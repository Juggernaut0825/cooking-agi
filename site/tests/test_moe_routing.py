import ast
import importlib.util
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
SOURCE = ROOT / "00-foundations/code/moe_routing.py"
if torch is not None:
    SPEC = importlib.util.spec_from_file_location("moe_routing", SOURCE)
    MOE = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(MOE)


class MoeDocumentationTests(unittest.TestCase):
    def test_simulation_does_not_claim_to_compute_auxiliary_gradients(self):
        source = (ROOT / "site/static/tx-lab.js").read_text()
        self.assertIn("not gradients of the auxiliary loss below", source)
        self.assertIn("并没有计算下方辅助 loss 的梯度", source)
        self.assertNotIn("Tokens over capacity (dropped)", source)

    def test_bilingual_examples_match(self):
        for chapter in ("router", "load-balancing"):
            examples = []
            for suffix in (".md", ".en.md"):
                text = (ROOT / "00-foundations/moe" / (chapter + suffix)).read_text()
                blocks = re.findall(r"```python\n(.*?)```", text, re.DOTALL)
                for block in blocks:
                    ast.parse(block)
                examples.append(blocks)
            self.assertEqual(examples[0], examples[1])

    def test_dispatch_excerpt_matches_executable_function(self):
        module = ast.parse(SOURCE.read_text())
        expected = next(node for node in module.body if isinstance(node, ast.FunctionDef)
                        and node.name == "sparse_moe")
        for suffix in (".md", ".en.md"):
            text = (ROOT / "00-foundations/moe" / ("router" + suffix)).read_text()
            excerpt = re.search(r"```python\n(def sparse_moe.*?)(?:```)", text, re.DOTALL).group(1)
            self.assertEqual(ast.dump(expected), ast.dump(ast.parse(excerpt).body[0]))

    def test_new_sections_have_shared_anchors(self):
        for chapter, anchors in {
            "router": ("dispatch-example", "routing-gradients", "group-limited-routing"),
            "load-balancing": ("sequence-balance", "balance-gradient"),
        }.items():
            for suffix in (".md", ".en.md"):
                text = (ROOT / "00-foundations/moe" / (chapter + suffix)).read_text()
                for anchor in anchors:
                    self.assertIn("{#" + anchor + "}", text)
                self.assertIn('<details markdown="1">', text)
                self.assertIn("../code/moe_routing.py", text)


