import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';

// §33.7 priceHistory — per-listing price change tracking
export const priceHistory = pgTable('price_history', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  listingId:     text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  priceCents:    integer('price_cents').notNull(),
  previousCents: integer('previous_cents'),
  changeType:    text('change_type').notNull(), // 'INITIAL' | 'INCREASE' | 'DECREASE' | 'SNAPSHOT'
  changeBps:     integer('change_bps'), // basis points (positive = increase, negative = decrease)
  source:        text('source').notNull().default('listing_update'), // 'listing_update' | 'offer_accepted' | 'promotion' | 'daily_snapshot'
  snapshotDate:  timestamp('snapshot_date', { withTimezone: true }).notNull().defaultNow(),
  recordedAt:    timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingDateIdx: index('ph_listing_date').on(table.listingId, table.recordedAt),
  snapshotIdx:    index('ph_snapshot').on(table.snapshotDate),
}));

// §33.8 buyerCollection — named listing collections
export const buyerCollection = pgTable('buyer_collection', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  userId:       text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  description:  text('description'),
  isPublic:     boolean('is_public').notNull().default(false),
  itemCount:    integer('item_count').notNull().default(0),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('bc_user').on(table.userId),
}));

// §33.8b buyerCollectionItem — junction table
export const buyerCollectionItem = pgTable('buyer_collection_item', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  collectionId: text('collection_id').notNull().references(() => buyerCollection.id, { onDelete: 'cascade' }),
  listingId:    text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  addedAt:      timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  collectionIdx: index('bci_collection').on(table.collectionId),
  uniqueItem:    unique().on(table.collectionId, table.listingId),
}));

// §33.9 recommendationFeed — cached personalized feeds
export const recommendationFeed = pgTable('recommendation_feed', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  userId:      text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:   text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  score:       real('score').notNull(),
  reason:      text('reason').notNull(), // 'SIMILAR_TO_VIEWED' | 'SIMILAR_TO_PURCHASED' | 'TRENDING' | 'PRICE_DROP' | 'NEW_FROM_FOLLOWED'
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  clickedAt:   timestamp('clicked_at', { withTimezone: true }),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }),
}, (table) => ({
  userGeneratedIdx: index('rf_user_generated').on(table.userId, table.generatedAt),
}));

// §33.10 buyerPreference — inferred buyer preference profiles
export const buyerPreference = pgTable('buyer_preference', {
  id:                       text('id').primaryKey().$defaultFn(() => createId()),
  userId:                   text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  preferredCategories:      jsonb('preferred_categories').notNull().default('[]'),
  preferredBrands:          jsonb('preferred_brands').notNull().default('[]'),
  preferredSizes:           jsonb('preferred_sizes').notNull().default('{}'),
  priceRangeMinCents:       integer('price_range_min_cents'),
  priceRangeMaxCents:       integer('price_range_max_cents'),
  updatedAt:                timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('bp_user').on(table.userId),
}));

// §33.11 reviewModerationQueue — auto-flagged review moderation queue
export const reviewModerationQueue = pgTable('review_moderation_queue', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  reviewId:          text('review_id').notNull(),
  listingId:         text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  reviewerId:        text('reviewer_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status:            text('status').notNull().default('PENDING'), // 'PENDING' | 'APPROVED' | 'REJECTED'
  flagReason:        text('flag_reason'),
  moderatedByUserId: text('moderated_by_user_id'),
  moderatedAt:       timestamp('moderated_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx:  index('rmq_status').on(table.status),
  reviewIdx:  index('rmq_review').on(table.reviewId),
}));
