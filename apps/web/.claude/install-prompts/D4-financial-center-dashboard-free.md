# [D4] Financial Center Dashboard + P&L (FREE Tier)

**One-line Summary:** Build the seller-facing Financial Center at `/my/finances` with a revenue dashboard (30-day KPIs), transaction history view, read-only expense list, P&L summary card, and Finance Pro upgrade gate UI. This is the FREE tier only -- expense CRUD, mileage, receipt scanning, and full P&L reports are deferred to D4.1-D4.3.

**Canonical Sources (read ALL before starting):**
1. `TWICELY_V3_FINANCIAL_CENTER_CANONICAL.md` -- primary spec (sections 1-6, 8-9)
2. `TWICELY_V3_SCHEMA_v2_0_7.md` -- section 18 (Finance Center tables), section 11 (Finance Engine tables)
3. `TWICELY_V3_PAGE_REGISTRY.md` -- route #49 (`/my/selling/analytics`), route #50-53 (`/my/selling/finances/*`)
4. `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` -- section 7 (Finance Subscriptions)
5. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` -- section 9 (Seller Analytics & Financial Tracking)
6. `TWICELY_V3_DECISION_RATIONALE.md` -- decisions #45, #46, #78, #100
7. `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` -- section 7.6 (finance pricing keys)
8. `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` -- delegation scopes (finances.view)
9. `TWICELY_V3_USER_MODEL.md` -- Finance as 4th subscription axis
10. `TWICELY_V3_TESTING_STANDARDS.md`

---

## 1. PREREQUISITES

### Must Be Complete
- **Phase C3** (Seller Finances -- payout balance, payout history, transactions page shell): DONE
- **Phase D3** (Subscriptions + Billing -- financeSubscription row, checkout, cancel): DONE (D3-S5, D3-S6)
- **Phase C1** (Reviews -- seller rating data for performance metrics): DONE

### Tables That Must Already Exist
All of these already exist in `src/lib/db/schema/finance.ts`:
- `ledgerEntry` (section 11.1) -- transaction data source
- `sellerBalance` (section 11.2) -- balance KPIs
- `payout` (section 11.4) -- payout history
- `orderPayment` (section 6.5 in commerce.ts) -- TF and fee data
- `expense` (section 18.2) -- read-only display for FREE
- `mileageEntry` (section 18.3) -- read-only display for FREE
- `financeSubscription` (section 18.1) -- tier gating
- `financialReport` (section 18.4) -- report storage (used in PRO, but schema exists)
- `sellerProfile.financeTier` -- denormalized tier check (`FREE` or `PRO`)

### Existing Files That Will Be Modified
- `src/app/(hub)/my/selling/finances/page.tsx` -- currently shows payout balance only, will be expanded to full finance dashboard
- `src/app/(hub)/my/selling/finances/transactions/page.tsx` -- currently says "Coming soon", will be replaced
- `src/app/(hub)/my/selling/finances/statements/page.tsx` -- currently says "Coming soon", will show upgrade gate
- `src/lib/casl/subjects.ts` -- needs `Expense` and `FinancialReport` subjects

### Dependencies (npm packages)
No new packages needed. Existing: `recharts` (already installed for hub dashboard charts), `date-fns` (already installed), `@tanstack/react-table` (already installed).

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### 2.1 CASL Subjects (Add to subjects.ts)

Add to the `SUBJECTS` array in `src/lib/casl/subjects.ts`:
```typescript
'Expense',
'FinancialReport',
'MileageEntry',
```

### 2.2 CASL Ability Rules (Add to ability.ts)

For **seller** actor:
```typescript
// Expense: owner can read their own (all tiers), manage requires PRO
can('read', 'Expense', { userId: session.userId });
// PRO gate for manage handled at action level, not CASL (financeTier check)

// FinancialReport: owner can read their own
can('read', 'FinancialReport', { userId: session.userId });

// MileageEntry: owner can read their own
can('read', 'MileageEntry', { userId: session.userId });

