import copy
import unittest

try:
    import torch
except ModuleNotFoundError as error:
    if error.name != "torch":
        raise
    torch = None


@unittest.skipIf(torch is None, "PyTorch is not installed")
class SystemsClosureTests(unittest.TestCase):
    def test_global_denominator_across_ranks_and_microbatches(self):
        partitions = (([1.0, 3.0], [2.0]), ([], [4.0, -1.0, 5.0]))
        token_count = sum(len(batch) for rank in partitions for batch in rank)
        rank_count = len(partitions)
        local_gradients = []
        for rank in partitions:
            weight = torch.tensor(0.7, dtype=torch.float64, requires_grad=True)
            for batch in rank:
                features = torch.tensor(batch, dtype=torch.float64)
                objective = (features * weight - 1).square().sum()
                (rank_count * objective / token_count).backward()
            local_gradients.append(weight.grad)
        reference = torch.tensor(0.7, dtype=torch.float64, requires_grad=True)
        features = torch.tensor([value for rank in partitions for batch in rank for value in batch],
                                dtype=torch.float64)
        (features * reference - 1).square().mean().backward()
        torch.testing.assert_close(torch.stack(local_gradients).mean(), reference.grad)

    def test_zero_token_rank_has_zero_contribution_not_zero_global_denominator(self):
        gradients = []
        for values in ([], [2.0, 3.0]):
            weight = torch.tensor(0.5, dtype=torch.float64, requires_grad=True)
            features = torch.tensor(values, dtype=torch.float64)
            (2 * (features * weight).square().sum() / 2).backward()
            gradients.append(weight.grad.item())
        self.assertEqual(gradients, [0.0, 13.0])
        self.assertEqual(sum(gradients) / 2, 6.5)

    def test_cached_rectangular_mask_keeps_history_and_excludes_future(self):
        queries = torch.zeros(1, 1, 2, 1, dtype=torch.float64)
        keys = torch.zeros(1, 1, 5, 1, dtype=torch.float64)
        values = torch.arange(10, 60, 10, dtype=torch.float64).reshape(1, 1, 5, 1)
        allowed = torch.arange(5)[None, :] <= torch.arange(3, 5)[:, None]
        actual = torch.nn.functional.scaled_dot_product_attention(
            queries, keys, values, attn_mask=allowed, dropout_p=0.0)
        torch.testing.assert_close(actual.flatten(), torch.tensor([25., 30.], dtype=torch.float64))
        wrong = torch.nn.functional.scaled_dot_product_attention(
            queries, keys, values, is_causal=True, dropout_p=0.0)
        torch.testing.assert_close(wrong.flatten(), torch.tensor([10., 15.], dtype=torch.float64))

    def test_pipeline_fill_drain_from_dependency_schedule(self):
        for stage_count in (1, 2, 4):
            for batch_count in (1, 4, 7):
                finish = [[0] * (batch_count + 1) for stage in range(stage_count + 1)]
                for stage in range(1, stage_count + 1):
                    for batch in range(1, batch_count + 1):
                        finish[stage][batch] = 1 + max(finish[stage - 1][batch],
                                                       finish[stage][batch - 1])
                duration = 2 * finish[-1][-1]
                busy = 2 * stage_count * batch_count
                self.assertEqual(busy / (stage_count * duration),
                                 batch_count / (batch_count + stage_count - 1))

    def test_resume_restores_optimizer_scheduler_and_rng(self):
        with torch.random.fork_rng(devices=[]):
            torch.manual_seed(8301)
            model = torch.nn.Sequential(torch.nn.Linear(2, 3), torch.nn.Dropout(0.4),
                                        torch.nn.Linear(3, 1)).double()
            optimizer = torch.optim.AdamW(model.parameters(), lr=0.02, foreach=False)
            scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.9)
            features = torch.tensor([[1., 2.], [-1., 3.]], dtype=torch.float64)

            def step(network, update, schedule):
                update.zero_grad(set_to_none=True)
                loss = network(features).square().mean()
                loss.backward()
                gradients = [parameter.grad.clone() for parameter in network.parameters()]
                update.step()
                schedule.step()
                return loss.detach(), gradients

            step(model, optimizer, scheduler)
            saved = copy.deepcopy((model.state_dict(), optimizer.state_dict(),
                                   scheduler.state_dict(), torch.get_rng_state()))
            expected_loss, expected_gradients = step(model, optimizer, scheduler)
            expected_parameters = [parameter.detach().clone() for parameter in model.parameters()]
            expected_rng = torch.get_rng_state()
            resumed = copy.deepcopy(model)
            resumed.load_state_dict(saved[0])
            resumed_optimizer = torch.optim.AdamW(resumed.parameters(), lr=0.02, foreach=False)
            resumed_scheduler = torch.optim.lr_scheduler.StepLR(resumed_optimizer, 1, gamma=0.9)
            resumed_optimizer.load_state_dict(saved[1])
            resumed_scheduler.load_state_dict(saved[2])
            torch.set_rng_state(saved[3])
            actual_loss, actual_gradients = step(resumed, resumed_optimizer, resumed_scheduler)
            torch.testing.assert_close(actual_loss, expected_loss, rtol=0, atol=0)
            for actual, expected in zip(actual_gradients, expected_gradients):
                torch.testing.assert_close(actual, expected, rtol=0, atol=0)
            for actual, expected in zip(resumed.parameters(), expected_parameters):
                torch.testing.assert_close(actual, expected, rtol=0, atol=0)
            self.assertEqual(resumed_scheduler.state_dict(), scheduler.state_dict())
            self.assertTrue(torch.equal(torch.get_rng_state(), expected_rng))
            warm_start = copy.deepcopy(resumed)
            warm_start.load_state_dict(saved[0])
            fresh_optimizer = torch.optim.AdamW(warm_start.parameters(), lr=saved[1]["param_groups"][0]["lr"],
                                                foreach=False)
            fresh_scheduler = torch.optim.lr_scheduler.StepLR(fresh_optimizer, 1, gamma=0.9)
            torch.set_rng_state(saved[3])
            step(warm_start, fresh_optimizer, fresh_scheduler)
            self.assertTrue(any(not torch.equal(actual, expected)
                                for actual, expected in zip(warm_start.parameters(), expected_parameters)))


if __name__ == "__main__":
    unittest.main()
