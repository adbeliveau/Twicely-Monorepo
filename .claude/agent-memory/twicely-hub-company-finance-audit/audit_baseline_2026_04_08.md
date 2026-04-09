---
name: Audit baseline 2026-04-08 (updated post-Phase A-E remediation merge, commit cb87b89)
description: Two full audit runs for hub-company-finance domain. Both passed. Surface remains correctly future-only after Phase A-E remediation merge.
type: project
---

**Run 1:** 2026-04-08 (pre-remediation). Verdict: PASS.
**Run 2:** 2026-04-08 (post-Phase A-E audit-remediation merge, commit cb87b89). Verdict: PASS.

Both runs confirmed identical findings:

- `apps/web/src/app/(hub)/company/` directory does not exist — confirmed by glob returning no files and `ls` returning NO_COMPANY_DIR.
- No production source files (apps/web/src or packages/) contain `companyPnl`, `twicelyInc`, `COMPANY_FINANCE`, `COMPANY_FINANCE_READONLY`, `companyRevenue`, `companyExpense`, or `companyBudget` references. The role name and namespace are not yet implemented anywhere.
- Banned terms `SellerTier` and `SubscriptionTier` are absent from all production source code across both runs.
- Canonical document `TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md` exists and is LOCKED (v1.0, 2026-03-07).
- 7-year retention is documented in the canonical (R3 — retention rule #110 not yet applicable, surface not built).
- Agent files found under `.claude/agents/`: `twicely-hub-company-finance.md`, `twicely-hub-company-finance-audit.md`, `twicely-hub-company-finance-fix.md` — correct placement, not code. Glob `*company-finance*` returns only these 3 agent files — no production matches.
- The Phase A-E remediation merge introduced no company-finance scope creep into other domains.

**Why:** This domain is scheduled for E3 build phase. No premature implementation was found in either run.
**How to apply:** On future audit runs, compare against this baseline. Any appearance of `/company/**` routes, `COMPANY_FINANCE` role references, or `companyPnl` in production src would be the first drift signal.
