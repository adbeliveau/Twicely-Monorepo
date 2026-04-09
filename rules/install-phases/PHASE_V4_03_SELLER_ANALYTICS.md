# V4 Install Phase 03 — Seller Analytics

**Status:** DRAFT (V4)
**Prereq:** Phase V4-02 complete (analytics event schema + emitter + platform snapshot all operational). `analyticsEvent` table exists and events are being written by trigger helpers.
**Canonical:** `rules/canonicals/14_SELLER_ANALYTICS.md`

---

## 0) What this phase installs

### Backend
- `sellerDailySnapshot` table (one row per seller per day)
- `sellerListingPerformance` table (weekly per-listing metrics)
- `sellerPercentileBand` table (platform-wide percentile thresholds)
- Seller snapshot computer in `packages/analytics/src/seller-snapshot-computer.ts`
- BullMQ workers: `seller-daily-snapshot` (02:00 UTC), `seller-listing-performance` (03:00 UTC Monday)
- Seller-facing queries in `apps/web/src/lib/queries/seller-analytics.ts`
- Server action for chart period switching

### UI (Hub)
- `(hub)/my/selling/analytics` -- Enhanced seller analytics dashboard (replaces basic V3 page)
- `(hub)/analytics/sellers/[sellerId]` -- Staff single-seller deep dive page

### Ops
- 9 platform_settings keys seeded
- Cron jobs registered for seller snapshot + listing performance
- Percentile bands computed nightly after snapshot job

---

## 1) Schema (Drizzle)

Append three tables to `packages/db/src/schema/analytics.ts` (created in Phase V4-02):

```ts
// --- Canonical 14: Seller Analytics ---

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

  // Score snapshot (read from sellerProfile, never written by analytics)
  sellerScore:         integer('seller_score'),
  performanceBand:     text('performance_band'),

  computedAt:          timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerDateIdx:       uniqueIndex('sds_seller_date').on(table.sellerId, table.snapshotDate),
  dateIdx:             index('sds_date').on(table.snapshotDate),
}));

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

Generate and apply migration:

```bash
npx drizzle-kit generate --name seller_analytics
npx drizzle-kit migrate
```

---

## 2) Server actions + queries

### 2.1 Seller snapshot computer -- `packages/analytics/src/seller-snapshot-computer.ts`

```ts
import { db } from '@twicely/db';
import {
  order, listing, ledgerEntry, analyticsEvent,
  sellerDailySnapshot, sellerPercentileBand, sellerProfile, shipment,
} from '@twicely/db/schema';
import { sql, and, eq, gte, lt, count, isNotNull } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

function dayStart(d: Date): Date { const r = new Date(d); r.setUTCHours(0,0,0,0); return r; }
function dayEnd(d: Date): Date { const r = new Date(d); r.setUTCHours(23,59,59,999); return r; }
function dateStr(d: Date): string { return d.toISOString().slice(0, 10); }

/**
 * Compute all daily metrics for one seller. Canonical 14, Section 4.2.
 */
