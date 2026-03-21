# I3+I4 Finance Gaps + Enrichment -- Findings

## Key Architecture Decisions
- Chargebacks are NOT a separate table. They are ledger entries grouped by `stripeDisputeId` (types: CHARGEBACK_DEBIT, CHARGEBACK_REVERSAL, CHARGEBACK_FEE).
- Reserve holds are NOT a separate table. They are ledger entries (RESERVE_HOLD / RESERVE_RELEASE) matched via `reversalOfEntryId`.
- Subscription overview must aggregate 5 separate tables: storeSubscription, listerSubscription, automationSubscription, financeSubscription, bundleSubscription.
- All subscription tables reference `sellerProfileId` (NOT userId). Must JOIN through sellerProfile to get userId/user name.

## CASL Gaps Found
- `Chargeback` and `Hold` subjects listed in Actors Security Canonical 4.3.4 but NOT in subjects.ts.
- `Reconciliation` and `Finance` also listed in canonical but existing pages use `Payout` / `LedgerEntry` -- no immediate need to add them.
- FINANCE role only gets: `can('read', ['Order', 'Payout', 'LedgerEntry', 'AuditEvent', 'User'])` and `can('update', 'Payout', { field: 'holdStatus' })`.

## Existing Page State (Pre-Enrichment)
- All E3.4 finance pages are basic: simple tables, no filters beyond 1 field, no drill-down links.
- `/tx/payments` queries `order` table directly (not `orderPayment`!) -- needs to switch to orderPayment for fee breakdown.
- Inline `formatCents` functions duplicated in 8+ pages -- should all use `formatCentsToDollars` from `@/lib/finance/format`.
- No query test files exist for admin-finance.ts or admin-orders.ts (zero test coverage on query layer).

## Spec Gaps Identified
1. No formal "chargeback case" entity -- grouping by stripeDisputeId is inferred from schema, not explicitly specified.
2. Hold matching via reversalOfEntryId direction not explicitly stated.
3. MRR calculation method for annual subs not specified.
4. Escrow timer should read `commerce.escrow.holdHours` from platform_settings.
5. Chargeback status (Open vs Lost) not distinguishable without Stripe API call.

## File Count
- 13 new files + 9 modified files = 22 total
- ~40-55 new tests expected

## Page Registry Gap
- `/fin/chargebacks`, `/fin/chargebacks/[id]`, `/fin/holds`, `/fin/subscriptions`, `/fin/payouts/[id]` are NOT in the Page Registry doc (only in Build Sequence Tracker I3 description). This is a documentation gap.
