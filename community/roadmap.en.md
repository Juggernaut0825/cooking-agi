# What we'd like to build next {#roadmap}

[中文](roadmap.md) · **English**

First, make the current version useful. Right now that means helping someone choose a starting point, make a little time, and return without losing their place. As the notes grow, we'd like people from other fields to help explain the parts we know less about.

<nav class="study-route roadmap-route" aria-label="Roadmap navigation">
<a href="#now"><small>THIS VERSION</small><strong>Interview prep & study dashboard</strong><span>Choose a route, make a plan, read, and keep notes</span></a>
<a href="#next"><small>NEXT</small><strong>Make studying easier</strong><span>Less searching around, more useful practice</span></a>
<a href="#future"><small>OPEN TO CONTRIBUTORS</small><strong>From vision to robotics</strong><span>Start with one good explanation and one small project</span></a>
</nav>

**See [Updates](updates.en.md) for release status and [Coverage](../learn/coverage.en.md) for individual chapters.** This page describes intentions, not shipped features. There are no release dates for work we haven't scoped yet.

## This version: a complete interview-prep entry point {#now}

The proposed **v1.0.0 · Study workspace** is about a usable learning flow, not complete coverage of AI.

- **Find a starting point.** Work up from small examples if a topic is new, or go straight to implementation, debugging, and tradeoffs if you know the basics.
- **Use the time you have.** Save tasks on dates you choose, with a different duration each time. You don't have to study daily. Time estimates describe focused work, not how fast you should understand a chapter.
- **Keep the reading connected.** Exercises link to the main notes rather than a second textbook. Bring questions and topics to revisit back to the dashboard.
- **Keep your own records.** Progress stays in the current browser, with JSON export, import preview, and restore. No account or fork required.

The initial routes focus on ML / LLMs, post-training, inference systems, and algorithms. The [release notes](updates.en.md#v1-0-0) describe the scope, limits, and checks still needed.

[Open the dashboard](../interview/dashboard.en.md) · [Browse the preparation routes](../interview/README.en.md)

## Next: improve the parts people already use {#next}

These are open work, not completed features. We'll use feedback to choose the order rather than add everything at once.

| Area | A small place to start | What a useful result looks like |
| --- | --- | --- |
| Finding notes and making plans | Improve note search in the session form; then consider a preview for several sessions | Nothing saves without confirmation or replaces existing plans and drafts |
| Connected practice | Review one route's prerequisites, example, exercise, and explanation | A beginner can attempt it from the linked notes; an experienced reader can skip the setup |
| Returning to a topic | Filter chapter records by revisit status and personal notes | Readers find where they got stuck; a click doesn't count as understanding |
| Backups and upgrades | Add older backup fixtures and cross-version restore tests | Routine updates preserve records; format changes have a migration path first |
| Language and small screens | Fix a confusing passage or a layout problem you've encountered | Both languages read naturally, and the page works on a phone and with a keyboard |

Accounts, cloud sync, streaks, and leaderboards are not part of the default plan. Offline use and cloud sync need separate proposals covering privacy, conflicts, and updates.

## Future topics: begin with a small project {#future}

These are areas we'd like to explore, **not complete courses or scheduled releases**. No one has been assigned to maintain them. The existing notes lean toward ML / LLMs; we'd especially welcome authors and reviewers with experience in these other fields.

| Direction | Possible first notes | A manageable first project |
| --- | --- | --- |
| Computer vision (CV) | Image inputs, convolutions and ViTs, classification vs. detection vs. segmentation, data and evaluation | Fix a public dataset subset, build a baseline, and examine where it fails |
| Autonomous driving | Perception, prediction, planning, control, and the information passed between them | Study one component using public data or simulation, without treating offline scores as evidence of road safety |
| Jetson & edge deployment | Model export, device inference, and latency, memory, and power tradeoffs | Deploy a small vision model with device details, software versions, and a measurement procedure; explain the workflow for readers without the hardware |
| Physical simulation | State, actions, time steps, contact, sensor noise, and simplifying assumptions | Build a small control task, change one assumption, and explain the difference |
| Robotics | Coordinate frames, kinematics, control, imitation learning, and RL in a complete system | Start with a simulated arm or mobile robot, identifying what does not transfer directly to hardware |

These shouldn't become five disconnected textbooks. Reuse the notes on data, evaluation, optimization, systems, and deployment where they help. We'd like each project to explain what a component receives, what it produces, and how it fits with the rest.

Add a navigation section and dashboard route once there is useful material and someone willing to maintain it, not a row of empty categories first. Contributors don't need to take on an entire field. Work involving vehicles or physical robots needs its own experimental conditions, failure analysis, and safety limits; a successful simulation is not a safety case for hardware.

## Where can I help? {#contribute}

A typo, diagram, or clearer explanation is enough for a small PR. You can also [leave feedback](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=note-feedback.yml) without knowing the fix. You don't need to be an expert to point out something that is hard to follow.

For a new topic, open a [proposal](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=proposal.yml) with four things:

1. **The reader:** someone starting out, someone with a foundation, or someone preparing for a kind of technical interview?
2. **One problem to explain:** a whole series is not required.
3. **The material:** public sources, a small example, or a reproducible experiment.
4. **What you'd like to do:** outline, prose, code, translation, or review, within the time you have.

A maintainer can help narrow the scope, find a home for it, and ask for a willing reviewer. One contribution is not a commitment to ongoing maintenance. Ordinary changes use the [PR review process](README.en.md#review); cross-area changes start with a discussion.

A ready note needs prerequisites, an explanation that builds from an example, a way to practice or check the result, and limits. State costs and versions for hardware work. Provide a CPU or simulated alternative when possible, and say when it isn't. Write each language naturally, credit sources, and distinguish an experiment you ran from one you only read about.

## How will releases work? {#versions}

Each formal release will record what changed, what remains unfinished, compatibility with saved records, and the corresponding code snapshot. Small edits don't have to wait for a major release; they also remain in repository history.

- **Patch** (for example, 1.0.1): corrections, translations, links, and fixes that don't change how the site is used.
- **Minor** (for example, 1.1.0): a complete feature or reviewed learning route that keeps existing progress usable.
- **Major** (for example, 2.0.0): a change requiring readers to adjust a workflow or migrate data, with migration instructions and tests first.

Site versions and backup-format versions are separate. Releasing a new site version won't by itself invalidate an old backup. Browser storage is not a permanent backup, though: export before clearing site data, changing devices, or moving to another origin.

[GitHub Releases](https://github.com/tianyi-zhang-02/cooking-agi/releases) will record formal releases. Proposals can change the directions here; the table is not a queue everyone must follow. The site will stay free. If it helps you, please share it with someone who might find it useful.