export async function computeSellerDailySnapshot(sellerId: string, date: Date): Promise<void> {
  const start = dayStart(date);
  const end = dayEnd(date);

  // GMV + order count
  const [gmvRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${order.totalCents}), 0)`,
    cnt: sql<string>`COUNT(*)`,
  }).from(order).where(and(
    eq(order.sellerId, sellerId),
    sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
    gte(order.createdAt, start), lt(order.createdAt, end),
  ));
  const gmvCents = Number(gmvRow?.total ?? 0);
  const ordersCount = Number(gmvRow?.cnt ?? 0);

  // Net revenue from ledger (SALE_CREDIT - refunds)
  const [creditRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${ledgerEntry.amountCents}), 0)`,
  }).from(ledgerEntry).where(and(
    eq(ledgerEntry.userId, sellerId), eq(ledgerEntry.type, 'SALE_CREDIT'),
    eq(ledgerEntry.status, 'POSTED'),
    gte(ledgerEntry.createdAt, start), lt(ledgerEntry.createdAt, end),
  ));
  const [refundRow] = await db.select({
    total: sql<string>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)`,
    cnt: sql<string>`COUNT(DISTINCT ${ledgerEntry.orderId})`,
  }).from(ledgerEntry).where(and(
    eq(ledgerEntry.userId, sellerId),
    sql`${ledgerEntry.type} IN ('REFUND_FULL', 'REFUND_PARTIAL')`,
    eq(ledgerEntry.status, 'POSTED'),
    gte(ledgerEntry.createdAt, start), lt(ledgerEntry.createdAt, end),
  ));
  const netRevenueCents = Number(creditRow?.total ?? 0) - Number(refundRow?.total ?? 0);
  const refundsCents = Number(refundRow?.total ?? 0);
  const refundsCount = Number(refundRow?.cnt ?? 0);

  // Fees
  const feeTypes = sql`${ledgerEntry.type} IN ('ORDER_TF_FEE','ORDER_BOOST_FEE','INSERTION_FEE')`;
  const [feeRow] = await db.select({
    total: sql<string>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)`,
  }).from(ledgerEntry).where(and(
    eq(ledgerEntry.userId, sellerId), feeTypes,
    eq(ledgerEntry.status, 'POSTED'),
    gte(ledgerEntry.createdAt, start), lt(ledgerEntry.createdAt, end),
  ));
  const totalFeesCents = Number(feeRow?.total ?? 0);

  // Views, visitors, saves from analyticsEvent
  const [viewRow] = await db.select({ cnt: count() }).from(analyticsEvent).where(and(
    eq(analyticsEvent.eventName, 'listing.view'), eq(analyticsEvent.sellerId, sellerId),
    gte(analyticsEvent.occurredAt, start), lt(analyticsEvent.occurredAt, end),
  ));
  const [visitorRow] = await db.select({
    cnt: sql<string>`COUNT(DISTINCT ${analyticsEvent.sessionId})`,
  }).from(analyticsEvent).where(and(
    eq(analyticsEvent.sellerId, sellerId), isNotNull(analyticsEvent.sessionId),
    gte(analyticsEvent.occurredAt, start), lt(analyticsEvent.occurredAt, end),
  ));
  const [saveRow] = await db.select({ cnt: count() }).from(analyticsEvent).where(and(
    eq(analyticsEvent.eventName, 'listing.save'), eq(analyticsEvent.sellerId, sellerId),
    gte(analyticsEvent.occurredAt, start), lt(analyticsEvent.occurredAt, end),
  ));

  // Listings
  const [activeRow] = await db.select({ cnt: count() }).from(listing)
    .where(and(eq(listing.ownerUserId, sellerId), eq(listing.status, 'ACTIVE')));
  const [newRow] = await db.select({ cnt: count() }).from(listing)
    .where(and(eq(listing.ownerUserId, sellerId), gte(listing.createdAt, start), lt(listing.createdAt, end)));

  // Shipping time
  const shipRows = await db.select({
    paidAt: order.paidAt, shippedAt: shipment.shippedAt, handlingDueAt: order.handlingDueAt,
  }).from(order).innerJoin(shipment, eq(shipment.orderId, order.id)).where(and(
    eq(order.sellerId, sellerId), isNotNull(shipment.shippedAt),
    gte(shipment.shippedAt, start), lt(shipment.shippedAt, end),
  ));
  let avgShipTimeMinutes: number | null = null;
  let lateShipmentsCount = 0;
  if (shipRows.length > 0) {
    let total = 0;
    for (const r of shipRows) {
      if (r.paidAt && r.shippedAt) total += (r.shippedAt.getTime() - r.paidAt.getTime()) / 60000;
      if (r.handlingDueAt && r.shippedAt && r.shippedAt > r.handlingDueAt) lateShipmentsCount++;
    }
    avgShipTimeMinutes = Math.round(total / shipRows.length);
  }

  // Score snapshot (read-only from sellerProfile)
  const [profile] = await db.select({
    sellerScore: sellerProfile.sellerScore, performanceBand: sellerProfile.performanceBand,
  }).from(sellerProfile).where(eq(sellerProfile.userId, sellerId));

  // Upsert
  const data = {
    sellerId, snapshotDate: dateStr(date),
    gmvCents, netRevenueCents, totalFeesCents,
    ordersCount, itemsSold: ordersCount,
    avgOrderValueCents: ordersCount > 0 ? Math.round(gmvCents / ordersCount) : 0,
    listingViews: viewRow?.cnt ?? 0, uniqueVisitors: Number(visitorRow?.cnt ?? 0), savesCount: saveRow?.cnt ?? 0,
    activeListings: activeRow?.cnt ?? 0, newListings: newRow?.cnt ?? 0, endedListings: 0,
    refundsCount, refundsCents, disputesCount: 0, returnsCount: 0,
    avgShipTimeMinutes, lateShipmentsCount,
    sellerScore: profile?.sellerScore ?? null, performanceBand: profile?.performanceBand ?? null,
  };

  await db.insert(sellerDailySnapshot).values(data).onConflictDoUpdate({
    target: [sellerDailySnapshot.sellerId, sellerDailySnapshot.snapshotDate],
    set: { ...data, computedAt: new Date() },
  });
}

