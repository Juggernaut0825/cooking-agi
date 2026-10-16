"""Focused review checks, not a full-site or production-model validation."""

import importlib.util
import json
import math
from pathlib import Path
import re
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]


def load_module(name, relative_path):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


COMPREHENSION = load_module("review_comprehension_20261016", "interview/code/comprehension_lab.py")
TRAINING = load_module("review_training_20261016", "practice/post-training/code/training_contracts.py")
OBJECTIVES = load_module("review_objectives_20261016", "practice/post-training/code/experiment_checks.py")
EVIDENCE = load_module("review_evidence_20261016", "practice/rag/code/evidence_pipeline.py")
RETRIEVAL = load_module("review_retrieval_20261016", "practice/recommender-systems/code/two_tower_reference.py")
EVALUATION = load_module("review_evaluation_20261016", "practice/recommender-systems/code/evaluation.py")
try:
    PREP = load_module("review_prep_20261016", "interview/code/prep_checks.py")
except ModuleNotFoundError as error:
    if error.name != "numpy":
        raise
    PREP = None


class TransformerArithmeticReview(unittest.TestCase):
    def test_kv_capacity_uses_binary_units(self):
        bytes_per_token = 2 * 32 * 32 * 128 * 2
        self.assertEqual(bytes_per_token, 524288)
        self.assertEqual(bytes_per_token / 2**20, 0.5)
        total_bytes = bytes_per_token * 32768
        self.assertEqual(total_bytes / 2**30, 16)
        self.assertAlmostEqual(total_bytes / 10**9, 17.179869184)

    def test_mla_storage_equivalence_is_not_a_head_count(self):
        latent_width, rope_width, head_width = 512, 64, 128
        self.assertEqual(latent_width + rope_width, 576)
        self.assertEqual((latent_width + rope_width) / (2 * head_width), 2.25)

    def test_mla_content_projection_absorption(self):
        latent = (3.0, 4.0)
        query = (2.0, -1.0)
        key_projection = ((1.0, 2.0), (-1.0, 1.0))
        expanded_key = [sum(weight * value for weight, value in zip(row, latent))
                        for row in key_projection]
        absorbed_query = [sum(query[row] * key_projection[row][column] for row in range(2))
                          for column in range(2)]
        expanded_score = sum(left * right for left, right in zip(query, expanded_key))
        latent_score = sum(left * right for left, right in zip(absorbed_query, latent))
        self.assertEqual(expanded_score, 21.0)
        self.assertEqual(expanded_score, latent_score)

        value_projection = ((2.0, -1.0), (1.0, 3.0))
        output_projection = (1.0, 2.0)
        expanded_value = [sum(weight * value for weight, value in zip(row, latent))
                          for row in value_projection]
        absorbed_output = [sum(output_projection[row] * value_projection[row][column]
                               for row in range(2)) for column in range(2)]
        self.assertEqual(sum(left * right for left, right in zip(expanded_value, output_projection)), 32.0)
        self.assertEqual(sum(left * right for left, right in zip(latent, absorbed_output)), 32.0)

    def test_sliding_window_receptive_field_includes_current(self):
        width, layers = 3, 2
        reachable = {0}
        for layer in range(layers):
            reachable = {position - offset for position in reachable for offset in range(width)}
        self.assertEqual(reachable, {-4, -3, -2, -1, 0})
        self.assertEqual(len(reachable), layers * (width - 1) + 1)

    def test_sink_is_exponentiated_logit(self):
        real_logits = (0.0, 0.0)
        for sink_logit in (0.0, math.log(2.0)):
            denominator = sum(math.exp(value) for value in real_logits) + math.exp(sink_logit)
            weights = [math.exp(value) / denominator for value in real_logits]
            expected = 1 / 3 if sink_logit == 0 else 1 / 4
            self.assertAlmostEqual(weights[0], expected)
            self.assertLess(sum(weights), 1)

    def test_rope_relative_position_still_depends_on_content(self):
        def rotate(vector, position):
            cosine, sine = math.cos(position), math.sin(position)
            return (vector[0] * cosine - vector[1] * sine,
                    vector[0] * sine + vector[1] * cosine)

        def score(query, key, query_position, key_position):
            return sum(left * right for left, right in zip(
                rotate(query, query_position), rotate(key, key_position)))

        query, key = (2.0, 1.0), (1.0, -1.0)
        original = score(query, key, 3, 1)
        self.assertAlmostEqual(original, score(query, key, 10, 8))
        self.assertAlmostEqual(2 * original, score((4.0, 2.0), key, 3, 1))

    def test_rope_base_leaves_first_frequency_unchanged(self):
        for base in (10000, 500000, 1000000):
            self.assertEqual(base ** (-2 * 0 / 128), 1)
        self.assertLess(500000 ** (-2 / 128), 10000 ** (-2 / 128))

    def test_online_softmax_matches_dense_weighted_sum(self):
        logits, values = (1000.0, 1002.0, 999.0), (2.0, -3.0, 4.0)
        maximum = max(logits)
        dense_weights = [math.exp(value - maximum) for value in logits]
        expected = sum(weight * value for weight, value in zip(dense_weights, values)) / sum(dense_weights)
        running_max, normalizer, numerator = -math.inf, 0.0, 0.0
        for logit, value in zip(logits, values):
            next_max = max(running_max, logit)
            rescale = math.exp(running_max - next_max)
            weight = math.exp(logit - next_max)
            normalizer = normalizer * rescale + weight
            numerator = numerator * rescale + weight * value
            running_max = next_max
        self.assertAlmostEqual(numerator / normalizer, expected)


