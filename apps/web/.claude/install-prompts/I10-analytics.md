# I10 — Platform Analytics Enrichment

**Phase & Step:** `[I10]`
**Feature Name:** Platform Analytics Dashboard + Seller Analytics Table
**One-line Summary:** Enrich the existing `/analytics` stub into a full platform analytics dashboard with GMV trends, take rate, user growth, cohort retention, and add a new `/analytics/sellers` page for seller performance analytics.

**Canonical Sources (read ALL before starting):**
- `TWICELY_V3_SCHEMA_v2_1_0.md` — order, ledgerEntry, sellerPerformance, sellerProfile, user, listing, review tables
- `TWICELY_V3_PAGE_REGISTRY.md` — Row 126: `/analytics` (STAFF: ADMIN, FINANCE)
- `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — Section 3.5 (FINANCE role), Section 5.5 (corp analytics route)
- `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — Section 9 (Seller Analytics & Financial Tracking), Section 40 (Background Jobs: analytics queue)
- `TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — Section 2.1-2.4 (TF brackets, effective rates, platform settings keys)
- `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` — I10 row: 2 pages, depends on E3.1
- `TWICELY_V3_TESTING_STANDARDS.md` — Unit test patterns

---

## 1. PREREQUISITES

| Dependency | Status | Why Needed |
|---|---|---|
| E3.1 (Hub Dashboard) | COMPLETE | Existing `/analytics` stub page, `admin-dashboard.ts` queries, `StatCard` + `ChartCard` components |
| D4 (Seller Analytics) | Phase reference only | Feature Lock-in Section 9 defines analytics metrics |
| `order` table | EXISTS | GMV, order counts, revenue metrics |
| `ledgerEntry` table | EXISTS | Fee revenue, take rate calculation |
| `sellerPerformance` table | EXISTS | Seller metrics aggregates |
| `sellerProfile` table | EXISTS | Seller tier, band, status data |
| `user` table | EXISTS | User growth, signup metrics |
| `listing` table | EXISTS | Active listings, sell-through rate |
| `review` table | EXISTS | Review metrics |
| `staffAuthorize()` | EXISTS | Hub auth pattern at `src/lib/casl/staff-authorize.ts` |
| `StatCard` component | EXISTS | At `src/components/admin/stat-card.tsx` |
| `ChartCard` component | EXISTS | At `src/components/admin/chart-card.tsx` (client component with period tabs) |
| `AdminPageHeader` component | EXISTS | At `src/components/admin/admin-page-header.tsx` |
| Admin nav `analytics` entry | EXISTS | In `src/lib/hub/admin-nav.ts` line 43-49, roles: ['ADMIN', 'FINANCE'] |

**No new npm packages required.** Charts rendered as simple data tables/bars (no Recharts dependency). Period selector uses existing `ChartCard` period tabs.

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

### 2.1 Database

**No new tables.** All analytics are computed from existing tables:
- `order` (GMV, order counts, revenue by period)
- `ledgerEntry` (fee revenue via `ORDER_TF_FEE`, `ORDER_BOOST_FEE`, `INSERTION_FEE`, `SUBSCRIPTION_CHARGE`, `LOCAL_TRANSACTION_FEE`, `CROSSLISTER_PLATFORM_FEE` types)
- `sellerPerformance` (seller aggregates: totalOrders, completedOrders, canceledOrders, averageRating, lateShipmentRate, cancelRate, returnRate, currentBand)
- `sellerProfile` (sellerType, storeTier, listerTier, performanceBand, status, createdAt)
- `user` (user growth: createdAt, isSeller)
- `listing` (active listings count, status: 'ACTIVE'/'SOLD'/'ENDED')
- `review` (review counts, average rating)

### 2.2 Query Layer — `src/lib/queries/admin-analytics.ts` (NEW)

Create a new query file with these exported functions:

#### `getAnalyticsSummary(periodDays: number): Promise<AnalyticsSummary>`
Returns high-level KPIs for the given period:
- `gmvCents` — SUM of `order.totalCents` WHERE `order.status` IN ('COMPLETED', 'DELIVERED') AND `order.createdAt >= periodStart`
- `gmvPreviousCents` — Same calculation for the PREVIOUS equivalent period (for comparison)
- `orderCount` — COUNT of orders in period (all non-CANCELED statuses)
- `orderCountPrevious` — COUNT in previous period
- `averageOrderCents` — `gmvCents / orderCount` (or 0 if no orders)
- `newUserCount` — COUNT of `user` WHERE `createdAt >= periodStart`
- `newUserCountPrevious` — COUNT in previous period
- `newSellerCount` — COUNT of `user` WHERE `isSeller = true` AND `createdAt >= periodStart`
- `activeListingCount` — COUNT of `listing` WHERE `status = 'ACTIVE'`
- `totalFeeRevenueCents` — SUM of ABS(`ledgerEntry.amountCents`) WHERE `type` IN ('ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'INSERTION_FEE', 'SUBSCRIPTION_CHARGE', 'LOCAL_TRANSACTION_FEE', 'CROSSLISTER_PLATFORM_FEE') AND `status = 'POSTED'` AND `createdAt >= periodStart`. Note: fee ledger entries have NEGATIVE amountCents (debits from seller), so use ABS().
- `takeRateBps` — `(totalFeeRevenueCents / gmvCents) * 10000` rounded to integer (effective platform take rate as basis points). If `gmvCents` is 0, return 0.

Return type:
```typescript
interface AnalyticsSummary {
  gmvCents: number;
  gmvPreviousCents: number;
  orderCount: number;
  orderCountPrevious: number;
  averageOrderCents: number;
  newUserCount: number;
  newUserCountPrevious: number;
  newSellerCount: number;
  activeListingCount: number;
  totalFeeRevenueCents: number;
  takeRateBps: number;
}
```

#### `getAnalyticsTimeSeries(metric: 'gmv' | 'orders' | 'users' | 'fees', periodDays: number): Promise<TimeSeriesPoint[]>`
Returns daily data points for the given metric over the period:
- `gmv` — Daily SUM of `order.totalCents` WHERE status IN ('COMPLETED', 'DELIVERED'), grouped by `DATE(order.createdAt)`
- `orders` — Daily COUNT of orders, grouped by `DATE(order.createdAt)`
- `users` — Daily COUNT of new `user`, grouped by `DATE(user.createdAt)`
- `fees` — Daily SUM of ABS(`ledgerEntry.amountCents`) WHERE `type` IN fee types AND `status = 'POSTED'`, grouped by `DATE(ledgerEntry.createdAt)`

Return type:
```typescript
interface TimeSeriesPoint {
  date: string;  // YYYY-MM-DD
  value: number; // cents for gmv/fees, raw count for orders/users
}
```

#### `getUserCohortRetention(months: number): Promise<CohortRow[]>`
Compute monthly cohort retention:
- For each month in the last `months` months, find users who signed up that month (the "cohort").
- For each subsequent month, count how many users from that cohort placed at least one order.
- Return as array of CohortRow.

Return type:
```typescript
interface CohortRow {
  cohortMonth: string;     // YYYY-MM
  cohortSize: number;      // users who signed up that month
  retentionPcts: number[]; // percentage retained in each subsequent month [month1, month2, ...]
}
```

Implementation note: This is a heavy query. Use raw SQL via `sql` tagged template for the cohort join. Limit to 6 months of cohorts by default. Each retention percentage = (COUNT of cohort users with orders in month N) / cohortSize * 100, rounded to 1 decimal.

#### `getSellerAnalyticsTable(params: SellerAnalyticsParams): Promise<{ sellers: SellerAnalyticsRow[]; total: number }>`
Paginated seller analytics table for `/analytics/sellers`:

Input params:
```typescript
interface SellerAnalyticsParams {
  page: number;         // 1-indexed
  pageSize: number;     // default 25, max 100
  sortBy: 'gmv' | 'orders' | 'rating' | 'cancelRate' | 'returnRate' | 'createdAt';
  sortDir: 'asc' | 'desc';
  bandFilter?: string;  // performanceBand value filter
  tierFilter?: string;  // storeTier value filter
  search?: string;      // search by store name or username
}
```

Query joins `sellerProfile` + `sellerPerformance` + aggregated order data:
```typescript
interface SellerAnalyticsRow {
  userId: string;
  storeName: string | null;
  storeSlug: string | null;
  username: string | null;
  sellerType: string;
  storeTier: string;
  listerTier: string;
  performanceBand: string;
  status: string;
  totalOrders: number;
  completedOrders: number;
  cancelRate: number;       // from sellerPerformance
  returnRate: number;       // from sellerPerformance
  averageRating: number | null;
  totalReviews: number;
  lateShipmentRate: number;
  gmvCents: number;         // SUM order.totalCents for COMPLETED orders by this seller
  createdAt: Date;
}
```

**Important:** The `gmvCents` for each seller requires a subquery or lateral join against the `order` table: `SUM(order.totalCents) WHERE order.sellerId = sellerProfile.userId AND order.status = 'COMPLETED'`. Use a subquery to avoid N+1.

### 2.3 Pages

#### Page 1: `/analytics` (ENRICH existing stub)

**File:** `src/app/(hub)/analytics/page.tsx`

Replace the current stub entirely. The new page has these sections:

**Section A — KPI Cards (top row)**

Use `StatCard` component (already imported on dashboard). Show 8 cards in a responsive grid (2-col on mobile, 4-col on desktop):

| Card | Label | Value | Change | Icon | Color |
|---|---|---|---|---|---|
| 1 | GMV (30d) | formatCents(summary.gmvCents) | % change vs previous 30d | DollarSign | success |
| 2 | Orders (30d) | summary.orderCount | % change vs previous 30d | ShoppingCart | info |
| 3 | Avg Order Value | formatCents(summary.averageOrderCents) | — | Receipt | default |
| 4 | Fee Revenue (30d) | formatCents(summary.totalFeeRevenueCents) | — | Coins | success |
| 5 | Take Rate | formatBps(summary.takeRateBps) (e.g. "9.85%") | — | TrendingUp | info |
| 6 | New Users (30d) | summary.newUserCount | % change vs previous 30d | UserPlus | info |
| 7 | New Sellers (30d) | summary.newSellerCount | — | Users | default |
| 8 | Active Listings | summary.activeListingCount.toLocaleString() | — | Tag | default |

The `change` prop uses `StatCard`'s existing `change` interface: `{ value: number, period: string }`. Calculate: `Math.round(((current - previous) / previous) * 100)` for GMV, orders, and users. If previous is 0, omit change.

**Section B — Trend Charts (2-column grid)**

Use existing `ChartCard` component (client component at `src/components/admin/chart-card.tsx`). Since charts require client interactivity for period switching but the page is a server component, create a thin client wrapper.

Create `src/components/admin/analytics-charts.tsx` (client component):
- Accepts pre-fetched time series data for all 4 metrics at 30d (default load)
- Renders 4 ChartCards in a 2-col grid: "GMV Trend", "Orders Trend", "User Signups", "Fee Revenue"
- Each ChartCard shows a simple bar visualization: for each date point, render a horizontal bar using Tailwind `<div>` with dynamic width proportional to max value in the dataset
- Period tabs: 7d / 30d / 90d. Default: 30d. When period changes, call a server action to refetch data.

Create `src/lib/actions/admin-analytics.ts` (server action):
```typescript
'use server';

