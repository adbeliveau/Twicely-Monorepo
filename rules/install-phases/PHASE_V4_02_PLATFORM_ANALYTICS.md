# V4 Install Phase 02 — Platform Analytics

**Status:** DRAFT (V4)
**Prereq:** Phase V4-01 complete (core schema, auth, CASL, BullMQ, finance ledger all operational). Existing V3 analytics pages at `(hub)/analytics` and `(hub)/analytics/sellers` already built and working.
**Canonical:** `rules/canonicals/15_PLATFORM_ANALYTICS.md`

---

## 0) What this phase installs

### Backend
- `analyticsEvent` table (idempotent event store with `idempotencyKey` unique constraint)
- `metricSnapshot` table (pre-computed time-series with composite unique index)
- `metricDefinition` table (configurable metric registry)
- `packages/analytics/` -- new workspace package: event emitter, trigger helpers, snapshot queries, snapshot computer
- BullMQ workers: `platform-daily-snapshot` (01:00 UTC), `platform-hourly-snapshot` (5 past every hour), `analytics-event-cleanup` (weekly)
- Reconciliation check after daily snapshot (compares snapshot GMV vs live order query)

### UI (Hub)
- `(hub)/analytics/events` -- Event explorer page (staff-only, filterable, paginated)
- `(hub)/analytics/snapshots` -- Metric snapshot explorer page (staff-only, chart + data table)
- Existing `(hub)/analytics` dashboard unchanged (continues using live V3 queries from `admin-analytics.ts`)

### Ops
- 15 metric definitions seeded into `metricDefinition` table
- 10 platform_settings keys seeded
- 4 doctor checks: event idempotency, snapshot freshness, metric reconciliation, definitions seeded

---

## 1) Schema (Drizzle)

Create `packages/db/src/schema/analytics.ts`:

```ts
import { pgTable, text, integer, boolean, real, timestamp, date, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';

// --- Canonical 15: Platform Analytics ---

export const analyticsEvent = pgTable('analytics_event', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  eventName:        text('event_name').notNull(),
  idempotencyKey:   text('idempotency_key').notNull().unique(),
  actorUserId:      text('actor_user_id'),
  sessionId:        text('session_id'),
  sellerId:         text('seller_id'),
  entityType:       text('entity_type'),
  entityId:         text('entity_id'),
  source:           text('source'),
  medium:           text('medium'),
  campaign:         text('campaign'),
  deviceType:       text('device_type'),
  platform:         text('platform'),
  ipHash:           text('ip_hash'),
  country:          text('country'),
  propertiesJson:   jsonb('properties_json').notNull().default(sql`'{}'`),
  occurredAt:       timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  eventNameOccIdx:  index('ae_event_name_occurred').on(table.eventName, table.occurredAt),
  actorOccIdx:      index('ae_actor_occurred').on(table.actorUserId, table.occurredAt),
  entityIdx:        index('ae_entity').on(table.entityType, table.entityId),
  sessionIdx:       index('ae_session').on(table.sessionId, table.occurredAt),
  sellerIdx:        index('ae_seller').on(table.sellerId, table.occurredAt),
}));

export const metricSnapshot = pgTable('metric_snapshot', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  metricKey:        text('metric_key').notNull(),
  period:           text('period').notNull(),
  periodStart:      timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:        timestamp('period_end', { withTimezone: true }).notNull(),
  valueCents:       integer('value_cents'),
  valueCount:       integer('value_count'),
  valueRate:        real('value_rate'),
  dimensionsJson:   jsonb('dimensions_json').notNull().default(sql`'{}'`),
  computedAt:       timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  metricPeriodIdx:  index('ms_metric_period').on(table.metricKey, table.period, table.periodStart),
  periodStartIdx:   index('ms_period_start').on(table.period, table.periodStart),
  uniqSnapshot:     uniqueIndex('ms_uniq').on(table.metricKey, table.period, table.periodStart, table.dimensionsJson),
}));

export const metricDefinition = pgTable('metric_definition', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  key:              text('key').notNull().unique(),
  name:             text('name').notNull(),
  description:      text('description'),
  unit:             text('unit').notNull().default('count'),
  period:           text('period').notNull().default('DAILY'),
  isActive:         boolean('is_active').notNull().default(true),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Register in `packages/db/src/schema/index.ts`:

```ts
export * from './analytics';
```

Generate and apply migration:

```bash
npx drizzle-kit generate --name platform_analytics
npx drizzle-kit migrate
```

---

## 2) Server actions + queries

### 2.1 Package scaffold: packages/analytics/

```
packages/analytics/
  package.json          -- name: @twicely/analytics
  tsconfig.json
  vitest.config.ts
  src/
    index.ts            -- barrel exports
    emit-event.ts       -- emitEvent(), emitEventsBatch()
    emit-event-types.ts -- EmitEventArgs, AnalyticsEventName, MetricPeriod
    triggers.ts         -- trackListingViewed(), trackOrderPaid(), etc.
    snapshot-computer.ts -- computePlatformDailySnapshot(), computePlatformHourlySnapshot()
    snapshot-queries.ts -- getMetricSeries(), getLatestMetric(), getMetricComparison()
    __tests__/
      emit-event.test.ts
      triggers.test.ts
      snapshot-computer.test.ts
      snapshot-queries.test.ts
