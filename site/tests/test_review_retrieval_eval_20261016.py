import ast
from collections import Counter
from contextlib import redirect_stdout
from fractions import Fraction
from functools import lru_cache
from io import StringIO
from itertools import product
import math
from pathlib import Path
import re
from statistics import mean
import unittest


ROOT = Path(__file__).resolve().parents[2]
EXAMPLE_STEMS = (
    "01-data-and-feedback/data-as-supervision",
    "01-data-and-feedback/feedback-to-objectives",
    "02-memory/memory-lifecycle",
    "04-search/dual-encoder",
    "04-search/hybrid-and-reranking",
    "04-search/tfidf-and-bm25",
    "04-search/vector-indexes",
    "07-evaluation/benchmark-protocols",
    "07-evaluation/metric-robustness",
    "07-evaluation/llm-as-a-judge/probability-scores",
    "10-agents/model-choice",
    "10-agents/tools-and-skills",
)


def python_blocks(stem, language):
    source = ROOT / f"{stem}{language}.md"
    return re.findall(r"```python\n(.*?)\n```", source.read_text(), re.S)


@lru_cache(maxsize=None)
def example_namespace(stem, language=""):
    namespace = {}
    with redirect_stdout(StringIO()):
        for block in python_blocks(stem, language):
            exec(compile(block, f"{stem}{language}.md", "exec"), namespace)
    return namespace