export async function fetchAnalyticsTimeSeries(
  metric: 'gmv' | 'orders' | 'users' | 'fees',
  periodDays: number
): Promise<TimeSeriesPoint[]>
```
- Validate metric is one of the 4 allowed values (Zod)
- Validate periodDays is one of [7, 30, 90] (Zod)
- Call `staffAuthorize()` + check `ability.can('read', 'Analytics')`
- Delegate to `getAnalyticsTimeSeries()` query
- Return the data

**Section C — Cohort Retention Table**

Below the charts, render the cohort retention data as an HTML table:
- Columns: Cohort Month | Cohort Size | Month 1 | Month 2 | Month 3 | Month 4 | Month 5 | Month 6
- Each retention cell shows the percentage with color coding: >=50% green, 20-49% yellow, <20% red
- Fetched server-side using `getUserCohortRetention(6)`

**Section D — Link to Sellers**

A card/link at the bottom: "View Seller Performance Table" linking to `/analytics/sellers`.

**Authorization:** `staffAuthorize()` + `ability.can('read', 'Analytics')`. If denied, show `<p>Access denied</p>`.

#### Page 2: `/analytics/sellers` (NEW)

**File:** `src/app/(hub)/analytics/sellers/page.tsx`

A paginated, sortable, filterable table of seller performance metrics.

**Features:**
- Table columns: Store Name (link to `/st/{slug}` if slug exists), Username, Seller Type, StoreTier, PerformanceBand, Status, Total Orders, Cancel Rate (%), Return Rate (%), Avg Rating, Reviews, GMV, Joined
- Default sort: GMV descending
- Filters (rendered as `<select>` dropdowns above table): Performance Band (all / EMERGING / ESTABLISHED / TOP_RATED / POWER_SELLER), StoreTier (all / NONE / STARTER / PRO / POWER / ENTERPRISE)
- Search: text input filtering by store name or username
- Pagination: Previous/Next buttons with page indicator ("Page X of Y")
- All filtering/sorting/pagination via URL search params (server-side)

**Authorization:** Same as `/analytics` — `staffAuthorize()` + `ability.can('read', 'Analytics')`.

**Money formatting:** All `gmvCents` values displayed using `formatCents()` helper (divide by 100, format with 2 decimal places, USD).

### 2.4 CASL Rules

Already exist and are sufficient:
- `FINANCE` role: `can('read', 'Analytics')` — in `src/lib/casl/platform-abilities.ts` line 116
- `ADMIN` / `SUPER_ADMIN`: `can('manage', 'all')` — covers Analytics
- `Analytics` is already registered in `src/lib/casl/subjects.ts` line 29
- `Analytics` is already in `src/lib/casl/permission-registry-data.ts` line 143

No CASL changes needed.

### 2.5 Admin Nav

Already exists at `src/lib/hub/admin-nav.ts` lines 43-49:
```typescript
{
  key: 'analytics',
  label: 'Analytics',
  href: '/analytics',
  icon: 'BarChart2',
  roles: ['ADMIN', 'FINANCE'],
}
```

No nav changes needed. The `/analytics/sellers` sub-page is accessible via link from `/analytics`, not as a separate nav item.

---

## 3. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- Do NOT use "FVF", "Final Value Fee", "commission" — use "Transaction Fee" or "TF" or "Twicely fees"
- Do NOT use "SellerTier", "SubscriptionTier" — use "StoreTier" or "ListerTier"
- Do NOT use "BASIC", "ELITE", "PLUS", "MAX", "PREMIUM", "STANDARD", "RISING" — use correct enum values
- Do NOT use "Twicely Balance", "wallet", "withdraw" — use "Available for payout", "payout", "Request payout"
- Do NOT use "seller dashboard" for the hub — it is "Twicely Hub" or "Hub"
- Do NOT use "take rate" in seller-facing UI (this is admin-only, so it IS acceptable in the hub analytics page)

### Technology Constraints
- Do NOT install Recharts, Chart.js, or any charting library. Use simple Tailwind bar visualization.
- Do NOT use tRPC, Zustand, Redux
- Do NOT use `as any`, `@ts-ignore`, `@ts-expect-error`
- Do NOT spread request body into DB operations

### Business Logic Constraints
- Take rate calculation: Use `ledgerEntry` with status = 'POSTED' only. Do NOT count PENDING or REVERSED entries.
- Fee types for take rate: ONLY count platform fee ledger entries: `ORDER_TF_FEE`, `ORDER_BOOST_FEE`, `INSERTION_FEE`, `SUBSCRIPTION_CHARGE`, `LOCAL_TRANSACTION_FEE`, `CROSSLISTER_PLATFORM_FEE`. Do NOT include `ORDER_STRIPE_PROCESSING_FEE` (that is Stripe's fee, not Twicely's revenue).
- GMV includes only COMPLETED and DELIVERED orders (not CREATED, PAID, PROCESSING, SHIPPED, etc.)
- Money stored and calculated as integer cents. Display conversion only in UI formatters.
- Fee rates are NOT hardcoded. The take rate shown on this page is the REALIZED take rate (actual fees collected / actual GMV), not a configured rate.
- Do NOT show marginal TF rates on this page. Show effective (realized) rate only.
- `sellerProfile.id` is NOT the same as `userId`. The `sellerProfile.userId` column references `user.id`. When joining with `order`, join on `order.sellerId = sellerProfile.userId`, NOT `order.sellerId = sellerProfile.id`.

### Code Constraints
- Max 300 lines per file
- All functions explicitly typed (parameters and return types)
- Zod validation on server action inputs with `.strict()`
- Use `sql` tagged template for complex aggregations
- Parallelize independent DB queries with `Promise.all()`
- Do NOT use `console.log`
- Ownership via `userId` always

---

## 4. ACCEPTANCE CRITERIA

### Functional
- [ ] `/analytics` page renders 8 KPI stat cards with correct data from DB
- [ ] GMV, Orders, and New Users cards show percentage change vs previous period
- [ ] Take rate displays as percentage (e.g., "9.85%") calculated from actual fee revenue / GMV
- [ ] Take rate calculation excludes Stripe processing fees (`ORDER_STRIPE_PROCESSING_FEE`)
- [ ] Take rate calculation only counts POSTED ledger entries (not PENDING/REVERSED)
- [ ] GMV only counts COMPLETED and DELIVERED orders
- [ ] 4 trend chart cards render with simple bar visualization showing daily data points
- [ ] Chart period tabs (7d/30d/90d) switch correctly via server action
- [ ] Cohort retention table shows 6 months of data with color-coded percentages
- [ ] `/analytics/sellers` page renders a paginated table of seller performance data
- [ ] Seller table supports sorting by gmv, orders, rating, cancelRate, returnRate, createdAt
- [ ] Seller table supports filtering by performanceBand and storeTier
- [ ] Seller table supports search by store name or username
- [ ] Seller table pagination works correctly with Previous/Next navigation

### Authorization
- [ ] Both pages require `staffAuthorize()` — unauthenticated staff see error
- [ ] Both pages check `ability.can('read', 'Analytics')` — unauthorized roles see "Access denied"
- [ ] ADMIN role can access both pages
- [ ] FINANCE role can access both pages
- [ ] SUPPORT role CANNOT access either page (no `can('read', 'Analytics')` in SUPPORT abilities)
- [ ] MODERATION role CANNOT access either page
- [ ] Server action `fetchAnalyticsTimeSeries` checks staff auth + CASL before returning data

### Data Integrity
- [ ] All monetary values stored and calculated as integer cents
- [ ] Take rate displayed as percentage with 2 decimal places (bps / 100)
- [ ] `formatCents()` divides by 100 and formats with `minimumFractionDigits: 2`
- [ ] No division by zero when GMV is 0 (take rate defaults to 0)
- [ ] No division by zero when previous period has 0 orders/users (change indicator omitted)
- [ ] Seller GMV calculated via subquery, not N+1 queries

### Vocabulary
- [ ] No banned terms anywhere in the code or UI text
- [ ] Fee revenue labeled as "Fee Revenue" or "Platform Revenue" (not "Commission")
- [ ] Take rate labeled as "Take Rate" (admin-only term, acceptable in hub)

### Code Quality
- [ ] All files under 300 lines
- [ ] Zero `as any`, `@ts-ignore`, `@ts-expect-error`
- [ ] TypeScript strict mode — zero errors
- [ ] Zod validation on server action with `.strict()`
- [ ] No `console.log` statements
- [ ] No hardcoded fee rates

---

## 5. TEST REQUIREMENTS

### Unit Tests — `src/lib/queries/__tests__/admin-analytics.test.ts`

Mock `@/lib/db` and `@/lib/db/schema` following the pattern in `admin-dashboard.test.ts`:

```
describe('getAnalyticsSummary')
  it('returns all fields with correct structure')
  it('returns zeros when DB returns empty rows')
  it('coerces gmvCents from SQL aggregate string to number')
  it('calculates takeRateBps as (feeRevenue / gmv) * 10000')
  it('returns takeRateBps as 0 when gmvCents is 0')
  it('calculates percentage change for gmv, orders, users')
  it('excludes ORDER_STRIPE_PROCESSING_FEE from fee revenue')

