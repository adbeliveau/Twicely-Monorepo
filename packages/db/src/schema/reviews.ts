import { pgTable, text, integer, boolean, timestamp, real, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { reviewStatusEnum, performanceBandEnum } from './enums';
import { user } from './auth';
import { sellerProfile } from './identity';
import { order } from './commerce';

// §8.1 review
export const review = pgTable('review', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  // restrict: reviews are permanent public records — must survive order/user lifecycle changes
  orderId:           text('order_id').notNull().unique().references(() => order.id, { onDelete: 'restrict' }),
  reviewerUserId:    text('reviewer_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  sellerId:          text('seller_id').notNull(),
  rating:            integer('rating').notNull(),
  title:             text('title'),
  body:              text('body'),
  photos:            text('photos').array().notNull().default(sql`'{}'::text[]`),
  status:            reviewStatusEnum('status').notNull().default('APPROVED'),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(true),
  flagReason:        text('flag_reason'),
  flaggedByUserId:   text('flagged_by_user_id'),
  removedByStaffId:  text('removed_by_staff_id'),
  removedReason:     text('removed_reason'),

  // Detailed Seller Ratings (DSR) — optional buyer feedback on 4 dimensions
  dsrItemAsDescribed: integer('dsr_item_as_described'),
  dsrShippingSpeed:   integer('dsr_shipping_speed'),
  dsrCommunication:   integer('dsr_communication'),
  dsrPackaging:       integer('dsr_packaging'),

  // Review weighting (V2 Trust Display Amendment — anti-gaming)
  orderValueCents:     integer('order_value_cents'),
  hadDispute:          boolean('had_dispute').notNull().default(false),
  disputeOutcome:      text('dispute_outcome'),
  trustWeight:         real('trust_weight').notNull().default(1.0),
  trustWeightFactors:  jsonb('trust_weight_factors').notNull().default(sql`'{}'`),

  // Dual-blind visibility gate (C1.5)
  // Null = immediately visible (legacy/admin reviews)
  // Non-null = hidden until that timestamp
  visibleAt:         timestamp('visible_at', { withTimezone: true }),

  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:     index('rev_seller').on(table.sellerId, table.createdAt),
  reviewerIdx:   index('rev_reviewer').on(table.reviewerUserId),
  ratingIdx:     index('rev_rating').on(table.sellerId, table.rating),
  statusIdx:     index('rev_status').on(table.status),
}));

// §8.2 reviewResponse
export const reviewResponse = pgTable('review_response', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  reviewId:        text('review_id').notNull().unique().references(() => review.id, { onDelete: 'cascade' }),
  sellerId:        text('seller_id').notNull(),
  body:            text('body').notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §8.3 sellerPerformance
export const sellerPerformance = pgTable('seller_performance', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:       text('seller_profile_id').notNull().unique().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  totalOrders:           integer('total_orders').notNull().default(0),
  completedOrders:       integer('completed_orders').notNull().default(0),
  canceledOrders:        integer('canceled_orders').notNull().default(0),
  totalReviews:          integer('total_reviews').notNull().default(0),
  averageRating:         real('average_rating'),
  lateShipmentRate:      real('late_shipment_rate').notNull().default(0),
  cancelRate:            real('cancel_rate').notNull().default(0),
  returnRate:            real('return_rate').notNull().default(0),
  defectRate:            real('defect_rate').notNull().default(0),
  inadRate:              real('inad_rate').notNull().default(0),
  chargebackRate:        real('chargeback_rate').notNull().default(0),
  responseTimeMinutes:   real('response_time_minutes'),

  // Trust display layer (V2 Trust Display Amendment — buyer-facing metrics)
  onTimeShippingPct:     real('on_time_shipping_pct'),
  avgResponseTimeHours:  real('avg_response_time_hours'),
  trustBadge:            text('trust_badge'),
  trustBadgeSecondary:   text('trust_badge_secondary'),
  displayStars:          real('display_stars'),
  showStars:             boolean('show_stars').notNull().default(true),

  currentBand:           performanceBandEnum('current_band').notNull().default('EMERGING'),
  bandLastEvaluatedAt:   timestamp('band_last_evaluated_at', { withTimezone: true }),
  periodStart:           timestamp('period_start', { withTimezone: true }),
  periodEnd:             timestamp('period_end', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §8.4 buyerReview (seller rates buyer — C1.5)
// Individual ratings are NEVER publicly visible; buyer sees only aggregate tier
export const buyerReview = pgTable('buyer_review', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  // restrict: buyer reviews are permanent records — must survive order/user lifecycle changes
  orderId:               text('order_id').notNull().unique().references(() => order.id, { onDelete: 'restrict' }),
  sellerUserId:          text('seller_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  buyerUserId:           text('buyer_user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),

  // 3 rating dimensions (1-5 stars each)
  ratingPayment:         integer('rating_payment').notNull(),        // Did buyer pay promptly?
  ratingCommunication:   integer('rating_communication').notNull(),  // Was buyer responsive?
  ratingReturnBehavior:  integer('rating_return_behavior'),          // If return, was it legitimate? (nullable)

  overallRating:         integer('overall_rating').notNull(),        // Average of above, rounded
  note:                  text('note'),                               // Private note (never shown to buyer)
  status:                reviewStatusEnum('status').notNull().default('APPROVED'),

  // Dual-blind visibility gate (same as buyer→seller reviews)
  visibleAt:             timestamp('visible_at', { withTimezone: true }),

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  buyerIdx:   index('br_buyer').on(table.buyerUserId),
  sellerIdx:  index('br_seller').on(table.sellerUserId),
  orderIdx:   index('br_order').on(table.orderId),
}));
