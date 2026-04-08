# /twicely-fix — Apply a Canonical-Correct Fix to a Twicely Domain

Dispatch a fix to a Twicely domain fixer agent. Fixers read the canonical,
apply the correct fix in code, update related artifacts (tests, seed, settings,
canonicals when wrong), and re-verify the violation is gone.

**Input:** `$ARGUMENTS`

| Argument form | Behavior |
|---|---|
| `<domain> <rule_id> <file:line>` | Fix one specific violation |
| `<domain> <issue_description>` | Free-form fix request, dispatched to the domain fixer |
| `<domain> from-audit` | Read the latest audit report for that domain and fix every FAIL/DRIFT it found |
| `from-audit` | Read the latest `/twicely-audit all` rollup and fix every safe FAIL across all domains |
| `list` | List every fixable domain (same as the audit list) |
| _(empty)_ | Print this help |

---

## Step 0 — Read context

Before dispatching, read:
1. `.claude/twicely-agents.yaml` — to confirm the domain exists.
2. `.claude/audit/known-false-positives.md` — to skip suppressed findings.
3. The relevant canonical(s) for the target domain.

---

## Step 1 — Parse $ARGUMENTS

- Empty → print help, exit.
- `list` → list domains, exit.
- `<domain> <rest>` → dispatch to `twicely-<domain>-fix`. The remainder is
  the violation description.
- `from-audit` → read the most recent rollup from `.claude/audit/last-report.md`,
  enumerate each FAIL, dispatch one fixer per domain in sequence (NOT parallel —
  fixes can conflict).

---

## Step 2 — Dispatch fixer

For a single domain fix, launch `twicely-<domain>-fix` via the Agent tool with
the violation as input.

**Sequential rule:** unlike `/twicely-audit all` which runs in parallel, fixes
run **sequentially** to avoid conflicts. Two fixers touching the same file can
overwrite each other's changes.

**Cost guardrail:** fixers run on sonnet by default. The cost is fine. The
risk is correctness, not cost. Always re-verify after a fix.

---

## Step 3 — Verify and report

After each fixer completes:

1. Print its FIX report verbatim.
2. If verdict = `FIXED` → mark domain as resolved.
3. If verdict = `PARTIAL` → flag for user attention.
4. If verdict = `ESCALATED` → surface the user decision request immediately.

After all fixes complete, suggest:
> Re-run `/twicely-audit <domain>` to confirm the fix landed cleanly.

---

## Step 4 — Never invent

This command dispatches fixers — it does not fix anything itself. If a domain
fixer doesn't exist, fall back to the **generic fixer pattern** in
`.claude/agents/_template-fixer.md` and apply it via a general-purpose subagent
with the domain's expert + auditor agent files passed as context.

---

## Examples

```
/twicely-fix mk-browse R2 apps/web/src/app/(marketplace)/i/[slug]/page.tsx:64
→ Fixes the SOLD noindex bug per Decision #71

/twicely-fix hub-finance R10
→ Fixes all 3 hardcoded retention values per FC v3.0

/twicely-fix hub-crosslister 5 vs 25 publish limit — 5 wins per Decision #105
→ Updates publish-meter.ts fallback, lister-subscription-card UI copy, and
  the LISTER_CANONICAL doc

/twicely-fix mk-browse from-audit
→ Reads the latest mk-browse audit and fixes every FAIL/DRIFT

/twicely-fix from-audit
→ Reads the rollup and fixes every safe-to-auto-fix issue across all 19 domains
```

---

## What the fixer will do (summary of `_template-fixer.md` rules)

1. Read the canonical.
2. Check decision status (LOCKED, SUPERSEDED, etc.).
3. Categorize the fix (A-F).
4. List files to modify.
5. STOP if > 5 files — surface to user.
6. Apply the fix.
7. Update related artifacts (tests, seed, related code, agent files if needed).
8. Re-verify by re-running the auditor's grep/glob.
9. Report.

If the fix requires a database migration → fixer creates the migration file
but does NOT execute it.

If the canonical and code disagree and the fixer can't tell which side is
right → STOPS and asks the user.