```

**`packages/analytics/package.json`:**

```json
{
  "name": "@twicely/analytics",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./emit-event": "./src/emit-event.ts",
    "./emit-event-types": "./src/emit-event-types.ts",
    "./triggers": "./src/triggers.ts",
    "./snapshot-computer": "./src/snapshot-computer.ts",
    "./snapshot-queries": "./src/snapshot-queries.ts"
  },
  "dependencies": {
    "@twicely/db": "workspace:*",
    "@twicely/logger": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

### 2.2 Event types -- `packages/analytics/src/emit-event-types.ts`

```ts
export type AnalyticsEventName =
  // Discovery
  | 'search.query' | 'search.result_click' | 'search.no_results'
  | 'listing.view' | 'listing.save' | 'listing.share'
  // Conversion
  | 'cart.add' | 'cart.remove' | 'checkout.start'
  | 'order.created' | 'order.paid' | 'order.shipped'
  | 'order.delivered' | 'order.completed' | 'order.canceled'
  // Post-purchase
  | 'return.opened' | 'refund.issued' | 'dispute.opened' | 'dispute.resolved' | 'review.submitted'
  // Seller
  | 'listing.created' | 'listing.activated' | 'listing.ended'
  | 'payout.requested' | 'payout.sent'
  // User
  | 'user.signed_up' | 'user.seller_onboarded' | 'user.logged_in'
  // Engagement
  | 'offer.made' | 'offer.accepted' | 'seller.followed' | 'notification.clicked'
  // Finance
  | 'subscription.started' | 'subscription.canceled' | 'subscription.renewed'
  // Platform
  | 'webhook.received' | 'job.failed' | 'health.check_completed';

export interface EmitEventArgs {
  eventName: AnalyticsEventName | string;
  idempotencyKey: string;
  actorUserId?: string;
  sessionId?: string;
  sellerId?: string;
  entityType?: string;
  entityId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  deviceType?: string;
  platform?: string;
  ipHash?: string;
  country?: string;
  properties?: Record<string, unknown>;
  occurredAt?: Date;
}

export type MetricPeriod = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
```

### 2.3 Event emitter -- `packages/analytics/src/emit-event.ts`

```ts
import { db } from '@twicely/db';
import { analyticsEvent } from '@twicely/db/schema';
import { logger } from '@twicely/logger';
import type { EmitEventArgs } from './emit-event-types';

/**
 * Emit a single analytics event. Idempotent -- duplicate keys silently ignored
 * via ON CONFLICT DO NOTHING on idempotency_key.
 */
export async function emitEvent(args: EmitEventArgs): Promise<{ created: boolean }> {
  const result = await db.insert(analyticsEvent).values({
    eventName:      args.eventName,
    idempotencyKey: args.idempotencyKey,
    actorUserId:    args.actorUserId ?? null,
    sessionId:      args.sessionId ?? null,
    sellerId:       args.sellerId ?? null,
    entityType:     args.entityType ?? null,
    entityId:       args.entityId ?? null,
    source:         args.source ?? null,
    medium:         args.medium ?? null,
    campaign:       args.campaign ?? null,
    deviceType:     args.deviceType ?? null,
    platform:       args.platform ?? null,
    ipHash:         args.ipHash ?? null,
    country:        args.country ?? null,
    propertiesJson: args.properties ?? {},
    occurredAt:     args.occurredAt ?? new Date(),
  }).onConflictDoNothing({ target: analyticsEvent.idempotencyKey });

  const created = (result.rowCount ?? 0) > 0;
  if (created) {
    logger.debug('analytics.event.emitted', { eventName: args.eventName, idempotencyKey: args.idempotencyKey });
  }
  return { created };
}

/**
 * Batch emit events. Deduplicates via ON CONFLICT DO NOTHING.
 */
export async function emitEventsBatch(events: EmitEventArgs[]): Promise<{ created: number; skipped: number }> {
  if (events.length === 0) return { created: 0, skipped: 0 };

  const result = await db.insert(analyticsEvent).values(
    events.map((e) => ({
      eventName:      e.eventName,
      idempotencyKey: e.idempotencyKey,
      actorUserId:    e.actorUserId ?? null,
      sessionId:      e.sessionId ?? null,
      sellerId:       e.sellerId ?? null,
      entityType:     e.entityType ?? null,
      entityId:       e.entityId ?? null,
      source:         e.source ?? null,
      medium:         e.medium ?? null,
      campaign:       e.campaign ?? null,
      deviceType:     e.deviceType ?? null,
      platform:       e.platform ?? null,
      ipHash:         e.ipHash ?? null,
      country:        e.country ?? null,
      propertiesJson: e.properties ?? {},
      occurredAt:     e.occurredAt ?? new Date(),
    }))
  ).onConflictDoNothing({ target: analyticsEvent.idempotencyKey });

  const created = result.rowCount ?? 0;
  return { created, skipped: events.length - created };
}
```

### 2.4 Trigger helpers -- `packages/analytics/src/triggers.ts`

Convenience wrappers that construct the correct `idempotencyKey` for each event type:

```ts
import { emitEvent } from './emit-event';

export async function trackListingViewed(
  listingId: string, sellerId: string, userId?: string, sessionId?: string
): Promise<void> {
  const viewer = sessionId ?? userId ?? 'anon';
  const day = new Date().toISOString().slice(0, 10);
  await emitEvent({
    eventName: 'listing.view',
    idempotencyKey: `listing:view:${listingId}:${viewer}:${day}`,
    actorUserId: userId, sessionId, sellerId,
    entityType: 'listing', entityId: listingId,
  });
}

export async function trackSearchPerformed(
  query: string, resultCount: number, userId?: string, sessionId?: string
): Promise<void> {
  await emitEvent({
    eventName: resultCount > 0 ? 'search.query' : 'search.no_results',
    idempotencyKey: `search:${sessionId ?? userId ?? 'anon'}:${Date.now()}`,
    actorUserId: userId, sessionId,
    entityType: 'search',
    properties: { query, resultCount },
  });
}

export async function trackOrderPaid(
  orderId: string, sellerId: string, totalCents: number
): Promise<void> {
  await emitEvent({
    eventName: 'order.paid',
    idempotencyKey: `order:${orderId}:paid`,
    sellerId, entityType: 'order', entityId: orderId,
    properties: { totalCents },
  });
}

export async function trackOrderCompleted(
  orderId: string, gmvCents: number, feeCents: number
): Promise<void> {
  await emitEvent({
    eventName: 'order.completed',
    idempotencyKey: `order:${orderId}:completed`,
    entityType: 'order', entityId: orderId,
    properties: { gmvCents, feeCents },
  });
}

export async function trackUserSignedUp(
  userId: string, source?: string, medium?: string
): Promise<void> {
  await emitEvent({
    eventName: 'user.signed_up',
    idempotencyKey: `user:${userId}:signed_up`,
    actorUserId: userId, entityType: 'user', entityId: userId,
    source, medium,
  });
}

export async function trackSellerOnboarded(sellerId: string): Promise<void> {
  await emitEvent({
    eventName: 'user.seller_onboarded',
    idempotencyKey: `seller:${sellerId}:onboarded`,
    actorUserId: sellerId, sellerId,
    entityType: 'user', entityId: sellerId,
  });
}

export async function trackListingCreated(
  listingId: string, sellerId: string, categoryId?: string
): Promise<void> {
  await emitEvent({
    eventName: 'listing.created',
    idempotencyKey: `listing:${listingId}:created`,
    actorUserId: sellerId, sellerId,
    entityType: 'listing', entityId: listingId,
    properties: categoryId ? { categoryId } : {},
  });
}

export async function trackSearchResultClicked(
  listingId: string, query: string, position: number, userId?: string
): Promise<void> {
  await emitEvent({
    eventName: 'search.result_click',
    idempotencyKey: `search:click:${listingId}:${userId ?? 'anon'}:${Date.now()}`,
    actorUserId: userId,
    entityType: 'listing', entityId: listingId,
    properties: { query, position },
  });
}
```

### 2.5 Snapshot computer -- `packages/analytics/src/snapshot-computer.ts`

```ts
import { db } from '@twicely/db';
import { order, user, listing, ledgerEntry, analyticsEvent, metricSnapshot } from '@twicely/db/schema';
import { sql, gte, lt, and, eq, count } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const PLATFORM_FEE_TYPES = [
  'ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'INSERTION_FEE',
  'SUBSCRIPTION_CHARGE', 'LOCAL_TRANSACTION_FEE', 'CROSSLISTER_PLATFORM_FEE',
] as const;

function dayStart(d: Date): Date { const r = new Date(d); r.setUTCHours(0,0,0,0); return r; }
function dayEnd(d: Date): Date { const r = new Date(d); r.setUTCHours(23,59,59,999); return r; }

async function upsertSnapshot(
  metricKey: string, period: string, start: Date, end: Date,
  opts: { valueCents?: number; valueCount?: number; valueRate?: number },
): Promise<void> {
  await db.insert(metricSnapshot).values({
    metricKey, period, periodStart: start, periodEnd: end,
    valueCents: opts.valueCents ?? null,
    valueCount: opts.valueCount ?? null,
    valueRate: opts.valueRate ?? null,
    dimensionsJson: {},
  }).onConflictDoUpdate({
    target: [metricSnapshot.metricKey, metricSnapshot.period, metricSnapshot.periodStart, metricSnapshot.dimensionsJson],
    set: {
      valueCents: opts.valueCents ?? null, valueCount: opts.valueCount ?? null,
      valueRate: opts.valueRate ?? null, computedAt: new Date(),
    },
  });
}

/**
 * Compute and persist all platform daily snapshots for a given date.
 * Canonical 15, Section 8.1.
 */
export async function computePlatformDailySnapshot(date: Date): Promise<number> {
  const start = dayStart(date);
  const end = dayEnd(date);
  let n = 0;

  // GMV + order count
  const [gmvRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${order.totalCents}), 0)`,
    cnt: sql<string>`COUNT(*)`,
  }).from(order).where(and(
    sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
    gte(order.createdAt, start), lt(order.createdAt, end),
  ));
  const gmvCents = Number(gmvRow?.total ?? 0);
  const orderCount = Number(gmvRow?.cnt ?? 0);

  await upsertSnapshot('gmv.daily', 'DAILY', start, end, { valueCents: gmvCents }); n++;
  await upsertSnapshot('orders.count.daily', 'DAILY', start, end, { valueCount: orderCount }); n++;
  await upsertSnapshot('orders.aov.daily', 'DAILY', start, end, {
    valueCents: orderCount > 0 ? Math.round(gmvCents / orderCount) : 0,
  }); n++;

  // New users / new sellers
  const [userRow] = await db.select({ cnt: count() }).from(user)
    .where(and(gte(user.createdAt, start), lt(user.createdAt, end)));
  await upsertSnapshot('users.new.daily', 'DAILY', start, end, { valueCount: userRow?.cnt ?? 0 }); n++;

  const [sellerRow] = await db.select({ cnt: count() }).from(user)
    .where(and(eq(user.isSeller, true), gte(user.createdAt, start), lt(user.createdAt, end)));
  await upsertSnapshot('users.new_sellers.daily', 'DAILY', start, end, { valueCount: sellerRow?.cnt ?? 0 }); n++;

  // Listings
  const [activeRow] = await db.select({ cnt: count() }).from(listing).where(eq(listing.status, 'ACTIVE'));
  await upsertSnapshot('listings.active.daily', 'DAILY', start, end, { valueCount: activeRow?.cnt ?? 0 }); n++;

  const [newListRow] = await db.select({ cnt: count() }).from(listing)
    .where(and(gte(listing.createdAt, start), lt(listing.createdAt, end)));
  await upsertSnapshot('listings.new.daily', 'DAILY', start, end, { valueCount: newListRow?.cnt ?? 0 }); n++;

  // Fee revenue
  const feeCondition = sql`${ledgerEntry.type} IN (${sql.join(
    PLATFORM_FEE_TYPES.map((t) => sql`${t}`), sql`, `,
  )})`;
  const [feeRow] = await db.select({
    total: sql<string>`COALESCE(SUM(ABS(${ledgerEntry.amountCents})), 0)`,
  }).from(ledgerEntry).where(and(
    feeCondition, eq(ledgerEntry.status, 'POSTED'),
    gte(ledgerEntry.createdAt, start), lt(ledgerEntry.createdAt, end),
  ));
  const feeCents = Number(feeRow?.total ?? 0);
  await upsertSnapshot('fee_revenue.daily', 'DAILY', start, end, { valueCents: feeCents }); n++;

  // Take rate (bps)
  const takeRateBps = gmvCents > 0 ? Math.round((feeCents / gmvCents) * 10000) : 0;
  await upsertSnapshot('take_rate.daily', 'DAILY', start, end, { valueCount: takeRateBps }); n++;

  // Search count
  const [searchRow] = await db.select({ cnt: count() }).from(analyticsEvent)
    .where(and(eq(analyticsEvent.eventName, 'search.query'), gte(analyticsEvent.occurredAt, start), lt(analyticsEvent.occurredAt, end)));
  await upsertSnapshot('search.count.daily', 'DAILY', start, end, { valueCount: searchRow?.cnt ?? 0 }); n++;

  // Reconciliation check
  const tolerance = await getPlatformSetting('analytics.snapshot.reconciliationToleranceCents', 100);
  const [liveGmv] = await db.select({
    total: sql<string>`COALESCE(SUM(${order.totalCents}), 0)`,
  }).from(order).where(and(
    sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
    gte(order.createdAt, start), lt(order.createdAt, end),
  ));
  const drift = Math.abs(gmvCents - Number(liveGmv?.total ?? 0));
  if (drift > tolerance) {
    logger.warn('analytics.snapshot.data_drift', { date: start.toISOString(), snapshotGmv: gmvCents, drift });
  }

  logger.info('analytics.platform_daily_snapshot.complete', { date: start.toISOString(), snapshotCount: n });
  return n;
}

