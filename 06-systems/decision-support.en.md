# LLMs for decision support: helping people decide without deciding for them

[中文](decision-support.md) · **English**

> Reading time: ~12 min · Draft, pending review

A support lead has to decide whether a late cancellation qualifies for an exceptional refund. The model reads the order and the policy, says "recommend deny, high confidence", and attaches the relevant clause; a person clicks the final button. With the model added, will the decision beat both the person alone and the model alone? **Not necessarily. For the team to beat the stronger of the two, three things must hold at once: the model's confidence signal separates the cases where it is reliable from those where it is not; on the cases where the model is unreliable, the person really is better than the model; and the interface leads the person to rely on the model according to that signal. In a number of experiments, adding explanations made people follow the AI more often whether it was right or wrong.**

> **Draft, pending review.** The site owner has not reviewed this note yet; facts, emphasis and wording may change. Check the primary sources linked in the text before relying on it.

## The setting: a person decides; the model recommends, summarises or critiques

Here the LLM takes no action; it only influences a decision a person makes. It can play three roles:

- **Recommend**: give a conclusion and a confidence level, such as "deny, high confidence";
- **Summarise evidence**: list the relevant clauses, order records and similar cases without concluding;
- **Critique**: the person first writes down a decision, and the model looks for holes, counterexamples or clauses the person missed.

Which actions need a person's approval, how to bind an approval to a specific operation, and when to hand off to a human are covered in [Human-in-the-Loop](human-in-the-loop.en.md). This note is about something else: how the model's output changes a person's judgement, and how to measure that change.

Define "better" in advance. Whether a decision was right is judged by a standard you can check afterwards, such as the outcome of a policy audit. The two kinds of error may also cost different amounts: wrongly approving one refund is not the same loss as wrongly refusing a long-standing customer, and then you compare expected loss rather than accuracy alone.

## What the research measures

| Concept | Meaning | What you need to measure it |
| --- | --- | --- |
| Complementary performance | Team accuracy is higher than the person alone and higher than the AI alone | Three results on the same cases: person alone, AI alone, person plus AI |
| Augmentation | The team beats the person alone, but not necessarily the AI | Two results: person alone and person plus AI |
| Over-reliance | The AI was wrong and the person followed it anyway | Per case: the AI's advice, the person's final decision and the ground truth |
| Under-reliance | The AI was right and the person overrode it | Same as above |
| Appropriate reliance | Trusting the AI when it deserves trust and not otherwise | Also the person's initial judgement before seeing the AI |

