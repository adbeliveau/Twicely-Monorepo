import { pgTable, text, integer, boolean, timestamp, jsonb, real, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { ledgerEntryTypeEnum, ledgerEntryStatusEnum, payoutStatusEnum, payoutBatchStatusEnum, feeBucketEnum, channelEnum, claimTypeEnum, performanceBandEnum } from './enums';
import { user } from './auth';
import { order } from './commerce';
import { listing } from './listings';

// §11.1 ledgerEntry
export const ledgerEntry = pgTable('ledger_entry', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  type:                ledgerEntryTypeEnum('type').notNull(),
  status:              ledgerEntryStatusEnum('status').notNull().default('PENDING'),
  amountCents:         integer('amount_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),

  // Ownership
  userId:              text('user_id').references(() => user.id),

  // Context references
  orderId:             text('order_id').references(() => order.id),
  listingId:           text('listing_id').references(() => listing.id),
  channel:             channelEnum('channel'),

  // Stripe correlation
  stripeEventId:       text('stripe_event_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeTransferId:    text('stripe_transfer_id'),
  stripeChargeId:      text('stripe_charge_id'),
  stripeRefundId:      text('stripe_refund_id'),
  stripeDisputeId:     text('stripe_dispute_id'),

  // Reversal tracking
  reversalOfEntryId:   text('reversal_of_entry_id'),

  // Admin
  createdByStaffId:    text('created_by_staff_id'),
  reasonCode:          text('reason_code'),
  memo:                text('memo'),

  postedAt:            timestamp('posted_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userTypeIdx:         index('le_user_type').on(table.userId, table.type),
  userCreatedIdx:      index('le_user_created').on(table.userId, table.createdAt),
  orderIdx:            index('le_order').on(table.orderId),
  stripeEventIdx:      index('le_stripe_event').on(table.stripeEventId),
  statusIdx:           index('le_status').on(table.status),
  reversalIdx:         index('le_reversal').on(table.reversalOfEntryId),
}));

// §11.2 sellerBalance
export const sellerBalance = pgTable('seller_balance', {
  userId:              text('user_id').primaryKey().references(() => user.id),
  pendingCents:        integer('pending_cents').notNull().default(0),
  availableCents:      integer('available_cents').notNull().default(0),
  reservedCents:       integer('reserved_cents').notNull().default(0),
  lastLedgerEntryId:   text('last_ledger_entry_id'),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §11.3 payoutBatch
export const payoutBatch = pgTable('payout_batch', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  status:              payoutBatchStatusEnum('status').notNull().default('CREATED'),
  totalSellers:        integer('total_sellers').notNull().default(0),
  processedSellers:    integer('processed_sellers').notNull().default(0),
  successCount:        integer('success_count').notNull().default(0),
  failureCount:        integer('failure_count').notNull().default(0),
  totalAmountCents:    integer('total_amount_cents').notNull().default(0),
  triggeredByStaffId:  text('triggered_by_staff_id'),
  isAutomatic:         boolean('is_automatic').notNull().default(true),
  startedAt:           timestamp('started_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §11.4 payout
export const payout = pgTable('payout', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id),
  batchId:             text('batch_id').references(() => payoutBatch.id),
  status:              payoutStatusEnum('status').notNull().default('PENDING'),
  amountCents:         integer('amount_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),
  stripeTransferId:    text('stripe_transfer_id'),
  stripePayoutId:      text('stripe_payout_id'),
  failureReason:       text('failure_reason'),
  isOnDemand:          boolean('is_on_demand').notNull().default(false),
  initiatedAt:         timestamp('initiated_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  failedAt:            timestamp('failed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('po_user').on(table.userId, table.createdAt),
  batchIdx:        index('po_batch').on(table.batchId),
  statusIdx:       index('po_status').on(table.status),
}));

// §11.5 feeSchedule
export const feeSchedule = pgTable('fee_schedule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  feeBucket:           feeBucketEnum('fee_bucket').notNull(),
  // v3.2: TF rate in basis points (progressive bracket-based)
  tfRateBps:           integer('tf_rate_bps').notNull(),
  insertionFeeCents:   integer('insertion_fee_cents').notNull(),
  effectiveAt:         timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt:           timestamp('expires_at', { withTimezone: true }),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  bucketEffectiveIdx:  index('fs_bucket_effective').on(table.feeBucket, table.effectiveAt),
}));

// §11.6 reconciliationReport
export const reconciliationReport = pgTable('reconciliation_report', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  periodStart:         timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:           timestamp('period_end', { withTimezone: true }).notNull(),
  status:              text('status').notNull().default('running'),
  totalEntriesChecked: integer('total_entries_checked').notNull().default(0),
  discrepancyCount:    integer('discrepancy_count').notNull().default(0),
  discrepanciesJson:   jsonb('discrepancies_json').notNull().default(sql`'[]'`),
  summaryJson:         jsonb('summary_json').notNull().default(sql`'{}'`),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// §11.7 manualAdjustment
export const manualAdjustment = pgTable('manual_adjustment', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id),
  ledgerEntryId:       text('ledger_entry_id').notNull().references(() => ledgerEntry.id),
  type:                text('type').notNull(),
  amountCents:         integer('amount_cents').notNull(),
  reasonCode:          text('reason_code').notNull(),
  memo:                text('memo').notNull(),
  approvedByStaffId:   text('approved_by_staff_id').notNull(),
  mfaVerifiedAt:       timestamp('mfa_verified_at', { withTimezone: true }).notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// §13.3 stripeEventLog (A2.1 — webhook idempotency)
export const stripeEventLog = pgTable('stripe_event_log', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  stripeEventId:     text('stripe_event_id').notNull().unique(),
  eventType:         text('event_type').notNull(),
  processedAt:       timestamp('processed_at', { withTimezone: true }),
  processingStatus:  text('processing_status').notNull().default('pending'),
  errorMessage:      text('error_message'),
  retryCount:        integer('retry_count').notNull().default(0),
  payloadJson:       jsonb('payload_json').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  stripeEventIdx:    index('sel_stripe_event').on(table.stripeEventId),
  statusIdx:         index('sel_status').on(table.processingStatus),
  eventTypeIdx:      index('sel_event_type').on(table.eventType, table.createdAt),
}));

// §13.4 buyerProtectionClaim (A2.1 — buyer protection fund claims)
export const buyerProtectionClaim = pgTable('buyer_protection_claim', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id),
  buyerId:             text('buyer_id').notNull().references(() => user.id),
  sellerId:            text('seller_id').notNull(),
  claimType:           claimTypeEnum('claim_type').notNull(),
  status:              text('status').notNull().default('OPEN'),
  claimAmountCents:    integer('claim_amount_cents').notNull(),
  approvedAmountCents: integer('approved_amount_cents'),
  evidenceJson:        jsonb('evidence_json').notNull().default(sql`'[]'`),
  resolutionNote:      text('resolution_note'),
  resolvedByStaffId:   text('resolved_by_staff_id'),
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  paidAt:              timestamp('paid_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:            index('bpc_order').on(table.orderId),
  buyerIdx:            index('bpc_buyer').on(table.buyerId),
  statusIdx:           index('bpc_status').on(table.status),
}));