// Analytics: owner can read their own (already exists via Analytics subject)
```

For **delegated staff** with `finances.view` scope:
```typescript
can('read', 'Expense', { userId: session.onBehalfOfSellerId });
can('read', 'FinancialReport', { userId: session.onBehalfOfSellerId });
can('read', 'MileageEntry', { userId: session.onBehalfOfSellerId });
```

For **platform staff** with ADMIN or FINANCE role:
```typescript
can('read', 'Expense');
can('read', 'FinancialReport');
can('read', 'MileageEntry');
```

### 2.3 Server Queries

#### `src/lib/queries/finance-center.ts` (NEW)

All queries take `userId: string` and return typed results. All money values in integer cents.

**getFinanceDashboardKPIs(userId: string, days: number = 30)**
Returns:
```typescript
interface FinanceDashboardKPIs {
  grossRevenueCents: number;       // Sum of order.totalCents for completed orders (as seller)
  totalOrderCount: number;         // Count of completed orders (as seller)
  avgSalePriceCents: number;       // grossRevenueCents / totalOrderCount (or 0)
  tfFeesCents: number;             // Sum of ledgerEntry WHERE type='ORDER_TF_FEE' (absolute value)
  stripeFeesCents: number;         // Sum of ledgerEntry WHERE type='ORDER_STRIPE_PROCESSING_FEE' (abs)
  totalFeesCents: number;          // tfFeesCents + stripeFeesCents + boostFeesCents
  boostFeesCents: number;          // Sum of ledgerEntry WHERE type='ORDER_BOOST_FEE' (abs)
  shippingCostsCents: number;      // Sum of ledgerEntry WHERE type='SHIPPING_LABEL_PURCHASE' (abs)
  netEarningsCents: number;        // grossRevenueCents - totalFeesCents - shippingCostsCents
  effectiveFeeRatePercent: number; // (totalFeesCents / grossRevenueCents) * 100, 2 decimal places
  availableForPayoutCents: number; // From sellerBalance.availableCents
  pendingCents: number;            // From sellerBalance.pendingCents
  reservedCents: number;           // From sellerBalance.reservedCents
}
```

Data sources:
- `order` table: WHERE `sellerId = userId` AND `status = 'COMPLETED'` AND `completedAt >= now() - {days} days`
- `ledgerEntry` table: WHERE `userId = userId` AND `createdAt >= now() - {days} days` AND relevant types
- `sellerBalance` table: WHERE `userId = userId`

**getRevenueTimeSeries(userId: string, days: number = 30)**
Returns:
```typescript
interface RevenueDataPoint {
  date: string;           // ISO date string (YYYY-MM-DD)
  revenueCents: number;   // Sum of order.totalCents completed on this date
  feesCents: number;      // Sum of TF + Stripe fees on this date
  orderCount: number;     // Count of orders completed on this date
}
```

Groups by `DATE(order.completedAt)` for the seller.

**getRecentTransactions(userId: string, opts: { page: number; pageSize: number; type?: string })**
Returns:
```typescript
interface TransactionRow {
  id: string;
  type: string;           // ledgerEntryType enum value
  amountCents: number;    // positive or negative
  status: string;
  orderId: string | null;
  memo: string | null;
  postedAt: Date | null;
  createdAt: Date;
}
interface TransactionListResult {
  transactions: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}
```

Queries `ledgerEntry` table WHERE `userId = userId`, ordered by `createdAt DESC`, paginated. Supports optional type filter.

**getExpenseSummary(userId: string, days: number = 30)**
Returns:
```typescript
interface ExpenseSummaryResult {
  totalExpensesCents: number;
  expensesByCategory: Array<{ category: string; totalCents: number; count: number }>;
  recentExpenses: Array<{
    id: string;
    category: string;
    amountCents: number;
    vendor: string | null;
    description: string | null;
    expenseDate: Date;
  }>;
}
```

Queries `expense` table WHERE `userId = userId` AND `expenseDate >= now() - {days} days`. Groups by category for summary. Returns last 5 recent expenses.

**getMileageSummary(userId: string, days: number = 30)**
Returns:
```typescript
interface MileageSummaryResult {
  totalMiles: number;
  totalDeductionCents: number;
  tripCount: number;
}
```

Queries `mileageEntry` table WHERE `userId = userId` AND `tripDate >= now() - {days} days`.

**getFinanceTier(userId: string): Promise<'FREE' | 'PRO'>`**
Queries `sellerProfile.financeTier` WHERE `userId = userId`. Returns `'FREE'` if not found.

### 2.4 Server Actions

#### `src/lib/actions/finance-center.ts` (NEW)

**getFinanceDashboardAction()**
- Calls `authorize()`, resolves userId (handles delegation via `session.onBehalfOfSellerId`)
- CASL check: `ability.can('read', sub('Analytics', { userId }))`
- Calls `getFinanceDashboardKPIs(userId)`, `getRevenueTimeSeries(userId)`, `getExpenseSummary(userId)`, `getMileageSummary(userId)`, `getFinanceTier(userId)`
- Returns: `{ success: true, kpis, timeSeries, expenses, mileage, financeTier }` or `{ success: false, error }`

**getTransactionHistoryAction(page?: number, pageSize?: number, type?: string)**
- Input validated with Zod `.strict()`:
  ```typescript
  z.object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    type: z.string().optional(),
  }).strict()
  ```
- CASL check: `ability.can('read', sub('LedgerEntry', { userId }))`
- Calls `getRecentTransactions(userId, { page, pageSize, type })`