/**
 * Run nightly for all active sellers. Canonical 14, Section 5.1.
 */
export async function runSellerDailySnapshotJob(date?: Date): Promise<{ processed: number; errors: number }> {
  const enabled = await getPlatformSetting('analytics.seller.enabled', true);
  if (!enabled) { logger.info('seller-daily-snapshot: disabled'); return { processed: 0, errors: 0 }; }

  const target = date ?? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
  const since = new Date(); since.setDate(since.getDate() - 90);
  const batchSize = await getPlatformSetting('analytics.seller.snapshotBatchSize', 50);

  // Active sellers: have ACTIVE listing OR order in last 90 days
  const sellerRows = await db.execute(sql`
    SELECT DISTINCT seller_id FROM (
      SELECT owner_user_id AS seller_id FROM listing WHERE status = 'ACTIVE'
      UNION
      SELECT seller_id FROM "order" WHERE created_at >= ${since.toISOString()}
    ) AS active_sellers
  `);

  let processed = 0, errors = 0;
  for (const row of sellerRows as Array<{ seller_id: string }>) {
    try {
      await computeSellerDailySnapshot(row.seller_id, target);
      processed++;
    } catch (err) {
      errors++;
      logger.error('seller-daily-snapshot.seller_error', { sellerId: row.seller_id, error: String(err) });
    }
  }

  await computePercentileBands();
  logger.info('seller-daily-snapshot.complete', { processed, errors, date: dateStr(target) });
  return { processed, errors };
}

async function computePercentileBands(): Promise<void> {
  const minOrders = await getPlatformSetting('analytics.seller.percentileMinOrders', 5);
  const metrics = ['gmv', 'orders', 'score'] as const;
  const periods = [30, 60, 90] as const;

  for (const metric of metrics) {
    for (const periodDays of periods) {
      const since = new Date(); since.setDate(since.getDate() - periodDays);
      const column = metric === 'gmv' ? 'gmv_cents' : metric === 'orders' ? 'orders_count' : 'seller_score';

      const rows = await db.execute(sql`
        SELECT SUM(${sql.raw(column)}) AS val FROM seller_daily_snapshot
        WHERE snapshot_date >= ${since.toISOString().slice(0, 10)}
        GROUP BY seller_id HAVING SUM(orders_count) >= ${minOrders}
        ORDER BY val ASC
      `);
      const values = (rows as Array<{ val: string }>).map((r) => Number(r.val));
      if (values.length < 4) continue;

      const p = (pct: number) => values[Math.min(Math.floor(pct * values.length), values.length - 1)] ?? 0;

      await db.insert(sellerPercentileBand).values({
        metric, periodDays,
        p25Value: p(0.25), p50Value: p(0.50), p75Value: p(0.75), p90Value: p(0.90),
      }).onConflictDoUpdate({
        target: [sellerPercentileBand.metric, sellerPercentileBand.periodDays],
        set: { p25Value: p(0.25), p50Value: p(0.50), p75Value: p(0.75), p90Value: p(0.90), computedAt: new Date() },
      });
    }
  }
}
```

Add export to `packages/analytics/package.json`:

```json
"./seller-snapshot-computer": "./src/seller-snapshot-computer.ts"
```

### 2.2 Seller-facing queries -- `apps/web/src/lib/queries/seller-analytics.ts`

```ts
import { db } from '@twicely/db';
import {
  sellerDailySnapshot, sellerListingPerformance,
  sellerPercentileBand, sellerProfile, listing,
} from '@twicely/db/schema';
import { and, eq, gte, sql, desc, asc } from 'drizzle-orm';

