import itertools
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


def snippets(name, language=""):
    source = ROOT / "00-foundations/deep-dives" / f"{name}{language}.md"
    return re.findall(r"```python\n(.*?)```", source.read_text(), re.S)


def load_examples(name):
    namespace = {}
    for snippet in snippets(name):
        exec(compile(snippet, name, "exec"), namespace)
    return namespace


class BilingualExamplesTests(unittest.TestCase):
    def test_draft_cycle_figure_is_localized_and_separate_from_code(self):
        for language, html_language in (("", "zh-CN"), (".en", "en")):
            source = (ROOT / "00-foundations/deep-dives" / f"dflash{language}.md").read_text()
            figure = re.search(r'<figure[^>]*id="draft-cycle".*?</figure>', source, re.S).group()
            self.assertIn(f'lang="{html_language}"', figure)
            self.assertIn("worked-update--pairs", figure)
            self.assertEqual(figure.count("<li>"), 4)
            self.assertEqual(figure.count("<span>"), 4)
            self.assertNotIn("<script", figure)
            self.assertLess(source.index(figure), source.index('<details id="feature-shapes"'))

    def test_examples_match_in_both_languages(self):
        for name in ("muon", "dflash"):
            self.assertTrue(snippets(name))
            self.assertEqual(snippets(name), snippets(name, ".en"))


class DraftVerificationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        namespace = load_examples("dflash")
        cls.verify = staticmethod(namespace["verify_greedy_block"])
        cls.speedup = staticmethod(namespace["cycle_speedup"])

    def test_first_mismatch_discards_entire_suffix(self):
        for position in range(4):
            draft = [10, 20, 30, 40]
            targets = draft + [50]
            targets[position] = 99
            self.assertEqual(self.verify(draft, targets), (draft[:position] + [99], position))

    def test_full_acceptance_and_empty_draft(self):
        self.assertEqual(self.verify([1, 2], [1, 2, 3]), ([1, 2, 3], 2))
        self.assertEqual(self.verify([], [7]), ([7], 0))

    def test_cache_bookkeeping_leaves_correction_or_bonus_uncached(self):
        prefix = [1, 2, 3, 4]
        anchor = 10
        for draft, choices in (([20, 99], [20, 30, 40]), ([20, 30], [20, 30, 40])):
            emitted, accepted = self.verify(draft, choices)
            temporary_tokens = prefix + [anchor] + draft
            temporary_states = [tuple(temporary_tokens[:position + 1])
                                for position in range(len(temporary_tokens))]
            committed_length = len(prefix) + 1 + accepted
            committed_states = temporary_states[:committed_length]
            confirmed = prefix + [anchor] + emitted
            self.assertEqual(len(committed_states), len(confirmed) - 1)
            self.assertEqual(committed_states[-1], tuple(confirmed[:-1]))
            resumed_states = committed_states + [tuple(confirmed)]
            full_states = [tuple(confirmed[:position + 1]) for position in range(len(confirmed))]
            self.assertEqual(resumed_states, full_states)
            if accepted < len(draft):
                self.assertEqual(committed_length, 6)
                self.assertNotEqual(temporary_states[-1], full_states[-1])

    def test_eos_stops_at_acceptance_or_correction(self):
        self.assertEqual(self.verify([1, 0, 3], [1, 0, 3, 4], 0), ([1, 0], 2))
        self.assertEqual(self.verify([1, 2, 3], [1, 0, 3, 4], 0), ([1, 0], 1))
        self.assertEqual(self.verify([1], [1, 0], 0), ([1, 0], 1))

    def test_invalid_target_alignment(self):
        for choices in ([], [1], [1, 2], [1, 2, 3, 4]):
            with self.assertRaises(ValueError):
                self.verify([1, 2], choices)

    def test_matches_autoregressive_prefix_on_all_binary_drafts(self):
        def next_token(prefix):
            return (sum(prefix) + len(prefix)) % 2

        for length in range(5):
            for draft in itertools.product(range(2), repeat=length):
                choices = [next_token(draft[:position]) for position in range(length + 1)]
                actual, _ = self.verify(draft, choices)
                expected = []
                for _ in actual:
                    expected.append(next_token(expected))
                self.assertEqual(actual, expected)

    def test_cycle_cost_examples_and_break_even(self):
        self.assertEqual(self.speedup(10, 3, 12, 1, 4), 2.5)
        self.assertEqual(self.speedup(10, 3, 12, 1, 1), 0.625)
        self.assertEqual(self.speedup(10, 3, 12, 1, 1.6), 1)

    def test_invalid_cost_inputs(self):
        for inputs in ((0, 1, 1, 1, 1), (1, -1, 1, 1, 1),
                       (1, 0, 0, 0, 1), (1, 1, 1, 1, 0),
                       (1, 1, math.nan, 1, 1), (math.inf, 1, 1, 1, 1)):
            with self.assertRaises(ValueError):
                self.speedup(*inputs)