class ProjectContractReview(unittest.TestCase):
    def test_embedding_cache_version_empty_value_and_copy(self):
        calls = []

        def encode(version, text):
            calls.append((version, text))
            return [] if text == "" else [1 if version == "v1" else 2]

        cache = COMPREHENSION.EmbeddingCache(encode)
        self.assertEqual(cache.get("v1", ""), [])
        self.assertEqual(cache.get("v1", ""), [])
        cached = cache.get("v1", "item")
        cached[0] = 999
        self.assertEqual(cache.get("v1", "item"), [1])
        self.assertEqual(cache.get("v2", "item"), [2])
        self.assertEqual(len(calls), 3)

    def test_token_mean_is_partition_invariant(self):
        self.assertEqual(COMPREHENSION.token_mean([[2.0, 2.0], [8.0]]), 4)
        self.assertEqual(COMPREHENSION.token_mean([[2.0], [], [2.0, 8.0]]), 4)
        self.assertEqual(COMPREHENSION.buggy_token_mean([[2.0, 2.0], [8.0]]), 5)
        with self.assertRaises(ValueError):
            COMPREHENSION.token_mean([[], []])

    def test_padding_preserves_real_eos_when_pad_equals_eos(self):
        examples = [
            {"input_ids": [11, 21, 2], "target_mask": [0, 1, 1]},
            {"input_ids": [11, 12, 21, 22, 2], "target_mask": [0, 0, 1, 1, 1]},
        ]
        same_id = TRAINING.collate_targets(examples, pad_id=2)
        other_id = TRAINING.collate_targets(examples, pad_id=0)
        self.assertEqual(same_id["labels"][0], [-100, 21, 2, -100, -100])
        self.assertEqual(same_id["attention_mask"][0], [1, 1, 1, 0, 0])
        self.assertEqual(same_id["labels"], other_id["labels"])

    def test_resume_matches_at_every_boundary(self):
        uninterrupted = TRAINING.ToyRun()
        uninterrupted.advance(12)
        for boundary in range(13):
            with self.subTest(boundary=boundary), tempfile.TemporaryDirectory() as directory:
                interrupted = TRAINING.ToyRun()
                interrupted.advance(boundary)
                path = Path(directory) / "state.json"
                TRAINING.save_checkpoint(path, interrupted.state())
                restored = TRAINING.ToyRun(seed=999)
                restored.restore(json.loads(path.read_text(encoding="utf-8")))
                restored.advance(12 - boundary)
                self.assertEqual(restored.state(), uninterrupted.state())

    def test_resume_rejects_changed_manifest(self):
        with self.assertRaisesRegex(ValueError, "manifest"):
            TRAINING.ToyRun(data_revision="other").restore(TRAINING.ToyRun().state())

    def test_token_and_sample_weighting_are_distinct(self):
        result = OBJECTIVES.masked_objective([[0.2], [1.0, 1.0, 1.0]], [[1], [1, 1, 1]])
        self.assertAlmostEqual(result["token_mean"], 0.8)
        self.assertAlmostEqual(result["sample_mean"], 0.6)
        self.assertEqual(result["valid_tokens"], 4)

    def test_rag_filters_revision_and_permission_before_ranking(self):
        chunks = [
            EVIDENCE.Chunk("old", "policy", 1, "registration deadline", frozenset({"public"})),
            EVIDENCE.Chunk("private", "secret", 1, "registration deadline", frozenset({"staff"})),
            EVIDENCE.Chunk("current", "policy", 2, "registration deadline", frozenset({"public"})),
        ]
        found = EVIDENCE.retrieve("registration", chunks, {"public"}, {"policy": 2, "secret": 1}, limit=1)
        self.assertEqual([chunk.chunk_id for chunk in found], ["current"])

    def test_rrf_deduplicates_each_source(self):
        self.assertEqual(EVIDENCE.reciprocal_rank_fusion([["a", "a", "b"], ["b"]]),
                         EVIDENCE.reciprocal_rank_fusion([["a", "b"], ["b"]]))

    def test_recall_denominator_and_undefined_cases(self):
        self.assertEqual(EVALUATION.recall_at_k(["P", "N1"], {"P"}, 2), 1)
        self.assertEqual(EVALUATION.recall_at_k(["N1", "N2", "P"], {"P"}, 2), 0)
        self.assertEqual(EVALUATION.recall_at_k(["P1", "P2"], {"P1", "P2", "P3", "P4"}, 2), 0.5)
        self.assertIsNone(EVALUATION.recall_at_k(["P"], set(), 1))
        with self.assertRaises(ValueError):
            EVALUATION.recall_at_k(["P", "P"], {"P"}, 2)

    def test_retraining_requires_matching_embedding_coordinates(self):
        old_spec = RETRIEVAL.EmbeddingSpec("old", 2, "inner_product")
        new_spec = RETRIEVAL.EmbeddingSpec("new", 2, "inner_product")
        old_items, new_items = {"A": (1, 0), "B": (0, 1)}, {"A": (0, 1), "B": (1, 0)}
        self.assertEqual(RETRIEVAL.exact_top_k((1, 0), old_spec, old_items, old_spec, 1)[0][0], "A")
        self.assertEqual(RETRIEVAL.exact_top_k((0, 1), new_spec, new_items, new_spec, 1)[0][0], "A")
        with self.assertRaisesRegex(ValueError, "incompatible"):
            RETRIEVAL.exact_top_k((0, 1), new_spec, old_items, old_spec, 1)
        mislabeled = RETRIEVAL.exact_top_k((0, 1), old_spec, old_items, old_spec, 1)
        self.assertEqual(mislabeled[0][0], "B")

    @unittest.skipIf(PREP is None, "NumPy is required for ML coding examples")
    def test_knn_implementations_agree_and_break_ties_deterministically(self):
        points, queries = [[1, 0], [-1, 0], [0, 2]], [[0, 0], [0, 1]]
        for mode in ("loop", "vectorized", "blocked"):
            with self.subTest(mode=mode):
                self.assertEqual(PREP.nearest_indices(points, queries, 2, mode=mode, block_size=1).tolist(),
                                 [[0, 1], [2, 0]])
                self.assertEqual(PREP.knn_predict(points, [2, 1, 3], [[0, 0]], 2, mode=mode).tolist(), [1])

    @unittest.skipIf(PREP is None, "NumPy is required by prep_checks")
    def test_algorithm_boundaries_and_cycle_detection(self):
        self.assertEqual(PREP.search_bounds([1, 2, 2, 4], 2), (1, 2))
        self.assertEqual(PREP.search_bounds([], 2), (0, -1))
        self.assertEqual(PREP.dependency_layers({"data": [], "train": ["data"], "eval": ["train"]}),
                         [["data"], ["train"], ["eval"]])
        with self.assertRaises(ValueError):
            PREP.dependency_layers({"first": ["second"], "second": ["first"]})

    @unittest.skipIf(PREP is None, "NumPy is required for the Markov exercise")
    def test_markov_hand_calculations(self):
        after_two, stationary, hitting = PREP.markov_example()
        self.assertAlmostEqual(after_two[0], 0.72)
        self.assertAlmostEqual(after_two[1], 0.28)
        self.assertAlmostEqual(stationary[0], 2 / 3)
        self.assertAlmostEqual(stationary[1], 1 / 3)
        self.assertAlmostEqual(hitting, 5)