describe('getAnalyticsTimeSeries')
  it('returns daily time series points for gmv metric')
  it('returns daily time series points for orders metric')
  it('returns daily time series points for users metric')
  it('returns daily time series points for fees metric')
  it('returns empty array when no data in period')

describe('getUserCohortRetention')
  it('returns correct cohort structure with monthly retention percentages')
  it('handles months with zero signups gracefully')
  it('limits to requested number of months')

describe('getSellerAnalyticsTable')
  it('returns paginated seller rows with total count')
  it('applies band filter when provided')
  it('applies tier filter when provided')
  it('applies search filter when provided')
  it('sorts by gmv descending by default')
  it('paginates correctly with page and pageSize')
```

### Unit Tests — `src/lib/actions/__tests__/admin-analytics.test.ts`

Mock `staffAuthorize` and query functions:

```
describe('fetchAnalyticsTimeSeries')
  it('returns time series data for valid metric and period')
  it('rejects invalid metric values')
  it('rejects invalid period values (not 7, 30, or 90)')
  it('throws ForbiddenError when staff not authenticated')
  it('throws ForbiddenError when ability cannot read Analytics')
```

**Minimum test count: 20 tests across the two test files.**

---

## 6. FILE APPROVAL LIST

| # | File Path | Action | Description |
|---|---|---|---|
| 1 | `src/lib/queries/admin-analytics.ts` | CREATE | Analytics query functions: summary, time series, cohort retention, seller table |
| 2 | `src/lib/actions/admin-analytics.ts` | CREATE | Server action for chart period switching (fetchAnalyticsTimeSeries) |
| 3 | `src/app/(hub)/analytics/page.tsx` | REPLACE | Enriched analytics dashboard: KPI cards, charts, cohort table |
| 4 | `src/components/admin/analytics-charts.tsx` | CREATE | Client component for chart rendering with period tabs |
| 5 | `src/app/(hub)/analytics/sellers/page.tsx` | CREATE | Seller performance analytics table page |
| 6 | `src/lib/queries/__tests__/admin-analytics.test.ts` | CREATE | Unit tests for analytics query functions |
| 7 | `src/lib/actions/__tests__/admin-analytics.test.ts` | CREATE | Unit tests for analytics server action |

**Total: 7 files (3 create, 1 replace, 0 modify + 2 test files + 1 component)**

---

## 7. VERIFICATION CHECKLIST

After implementation, run these checks and report raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Run new tests specifically
pnpm vitest run src/lib/queries/__tests__/admin-analytics.test.ts src/lib/actions/__tests__/admin-analytics.test.ts

# 4. File size check — all files under 300 lines
wc -l src/lib/queries/admin-analytics.ts src/lib/actions/admin-analytics.ts src/app/\(hub\)/analytics/page.tsx src/components/admin/analytics-charts.tsx src/app/\(hub\)/analytics/sellers/page.tsx

# 5. Banned terms check
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|fvf\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|STANDARD\|RISING\|Twicely Balance\|wallet\|Withdraw" src/lib/queries/admin-analytics.ts src/lib/actions/admin-analytics.ts src/app/\(hub\)/analytics/page.tsx src/components/admin/analytics-charts.tsx src/app/\(hub\)/analytics/sellers/page.tsx || echo "No banned terms found"

# 6. No console.log
grep -rn "console.log" src/lib/queries/admin-analytics.ts src/lib/actions/admin-analytics.ts src/app/\(hub\)/analytics/page.tsx src/components/admin/analytics-charts.tsx src/app/\(hub\)/analytics/sellers/page.tsx || echo "No console.log found"

# 7. No as any
grep -rn "as any\|@ts-ignore\|@ts-expect-error" src/lib/queries/admin-analytics.ts src/lib/actions/admin-analytics.ts src/app/\(hub\)/analytics/page.tsx src/components/admin/analytics-charts.tsx src/app/\(hub\)/analytics/sellers/page.tsx || echo "No type overrides found"

# 8. Lint
./twicely-lint.sh
```