export type SellerMetric = 'gmv' | 'orders' | 'views' | 'revenue' | 'refunds';
export type PercentileBand = 'top10' | 'top25' | 'top50' | 'top75' | 'bottom25' | 'unknown';

export interface SellerAnalyticsSummary {
  periodDays: number;
  gmvCents: number;
  gmvPreviousCents: number;
  netRevenueCents: number;
  ordersCount: number;
  ordersCountPrevious: number;
  itemsSold: number;
  listingViews: number;
  conversionRate: number;
  avgOrderValueCents: number;
  refundsCount: number;
  activeListings: number;
  sellerScore: number;
  performanceBand: string;
  salesVelocity: number;
}

export interface TimeSeriesPoint { date: string; value: number; }

export interface TopListingRow {
  listingId: string; title: string; status: string;
  views: number; saves: number; purchases: number;
  revenueCents: number; conversionRate: number; daysListed: number;
}

export interface SellerPercentileResult {
  gmv: PercentileBand; orders: PercentileBand; score: PercentileBand;
}

export interface InventoryAgeResult {
  totalActive: number; avgDaysListed: number;
  buckets: { label: string; count: number }[];
}

function periodStart(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function previousPeriodStart(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days * 2);
  return d.toISOString().slice(0, 10);
}

export async function getSellerAnalyticsSummary(
  sellerId: string, periodDays: number,
): Promise<SellerAnalyticsSummary> { /* see Canonical 14 Section 6.2 */ }

export async function getSellerTimeSeries(
  sellerId: string, metric: SellerMetric, periodDays: number,
): Promise<TimeSeriesPoint[]> { /* ordered by snapshotDate asc, capped at 90 days */ }

export async function getSellerTopListings(
  sellerId: string, periodDays: number, limit?: number,
): Promise<TopListingRow[]> { /* grouped by listingId, ordered by revenue desc */ }

export async function getSellerPercentile(sellerId: string): Promise<SellerPercentileResult> {
  /* classify seller's 30-day totals against sellerPercentileBand thresholds */
}

export async function getSellerInventoryAge(sellerId: string): Promise<InventoryAgeResult> {
  /* bucket active listings by days since createdAt */
}
```

Full implementations follow Canonical 14 Section 6 specifications. All queries enforce `sellerId` filter at the query layer for CASL compliance.

### 2.3 Server action -- `apps/web/src/lib/actions/seller-analytics.ts`

```ts
'use server';

import { z } from 'zod';
import { authorize, sub } from '@twicely/casl';
import { ForbiddenError } from '@twicely/casl/authorize';
import { getSellerTimeSeries, getSellerTopListings } from '@/lib/queries/seller-analytics';

const timeSeriesSchema = z.object({
  metric: z.enum(['gmv', 'orders', 'views', 'revenue', 'refunds']),
  periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
}).strict();

export async function fetchSellerTimeSeries(
  metric: 'gmv' | 'orders' | 'views' | 'revenue' | 'refunds',
  periodDays: number,
): Promise<TimeSeriesPoint[]> {
  const { session, ability } = await authorize();
  if (!session) throw new Error('Not authenticated');
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Analytics', { sellerId: userId }))) {
    throw new ForbiddenError('Analytics access required');
  }
  const parsed = timeSeriesSchema.parse({ metric, periodDays });
  return getSellerTimeSeries(userId, parsed.metric, parsed.periodDays);
}

export async function fetchSellerTopListings(
  periodDays: number, limit = 10,
): Promise<TopListingRow[]> {
  const { session, ability } = await authorize();
  if (!session) throw new Error('Not authenticated');
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('Analytics', { sellerId: userId }))) {
    throw new ForbiddenError('Analytics access required');
  }
  return getSellerTopListings(userId, periodDays, limit);
}
```

### 2.4 BullMQ cron registration

Add to `packages/jobs/src/cron-jobs.ts`:

```ts
// Seller analytics crons
const sellerSnapshotPattern = await getPlatformSetting('jobs.cron.sellerDailySnapshot.pattern', '0 2 * * *');
await cronQueue.add('cron:seller-snapshot', { task: 'seller-snapshot' }, {
  repeat: { pattern: sellerSnapshotPattern, tz: 'UTC' },
  jobId: 'cron:seller-snapshot',
});

