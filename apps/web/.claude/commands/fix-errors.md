# /project:fix-errors — Automated Error Resolution

Fix build errors using the build-error-resolver agent. Can target a specific check
or run all checks and fix everything that's auto-fixable.

**Input:** `$ARGUMENTS` (optional — `lint`, `typecheck`, `tests`, or blank for all)

---

## Step 1: Run the Relevant Check(s)

Based on `$ARGUMENTS`, run the appropriate check and capture the raw output:

- **`lint`** — Run `./twicely-lint.sh 2>&1` and capture full output.
- **`typecheck`** — Run `pnpm typecheck 2>&1` and capture full output.
- **`tests`** — Run `pnpm test 2>&1` and capture full output.
- **blank (all)** — Run `./twicely-lint.sh 2>&1` and capture full output.
  This covers TypeScript, tests, banned terms, routes, file sizes, and UX language.

If the check passes with zero failures, report:

> "All checks passed. Nothing to fix."

And stop.

---

## Step 2: Classify Errors

Before launching the resolver, do a quick triage of the failures:

- **Lint-only failures** (banned terms, wrong routes, UX language, file sizes):
  These are always safe to auto-fix. Proceed directly to Step 3.

- **TypeScript errors**:
  Show the user the error count and ask:

  > "Found N TypeScript error(s). Launch the build-error-resolver to fix them?"

  Options: "Yes, fix them" / "Show me the errors first" / "Skip — I'll fix manually"

  - If **"Show me the errors first"** — paste the raw TS error output, then re-ask.
  - If **"Skip"** — stop and report the errors only.

- **Test failures**:
  Show the user the failure summary and ask:

  > "Found N test failure(s). Launch the build-error-resolver to diagnose?"

  Options: "Yes, diagnose and fix" / "Show me the failures first" / "Skip — I'll fix manually"

  - If **"Show me the failures first"** — paste the raw test output, then re-ask.
  - If **"Skip"** — stop and report the failures only.

---

## Step 3: Launch Resolver

Launch the **build-error-resolver** agent (sonnet):

> "Fix the following build errors. Parse the raw output below, classify each error,
> apply minimal surgical fixes for auto-fixable errors, and escalate the rest.
> Re-run the specific check after each fix to verify.
>
> Error source: [lint | typecheck | tests]
>
> Raw output:
> ```
> [paste the captured output from Step 1]
> ```
>
> After fixing, re-run the full check (`./twicely-lint.sh` for lint, `pnpm typecheck`
> for TS, `pnpm test` for tests) and include the re-run output in your report."

---

## Step 4: Present Results

Show the resolver's Error Resolution Report. Then:

- **If all errors fixed and verified:**
  > "All errors resolved. Run `./twicely-lint.sh` for a final full verification,
  > or continue with `/project:build` to resume the pipeline."

- **If some errors were escalated:**
  > "Fixed N of M errors. The following N errors need your input:"
  > [list each escalated error with the resolver's escalation details]

- **If new errors appeared from fixes:**
  > "Fixes introduced N new error(s). These have been escalated for manual review:"
  > [list the new errors]
