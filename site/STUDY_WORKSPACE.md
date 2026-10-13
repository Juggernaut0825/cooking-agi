# Study workspace architecture

The dashboard is a separate learning workspace inside the same static site. The library explains concepts; the workspace helps readers choose a task, make time for it, return to the source, and keep their own notes. It is not a second textbook or a company-specific interview service.

## Reader needs

| Reader | Starting point | Useful next action |
| --- | --- | --- |
| New to a topic | Small examples with prerequisites | Trace one operation before implementing a whole system |
| Returning to familiar material | Implementation, debugging, and tradeoffs | Try an exercise, then revisit the missing explanation |
| Already following a plan | Their own task and available dates | Add a session without adopting a preset route |

Suggested minutes are an allowance for one attempt, not an estimate of how quickly someone should master the chapter. Dates can be nonconsecutive, durations can differ, and check-ins are optional. There are no streaks, penalties, rankings, mastery scores, or offer guarantees.

## Five workspaces

- **Overview** shows the next planned task, a note to resume, and counts of saved records. Counts describe activity, not ability.
- **My schedule** combines a week view with editable sessions. Select a date to filter its plans or leave dates unfiltered to browse the full list.
- **Study routes** offers four topics and two starting points. Each route has three concrete exercises connected to existing bilingual notes.
- **Notes and backups** keeps chapter statuses, private memos, import previews, export, and recovery together.
- **Updates and settings** follows topics, keeps new notes in an undated queue, and distinguishes substantive revisions from presentation edits. It shares the progress envelope with sidebar bookmarks and reading positions.

The stable entry is `interview/dashboard.html` or `interview/dashboard.en.html`. Hashes select overview, schedule, routes, or progress; topic and level query parameters make a route bookmarkable. Browser history and language changes preserve these selections. A reader can use the library without the dashboard and vice versa.

Without JavaScript, all five page sections remain in the document and the route reading links work. Editing progress and schedules requires JavaScript. The app hides inactive panels only after enhancement.

## One source of learning content

`site/study-routes.json` contains route IDs, topic and level, independently written Chinese and English labels, and exercise suggestions. An exercise references the canonical source path and an editable suggested duration. It does not duplicate the chapter body.

`site/prep_workspace.py` validates both language destinations, route IDs, labels, and durations, then renders the route cards at build time. Broken sources fail the build rather than producing dead buttons. The generated progress catalog remains the authority for note destinations.

To revise a route:

1. Read its destination chapters, including any prerequisites or limits.
2. Update the two language descriptions and the actual task in `study-routes.json`.
3. Check that the exercise can be attempted from the linked explanation; do not promise completion within the suggested minutes.
4. Run the workspace tests, bilingual parity, build, and link check.
5. Preserve source IDs when moving chapters, following `PREP_PROGRESS.md`.

Changing a route does not edit someone's existing session. Once saved, the task title and planned duration belong to the reader. This version does not track route completion or retroactively match old sessions to revised exercises.

## Data ownership and boundaries

| Data | Owner | Where it lives |
| --- | --- | --- |
| Notes, routes, translations | Contributors | Versioned repository sources |
| Note destination catalog | Build | Public static JSON |
| Session dates, titles, durations and check-ins | Reader | Existing local progress envelope |
| Chapter status and private memo | Reader | Same local progress envelope |
| Current route and workspace | Reader interface | URL |
| Selected week, day filter and open form | Current page | Memory only |

No account, backend, telemetry, or external synchronization is added. A git pull changes code and content, not browser progress. Browser eviction, private browsing, changing origins, or clearing site data can still lose local records. Export is an explicit download, not an automatic file save. See `PREP_PROGRESS.md` for the complete version-1 backup contract.

Panel changes preserve an open form in the current page. Adding another route exercise cannot replace it: save or cancel first. Unsaved forms are not progress records and do not survive a page reload or language navigation. Saved sessions do.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `prep-progress-store.js` | Validation, merge policy, local persistence and recovery |
| `prep-progress.js` | Article controls, catalog, export/import UI and shared API |
| `prep-schedule.js` | Session forms, validation, filtering, edits and check-ins |
| `prep-calendar.js` | Civil-date arithmetic, week navigation and derived planned counts |
| `prep-workspace.js` | Workspace routing, overview, route filters and plan requests |
| `prep-route-planner.js` | Editable route preview, duplicate checks and explicit batch insertion |
| `prep_workspace.py` | Route validation and static bilingual markup |
| `prep-workspace.css` | Dashboard layout and theme-scoped presentation |

