import importlib.util
import json
import math
from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]
TORCH_AVAILABLE = importlib.util.find_spec("torch") is not None


class ContinuousControlArithmeticTests(unittest.TestCase):
    def test_entropy_coordinate_change_preserves_constraint_gap(self):
        normalized_log_probability = 2.0
        normalized_target_entropy = -1.0
        log_scale = math.log(2)
        environment_log_probability = normalized_log_probability - log_scale
        environment_target_entropy = normalized_target_entropy + log_scale
        normalized_gap = -normalized_log_probability - normalized_target_entropy
        environment_gap = -environment_log_probability - environment_target_entropy
        self.assertAlmostEqual(environment_gap, normalized_gap)
        self.assertNotAlmostEqual(
            -environment_log_probability - normalized_target_entropy, normalized_gap)

    def test_entropy_lab_matches_worked_example_across_supported_temperatures(self):
        node = shutil.which("node")
        if node is None:
            self.skipTest("Node.js required")
        script = """
const lab = require(process.argv[1]);
console.log(JSON.stringify([0.05, 0.1, 0.5, 1, 2].map(alpha => lab.entropyPolicy(alpha))));
"""
        result = subprocess.run(
            [node, "-e", script, str(ROOT / "site/static/deep-rl-lab.js")],
            check=True, capture_output=True, text=True)
        rows = json.loads(result.stdout)
        previous_entropy = -math.inf
        for temperature, row in zip((0.05, 0.1, 0.5, 1, 2), rows):
            probabilities = row["probabilities"]
            self.assertAlmostEqual(sum(probabilities), 1)
            self.assertTrue(all(0 < probability < 1 for probability in probabilities))
            self.assertTrue(math.isfinite(row["entropy"]))
            self.assertGreater(row["entropy"], previous_entropy)
            previous_entropy = row["entropy"]
            soft_value = probabilities[1] + temperature * row["entropy"]
            self.assertAlmostEqual(
                soft_value, temperature * math.log1p(math.exp(1 / temperature)))
        self.assertAlmostEqual(rows[2]["probabilities"][1], 0.8807970779778823)
        self.assertAlmostEqual(rows[2]["entropy"], 0.3653338550872076)


