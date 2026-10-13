# AGI Study Notes

**ML / LLM notes for learning, building, and interview preparation.**

<!-- repository-only -->

[**Read the notes →**](https://tianyi-zhang-02.github.io/cooking-agi/) · [中文](README.zh.md) · [Behind the notes](contributors.en.md) · [Contribute](CONTRIBUTING.md#english)

[![Build](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml/badge.svg?branch=main)](https://github.com/tianyi-zhang-02/cooking-agi/actions/workflows/site.yml)

<a href="https://tianyi-zhang-02.github.io/cooking-agi/"><img src=".github/media/promo.en.webp" width="100%" alt="A 29-second tour of the site: an interactive figure, the English and Chinese switch, 250+ notes, the chronicle tree, and reading history"></a>

<!-- /repository-only -->

When I started preparing for industry roles, my materials were scattered across lectures, papers, documentation, and bookmarks. Finding a good explanation took time. Working out what to read next took more. These notes grew out of trying to bring that material together.

Here you'll find ML and LLM notes in English and Chinese, with examples, diagrams, code, and project walkthroughs. **They're free to read and will stay that way.** You can start with the basics, review for an interview, or explore a field outside your own. The aim is to make useful material easier to find and follow, even if you're new to it.

**English or 中文:** use the switch at the top of any note. It opens the same article in the other language; Chinese notes keep familiar English technical terms. The site starts in English and remembers your choice in this browser. A direct link to a language opens that version.

<span id="_1"></span>

## Start here

| What brings you here? | A place to start |
| --- | --- |
| I'm new to ML | [Starting out](interview/speedrun-start.en.md) — work through a prediction, a loss, and a parameter update. Python pointers are included. |
| I want a learning plan | [Study at your pace](interview/study-plan.en.md) — choose a route and fit reading and practice around your week. |
| I have an interview soon | [Quick review](interview/speedrun.en.md) — focus on topics relevant to the role and the time you have. |
| I want to check what I know | [Coding checks](interview/coding-checks.en.md) · [Role-based preparation](interview/ai-roles-prep.en.md) — try first, then revisit what was difficult. |
| I'm here out of curiosity | [Choose a topic](learn/choose-your-path.en.md#topics) · [Tech history](learn/technology-timeline.en.md) — explore a question or follow how a field developed. |

Choose for the topic, not your job title. You might know systems well and still want an introduction to RL.

### How to use the notes

1. **Pick something you want to understand.** Use a route above, or the [topic guide](learn/choose-your-path.en.md). You don't need to read the site in order.
2. **Follow the example, then try it.** Work through a calculation or run the code. Continue to the derivation and tradeoffs when you want more detail. We're still improving this progression in some chapters.
3. **Keep your place.** “My preparation” on each note saves your status and reminders. The [study dashboard](interview/dashboard.en.md) brings your plan and records together. No account or fork is needed. Records stay in this browser; [export a JSON backup](interview/study-plan.en.md#backups) to keep a copy or move devices.

Time estimates mean focused learning time, not a daily target. Split a session if you need to; there is no streak to maintain.

### What's in each section

- **[Foundations](learn/README.en.md)** — How models work, learn, and are evaluated. The [study guide](00-foundations/study-guide.en.md) is a starting point for language models.
- **[Interview prep](interview/README.en.md)** — ML / LLM review, ML coding, Python, and reusable algorithm patterns.
- **[Engineering practice](practice/README.en.md)** — Recommendation, RAG, and post-training systems: how data, training, serving, and evaluation fit together.
- **[Tech history](learn/technology-timeline.en.md)** — Developments in power, chips, networks, software, and AI, with links to original sources.
- **[Career notes](career/README.en.md)** — What I tried during internship and new-grad searches, and what I'd do differently.

Diagrams show the main idea without requiring interaction. The controls are there when you want to change an input or compare outcomes.

<span id="_2"></span>

## Content map

A few articles to start reading now:

- **How models work:** [Transformer walkthrough](https://tianyi-zhang-02.github.io/cooking-agi/00-foundations/transformer-lab.en.html) · [BERT](00-foundations/core/bert.en.md) · [CLIP and multimodal learning](03-multimodal-learning/clip.en.md).
- **How models learn:** [Training basics](learn/pretraining/README.en.md) · [Deep RL](05-post-training/deep-rl/README.en.md) · [Post-training](05-post-training/README.en.md) · [LLM-as-a-Judge](07-evaluation/llm-as-a-judge/README.en.md).
- **How models get used:** [Inference](learn/inference/README.en.md) · [Search and retrieval](04-search/README.en.md) · [Agents and tools](10-agents/README.en.md).

For practice, head to [ML coding](learn/ml-exercises/README.en.md), [Python](interview/python.en.md), [algorithm patterns](interview/leetcode.en.md), or [system design](learn/system-design/README.en.md).

**Still being worked on:** some explanations and source comparisons need more review. The [coverage and backlog](learn/coverage.en.md) separates material that exists from material that has been checked. Small tested examples are not claims of full-model training or benchmark reproduction.

**Next up: the v1.0 study workspace.** Planning sessions, keeping notes, and backing up progress are the focus. See [release scope](community/updates.en.md) and the [roadmap](community/roadmap.en.md). CV, autonomous driving, edge deployment, simulation, and robotics are proposed areas for future contributions, not complete courses yet.

<span id="_3"></span>

## Join us!

If a passage is confusing, something has changed, or a topic is missing, we'd like to hear about it. You don't need to have the answer before asking a question.

- **Give feedback:** [open an issue](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=note-feedback.yml) and link the part you're referring to. You can flag a correction, outdated information, an unclear explanation, a missing topic, or a site problem.
- **Make a change:** small fixes can go straight into a PR. For a new article or navigation change, start with a [content proposal](https://github.com/tianyi-zhang-02/cooking-agi/issues/new?template=proposal.yml) so we can coordinate.
- **Pass it on:** if the notes helped you learn or prepare, share the link with a friend or classmate. Sharing an employer or job-search outcome is never required. Meet the contributors in [Behind the notes](contributors.en.md); map locations are optional too.

These are our working notes, not an official curriculum. Our experience is mainly in ML / LLM and MLE / research preparation, and it shapes what we cover. Some material will be incomplete or out of date. We share public knowledge and preparation methods, not company-specific interview information or question banks. We can't predict questions or promise an offer.

<details markdown="1">
<summary>Contributing, review, and privacy</summary>

See the [contributing guide](CONTRIBUTING.md#english), [editorial guide](EDITORIAL.en.md), and [area reviewers](community/README.en.md). Community PRs need a relevant non-author CODEOWNER review and passing checks. Use public sources and your own explanations. Disclose and check AI-assisted work; an AI review is not formal approval or factual verification.

Issues are public. Don't attach private progress backups, company material, or unredacted logs. A public source or software version is helpful when reporting a change, but not required to ask for a clearer explanation.

</details>

**Free to read, open to reuse.** There are no paid chapters or premium preparation routes. Original code uses MIT; original notes use CC BY 4.0. Keep attribution, source links, and the relevant notices, and mark your changes. Third-party materials retain their own terms. We don't endorse others' edited or redistributed versions; warranty and liability terms are in the [licenses](LICENSE.md).

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

Some experiments also need PyTorch, as documented in their chapters; corresponding tests explicitly skip when it is unavailable. Your bookmark list, recently opened notes, and reading positions stay in this browser. Public counting is off by default; opting in sends only subsequent reads and manual save actions, not past records or study backups. No production counting service is connected yet.

</details>

<span id="_5"></span>

## Why this exists

Moving from academic research toward industry, I often found that something I recognized in a paper was much harder to explain or implement myself. Writing it down helped me notice those gaps. Sharing the notes gives other people a chance to point them out too.

I hope this makes it easier to get started without already having a background in the field or someone to hand you a reading list. It won't replace study and practice. Where others explain something better, we'll link to them; where we lack experience, we'd like to learn from people who have it. Comparing notes across fields may reveal connections we wouldn't find on our own.

If it saves you some searching and leaves a little more time for the rest of your life, that's a good reason to keep working on it.
