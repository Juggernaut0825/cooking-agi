import contextlib
import io
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
PRECISION = "00-foundations/deep-dives/precision-and-memory"
NORMALIZATION = "00-foundations/core/normalization"


def example_code(chapter, function_name, language=""):
    source = (ROOT / f"{chapter}{language}.md").read_text()
    return next(block for block in re.findall(r"```python\n(.*?)\n```", source, re.S)
                if f"def {function_name}(" in block)


def example_namespace(chapter, function_name, language=""):
    namespace = {}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(example_code(chapter, function_name, language), chapter, "exec"), namespace)
    return namespace


class PrecisionPresentationTests(unittest.TestCase):
    def test_normalization_example_and_localized_figure(self):
        self.assertEqual(example_code(NORMALIZATION, "batchnorm_train_eval_example"),
                         example_code(NORMALIZATION, "batchnorm_train_eval_example", ".en"))
        for language, expected_lang in (("", "zh-CN"), (".en", "en")):
            source = (ROOT / f"{NORMALIZATION}{language}.md").read_text()
            self.assertIn("{#train-eval-statistics}", source)
            self.assertIn("{#batchnorm-accumulation}", source)
            figure = next(value for value in re.findall(r"<figure\b.*?</figure>", source, re.S)
                          if 'id="normalization-train-eval"' in value)
            self.assertIn(f'lang="{expected_lang}"', figure)
            self.assertEqual(figure.count("<li>"), 2)
            if language:
                self.assertNotRegex(figure, r"[\u4e00-\u9fff]")
            else:
                self.assertRegex(figure, r"[\u4e00-\u9fff]")

    def test_examples_and_localized_figure(self):
        for function_name in ("rounded_update_example", "autocast_dtype_example"):
            self.assertEqual(example_code(PRECISION, function_name),
                             example_code(PRECISION, function_name, ".en"))
        for language, expected_lang in (("", "zh-CN"), (".en", "en")):
            source = (ROOT / f"{PRECISION}{language}.md").read_text()
            self.assertIn("{#rounded-away-update}", source)
            figure = next(value for value in re.findall(r"<figure\b.*?</figure>", source, re.S)
                          if 'id="precision-update-paths"' in value)
            self.assertIn(f'lang="{expected_lang}"', figure)
            self.assertEqual(figure.count("<li>"), 2)
            if language:
                self.assertNotRegex(figure, r"[\u4e00-\u9fff]")
            else:
                self.assertRegex(figure, r"[\u4e00-\u9fff]")


@unittest.skipIf(torch is None, "PyTorch unavailable; precision CPU checks not executed")
class PrecisionNumericsTests(unittest.TestCase):
    def test_published_update_example(self):
        for language in ("", ".en"):
            namespace = example_namespace(PRECISION, "rounded_update_example", language)
            low_result, full_result, rounded_result = namespace["rounded_update_example"]()
            self.assertEqual(low_result, 1.0)
            self.assertAlmostEqual(full_result, 0.9, delta=2e-6)
            self.assertEqual(rounded_result, 0.8984375)
            self.assertGreater(torch.tensor(0.001, dtype=torch.bfloat16).item(), 0.0)

    def test_local_rounding_grid_and_step_size_boundary(self):
        weight = torch.tensor(1.0, dtype=torch.bfloat16)
        predecessor = torch.nextafter(weight, torch.tensor(0.0, dtype=torch.bfloat16))
        self.assertEqual(predecessor.item(), 0.99609375)
        self.assertLess(abs(0.999 - 1.0), abs(0.999 - predecessor.item()))
        self.assertEqual((weight - 0.001).item(), 1.0)
        self.assertEqual((weight - 0.004).item(), predecessor.item())

    def test_published_autocast_dtypes_and_gradients(self):
        for language in ("", ".en"):
            namespace = example_namespace(PRECISION, "autocast_dtype_example", language)
            dtypes, gradient = namespace["autocast_dtype_example"]()
            self.assertEqual(dtypes, (torch.float32, torch.bfloat16, torch.float32, torch.float32))
            torch.testing.assert_close(gradient, torch.tensor([[6., 8.]], dtype=torch.float32))


