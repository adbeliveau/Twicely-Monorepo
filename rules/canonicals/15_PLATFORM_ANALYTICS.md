# Canonical 15 — Platform Analytics

**Status:** DRAFT (V4)
**Domain:** Analytics event tracking, metric snapshots, KPI computation, dashboards
**Depends on:** db (schema), jobs (BullMQ workers), casl (RBAC), finance (ledger reconciliation), commerce (orders)
**Package:** `packages/analytics/src/` (new package) + `apps/web/src/lib/queries/admin-analytics.ts` (existing V3)

---

## 1. Purpose

Define how the platform tracks events, computes aggregate metrics, stores time-series snapshots, and surfaces dashboards. All metric definitions are authoritative -- if a metric is not defined here it must not be used for business decisions.

V4 merges V2's event-first + snapshot design with V3's live Drizzle queries and BullMQ job infrastructure. The key insight: V3 already has working live queries for platform KPIs (GMV, orders, users, fees, cohorts) in `apps/web/src/lib/queries/admin-analytics.ts`; V4 adds event tracking + pre-computed snapshots for historical accuracy and performance at scale.

**What this is:**
- Idempotent event store for all trackable user and system actions
- Pre-computed metric snapshots (hourly/daily/weekly/monthly) for fast dashboard reads
- Configurable metric definitions registry
- BullMQ snapshot computation jobs
- Admin dashboards for GMV, orders, users, conversion, cohorts, fees
- Reconciliation between snapshots and commerce orders + finance ledger

**What this is NOT:**
- Not a real-time streaming analytics pipeline (events are written synchronously, snapshots are batch)
- Not a BI tool (no custom report builder, no ad-hoc SQL)
- Not seller-facing analytics (see Canonical 14 -- Seller Analytics)

---

## 2. Core Principles

1. **Single source of truth** for each metric -- orders table for GMV, ledger for revenue.
2. **Event-first analytics** -- facts (events) before aggregates (snapshots).
3. **Idempotent ingestion** -- duplicate events silently deduplicated via `idempotencyKey` with `ON CONFLICT DO NOTHING`.
4. **Privacy-respecting defaults** -- no raw PII in analytics, IP hashed with SHA-256, no buyer identity in seller analytics, no raw card/payment details.
5. **Reconciliation required** -- snapshots must reconcile with commerce orders + finance ledger within configurable tolerance.
6. **Integer cents** -- all money metrics in integer cents, never floats.
7. **Pre-computed snapshots complement live queries** -- dashboards read snapshots for speed; admin can trigger live recomputation.
8. **Event immutability** -- events are append-only. Never update or delete analytics events (except for GDPR data purge which pseudonymizes `actorUserId`).

---

## 3. Schema (Drizzle pgTable)

All tables in `packages/db/src/schema/analytics.ts` (new file).

### 3.1 analyticsEvent

Idempotent event store. Every tracked user/system action writes one row.

```ts
export const analyticsEvent = pgTable('analytics_event', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),

  // Event identification
  eventName:        text('event_name').notNull(),       // e.g. "listing.view", "order.paid"
  idempotencyKey:   text('idempotency_key').notNull().unique(), // prevents duplicate events

  // Actors
  actorUserId:      text('actor_user_id'),              // user who triggered (nullable for anonymous)
  sessionId:        text('session_id'),                 // browser session
  sellerId:         text('seller_id'),                  // associated seller (if applicable)

  // Entity references
  entityType:       text('entity_type'),                // "listing" | "order" | "search" | ...
  entityId:         text('entity_id'),                  // the entity's primary key

  // Attribution
  source:           text('source'),                     // utm_source / referrer
  medium:           text('medium'),                     // utm_medium
  campaign:         text('campaign'),                   // utm_campaign

  // Device context
  deviceType:       text('device_type'),                // "desktop" | "mobile" | "tablet"
  platform:         text('platform'),                   // "web" | "ios" | "android" | "extension"
  ipHash:           text('ip_hash'),                    // SHA-256 of IP (privacy-safe)
  country:          text('country'),                    // ISO 3166-1 alpha-2

  // Flexible payload
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
```

### 3.2 metricSnapshot

