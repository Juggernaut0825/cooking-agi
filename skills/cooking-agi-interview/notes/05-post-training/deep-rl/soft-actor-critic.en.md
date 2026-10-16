<!-- source: https://github.com/tianyi-zhang-02/cooking-agi/blob/main/05-post-training/deep-rl/soft-actor-critic.en.md -->
# SAC: why add entropy to reward?

[中文](soft-actor-critic.md) · **English**

> Reading time: ~10–12 min · Last reviewed: 2026-10

A deterministic Actor can commit too early to one route. SAC does more than add action noise: it puts preserving alternatives into the objective. **This changes the meaning of value, so the Critic target must change too.**

## What entropy encourages

A maximum-entropy objective is commonly written as:

$$
J(\pi)=\mathbb E\left[\sum_t\gamma^t
\left(r_t+\alpha\mathcal H(\pi(\cdot\mid s_t))\right)\right].
$$

$\alpha$ controls the relative weight of return and randomness. With two discrete actions and fixed Q-values $[0,1]$, maximizing $\sum_ap_aQ_a+\alpha H(p)$ gives $p_a\propto\exp(Q_a/\alpha)$. Small $\alpha$ concentrates the policy; large $\alpha$ makes it more uniform.

Discrete teaching example: Q=[0,1] and α=0.5 give probability about 0.881 to the higher-value action. This is not a continuous SAC training simulation.

Continuous actions use differential entropy. It can be negative and depends on coordinate scale. Do not transfer the numerical range of the discrete visualization to a continuous Gaussian policy.

## Why does softmax emerge from the entropy objective?

Fix a state and action values $Q_a$, and optimize a discrete distribution $p$. Set $Z=\sum_a\exp(Q_a/\alpha)$ and $p^*_a=\exp(Q_a/\alpha)/Z$. Then:

$$
\sum_a p_aQ_a+\alpha H(p)
=\alpha\log Z-\alpha D_{\rm KL}(p\|p^*).
$$

Nonnegative KL makes $p=p^*$ optimal. Softmax is the solution to the entropy-regularized problem, not an arbitrary insertion. The corresponding soft value is $\alpha\log\sum_a\exp(Q_a/\alpha)$.

For Q values $[0,1]$ and $\alpha=0.5$, the better action has probability about 0.8808, expected Q is about 0.8808, entropy is about 0.3653, and soft value is about 1.0635. Exceeding the maximum Q of 1 reflects the entropy bonus, not an action with reward above 1.

With continuous actions, the sum becomes an integral and normalization may be intractable. SAC uses a parameterized policy for approximate improvement rather than enumerating continuous actions in a giant softmax.

## Check automatic temperature with its update direction

For an average entropy floor $H_{\rm target}$, hold the policy fixed and consider minimizing $L_\alpha=\alpha(H-H_{\rm target})$ over $\alpha\ge0$. Below-target entropy gives a negative derivative, increasing $\alpha$ and the incentive for randomness. Above-target entropy does the opposite. This constrains the average, not every state's entropy to the same value.

Let $\eta=\log\alpha$, estimate entropy with $\hat H=-\log\pi(a\mid s)$, and set $g=\operatorname{stopgrad}(\hat H-H_{\rm target})$. Direct substitution gives $L_\eta=e^\eta g$ with gradient $\alpha g$; the common surrogate $\tilde L_\eta=\eta g$ instead has gradient $g$. The directions agree, but these are different losses with different gradient scales. Continuous differential-entropy targets may be negative: $\hat H=-2,H_{\rm target}=-1$ still means insufficient entropy, so either descent update raises the temperature.

## The common twin-Q formulation

We use the common SAC variant without a separate V-network; the original paper's network arrangement differs. Sample the next action from the current stochastic policy and use slowly updated target Q parameters, with $d$ denoting true termination:

$$
y=r+\gamma(1-d)
\left[\min_iQ_{\bar\phi_i}(s',a')-\alpha\log\pi_\theta(a'\mid s')\right],
\quad a'\sim\pi_\theta(\cdot\mid s').
$$

This soft Q includes the current reward, then future rewards and entropy from the next state onward. The current state's entropy enters the policy objective; do not add it twice. Critics fit the detached target above, while the Actor minimizes:

$$
L_\pi=\mathbb E_{s\sim\mathcal D,\,a\sim\pi_\theta}
\left[\alpha\log\pi_\theta(a\mid s)-\min_iQ_{\phi_i}(s,a)\right].
$$

