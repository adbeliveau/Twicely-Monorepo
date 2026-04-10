/**
 * @twicely/analytics — Type definitions
 *
 * Canonical 15: Platform Analytics types for events, metrics, and snapshots.
 */

// ── Event Name Taxonomy ──────────────────────────────────────────────────────

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

// ── Snapshot Period ──────────────────────────────────────────────────────────

export type SnapshotPeriod = 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

// ── Metric Key ───────────────────────────────────────────────────────────────

export type MetricKey =
  | 'gmv.daily' | 'gmv.hourly'
  | 'orders.count.daily' | 'orders.count.hourly'
  | 'orders.aov.daily'
  | 'users.new.daily' | 'users.new_sellers.daily'
  | 'listings.active.daily' | 'listings.new.daily'
  | 'fee_revenue.daily'
  | 'take_rate.daily'
  | 'search.count.daily' | 'search.count.hourly'
  | 'refund_rate.daily'
  | 'dispute_rate.daily';

// ── Metric Unit ──────────────────────────────────────────────────────────────

export type MetricUnit = 'cents' | 'count' | 'rate' | 'bps';

// ── Event Emit Input ─────────────────────────────────────────────────────────

export interface EventEmitInput {
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

// ── Metric Definition ────────────────────────────────────────────────────────

export interface MetricDefinitionInput {
  key: MetricKey | string;
  name: string;
  description?: string;
  unit: MetricUnit;
  period: SnapshotPeriod;
  isActive?: boolean;
}

// ── Snapshot Compute Input ───────────────────────────────────────────────────

export interface SnapshotComputeInput {
  metricKey: MetricKey | string;
  period: SnapshotPeriod;
  periodStart: Date;
  periodEnd: Date;
  valueCents?: number;
  valueCount?: number;
  valueRate?: number;
  dimensionsJson?: Record<string, unknown>;
}

// ── Snapshot Row (query result) ──────────────────────────────────────────────

export interface MetricSnapshotRow {
  metricKey: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  valueCents: number | null;
  valueCount: number | null;
  valueRate: number | null;
  computedAt: Date;
}

// ── Event Query Filters ──────────────────────────────────────────────────────

export interface EventQueryFilters {
  eventName?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  sellerId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ── Analytics Event Row (query result) ───────────────────────────────────────

export interface AnalyticsEventRow {
  id: string;
  eventName: string;
  idempotencyKey: string;
  actorUserId: string | null;
  sessionId: string | null;
  sellerId: string | null;
  entityType: string | null;
  entityId: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  deviceType: string | null;
  platform: string | null;
  ipHash: string | null;
  country: string | null;
  propertiesJson: unknown;
  occurredAt: Date;
  createdAt: Date;
}