@unittest.skipUnless(TORCH_AVAILABLE, "PyTorch required")
class ContinuousControlGradientTests(unittest.TestCase):
    def test_ddpg_actor_gradient_passes_through_frozen_critic(self):
        import torch

        parameter = torch.tensor(math.atanh(0.2), dtype=torch.float64, requires_grad=True)
        critic_peak = torch.nn.Parameter(torch.tensor(0.7, dtype=torch.float64))
        critic_peak.requires_grad_(False)
        action = parameter.tanh()
        critic_value = -(action - critic_peak).square()
        (-critic_value).backward()
        self.assertAlmostEqual(parameter.grad.item(), -0.96)
        self.assertIsNone(critic_peak.grad)
        with torch.no_grad():
            disconnected_value = -(parameter.tanh() - critic_peak).square()
        self.assertFalse(disconnected_value.requires_grad)

    def test_td3_clips_noise_then_actions(self):
        import torch

        proposed = torch.tensor([0.9, -0.9, 0.0], dtype=torch.float64, requires_grad=True)
        noise = torch.tensor([0.4, -0.4, 0.4], dtype=torch.float64)
        with torch.no_grad():
            smoothed = (proposed + noise.clamp(-0.2, 0.2)).clamp(-1, 1)
        torch.testing.assert_close(smoothed, torch.tensor([1.0, -1.0, 0.2], dtype=torch.float64))
        self.assertFalse(smoothed.requires_grad)

    def test_td3_shared_target_is_detached_and_masks_only_termination(self):
        import torch

        target_first = torch.tensor([4.0, 4.0, 4.0], requires_grad=True)
        target_second = torch.tensor([6.0, 6.0, 6.0], requires_grad=True)
        terminated = torch.tensor([False, True, False])
        truncated = torch.tensor([False, False, True])
        with torch.no_grad():
            target = 1 + 0.9 * (~terminated) * torch.minimum(target_first, target_second)
        torch.testing.assert_close(target, torch.tensor([4.6, 1.0, 4.6]))
        self.assertEqual(target[truncated].item(), target[0].item())
        current_first = torch.tensor([3.0, 3.0, 3.0], requires_grad=True)
        current_second = torch.tensor([5.0, 5.0, 5.0], requires_grad=True)
        loss = (current_first - target).square().mean() + (current_second - target).square().mean()
        loss.backward()
        self.assertIsNone(target_first.grad)
        self.assertIsNone(target_second.grad)
        self.assertLess(current_first.grad[0].item(), 0)
        self.assertGreater(current_second.grad[0].item(), 0)

    def test_sac_soft_target_stops_policy_temperature_and_target_gradients(self):
        import torch

        policy_mean = torch.tensor(0.2, dtype=torch.float64, requires_grad=True)
        target_peak = torch.tensor(4.0, dtype=torch.float64, requires_grad=True)
        log_temperature = torch.tensor(math.log(0.2), dtype=torch.float64, requires_grad=True)
        with torch.no_grad():
            latent = policy_mean + 0.5
            action = latent.tanh()
            log_probability = (-0.5 * (latent - policy_mean).square()
                               - 0.5 * math.log(2 * math.pi)
                               - 2 * (math.log(2) - latent - torch.nn.functional.softplus(-2 * latent)))
            minimum_q = torch.minimum(target_peak - action.square(), target_peak + 1)
            soft_value = minimum_q - log_temperature.exp() * log_probability
            target = 1 + 0.9 * torch.tensor([1.0, 0.0], dtype=torch.float64) * soft_value
        current_q = torch.tensor([3.0, 5.0], dtype=torch.float64, requires_grad=True)
        (current_q - target).square().mean().backward()
        self.assertEqual(target[1].item(), 1)
        self.assertFalse(target.requires_grad)
        self.assertIsNotNone(current_q.grad)
        for parameter in (policy_mean, target_peak, log_temperature):
            self.assertIsNone(parameter.grad)

    def test_sac_actor_reparameterization_matches_finite_differences(self):
        import torch

        parameters = torch.tensor([0.2, -0.3], dtype=torch.float64, requires_grad=True)
        critic_peak = torch.nn.Parameter(torch.tensor(0.7, dtype=torch.float64), requires_grad=False)
        log_temperature = torch.tensor(math.log(0.2), dtype=torch.float64, requires_grad=True)
        noise = torch.tensor([[0.5, -0.7], [0.1, 1.2]], dtype=torch.float64)

        def actor_loss(current_parameters):
            mean, log_std = current_parameters.unbind()
            latent = mean + log_std.exp() * noise
            actions = latent.tanh()
            gaussian = torch.distributions.Normal(mean, log_std.exp())
            log_jacobian = 2 * (math.log(2) - latent - torch.nn.functional.softplus(-2 * latent))
            log_probability = (gaussian.log_prob(latent) - log_jacobian).sum(dim=-1)
            self.assertEqual(log_probability.shape, (2,))
            first_q = -(actions - critic_peak).square().sum(dim=-1)
            second_q = first_q + 1
            return (log_temperature.detach().exp() * log_probability
                    - torch.minimum(first_q, second_q)).mean()

        actor_loss(parameters).backward()
        difference = 1e-6
        for index in range(parameters.numel()):
            positive = parameters.detach().clone()
            negative = parameters.detach().clone()
            positive[index] += difference
            negative[index] -= difference
            numerical = (actor_loss(positive) - actor_loss(negative)) / (2 * difference)
            self.assertAlmostEqual(parameters.grad[index].item(), numerical.item(), places=7)
            self.assertGreater(abs(parameters.grad[index].item()), 1e-5)
        self.assertIsNone(critic_peak.grad)
        self.assertIsNone(log_temperature.grad)

    def test_temperature_losses_share_direction_not_gradient_scale(self):
        import torch

        for entropy in (-2.0, -1.0, 0.0):
            for use_surrogate in (False, True):
                with self.subTest(entropy=entropy, surrogate=use_surrogate):
                    log_probability = torch.tensor(-entropy, dtype=torch.float64, requires_grad=True)
                    log_temperature = torch.tensor(math.log(0.2), dtype=torch.float64, requires_grad=True)
                    gap = (-log_probability - (-1.0)).detach()
                    multiplier = log_temperature if use_surrogate else log_temperature.exp()
                    (multiplier * gap).backward()
                    expected = (entropy + 1.0) * (1.0 if use_surrogate else 0.2)
                    self.assertAlmostEqual(log_temperature.grad.item(), expected)
                    self.assertIsNone(log_probability.grad)
                    updated = math.exp(log_temperature.item() - 0.1 * log_temperature.grad.item())
                    if entropy < -1:
                        self.assertGreater(updated, 0.2)
                    elif entropy > -1:
                        self.assertLess(updated, 0.2)
                    else:
                        self.assertAlmostEqual(updated, 0.2)

    def test_stable_tanh_jacobian_handles_saturation(self):
        import torch

        latents = torch.tensor([-1000.0, -20.0, -3.0, 0.0, 3.0, 20.0, 1000.0],
                               dtype=torch.float64, requires_grad=True)
        stable = 2 * (math.log(2) - latents - torch.nn.functional.softplus(-2 * latents))
        self.assertTrue(torch.isfinite(stable).all())
        torch.testing.assert_close(stable, stable.flip(0))
        torch.testing.assert_close(stable[2:5], torch.log1p(-latents[2:5].tanh().square()))
        self.assertEqual(stable[3].item(), 0)
        self.assertFalse(torch.isfinite(torch.log1p(-latents[0].tanh().square())))
        stable.sum().backward()
        self.assertTrue(torch.isfinite(latents.grad).all())

    def test_td3_target_updates_follow_delayed_actor_rounds(self):
        import torch

        online = torch.nn.Parameter(torch.tensor(0.0, dtype=torch.float64))
        target = online.detach().clone()
        synchronized = []
        for critic_round in range(1, 5):
            with torch.no_grad():
                online.fill_(critic_round)
                if critic_round % 2 == 0:
                    target.mul_(0.9).add_(online, alpha=0.1)
            synchronized.append(target.item())
        for actual, expected in zip(synchronized, (0.0, 0.2, 0.2, 0.58)):
            self.assertAlmostEqual(actual, expected)
        self.assertFalse(target.requires_grad)


if __name__ == "__main__":
    unittest.main()
