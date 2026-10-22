# Data safety and scoring fixes

The fix branch preserves database `namami`, store `state`, current key `namami-state-v1`, fallback key `namami-state`, and schema version 6. Do not change the production origin or clear site data during this release.

## Preservation

- Failed reads, unsupported records, or failed migration backups stop loading and saving. Samples are created only after successful reads confirm no saved record exists.
- Before adding migration metadata, save and verify the original record under a separate `namami-recovery:` key. Keep raw habit history, numeric logs, freeze dates, reward claims and their historical costs, adjustments, quotes, and unknown fields.
- Each successful IndexedDB save commits both the primary state and `namami-state-v1-protected` in one transaction. A version that bypasses the edit lock cannot overwrite the protected copy. If the copies disagree, stop and offer a recovery download containing both; do not merge or choose a history automatically.
- One copy edits at a time. Web Locks are preferred, with an IndexedDB lease for browsers without them. Every transactional save checks ownership and the previously saved state. Some browsers need up to 30 seconds to release a closed/reloaded copy; Retry then reopens it. A paused copy retains unsaved changes for download.
- Save errors are visible and retry the in-memory changes in order. Keep the app open while retrying. Browser/OS termination before a write completes cannot be made fully reliable by application code.
- Recovery copies are local to the same origin. They are not a cloud backup and do not survive the user or OS clearing all site data.

## Scoring rules

- Recorded completion booleans remain authoritative after goal edits. New logs use the current goal. Raw numeric values are retained.
- Daily schedules count consecutive days. Custom schedules skip off-days. Weekly frequency means one successful calendar week per streak step; weeks follow the existing Sunday–Saturday grouping. Additional recorded activity is retained.
- The all-tasks daily bonus considers tasks due that day, from their effective start. Weekly tasks are due on Saturday and can be satisfied earlier that week. Days with no due tasks do not create a bonus or streak step.
- New streak bonuses add the full configured amount at 3, 7, and 30 steps of each run. They remain earned when a run breaks. Milestone coverage prevents reloads, rechecking, or shifted backfilled dates from paying twice. Changing bonus rates does not reprice recorded bonus awards.
- On upgrade, retain at least the balance the released formula would display, using a protected opening amount. The old app did not store historical bonus payments, so the migration does not invent historical payment amounts or replay every past milestone. Base completion points and daily bonuses retain the app's existing current-configuration calculation; the new journal specifically persists streak earnings.
- MITHURA achievement badges use lifetime earnings, not the balance left after spending. Existing badges remain. Streak badges retain the existing repeated-milestone behavior, with durable identities for later runs.
- Ongoing habit progress uses completed scheduled periods among the most recent 30 eligible periods, excluding an unfinished current period. Target challenges retain completed-count / target progress. Both views use the same percentage, bounded at 100%.
- Rewards and freezes check the latest balance within the state update. Reward claims retain the price at purchase. Invalid numeric values are rejected without sanitizing old records.

## Offline updates

The generated service worker precaches the exact built JavaScript and CSS and uses a build-specific cache version. Failed or wrong-type network responses do not replace healthy cached assets. HTML fallback applies only to navigation. Updates wait for open copies to close, including when an older client asks the worker to skip waiting; no update forces a reload over an unfinished form or pending write.

## Verification and release

Run `npm ci`, `npm test`, `npm run lint`, and `npm run build`. CI repeats tests, lint, and build on Windows and Linux with Node 24. The regression suite covers schemas 1–6, unknown fields, exact pre-migration copies, load/save failures, edit races, one-editor coordination, protected-copy conflicts, timezones, day rollover, schedules, goal edits, bonuses, spending, and offline workers.

Before merging a production release, validate an installed Android/iOS app update and offline reopen using synthetic data on a staging origin. This was not tested on a physical phone during the local fix pass. Review a close/reopen cycle, the fallback lock delay, and recovery/error behavior. Do not test by clearing an existing user's storage.

If recovery detects conflicting copies, retain the downloaded JSON and both original browser records. Recovery selection/import needs deliberate review; automatic merging can duplicate spending or resurrect deleted habits. A general backup/import interface and custom-quote editor belong to a later feature phase.

The owner confirmed that real usage started with the current storage layout. No discovery of the pre-release default localforage database is added.

CI action versions follow the official [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node) documentation and are pinned to verified commits.
