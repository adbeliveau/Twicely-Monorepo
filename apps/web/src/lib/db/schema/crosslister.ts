import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, unique, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { channelEnum, authMethodEnum, accountStatusEnum, channelListingStatusEnum, publishJobStatusEnum, publishJobTypeEnum, importBatchStatusEnum, pollTierEnum } from './enums';
import { user } from './auth';
import { listing } from './listings';
import { category } from './catalog';

// §12.1 crosslisterAccount
export const crosslisterAccount = pgTable('crosslister_account', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  channel:             channelEnum('channel').notNull(),
  externalAccountId:   text('external_account_id'),
  externalUsername:    text('external_username'),

  // Auth
  authMethod:          authMethodEnum('auth_method').notNull(),
  accessToken:         text('access_token'),
  refreshToken:        text('refresh_token'),
  sessionData:         jsonb('session_data'),
  tokenExpiresAt:      timestamp('token_expires_at', { withTimezone: true }),
  lastAuthAt:          timestamp('last_auth_at', { withTimezone: true }),

  // Status
  status:              accountStatusEnum('account_status').notNull().default('ACTIVE'),
  lastSyncAt:          timestamp('last_sync_at', { withTimezone: true }),
  lastErrorAt:         timestamp('last_error_at', { withTimezone: true }),
  lastError:           text('last_error'),
  consecutiveErrors:   integer('consecutive_errors').notNull().default(0),

  // Capabilities (set by connector at auth time)
  capabilities:        jsonb('capabilities').notNull().default(sql`'{}'`),

  // Import tracking
  firstImportCompletedAt: timestamp('first_import_completed_at', { withTimezone: true }),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerChannelIdx:    unique().on(table.sellerId, table.channel),
  statusIdx:           index('ca_status').on(table.status),
}));

// §12.2 channelProjection
export const channelProjection = pgTable('channel_projection', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  accountId:           text('account_id').notNull().references(() => crosslisterAccount.id),
  channel:             channelEnum('channel').notNull(),
  sellerId:            text('seller_id').notNull(),

  // External identity
  externalId:          text('external_id'),
  externalUrl:         text('external_url'),
  status:              channelListingStatusEnum('status').notNull().default('DRAFT'),
  source:              text('source').notNull().default('MANUAL'), // MANUAL | IMPORT | AUTO_DETECTED

  // Overrides (per-platform deviations from canonical)
  overridesJson:       jsonb('overrides_json').notNull().default(sql`'{}'`),
  platformDataJson:    jsonb('platform_data_json').notNull().default(sql`'{}'`),

  // Sync tracking
  syncEnabled:         boolean('sync_enabled').notNull().default(true),
  lastCanonicalHash:   text('last_canonical_hash'),
  hasPendingSync:      boolean('has_pending_sync').notNull().default(false),
  externalDiff:        jsonb('external_diff'),

  // Publish attempts
  publishAttempts:     integer('publish_attempts').notNull().default(0),
  lastPublishError:    text('last_publish_error'),

  // Polling engine (§13 adaptive polling)
  pollTier:     pollTierEnum('poll_tier').notNull().default('COLD'),
  nextPollAt:   timestamp('next_poll_at', { withTimezone: true }),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  prePollTier:  pollTierEnum('pre_poll_tier'),

  orphanedAt:          timestamp('orphaned_at', { withTimezone: true }),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingAccountIdx:   unique().on(table.listingId, table.accountId, table.channel),
  externalUnique:      uniqueIndex('uq_projection_external').on(table.sellerId, table.channel, table.externalId),
  sellerChannelIdx:    index('cp_seller_channel').on(table.sellerId, table.channel),
  statusIdx:           index('cp_status').on(table.status),
  syncIdx:             index('cp_pending_sync').on(table.hasPendingSync),
  nextPollIdx:         index('cp_next_poll').on(table.nextPollAt),
}));

// §12.3 crossJob
export const crossJob = pgTable('cross_job', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id),
  projectionId:        text('projection_id').references(() => channelProjection.id),
  accountId:           text('account_id').references(() => crosslisterAccount.id),

  jobType:             publishJobTypeEnum('job_type').notNull(),
  priority:            integer('priority').notNull().default(500),
  idempotencyKey:      text('idempotency_key').notNull().unique(),

  status:              publishJobStatusEnum('status').notNull().default('PENDING'),
  scheduledFor:        timestamp('scheduled_for', { withTimezone: true }),
  startedAt:           timestamp('started_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  attempts:            integer('attempts').notNull().default(0),
  maxAttempts:         integer('max_attempts').notNull().default(3),
  lastError:           text('last_error'),

  payload:             jsonb('payload').notNull(),
  result:              jsonb('result'),
  bullmqJobId:         text('bullmq_job_id'),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerTypeIdx:       index('cj_seller_type').on(table.sellerId, table.jobType),
  statusPriorityIdx:   index('cj_status_priority').on(table.status, table.priority),
  scheduledIdx:        index('cj_scheduled').on(table.scheduledFor),
  idempotencyIdx:      index('cj_idempotency').on(table.idempotencyKey),
}));

