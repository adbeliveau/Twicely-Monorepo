# Canonical 14 — Seller Analytics

**Status:** DRAFT (V4)
**Domain:** Daily seller snapshots, listing performance, percentile bands, seller-facing dashboard
**Depends on:** db (schema), scoring (seller score engine), jobs (BullMQ workers), casl (RBAC), finance (ledger), analytics (platform events from Canonical 15)
**Package:** Queries in `apps/web/src/lib/queries/admin-analytics-sellers.ts` (existing V3) + new snapshot logic in `packages/analytics/src/` + seller queries in `apps/web/src/lib/queries/seller-analytics.ts` (new)

---

## 1. Purpose

Define how seller performance is tracked, aggregated, and surfaced:
- **Daily snapshots** per seller (GMV, orders, views, net revenue, refunds, shipping metrics)
- **Listing-level performance** (views, saves, purchases per listing per period)
- **Percentile bands** (where a seller stands vs. platform, without exposing competitor data)
- **Seller-facing dashboard** at `(hub)/my/selling/analytics` (read-only, own data only)
- **Staff-facing seller analytics table** (already built in V3 at `(hub)/analytics/sellers`)

V4 merges V2's pre-computed snapshot model with V3's live `sellerPerformance` table and the scoring engine in `packages/scoring/src/`. The key distinction: `sellerPerformance` (V3, existing in `packages/db/src/schema/reviews.ts`) stores rolling aggregates for the score engine; `sellerDailySnapshot` (V4, new) stores date-partitioned history for trend charts and the seller dashboard.

---

## 2. Core Principles

1. **Seller sees only own data** -- enforced by `sellerId` filter at query layer + CASL `{ sellerId }` constraint.
2. **No cross-seller comparison** -- percentile bands show relative position ("top 10%", "top 25%") without exposing any other seller's numbers.
3. **Pre-computed, not live** -- seller dashboard reads snapshots, not live transactional queries. No expensive aggregations at page load.
4. **Reconciles with ledger** -- `netRevenueCents` in snapshot must match ledger SALE_CREDIT minus refund entries for the seller + day.
5. **No buyer PII** -- seller analytics never expose buyer names, emails, or addresses. `uniqueVisitors` is a count only.
6. **Integer cents** for all money values.
7. **Max 90-day lookback** for seller dashboard (configurable via `analytics.seller.maxPeriodDays`). Longer ranges require staff export.
8. **Analytics events feed view counts** -- `listing.view` events with `sellerId` property are the source for `listingViews` in snapshots.
9. **Gated by subscription tier** -- basic analytics (summary cards, 30-day view) available to all sellers. Advanced analytics (listing-level performance, percentile bands, 90-day view, trend charts) gated behind Store PRO tier or higher.

---

## 3. Schema (Drizzle pgTable)

All tables in `packages/db/src/schema/analytics.ts` (same file as platform analytics from Canonical 15).

### 3.1 sellerDailySnapshot

One row per seller per day. Computed nightly by BullMQ job.

```ts
export const sellerDailySnapshot = pgTable('seller_daily_snapshot', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  snapshotDate:        date('snapshot_date').notNull(),

  // Revenue
  gmvCents:            integer('gmv_cents').notNull().default(0),
  netRevenueCents:     integer('net_revenue_cents').notNull().default(0),
  totalFeesCents:      integer('total_fees_cents').notNull().default(0),

  // Orders
  ordersCount:         integer('orders_count').notNull().default(0),
  itemsSold:           integer('items_sold').notNull().default(0),
  avgOrderValueCents:  integer('avg_order_value_cents').notNull().default(0),

  // Conversion funnel
  listingViews:        integer('listing_views').notNull().default(0),
  uniqueVisitors:      integer('unique_visitors').notNull().default(0),
  savesCount:          integer('saves_count').notNull().default(0),

  // Listings
  activeListings:      integer('active_listings').notNull().default(0),
  newListings:         integer('new_listings').notNull().default(0),
  endedListings:       integer('ended_listings').notNull().default(0),

  // Quality
  refundsCount:        integer('refunds_count').notNull().default(0),
  refundsCents:        integer('refunds_cents').notNull().default(0),
  disputesCount:       integer('disputes_count').notNull().default(0),
  returnsCount:        integer('returns_count').notNull().default(0),

  // Shipping
  avgShipTimeMinutes:  integer('avg_ship_time_minutes'),
  lateShipmentsCount:  integer('late_shipments_count').notNull().default(0),

  // Score (snapshot of seller score at end of day)
  sellerScore:         integer('seller_score'),
  performanceBand:     text('performance_band'),

  computedAt:          timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerDateIdx:       uniqueIndex('sds_seller_date').on(table.sellerId, table.snapshotDate),
  dateIdx:             index('sds_date').on(table.snapshotDate),
}));
```

