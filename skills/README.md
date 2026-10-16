# Agent skills

## cooking-agi-interview

A mock interviewer and review coach for MLE / research engineer / LLM engineer / AI infra
interviews, built from the notes in this repository. It asks one question at a time, grades the
answer against the notes, follows up on gaps, and keeps a local progress log so weak areas come
back. Works with Claude Code, Codex, and other agents that read `SKILL.md` skills. Fully local:
no server, no API key beyond your agent's own.

Install:

```bash
npx skills add https://github.com/tianyi-zhang-02/cooking-agi --skill cooking-agi-interview
```

Add `-g` to install for your user instead of the current project, or `-a claude-code -a codex`
to choose agents. Then ask your agent things like:

- "Mock interview for an LLM inference engineer role, 5 questions"
- "Drill me on RLHF and DPO until I get three in a row right"
- "Rapid-fire review of Transformer basics"
- "What am I weak at? Quiz me on that"
- "ML system design interview: a RAG assistant over 10M documents"

Progress is stored in `~/.cooking-agi-interview/progress.json`.

### For maintainers

`data/` and `notes/` are generated from the English notes; do not edit them by hand.
After changing notes:

```bash
python site/skill_bundle.py
```

`python site/skill_bundle.py --check` exits non-zero when the committed bundle is stale.
