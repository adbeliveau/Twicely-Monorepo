import { pgTable, text, integer, index, unique, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { category } from './catalog';
import { buyerReferralStatusEnum } from './enums';

// Note: buyer_block_list is defined as buyerBlockList in social.ts (§20.5)

// §23.1 googleCategoryMapping
export const googleCategoryMapping = pgTable('google_category_mapping', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  twicelyCategoryId:   text('twicely_category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  googleCategoryId:    integer('google_category_id').notNull(),
  googleCategoryPath:  text('google_category_path').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  twicelyUnique:       unique().on(table.twicelyCategoryId),
}));

// §23.2 buyerReferral
export const buyerReferral = pgTable('buyer_referral', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  referrerUserId:        text('referrer_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  referredUserId:        text('referred_user_id').references(() => user.id, { onDelete: 'set null' }),
  referralCode:          text('referral_code').notNull().unique(),
  status:                buyerReferralStatusEnum('status').notNull().default('PENDING'),

  // Credits
  referrerCreditCents:   integer('referrer_credit_cents'),
  referredCreditCents:   integer('referred_credit_cents'),
  qualifyingOrderId:     text('qualifying_order_id'),

  // Anti-fraud
  referredIp:            text('referred_ip'),
  referredDeviceHash:    text('referred_device_hash'),

  // Timestamps
  clickedAt:             timestamp('clicked_at', { withTimezone: true }),
  signedUpAt:            timestamp('signed_up_at', { withTimezone: true }),
  redeemedAt:            timestamp('redeemed_at', { withTimezone: true }),
  expiresAt:             timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  referrerIdx:           index('br_referrer').on(table.referrerUserId),
  referredIdx:           index('br_referred').on(table.referredUserId),
  statusIdx:             index('br_status').on(table.status),
}));
