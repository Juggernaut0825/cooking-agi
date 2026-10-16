import math
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = ("", ".en")
EXECUTABLE_NOTES = (
    "03-multimodal-learning/blip-and-q-former",
    "03-multimodal-learning/vit",
    "03-multimodal-learning/qwen-vl",
    "03-multimodal-learning/image-generation",
    "03-multimodal-learning/vlm-finetuning",
    "03-multimodal-learning/siglip",
)
EDITED_PAIRS = (
    "03-multimodal-learning/image-generation",
    "03-multimodal-learning/vlm-finetuning",
    "11-frontier/README",
    "11-frontier/world-models/dreamer",
    "11-frontier/world-models/jepa",
    "11-frontier/self-improvement/README",
    "11-frontier/self-improvement/generate-verify-train",
    "11-frontier/self-improvement/review",
    "11-frontier/interpretability/sparse-autoencoders",
    "11-frontier/interpretability/review",
    "13-embodied/README",
    "13-embodied/perception/camera-geometry",
    "13-embodied/driving/prediction-planning",
)


def read_note(stem, language=""):
    return (ROOT / f"{stem}{language}.md").read_text(encoding="utf-8")


def python_blocks(source):
    return re.findall(r"^```python\n(.*?)^```", source, flags=re.M | re.S)


def load_examples(stem, language=""):
    namespace = {}
    for index, block in enumerate(python_blocks(read_note(stem, language))):
        exec(compile(block, f"{stem}{language}.md:block-{index}", "exec"), namespace)
    return namespace


