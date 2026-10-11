# The score improved. What does that actually establish?

[中文](metric-robustness.md) · **English**

A new model gains three Recall points. Before calling it an improvement: was the candidate pool identical? Were both models evaluated on the same queries? Did a subgroup regress? Would another seed produce the same result?

Start with a few small calculations, then choose a statistical method that fits the question. All numbers here are teaching data, not model measurements. For the intuition, read [population mixtures](#population-mix) and [two ways to get the same gain](#paired-binary); for runnable code, continue to the [paired bootstrap](#paired-bootstrap).

## 1. The same Recall name can hide a different task

Let $P$ be the labeled positive set for a query and $R_K$ its top-$K$ results. Standard Recall@K is:

$$
\mathrm{Recall@K}=\frac{|P\cap R_K|}{|P|},\qquad |P|>0.
$$

With eight known positives and three positives in the top three, Recall@3 is $3/8$, not 1. Some implementations replace the denominator with $\min(|P|,K)$ and return 1. That can be a separately named normalized measure, but should not be compared silently with standard Recall.

| Check first | Why it changes the conclusion |
| --- | --- |
| How are queries with no positives handled? | Exclusion, zero-filling, and separate reporting produce different averages; report coverage |
| Average per query or pool hit counts? | Macro gives equal weight to queries; micro favors queries with more positives |
| How was the pool built? | Full-corpus, randomly sampled, and hard-negative pools are different tasks |
| Where did positives come from? | Exposed clicks, human judgments, and teacher labels measure different things |

With one positive and sampled comparisons, Recall@K becomes a hit indicator. Under random ranking with $n$ comparisons, its expectation is $\min(K,n+1)/(n+1)$. At $K=10$, 19 comparisons give 50%; 999 give 1%. This says nothing about model quality. Pool construction alone changes difficulty.

Some comparisons may also be relevant but unlabeled. A model that promotes them may lose measured Recall. Report the result as Recall under the specified pool and labels, not as a direct measure of real satisfaction.

## 2. Whose proportions define the average? {#population-mix}

A fictional evaluation contains 90% established users and 10% new users:

| Population | Old model | New model | Change |
| --- | --- | --- | --- |
| Established users | 80% | 85% | +5 percentage points |
| New users | 40% | 30% | −10 percentage points |
| Weighted 90% / 10% | 76% | 79.5% | +3.5 percentage points |

Overall performance improves while new users regress. Both statements are true. For a target population split equally between the groups, the old model scores 60% and the new one 57.5%: the ordering reverses.

```text
10% new users: old 76.0% → new 79.5%  (+3.5 percentage points)
50% new users: old 60.0% → new 57.5%  (−2.5 percentage points)
Within-group performance stays identical. The target population changes.
```

Do not select weights because they make the conclusion attractive. Define the observed population, target deployment population, and protected slices in advance. The weights $w_g$ in $\bar m=\sum_g w_gm_g$ are part of the question.

Matched sampling can balance measured conditions without turning populations into randomized controls. Matching positive counts may leave task difficulty unmatched. A high score in a small slice is not, by itself, a causal effect of a design choice.

## 3. Could the difference be noise? Start with paired examples {#paired-comparison}

Run both models on the same queries and record $d_i=m_i^{\mathrm{new}}-m_i^{\mathrm{old}}$. Inspect the distribution of differences before its average. Comparing means from unrelated samples also mixes in changes in query difficulty.

### Both go from 70% to 80%. What is different? {#paired-binary}

For pass/fail outcomes, start by separating four kinds of pairs. These two fictional comparisons each contain 200 questions, with an old and new result for every question:

<div class="worked-table" markdown="1">

| Outcome | A | B |
| --- | --- | --- |
| Both correct | 100 | 140 |
| Old correct, new wrong | 40 | 0 |
| Old wrong, new correct | 60 | 20 |
| Both wrong | 0 | 40 |
| Accuracy | 70% → 80% | 70% → 80% |

</div>

A fixes 60 questions but loses 40 previously correct answers. B fixes 20 with no observed regressions in this sample. **Both gain a net 20 questions, but the changes are distributed differently.** Keeping only 70% → 80% loses that information.

McNemar's test asks whether these two fixed models have equal accuracy using their paired binary outcomes. It considers the discordant pairs: how many improve and how many regress. B's changes all favor improvement; A has more changes in both directions. The test needs assumptions such as independent question pairs drawn from the same target distribution and a fixed scoring rule. A hundred near-duplicate questions from one user are not a hundred independent pieces of evidence.

<details markdown="1">
<summary>Work it out: why isn't the net gain of 20 enough?</summary>

Let $g$ count gains and $\ell$ count regressions. Both accuracy differences are $(g-\ell)/200=0.10$, but the number of discordant pairs, $g+\ell$, is 100 in A and 20 in B.

Under the null of equal accuracy and the sampling assumptions above, conditioning on the number of discordant pairs gives $G\sim\mathrm{Binomial}(g+\ell,1/2)$. If neither model is favored, a discordant result is equally likely to point in either direction. The symmetric binomial distribution gives the two-sided exact p-value:

$$
p=\min\left(1,\;2\sum_{j=0}^{\min(g,\ell)}\binom{g+\ell}{j}2^{-(g+\ell)}\right).
$$

This small-table calculation uses only Python's standard library. Inputs are counts: negative numbers, fractions, and booleans are rejected.

```python
from math import comb

def exact_mcnemar(gained, lost):
    if any(type(count) is not int or count < 0 for count in (gained, lost)):
        raise ValueError("Counts must be nonnegative integers")
    disagreements = gained + lost
    if disagreements == 0:
        return 1.0
    tail_count = sum(comb(disagreements, count)
                     for count in range(min(gained, lost) + 1))
    return min(1.0, 2 * tail_count / (2 ** disagreements))

comparison_a = exact_mcnemar(60, 40)
comparison_b = exact_mcnemar(20, 0)
assert abs(comparison_a - 0.0568879336409808) < 1e-12
assert comparison_b == 2 / (2 ** 20)
print(f"A: {comparison_a:.6f}; B: {comparison_b:.8f}")
```

The results are approximately 0.056888 for A and 0.00000191 for B. The same gain provides different evidence against equal accuracy under this test. A p-value is not the probability that the new model is useless, nor is it an effect size. B's smaller value does not mean its accuracy gain is larger. The [statsmodels McNemar documentation](https://www.statsmodels.org/stable/generated/statsmodels.stats.contingency_tables.mcnemar.html) distinguishes the exact binomial test from the chi-squared approximation; [SciPy's two-sided binomtest](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.binomtest.html) provides another check.

