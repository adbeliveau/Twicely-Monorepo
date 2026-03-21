import { pgTable, text, boolean, timestamp, jsonb, index, unique, integer } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';
import { category } from './catalog';

// §16.1 follow
export const follow = pgTable('follow', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  followerId:          text('follower_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  followedId:          text('followed_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  followerIdx:         index('fol_follower').on(table.followerId),
  followedIdx:         index('fol_followed').on(table.followedId),
  uniquePairIdx:       unique().on(table.followerId, table.followedId),
}));

// §16.2 watchlistItem
export const watchlistItem = pgTable('watchlist_item', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  notifyPriceDrop:     boolean('notify_price_drop').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userListingIdx:      unique().on(table.userId, table.listingId),
  listingIdx:          index('wl_listing').on(table.listingId),
}));

// §16.3 browsingHistory (§27.2 in schema doc)
export const browsingHistory = pgTable('browsing_history', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  categoryId:          text('category_id').references(() => category.id),
  sellerId:            text('seller_id'),
  viewCount:           integer('view_count').notNull().default(1),
  totalDurationSec:    integer('total_duration_sec').notNull().default(0),
  lastViewDurationSec: integer('last_view_duration_sec').notNull().default(0),
  didAddToCart:        boolean('did_add_to_cart').notNull().default(false),
  didAddToWatchlist:   boolean('did_add_to_watchlist').notNull().default(false),
  didMakeOffer:        boolean('did_make_offer').notNull().default(false),
  didPurchase:         boolean('did_purchase').notNull().default(false),
  didSetPriceAlert:    boolean('did_set_price_alert').notNull().default(false),
  sourceType:          text('source_type'), // 'search' | 'category' | 'recommendation' | 'alert' | 'direct'
  searchQuery:         text('search_query'),
  firstViewedAt:       timestamp('first_viewed_at', { withTimezone: true }).notNull().defaultNow(),
  lastViewedAt:        timestamp('last_viewed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userListingIdx:      unique().on(table.userId, table.listingId),
  userViewedIdx:       index('bh_user_viewed').on(table.userId, table.lastViewedAt),
}));

// §16.4 savedSearch
export const savedSearch = pgTable('saved_search', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:                text('name').notNull(),
  queryJson:           jsonb('query_json').notNull(),
  notifyNewMatches:    boolean('notify_new_matches').notNull().default(true),
  lastCheckedAt:       timestamp('last_checked_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:             index('ss_user').on(table.userId),
}));

// §20.5 buyerBlockList (C1.6 — Buyer Block List)
// Sellers can block buyers from purchasing or making offers
// Max 500 blocked buyers per seller
export const buyerBlockList = pgTable('buyer_block_list', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  blockerId:       text('blocker_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  blockedId:       text('blocked_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  reason:          text('reason'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  blockerIdx:      index('bbl_blocker').on(table.blockerId),
  blockedIdx:      index('bbl_blocked').on(table.blockedId),
  uniquePairIdx:   unique().on(table.blockerId, table.blockedId),
}));