/**
 * Lightweight hourly snapshot: GMV, orders, searches for the previous hour.
 */
export async function computePlatformHourlySnapshot(hour: Date): Promise<number> {
  const start = new Date(hour); start.setMinutes(0, 0, 0);
  const end = new Date(start); end.setHours(end.getHours() + 1);
  let n = 0;

  const [gmvRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${order.totalCents}), 0)`,
    cnt: sql<string>`COUNT(*)`,
  }).from(order).where(and(
    sql`${order.status} IN ('COMPLETED', 'DELIVERED')`,
    gte(order.createdAt, start), lt(order.createdAt, end),
  ));
  await upsertSnapshot('gmv.hourly', 'HOURLY', start, end, { valueCents: Number(gmvRow?.total ?? 0) }); n++;
  await upsertSnapshot('orders.count.hourly', 'HOURLY', start, end, { valueCount: Number(gmvRow?.cnt ?? 0) }); n++;

  const [searchRow] = await db.select({ cnt: count() }).from(analyticsEvent)
    .where(and(eq(analyticsEvent.eventName, 'search.query'), gte(analyticsEvent.occurredAt, start), lt(analyticsEvent.occurredAt, end)));
  await upsertSnapshot('search.count.hourly', 'HOURLY', start, end, { valueCount: searchRow?.cnt ?? 0 }); n++;

  return n;
}
```

