import { pgTable, text, integer, boolean, timestamp, jsonb, real, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import {
  localTransactionStatusEnum,
  confirmationModeEnum,
  localReliabilityEventTypeEnum,
  localFraudFlagSeverityEnum,
  localFraudFlagStatusEnum,
} from './enums';
import { user } from './auth';
import { order } from './commerce';
import { listing } from './listings';

export const safeMeetupLocation = pgTable('safe_meetup_location', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  name:              text('name').notNull(),
  address:           text('address').notNull(),
  city:              text('city').notNull(),
  state:             text('state').notNull(),
  zip:               text('zip').notNull(),
  country:           text('country').notNull().default('US'),
  latitude:          real('latitude').notNull(),
  longitude:         real('longitude').notNull(),
  type:              text('type').notNull(),
  verifiedSafe:      boolean('verified_safe').notNull().default(false),
  operatingHoursJson: jsonb('operating_hours_json'),
  meetupCount:       integer('meetup_count').notNull().default(0),
  rating:            real('rating'),
  isActive:          boolean('is_active').notNull().default(true),
  addedByStaffId:    text('added_by_staff_id'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cityStateIdx:      index('sml_city').on(table.city, table.state),
  geoIdx:            index('sml_geo').on(table.latitude, table.longitude),
}));

export const localTransaction = pgTable('local_transaction', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  // restrict: local transaction is a financial record — must survive order/user deletion
  orderId:               text('order_id').notNull().references(() => order.id, { onDelete: 'restrict' }),
  buyerId:               text('buyer_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  sellerId:              text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  // set null: transaction record kept even if safe meetup location is removed
  meetupLocationId:      text('meetup_location_id').references(() => safeMeetupLocation.id, { onDelete: 'set null' }),
  status:                localTransactionStatusEnum('status').notNull().default('SCHEDULED'),
  scheduledAt:           timestamp('scheduled_at', { withTimezone: true }),
  scheduledAtConfirmedAt: timestamp('scheduled_at_confirmed_at', { withTimezone: true }),
  schedulingProposedBy:  text('scheduling_proposed_by'),
  sellerConfirmationCode:  text('seller_confirmation_code').notNull().unique(),
  sellerOfflineCode:       text('seller_offline_code').notNull(),
  buyerConfirmationCode:   text('buyer_confirmation_code').notNull().unique(),
  buyerOfflineCode:        text('buyer_offline_code').notNull(),
  confirmationMode:        confirmationModeEnum('confirmation_mode'),
  sellerCheckedIn:       boolean('seller_checked_in').notNull().default(false),
  sellerCheckedInAt:     timestamp('seller_checked_in_at', { withTimezone: true }),
  buyerCheckedIn:        boolean('buyer_checked_in').notNull().default(false),
  buyerCheckedInAt:      timestamp('buyer_checked_in_at', { withTimezone: true }),
  confirmedAt:           timestamp('confirmed_at', { withTimezone: true }),
  offlineConfirmedAt:    timestamp('offline_confirmed_at', { withTimezone: true }),
  syncedAt:              timestamp('synced_at', { withTimezone: true }),
  safetyAlertSent:       boolean('safety_alert_sent').notNull().default(false),
  safetyAlertAt:         timestamp('safety_alert_at', { withTimezone: true }),
  noShowParty:           text('no_show_party'),
  /** @deprecated §A5 removed monetary no-show penalties. Column retained for legacy display; no new writes. */
  noShowFeeCents:        integer('no_show_fee_cents'),
  /** @deprecated §A5 removed monetary no-show penalties. Column retained for legacy display; no new writes. */
  noShowFeeChargedAt:    timestamp('no_show_fee_charged_at', { withTimezone: true }),
  // Price adjustment (A3)
  adjustedPriceCents:       integer('adjusted_price_cents'),
  adjustmentReason:         text('adjustment_reason'),
  adjustmentInitiatedAt:    timestamp('adjustment_initiated_at', { withTimezone: true }),
  adjustmentAcceptedAt:     timestamp('adjustment_accepted_at', { withTimezone: true }),
  adjustmentDeclinedAt:     timestamp('adjustment_declined_at', { withTimezone: true }),
  // Reschedule tracking (A7)
  rescheduleCount:          integer('reschedule_count').notNull().default(0),
  lastRescheduledAt:        timestamp('last_rescheduled_at', { withTimezone: true }),
  lastRescheduledBy:        text('last_rescheduled_by'),
  originalScheduledAt:      timestamp('original_scheduled_at', { withTimezone: true }),
  rescheduleProposedAt:     timestamp('reschedule_proposed_at', { withTimezone: true }),
  // Cancellation sub-state (A8) — 'BUYER' or 'SELLER', mirrors noShowParty pattern
  canceledByParty:          text('canceled_by_party'),
  // Day-of confirmation (A9) — buyer-initiated "Are we still on?" flow
  dayOfConfirmationSentAt:      timestamp('day_of_confirmation_sent_at', { withTimezone: true }),
  dayOfConfirmationRespondedAt: timestamp('day_of_confirmation_responded_at', { withTimezone: true }),
  dayOfConfirmationExpired:     boolean('day_of_confirmation_expired').notNull().default(false),
  // Photo evidence (A13)
  meetupPhotoUrls:              text('meetup_photo_urls').array().notNull().default(sql`'{}'::text[]`),
  meetupPhotosAt:               timestamp('meetup_photos_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:              index('lt_order').on(table.orderId),
  buyerIdx:              index('lt_buyer').on(table.buyerId),
  sellerIdx:             index('lt_seller').on(table.sellerId),
  statusIdx:             index('lt_status').on(table.status),
  sellerConfirmCodeIdx:  index('lt_seller_confirm').on(table.sellerConfirmationCode),
  buyerConfirmCodeIdx:   index('lt_buyer_confirm').on(table.buyerConfirmationCode),
}));

