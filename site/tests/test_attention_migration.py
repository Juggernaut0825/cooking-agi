import contextlib
import io
from pathlib import Path
import re
import runpy
import unittest

try:
    import torch
except ModuleNotFoundError as error:
    if error.name != "torch":
        raise
    torch = None


ROOT = Path(__file__).resolve().parents[2]
CHAPTER = "00-foundations/core/multi-head-attention"


def cache_example(language):
    source = (ROOT / f"{CHAPTER}{language}.md").read_text()
    return next(block for block in re.findall(r"```python\n(.*?)\n```", source, re.S)
                if "def cached_attention_example(" in block)


class AttentionPresentationTests(unittest.TestCase):
    def test_example_is_shared_but_figure_is_localized(self):
        self.assertEqual(cache_example(""), cache_example(".en"))
        for language, expected_lang, heading in (("", "zh-CN", "接上缓存"),
                                                 (".en", "en", "cached prefix")):
            source = (ROOT / f"{CHAPTER}{language}.md").read_text()
            self.assertIn("{#cached-causal-mask}", source)
            figure = next(value for value in re.findall(r"<figure\b.*?</figure>", source, re.S)
                          if 'id="cached-mask-output"' in value)
            self.assertIn(f'lang="{expected_lang}"', figure)
            self.assertIn(heading, figure)
            self.assertEqual(figure.count("<li>"), 2)
            if language:
                self.assertNotRegex(figure, r"[\u4e00-\u9fff]")
            else:
                self.assertRegex(figure, r"[\u4e00-\u9fff]")
            cache = (ROOT / f"00-foundations/deep-dives/kv-cache-and-inference{language}.md").read_text()
            self.assertIn(f"multi-head-attention{language}.md#cached-causal-mask", cache)


