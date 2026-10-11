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


class RotaryPresentationTests(unittest.TestCase):
    def test_bilingual_sections_and_code(self):
        versions = [(ROOT / f"00-foundations/deep-dives/position-and-context{language}.md").read_text()
                    for language in ("", ".en")]
        self.assertEqual(*[re.findall(r"```python\n(.*?)\n```", text, re.S) for text in versions])
        for text in versions:
            for anchor in ("rotary-layout", "dynamic-rope-cache"):
                self.assertIn("{#" + anchor + "}", text)
            for number in ("11.1452", "6.8878"):
                self.assertIn(number, text)
            self.assertIn("../code/model.py", text)
            self.assertIn("a0940f9cf7065d45bb6675660f80d305c041a754", text)
            self.assertIn("v4.44.2", text)


@unittest.skipIf(torch is None, "PyTorch unavailable; RoPE CPU checks not executed")
class RotaryNumericsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = runpy.run_path(str(ROOT / "00-foundations/code/model.py"))

    @staticmethod
    def adjacent_rotation(inputs, cosine, sine):
        pairs = inputs.reshape(*inputs.shape[:-1], -1, 2)
        first, second = pairs[..., 0], pairs[..., 1]
        return torch.stack((first * cosine - second * sine,
                            first * sine + second * cosine), dim=-1).flatten(-2)

    def test_absolute_layout_example_and_permutation(self):
        query = torch.tensor([[[[1., 2., 3., 4.]]]])
        key = torch.tensor([[[[4., 3., 2., 1.]]]])
        cosine, sine = self.model["build_rope_cache"](4, 2, 10000.0)
        adjacent = self.adjacent_rotation(query, cosine[1:2], sine[1:2])
        split = self.model["apply_rope"](query, cosine[1:2], sine[1:2])
        self.assertAlmostEqual((adjacent * key).sum().item(), 11.145168, places=5)
        self.assertAlmostEqual((split * key).sum().item(), 6.887815, places=5)
        permutation = [0, 2, 1, 3]
        converted = self.model["apply_rope"](query[..., permutation], cosine[1:2], sine[1:2])
        torch.testing.assert_close(converted, adjacent[..., permutation])
        torch.testing.assert_close((converted * key[..., permutation]).sum(), (adjacent * key).sum())

    def test_projection_permutation_stays_within_each_head(self):
        generator = torch.Generator().manual_seed(12)
        inputs = torch.randn(2, 3, 7, generator=generator)
        head_dim = 8
        permutation = torch.cat((torch.arange(0, head_dim, 2), torch.arange(1, head_dim, 2)))
        cosine, sine = self.model["build_rope_cache"](head_dim, 3, 10000.0)
        for heads in (2, 4):
            weights = torch.randn(heads, head_dim, 7, generator=generator)
            original = (inputs @ weights.reshape(-1, 7).T).reshape(2, 3, heads, head_dim).transpose(1, 2)
            converted_weights = weights[:, permutation].reshape(-1, 7)
            converted = (inputs @ converted_weights.T).reshape(2, 3, heads, head_dim).transpose(1, 2)
            expected = self.adjacent_rotation(original, cosine, sine)[..., permutation]
            actual = self.model["apply_rope"](converted, cosine, sine)
            torch.testing.assert_close(actual, expected)

    def test_rerotation_is_not_a_multilayer_cache_rebuild(self):
        with torch.random.fork_rng(), torch.no_grad():
            for layers in (1, 2):
                with self.subTest(layers=layers):
                    torch.manual_seed(0)
                    config = self.model["Config"](vocab_size=64, n_layer=layers, n_head=4,
                                                  n_kv_head=2, d_model=64, max_seq_len=32)
                    network = self.model["Transformer"](config).eval()
                    tokens = torch.randint(0, config.vocab_size, (1, 13))
                    old_cache = self.model["KVCache"](config, 1, "cpu")
                    network(tokens[:, :12], cache=old_cache)
                    old_cosine, old_sine = network.rope_cos.clone(), network.rope_sin.clone()
                    frequencies = config.rope_theta ** (-torch.arange(0, config.head_dim, 2).float() / config.head_dim)
                    angles = torch.arange(config.max_seq_len).float()[:, None] * frequencies / 4
                    network.rope_cos.copy_(angles.cos())
                    network.rope_sin.copy_(angles.sin())
                    for layer in range(layers):
                        unrotated = self.model["apply_rope"](old_cache.k[layer][:, :, :12],
                                                              old_cosine[:12], -old_sine[:12])
                        old_cache.k[layer][:, :, :12] = self.model["apply_rope"](
                            unrotated, network.rope_cos[:12], network.rope_sin[:12])
                    approximate, unused = network(tokens[:, 12:], cache=old_cache)
                    fresh_cache = self.model["KVCache"](config, 1, "cpu")
                    reference, unused = network(tokens, cache=fresh_cache)
                    torch.testing.assert_close(old_cache.k[0][:, :, :12], fresh_cache.k[0][:, :, :12],
                                               atol=1e-6, rtol=1e-5)
                    torch.testing.assert_close(old_cache.v[0][:, :, :12], fresh_cache.v[0][:, :, :12])
                    if layers == 1:
                        torch.testing.assert_close(approximate[:, -1], reference[:, -1], atol=1e-6, rtol=1e-5)
                    else:
                        self.assertGreater((old_cache.v[1][:, :, :12] - fresh_cache.v[1][:, :, :12]).abs().max().item(), 1e-4)
                        self.assertGreater((approximate[:, -1] - reference[:, -1]).abs().max().item(), 1e-6)
                    rebuilt_cache = self.model["KVCache"](config, 1, "cpu")
                    network(tokens[:, :12], cache=rebuilt_cache)
                    rebuilt, unused = network(tokens[:, 12:], cache=rebuilt_cache)
                    torch.testing.assert_close(rebuilt[:, -1], reference[:, -1], atol=1e-6, rtol=1e-5)


if __name__ == "__main__":
    unittest.main()