@unittest.skipIf(torch is None, "PyTorch unavailable; MoE numerical tests not run")
class MoeRoutingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        previous_threads = torch.get_num_threads()
        torch.set_num_threads(1)
        cls.addClassCleanup(torch.set_num_threads, previous_threads)

    def make_experts(self, count=3, width=2):
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(31)
            return torch.nn.ModuleList([
                torch.nn.Sequential(torch.nn.Linear(width, 3), torch.nn.Tanh(),
                                    torch.nn.Linear(3, width)).double()
                for expert_id in range(count)
            ])

    def test_dispatch_arithmetic(self):
        hidden = torch.eye(2, dtype=torch.float64)
        experts = torch.nn.ModuleList([torch.nn.Linear(2, 2, bias=False).double() for expert_id in range(3)])
        matrices = [[[2, 0], [0, 0]], [[0, 1], [0, 3]], [[0, 5], [4, 1]]]
        with torch.no_grad():
            for expert, matrix in zip(experts, matrices):
                expert.weight.copy_(torch.tensor(matrix, dtype=torch.float64))
        logits = torch.tensor([[3.0, 1e-10, 1.0], [1e-10, 1.5, 1.0]], dtype=torch.float64).log()
        output = MOE.sparse_moe(hidden, logits, experts, 2)
        torch.testing.assert_close(output, torch.tensor([[1.5, 1.0], [2.6, 2.2]], dtype=torch.float64))

    def test_sparse_outputs_and_gradients_match_dense_oracle(self):
        hidden = torch.tensor([[0.2, 0.8], [-0.3, 0.7], [1.1, -0.4]], dtype=torch.float64,
                              requires_grad=True)
        router_weight = torch.tensor([[2., -1., 0.4], [0.3, 1.3, -0.8]], dtype=torch.float64,
                                     requires_grad=True)
        experts = self.make_experts()
        for normalization in ("selected", "full"):
            logits = hidden @ router_weight
            sparse = MOE.sparse_moe(hidden, logits, experts, 2, normalization)
            indices = logits.topk(2, dim=-1).indices
            probabilities = logits.softmax(dim=-1)
            selected = probabilities.gather(-1, indices)
            if normalization == "selected":
                selected = selected / selected.sum(dim=-1, keepdim=True)
            gates = torch.zeros_like(logits).scatter(1, indices, selected)
            dense = (torch.stack([expert(hidden) for expert in experts], dim=1)
                     * gates[..., None]).sum(dim=1)
            torch.testing.assert_close(sparse, dense)
            parameters = (hidden, router_weight, *experts.parameters())
            sparse_gradients = torch.autograd.grad(sparse.square().sum(), parameters, retain_graph=True)
            dense_gradients = torch.autograd.grad(dense.square().sum(), parameters)
            for actual, expected in zip(sparse_gradients, dense_gradients):
                torch.testing.assert_close(actual, expected)

    def test_gradcheck_away_from_selection_boundaries(self):
        hidden = torch.tensor([[0.3, -0.2]], dtype=torch.float64, requires_grad=True)
        logits = torch.tensor([[3., 1., -2.]], dtype=torch.float64, requires_grad=True)
        experts = self.make_experts()
        self.assertTrue(torch.autograd.gradcheck(lambda inputs, scores: MOE.sparse_moe(inputs, scores, experts, 2),
                                                (hidden, logits)))

    def test_mixed_precision_dispatch_and_backward(self):
        for dtype in (torch.bfloat16, torch.float16, torch.float32, torch.float64):
            for normalization in ("selected", "full"):
                with self.subTest(dtype=dtype, normalization=normalization):
                    hidden = torch.tensor([[0.2, 0.8], [-0.3, 0.7], [1.1, -0.4]],
                                          dtype=dtype, requires_grad=True)
                    router_weight = torch.tensor([[2., -1., 0.4], [0.3, 1.3, -0.8]],
                                                 dtype=torch.float32, requires_grad=True)
                    logits = hidden.float() @ router_weight
                    experts = self.make_experts().to(dtype)
                    actual = MOE.sparse_moe(hidden, logits, experts, 2, normalization)
                    indices = logits.topk(2, dim=-1).indices
                    selected = logits.softmax(-1).gather(1, indices)
                    if normalization == "selected":
                        selected = selected / selected.sum(-1, keepdim=True)
                    dense_weights = torch.zeros_like(logits).scatter(1, indices, selected)
                    accumulation_dtype = torch.promote_types(dtype, torch.float32)
                    dense_outputs = torch.stack([expert(hidden) for expert in experts], dim=1)
                    expected = (dense_outputs.to(accumulation_dtype)
                                * dense_weights[..., None].to(accumulation_dtype)).sum(1).to(dtype)
                    self.assertEqual(actual.dtype, dtype)
                    torch.testing.assert_close(actual, expected, atol=0.004, rtol=0.02)
                    parameters = (hidden, router_weight, *experts.parameters())
                    actual_gradients = torch.autograd.grad(actual.float().square().sum(), parameters,
                                                          retain_graph=True)
                    expected_gradients = torch.autograd.grad(expected.float().square().sum(), parameters)
                    for gradient, reference in zip(actual_gradients, expected_gradients):
                        self.assertTrue(torch.isfinite(gradient).all())
                        self.assertGreater(gradient.abs().sum().item(), 0)
                        torch.testing.assert_close(gradient, reference, atol=0.004, rtol=0.02)

    def test_gates_use_at_least_float32(self):
        for dtype in (torch.bfloat16, torch.float16, torch.float32, torch.float64):
            logits = torch.tensor([[3., 1., -2.]], dtype=dtype, requires_grad=True)
            expected_dtype = torch.float64 if dtype == torch.float64 else torch.float32
            for normalization in ("selected", "full"):
                indices, weights = MOE.selected_gates(logits, 2, normalization)
                expected = (logits.to(expected_dtype).softmax(-1).gather(1, indices)
                            if normalization == "full" else logits.to(expected_dtype).topk(2).values.softmax(-1))
                self.assertEqual(weights.dtype, expected_dtype)
                torch.testing.assert_close(weights, expected)

    def test_accumulation_precedes_cast_back_to_bfloat16(self):
        hidden = torch.ones(1, 1, dtype=torch.bfloat16)
        logits = torch.zeros(1, 3)
        experts = torch.nn.ModuleList([torch.nn.Linear(1, 1, bias=False).bfloat16() for _ in range(3)])
        with torch.no_grad():
            for expert, value in zip(experts, (256., 1., -256.)):
                expert.weight.fill_(value)
        actual = MOE.sparse_moe(hidden, logits, experts, 3)
        expected = torch.tensor([[1 / 3]], dtype=torch.bfloat16)
        torch.testing.assert_close(actual, expected)
        rounded_each_time = torch.zeros_like(hidden)
        for expert in experts:
            rounded_each_time += (expert(hidden).float() / 3).bfloat16()
        self.assertEqual(rounded_each_time.item(), 0.5)
        self.assertFalse(torch.allclose(rounded_each_time, actual))

    def test_dense_comparison_budget(self):
        dense = {width: 3 * 128 * width for width in (256, 512, 2048)}
        moe_parameters = 8 * dense[256]
        moe_mac = 2 * dense[256]
        self.assertEqual((moe_parameters, moe_mac), (786432, 196608))
        self.assertEqual(moe_mac, dense[512])
        self.assertEqual(moe_parameters, dense[2048])
        self.assertEqual(moe_parameters // dense[512], 4)


    def test_unselected_expert_gets_no_task_gradient(self):
        hidden = torch.tensor([[0.3, -0.2]], dtype=torch.float64)
        logits = torch.tensor([[3., 1., -2.]], dtype=torch.float64, requires_grad=True)
        experts = self.make_experts()
        MOE.sparse_moe(hidden, logits, experts, 2).square().sum().backward()
        self.assertTrue(all(parameter.grad is None for parameter in experts[2].parameters()))
        self.assertEqual(logits.grad[0, 2].item(), 0)
        self.assertGreater(logits.grad[0, :2].abs().sum().item(), 0)

    def test_top_one_normalization_changes_router_gradient(self):
        for normalization in ("selected", "full"):
            logits = torch.tensor([[2., 0., -1.]], dtype=torch.float64, requires_grad=True)
            indices, weights = MOE.selected_gates(logits, 1, normalization)
            (weights * 3).sum().backward()
            self.assertEqual(indices.tolist(), [[0]])
            if normalization == "selected":
                torch.testing.assert_close(logits.grad, torch.zeros_like(logits))
            else:
                self.assertGreater(logits.grad[0, 0].item(), 0)
                self.assertTrue(torch.all(logits.grad[0, 1:] < 0))

    def test_group_scoring_tradeoff(self):
        scores = torch.tensor([[0.9, 0.1, 0.8, 0.79]])
        self.assertEqual(scores.topk(2).indices.tolist(), [[0, 2]])
        self.assertEqual(MOE.group_limited_topk(scores, 2, 1, 2).tolist(), [[0, 1]])
        self.assertEqual(MOE.group_limited_topk(scores, 2, 1, 2, 2).tolist(), [[2, 3]])

    def test_negative_scores_do_not_select_masked_groups(self):
        scores = torch.tensor([[-0.1, -3., -0.2, -0.3]])
        self.assertEqual(MOE.group_limited_topk(scores, 2, 1, 2).tolist(), [[0, 1]])

    def test_group_constraints_and_all_groups_equivalence(self):
        generator = torch.Generator().manual_seed(11)
        scores = torch.randn(17, 12, generator=generator, dtype=torch.float64)
        indices = MOE.group_limited_topk(scores, 4, 2, 4)
        for chosen in indices:
            self.assertLessEqual((chosen // 3).unique().numel(), 2)
            self.assertEqual(chosen.unique().numel(), 4)
        torch.testing.assert_close(MOE.group_limited_topk(scores, 4, 4, 4), scores.topk(4).indices)
        for arguments in ((5, 1, 2), (4, 1, 4), (4, 0, 2), (4, 2, 2, 4)):
            with self.assertRaises(ValueError):
                MOE.group_limited_topk(scores, *arguments)

    def test_sequence_vs_batch_example(self):
        logits = torch.tensor([[[0.9, 0.1]] * 4, [[0.1, 0.9]] * 4], dtype=torch.float64).log()
        valid = torch.ones(2, 4, dtype=torch.bool)
        self.assertAlmostEqual(MOE.balance_loss(logits, valid, 1).item(), 1.8)
        self.assertAlmostEqual(MOE.balance_loss(logits, valid, 1, "batch").item(), 1)
        namespace = {"torch": torch, "balance_loss": MOE.balance_loss}
        text = (ROOT / "00-foundations/moe/load-balancing.md").read_text()
        block = next(block for block in re.findall(r"```python\n(.*?)```", text, re.DOTALL)
                     if "sequence_loss" in block)
        exec(block, namespace)

    def test_top_k_counts_and_normalization(self):
        logits = torch.tensor([[[4., 3., 0., -1.], [4., 3., 0., -1.],
                                [4., 0., 3., -1.], [0., 4., -1., 3.]]], dtype=torch.float64)
        fractions, probabilities = MOE.balance_statistics(logits, torch.ones(1, 4, dtype=torch.bool), 2)
        torch.testing.assert_close(fractions, torch.tensor([[.375, .375, .125, .125]], dtype=torch.float64))
        torch.testing.assert_close(probabilities.sum(dim=-1), torch.ones(1, dtype=torch.float64))

    def test_low_precision_balance_counts_do_not_overflow(self):
        valid = torch.ones(1, 8192, dtype=torch.bool)
        for dtype in (torch.float16, torch.bfloat16, torch.float32, torch.float64):
            logits = torch.zeros(1, 8192, 8, dtype=dtype)
            expected_dtype = torch.float64 if dtype == torch.float64 else torch.float32
            for scope in ("sequence", "batch"):
                with self.subTest(dtype=dtype, scope=scope):
                    fractions, probabilities = MOE.balance_statistics(logits, valid, 8, scope)
                    self.assertEqual(MOE.balance_loss(logits, valid, 8, scope).item(), 1)
                    self.assertEqual(fractions.dtype, expected_dtype)
                    self.assertEqual(probabilities.dtype, expected_dtype)
                    torch.testing.assert_close(fractions, torch.full_like(fractions, 1 / 8))
                    torch.testing.assert_close(probabilities, torch.full_like(probabilities, 1 / 8))

    def test_low_precision_balance_matches_single_token_reference(self):
        valid = torch.ones(1, 32769, dtype=torch.bool)
        valid[:, -1] = False
        for dtype in (torch.float16, torch.bfloat16):
            for scope in ("sequence", "batch"):
                for scoring in ("softmax", "sigmoid"):
                    with self.subTest(dtype=dtype, scope=scope, scoring=scoring):
                        reference = torch.tensor([[[2., 1., 0., -1.]]], requires_grad=True)
                        logits = reference.detach().to(dtype).repeat(1, 32769, 1)
                        logits[:, -1] = torch.nan
                        logits.requires_grad_()
                        expected = MOE.balance_loss(reference, valid[:, :1], 2, scope, scoring)
                        actual = MOE.balance_loss(logits, valid, 2, scope, scoring)
                        torch.testing.assert_close(actual.float(), expected)
                        self.assertEqual(actual.dtype, torch.float32)
                        expected_gradient = torch.autograd.grad(expected, reference)[0]
                        gradient = torch.autograd.grad(actual, logits)[0]
                        self.assertTrue(torch.isfinite(gradient).all())
                        torch.testing.assert_close(gradient[:, -1], torch.zeros_like(gradient[:, -1]))
                        torch.testing.assert_close(gradient[:, :32768].float().sum(1, keepdim=True),
                                                   expected_gradient, atol=0.003, rtol=0.01)

    def test_variable_lengths_change_batch_weighting(self):
        logits = torch.tensor([[[0.9, 0.1]] * 4, [[0.1, 0.9]] * 4], dtype=torch.float64).log()
        valid = torch.tensor([[True] * 4, [True, False, False, False]])
        self.assertAlmostEqual(MOE.balance_loss(logits, valid, 1).item(), 1.8)
        self.assertAlmostEqual(MOE.balance_loss(logits, valid, 1, scope="batch").item(), 1.288)

    def test_analytic_balance_gradient(self):
        logits = torch.tensor([[[0.9, 0.1]] * 4], dtype=torch.float64).log().requires_grad_()
        valid = torch.ones(1, 4, dtype=torch.bool)
        MOE.balance_loss(logits, valid, 1).backward()
        expected = torch.tensor([[[0.045, -0.045]] * 4], dtype=torch.float64)
        torch.testing.assert_close(logits.grad, expected)

    def test_discrete_count_error_has_no_gradient_path(self):
        logits = torch.tensor([[[2., 0.], [3., -1.]]], dtype=torch.float64, requires_grad=True)
        fractions, probabilities = MOE.balance_statistics(logits, torch.ones(1, 2, dtype=torch.bool), 1)
        self.assertFalse(fractions.requires_grad)
        self.assertFalse((fractions - 0.5).square().sum().requires_grad)
        self.assertTrue(probabilities.requires_grad)

    def test_padding_nan_is_excluded_and_gets_zero_gradient(self):
        base = torch.tensor([[[2., 0.], [3., -1.]]], dtype=torch.float64)
        valid = torch.tensor([[True, True, False]])
        padded = torch.cat((base, torch.full((1, 1, 2), torch.nan)), dim=1).requires_grad_()
        for scoring in ("softmax", "sigmoid"):
            loss = MOE.balance_loss(padded, valid, 1, scoring=scoring)
            expected = MOE.balance_loss(base, valid[:, :2], 1, scoring=scoring)
            torch.testing.assert_close(loss, expected)
            gradient = torch.autograd.grad(loss, padded)[0]
            self.assertTrue(torch.isfinite(gradient).all())
            torch.testing.assert_close(gradient[:, 2], torch.zeros(1, 2, dtype=torch.float64))

    def test_normalized_sigmoid_matches_direct_calculation(self):
        logits = torch.tensor([[[2., 0., -1.], [-1., 3., 0.]]], dtype=torch.float64)
        _, probabilities = MOE.balance_statistics(logits, torch.ones(1, 2, dtype=torch.bool), 2, scoring="sigmoid")
        affinities = logits.sigmoid()
        expected = (affinities / affinities.sum(dim=-1, keepdim=True)).mean(dim=1)
        torch.testing.assert_close(probabilities, expected)
        extreme = torch.full_like(logits, -1000.)
        self.assertTrue(torch.isfinite(MOE.balance_loss(extreme, torch.ones(1, 2, dtype=torch.bool), 2,
                                                       scoring="sigmoid")))

    def test_duplication_invariance_and_alpha_scaling(self):
        logits = torch.tensor([[[3., 2., -1.], [0., 1., 3.]]], dtype=torch.float64)
        valid = torch.ones(1, 2, dtype=torch.bool)
        original = MOE.balance_loss(logits, valid, 2)
        duplicate = MOE.balance_loss(logits.repeat(1, 2, 1), valid.repeat(1, 2), 2)
        torch.testing.assert_close(original, duplicate)
        torch.testing.assert_close(MOE.balance_loss(logits, valid, 2, alpha=.03), original * .03)

    def test_invalid_shapes_masks_and_empty_sequences(self):
        logits = torch.ones(2, 3, 4)
        valid = torch.ones(2, 3, dtype=torch.bool)
        for kwargs in ({"top_k": 0}, {"top_k": 5}, {"scope": "global"}, {"scoring": "raw"}):
            arguments = {"top_k": 2, **kwargs}
            with self.assertRaises(ValueError):
                MOE.balance_loss(logits, valid, **arguments)
        for mask in (valid.float(), valid[:, :2], torch.zeros_like(valid)):
            with self.assertRaises(ValueError):
                MOE.balance_loss(logits, mask, 2)


if __name__ == "__main__":
    unittest.main()
