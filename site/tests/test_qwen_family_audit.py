import contextlib
from fractions import Fraction
from html.parser import HTMLParser
import io
from pathlib import Path
import re
import unittest

try:
    import markdown
except ModuleNotFoundError:
    markdown = None


ROOT = Path(__file__).resolve().parents[2]
FAMILIES = ROOT / "00-foundations/model-families"
LEGACY_HEADINGS = {
    "qwen.md": {
        "Qwen 精读：一个家族，多种规模与推理模式": "qwen",
        "一句话定位": "_1",
        "先把三种“省计算”分开": "_2",
        "真正值得抓住的三件事": "_3",
        "取舍表": "_4",
        "后训练不是所有型号都走同一条线": "_5",
        "Qwen3.5：线性状态与完整历史各负责什么？": "qwen35",
        "2026 更新：Qwen3.8 不是一种统一结构": "2026-qwen38",
        "Flash-Next 的参数账，为什么不能只看 6B？": "flash-next-6b",
        "模型卡上的成绩该怎么读？": "_6",
        "我会怎样使用这个家族": "_7",
        "自检": "_8",
        "原始资料": "_9",
    },
    "qwen.en.md": {
        "Qwen deep dive: one family across scales and reasoning modes": "qwen-deep-dive-one-family-across-scales-and-reasoning-modes",
        "One-sentence position": "one-sentence-position",
        "Separate three ways to spend less compute": "separate-three-ways-to-spend-less-compute",
        "Three ideas worth keeping": "three-ideas-worth-keeping",
        "Trade-offs": "trade-offs",
        "Not every size follows the same training route": "not-every-size-follows-the-same-training-route",
        "Qwen3.5: recurrent state versus full history": "qwen35-recurrent-state-versus-full-history",
        "2026 update: Qwen3.8 is not one uniform architecture": "2026-update-qwen38-is-not-one-uniform-architecture",
        "Why is 6B not Flash-Next's complete resource budget?": "why-is-6b-not-flash-nexts-complete-resource-budget",
        "How should we interpret model-card scores?": "how-should-we-interpret-model-card-scores",
        "How I would use the family": "how-i-would-use-the-family",
        "Self-check": "self-check",
        "Primary sources": "primary-sources",
    },
    "qwen-early.md": {
        "Qwen 1–2.5：哪些改了架构，哪些改了训练？": "qwen-125",
        "先认准讨论的是哪个版本": "_1",
        "Qwen：从输入到 loss，看完整一次": "qwen-loss",
        "Qwen1.5：接口也是实验的一部分": "qwen15",
        "Qwen2：GQA 的账可以单独算": "qwen2gqa",
        "Qwen2.5：架构相近，训练配方仍然很重要": "qwen25",
        "做一个不会混淆因素的小实验": "_2",
    },
    "qwen-early.en.md": {
        "Qwen 1–2.5: separating architecture changes from training changes": "qwen-125-separating-architecture-changes-from-training-changes",
        "Identify the exact version first": "identify-the-exact-version-first",
        "Qwen: follow the input through to the loss": "qwen-follow-the-input-through-to-the-loss",
        "Qwen1.5: interfaces are part of the experiment": "qwen15-interfaces-are-part-of-the-experiment",
        "Qwen2: calculate GQA's savings separately": "qwen2-calculate-gqas-savings-separately",
        "Qwen2.5: similar architecture still leaves substantial training choices": "qwen25-similar-architecture-still-leaves-substantial-training-choices",
        "A small experiment that keeps factors separate": "a-small-experiment-that-keeps-factors-separate",
    },
}


def source(name, suffix=".md"):
    return (FAMILIES / (name + suffix)).read_text(encoding="utf-8")


def snippets(name, suffix=".md"):
    return re.findall(r"```python\n(.*?)```", source(name, suffix), re.S)


def namespace(name, suffix=".md"):
    result = {}
    with contextlib.redirect_stdout(io.StringIO()):
        for snippet in snippets(name, suffix):
            exec(compile(snippet, name + suffix, "exec"), result)
    return result


