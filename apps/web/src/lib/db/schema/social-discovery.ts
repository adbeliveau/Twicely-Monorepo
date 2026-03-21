import { pgTable, text, integer, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';
import { liveSessionStatusEnum } from './enums';

// §24.1 listingQuestion — Public Q&A on listings (Amazon-style)
export const listingQuestion = pgTable('listing_question', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  askerId:         text('asker_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  questionText:    text('question_text').notNull(),         // 500 char max (enforced in app)
  answerText:      text('answer_text'),                     // 1000 char max (nullable until answered)
  answeredAt:      timestamp('answered_at', { withTimezone: true }),
  answeredBy:      text('answered_by').references(() => user.id), // seller or staff delegate
  isPinned:        boolean('is_pinned').notNull().default(false), // seller can pin up to 3
  isHidden:        boolean('is_hidden').notNull().default(false), // moderation or seller-hidden
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:      index('lq_listing').on(table.listingId),
  askerIdx:        index('lq_asker').on(table.askerId),
  pinnedIdx:       index('lq_pinned').on(table.listingId, table.isPinned),
}));

// §24.2 curatedCollection — Staff-curated collections for Explore page
export const curatedCollection = pgTable('curated_collection', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  title:           text('title').notNull(),
  slug:            text('slug').notNull().unique(),
  description:     text('description'),
  coverImageUrl:   text('cover_image_url'),
  curatedBy:       text('curated_by').notNull().references(() => user.id), // staff user
  isPublished:     boolean('is_published').notNull().default(false),
  startDate:       timestamp('start_date', { withTimezone: true }),        // seasonal/themed
  endDate:         timestamp('end_date', { withTimezone: true }),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx:         index('cc_slug').on(table.slug),
  publishedIdx:    index('cc_published').on(table.isPublished, table.sortOrder),
}));

// §24.3 curatedCollectionItem — Junction: collection → listing
export const curatedCollectionItem = pgTable('curated_collection_item', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  collectionId:    text('collection_id').notNull().references(() => curatedCollection.id, { onDelete: 'cascade' }),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sortOrder:       integer('sort_order').notNull().default(0),
  addedBy:         text('added_by').notNull().references(() => user.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  collectionIdx:   index('cci_collection').on(table.collectionId, table.sortOrder),
  uniqueItem:      unique().on(table.collectionId, table.listingId),
}));

// §24.5 liveSession — Live selling sessions (design only — no UI until post-launch)
export const liveSession = pgTable('live_session', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:        text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title:           text('title').notNull(),
  description:     text('description'),
  status:          liveSessionStatusEnum('status').notNull().default('SCHEDULED'),
  scheduledAt:     timestamp('scheduled_at', { withTimezone: true }),
  startedAt:       timestamp('started_at', { withTimezone: true }),
  endedAt:         timestamp('ended_at', { withTimezone: true }),
  viewerCount:     integer('viewer_count').notNull().default(0),
  peakViewerCount: integer('peak_viewer_count').notNull().default(0),
  streamUrl:       text('stream_url'),
  thumbnailUrl:    text('thumbnail_url'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:       index('ls_seller').on(table.sellerId),
  statusIdx:       index('ls_status').on(table.status),
  scheduledIdx:    index('ls_scheduled').on(table.scheduledAt),
}));

// §24.6 liveSessionProduct — Products featured in live sessions
export const liveSessionProduct = pgTable('live_session_product', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  sessionId:       text('session_id').notNull().references(() => liveSession.id, { onDelete: 'cascade' }),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  featuredAt:      timestamp('featured_at', { withTimezone: true }),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sessionIdx:      index('lsp_session').on(table.sessionId, table.sortOrder),
  uniqueItem:      unique().on(table.sessionId, table.listingId),
}));
