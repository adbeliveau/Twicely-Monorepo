# [I3+I4] Finance Gaps + Finance & Transaction Enrichment

**Phase:** I (Admin Panel V2-to-V3 Port)
**Steps:** I3 + I4 (combined — I4 depends on I3)
**Feature Name:** Finance Gaps + Finance & Transaction Enrichment
**One-line Summary:** Create 5 missing finance hub pages (payout detail, chargebacks, holds, subscriptions) and enrich 6 existing finance/transaction pages with production-grade filtering, drill-down, and inline data.
**Canonical Sources (READ ALL before starting):**
- `TWICELY_V3_FINANCE_ENGINE_CANONICAL.md` -- ledger architecture, posting rules, balance derivation, payout execution, reconciliation, chargeback flow, reserve holds
- `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` -- TF brackets, payout tier matrix, escrow rules, subscription pricing, UX language pack
- `TWICELY_V3_SCHEMA_v2_1_0.md` -- all table/column/enum definitions (sections 11.1-11.7, 6.3-6.5, 3.1-3.5, 7.3)
- `TWICELY_V3_PAGE_REGISTRY.md` -- routes 88-97d (Section 8.4-8.5)
- `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` -- CASL rules for FINANCE role (Section 4.2), custom role subjects (Section 4.3.4)

---

## 1. PREREQUISITES

| Requirement | Status |
|---|---|
| Phase E3 (Admin hub pages) | COMPLETE |
| Phase E3.4 (Finance hub pages) | COMPLETE |
| `ledgerEntry`, `sellerBalance`, `payoutBatch`, `payout`, `feeSchedule`, `reconciliationReport`, `manualAdjustment` tables | EXIST in `src/lib/db/schema/finance.ts` |
| `order`, `orderItem`, `orderPayment` tables | EXIST in `src/lib/db/schema/commerce.ts` |
| `storeSubscription`, `listerSubscription`, `automationSubscription`, `financeSubscription`, `bundleSubscription` tables | EXIST in `src/lib/db/schema/subscriptions.ts` |
| `dispute` table | EXISTS in `src/lib/db/schema/commerce.ts` |
| `src/lib/queries/admin-finance.ts` | EXISTS (5 query functions) |
| `src/lib/queries/admin-orders.ts` | EXISTS (5 query functions) |
| `src/lib/finance/format.ts` exports `formatCentsToDollars` | EXISTS |
| CASL subjects `Payout`, `LedgerEntry`, `Order`, `Subscription` | EXIST in `src/lib/casl/subjects.ts` |

**Dependencies NOT met (installer must address):**
- CASL subjects `Chargeback`, `Hold`, `Reconciliation`, `Finance` are listed in Actors Security Canonical Section 4.3.4 but NOT yet in `src/lib/casl/subjects.ts`. The installer MUST add them to complete I3.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### 2A. I3 -- Five New Finance Pages

#### 2A.1 `/fin/payouts/[id]` -- Payout Detail Page

**Route:** `src/app/(hub)/fin/payouts/[id]/page.tsx`
**Gate:** STAFF(ADMIN, FINANCE)
**CASL check:** `ability.can('read', 'Payout')`

This page provides drill-down from the payouts list. Shows:

1. **Payout header card:** Amount (formatCentsToDollars), status badge (color-coded: PENDING=yellow, PROCESSING=blue, COMPLETED=green, FAILED=red, REVERSED=gray), created date, completed/failed date.
2. **Seller info card:** Link to `/usr/{userId}` showing user name + email. Show `isOnDemand` flag.
3. **Batch info card** (if `batchId` exists): Link to batch, show batch status, totalSellers, successCount, failureCount.
4. **Stripe correlation section:** Show `stripeTransferId` and `stripePayoutId` as monospace text (truncated with copy button).
5. **Failure reason section** (if status=FAILED): Show `failureReason` in a red alert box.
6. **Related ledger entries:** Query `ledgerEntry` WHERE `type IN ('PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED') AND userId = payout.userId` AND `createdAt` near the payout's `createdAt` (within 1 hour). Show table: type, amount, status, date.

**Query:** `getPayoutDetail(id: string)` in `src/lib/queries/admin-finance.ts`
- SELECT payout by id
- JOIN user for seller name/email
- If batchId, SELECT payoutBatch
- SELECT related ledger entries

#### 2A.2 `/fin/chargebacks` -- Chargeback List Page

**Route:** `src/app/(hub)/fin/chargebacks/page.tsx`
**Gate:** STAFF(ADMIN, FINANCE)
**CASL check:** `ability.can('read', 'LedgerEntry')` (chargebacks are ledger entries, not a separate table)

**Implementation note:** There is NO dedicated `chargeback` table in the schema. Chargebacks are tracked as ledger entries with types `CHARGEBACK_DEBIT`, `CHARGEBACK_REVERSAL`, `CHARGEBACK_FEE` per Finance Engine Canonical Section 5.5. The Stripe dispute ID is stored in `ledgerEntry.stripeDisputeId`.