### 3.2 sellerListingPerformance

Per-listing metrics aggregated by period (weekly buckets, Monday-Sunday).

```ts
export const sellerListingPerformance = pgTable('seller_listing_performance', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:         text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:        text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  periodStart:      date('period_start').notNull(),
  periodEnd:        date('period_end').notNull(),

  views:            integer('views').notNull().default(0),
  saves:            integer('saves').notNull().default(0),
  purchases:        integer('purchases').notNull().default(0),
  revenueCents:     integer('revenue_cents').notNull().default(0),

  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerListingPeriodIdx: uniqueIndex('slp_seller_listing_period').on(table.sellerId, table.listingId, table.periodStart),
  sellerPeriodIdx:        index('slp_seller_period').on(table.sellerId, table.periodStart),
  listingIdx:             index('slp_listing').on(table.listingId),
}));
```

### 3.3 sellerPercentileBand

Platform-wide percentile thresholds. Computed nightly after all seller snapshots are written. Never exposed to sellers -- only the seller's relative position is shown.

```ts
export const sellerPercentileBand = pgTable('seller_percentile_band', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  metric:          text('metric').notNull(),      // "gmv" | "orders" | "conversion" | "shipTime" | "score"
  periodDays:      integer('period_days').notNull(), // 30 | 60 | 90
  p25Value:        integer('p25_value').notNull(),
  p50Value:        integer('p50_value').notNull(),
  p75Value:        integer('p75_value').notNull(),
  p90Value:        integer('p90_value').notNull(),
  computedAt:      timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  metricPeriodIdx: uniqueIndex('spb_metric_period').on(table.metric, table.periodDays),
}));
```

### 3.4 Existing V3 Tables (no changes)

- `sellerPerformance` in `packages/db/src/schema/reviews.ts` -- rolling aggregates for seller score engine. Stays as-is.
- `sellerProfile` in `packages/db/src/schema/identity.ts` -- `sellerScore`, `performanceBand`, `isNew`. Stays as-is.

These are the **score engine's** tables. The seller analytics domain reads from them but never writes to them.

---

## 4. Business Rules

### 4.1 Snapshot Computation