### 2.6 Snapshot queries -- `packages/analytics/src/snapshot-queries.ts`

```ts
import { db } from '@twicely/db';
import { metricSnapshot } from '@twicely/db/schema';
import { and, eq, gte, lte, asc, desc } from 'drizzle-orm';
import type { MetricPeriod } from './emit-event-types';

export interface MetricSnapshotRow {
  metricKey: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  valueCents: number | null;
  valueCount: number | null;
  valueRate: number | null;
}

export async function getMetricSeries(
  metricKey: string, period: MetricPeriod, startDate: Date, endDate: Date,
): Promise<MetricSnapshotRow[]> {
  return db.select({
    metricKey: metricSnapshot.metricKey,
    period: metricSnapshot.period,
    periodStart: metricSnapshot.periodStart,
    periodEnd: metricSnapshot.periodEnd,
    valueCents: metricSnapshot.valueCents,
    valueCount: metricSnapshot.valueCount,
    valueRate: metricSnapshot.valueRate,
  }).from(metricSnapshot).where(and(
    eq(metricSnapshot.metricKey, metricKey),
    eq(metricSnapshot.period, period),
    gte(metricSnapshot.periodStart, startDate),
    lte(metricSnapshot.periodStart, endDate),
  )).orderBy(asc(metricSnapshot.periodStart));
}

export async function getLatestMetric(metricKey: string): Promise<MetricSnapshotRow | null> {
  const rows = await db.select({
    metricKey: metricSnapshot.metricKey,
    period: metricSnapshot.period,
    periodStart: metricSnapshot.periodStart,
    periodEnd: metricSnapshot.periodEnd,
    valueCents: metricSnapshot.valueCents,
    valueCount: metricSnapshot.valueCount,
    valueRate: metricSnapshot.valueRate,
  }).from(metricSnapshot)
    .where(eq(metricSnapshot.metricKey, metricKey))
    .orderBy(desc(metricSnapshot.periodStart))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMetricComparison(
  metricKey: string, period: MetricPeriod,
  currentStart: Date, currentEnd: Date,
  previousStart: Date, previousEnd: Date,
): Promise<{ current: MetricSnapshotRow[]; previous: MetricSnapshotRow[] }> {
  const [current, previous] = await Promise.all([
    getMetricSeries(metricKey, period, currentStart, currentEnd),
    getMetricSeries(metricKey, period, previousStart, previousEnd),
  ]);
  return { current, previous };
}
```

