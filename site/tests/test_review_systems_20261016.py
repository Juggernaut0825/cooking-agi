import ast
import contextlib
import io
import math
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


def python_blocks(relative_path):
    return re.findall(r"```python\n(.*?)```", (ROOT / relative_path).read_text(), re.S)


def execute_example(relative_path, index=0):
    namespace = {}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(python_blocks(relative_path)[index], namespace)
    return namespace


class SystemsReviewTests(unittest.TestCase):
    def test_bilingual_executable_examples_match(self):
        for stem in (
            "12-infra/quantization/formats-and-error",
            "12-infra/quantization/checking-quality",
            "12-infra/quantization/weight-only-and-ptq",
            "11-frontier/diffusion-lm/masked-diffusion",
            "11-frontier/diffusion-lm/decoding-and-speed",
        ):
            with self.subTest(stem=stem):
                chinese = [ast.dump(ast.parse(block)) for block in python_blocks(stem + ".md")]
                english = [ast.dump(ast.parse(block)) for block in python_blocks(stem + ".en.md")]
                self.assertEqual(chinese, english)

    def test_quantization_outlier_uses_consistent_denominator(self):
        example = execute_example("12-infra/quantization/formats-and-error.md")
        error = example["mse"](example["outlier_weights"], example["outlier_restored"])
        self.assertAlmostEqual(error, 0.2592)
        self.assertAlmostEqual(error / 0.0042, 61.714285714285715)
        self.assertAlmostEqual(error * 8 / 7, 0.29622857142857145)

    def test_affine_zero_point_handles_positive_negative_and_zero_ranges(self):
        example = execute_example("12-infra/quantization/formats-and-error.en.md")
        for values in ([1.0, 2.0], [-2.0, -1.0], [-1.0, 2.0], [0.0, 0.0]):
            with self.subTest(values=values):
                scale, zero_point, codes, restored = example["quantize_affine"](values)
                self.assertGreater(scale, 0)
                self.assertTrue(0 <= zero_point <= 15)
                self.assertTrue(all(0 <= code <= 15 for code in codes))
                self.assertEqual(scale * (zero_point - zero_point), 0)
                self.assertTrue(all(abs(before - after) <= scale / 2 + 1e-12
                                    for before, after in zip(values, restored)))
        self.assertEqual(example["quantize_sym"]([0.0, 0.0])[2], [0.0, 0.0])

    def test_paired_report_example_and_invalid_pairs(self):
        example = execute_example("12-infra/quantization/checking-quality.md")
        report = example["report"]
        self.assertAlmostEqual(report["flips"], 0.056)
        self.assertAlmostEqual(report["diff"], -0.004)
        self.assertAlmostEqual(report["p"], 0.6889, places=4)
        self.assertAlmostEqual(report["ci95"][0] * 100, -1.87, places=2)
        self.assertAlmostEqual(report["ci95"][1] * 100, 1.07, places=2)
        for base, quantized in (([], []), ([True], []), ([True], [True, False])):
            with self.assertRaises(ValueError):
                example["paired_report"](base, quantized)
        unchanged = example["paired_report"]([True, False], [True, False])
        self.assertEqual(unchanged["p"], 1)
        self.assertEqual(unchanged["ci95"], (0, 0))

    def test_gptq_example_executes_and_beats_independent_rounding(self):
        example = execute_example("12-infra/quantization/weight-only-and-ptq.md")
        self.assertAlmostEqual(example["output_error"](example["rtn"]), 0.3527, places=4)
        self.assertAlmostEqual(example["output_error"](example["gptq"]), 0.00176, places=5)

    def test_diffusion_likelihood_depends_on_sampler(self):
        example = execute_example("11-frontier/diffusion-lm/masked-diffusion.md")
        self.assertAlmostEqual(example["objective"], (example["left_to_right"] + example["right_to_left"]) / 2)
        self.assertAlmostEqual(math.exp(-example["generator_nll"]), 0.105)
        self.assertAlmostEqual(math.exp(-example["left_to_right"]), 0.16)
        self.assertGreater(example["objective"], example["generator_nll"])

    def test_full_mask_probability_integrates_to_one_over_length_plus_one(self):
        for length in (1, 2, 4, 8):
            subdivisions = 10000
            estimate = sum(((index + 0.5) / subdivisions) ** length
                           for index in range(subdivisions)) / subdivisions
            self.assertAlmostEqual(estimate, 1 / (length + 1), places=7)

    def test_roofline_counts_prefill_first_token_and_integer_batch(self):
        example = execute_example("11-frontier/diffusion-lm/decoding-and-speed.md", 1)
        step = example["step"]
        latency = example["prefill"] + 255 * step(1)
        self.assertAlmostEqual(latency, 1072.2805943478195)
        self.assertEqual(round(latency), 1072)
        self.assertEqual(round(latency / (64 * step(768)), 2), 1.54)
        threshold = example["weight_read_ms"] / example["position_compute_ms"] / 32
        self.assertEqual(math.ceil(threshold), 10)
        self.assertGreater(step(32 * 10), step(32 * 9))

    def test_mixed_fp8_head_limits_speedup(self):
        mixed_seconds = 2 * 7.5e9 / 1978.9e12 + 2 * 0.5e9 / 989.4e12
        bf16_seconds = 2 * 8e9 / 989.4e12
        self.assertEqual(round(1 / mixed_seconds), 116405)
        self.assertAlmostEqual(bf16_seconds / mixed_seconds, 1.8824, places=4)
        self.assertLess(bf16_seconds / mixed_seconds, 2)

    def test_kv_memory_decimal_budget(self):
        bf16_bytes = 2 * 32 * 8 * 128 * 2 * 131072
        self.assertEqual(bf16_bytes, 16 * 2 ** 30)
        remaining_bytes = 80e9 - 16e9 - 6e9
        self.assertEqual(remaining_bytes // bf16_bytes, 3)
        self.assertEqual(remaining_bytes // (bf16_bytes / 2), 6)
        self.assertEqual(2 * 32 * 8 * 128 * 2 * 128, 16 * 2 ** 20)
        performance_bytes = 14e9 + 128 * 4096 * 131072
        self.assertGreater(performance_bytes, 80e9)
        self.assertAlmostEqual(performance_bytes / 1e9, 82.7, places=1)

    def test_kivi_minmax_example_is_not_integer_zero_point(self):
        keys = [[0.4, -0.2, 9.0, 0.1], [-0.3, 0.5, 11.0, -0.4],
                [0.2, -0.6, 10.0, 0.3], [0.5, 0.1, 12.0, -0.2]]
        query = [1, 1, 0.1, 1]

        def quantize_group(values):
            lower = min(values)
            scale = (max(values) - lower) / 3
            return [lower + scale * round((value - lower) / scale) for value in values]

        token_keys = [quantize_group(row) for row in keys]
        channel_keys = list(zip(*(quantize_group(column) for column in zip(*keys))))

        def scores(matrix):
            return [sum(value * coefficient for value, coefficient in zip(row, query))
                    for row in matrix]

        reference = scores(keys)
        self.assertEqual([round(value, 2) for value in scores(token_keys)], [0.3, -0.1, -0.8, 0.6])
        self.assertEqual([round(value, 2) for value in scores(channel_keys)], [1.23, 0.9, 0.93, 1.67])
        self.assertAlmostEqual(max(abs(before - after) for before, after in zip(reference, scores(token_keys))), 1.7)
        self.assertAlmostEqual(max(abs(before - after) for before, after in zip(reference, scores(channel_keys))) / 2, 1 / 30)

    def test_fp8_fnuz_reinterpretation_excludes_special_encodings(self):
        def decode(payload, fnuz):
            sign = -1 if payload & 128 else 1
            exponent = (payload >> 3) & 15
            mantissa = payload & 7
            if (fnuz and payload == 128) or (not fnuz and exponent == 15 and mantissa == 7):
                return math.nan
            bias = 8 if fnuz else 7
            significand = mantissa / 8 if exponent == 0 else 1 + mantissa / 8
            return sign * significand * 2 ** ((1 if exponent == 0 else exponent) - bias)

        for payload in range(256):
            if payload not in (0, 128, 127, 255):
                self.assertEqual(decode(payload, False), 2 * decode(payload, True))
        self.assertTrue(math.isnan(decode(128, True)))
        self.assertEqual(decode(127, True), 240)
        self.assertTrue(math.isnan(decode(127, False)))
        tiny_value = 2 ** -11
        self.assertEqual(abs(0 - tiny_value) / tiny_value, 1)

    def test_vllm_version_and_conditions_remain_in_both_languages(self):
        for language in ("", ".en"):
            serving = (ROOT / ("06-systems/inference-frameworks" + language + ".md")).read_text()
            for marker in ("prefix_match_unit", "PCP=1", "TP × PCP × DP", "v0.31.0"):
                self.assertIn(marker, serving)
            quantization = (ROOT / ("12-infra/quantization/fp8-and-kv-cache" + language + ".md")).read_text()
            for marker in ("CUDA 11.8+", "ROCm", "int4_per_token_head", "*_per_token_head"):
                self.assertIn(marker, quantization)

    def test_migrated_headings_preserve_old_entry_points(self):
        headings = {
            "": ("## 部署时的 DP，不一定是互不相干的副本", "## PP 的 KV 在哪里，边界传多少东西？"),
            ".en": ("## Serving DP does not always mean independent replicas", "## Where does PP keep KV, and what crosses a boundary?"),
        }
        for language, expected in headings.items():
            source = (ROOT / ("06-systems/distributed-training" + language + ".md")).read_text()
            self.assertIn("{#eight-gpus}", source)
            for heading in expected:
                self.assertEqual(source.count(heading), 1)


if __name__ == "__main__":
    unittest.main()
