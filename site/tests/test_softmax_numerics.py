import math
from pathlib import Path
import re
import runpy
import unittest

try:
    import numpy as np
except ModuleNotFoundError as error:
    if error.name != "numpy":
        raise
    np = None


ROOT = Path(__file__).resolve().parents[2]


def python_examples(chapter, suffix=".md"):
    source = (ROOT / (chapter + suffix)).read_text()
    return re.findall(r"```python\n(.*?)```", source, re.S)


def streaming_example(suffix=".md"):
    namespace = {}
    for snippet in python_examples("00-foundations/deep-dives/attention-kernels", suffix):
        if "def streaming_attention" in snippet:
            exec(compile(snippet, "streaming_attention", "exec"), namespace)
    return namespace["streaming_attention"]


@unittest.skipUnless(np is not None, "NumPy is required for array softmax checks")
class ArraySoftmaxTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.implementations = [
            runpy.run_path(str(ROOT / "00-foundations/code" / name))["softmax"]
            for name in ("attention_numpy.py", "interview_kit.py")
        ]
        cls.inline_examples = []
        for suffix in (".md", ".en.md"):
            snippets = python_examples("00-foundations/core/multi-head-attention", suffix)
            snippet = next(code for code in snippets if "def softmax(" in code)
            namespace = {}
            exec(compile(snippet, "inline-attention" + suffix, "exec"), namespace)
            cls.inline_examples.append(namespace)
            cls.implementations.append(namespace["softmax"])

    def test_inline_attention_uses_each_calls_sequence_length(self):
        oracle = runpy.run_path(str(ROOT / "00-foundations/code/attention_numpy.py"))
        generator = np.random.default_rng(42)
        for namespace in self.inline_examples:
            namespace["seq_length"] = 97
            module = namespace["MultiHeadAttention"](12, 3, seed=4)
            reference = oracle["MultiHeadAttention"](12, 3, seed=4)
            for length in (2, 5, 1):
                inputs = generator.normal(size=(2, length, 12))
                mask = namespace["causal_mask"](length)
                actual, weights = module(inputs, mask)
                expected, expected_weights = reference(inputs, mask)
                self.assertEqual(actual.shape, (2, length, 12))
                np.testing.assert_allclose(actual, expected)
                np.testing.assert_allclose(weights, expected_weights)

    def test_large_logits_and_shared_offset(self):
        expected = np.array([0.090030573, 0.244728471, 0.665240956])
        for implementation in self.implementations:
            for offset in (-1000, 0, 1000):
                with self.subTest(module=implementation.__module__, offset=offset):
                    actual = implementation(np.array([0.0, 1.0, 2.0]) + offset)
                    np.testing.assert_allclose(actual, expected, atol=1e-9)

    def test_fp16_long_row_uses_wider_sum_and_output(self):
        logits = np.zeros((2, 65536), dtype=np.float16)
        for implementation in self.implementations:
            with np.errstate(over="raise", invalid="raise", divide="raise"):
                probabilities = implementation(logits)
            self.assertEqual(probabilities.dtype, np.float32)
            np.testing.assert_array_equal(probabilities.sum(axis=-1), [1, 1])
            np.testing.assert_array_equal(probabilities, np.full(logits.shape, 1 / 65536))

    def test_preserves_float64_and_handles_integer_subtraction(self):
        for implementation in self.implementations:
            result = implementation(np.array([0, 1], dtype=np.float64))
            self.assertEqual(result.dtype, np.float64)
            np.testing.assert_array_equal(implementation(np.array([-128, 127], dtype=np.int8)),
                                          [0, 1])

    def test_masks_normalize_on_requested_axis(self):
        logits = np.array([[0, -np.inf], [-np.inf, 0], [0, 0]], dtype=float)
        for implementation in self.implementations:
            actual = implementation(logits, axis=0)
            np.testing.assert_array_equal(actual, [[0.5, 0], [0, 0.5], [0.5, 0.5]])

    def test_invalid_logits_and_empty_support_raise(self):
        inputs = ([math.inf, 0], [math.nan, 0], [-math.inf, -math.inf],
                  [[0, 1], [-math.inf, -math.inf]], [1j, 0],
                  [2**60, 2**60 + 1])
        for implementation in self.implementations:
            for logits in inputs:
                with self.subTest(input=logits), self.assertRaises(ValueError):
                    implementation(logits)

    def test_direct_log_probability_example_in_both_languages(self):
        chapter = "00-foundations/hand-write-kit"
        self.assertEqual(python_examples(chapter), python_examples(chapter, ".en.md"))
        for suffix in (".md", ".en.md"):
            namespace = {}
            for snippet in python_examples(chapter, suffix):
                exec(compile(snippet, chapter + suffix, "exec"), namespace)
            self.assertEqual(namespace["probabilities"][1], 0)
            self.assertEqual(namespace["direct"][1], -1000)
            self.assertTrue(np.isneginf(namespace["indirect"][1]))


class StreamingSoftmaxTests(unittest.TestCase):
    def test_streaming_rejects_bad_numbers_and_block_sizes(self):
        for suffix in (".md", ".en.md"):
            attention = streaming_example(suffix)
            for bad in (math.inf, math.nan):
                with self.assertRaises(ValueError):
                    attention([bad, 0], [1, 2], 1)
                with self.assertRaises(ValueError):
                    attention([0, 1], [bad, 2], 1)
            for block_size in (0, -1, 1.5, True):
                with self.assertRaises(ValueError):
                    attention([0], [1], block_size)
            self.assertEqual(attention([-math.inf, 0], [math.nan, 7], 1), 7)

    def test_block_averaging_counterexample(self):
        attention = streaming_example()
        scores = [0, 0, math.log(8)]
        values = [10, 20, 0]
        first = attention(scores[:2], values[:2], 1)
        second = attention(scores[2:], values[2:], 1)
        self.assertEqual((first + second) / 2, 7.5)
        for block_size in (1, 2, 3, 4):
            self.assertAlmostEqual(attention(scores, values, block_size), 3)

    def test_original_example_equal_block_mass_is_only_a_coincidence(self):
        attention = streaming_example()
        scores = [math.log(1), math.log(2), math.log(3)]
        values = [10, 20, 0]
        block_average = (attention(scores[:2], values[:2], 1) + values[2]) / 2
        self.assertAlmostEqual(block_average, attention(scores, values, 2))

    def test_partition_statistics_merge_without_averaging_outputs(self):
        attention = streaming_example()
        scores = [-math.inf, 1, -5, 4, 0, 2]
        values = [0, 3, 4, 10, -1, 6]
        expected = attention(scores, values, 2)
        for boundary in range(1, len(scores)):
            statistics = []
            for start, end in ((0, boundary), (boundary, len(scores))):
                visible = [(score, value) for score, value in zip(scores[start:end], values[start:end])
                           if score != -math.inf]
                if not visible:
                    continue
                maximum = max(score for score, value in visible)
                weights = [math.exp(score - maximum) for score, value in visible]
                statistics.append((maximum, sum(weights),
                                   sum(weight * value for weight, (score, value) in zip(weights, visible))))
            maximum = max(part[0] for part in statistics)
            normalizer = sum(math.exp(part[0] - maximum) * part[1] for part in statistics)
            numerator = sum(math.exp(part[0] - maximum) * part[2] for part in statistics)
            self.assertAlmostEqual(numerator / normalizer, expected)


if __name__ == "__main__":
    unittest.main()
