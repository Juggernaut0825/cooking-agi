# Study plan: one small exercise at a time

[中文](study-plan.md) · **English**

Start somewhere you can follow, and pair reading with practice. This is a suggested learning sequence, not a promise that a certain number of days will get you an offer.

[Back to interview preparation](README.en.md#plan) · [Looking for a focused review? Try Speedrun](speedrun.en.md)

## Find a starting point {#build}

If ML is new to you, begin with [one prediction in the starter route](speedrun-start.en.md#prediction). After working it out, ask: what is the input, what does the model return, and what does the loss compare?

- Lists and functions are unfamiliar: try the [small Python examples](speedrun-start.en.md#first-two), then come back.
- You can code, but haven't studied training: skip the syntax and connect predictions and loss to [one parameter update](speedrun-start.en.md#update).
- All of this is familiar: skip the rereading and try the [gap checks below](#refresh).

You're choosing a starting point for **this topic**, not a label for yourself. Someone with years of systems experience may still be new to model training.

## If you have a foundation, find the gaps first {#refresh}

Without looking up a solution, pick a small task relevant to your role. There is no score; the point is to find something worth spending your next session on.

| Try this | If you get stuck, start here |
| --- | --- |
| Compute an average loss, then change the batch partition | [Aggregation and denominators](code-comprehension.en.md#aggregation): what exactly are you averaging? |
| Write causal attention and label each tensor shape | [ML coding](../learn/ml-exercises/README.en.md): shapes, masks, and tests |
| Trace DFS and BFS on a small graph | [Traversal](algorithms/traversal.en.md): stacks, queues, and visited nodes |
| Trace an LLM request from the queue to a returned token | [Inference frameworks](../06-systems/inference-frameworks.en.md): scheduling, caching, and execution |
| Explain why you rejected an alternative in a project | [Project preparation](../career/prepare.en.md): constraints, your contribution, and evidence |

Skip what you can already do independently. If you can recall a conclusion but not explain it, try a runnable example. That often makes the missing step easier to see.

## Arrange a few small sessions {#sessions}

You could set aside **30–60 minutes of focused learning time** per session. That's a planning choice, not an estimate for finishing each unit. An unfamiliar idea may take several sessions. Breaks don't count, and missed sessions don't create work you owe.

To put it on a calendar, choose dates in [your study dashboard](dashboard.en.md#schedule), not a daily commitment. Planned focused minutes can differ for each session: perhaps 25 on Tuesday and 70 on Saturday. Leave empty dates for rest; you set the pace.

After studying, you can optionally record the actual date and focused minutes, reschedule, backfill a check-in, or undo it. Cancelled sessions can be restored too. There are no streaks or overdue penalties, and recording a session as done does not imply mastery.

| Sequence | Read a little | Try it yourself | Leave something to return to |
| --- | --- | --- | --- |
| 1 · Inputs and predictions | [One prediction](speedrun-start.en.md#prediction) | Calculate predictions and loss for two samples, then check in Python | A runnable function with explicit inputs and expected outputs |
| 2 · Parameter updates | [One update](speedrun-start.en.md#update) | Change the learning rate, watch the loss, and explain an oversized step | Before-and-after values and one open question |
| 3 · A training loop | [Tensors and PyTorch](../00-foundations/pytorch/README.en.md) → [Training loop](../00-foundations/pytorch/training-loop.en.md) | Run forward, backward, and update on a small batch; distinguish train from eval | A repeatable script and one checked result |
| 4 · An algorithm pattern | [Hash maps](algorithms/hash-and-prefix.en.md) or [DFS / BFS](algorithms/traversal.en.md) | Implement it, add duplicate values or a cycle as appropriate, and explain complexity | An edge-case test and the conditions where the method applies |
| 5 · Your target area | [Role-based practice](ai-roles-prep.en.md) | Choose one branch below and one exercise in it | An implementation, experiment log, or design sketch |
| 6 · Put it together | [Code comprehension](code-comprehension.en.md) and [Project preparation](../career/prepare.en.md) | Change one requirement in code; explain a decision from a project | Two things you couldn't explain clearly; revisit one next time |

Units 1–3 help if ML is new to you. Algorithms can run alongside them; you don't have to finish the model material first. Split any unit across sessions, or skip it when you can already do the work.

## Then choose the branch you need {#roles}

### MLE / Research Engineer

Choose one [ML implementation exercise](../learn/ml-exercises/README.en.md), such as stable softmax or attention. Start with small inputs, then check outputs, gradients, and edge cases. Follow it with a training or evaluation problem relevant to the role; you don't need to read every model family.

For LLM work, continue with [post-training practice](../practice/post-training/README.en.md). For recommendation and retrieval, try the [recommender walkthroughs](../practice/recommender-systems/README.en.md). Different directions deserve different preparation.

### Inference / ML Systems

Follow [one inference request](../06-systems/inference-frameworks.en.md) through each module's inputs and outputs. Pick a constraint: limited memory, long queues, or long requests delaying short ones. Write down two options, what each changes, and what you would need to measure.

In the [system-design exercises](../learn/system-design/README.en.md), define the workload and latency target before picking components. Keep time for algorithms and code reading too; architecture diagrams are only part of preparation.

### General Coding / SWE

Build your plan around [Python and algorithm patterns](leetcode.en.md) and [reading code](code-comprehension.en.md). Practice one method, then change a condition and check whether it still applies. ML is not a prerequisite for general SWE preparation.

This site is organized around ML and AI systems, not every kind of SWE role. Use the job description and interview guidance to decide which language, backend, or systems topics to add.

### Research Scientist

Choose a paper you worked on or read carefully. Explain its question, controls, and limits, then propose an experiment that distinguishes two possible explanations. [Evaluation foundations](../07-evaluation/README.en.md) can help you check whether a metric improvement supports your interpretation.

Practice the relevant implementation too, rather than separating research discussion from engineering entirely. This route doesn't replace expertise in your particular research field.

## Make it easy to return {#resume}

Leave three lines before stopping: **what you tried, what is still unclear, and what you will try next**. For example:

> The causal mask works, but I haven't tested padding. Next time, use two sequences of different lengths and write the expected mask by hand first.

Expand “My preparation” at the top of a note to choose a status or leave those three lines. Changes save automatically in this browser, with one record shared between the English and Chinese pages. Return to [your dashboard](dashboard.en.md#progress) to pick up where you left off. To set aside time for a note, choose “Plan a session for this note,” then pick a date and duration. Tracking is optional; your code and notes can serve the same purpose.

If you miss a day, there's nothing to make up. After a longer break, run your last example and decide whether to continue or revisit it.

## Keep a backup for your next device {#backups}

Open [Notes & backups on your dashboard](dashboard.en.md#progress) and choose “Export progress.” One JSON file contains study records, sessions, check-ins, bookmarks, recent reading, reading positions, and update settings. On another device or browser, drop it back in and review the preview before confirming. The default keeps current records and adds missing ones. You can instead choose newer records or explicitly prefer the backup to restore older ones. Fields missing from an older backup do not erase what you have now.

- **No fork or clone required.** Progress is separate from the site source, so normal site updates or `git pull` do not overwrite it. You can host your own copy too, but a different domain, protocol, or local port has separate browser storage. Import your backup there.
- **Browser storage is not a permanent backup.** Clearing site data, closing a private window, or browser storage cleanup can remove records. Export occasionally and keep the file outside the repository.
- **Imports are local.** The file is read in your browser, not uploaded. Backups are unencrypted and contain private notes, so keep them out of public repositories. Unsaved forms and display preferences such as the theme are not included. Recent reading means this site's pages, not your Chrome browsing history.
- **What about future updates?** Titles, ordering, and language do not identify a record. Maintainers must preserve the original ID when moving a chapter. Records without a matching page are kept, not deleted. An unsupported file version produces a warning and leaves existing progress unchanged rather than forcing an import.

The browser also keeps up to three recovery copies, with a preview before restoring. They are not a complete history of every keystroke. Clearing all browser data removes them too, so keep an exported file elsewhere, perhaps in your own iCloud / Drive folder. This site does not connect to cloud storage or provide account-based sync. If two devices changed the same record, choose which copy to keep in the import preview.

In [Updates & settings](dashboard.en.md#updates), follow a topic to add its future notes to your queue by default. Nothing is assigned a date, and you can turn auto-add off. Tracked articles get notices for substantive additions or corrections, not title or layout changes. “Mark this update as read” closes the notice without changing your study status.

[Back to preparation](README.en.md#plan) · [Practice one skill](README.en.md#prep-routes) · [Full library](../learn/README.en.md)