This page shows:
1. **KPI cards:** Total chargeback count (30d), total chargeback amount (30d), reversal rate (won disputes / total), average chargeback amount.
2. **Chargeback table:** Grouped by `stripeDisputeId` (each dispute = 2-3 ledger entries). Columns: Dispute ID (monospace), Seller (link to `/usr/{userId}`), Order # (link to `/tx/orders/{orderId}`), Amount, Status (derived: if CHARGEBACK_REVERSAL exists for same disputeId = "Won", else if only CHARGEBACK_DEBIT = "Open/Lost"), Date.
3. **Filters:** Date range (searchParams: `from`, `to`), status filter (All / Open / Won).
4. **Pagination:** page + pageSize via searchParams.

**Query:** `getChargebackList(opts)` in `src/lib/queries/admin-finance-chargebacks.ts` (new file)
- SELECT from ledgerEntry WHERE type IN ('CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE')
- GROUP BY stripeDisputeId to create chargeback "cases"
- JOIN user for seller name
- JOIN order for order number

#### 2A.3 `/fin/chargebacks/[id]` -- Chargeback Detail Page

**Route:** `src/app/(hub)/fin/chargebacks/[id]/page.tsx`
**Gate:** STAFF(ADMIN, FINANCE)
**CASL check:** `ability.can('read', 'LedgerEntry')`

The `[id]` param is the `stripeDisputeId` (NOT a ledger entry id).

Shows:
1. **Dispute header:** Stripe Dispute ID, status (Open/Won/Lost), total disputed amount.
2. **Seller card:** Link to `/usr/{userId}`, seller name, email.
3. **Order card:** Link to `/tx/orders/{orderId}`, order number, total.
4. **All ledger entries for this dispute:** Table of all ledger entries WHERE `stripeDisputeId = id`. Columns: Type (badge), Amount (signed, color-coded), Status, Date, Memo.
5. **Timeline view:** Chronological view of CHARGEBACK_DEBIT, CHARGEBACK_FEE, and (if exists) CHARGEBACK_REVERSAL.

**Query:** `getChargebackDetail(stripeDisputeId: string)` in `src/lib/queries/admin-finance-chargebacks.ts`

#### 2A.4 `/fin/holds` -- Reserve Holds Page

**Route:** `src/app/(hub)/fin/holds/page.tsx`
**Gate:** STAFF(ADMIN, FINANCE)
**CASL check:** `ability.can('read', 'LedgerEntry')`

**Implementation note:** Reserve holds are ledger entries with types `RESERVE_HOLD` and `RESERVE_RELEASE` per Finance Engine Canonical Section 5.11. There is no dedicated `hold` table.

Shows:
1. **KPI cards:** Active holds count (RESERVE_HOLD without matching RESERVE_RELEASE), total held amount, released in last 30 days.
2. **Active holds table:** All RESERVE_HOLD entries that do NOT have a corresponding RESERVE_RELEASE (matched by `reversalOfEntryId`). Columns: Seller (link), Amount, Reason Code, Memo, Created Date.
3. **Released holds table** (below, collapsed by default): RESERVE_RELEASE entries in last 30 days. Columns: Seller, Amount, Released Date.
4. **Filters:** Active only / Released only / All.

**Query:** `getHoldList(opts)` in `src/lib/queries/admin-finance-holds.ts` (new file)

#### 2A.5 `/fin/subscriptions` -- Platform Subscriptions Overview Page

**Route:** `src/app/(hub)/fin/subscriptions/page.tsx`
**Gate:** STAFF(ADMIN, FINANCE)
**CASL check:** `ability.can('read', 'Subscription')`

Shows aggregated subscription metrics from ALL 5 subscription tables:

1. **KPI cards (row 1):** Total active subscriptions (all axes), Monthly recurring revenue (MRR) estimate, Annual recurring revenue (ARR) estimate, Churn rate (30d: canceled / active at start of period).
2. **Tier distribution cards (row 2):**
   - Store: Count per tier (NONE/STARTER/PRO/POWER/ENTERPRISE) where status=ACTIVE.
   - Crosslister: Count per tier (NONE/FREE/LITE/PRO) where status=ACTIVE.
   - Finance: Count per tier (FREE/PRO) where status=ACTIVE.
   - Automation: Active count.
   - Bundles: Count per tier (STARTER/PRO/POWER) where status=ACTIVE.
3. **Recent subscription changes table:** JOIN across all 5 subscription tables, ORDER BY updatedAt DESC, LIMIT 50. Columns: Seller (link to `/usr/{sellerProfile.userId}`), Axis (Store/Lister/Finance/Automation/Bundle), Tier, Status (badge), Billing Period (if applicable), Updated.

**Queries:** `getSubscriptionStats()` and `getRecentSubscriptionChanges()` in `src/lib/queries/admin-subscriptions.ts` (new file)

### 2B. I4 -- Enrich Six Existing Pages

#### 2B.1 Enrich `/fin` (Finance Overview)