The first term discourages premature concentration; the second favors valuable actions. States here come from replay: this is the practical policy-improvement objective, not an exact gradient of the opening $J(\pi)$ under true state visitation. Multiplying every reward by 100 without changing $\alpha$ also changes the two terms' balance.

## Reparameterization and the missing tanh correction

Reparameterization writes a random action as fixed noise passed through a differentiable transform. Trace the data flow before the change of variables:

State sPredict μ, log σ→Fixed noise εu = μ + σε→Action atanh + density correction→Q and log πBoth reach the Actor

Write $u=\mu_\theta(s)+\sigma_\theta(s)\epsilon$, with $\epsilon\sim\mathcal N(0,I)$, then bound actions using $a=\tanh u$. Gradients can now pass through the action into the Actor. “Fixed noise” in the diagram means holding this sampled $\epsilon$ constant during differentiation, not reusing the same noise throughout training.

The action density is no longer the original Gaussian density. Apply change of variables:

$$
\log\pi(a\mid s)=\log\mathcal N(u;\mu,\sigma)
-\sum_j\log(1-\tanh^2u_j).
$$

Use a numerically stable equivalent rather than evaluating $\log0$ near tanh saturation. A density in environment-action coordinates must also subtract the scaling log-determinant. Alternatively, define entropy consistently in normalized-action coordinates, including in the Critic target and temperature loss. For a scalar action, rescaling to $a_{\rm env}=2a$ gives $\log\pi_{\rm env}=\log\pi-\log2$ and $H_{\rm env}=H+\log2$; expressing the same entropy constraint requires adding $\log2$ to $H_{\rm target}$ too. This constant does not directly change the Actor gradient with Q and temperature fixed, but it changes the entropy reading.

A stable scalar Jacobian term is:

$$
\log(1-\tanh^2u)=2\left(\log2-u-\operatorname{softplus}(-2u)\right).
$$

At $u=0$, it is zero. For large $u$, directly computing $1-\tanh^2u$ can round to zero; the right-hand form avoids first subtracting nearly equal numbers. Sum over action dimensions, not over the batch as well.

## Check 3 updates with one transition

Let $r=1,\gamma=0.9,\alpha=0.2$, sampled next-action log-probability be -0.7, and the smaller target Q be 4. For a nonterminal transition:

$$
y=1+0.9\left[4-0.2(-0.7)\right]=4.726.
$$

The extra 0.126 comes from the soft-value definition, not additional task reward. It also does not show SAC outperforming TD3.

| Update | Quantities read | Where gradients must stop |
| --- | --- | --- |
| Two Q-functions | Replay $(s,a)$ and the soft target | Entire target branch, including target Q, sampled action, log-probability, and α |
| Actor | Current states, reparameterized actions, current twin Q, log-probability | Hold α and Critic parameters fixed, but keep Q → action → Actor derivatives |
| Temperature α, if enabled | Difference between policy entropy and target entropy | Treat policy log-probability as fixed for this step |

Initialize the two target Q-networks from the current Q-networks, then typically Polyak-update them each Critic round. This variant has no target Actor and adds no separate TD3 smoothing noise. True termination gives $y=r$; an external time-limit truncation still uses a soft bootstrap from the final pre-reset state.

The policy-gradient chapter's update, which multiplies $\nabla\log\pi$ by a return (the score-function estimator), treats sampled actions as fixed observations; this Actor differentiates through them. The distinction is the estimator, not simply discrete versus continuous actions: continuous policies can also use score-function gradients. The two paths need different detach positions.

## Automatic temperature still involves choices

Automatic $\alpha$ tuning aims for a specified target entropy. You still choose that target, action scale, and reward scale, and must check update signs. Inspecting $\alpha$, log probabilities, action saturation, and Critic magnitudes often reveals more than one return curve.

| Choice | Benefit | Cost |
| --- | --- | --- |
| Fixed temperature | Simple and easy to analyze | Sensitive to reward scale |
| Automatic temperature | Adapts to policy entropy | Adds a target and optimizer; a sign error can compound |
| Minimum of twin Critics | Reduces some overestimation | Can also be pessimistically biased |

## Where it fits, and where it does not

SAC is often useful for continuous control with reusable data. It is not a universal RL upgrade. Huge discrete token spaces need different designs, entropy need not solve sparse-reward exploration, and real systems may prohibit random experimentation.

References: [Original SAC paper](https://arxiv.org/abs/1801.01290) · [Algorithms and Applications](https://arxiv.org/abs/1812.05905) · [Twin-Q equations and pseudocode](https://spinningup.openai.com/en/latest/algorithms/sac.html). Next: [Learning a model to think ahead](model-based.en.md).