1. **Run nightly** after platform daily snapshot (depends on platform events being written first).
2. **Active sellers only**: compute for any seller with at least one ACTIVE listing OR at least one order in the last 90 days.
3. **Upsert**: re-running for the same date overwrites (safe for backfills).
4. **Score snapshot**: read `sellerProfile.sellerScore` and `sellerProfile.performanceBand` at snapshot time -- do NOT recompute score (that is the scoring engine's job in `packages/scoring/src/`).
5. **Batch processing**: process sellers in batches of `analytics.seller.snapshotBatchSize` (default 50) to avoid DB pressure.

### 4.2 Data Sources per Field

| Snapshot Field | Source |
|---|---|
| gmvCents | SUM(order.totalCents) WHERE sellerId AND status IN (COMPLETED, DELIVERED) AND paidAt in day |
| netRevenueCents | SUM(ledgerEntry.amountCents) WHERE userId=sellerId AND type=SALE_CREDIT AND status=POSTED in day, minus SUM WHERE type in refund types |
| totalFeesCents | SUM(ABS(ledgerEntry.amountCents)) WHERE userId=sellerId AND type IN platform fee types AND status=POSTED in day |
| ordersCount | COUNT(order) WHERE sellerId AND paidAt in day AND status != CANCELED |
| itemsSold | COUNT(DISTINCT listing_id from order items) for orders in day |
| listingViews | COUNT(analyticsEvent) WHERE eventName='listing.view' AND sellerId in day |
| uniqueVisitors | COUNT(DISTINCT sessionId) from analyticsEvent WHERE sellerId in day |
| savesCount | COUNT(analyticsEvent) WHERE eventName='listing.save' AND sellerId in day |
| activeListings | COUNT(listing) WHERE ownerUserId=sellerId AND status=ACTIVE at end of day |
| newListings | COUNT(listing) WHERE ownerUserId=sellerId AND createdAt in day |
| endedListings | COUNT(listing) WHERE ownerUserId=sellerId AND status changed to ENDED/SOLD in day |
| refundsCount | COUNT(DISTINCT orderId) from ledgerEntry WHERE type in refund types AND sellerId in day |
| refundsCents | SUM(ABS(amountCents)) from ledgerEntry WHERE type in refund types AND sellerId in day |
| disputesCount | COUNT(dispute) WHERE sellerId AND createdAt in day |
| returnsCount | COUNT(returnRequest) WHERE sellerId AND createdAt in day |
| avgShipTimeMinutes | AVG(shippedAt - paidAt) in minutes for orders shipped in day |
| lateShipmentsCount | COUNT where shippedAt > handlingDueAt |
| sellerScore | READ sellerProfile.sellerScore |
| performanceBand | READ sellerProfile.performanceBand |

### 4.3 Percentile Band Rules

1. Computed from the last N days of `sellerDailySnapshot` aggregated per seller.
2. Only include sellers with >= `analytics.seller.percentileMinOrders` (default 5) orders in the period (avoid noisy low-volume sellers skewing bands).
3. Percentiles: p25, p50, p75, p90 computed using standard percentile interpolation.
4. **Never expose actual p-values to sellers.** The API returns only the seller's band label: `"top10"`, `"top25"`, `"top50"`, `"top75"`, `"bottom25"`.
5. Computed for metrics: `gmv`, `orders`, `conversion`, `shipTime`, `score`.
6. Computed for period windows: 30, 60, 90 days.

### 4.4 Listing Performance

1. Aggregated in weekly buckets (Monday-Sunday).
2. Views and saves sourced from `analyticsEvent` WHERE entityType='listing' AND entityId=listingId.
3. Purchases and revenue from completed orders containing that listing.
4. Seller can only see own listings. CASL enforces `{ sellerId }` constraint.
5. Listings with zero views in the period are omitted (not stored as zero-rows).

### 4.5 Sales Velocity & Inventory Age

Derived at query time from `sellerDailySnapshot`, not stored separately:

- **Sales Velocity**: `ordersCount / periodDays` (orders per day over selected period)
- **Inventory Age**: `(today - listing.createdAt)` for ACTIVE listings, computed at query time from the listing table
- **Days to Sell (avg)**: AVG(order.paidAt - listing.createdAt) for completed orders in period

### 4.6 Privacy

1. No buyer names, emails, or addresses in any seller-facing response.
2. `uniqueVisitors` is a count only -- no session IDs exposed.
3. Individual order details are NOT part of analytics (use the orders page for that).
4. Search queries that led to listing views are not exposed to sellers.

### 4.7 Subscription Tier Gating

| Feature | Free / Basic Tier | Store PRO+ |
|---|---|---|
| Summary cards (GMV, orders, active listings) | Yes | Yes |
| 30-day lookback | Yes | Yes |
| 7-day trend sparklines | Yes | Yes |
| 90-day lookback | No | Yes |
| Trend charts with period switcher | No | Yes |
| Listing-level performance table | No | Yes |
| Percentile band indicator | No | Yes |
| Top listings by revenue | No | Yes |
| Sales velocity metrics | No | Yes |

Enforcement: check `sellerProfile.storeTier` at the query layer. If not PRO+, return `null` for gated fields and the UI hides those sections with an upgrade prompt.

---

## 5. Jobs (BullMQ Workers in packages/jobs/)

### 5.1 seller-daily-snapshot

**File:** `packages/jobs/src/seller-daily-snapshot.ts`
**Queue:** `platform-cron`
**Schedule:** `0 2 * * *` (02:00 UTC daily, after platform snapshot at 01:00) via `getPlatformSetting('jobs.cron.sellerDailySnapshot.pattern')`
**Timezone:** `tz: 'UTC'`

```ts
export async function computeSellerDailySnapshot(sellerId: string, date: Date): Promise<void>
export async function runSellerDailySnapshotJob(): Promise<{ processed: number; errors: number }>
```

Behavior:
1. Check `getPlatformSetting('analytics.seller.enabled')` kill switch.
2. Query all active sellers (have ACTIVE listing OR order in last 90 days).
3. For each seller (batched by `analytics.seller.snapshotBatchSize`), compute all fields from section 4.2.
4. Upsert into `sellerDailySnapshot`.
5. After all sellers processed, compute percentile bands (section 5.3).
6. Log summary via `@twicely/logger`.

### 5.2 seller-listing-performance

**File:** `packages/jobs/src/seller-listing-performance.ts`
**Queue:** `platform-cron`
**Schedule:** `0 3 * * 1` (03:00 UTC every Monday) via `getPlatformSetting('jobs.cron.sellerListingPerformance.pattern')`
**Timezone:** `tz: 'UTC'`

Computes weekly listing performance for the prior week (Mon-Sun). For each active seller, queries `analyticsEvent` for listing.view and listing.save events, and completed orders for purchases/revenue. Upserts into `sellerListingPerformance`.

### 5.3 percentile-band-compute

Runs as part of `seller-daily-snapshot` job (not a separate queue entry). After all seller snapshots are written, aggregates and upserts `sellerPercentileBand` for each metric x periodDays combination.

```ts
async function computePercentileBands(date: Date): Promise<void>
```

Uses SQL `PERCENTILE_CONT(0.25)`, `PERCENTILE_CONT(0.50)`, `PERCENTILE_CONT(0.75)`, `PERCENTILE_CONT(0.90)` window functions over the aggregated seller totals.

---

## 6. API / Actions

### 6.1 Existing V3 (staff-facing, keep as-is)

| Function | File | Purpose |
|---|---|---|
| `getSellerAnalyticsTable(params)` | `apps/web/src/lib/queries/admin-analytics-sellers.ts` | Staff table with sort/filter/search |
| `getUserCohortRetention(months)` | same | Cohort retention analysis |

### 6.2 New Seller-Facing Queries

| Function | File | Signature |
|---|---|---|
| `getSellerAnalyticsSummary` | `apps/web/src/lib/queries/seller-analytics.ts` | `(sellerId: string, periodDays: number) => SellerAnalyticsSummary` |
| `getSellerTimeSeries` | same | `(sellerId: string, metric: SellerMetric, periodDays: number) => TimeSeriesPoint[]` |
| `getSellerTopListings` | same | `(sellerId: string, periodDays: number, limit: number) => TopListingRow[]` |
| `getSellerPercentile` | same | `(sellerId: string) => SellerPercentileResult` |
| `getSellerInventoryAge` | same | `(sellerId: string) => InventoryAgeResult` |

### 6.3 New Server Actions

| Action | File | Purpose |
|---|---|---|
| `fetchSellerTimeSeries` | `apps/web/src/lib/actions/seller-analytics.ts` | Period switcher for seller charts |
| `fetchSellerTopListings` | same | Period/sort switcher for top listings table |

### 6.4 Return Types

```ts
interface SellerAnalyticsSummary {
  periodDays: number;
  gmvCents: number;
  gmvPreviousCents: number;           // same-length previous period for comparison
  netRevenueCents: number;
  ordersCount: number;
  ordersCountPrevious: number;
  itemsSold: number;
  listingViews: number;
  conversionRate: number;              // ordersCount / listingViews (0.0-1.0)
  avgOrderValueCents: number;
  refundsCount: number;
  activeListings: number;
  sellerScore: number;
  performanceBand: string;
  salesVelocity: number;               // orders per day
}

interface TopListingRow {
  listingId: string;
  title: string;
  status: string;
  imageUrl: string | null;
  views: number;
  saves: number;
  purchases: number;
  revenueCents: number;
  conversionRate: number;              // purchases / views
  daysListed: number;                  // inventory age
}

interface SellerPercentileResult {
  gmv: PercentileBand;
  orders: PercentileBand;
  score: PercentileBand;
}

type PercentileBand = 'top10' | 'top25' | 'top50' | 'top75' | 'bottom25' | 'unknown';

type SellerMetric = 'gmv' | 'orders' | 'views' | 'revenue' | 'refunds';

interface InventoryAgeResult {
  totalActive: number;
  avgDaysListed: number;
  buckets: {
    label: string;                     // "0-7 days", "8-30 days", "31-60 days", "60+ days"
    count: number;
  }[];
}
```

---

## 7. UI Pages

### 7.1 Seller Analytics Dashboard (existing V3 -- enhanced)

**Route:** `(hub)/my/selling/analytics`
**File:** `apps/web/src/app/(hub)/my/selling/analytics/page.tsx`
**CASL:** `ability.can('read', sub('Analytics', { sellerId: userId }))`

V3 currently has a basic page with live queries (revenue, order count, active listings). V4 enhances with snapshot-backed data:

**Sections (all tiers):**
- A: Summary cards (GMV, Orders, Active Listings) with previous-period comparison and sparkline

**Sections (PRO+ only):**
- B: Trend charts (GMV, Orders, Views) with 7d/30d/90d period switcher
- C: Top listings table (by revenue, with views/saves/conversion)
- D: Percentile position indicator (badge, not raw numbers)
- E: Sales velocity and inventory age summary
- F: Upgrade CTA for Basic tier sellers

### 7.2 Staff Seller Analytics (existing V3)

**Route:** `(hub)/analytics/sellers`
**File:** `apps/web/src/app/(hub)/analytics/sellers/page.tsx`
Already built. Shows sortable table with GMV, orders, cancel rate, return rate, ratings, band, tier.

### 7.3 Staff Single-Seller Deep Dive (new)

**Route:** `(hub)/analytics/sellers/[sellerId]`
**File:** `apps/web/src/app/(hub)/analytics/sellers/[sellerId]/page.tsx`
**CASL:** `ability.can('read', 'Analytics')` (platform-level)

Same data as seller dashboard but for any seller. Shows all sections regardless of tier. Includes additional staff-only information:
- Full snapshot history (no 90-day cap)
- Reconciliation status (snapshot vs. ledger delta)
- Score history chart

---

## 8. RBAC (CASL)

| Action | Subject | Constraint | Roles |
|---|---|---|---|
| `read` | `Analytics` | `{ sellerId }` | SELLER (own data only) |
| `read` | `Analytics` | `{ sellerId }` (any) | SUPPORT_AGENT, SELLER_SUPPORT |
| `read` | `Analytics` | none (platform-wide) | PLATFORM_ADMIN, ANALYTICS_ADMIN |
| `export` | `Analytics` | none | PLATFORM_ADMIN, FINANCE_ADMIN |

Existing V3 CASL is sufficient. The seller-facing queries must always include `WHERE sellerId = session.userId` (or `session.onBehalfOfSellerId` for delegated sessions). CASL's `{ sellerId }` constraint is the enforcement layer.

---

## 9. Platform Settings Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `analytics.seller.enabled` | boolean | `true` | Kill switch for seller analytics dashboard |
| `analytics.seller.maxPeriodDays` | integer | `90` | Max days a seller can query |
| `analytics.seller.percentileMinOrders` | integer | `5` | Minimum orders to include seller in percentile bands |
| `analytics.seller.showPercentiles` | boolean | `true` | Toggle percentile badges on seller dashboard |
| `analytics.seller.snapshotBatchSize` | integer | `50` | Sellers processed per batch in nightly job |
| `analytics.seller.advancedTierRequired` | string | `STORE_PRO` | Minimum subscription tier for advanced analytics |
| `analytics.seller.snapshotRetentionDays` | integer | `365` | Days to retain seller daily snapshots |
| `jobs.cron.sellerDailySnapshot.pattern` | string | `0 2 * * *` | Cron for daily seller snapshots |
| `jobs.cron.sellerListingPerformance.pattern` | string | `0 3 * * 1` | Cron for weekly listing performance |

---

## 10. Observability

| Signal | Type | Description |
|---|---|---|
| `analytics.seller_snapshot.computed` | counter | Seller snapshots written per nightly run |
| `analytics.seller_snapshot.errors` | counter | Sellers that failed computation |
| `analytics.seller_snapshot.duration_ms` | histogram | Total job duration |
| `analytics.percentile_band.computed` | counter | Percentile bands recomputed |
| `analytics.listing_performance.computed` | counter | Listing performance rows written per weekly run |
| `analytics.seller_dashboard.query_ms` | histogram | Seller dashboard query latency |
| `analytics.seller_snapshot.ledger_drift` | gauge | Cents drift between snapshot and ledger for spot-check seller |

---

## 11. Relationship to Scoring Engine

The seller analytics domain is a **read-only consumer** of the scoring engine output:

- `packages/scoring/src/` owns score computation (pure functions).
- `packages/jobs/src/seller-score-recalc.ts` owns the nightly recalc job.
- Seller analytics snapshots READ `sellerProfile.sellerScore` and `sellerProfile.performanceBand` -- they never write to these fields.
- The `sellerPerformance` table (rolling aggregates) feeds the score engine. `sellerDailySnapshot` (daily history) feeds the analytics dashboard. These are separate concerns.

---

## 12. Out of Scope

- **Platform-wide analytics** -- see Canonical 15 (Platform Analytics)
- **Score computation** -- owned by `packages/scoring/src/`
- **Raw event export for sellers** -- sellers never see raw events
- **Cross-seller leaderboards** -- never expose competitive data
- **Custom date ranges beyond 90 days** for sellers (staff has no cap)
- **Real-time seller analytics** -- all data is batch-computed from snapshots
- **Buyer analytics** -- no buyer-facing analytics dashboard in V4
