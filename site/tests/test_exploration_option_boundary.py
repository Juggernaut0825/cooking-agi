import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
NOTES = ROOT / "05-post-training/deep-rl"
SPEC = importlib.util.spec_from_file_location("rl_checks", NOTES / "code/rl_checks.py")
REFERENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REFERENCE)


class ExplorationOptionBoundaryTests(unittest.TestCase):
    def test_option_bootstrap_masks_environment_not_option_termination(self):
        for suffix, distinction in (
            ("", "不表示 option 自己结束"),
            (".en", "not option termination"),
        ):
            with self.subTest(language=suffix or "zh"):
                chapter = (NOTES / f"exploration-and-hierarchy{suffix}.md").read_text()
                self.assertIn(r"+\gamma^\tau(1-d)V(s_{t+\tau}).", chapter)
                self.assertIn(distinction, chapter)
                self.assertIn(r"y=2.62+0.9^3\times5=6.265", chapter)
                self.assertIn("y=2.62$", chapter)

        rewards = [1, 0, 2]
        discount = 0.9
        successor_value = 5
        option_return = REFERENCE.discounted_return(rewards, discount)
        self.assertAlmostEqual(option_return, 2.62)
        for environment_terminated, expected in ((False, 6.265), (True, 2.62)):
            with self.subTest(environment_terminated=environment_terminated):
                tail = 0 if environment_terminated else successor_value
                target = option_return + discount ** len(rewards) * tail
                nested_target = tail
                for reward in reversed(rewards):
                    nested_target = reward + discount * nested_target
                self.assertAlmostEqual(target, expected)
                self.assertAlmostEqual(target, nested_target)
        self.assertNotAlmostEqual(option_return + discount * successor_value, 6.265)


if __name__ == "__main__":
    unittest.main()