**Expected outcomes:**
- TypeScript: 0 errors
- Test count: >= BASELINE_TESTS (currently 8603) + ~20 new tests
- All new tests pass
- All files under 300 lines
- No banned terms
- No console.log
- No type overrides

---

## 8. IMPLEMENTATION NOTES

### Pattern Reference: Existing Dashboard (`/d`)

The existing dashboard page at `src/app/(hub)/d/page.tsx` is the closest pattern reference:
- Uses `staffAuthorize()` for auth
- Imports from `src/lib/queries/admin-dashboard.ts`
- Uses `AdminPageHeader`, `StatCard` components
- Parallelizes queries with `Promise.all()`
- Has a `formatCents()` helper inline

Follow the same patterns. The new analytics page is a richer version of the dashboard.

### Helper Functions

Create a `formatBps` helper within the page file (not exported):
```typescript
function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
```

Reuse the existing `formatCents` pattern from the dashboard.

### Seller Table Pagination via Search Params

The seller table page should read filtering/sorting/pagination from `searchParams`:
```typescript
export default async function SellerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
```

Parse search params server-side. No client-side state needed for this page.

### Cohort Retention SQL Strategy

The cohort retention query should be structured as:
1. Generate month series for the last N months
2. For each month, get users who signed up (the cohort)
3. For each subsequent month, count cohort users who have at least one order
4. Use a single SQL query with CTEs if possible, or multiple queries parallelized

If the SQL becomes too complex for a single query, split into:
- One query: get cohort sizes per month
- One query per cohort: get retention counts per subsequent month
- Parallelize the per-cohort queries

### Take Rate Clarification

The "take rate" on this page is the REALIZED platform take rate:
- Numerator: Total fee revenue collected (sum of TF + boost + insertion + subscription + local TF + crosslister fees from POSTED ledger entries)
- Denominator: Total GMV (sum of COMPLETED + DELIVERED order totals)
- This is NOT the same as the configured TF bracket rates. It reflects what the platform actually earned.
- Display as percentage with 2 decimal places (e.g., "9.85%")

---

## 9. SPEC GAPS / DECISIONS NEEDED

**None identified.** The Page Registry specifies `/analytics` with scope "GMV, take rate, user growth, cohort retention" which is exactly what this prompt implements. The `/analytics/sellers` sub-page is listed in the Build Sequence Tracker as part of I10. All data sources exist in the schema. CASL rules already cover the `Analytics` subject for ADMIN and FINANCE roles.