class RetrievalEvaluationReviewTests(unittest.TestCase):
    def test_bilingual_examples_match_and_execute(self):
        for stem in EXAMPLE_STEMS:
            with self.subTest(stem=stem):
                chinese = python_blocks(stem, "")
                english = python_blocks(stem, ".en")
                self.assertTrue(chinese)
                self.assertEqual([ast.dump(ast.parse(block)) for block in chinese],
                                 [ast.dump(ast.parse(block)) for block in english])
                for language in ("", ".en"):
                    example_namespace(stem, language)

    def test_centered_rewards_do_not_define_the_whole_objective(self):
        rewards = [0, 0, 1, 1]
        self.assertEqual([reward - mean(rewards) for reward in rewards],
                         [-0.5, -0.5, 0.5, 0.5])
        for rewards in ([0] * 4, [1] * 4):
            self.assertEqual([reward - mean(rewards) for reward in rewards], [0] * 4)
        probability, reference, coefficient = 0.7, 0.5, 0.1
        kl_derivative = coefficient * math.log(
            probability * (1 - reference) / (reference * (1 - probability)))
        self.assertGreater(kl_derivative, 0)

    def test_calibration_is_distinct_from_ranking(self):
        labels = [1] * 8 + [0] * 2 + [1] * 2 + [0] * 8
        self.assertEqual(mean(labels), 0.5)
        calibrated = [0.8] * 10 + [0.2] * 10
        overconfident = [0.99] * 10 + [0.90] * 10
        constant = [0.5] * 20
        self.assertEqual(sorted(range(20), key=calibrated.__getitem__),
                         sorted(range(20), key=overconfident.__getitem__))
        self.assertEqual(len(set(constant)), 1)
        for score in set(calibrated):
            group = [label for label, prediction in zip(labels, calibrated) if prediction == score]
            self.assertEqual(mean(group), score)
        for score in set(overconfident):
            group = [label for label, prediction in zip(labels, overconfident) if prediction == score]
            self.assertLess(mean(group), score)

    def test_judge_fixture_kappa_and_false_approval_denominators(self):
        source = (ROOT / "site/static/judge-lab.js").read_text()
        fixture = re.search(r"const calibrationRows = \[(.*?)\n  \];", source, re.S).group(1)
        rows = [(human == "pass", float(score)) for human, score in
                re.findall(r"human: '(pass|fail)', score: ([0-9.]+)", fixture)]
        self.assertEqual(len(rows), 12)
        for threshold, expected in ((3.5, (4, 3, 2, 3)), (4, (3, 2, 3, 4))):
            with self.subTest(threshold=threshold):
                counts = Counter((human, score >= threshold) for human, score in rows)
                actual = tuple(counts[pair] for pair in ((True, True), (False, True),
                                                        (True, False), (False, False)))
                self.assertEqual(actual, expected)
                true_positive, false_positive, false_negative, true_negative = actual
                observed = Fraction(true_positive + true_negative, len(rows))
                human_positive = Fraction(true_positive + false_negative, len(rows))
                predicted_positive = Fraction(true_positive + false_positive, len(rows))
                chance = (human_positive * predicted_positive
                          + (1 - human_positive) * (1 - predicted_positive))
                self.assertEqual(observed, Fraction(7, 12))
                self.assertEqual((observed - chance) / (1 - chance), Fraction(1, 6))
        self.assertEqual(Fraction(3, 4 + 3), Fraction(3, 7))
        self.assertEqual(Fraction(3, 3 + 3), Fraction(1, 2))
        self.assertEqual(sum(abs(score - 4) <= 0.5 for _, score in rows), 6)

    def test_exact_mcnemar_against_enumerated_null_distribution(self):
        function = example_namespace("07-evaluation/metric-robustness")["exact_mcnemar"]
        for gained, lost in ((10, 6), (3, 1), (0, 0), (2, 2)):
            total = gained + lost
            tail_count = sum(sum(outcome) <= min(gained, lost)
                             for outcome in product((0, 1), repeat=total))
            expected = min(1, 2 * tail_count / 2 ** total)
            self.assertEqual(function(gained, lost), expected)
            self.assertEqual(function(lost, gained), expected)
        self.assertAlmostEqual(function(60, 40), 0.0568879336409808)
        self.assertEqual(function(20, 0), 2 / 2 ** 20)
        for invalid in ((-1, 0), (1.5, 0), (True, 0)):
            with self.assertRaises(ValueError):
                function(*invalid)

    def test_bootstrap_preserves_pairs_and_zero_is_in_interval(self):
        namespace = example_namespace("07-evaluation/metric-robustness")
        paired = [new - old for old, new in zip(namespace["old_scores"], namespace["new_scores"])]
        self.assertEqual(namespace["differences"], paired)
        self.assertAlmostEqual(mean(paired), 0.05)
        self.assertEqual(len(namespace["estimates"]), 4000)
        self.assertLessEqual(namespace["lower"], 0)
        self.assertGreaterEqual(namespace["upper"], 0)
        independent_half_width = 1.96 * math.sqrt(0.8 * 0.2 / 200 + 0.82 * 0.18 / 200)
        self.assertAlmostEqual(independent_half_width, 0.0768659924804201,
                               places=8)

    def test_inverse_propensity_variance_bias_and_missing_support(self):
        function = example_namespace("01-data-and-feedback/feedback-to-objectives")["contribution_moments"]
        self.assertEqual(function(Fraction(1, 2)), (1, 1))
        self.assertEqual(function(Fraction(1, 10)), (1, 9))
        self.assertEqual(function(Fraction(1, 10), Fraction(1, 4)),
                         (Fraction(2, 5), Fraction(36, 25)))
        for unsupported in (0, -1, 2):
            with self.assertRaises(ValueError):
                function(unsupported)

    def test_memory_filters_scope_time_and_current_deletion_status(self):
        function = example_namespace("02-memory/memory-lifecycle")["current_memories"]
        records = [dict(id="temporary", user="alice", scope="meeting", status="active",
                        observed=4, start=3, end=6, overrides=[])]
        self.assertEqual(function(records, "alice", "meeting", 3, known_at=3), [])
        self.assertEqual(function(records, "alice", "meeting", 3, known_at=4), ["temporary"])
        self.assertEqual(function(records, "bob", "meeting", 4), [])
        self.assertEqual(function(records, "alice", "mail", 4), [])
        self.assertEqual(function(records, "alice", "meeting", 6), [])
        records[0]["status"] = "deleted"
        self.assertEqual(function(records, "alice", "meeting", 4, known_at=4), [])

    def test_contrastive_gradient_and_candidate_dependence(self):
        function = example_namespace("04-search/dual-encoder")["contrastive_step"]
        scores, temperature, epsilon = [0.8, 0.2, -0.4], 0.7, 1e-6
        _, probabilities, gradients = function(scores, temperature)
        self.assertAlmostEqual(sum(probabilities), 1)
        for index, gradient in enumerate(gradients):
            plus, minus = scores.copy(), scores.copy()
            plus[index] += epsilon
            minus[index] -= epsilon
            numerical = (function(plus, temperature)[0] - function(minus, temperature)[0]) / (2 * epsilon)
            self.assertAlmostEqual(numerical, gradient, places=7)
        self.assertLess(function(scores + [0.8], temperature)[1][0], probabilities[0])
        self.assertAlmostEqual(function([1e20, 1e20])[0], math.log(2))

    def test_rrf_deduplication_constants_and_top_one_tie(self):
        function = example_namespace("04-search/hybrid-and-reranking")["reciprocal_rank_fusion"]
        rankings = [["A", "B", "C"], ["B", "C", "D"]]
        for constant in (10, 60):
            self.assertEqual(function(rankings, constant), ["B", "C", "A", "D"])
        self.assertEqual(function([["B"], ["A"]]), ["A", "B"])
        with self.assertRaises(ValueError):
            function([["A", "A"]])
        with self.assertRaises(ValueError):
            function(rankings, -1)

    def test_conditional_yes_no_is_not_full_vocabulary_probability(self):
        self.assertAlmostEqual(1 / (1 + math.exp(-2)), 0.8807970779778823)
        yes_probability, no_probability = Fraction(1, 10), Fraction(1, 100)
        mass = yes_probability + no_probability
        conditional = yes_probability / mass
        self.assertEqual(mass, Fraction(11, 100))
        self.assertEqual(conditional, Fraction(10, 11))
        self.assertNotEqual(conditional, yes_probability)

    def test_bm25_uniform_scale_preserves_own_order_not_fused_order(self):
        bm25 = example_namespace("04-search/tfidf-and-bm25")["bm25_term"]
        for frequency in (1, 2, 4, 8):
            teaching = bm25(frequency, 10, 10, 1, 1.2, 0.75)
            self.assertAlmostEqual(teaching / 2.2, frequency / (frequency + 1.2))
        self.assertGreater(2 + 0, 1 + 0.6)
        self.assertLess(2 / 2.2 + 0, 1 / 2.2 + 0.6)
        self.assertGreater(2, 1.5)
        self.assertLess(2 / 2.2, 1.5)

    def test_constant_score_offset_does_not_change_fusion_order(self):
        lexical, dense = [0.1, 0.2], [0.9, 0.1]
        before = [first + second for first, second in zip(lexical, dense)]
        after = [first + 1000 + second for first, second in zip(lexical, dense)]
        self.assertGreater(before[0], before[1])
        self.assertGreater(after[0], after[1])
        self.assertAlmostEqual(before[0] - before[1], after[0] - after[1])

    def test_pass_hat_k_averages_task_probabilities_not_average_power(self):
        task_probabilities = [0.5, 1.0]
        averaged_pass_two = mean(probability ** 2 for probability in task_probabilities)
        self.assertEqual(averaged_pass_two, 0.625)
        self.assertEqual(mean(task_probabilities) ** 2, 0.5625)
        self.assertAlmostEqual(0.9 ** 8, 0.43046721)

    def test_multi_agent_example_assumptions_are_explicit(self):
        self.assertAlmostEqual((0.95 * 0.98) ** 3, 0.806954491)
        self.assertAlmostEqual((0.95 * 0.90) ** 3, 0.625026375)
        self.assertAlmostEqual(1 - 0.9 / 0.95, 1 / 19)
        self.assertEqual(10 + 4 * 10 + 10 + 10, 70)
        self.assertEqual(10 + 3 * 40 + 3 * 10 + 3 * 10, 190)
        self.assertGreater(0.9, 0.9 ** 3)
        for language in ("", ".en"):
            source = (ROOT / f"10-agents/single-vs-multi-agent{language}.md").read_text()
            self.assertIn("prompt-caching", source)
            self.assertIn("$3s$", source)
            self.assertIn("190", source)
            self.assertIn("待审核草稿" if not language else "Draft, pending review", source)

    def test_bilingual_api_and_security_caveats_remain_present(self):
        for language in ("", ".en"):
            with self.subTest(language=language):
                prompting = (ROOT / f"10-agents/prompting{language}.md").read_text()
                memory = (ROOT / f"02-memory/memory-lifecycle{language}.md").read_text()
                vector = (ROOT / f"04-search/vector-indexes{language}.md").read_text()
                scenarios = (ROOT / f"10-agents/scenarios{language}.md").read_text()
                self.assertIn("max_tokens", prompting)
                self.assertIn("structured-outputs", prompting)
                self.assertIn("rfc9111", memory)
                self.assertIn("TTL", memory)
                self.assertIn("v0.8.7", vector)
                self.assertIn("banking_knowledge", scenarios)


if __name__ == "__main__":
    unittest.main()
