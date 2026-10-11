import importlib.util
from fractions import Fraction
import math
from pathlib import Path
import re
import tomllib
import unittest


ROOT = Path(__file__).resolve().parents[2]
NOTES = ROOT / "05-post-training"


def snippets(suffix):
    return re.findall(r"```python\n(.*?)```", (NOTES / f"clipping-variants{suffix}").read_text(), re.S)


class ClippingReadingRouteTests(unittest.TestCase):
    def test_sequence_clipping_keeps_negative_advantage_signal(self):
        for suffix in (".md", ".en.md"):
            source = (NOTES / f"policy-ratios{suffix}").read_text()
            namespace = {}
            for block in re.findall(r"```python\n(.*?)```", source, re.S):
                exec(compile(block, f"policy-ratios{suffix}", "exec"), namespace)
            log_ratios = [math.log(2), math.log(0.5)]
            step = 1e-6
            def objective(values):
                ratio = namespace["sequence_ratio"](values, [True, True])
                return namespace["clipped_surrogate"](ratio, -1)
            self.assertAlmostEqual(objective(log_ratios), -1)
            for position in range(2):
                above, below = log_ratios.copy(), log_ratios.copy()
                above[position] += step
                below[position] -= step
                derivative = (objective(above) - objective(below)) / (2 * step)
                self.assertAlmostEqual(derivative, -0.5, places=8)
            self.assertIn("−0.5", source)

    def test_bilingual_examples_match(self):
        self.assertEqual(snippets(".md"), snippets(".en.md"))
        self.assertEqual(len(snippets(".md")), 1)

    def test_optional_advanced_route_is_reachable(self):
        navigation = tomllib.loads((ROOT / "site/nav.toml").read_text())
        section = next(section for section in navigation["section"]
                       if section["dir"] == "05-post-training/preference-objectives")
        self.assertIn("05-post-training/clipping-variants.md", section["include"])
        self.assertLess(section["order"].index("dapo.md"), section["order"].index("clipping-variants.md"))
        for suffix in (".md", ".en.md"):
            overview = (NOTES / "rlhf" / f"ppo-clipping{suffix}").read_text()
            self.assertIn(f"../clipping-variants{suffix}", overview)

    def test_dpo_relative_improvement_does_not_require_chosen_probability_gain(self):
        for suffix in (".md", ".en.md"):
            source = (NOTES / f"after-ppo{suffix}").read_text()
            section = source.split("{#relative-not-absolute}", 1)[1].split("## ", 1)[0]
            rows = re.findall(r"\| ([^|]+) \| (0\.\d+) \| (0\.\d+) \|", section)
            self.assertEqual(len(rows), 3)
            reference = [Fraction(row[1]) for row in rows]
            current = [Fraction(row[2]) for row in rows]
            self.assertEqual(sum(reference), 1)
            self.assertEqual(sum(current), 1)
            self.assertLess(current[0], reference[0])
            relative_ratio = (current[0] / current[1]) / (reference[0] / reference[1])
            self.assertEqual(relative_ratio, Fraction(9, 4))
            loss = math.log1p(1 / float(relative_ratio))
            self.assertLess(loss, math.log(2))
            self.assertIn(f"{loss:.4f}", section)
            self.assertIn(f"{math.log(2):.4f}", section)