**File:** `src/app/(hub)/fin/page.tsx` (MODIFY)
**Current state:** 4 KPI cards + 5 nav link cards (52 lines).

Add:
1. **Revenue breakdown chart placeholder:** A section with heading "Revenue by Type (30d)" showing a table of revenue by ledger entry type. Rows: Transaction Fees (ORDER_TF_FEE), Boost Fees (ORDER_BOOST_FEE), Subscription Revenue (SUBSCRIPTION_CHARGE), Insertion Fees (INSERTION_FEE), Overage Packs (OVERAGE_CHARGE), Other. Each row: Type label, Amount (formatCentsToDollars), % of total.
2. **Additional KPI cards:** Stripe processing fees (pass-through, 30d), pending release amount (sum of PENDING ledger entries), active reserve holds amount, chargeback count (30d).
3. **Add link cards** for the 3 new I3 pages: Chargebacks, Reserve Holds, Subscriptions.
4. **Use `formatCentsToDollars`** from `@/lib/finance/format` instead of inline `formatCents` function.

**New query:** `getFinanceOverviewEnriched(days: number)` in `src/lib/queries/admin-finance.ts` (add to existing file).

#### 2B.2 Enrich `/fin/ledger` (Ledger Explorer)

**File:** `src/app/(hub)/fin/ledger/page.tsx` (MODIFY)
**Current state:** Basic table with type/amount/status/memo. No filters except type (65 lines).

Add:
1. **Filter bar (form, method=get):**
   - Type dropdown: All + every value in `ledgerEntryTypeEnum` (use the enum values from schema).
   - Status dropdown: All / PENDING / POSTED / REVERSED.
   - Seller search: text input (search by userId or user email).
   - Order search: text input (search by orderId).
   - Date range: `from` and `to` date inputs.
2. **Enhanced table columns:** Date, Type (badge), User (link to `/usr/{userId}` if not null), Order (link to `/tx/orders/{orderId}` if not null), Amount (signed, color-coded), Status (badge: green=POSTED, yellow=PENDING, gray=REVERSED), Stripe Event ID (monospace, truncated), Memo.
3. **Clickable rows:** Each row expands to show full details OR links to related pages.
4. **Pagination:** Previous/Next with page count.
5. **Replace inline formatCents** with `formatCentsToDollars` from `@/lib/finance/format`.

**Modify query:** `getLedgerEntries` in `src/lib/queries/admin-finance.ts` to accept: `status`, `orderId`, `dateFrom`, `dateTo` filter params. JOIN user for name resolution.

#### 2B.3 Enrich `/fin/payouts` (Payouts List)

**File:** `src/app/(hub)/fin/payouts/page.tsx` (MODIFY)
**Current state:** Basic table with user/amount/status/dates. No drill-down (69 lines).

Add:
1. **KPI cards (top):** Total paid out (30d), pending payouts count, failed payouts count, average payout amount.
2. **Filter bar:** Status dropdown (All / PENDING / PROCESSING / COMPLETED / FAILED / REVERSED), date range, seller search.
3. **Enhanced table:** User (link to `/usr/{userId}` with name), Amount, Status (color-coded badge), Type (auto/on-demand badge from `isOnDemand`), Batch (link to batch detail if batchId), Initiated date, Completed/Failed date.
4. **Row links:** Each payout row links to `/fin/payouts/{id}` (the new I3 detail page).
5. **Pagination:** Previous/Next.
6. **Replace inline formatCents** with `formatCentsToDollars`.

**Modify query:** `getPayoutList` in `src/lib/queries/admin-finance.ts` to JOIN user for name, accept dateFrom/dateTo/search params.

#### 2B.4 Enrich `/tx/payments` (Payments List)

**File:** `src/app/(hub)/tx/payments/page.tsx` (MODIFY)
**Current state:** Basic table from order table with paymentIntentId. No pagination, no filters (53 lines).

Add:
1. **Use `orderPayment` table** instead of querying `order` table. The orderPayment table has: stripePaymentIntentId, stripeChargeId, status, amountCents, stripeFeesCents, tfAmountCents, tfRateBps, boostFeeAmountCents, netToSellerCents, capturedAt, refundedAt, refundAmountCents.
2. **Enhanced table columns:** Order # (link to `/tx/orders/{orderId}`), Payment Intent (monospace, truncated), Amount, Transaction Fee (tfAmountCents), Stripe Fee (stripeFeesCents), Boost Fee (boostFeeAmountCents if > 0), Net to Seller (netToSellerCents), Status (badge), Captured date.
3. **Filter bar:** Status dropdown (All / pending / captured / failed / refunded), date range, search by order number or payment intent.
4. **Pagination.**
5. **KPI cards (top):** Total captured (30d), total refunded (30d), total Stripe fees (30d), total Transaction Fees collected (30d).
6. **Replace inline formatCents** with `formatCentsToDollars`.

**New query:** `getEnrichedPaymentsList(opts)` in `src/lib/queries/admin-orders.ts` (add to existing). Query orderPayment JOIN order for orderNumber.

