# Releases & updates {#updates}

[中文](updates.md) · **English**

This page records what belongs to each version. Future work lives in the [roadmap](roadmap.en.md). For edits to a particular article, use its source link and repository history.

## v1.0.0 · Study workspace {#v1-0-0}

**Unreleased · This is the proposed release scope, not a launch announcement.** Formal versions are identified by tags and commits in [GitHub Releases](https://github.com/tianyi-zhang-02/cooking-agi/releases). Merging a PR, deploying the website, and creating a release are separate steps.

This version addresses a practical problem: a growing library still doesn't tell you what to study today. It connects preparation routes, a personal schedule, and your notes. You can continue using the site purely as a reference if you prefer.

### What's included

- **A separate study dashboard:** overview, schedule, routes, updates/settings, and notes with backups, linked to the main library.
- **Two starting points:** introductory and review routes for ML / LLMs, post-training, inference systems, and algorithms. Eight routes contain 24 suggested exercises; timings are planning aids.
- **Your own schedule:** nonconsecutive dates, different durations, rescheduling, and optional records of actual study time. No daily check-in requirement.
- **Portable progress:** study records, sessions, bookmarks, reading positions and settings in one JSON backup, with an import preview and up to three browser recovery copies.
- **Content updates:** new notes in followed topics join an undated queue by default, with an opt-out. Only substantive revisions trigger notices; presentation edits do not change your schedule or study status.
- **Connected reading:** additions on data and supervision, RL methods and costs, inference framework internals, and a technology-history map. These are scoped learning materials, not a complete technical history or measured GPU benchmarks.
- **A way to contribute:** bilingual usage guides, a public roadmap, categorized feedback, contribution and licensing guidance. Optional AI review assistance does not approve or publish changes.

[Open the dashboard](../interview/dashboard.en.md) · [Choose a preparation route](../interview/README.en.md) · [Find a contribution](roadmap.en.md#contribute)

### Records and upgrades

This version keeps the existing version-1 progress format and stable chapter IDs. Routine site updates or a source pull do not deliberately reset records at the same browser origin. The site version and backup-format version are different things.

This is not cloud sync. Export and import when changing devices, browsers, or origins, or clearing site data. Unsaved forms do not survive a reload, and simultaneous edits in multiple tabs do not have transactional guarantees. Confirm your records were saved before exporting and retain the original backup. **Do not upload private backups to issues or the repository.**

### Known limits

- The dashboard covers the four topics above. CV, autonomous driving, Jetson, physical simulation, and robotics are proposed extensions, not completed routes.
- Finishing a session does not establish understanding. There is no automatic grading, ability prediction, or offer guarantee.
- Route updates do not rewrite saved tasks. Whole-route completion tracking is not implemented.
- There are no accounts, cloud sync, offline caching, or paid services. Export promptly if browser storage is unavailable; it is not permanent archival storage.
- Automated checks and browser spot-checks do not establish independent review of every technical claim or completion of GPU or hardware experiments.

### Before the release

1. Review the complete diff for private information, unlicensed material, and drafts meant only for social media; confirm the licensing scope of earlier contributions.
2. Run tests, bilingual, build, and link checks; exercise saving, restoration, language switching, and mobile layout in the dashboard.
3. Complete PR review and resolve outstanding issues. Neither AI review assistance nor passing CI substitutes for human approval.
4. After merging, verify the Pages deployment for that commit, then create its tag and release and update this page to the published state.

The [acceptance record](../CONTENT_RELEASE_CHECKLIST.md) tracks checks and their limits. The [release procedure](../site/RELEASING.md) is for maintainers. This page must not label the release as published before those steps are complete.
