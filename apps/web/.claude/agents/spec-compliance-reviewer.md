---
name: spec-compliance-reviewer
description: "DEPRECATED — Use /audit instead. The spec-compliance-reviewer has been replaced by the Super Audit V2 command which runs 9 streams with diff mode and false-positive suppression.\n\nExamples:\n\n- user: \"Review my payout feature code\"\n  assistant: \"I'll run /audit diff to check only changed files across all 9 streams.\"\n  (Use the Skill tool to invoke 'audit' with args 'diff'.)\n\n- user: \"Check the fee calculation logic\"\n  assistant: \"I'll run /audit 5 for deterministic money math verification.\"\n  (Use the Skill tool to invoke 'audit' with args '5' or 'money'.)"
model: haiku
color: cyan
memory: project
---

# DEPRECATED

This agent has been replaced by the `/audit` command (Super Audit V2).

**Use instead:** `/audit` or individual streams:
- `/audit 2` or `/audit auth` — Auth & CASL checks
- `/audit 5` or `/audit money` — Money math & banned terms (shell, deterministic)
- `/audit 6` or `/audit schema` — Schema alignment
- `/audit 7` or `/audit wiring` — Side effects & dead code (shell) — NEW
- `/audit 8` or `/audit stripe` — Stripe payment safety (shell + agent) — NEW
- `/audit 9` or `/audit hygiene` — Code hygiene (shell) — NEW
- `/audit diff` — Only audit changed files
- `/audit quick` — Shell streams only (fast)
- `/audit full` — Everything

See `.claude/commands/audit.md` for the full specification.