#### 2B.5 Enrich `/tx/orders` (Orders List)

**File:** `src/app/(hub)/tx/orders/page.tsx` (MODIFY)
**Current state:** Search + status filter + basic table. No date range, no pagination beyond basic Previous/Next (106 lines).

Add:
1. **Date range filter:** `from` and `to` date inputs in the filter form.
2. **Status dropdown** (replace free-text): Select with all `orderStatusEnum` values from schema.
3. **Enhanced table columns:** Add "Payment" column (captured/pending/failed badge from orderPayment.status, retrieved via a single batch query).
4. **Status badges:** Color-coded per status (COMPLETED=green, REFUNDED=red, CANCELLED=gray, SHIPPED/IN_TRANSIT=blue, PENDING_PAYMENT=yellow, etc.).
5. **Export hint:** Small text "Export coming soon" placeholder below pagination (do NOT implement export).

**Modify query:** `getAdminOrderList` in `src/lib/queries/admin-orders.ts` to also return payment status for each order (LEFT JOIN orderPayment).

#### 2B.6 Enrich `/tx/orders/[id]` (Order Detail)

**File:** `src/app/(hub)/tx/orders/[id]/page.tsx` (MODIFY)
**Current state:** 3 info cards (order/buyer/seller) + shipping + local tx + ledger entries table (114 lines).

Add:
1. **Order items section:** Query `orderItem` for this order. Show table: Item Title, Quantity, Unit Price, Transaction Fee Rate (tfRateBps as percentage), Transaction Fee Amount, Fee Bucket (if set).
2. **Payment breakdown card:** Query `orderPayment` for this order. Show: Gross amount, Transaction Fee (amount + rate as %), Stripe processing fee, Boost fee (if > 0), Net to seller. Format per Pricing Canonical Section 3.1:
   ```
   Gross sale:               $50.00
   Transaction Fee (10%):    -$5.00
   Payment Processing:       -$1.75
   Boost Fee (3%):           -$1.50   (only if > 0)
   --------------------------------
   Net Earnings:             $41.75
   ```
   Use "Transaction Fee" NOT "TF" or "FVF". Use "Payment Processing" NOT "Stripe fee".
3. **Escrow status section:** If order has delivery timestamp, show escrow timer: "Delivered {date}. Escrow hold: {72h from deliveredAt}. Funds release: {release date}." Show status: HELD / RELEASED / CLAIMED based on ledger entries.
4. **Status timeline:** Chronological list of order lifecycle events from timestamps: createdAt, paidAt, shippedAt, deliveredAt, completedAt, canceledAt. Each with icon and timestamp.
5. **Related disputes:** Query `dispute` WHERE orderId = id. Show card if any exist: claim type, status, resolution amount.

**New queries:** Add `getOrderItems(orderId)` and `getOrderPayment(orderId)` and `getOrderDisputes(orderId)` to `src/lib/queries/admin-orders.ts`.

### 2C. CASL Subject Additions

Add to `src/lib/casl/subjects.ts`:
```
'Chargeback',
'Hold',
```

These are referenced in Actors Security Canonical Section 4.3.4 (custom role subjects table). `Reconciliation` and `Finance` are also listed there but the existing pages use `Payout` and `LedgerEntry` checks which are already sufficient -- adding them would be over-engineering with no current consumers.

**Note:** Do NOT add `Reconciliation` or `Finance` as CASL subjects at this time. The existing `/fin/recon` page uses `ability.can('read', 'Payout')` and the `/fin` overview uses the same. Only add subjects that are directly needed by I3 pages.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms (scan ALL output)
- NEVER use "FVF", "Final Value Fee", "fvf" -- use "Transaction Fee" or "TF" in code-only contexts
- NEVER use "Twicely Balance" -- use "Available for payout"
- NEVER use "wallet" in any UI text
- NEVER use "Withdraw" -- use "Request payout"
- NEVER use "Stripe fee" in UI -- use "Payment Processing" or "Payment processing fee"
- NEVER use "Sale price" on transaction rows -- use "Gross sale"
- NEVER use "Net payout" -- use "Net earnings"
- NEVER use "Commission" -- use "Twicely fees" or "Transaction Fee"
- NEVER use "Balance" by itself with "Twicely" -- use "Available for payout"

### Tech Stack
- Drizzle ORM only (no Prisma)
- Server components for data fetching (no client-side fetch for page data)
- `formatCentsToDollars` from `@/lib/finance/format` for money display (do NOT create inline formatCents functions)
- Integer cents for all monetary values (never floats, never dollars as numbers)

### Architecture
- Do NOT modify `src/lib/hub/admin-nav.ts` -- this is LOCKED for this branch
- Do NOT create server actions for I3/I4 -- these are read-only admin pages (no mutations)
- Do NOT create API routes -- these are server-rendered pages using direct DB queries
- File maximum: 300 lines per file. If a page exceeds this, extract components.
- Do NOT add any new sidebar links or navigation changes

