# /project:sync-docs — Documentation Sync

Update all tracking documents after a build step is complete and verified.

**Input:** `$ARGUMENTS` (e.g., `D6`, `E3.1`)

---

## Step 1: Launch Doc Sync Agent

Launch the **doc-sync-agent** (haiku):

> "Build step $ARGUMENTS is complete and all checks have passed. Synchronize all
> tracking documents to reflect the current codebase state:
>
> 1. **Build Sequence Tracker** (`read-me/TWICELY_V3_BUILD_SEQUENCE_TRACKER.md`):
>    Mark $ARGUMENTS as done with today's date, update summary counts
> 2. **CLAUDE.md**: Update BASELINE_TESTS, BASELINE_FILES, LAST_COMMIT, LAST_UPDATED
> 3. **Page Registry** (`read-me/TWICELY_V3_PAGE_REGISTRY.md`): Add any new routes
> 4. **Decision Rationale** (`read-me/TWICELY_V3_DECISION_RATIONALE.md`): Add any
>    new decisions made during implementation
>
> Read each file's current state before editing. Show before/after values for every
> change you make. Run `pnpm test` and `git log --oneline -1` to get current values."

---

## Step 2: Present Report

Show the sync report with before/after values for each document updated.

Remind the user: "Doc changes are ready. Commit when you're satisfied:
`git add -A && git commit -m 'chore: update tracking docs — $ARGUMENTS complete'`"
