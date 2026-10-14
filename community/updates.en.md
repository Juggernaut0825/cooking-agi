# Releases & updates {#updates}

[中文](updates.md) · **English**

This page records what belongs to each version. Future work lives in the [roadmap](roadmap.en.md). For edits to a particular article, use its source link and repository history.

## v1.0.0 · Interview prep {#v1-0-0}

**Unreleased · This is the proposed release scope, not a launch announcement.** Formal versions are identified by tags and commits in [GitHub Releases](https://github.com/tianyi-zhang-02/cooking-agi/releases). Merging a PR, deploying the website, and creating a release are separate steps.

This version addresses a practical problem: a growing library still doesn't tell you what to study today. It connects preparation routes, practice sets, and your own reading records. You can continue using the site purely as a reference if you prefer.

### What's included

- **One save button, one reading panel:** “Save this page” sits under a note's title. “My reading” at the top right shows which notes you read today and how often, alongside saved notes, settings, and backups. The separate study dashboard tried earlier is folded into it, and old links lead to the interview-prep page.
- **Two starting points:** introductory and review routes for ML / LLMs, post-training, inference systems, and algorithms. Eight sets hold 24 exercises, collected in the [study plan](../interview/study-plan.en.md#routes); timings are planning aids.
- **Portable records:** saved notes, reading history, and reading positions in one JSON backup; importing merges, keeping the newer copy of each record.
- **Technology world tree:** how power, chips, software, data and models each developed and where they met, with 143 milestones and 59 sourced connections arranged by period. Open a milestone to see its connections, or select a field to follow one line. It is a scoped selection, not a complete history.
- **New notes:** data and supervision, RL methods and costs, and inference framework internals. These are scoped learning materials, not measured GPU benchmarks.
- **A way to contribute:** bilingual usage guides, a public roadmap, categorized feedback, contribution and licensing guidance. Optional AI review assistance does not approve or publish changes.

[Choose a preparation route](../interview/README.en.md) · [Find a contribution](roadmap.en.md#contribute)

### Records and upgrades

This version keeps the existing version-1 progress format and stable chapter IDs. Routine site updates or a source pull do not deliberately reset records at the same browser origin. The site version and backup-format version are different things.

This is not cloud sync. Export and import when changing devices, browsers, or origins, or clearing site data. Simultaneous edits in multiple tabs do not have transactional guarantees. Confirm your records were saved before exporting and retain the original backup. **Do not upload private backups to issues or the repository.**

### Known limits

- Preparation routes cover the four topics above. CV, autonomous driving, Jetson, physical simulation, and robotics are proposed extensions, not completed routes.
- Reading or saving a note does not establish understanding. There is no automatic grading, ability prediction, or offer guarantee.
- There are no accounts, cloud sync, offline caching, or paid services. Export promptly if browser storage is unavailable; it is not permanent archival storage.
- Automated checks and browser spot-checks do not establish independent review of every technical claim or completion of GPU or hardware experiments.

### Before the release

1. Review the complete diff for private information, unlicensed material, and drafts meant only for social media; confirm the licensing scope of earlier contributions.
2. Run tests, bilingual, build, and link checks; exercise saving, backup export and import, language switching, and mobile layout.
3. Complete PR review and resolve outstanding issues. Neither AI review assistance nor passing CI substitutes for human approval.
4. After merging, verify the Pages deployment for that commit, then create its tag and release and update this page to the published state.

The [acceptance record](../CONTENT_RELEASE_CHECKLIST.md) tracks checks and their limits. The [release procedure](../site/RELEASING.md) is for maintainers. This page must not label the release as published before those steps are complete.