### 2.5 Pages and Components

#### Route: `/my/selling/finances` (MODIFY existing page)
**File:** `src/app/(hub)/my/selling/finances/page.tsx`

Replace the current payout-only page with a full Financial Center dashboard. The page fetches data via `getFinanceDashboardAction()` and renders:

1. **Header**: "Financial Center" title + "Finance Pro" upgrade badge/CTA (if tier is FREE)
2. **KPI Cards Row** (4 cards):
   - Gross revenue (last 30 days) in dollars, with trend indicator vs previous 30 days
   - Net earnings (after fees) in dollars
   - Total fees (TF + Stripe + boost) in dollars, with effective rate %
   - Available for payout (from sellerBalance)
3. **Revenue Chart** (recharts AreaChart): 30-day revenue and fees time series
4. **P&L Summary Card**: Simple revenue - fees - expenses = net breakdown
   - Revenue line
   - Fees line (negative)
   - Expenses line (negative, from expense table)
   - Mileage deductions line (negative, from mileageEntry)
   - Net profit line (bold)
   - If FREE tier and no expenses: show "Track your expenses with Finance Pro" CTA
5. **Recent Transactions** (last 5 with "View All" link to `/my/selling/finances/transactions`)
6. **Expense Summary Card**: Category breakdown donut/bar chart + "View All" link
   - FREE tier: read-only list, no add/edit/delete buttons
   - If no expenses: "No expenses tracked yet. Upgrade to Finance Pro to start tracking."
7. **Quick Links Card**: Links to Transactions, Payouts, Statements

**UX Language Compliance:**
- "Available for payout" (never "Twicely Balance")
- "Net earnings" (never "Net payout")
- "Transaction Fee" (never "FVF" or "Commission")
- "Payment processing fee" (never "Stripe fee" in isolation -- use "Payment processing fee" in the P&L breakdown)

#### Route: `/my/selling/finances/transactions` (MODIFY existing page)
**File:** `src/app/(hub)/my/selling/finances/transactions/page.tsx`

Replace "Coming soon" with a paginated transaction history table.

1. **Header**: "Transactions" title + breadcrumb back to finances
2. **Filter Bar**: Type filter dropdown (All / Sales / Fees / Payouts / Refunds / Other)
   - Maps to ledger entry type groups:
     - Sales: `ORDER_PAYMENT_CAPTURED`
     - Fees: `ORDER_TF_FEE`, `ORDER_BOOST_FEE`, `ORDER_STRIPE_PROCESSING_FEE`, `INSERTION_FEE`, `SUBSCRIPTION_CHARGE`, `FINANCE_SUBSCRIPTION_CHARGE`
     - Payouts: `PAYOUT_SENT`, `PAYOUT_FAILED`, `PAYOUT_REVERSED`
     - Refunds: `REFUND_FULL`, `REFUND_PARTIAL`, `REFUND_TF_REVERSAL`, `REFUND_BOOST_REVERSAL`, `REFUND_STRIPE_REVERSAL`
     - Other: everything else
3. **Transaction Table**: Date, Type (human label), Amount (green for credits, red for debits), Status badge, Order link (if orderId exists)
4. **Pagination**: Page numbers + Previous/Next
5. **FREE tier**: 30-day history only. Show "Upgrade to Finance Pro for 2 years of history" banner if user tries to go beyond 30 days.

#### Route: `/my/selling/finances/statements` (MODIFY existing page)
**File:** `src/app/(hub)/my/selling/finances/statements/page.tsx`

Replace "Coming soon" with a Finance Pro upgrade gate.

1. **Header**: "Financial Statements"
2. **Upgrade CTA Card**: Explains what Finance Pro includes (P&L reports, balance sheets, CSV/PDF export, 2-year history)
3. **Pricing**: $9.99/mo (annual) or $14.99/mo
4. **Upgrade Button**: Links to `/my/selling/subscription` (existing subscription management page)
5. If user IS Finance Pro: Show "Coming in a future update" placeholder (D4.3 scope)

### 2.6 Shared Components

#### `src/components/finance/kpi-card.tsx` (NEW)
Reusable card showing: title, value (formatted dollars), trend indicator (up/down arrow + percentage), optional subtitle. Used for the 4 KPI cards.

```typescript
interface KpiCardProps {
  title: string;
  valueCents: number;
  previousValueCents?: number;  // for trend calculation
  subtitle?: string;
  format?: 'currency' | 'percent' | 'number';
}
```

#### `src/components/finance/revenue-chart.tsx` (NEW)
Recharts AreaChart wrapper for the 30-day revenue time series. Accepts `data: RevenueDataPoint[]`. Shows revenue as green area, fees as red line.