Pre-computed time-series values. One row per metric + period + date + dimension slice.

```ts
export const metricSnapshot = pgTable('metric_snapshot', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  metricKey:        text('metric_key').notNull(),       // e.g. "gmv.daily", "orders.count.daily"
  period:           text('period').notNull(),            // "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY"
  periodStart:      timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:        timestamp('period_end', { withTimezone: true }).notNull(),
  valueCents:       integer('value_cents'),              // for money metrics (integer cents)
  valueCount:       integer('value_count'),              // for count metrics
  valueRate:        real('value_rate'),                   // for rate/percentage metrics (0.0-1.0)
  dimensionsJson:   jsonb('dimensions_json').notNull().default(sql`'{}'`), // e.g. {"categoryId":"cat_123"}
  computedAt:       timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  metricPeriodIdx:  index('ms_metric_period').on(table.metricKey, table.period, table.periodStart),
  periodStartIdx:   index('ms_period_start').on(table.period, table.periodStart),
  uniqSnapshot:     uniqueIndex('ms_uniq').on(table.metricKey, table.period, table.periodStart, table.dimensionsJson),
}));
```

### 3.3 metricDefinition

Registry of known metrics. Drives the snapshot computation job and documents what each metric means.

```ts
export const metricDefinition = pgTable('metric_definition', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  key:              text('key').notNull().unique(),      // matches metricSnapshot.metricKey
  name:             text('name').notNull(),
  description:      text('description'),
  unit:             text('unit').notNull().default('count'), // "cents" | "count" | "rate" | "bps"
  period:           text('period').notNull().default('DAILY'),
  isActive:         boolean('is_active').notNull().default(true),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 4. Event Taxonomy

All events follow the naming convention `<domain>.<action>` in lowercase with dot separator. New event types can be added without schema changes -- `eventName` is a text column, not an enum.

### 4.1 Discovery Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `search.query` | search | `{ query, resultCount, filters }` |
| `search.result_click` | listing | `{ query, position }` |
| `search.no_results` | search | `{ query, filters }` |
| `listing.view` | listing | `{ sellerId, categoryId }` |
| `listing.save` | listing | `{ sellerId }` |
| `listing.share` | listing | `{ channel }` |

### 4.2 Conversion Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `cart.add` | listing | `{ priceCents, sellerId }` |
| `cart.remove` | listing | `{ priceCents }` |
| `checkout.start` | order | `{ itemCount, subtotalCents }` |
| `order.created` | order | `{ sellerId, totalCents }` |
| `order.paid` | order | `{ totalCents, paymentMethod }` |
| `order.shipped` | order | `{ sellerId, carrierCode }` |
| `order.delivered` | order | `{ sellerId }` |
| `order.completed` | order | `{ gmvCents, feeCents }` |
| `order.canceled` | order | `{ cancelInitiator, reason }` |

### 4.3 Post-Purchase Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `return.opened` | return | `{ reason, orderId }` |
| `refund.issued` | order | `{ amountCents, type }` |
| `dispute.opened` | dispute | `{ orderId, type }` |
| `dispute.resolved` | dispute | `{ orderId, resolution }` |
| `review.submitted` | review | `{ orderId, rating }` |

### 4.4 Seller Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `listing.created` | listing | `{ sellerId, categoryId }` |
| `listing.activated` | listing | `{ sellerId, priceCents }` |
| `listing.ended` | listing | `{ sellerId, reason }` |
| `payout.requested` | payout | `{ amountCents, sellerId }` |
| `payout.sent` | payout | `{ amountCents, sellerId }` |

### 4.5 User Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `user.signed_up` | user | `{ source, medium }` |
| `user.seller_onboarded` | user | `{ sellerType }` |
| `user.logged_in` | user | `{ method }` |

### 4.6 Platform / System Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `webhook.received` | webhook | `{ provider, eventType }` |
| `job.failed` | job | `{ queueName, errorMessage }` |
| `health.check_completed` | health | `{ status, providerId }` |

### 4.7 Engagement Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `offer.made` | offer | `{ listingId, amountCents }` |
| `offer.accepted` | offer | `{ listingId, amountCents }` |
| `seller.followed` | user | `{ sellerId }` |
| `notification.clicked` | notification | `{ type, channel }` |

### 4.8 Finance Events

| Event Name | Entity Type | Key Properties |
|---|---|---|
| `subscription.started` | subscription | `{ product, tier }` |
| `subscription.canceled` | subscription | `{ product, reason }` |
| `subscription.renewed` | subscription | `{ product, tier, amountCents }` |

---

## 5. KPI Definitions (Authoritative)

### 5.1 Marketplace Health KPIs

| KPI | Formula | Unit | Source |
|---|---|---|---|
| GMV | SUM(order.totalCents) WHERE status IN (COMPLETED, DELIVERED) | cents | order table |
| Net Revenue | SUM(ABS(ledgerEntry.amountCents)) WHERE type IN platform fee types AND status=POSTED | cents | ledger_entry table |
| Take Rate | Net Revenue / GMV * 10000 | bps | derived |
| Order Count | COUNT(order) WHERE status NOT IN (CANCELED) | count | order table |
| AOV | GMV / Order Count | cents | derived |
| Active Listings | COUNT(listing) WHERE status = ACTIVE | count | listing table |
| Sell-Through Rate | SOLD count / (ACTIVE + SOLD) count | rate | listing table |
| Refund Rate | refunded orders / paid orders | rate | order + ledger |
| Dispute Rate | disputes opened / paid orders | rate | dispute + order |

### 5.2 Growth KPIs

| KPI | Formula | Unit |
|---|---|---|
| New Users | COUNT(user) created in period | count |
| New Sellers | COUNT(user) WHERE isSeller=true created in period | count |
| Buyer Retention (cohort) | distinct buyers with order in month N / cohort size | rate |
| Seller Retention (cohort) | distinct sellers with sale in month N / cohort size | rate |

### 5.3 Discovery KPIs

| KPI | Formula | Unit |
|---|---|---|
| Search CTR | search.result_click events / search.query events | rate |
| Conversion Rate | order.completed events / listing.view events | rate |
| Zero Result Rate | search.no_results events / total search events | rate |

### 5.4 Platform Fee Types (for Net Revenue)

```ts
const PLATFORM_FEE_TYPES = [
  'ORDER_TF_FEE',
  'ORDER_BOOST_FEE',
  'INSERTION_FEE',
  'SUBSCRIPTION_CHARGE',
  'LOCAL_TRANSACTION_FEE',
  'CROSSLISTER_PLATFORM_FEE',
] as const;
```

---

## 6. Business Rules

1. **Idempotency**: `emitEvent()` is safe to call multiple times. Duplicate `idempotencyKey` is silently ignored via `ON CONFLICT DO NOTHING`.
2. **Event immutability**: Events are append-only. Never update or delete analytics events (except for GDPR data purge which pseudonymizes `actorUserId` and clears `sessionId`, `ipHash`).
3. **Snapshot upsert**: Snapshot jobs use `ON CONFLICT (metricKey, period, periodStart, dimensionsJson) DO UPDATE` to allow safe re-runs and backfills.
4. **Reconciliation tolerance**: Snapshot GMV must match order table GMV within `analytics.snapshot.reconciliationToleranceCents` (default 100 cents / $1.00) for any given day. If exceeded, the system logs a `DATA_DRIFT` alert via `@twicely/logger`.
5. **Period capping**: Live queries cap at 90 days (configurable via `analytics.dashboard.maxPeriodDays`). For longer ranges, use pre-computed snapshots.
6. **Previous-period comparison**: Summary cards show current period vs. same-length previous period (e.g., last 30d vs. prior 30d). This is already implemented in V3's `getAnalyticsSummary()`.
7. **Batch event writes**: For high-volume scenarios (e.g., search impressions), use `emitEventsBatch()` which does a bulk INSERT with `ON CONFLICT DO NOTHING`. Batch size capped by `analytics.event.batchSize`.
8. **No raw PII in event properties**: Never store buyer/seller names, emails, phone numbers, or full addresses in `propertiesJson`. Use IDs only. The `ipHash` column stores SHA-256 of the IP, never the raw IP.

---

## 7. Event Emitter

### 7.1 emitEvent

```ts
// packages/analytics/src/emit-event.ts