class Headings(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.current = None
        self.headings = {}
        self.ids = []
        self.feed(body)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag in ("h1", "h2", "h3"):
            self.current = [attrs.get("id"), ""]

    def handle_data(self, data):
        if self.current is not None:
            self.current[1] += data

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3") and self.current is not None:
            identifier, label = self.current
            self.headings[label] = identifier
            self.current = None


class QwenFamilyAuditTests(unittest.TestCase):
    def test_bilingual_examples_match_and_execute(self):
        for name in ("qwen", "qwen-early"):
            with self.subTest(name=name):
                self.assertTrue(snippets(name))
                self.assertEqual(snippets(name), snippets(name, ".en.md"))
                namespace(name)
                namespace(name, ".en.md")

    def test_qwen2_raw_cache_example(self):
        result = namespace("qwen-early")
        self.assertEqual(result["qwen2_gqa"], 469762048)
        self.assertEqual(result["qwen2_mha"], 3288334336)
        self.assertEqual(result["qwen2_gqa"] / result["qwen2_mha"], 1 / 7)

    def test_cache_scaling_and_empty_sequence(self):
        count = namespace("qwen-early")["kv_cache_bytes"]
        dimensions = dict(batch=1, layers=28, tokens=8192, kv_heads=4, head_dim=128, bytes_per_value=2)
        baseline = count(**dimensions)
        for field in dimensions:
            changed = dict(dimensions)
            changed[field] *= 2
            with self.subTest(field=field):
                self.assertEqual(count(**changed), 2 * baseline)
        self.assertEqual(count(**dict(dimensions, tokens=0)), 0)

    def test_cache_rejects_invalid_dimensions(self):
        count = namespace("qwen-early")["kv_cache_bytes"]
        dimensions = dict(batch=1, layers=28, tokens=8192, kv_heads=4, head_dim=128, bytes_per_value=2)
        for field in dimensions:
            invalid = (-1, True, 1.5, None) if field == "tokens" else (0, -1, True, 1.5, None)
            for value in invalid:
                with self.subTest(field=field, value=value):
                    with self.assertRaises(ValueError):
                        count(**dict(dimensions, **{field: value}))

    def test_original_qwen3_head_table(self):
        expected = [
            ("Qwen3-0.6B / 1.7B", "16", "8", "1/2"),
            ("Qwen3-4B / 8B", "32", "8", "1/4"),
            ("Qwen3-14B", "40", "8", "1/5"),
            ("Qwen3-32B", "64", "8", "1/8"),
            ("Qwen3-30B-A3B", "32", "4", "1/8"),
            ("Qwen3-235B-A22B", "64", "4", "1/16"),
        ]
        for suffix in (".md", ".en.md"):
            rows = re.findall(r"^\| (Qwen3-[^|]+?) \| (\d+) / (\d+) \| (\d+/\d+) \|$", source("qwen", suffix), re.M)
            self.assertEqual(rows, expected)
            for model, query_heads, kv_heads, fraction in rows:
                with self.subTest(model=model, suffix=suffix):
                    self.assertEqual(Fraction(int(kv_heads), int(query_heads)), Fraction(fraction))

    def test_early_gqa_head_table(self):
        for suffix in (".md", ".en.md"):
            text = source("qwen-early", suffix)
            for model, query_heads, kv_heads, fraction in (
                ("Qwen1.5-7B", 32, 32, "1"),
                ("Qwen1.5-32B", 40, 8, "1/5"),
                ("Qwen2-7B", 28, 4, "1/7"),
                ("Qwen2.5-7B-Instruct", 28, 4, "1/7"),
            ):
                row = next(line for line in text.splitlines() if line.startswith("| [" + model + "]"))
                self.assertIn(f"| {query_heads} / {kv_heads} | {fraction}", row)
                self.assertEqual(Fraction(kv_heads, query_heads), Fraction(fraction))

    def test_causal_pair_count_matches_enumeration(self):
        count = namespace("qwen")["causal_read_pairs"]
        for tokens in range(100):
            self.assertEqual(count(tokens), sum(range(1, tokens + 1)))
            for budget in (1, 4, 8, 32, 128):
                with self.subTest(tokens=tokens, budget=budget):
                    self.assertEqual(count(tokens, budget), sum(min(position, budget) for position in range(1, tokens + 1)))

    def test_budget_covering_context_is_dense(self):
        count = namespace("qwen")["causal_read_pairs"]
        self.assertEqual(count(0, 2048), 0)
        self.assertEqual(count(1, 2048), 1)
        self.assertEqual(count(2048, 2048), count(2048))
        self.assertEqual(count(2049, 2048), count(2049) - 1)
        self.assertEqual(count(32768, 65536), count(32768))

    def test_decode_and_prefill_fractions_are_distinct(self):
        result = namespace("qwen")
        self.assertEqual(result["decode_fraction"], 0.0625)
        self.assertAlmostEqual(result["prefill_fraction"], 0.121092, places=6)
        self.assertGreater(result["prefill_fraction"], result["decode_fraction"])
        for suffix in (".md", ".en.md"):
            self.assertIn("0.121092", source("qwen", suffix))
            self.assertIn("6.25%", source("qwen", suffix))

    def test_pair_count_rejects_invalid_inputs(self):
        count = namespace("qwen")["causal_read_pairs"]
        for tokens in (-1, True, 1.5, None):
            with self.subTest(tokens=tokens):
                with self.assertRaises(ValueError):
                    count(tokens, 1)
        for budget in (0, -1, True, 1.5):
            with self.subTest(budget=budget):
                with self.assertRaises(ValueError):
                    count(1, budget)

    def test_source_links_and_new_anchors_match_languages(self):
        for name in ("qwen", "qwen-early"):
            chinese, english = source(name), source(name, ".en.md")
            urls = lambda text: set(re.findall(r"\]\((https://[^)]+)\)", text))
            self.assertEqual(urls(chinese), urls(english))
            self.assertIn("2026-10-10", chinese)
            self.assertIn("2026-10-10", english)
            self.assertIn(f"({name}.en.md)", chinese)
            self.assertIn(f"({name}.md)", english)
        expected = {"original-qwen3-config", "qwen-thinking-switches", "qwen3-next-boundary"}
        for suffix in (".md", ".en.md"):
            self.assertEqual(set(re.findall(r"\{#([^}]+)\}", source("qwen", suffix))), expected)

    @unittest.skipIf(markdown is None, "optional Python-Markdown is unavailable")
    def test_all_legacy_heading_ids_remain_unique_and_attached(self):
        for filename, expected in LEGACY_HEADINGS.items():
            with self.subTest(filename=filename):
                parser = markdown.Markdown(extensions=["fenced_code", "tables", "attr_list", "toc"])
                parsed = Headings(parser.convert((FAMILIES / filename).read_text(encoding="utf-8")))
                self.assertEqual(len(parsed.ids), len(set(parsed.ids)))
                for label, identifier in expected.items():
                    self.assertEqual(parsed.headings[label], identifier)


if __name__ == "__main__":
    unittest.main()
