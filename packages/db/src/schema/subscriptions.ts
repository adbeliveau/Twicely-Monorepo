import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { storeTierEnum, listerTierEnum, financeTierEnum, bundleTierEnum, subscriptionStatusEnum, delegationStatusEnum } from './enums';
import { user } from './auth';
import { sellerProfile } from './identity';

// §A2.2 trialUsage — trial tracking per user per product type
export const trialUsage = pgTable('trial_usage', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  productType: text('product_type').notNull(), // 'STORE' | 'LISTER' | 'AUTOMATION'
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }).notNull().defaultNow(),
  trialEndedAt: timestamp('trial_ended_at', { withTimezone: true }),
  convertedToSubscription: boolean('converted_to_subscription').notNull().default(false),
  stripeSubscriptionId: text('stripe_subscription_id'),
});

// §3.1 storeSubscription
export const storeSubscription = pgTable('store_subscription', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:     text('seller_profile_id').notNull().unique().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  tier:                storeTierEnum('tier').notNull(),
  status:              subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId:       text('stripe_price_id'),
  currentPeriodStart:  timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:    timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:   boolean('cancel_at_period_end').notNull().default(false),
  canceledAt:          timestamp('canceled_at', { withTimezone: true }),
  trialEndsAt:         timestamp('trial_ends_at', { withTimezone: true }),
  pendingTier:         storeTierEnum('pending_tier'),
  pendingBillingInterval: text('pending_billing_interval'),
  pendingChangeAt:     timestamp('pending_change_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §3.2 listerSubscription
export const listerSubscription = pgTable('lister_subscription', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:     text('seller_profile_id').notNull().unique().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  tier:                listerTierEnum('tier').notNull(),
  status:              subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId:       text('stripe_price_id'),
  currentPeriodStart:  timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:    timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:   boolean('cancel_at_period_end').notNull().default(false),
  canceledAt:          timestamp('canceled_at', { withTimezone: true }),
  pendingTier:         listerTierEnum('pending_tier'),
  pendingBillingInterval: text('pending_billing_interval'),
  pendingChangeAt:     timestamp('pending_change_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §3.3 automationSubscription
export const automationSubscription = pgTable('automation_subscription', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:     text('seller_profile_id').notNull().unique().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  status:              subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  creditsIncluded:     integer('credits_included').notNull().default(2000),
  creditsUsed:         integer('credits_used').notNull().default(0),
  currentPeriodStart:  timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:    timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:   boolean('cancel_at_period_end').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §18.1 financeSubscription
export const financeSubscription = pgTable('finance_subscription', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:       text('seller_profile_id').notNull().unique().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  tier:                  financeTierEnum('tier').notNull(),
  status:                subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId:  text('stripe_subscription_id').unique(),
  stripePriceId:         text('stripe_price_id'),
  currentPeriodStart:    timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:      timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:     boolean('cancel_at_period_end').notNull().default(false),
  canceledAt:            timestamp('canceled_at', { withTimezone: true }),
  pendingTier:           text('pending_tier'),
  pendingBillingInterval: text('pending_billing_interval'),
  pendingChangeAt:       timestamp('pending_change_at', { withTimezone: true }),
  // Intelligence layer — trial & receipt credits (Financial Center Canonical §2, §3)
  storeTierTrialUsed:          boolean('store_tier_trial_used').notNull().default(false),
  storeTierTrialStartedAt:     timestamp('store_tier_trial_started_at', { withTimezone: true }),
  storeTierTrialEndsAt:        timestamp('store_tier_trial_ends_at', { withTimezone: true }),
  receiptCreditsUsedThisMonth: integer('receipt_credits_used_this_month').notNull().default(0),
  receiptCreditsPeriodStart:   timestamp('receipt_credits_period_start', { withTimezone: true }),
  // Tax features (Financial Center Canonical §6.5, §6.6)
  taxSavedCents:               integer('tax_saved_cents').notNull().default(0),
  taxQuarterlyPaymentsJson:    jsonb('tax_quarterly_payments_json').notNull().default(sql`'{}'`),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §3.5 bundleSubscription (addendum: canceledAt + trialEndsAt match storeSubscription pattern)
export const bundleSubscription = pgTable('bundle_subscription', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:       text('seller_profile_id').notNull().unique().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  tier:                  bundleTierEnum('tier').notNull(),
  status:                subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId:  text('stripe_subscription_id').unique(),
  stripePriceId:         text('stripe_price_id'),
  currentPeriodStart:    timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:      timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:     boolean('cancel_at_period_end').notNull().default(false),
  pendingTier:           bundleTierEnum('pending_tier'),
  pendingBillingInterval: text('pending_billing_interval'),
  pendingChangeAt:       timestamp('pending_change_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §3.4 delegatedAccess
export const delegatedAccess = pgTable('delegated_access', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:        text('seller_id').notNull().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  // restrict: delegated access records must survive user deletion for access audit
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  email:           text('email').notNull(),
  scopes:          text('scopes').array().notNull().default(sql`'{}'::text[]`),
  status:          delegationStatusEnum('status').notNull().default('ACTIVE'),
  invitedAt:       timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt:      timestamp('accepted_at', { withTimezone: true }),
  revokedAt:       timestamp('revoked_at', { withTimezone: true }),
  revokedByUserId: text('revoked_by_user_id'),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:       index('da_seller').on(table.sellerId),
  userIdx:         index('da_user').on(table.userId),
  statusIdx:       index('da_status').on(table.status),
}));
