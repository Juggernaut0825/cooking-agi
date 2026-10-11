import importlib.util
from pathlib import Path
import unittest

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    'handwrite_kit', ROOT / '00-foundations/code/interview_kit.py',
)
KIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(KIT)


class HandwriteFilteringTests(unittest.TestCase):
    def test_top_k_ties_use_token_id_and_keep_exact_count(self):
        logits = np.array([2., 2., 2., 1.])
        for count in range(1, 5):
            actual = KIT.filter_logits(logits, top_k=count)
            self.assertEqual(np.flatnonzero(np.isfinite(actual)).tolist(), list(range(count)))
        np.testing.assert_array_equal(logits, [2., 2., 2., 1.])

    def test_top_p_keeps_the_threshold_crossing_token(self):
        logits = np.log([.1, .6, .3])
        actual = KIT.softmax(KIT.filter_logits(logits, top_p=.8))
        np.testing.assert_allclose(actual, [0., 2 / 3, 1 / 3])
        tied = KIT.filter_logits(np.zeros(4), top_p=.5)
        self.assertEqual(np.flatnonzero(np.isfinite(tied)).tolist(), [0, 1])

    def test_top_k_then_top_p_uses_surviving_mass(self):
        logits = np.log([.4, .3, .2, .1])
        actual = KIT.softmax(KIT.filter_logits(logits, top_k=2, top_p=.6))
        np.testing.assert_allclose(actual, [4 / 7, 3 / 7, 0., 0.])

    def test_no_truncation_preserves_masked_support(self):
        actual = KIT.filter_logits(np.array([0., -np.inf, -1000.]), top_k=3, top_p=1)
        self.assertEqual(np.flatnonzero(np.isfinite(actual)).tolist(), [0, 2])
        np.testing.assert_allclose(KIT.softmax(actual), [1., 0., 0.])

    def test_large_finite_temperature_scaling(self):
        with np.errstate(over='raise', invalid='raise', divide='raise', under='ignore'):
            actual = KIT.softmax(KIT.filter_logits(np.array([1e308, -1e308]), temperature=1e308))
            np.testing.assert_allclose(actual, [1 / (1 + np.exp(-2)), 1 / (1 + np.exp(2))])
            tied = KIT.softmax(KIT.filter_logits(np.array([1e308, 1e308]), temperature=1e-308))
            np.testing.assert_allclose(tied, [.5, .5])
            peaked = KIT.softmax(KIT.filter_logits(np.array([1e308, -1e308]), temperature=1e-308))
            np.testing.assert_allclose(peaked, [1., 0.])

    def test_invalid_parameters_are_rejected(self):
        logits = np.array([0., 1.])
        for temperature in (0., -1., np.nan, np.inf):
            with self.subTest(temperature=temperature), self.assertRaises(ValueError):
                KIT.filter_logits(logits, temperature=temperature)
        for count in (0, -1, 3, 1.5, True):
            with self.subTest(top_k=count), self.assertRaises(ValueError):
                KIT.filter_logits(logits, top_k=count)
        for threshold in (0., -1., 1.1, np.nan):
            with self.subTest(top_p=threshold), self.assertRaises(ValueError):
                KIT.filter_logits(logits, top_p=threshold)

    def test_temperature_outside_float32_range_promotes_scaling(self):
        for dtype in (np.float16, np.float32):
            with self.subTest(dtype=dtype), np.errstate(all='raise'):
                tied = KIT.filter_logits(np.ones(2, dtype=dtype), temperature=1e-308)
                np.testing.assert_array_equal(tied, [0., 0.])
                self.assertEqual(tied.dtype, np.float64)
                wide = KIT.filter_logits(np.array([1., -1.], dtype=dtype), temperature=1e308)
                self.assertEqual(wide.dtype, np.float64)
                self.assertGreater(wide[0], wide[1])

    def test_invalid_logits_are_rejected(self):
        for logits in ([], [[1., 2.]], [np.nan, 0.], [np.inf, 0.], [-np.inf, -np.inf], ['0', '1']):
            with self.subTest(logits=logits), self.assertRaises(ValueError):
                KIT.filter_logits(logits)
        with self.assertRaises(ValueError):
            KIT.filter_logits(np.array([2**60, 2**60 + 1], dtype=np.int64))

    def test_half_precision_computes_distribution_in_float32(self):
        logits = np.zeros(65536, dtype=np.float16)
        actual = KIT.filter_logits(logits, top_p=.5)
        self.assertEqual(actual.dtype, np.float32)
        self.assertEqual(np.isfinite(actual).sum(), 32768)
        self.assertAlmostEqual(float(KIT.softmax(actual).sum()), 1.)

    def test_all_mlp_parameter_gradients_match_finite_differences(self):
        generator = np.random.default_rng(42)
        inputs = generator.normal(size=(4, 3))
        labels = np.array([0., 1., 0., 1.])
        parameters = [generator.normal(size=(3, 2)), np.array([2., -2.]),
                      generator.normal(size=(2, 1)), np.array([.2])]
        logits, cache = KIT.mlp_forward(inputs, *parameters)
        gradients = KIT.mlp_backward(logits, labels, cache, parameters[2])
        step = 1e-6
        for parameter, gradient in zip(parameters, gradients):
            for index in np.ndindex(parameter.shape):
                original = parameter[index]
                parameter[index] = original + step
                positive = KIT.bce_with_logits(KIT.mlp_forward(inputs, *parameters)[0], labels).mean()
                parameter[index] = original - step
                negative = KIT.bce_with_logits(KIT.mlp_forward(inputs, *parameters)[0], labels).mean()
                parameter[index] = original
                analytic = float(gradient) if np.ndim(gradient) == 0 else gradient[index]
                self.assertAlmostEqual(analytic, (positive - negative) / (2 * step), places=7)


if __name__ == '__main__':
    unittest.main()
