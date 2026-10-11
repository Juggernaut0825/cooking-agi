from contextlib import redirect_stdout
import io
from itertools import product
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


def load_lesson(suffix):
    source = (ROOT / f"07-evaluation/metric-robustness{suffix}").read_text()
    blocks = re.findall(r"```python\n(.*?)\n```", source, re.S)
    selected = [block for block in blocks if "def exact_mcnemar(" in block]
    if len(selected) != 1:
        raise AssertionError("Expected one executable McNemar example")
    namespace = {}
    with redirect_stdout(io.StringIO()):
        exec(compile(selected[0], "metric-robustness" + suffix, "exec"), namespace)
    return source, selected[0], namespace["exact_mcnemar"]


class EvaluationEvidenceTests(unittest.TestCase):
    def test_both_language_examples_execute_identically(self):
        chinese = load_lesson(".md")
        english = load_lesson(".en.md")
        self.assertEqual(chinese[1], english[1])
        for gained, lost in ((60, 40), (20, 0), (2, 1), (0, 0)):
            self.assertEqual(chinese[2](gained, lost), english[2](gained, lost))

    def test_actual_article_tables_have_equal_gains_but_different_discordance(self):
        for suffix in (".md", ".en.md"):
            source, _, calculate = load_lesson(suffix)
            rows = re.findall(r"^\| [^|\n]+ \| (\d+) \| (\d+) \|$", source, re.M)
            self.assertEqual(len(rows), 4)
            comparisons = list(zip(*(tuple(map(int, row)) for row in rows)))
            self.assertEqual(comparisons, [(100, 40, 60, 0), (140, 0, 20, 40)])
            for both_correct, lost, gained, both_wrong in comparisons:
                total = both_correct + lost + gained + both_wrong
                self.assertEqual(total, 200)
                self.assertEqual(both_correct + lost, 140)
                self.assertEqual(both_correct + gained, 160)
                self.assertEqual((gained - lost) / total, 0.1)
            self.assertAlmostEqual(calculate(60, 40), 0.056887933640980784)
            self.assertEqual(calculate(20, 0), 1.9073486328125e-06)

    def test_small_counts_match_exhaustive_null_outcomes(self):
        _, _, calculate = load_lesson(".md")
        for total in range(1, 11):
            outcomes = [sum(bits) for bits in product((0, 1), repeat=total)]
            for gained in range(total + 1):
                observed_distance = abs(2 * gained - total)
                extreme = sum(abs(2 * outcome - total) >= observed_distance for outcome in outcomes)
                with self.subTest(total=total, gained=gained):
                    self.assertEqual(calculate(gained, total - gained), extreme / len(outcomes))

    def test_reversing_model_order_preserves_two_sided_value(self):
        _, _, calculate = load_lesson(".md")
        for gained in range(15):
            for lost in range(15):
                probability = calculate(gained, lost)
                self.assertEqual(probability, calculate(lost, gained))
                self.assertGreaterEqual(probability, 0)
                self.assertLessEqual(probability, 1)

    def test_no_disagreements_balanced_and_unanimous_changes(self):
        _, _, calculate = load_lesson(".md")
        self.assertEqual(calculate(0, 0), 1)
        self.assertEqual(calculate(1, 0), 1)
        self.assertEqual(calculate(2, 1), 1)
        self.assertEqual(calculate(50, 50), 1)
        self.assertEqual(calculate(0, 20), 2 / 2 ** 20)

    def test_invalid_counts_are_not_coerced(self):
        _, _, calculate = load_lesson(".md")
        for invalid in (-1, 1.5, 1.0, True, False, None, "2", []):
            for pair in ((invalid, 2), (2, invalid)):
                with self.subTest(pair=pair), self.assertRaises(ValueError):
                    calculate(*pair)

    def test_project_example_uses_actual_paired_fixture_labels(self):
        _, _, calculate = load_lesson(".md")
        fixtures = ROOT / "practice/web-lab/code/eval-fixtures"
        results = []
        for name in ("baseline.json", "candidate.json"):
            document = json.loads((fixtures / name).read_text())
            results.append({row["id"]: row["passed"] for row in document["results"]})
        baseline, candidate = results
        self.assertEqual(baseline.keys(), candidate.keys())
        gained = sum(candidate[key] and not baseline[key] for key in baseline)
        lost = sum(baseline[key] and not candidate[key] for key in baseline)
        self.assertEqual((gained, lost), (2, 1))
        self.assertEqual(calculate(gained, lost), 1)

    def test_statistics_do_not_replace_the_ci_gate(self):
        source = (ROOT / "practice/web-lab/code/eval_report.py").read_text()
        self.assertNotIn("exact_mcnemar", source)
        self.assertNotIn("scipy", source)
        for suffix in (".md", ".en.md"):
            lesson, _, _ = load_lesson(suffix)
            project = (ROOT / f"practice/web-lab/eval-report{suffix}").read_text()
            self.assertIn("{#paired-binary}", lesson)
            self.assertIn("{#paired-bootstrap}", lesson)
            self.assertIn("{#gate-and-evidence}", project)
            self.assertIn(f"metric-robustness{suffix}#paired-binary", project)


if __name__ == "__main__":
    unittest.main()
