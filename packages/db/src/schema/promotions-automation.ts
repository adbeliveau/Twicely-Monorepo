/**
 * V4-06: Promotions Automation Schema
 *
 * Campaign management, budget tracking, scheduling, and promotion linkage.
 * Additive to existing promotions.ts tables.
 */

import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { promotionCampaignTypeEnum, promotionCampaignStatusEnum } from './enums';
import { promotion } from './promotions';
import { order } from './commerce';

// --- promotionCampaign ---

export const promotionCampaign = pgTable('promotion_campaign', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  name:                 text('name').notNull(),
  description:          text('description'),
  campaignType:         promotionCampaignTypeEnum('campaign_type').notNull(),
  status:               promotionCampaignStatusEnum('status').notNull().default('DRAFT'),
  startsAt:             timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt:               timestamp('ends_at', { withTimezone: true }).notNull(),
  timezone:             text('timezone').notNull().default('UTC'),
  budgetCents:          integer('budget_cents'),
  spentCents:           integer('spent_cents').notNull().default(0),
  maxRedemptions:       integer('max_redemptions'),
  maxTotalDiscountCents: integer('max_total_discount_cents'),
  budgetAlertPct:       integer('budget_alert_pct').notNull().default(80),
  autoDisableOnExhaust: boolean('auto_disable_on_exhaust').notNull().default(true),
  targetingRules:       jsonb('targeting_rules').notNull().default(sql`'{}'::jsonb`),
  sellerId:             text('seller_id'),
  createdByStaffId:     text('created_by_staff_id'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusStartIdx:       index('pc_status_start').on(table.status, table.startsAt),
  statusEndIdx:         index('pc_status_end').on(table.status, table.endsAt),
  sellerStatusIdx:      index('pc_seller_status').on(table.sellerId, table.status),
}));

// --- campaignPromotion ---

export const campaignPromotion = pgTable('campaign_promotion', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  campaignId:           text('campaign_id').notNull().references(() => promotionCampaign.id, { onDelete: 'cascade' }),
  promotionId:          text('promotion_id').notNull().references(() => promotion.id, { onDelete: 'restrict' }),
  priority:             integer('priority').notNull().default(0),
}, (table) => ({
  uniqueCampaignPromo:  uniqueIndex('cp_campaign_promo_unique').on(table.campaignId, table.promotionId),
}));

// --- campaignBudgetLog ---

export const campaignBudgetLog = pgTable('campaign_budget_log', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  campaignId:           text('campaign_id').notNull().references(() => promotionCampaign.id, { onDelete: 'cascade' }),
  action:               text('action').notNull(),
  amountCents:          integer('amount_cents').notNull(),
  balanceCents:         integer('balance_cents').notNull(),
  orderId:              text('order_id'),
  staffId:              text('staff_id'),
  reason:               text('reason'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  campaignCreatedIdx:   index('cbl_campaign_created').on(table.campaignId, table.createdAt),
}));

// --- campaignRule ---

export const campaignRule = pgTable('campaign_rule', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  campaignId:           text('campaign_id').notNull().references(() => promotionCampaign.id, { onDelete: 'cascade' }),
  ruleType:             text('rule_type').notNull(),
  condition:            jsonb('condition').notNull(),
  isActive:             boolean('is_active').notNull().default(true),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  campaignRuleTypeIdx:  index('cr_campaign_rule_type').on(table.campaignId, table.ruleType),
}));

// --- campaignRedemption ---

export const campaignRedemption = pgTable('campaign_redemption', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  campaignId:           text('campaign_id').notNull().references(() => promotionCampaign.id, { onDelete: 'cascade' }),
  promotionId:          text('promotion_id').notNull().references(() => promotion.id, { onDelete: 'restrict' }),
  orderId:              text('order_id').notNull().references(() => order.id, { onDelete: 'restrict' }),
  buyerId:              text('buyer_id').notNull(),
  discountCents:        integer('discount_cents').notNull(),
  idempotencyKey:       text('idempotency_key').unique(),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  campaignDateIdx:      index('cred_campaign_date').on(table.campaignId, table.createdAt),
  buyerCampaignIdx:     index('cred_buyer_campaign').on(table.buyerId, table.campaignId),
  orderIdx:             index('cred_order').on(table.orderId),
}));

// --- scheduledPromoTask ---

export const scheduledPromoTask = pgTable('scheduled_promo_task', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  campaignId:           text('campaign_id').notNull().references(() => promotionCampaign.id, { onDelete: 'cascade' }),
  taskType:             text('task_type').notNull(), // 'activate' | 'deactivate'
  scheduledFor:         timestamp('scheduled_for', { withTimezone: true }).notNull(),
  status:               text('status').notNull().default('pending'),
  executedAt:           timestamp('executed_at', { withTimezone: true }),
  errorMessage:         text('error_message'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  scheduledStatusIdx:   index('spt_scheduled_status').on(table.scheduledFor, table.status),
  campaignIdx:          index('spt_campaign').on(table.campaignId),
}));