#### `src/components/finance/pnl-summary.tsx` (NEW)
P&L breakdown card component. Accepts KPI data + expense/mileage summaries. Renders line items with indentation. Shows net profit bold at bottom.

#### `src/components/finance/transaction-table.tsx` (NEW)
Client component with type filter, paginated table, and action to load more pages. Receives initial data from server, fetches subsequent pages via server action.

#### `src/components/finance/finance-pro-gate.tsx` (NEW)
Reusable upgrade CTA component. Shows feature comparison (FREE vs PRO), pricing, and upgrade button. Used on statements page and as inline CTA on dashboard.

#### `src/components/finance/expense-summary-card.tsx` (NEW)
Read-only expense breakdown by category. Shows category name, amount, count. No add/edit/delete buttons (those are D4.1 scope).

### 2.7 Platform Settings Keys Used

These already exist in the platform settings system. The dashboard reads them for display purposes:

| Key | Used For |
|-----|----------|
| `finance.pricing.pro.annualCents` | Upgrade CTA pricing display (999 = $9.99/mo) |
| `finance.pricing.pro.monthlyCents` | Upgrade CTA pricing display (1499 = $14.99/mo) |
| `finance.reportRetentionDays.free` | 30 -- enforced as transaction history limit |
| `finance.reportRetentionYears.pro` | 2 -- shown in upgrade CTA |
| `finance.expenseCategories` | Category labels for expense summary display |

### 2.8 Validation Schemas

#### `src/lib/validations/finance-center.ts` (NEW)

```typescript
import { z } from 'zod';

export const transactionHistorySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  type: z.enum([
    'ORDER_PAYMENT_CAPTURED',
    'ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'ORDER_STRIPE_PROCESSING_FEE',
    'INSERTION_FEE', 'SUBSCRIPTION_CHARGE', 'FINANCE_SUBSCRIPTION_CHARGE',
    'PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED',
    'REFUND_FULL', 'REFUND_PARTIAL',
    'REFUND_TF_REVERSAL', 'REFUND_BOOST_REVERSAL', 'REFUND_STRIPE_REVERSAL',
    'SHIPPING_LABEL_PURCHASE', 'SHIPPING_LABEL_REFUND',
    'MANUAL_CREDIT', 'MANUAL_DEBIT',
    'RESERVE_HOLD', 'RESERVE_RELEASE',
    'LOCAL_TRANSACTION_FEE',
    'AUTH_FEE_BUYER', 'AUTH_FEE_SELLER',
  ]).optional(),
  typeGroup: z.enum(['ALL', 'SALES', 'FEES', 'PAYOUTS', 'REFUNDS', 'OTHER']).optional(),
}).strict();

export const dashboardPeriodSchema = z.object({
  days: z.number().int().positive().max(365).default(30),
}).strict();
```

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Forbidden in D4
- **NO expense CRUD** (create/update/delete expenses) -- that is D4.1 scope
- **NO mileage CRUD** (create/update/delete mileage entries) -- that is D4.2 scope
- **NO receipt scanning** -- that is D4.2 scope
- **NO CSV/PDF export** -- that is D4.3 scope (PRO only)
- **NO balance sheet or cash flow report** -- that is D4.3 scope
- **NO QuickBooks/Xero integration** -- that is G10.3 scope
- **NO cross-platform revenue** (eBay/Poshmark columns) -- data only available when crosslister ships (F5.1)
- **NO COGS calculation** from listing.cogsCents -- that is D4.1 scope (requires expense-aware P&L)
- **NO new database tables** -- all schema exists
- **NO new database migrations** -- all schema exists

### Banned Patterns
- `as any`, `@ts-ignore`, `@ts-expect-error` -- zero occurrences
- Float for money -- integer cents only, format to dollars only in UI display
- Hardcoded fee rates -- read from ledger entries (already calculated and posted)
- Fee calculations in frontend -- server provides computed KPIs
- `storeId` or `sellerProfileId` as ownership -- always `userId`
- Spreading request body into DB queries -- explicit field mapping
- Files over 300 lines -- split if needed
- `console.log` in production code

### Banned Vocabulary
- "Twicely Balance" -- use "Available for payout"
- "wallet" -- use "payout" or "earnings"
- "Withdraw" -- use "Request payout"
- "FVF" or "Final Value Fee" or "Commission" -- use "Transaction Fee"
- "Stripe fee" (in UI labels) -- use "Payment processing fee"
- "Net payout" -- use "Net earnings"
- "Balance updated" -- use "Your available-for-payout amount changed"