// ─── Local Reliability Events (G2.8 — Decision #114) ─────────────────────────

export const localReliabilityEvent = pgTable('local_reliability_event', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  transactionId:   text('transaction_id').notNull().references(() => localTransaction.id, { onDelete: 'cascade' }),
  eventType:       localReliabilityEventTypeEnum('event_type').notNull(),
  marksApplied:    integer('marks_applied').notNull(),
  decaysAt:        timestamp('decays_at', { withTimezone: true }).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('lre_user').on(table.userId),
  transactionIdx:  index('lre_transaction').on(table.transactionId),
  decaysAtIdx:     index('lre_decays_at').on(table.decaysAt),
}));

// ─── Local Fraud Flags (G2.15 — Addendum §A12) ────────────────────────────────

export const localFraudFlag = pgTable('local_fraud_flag', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  // restrict: fraud flags are audit records — must survive user/transaction/listing deletion
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  localTransactionId:  text('local_transaction_id').notNull().references(() => localTransaction.id, { onDelete: 'restrict' }),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'restrict' }),
  trigger:             text('trigger').notNull(),  // 'SAME_LISTING_SOLD' | 'PHASH_DUPLICATE' | 'NOSHOW_RELIST' | 'BUYER_CLAIM'
  severity:            localFraudFlagSeverityEnum('severity').notNull(),
  status:              localFraudFlagStatusEnum('status').notNull().default('OPEN'),
  detailsJson:         jsonb('details_json').notNull().default(sql`'{}'`),
  // Resolution
  resolvedByStaffId:   text('resolved_by_staff_id'),
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  resolutionNote:      text('resolution_note'),
  // Consequence tracking
  refundIssuedAt:      timestamp('refund_issued_at', { withTimezone: true }),
  listingRemovedAt:    timestamp('listing_removed_at', { withTimezone: true }),
  sellerBannedAt:      timestamp('seller_banned_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:           index('lff_seller').on(table.sellerId),
  transactionIdx:      index('lff_transaction').on(table.localTransactionId),
  statusIdx:           index('lff_status').on(table.status),
  severityIdx:         index('lff_severity').on(table.severity),
}));

export const combinedShippingQuote = pgTable('combined_shipping_quote', {
  id:                      text('id').primaryKey().$defaultFn(() => createId()),
  // cascade: combined shipping quote is an ephemeral pre-checkout record owned by the order
  orderId:                 text('order_id').notNull().references(() => order.id, { onDelete: 'cascade' }),
  // restrict: financial quote record should survive user deletion for audit
  sellerId:                text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  buyerId:                 text('buyer_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  status:                  text('status').notNull(),
  maxShippingCents:        integer('max_shipping_cents').notNull(),
  quotedShippingCents:     integer('quoted_shipping_cents'),
  penaltyApplied:          boolean('penalty_applied').notNull().default(false),
  penaltyDiscountPercent:  real('penalty_discount_percent'),
  finalShippingCents:      integer('final_shipping_cents'),
  savingsCents:            integer('savings_cents'),
  sellerDeadline:          timestamp('seller_deadline', { withTimezone: true }).notNull(),
  sellerQuotedAt:          timestamp('seller_quoted_at', { withTimezone: true }),
  buyerRespondedAt:        timestamp('buyer_responded_at', { withTimezone: true }),
  createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:                index('csq_order').on(table.orderId),
  sellerDeadlineIdx:       index('csq_deadline').on(table.sellerDeadline, table.status),
}));
