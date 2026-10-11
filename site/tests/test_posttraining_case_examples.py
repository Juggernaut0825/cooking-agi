import contextlib
from fractions import Fraction
import io
import itertools
import math
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


class PosttrainingCaseExampleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prefix_examples = []
        cls.case_pages = []
        for suffix in (".md", ".en.md"):
            source = ROOT / ("05-post-training/model-adaptation" + suffix)
            snippets = re.findall(r"```python\n(.*?)```", source.read_text(encoding="utf-8"), re.S)
            examples = [snippet for snippet in snippets if "def legal_next_tokens(" in snippet]
            if len(examples) != 1:
                raise AssertionError(f"Expected one prefix example in {source}")
            namespace = {}
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                exec(compile(examples[0], str(source), "exec"), namespace)
            cls.prefix_examples.append((examples[0], namespace, output.getvalue()))
            case = ROOT / ("05-post-training/same-base-different-posttraining" + suffix)
            cls.case_pages.append(case.read_text(encoding="utf-8"))

    def test_bilingual_prefix_examples_match_and_execute(self):
        self.assertEqual(self.prefix_examples[0][0], self.prefix_examples[1][0])
        expected = "['a']\n['b', 'c']\n['<EOS>']\n[]\n"
        for snippet, namespace, output in self.prefix_examples:
            self.assertEqual(output, expected)

    def test_prefix_constraints_accept_exactly_the_label_sequences(self):
        candidates = [
            tokens
            for length in range(1, 4)
            for tokens in itertools.product(("a", "b"), repeat=length)
        ]
        label_sets = [
            labels
            for size in (1, 2)
            for labels in itertools.combinations(candidates, size)
        ]
        payloads = [
            tokens
            for length in range(4)
            for tokens in itertools.product(("a", "b"), repeat=length)
        ]
        checked = 0
        for snippet, namespace, output in self.prefix_examples:
            legal_next_tokens = namespace["legal_next_tokens"]
            for labels in label_sets:
                for payload in payloads:
                    prefix = ()
                    accepted = True
                    for token in payload + ("<EOS>",):
                        if token not in legal_next_tokens(prefix, labels):
                            accepted = False
                            break
                        if token != "<EOS>":
                            prefix += (token,)
                    self.assertEqual(accepted, payload in labels, (labels, payload))
                    checked += 1
        self.assertEqual(len(label_sets), 105)
        self.assertEqual(checked, 3150)

    def test_whitelists_termination_and_overlapping_labels(self):
        for snippet, namespace, output in self.prefix_examples:
            legal_next_tokens = namespace["legal_next_tokens"]
            labels = namespace["labels"]
            whitelist = {token for label in labels for token in label}
            self.assertTrue(set(("b", "a")).issubset(whitelist))
            self.assertNotIn(("b", "a"), labels)
            self.assertNotIn("b", legal_next_tokens((), labels))
            self.assertNotIn("<EOS>", legal_next_tokens(("a",), labels))
            self.assertEqual(legal_next_tokens(("b",), labels), set())
            overlapping = (("a",), ("a", "b"))
            self.assertEqual(legal_next_tokens(("a",), overlapping), {"<EOS>", "b"})
            self.assertEqual(legal_next_tokens(("a", "b"), overlapping), {"<EOS>"})
            singles = (("A",), ("B",), ("C",))
            self.assertEqual(legal_next_tokens((), singles), {"A", "B", "C"})
            self.assertEqual(legal_next_tokens(("A",), singles), {"<EOS>"})
            self.assertNotIn(("A", "A"), singles)
            self.assertEqual(legal_next_tokens(("A", "A"), singles), set())

    def test_matched_and_cross_effort_arithmetic_in_both_pages(self):
        tables = [
            re.findall(r"\| (GLM-5\.[23]) \| (Max|High) \| ([\d.]+)% \| (\d+)k \|", page)
            for page in self.case_pages
        ]
        self.assertEqual(tables[0], tables[1])
        self.assertEqual(len(tables[0]), 3)
        for page, rows in zip(self.case_pages, tables):
            values = {
                (model, effort): (Fraction(score), int(tokens) * 1000)
                for model, effort, score, tokens in rows
            }
            old_score, old_tokens = values[("GLM-5.2", "Max")]
            max_score, max_tokens = values[("GLM-5.3", "Max")]
            high_score, high_tokens = values[("GLM-5.3", "High")]
            self.assertGreater(max_score, old_score)
            self.assertGreater(high_score, old_score)
            matched_reduction = Fraction(old_tokens - max_tokens, old_tokens) * 100
            cross_reduction = Fraction(old_tokens - high_tokens, old_tokens) * 100
            self.assertEqual(matched_reduction, Fraction(175, 8))
            self.assertEqual(cross_reduction, Fraction(575, 12))
            self.assertIn(f"{float(matched_reduction):.3f}", page)
            self.assertIn(f"{float(cross_reduction):.2f}", page)

    def test_ratio_example_is_token_dependent_before_any_weight_update(self):
        rollout = (Fraction(1, 2), Fraction(1, 2))
        training = (Fraction(3, 5), Fraction(2, 5))
        self.assertEqual(sum(rollout), 1)
        self.assertEqual(sum(training), 1)
        ratios = tuple(target / behavior for target, behavior in zip(training, rollout))
        self.assertEqual(ratios, (Fraction(6, 5), Fraction(4, 5)))
        self.assertNotEqual(ratios[0], ratios[1])
        self.assertEqual(sum(behavior * ratio for behavior, ratio in zip(rollout, ratios)), 1)
        for target, behavior, ratio in zip(training, rollout, ratios):
            self.assertAlmostEqual(math.exp(math.log(target) - math.log(behavior)), float(ratio))
        for page in self.case_pages:
            self.assertIn(r"q(\cdot\mid s)=(0.5,0.5)", page)
            self.assertIn(r"p_{\theta_0}(\cdot\mid s)=(0.6,0.4)", page)
            self.assertIn("$(1.2,0.8)$", page)

    def test_synthetic_baseline_and_aggregation_counterexamples(self):
        for task_success in (0.046, 0.283):
            step_success = task_success ** (1 / 25)
            self.assertAlmostEqual(step_success ** 25, task_success, places=14)
            for page in self.case_pages:
                self.assertIn(f"{step_success:.6f}", page)
        outcomes = (0, 0, 1)
        self.assertEqual(Fraction(sum(outcomes), len(outcomes)), Fraction(1, 3))
        self.assertEqual(int(any(outcomes)), 1)
        mean_absolute_error = Fraction(1, 10_000_000)
        self.assertEqual(float(mean_absolute_error), 1e-7)
        self.assertGreater(1, mean_absolute_error)
        self.assertEqual(sum((Fraction(-1, 10), Fraction(1, 10))), 0)
        for page in self.case_pages:
            self.assertIn("[0, 0, 1]", page)
            self.assertIn("$1/3$", page)
            self.assertIn("$10^7$", page)
            self.assertIn("$10^{-7}$", page)


if __name__ == "__main__":
    unittest.main()
