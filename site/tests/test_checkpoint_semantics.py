import ast
from fractions import Fraction
from pathlib import Path
import re
import unittest

import numpy as np

try:
    import torch
except ModuleNotFoundError as error:
    if error.name != "torch":
        raise
    torch = None


ROOT = Path(__file__).resolve().parents[2]
MEMORY = "00-foundations/deep-dives/precision-and-memory"
ATTENTION = "00-foundations/core/multi-head-attention"
DISTRIBUTED = "06-systems/distributed-training"


def snippet_for(chapter, function_name, language=""):
    source = (ROOT / f"{chapter}{language}.md").read_text()
    return next(block for block in re.findall(r"```python\n(.*?)```", source, re.S)
                if re.search(rf"^def {re.escape(function_name)}\(", block, re.M))


def namespace_for(chapter, function_name, language=""):
    namespace = {}
    exec(compile(snippet_for(chapter, function_name, language), chapter, "exec"), namespace)
    return namespace


class CheckpointDocsAndArithmeticTests(unittest.TestCase):
    def test_new_snippets_match_across_languages(self):
        for chapter, name in ((MEMORY, "checkpoint_example"), (ATTENTION, "softmax_backward")):
            with self.subTest(chapter=chapter):
                chinese = snippet_for(chapter, name)
                self.assertEqual(chinese, snippet_for(chapter, name, ".en"))
                ast.parse(chinese)

    def test_localized_figure_and_optional_details(self):
        for language in ("", ".en"):
            source = (ROOT / f"{MEMORY}{language}.md").read_text()
            section = source.split("{#recompute-example}", 1)[1].split("{#recompute-budget}", 1)[0]
            figure = re.search(r"<figure[^>]*>(.*?)</figure>", section, re.S).group(1)
            if language:
                self.assertNotRegex(figure, r"[\u4e00-\u9fff]")
            else:
                self.assertRegex(figure, r"[\u4e00-\u9fff]")
            self.assertLess(section.index("<figure"), section.index("<details"))
            self.assertIn("use_reentrant=False", section)

    def test_scalar_chain(self):
        features, weight = 2, 3
        hidden = features * weight
        self.assertEqual((hidden**2, 2 * hidden * weight, 2 * hidden * features), (36, 36, 24))
        self.assertNotEqual(features * 4, hidden)

    def test_selective_budget_arithmetic(self):
        sizes = (4, 32)
        times = (6, 1)
        for saved, expected in (((True, True), (36, 0)), ((True, False), (4, 1)),
                                ((False, False), (0, 7))):
            retained = sum(size for size, keep in zip(sizes, saved) if keep)
            recompute = sum(time for time, keep in zip(times, saved) if not keep)
            self.assertEqual((retained, recompute), expected)

    def test_ring_send_volume(self):
        for ranks in (1, 2, 4, 8):
            sent = Fraction(8 * (ranks - 1), ranks)
            baseline = sent * 2
            stage_two = sent + sent
            stage_three = sent * 3
            self.assertEqual(stage_two, baseline)
            if ranks > 1:
                self.assertEqual(stage_three / baseline, Fraction(3, 2))
            else:
                self.assertEqual(stage_three, 0)
            if ranks == 4:
                self.assertEqual((baseline, stage_two, stage_three), (12, 12, 18))
        for language in ("", ".en"):
            source = (ROOT / f"{DISTRIBUTED}{language}.md").read_text()
            self.assertIn("{#zero-communication}", source)
            self.assertIn("6 + 6 + 6 = 18 MiB", source)

    def test_softmax_counterexamples(self):
        for language in ("", ".en"):
            backward = namespace_for(ATTENTION, "softmax_backward", language)["softmax_backward"]
            probabilities = np.array([0.5, 0.5])
            np.testing.assert_allclose(backward(probabilities, np.array([1.0, 0.0])), [0.25, -0.25])
            np.testing.assert_allclose(backward(probabilities, np.ones(2)), [0.0, 0.0])
            self.assertFalse(np.allclose(probabilities * (1 - probabilities), np.zeros(2)))
            np.testing.assert_allclose(backward(np.array([1.0]), np.array([3.0])), [0.0])

    def test_softmax_finite_differences_and_shift_invariance(self):
        backward = namespace_for(ATTENTION, "softmax_backward")["softmax_backward"]
        scores = np.array([[0.2, -0.7, 1.4], [-1.0, 2.0, 0.0]])
        upstream = np.array([[1.0, -2.0, 0.5], [0.0, 3.0, -1.0]])

        def normalized(values):
            exponentials = np.exp(values - values.max(axis=-1, keepdims=True))
            return exponentials / exponentials.sum(axis=-1, keepdims=True)

        exact = backward(normalized(scores), upstream)
        numeric = np.zeros_like(scores)
        step = 1e-6
        for index in np.ndindex(scores.shape):
            plus, minus = scores.copy(), scores.copy()
            plus[index] += step
            minus[index] -= step
            numeric[index] = np.sum((normalized(plus) - normalized(minus)) * upstream) / (2 * step)
        np.testing.assert_allclose(exact, numeric, atol=1e-9)
        np.testing.assert_allclose(exact.sum(axis=-1), 0.0, atol=1e-15)
        np.testing.assert_allclose(backward(normalized(scores + 123), upstream), exact, atol=1e-14)


@unittest.skipIf(torch is None, "PyTorch unavailable; checkpoint and optimizer CPU checks not executed")
class CheckpointTensorTests(unittest.TestCase):
    def test_published_checkpoint_example(self):
        for language in ("", ".en"):
            example = namespace_for(MEMORY, "checkpoint_example", language)["checkpoint_example"]
            self.assertEqual(example(False), (36.0, 36.0, 24.0))
            self.assertEqual(example(True), example(False))

    def test_sgd_optional_momentum_state(self):
        for momentum, expected_bytes in ((0.0, 0), (0.9, 400)):
            weight = torch.nn.Parameter(torch.ones(100, dtype=torch.float32))
            optimizer = torch.optim.SGD([weight], lr=0.1, momentum=momentum, foreach=False)
            self.assertFalse(optimizer.state)
            weight.square().mean().backward()
            gradient = weight.grad.clone()
            optimizer.step()
            state_bytes = sum(value.numel() * value.element_size()
                              for entry in optimizer.state.values() for value in entry.values()
                              if isinstance(value, torch.Tensor))
            self.assertEqual(state_bytes, expected_bytes)
            if momentum:
                torch.testing.assert_close(optimizer.state[weight]["momentum_buffer"], gradient)

    def test_softmax_matches_autograd(self):
        backward = namespace_for(ATTENTION, "softmax_backward")["softmax_backward"]
        scores = torch.tensor([[0.2, -0.7, 1.4], [-1.0, 2.0, 0.0]],
                              dtype=torch.float64, requires_grad=True)
        upstream = torch.tensor([[1.0, -2.0, 0.5], [0.0, 3.0, -1.0]], dtype=torch.float64)
        probabilities = scores.softmax(dim=-1)
        gradient, = torch.autograd.grad(probabilities, scores, grad_outputs=upstream)
        np.testing.assert_allclose(backward(probabilities.detach().numpy(), upstream.numpy()),
                                   gradient.numpy(), atol=1e-15)


if __name__ == "__main__":
    unittest.main()
