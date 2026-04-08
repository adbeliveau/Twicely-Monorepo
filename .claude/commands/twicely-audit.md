# /twicely-audit — Run Twicely Domain Auditors

Run one or more Twicely domain auditors. Each auditor reads its own canonicals
and code paths, then produces a pass/fail compliance report. Auditors run on
sonnet by default for cheap parallelization.

**Input:** `$ARGUMENTS`

| Argument form | Behavior |
|---|---|
| `<domain>` | Audit one domain. E.g. `/twicely-audit hub-finance` |
| `all` | Audit every domain in the registry, in parallel. |
| `layer mk` | Audit every marketplace domain. |
| `layer hub` | Audit every hub domain. |
| `layer engine` | Audit every engine domain. |
| `changed` | Audit only domains whose owned paths changed since the last commit. |
| `changed main` | Audit only domains whose owned paths changed vs `main`. |
| `list` | List every auditable domain. |
| _(empty)_ | Print this help. |

---

## Step 0 — Read the registry and false positives

Before doing anything, read:
1. `.claude/twicely-agents.yaml` — source of truth for what exists.
2. `.claude/audit/known-false-positives.md` — anything in here is suppressed
   in the final report.

---

## Step 1 — Parse $ARGUMENTS

- Empty → print help, exit.
- `list` → print every domain id, layer, and title. Exit.
- `<domain>` → verify it exists in the registry. Set targets to that one.
- `all` → set targets = every `domains[].id`.
- `layer mk|hub|engine` → set targets = every domain at that layer.
- `changed` / `changed <branch>` →
  1. Run `git diff --name-only <branch>...HEAD` (default `<branch>`=`HEAD~1`).
  2. For each changed file, look up which domain owns it (registry
     `code_paths.*` lookup).
  3. Set targets = the union of those owners.
  4. If no domains match, print "No domains affected by changes" and exit.

---

## Step 2 — Dispatch auditors

For each target, launch `twicely-<id>-audit` via the Agent tool.

**Parallel rule:** if there is more than one target, launch ALL of them in a
single message with multiple `Agent` tool calls.

**Cost guardrail:** auditors run on sonnet by default, so `all` (18 parallel
sonnet invocations) is cheap. No confirmation prompt.

---

## Step 3 — Collect and roll up

For a single target: print the auditor's report verbatim.

For multiple targets, produce a rollup:

```
═══════════════════════════════════════════════════════════════════════════════
TWICELY AUDIT ROLLUP — <N> domains
═══════════════════════════════════════════════════════════════════════════════
Run at:        <ISO timestamp>
Scope:         <all | layer X | changed | etc.>

OVERALL VERDICT: <PASS | DRIFT | FAIL>
  PASS:  <count>
  DRIFT: <count>
  FAIL:  <count>

───────────────────────────────────────────────────────────────────────────────
DOMAIN VERDICTS
───────────────────────────────────────────────────────────────────────────────
  [PASS]  twicely-mk-browse
  [DRIFT] twicely-mk-checkout         (3 untracked files, 1 missing test)
  [FAIL]  twicely-hub-finance         (1 banned term, 2 unverified rules)
  ...

───────────────────────────────────────────────────────────────────────────────
TOP VIOLATIONS (FAIL only)
───────────────────────────────────────────────────────────────────────────────
1. twicely-hub-finance / R2: hardcoded $11.99 at .../page.tsx:42
2. twicely-mk-checkout  / R9: float math at .../checkout.ts:88
...

───────────────────────────────────────────────────────────────────────────────
DRIFT SUMMARY
───────────────────────────────────────────────────────────────────────────────
Files in code, missing from registry: <count>
Files in registry, missing from code: <count>
Schema mismatches:                    <count>
Test coverage gaps:                   <count>
═══════════════════════════════════════════════════════════════════════════════

Run /twicely-audit <domain> for the full report on any specific domain.
```

---

## Step 4 — Overall verdict

- `PASS` — every domain passed.
- `DRIFT` — at least one DRIFT, no FAIL.
- `FAIL` — at least one FAIL.

---

## Step 5 — Exit cleanly

If overall verdict is `FAIL`, suggest the next step:

> Run `/twicely-audit <failing-domain>` for full details, or
> `/twicely-ask <failing-domain> how do I fix <violation>?` for the expert's
> guidance.

If overall verdict is `DRIFT`, suggest:

> Drift means the registry and code have diverged. Run `doc-sync-agent` to
> update the registry, or update the affected canonical.

---

## Examples

```
/twicely-audit hub-finance
→ runs twicely-hub-finance-audit, prints full report

/twicely-audit all
→ fans out to all 18 auditors in parallel, prints rollup

/twicely-audit layer hub
→ audits all 9 hub domains in parallel

/twicely-audit changed
→ only audits domains whose code changed since HEAD~1

/twicely-audit changed main
→ only audits domains whose code changed vs main branch
```
