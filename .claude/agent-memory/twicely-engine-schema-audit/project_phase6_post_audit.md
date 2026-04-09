---
name: Phase 6 engine-schema post-audit (2026-04-08)
description: Audit results after Phase 6 schema hygiene commit (06ebc88) on chore/contributing-and-ci-fix
type: project
---

Phase 6 landed clean on all 8 business rules. VERDICT: PASS (1 canonical drift, suppressed per FP-032 pattern).

**Fact:** Phase 6 commit (06ebc88) regenerated the baseline migration (0000_happy_phalanx.sql, 3180 lines) rather than creating an incremental 0038_add-ledger-idempotency-key.sql. The idempotency key column + partial unique index are correctly present in the baseline.

**Why:** The audit prompt described `drizzle/0038_add-ledger-idempotency-key.sql` as a Phase 6 catchup but the implementation chose to regenerate the full baseline instead. Both approaches produce identical DB state. The incremental file does not exist.

**How to apply:** In future audits, do not flag the missing 0038_ migration — the baseline was the chosen strategy. The journal only has entry 0 (0000_happy_phalanx).

**Canonical drift (non-blocking):** `ledgerEntryTypeEnum` has 2 values beyond the v2.1.0 spec: `LOCAL_CASH_SALE_REVENUE` (Phase 5 / §8/A16) and `BOOST_CREDIT_ISSUED` (Seller Score Canonical §5.4). Spec doc not yet updated. Owner aware (same pattern as FP-032).

**Schema file count:** 37 .ts files in packages/db/src/schema/ (36 domain + index.ts). The 38+ threshold in STEP 0 was set when enums.ts was counted separately. Actual structure: 36 domain files + index is correct.
