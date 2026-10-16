import ast
import contextlib
import importlib.util
import io
import math
from pathlib import Path
import re
import sys
import unittest

try:
    import torch
except ModuleNotFoundError as error:
    if error.name != "torch":
        raise
    torch = None


ROOT = Path(__file__).resolve().parents[2]
FOUNDATIONS = ROOT / "00-foundations"
PYTORCH_CHAPTERS = (
    "README", "tensors-and-storage", "operations-and-shapes",
    "cross-entropy", "autograd", "training-loop",
)
CODE_CHAPTERS = tuple(f"pytorch/{chapter}" for chapter in PYTORCH_CHAPTERS) + (
    "scaling/compute-optimal", "scaling/hyperparameters",
    "deep-dives/gated-attention", "deep-dives/recurrent-dynamics",
    "moe/systems", "transformer",
)


def python_blocks(chapter, language=""):
    text = (FOUNDATIONS / f"{chapter}{language}.md").read_text()
    return re.findall(r"```python\n(.*?)```", text, re.DOTALL)


def execute_examples(chapter, language="", namespace=None):
    namespace = {} if namespace is None else namespace
    with contextlib.redirect_stdout(io.StringIO()):
        for position, block in enumerate(python_blocks(chapter, language)):
            exec(compile(block, f"{chapter}{language}:{position}", "exec"), namespace)
    return namespace


def loss_surface(parameters, tokens):
    return 1.82 + 482 / parameters ** 0.348 + 2085 / tokens ** 0.366


def reference_optimum():
    exponent = 0.366 / (0.348 + 0.366)
    coefficient = (0.348 * 482 / (0.366 * 2085)) ** (1 / (0.348 + 0.366))
    parameters = coefficient * (1e22 / 6) ** exponent
    return parameters, 1e22 / (6 * parameters)


def inference_optimum(inference_tokens):
    reference_parameters, reference_tokens = reference_optimum()
    target = loss_surface(reference_parameters, reference_tokens)

    def training_tokens(parameters):
        return (2085 / (target - 1.82 - 482 / parameters ** 0.348)) ** (1 / 0.366)

    def cost(log_parameters):
        parameters = math.exp(log_parameters)
        return 6 * parameters * training_tokens(parameters) + 2 * parameters * inference_tokens

    lower = math.log((482 / (target - 1.82)) ** (1 / 0.348) * (1 + 1e-10))
    upper = math.log(2 * reference_parameters)
    for _ in range(150):
        left = lower + (upper - lower) / 3
        right = upper - (upper - lower) / 3
        if cost(left) < cost(right):
            upper = right
        else:
            lower = left
    parameters = math.exp((lower + upper) / 2)
    tokens = training_tokens(parameters)
    return parameters, tokens, cost(math.log(parameters))


class FoundationsDocumentTests(unittest.TestCase):
    def test_bilingual_python_ast_matches(self):
        for chapter in CODE_CHAPTERS:
            with self.subTest(chapter=chapter):
                chinese = python_blocks(chapter)
                english = python_blocks(chapter, ".en")
                self.assertTrue(chinese)
                self.assertEqual(len(chinese), len(english))
                for chinese_block, english_block in zip(chinese, english):
                    self.assertEqual(ast.dump(ast.parse(chinese_block)), ast.dump(ast.parse(english_block)))

    def test_scaling_draft_status_retained(self):
        for source in (FOUNDATIONS / "scaling").glob("*.md"):
            with self.subTest(source=source.name):
                text = source.read_text()
                self.assertIn("Draft, pending review" if source.name.endswith(".en.md") else "待审核草稿", text)

    def test_decoder_legacy_anchors_retained(self):
        anchors = {
            "": ("2-rope-qk", "3-pre-norm-rmsnorm", "4-swiglu-ffn", "5-mhamqa-gqa-kv", "6-kv-cache", "7-flashattention", "8", "9-moe-ffn", "10-block"),
            ".en": ("2-rope-relative-phase-in-q-and-k", "3-pre-norm-and-rmsnorm-protecting-the-residual-stream", "4-swiglu-content-and-a-learned-gate", "5-mha-mqa-and-gqa-reducing-kv-width", "6-kv-cache-trading-memory-for-historical-recomputation", "7-flashattention-the-same-formula-with-less-memory-traffic", "8-long-context-position-extrapolation-and-quadratic-cost-are-different-problems", "9-moe-scaling-ffn-capacity-not-attention-heads", "10-walking-through-one-modern-block-end-to-end"),
        }
        for language, expected in anchors.items():
            text = (FOUNDATIONS / f"core/decoder-only{language}.md").read_text()
            actual = set(re.findall(r'\{#([^}]+)\}|id="([^"]+)"', text))
            actual = {first or second for first, second in actual}
            self.assertTrue(set(expected).issubset(actual))

    def test_math_only_examples_execute_in_both_languages(self):
        for chapter in ("scaling/compute-optimal", "scaling/hyperparameters", "deep-dives/gated-attention", "moe/systems"):
            for language in ("", ".en"):
                with self.subTest(chapter=chapter, language=language):
                    namespace = execute_examples(chapter, language)
                    if chapter.endswith("compute-optimal"):
                        self.assertAlmostEqual(namespace["slope"], 0.5, places=3)
                        self.assertAlmostEqual(namespace["n_opt"] / 1e9, 9.17, places=2)


