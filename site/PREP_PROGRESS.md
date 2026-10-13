# Preparation progress: storage and compatibility

Progress is user data, not content in Git. The browser controller uses the stable localStorage key `cooking-agi:prep-progress`; the latest pre-import snapshot uses `cooking-agi:prep-progress:before-import`. A site rebuild, normal pull, or content release must not reset either key. Do not include these keys in general UI-preference reset handlers.

The independent dashboard lives at `interview/dashboard.html` and `interview/dashboard.en.html`, on the same origin as the notes. It has its own navigation and layout rather than the article sidebar. The interview landing page remains the route chooser; its old `#schedule` and `#progress` anchors lead to a dashboard entry card. No storage key or format changes are needed, so existing records remain available. Article controls are optional and collapsed by default. Reading a page alone does not mark it as learned: a reader first chooses a status or writes a note. After that, the controller records the last visible section. No countdown, streak, score, or inferred mastery is collected.

The [session planner](../interview/dashboard.html#schedule) ([English](../interview/dashboard.en.html#schedule)) uses the same local storage and JSON backups. Readers choose dates, not a daily obligation, and can plan different effective minutes per session. Empty dates are rest. Check-ins are optional; each records an actual date, with actual minutes optional. Rescheduling, backfilling, undoing a check-in, and restoring a cancelled session do not carry streak or overdue penalties. A done session is not evidence of mastery. Date groups use the planned civil date, while completed rows show the actual date separately; UTC timestamps are used only for merge ordering.

The dashboard opens notes through the trusted generated catalog. Each article links back and offers “Plan a session for this note.” This passes only its stable note ID in a query parameter; the dashboard prefills a form from its own catalog, never saves a session automatically, and never overwrites an open draft. Language switching retains the section and valid note ID. Unknown IDs or external URLs cannot create a linked task. Backups and sequential cross-tab updates work as before.

## What is saved

The dashboard has five hash-addressed workspaces: overview, schedule, study routes, updates/settings, and notes/backups. Route suggestions reference existing notes and only prefill a draft; saving remains explicit. The week view derives planned counts and minutes from the same sessions. Topic and starting-point filters can be bookmarked in the URL; the current week, day filter, and unsaved form are page-local. See `STUDY_WORKSPACE.md` for the product flow, module boundaries, and next phases.

The version-1 JSON envelope has `format: "cooking-agi-prep-progress"`, `version: 1`, `site: "cooking-agi"`, `entries`, and `mode`. Entries are keyed by a stable note ID and contain a status, private note, display-title fallback, ISO timestamp, and optional section position with its language. The mode is `review` or `plan` with a timestamp. Exports add an `exportedAt` timestamp when space permits. Compact encoding keeps normal exports and pre-import backups within the same 2 MiB import limit; use `PrepProgressStore.encode` rather than pretty-printing recovery files.

The four statuses are `planned`, `learning`, `revisit`, and `practiced`. “Practiced this round” is a reader's own label, not evidence of mastery. Position links use only the generated, trusted catalog; imported titles and notes are rendered as text, never HTML. Imported URLs are not followed.

Sidebar bookmarks, recent notes and general reading positions now use the same envelope through `prep-library-state.js`. On first use it migrates the site's old `cooking-agi:reading:v1` and `cooking-agi:positions:v1` keys without deleting them. A preserved legacy copy retains paths not in today's catalog. New records use stable IDs, so a chapter rename with an ID override keeps bookmarks and positions. Removal uses timestamped tombstones rather than deletions; clearing recent reading does not remove bookmarks. Only this site's reading history is involved, never browser history from other sites. Theme, sidebar expansion and other display preferences remain separate; unsaved forms are not part of a backup.

### Optional workspace in version-1 backups

`workspace: {version: 1, records: {}, history: []}` stores topic follows, auto-add preferences, the content baseline, notices, revision acknowledgements, bookmarks, visits, positions and the migration marker. Each record has `updatedAt` and merges independently using the same policy as notes and sessions. Older backups without this extension do not erase it. Unsupported extension versions pause writes rather than resetting state. Unknown optional fields survive round trips. Up to 3,000 records and the latest 100 update actions fit within the shared 2 MiB and structural limits; the UI shows the latest 20 actions alongside closed notices. This is not unlimited history.

`content-updates.json` is an editorial manifest, not a hash of rendered pages. Its edition and note revisions are independent of the site release and backup format. All current learning notes start at edition 1. A new learning note must be registered explicitly or the build fails. Increment the edition for a content release; set `introduced` and `revision` to that edition for new notes. For substantive additions or factual corrections to an existing note, change only `revision` and include a short Chinese and English `summary`. Do not bump for layout, wording, translation polish, navigation order or source moves. Preserve stable IDs on renames. Keep old manifest records when a page is removed.

First use quietly records the current edition; it does not label the entire archive new. Saving a note or a linked session follows its topics unless the reader explicitly unfollowed. Following starts at the current edition. New notes introduced after that point enter an undated queue by default. With auto-add off they remain optional notices. Neither choice changes calendar dates or overwrites saved task text. Substantive revisions to tracked notes show separately, including on the article; acknowledging them never changes the learning status. Dismissal is revision-specific and can be reversed. Saving a planned session marks a queued notice scheduled; opening a draft alone does not.

### Reading history and reader settings (workspace records)

The reader hub (`static/reader-hub.js`, loaded on every page after the progress controller) adds two kinds of workspace records. They use the same envelope, merge, backup and recovery rules as other workspace records; no new storage key is created.

| Key | Fields | Meaning |
| --- | --- | --- |
| `reads-YYYYMMDD` | `notes`: up to 200 `note-…` IDs mapped to integers 0–9999; `updatedAt` | How many times each note was read on that local calendar day. A page counts once per load after 15 seconds of visible time; reading a page is not marking it learned. |
| `reader-settings` | optional `history` (boolean, default on), `mascot` (`open`, `collapsed`, `hidden`; default `collapsed`), `starAskedOn` (`YYYY-MM-DD` or empty), `starDone` (boolean), `snoozedUntil` (UTC timestamp or empty); `updatedAt` | Whether reading is counted, and the star notice: a small toast that appears at most once a day (after 20 seconds on a page) until the reader stars, chooses "Don't show again" (`starDone`, `mascot: hidden`), or snoozes it for 12 hours ("Not now" or ×). The Star pill in the top bar is always there; clicking it also counts as starred. Choosing Show in settings clears a snooze. |

Days older than 90 are emptied rather than deleted, so a later import cannot resurrect them by default and merges stay timestamp-based. Clearing reading history empties every day record and leaves bookmarks, notes and sessions untouched. Each day merges as one record, so the same day edited on two devices keeps the newer copy under the usual policies; counts are approximate, not an audit log. One record per active day accumulates against the 3,000-record workspace limit, which leaves years of daily use but is not unlimited. Turning counting off stops new counts without erasing old ones.

The hub's "Saved" tab reads and writes the existing `bookmark-…` records; it is the same list as the sidebar. Theme stays in its separate `theme` key; the settings tab only presses the existing toggle.

### Optional schedule in version-1 backups

Route-generated sessions can include an optional `exerciseId` (`exercise-` plus a stable lowercase alphanumeric/hyphen key). It distinguishes different exercises on one note and remains stable across languages and route reordering. Old sessions without it remain valid; imports preserve it as part of a session, and older readers already preserve safe unknown fields. It is not a completion score or a new outer backup version.

The outer export remains `version: 1`. Its optional `schedule` has its own `version: 1` and a `sessions` object keyed by session ID, with check-ins stored on those records. Validate the schedule when present before saving anything; an older backup without it is valid and does not erase local sessions. A malformed schedule or unsupported schedule version must not be silently discarded or partially imported.

| Session field | Accepted value |
| --- | --- |
| ID (key in `sessions`) | `session-` followed by 32 lowercase hexadecimal digits; stable across edits and restore |
| `title` | Nonblank text, at most 160 characters |
| `date` | Valid calendar date in `YYYY-MM-DD`, year 1900–2200 |
| `minutes` | Integer planned effective minutes, 1–1440 |
| `noteId` | Empty string or `note-` followed by 16 lowercase hexadecimal digits; never an imported URL |
| `status` | `planned`, `done`, or `cancelled` |
| `completedOn` | Valid date with the same format and year range when `done`; empty string otherwise |
| `actualMinutes` | `null` when unrecorded; a done session may use an integer from 0–1440, where zero is not missing |
| `updatedAt` | Canonical UTC ISO timestamp, such as `2026-10-11T12:00:00.000Z`, used for timestamp-based merge choices |

Allow at most **300 sessions, including cancelled tombstones**, within the existing envelope size limit. Cancellation retains the session ID and an updated record rather than deleting it; restore reuses that ID. Missing sessions in a backup are not deletions. A cancellation participates in the same merge policy as an active session, so explicitly preferring an older backup can restore an older active state. Do not silently purge tombstones to make room.

## Stable IDs and chapter moves

`site/prep_progress.py` identifies a bilingual pair using its canonical Chinese source path, independent of title, navigation position, and language. The default ID is `note-` plus the first 16 hexadecimal digits of SHA-256 of that path. The build produces a public ID-to-page catalog with no user data.

A **source-path rename needs an explicit alias** in `site/progress-id-overrides.json`: map the new canonical path to the old ID. Retrieve the old ID from the previous catalog before moving the source. Do not generate a fresh ID for an existing chapter or reuse an old ID for unrelated content. The build rejects duplicate IDs. Translation pairs must retain one identity. Anchors should also remain stable; if a section is removed, an old link still reaches the note, but cannot recover the removed section.

For a split, keep the old ID on the continuation or overview and give genuinely new chapters new IDs. For a merge, preserve the older page or provide a deliberate migration; do not silently collapse independent user notes. Unknown IDs remain in storage and exports even if the current catalog has no matching page.

## Import and recovery

1. Read a local file, check the 2 MiB limit, then parse and validate before any write.
2. Preview added records, conflicts, replacements, unknown chapters, and the resulting mode, with separate added/conflicting/replaced counts for sessions, including cancellations and restores.
3. Merge notes and sessions by their stable IDs. `keep-local` preserves existing records and adds missing ones; `newer` replaces a matching record only with a strictly newer `updatedAt`; `prefer-backup` uses the incoming record even when older. The selected policy applies per matching record, not as whole-schedule replacement.
4. Re-read browser storage when confirming, merge, and keep a pre-import snapshot including the schedule. Records missing from the imported file are not deleted; a missing `schedule` leaves the local schedule intact.
5. If storage fails, retain work in memory and offer export with a warning. A recovery snapshot is best-effort on disk and remains exportable in the current page if that write fails.

The parser checks the envelope, IDs, timestamps, statuses, lengths, nesting, and object count. It rejects prototype-related keys. Version 1 allows at most 1,000 records and 2,000 characters per note. Unknown optional fields and chapter IDs survive round trips. Bad input and unsupported versions do not mutate existing progress. An unreadable or future-format **existing** local record disables writes and can be exported unchanged; do not replace it with an empty default.

When a new edit exceeds a validation limit, keep the unsaved fields visible and offer a plain-text draft export on the article itself. This TXT file is for manual recovery, not JSON import; the UI must not claim the draft is already in the progress backup. Failed storage writes instead retain a valid state in memory and allow JSON export before leaving. If rebasing that state onto another tab exceeds the limit, preserve the two copies separately and pause writes rather than silently dropping records.

There is no automatic cloud sync or transactional multi-tab store. Sequential edits read the latest disk state, and storage events refresh the UI. Simultaneous writes can still race; keep one editing tab per note or session. Timestamp-based merging also depends on device clocks. Keeping current records is therefore the default, with explicit selection for conflicts.

The `:snapshots` key keeps up to three valid recovery copies, normally at least a minute apart; imports also request a pre-change copy. Copies are bounded to approximately 2 MiB in total, except a single largest valid envelope plus its wrapper. Quota failure must not prevent a successful primary write, and the UI warns when a recovery copy could not be stored. If the primary key disappears while recovery copies remain, pause writes and offer an explicit preview/restore instead of silently initializing empty state. Corrupt or future primary data remains exportable and is never automatically overwritten with a snapshot. Recovery copies can be downloaded even then. Clearing all site storage destroys these copies too: a file outside the browser is the recovery boundary. A user may keep exported files in a cloud-synced folder; the site neither connects to that service nor automatically overwrites files there.

## Future format changes

The first shipped format is version 1; there is no invented migration for an earlier format. A future writer must retain a tested migration path from version 1 before changing the version. Add immutable old-version fixtures, test migrations without modifying the input, preserve unknown records and optional fields where safe, and validate the migrated result before saving. Unsupported newer files must remain exportable but read-only in old site builds. Do not claim that this version can read arbitrary future schemas.

When editing this feature, test an old backup against the new catalog, a renamed chapter with its override, a missing chapter, a repeated import, an older restore, conflicting changes, storage denial/quota failures, and malformed or newer-version data. For schedules, also test absent schedules, invalid dates and minute bounds, all three merge policies and per-session counts, cancellation/restore, optional check-ins and undo, and the 300-session limit including tombstones. Never equate catalog presence or a checked-in session with mastery.

## Browser and repository boundaries

Persistence is scoped to browser profile and origin (protocol, domain, and port), not to the Git checkout; no fork or clone is needed to save progress or sessions. Switching a localhost port, moving from localhost to GitHub Pages, using another browser, or deploying a fork at another origin requires importing the backup. Private browsing, clearing site data, eviction, and storage failures can remove records. The site cannot quietly save an arbitrary file on someone's computer; export is an explicit download.

Keep backups outside the checkout. `.gitignore` includes `agi-prep-progress*.json` and `.study-progress/` as an extra safeguard, not a security boundary: differently named files and already-tracked files are not protected by those patterns. Do not commit private notes to a public fork. JSON files are not encrypted. Imports are parsed locally; no note or progress payload is uploaded. The public catalog fetch contains only site metadata.

## Checks

Run from the repository root:

```sh
node --test site/tests/prep-progress-store.test.cjs
python -m unittest discover -s site/tests -p 'test_prep_progress.py'
python -m unittest discover -s site/tests -p 'test_prep_hub.py'
python -m unittest discover -s site/tests -p 'test_prep_schedule.py'
python site/build.py
```

For browser checks, use a separate localhost port so synthetic test notes do not alter a reader's actual progress. Verify save/reload, language switching, import preview and cancellation, conflicts, export/reimport, unknown chapters, errors, keyboard controls, and narrow layouts. Do not reset a reader's storage to prepare a test.
