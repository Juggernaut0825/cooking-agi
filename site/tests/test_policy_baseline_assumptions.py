import importlib.util
from pathlib import Path
import re
import runpy
import unittest


ROOT = Path(__file__).resolve().parents[2]
NOTES = ROOT / "05-post-training/deep-rl"
REFERENCE = runpy.run_path(str(ROOT / "05-post-training/deep-rl/code/rl_checks.py"))


class BaselineAssumptionTests(unittest.TestCase):
    def test_bilingual_snippets_match_reference_functions(self):
        for chapter, function, filename in (
            ("policy-gradients", "actor_loss", "torch_updates.py"),
            ("actor-critic-gae", "gae", "rl_checks.py"),
        ):
            chinese = (NOTES / (chapter + ".md")).read_text()
            english = (NOTES / (chapter + ".en.md")).read_text()
            snippets = re.findall(r"```python\n(.*?)```", chinese, re.S)
            self.assertEqual(snippets, re.findall(r"```python\n(.*?)```", english, re.S))
            import ast
            reference = ast.parse((ROOT / "05-post-training/deep-rl/code" / filename).read_text())
            actual = ast.parse("\n".join(snippets))
            expected_function = next(node for node in reference.body
                                     if isinstance(node, ast.FunctionDef) and node.name == function)
            actual_function = next(node for node in actual.body
                                   if isinstance(node, ast.FunctionDef) and node.name == function)
            self.assertEqual(ast.dump(actual_function), ast.dump(expected_function))

    def test_full_mc_advantage_bias_does_not_imply_gradient_bias(self):
        probabilities = [0.25, 0.75]
        rewards = [1.0, 3.0]
        true_value = sum(probability * reward for probability, reward in zip(probabilities, rewards))
        baseline_error = 2.0
        estimated_value = true_value + baseline_error
        estimates = REFERENCE["gae"](
            rewards, [estimated_value] * 2, [999.0] * 2,
            [True, True], [False, False], gamma=0.9, trace_decay=1.0,
        )
        true_advantages = [reward - true_value for reward in rewards]
        for estimate, advantage in zip(estimates, true_advantages):
            self.assertAlmostEqual(estimate, advantage - baseline_error)
        scores = [1 - probabilities[0], -probabilities[0]]
        estimated_gradient = sum(probability * score * estimate
                                 for probability, score, estimate in zip(probabilities, scores, estimates))
        true_gradient = sum(probability * score * advantage
                            for probability, score, advantage in zip(probabilities, scores, true_advantages))
        self.assertAlmostEqual(estimated_gradient, true_gradient)
        self.assertNotEqual(true_gradient, 0)

    def test_truncation_retains_action_dependent_tail_error(self):
        probabilities = [0.25, 0.75]
        scores = [0.75, -0.25]
        gamma = 0.9
        exact_tails = [1.0, 3.0]
        wrong_tails = [4.0, 3.0]
        baseline = gamma * sum(probability * tail for probability, tail in zip(probabilities, exact_tails))
        estimates = REFERENCE["gae"](
            [0.0, 0.0], [baseline] * 2, wrong_tails,
            [False, False], [True, True], gamma=gamma, trace_decay=1.0,
        )
        estimated_gradient = sum(probability * score * estimate
                                 for probability, score, estimate in zip(probabilities, scores, estimates))
        true_gradient = sum(probability * score * (gamma * tail - baseline)
                            for probability, score, tail in zip(probabilities, scores, exact_tails))
        self.assertAlmostEqual(estimated_gradient - true_gradient, 0.25 * 0.75 * gamma * 3)


@unittest.skipUnless(importlib.util.find_spec("torch") is not None, "PyTorch required")
class DetachedBaselineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.functions = runpy.run_path(str(ROOT / "05-post-training/deep-rl/code/torch_updates.py"))

    def test_fixed_baselines_preserve_expected_bandit_gradient(self):
        import torch
        for baseline in (-100.0, 0.0, 2.0, 100.0):
            logits = torch.zeros(2, dtype=torch.float64, requires_grad=True)
            advantages = torch.tensor([1.0 - baseline, 3.0 - baseline], dtype=torch.float64,
                                      requires_grad=True)
            loss = self.functions["actor_loss"](logits.log_softmax(dim=0), advantages)
            loss.backward()
            gradient = logits.grad
            torch.testing.assert_close(gradient, torch.tensor([0.5, -0.5], dtype=torch.float64))
            self.assertIsNone(advantages.grad)

    def test_detach_does_not_fix_single_sample_baseline_refitting(self):
        import torch
        expected_gradient = torch.zeros(2, dtype=torch.float64)
        rewards = torch.tensor([1.0, 3.0], dtype=torch.float64)
        for action in range(2):
            logits = torch.zeros(2, dtype=torch.float64, requires_grad=True)
            fitted_baseline = torch.tensor([rewards[action].item()], dtype=torch.float64,
                                           requires_grad=True)
            advantage = rewards[action:action + 1] - fitted_baseline
            loss = self.functions["actor_loss"](logits.log_softmax(dim=0)[action:action + 1], advantage)
            loss.backward()
            gradient = logits.grad
            expected_gradient += 0.5 * gradient
            self.assertIsNone(fitted_baseline.grad)
        torch.testing.assert_close(expected_gradient, torch.zeros(2, dtype=torch.float64))
        logits = torch.zeros(2, dtype=torch.float64, requires_grad=True)
        true_loss = -(logits.softmax(dim=0) * rewards).sum()
        true_gradient = torch.autograd.grad(true_loss, logits)[0]
        torch.testing.assert_close(true_gradient, torch.tensor([0.5, -0.5], dtype=torch.float64))


if __name__ == "__main__":
    unittest.main()
