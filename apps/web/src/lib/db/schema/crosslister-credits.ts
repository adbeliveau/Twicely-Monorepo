/**
 * Publish credit ledger schema — FIFO credit tracking for Crosslister publish allowances.
 * Source: Pricing Canonical §6.2, §6.4; Lister Canonical §7.3
 */

import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listerSubscription } from './subscriptions';
import { creditTypeEnum } from './enums';

// §F4.S1 publishCreditLedger — per-user credit buckets, consumed FIFO by expiresAt
export const publishCreditLedger = pgTable('publish_credit_ledger', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  userId:               text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  creditType:           creditTypeEnum('credit_type').notNull(),
  totalCredits:         integer('total_credits').notNull(),
  usedCredits:          integer('used_credits').notNull().default(0),
  expiresAt:            timestamp('expires_at', { withTimezone: true }).notNull(),
  periodStart:          timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:            timestamp('period_end', { withTimezone: true }).notNull(),
  listerSubscriptionId: text('lister_subscription_id').references(() => listerSubscription.id),
  stripeSessionId:      text('stripe_session_id'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userExpiresIdx:    index('pcl_user_expires').on(table.userId, table.expiresAt),
  subIdx:            index('pcl_sub').on(table.listerSubscriptionId),
  stripeSessionUniq: uniqueIndex('pcl_stripe_session').on(table.stripeSessionId),
}));
