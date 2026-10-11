from fractions import Fraction
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


def lesson_namespace(stem, suffix):
    source = (ROOT / (stem + suffix)).read_text()
    namespace = {}
    blocks = re.findall(r"```python\n(.*?)\n```", source, re.S)
    for block in blocks:
        exec(compile(block, stem + suffix, "exec"), namespace)
    return namespace, blocks


class MemoryFeedbackExampleTests(unittest.TestCase):
    def memory_reader(self):
        namespace, _ = lesson_namespace("02-memory/memory-lifecycle", ".md")
        return namespace["current_memories"]

    def memories(self):
        return [
            dict(id="usual", user="demo", scope="meetings", status="active",
                 observed=0, start=0, end=10, overrides=[]),
            dict(id="trip", user="demo", scope="meetings", status="active",
                 observed=4, start=3, end=6, overrides=["usual"]),
        ]

    def test_both_language_versions_execute_identical_examples(self):
        for stem in ("01-data-and-feedback/feedback-to-objectives", "02-memory/memory-lifecycle"):
            _, chinese = lesson_namespace(stem, ".md")
            _, english = lesson_namespace(stem, ".en.md")
            self.assertEqual(chinese, english)

    def test_late_arrival_is_not_available_to_an_earlier_decision(self):
        reader = self.memory_reader()
        records = self.memories()
        self.assertEqual(reader(records, "demo", "meetings", 3, known_at=3), ["usual"])
        self.assertEqual(reader(records, "demo", "meetings", 3, known_at=4), ["trip"])
        self.assertEqual(reader(records, "demo", "meetings", 3), ["usual"])

    def test_future_scheduling_uses_only_currently_known_records(self):
        reader = self.memory_reader()
        records = self.memories()
        self.assertEqual(reader(records, "demo", "meetings", 5, known_at=1), ["usual"])
        records[1]["observed"] = 1
        self.assertEqual(reader(records, "demo", "meetings", 5, known_at=1), ["trip"])

    def test_validity_is_half_open_and_expired_override_does_not_hide_usual(self):
        reader = self.memory_reader()
        records = self.memories()
        records[1]["observed"] = 1
        for day, expected in ((2, ["usual"]), (3, ["trip"]), (5, ["trip"]), (6, ["usual"]), (10, [])):
            with self.subTest(day=day):
                self.assertEqual(reader(records, "demo", "meetings", day), expected)

    def test_current_deletion_and_scope_filters_still_apply(self):
        reader = self.memory_reader()
        records = self.memories()
        records[0]["status"] = "deleted"
        self.assertEqual(reader(records, "demo", "meetings", 2, known_at=2), [])
        self.assertEqual(reader(records, "demo", "meetings", 6), [])
        self.assertEqual(reader(records, "someone-else", "meetings", 4), [])
        self.assertEqual(reader(records, "demo", "shopping", 4), [])

    def test_exact_ipw_moments_follow_enumerated_distribution(self):
        namespace, _ = lesson_namespace("01-data-and-feedback/feedback-to-objectives", ".md")
        moments = namespace["contribution_moments"]
        for propensity in (Fraction(1, 100), Fraction(1, 10), Fraction(1, 2), Fraction(1)):
            mean, variance = moments(propensity)
            self.assertEqual(mean, 1)
            self.assertEqual(variance, (1 - propensity) / propensity)
            for floor in (Fraction(0), Fraction(1, 4), Fraction(1)):
                denominator = max(propensity, floor)
                mean, variance = moments(propensity, floor)
                self.assertEqual(mean, propensity / denominator)
                self.assertEqual(variance, propensity * (1 - propensity) / denominator ** 2)

    def test_zero_support_is_not_silently_repaired_by_clipping(self):
        namespace, _ = lesson_namespace("01-data-and-feedback/feedback-to-objectives", ".md")
        moments = namespace["contribution_moments"]
        for propensity, floor in ((0, Fraction(1, 4)), (-1, 0), (2, 0), (1, -1), (1, 2)):
            with self.subTest(propensity=propensity, floor=floor):
                with self.assertRaises(ValueError):
                    moments(propensity, floor)


if __name__ == "__main__":
    unittest.main()
