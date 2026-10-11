from contextlib import redirect_stdout
from html.parser import HTMLParser
import io
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "site"))
import build


class ReadingMarkup(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.depth = 0
        self.ids = {}
        self.figures = []
        self.folded_text = []
        self.visible_text = []
        self.feed(body)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "details":
            self.depth += 1
        if "id" in attrs:
            self.ids[attrs["id"]] = self.depth
        if tag == "figure":
            self.figures.append((attrs, self.depth))

    def handle_endtag(self, tag):
        if tag == "details":
            self.depth -= 1

    def handle_data(self, text):
        (self.folded_text if self.depth else self.visible_text).append(text)


class BilingualReadabilityTests(unittest.TestCase):
    def source(self, path, suffix):
        return (ROOT / f"{path}{suffix}.md").read_text()

    def calculation(self, suffix):
        source = self.source("00-foundations/core/bert", suffix)
        return re.search(r"```python\n(.*?)```", source, re.S).group(1)

    def run_calculation(self):
        namespace = {}
        with redirect_stdout(io.StringIO()):
            exec(compile(self.calculation(""), "bert-context-example", "exec"), namespace)
        return namespace

    def test_both_languages_run_the_same_calculation(self):
        self.assertEqual(self.calculation(""), self.calculation(".en"))
        result = self.run_calculation()
        for actual, expected in zip(result["weights"], [0.2, 0.3, 0.5]):
            self.assertAlmostEqual(actual, expected)
        for key, expected in [("before", [1.2, 1.1]), ("after", [1.6, 1.1])]:
            for actual, target in zip(result[key], expected):
                self.assertAlmostEqual(actual, target)

    def test_context_change_matches_the_weighted_delta(self):
        result = self.run_calculation()
        change = [after - before for before, after in zip(result["before"], result["after"])]
        self.assertAlmostEqual(change[0], result["weights"][0] * 2)
        self.assertAlmostEqual(change[1], 0)

    def test_mixing_identical_values_preserves_them(self):
        result = self.run_calculation()
        mixed = result["mix"]([[4.0, -2.0]] * 3)
        self.assertAlmostEqual(mixed[0], 4)
        self.assertAlmostEqual(mixed[1], -2)
        self.assertAlmostEqual(sum(result["weights"]), 1)

    def test_context_figure_and_diagnosis_are_not_hidden(self):
        for suffix, language in [("", "zh-CN"), (".en", "en")]:
            with self.subTest(language=language):
                body, _ = build.render_markdown(self.source("00-foundations/core/bert", suffix))
                parsed = ReadingMarkup(body)
                for anchor in ["context-calculation", "context-mixture", "inspect-a-mistake"]:
                    self.assertEqual(parsed.ids[anchor], 0)
                figures = {attrs["id"]: (attrs, depth) for attrs, depth in parsed.figures}
                self.assertEqual(set(figures), {"context-mixture", "answer-boundaries"})
                attrs, depth = figures["context-mixture"]
                self.assertEqual(attrs["lang"], language)
                self.assertEqual(depth, 0)
                figure = re.search(r'<figure.*?</figure>', body, re.S).group()
                self.assertEqual(figure.count("<li>"), 3)
                if suffix:
                    self.assertNotRegex(figure, r"[\u4e00-\u9fff]")
                else:
                    self.assertIn("传入", figure)
                    self.assertNotIn("Contributes", figure)

    def test_dpo_derivation_is_optional_but_example_is_visible(self):
        for suffix in ["", ".en"]:
            with self.subTest(language=suffix):
                body, _ = build.render_markdown(self.source("05-post-training/rlhf/after-rlhf", suffix))
                parsed = ReadingMarkup(body)
                self.assertEqual(parsed.ids["dpo-example"], 0)
                self.assertEqual(parsed.ids["method-comparison"], 0)
                self.assertIn("Bradley", "".join(parsed.folded_text))
                self.assertIn("0.513", "".join(parsed.visible_text))
                self.assertIn("Reference", "".join(parsed.visible_text))

    def test_dpo_example_matches_the_displayed_comparison(self):
        codes = []
        for suffix in ["", ".en"]:
            source = self.source("05-post-training/rlhf/after-rlhf", suffix)
            example = source.split("{#dpo-example}", 1)[1]
            code = re.search(r"```python\n(.*?)```", example, re.S).group(1)
            codes.append(code)
            namespace = {}
            with redirect_stdout(io.StringIO()):
                exec(compile(code, "dpo-example", "exec"), namespace)
            self.assertAlmostEqual(namespace["relative_gap"], 2)
            self.assertAlmostEqual(namespace["loss"], 0.5130152523999526)
            body, _ = build.render_markdown(source)
            markup = ReadingMarkup(body)
            self.assertEqual(markup.ids["dpo-score-changes"], 0)
            figures = {attrs["id"]: (attrs, depth) for attrs, depth in markup.figures}
            self.assertEqual(figures["dpo-score-changes"][0]["lang"], "en" if suffix else "zh-CN")
            figure = re.search(r'<figure[^>]*id="dpo-score-changes".*?</figure>', body, re.S).group()
            self.assertEqual(figure.count("<li>"), 2)
            self.assertIn("−3 → −2", figure)
            self.assertIn("−3 → −4", figure)
            self.assertIn("+1", figure)
            self.assertIn("−1", figure)
        self.assertEqual(*codes)

    def test_equal_policy_and_reference_zeroes_gap_not_answer_probabilities(self):
        preferred, rejected = -2.0, -5.0
        gap = (preferred - preferred) - (rejected - rejected)
        self.assertEqual(gap, 0)
        self.assertNotEqual(math.exp(preferred), math.exp(rejected))
        self.assertAlmostEqual(math.log1p(math.exp(-0.2 * gap)), math.log(2))


class RouterCopyTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js required")
    def test_initial_slider_values_are_on_their_step_grid(self):
        source = (ROOT / "site/static/tx-lab.js").read_text()
        start = source.index("  var P = { hard: 35")
        end = source.index("  var W = 560", start)
        script = source[start:end] + "\nconsole.log(JSON.stringify(P));"
        parameters = json.loads(subprocess.check_output([shutil.which("node"), "-e", script], text=True))
        controls = re.findall(r"min: (\d+), max: (\d+), step: (\d+), value: P\.(\w+)", source[end:])
        controls = [control for control in controls if control[3] in parameters]
        self.assertEqual(len(controls), 4)
        for minimum, maximum, step, parameter in controls:
            with self.subTest(parameter=parameter):
                value = parameters[parameter]
                self.assertGreaterEqual(value, int(minimum))
                self.assertLessEqual(value, int(maximum))
                self.assertEqual((value - int(minimum)) % int(step), 0)

    @unittest.skipUnless(shutil.which("node"), "Node.js required")
    def test_router_overhead_copy_matches_the_computed_cost_and_latency(self):
        path = ROOT / "site/static/tx-lab.js"
        source = path.read_text()
        start = source.index("  var P = { hard: 35")
        end = source.index("  var W = 560", start)
        script = source[start:end] + "\nconsole.log(JSON.stringify({parameters: P, plans: plans()}));"
        result = subprocess.run([shutil.which("node"), "-e", script],
                                text=True, capture_output=True, check=True)
        output = json.loads(result.stdout)
        parameters, plans = output["parameters"], output["plans"]
        hard = parameters["hard"] / 100
        judge = parameters["judge"] / 100
        sent = hard * judge + (1 - hard) * (1 - judge)
        model_cost = sent * parameters["cost"] + (1 - sent)
        model_latency = sent * 2.2 + (1 - sent)
        self.assertAlmostEqual(plans["router"]["c"] - model_cost, 0.05)
        self.assertAlmostEqual(plans["router"]["lat"] - model_latency, 0.1)
        caption = re.search(r"TX\.bi\(note,\s*'([^']*)',\s*'([^']*)'\);", source[end:])
        self.assertIsNotNone(caption)
        self.assertIn("Checking overhead is omitted", caption[1])
        self.assertIn("routing adds fixed toy overheads of 0.05 cost units and 0.1 latency units", caption[1])
        self.assertIn("检查开销未计入", caption[2])
        self.assertIn("路由另加固定的示意开销：成本 0.05、延迟 0.1", caption[2])


if __name__ == "__main__":
    unittest.main()
