import importlib.util
from pathlib import Path
import re
import unittest


NOTES = Path(__file__).resolve().parents[2] / "05-post-training/deep-rl"


def load_example(chapter, suffix):
    source = NOTES / (chapter + suffix)
    snippets = re.findall(r"```python\n(.*?)```", source.read_text(), re.S)
    if not snippets:
        raise AssertionError(f"No Python example in {source}")
    namespace = {}
    exec(compile("\n".join(snippets), str(source), "exec"), namespace)
    return namespace


class DeepRLFoundationAuditTests(unittest.TestCase):
    def test_td_terminal_and_truncation_targets(self):
        for suffix in (".md", ".en.md"):
            target = load_example("returns-and-td", suffix)["td_target"]
            with self.subTest(suffix=suffix):
                self.assertEqual(target(1.0, 5.0, 0.9, True), 1.0)
                self.assertEqual(target(1.0, 5.0, 0.9, False), 5.5)

    def test_td_terminal_ignores_nonfinite_successor(self):
        for suffix in (".md", ".en.md"):
            target = load_example("returns-and-td", suffix)["td_target"]
            for successor in (float("nan"), float("inf"), -float("inf")):
                with self.subTest(suffix=suffix, successor=successor):
                    self.assertEqual(target(1.0, successor, 0.9, True), 1.0)

    def test_td_zero_discount_ignores_nonfinite_successor(self):
        for suffix in (".md", ".en.md"):
            target = load_example("returns-and-td", suffix)["td_target"]
            for successor in (float("nan"), float("inf"), -float("inf")):
                with self.subTest(suffix=suffix, successor=successor):
                    self.assertEqual(target(1.0, successor, 0.0, False), 1.0)

    @unittest.skipUnless(importlib.util.find_spec("torch"), "PyTorch required")
    def test_double_dqn_label_changes_with_fixed_target_network(self):
        import torch

        class TableNetwork(torch.nn.Module):
            def __init__(self, values):
                super().__init__()
                self.values = torch.nn.Parameter(torch.tensor(values, dtype=torch.float64))

            def forward(self, states):
                return self.values[states[:, 0].long()]

        for suffix in (".md", ".en.md"):
            loss_function = load_example("dqn", suffix)["double_dqn_loss"]
            online = TableNetwork([[0, 0], [5, 4]])
            target = TableNetwork([[0, 0], [2, 6]])
            original_target = target.values.detach().clone()
            states = torch.tensor([[0.]], dtype=torch.float64)
            successors = torch.tensor([[1.]], dtype=torch.float64)
            actions = torch.tensor([0])
            rewards = torch.tensor([1.], dtype=torch.float64)
            terminated = torch.tensor([False])
            with self.subTest(suffix=suffix):
                before = loss_function(online, target, states, actions, rewards,
                                       successors, terminated, 0.9)
                self.assertAlmostEqual(before.item(), 2.8 - 0.5)
                with torch.no_grad():
                    online.values[1, 0] = 3.0
                after = loss_function(online, target, states, actions, rewards,
                                      successors, terminated, 0.9)
                self.assertAlmostEqual(after.item(), 6.4 - 0.5)
                self.assertTrue(torch.equal(target.values, original_target))
                after.backward()
                self.assertIsNone(target.values.grad)
                self.assertEqual(online.values.grad[1].abs().sum().item(), 0.0)
                self.assertLess(online.values.grad[0, 0].item(), 0.0)


if __name__ == "__main__":
    unittest.main()