@unittest.skipIf(torch is None, "PyTorch unavailable; attention CPU checks not executed")
class AttentionMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.implementations = runpy.run_path(str(ROOT / "00-foundations/code/attention_torch.py"))

    def test_library_output_and_input_gradients_with_bias_and_dtype(self):
        torch.manual_seed(19)
        for dtype in (torch.float32, torch.float64):
            for bias in (False, True):
                for training in (False, True):
                    with self.subTest(dtype=dtype, bias=bias, training=training):
                        module = self.implementations["MultiHeadAttention"](8, 2, bias=bias).to(dtype=dtype)
                        module.train(training)
                        inputs = torch.randn(2, 4, 8, dtype=dtype, requires_grad=True)
                        causal = self.implementations["causal_mask"](4)
                        padding = torch.tensor([[False, False, True, True]])
                        per_head = causal.expand(2, 2, 4, 4).clone()
                        per_head[1, 0, 2:, 0] = True
                        for mask in (None, causal, padding, per_head):
                            manual, _ = module(inputs, mask)
                            sdpa = self.implementations["sdpa_version"](module, inputs, mask)
                            reference = self.implementations["library_version"](module, inputs, mask)
                            torch.testing.assert_close(sdpa, manual)
                            torch.testing.assert_close(reference, manual)
                            manual_gradient, = torch.autograd.grad(manual.square().sum(), inputs)
                            sdpa_gradient, = torch.autograd.grad(sdpa.square().sum(), inputs)
                            reference_gradient, = torch.autograd.grad(reference.square().sum(), inputs)
                            torch.testing.assert_close(sdpa_gradient, manual_gradient)
                            torch.testing.assert_close(reference_gradient, manual_gradient)
                            with torch.no_grad():
                                inference = self.implementations["library_version"](module, inputs, mask)
                            torch.testing.assert_close(inference, manual.detach())

    def test_sdpa_parameter_gradients_and_library_copy_boundary(self):
        torch.manual_seed(31)
        module = self.implementations["MultiHeadAttention"](8, 2, bias=True).double()
        inputs = torch.randn(2, 4, 8, dtype=torch.float64, requires_grad=True)
        mask = self.implementations["causal_mask"](4)
        targets = (inputs, *module.parameters())
        manual, _ = module(inputs, mask)
        sdpa = self.implementations["sdpa_version"](module, inputs, mask)
        torch.testing.assert_close(sdpa, manual)
        manual_gradients = torch.autograd.grad(manual.square().sum(), targets)
        sdpa_gradients = torch.autograd.grad(sdpa.square().sum(), targets)
        for actual, expected in zip(sdpa_gradients, manual_gradients):
            torch.testing.assert_close(actual, expected)
        reference = self.implementations["library_version"](module, inputs, mask)
        copied_gradients = torch.autograd.grad(reference.square().sum(), tuple(module.parameters()),
                                               allow_unused=True)
        self.assertTrue(all(gradient is None for gradient in copied_gradients))

    def test_every_wrapper_rejects_a_fully_blocked_query(self):
        module = self.implementations["MultiHeadAttention"](8, 2, bias=True)
        inputs = torch.ones(2, 4, 8)
        mask = self.implementations["causal_mask"](4).expand(2, 2, 4, 4).clone()
        mask[1, 1, 2, :] = True
        for implementation in (lambda: module(inputs, mask),
                               lambda: self.implementations["sdpa_version"](module, inputs, mask),
                               lambda: self.implementations["library_version"](module, inputs, mask)):
            with self.assertRaisesRegex(ValueError, "at least one allowed key"):
                implementation()

    def test_published_cached_mask_example(self):
        for language in ("", ".en"):
            namespace = {}
            with contextlib.redirect_stdout(io.StringIO()):
                exec(compile(cache_example(language), CHAPTER, "exec"), namespace)
            aligned, upper_left, allowed = namespace["cached_attention_example"]()
            torch.testing.assert_close(aligned.flatten(), torch.tensor([25., 30.], dtype=torch.float64))
            torch.testing.assert_close(upper_left.flatten(), torch.tensor([10., 15.], dtype=torch.float64))
            self.assertEqual(allowed.tolist(), [[True, True, True, True, False], [True] * 5])

    def test_cached_append_matches_full_forward_for_nonzero_scores(self):
        generator = torch.Generator().manual_seed(29)
        query = torch.randn(2, 3, 5, 4, dtype=torch.float64, generator=generator)
        key = torch.randn(2, 3, 5, 4, dtype=torch.float64, generator=generator)
        value = torch.randn(2, 3, 5, 6, dtype=torch.float64, generator=generator)
        full = torch.nn.functional.scaled_dot_product_attention(query, key, value,
                                                               is_causal=True, dropout_p=0.0)
        for prefix_length in range(5):
            query_positions = torch.arange(prefix_length, 5)
            key_positions = torch.arange(5)
            allowed = key_positions[None, :] <= query_positions[:, None]
            appended = torch.nn.functional.scaled_dot_product_attention(
                query[:, :, prefix_length:], key, value, attn_mask=allowed, dropout_p=0.0,
            )
            torch.testing.assert_close(appended, full[:, :, prefix_length:])
        last = torch.nn.functional.scaled_dot_product_attention(query[:, :, -1:], key, value,
                                                               dropout_p=0.0)
        torch.testing.assert_close(last, full[:, :, -1:])

    def test_single_query_shortcut_requires_all_keys_to_be_valid(self):
        query = torch.zeros(1, 1, 1, 2, dtype=torch.float64)
        key = torch.zeros(1, 1, 5, 2, dtype=torch.float64)
        value = torch.tensor([10., 20., 30., 40., 50.], dtype=torch.float64).view(1, 1, 5, 1)
        allowed = torch.tensor([[False, True, True, True, True]])
        sdpa = torch.nn.functional.scaled_dot_product_attention
        self.assertAlmostEqual(sdpa(query, key, value, dropout_p=0.0).item(), 30.)
        self.assertAlmostEqual(sdpa(query, key, value, attn_mask=allowed, dropout_p=0.0).item(), 35.)
        self.assertAlmostEqual(sdpa(query, key, value, is_causal=True, dropout_p=0.0).item(), 10.)


if __name__ == "__main__":
    unittest.main()
