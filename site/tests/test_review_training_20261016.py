import ast
from collections import Counter
import contextlib
import importlib.util
import io
from itertools import product
import math
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "05-post-training/deep-rl/code/rl_checks.py"
SPEC = importlib.util.spec_from_file_location("review_training_checks", MODULE_PATH)
CHECKS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKS)


def weighted_moments(probabilities, values):
    mean = sum(probability * value for probability, value in zip(probabilities, values))
    variance = sum(probability * (value - mean) ** 2
                   for probability, value in zip(probabilities, values))
    return mean, variance


def voting_accuracy(probabilities, samples):
    accuracy = 0.0
    for answers in product(range(len(probabilities)), repeat=samples):
        counts = Counter(answers)
        winners = [answer for answer, count in counts.items()
                   if count == max(counts.values())]
        chance = math.prod(probabilities[answer] for answer in answers)
        if 0 in winners:
            accuracy += chance / len(winners)
    return accuracy


def first_accepted_accuracy(correct, recall, false_acceptance, samples):
    probabilities = (correct * recall, correct * (1 - recall),
                     (1 - correct) * false_acceptance,
                     (1 - correct) * (1 - false_acceptance))
    accuracy = 0.0
    for outcomes in product(range(4), repeat=samples):
        chosen = next((outcome for outcome in outcomes if outcome in (0, 2)), outcomes[0])
        if chosen in (0, 1):
            accuracy += math.prod(probabilities[outcome] for outcome in outcomes)
    return accuracy


