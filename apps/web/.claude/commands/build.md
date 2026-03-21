# /project:build — Full Pipeline Orchestrator

Run the complete build pipeline for a Twicely V3 build step. Delegates ALL work to
specialized agents — never write code yourself in this pipeline.

**Input:** `$ARGUMENTS` (e.g., `D6`, `E3`, `F1.2` — or leave blank to auto-detect)

---

## STAGE 0: Resolve Build Step

**If `$ARGUMENTS` is empty** (user just typed `/project:build` with no argument):

1. Read `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_BUILD_SEQUENCE_TRACKER.md`
2. Find the first step whose status is `queued` (not `done`, not `blocked`, not `skipped`)
3. Show the user what's next:

> **Next build step: [STEP_ID] — [Feature Name]**
>
> Status: queued
> Dependencies: [list any prerequisite steps, or "none"]
> Relevant specs: [list the canonical docs that apply]
>
> Run this step?

Use `AskUserQuestion` with options: "Yes, run [STEP_ID]" / "Show me the full queue first" / "Pick a different step"

- If **"Yes, run"** → set `$ARGUMENTS` to that step ID and continue to Stage 1.
- If **"Show me the full queue"** → read the tracker and list all remaining queued steps
  with their IDs, names, and dependencies. Then ask which one to run.
- If **"Pick a different step"** → ask which step ID they want. Then continue to Stage 1.

**If `$ARGUMENTS` is provided** — skip Stage 0, go directly to Stage 1.

---

## STAGE 1: Generate Install Prompt

Launch the **install-prompt-writer** agent (opus):