export async function emitEvent(args: EmitEventArgs): Promise<{ created: boolean; eventId?: string }>
```

Writes a single event to `analyticsEvent` with `ON CONFLICT (idempotency_key) DO NOTHING`. Returns `{ created: true }` if new, `{ created: false }` if deduplicated.

Checks `getPlatformSetting('analytics.event.enabled')` kill switch before writing. If disabled, returns `{ created: false }` silently.

### 7.2 emitEventsBatch

```ts
export async function emitEventsBatch(events: EmitEventArgs[]): Promise<{ created: number; skipped: number }>
```

Bulk INSERT with `ON CONFLICT DO NOTHING`. Batch size validated against `analytics.event.batchSize`.

### 7.3 Trigger Helpers

Convenience wrappers that construct the correct `idempotencyKey` for each event type:

```ts
// packages/analytics/src/triggers.ts

export async function trackListingViewed(listingId: string, sellerId: string, userId?: string, sessionId?: string): Promise<void>
export async function trackSearchPerformed(query: string, resultCount: number, userId?: string, sessionId?: string): Promise<void>
export async function trackSearchResultClicked(listingId: string, query: string, position: number, userId?: string): Promise<void>
export async function trackOrderPaid(orderId: string, sellerId: string, totalCents: number): Promise<void>
export async function trackOrderCompleted(orderId: string, gmvCents: number, feeCents: number): Promise<void>
export async function trackUserSignedUp(userId: string, source?: string, medium?: string): Promise<void>
export async function trackSellerOnboarded(sellerId: string): Promise<void>
export async function trackListingCreated(listingId: string, sellerId: string, categoryId?: string): Promise<void>
```

**Idempotency key patterns:**
- `listing:view:{listingId}:{sessionId|userId}:{YYYY-MM-DD}` (daily dedup per viewer)
- `search:{sessionId}:{timestamp}` (unique per search)
- `order:{orderId}:paid` (once per order lifecycle)
- `order:{orderId}:completed` (once per order lifecycle)
- `user:{userId}:signed_up` (once per user)

---

## 8. Jobs (BullMQ Workers in packages/jobs/)

### 8.1 platform-daily-snapshot

**File:** `packages/jobs/src/platform-daily-snapshot.ts`
**Queue:** `platform-cron`
**Schedule:** `0 1 * * *` (01:00 UTC daily) via `getPlatformSetting('jobs.cron.platformDailySnapshot.pattern')`
**Timezone:** `tz: 'UTC'`

Computes and upserts daily snapshots for:

| Metric Key | Unit | Source |
|---|---|---|
| `gmv.daily` | cents | SUM(order.totalCents) WHERE status IN (COMPLETED, DELIVERED) AND paidAt in day |
| `orders.count.daily` | count | COUNT(order) WHERE paidAt in day AND status != CANCELED |
| `orders.aov.daily` | cents | gmv.daily / orders.count.daily |
| `users.new.daily` | count | COUNT(user) WHERE createdAt in day |
| `users.new_sellers.daily` | count | COUNT(user) WHERE isSeller=true AND createdAt in day |
| `listings.active.daily` | count | COUNT(listing) WHERE status=ACTIVE at end of day |
| `listings.new.daily` | count | COUNT(listing) WHERE createdAt in day |
| `fee_revenue.daily` | cents | SUM(ABS(ledgerEntry.amountCents)) WHERE type IN PLATFORM_FEE_TYPES AND status=POSTED in day |
| `take_rate.daily` | bps | fee_revenue.daily / gmv.daily * 10000 |
| `search.count.daily` | count | COUNT(analyticsEvent) WHERE eventName='search.query' in day |
| `refund_rate.daily` | rate | refunded orders / paid orders in day |
| `dispute_rate.daily` | rate | disputes opened / paid orders in day |

```ts
export async function computePlatformDailySnapshot(date: Date): Promise<MetricSnapshotRow[]>
```

### 8.2 platform-hourly-snapshot

**File:** `packages/jobs/src/platform-hourly-snapshot.ts`
**Queue:** `platform-cron`
**Schedule:** `5 * * * *` (5 minutes past every hour) via `getPlatformSetting('jobs.cron.platformHourlySnapshot.pattern')`

Computes lightweight hourly snapshots for real-time dashboard cards:

| Metric Key | Unit |
|---|---|
| `gmv.hourly` | cents |
| `orders.count.hourly` | count |
| `search.count.hourly` | count |

### 8.3 reconciliation-check

Runs as part of the daily snapshot job (not a separate queue entry). After computing snapshots, compares `gmv.daily` snapshot against a live order query. If delta exceeds `analytics.snapshot.reconciliationToleranceCents`, logs a `DATA_DRIFT` warning via `@twicely/logger` and increments the `analytics.snapshot.data_drift` gauge.

### 8.4 event-retention-cleanup

**File:** `packages/jobs/src/analytics-event-cleanup.ts`
**Queue:** `platform-cron`
**Schedule:** `0 4 * * 0` (04:00 UTC every Sunday) via `getPlatformSetting('jobs.cron.analyticsEventCleanup.pattern')`

Deletes `analyticsEvent` rows older than `analytics.event.retentionDays` (default 365). Snapshots are retained independently per `analytics.snapshot.retentionDays` (default 730).

---

## 9. API / Actions

### 9.1 Existing V3 Live Queries (keep as-is)

| Function | File | Purpose |
|---|---|---|
| `getAnalyticsSummary(periodDays)` | `apps/web/src/lib/queries/admin-analytics.ts` | Live KPI summary cards |
| `getAnalyticsTimeSeries(metric, periodDays)` | same | Live time-series for charts |
| `getUserCohortRetention(months)` | `apps/web/src/lib/queries/admin-analytics-sellers.ts` | Cohort retention table |
| `getSellerAnalyticsTable(params)` | same | Seller performance table |
| `fetchAnalyticsTimeSeries(metric, periodDays)` | `apps/web/src/lib/actions/admin-analytics.ts` | Server action for chart period switching |

These continue to work as-is. They query live transactional tables and are sufficient for the current V3 hub analytics dashboard at `(hub)/analytics`.

### 9.2 New Event Emitter

| Function | File | Purpose |
|---|---|---|
| `emitEvent(args)` | `packages/analytics/src/emit-event.ts` | Idempotent single event write |
| `emitEventsBatch(events)` | same | Batch event write (high-volume) |

### 9.3 New Snapshot Queries

| Function | File | Purpose |
|---|---|---|
| `getMetricSeries(metricKey, period, startDate, endDate)` | `packages/analytics/src/snapshot-queries.ts` | Read pre-computed time-series |
| `getLatestMetric(metricKey)` | same | Read most recent snapshot value |
| `getMetricComparison(metricKey, period, currentStart, previousStart)` | same | Current vs previous period |

### 9.4 New Server Actions

| Action | File | Purpose |
|---|---|---|
| `fetchEventExplorerPage` | `apps/web/src/lib/actions/admin-analytics-events.ts` | Paginated event explorer with filters |
| `fetchSnapshotTimeSeries` | `apps/web/src/lib/actions/admin-analytics-snapshots.ts` | Snapshot-backed time series for charts |

---

## 10. UI Pages

### 10.1 Platform Analytics Dashboard (existing V3)

**Route:** `(hub)/analytics`
**File:** `apps/web/src/app/(hub)/analytics/page.tsx`
**CASL:** `ability.can('read', 'Analytics')` (platform-level, no sellerId constraint)
**Sections:**
- A: KPI summary cards (GMV, Orders, AOV, Fee Revenue, Take Rate, New Users, New Sellers, Active Listings) with previous-period comparison
- B: Trend charts (GMV, Orders, Users, Fees) with 7d/30d/90d period switcher
- C: Cohort retention table (6-month lookback)
- D: Link to seller performance table

Already built and working. No changes needed for V4 phase 1.

### 10.2 Seller Performance Table (existing V3)

**Route:** `(hub)/analytics/sellers`
**File:** `apps/web/src/app/(hub)/analytics/sellers/page.tsx`
**Features:** Sortable table, band/tier filters, search, pagination

Already built. No changes needed.

### 10.3 Event Explorer (new)

**Route:** `(hub)/analytics/events`
**File:** `apps/web/src/app/(hub)/analytics/events/page.tsx`
**CASL:** `ability.can('read', 'Analytics')` (platform-level)
**Features:**
- Filter by eventName, actorUserId, entityType, entityId, date range
- Paginated table (default 50 rows, max 100)
- No raw PII shown -- actorUserId is displayed as a link to user profile, not as email/name
- Export to CSV (platform admin only)

### 10.4 Metric Snapshot Explorer (new)

**Route:** `(hub)/analytics/snapshots`
**File:** `apps/web/src/app/(hub)/analytics/snapshots/page.tsx`
**CASL:** `ability.can('read', 'Analytics')` (platform-level)
**Features:**
- Metric key selector
- Period selector (hourly/daily/weekly)
- Time-series chart with configurable date range
- Reconciliation status indicator

---

## 11. RBAC (CASL)

| Action | Subject | Constraint | Roles |
|---|---|---|---|
| `read` | `Analytics` | none (platform-wide) | PLATFORM_ADMIN, ANALYTICS_ADMIN, DEVELOPER |
| `read` | `Analytics` | `{ sellerId }` | SELLER (own data), SUPPORT_AGENT (any seller) |
| `export` | `Analytics` | none | PLATFORM_ADMIN only |
| `create` | `AnalyticsEvent` | none (system) | Internal only (emit-event.ts) |

Existing V3 CASL setup in `packages/casl/src/` already has:
- `ability.ts`: `can('read', 'Analytics', { sellerId })`
- `platform-abilities.ts`: `can('read', 'Analytics')`
- `staff-abilities.ts`: `can('read', 'Analytics', { sellerId })`
- `subjects.ts`: `'Analytics'`

No changes needed to CASL for platform analytics. Event explorer requires `read Analytics` (platform-level, no sellerId constraint).

---

## 12. Platform Settings Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `analytics.event.enabled` | boolean | `true` | Kill switch for event tracking |
| `analytics.event.batchSize` | integer | `100` | Max events per batch write |
| `analytics.event.retentionDays` | integer | `365` | Days to retain raw events before cleanup |
| `analytics.snapshot.enabled` | boolean | `true` | Kill switch for snapshot computation |
| `analytics.snapshot.reconciliationToleranceCents` | integer | `100` | Max allowed drift before DATA_DRIFT alert |
| `analytics.snapshot.retentionDays` | integer | `730` | Days to retain metric snapshots |
| `analytics.dashboard.maxPeriodDays` | integer | `90` | Max days for live dashboard queries |
| `jobs.cron.platformDailySnapshot.pattern` | string | `0 1 * * *` | Cron pattern for daily snapshot job |
| `jobs.cron.platformHourlySnapshot.pattern` | string | `5 * * * *` | Cron pattern for hourly snapshot job |
| `jobs.cron.analyticsEventCleanup.pattern` | string | `0 4 * * 0` | Cron pattern for event retention cleanup |

---

## 13. Reconciliation

### 13.1 What Reconciles

| Metric | Analytics Source | Authoritative Source | Tolerance |
|---|---|---|---|
| GMV | `gmv.daily` snapshot | SUM(order.totalCents) WHERE status IN (COMPLETED, DELIVERED) | `reconciliationToleranceCents` |
| Net Revenue | `fee_revenue.daily` snapshot | SUM(ABS(ledgerEntry.amountCents)) WHERE type IN PLATFORM_FEE_TYPES | `reconciliationToleranceCents` |
| Order Count | `orders.count.daily` snapshot | COUNT(order) | 0 (exact match) |

### 13.2 When Reconciliation Fails

1. Log `DATA_DRIFT` via `@twicely/logger` with delta amount and metric key.
2. Set `analytics.snapshot.data_drift` gauge to the delta in cents.
3. Dashboard shows a yellow warning banner on the affected metric card.
4. Do NOT block the dashboard -- stale data is better than no data.

---

## 14. Observability

| Signal | Type | Description |
|---|---|---|
| `analytics.event.emitted` | counter | Events successfully written |
| `analytics.event.deduplicated` | counter | Events skipped (idempotency) |
| `analytics.event.batch_size` | histogram | Events per batch write |
| `analytics.snapshot.computed` | counter | Snapshots written per daily run |
| `analytics.snapshot.data_drift` | gauge | Cents drift between snapshot and live query |
| `analytics.snapshot.duration_ms` | histogram | Time to compute all daily snapshots |
| `analytics.event_explorer.query_ms` | histogram | Event explorer query latency |
| `analytics.event_cleanup.deleted` | counter | Events deleted by retention cleanup |

All metrics emitted via `@twicely/logger` structured logging. Alerts configured for `data_drift > reconciliationToleranceCents`.

---

## 15. Seed Data

### 15.1 Metric Definitions

Seed via `apps/web/src/db/seed/` (existing seed infrastructure):

```ts
const METRIC_DEFINITIONS = [
  { key: 'gmv.daily',              name: 'Daily GMV',           unit: 'cents',  period: 'DAILY' },
  { key: 'gmv.hourly',             name: 'Hourly GMV',          unit: 'cents',  period: 'HOURLY' },
  { key: 'orders.count.daily',     name: 'Daily Orders',        unit: 'count',  period: 'DAILY' },
  { key: 'orders.count.hourly',    name: 'Hourly Orders',       unit: 'count',  period: 'HOURLY' },
  { key: 'orders.aov.daily',       name: 'Daily AOV',           unit: 'cents',  period: 'DAILY' },
  { key: 'users.new.daily',        name: 'New Users Daily',     unit: 'count',  period: 'DAILY' },
  { key: 'users.new_sellers.daily',name: 'New Sellers Daily',   unit: 'count',  period: 'DAILY' },
  { key: 'listings.active.daily',  name: 'Active Listings',     unit: 'count',  period: 'DAILY' },
  { key: 'listings.new.daily',     name: 'New Listings Daily',  unit: 'count',  period: 'DAILY' },
  { key: 'fee_revenue.daily',      name: 'Daily Fee Revenue',   unit: 'cents',  period: 'DAILY' },
  { key: 'take_rate.daily',        name: 'Daily Take Rate',     unit: 'bps',    period: 'DAILY' },
  { key: 'search.count.daily',     name: 'Daily Searches',      unit: 'count',  period: 'DAILY' },
  { key: 'search.count.hourly',    name: 'Hourly Searches',     unit: 'count',  period: 'HOURLY' },
  { key: 'refund_rate.daily',      name: 'Daily Refund Rate',   unit: 'rate',   period: 'DAILY' },
  { key: 'dispute_rate.daily',     name: 'Daily Dispute Rate',  unit: 'rate',   period: 'DAILY' },
];
```

### 15.2 Platform Settings

Add to existing platform_settings seed:

```ts
{ key: 'analytics.event.enabled',                           value: 'true' },
{ key: 'analytics.event.batchSize',                         value: '100' },
{ key: 'analytics.event.retentionDays',                     value: '365' },
{ key: 'analytics.snapshot.enabled',                        value: 'true' },
{ key: 'analytics.snapshot.reconciliationToleranceCents',   value: '100' },
{ key: 'analytics.snapshot.retentionDays',                  value: '730' },
{ key: 'analytics.dashboard.maxPeriodDays',                 value: '90' },
{ key: 'jobs.cron.platformDailySnapshot.pattern',           value: '0 1 * * *' },
{ key: 'jobs.cron.platformHourlySnapshot.pattern',          value: '5 * * * *' },
{ key: 'jobs.cron.analyticsEventCleanup.pattern',           value: '0 4 * * 0' },
```

---

## 16. Out of Scope

- **Seller-facing analytics** -- see Canonical 14 (Seller Analytics)
- **Real-time event streaming** -- V4 uses synchronous DB writes; streaming (Kafka, etc.) deferred
- **Custom BI / report builder** -- no ad-hoc query interface for staff
- **A/B testing framework** -- deferred to a separate canonical
- **Attribution modeling** -- UTM parameters are stored but no multi-touch attribution engine
- **Mobile app analytics** -- platform column supports "ios"/"android" but native SDKs are not in scope
- **Third-party analytics integrations** (Google Analytics, Mixpanel) -- deferred