### Route Constraints
- `/my/selling/finances` -- NOT `/my/finances` (Feature Lock-in Addendum section 49 says `/my/finances` but Page Registry #50 says `/my/selling/finances` -- **Page Registry wins** as it is the canonical route source)
- Never use `/dashboard`, `/admin`, `/l/`, `/listing/`, `/store/`

### SPEC INCONSISTENCY -- Document for Owner
The Feature Lock-in Addendum section 49 uses old Finance tier names (Lite / Plus / Pro) with 5 tiers. The Schema (v2.0.7) and Pricing Canonical (v3.2) both define `financeTierEnum = ['FREE', 'PRO']` -- only 2 tiers. **The Schema and Pricing Canonical are authoritative.** D4 uses `FREE` and `PRO` only. The Addendum's "Lite" features map to what FREE gets, and "Plus/Pro" features map to PRO.

The Feature Lock-in Addendum section 49 also says phase "D3" for basic dashboard. The Build Sequence Tracker says "D4". **The Build Sequence Tracker wins** -- this is D4.

---

## 4. ACCEPTANCE CRITERIA

### Functional
1. Visiting `/my/selling/finances` as an authenticated seller shows the Financial Center dashboard with 4 KPI cards, revenue chart, P&L summary, and recent transactions
2. KPI cards show: Gross revenue (30 days), Net earnings, Total fees with effective rate %, Available for payout
3. Revenue chart shows a 30-day time series of daily revenue and fees using recharts
4. P&L summary card shows: Revenue - Fees - Expenses - Mileage Deductions = Net Profit
5. Recent transactions section shows last 5 ledger entries with "View All" link
6. `/my/selling/finances/transactions` shows paginated transaction history with type filter
7. Transaction type filter groups ledger entry types into human-readable categories (Sales, Fees, Payouts, Refunds, Other)
8. FREE tier transaction history is limited to 30 days with upgrade CTA for older data
9. `/my/selling/finances/statements` shows Finance Pro upgrade gate (for FREE tier) or placeholder (for PRO tier)
10. Expense summary card shows read-only category breakdown -- no create/edit/delete buttons
11. If seller has no expenses, show "Track your expenses with Finance Pro" message
12. If seller has no orders, show empty state: "Your financial data will appear here after your first sale"
13. Non-seller users see "Start selling first" state with link to create listing
14. Sellers without Stripe onboarding see "Complete payment setup" state
15. Finance Pro upgrade CTA shows correct pricing ($9.99/mo annual, $14.99/mo monthly) from platform settings
16. Finance Pro upgrade button links to `/my/selling/subscription`

### Authorization
17. Unauthenticated users are redirected to `/auth/login`
18. Non-seller users cannot access finance data (shown "Start selling first")
19. Delegated staff with `finances.view` scope can view the dashboard
20. Delegated staff WITHOUT `finances.view` scope get "Not authorized"
21. CASL subjects `Expense`, `FinancialReport`, `MileageEntry` exist in subjects.ts
22. All server actions check CASL ability before querying data

### Data Integrity
23. All monetary values are stored and transmitted as integer cents
24. All monetary display formatting happens in UI components only (dollars with 2 decimal places)
25. Revenue calculations use `order.totalCents` WHERE `status = 'COMPLETED'` (not PAID, not CREATED)
26. Fee calculations use `ledgerEntry` WHERE relevant types (not recalculated)
27. Balance data comes from `sellerBalance` table (not recomputed from ledger)
28. 30-day window uses `>= now() - 30 days` (inclusive, timezone-aware)

### Vocabulary
29. Zero occurrences of "Twicely Balance", "wallet", "Withdraw", "FVF", "Commission", "Stripe fee" (as label), "Net payout" in any UI text
30. "Available for payout" used for balance display
31. "Transaction Fee" used for TF references
32. "Payment processing fee" used for Stripe fee line items
33. "Net earnings" used for net after fees

### Code Quality
34. Zero `as any`, zero `@ts-ignore`, zero `@ts-expect-error`
35. All files under 300 lines
36. Zod `.strict()` on all input validation schemas
37. TypeScript `strict: true` passes with zero errors
38. Test count >= BASELINE_TESTS (must not decrease)

---

## 5. TEST REQUIREMENTS

### Unit Tests

#### `src/lib/queries/__tests__/finance-center.test.ts` (NEW)

```
describe('getFinanceDashboardKPIs')
  - returns zeros when seller has no completed orders
  - calculates gross revenue from completed orders only (ignores PAID, CANCELED)
  - sums TF fees from ORDER_TF_FEE ledger entries
  - sums Stripe fees from ORDER_STRIPE_PROCESSING_FEE ledger entries
  - sums boost fees from ORDER_BOOST_FEE ledger entries
  - calculates net earnings correctly (revenue - fees - shipping)
  - calculates effective fee rate as percentage with 2 decimal places
  - reads available/pending/reserved from sellerBalance
  - respects the days parameter (30-day default, custom period)
  - handles seller with balance but no orders gracefully

describe('getRevenueTimeSeries')
  - returns empty array when no completed orders
  - groups revenue by date correctly
  - includes all days in range (zero-fill missing days)
  - sums multiple orders on the same day

describe('getRecentTransactions')
  - returns paginated results with correct total count
  - filters by ledger entry type when specified
  - orders by createdAt descending
  - returns empty array for seller with no transactions

describe('getExpenseSummary')
  - returns zeros when seller has no expenses
  - groups expenses by category with correct totals
  - limits recent expenses to 5 entries
  - respects date range filter

describe('getMileageSummary')
  - returns zeros when seller has no mileage entries
  - sums miles and deduction cents correctly
  - counts trips in date range
```

#### `src/lib/actions/__tests__/finance-center.test.ts` (NEW)

```
describe('getFinanceDashboardAction')
  - returns error when not authenticated
  - returns dashboard data for authenticated seller
  - includes financeTier in response
  - handles delegation (uses onBehalfOfSellerId)
  - returns error when CASL denies access

describe('getTransactionHistoryAction')
  - validates input with Zod (rejects negative page)
  - returns paginated transaction list
  - filters by type group when specified
  - returns error when not authorized
```

### Test Patterns
Follow existing patterns from `src/lib/actions/__tests__/storefront.test.ts`:
- Use `vi.mock` for `@/lib/db`, `@/lib/casl`, `@/lib/casl/authorize`
- Use `selectChain` / `insertChain` helpers for Drizzle query mocking
- Use `makeOwnerSession` / `makeStaffSession` helpers from test utilities
- Use `beforeEach` to reset mocks

---

## 6. FILE APPROVAL LIST

### New Files (12)
| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/queries/finance-center.ts` | Finance Center queries (KPIs, time series, transactions, expense summary, mileage summary) |
| 2 | `src/lib/actions/finance-center.ts` | Finance Center server actions (dashboard, transaction history) |
| 3 | `src/lib/validations/finance-center.ts` | Zod validation schemas for finance center inputs |
| 4 | `src/components/finance/kpi-card.tsx` | Reusable KPI display card (value, trend, subtitle) |
| 5 | `src/components/finance/revenue-chart.tsx` | 30-day revenue/fees area chart (recharts) |
| 6 | `src/components/finance/pnl-summary.tsx` | P&L breakdown card (revenue - fees - expenses = net) |
| 7 | `src/components/finance/transaction-table.tsx` | Paginated transaction table with type filter |
| 8 | `src/components/finance/finance-pro-gate.tsx` | Finance Pro upgrade CTA card |
| 9 | `src/components/finance/expense-summary-card.tsx` | Read-only expense category breakdown |
| 10 | `src/lib/queries/__tests__/finance-center.test.ts` | Unit tests for finance center queries |
| 11 | `src/lib/actions/__tests__/finance-center.test.ts` | Unit tests for finance center actions |
| 12 | `src/lib/finance/format.ts` | Money formatting utilities (cents to dollars, trend calc) |

### Modified Files (5)
| # | File Path | Description |
|---|-----------|-------------|
| 13 | `src/lib/casl/subjects.ts` | Add `Expense`, `FinancialReport`, `MileageEntry` subjects |
| 14 | `src/lib/casl/ability.ts` | Add CASL rules for new subjects (seller, staff, admin) |
| 15 | `src/app/(hub)/my/selling/finances/page.tsx` | Replace payout-only page with full Financial Center dashboard |
| 16 | `src/app/(hub)/my/selling/finances/transactions/page.tsx` | Replace "Coming soon" with paginated transaction history |
| 17 | `src/app/(hub)/my/selling/finances/statements/page.tsx` | Replace "Coming soon" with Finance Pro upgrade gate |

**Total: 17 files (12 new + 5 modified)**

---

## 7. PARALLEL STREAMS

This feature has 17 files across 3 independent domains (queries, UI, tests). Decompose into 4 streams.

### Dependency Graph

```
Stream A: CASL + Queries + Validations
    |
    v
Stream B: Server Actions -----> Stream D: Tests
    |
    v
Stream C: UI Pages + Components
```

### Stream A: Foundation (CASL + Queries + Validations)
**Files:** 1, 3, 12, 13, 14 (subjects.ts, ability.ts, finance-center queries, validations, format utils)
**No dependencies -- starts immediately**

Tasks:
1. Add `Expense`, `FinancialReport`, `MileageEntry` to `SUBJECTS` array in `src/lib/casl/subjects.ts`
2. Add CASL rules in `src/lib/casl/ability.ts` for seller, delegated staff, and platform staff actors
3. Create `src/lib/validations/finance-center.ts` with Zod schemas
4. Create `src/lib/finance/format.ts` with `formatCentsToDollars(cents: number): string` and `calculateTrend(current: number, previous: number): { direction: 'up' | 'down' | 'flat'; percent: number }`
5. Create `src/lib/queries/finance-center.ts` with all 5 query functions

**Interface Contract (exported types from queries):**
```typescript
// src/lib/queries/finance-center.ts
export interface FinanceDashboardKPIs {
  grossRevenueCents: number;
  totalOrderCount: number;
  avgSalePriceCents: number;
  tfFeesCents: number;
  stripeFeesCents: number;
  boostFeesCents: number;
  totalFeesCents: number;
  shippingCostsCents: number;
  netEarningsCents: number;
  effectiveFeeRatePercent: number;
  availableForPayoutCents: number;
  pendingCents: number;
  reservedCents: number;
}

export interface RevenueDataPoint {
  date: string;
  revenueCents: number;
  feesCents: number;
  orderCount: number;
}

export interface TransactionRow {
  id: string;
  type: string;
  amountCents: number;
  status: string;
  orderId: string | null;
  memo: string | null;
  postedAt: Date | null;
  createdAt: Date;
}

export interface TransactionListResult {
  transactions: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseSummaryResult {
  totalExpensesCents: number;
  expensesByCategory: Array<{ category: string; totalCents: number; count: number }>;
  recentExpenses: Array<{
    id: string;
    category: string;
    amountCents: number;
    vendor: string | null;
    description: string | null;
    expenseDate: Date;
  }>;
}

export interface MileageSummaryResult {
  totalMiles: number;
  totalDeductionCents: number;
  tripCount: number;
}

export async function getFinanceDashboardKPIs(userId: string, days?: number): Promise<FinanceDashboardKPIs>;
export async function getRevenueTimeSeries(userId: string, days?: number): Promise<RevenueDataPoint[]>;
export async function getRecentTransactions(userId: string, opts: { page: number; pageSize: number; type?: string }): Promise<TransactionListResult>;
export async function getExpenseSummary(userId: string, days?: number): Promise<ExpenseSummaryResult>;
export async function getMileageSummary(userId: string, days?: number): Promise<MileageSummaryResult>;
export async function getFinanceTier(userId: string): Promise<'FREE' | 'PRO'>;
```

```typescript
// src/lib/finance/format.ts
export function formatCentsToDollars(cents: number): string;
export function calculateTrend(currentCents: number, previousCents: number): {
  direction: 'up' | 'down' | 'flat';
  percent: number;
};
export function getLedgerTypeLabel(type: string): string;
export function getLedgerTypeGroup(type: string): 'SALES' | 'FEES' | 'PAYOUTS' | 'REFUNDS' | 'OTHER';
```

### Stream B: Server Actions
**Files:** 2 (finance-center actions)
**Depends on: Stream A (needs query functions and types)**

Tasks:
1. Create `src/lib/actions/finance-center.ts` with `getFinanceDashboardAction()` and `getTransactionHistoryAction()`
2. Both actions use `'use server'` directive
3. Both actions call `authorize()` and check CASL
4. Both actions handle delegation (resolve userId from session)
5. Both actions validate input with Zod `.strict()` schemas

**Interface Contract (exported action signatures):**
```typescript
// src/lib/actions/finance-center.ts
'use server';

export interface FinanceDashboardResponse {
  success: true;
  kpis: FinanceDashboardKPIs;
  timeSeries: RevenueDataPoint[];
  expenses: ExpenseSummaryResult;
  mileage: MileageSummaryResult;
  financeTier: 'FREE' | 'PRO';
} | {
  success: false;
  error: string;
}

export interface TransactionHistoryResponse {
  success: true;
  data: TransactionListResult;
} | {
  success: false;
  error: string;
}

export async function getFinanceDashboardAction(): Promise<FinanceDashboardResponse>;
export async function getTransactionHistoryAction(
  page?: number,
  pageSize?: number,
  type?: string
): Promise<TransactionHistoryResponse>;
```

### Stream C: UI Pages + Components
**Files:** 4, 5, 6, 7, 8, 9, 15, 16, 17 (all components + page modifications)
**Depends on: Stream B (needs action signatures and response types)**

Tasks:
1. Create `src/components/finance/kpi-card.tsx`
2. Create `src/components/finance/revenue-chart.tsx` (uses recharts `AreaChart`)
3. Create `src/components/finance/pnl-summary.tsx`
4. Create `src/components/finance/transaction-table.tsx` (client component with `'use client'`)
5. Create `src/components/finance/finance-pro-gate.tsx`
6. Create `src/components/finance/expense-summary-card.tsx`
7. Modify `src/app/(hub)/my/selling/finances/page.tsx` -- full dashboard
8. Modify `src/app/(hub)/my/selling/finances/transactions/page.tsx` -- paginated history
9. Modify `src/app/(hub)/my/selling/finances/statements/page.tsx` -- upgrade gate

### Stream D: Tests
**Files:** 10, 11 (test files)
**Depends on: Stream A (needs query signatures), Stream B (needs action signatures)**
**Can run in parallel with Stream C**

Tasks:
1. Create `src/lib/queries/__tests__/finance-center.test.ts` with all query tests
2. Create `src/lib/actions/__tests__/finance-center.test.ts` with all action tests
3. Follow existing mock patterns: `vi.mock('@/lib/db')`, `vi.mock('@/lib/casl')`

### Merge Verification
After all streams complete:
- [ ] `pnpm typecheck` passes with 0 errors
- [ ] `pnpm test` passes with count >= BASELINE_TESTS
- [ ] Financial Center dashboard renders with seed data (seller1 has finance subscription + expenses + mileage entries)
- [ ] Transaction history pagination works
- [ ] Expense summary shows seed data categories
- [ ] Finance Pro gate shows correct pricing
- [ ] CASL subjects list includes new entries
- [ ] No banned terms in any file

---

## 8. VERIFICATION CHECKLIST

After implementation, run these exact commands and paste the FULL output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite
pnpm test

# 3. Banned terms check
./twicely-lint.sh

# 4. File size check (all new files under 300 lines)
wc -l src/lib/queries/finance-center.ts src/lib/actions/finance-center.ts src/lib/validations/finance-center.ts src/lib/finance/format.ts src/components/finance/*.tsx src/app/\(hub\)/my/selling/finances/page.tsx src/app/\(hub\)/my/selling/finances/transactions/page.tsx src/app/\(hub\)/my/selling/finances/statements/page.tsx

# 5. Verify CASL subjects added
grep -n "Expense\|FinancialReport\|MileageEntry" src/lib/casl/subjects.ts

# 6. Verify no banned vocabulary in finance components
grep -rn "Twicely Balance\|wallet\|Withdraw\|FVF\|Final Value Fee\|Commission\|Net payout\|Stripe fee" src/components/finance/ src/app/\(hub\)/my/selling/finances/
```

### Expected Outcomes
- TypeScript: 0 errors
- Tests: >= BASELINE_TESTS, all passing
- Banned terms: 0 occurrences
- All files: < 300 lines each
- CASL subjects: `Expense`, `FinancialReport`, `MileageEntry` present
- Banned vocabulary: 0 occurrences in finance components/pages

---

## 9. IMPLEMENTATION NOTES

### Money Formatting Pattern
Create a shared `formatCentsToDollars` utility. Never use `toFixed(2)` on cents/100 (floating point). Use:
```typescript
export function formatCentsToDollars(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${remainder.toString().padStart(2, '0')}`;
}
```

### Ledger Entry Type Mapping
Map ledger entry types to human-readable labels for the transaction table:
```typescript
const TYPE_LABELS: Record<string, string> = {
  ORDER_PAYMENT_CAPTURED: 'Sale',
  ORDER_TF_FEE: 'Transaction Fee',
  ORDER_STRIPE_PROCESSING_FEE: 'Payment processing fee',
  ORDER_BOOST_FEE: 'Boost fee',
  PAYOUT_SENT: 'Payout sent',
  PAYOUT_FAILED: 'Payout failed',
  REFUND_FULL: 'Full refund',
  REFUND_PARTIAL: 'Partial refund',
  SHIPPING_LABEL_PURCHASE: 'Shipping label',
  INSERTION_FEE: 'Insertion fee',
  SUBSCRIPTION_CHARGE: 'Subscription charge',
  FINANCE_SUBSCRIPTION_CHARGE: 'Finance Pro charge',
  LOCAL_TRANSACTION_FEE: 'Local sale fee',
  // ... etc
};
```

### Existing Page Preservation
The existing `payout-balance-card.tsx` and `payout-history-table.tsx` components can be reused or incorporated into the new dashboard layout. The current finances page calls `getBalanceAction()` and `getPayoutsAction()` from `payout-settings.ts` -- these continue to work for the payout section. The new KPI data supplements (not replaces) the payout data.

### Delegation Pattern
Follow the existing pattern from `payout-settings.ts`:
```typescript
const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
```

### financeTier Check Pattern
```typescript
const [profile] = await db
  .select({ financeTier: sellerProfile.financeTier })
  .from(sellerProfile)
  .where(eq(sellerProfile.userId, userId))
  .limit(1);
const tier = profile?.financeTier ?? 'FREE';
```

---

**END OF INSTALL PROMPT -- D4-financial-center-dashboard-free.md**
