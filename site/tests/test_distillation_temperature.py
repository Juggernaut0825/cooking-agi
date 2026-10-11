import math
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


def softened_probabilities(logits, temperature):
    weights = [math.exp((value - max(logits)) / temperature) for value in logits]
    return [weight / math.fsum(weights) for weight in weights]


class DistillationTemperatureTests(unittest.TestCase):
    def test_softening_need_not_increase_every_nonmaximal_probability(self):
        logits = [2.0, 1.9, 0.0]
        cooler = softened_probabilities(logits, 1.0)
        warmer = softened_probabilities(logits, 2.0)
        self.assertLess(logits[1], max(logits))
        self.assertLess(warmer[1], cooler[1])
        self.assertGreater(
            -math.fsum(value * math.log(value) for value in warmer),
            -math.fsum(value * math.log(value) for value in cooler),
        )
        for suffix in (".md", ".en.md"):
            source = (ROOT / ("05-post-training/distillation" + suffix)).read_text()
            self.assertIn("[2.0, 1.9, 0.0]", source)
            self.assertIn(f"{cooler[1]:.4f}", source)
            self.assertIn(f"{warmer[1]:.4f}", source)

    def test_higher_temperature_shrinks_pairwise_log_probability_ratios(self):
        logits = [2.0, 1.9, 0.0]
        for temperature in (0.5, 1.0, 2.0, 10.0):
            probabilities = softened_probabilities(logits, temperature)
            for first in range(len(logits)):
                for second in range(len(logits)):
                    actual = math.log(probabilities[first] / probabilities[second])
                    self.assertAlmostEqual(
                        actual, (logits[first] - logits[second]) / temperature,
                    )

    def test_temperature_squared_loss_gradient_is_not_temperature_invariant(self):
        teacher_logits = [2.0, 1.9, 0.0]
        student_logits = [0.3, -0.4, 0.8]
        gradients = []
        for temperature in (1.0, 2.0):
            teacher = softened_probabilities(teacher_logits, temperature)
            student = softened_probabilities(student_logits, temperature)
            expected = [
                temperature * (prediction - target)
                for prediction, target in zip(student, teacher)
            ]

            def loss(logits):
                probabilities = softened_probabilities(logits, temperature)
                return temperature ** 2 * math.fsum(
                    target * math.log(target / prediction)
                    for target, prediction in zip(teacher, probabilities)
                )

            for index, derivative in enumerate(expected):
                upper, lower = student_logits.copy(), student_logits.copy()
                upper[index] += 1e-5
                lower[index] -= 1e-5
                actual = (loss(upper) - loss(lower)) / 2e-5
                self.assertAlmostEqual(actual, derivative, places=8)
            gradients.append(expected)
        self.assertGreater(max(abs(first - second) for first, second in zip(*gradients)), 0.01)


if __name__ == "__main__":
    unittest.main()
