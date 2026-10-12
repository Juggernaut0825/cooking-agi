# AGI Study Notes

**ML knowledge, with somewhere to start and room to go deeper.**

[**Read the notes →**](https://tianyi-zhang-02.github.io/cooking-agi/) · [中文](README.zh.md) · [Behind the notes](contributors.en.md) · [Contribute](CONTRIBUTING.md#english)

[![Build](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml/badge.svg?branch=main)](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml)

**Working toward v1.0: the study workspace.** Choose a route, plan sessions around your week, and keep your notes and backups. See [release scope](community/updates.en.md) and the [roadmap](community/roadmap.en.md). Future CV, autonomous-driving, edge, simulation, and robotics topics are open for proposals, not completed courses.

ML and LLM notes in English and Chinese, free to read, with examples, diagrams, and code. I started collecting them because preparing for interviews meant opening a lot of tabs and still not knowing where to begin.

The goal is to make this knowledge easier to access—not just for people who already know the field. Learn a topic from the basics, prepare for a career change, review during recruiting season, or follow something you're curious about. Spend less time finding material and more time making sense of it.

The site opens in English on your first visit. **中文 / EN** at the top switches the same note in one click; Chinese notes include English technical terms. Your choice is remembered in this browser. Direct links to a particular language stay in that language.

<span id="_1"></span>

## Start here

| What brings you here? | Start here | What to do first |
| --- | --- | --- |
| ML is new to me, or I'm changing fields | [Starting out](interview/speedrun-start.en.md) | Work through one prediction, loss, and update; follow the Python pointers if needed. |
| I want a steady learning plan | [Study at your pace](interview/study-plan.en.md) | Pick a starting point, then one small reading-and-coding session. |
| I have interviews coming up and limited time | [Quick review](interview/speedrun.en.md) | Choose the parts relevant to your role and the focused learning time you have. |
| I have experience and want to find gaps | [Short coding checks](interview/coding-checks.en.md) · [Role-based preparation](interview/ai-roles-prep.en.md) | Try an implementation or explanation before rereading. Skip what you can already do. |
| I just want to explore a topic | [Choose a topic](learn/choose-your-path.en.md#topics) · [Tech history](learn/technology-timeline.en.md) | Follow an interest, not an interview syllabus. |

These are different ways into the same notes, not levels you have to finish. A systems engineer may still want the beginner explanation of RL; someone new to ML may already be comfortable with Python.

### How to use the notes

1. **Choose a route, then one note.** The [preparation home](interview/README.en.md) separates quick review from planned learning. The [full route guide](learn/choose-your-path.en.md) also covers research and projects.
2. **Start with the example.** We aim to build from intuition to mechanics, then assumptions, code, and tradeoffs. Stop when you have what you need, or continue into the details. Some chapters do this better than others—we're still improving them.
3. **Leave yourself a next step.** Open “My preparation” on a note to save a status or reminder. Bookmark [your study dashboard](interview/dashboard.en.md) to plan sessions and return to your records. They stay in your browser; export a progress JSON for backup or another device. No fork or account needed. [How backups work](interview/study-plan.en.md#backups).

Time estimates are focused learning hours, not deadlines. You can split them across sessions. There is no streak to keep or offer promised at the end.

### What's in each section

- **[Foundations](learn/README.en.md)** — Understand model components, training, evaluation, and inference. New to language models? Start with the [study guide](00-foundations/study-guide.en.md).
- **[Interview prep](interview/README.en.md)** — Review ML / LLM concepts, practice ML coding and Python, and learn transferable algorithm patterns.
- **[Engineering practice](practice/README.en.md)** — Work through recommendation, RAG, and post-training projects: data, evaluation, checkpoints, and design tradeoffs.
- **[Tech history](learn/technology-timeline.en.md)** — Trace power, chips, networks, software, data, and AI through selected milestones and original sources.
- **[Career notes](career/README.en.md)** — Read about internship and new-grad preparation, decisions, and things I'd do differently.

Follow a small example first. If you want the derivation or implementation details, keep reading or open the optional sections. Diagrams explain the main idea without requiring you to click through every step.

<span id="_2"></span>

## Content map

Three routes through the foundations, depending on what you're curious about:

- **How models work:** [Transformer walkthrough](https://tianyi-zhang-02.github.io/cooking-agi/00-foundations/transformer-lab.en.html) · [BERT](00-foundations/core/bert.en.md) · [CLIP and multimodal learning](03-multimodal-learning/clip.en.md).
- **How models learn:** [Training basics](learn/pretraining/README.en.md) · [Deep RL](05-post-training/deep-rl/README.en.md) · [Post-training](05-post-training/README.en.md) · [LLM-as-a-Judge](07-evaluation/llm-as-a-judge/README.en.md).
- **How models get used:** [Inference](learn/inference/README.en.md) · [Search and retrieval](04-search/README.en.md) · [Agents and tools](10-agents/README.en.md).

For practice, head to [ML coding](learn/ml-exercises/README.en.md), [Python](interview/python.en.md), [algorithm patterns](interview/leetcode.en.md), or [system design](learn/system-design/README.en.md).

**Still being worked on:** some explanations and source comparisons need more review. The [coverage and backlog](learn/coverage.en.md) separates material that exists from material that has been checked. Small tested examples are not claims of full-model training or benchmark reproduction.

<span id="_3"></span>

## Join us!

This is a community-maintained collection, not an official curriculum. The choice of topics and advice reflects our experience and judgment—currently closest to ML / LLM and MLE / research preparation. The field changes, interviews change, and some notes will fall behind. We can miss things or get them wrong.

[Open a feedback issue](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=note-feedback.yml) and choose **correction, outdated information, explanation, missing topic, or site problem**. Link the passage and tell us what you noticed. A public source or software version helps when something has changed, but you don't need to have the answer to ask a question. Issues are public: don't attach private progress backups, company material, or unredacted logs.

Small fixes can go straight into a PR. For a new article or navigation change, start with a [content proposal](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=proposal.yml) so we don't duplicate work. See the [contributing guide](CONTRIBUTING.md#english), [editorial guide](EDITORIAL.en.md), and [area reviewers](community/README.en.md) for the process. Routine merges need a relevant non-author CODEOWNER review and passing checks.

We teach transferable concepts and preparation methods, not company-specific interview intelligence or question banks. Use public sources and your own explanations. AI-assisted work needs checking and disclosure; an AI preliminary review is not approval or evidence that a claim is true.

If the notes helped you understand something, prepare, or land an offer, passing the link to someone else would mean a lot. There's no need to share your employer or outcome. Corrections and new perspectives help just as much. Contributors are listed in [Behind the notes](contributors.en.md); participation and map locations are optional.

**Open source and open content:** original code uses MIT; original notes use CC BY 4.0. Credit the authors and source, keep the relevant notices, and indicate changes when adapting the notes. Third-party materials retain their own terms. See [license scope](LICENSE.md).

**These notes will stay free on this site.** No paid chapters or premium preparation route. Share them with classmates, friends changing jobs, or anyone learning something new. Reuse and adapt the original material under its license; we don't vouch for third-party edits or take responsibility for how others present them. The applicable licenses set out the warranty and liability terms.

This is a learning resource, not a way to “hack” an interview. We can't promise an offer or predict a company's questions. What we can work on is a useful structure: choose what you need, understand it, try it, and go deeper when it matters. People from different fields can also help connect ideas we'd otherwise miss.

<span id="_4"></span>

## Run locally

This repository contains the notes, examples, and static-site source. No database is needed. From the repository root, with Python 3.12 recommended:

```bash
python3 -m pip install markdown pygments numpy
python3 site/build.py --serve
```

Open <http://localhost:8000>. To build without starting a server, run `python3 site/build.py`; output goes to `_site/`.

<details markdown="1">
<summary>Checks before submitting</summary>

```bash
python3 site/collaboration.py
python3 -m unittest discover -s site/tests
python3 site/leakcheck.py
python3 site/paritycheck.py --strict
python3 site/build.py
```

Some experiments also need PyTorch, as documented in their chapters; corresponding tests explicitly skip when it is unavailable. Bookmarks, recently opened notes, and reading positions stay in this browser and are not uploaded.

</details>

<span id="_5"></span>

## Why this exists

These notes started while I was moving from academic research toward industry. My preparation materials were scattered across papers, lectures, documentation, and bookmarks. Putting them together helped me see what I understood and what I still needed to work on.

I don't want a useful explanation to depend on knowing the right person or collecting the right set of bookmarks. Making knowledge more accessible is the point. These notes are not a complete education or a substitute for practice. For areas outside our experience, we link to people who know them better and welcome contributors who can fill the gaps.

Hopefully this saves you a little searching—and leaves more time for things outside studying, too.
