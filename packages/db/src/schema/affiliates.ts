import { pgTable, text, integer, index, unique, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { user } from './auth';
import { listing } from './listings';
import {
  affiliateTierEnum,
  affiliateStatusEnum,
  referralStatusEnum,
  promoCodeTypeEnum,
  promoDiscountTypeEnum,
  commissionStatusEnum,
  payoutStatusEnum,
} from './enums';

// §21.1 affiliate
export const affiliate = pgTable('affiliate', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id).unique(),
  tier:                affiliateTierEnum('tier').notNull().default('COMMUNITY'),
  status:              affiliateStatusEnum('status').notNull().default('ACTIVE'),
  referralCode:        text('referral_code').notNull().unique(),     // e.g., 'USERNAME' → twicely.co/ref/USERNAME
  commissionRateBps:   integer('commission_rate_bps').notNull(),     // 1500 = 15.00%
  cookieDurationDays:  integer('cookie_duration_days').notNull().default(30),
  commissionDurationMonths: integer('commission_duration_months').notNull().default(12),
  payoutMethod:        text('payout_method'),                       // 'stripe_connect' | 'paypal'
  payoutEmail:         text('payout_email'),                        // PayPal email if applicable
  stripeConnectAccountId: text('stripe_connect_account_id'),        // If using Stripe payouts
  taxInfoProvided:     boolean('tax_info_provided').notNull().default(false),
  pendingBalanceCents: integer('pending_balance_cents').notNull().default(0),
  availableBalanceCents: integer('available_balance_cents').notNull().default(0),
  totalEarnedCents:    integer('total_earned_cents').notNull().default(0),
  totalPaidCents:      integer('total_paid_cents').notNull().default(0),
  warningCount:        integer('warning_count').notNull().default(0),
  suspendedAt:         timestamp('suspended_at', { withTimezone: true }),
  suspendedUntil:      timestamp('suspended_until', { withTimezone: true }),  // NULL = permanent (ban), non-NULL = auto-expires
  suspendedReason:     text('suspended_reason'),
  applicationNote:     text('application_note'),                    // For influencer applications
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:             index('aff_user').on(table.userId),
  statusIdx:           index('aff_status').on(table.status),
}));

// §21.3 promoCode (defined before referral since referral references it)
export const promoCode = pgTable('promo_code', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  code:                text('code').notNull().unique(),              // Uppercased, 4-20 chars alphanumeric + hyphens
  type:                promoCodeTypeEnum('type').notNull(),
  affiliateId:         text('affiliate_id').references(() => affiliate.id),  // NULL for platform codes
  discountType:        promoDiscountTypeEnum('discount_type').notNull(),
  discountValue:       integer('discount_value').notNull(),          // BPS for percentage, cents for fixed
  durationMonths:      integer('duration_months').notNull().default(1),  // How many months discount applies
  scopeProductTypes:   jsonb('scope_product_types'),                 // ['store', 'lister', 'automation', 'finance'] or NULL for all
  usageLimit:          integer('usage_limit'),                       // NULL = unlimited
  usageCount:          integer('usage_count').notNull().default(0),
  expiresAt:           timestamp('expires_at', { withTimezone: true }),  // NULL = never
  isActive:            boolean('is_active').notNull().default(true),
  createdByUserId:     text('created_by_user_id').notNull(),         // Affiliate userId or admin staffId
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  affiliateIdx:        index('pc_affiliate').on(table.affiliateId),
  typeIdx:             index('pc_type').on(table.type),
}));

