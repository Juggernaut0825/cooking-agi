<!-- source: https://github.com/tianyi-zhang-02/cooking-agi/blob/main/interview/speedrun.en.md -->
# Interview speedrun

[中文](speedrun.md) · **English**

> Last reviewed: 2026-10 · Choose by focused learning time, not a completion deadline. This does not promise coverage of a company's entire interview loop.

Your interview is scheduled, and you do not have time for hundreds of notes. Start with a few things you can finish: implement something, find a bug, explain a mechanism, and discuss a project. Open a longer note when you get stuck, not because every link needs a visit.

The budgets mean **focused learning time**: reading, writing, thinking, and reviewing, with breaks excluded. Spread six or twelve hours across sessions that fit your life. Set aside half an hour or an hour when it works for you, try one small exercise, and pick up there next time. No need to finish in one sitting or keep a daily streak.

To come back to a note, choose “Save this page” under its title and find it under “My reading” at the top right. Before switching devices or clearing your browser, [export a backup](study-plan.en.md#backups).

Choose by familiarity, not years of employment. If you know Python but not ML, use just the model part of the starter route. Below is the **review route**, organized into suggested 2 / 6 / 12-hour budgets. Stay with a difficult idea longer rather than turning the page to keep up.

## Spend ten minutes choosing the round to prepare for

Check the invitation and job description: algorithms, ML coding, code comprehension, system design, or a project discussion? Can you run code, read documentation, or use a specified AI tool? **Do not use AI during the interview without explicit permission.**

Write down the next round, your weakest relevant skill, and what you will produce today. For example: “ML coding on Thursday; I reverse masks; today I will implement attention and test that changing a future token cannot change earlier outputs.” That gives you more to work with than “review Transformers.”

The default route is for ML / LLM roles. If the next round is algorithms only, replace the ML block with algorithm practice. If it is a project discussion, use that time for project follow-ups. You do not need to divide your time equally.

## Start with two hours of relevant review

| Suggested time | What to do | What to keep |
| --- | --- | --- |
| 10 minutes | Confirm the format and pick a gap | A one-sentence practice goal |
| 35 minutes | Solve an algorithm problem using a familiar method, without recalling a memorized answer | Working code, boundary tests, complexity |
| 25 minutes | Try the [code-reading exercise](code-comprehension.en.md#cache): trace calls before editing | An input that reproduces the bug and a minimal fix |
| 25 minutes | Choose one relevant [concept below](#core) | A two-minute explanation with a counterexample or limitation |
| 20 minutes | Talk through your own project | Problem, personal contribution, decisions, evidence, and what you did not do |
| 5 minutes | Record unresolved questions and check your interview setup | One priority for the next session |

Suggested total: 120 minutes, split however you like. If the algorithm takes longer, record whether you got stuck on the approach, implementation, or tests instead of rushing to the answer. The code-reading block uses one short example, not the whole chapter. Finishing only one part today is still useful.

## Six hours: add four hours to the two-hour plan

| Additional time | What to do | A stopping point |
| --- | --- | --- |
| 60 minutes | Practice two more algorithm patterns, 30 minutes each | Explain why the method still works on a changed input |
| 60 minutes | Implement one ML component: softmax / loss, an MLP, or attention, depending on your starting point | Check outputs or gradients; reduce the scope to one function if needed |
| 45 minutes | Choose three [core topics](#core), 15 minutes each | Explain what each does, why, and a condition where it does not apply |
| 45 minutes | Complete the [code-comprehension practice](code-comprehension.en.md#practice) | State expected behavior, fix it, and add regression tests |
| 30 minutes | Rehearse a round with project follow-ups | Record a real sticking point, not just a smooth script |

Suggested total: 360 minutes, not a requirement to master this by hour six. For a general SWE round, replace the ML implementation with a change to an unfamiliar program and its tests. For research discussions, move some extra algorithm time to hypotheses, controls, and failed experiments from your work; retain practice for any confirmed coding rounds.

## Twelve hours: add six hours and revisit your weak spots

| Additional time | What to do | A stopping point |
| --- | --- | --- |
| 90 minutes | Pick three algorithm patterns; time the implementation, tests, and review | Explain why an unsuccessful approach failed |
| 90 minutes | Implement or debug an ML component | It still works with padding, empty input, or a different batch |
| 60 minutes | Work through one [system design](../learn/system-design/README.en.md) | Requirements, capacity, interfaces, bottlenecks, and degraded operation |
| 45 minutes | Audit your project and experiment claims | Baseline, data split, cost, limitations; identify anything not measured |
| 45 minutes | Rehearse the format closest to your actual round | Complete the main steps without hints; verify outputs even in AI-enabled practice |
| 30 minutes | Redo two earlier mistakes | Explain the correction without looking at the previous answer |

Suggested total: 720 minutes. If you need more practice, pick from the [role-based guide](ai-roles-prep.en.md). Close to the interview, redo weak spots rather than switching to a new area.

## Core ideas: explain the mechanism, then follow up as needed

These are reminders, not scripts to recite. Each topic starts with a small example. Use the linked chapter if you cannot explain a follow-up. Pick the topics relevant to the round.

### Algorithms: what makes the method valid?

A hash map answers “have I seen this before?”; pointers exploit order or maintain a window; binary search needs a reason to discard half the candidates; DFS / BFS traverse states; a heap keeps the most useful current item available. A keyword in the prompt is not enough to choose a template.

For two numbers summing to 8 in `[3, 3, 5]`, at the second 3 you check whether **5 has appeared**, not whether 3 is repeated. A typical hash-map solution uses average O(n) time and O(n) space. Explain why one position cannot be used twice.

**Check one condition:** BFS finds shortest paths in an unweighted graph; do not transfer that guarantee to unequal edge weights. Returning every path also has a different output cost from returning one distance. Keep practicing LeetCode for algorithm rounds: reading code does not replace solving a problem from scratch.

Continue: [Hash maps and prefix sums](algorithms/hash-and-prefix.en.md) · [Pointers and binary search](algorithms/pointers-and-search.en.md) · [DFS / BFS](algorithms/traversal.en.md) · [Stacks and heaps](algorithms/stack-heap-links.en.md) · [Backtracking and DP](algorithms/backtracking-and-dp.en.md). Pick one small problem per needed method, not every chapter.

### ML: a lower loss is not yet a better model

A falling training loss means the model fits the current objective better. It does not establish improvement on new data. Start with the prediction task, data split, and loss aggregation before describing the architecture.

Suppose two batches have token losses `[2,2]` and `[8]`. Averaging their means gives 5; averaging all valid tokens gives 4. These measure different things and should not be presented as the same metric.

**Check the basics:** can a tiny batch be overfit? Are gradients cleared? Are training and validation separated? Were normalization statistics fitted only on training data? Code that runs can still optimize the wrong objective.

Continue: [Training loop](../00-foundations/pytorch/training-loop.en.md) · [Fundamentals](basics/README.en.md) · [Aggregation bug](code-comprehension.en.md#aggregation).

### LLMs: trace attention through its shapes

In ordinary multi-head attention, split Q/K/V often have shape `[B,H,T,D]`. Multiplying Q by transposed K produces `[B,H,T,T]`. Divide by `sqrt(D)`, apply the mask, take softmax over the last dimension, then use those weights to combine V. Scaling happens before softmax to control the dot-product scale, not to divide an already computed probability.

With three causal positions, the first can attend only to itself, and the second to the first two. **Changing the third token must not change earlier outputs.** That test catches a reversed mask when a shape check cannot.

A KV cache stores earlier keys and values so they do not need to be recomputed each step. It does not cache a whole answer or store Q. Fix the model, disable dropout, and compare per-position logits for the same token sequence before comparing sampled text.

Continue: [Attention](../00-foundations/core/multi-head-attention.en.md) · [KV cache](../00-foundations/deep-dives/kv-cache-and-inference.en.md) · [Sampling](../00-foundations/core/decoding.en.md).

### Post-training: where does the supervision come from?

SFT learns from demonstrations; DPO commonly optimizes directly from preference pairs; PPO / GRPO sample trajectories and use feedback to update a policy. DPO usually does not require online rollouts inside its optimization loop, but models may have generated its preference data. That data is not free.

If four responses to a prompt all receive zero reward, group centering leaves no relative reward difference for GRPO to learn from in that group. Whether other terms such as KL still contribute depends on the objective. Changing the learning rate alone may miss the issue: inspect task difficulty, reachable rewards, and sampling budget.

**Keep the roles separate:** the reference is a policy used to constrain drift, not a “correct answer.” The old policy generated the sampled trajectories. RLVR describes a source of feedback, not an alternative on the same axis as PPO versus GRPO.

Continue: [Methods compared](../05-post-training/deep-rl/methods-map.en.md) · [Why RL is hard to train](../05-post-training/deep-rl/why-rl-is-hard.en.md). Skip this block if it is unrelated to the role.

### Data and evaluation: what could fool this metric?

Getting 90 easy examples right and ten important hard ones wrong still gives 90% accuracy. Decide which users and errors matter, then inspect the relevant groups instead of optimizing only an aggregate score.

For a two-point improvement, check whether data and candidate pools match, whether there is leakage or extra compute, and whether repeated runs or uncertainty analysis support the difference. A judge model also needs checks: swap answer order, audit a sample manually, and inspect disagreements.

Continue: [Evaluation](../07-evaluation/README.en.md) · [LLM-as-a-Judge](../07-evaluation/llm-as-a-judge/README.en.md) · [Data as supervision](../01-data-and-feedback/data-as-supervision.en.md).

### Systems: follow a request instead of listing frameworks

A request typically passes through validation, queuing, scheduling, model execution, and output handling. Establish latency targets and concurrency before choosing a bottleneck: computation, memory bandwidth, memory capacity, or communication?

At two bytes per parameter, 7B parameters need roughly **14 GB for weights alone**, in decimal units. That is not the whole service footprint: add KV cache, temporary tensors, and runtime overhead. Training also needs gradients and optimizer state. Quantization does not shrink every allocation by the same factor.

DDP replicates models and splits samples; FSDP shards training state, trading communication for memory; TP splits computation within layers; PP splits layers. vLLM / SGLang address inference execution and serving, rather than being alternative training replacements for FSDP.

Continue: [A complete ML system](../practice/ml-system/README.en.md) · [vLLM / SGLang](../06-systems/inference-frameworks.en.md#engine-map) · [Training frameworks](../06-systems/training-frameworks.en.md).

## Replace irrelevant work with role-specific practice

| Direction | Keep first | Leave for later when time is short |
| --- | --- | --- |
| General SWE | Algorithms, code reading, tests, projects; system design if requested | Unrelated model derivations |
| Model-focused MLE / RE | Algorithms, ML coding, training bugs, data and evaluation, projects | Every model family's details |
| RS / research discussion | Required coding, research assumptions, experiments, personal contributions, next questions | Implementing every popular architecture |
| Inference / ML systems | Algorithms, generation and caches, memory estimates, scheduling, performance evidence | Memorizing every framework class |

These are time-allocation suggestions, not a company's question bank. For vision, speech, robotics, or other domains, substitute their core problems for the LLM material. A few memorized terms do not replace domain knowledge.

## Should you practice Google's code-comprehension format?

Yes, but **do not drop algorithm practice**. Reporting from May 2026 described an AI-assisted code-comprehension pilot on selected US Google teams, involving reading, debugging, and optimization—not a confirmed worldwide process. See [code comprehension](code-comprehension.en.md#google) for sources and an original practice exercise.

If your invitation includes that round, confirm the tools, test execution, and exact permission to use AI. Code comprehension does not automatically mean AI is allowed; Google's and Google DeepMind's processes are not interchangeable.

## Finish with a small note of your own

End each session with a place to resume: “add an empty-input test” or “check the softmax dimension by hand.” Next time, redo the small example before changing one condition. That checks whether you really understood it.

Before the interview, go over your recurring coding mistakes, concepts you still cannot explain, the evidence in your project that supports its conclusions, and the parts you have not done. Above all, separate work you did yourself, work you contributed to, and things you only understand in principle. Explain your choices and what still needs testing rather than rushing through more terminology.

For longer preparation, return to [Interview prep](README.en.md) or the [role-based guide](ai-roles-prep.en.md). This route helps you choose what to do now; it does not replace the detailed notes.
