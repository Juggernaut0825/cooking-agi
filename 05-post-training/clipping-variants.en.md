# What exactly is being clipped?

[中文](clipping-variants.md) · **English**

> Checked: 2026-10-10 · Further study · Start with [PPO clipping](rlhf/ppo-clipping.en.md)

A token has already become much more likely. Should the next update keep pushing it? Some methods stop this contribution. Others keep updating with a capped weight, or gradually reduce its influence.

For the main distinction, read the table and three examples. Expand the equations and CPU check when you want the derivation. This is policy-update clipping—not the vision–language model CLIP, and not gradient clipping.

## Find the operation being clipped {#where-to-clip}

Hold a sampled response and its prefixes fixed. Write $\rho=\pi_\theta(a\mid s)/\pi_b(a\mid s)$, where $\pi_b$ generated the data; it is not the Reference. Treat advantage $A$ as fixed for this derivative.

| Method | Main change | Look for in code |
| --- | --- | --- |
| PPO / common GRPO | Flatten the term after enough movement in the advantage-favored direction | Which branch `min` selects |
| DAPO's Clip-Higher | Set upper and lower thresholds separately | Not widening both bounds at once |
| Dual-clip PPO | Also cap the extreme penalty for negative advantages | The second `max` applies only for $A<0$ |
| CISPO | Cap the weight multiplying log-probability | Detach the weight, not log-probability |
| SAPO | Smoothly attenuate updates away from the sampling policy | The derivative, not just the objective value |
| GSPO | Aggregate a response-level ratio before clipping | Masks, length normalization, and clipping granularity |

[DAPO](dapo.en.md) and [GSPO](policy-ratios.en.md) have their own worked examples. Here we fill in three other mechanisms; these are alternatives to investigate, not successive upgrades everyone must adopt.

## Dual-clip: limit an extreme negative contribution {#dual-clip}

Suppose an action had probability 2% under the behavior policy and now has probability 10%. Then $\rho=5$. With $A=-1$, ordinary PPO retains a contribution of $-5$, pushing that probability down. Large ratios can make this correction large too.