// §21.2 referral
export const referral = pgTable('referral', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  affiliateId:         text('affiliate_id').notNull().references(() => affiliate.id),
  referredUserId:      text('referred_user_id').references(() => user.id),  // NULL until signup
  status:              referralStatusEnum('status').notNull().default('CLICKED'),
  clickedAt:           timestamp('clicked_at', { withTimezone: true }).notNull().defaultNow(),
  signedUpAt:          timestamp('signed_up_at', { withTimezone: true }),
  trialStartedAt:      timestamp('trial_started_at', { withTimezone: true }),
  convertedAt:         timestamp('converted_at', { withTimezone: true }),
  churnedAt:           timestamp('churned_at', { withTimezone: true }),
  expiresAt:           timestamp('expires_at', { withTimezone: true }).notNull(),  // Cookie expiry
  ipAddress:           text('ip_address'),                          // For fraud detection
  userAgent:           text('user_agent'),
  utmSource:           text('utm_source'),
  utmMedium:           text('utm_medium'),
  utmCampaign:         text('utm_campaign'),
  promoCodeId:         text('promo_code_id').references(() => promoCode.id),
  // G3.6 — listing-level attribution; NULL for signup referrals
  listingId:           text('listing_id').references(() => listing.id),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  affiliateIdx:        index('ref_affiliate').on(table.affiliateId),
  referredUserIdx:     index('ref_referred').on(table.referredUserId),
  statusIdx:           index('ref_status').on(table.status),
  expiresIdx:          index('ref_expires').on(table.expiresAt),
  listingIdx:          index('ref_listing').on(table.listingId),
}));

// §21.4 promoCodeRedemption
export const promoCodeRedemption = pgTable('promo_code_redemption', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  promoCodeId:         text('promo_code_id').notNull().references(() => promoCode.id),
  userId:              text('user_id').notNull().references(() => user.id),
  subscriptionProduct: text('subscription_product').notNull(),       // 'store' | 'lister' | 'automation' | 'finance' | 'bundle'
  discountAppliedCents: integer('discount_applied_cents').notNull(),
  monthsRemaining:     integer('months_remaining').notNull(),        // Countdown of discount months left
  stripePromotionCodeId: text('stripe_promotion_code_id'),           // Stripe's promo code ID
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  promoIdx:            index('pcr_promo').on(table.promoCodeId),
  userIdx:             index('pcr_user').on(table.userId),
  uniqueRedemption:    unique().on(table.promoCodeId, table.userId, table.subscriptionProduct),
}));

// §21.5 affiliateCommission
export const affiliateCommission = pgTable('affiliate_commission', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  affiliateId:         text('affiliate_id').notNull().references(() => affiliate.id),
  referralId:          text('referral_id').notNull().references(() => referral.id),
  invoiceId:           text('invoice_id').notNull(),                 // Stripe invoice ID
  subscriptionProduct: text('subscription_product').notNull(),       // Which product generated this
  grossRevenueCents:   integer('gross_revenue_cents').notNull(),     // Invoice amount
  netRevenueCents:     integer('net_revenue_cents').notNull(),       // After Stripe fees
  commissionRateBps:   integer('commission_rate_bps').notNull(),     // Rate at time of calculation
  commissionCents:     integer('commission_cents').notNull(),        // Actual commission amount
  status:              commissionStatusEnum('status').notNull().default('PENDING'),
  holdExpiresAt:       timestamp('hold_expires_at', { withTimezone: true }).notNull(),  // 30-day hold
  paidAt:              timestamp('paid_at', { withTimezone: true }),
  reversedAt:          timestamp('reversed_at', { withTimezone: true }),
  reversalReason:      text('reversal_reason'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  affiliateIdx:        index('ac_affiliate').on(table.affiliateId, table.status),
  referralIdx:         index('ac_referral').on(table.referralId),
  holdIdx:             index('ac_hold').on(table.holdExpiresAt),
  invoiceIdx:          index('ac_invoice').on(table.invoiceId),
}));

// §21.6 affiliatePayout
export const affiliatePayout = pgTable('affiliate_payout', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  affiliateId:         text('affiliate_id').notNull().references(() => affiliate.id),
  amountCents:         integer('amount_cents').notNull(),
  method:              text('method').notNull(),                     // 'stripe_connect' | 'paypal'
  externalPayoutId:    text('external_payout_id'),                   // Stripe transfer ID or PayPal batch ID
  status:              payoutStatusEnum('status').notNull().default('PENDING'),
  periodStart:         timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:           timestamp('period_end', { withTimezone: true }).notNull(),
  failedReason:        text('failed_reason'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  affiliateIdx:        index('ap_affiliate').on(table.affiliateId),
  statusIdx:           index('ap_status').on(table.status),
}));