With no discordant pairs, the code returns 1 by convention. Observing no differences does not establish equivalence on every task. Neither does the test decide whether to ship: critical regressions and extra latency still matter.

</details>

### For scores beyond pass/fail, try a paired bootstrap {#paired-bootstrap}

Per-query Recall can be 0.4 or 0.6; those values are not binary counts for McNemar's test. We still want the average difference, using a different method to examine its sensitivity to which examples were sampled.

This minimal paired bootstrap resamples queries while preserving each old/new pair. It estimates **uncertainty from test-sample composition, conditional on these two sets of model outputs**.

```python
import random
from statistics import mean

old_scores = [0.6, 0.6, 0.5, 0.5, 0.4, 0.4, 0.3, 0.3]
new_scores = [0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.6]
differences = [new - old for old, new in zip(old_scores, new_scores)]
generator = random.Random(7)
estimates = sorted(mean(generator.choices(differences, k=len(differences)))
                   for _ in range(4000))
lower, upper = estimates[100], estimates[3899]
assert abs(mean(differences) - 0.05) < 1e-12
assert lower <= 0 <= upper
print(round(mean(differences), 3), round(lower, 3), round(upper, 3))
```

The mean gains 0.05, but this eight-example interval still includes zero; it does not establish a stable improvement. Nor does it establish equivalence: the data may be insufficient to distinguish the models. This is an approximate percentile-interval demonstration. See [SciPy bootstrap](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html) for pairing and interval methods, and inspect small-sample, skewed, or degenerate cases.

When one user contributes many correlated queries, resample an appropriate cluster such as the user, then compute the preselected query-weighted or user-weighted statistic. Resampling log rows independently can mistake correlated observations for additional independent evidence.

Bootstrap does not measure training variance for you. Comparing training methods also needs independently trained seeds. Rerunning one checkpoint is not retraining it. If the judge is stochastic, inspect scoring repeatability separately.

## 4. Inspect twenty metrics and some will probably rise

Slices help find problems, but selecting the largest gain from many comparisons can overstate effects. Prespecify a primary metric, regression guardrails, and a small set of motivated slices. Treat other discoveries as exploratory and confirm them on independent held-out data.

Not every result belongs in a significant/not-significant binary. Report effect size, interval, sample size, and practical cost. A tiny statistically significant gain may not justify double the latency; failure to reach significance does not prove a method has no value.

## 5. What if the evaluator changed?

Judge versions, prompts, reference answers, and task distributions affect LLM scores. Longer new answers may be more complete, or the judge may simply prefer length. Recheck fixed human-reviewed anchors and inspect errors by task rather than relying only on overall agreement.

Do not use an evaluation set indefinitely as development data. Record which examples informed rubric, threshold, or model changes, and keep a final subset out of those decisions. Sharing a training teacher and evaluator is not automatically invalid, but their agreement is not independent evidence; external references are needed to test shared blind spots.

See [LLM-as-a-Judge](llm-as-a-judge/README.en.md) for concrete biases. If the failure could be in retrieval, context selection, or generation, use the [evaluation stack](evaluation-stack.en.md) to locate it first.

For a runnable project, continue to [evaluation reports and CI](../practice/web-lab/eval-report.en.md). Its gate catches regressions against rules chosen in advance; a green CI result does not certify that the model is better overall.