// §13.5 sellerScoreSnapshot (A2.1 — historical seller performance; evolved G4.1 for daily snapshots)
export const sellerScoreSnapshot = pgTable('seller_score_snapshot', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:     text('seller_profile_id').notNull(),
  overallScore:        real('overall_score').notNull(),
  componentScoresJson: jsonb('component_scores_json').notNull(),
  performanceBand:     performanceBandEnum('performance_band').notNull(),
  periodStart:         timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:           timestamp('period_end', { withTimezone: true }).notNull(),
  orderCount:          integer('order_count').notNull(),
  defectCount:         integer('defect_count').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // G4.1 — Daily snapshot columns (Seller Score Canonical Section 10.3)
  userId:              text('user_id').references(() => user.id),
  snapshotDate:        date('snapshot_date'),
  searchMultiplier:    real('search_multiplier'),

  // Raw metric values
  onTimeShippingPct:   real('on_time_shipping_pct'),
  inadClaimRatePct:    real('inad_claim_rate_pct'),
  reviewAverage:       real('review_average'),
  responseTimeHours:   real('response_time_hours'),
  returnRatePct:       real('return_rate_pct'),
  cancellationRatePct: real('cancellation_rate_pct'),

  // Per-metric normalized scores (0-1000)
  shippingScore:       integer('shipping_score'),
  inadScore:           integer('inad_score'),
  reviewScore:         integer('review_score'),
  responseScore:       integer('response_score'),
  returnScore:         integer('return_score'),
  cancellationScore:   integer('cancellation_score'),

  // Scoring context
  primaryFeeBucket:    text('primary_fee_bucket'),
  trendModifier:       real('trend_modifier'),
  bayesianSmoothing:   real('bayesian_smoothing'),

  // Band transition tracking
  previousBand:        performanceBandEnum('previous_band'),
  bandChangedAt:       timestamp('band_changed_at', { withTimezone: true }),
}, (table) => ({
  sellerPeriodIdx:     index('sss_seller_period').on(table.sellerProfileId, table.periodStart),
  userDateIdx:         uniqueIndex('sss_user_date_idx').on(table.userId, table.snapshotDate),
  dateIdx:             index('sss_date_idx').on(table.snapshotDate),
}));