@unittest.skipUnless(torch is not None, "PyTorch is required for SVD reference checks")
class MuonGeometryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.polar = staticmethod(load_examples("muon")["polar_reference"])

    def test_diagonal_singular_values_and_sign(self):
        actual = self.polar([[6.0, 0.0], [0.0, -2.0]])
        expected = torch.diag(torch.tensor([1.0, -1.0], dtype=torch.float64))
        torch.testing.assert_close(actual, expected)

    def test_rectangular_semi_orthogonality_and_rms(self):
        matrix = torch.tensor([[2.0, 1.0, 0.0], [0.0, 2.0, 1.0]], dtype=torch.float64)
        for source in (matrix, matrix.T):
            actual = self.polar(source)
            gram = actual @ actual.T if source.shape[0] < source.shape[1] else actual.T @ actual
            torch.testing.assert_close(gram, torch.eye(2, dtype=torch.float64))
            self.assertAlmostEqual(actual.square().mean().sqrt().item(), 1 / math.sqrt(3))

    def test_rank_deficiency_and_zero(self):
        torch.testing.assert_close(self.polar([[2.0, 0.0], [0.0, 0.0]]),
                                   torch.diag(torch.tensor([1.0, 0.0], dtype=torch.float64)))
        self.assertEqual(torch.count_nonzero(self.polar(torch.zeros(2, 3))), 0)

    def test_full_svd_product_adds_a_null_space_direction(self):
        matrix = torch.diag(torch.tensor([2.0, 0.0], dtype=torch.float64))
        left, singular, right = torch.linalg.svd(matrix, full_matrices=False)
        self.assertEqual(torch.linalg.matrix_rank(left @ right), 2)
        self.assertEqual(torch.linalg.matrix_rank(self.polar(matrix)), 1)
        self.assertFalse(torch.allclose(left @ right, self.polar(matrix)))

    def test_shape_scaling_reference_and_base_rate_decay(self):
        for rows, columns, expected_original in ((8, 2, 1 / math.sqrt(2)), (2, 8, 1 / math.sqrt(8))):
            direction = self.polar(torch.eye(rows, columns, dtype=torch.float64))
            rms = direction.square().mean().sqrt().item()
            original = math.sqrt(max(1, rows / columns))
            matched = 0.2 * math.sqrt(max(rows, columns))
            self.assertAlmostEqual(rms * original, expected_original)
            self.assertAlmostEqual(rms * matched, 0.2)
            weight = torch.ones_like(direction)
            updated = (1 - 0.1 * 0.2) * weight - 0.1 * original * direction
            torch.testing.assert_close(updated + 0.1 * original * direction, 0.98 * weight)

    def test_scale_invariance_and_not_elementwise_sign(self):
        matrix = torch.tensor([[1.0, 1.0], [0.0, 1.0]], dtype=torch.float64)
        expected = self.polar(matrix)
        for scale in (1e-200, 1e200):
            torch.testing.assert_close(self.polar(matrix * scale), expected)
        self.assertFalse(torch.allclose(expected, matrix.sign()))

    def test_row_shards_are_not_a_full_matrix_update(self):
        for language in ("", ".en"):
            namespace = {}
            for snippet in snippets("muon", language):
                exec(compile(snippet, "muon" + language, "exec"), namespace)
            whole = namespace["whole_update"]
            rows = namespace["row_updates"]
            expected_rows = torch.tensor([[1 / math.sqrt(2), 1 / math.sqrt(2)], [0, 1]],
                                         dtype=torch.float64)
            torch.testing.assert_close(rows, expected_rows)
            torch.testing.assert_close(whole @ whole.T, torch.eye(2, dtype=torch.float64))
            self.assertFalse(torch.allclose(rows @ rows.T, torch.eye(2, dtype=torch.float64)))
            self.assertFalse(torch.allclose(rows, whole))

    def test_gather_before_transform_and_slice_after_recovers_the_update(self):
        for matrix in (torch.tensor([[1.0, 1.0], [0.0, 1.0]], dtype=torch.float64),
                       torch.arange(1, 13, dtype=torch.float64).reshape(4, 3)):
            for axis in (0, 1):
                shards = matrix.split(1, dim=axis)
                restored = torch.cat(shards, dim=axis)
                full_update = self.polar(restored)
                local_updates = full_update.split(1, dim=axis)
                torch.testing.assert_close(torch.cat(local_updates, dim=axis), self.polar(matrix))

    def test_invalid_matrices(self):
        for matrix in ([], [1, 2], [[], []], [[math.inf]], [[math.nan]], [[1j]],
                       torch.tensor([[1j]])):
            with self.assertRaises(ValueError):
                self.polar(matrix)

    def test_common_quintic_does_not_fix_one(self):
        self.assertAlmostEqual(3.4445 - 4.775 + 2.0315, 0.701)

    def test_large_integer_input_does_not_fail_during_complex_check(self):
        actual = self.polar([[2**64, 0], [0, 2**64]])
        torch.testing.assert_close(actual, torch.eye(2, dtype=torch.float64))

    def test_five_step_diagonal_is_not_the_svd_reference(self):
        namespace = load_examples("muon")
        actual = torch.tensor(namespace["transformed"], dtype=torch.float64)
        expected = torch.tensor([0.7530, 1.1337], dtype=torch.float64)
        torch.testing.assert_close(actual, expected, atol=1e-4, rtol=0)
        self.assertFalse(torch.allclose(actual, torch.ones_like(actual)))


if __name__ == "__main__":
    unittest.main()