class FoundationsArithmeticTests(unittest.TestCase):
    def test_training_surface_table(self):
        parameters, tokens = reference_optimum()
        self.assertAlmostEqual(parameters / 1e9, 9.0555088, places=6)
        self.assertAlmostEqual(tokens / 1e9, 184.0500301, places=5)
        baseline = loss_surface(parameters, tokens)
        expected_ratios = (325, 81, 20, 5, 1)
        for multiplier, expected_ratio in zip((0.25, 0.5, 1, 2, 4), expected_ratios):
            scaled_parameters = parameters * multiplier
            scaled_tokens = tokens / multiplier
            self.assertEqual(round(scaled_tokens / scaled_parameters), expected_ratio)
            self.assertGreaterEqual(loss_surface(scaled_parameters, scaled_tokens) - baseline, -1e-12)
        for language in ("", ".en"):
            text = (FOUNDATIONS / f"scaling/compute-optimal{language}.md").read_text()
            self.assertIn("| 325 |", text)
            self.assertIn("| 81 |", text)

    def test_inference_surface_table(self):
        reference_parameters, reference_tokens = reference_optimum()
        target = loss_surface(reference_parameters, reference_tokens)
        cases = ((0, 9.1, 184, 20), (1e11, 7.5, 225, 30), (1e12, 4.6, 446, 96), (1e13, 2.8, 1488, 535), (1e14, 2.0, 6407, 3204))
        for inference_tokens, rounded_parameters, rounded_tokens, ratio in cases:
            with self.subTest(inference_tokens=inference_tokens):
                parameters, tokens, total = inference_optimum(inference_tokens)
                self.assertEqual(round(parameters / 1e9, 1), rounded_parameters)
                self.assertEqual(round(tokens / 1e9), rounded_tokens)
                self.assertEqual(round(tokens / parameters), ratio)
                self.assertAlmostEqual(loss_surface(parameters, tokens), target, places=12)
                self.assertLessEqual(total, (1e22 + 2 * reference_parameters * inference_tokens) * (1 + 1e-12))
        parameters, tokens, total = inference_optimum(1e12)
        self.assertAlmostEqual(6 * parameters * tokens / 1e22, 1.2388464, places=6)
        self.assertAlmostEqual(1 - total / (1e22 + 2 * reference_parameters * 1e12), 0.2301292, places=6)

    def test_repeated_data_effective_tokens(self):
        for epochs, expected in ((1, 100), (2, 196.8), (4, 372.6), (16, 1058.6), (40, 1517.6)):
            effective = 100 * (1 + 15.4 * (1 - math.exp(-(epochs - 1) / 15.4)))
            self.assertAlmostEqual(effective, expected, delta=0.05)
            self.assertLessEqual(effective, epochs * 100)
            self.assertLess(effective, 1640)

    def test_batch_tradeoff_and_adam_conversion(self):
        steps = lambda batch: 10000 * (1 + 2e6 / batch)
        self.assertEqual(steps(4e6), 15000)
        self.assertEqual(steps(16e6), 11250)
        self.assertEqual(steps(16e6) * 16e6 / (steps(4e6) * 4e6), 3)
        self.assertAlmostEqual(3e-4 * math.sqrt(4), 6e-4)
        self.assertAlmostEqual(1 - 4 * (1 - 0.9), 0.6)
        self.assertAlmostEqual(1 - 4 * (1 - 0.95), 0.8)
        self.assertAlmostEqual(1e-8 / math.sqrt(4), 5e-9)
        self.assertLess(1 - 20 * (1 - 0.9), 0)

    def test_weight_decay_preserves_timescale_only_with_lr_accounted_for(self):
        old_batch, old_lr, old_decay, tokens = 1e6, 3e-4, 0.1, 1e11
        new_batch, new_lr = 4 * old_batch, 2 * old_lr
        new_decay = old_decay * new_batch / old_batch * old_lr / new_lr
        old_timescale = old_batch / (old_lr * old_decay * tokens)
        self.assertAlmostEqual(new_decay, 0.2)
        self.assertAlmostEqual(new_batch / (new_lr * new_decay * tokens), old_timescale)
        self.assertNotAlmostEqual(new_batch / (new_lr * 4 * old_decay * tokens), old_timescale)

    def test_mup_update_and_epsilon_suppression(self):
        for upstream in (-1, 1):
            for width in (512, 4096):
                activation = [1 if index % 2 else -1 for index in range(width)]
                learning_rate = 0.01 * 512 / width
                change = sum(-learning_rate * math.copysign(1, upstream * value) * value for value in activation)
                self.assertAlmostEqual(abs(change), 5.12)
                self.assertEqual(math.copysign(1, change), -upstream)
        gradient = 1e-12
        self.assertNotEqual(gradient, 0)
        self.assertAlmostEqual(gradient / (abs(gradient) + 1e-8), 9.9990001e-5)

    def test_gqa_projection_parameters_and_cache(self):
        width, query_heads, head_dimension = 8, 4, 2
        query_and_output = 2 * width * query_heads * head_dimension
        attention_parameters = [query_and_output + 2 * width * kv_heads * head_dimension for kv_heads in (4, 1)]
        cache_scalars = [2 * kv_heads * head_dimension for kv_heads in (4, 1)]
        self.assertEqual(attention_parameters, [256, 160])
        self.assertEqual(cache_scalars, [16, 4])
        self.assertEqual(8 * 7168 * 2 * 4096 / 2 ** 20, 448)
        self.assertEqual(4 * 7168 / 2 ** 10, 28)

    def test_zero_mean_is_needed_for_dot_product_variance(self):
        centered_products = [query * key for query in (-1, 1) for key in (-1, 1)]
        shifted_products = [query * key for query in (0, 2) for key in (0, 2)]
        variance = lambda values: sum(value ** 2 for value in values) / len(values) - (sum(values) / len(values)) ** 2
        self.assertEqual(variance(centered_products), 1)
        self.assertEqual(variance(shifted_products), 3)


