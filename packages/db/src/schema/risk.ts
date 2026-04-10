import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';

// §3.1 riskSignal — append-only risk signal log
export const riskSignal = pgTable('risk_signal', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').references(() => user.id, { onDelete: 'restrict' }),
  sellerId:          text('seller_id'),
  signalType:        text('signal_type').notNull(),
  score:             integer('score').notNull(),
  severity:          text('severity').notNull().default('LOW'),
  metaJson:          jsonb('meta_json').notNull().default(sql`'{}'::jsonb`),
  source:            text('source').notNull().default('system'),
  resolved:          boolean('resolved').notNull().default(false),
  resolvedAt:        timestamp('resolved_at', { withTimezone: true }),
  resolvedByStaffId: text('resolved_by_staff_id'),
  resolvedReason:    text('resolved_reason'),
  occurredAt:        timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:   index('rs_seller').on(table.sellerId, table.occurredAt),
  userIdx:     index('rs_user').on(table.userId, table.occurredAt),
  typeIdx:     index('rs_type').on(table.signalType, table.occurredAt),
  severityIdx: index('rs_severity').on(table.severity, table.resolved),
}));

// §3.2 riskScore — composite risk score per user (cache + dashboard)
export const riskScore = pgTable('risk_score', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }).unique(),
  buyerScore:       integer('buyer_score').notNull().default(0),
  sellerScore:      integer('seller_score').notNull().default(0),
  compositeScore:   integer('composite_score').notNull().default(0),
  severity:         text('severity').notNull().default('LOW'),
  signalCount:      integer('signal_count').notNull().default(0),
  lastSignalAt:     timestamp('last_signal_at', { withTimezone: true }),
  lastComputedAt:   timestamp('last_computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  compositeIdx: index('rsc_composite').on(table.compositeScore),
  severityIdx:  index('rsc_severity').on(table.severity),
}));

// §3.3 riskThreshold — per-action configurable thresholds
export const riskThreshold = pgTable('risk_threshold', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  action:           text('action').notNull().unique(),
  warnAt:           integer('warn_at').notNull().default(31),
  stepUpAt:         integer('step_up_at').notNull().default(61),
  blockAt:          integer('block_at').notNull().default(81),
  isActive:         boolean('is_active').notNull().default(true),
  updatedByStaffId: text('updated_by_staff_id'),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// §3.4 riskAction — gate decision audit trail
export const riskAction = pgTable('risk_action', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  action:              text('action').notNull(),
  recommendation:      text('recommendation').notNull(),
  scoreAtTime:         integer('score_at_time').notNull(),
  outcome:             text('outcome').notNull(),
  overriddenByStaffId: text('overridden_by_staff_id'),
  overrideReason:      text('override_reason'),
  metaJson:            jsonb('meta_json').notNull().default(sql`'{}'::jsonb`),
  occurredAt:          timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:   index('ra_user').on(table.userId, table.occurredAt),
  actionIdx: index('ra_action').on(table.action, table.outcome),
}));

// §3.5 accountSecurityEvent — append-only auth/security log
export const accountSecurityEvent = pgTable('account_security_event', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  userId:      text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  eventType:   text('event_type').notNull(),
  ipAddress:   text('ip_address'),
  userAgent:   text('user_agent'),
  deviceId:    text('device_id'),
  location:    text('location'),
  success:     boolean('success').notNull().default(true),
  metaJson:    jsonb('meta_json').notNull().default(sql`'{}'::jsonb`),
  occurredAt:  timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('ase_user').on(table.userId, table.occurredAt),
  typeIdx: index('ase_type').on(table.eventType, table.occurredAt),
  ipIdx:   index('ase_ip').on(table.ipAddress, table.occurredAt),
}));
