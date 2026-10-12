# Review assistants and planning assistants

Two uses, with different data and permissions. They must not share a catch-all agent with access to the repository, browser progress, and publishing credentials.

## 1. Content review — implemented first

`review_assist.py` prepares three independent role requests from the same explicitly selected public excerpts. Technical accuracy, teaching, and evidence/safety have separate responsibilities. A deterministic report groups their findings; a human checks them against the source and decides what to change. See [the review workflow](REVIEW_ASSIST.md).

```text
Maintainer selects public excerpts
              ↓
Validate size, paths and input shape; fingerprint the snapshot
              ↓
Technical reviewer ─ Teaching reviewer ─ Evidence/safety reviewer
              ↓
Validate each finding against an exact supplied quote
              ↓
Triage report + original role reports + missing-evidence questions
              ↓
Human verifies sources/tests → edits → normal PR review
```

The agents do not browse sources, run code, approve a PR, or publish. A link in an excerpt is not evidence that anyone read it. Three roles using the same model are not three independent experts; agreement is not factual verification. A failed or incomplete role stays visible. Deterministic checks still cover links, bilingual structure, data schemas, tests and leaks separately.

Default execution is local request preparation. Remote review requires an explicit public-input flag, model and API key; it can incur charges. No API calls or automatic GitHub bot were enabled in this iteration. A future PR integration must use a maintainer-approved snapshot, minimal read-only access, fixed input limits and a budget. Never run contributor code or expose secrets to fork PRs in a privileged review job.

## 2. Planning assistance — design, not a live model feature

The dashboard already works without AI. Route selection, editable date/minute previews and explicit saving are deterministic. A model would only be useful for suggesting a route when a person's goals do not fit those choices—not for adding a chat box to every button.

| Role | Input | Output | Must not do |
| --- | --- | --- | --- |
| Curriculum | Public catalog, declared goal and starting point | Note IDs, prerequisites, exercise order and short reasons | Invent notes or claim a reader has mastered them |
| Workload | User-approved available dates and effective minutes | A draft fitting that budget, plus optional work left out | Turn rest days into missed deadlines or assume daily availability |
| Plan critic | The proposed draft and the same constraints | Missing prerequisites, overload, duplicates and uncertainty | Score employability, guarantee an offer or silently rewrite a plan |
| Deterministic coordinator | Validated proposals, current local state | A visible diff for the user to accept or reject | Let an agent write directly to progress storage |

Start with one bounded parallel pass, then at most one revision after concrete feedback. Do not let agents keep negotiating until they agree. If constraints conflict, show the conflict and let the reader choose a smaller scope or more time. The existing manual route planner remains available when a model call fails or the user opts out.

### Proposed contract

A proposal needs `proposalVersion`, `catalogEdition`, `createdAt`, `goal`, and a list of items with a stable `noteId`, exercise description, proposed civil date, effective minutes and reason. It also lists prerequisites, omitted material and unresolved questions. It carries no arbitrary URLs or executable instructions. Title and destination come from the local trusted catalog, not from model output.

Before displaying it, validate IDs, types, bounds, dates, prerequisites and source revisions. Before accepting it, validate again against the current state: another tab may have added a session, the catalog may have changed, or capacity may have been reached. Show additions and conflicts, never silently remove or reschedule existing work. Explicitly distinguish **a draft**, **saved locally**, and **held in memory because storage failed**.

### Privacy boundary

Planning notes, study history and backups stay local. An optional future remote planner must first show exactly which fields would be sent and to which provider. Exclude private memos, reading history, usernames, resumes and full backups by default. An API key must never ship in the static site. A server-backed integration, abuse controls and provider-specific retention review would be a separate release—not an implicit requirement to use this dashboard.

### Progress compatibility

Accepted suggestions become ordinary version-1 sessions through the same storage API and backup flow. Agent output is not a second source of truth. An unaccepted proposal never changes saved progress. A future schema must retain old backup fixtures and migration tests. The site cannot promise to recover data after all browser copies and external backups are gone.

## Release checks

- Review: malformed output, fabricated quotes, partial failures, contradictory role findings, no network by default, and no automatic approval.
- Planning: preview/cancel leaves records unchanged; duplicate notes and stale proposals do not overwrite records; invalid batches make no partial changes.
- Persistence: old-format import, unknown records, another tab's edits, capacity limits, denied storage, local export and recovery.
- Interface: both languages, narrow screens, keyboard access and clear save status. No countdown, ranking or streak pressure.

Implementing these checks does not establish teaching quality or technical correctness. Those still need readers and maintainers to work through the material.