### 2.7 Barrel export -- `packages/analytics/src/index.ts`

```ts
export { emitEvent, emitEventsBatch } from './emit-event';
export type { EmitEventArgs, AnalyticsEventName, MetricPeriod } from './emit-event-types';
export { computePlatformDailySnapshot, computePlatformHourlySnapshot } from './snapshot-computer';
export { getMetricSeries, getLatestMetric, getMetricComparison } from './snapshot-queries';
export type { MetricSnapshotRow } from './snapshot-queries';
```

### 2.8 BullMQ workers

**`packages/jobs/src/platform-daily-snapshot.ts`:**

```ts
import { createQueue, createWorker } from './queue';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const QUEUE_NAME = 'platform-daily-snapshot';

export const platformSnapshotQueue = createQueue(QUEUE_NAME);

export function createPlatformSnapshotWorker(): void {
  createWorker(QUEUE_NAME, async (job) => {
    const enabled = await getPlatformSetting('analytics.snapshot.enabled', true);
    if (!enabled) { logger.info('platform-daily-snapshot: disabled'); return; }

    const { computePlatformDailySnapshot } = await import('@twicely/analytics/snapshot-computer');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const count = await computePlatformDailySnapshot(yesterday);
    logger.info('platform-daily-snapshot.done', { metrics: count });
  }, 1);
}
```