class BilingualReviewGuards(unittest.TestCase):
    def test_transformer_units_and_visual_targets_match(self):
        documents = [(ROOT / f"interview/transformer-followups{suffix}.md").read_text(encoding="utf-8")
                     for suffix in ("", ".en")]
        for document in documents:
            for phrase in ("0.5 MiB", "16 GiB", "17.18 GB", "512+64=576", "e^s", "ReLU", "dropout"):
                self.assertIn(phrase, document)
        targets = [re.findall(r"transformer-lab(?:\.en)?\.md#(tx-[\w-]+)", document)
                   for document in documents]
        self.assertEqual(targets[0], targets[1])
        self.assertEqual(len(targets[0]), 7)
        self.assertEqual(documents[0].count('<details class="qa"'), documents[1].count('<details class="qa"'))

    def test_evaluation_version_and_compatibility_sources_are_paired(self):
        for suffix in ("", ".en"):
            document = (ROOT / f"practice/recommender-systems/05-evaluation-lab{suffix}.md").read_text(encoding="utf-8")
            self.assertIn("Python 3.10+", document)
            self.assertIn("https://www.tensorflow.org/recommenders/examples/basic_retrieval", document)
            self.assertIn(f"08-serving-lifecycle{suffix}.md", document)


if __name__ == "__main__":
    unittest.main()