class FrontierReviewTests(unittest.TestCase):
    def test_bilingual_python_examples_execute_and_match(self):
        for stem in EXECUTABLE_NOTES:
            with self.subTest(note=stem):
                chinese = python_blocks(read_note(stem))
                english = python_blocks(read_note(stem, ".en"))
                self.assertTrue(chinese)
                self.assertEqual(chinese, english)
                for language in LANGUAGES:
                    load_examples(stem, language)

    def test_answer_labels_preserve_answer_and_stop_token(self):
        for language in LANGUAGES:
            examples = load_examples("03-multimodal-learning/vlm-finetuning", language)
            self.assertEqual(examples["labels"], [-100, -100, -100, -100, 40, 2, -100])
            labeler = examples["answer_labels"]
            with self.assertRaises(ValueError):
                labeler([10, 2], [True, False], [True, True], [False, False])
            with self.assertRaises(ValueError):
                labeler([10, 2], [False, 1], [True, True], [False, False])
            source = read_note("03-multimodal-learning/vlm-finetuning", language)
            for marker in ("{% generation %}", "{% endgeneration %}", "transformers>=5.18.0"):
                self.assertIn(marker, source)

    def test_patchification_order_and_invalid_shapes(self):
        patchify = load_examples("03-multimodal-learning/vit")["patchify_gray"]
        self.assertEqual(patchify([[1, 2], [3, 4]], 2), [[1, 2, 3, 4]])
        for pixels, size in (([], 2), ([[1], [2, 3]], 1), ([[1, 2]], 2), ([[1]], 0)):
            with self.subTest(pixels=pixels, size=size), self.assertRaises(ValueError):
                patchify(pixels, size)

    def test_qwen_token_budget_uses_processed_dimensions(self):
        count = load_examples("03-multimodal-learning/qwen-vl")["merged_image_tokens"]
        self.assertEqual(count(280, 560), 200)
        self.assertEqual(count(560, 560), 400)
        for dimensions in ((281, 560), (0, 560), (True, 560)):
            with self.subTest(dimensions=dimensions), self.assertRaises(ValueError):
                count(*dimensions)

    def test_filter_precision_and_recall_are_distinct(self):
        report = load_examples("03-multimodal-learning/blip-and-q-former")["filter_report"]
        result = report([0.9, 0.1, 0.2], [True, True, False], 0.5)
        self.assertEqual(result["precision"], 1)
        self.assertEqual(result["recall"], 0.5)
        self.assertIsNone(report([0.1], [True], 0.5)["precision"])
        self.assertIsNone(report([0.9], [False], 0.5)["recall"])

    def test_qformer_attention_objectives(self):
        mask = load_examples("03-multimodal-learning/blip-and-q-former")["visibility_mask"]
        self.assertEqual(mask("itc", 1, 2), [[True, False, False], [False, True, True], [False, True, True]])
        self.assertTrue(all(all(row) for row in mask("itm", 1, 2)))
        self.assertEqual(mask("itg", 1, 2), [[True, False, False], [True, True, False], [True, True, True]])

    def test_flow_interpolation_and_step_bounds(self):
        flow = load_examples("03-multimodal-learning/image-generation")["linear_flow_example"]
        self.assertEqual(flow(2, 10, 0.25, 6, 0.1), (4, 8, 4, 4.6))
        self.assertEqual(flow(2, 10, 1, 8, 0), (10, 8, 0, 10))
        with self.assertRaises(ValueError):
            flow(2, 10, 0.9, 6, 0.2)

    def test_siglip_reduction_and_numerical_stability(self):
        examples = load_examples("03-multimodal-learning/siglip")
        self.assertAlmostEqual(examples["siglip_loss"]([[0, 0], [0, 0]]), 2 * math.log(2))
        self.assertEqual(examples["pair_loss"](-1000, True), 1000)
        self.assertEqual(examples["pair_loss"](1000, True), 0)

    def test_false_rejection_changes_accepted_precision(self):
        accepted_precision = 400 / (400 + 60)
        rejected_precision = 200 / (200 + 60)
        self.assertAlmostEqual(accepted_precision, 0.8695652173913043)
        self.assertAlmostEqual(rejected_precision, 0.7692307692307693)
        self.assertLess(rejected_precision, accepted_precision)
        self.assertNotEqual(60 / 460, 60 / 600)
        for language in LANGUAGES:
            source = read_note("11-frontier/self-improvement/generate-verify-train", language)
            self.assertIn(r"\frac{pr}{pr+(1-p)f}", source)
            self.assertIn("200/260", source)
            self.assertIn("2412.02674v2", source)

    def test_sae_error_ratio_is_not_reconstructed_energy(self):
        coefficient = max(0, math.sqrt(2) - 0.5)
        reconstructed = coefficient / math.sqrt(2)
        squared_error = 2 * (1 - reconstructed) ** 2
        self.assertAlmostEqual(squared_error, 0.25)
        self.assertAlmostEqual(1 - squared_error / 2, 0.875)
        self.assertAlmostEqual(coefficient ** 2 / 2, 0.4178932188134525)
        self.assertEqual(max(0, math.sqrt(2) - 3 / 2), 0)
        for language in LANGUAGES:
            for stem in ("sparse-autoencoders", "review"):
                source = read_note(f"11-frontier/interpretability/{stem}", language)
                self.assertIn("41.8", source)
                self.assertIn("AuxK", source)

    def test_jepa_norm_counterexample(self):
        radius = 0.075
        self.assertAlmostEqual(math.sqrt(3) * radius, 0.1299038105676658)
        coordinate_clipped = (radius, radius, radius)
        self.assertGreater(sum(abs(value) for value in coordinate_clipped), radius)
        for language in LANGUAGES:
            source = read_note("11-frontier/world-models/jepa", language)
            self.assertIn("7.5 cm", source)
            self.assertIn("L∞", source)
            self.assertIn("2506.09985v1", source)
            self.assertIn("2511.08544v1", source)

    def test_fixed_ema_example(self):
        self.assertAlmostEqual(0.996 ** 100, 0.6697825712726458)

    def test_stereo_derivative_is_local(self):
        focal_baseline = 1000 * 0.5
        disparity = focal_baseline / 40
        self.assertEqual(disparity, 12.5)
        self.assertAlmostEqual(focal_baseline / (disparity + 1), 37.037037037)
        self.assertAlmostEqual(focal_baseline / (disparity - 1), 43.47826087)
        self.assertAlmostEqual(focal_baseline / disparity ** 2, 3.2)
        for language in LANGUAGES:
            source = read_note("13-embodied/perception/camera-geometry", language)
            self.assertIn("37.04", source)
            self.assertIn("43.48", source)
            self.assertIn("tr98-71.pdf", source)

    def test_reprojection_requires_homogeneous_division(self):
        homogeneous = (0.5, 0, 1.5)
        projected = tuple(value / homogeneous[2] for value in homogeneous[:2])
        self.assertEqual(projected, (1 / 3, 0))
        self.assertNotEqual(projected, homogeneous[:2])
        for language in LANGUAGES:
            source = read_note("13-embodied/perception/camera-geometry", language)
            self.assertIn("1/3", source)
            self.assertIn(r"\sim", source)

    def test_trajectory_cost_table_and_zero_weight_tie(self):
        for language in LANGUAGES:
            source = read_note("13-embodied/driving/prediction-planning", language)
            costs = {}
            for label in ("A", "B", "C"):
                row = re.search(rf"^\| {label} .*?$", source, re.M).group(0)
                fields = [field.strip() for field in row.strip("|").split("|")]
                costs[label] = [float(field) for field in fields[4:7]]
            for weights, winner in (((1, 1, 1), "A"), ((1, 1, 2), "B")):
                totals = {label: sum(cost * weight for cost, weight in zip(values, weights)) for label, values in costs.items()}
                self.assertEqual(min(totals, key=totals.get), winner)
            self.assertEqual(costs["A"][0], costs["C"][0])
            self.assertIn("(1,0,0)", source)
            self.assertIn("1.5w_c+(2/3)w_s", source)

    def test_dreamer_lambda_return_and_terminal_cutoff(self):
        values = [0.6, 0.5, 0.6, 0.8]
        rewards = [0, 0, 0, 1]
        returns = [0, 0, 0, values[-1]]
        for index in reversed(range(3)):
            returns[index] = rewards[index + 1] + 0.9 * (0.5 * values[index + 1] + 0.5 * returns[index + 1])
        for actual, expected in zip(returns, [0.6948, 1.044, 1.72, 0.8]):
            self.assertAlmostEqual(actual, expected)
        self.assertAlmostEqual(0.9 * (0.5 * 0.5 + 0.5 * -1), -0.225)
        for language in LANGUAGES:
            source = read_note("11-frontier/world-models/dreamer", language)
            self.assertIn("dyn.observe", source)
            self.assertIn("2301.04104v2", source)
            self.assertIn("0.3", source)

    def test_frontier_entries_and_robotics_query_survive(self):
        for language in LANGUAGES:
            frontier = read_note("11-frontier/README", language)
            for series in ("world-models", "self-improvement", "test-time-compute", "agentic-rl", "interpretability", "diffusion-lm"):
                self.assertIn(f"{series}/README{language}.md", frontier)
            embodied = read_note("13-embodied/README", language)
            self.assertIn(f"technology-timeline{language}.md?field=applications&track=robotics", embodied)
            self.assertIn("草稿" if not language else "draft", embodied.lower())

    def test_bilingual_visual_markers_survive(self):
        pattern = r"<!-- (?:widget|paper-figure):[^>]+-->"
        for stem in EDITED_PAIRS:
            with self.subTest(note=stem):
                self.assertEqual(re.findall(pattern, read_note(stem)), re.findall(pattern, read_note(stem, ".en")))


if __name__ == "__main__":
    unittest.main()
