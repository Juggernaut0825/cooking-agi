import math
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
FAMILIES = ROOT / "00-foundations/model-families"


class DeepSeekFamilyAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.blocks = {}
        cls.namespaces = {}
        for chapter in ("deepseek", "deepseek-v4"):
            for suffix in (".md", ".en.md"):
                source = FAMILIES / (chapter + suffix)
                blocks = re.findall(r"```python\n(.*?)```", source.read_text(), re.S)
                cls.blocks[chapter, suffix] = blocks
                namespace = {}
                for block in blocks:
                    exec(compile(block, str(source), "exec"), namespace)
                cls.namespaces[chapter, suffix] = namespace

    def functions(self, chapter, name):
        return [self.namespaces[chapter, suffix][name] for suffix in (".md", ".en.md")]

    def test_bilingual_examples_match_and_execute_independently(self):
        for chapter in ("deepseek", "deepseek-v4"):
            with self.subTest(chapter=chapter):
                self.assertTrue(self.blocks[chapter, ".md"])
                self.assertEqual(self.blocks[chapter, ".md"], self.blocks[chapter, ".en.md"])

    def test_mla_payload_counts_shared_latent_once_and_includes_rope(self):
        for cache_bytes in self.functions("deepseek", "mla_cache_bytes"):
            self.assertEqual(cache_bytes(1, 1, 1, 512, 64, 2), 1152)
            self.assertEqual(cache_bytes(1, 8192, 61, 512, 64, 2), 575668224)
            self.assertEqual(cache_bytes(1, 8192, 61, 512, 64, 2) // 2**20, 549)

    def test_fine_grained_expert_budget_excludes_extra_shared_branch(self):
        input_width = 128
        coarse_total = 3 * input_width * 256 * 8
        fine_total = 3 * input_width * 64 * 32
        coarse_active = 3 * input_width * 256 * 2
        fine_active = 3 * input_width * 64 * 8
        self.assertEqual(coarse_total, fine_total)
        self.assertEqual(coarse_active, fine_active)
        with_shared = fine_active + 3 * input_width * 64
        self.assertAlmostEqual(with_shared / fine_active, 9 / 8)

    def test_mla_payload_scales_with_each_budget_dimension(self):
        arguments = [1, 8192, 61, 512, 64, 2]
        for cache_bytes in self.functions("deepseek", "mla_cache_bytes"):
            baseline = cache_bytes(*arguments)
            for dimension in (0, 1, 2, 5):
                changed = arguments.copy()
                changed[dimension] *= 2
                self.assertEqual(cache_bytes(*changed), 2 * baseline)
            self.assertEqual(cache_bytes(1, 0, 61, 512, 64, 2), 0)

    def test_mla_payload_rejects_invalid_dimensions(self):
        arguments = [1, 8192, 61, 512, 64, 2]
        for cache_bytes in self.functions("deepseek", "mla_cache_bytes"):
            for dimension in range(len(arguments)):
                invalid_values = (-1, 1.5, True, math.nan)
                if dimension != 1:
                    invalid_values += (0,)
                for invalid in invalid_values:
                    with self.subTest(dimension=dimension, invalid=invalid):
                        changed = arguments.copy()
                        changed[dimension] = invalid
                        with self.assertRaises(ValueError):
                            cache_bytes(*changed)

    def test_mtp_rows_have_shifted_condition_and_distinct_target(self):
        for training_rows in self.functions("deepseek", "mtp_training_rows"):
            rows = training_rows(["A", "B", "C", "D", "E"])
            self.assertEqual(rows, [
                (("A",), "B", "C"),
                (("A", "B"), "C", "D"),
                (("A", "B", "C"), "D", "E"),
            ])
            for prefix, condition, target in rows:
                self.assertNotIn(target, prefix + (condition,))

    def test_mtp_target_changes_do_not_enter_that_rows_inputs(self):
        for training_rows in self.functions("deepseek", "mtp_training_rows"):
            before = training_rows(["A", "B", "C", "D"])
            after = training_rows(["A", "B", "changed", "D"])
            self.assertEqual(before[0][:2], after[0][:2])
            self.assertNotEqual(before[0][2], after[0][2])
            self.assertNotEqual(before[1][1], after[1][1])

    def test_mtp_short_sequences_have_no_extra_target(self):
        for training_rows in self.functions("deepseek", "mtp_training_rows"):
            for tokens in ([], ["A"], ["A", "B"]):
                self.assertEqual(training_rows(tokens), [])

    def test_v3_bias_selects_experts_without_changing_mixture_affinities(self):
        for route in self.functions("deepseek", "route_with_bias"):
            result = route([0.6, 0.3, 0.1], [0, 0, 0.4], 2)
            self.assertEqual([index for index, _ in result], [0, 2])
            self.assertAlmostEqual(result[0][1], 6 / 7)
            self.assertAlmostEqual(result[1][1], 1 / 7)
            mixture = sum(weight * [2, 0, 10][index] for index, weight in result)
            self.assertAlmostEqual(mixture, 22 / 7)
            self.assertNotAlmostEqual(mixture, 62 / 11)

    def test_v4_ledger_counts_current_token_at_completion_boundaries(self):
        for ledger in self.functions("deepseek-v4", "attention_ledger"):
            for query_position in (0, 2, 3, 4, 6, 7, 8, 11, 127, 128):
                with self.subTest(query_position=query_position):
                    result = ledger(query_position + 1, 4, 128, 32, 128)
                    block_ends = range(3, query_position + 1, 4)
                    self.assertEqual(result["light_stored"], len(block_ends))
                    self.assertEqual(result["light_tail"], (query_position + 1) % 4)
            self.assertEqual(ledger(8, 4, 128, 32, 128)["light_stored"], 2)
            self.assertEqual(ledger(9, 4, 128, 32, 128)["light_stored"], 2)

    def test_v4_sparse_core_reads_do_not_bound_storage_or_hca_reads(self):
        for ledger in self.functions("deepseek-v4", "attention_ledger"):
            short = ledger(1024, 4, 128, 32, 128)
            long = ledger(2048, 4, 128, 32, 128)
            self.assertEqual(short["light_main_reads"], 160)
            self.assertEqual(long["light_main_reads"], 160)
            self.assertEqual(short["heavy_main_reads"], 136)
            self.assertEqual(long["heavy_main_reads"], 144)
            for stored in ("light_stored", "heavy_stored"):
                self.assertEqual(long[stored], 2 * short[stored])

    def test_v4_tails_do_not_round_up_incomplete_blocks(self):
        for ledger in self.functions("deepseek-v4", "attention_ledger"):
            for history in (1, 3, 4, 9, 127, 128, 129, 1025):
                result = ledger(history, 4, 128, 32, 128)
                for kind, ratio in (("light", 4), ("heavy", 128)):
                    self.assertEqual(result[kind + "_stored"] * ratio + result[kind + "_tail"], history)
                    self.assertLess(result[kind + "_tail"], ratio)

    def test_joint_attention_with_sink_is_not_two_separate_softmaxes(self):
        logits = [0.0, 0.0]
        values = [3.0, 9.0]
        denominator = sum(math.exp(logit) for logit in logits) + math.exp(0.0)
        weights = [math.exp(logit) / denominator for logit in logits]
        output = sum(weight * value for weight, value in zip(weights, values))
        self.assertAlmostEqual(output, 4)
        self.assertAlmostEqual(sum(weights), 2 / 3)
        self.assertNotAlmostEqual(output, sum(values))

    def test_mhc_fixed_mixing_bound_does_not_bound_transformed_branch(self):
        values = [2.0, 10.0]
        matrix = [[0.8, 0.2], [0.2, 0.8]]
        mixed = [sum(weight * value for weight, value in zip(row, values)) for row in matrix]
        self.assertAlmostEqual(sum(mixed), 12)
        self.assertAlmostEqual(sum(value**2 for value in mixed), 83.52)
        original_norm = sum(value**2 for value in values)
        self.assertLessEqual(sum(value**2 for value in mixed), original_norm)
        self.assertGreater(sum((value + 10)**2 for value in mixed), original_norm)

    def test_reverse_kl_example_uses_nats_and_is_asymmetric(self):
        student, teacher = [0.8, 0.2], [0.5, 0.5]
        reverse = sum(probability * math.log(probability / reference)
                      for probability, reference in zip(student, teacher))
        forward = sum(reference * math.log(reference / probability)
                      for probability, reference in zip(student, teacher))
        self.assertAlmostEqual(reverse, 0.19274475702175753)
        self.assertAlmostEqual(forward, 0.22314355131420976)
        self.assertNotAlmostEqual(reverse, forward)


if __name__ == "__main__":
    unittest.main()