@unittest.skipIf(torch is None, "PyTorch unavailable; normalization CPU checks not executed")
class NormalizationNumericsTests(unittest.TestCase):
    def test_published_train_eval_example(self):
        for language in ("", ".en"):
            namespace = example_namespace(NORMALIZATION, "batchnorm_train_eval_example", language)
            training, evaluation, variance = namespace["batchnorm_train_eval_example"]()
            expected = torch.tensor([[-1.0], [1.0]])
            torch.testing.assert_close(training, expected)
            torch.testing.assert_close(evaluation, expected / 2 ** 0.5)
            self.assertEqual(variance.item(), 2.0)

    def test_accumulation_changes_statistics_and_gradients(self):
        inputs = torch.tensor([[0.0], [2.0], [10.0], [12.0]])
        coefficients = torch.tensor([[0.0], [1.0], [2.0], [3.0]])
        full = torch.nn.BatchNorm1d(1, eps=0, momentum=0.1)
        micro = torch.nn.BatchNorm1d(1, eps=0, momentum=0.1)
        full_output = full(inputs)
        (full_output * coefficients).sum().div(4).backward()
        micro_output = []
        for input_chunk, coefficient_chunk in zip(inputs.split(2), coefficients.split(2)):
            output_chunk = micro(input_chunk)
            micro_output.append(output_chunk)
            (output_chunk * coefficient_chunk).sum().div(4).backward()
        self.assertAlmostEqual(full.running_mean.item(), 0.6, places=6)
        self.assertAlmostEqual(full.running_var.item(), 0.9 + 0.1 * 104 / 3, places=6)
        self.assertAlmostEqual(micro.running_mean.item(), 1.19, places=6)
        self.assertAlmostEqual(micro.running_var.item(), 1.19, places=6)
        self.assertFalse(torch.allclose(full_output, torch.cat(micro_output)))
        self.assertFalse(torch.allclose(full.weight.grad, micro.weight.grad))
        self.assertEqual(full.num_batches_tracked.item(), 1)
        self.assertEqual(micro.num_batches_tracked.item(), 2)

    def test_normalized_shape_controls_token_independence(self):
        inputs = torch.tensor([[[1., 2.], [3., 5.], [6., 8.]]])
        changed = inputs.clone()
        changed[:, -1] += 100
        for constructor in (torch.nn.LayerNorm, torch.nn.RMSNorm):
            with self.subTest(layer=constructor.__name__):
                token_norm = constructor(2, eps=0, elementwise_affine=False)
                sequence_norm = constructor((3, 2), eps=0, elementwise_affine=False)
                torch.testing.assert_close(token_norm(inputs)[:, 0], token_norm(changed)[:, 0])
                self.assertFalse(torch.allclose(sequence_norm(inputs)[:, 0], sequence_norm(changed)[:, 0]))

    def test_no_grad_does_not_freeze_batchnorm_state(self):
        norm = torch.nn.BatchNorm1d(1, momentum=1)
        with torch.no_grad():
            norm(torch.tensor([[1.], [3.]]))
        self.assertEqual(norm.running_mean.item(), 2)
        norm.eval()
        output = norm(torch.tensor([[10.], [20.]], requires_grad=True))
        self.assertTrue(output.requires_grad)
        self.assertEqual(norm.running_mean.item(), 2)

    def test_eval_without_running_statistics_still_reads_future(self):
        original = torch.tensor([[[1., 2., 3.]]])
        changed = original.clone()
        changed[:, :, -1] += 100
        current = torch.nn.BatchNorm1d(1, affine=False, track_running_stats=False).eval()
        self.assertFalse(torch.allclose(current(original)[:, :, 0], current(changed)[:, :, 0]))
        frozen = torch.nn.BatchNorm1d(1, affine=False).eval()
        torch.testing.assert_close(frozen(original)[:, :, 0], frozen(changed)[:, :, 0])

    def test_small_absolute_mean_does_not_make_norms_equal(self):
        layer = torch.nn.LayerNorm(2, eps=0, elementwise_affine=False)
        rms = torch.nn.RMSNorm(2, eps=0, elementwise_affine=False)
        for scale in (1.0, 1e-6):
            inputs = torch.tensor([1., 3.]) * scale
            torch.testing.assert_close(layer(inputs), torch.tensor([-1., 1.]))
            torch.testing.assert_close(rms(inputs), torch.tensor([1., 3.]) / 5 ** 0.5)
            self.assertFalse(torch.allclose(layer(inputs), rms(inputs)))
        torch.testing.assert_close(layer(torch.tensor([-1., 1.])), rms(torch.tensor([-1., 1.])))


if __name__ == "__main__":
    unittest.main()