**`packages/jobs/src/platform-hourly-snapshot.ts`:**

```ts
import { createWorker } from './queue';
import { logger } from '@twicely/logger';

export function createPlatformHourlySnapshotWorker(): void {
  createWorker('platform-hourly-snapshot', async () => {
    const { computePlatformHourlySnapshot } = await import('@twicely/analytics/snapshot-computer');
    const prevHour = new Date();
    prevHour.setHours(prevHour.getHours() - 1);
    const count = await computePlatformHourlySnapshot(prevHour);
    logger.info('platform-hourly-snapshot.done', { metrics: count });
  }, 1);
}
```

**`packages/jobs/src/analytics-event-cleanup.ts`:**

```ts
import { createWorker } from './queue';
import { db } from '@twicely/db';
import { analyticsEvent } from '@twicely/db/schema';
import { lt } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export function createAnalyticsEventCleanupWorker(): void {
  createWorker('analytics-event-cleanup', async () => {
    const retentionDays = await getPlatformSetting('analytics.event.retentionDays', 365);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await db.delete(analyticsEvent).where(lt(analyticsEvent.occurredAt, cutoff));
    logger.info('analytics-event-cleanup.done', { deleted: result.rowCount ?? 0, cutoff: cutoff.toISOString() });
  }, 1);
}
```

**Register in `packages/jobs/src/cron-jobs.ts`:**

```ts
// Platform analytics crons
const platformSnapshotPattern = await getPlatformSetting('jobs.cron.platformDailySnapshot.pattern', '0 1 * * *');
await cronQueue.add('cron:platform-snapshot', { task: 'platform-snapshot' }, {
  repeat: { pattern: platformSnapshotPattern, tz: 'UTC' },
  jobId: 'cron:platform-snapshot',
});

const hourlySnapshotPattern = await getPlatformSetting('jobs.cron.platformHourlySnapshot.pattern', '5 * * * *');
await cronQueue.add('cron:platform-hourly-snapshot', { task: 'platform-hourly-snapshot' }, {
  repeat: { pattern: hourlySnapshotPattern, tz: 'UTC' },
  jobId: 'cron:platform-hourly-snapshot',
});

const eventCleanupPattern = await getPlatformSetting('jobs.cron.analyticsEventCleanup.pattern', '0 4 * * 0');
await cronQueue.add('cron:analytics-event-cleanup', { task: 'analytics-event-cleanup' }, {
  repeat: { pattern: eventCleanupPattern, tz: 'UTC' },
  jobId: 'cron:analytics-event-cleanup',
});
```

### 2.9 Server actions for new UI pages

**`apps/web/src/lib/actions/admin-analytics-events.ts`:**