class ReviewTrainingTests(unittest.TestCase):
    def test_gae_stops_nan_at_termination(self):
        result = CHECKS.gae([1, math.nan], [0, 0], [5, 0],
                            [True, True], [False, False], 0.9, 1.0)
        self.assertEqual(result[0], 1)
        self.assertTrue(math.isnan(result[1]))

    def test_gae_truncation_bootstraps_without_next_episode_nan(self):
        result = CHECKS.gae([1, math.nan], [0, 0], [5, 0],
                            [False, True], [True, False], 0.9, 1.0)
        self.assertEqual(result[0], 5.5)
        self.assertTrue(math.isnan(result[1]))

    def test_zero_discount_ignores_unused_future_values(self):
        result = CHECKS.gae([1, math.nan], [0.25, 0], [math.nan, math.nan],
                            [False, False], [False, False], 0, 1.0)
        self.assertEqual(result[0], 0.75)

    def test_zero_trace_decay_ignores_future_carry(self):
        result = CHECKS.gae([1, math.nan], [0, 0], [5, 0],
                            [False, True], [False, False], 0.9, 0)
        self.assertEqual(result[0], 5.5)

    def test_valid_gae_trace_and_shape_validation(self):
        arguments = ([0, 0, 1], [0.9, 0.3, 0.8], [0.3, 0.8, 0],
                     [False, False, True], [False] * 3)
        for decay, expected in ((0.5, [-0.3, 0.6, 0.2]), (1, [0.1, 0.7, 0.2])):
            for actual, target in zip(CHECKS.gae(*arguments, 1, decay), expected):
                self.assertAlmostEqual(actual, target)
        self.assertEqual(CHECKS.gae([], [], [], [], []), [])
        with self.assertRaises(ValueError):
            CHECKS.gae([1], [], [0], [True], [False])

    def test_bilingual_gae_examples_match_executable_function(self):
        module_tree = ast.parse(MODULE_PATH.read_text())
        function = next(node for node in module_tree.body
                        if isinstance(node, ast.FunctionDef) and node.name == "gae")
        for suffix in ("", ".en"):
            source = (ROOT / f"05-post-training/deep-rl/actor-critic-gae{suffix}.md").read_text()
            blocks = re.findall(r"```python\n(.*?)\n```", source, re.S)
            block = next(block for block in blocks if "def gae(" in block)
            documented = ast.parse(block).body[0]
            self.assertEqual(ast.dump(documented), ast.dump(function))
            namespace = {}
            exec(compile(block, "documented_gae", "exec"), namespace)
            self.assertEqual(namespace["gae"]([1, math.nan], [0, 0], [5, 0],
                                             [False, True], [True, False], 0.9, 1)[0], 5.5)

    def test_voting_finite_budget_is_not_asymptotic_mode(self):
        self.assertAlmostEqual(voting_accuracy([0.4, 0.6], 3), 0.352)
        self.assertAlmostEqual(voting_accuracy([0.6, 0.4], 3), 0.648)
        self.assertAlmostEqual(voting_accuracy([0.4, 0.41, 0.19], 3), 0.41432)
        self.assertGreater(voting_accuracy([0.4, 0.41, 0.19], 3), 0.4)

    def test_verifier_polynomial_matches_exhaustive_selection(self):
        for correct, recall, false_acceptance, samples in product(
                (0, 0.4, 1), (0, 0.8, 1), (0, 0.1, 1), (1, 2, 4)):
            rejection = 1 - correct * recall - (1 - correct) * false_acceptance
            formula = (correct * recall * sum(rejection ** index for index in range(samples))
                       + correct * (1 - recall) * rejection ** (samples - 1))
            with self.subTest(parameters=(correct, recall, false_acceptance, samples)):
                self.assertAlmostEqual(formula, first_accepted_accuracy(
                    correct, recall, false_acceptance, samples))

    def test_verifier_no_acceptance_and_no_false_positive_cases(self):
        self.assertAlmostEqual(first_accepted_accuracy(0.4, 0, 0, 4), 0.4)
        self.assertAlmostEqual(first_accepted_accuracy(0.4, 1, 0, 4), 1 - 0.6 ** 4)
        self.assertAlmostEqual(first_accepted_accuracy(0.4, 1, 0.1, 4), 0.7956256)
        self.assertEqual(first_accepted_accuracy(0, 1, 0, 4), 0)

    def test_self_normalization_can_increase_variance(self):
        behavior = [0.5, 0.5]
        target = [0.8, 0.2]
        rewards = [0.625, 2.5]
        ordinary = [probability / sampling * reward
                    for probability, sampling, reward in zip(target, behavior, rewards)]
        self.assertEqual(weighted_moments(behavior, ordinary), (1, 0))
        normalized_mean, normalized_variance = weighted_moments(behavior, rewards)
        self.assertEqual(normalized_mean, 1.5625)
        self.assertEqual(normalized_variance, 0.87890625)

    def test_dr_requires_independent_value_fitting(self):
        behavior, target, rewards = [0.9, 0.1], [0.5, 0.5], [1, 3]
        memorized_estimates = []
        for action in range(2):
            model = [0, 0]
            model[action] = rewards[action]
            direct = sum(probability * value for probability, value in zip(target, model))
            residual = target[action] / behavior[action] * (rewards[action] - model[action])
            memorized_estimates.append(direct + residual)
        self.assertAlmostEqual(weighted_moments(behavior, memorized_estimates)[0], 0.6)
        self.assertEqual(weighted_moments(target, rewards)[0], 2)
        for model in ([0, 0], [1, 2], [1, 3]):
            direct = sum(probability * value for probability, value in zip(target, model))
            estimates = [direct + target[action] / behavior[action]
                         * (rewards[action] - model[action]) for action in range(2)]
            self.assertAlmostEqual(weighted_moments(behavior, estimates)[0], 2)

    def test_marginal_ratio_can_still_be_exponential(self):
        self.assertEqual(1 / (0.5 ** 10), 1024)

    def test_length_normalization_changes_shared_action_coefficient(self):
        advantages, lengths = [1, -1], [2, 6]
        per_trajectory = sum(advantage / length for advantage, length
                             in zip(advantages, lengths)) / len(advantages)
        per_token = sum(advantages) / sum(lengths)
        self.assertAlmostEqual(per_trajectory, 1 / 6)
        self.assertEqual(per_token, 0)

    def test_action_only_loss_can_update_context_representation(self):
        def action_loss(context_embedding):
            return math.log1p(math.exp(-context_embedding))

        epsilon = 1e-6
        derivative = (action_loss(0.2 + epsilon) - action_loss(0.2 - epsilon)) / (2 * epsilon)
        self.assertAlmostEqual(derivative, -1 / (1 + math.exp(0.2)), places=8)
        self.assertNotEqual(derivative, 0)

    def test_pass_audit_uses_the_correct_conditioning(self):
        wrong_passes = 0.2 * 0.2
        error_among_passes = wrong_passes / 0.34
        self.assertAlmostEqual(error_among_passes, 2 / 17)
        self.assertNotAlmostEqual(error_among_passes, 0.2)

    def test_self_revision_requires_detection_assumption(self):
        self.assertAlmostEqual(0.3 + 0.7 * 0.5, 0.65)
        self.assertAlmostEqual(0.3 + 0.7 * 0.4 * 0.5, 0.44)

    def test_after_rlhf_bilingual_worked_examples_execute(self):
        for suffix in ("", ".en"):
            source = (ROOT / f"05-post-training/rlhf/after-rlhf{suffix}.md").read_text()
            blocks = re.findall(r"```python\n(.*?)\n```", source, re.S)
            self.assertEqual(len(blocks), 3)
            with contextlib.redirect_stdout(io.StringIO()):
                for block in blocks:
                    exec(compile(block, "after_rlhf_example", "exec"), {})

    def test_corrected_examples_and_qualifiers_exist_in_both_languages(self):
        expectations = {
            "05-post-training/deep-rl/ope-estimators": ("1.5625", "0.879", "1024"),
            "11-frontier/test-time-compute/parallel-and-verify": ("0.41432", "q^j", "N\\ge1"),
            "11-frontier/test-time-compute/long-chains": ("0.44", "256", "1805.04770"),
            "11-frontier/test-time-compute/measuring": ("256",),
            "11-frontier/test-time-compute/review": ("0.41432", "256"),
            "05-post-training/rlhf/after-rlhf": ("\\beta>0", "#dpo-derivation"),
        }
        for stem, markers in expectations.items():
            for suffix in ("", ".en"):
                source = (ROOT / f"{stem}{suffix}.md").read_text()
                for marker in markers:
                    with self.subTest(stem=stem, language=suffix, marker=marker):
                        self.assertIn(marker, source)

    def test_draft_badges_and_audit_table_survive(self):
        for series, stems in (
                ("agentic-rl", ("credit-and-training", "environments-and-rewards", "review")),
                ("test-time-compute", ("parallel-and-verify", "long-chains", "measuring", "review"))):
            for stem, suffix in product(stems, ("", ".en")):
                source = (ROOT / f"11-frontier/{series}/{stem}{suffix}.md").read_text()
                self.assertIn("Draft, pending review" if suffix else "草稿", source)
        for suffix in ("", ".en"):
            source = (ROOT / f"11-frontier/agentic-rl/environments-and-rewards{suffix}.md").read_text()
            lines = source.splitlines()
            audit_row = next(index for index, line in enumerate(lines)
                             if line.startswith("|") and "q_{\\rm miss}" in line)
            self.assertTrue(lines[audit_row - 1].startswith("|"))
            self.assertTrue(lines[audit_row + 1].startswith("|"))
            self.assertTrue(lines[audit_row + 2].startswith("|"))


if __name__ == "__main__":
    unittest.main()