@unittest.skipUnless(importlib.util.find_spec("torch") is not None, "PyTorch required")
class ClippingGradientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.namespaces = {}
        for suffix in (".md", ".en.md"):
            namespace = {}
            exec(compile(snippets(suffix)[0], f"clipping-variants{suffix}", "exec"), namespace)
            cls.namespaces[suffix] = namespace

    def test_local_gradients_against_independent_piecewise_oracle(self):
        import torch
        for suffix, namespace in self.namespaces.items():
            for ratio in (0.05, 0.3, 0.6, 0.9, 1.0, 1.1, 1.4, 2.0, 2.9, 3.1, 5.0, 9.0):
                for advantage_value in (-2.0, -0.4, 0.0, 0.7, 2.0):
                    current = torch.tensor(math.log(0.1 * ratio), dtype=torch.float64, requires_grad=True)
                    old = torch.tensor(math.log(0.1), dtype=torch.float64)
                    advantage = torch.tensor(advantage_value, dtype=torch.float64)
                    terms = namespace["local_surrogates"](current, old, advantage)
                    active = (advantage_value > 0 and ratio < 1.2) or (advantage_value < 0 and ratio > 0.8)
                    ordinary = ratio * advantage_value if active else 0.0
                    smooth_gate = 1 / math.cosh(ratio - 1) ** 2
                    expected = {
                        "ppo": ordinary,
                        "dual": 0.0 if advantage_value < 0 and ratio > 3 else ordinary,
                        "cispo": min(ratio, 1.2) * advantage_value,
                        "sapo": smooth_gate * ratio * advantage_value,
                    }
                    for method, term in terms.items():
                        with self.subTest(language=suffix, ratio=ratio, advantage=advantage_value, method=method):
                            derivative = torch.autograd.grad(term, current, retain_graph=True)[0].item()
                            self.assertAlmostEqual(derivative, expected[method], places=11)

    def test_negative_dual_clip_value_and_derivative(self):
        import torch
        for namespace in self.namespaces.values():
            current = torch.tensor(math.log(0.1), dtype=torch.float64, requires_grad=True)
            old = torch.tensor(math.log(0.02), dtype=torch.float64)
            advantage = torch.tensor(-1.0, dtype=torch.float64)
            terms = namespace["local_surrogates"](current, old, advantage)
            for method, expected_value, expected_derivative in (("ppo", -5.0, -5.0), ("dual", -3.0, 0.0)):
                self.assertAlmostEqual(terms[method].item(), expected_value)
                self.assertAlmostEqual(torch.autograd.grad(terms[method], current, retain_graph=True)[0].item(), expected_derivative)

    def test_old_policy_and_advantage_have_no_gradient_path(self):
        import torch
        for namespace in self.namespaces.values():
            current = torch.tensor(math.log(0.4), dtype=torch.float64, requires_grad=True)
            old = torch.tensor(math.log(0.5), dtype=torch.float64, requires_grad=True)
            advantage = torch.tensor(0.7, dtype=torch.float64, requires_grad=True)
            for term in namespace["local_surrogates"](current, old, advantage).values():
                gradients = torch.autograd.grad(term, (current, old, advantage), retain_graph=True, allow_unused=True)
                self.assertIsNotNone(gradients[0])
                self.assertIsNone(gradients[1])
                self.assertIsNone(gradients[2])

    def test_missing_cispo_detach_changes_uncapped_gradient(self):
        import torch
        current = torch.tensor(math.log(0.4), dtype=torch.float64, requires_grad=True)
        old = torch.tensor(math.log(0.5), dtype=torch.float64)
        ratio = (current - old).exp()
        wrong = ratio.clamp(0.0, 1.2) * current
        derivative = torch.autograd.grad(wrong, current)[0].item()
        self.assertAlmostEqual(derivative, 0.8 * (1 + math.log(0.4)))
        self.assertNotAlmostEqual(derivative, 0.8)

    def test_sapo_finite_difference_matches_autograd(self):
        import torch
        function = self.namespaces[".md"]["local_surrogates"]
        for ratio in (0.2, 0.6, 1.0, 1.4, 2.0, 3.0):
            current = torch.tensor(math.log(0.1 * ratio), dtype=torch.float64, requires_grad=True)
            old = torch.tensor(math.log(0.1), dtype=torch.float64)
            advantage = torch.tensor(-0.7, dtype=torch.float64)
            term = function(current, old, advantage)["sapo"]
            derivative = torch.autograd.grad(term, current)[0].item()
            step = 1e-6
            numerical = (function(current.detach() + step, old, advantage)["sapo"]
                         - function(current.detach() - step, old, advantage)["sapo"]).item() / (2 * step)
            self.assertAlmostEqual(derivative, numerical, places=8)

    def test_gate_bound_does_not_bound_full_gradient_coefficient(self):
        ratio = 1.4
        gate = 1 / math.cosh(ratio - 1) ** 2
        self.assertLess(gate, 1)
        self.assertGreater(gate * ratio, 1)


if __name__ == "__main__":
    unittest.main()
