import importlib.util
import math
from pathlib import Path
import re
import unittest

try:
    import torch
except ModuleNotFoundError as error:
    if error.name != "torch":
        raise
    torch = None


ROOT = Path(__file__).resolve().parents[2]


@unittest.skipIf(torch is None, "PyTorch is unavailable; loss examples were not verified")
class LossContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("loss_contracts", ROOT / "00-foundations/code/loss_contracts.py")
        cls.losses = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.losses)
        threads = torch.get_num_threads()
        torch.set_num_threads(1)
        cls.addClassCleanup(torch.set_num_threads, threads)

    def test_hard_target_value_and_gradient(self):
        logits = torch.tensor([[2., 3., 5.]], dtype=torch.float64).log().requires_grad_()
        loss = self.losses.hard_cross_entropy(logits, torch.tensor([2]))
        self.assertAlmostEqual(loss.item(), math.log(2))
        loss.backward()
        torch.testing.assert_close(logits.grad, torch.tensor([[.2, .3, -.5]], dtype=torch.float64))

    def test_shift_invariance_and_large_logits(self):
        logits = torch.tensor([[1000., 999., -1000.]], dtype=torch.float64)
        targets = torch.tensor([2])
        expected = torch.nn.functional.cross_entropy(logits, targets)
        torch.testing.assert_close(self.losses.hard_cross_entropy(logits, targets), expected)
        torch.testing.assert_close(self.losses.hard_cross_entropy(logits + 400, targets), expected)

    def test_soft_target_value_and_gradient(self):
        logits = torch.tensor([[2., 3., 5.]], dtype=torch.float64).log().requires_grad_()
        targets = torch.tensor([[.1, .2, .7]], dtype=torch.float64)
        loss = self.losses.soft_cross_entropy(logits, targets)
        expected = torch.nn.functional.cross_entropy(logits, targets)
        torch.testing.assert_close(loss, expected)
        loss.backward()
        torch.testing.assert_close(logits.grad, torch.tensor([[.1, .1, -.2]], dtype=torch.float64))

    def test_low_precision_large_vocabulary_values_and_gradients(self):
        classes = 65536
        targets = torch.tensor([classes - 1, classes // 2])
        for dtype in (torch.float16, torch.bfloat16):
            for soft in (False, True):
                for autocast in (False, True):
                    with self.subTest(dtype=dtype, soft=soft, autocast=autocast):
                        logits = torch.zeros(2, classes, dtype=dtype, requires_grad=True)
                        one_hot = torch.nn.functional.one_hot(targets, classes).to(dtype)
                        soft_targets = one_hot * .75
                        soft_targets[:, 1] = .25
                        with torch.autocast("cpu", dtype=dtype, enabled=autocast):
                            if soft:
                                loss = self.losses.soft_cross_entropy(logits, soft_targets)
                            else:
                                loss = self.losses.hard_cross_entropy(logits, targets)
                        self.assertEqual(loss.dtype, torch.float32)
                        self.assertTrue(torch.isfinite(loss))
                        self.assertAlmostEqual(loss.item(), math.log(classes), places=5)
                        loss.backward()
                        distribution = soft_targets if soft else one_hot
                        expected = torch.full((2, classes), 1 / classes) - distribution.float()
                        expected = (expected / 2).to(dtype)
                        self.assertEqual(logits.grad.dtype, dtype)
                        self.assertTrue(torch.isfinite(logits.grad).all())
                        torch.testing.assert_close(logits.grad, expected, rtol=0, atol=0)

    def test_soft_target_working_dtype_and_gradients(self):
        dtypes = (torch.float16, torch.bfloat16, torch.float32, torch.float64)
        for logits_dtype in dtypes:
            for targets_dtype in dtypes:
                with self.subTest(logits_dtype=logits_dtype, targets_dtype=targets_dtype):
                    logits = torch.tensor([[.123456789012, -.987654321098, 1.234567890123]], dtype=logits_dtype, requires_grad=True)
                    targets = torch.tensor([[.125, .25, .625]], dtype=targets_dtype, requires_grad=True)
                    reference_logits = logits.detach().clone().requires_grad_()
                    reference_targets = targets.detach().clone().requires_grad_()
                    working_dtype = torch.promote_types(torch.promote_types(logits_dtype, targets_dtype), torch.float32)
                    expected = torch.nn.functional.cross_entropy(reference_logits.to(working_dtype), reference_targets.to(working_dtype))
                    actual = self.losses.soft_cross_entropy(logits, targets)
                    self.assertEqual(actual.dtype, working_dtype)
                    tolerance = 1e-12 if working_dtype == torch.float64 else 1e-6
                    torch.testing.assert_close(actual, expected, rtol=tolerance, atol=tolerance)
                    actual.backward()
                    expected.backward()
                    self.assertEqual(logits.grad.dtype, logits_dtype)
                    self.assertEqual(targets.grad.dtype, targets_dtype)
                    torch.testing.assert_close(logits.grad, reference_logits.grad)
                    torch.testing.assert_close(targets.grad, reference_targets.grad)

    def test_low_precision_soft_target_validation_is_unchanged(self):
        for dtype in (torch.float16, torch.bfloat16):
            with self.subTest(dtype=dtype):
                logits = torch.tensor([[.25, -.5, 1.]], dtype=dtype, requires_grad=True)
                targets = torch.tensor([[.1, .2, .7]], dtype=dtype, requires_grad=True)
                reference_logits = logits.detach().float().requires_grad_()
                reference_targets = targets.detach().float().requires_grad_()
                actual = self.losses.soft_cross_entropy(logits, targets)
                expected = torch.nn.functional.cross_entropy(reference_logits, reference_targets)
                torch.testing.assert_close(actual, expected)
                actual.backward()
                expected.backward()
                torch.testing.assert_close(logits.grad, reference_logits.grad.to(dtype))
                torch.testing.assert_close(targets.grad, reference_targets.grad.to(dtype))
                for invalid in ([[.1, .1, .1]], [[-.1, .5, .6]], [[float("nan"), .5, .5]]):
                    with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                        self.losses.soft_cross_entropy(logits, torch.tensor(invalid, dtype=dtype))

    def test_low_precision_masked_token_mean_and_gradients(self):
        labels = torch.tensor([[-100, 0, -100, 1, -100], [0, 2, 1, -100, -100]])
        visible = torch.tensor([[False, True, True, True, True], [True, True, True, False, False]])
        valid_pairs = visible[:, :-1] & visible[:, 1:]
        shifted_labels = labels[:, 1:].masked_fill(~valid_pairs, -100)
        valid = shifted_labels != -100
        self.assertEqual(valid.sum(dim=-1).tolist(), [1, 2])
        for dtype in (torch.float16, torch.bfloat16):
            with self.subTest(dtype=dtype):
                scores = torch.arange(30, dtype=torch.float32).reshape(2, 5, 3) / 8
                active = torch.zeros(2, 5, dtype=torch.bool)
                active[:, :-1] = valid
                scores[~active] = float("nan")
                logits = scores.to(dtype).requires_grad_()
                reference_logits = logits.detach().float().requires_grad_()
                expected = torch.nn.functional.cross_entropy(reference_logits[:, :-1][valid], shifted_labels[valid])
                actual = self.losses.causal_sft_loss(logits, labels, visible)
                self.assertEqual(actual.dtype, torch.float32)
                torch.testing.assert_close(actual, expected)
                actual.backward()
                expected.backward()
                torch.testing.assert_close(logits.grad, reference_logits.grad.to(dtype))
                torch.testing.assert_close(logits.grad[~active], torch.zeros_like(logits.grad[~active]))
                with self.assertRaisesRegex(ValueError, "no supervised"):
                    self.losses.causal_sft_loss(logits, torch.full_like(labels, -100), visible)

    def test_cross_entropy_bilingual_blocks_and_working_dtype(self):
        snippets = []
        for suffix in ("", ".en"):
            text = (ROOT / f"00-foundations/pytorch/cross-entropy{suffix}.md").read_text()
            blocks = re.findall(r"```python\n(.*?)```", text, re.DOTALL)
            snippets.append(blocks)
            self.assertTrue(blocks)
            namespace = {}
            for block in blocks:
                exec(compile(block, f"cross-entropy{suffix}.md", "exec"), namespace)
            for dtype in (torch.float16, torch.bfloat16, torch.float32, torch.float64):
                with self.subTest(suffix=suffix, dtype=dtype):
                    logits = torch.zeros(1, 65536, dtype=dtype, requires_grad=True)
                    targets = torch.tensor([65535])
                    actual = namespace["ce_from_logits"](logits, targets)
                    working_dtype = torch.promote_types(dtype, torch.float32)
                    self.assertEqual(actual.dtype, working_dtype)
                    self.assertAlmostEqual(actual.item(), math.log(65536), places=5)
                    actual.backward()
                    expected = torch.full((1, 65536), 1 / 65536, dtype=working_dtype)
                    expected[0, 65535] -= 1
                    torch.testing.assert_close(logits.grad, expected.to(dtype), rtol=0, atol=0)
        self.assertEqual(snippets[0], snippets[1])

    def test_gradcheck_hard_and_soft(self):
        logits = torch.tensor([[.3, -.4, 1.2], [-.2, .5, .8]], dtype=torch.float64, requires_grad=True)
        self.assertTrue(torch.autograd.gradcheck(lambda scores: self.losses.hard_cross_entropy(scores, torch.tensor([0, 2])), (logits,)))
        soft = torch.tensor([[.1, .2, .7], [.5, .1, .4]], dtype=torch.float64)
        self.assertTrue(torch.autograd.gradcheck(lambda scores: self.losses.soft_cross_entropy(scores, soft), (logits,)))

    def test_ignored_nan_row_does_not_enter_reduction(self):
        logits = torch.tensor([[0., 0.], [float("nan"), float("nan")]], requires_grad=True)
        loss = self.losses.hard_cross_entropy(logits, torch.tensor([1, -100]))
        self.assertAlmostEqual(loss.item(), math.log(2), places=6)
        loss.backward()
        torch.testing.assert_close(logits.grad[1], torch.zeros(2))

    def test_empty_targets_raise(self):
        for targets in (torch.tensor([-100, -100]), torch.empty(0, dtype=torch.long)):
            with self.subTest(targets=targets), self.assertRaisesRegex(ValueError, "no supervised"):
                self.losses.hard_cross_entropy(torch.zeros(targets.numel(), 3), targets)

    def test_bad_hard_targets_raise(self):
        for targets in (torch.tensor([3]), torch.tensor([-1]), torch.tensor([1.])):
            with self.subTest(targets=targets), self.assertRaises(ValueError):
                self.losses.hard_cross_entropy(torch.zeros(1, 3), targets)

    def test_bad_soft_targets_raise(self):
        for targets in ([[.1, .1, .1]], [[-.1, .5, .6]], [[float("nan"), .5, .5]]):
            with self.subTest(targets=targets), self.assertRaises(ValueError):
                self.losses.soft_cross_entropy(torch.zeros(1, 3), torch.tensor(targets))

    def test_binary_extremes_and_zero_gradient(self):
        logits = torch.tensor([-1000., -100., 0., 100., 1000.], dtype=torch.float64, requires_grad=True)
        targets = torch.tensor([1., 1., 1., 0., 0.], dtype=torch.float64)
        actual = self.losses.binary_cross_entropy_with_logits(logits, targets)
        expected = torch.nn.functional.binary_cross_entropy_with_logits(logits, targets)
        torch.testing.assert_close(actual, expected)
        actual.backward()
        torch.testing.assert_close(logits.grad, (logits.detach().sigmoid() - targets) / 5)

    def test_probability_clamping_loses_gradient(self):
        logits = torch.tensor([-100.], dtype=torch.float64, requires_grad=True)
        clipped = logits.sigmoid().clamp(1e-7, 1 - 1e-7)
        (-clipped.log()).backward()
        self.assertEqual(logits.grad.item(), 0.)
        logits.grad = None
        self.losses.binary_cross_entropy_with_logits(logits, torch.ones_like(logits)).backward()
        self.assertEqual(logits.grad.item(), -1.)

    def test_binary_contract_rejects_broadcast(self):
        with self.assertRaises(ValueError):
            self.losses.binary_cross_entropy_with_logits(torch.zeros(2, 1), torch.zeros(2))
        with self.assertRaises(ValueError):
            self.losses.binary_cross_entropy_with_logits(torch.zeros(1), torch.tensor([2.]))

    def test_sft_shift_uses_preceding_position(self):
        logits = torch.zeros(1, 6, 6, dtype=torch.float64, requires_grad=True)
        labels = torch.tensor([[-100, -100, -100, 4, 5, -100]])
        visible = torch.tensor([[True, True, True, True, True, False]])
        loss = self.losses.causal_sft_loss(logits, labels, visible)
        self.assertAlmostEqual(loss.item(), math.log(6))
        loss.backward()
        active = (logits.grad.abs().sum(-1) > 0).nonzero().tolist()
        self.assertEqual(active, [[0, 2], [0, 3]])

    def test_eos_same_id_as_padding(self):
        logits = torch.zeros(1, 4, 3, requires_grad=True)
        labels = torch.tensor([[-100, 1, 2, 2]])
        visible = torch.tensor([[True, True, True, False]])
        self.losses.causal_sft_loss(logits, labels, visible).backward()
        self.assertNotEqual(logits.grad[0, 1, 2].item(), 0.)
        torch.testing.assert_close(logits.grad[0, 2], torch.zeros(3))

    def test_left_padding_does_not_predict_first_real_token(self):
        logits = torch.zeros(1, 4, 3, requires_grad=True)
        labels = torch.tensor([[2, 0, 1, 2]])
        visible = torch.tensor([[False, True, True, True]])
        self.losses.causal_sft_loss(logits, labels, visible).backward()
        torch.testing.assert_close(logits.grad[0, 0], torch.zeros(3))

    def test_masked_context_can_receive_gradient(self):
        embeddings = torch.tensor([[[.2, -.1], [.3, .4], [-.2, .5]]], requires_grad=True)
        prefix_states = embeddings.cumsum(dim=1)
        projection = torch.tensor([[1., -1., .5], [.5, 1., -1.]])
        logits = prefix_states @ projection
        labels = torch.tensor([[-100, -100, 2]])
        self.losses.causal_sft_loss(logits, labels, torch.ones(1, 3, dtype=torch.bool)).backward()
        self.assertGreater(embeddings.grad[0, 0].abs().sum().item(), 0.)
        torch.testing.assert_close(embeddings.grad[0, 2], torch.zeros(2))

    def test_token_mean_differs_from_mean_of_means(self):
        first, second = torch.tensor([2.]), torch.tensor([1., 1., 1.])
        self.assertEqual(torch.cat([first, second]).mean().item(), 1.25)
        self.assertEqual(((first.mean() + second.mean()) / 2).item(), 1.5)

    def test_weighted_hard_and_one_hot_denominators(self):
        logits = torch.zeros(2, 2, dtype=torch.float64)
        targets = torch.tensor([0, 1])
        weights = torch.tensor([1., 3.], dtype=torch.float64)
        hard = torch.nn.functional.cross_entropy(logits, targets, weight=weights)
        soft = torch.nn.functional.cross_entropy(logits, torch.nn.functional.one_hot(targets, 2).double(), weight=weights)
        self.assertAlmostEqual(hard.item(), math.log(2))
        self.assertAlmostEqual(soft.item(), 2 * math.log(2))

    def test_dft_detach_changes_the_gradient_direction(self):
        logits = torch.tensor([[math.log(.99), math.log(.01)]], dtype=torch.float64, requires_grad=True)
        targets = torch.tensor([1])
        loss = self.losses.dft_token_loss(logits, targets)
        gradient = torch.autograd.grad(loss, logits)[0]
        self.assertAlmostEqual(gradient[0, 1].item(), -.0099)
        probability = logits.softmax(-1)[0, 1]
        wrong = -probability * probability.log()
        wrong_gradient = torch.autograd.grad(wrong, logits)[0]
        self.assertGreater(wrong_gradient[0, 1].item(), 0.)

    def test_sft_bilingual_examples_match_and_run(self):
        snippets = []
        for suffix in ("", ".en"):
            text = (ROOT / f"05-post-training/sft-and-its-ceiling{suffix}.md").read_text()
            snippets.append(re.findall(r"```python\n(.*?)```", text, re.DOTALL))
        self.assertEqual(snippets[0], snippets[1])
        self.assertTrue(snippets[0])
        namespace = {}
        for snippet in snippets[0]:
            exec(compile(snippet, "sft-example", "exec"), namespace)

    def test_teacher_forcing_scores_only_demonstration_prefixes(self):
        for alternate_probability in (.05, .95):
            probabilities = torch.tensor([
                [.8, .2],
                [.6, .4],
                [alternate_probability, 1 - alternate_probability],
            ], dtype=torch.float64)
            logits = probabilities.log().requires_grad_()
            loss = torch.nn.functional.cross_entropy(logits[:2], torch.tensor([0, 0]))
            self.assertAlmostEqual(math.exp(-2 * loss.item()), .48)
            loss.backward()
            torch.testing.assert_close(logits.grad[2], torch.zeros(2, dtype=torch.float64))
        for suffix in ('', '.en'):
            text = (ROOT / f'05-post-training/sft-and-its-ceiling{suffix}.md').read_text()
            self.assertIn('id="teacher-forcing"', text)
            self.assertIn('0.8\\times0.6=0.48', text)


if __name__ == "__main__":
    unittest.main()
