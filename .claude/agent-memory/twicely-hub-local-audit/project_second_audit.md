---
name: Second hub-local audit (2026-04-08, post Phase A-E remediation, commit cb87b89)
description: DRIFT verdict — Phase 3 state machine guards confirmed, Phase 5 cash sale action layer missing from apps/web, noShowFee UI still present in local-transaction-detail.tsx, storefront/seller-card absorption confirmed
type: project
---

Audit date: 2026-04-08 (post Phase A-E audit-remediation merge, commit cb87b89)

**Verdict: DRIFT (non-blocking)**

**Phase 3 state machine guards — CONFIRMED at all 7 write sites:**
- `local-transaction.ts`: `confirmLocalTransactionAction` uses `canTransition(tx.status, 'COMPLETED')`
- `local-transaction.ts`: `checkInToMeetupAction` uses `canTransition(tx.status, targetStatus)`
- `local-transaction.ts`: `confirmReceiptAction` uses `canTransition(transaction.status, 'RECEIPT_CONFIRMED')`
- `local-transaction.ts`: `confirmReceiptManualAction` uses `canTransition(transaction.status, 'RECEIPT_CONFIRMED')`
- `local-price-adjustment.ts`: `initiatePriceAdjustmentAction` uses `canTransition(transaction.status, 'ADJUSTMENT_PENDING')`
- `local-transaction-offline.ts`: both offline confirmation actions use `canTransition(transaction.status, 'RECEIPT_CONFIRMED')`
- `local-cancel.ts`: uses `canTransition(tx.status, 'CANCELED')`
All 7 confirmed.

**Phase 5 cash sale — DRIFT:**
- `packages/commerce/src/local-cash-sale.ts` and `local-cash-complete.ts` exist with correct logic
- `apps/web/src/lib/actions/local-cash-sale.ts` and `local-cash-complete.ts` do NOT exist
- No server action wires the cash sale recording to a UI entry point
- `LOCAL_CASH_SALE_REVENUE` is consumed in finance-center-detail.ts and finance-center-reports-pnl.ts (read side works; write side is missing)
- Phase 5 wiring is documented as complete in the user's note but the action files are absent

**Stale noShowFee UI — PERSISTS from first audit:**
- `apps/web/src/components/hub/orders/local-transaction-detail.tsx:123-126` still renders noShowFeeCents fee amount and charge date when `tx.noShowFeeCents !== null`
- Schema column `noShowFeeCents` is nullable (correct — legacy data only), no active charge path
- UI is guarded by `tx.noShowParty` check at line 118, so it only renders if `noShowParty` is set
- A5 removed monetary penalties; this display is stale but harmless (column always null in new data)

**Component absorption — CONFIRMED (prior FP still valid):**
- `storefront-header.tsx` imports and renders `<LocalMeetupStats>` (line 8, 227)
- `seller-card.tsx` imports and renders `<LocalMeetupStats>` (line 5, 87)
- Standalone `storefront-header-local.tsx` and `seller-card-local.tsx` are intentionally absent

**How to apply:** Phase 5 cash sale action files are the outstanding gap. noShowFee UI cleanup is a cosmetic backlog item. Both have no active charge path.