The workspace and calendar read state through PreparationProgress. Individual exercises dispatch `notes:prep-plan-request` with a catalog ID, title and minutes; the session controller validates it and opens a draft. The route planner can also prepare several sessions together. Neither path saves automatically.

## Route preview

“Plan this route” opens a page-local draft. Each exercise has its own checkbox, date and effective minutes; the initial two-day spacing is only an editable suggestion. Each step has an explicit stable exercise ID, separate from its note ID: two different exercises can use the same chapter. Preserve these IDs when translating, rewording or reordering steps. Existing non-cancelled sessions with the same exercise ID are excluded across languages. For old or manually created sessions without an exercise ID, a matching note is conservatively excluded. Repeated practice is still available through the individual-session form. Note status alone does not imply a completed session or mastery.

Saving rechecks catalog membership and inserts the selected sessions through `addSessions`. It reads the latest stored state, rejects ID collisions or duplicate notes, validates the whole result and only then writes once. Invalid or over-capacity batches do not leave half a route saved. Storage denial keeps the batch in memory with an explicit export warning. This uses the existing version-1 sessions; exports, merge policies and recovery need no new format. As with the existing localStorage implementation, this is not a cross-tab transactional database: truly simultaneous writes remain a limitation.

The draft survives panel/filter changes, but not reload or language navigation; it is visibly labelled unsaved. Another route cannot replace it until saved or cancelled. Successful saves refresh the schedule, calendar and overview from the shared store. No local private records are sent to a model. See [agent-system boundaries](AGENT_SYSTEMS.md) for the separately designed, not-yet-connected planning agents.

`notes:prep-day` carries a civil date or an empty string to clear the filter. The calendar displays only **planned** sessions and planned minutes. It does not infer actual study from a scheduled date. Existing completed-session lists remain grouped by planned date, and separately show actual study dates and optional actual minutes. Date arithmetic uses UTC noon for calendar calculations, while “today” uses the reader's local date.

Keep feature assets scoped to the dashboard. Do not add another framework, service worker, or global navigation override merely to implement a panel.

## Verification

Run from the repository root:

~~~sh
python -m unittest discover -s site/tests -p 'test_prep_*.py'
python site/paritycheck.py --strict
python site/leakcheck.py
python site/build.py
git diff --check
~~~

The tests cover the store contract, schema failures, old backups, cross-tab conflicts, drafts, plan requests, filters, date boundaries, leap days, and language parity. Browser QA must also cover:

- Route → editable draft → saved session → linked note → dashboard.
- Nonconsecutive dates, unequal durations, optional actual minutes, rescheduling and cancellation.
- Hash navigation, language switching, reload and a previously saved progress file.
- Light and dark themes at desktop and narrow mobile widths.
- Keyboard focus after hiding a panel or replacing a calendar day.
- Storage or catalog failures without claiming an unsaved draft is saved.

Use an isolated localhost origin for synthetic records; do not populate a reader's real dashboard with test sessions.

## Further development

The public [roadmap](../community/roadmap.en.md) is the reader-facing source for priorities and contribution opportunities. The [release notes](../community/updates.en.md) track release status; this architecture document is not a shipping announcement. Keep route IDs, chapter IDs, and the backup-format version independent of site release numbers.

These are follow-up phases, not features already shipped:

1. **Better planning**: build on the existing searchable note selection and multi-session route preview; consider explicit rescheduling of a group. No automatic calendar filling or silent overwrite.
2. **Richer review**: filters for a reader's chapter records and a way to attach their own practice outcomes. Avoid treating a click as evidence of understanding.
3. **Portability**: immutable backup fixtures and tested migrations before changing the schema. Optional local-file workflows need explicit file permissions.
4. **Offline or cross-device use**: consider only after the local flow is reliable. Offline caching needs an update strategy; cloud sync needs authentication, privacy decisions and conflict handling. Neither is implied by the current local backup feature.

Keep the useful loop small even as coverage grows: choose, plan, learn, leave a note, return.
