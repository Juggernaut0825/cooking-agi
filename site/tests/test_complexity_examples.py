from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]


def example_blocks(suffix):
    note = (ROOT / "interview/algorithms" / ("complexity-and-tools" + suffix)).read_text()
    return re.findall(r"```python\n(.*?)\n```", note, re.S)


class ComplexityExampleTests(unittest.TestCase):
    def test_bilingual_examples_match(self):
        self.assertEqual(example_blocks(".md"), example_blocks(".en.md"))

    def test_doubling_costs_and_linear_total(self):
        namespace = {}
        exec(example_blocks(".md")[0], namespace)
        count_costs = namespace["doubling_append_costs"]
        self.assertEqual(count_costs(0), [])
        self.assertEqual(count_costs(1), [1])
        self.assertEqual(count_costs(8), [1, 2, 3, 1, 5, 1, 1, 1])
        for count in range(1, 513):
            with self.subTest(count=count):
                costs = count_costs(count)
                self.assertEqual(len(costs), count)
                self.assertLess(sum(costs), 3 * count)
                for position, cost in enumerate(costs):
                    copies = position if position and position & (position - 1) == 0 else 0
                    self.assertEqual(cost, 1 + copies)

    def test_standard_library_example_outputs(self):
        for suffix in (".md", ".en.md"):
            namespace = {}
            exec(example_blocks(suffix)[1], namespace)
            self.assertEqual(namespace["counts"]["a"], 3)
            self.assertEqual(namespace["groups"]["fruit"], ["pear"])
            self.assertEqual(namespace["first"], "start")
            self.assertEqual(list(namespace["queue"]), ["next"])
            self.assertEqual((namespace["left"], namespace["right"]), (1, 3))
            self.assertEqual(namespace["smallest"], 1)

    def test_heapify_height_budget(self):
        for levels in range(1, 11):
            count = 2 ** levels - 1
            heights = [0] * count
            for position in range(count - 1, -1, -1):
                children = [child for child in (2 * position + 1, 2 * position + 2) if child < count]
                if children:
                    heights[position] = 1 + max(heights[child] for child in children)
            self.assertEqual(sum(heights), count - levels)
            self.assertLess(sum(heights), count)
            if count == 15:
                self.assertEqual(sum(heights), 11)
                self.assertEqual([heights.count(height) for height in range(4)], [8, 4, 2, 1])


if __name__ == "__main__":
    unittest.main()