> "Write the install prompt for phase **$ARGUMENTS**. Read all relevant canonical specs
> from `C:\Users\XPS-15\Projects\Twicely\read-me\`, the schema doc, page registry,
> feature lock-in, build sequence tracker, and decision rationale. Output the full
> structured install prompt including the File Approval List and any Parallel Streams
> section if applicable."

After the agent returns:
- Save the full install prompt output — you will need it for Stage 3.
- Extract the **File Approval List** section from the output.
- Note whether a **Parallel Streams** section exists (for Stage 3 routing).

---

## STAGE 2: Human Approval Pause

Present the File Approval List to the user using `AskUserQuestion`:

> "**[$ARGUMENTS] File Approval List**
>
> The install-prompt-writer produced the following files to create/modify:
>
> [paste the File Approval List here]
>
> Approve to continue with implementation?"

Options: "Approved" / "Modify list first" / "Cancel pipeline"

- If **Approved** → proceed to Stage 3.
- If **Modify list first** → ask what changes, re-run Stage 1 with adjustments, then re-pause.
- If **Cancel pipeline** → stop and report "Pipeline cancelled at Stage 2."

---

## STAGE 3: Execute Implementation

Check if the install prompt contains a **Parallel Streams** section.

**If NO parallel streams** — single executor:

Launch the **install-executor** agent (sonnet):

> "Execute this install prompt faithfully. The user has already approved the file list.
> Skip the File Approval Protocol step — go directly to implementation.
>
> [paste the full install prompt from Stage 1]"

**If parallel streams exist** — launch the **parallel-decomposer** agent first:

> "Decompose this install prompt into parallel work streams:
>
> [paste the install prompt]"

Then launch one **install-executor** agent per stream, each with its self-contained
sub-prompt. Run them sequentially (agents cannot truly run in parallel from commands).

After executor(s) complete, summarize what was built (files created/modified, key decisions).

---

## STAGE 4: Review + Tests (in parallel)

Launch both agents simultaneously:

**4a — spec-compliance-reviewer** (opus):

> "Review ALL code changes from the $ARGUMENTS build step. Run `git diff` to find
> what changed. Check every file against the relevant canonical specs. Execute the
> full review checklist: banned terms, TypeScript violations, route prefixes, enum
> names, ownership model, schema compliance, file sizes, and security scan.
> Output a structured PASS/FAIL verdict with line-by-line findings."

**4b — test-writer** (sonnet):

> "Write comprehensive Vitest tests for the code implemented in the $ARGUMENTS build
> step. Run `git diff --name-only` to identify new/changed files. Read each file,
> read the relevant canonical specs, and write tests covering auth, validation,
> happy path, edge cases, and tier gates. Follow established mock patterns. Ensure
> test count stays >= BASELINE_TESTS from CLAUDE.md."

Wait for both to complete. Summarize their outputs.

---

## STAGE 5: Evaluate Results

Run the lint script:

```bash
./twicely-lint.sh
```

Evaluate all three inputs:
1. **Reviewer verdict** from Stage 4a
2. **Test results** from Stage 4b
3. **Lint script output** from above

**If ANY of these fail:**
- Report the exact failures (paste raw output, do not summarize).
- List specific violations with file paths and line numbers.
- Proceed to **Stage 5b** (automated error resolution).

**If ALL pass:**
- Report: "All checks passed. Proceeding to doc sync."
- Skip Stage 5b. Continue to Stage 6.

---

## STAGE 5b: Automated Error Resolution

Triage the failures from Stage 5 into two buckets:

**Bucket A — Lint-only failures** (banned terms, wrong routes, UX language, file sizes):
These are always safe find-replace fixes. Launch the resolver automatically:

Launch the **build-error-resolver** agent (sonnet):

> "Fix the following lint failures from the Twicely build pipeline. Parse the raw
> output below, classify each error, apply minimal surgical fixes for auto-fixable
> errors, and escalate the rest. Re-run `./twicely-lint.sh` after fixing to verify.
>
> Raw lint output:
> ```
> [paste the lint script output from Stage 5]
> ```"

**Bucket B — TypeScript errors, test failures, or spec violations:**
These may require design decisions. Ask the user before launching:

> "Stage 5 found [N] TypeScript error(s) / [N] test failure(s) / [N] spec violation(s).
>
> Launch the build-error-resolver to attempt automated fixes?"

Options: "Yes, attempt auto-fix" / "Show me the errors — I'll fix manually" / "Stop pipeline"

- If **"Yes"** — Launch the **build-error-resolver** agent with the relevant error output.
- If **"Show me the errors"** — paste raw output and stop. Say: "Fix the issues above, then run `/project:review $ARGUMENTS` to re-verify."
- If **"Stop pipeline"** — stop and report "Pipeline stopped at Stage 5b."

**After the resolver returns:**

Re-run `./twicely-lint.sh` to get a fresh full check.

- **If ALL pass now:** Report "All checks passed after auto-fix. Proceeding to doc sync." Continue to Stage 6.
- **If resolver escalated errors:** Report the escalations. Say: "The resolver fixed what it could but escalated [N] error(s) that need your input." List each escalation. **STOP.**
- **If new errors appeared:** Report them. **STOP.** Do not loop — say: "Auto-fix introduced new errors. Manual intervention needed."

---

## STAGE 6: Documentation Sync

Launch the **doc-sync-agent** (haiku):

> "Build step $ARGUMENTS is complete. All checks passed. Update all tracking documents:
> - Mark $ARGUMENTS as done in the build sequence tracker
> - Update CLAUDE.md baselines (test count, file count, last commit, last updated)
> - Update the build sequence summary table (Done/Remaining counts)
> - Add any new routes to the page registry if applicable
> - Add any new decisions to the decision rationale doc if applicable
>
> Read the current state of each doc before editing. Show before/after for each change."

After the agent returns, summarize what docs were updated.

---

## STAGE 7: Final Report

Present the consolidated report:

```
## [$ARGUMENTS] Build Pipeline — Complete

### Files Created/Modified
[list from Stage 3]

### Review Verdict
[PASS/FAIL + key findings from Stage 4a]

### Test Results
[count, new tests added from Stage 4b]

### Lint Results
[summary from Stage 5]

### Documentation Updated
[list from Stage 6]

### Next Step
[Read the build sequence tracker, find the next queued step after $ARGUMENTS,
and show: "Next up: [STEP_ID] — [Feature Name]. Run `/project:build` to continue."]
```

---

## Recovery

If the pipeline stops at any stage:
- **Stage 2 rejected** → adjust the prompt, re-run `/project:build $ARGUMENTS`
- **Stage 3 failed** → fix code, then `/project:review $ARGUMENTS`
- **Stage 5 failed** → Stage 5b auto-resolves lint errors; for TS/test errors, approve auto-fix or fix manually
- **Stage 5b escalated** → fix the escalated issues, then `/project:review $ARGUMENTS`
- **Stage 5b introduced new errors** → fix manually, then `/project:review $ARGUMENTS`
- **Docs not synced** → `/project:sync-docs $ARGUMENTS`
- **Want to preview first** → `/project:write-prompt $ARGUMENTS`
- **Fix errors outside pipeline** → `/project:fix-errors` (lint/typecheck/tests)