### Business Logic
- Chargebacks have NO dedicated table -- they are ledger entries grouped by `stripeDisputeId`
- Reserve holds have NO dedicated table -- they are ledger entries with type RESERVE_HOLD/RESERVE_RELEASE
- Subscription overview aggregates from 5 separate tables (store, lister, automation, finance, bundle)
- Ledger entries are IMMUTABLE -- no UPDATE/DELETE buttons anywhere
- All monetary columns are integer cents
- The `sellerProfile.id` is NOT the same as `user.id`. Subscription tables reference `sellerProfileId`, not `userId`. The installer must resolve this correctly when linking subscriptions to user profiles.

---

## 4. ACCEPTANCE CRITERIA

### I3 Page Existence & Rendering
- [ ] `/fin/payouts/[id]` renders payout detail with seller info, batch info, Stripe IDs, and related ledger entries
- [ ] `/fin/payouts/[id]` returns 404 for non-existent payout ID
- [ ] `/fin/chargebacks` renders chargeback list grouped by Stripe dispute ID
- [ ] `/fin/chargebacks` shows KPI cards with counts and amounts
- [ ] `/fin/chargebacks/[id]` renders chargeback detail for a given stripeDisputeId
- [ ] `/fin/chargebacks/[id]` shows all related ledger entries (CHARGEBACK_DEBIT, CHARGEBACK_FEE, CHARGEBACK_REVERSAL)
- [ ] `/fin/holds` renders active holds and released holds (last 30d)
- [ ] `/fin/holds` correctly identifies active holds (RESERVE_HOLD without matching RESERVE_RELEASE)
- [ ] `/fin/subscriptions` renders aggregate subscription metrics from all 5 subscription tables
- [ ] `/fin/subscriptions` shows tier distribution for each subscription axis

### I4 Enrichment
- [ ] `/fin` page shows revenue breakdown by type, additional KPIs, and links to chargebacks/holds/subscriptions
- [ ] `/fin/ledger` has working filters: type, status, seller, order, date range
- [ ] `/fin/ledger` shows user name (linked) and order number (linked) in table
- [ ] `/fin/payouts` has KPI cards, status filter, seller search, and rows link to `/fin/payouts/[id]`
- [ ] `/tx/payments` queries `orderPayment` table (not `order`), shows TF, Stripe fees, boost fees, net to seller
- [ ] `/tx/payments` has filter bar with status, date range, search
- [ ] `/tx/orders` has date range filter and status dropdown (not free-text)
- [ ] `/tx/orders/[id]` shows order items with per-item TF breakdown
- [ ] `/tx/orders/[id]` shows payment breakdown card with correct labels per UX language pack
- [ ] `/tx/orders/[id]` shows escrow status with 72-hour hold calculation
- [ ] `/tx/orders/[id]` shows order timeline from lifecycle timestamps
- [ ] `/tx/orders/[id]` shows related disputes if any exist