@unittest.skipIf(torch is None, "PyTorch unavailable: CPU numerical checks were not run")
class FoundationsTorchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        previous_threads = torch.get_num_threads()
        torch.set_num_threads(1)
        cls.addClassCleanup(torch.set_num_threads, previous_threads)

    def test_pytorch_and_recurrence_examples_execute_both_languages(self):
        chapters = tuple(f"pytorch/{chapter}" for chapter in PYTORCH_CHAPTERS) + ("deep-dives/recurrent-dynamics",)
        with torch.random.fork_rng(devices=[]):
            for chapter in chapters:
                for language in ("", ".en"):
                    with self.subTest(chapter=chapter, language=language):
                        execute_examples(chapter, language)

    def test_soft_target_optimum_factory_exception_and_snapshot(self):
        target = torch.tensor([[0.1, 0.2, 0.7]], dtype=torch.float64)
        logits = target.log().requires_grad_()
        torch.nn.functional.cross_entropy(logits, target).backward()
        torch.testing.assert_close(logits.grad, torch.zeros_like(logits), atol=1e-15, rtol=0)
        with torch.no_grad():
            source = torch.tensor([2.0], requires_grad=True)
            computed = source * 2
        self.assertTrue(source.requires_grad)
        self.assertFalse(computed.requires_grad)
        snapshot = source.detach().cpu().numpy().copy()
        with torch.no_grad():
            source.add_(1)
        self.assertEqual(snapshot[0], 2)

    def test_qk_norm_direction_scale_and_noncommuting_gains(self):
        def normalized(values):
            return values / values.square().mean().sqrt()

        query = torch.tensor([1.0, 0.0], dtype=torch.float64)
        orthogonal_key = torch.tensor([0.0, 1.0], dtype=torch.float64)
        self.assertEqual((normalized(query) @ normalized(orthogonal_key)).item(), 0)
        self.assertAlmostEqual((normalized(query) @ normalized(query)).item() / math.sqrt(2), math.sqrt(2))
        torch.testing.assert_close(normalized(query), normalized(query * 3))
        rotation = torch.tensor([[0.0, -1.0], [1.0, 0.0]], dtype=torch.float64)
        gain = torch.tensor([2.0, 1.0], dtype=torch.float64)
        self.assertFalse(torch.allclose(rotation @ (gain * normalized(query)), gain * normalized(rotation @ query)))

    def test_chunked_gqa_cache_matches_full_forward(self):
        name = "review_foundations_model_20261016"
        specification = importlib.util.spec_from_file_location(name, FOUNDATIONS / "code/model.py")
        module = importlib.util.module_from_spec(specification)
        sys.modules[name] = module
        self.addCleanup(sys.modules.pop, name, None)
        specification.loader.exec_module(module)
        with torch.random.fork_rng(devices=[]), torch.no_grad():
            torch.manual_seed(123)
            for kv_heads in (1, 2, 4):
                configuration = module.Config(vocab_size=16, n_layer=2, n_head=4, n_kv_head=kv_heads, d_model=32, max_seq_len=12)
                model = module.Transformer(configuration).eval()
                tokens = torch.randint(0, 16, (2, 9))
                expected = model(tokens)[0]
                cache = module.KVCache(configuration, 2, "cpu")
                chunks = [model(tokens[:, start:stop], cache=cache)[0] for start, stop in ((0, 3), (3, 5), (5, 9))]
                torch.testing.assert_close(torch.cat(chunks, dim=1), expected, atol=1e-6, rtol=1e-5)
                self.assertEqual(cache.pos, 9)
                altered = tokens.clone()
                altered[:, 5:] = (altered[:, 5:] + 1) % 16
                torch.testing.assert_close(model(altered)[0][:, :5], expected[:, :5], atol=0, rtol=0)


if __name__ == "__main__":
    unittest.main()
