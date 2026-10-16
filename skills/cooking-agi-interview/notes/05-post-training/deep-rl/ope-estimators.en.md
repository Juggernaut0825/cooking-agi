<!-- source: https://github.com/tianyi-zhang-02/cooking-agi/blob/main/05-post-training/deep-rl/ope-estimators.en.md -->
# Off-policy evaluation, one layer deeper: per-decision weights, doubly robust, and LSTD

[中文](ope-estimators.md) · **English**

> Reading time: ~12 min · Last reviewed: 2026-10

[Offline RL and OPE](offline-and-ope.en.md) estimates a new policy's performance with whole-trajectory importance weights: with enough data and accurate behavior probabilities it is unbiased, but over a long horizon the weight is a long product of ratios and the variance becomes unusable. Without collecting new data, how else can the variance come down? **Do not multiply ratios you do not need; if you have a value model, use it to cancel noise rather than to replace the data.** At the end we take a different route: solving for the value function directly with linear features.

## Where trajectory weights waste effort

Trajectory IS multiplies each trajectory's return $R_i$ by the whole trajectory's weight $w_i$ (the formula is in [Offline RL and OPE](offline-and-ope.en.md) and is not re-derived here). The problem: the reward at step 0 is also multiplied by the action ratios of steps 1, 2, and so on. Those actions happen after the reward and cannot affect it, yet they add real noise to it.

## Per-decision importance sampling: the reward at step $t$ only needs ratios up to $t$

Per-decision importance sampling (PDIS) multiplies each reward only by the action ratios up to and including its own step:

$$
\hat J_{\rm PDIS}=\frac1N\sum_{i=1}^N\sum_{t=0}^{T-1}\gamma^t\rho^i_{0:t}\,r^i_t,\qquad
\rho^i_{0:t}=\prod_{k=0}^{t}\frac{\pi(a^i_k\mid s^i_k)}{\mu(a^i_k\mid s^i_k)}.
$$

Why does dropping the later ratios add no bias? Given the history up to step $k$, when actions are drawn from the behavior policy $\mu$, the ratio's conditional expectation is $\sum_a\mu(a\mid s)\,\pi(a\mid s)/\mu(a\mid s)=1$ (provided every action $\pi$ takes is also taken by $\mu$). Multiplying by something with conditional mean 1 leaves the expectation unchanged and only adds noise. Theorem 1 of [Precup, Sutton, and Singh (2000)](http://incompleteideas.net/papers/PSS-00.pdf) proves the per-decision estimator unbiased and consistent.

Compute variances on a two-step example. Each step has the same state and two actions, A and B; choosing A earns 1 point on that step and B earns 0; no discounting. The behavior policy picks each action 50% of the time; the target policy picks A with probability 0.8. So A's ratio is $0.8/0.5=1.6$, B's is $0.2/0.5=0.4$, and the true value is $J(\pi)=0.8+0.8=1.6$. Under the behavior policy, the 4 trajectories each occur with probability 1/4:

| Trajectory | Return | Whole-trajectory weight | Trajectory IS value | Per-decision IS value |
| --- | --- | --- | --- | --- |
| AA | 2 | $1.6\times1.6=2.56$ | 5.12 | $1.6\times1+2.56\times1=4.16$ |
| AB | 1 | $1.6\times0.4=0.64$ | 0.64 | $1.6\times1+0.64\times0=1.6$ |
| BA | 1 | $0.4\times1.6=0.64$ | 0.64 | $0.4\times0+0.64\times1=0.64$ |
| BB | 0 | 0.16 | 0 | 0 |

Both columns average 1.6, so both are unbiased; the per-trajectory variance drops from 4.20 to 2.51. The difference comes from trajectories like AB: the 1 point earned at step 0 is shrunk to 0.64 by trajectory IS, because step 1 chose B, which the target policy dislikes; per-decision IS looks only at step 0's ratio and gives it 1.6.

