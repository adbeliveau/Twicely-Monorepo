import { pgTable, text, integer, boolean, timestamp, real, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { promotionTypeEnum, promotionScopeEnum } from './enums';
import { user } from './auth';
import { order } from './commerce';
import { listing } from './listings';

// §15.1 promotion
export const promotion = pgTable('promotion', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull(),
  name:                text('name').notNull(),
  type:                promotionTypeEnum('type').notNull(),
  scope:               promotionScopeEnum('scope').notNull(),
  discountPercent:     real('discount_percent'),
  discountAmountCents: integer('discount_amount_cents'),
  minimumOrderCents:   integer('minimum_order_cents'),
  maxUsesTotal:        integer('max_uses_total'),
  maxUsesPerBuyer:     integer('max_uses_per_buyer').notNull().default(1),
  usageCount:          integer('usage_count').notNull().default(0),
  couponCode:          text('coupon_code').unique(),
  applicableCategoryIds: text('applicable_category_ids').array().notNull().default(sql`'{}'::text[]`),
  applicableListingIds: text('applicable_listing_ids').array().notNull().default(sql`'{}'::text[]`),
  isActive:            boolean('is_active').notNull().default(true),
  startsAt:            timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt:              timestamp('ends_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:           index('promo_seller').on(table.sellerId),
  couponIdx:           index('promo_coupon').on(table.couponCode),
  activeIdx:           index('promo_active').on(table.isActive, table.startsAt, table.endsAt),
}));

// §15.2 promotionUsage
export const promotionUsage = pgTable('promotion_usage', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  promotionId:         text('promotion_id').notNull().references(() => promotion.id),
  orderId:             text('order_id').notNull().references(() => order.id),
  buyerId:             text('buyer_id').notNull().references(() => user.id),
  discountCents:       integer('discount_cents').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  promotionIdx:        index('pu_promotion').on(table.promotionId),
  buyerPromoIdx:       index('pu_buyer_promo').on(table.buyerId, table.promotionId),
}));

// §15.3 promotedListing
export const promotedListing = pgTable('promoted_listing', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:            text('seller_id').notNull(),
  boostPercent:        real('boost_percent').notNull(),
  isActive:            boolean('is_active').notNull().default(true),
  impressions:         integer('impressions').notNull().default(0),
  clicks:              integer('clicks').notNull().default(0),
  sales:               integer('sales').notNull().default(0),
  totalFeeCents:       integer('total_fee_cents').notNull().default(0),
  startedAt:           timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt:             timestamp('ended_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:          index('pl_listing').on(table.listingId),
  sellerActiveIdx:     index('pl_seller_active').on(table.sellerId, table.isActive),
}));

// §15.4 promotedListingEvent (A2.1 — attribution tracking)
export const promotedListingEvent = pgTable('promoted_listing_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  promotedListingId:   text('promoted_listing_id').notNull().references(() => promotedListing.id, { onDelete: 'cascade' }),
  eventType:           text('event_type').notNull(),
  orderId:             text('order_id'),
  feeCents:            integer('fee_cents'),
  attributionWindow:   integer('attribution_window').notNull().default(7),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  promotedListingIdx:  index('ple_promoted').on(table.promotedListingId, table.eventType),
  eventTypeIdx:        index('ple_event_type').on(table.eventType, table.createdAt),
}));