```ts
'use server';

import { z } from 'zod';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { ForbiddenError } from '@twicely/casl/authorize';
import { db } from '@twicely/db';
import { analyticsEvent } from '@twicely/db/schema';
import { and, eq, gte, lte, desc, count } from 'drizzle-orm';

const schema = z.object({
  eventName: z.string().optional(),
  actorUserId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
}).strict();

export async function fetchEventExplorerPage(params: z.input<typeof schema>) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Analytics')) throw new ForbiddenError('Analytics access required');
  const p = schema.parse(params);
  // Build WHERE conditions, paginate, return { total, events }
}
```

---

## 3) UI pages

### 3.1 Event Explorer

**File:** `apps/web/src/app/(hub)/analytics/events/page.tsx`
**CASL:** `ability.can('read', 'Analytics')` via `staffAuthorize()`

Layout:
- Filter bar: event name dropdown, actor user ID input, entity type dropdown, date range picker
- Paginated table: occurredAt, eventName, entityType, entityId, actorUserId (link to user profile), properties (expandable)
- Page size selector (25/50/100)
- No raw PII -- actorUserId shown as masked ID, links to user admin page

### 3.2 Metric Snapshot Explorer

**File:** `apps/web/src/app/(hub)/analytics/snapshots/page.tsx`
**CASL:** `ability.can('read', 'Analytics')` via `staffAuthorize()`

Layout:
- Metric key dropdown (populated from `metricDefinition` table)
- Period selector (HOURLY | DAILY | WEEKLY)
- Date range picker
- Time-series line chart (recharts)
- Data table below chart with raw values
- Reconciliation status badge (green = within tolerance, yellow = DATA_DRIFT detected)

---

## 4) Tests

### 4.1 Package tests (`packages/analytics/src/__tests__/`)

| Test File | Count | Validates |
|---|---|---|
| `emit-event.test.ts` | 6 | emitEvent creates row; duplicate key returns `{ created: false }`; batch write creates N rows; batch deduplicates; properties stored as JSON; null optional fields |
| `triggers.test.ts` | 8 | Each trigger helper (trackListingViewed, trackSearchPerformed, trackOrderPaid, trackOrderCompleted, trackUserSignedUp, trackSellerOnboarded, trackListingCreated, trackSearchResultClicked) generates correct eventName + idempotencyKey pattern |
| `snapshot-computer.test.ts` | 7 | Daily snapshot writes 10+ metrics; GMV uses integer cents; AOV derived correctly; fee revenue from ledger; reconciliation detects drift and logs warning; upsert overwrites safely; hourly snapshot writes 3 metrics |
| `snapshot-queries.test.ts` | 4 | getMetricSeries returns ordered data; getLatestMetric returns most recent; getMetricComparison returns both periods; empty results handled |

### 4.2 Job tests (`packages/jobs/src/__tests__/`)

| Test File | Count | Validates |
|---|---|---|
| `platform-daily-snapshot.test.ts` | 4 | Worker calls computePlatformDailySnapshot; kill switch skips; cron registered with UTC tz; correct pattern from platform_settings |
| `platform-hourly-snapshot.test.ts` | 3 | Computes 3 hourly metrics; previous-hour window correct; cron registered |
| `analytics-event-cleanup.test.ts` | 3 | Deletes events older than retentionDays; respects setting; does not delete recent events |

### 4.3 Action tests (`apps/web/src/lib/actions/__tests__/`)

| Test File | Count | Validates |
|---|---|---|
| `admin-analytics-events.test.ts` | 4 | Pagination works; filters by eventName; CASL enforcement (rejects non-admin); empty results return `{ total: 0, events: [] }` |

### 4.4 Mock setup pattern

```ts
vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({ analyticsEvent, metricSnapshot, metricDefinition, ... }));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(100),
}));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() } }));
```

**Total new tests: 39**

---

## 5) Doctor checks

Add to `packages/jobs/src/doctor-checks.ts`:

### 5.1 analytics.event_idempotency

Write a test event with `emitEvent()`, write again with same key, verify only one row exists. Clean up after.

```ts
{
  name: 'analytics.event_idempotency',
  module: 'Analytics',
  check: async () => {
    const testKey = `doctor_test_${Date.now()}`;
    await emitEvent({ eventName: 'doctor.test', idempotencyKey: testKey });
    await emitEvent({ eventName: 'doctor.test', idempotencyKey: testKey });
    const rows = await db.select({ cnt: count() }).from(analyticsEvent)
      .where(eq(analyticsEvent.idempotencyKey, testKey));
    await db.delete(analyticsEvent).where(eq(analyticsEvent.idempotencyKey, testKey));
    return rows[0].cnt === 1 ? 'HEALTHY' : 'UNHEALTHY';
  },
}
```

