import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';


// §34.1 bulkListingJob — async bulk listing operations
export const bulkListingJob = pgTable('bulk_listing_job', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:         text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  jobType:          text('job_type').notNull(), // 'IMPORT' | 'EXPORT' | 'PRICE_UPDATE' | 'RELIST' | 'END'
  status:           text('status').notNull().default('PENDING'), // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  totalItems:       integer('total_items').notNull().default(0),
  processedItems:   integer('processed_items').notNull().default(0),
  failedItems:      integer('failed_items').notNull().default(0),
  errorLog:         jsonb('error_log'),
  fileUrl:          text('file_url'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt:      timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  sellerStatusIdx:  index('blj_seller_status').on(table.sellerId, table.status),
}));

// §34.2 listingTemplate — reusable listing defaults
export const listingTemplate = pgTable('listing_template', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:                text('name').notNull(),
  categoryId:         text('category_id'),
  descriptionTemplate: text('description_template'),
  conditionDefault:    text('condition_default'),
  shippingPresetId:    text('shipping_preset_id'),
  defaultsJson:        jsonb('defaults_json').notNull().default('{}'),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx: index('ltpl_seller').on(table.sellerId),
}));

// §34.3 shippingPreset — saved shipping configurations
export const shippingPreset = pgTable('shipping_preset', {
  id:                          text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:                    text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:                        text('name').notNull(),
  carrier:                     text('carrier').notNull(),
  serviceType:                 text('service_type').notNull(),
  weightOz:                    integer('weight_oz'),
  lengthIn:                    integer('length_in'),
  widthIn:                     integer('width_in'),
  heightIn:                    integer('height_in'),
  freeShippingThresholdCents:  integer('free_shipping_threshold_cents'),
  isDefault:                   boolean('is_default').notNull().default(false),
  createdAt:                   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx: index('sp_seller').on(table.sellerId),
}));

// §34.4 listingDraft — auto-saved drafts with optional scheduled publish
export const listingDraft = pgTable('listing_draft', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:           text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:          text('listing_id').references(() => listing.id, { onDelete: 'set null' }),
  draftData:          jsonb('draft_data').notNull().default('{}'),
  autoSavedAt:        timestamp('auto_saved_at', { withTimezone: true }).notNull().defaultNow(),
  scheduledPublishAt: timestamp('scheduled_publish_at', { withTimezone: true }),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx: index('ld_seller').on(table.sellerId),
  scheduledIdx: index('ld_scheduled').on(table.scheduledPublishAt),
}));

// §34.5 vacationModeSchedule — enhanced vacation mode with scheduling and behavior flags
export const vacationModeSchedule = pgTable('vacation_mode_schedule', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:          text('seller_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  isActive:          boolean('is_active').notNull().default(false),
  startAt:           timestamp('start_at', { withTimezone: true }),
  endAt:             timestamp('end_at', { withTimezone: true }),
  mode:              text('mode').notNull().default('HARD_AWAY'), // 'HARD_AWAY' | 'SOFT_AWAY' | 'AWAY_BUT_OPEN'
  autoReplyMessage:  text('auto_reply_message'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx: index('vms_seller').on(table.sellerId),
  activeIdx: index('vms_active').on(table.isActive, table.endAt),
}));

// §34.6 sellerAppeal — structured appeal against enforcement actions
export const sellerAppeal = pgTable('seller_appeal', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:         text('seller_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  appealType:       text('appeal_type').notNull(), // 'LISTING_REMOVAL' | 'ACCOUNT_SUSPENSION' | 'FEE_DISPUTE' | 'POLICY_VIOLATION'
  entityId:         text('entity_id'),
  reason:           text('reason').notNull(),
  status:           text('status').notNull().default('PENDING'), // 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'DENIED'
  reviewedByUserId: text('reviewed_by_user_id'),
  reviewedAt:       timestamp('reviewed_at', { withTimezone: true }),
  responseNote:     text('response_note'),
  slaDeadlineAt:    timestamp('sla_deadline_at', { withTimezone: true }).notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx: index('sa_seller').on(table.sellerId),
  statusIdx: index('sa_status').on(table.status),
  slaIdx:    index('sa_sla').on(table.slaDeadlineAt),
}));