const listingPerfPattern = await getPlatformSetting('jobs.cron.sellerListingPerformance.pattern', '0 3 * * 1');
await cronQueue.add('cron:seller-listing-performance', { task: 'seller-listing-performance' }, {
  repeat: { pattern: listingPerfPattern, tz: 'UTC' },
  jobId: 'cron:seller-listing-performance',
});
```

Add to cron worker handler:

```ts
case 'seller-snapshot': {
  const { runSellerDailySnapshotJob } = await import('@twicely/analytics/seller-snapshot-computer');
  await runSellerDailySnapshotJob();
  break;
}
case 'seller-listing-performance': {
  // Compute weekly listing performance for prior Mon-Sun
  break;
}
```

---

## 3) UI pages

### 3.1 Enhanced Seller Analytics Dashboard

**File:** `apps/web/src/app/(hub)/my/selling/analytics/page.tsx`
**CASL:** `ability.can('read', sub('Analytics', { sellerId: userId }))`

Replaces the basic V3 page with snapshot-backed data:

**All tiers:**
- Summary cards: GMV, Orders, Active Listings with previous-period comparison arrows
- 30-day sparklines (thin line charts in each card)

**Store PRO+ only (check `sellerProfile.storeTier >= 'STORE_PRO'`):**
- Trend charts (GMV, Orders, Views) with 7d/30d/90d period switcher (client component calling `fetchSellerTimeSeries`)
- Top listings table with views, saves, conversion, revenue (calls `fetchSellerTopListings`)
- Percentile position badges (calls `getSellerPercentile`)
- Sales velocity + inventory age summary (calls `getSellerInventoryAge`)
- Upgrade CTA banner for Basic tier sellers where advanced sections would appear

### 3.2 Staff Single-Seller Deep Dive

**File:** `apps/web/src/app/(hub)/analytics/sellers/[sellerId]/page.tsx`
**CASL:** `ability.can('read', 'Analytics')` (platform-level, no sellerId constraint)

Same data as seller dashboard but for any seller. All sections shown regardless of tier. Additional staff-only features:
- No 90-day cap (full snapshot history available)
- Reconciliation status (snapshot GMV vs. ledger delta for spot-checked days)
- Score history chart from `sellerDailySnapshot.sellerScore` time series

---

## 4) Tests

### 4.1 Snapshot computer tests (`packages/analytics/src/__tests__/seller-snapshot-computer.test.ts`)

| # | Test | Validates |
|---|---|---|
| 1 | `computeSellerDailySnapshot` writes one row | Snapshot upserted |
| 2 | Re-run for same seller+date updates (upsert) | No duplicate rows |
| 3 | GMV matches sum of COMPLETED/DELIVERED orders | Integer cents correctness |
| 4 | Net revenue = SALE_CREDIT minus refunds from ledger | Ledger reconciliation |
| 5 | Listing views sourced from analyticsEvent | Event-to-snapshot pipeline |
| 6 | Score snapshot reads from sellerProfile (never recomputes) | Read-only consumer pattern |
| 7 | `runSellerDailySnapshotJob` processes all active sellers | Full job flow |
| 8 | Kill switch skips when `analytics.seller.enabled=false` | Platform setting respected |
| 9 | Percentile bands computed after all snapshots | Band computation runs |
| 10 | Seller with < percentileMinOrders excluded from bands | Threshold enforcement |

### 4.2 Query tests (`apps/web/src/lib/queries/__tests__/seller-analytics.test.ts`)

| # | Test | Validates |
|---|---|---|
| 1 | `getSellerAnalyticsSummary` aggregates snapshots correctly | Summary math |
| 2 | Previous-period comparison returns correct values | Period offset logic |
| 3 | `getSellerTimeSeries` returns date-ordered points | Sort order |
| 4 | `getSellerTopListings` sorted by revenue desc | Sort correctness |
| 5 | `getSellerPercentile` returns correct band label | Classification logic |
| 6 | Capped at 90 days even if 180 requested | Max period enforcement |
| 7 | `getSellerInventoryAge` bucket counts are correct | Bucket assignment |

### 4.3 Action tests (`apps/web/src/lib/actions/__tests__/seller-analytics.test.ts`)

| # | Test | Validates |
|---|---|---|
| 1 | `fetchSellerTimeSeries` returns data for authenticated seller | Happy path |
| 2 | Rejects unauthenticated requests | Auth enforcement |
| 3 | Seller cannot request other seller's data | CASL sellerId constraint |
| 4 | Invalid metric or periodDays rejected by Zod | Validation |

### 4.4 Mock setup pattern

```ts
vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  sellerDailySnapshot, sellerListingPerformance, sellerPercentileBand, sellerProfile, ...
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(5),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
```

**Total new tests: 21**

---

## 5) Doctor checks

Add to `packages/jobs/src/doctor-checks.ts`:

### 5.1 analytics.seller_snapshots_exist

Verify yesterday's `sellerDailySnapshot` has at least 1 row. Returns HEALTHY if rows found, DEGRADED if zero.

### 5.2 analytics.percentile_bands_fresh

Verify `sellerPercentileBand.computedAt` is within the last 48 hours. Returns HEALTHY if fresh, DEGRADED if stale or missing.

### 5.3 analytics.seller_ledger_reconciliation

Spot-check one random seller from yesterday's snapshots: compare `sellerDailySnapshot.gmvCents` vs. live `SUM(order.totalCents)` query. Returns HEALTHY if within 100 cents, DEGRADED if drift detected.

---

## 6) Seed data

### Platform settings (9 keys)

Add to existing platform_settings seed:

```ts
{ key: 'analytics.seller.enabled',                      value: 'true' },
{ key: 'analytics.seller.maxPeriodDays',                 value: '90' },
{ key: 'analytics.seller.percentileMinOrders',           value: '5' },
{ key: 'analytics.seller.showPercentiles',               value: 'true' },
{ key: 'analytics.seller.snapshotBatchSize',             value: '50' },
{ key: 'analytics.seller.advancedTierRequired',          value: 'STORE_PRO' },
{ key: 'analytics.seller.snapshotRetentionDays',         value: '365' },
{ key: 'jobs.cron.sellerDailySnapshot.pattern',          value: '0 2 * * *' },
{ key: 'jobs.cron.sellerListingPerformance.pattern',     value: '0 3 * * 1' },
```

---

## 7) Phase completion criteria

- [ ] `seller_daily_snapshot` table migrated with `sds_seller_date` unique index and `sds_date` index
- [ ] `seller_listing_performance` table migrated with `slp_seller_listing_period` unique index
- [ ] `seller_percentile_band` table migrated with `spb_metric_period` unique index
- [ ] `packages/analytics/src/seller-snapshot-computer.ts` created with `computeSellerDailySnapshot` + `runSellerDailySnapshotJob`
- [ ] Percentile bands computed nightly after all seller snapshots (p25, p50, p75, p90)
- [ ] Seller-daily-snapshot cron registered at `0 2 * * *` UTC with `tz: 'UTC'`
- [ ] Seller-listing-performance cron registered at `0 3 * * 1` UTC with `tz: 'UTC'`
- [ ] `apps/web/src/lib/queries/seller-analytics.ts` created with 5 query functions
- [ ] `apps/web/src/lib/actions/seller-analytics.ts` created with 2 server actions
- [ ] Seller dashboard at `(hub)/my/selling/analytics` enhanced with snapshot-backed data
- [ ] Staff deep-dive page at `(hub)/analytics/sellers/[sellerId]` created
- [ ] Seller can only see own data (CASL `{ sellerId }` constraint enforced + WHERE sellerId at query layer)
- [ ] Advanced analytics gated behind Store PRO tier (basic cards for all sellers)
- [ ] No buyer PII exposed in any seller-facing response
- [ ] Percentile bands show band label only (`top10`, `top25`, etc.), never raw p-values
- [ ] Score snapshot reads from `sellerProfile` (never recomputes -- scoring engine owns that)
- [ ] 9 platform settings keys seeded
- [ ] 3 doctor checks pass: seller snapshots exist, percentile bands fresh, seller ledger reconciliation
- [ ] 21 new tests green
- [ ] Existing V3 pages unchanged: `(hub)/analytics`, `(hub)/analytics/sellers`, `(hub)/my/selling/analytics` (basic page replaced cleanly)
- [ ] `npx turbo typecheck` passes
- [ ] `npx turbo test` passes (baseline + 21)
