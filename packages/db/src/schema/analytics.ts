import { pgTable, text, integer, boolean, real, timestamp, date, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';

// --- Canonical 15: Platform Analytics ---

/** Idempotent event store. Every tracked user/system action writes one row. */
export const analyticsEvent = pgTable('analytics_event', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),

  // Event identification
  eventName:        text('event_name').notNull(),
  idempotencyKey:   text('idempotency_key').notNull().unique(),

  // Actors
  actorUserId:      text('actor_user_id'),
  sessionId:        text('session_id'),
  sellerId:         text('seller_id'),

  // Entity references
  entityType:       text('entity_type'),
  entityId:         text('entity_id'),

  // Attribution
  source:           text('source'),
  medium:           text('medium'),
  campaign:         text('campaign'),

  // Device context
  deviceType:       text('device_type'),
  platform:         text('platform'),
  ipHash:           text('ip_hash'),
  country:          text('country'),

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

/** Pre-computed time-series values. One row per metric + period + date + dimension slice. */
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

/** Registry of known metrics. Drives snapshot computation and documents what each metric means. */
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

// --- Canonical 14: Seller Analytics ---

/** One row per seller per day. Aggregated from orders, ledger, events, and listings. */
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

/** Weekly per-listing performance metrics for a seller. */
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

/** Platform-wide percentile thresholds for seller performance comparison. */
export const sellerPercentileBand = pgTable('seller_percentile_band', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  metric:          text('metric').notNull(),
  periodDays:      integer('period_days').notNull(),
  p25Value:        integer('p25_value').notNull(),
  p50Value:        integer('p50_value').notNull(),
  p75Value:        integer('p75_value').notNull(),
  p90Value:        integer('p90_value').notNull(),
  computedAt:      timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  metricPeriodIdx: uniqueIndex('spb_metric_period').on(table.metric, table.periodDays),
}));