The [Dual-clip PPO algorithm section](https://arxiv.org/html/1912.09729v3) adds a floor for negative-advantage terms. With illustrative $c=3$, the term becomes $\max(-5,-3)=-3$, a plateau. Positive-advantage terms do not receive this extra operation.

<details markdown="1">
<summary>Why another max, rather than another min?</summary>

Let $J_{\rm PPO}$ denote the ordinary objective to maximize:

$$
J_{\rm dual}=\begin{cases}
\max(J_{\rm PPO},cA),&A<0,\\
J_{\rm PPO},&A\geq0,
\end{cases}\qquad c>1.
$$

Since $A$ is negative, so is $cA$. Taking `max` prevents the term from becoming arbitrarily negative. Another `min` would not do that. If code minimizes $-J$, transform both the signs and the selection operation consistently.

</details>

This addresses one extreme-weight behavior, not bad rewards or arbitrarily stale data. The paper studied distributed game RL; its results are not a guarantee for language models.

## CISPO: the weight stops growing, but the gradient remains {#cispo}

Take one token with old probability 0.5, current probability 0.7, and $A=1$. Its ratio is 1.4. PPO with upper threshold 1.2 is already flat. CISPO in [MiniMax-M1 §3.1](https://arxiv.org/html/2506.13585v1#S3.SS1) instead multiplies current log-probability by a detached, clipped weight.

For this comparison, **we choose an upper cap of 1.2 and no effective lower cap**. The objective's derivative with respect to current log-probability is still $+1.2$, not zero. Further probability growth no longer increases that weight, but crossing the cap does not turn off the update.

<details markdown="1">
<summary>Exactly what gets detached?</summary>

$$
J_{\rm CISPO}=\operatorname{sg}(\hat\rho)A\log\pi_\theta(a\mid s),
\qquad
\hat\rho=\operatorname{clip}(\rho,0,1.2).
$$

Thus $\partial J/\partial\log\pi_\theta=\hat\rho A$. Stop-gradient applies to the weight, not the entire product. Without it, an uncapped weight contributes its own derivative. Equal forward values are not sufficient to verify the implementation.

</details>

This is one local term, not a CISPO trainer; the paper also uses group-relative advantages and valid-token aggregation. Clipping changes weights, and this tokenwise expression does not correct the entire prefix distribution. It is not unbiased full-trajectory IS. Zero advantages, action masks, and numerical underflow can still remove a contribution; “not dropped for crossing the cap” does not mean every token always has a signal.

## SAPO: reduce the contribution smoothly {#sapo}

Here SAPO means [Soft Adaptive Policy Optimization v2](https://arxiv.org/html/2511.20347v2#S3). It replaces hard clipping with a smooth function and allows different $\tau$ values for positive and negative advantages. This $\tau$ controls update attenuation, **not generation temperature**.

<details markdown="1">
<summary>The objective and its gradient weight are different functions</summary>

For $p=\sigma(\tau(\rho-1))$, the local objective and derivative are:

$$
J_{\rm SAPO}=\frac{4}{\tau}pA,
\qquad
\frac{\partial J}{\partial\log\pi_\theta}
=\underbrace{4p(1-p)}_{w(\rho)}\rho A.
$$

$w$ equals 1 at $\rho=1$ and decreases away from it. **The gate $w$ is not the full coefficient $w\rho A$**: bounding the former by 1 does not bound the latter's magnitude by 1. The approximate sequence-level interpretation needs additional assumptions; this tokenwise formula is not simply GSPO.

</details>

With teaching parameters $\tau=2$ and $A=1$, the log-probability derivative is 1 at $\rho=1$ and about 1.1979 at $\rho=1.4$. It is smaller than the unattenuated 1.4, without abruptly becoming zero at 1.2. Floating-point sigmoid can still saturate at extreme ratios. Smoothness guarantees neither a usable gradient everywhere nor a hard KL bound.

## Check the same input under each objective {#gradient-check}

We compare **local derivatives of maximization objectives with respect to the selected log-probability**. Negate them for a minimization loss, then backpropagate through log-softmax and the model. Raw loss values from different objectives are not comparable quality scores.

| Fixed $A=1,\rho=1.4$ | Local derivative |
| --- | --- |
| PPO, upper threshold 1.2 | 0 |
| Dual-clip, $c=3$ | 0; its positive-advantage branch is unchanged |
| CISPO, upper cap 1.2 | 1.2 |
| SAPO, $\tau=2$ | About 1.1979 |

<details markdown="1">
<summary>Run the comparison on CPU</summary>

The example assumes equally shaped finite inputs and omits masks, reductions, KL, rollouts, and optimization. The function does not fully validate its inputs and is not a production loss API. Ratios stay moderate so exponential overflow does not obscure this mechanism check.

```python
import math
import torch

def local_surrogates(log_prob, old_log_prob, advantage):
    fixed_advantage = advantage.detach()
    ratio = (log_prob - old_log_prob.detach()).exp()
    ordinary = torch.minimum(
        ratio * fixed_advantage,
        ratio.clamp(0.8, 1.2) * fixed_advantage,
    )
    dual = torch.where(
        fixed_advantage < 0,
        torch.maximum(ordinary, 3.0 * fixed_advantage),
        ordinary,
    )
    capped_weight = ratio.clamp(0.0, 1.2).detach()
    smooth = 2.0 * torch.sigmoid(2.0 * (ratio - 1.0))
    return {
        "ppo": ordinary,
        "dual": dual,
        "cispo": capped_weight * fixed_advantage * log_prob,
        "sapo": smooth * fixed_advantage,
    }

current = torch.tensor(math.log(0.7), dtype=torch.float64, requires_grad=True)
old = torch.tensor(math.log(0.5), dtype=torch.float64)
advantage = torch.tensor(1.0, dtype=torch.float64)
terms = local_surrogates(current, old, advantage)
derivatives = {
    name: torch.autograd.grad(term, current, retain_graph=True)[0].item()
    for name, term in terms.items()
}
assert derivatives["ppo"] == derivatives["dual"] == 0
assert math.isclose(derivatives["cispo"], 1.2)
assert math.isclose(derivatives["sapo"], 1.197894300513649, rel_tol=1e-12)
```

To try a negative advantage, change current probability to 0.1, old probability to 0.02, and advantage to −1; remove the three assertions for the previous example. PPO and Dual-clip then have values −5 and −3, with log-probability derivatives −5 and 0. Automated tests also cover both signs, zero advantage, several ratios, and the stop-gradient paths.

</details>

## What to record before changing the algorithm {#diagnostics}

- Separate positive and negative advantages. Which has a longer ratio tail? Which terms actually reach a plateau?
- Record update-coefficient distributions, not just whether something was clipped. CISPO's weight-cap fraction is not PPO's zero-gradient fraction.
- Match data, generation budgets, masks, loss reduction, and evaluation. Changing five things at once makes the cause of an improvement hard to identify.
- Inspect rewards, lengths, KL, and failures together. A smoother curve does not establish more reliable answers.

This page checks local formulas and CPU gradients, not model quality or GPU throughput. Continue with [stale asynchronous trajectories](async-policy-learning.en.md), or return to the [post-training overview](README.en.md) to choose another route.
