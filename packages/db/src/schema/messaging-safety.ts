import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import {
  bannedKeywordCategoryEnum,
  bannedKeywordActionEnum,
  moderationActionEnum,
  safetyActionTypeEnum,
} from './enums';
import { user } from './auth';
import { message, conversation } from './messaging';

// §9.3 bannedKeyword — V4-15 Messaging Safety
export const bannedKeyword = pgTable('banned_keyword', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  keyword:          text('keyword').notNull().unique(),
  category:         bannedKeywordCategoryEnum('category').notNull(),
  action:           bannedKeywordActionEnum('action').notNull(),
  isRegex:          boolean('is_regex').notNull().default(false),
  isActive:         boolean('is_active').notNull().default(true),
  createdByStaffId: text('created_by_staff_id'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryActiveIdx: index('bk_category_active').on(table.category, table.isActive),
}));

// §9.4 messageModerationLog — V4-15 Messaging Safety
export const messageModerationLog = pgTable('message_moderation_log', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  messageId:        text('message_id').notNull().references(() => message.id, { onDelete: 'cascade' }),
  action:           moderationActionEnum('action').notNull(),
  reason:           text('reason').notNull(),
  matchedKeywords:  text('matched_keywords').array().notNull().default(sql`'{}'::text[]`),
  aiConfidence:     integer('ai_confidence'),
  staffId:          text('staff_id'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  messageIdx:       index('mml_message').on(table.messageId),
  actionCreatedIdx: index('mml_action_created').on(table.action, table.createdAt),
}));

// §9.5 messageRateLimit — V4-15 Messaging Safety
export const messageRateLimit = pgTable('message_rate_limit', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').notNull(),
  windowStart:      timestamp('window_start', { withTimezone: true }).notNull(),
  messageCount:     integer('message_count').notNull().default(0),
}, (table) => ({
  userWindowIdx:    uniqueIndex('mrl_user_window').on(table.userId, table.windowStart),
}));

// §9.6 messageSafetyAction — V4-15 Messaging Safety
export const messageSafetyAction = pgTable('message_safety_action', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  actionType:       safetyActionTypeEnum('action_type').notNull(),
  violationCount:   integer('violation_count').notNull(),
  triggerMessageId: text('trigger_message_id').references(() => message.id, { onDelete: 'set null' }),
  reason:           text('reason').notNull(),
  expiresAt:        timestamp('expires_at', { withTimezone: true }),
  revokedAt:        timestamp('revoked_at', { withTimezone: true }),
  revokedByStaffId: text('revoked_by_staff_id'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userCreatedIdx:   index('msa_user_created').on(table.userId, table.createdAt),
  actionExpiresIdx: index('msa_action_expires').on(table.actionType, table.expiresAt),
}));

// §9.7 sellerResponseMetric — V4-15 Messaging Safety
export const sellerResponseMetric = pgTable('seller_response_metric', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:              text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  conversationId:        text('conversation_id').notNull().references(() => conversation.id, { onDelete: 'cascade' }),
  firstBuyerMessageAt:   timestamp('first_buyer_message_at', { withTimezone: true }).notNull(),
  firstSellerResponseAt: timestamp('first_seller_response_at', { withTimezone: true }),
  responseTimeMinutes:   integer('response_time_minutes'),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerCreatedIdx:      index('srm_seller_created').on(table.sellerId, table.createdAt),
  sellerConvIdx:         uniqueIndex('srm_seller_conv').on(table.sellerId, table.conversationId),
}));