Work on appropriate reliance often cites the review of trust in automation by [Lee and See (2004)](https://doi.org/10.1518/hfes.46.1.50_30392): trust shapes whether people rely on automation, and that trust need not match how well the system actually performs. [Schemmer et al. (IUI 2023)](https://arxiv.org/abs/2302.02187) split it into two computable ratios: RAIR is, among cases where the person's initial judgement was wrong and the AI was right, the share that ended up correct; RSR is, among cases where the initial judgement was right and the AI was wrong, the share where the person kept their own answer. Both need an initial judgement, so they can only be computed in a "decide first, then see the AI" workflow. The tendency to over-rely on automation is often called automation bias; [Goddard et al. (2012)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3240751/) ran a systematic review focused on clinical decision support that included 74 studies, and the mitigators it lists include training, emphasising user accountability, where the advice sits on the screen, confidence levels updated per case, and giving information rather than a recommendation.

**Complementary performance needs the right conditions.** [Bansal et al. (CHI 2021)](https://arxiv.org/abs/2006.14779) point out that in earlier studies, gains from explanations appeared only when the AI alone outperformed both the person and the best team. So they deliberately chose tasks where the AI and people were similarly accurate: two review-sentiment datasets, where the AI was 84% accurate on the selected examples, and LSAT logic questions, where the AI scored 65% against about 67% for people in a pilot. The studies involved 1626 crowd participants. Every person-plus-AI condition reached complementary performance, but adding explanations did not do significantly better than simply showing the AI's confidence; explanations made people more likely to accept the AI's recommendation, whether it was right or wrong.

The [meta-analysis by Vaccaro, Almaatouq and Malone](https://www.nature.com/articles/s41562-024-02024-1) (Nature Human Behaviour, October 2024) pooled 106 experiments and 370 effect sizes published between January 2020 and June 2023. On average, person plus AI beat the person alone (Hedges' g = 0.64) but did worse than the stronger of the two (g = −0.23). Losses concentrated in tasks that involve choosing among a finite set of options; when the AI alone outperformed people, the combination did worse on average (g = −0.54), and when people alone outperformed the AI, the combination did better on average (g = 0.46). In their data, neither explanations nor displaying the AI's confidence was a significant moderator. The authors also flag possible publication bias and large differences in study designs.

## Work it through: AI at 80%, person at 70%

Everything below is a teaching assumption with numbers chosen to be easy to compute, not a measurement.

Split the cases by the confidence the AI displays: the high-confidence group $H$ is 60% of cases, where the AI is 95% accurate; the low-confidence group $L$ is 40%, where the AI is 57.5% accurate. Overall AI accuracy is $0.6\times0.95+0.4\times0.575=0.80$. The person alone is 70% accurate in both groups. The decision is binary (approve or deny).

Let $P(g)$ be the share of group $g$, $a_g$ the AI's accuracy in that group, $h_g$ the person's accuracy alone, and $r_g$ the share of cases in that group where the person adopts the AI's advice. Also assume that within a group, whether the person adopts is unrelated to whether the AI is right on that case, that is, the person cannot tell which advice in the group is wrong. Then

$$
\mathrm{Acc}_{\rm team}=\sum_{g}P(g)\,\big[r_g\,a_g+(1-r_g)\,h_g\big].
$$

| Reliance policy | $r_H$, $r_L$ | Team accuracy |
| --- | --- | --- |
| Person only | 0, 0 | 0.70 |
| AI only | 1, 1 | 0.80 |
| Follow when confident, decide alone when not | 1, 0 | $0.6\times0.95+0.4\times0.70=0.85$ |
| Same, but also follow half the low-confidence advice (over-reliance) | 1, 0.5 | $0.57+0.4\times(0.5\times0.575+0.5\times0.70)=0.825$ |
| Same, but also override a third of the confident advice (under-reliance) | 2/3, 0 | $0.6\times(\tfrac23\times0.95+\tfrac13\times0.70)+0.28=0.80$ |
| Follow the confidence signal, but the signal carries no information (AI at 80% in both groups) | 1, 0 | $0.6\times0.80+0.4\times0.70=0.76$ |

In the third row the team reaches 85%, beating both: in group $L$ the person is more accurate than the AI (70% against 57.5%), and the confidence signal picks out exactly that group. **The best rule is to follow whoever is more accurate in each group; for the team to beat the AI, there must be a group where the person beats the AI, and the signal must identify it.** With over-reliance the team keeps 82.5%, losing half the gain; with under-reliance it falls back to 80%, as if no person were involved; if the confidence signal carries no information, the same rule gives only 76%, **below the AI alone**. That last case is not rare: as shown below, the confidence LLMs state in words is often inaccurate.

This points the same way as the meta-analysis: when the AI is stronger on average, combinations often do worse. It also shows why Bansal et al. chose tasks of similar accuracy: people must beat the AI on some cases for the combination to have room to gain.

The formula leaves out two things. First, a person can sometimes spot wrong advice within a group, making $r_g$ high when the AI is right and low when it is wrong; that is what explanations and evidence aim for, but they can also backfire, which is exactly what Bansal et al. saw when explanations increased acceptance regardless of correctness. Second, "agreement" seen in production is not "reliance". In group $L$, even when the person judges completely independently, $0.575\times0.70+0.425\times0.30=0.53$ of cases agree with the AI by coincidence (in a binary choice, both being wrong also produces agreement). To separate real reliance from coincidental agreement, you need the person's initial judgement.

## Five design levers and their evidence

### Show uncertainty

[Kim et al. (FAccT 2024)](https://arxiv.org/abs/2405.00623) ran a pre-registered experiment (N = 404) in which participants answered medical questions with access to a fictional LLM-powered search assistant. When the assistant said, in the first person, "I'm not sure, but...", participants followed it less and were more accurate; general phrasings such as "It's not clear, but..." had weaker effects that did not reach statistical significance. [Steyvers et al. (Nature Machine Intelligence, 2025)](https://www.nature.com/articles/s42256-024-00976-7) found that with default explanations, people overestimate how accurate LLM answers are; longer explanations raised people's confidence even when the answers were no more accurate; and adjusting the wording of explanations to match the model's internal confidence narrowed that gap.

There is evidence the other way too. [Zhou et al. (ACL 2024)](https://arxiv.org/abs/2401.06730) found that models rarely volunteer uncertainty; when asked to state their confidence they lean overconfident, with an average of 47% of their "confident" answers being wrong; and users rely on them heavily whether or not the answers carry certainty markers. In [Bo et al. (CHI 2025)](https://arxiv.org/abs/2412.15584), token-level uncertainty highlighting had the smallest effect on reliance of the three interventions they tested. The meta-analysis also found no significant average effect of displaying confidence. So first test whether the confidence signal is accurate on your data, then decide whether to show it and in what words.

### Show evidence and sources

The pre-registered experiment by [Kim et al. (CHI 2025)](https://arxiv.org/abs/2502.08554) (N = 308) found that giving explanations increases reliance on LLM answers, correct and incorrect alike; but when sources are provided, or when the explanation contains inconsistencies, reliance on incorrect answers drops. [Si et al. (NAACL 2024)](https://arxiv.org/abs/2310.12558) had 80 crowd workers fact-check claims: reading LLM explanations was faster than using a search engine with similar accuracy, but people over-relied on the explanations when they were wrong; having the model explain both why a claim is true and why it is false reduced this, but did not significantly beat the search engine; and showing search results together with the LLM explanation did no better than search results alone.

[Vasconcelos et al. (CSCW 2023)](https://arxiv.org/abs/2212.06823) ran 5 experiments (N = 731) on a maze task with a simulated AI fixed at 80% accuracy. The harder the task and the easier the explanation was to check, the more explanations reduced over-reliance; raising the bonus for correct answers also reduced over-reliance. Together: **evidence helps only when checking it is cheaper than redoing the task yourself.** A source passage with its location is easier to check than a fluent paragraph of reasons.

### Let the person decide first

[Buçinca et al. (CSCW 2021)](https://arxiv.org/abs/2102.09692) tested three "cognitive forcing" designs on a task of replacing a high-carbohydrate ingredient in a meal (N = 199, simulated AI at 75% accuracy): showing the AI's suggestion only on click, answering first and then seeing the AI, and showing the suggestion only after a 30-second wait. On cases where the AI was wrong, these designs led people to follow it less than simple explainable-AI interfaces did, but did not eliminate over-reliance; the three designs did not differ significantly from each other; the designs that reduced over-reliance most were also the ones participants liked least; and participants who enjoy effortful thinking benefited more.

[Fogliato et al. (FAccT 2022)](https://arxiv.org/abs/2205.09696) asked 19 veterinary radiologists to read X-rays. Those who recorded a provisional judgement before seeing the AI agreed with it less whether or not the AI was right, also rated it less useful, and did not take longer overall. So deciding first can reduce over-reliance while also increasing under-reliance. Its other benefit is that it records the initial judgement, which is what makes RAIR and RSR computable.

### Critique mode instead of answer mode

[Gajos and Mamykina (IUI 2022)](https://arxiv.org/abs/2202.05402) ran three experiments on nutrition choices: seeing the AI's recommendation and explanation before choosing improved decisions but produced no learning; choosing first and then seeing the recommendation and explanation also improved decisions without learning; giving only the explanation, with no recommendation, and letting people reach their own conclusion improved decisions and produced learning. The Goddard et al. review also lists giving information rather than a recommendation as a mitigator. In a position paper, [Miller (2023)](https://arxiv.org/abs/2302.12389) argues for "evaluative AI": offering evidence for and against the hypotheses a person is considering, instead of an answer to accept or reject; this is an argument, not an experimental result.

The "implicit answer" intervention in Bo et al. (advice that implies the answer without stating it) helped people stick with correct initial judgements on both tasks, at the cost of significantly more time; overall, the three interventions reduced over-reliance but also reduced reliance that would have helped. There is also a risk specific to LLMs: [Sharma et al. (2023)](https://arxiv.org/abs/2310.13548) found that several assistants tend to go along with views the user has already expressed. Critique mode makes the person state their decision first, so before launch, test how often the model actually objects when the person's decision is wrong.

### Abstention and deferral

Learning to defer treats "predict myself or hand off to the expert" as part of what is learned; for example, [Mozannar and Sontag (ICML 2020)](https://arxiv.org/abs/2006.01862) train a classifier together with a rejector that decides when to defer. How a person then handles a deferred case depends on what you tell them: on real conservation data, [Bondi et al. (AAAI 2022)](https://arxiv.org/abs/2112.06751) found that telling the person "the AI chose to defer" while not showing the AI's own prediction significantly improved the person's accuracy.

Back to the example: the rule in the third row amounts to the model abstaining in the low-confidence group and handing those 40% to the person to judge independently. The cost is that all the hardest cases flow to people, so queues and fatigue must be counted too; see the hand-off conditions in [Human-in-the-Loop](human-in-the-loop.en.md).

| Lever | Where evidence is fairly consistent | Cost or open question |
| --- | --- | --- |
| Show uncertainty | First-person uncertainty phrasing reduced following and raised accuracy in one experiment | Stated LLM confidence is often inaccurate; no significant average effect in the meta-analysis |
| Show evidence and sources | Sources reduce reliance on wrong answers; the cheaper the check, the better it works | Fluent explanations by themselves increase reliance, right or wrong |
| Decide first | Less following of wrong advice; the initial judgement gets recorded | Also less adoption of correct advice; participants rate it lower |
| Critique mode | In one study, explanation without a recommendation improved both decisions and learning | Takes longer; the model may simply agree with the user |
| Abstain and defer | People are more accurate when deferral hides the AI's guess | Hard cases pile up on people; queues and workload need managing |

## What to log and evaluate in production

For every case, record at least: what the person saw and in what order, their initial judgement, their final decision, how long it took, and the eventual outcome. Here is a synthetic record:

```text
case_id=demo-203  model=…  prompt=…  ui_variant=decide_first
shown: recommendation=deny  confidence_bin=high  sources=[policy-4.2]
human_initial=approve  human_final=approve  overrode_ai=true
time_to_decide=95s  opened_sources=true  override_reason="system outage prevented on-time cancellation"
outcome (audit after 30 days) = approve_was_correct
```

| Metric | How to compute | Watch out for |
| --- | --- | --- |
| Decision outcome | Share of final decisions that match the later outcome, compared with two baselines: "follow the AI's advice" and "follow the person's initial judgement" | Outcomes arrive late; some outcomes are visible only on the path that was actually taken |
| Override rate (by confidence group) | Share of cases in each group where the person overrode the AI | A low override rate is not necessarily good; it may mean rubber-stamping |
| Reliance calibration | In each group, compare the AI's later accuracy with the share of cases where the person adopted it; compute over-reliance and under-reliance separately | AI errors are few, so estimates have wide intervals |
| RAIR and RSR | As defined above, from the initial judgement, the AI's advice and the ground truth | Only computable in a decide-first workflow |
| Time and workload | Time per case, share of cases where sources were opened, number of deferrals | Slower is not better; too many deferrals create queues |

Three things are easy to get wrong. First, **selective labels**: [Lakkaraju et al. (KDD 2017)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5958915/) use bail to show that whether a defendant returns to court is observed only for people who were released; refunds are similar: if correctness is judged by consequences (for example, whether an approved refund was later abused), a denied request has no "what if we had approved" outcome, so naive comparisons are biased; judging correctness by a policy audit makes this problem smaller. Second, **too few errors**: if the high-confidence group has 600 cases a month and the AI is 95% accurate there, there are only about 30 AI errors; estimating a rate near 50% from 30 cases gives a 95% interval of about $\pm1.96\sqrt{0.5\times0.5/30}\approx\pm0.18$. Third, **randomise interface variants**: the same reviewer using different interfaces over time carries habits across, so group by reviewer and time block and compare with paired methods; see [Controlled comparisons and slices](../07-evaluation/ablation-and-slices.en.md).

For log fields and redaction requirements, see [Agent observability](agent-observability.en.md); these records are also the source for updating rules and evaluation sets, not just an agreement rate on a dashboard.
