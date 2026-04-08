---
name: Audit baseline 2026-04-08
description: First full audit run for hub-company-finance domain. All checks passed. Surface is correctly future-only.
type: project
---

First audit run on 2026-04-08. Verdict: PASS.

- `apps/web/src/app/(hub)/company/` directory does not exist — confirmed by glob returning no files.
- No production source files (apps/web/src or packages/) contain `companyPnl`, `twicelyInc`, `COMPANY_FINANCE`, or `companyFinance` references. The role name and namespace are not yet implemented anywhere.
- Banned terms `SellerTier` and `SubscriptionTier` are absent from all production source code. Matches in `install-prompts/` and `twicely-lint.sh` are negative-assertion contexts (install checklists and lint ban-list), not violations.
- Canonical document `TWICELY_V3_COMPANY_FINANCES_CANONICAL_v1_0.md` exists and is LOCKED (v1.0, 2026-03-07).
- 7-year retention is documented in the canonical at line 834 ("Retained for 7 years per financial record retention policy") and the platform_settings seed key `company.finance.recordRetentionYears: 7` at line 1127.
- Agent files found under `.claude/agents/`: `twicely-hub-company-finance.md`, `twicely-hub-company-finance-audit.md`, `twicely-hub-company-finance-fix.md` — correct placement, not code.

**Why:** This domain is scheduled for E3 build phase. No premature implementation was found.
**How to apply:** On future audit runs, compare against this baseline. Any appearance of `/company/**` routes, `COMPANY_FINANCE` role references, or `companyPnl` in production src would be the first drift signal.