### 5.2 analytics.snapshot_freshness

Verify yesterday's `gmv.daily` snapshot exists. Returns HEALTHY if found, DEGRADED if missing.

### 5.3 analytics.metric_reconciliation

Compare `gmv.daily` snapshot vs live order query for yesterday. Returns HEALTHY if within `reconciliationToleranceCents`, DEGRADED if drift detected.

### 5.4 analytics.definitions_seeded

Verify `metricDefinition` table has at least 10 rows. Returns HEALTHY if so, DEGRADED if fewer.

---

## 6) Seed data

### 6.1 Metric definitions (15 rows)

Upsert via `db.insert(metricDefinition).values(def).onConflictDoUpdate(...)`:

```ts
const METRIC_DEFINITIONS = [
  { key: 'gmv.daily',               name: 'Daily GMV',           unit: 'cents',  period: 'DAILY' },
  { key: 'gmv.hourly',              name: 'Hourly GMV',          unit: 'cents',  period: 'HOURLY' },
  { key: 'orders.count.daily',      name: 'Daily Orders',        unit: 'count',  period: 'DAILY' },
  { key: 'orders.count.hourly',     name: 'Hourly Orders',       unit: 'count',  period: 'HOURLY' },
  { key: 'orders.aov.daily',        name: 'Daily AOV',           unit: 'cents',  period: 'DAILY' },
  { key: 'users.new.daily',         name: 'New Users Daily',     unit: 'count',  period: 'DAILY' },
  { key: 'users.new_sellers.daily', name: 'New Sellers Daily',   unit: 'count',  period: 'DAILY' },
  { key: 'listings.active.daily',   name: 'Active Listings',     unit: 'count',  period: 'DAILY' },
  { key: 'listings.new.daily',      name: 'New Listings Daily',  unit: 'count',  period: 'DAILY' },
  { key: 'fee_revenue.daily',       name: 'Daily Fee Revenue',   unit: 'cents',  period: 'DAILY' },
  { key: 'take_rate.daily',         name: 'Daily Take Rate',     unit: 'bps',    period: 'DAILY' },
  { key: 'search.count.daily',      name: 'Daily Searches',      unit: 'count',  period: 'DAILY' },
  { key: 'search.count.hourly',     name: 'Hourly Searches',     unit: 'count',  period: 'HOURLY' },
  { key: 'refund_rate.daily',       name: 'Daily Refund Rate',   unit: 'rate',   period: 'DAILY' },
  { key: 'dispute_rate.daily',      name: 'Daily Dispute Rate',  unit: 'rate',   period: 'DAILY' },
];
```

### 6.2 Platform settings (10 keys)

Add to existing platform_settings seed per Canonical 15, Section 12.

---

## 7) Phase completion criteria

- [ ] `analytics_event` table migrated with `idempotency_key` unique constraint and 5 indexes
- [ ] `metric_snapshot` table migrated with composite unique index `ms_uniq`
- [ ] `metric_definition` table migrated with `key` unique constraint
- [ ] `packages/db/src/schema/index.ts` re-exports `./analytics`
- [ ] `packages/analytics/` package created (emit-event, triggers, snapshot-computer, snapshot-queries)
- [ ] `emitEvent()` is idempotent (duplicate key returns `{ created: false }`)
- [ ] `emitEventsBatch()` handles bulk inserts with dedup via ON CONFLICT DO NOTHING
- [ ] `computePlatformDailySnapshot()` writes 10+ metric snapshots with upsert
- [ ] `computePlatformHourlySnapshot()` writes 3 metric snapshots
- [ ] Daily snapshot cron job registered at `0 1 * * *` UTC
- [ ] Hourly snapshot cron job registered at `5 * * * *` UTC
- [ ] Event retention cleanup cron registered at `0 4 * * 0` UTC
- [ ] Reconciliation check logs DATA_DRIFT if delta exceeds tolerance
- [ ] Event explorer page at `(hub)/analytics/events` with filtering and pagination
- [ ] Snapshot explorer page at `(hub)/analytics/snapshots` with chart
- [ ] 15 metric definitions seeded
- [ ] 10 platform settings keys seeded
- [ ] 4 doctor checks pass: event idempotency, snapshot freshness, metric reconciliation, definitions seeded
- [ ] 39 new tests green
- [ ] Existing V3 pages unaffected: `(hub)/analytics`, `(hub)/analytics/sellers`
- [ ] `npx turbo typecheck` passes (25/25 packages including new @twicely/analytics)
- [ ] `npx turbo test` passes (baseline + 39)