// §12.4 importBatch
export const importBatch = pgTable('import_batch', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id),
  accountId:           text('account_id').notNull().references(() => crosslisterAccount.id),
  channel:             channelEnum('channel').notNull(),
  status:              importBatchStatusEnum('status').notNull().default('CREATED'),

  // Counts
  totalItems:          integer('total_items').notNull().default(0),
  processedItems:      integer('processed_items').notNull().default(0),
  createdItems:        integer('created_items').notNull().default(0),
  deduplicatedItems:   integer('deduplicated_items').notNull().default(0),
  failedItems:         integer('failed_items').notNull().default(0),
  skippedItems:        integer('skipped_items').notNull().default(0),

  isFirstImport:       boolean('is_first_import').notNull(),
  startedAt:           timestamp('started_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  errorSummaryJson:    jsonb('error_summary_json').notNull().default(sql`'[]'`),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerChannelIdx:    index('ib_seller_channel').on(table.sellerId, table.channel),
  statusIdx:           index('ib_status').on(table.status),
}));

// §12.5 importRecord
export const importRecord = pgTable('import_record', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  batchId:             text('batch_id').notNull().references(() => importBatch.id, { onDelete: 'cascade' }),
  externalId:          text('external_id').notNull(),
  channel:             channelEnum('channel').notNull(),
  status:              text('status').notNull().default('pending'),
  listingId:           text('listing_id').references(() => listing.id),
  rawDataJson:         jsonb('raw_data_json').notNull().default(sql`'{}'`),
  normalizedDataJson:  jsonb('normalized_data_json'),
  errorMessage:        text('error_message'),
  dedupeMatchListingId: text('dedupe_match_listing_id'),
  dedupeConfidence:    real('dedupe_confidence'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  batchIdx:            index('ir_batch').on(table.batchId),
  externalIdx:         index('ir_external').on(table.channel, table.externalId),
}));

// §12.6 dedupeFingerprint
export const dedupeFingerprint = pgTable('dedupe_fingerprint', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:            text('seller_id').notNull(),
  titleHash:           text('title_hash').notNull(),
  imageHash:           text('image_hash'),
  priceRange:          text('price_range'),
  compositeHash:       text('composite_hash').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerCompositeIdx:  index('df_seller_composite').on(table.sellerId, table.compositeHash),
  listingIdx:          index('df_listing').on(table.listingId),
}));

// §12.7 channelCategoryMapping
export const channelCategoryMapping = pgTable('channel_category_mapping', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  channel:             channelEnum('channel').notNull(),
  twicelyCategoryId:   text('twicely_category_id').notNull().references(() => category.id),
  externalCategoryId:  text('external_category_id').notNull(),
  externalCategoryName: text('external_category_name').notNull(),
  confidence:          real('confidence').notNull().default(1.0),
  isVerified:          boolean('is_verified').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelCatIdx:       unique().on(table.channel, table.twicelyCategoryId),
}));

// §12.8 channelPolicyRule
export const channelPolicyRule = pgTable('channel_policy_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  channel:             channelEnum('channel').notNull(),
  field:               text('field').notNull(),
  constraintJson:      jsonb('constraint_json').notNull(),
  guidance:            text('guidance'),
  severity:            text('severity').notNull().default('WARN'),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelFieldIdx:     index('cpr_channel_field').on(table.channel, table.field),
}));

// §12.9 automationSetting
export const automationSetting = pgTable('automation_setting', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),

  // Auto-relist
  autoRelistEnabled:   boolean('auto_relist_enabled').notNull().default(false),
  autoRelistDays:      integer('auto_relist_days').notNull().default(30),
  autoRelistChannels:  text('auto_relist_channels').array().notNull().default(sql`'{}'::text[]`),

  // Offer-to-likers
  offerToLikersEnabled: boolean('offer_to_likers_enabled').notNull().default(false),
  offerDiscountPercent: integer('offer_discount_percent').notNull().default(10),
  offerMinDaysListed:  integer('offer_min_days_listed').notNull().default(7),

  // Smart price drops
  priceDropEnabled:    boolean('price_drop_enabled').notNull().default(false),
  priceDropPercent:    integer('price_drop_percent').notNull().default(5),
  priceDropIntervalDays: integer('price_drop_interval_days').notNull().default(14),
  priceDropFloorPercent: integer('price_drop_floor_percent').notNull().default(50),

  // Posh sharing
  poshShareEnabled:    boolean('posh_share_enabled').notNull().default(false),
  poshShareTimesPerDay: integer('posh_share_times_per_day').notNull().default(3),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
