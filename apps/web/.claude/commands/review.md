# /project:review — Spec Compliance Review

Run a standalone spec compliance + security review on recent code changes.

**Input:** `$ARGUMENTS` (optional — e.g., `D6`, a file path, or blank for auto-detect)

---

## Step 1: Determine Scope

- **If `$ARGUMENTS` is a build phase** (e.g., `D6`, `E3`): scope the review to files
  changed in that phase. Use git log to find the relevant commit(s).
- **If `$ARGUMENTS` is a file path**: scope the review to that specific file.
- **If `$ARGUMENTS` is empty**: use `git diff --name-only HEAD~1` to find recently
  changed files. If no changes found, use `git diff --name-only` for unstaged changes.

Report the scope before launching the reviewer:
> "Reviewing [N] files: [list files]"

---

## Step 2: Launch Reviewer

Launch the **spec-compliance-reviewer** agent (opus):

> "Review the following files for spec compliance and security:
>
> [list the files from Step 1]
>
> Run the full review checklist from your system prompt. For each file:
> 1. Read the file contents
> 2. Identify which canonical specs apply
> 3. Read those specs from `C:\Users\XPS-15\Projects\Twicely\read-me\`
> 4. Check: banned terms, TypeScript violations, route prefixes, enum names,
>    ownership model, schema compliance, file sizes (300 line max), security
> 5. Output a structured PASS/FAIL verdict with line-by-line findings"

---

## Step 3: Present Results

Show the full review output. Then:

- **If PASS**: "All checks passed. Run `/project:sync-docs $ARGUMENTS` to update tracking docs."
- **If FAIL**: List each violation with file path, line number, and what's wrong.
  Say: "Fix the issues above, then re-run `/project:review $ARGUMENTS`."

Also run `./twicely-lint.sh` and append its raw output to the report.