### Authorization
- [ ] ALL new pages check CASL authorization (staffAuthorize + ability check)
- [ ] Unauthenticated requests redirect to login
- [ ] FINANCE role staff can access all /fin/* and read-only /tx/* pages
- [ ] SUPPORT role staff can access /tx/* pages but NOT /fin/* pages (except /tx/payments which requires ADMIN or FINANCE)

### Vocabulary
- [ ] Zero occurrences of "FVF", "Final Value Fee" in any created/modified file
- [ ] Zero occurrences of "Twicely Balance" in any UI text
- [ ] Zero occurrences of "wallet" in any UI text
- [ ] "Transaction Fee" used (not "TF") in UI-facing labels
- [ ] "Payment Processing" used (not "Stripe fee") in UI-facing labels
- [ ] "Gross sale" used (not "Sale price") in transaction rows
- [ ] "Net earnings" used (not "Net payout") in payment breakdowns

### Data Integrity
- [ ] All monetary values displayed using `formatCentsToDollars` (not inline formatting)
- [ ] All amounts stored/queried as integer cents
- [ ] No ledger entry mutation buttons exist (read-only views)
- [ ] Pagination works correctly (no off-by-one errors)
- [ ] Empty states render for all tables when no data exists

### Code Quality
- [ ] Zero `as any`, zero `@ts-ignore`, zero `@ts-expect-error`
- [ ] No file exceeds 300 lines
- [ ] No inline `formatCents` functions (use shared utility)
- [ ] No `console.log` in production code
- [ ] TypeScript strict mode passes with 0 errors

---

## 5. TEST REQUIREMENTS

### Query Tests (unit tests with vitest mocks)

**File:** `src/lib/queries/__tests__/admin-finance-chargebacks.test.ts`
- `getChargebackList` returns grouped chargebacks by stripeDisputeId
- `getChargebackList` applies status filter correctly
- `getChargebackList` applies date range filter
- `getChargebackList` returns empty array when no chargebacks exist
- `getChargebackStats` returns correct counts and amounts
- `getChargebackDetail` returns all entries for a given stripeDisputeId
- `getChargebackDetail` returns null for non-existent disputeId

**File:** `src/lib/queries/__tests__/admin-finance-holds.test.ts`
- `getHoldList` returns active holds (no matching RESERVE_RELEASE)
- `getHoldList` excludes released holds from active list
- `getHoldList` returns released holds in last 30 days
- `getHoldStats` returns correct active count and total held amount
- Empty state: returns empty arrays when no holds exist

**File:** `src/lib/queries/__tests__/admin-subscriptions.test.ts`
- `getSubscriptionStats` aggregates counts from all 5 subscription tables
- `getSubscriptionStats` calculates MRR correctly from active subscriptions
- `getSubscriptionStats` handles empty tables (zero counts)
- `getRecentSubscriptionChanges` returns across all subscription axes ordered by updatedAt
- `getRecentSubscriptionChanges` resolves seller names via sellerProfile -> user JOIN

**File:** `src/lib/queries/__tests__/admin-finance-enriched.test.ts`
- `getPayoutDetail` returns full payout with user info and batch info
- `getPayoutDetail` returns null for non-existent id
- `getFinanceOverviewEnriched` returns revenue breakdown by entry type
- `getLedgerEntries` (enhanced) filters by status correctly
- `getLedgerEntries` (enhanced) filters by date range correctly
- `getLedgerEntries` (enhanced) filters by orderId
- `getLedgerEntries` (enhanced) resolves user names

**File:** `src/lib/queries/__tests__/admin-orders-enriched.test.ts`
- `getEnrichedPaymentsList` returns orderPayment data with order number
- `getEnrichedPaymentsList` filters by status
- `getEnrichedPaymentsList` paginates correctly
- `getOrderItems` returns items with TF breakdown
- `getOrderPayment` returns payment with all fee columns
- `getOrderDisputes` returns disputes for an order
- `getOrderDisputes` returns empty array for order with no disputes
- `getAdminOrderList` (enhanced) returns payment status via LEFT JOIN

### Test Patterns
Follow existing patterns from `src/lib/queries/__tests__/` and `src/lib/actions/__tests__/`:
- Use `vi.mock('@/lib/db')` for database mocking
- Use `selectChain` / `insertChain` helpers if available
- Mock `staffAuthorize` for CASL checks
- All test descriptions in imperative form: "returns X when Y"

### Minimum Test Count
Current baseline: 8293 tests. This step should add approximately 40-55 tests.

---

## 6. FILE APPROVAL LIST

### New Files (I3 -- Gap Pages)

| # | Path | Description |
|---|------|-------------|
| 1 | `src/app/(hub)/fin/payouts/[id]/page.tsx` | Payout detail page (header, seller, batch, Stripe IDs, related ledger) |
| 2 | `src/app/(hub)/fin/chargebacks/page.tsx` | Chargeback list page (KPIs, grouped table by dispute ID, filters) |
| 3 | `src/app/(hub)/fin/chargebacks/[id]/page.tsx` | Chargeback detail page (dispute entries, timeline, seller/order cards) |
| 4 | `src/app/(hub)/fin/holds/page.tsx` | Reserve holds page (active holds, released holds, KPIs) |
| 5 | `src/app/(hub)/fin/subscriptions/page.tsx` | Subscriptions overview (aggregate metrics, tier distribution, recent changes) |

### New Files (Queries)

| # | Path | Description |
|---|------|-------------|
| 6 | `src/lib/queries/admin-finance-chargebacks.ts` | Chargeback list, stats, and detail queries |
| 7 | `src/lib/queries/admin-finance-holds.ts` | Reserve hold list and stats queries |
| 8 | `src/lib/queries/admin-subscriptions.ts` | Subscription aggregation and recent changes queries |

### New Files (Tests)

| # | Path | Description |
|---|------|-------------|
| 9 | `src/lib/queries/__tests__/admin-finance-chargebacks.test.ts` | Tests for chargeback queries |
| 10 | `src/lib/queries/__tests__/admin-finance-holds.test.ts` | Tests for hold queries |
| 11 | `src/lib/queries/__tests__/admin-subscriptions.test.ts` | Tests for subscription aggregation queries |
| 12 | `src/lib/queries/__tests__/admin-finance-enriched.test.ts` | Tests for enriched payout detail, overview, ledger queries |
| 13 | `src/lib/queries/__tests__/admin-orders-enriched.test.ts` | Tests for enriched payment, order item, order payment queries |

### Modified Files (I4 -- Enrichments)

| # | Path | Description |
|---|------|-------------|
| 14 | `src/app/(hub)/fin/page.tsx` | Add revenue breakdown, extra KPIs, new link cards |
| 15 | `src/app/(hub)/fin/ledger/page.tsx` | Add filter bar (type, status, seller, order, date), enhanced columns |
| 16 | `src/app/(hub)/fin/payouts/page.tsx` | Add KPIs, filters, row links to detail, enhanced table |
| 17 | `src/app/(hub)/tx/payments/page.tsx` | Switch to orderPayment table, add fee columns, filters, KPIs |
| 18 | `src/app/(hub)/tx/orders/page.tsx` | Add date range filter, status dropdown, payment status column |
| 19 | `src/app/(hub)/tx/orders/[id]/page.tsx` | Add order items, payment breakdown, escrow status, timeline, disputes |

### Modified Files (Queries -- Adding Functions)

| # | Path | Description |
|---|------|-------------|
| 20 | `src/lib/queries/admin-finance.ts` | Add: getPayoutDetail, getFinanceOverviewEnriched, enhance getLedgerEntries/getPayoutList |
| 21 | `src/lib/queries/admin-orders.ts` | Add: getEnrichedPaymentsList, getOrderItems, getOrderPayment, getOrderDisputes, enhance getAdminOrderList |

### Modified Files (CASL)

| # | Path | Description |
|---|------|-------------|
| 22 | `src/lib/casl/subjects.ts` | Add 'Chargeback' and 'Hold' subjects |

**Total: 13 new files + 9 modified files = 22 files**

---

## 7. VERIFICATION CHECKLIST

After implementation, run ALL of these and paste raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite
pnpm test

# 3. Banned terms check
grep -rn "FVF\|Final Value Fee\|Twicely Balance\|SellerTier\|SubscriptionTier" src/app/\(hub\)/fin/ src/app/\(hub\)/tx/ src/lib/queries/admin-finance*.ts src/lib/queries/admin-orders*.ts src/lib/queries/admin-subscriptions.ts || echo "No banned terms found"

# 4. File size check
find src/app/\(hub\)/fin/ src/app/\(hub\)/tx/ -name "*.tsx" -exec wc -l {} + | sort -rn | head -20

# 5. Route prefix check
grep -rn '"/l/\|"/listing/\|"/store/\|"/shop/\|"/dashboard\|"/admin"' src/app/\(hub\)/fin/ src/app/\(hub\)/tx/ || echo "No wrong routes found"

# 6. console.log check
grep -rn "console\.log" src/app/\(hub\)/fin/ src/app/\(hub\)/tx/ src/lib/queries/admin-finance*.ts src/lib/queries/admin-orders*.ts src/lib/queries/admin-subscriptions.ts || echo "No console.log found"
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= 8293 (baseline) + ~40-55 new tests
- Banned terms: 0 occurrences
- File sizes: all under 300 lines
- Route prefixes: 0 wrong routes
- console.log: 0 occurrences

---

## 8. DECOMPOSITION (SUB-STEPS)

This combined prompt is large. The installer should implement in this order:

### Sub-step I3+I4.1 -- CASL + Queries (Foundation)
1. Add CASL subjects (`Chargeback`, `Hold`)
2. Create `admin-finance-chargebacks.ts`, `admin-finance-holds.ts`, `admin-subscriptions.ts` query files
3. Add new functions to `admin-finance.ts` and `admin-orders.ts`
4. Write ALL test files (13 new test files)
5. Run `pnpm typecheck` and `pnpm test` -- must pass before continuing

### Sub-step I3+I4.2 -- I3 New Pages (5 pages)
1. `/fin/payouts/[id]`
2. `/fin/chargebacks`
3. `/fin/chargebacks/[id]`
4. `/fin/holds`
5. `/fin/subscriptions`
6. Run `pnpm typecheck` -- must pass before continuing

### Sub-step I3+I4.3 -- I4 Enrichments (6 pages)
1. Enrich `/fin` (overview)
2. Enrich `/fin/ledger`
3. Enrich `/fin/payouts`
4. Enrich `/tx/payments`
5. Enrich `/tx/orders`
6. Enrich `/tx/orders/[id]`
7. Run full verification checklist

Sub-steps 2 and 3 are sequential (I4 pages link to I3 pages). Sub-step 1 must be done first.

---

## 9. SPEC GAPS & DECISIONS NEEDED

### NOT SPECIFIED -- Owner Decision Needed

1. **Chargeback list grouping logic:** The schema has `stripeDisputeId` on ledger entries but there is no formal "chargeback case" entity. The prompt groups by `stripeDisputeId` -- confirm this is correct, or should chargebacks link through the `dispute` table instead?

2. **Subscription MRR calculation:** MRR for annual subscriptions -- should it be annualCents/12 or the actual monthly equivalent from platform settings? The prompt uses settings-based pricing.

3. **Hold matching logic:** The prompt matches RESERVE_HOLD to RESERVE_RELEASE via `reversalOfEntryId`. The Finance Engine Canonical Section 5.11 says releases reference the hold, but the schema's `reversalOfEntryId` field is on the newer entry. Confirm: RESERVE_RELEASE.reversalOfEntryId points to the RESERVE_HOLD entry's id?

4. **Escrow timer display:** The order detail page should show escrow status. The Finance Engine says 72 hours after delivery (from `commerce.escrow.holdHours` platform setting). Should the page read this setting, or is 72 hours acceptable as a display-only constant (with a note that it reads from settings)?

5. **Chargeback "status" derivation:** Since there is no status field on chargebacks (they are ledger entries), the prompt derives status from entry presence: if CHARGEBACK_REVERSAL exists = "Won", if only CHARGEBACK_DEBIT = "Open/Lost". Should we distinguish "Open" from "Lost"? This would require checking the Stripe dispute status via API, which is out of scope for a read-only admin page.

---

## 10. REFERENCE: EXISTING CODE INVENTORY

### Existing Finance Hub Pages (files to be modified)
| Path | Lines | Build Phase |
|------|-------|-------------|
| `src/app/(hub)/fin/page.tsx` | 52 | E3.4 |
| `src/app/(hub)/fin/ledger/page.tsx` | 65 | E3.4 |
| `src/app/(hub)/fin/payouts/page.tsx` | 69 | E3.4 |
| `src/app/(hub)/fin/adjustments/page.tsx` | 74 | E3.4 |
| `src/app/(hub)/fin/costs/page.tsx` | 62 | E3.4 |
| `src/app/(hub)/fin/recon/page.tsx` | 43 | E3.4 |
| `src/app/(hub)/fin/promo-codes/page.tsx` | ~80 | G1.5 |
| `src/app/(hub)/fin/affiliate-payouts/page.tsx` | ~80 | G3.4 |
| `src/app/(hub)/fin/tax/page.tsx` | ~50 | G5 |

### Existing Transaction Hub Pages (files to be modified)
| Path | Lines | Build Phase |
|------|-------|-------------|
| `src/app/(hub)/tx/page.tsx` | 46 | E3.3 |
| `src/app/(hub)/tx/orders/page.tsx` | 106 | E3.3 |
| `src/app/(hub)/tx/orders/[id]/page.tsx` | 114 | E3.3 |
| `src/app/(hub)/tx/payments/page.tsx` | 53 | E3.3 |

### Existing Query Files (to be extended)
| Path | Functions |
|------|-----------|
| `src/lib/queries/admin-finance.ts` | getFinanceKPIs, getLedgerEntries, getPayoutList, getManualAdjustments, getPlatformCosts |
| `src/lib/queries/admin-orders.ts` | getAdminOrderList, getAdminOrderDetail, getTransactionOverviewKPIs, getPaymentsList |

### Schema Tables Used
| Table | Schema File | Section |
|-------|-------------|---------|
| `ledgerEntry` | `finance.ts` | 11.1 |
| `sellerBalance` | `finance.ts` | 11.2 |
| `payoutBatch` | `finance.ts` | 11.3 |
| `payout` | `finance.ts` | 11.4 |
| `feeSchedule` | `finance.ts` | 11.5 |
| `reconciliationReport` | `finance.ts` | 11.6 |
| `manualAdjustment` | `finance.ts` | 11.7 |
| `order` | `commerce.ts` | 6.3 |
| `orderItem` | `commerce.ts` | 6.4 |
| `orderPayment` | `commerce.ts` | 6.5 |
| `storeSubscription` | `subscriptions.ts` | 3.1 |
| `listerSubscription` | `subscriptions.ts` | 3.2 |
| `automationSubscription` | `subscriptions.ts` | 3.3 |
| `financeSubscription` | `subscriptions.ts` | 18.1 |
| `bundleSubscription` | `subscriptions.ts` | 3.5 |
| `dispute` | `commerce.ts` | 7.3 |
| `user` | `auth.ts` | 2.1 |
| `sellerProfile` | `identity.ts` | 2.3 |

### Enums Referenced
| Enum | Values | Schema Location |
|------|--------|----------------|
| `ledgerEntryTypeEnum` | 38 values (see schema enums.ts line 155-176) | `enums.ts` |
| `ledgerEntryStatusEnum` | PENDING, POSTED, REVERSED | `enums.ts` |
| `payoutStatusEnum` | PENDING, PROCESSING, COMPLETED, FAILED, REVERSED | `enums.ts` |
| `payoutBatchStatusEnum` | CREATED, PROCESSING, COMPLETED, PARTIALLY_FAILED, FAILED | `enums.ts` |
| `orderStatusEnum` | 14 values (see Pricing Canonical Section 17) | `enums.ts` |
| `storeTierEnum` | NONE, STARTER, PRO, POWER, ENTERPRISE | `enums.ts` |
| `listerTierEnum` | NONE, FREE, LITE, PRO | `enums.ts` |
| `financeTierEnum` | FREE, PRO | `enums.ts` |
| `bundleTierEnum` | STARTER, PRO, POWER | `enums.ts` |
| `subscriptionStatusEnum` | ACTIVE, PAST_DUE, CANCELED, PAUSED, TRIALING, PENDING | `enums.ts` |
| `claimTypeEnum` | (used by dispute table) | `enums.ts` |
| `disputeStatusEnum` | (used by dispute table) | `enums.ts` |

---

*End of I3+I4 combined install prompt.*
