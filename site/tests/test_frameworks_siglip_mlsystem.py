import ast
import math
from pathlib import Path
import re
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "site"))
import build
import paritycheck


CHAPTERS = {
    "06-systems/training-frameworks": "pretraining",
    "06-systems/inference-frameworks": "inference",
    "03-multimodal-learning/siglip": "multimodal",
    "practice/ml-system/README": "ml-systems",
    "practice/ml-system/data-to-model": "ml-systems",
    "practice/ml-system/serving-and-feedback": "ml-systems",
}


def source(chapter, suffix=""):
    return (ROOT / f"{chapter}{suffix}.md").read_text()


def blocks(chapter, suffix=""):
    return re.findall(r"```python\n(.*?)```", source(chapter, suffix), re.S)


def example_namespace(chapter):
    namespace = {}
    for block in blocks(chapter):
        exec(compile(block, chapter, "exec"), namespace)
    return namespace


class FrameworksSiglipSystemTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.siglip = example_namespace("03-multimodal-learning/siglip")
        cls.data = example_namespace("practice/ml-system/data-to-model")
        cls.serving = example_namespace("practice/ml-system/serving-and-feedback")

    def test_bilingual_structure_anchors_and_code(self):
        for chapter in CHAPTERS:
            with self.subTest(chapter=chapter):
                chinese, english = source(chapter), source(chapter, ".en")
                self.assertEqual(paritycheck.shape(chinese), paritycheck.shape(english))
                self.assertEqual(re.findall(r"\{#([^}]+)\}", chinese), re.findall(r"\{#([^}]+)\}", english))
                self.assertEqual(blocks(chapter), blocks(chapter, ".en"))
                for block in blocks(chapter):
                    ast.parse(block)

    def test_each_note_has_one_correct_navigation_location(self):
        previous_nav, previous_sources = build.NAV.copy(), build.BY_SRC.copy()
        try:
            pages, _ = build.discover(build.load_nav())
            for chapter, group in CHAPTERS.items():
                for suffix, language in (("", "zh"), (".en", "en")):
                    matches = [page for page in pages if page.src == ROOT / f"{chapter}{suffix}.md"]
                    self.assertEqual(len(matches), 1, chapter)
                    self.assertEqual(matches[0].section["group"], group)
                    self.assertEqual(matches[0].lang, language)
        finally:
            build.NAV.clear()
            build.NAV.update(previous_nav)
            build.BY_SRC.clear()
            build.BY_SRC.update(previous_sources)

    def test_local_links_exist_and_keep_language(self):
        for chapter in CHAPTERS:
            for suffix in ("", ".en"):
                path = ROOT / f"{chapter}{suffix}.md"
                links = re.findall(r"\]\(([^)]+\.md)(?:#[^)]*)?\)", source(chapter, suffix))
                self.assertTrue(links, chapter)
                for position, link in enumerate(links):
                    target = (path.parent / link).resolve()
                    self.assertTrue(target.is_file(), str(target))
                    if position:
                        self.assertEqual(target.name.endswith(".en.md"), suffix == ".en", link)

    def test_figures_are_localized(self):
        count = 0
        for chapter in CHAPTERS:
            for suffix in ("", ".en"):
                for figure in re.findall(r"<figure.*?</figure>", source(chapter, suffix), re.S):
                    count += 1
                    self.assertIn(f'lang="{"en" if suffix else "zh-CN"}"', figure)
                    if suffix:
                        self.assertNotRegex(figure, r"[\u4e00-\u9fff]")
                    else:
                        self.assertRegex(figure, r"[\u4e00-\u9fff]")
        self.assertEqual(count, 10)

    def test_siglip_normalizes_by_batch_not_pairs(self):
        calculate = self.siglip["siglip_loss"]
        self.assertAlmostEqual(calculate([[2, -2], [-2, 2]]), 0.253856022085945)
        for batch_size in (1, 2, 4, 16):
            self.assertAlmostEqual(calculate([[0] * batch_size for _ in range(batch_size)]), batch_size * math.log(2))

    def test_siglip_stable_extremes_and_validation(self):
        pair_loss = self.siglip["pair_loss"]
        self.assertEqual(pair_loss(1000, True), 0)
        self.assertEqual(pair_loss(-1000, False), 0)
        self.assertEqual(pair_loss(-1000, True), 1000)
        self.assertEqual(pair_loss(1000, False), 1000)
        for invalid in (math.inf, -math.inf, math.nan):
            with self.assertRaises(ValueError):
                pair_loss(invalid, True)
        for matrix in ([], [[1, 2]], [[1], [2]], [[math.nan]]):
            with self.assertRaises(ValueError):
                self.siglip["siglip_loss"](matrix)

    def test_pair_gradient_matches_logistic_derivative(self):
        pair_loss = self.siglip["pair_loss"]
        delta = 1e-5
        for logit in (-4, -1, 0, 1, 4):
            for positive in (False, True):
                numerical = (pair_loss(logit + delta, positive) - pair_loss(logit - delta, positive)) / (2 * delta)
                expected = 1 / (1 + math.exp(-logit)) - int(positive)
                self.assertAlmostEqual(numerical, expected, places=8)

    def test_candidate_comparison_numbers(self):
        self.assertAlmostEqual(1 / (1 + math.exp(-2)), 0.8807970779778823)
        self.assertAlmostEqual(math.exp(2) / (math.exp(2) + math.exp(-2)), 0.9820137900379085)
        self.assertAlmostEqual(math.exp(2) / (2 * math.exp(2) + math.exp(-2)), 0.4954626425778431)

    def test_point_in_time_blocks_late_and_future_records(self):
        lookup = self.data["feature_as_of"]
        records = self.data["records"]
        self.assertEqual(lookup(records, "user-a", 600)["value"], 2)
        self.assertEqual(lookup(records, "user-a", 602)["value"], 3)
        self.assertIsNone(lookup(records, "unknown", 700))
        self.assertIsNone(lookup(records, "user-a", 589))
        self.assertIsNone(lookup([], "user-a", 700))
        future = {"entity": "user-a", "event_at": 605, "available_at": 590, "value": 9}
        self.assertEqual(lookup([future] + records, "user-a", 600)["value"], 2)
        self.assertEqual(lookup(list(reversed(records)), "user-a", 603)["value"], 3)

    def test_speedup_uses_unchanged_work(self):
        calculate = self.serving["end_to_end_speedup"]
        self.assertAlmostEqual(calculate(500, 300, 3), 5 / 3)
        self.assertEqual(calculate(500, 0, 3), 1)
        self.assertEqual(calculate(500, 500, 4), 4)
        self.assertEqual(calculate(500, 300, 1), 1)
        self.assertLess(calculate(500, 300, 0.5), 1)
        for arguments in ((0, 0, 2), (500, 501, 2), (500, -1, 2), (500, 300, 0), (500, 300, math.inf)):
            with self.assertRaises(ValueError):
                calculate(*arguments)


if __name__ == "__main__":
    unittest.main()