The improvement has limits. When only the last step has a reward, the two estimators are identical, and per-decision IS is not guaranteed to have lower variance in every problem. Long horizons still hurt: in a trajectory that picks A for 10 steps, the reward at step 9 is multiplied by $1.6^{10}\approx110$.

## Weighted per-decision: normalize each step separately

As with self-normalized IS, you can divide the weights at each time step by the sum of that step's weights across trajectories:

$$
\hat J_{\rm WPDIS}=\sum_{t=0}^{T-1}\gamma^t\,\frac{\sum_i\rho^i_{0:t}\,r^i_t}{\sum_i\rho^i_{0:t}}.
$$

Each step's estimate is a weighted average of observed rewards, so it never leaves the reward range. Suppose an unlucky log of 3 trajectories: AA, AA, BB. Per-decision IS gives $(4.16+4.16+0)/3\approx2.77$; the weighted version gives $3.2/3.6\approx0.89$ at step 0 and $5.12/5.28\approx0.97$ at step 1, about 1.86 in total, closer to the true 1.6. The price is bias with finite samples. Precup et al. also give a weighted per-decision version and note that it is consistent but biased.

## Doubly robust: work it out on a one-step bandit first

Another way to cut variance is to bring in a value model $\hat Q$. In the one-step case, the doubly robust (DR) estimator of [Dudík, Langford, and Li (2011)](https://arxiv.org/abs/1103.4601) is:

$$
\hat V_{\rm DR}=\sum_a\pi(a\mid s)\hat Q(s,a)+\frac{\pi(a_i\mid s)}{\mu(a_i\mid s)}\Big(r_i-\hat Q(s,a_i)\Big).
$$

The first term is the model's own guess (the direct method); the second uses the importance weight to correct the model's residual on this sample. If $\hat Q$ is correct, the residual has mean 0, so the correction averages to 0 whether or not the weights are right; if the weights are correct, the correction cancels the model's bias in expectation. If either one is right, the estimate is unbiased; that is what "doubly robust" means.

Reuse the bandit from the [Offline RL note](offline-and-ope.en.md) with a bit of noise: the left reward is always 1; the right reward is 2 or 4 with equal probability, mean 3. The behavior policy goes left 90% and right 10%; the target policy picks each 50%, so the true value is $0.5\times1+0.5\times3=2$. Variances below are per single sample; $\hat Q$ is assumed to come from a separate dataset and is held fixed.

| Estimator | Behavior probabilities | $\hat Q$ | Expectation | Variance |
| --- | --- | --- | --- | --- |
| Direct method, $\hat Q$ only | Not used | Wrong: right estimated as 2 | 1.5 | 0 |
| IS | Correct | Not used | 2 | 21.28 |
| IS | Wrong: assumed 50% each | Not used | 1.2 | 0.46 |
| DR | Correct | Wrong: right estimated as 2 | 2 | 4.75 |
| DR | Correct | Correct | 2 | 2.5 |
| DR | Wrong: assumed 50% each | Correct | 2 | 0.1 |
| DR | Wrong | Wrong | 1.6 | 0.19 |

Here is how row 4 arises. The model guesses $0.5\times1+0.5\times2=1.5$. Draw left: the residual is $1-1=0$ and the estimate is 1.5. Draw right: the weight is 5; with reward 2 the residual is 0 and the estimate is 1.5, with reward 4 the residual is 2 and the estimate is $1.5+5\times2=11.5$. The average is exactly 2. On right samples IS gives 10 or 20 while DR gives 1.5 or 11.5: the model absorbs most of the value and the weight only amplifies the residual. With a fully correct $\hat Q$, the remaining variance of 2.5 comes entirely from the right reward's own noise amplified by the weight 5: $0.1\times5^2\times1=2.5$.

The last row is a reminder: if both are wrong, DR is biased too. Row 6, "wrong probabilities but a perfect model", is rare in practice because $\hat Q$ is almost never exactly right.

## Multiple steps: use $\hat Q$ as a control variate at every step

[Jiang and Li (2016)](https://arxiv.org/abs/1511.03722) extend this to sequential decisions with a backward recursion:

$$
V^{(t)}_{\rm DR}=\hat V(s_t)+\rho_t\Big(r_t+\gamma V^{(t+1)}_{\rm DR}-\hat Q(s_t,a_t)\Big),\qquad V^{(T)}_{\rm DR}=0,
$$

where $\rho_t=\pi(a_t\mid s_t)/\mu(a_t\mid s_t)$ is only that step's ratio and $\hat V(s)=\sum_a\pi(a\mid s)\hat Q(s,a)$. With known behavior probabilities it is unbiased; the closer $\hat Q$ is to the true Q, the more the remaining variance comes from the randomness of rewards and transitions themselves. The paper also gives a variance lower bound for the problem and shows DR can match it in some settings.

A handy special case: set $\hat Q\equiv0$, and the unrolled recursion is per-decision IS. [Thomas and Brunskill (2016)](https://proceedings.mlr.press/v48/thomasa16.html) write the same estimator in a non-recursive control-variate form and replace the weights with per-step normalized ones, giving weighted DR (biased but consistent); they also propose MAGIC, which mixes model-based and importance-sampling estimates automatically, and report lower mean squared error in their own experiments.

## No product over time: weight by state-distribution ratios

All the methods so far multiply "action ratios along time". Another route asks: how many times more often does the target policy visit a given $(s,a)$ than the data does? With the discounted occupancy $d^\pi(s,a)=(1-\gamma)\sum_t\gamma^t\Pr(s_t=s,a_t=a)$:

$$
J(\pi)=\frac1{1-\gamma}\,\mathbb E_{(s,a,r)\sim d^{\mathcal D}}\big[w(s,a)\,r\big],\qquad
w(s,a)=\frac{d^\pi(s,a)}{d^{\mathcal D}(s,a)} .
$$

When the data come from $\mu$, $w$ splits into one state ratio times one action ratio: $\frac{d^\pi(s)}{d^\mu(s)}\cdot\frac{\pi(a\mid s)}{\mu(a\mid s)}$. The weight is no longer a product over time and does not grow exponentially with the horizon.

Back to the two-step example. There the state does not depend on actions, so every step's state ratio is 1; with a finite horizon the ratio is taken per time step, so each reward is multiplied only by its own step's action ratio. The 4 trajectories give 3.2, 1.6, 1.6, and 0; the mean is still 1.6 and the variance falls to 1.28 (per-decision IS gave 2.51, trajectory IS 4.20). Here the state ratio happens to be known; in general it must be estimated from data, an error in it introduces bias, and the data still have to cover the states the target policy visits.

How to estimate the ratio is the core of these methods:

- [Liu et al. (2018)](https://arxiv.org/abs/1810.12429) apply importance sampling directly to stationary state distributions and estimate the density ratio from behavior trajectories, to escape the variance explosion of long horizons;
- [Xie, Ma, and Wang (2019)](https://arxiv.org/abs/1906.03393) work in a finite-horizon, nonstationary setting, recursively estimate the target policy's state marginal at each step, and prove an error bound that grows only polynomially with the horizon;
- [DualDICE (Nachum et al., 2019)](https://arxiv.org/abs/1906.04733) does not even need to know the behavior policy. Its starting point is a small fact: minimizing $\tfrac12d^{\mathcal D}x^2-d^\pi x$ at each $(s,a)$ gives $x=d^\pi/d^{\mathcal D}$. For example, with $d^{\mathcal D}=0.25$ and $d^\pi=0.5$, setting the derivative $0.25x-0.5=0$ gives $x=2$. A change of variables then replaces the unavailable expectation under $d^\pi$ with an expectation over initial states; the paper proves that the Bellman residual of the resulting problem's optimum is exactly the desired ratio.

As of October 2026, applying these estimators to offline evaluation of LLMs or agents is still changing quickly: one "action" may be a whole passage of text, probability ratios are extreme, and behavior probabilities are often unavailable. This note treats none of those practices as settled; the estimators above are themselves established results.

## LSTD: solve for the TD fixed point with linear features

A different angle: no weighting at all, just solve for the value function from fixed data. Let $V(s)\approx\phi(s)^\top w$ with $k$-dimensional features $\phi$. Require the TD error to average zero along the feature directions, $\sum_i\phi(s_i)\big(r_i+\gamma\phi(s'_i)^\top w-\phi(s_i)^\top w\big)=0$, and rearrange into a linear system:

$$
A=\sum_i\phi(s_i)\big(\phi(s_i)-\gamma\phi(s'_i)\big)^\top,\qquad
b=\sum_i\phi(s_i)\,r_i,\qquad w=A^{-1}b .
$$

This is least-squares TD (LSTD) from [Bradtke and Barto (1996)](https://all.cs.umass.edu/pubs/1995_96/bradtke_b_ML96.pdf). They prove probability-one convergence with linear approximation; each step costs more than TD, but it uses the data more fully and has no learning rate to tune. For terminal states, set $\phi(s')$ to 0.

A two-state loop: going from state 1 to 2 earns 0, going from 2 back to 1 earns 1, $\gamma=0.9$, and the data contain one transition of each kind. The true values satisfy $V_1=0.9V_2$ and $V_2=1+0.9V_1$, giving $V=(4.737,\,5.263)$.

First use one-hot features $\phi(1)=(1,0)$ and $\phi(2)=(0,1)$:

| Quantity | Transition 1 ($1\to2$, $r=0$) | Transition 2 ($2\to1$, $r=1$) | Sum |
| --- | --- | --- | --- |
| $\phi(s)\big(\phi(s)-\gamma\phi(s')\big)^\top$ | $\begin{bmatrix}1&-0.9\\0&0\end{bmatrix}$ | $\begin{bmatrix}0&0\\-0.9&1\end{bmatrix}$ | $A=\begin{bmatrix}1&-0.9\\-0.9&1\end{bmatrix}$ |
| $\phi(s)\,r$ | $(0,0)$ | $(0,1)$ | $b=(0,1)$ |

Solving $Aw=b$ gives $w=(4.737,\,5.263)$, exactly the true values. With one-hot features, LSTD amounts to solving the Bellman equation with transitions estimated from the data.

Now switch to a one-dimensional feature $\phi(1)=1$, $\phi(2)=2$, which can only express "state 2 is worth twice state 1". $A=1\times(1-0.9\times2)+2\times(2-0.9\times1)=1.4$, $b=2$, $w\approx1.43$, so $V\approx(1.43,\,2.86)$. Check the TD errors: state 1 gives $0.9\times2.86-1.43\approx1.14$, state 2 gives $1+0.9\times1.43-2.86\approx-0.57$, and the feature-weighted sum is $1\times1.14+2\times(-0.57)=0$. An equally weighted least-squares fit to the true values with the same feature gives $w\approx3.05$, that is $(3.05,\,6.11)$. **LSTD solves for the TD fixed point, not the best fit to the true values; when the features cannot express the truth, both are wrong, and they differ.** This is the same point as in the [Fitted Q note](fitted-q.en.md): projection and the Bellman update use different yardsticks.

Each sample updates $A$ in $O(k^2)$, and the final solve costs $O(k^3)$ once. With too few samples or redundant features, $A$ becomes singular or ill-conditioned; in practice a small ridge term is common.

## LSPI: policy iteration on the same batch, over and over

LSTD estimates $V$ for the policy behind the data, and improving the policy would still require a model. LSPI from [Lagoudakis and Parr (2003)](https://jmlr.org/papers/v4/lagoudakis03a.html) switches to state-action features $\phi(s,a)$: LSTDQ replaces $\phi(s)$ above with $\phi(s,a)$ and $\phi(s')$ with $\phi(s',\pi(s'))$, estimating Q for the current policy $\pi$; then it sets the new policy $\pi'(s)=\arg\max_a\phi(s,a)^\top w$ and repeats on **the same batch of samples**. The paper stresses that it is fully off-policy, reuses the same data each iteration, and has no learning rate; it also notes that LSTDQ's result depends on how samples are distributed over $(s,a)$. The paper reports learning to balance an inverted pendulum and a bicycle from a small number of random-action trials.

Offline, the trouble is the $\arg\max$. Suppose there is one state $s$ with two actions, "cautious" and "aggressive", and the log contains only "cautious": each time it costs 1 point and returns to $s$, with $\gamma=0.9$. With one-hot features, $(s,\text{aggressive})$ never appears, its row in $A$ is all zeros, and the matrix is not invertible; with a tiny ridge term, its weight is set to 0.

- Evaluate the "cautious" policy: $w_{\text{cautious}}\approx-10$, $w_{\text{aggressive}}=0$. One improvement step: $\arg\max(-10,\,0)$ picks "aggressive".
- Evaluate the "aggressive" policy: $w_{\text{cautious}}\approx-1$ (cautious once, then aggressive from there), and $w_{\text{aggressive}}$ is still 0. The policy stays at "aggressive".

LSPI settles on an action it has never tried, and its "value 0" is just the ridge default. If all rewards were positive, the same default would make the unseen action look worst instead; the conclusion is set by the default, not by the data. Online, the agent would try "aggressive" once and correct itself; offline, there is no such chance. This is the support problem from [Offline RL and OPE](offline-and-ope.en.md), and the max over unsupported actions from [Fitted Q](fitted-q.en.md).

## One comparison table

| Estimator | Needs behavior probabilities? | Needs a value function or model? | Bias | Variance | Typical failure |
| --- | --- | --- | --- | --- | --- |
| Trajectory IS | Yes | No | Unbiased with accurate probabilities and enough coverage | Grows exponentially with the horizon | A few trajectories' weights dominate the estimate |
| Self-normalized IS | Yes | No | Biased with finite samples, consistent | Lower than IS | Still controlled by extreme weights |
| Per-decision IS | Yes | No | Unbiased | Often lower than trajectory IS, still grows with the horizon | Weights on late rewards explode over long horizons |
| Weighted per-decision IS | Yes | No | Biased, consistent | Lower; each step stays within the reward range | Leans toward the behavior policy with few samples |
| Direct method (FQE, model) | No | Yes | Depends on model error | Low | Systematic bias in extrapolated regions |
| DR | Yes; $\hat Q$ covers for inaccurate probabilities | Yes | Unbiased if either one is right | Lower as $\hat Q$ improves | Biased when both are wrong; still affected by heavy-tailed weights |
| Weighted DR, MAGIC | Yes | Yes | Biased, consistent | Usually lower | Size of the bias is hard to quantify |
| State-distribution ratios (Liu et al., MIS, DualDICE) | Liu et al. and MIS yes, DualDICE no | Must estimate a ratio function | Biased if the ratio is wrong | No exploding product over time | Ratio is hard to estimate; insufficient coverage |
| LSTD / LSTDQ | LSTD needs data from the evaluated policy, LSTDQ does not | Linear features | Converges to the TD fixed point, not the best fit | No learning rate; can be ill-conditioned with few samples | Features cannot express the truth; unsupported actions are decided by defaults |

## Where this note stops

This note covers the structure of the estimators and hand-computed examples; it does not cover OPE confidence intervals or lower-bound theory. Every estimator assumes the log covers where the target policy goes and that observations do not omit a variable affecting both actions and outcomes; check those first, in the order given in [Offline RL and OPE](offline-and-ope.en.md). The basic importance-sampling derivation is in [Policy gradients](policy-gradients.en.md), and projection under function approximation is in [Fitted Q](fitted-q.en.md).
