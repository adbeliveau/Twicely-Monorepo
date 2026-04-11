import { pgTable, text, boolean, timestamp, integer, real, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { sellerTypeEnum, sellerStatusEnum, storeTierEnum, listerTierEnum, performanceBandEnum, businessTypeEnum, financeTierEnum, bundleTierEnum } from './enums';
import { user } from './auth';


// §2.3 sellerProfile
export const sellerProfile = pgTable('seller_profile', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  sellerType:        sellerTypeEnum('seller_type').notNull().default('PERSONAL'),
  storeTier:         storeTierEnum('store_tier').notNull().default('NONE'),
  listerTier:        listerTierEnum('lister_tier').notNull().default('NONE'),
  listerFreeExpiresAt: timestamp('lister_free_expires_at', { withTimezone: true }),
  hasAutomation:     boolean('has_automation').notNull().default(false),
  financeTier:       financeTierEnum('finance_tier').notNull().default('FREE'),
  bundleTier:        bundleTierEnum('bundle_tier').notNull().default('NONE'),
  performanceBand:   performanceBandEnum('performance_band').notNull().default('EMERGING'),
  status:            sellerStatusEnum('status').notNull().default('ACTIVE'),
  payoutsEnabled:    boolean('payouts_enabled').notNull().default(false),
  storeName:         text('store_name'),
  storeSlug:         text('store_slug').unique(),
  storeDescription:  text('store_description'),
  returnPolicy:      text('return_policy'),
  handlingTimeDays:  integer('handling_time_days').notNull().default(3),
  vacationMode:      boolean('vacation_mode').notNull().default(false),
  vacationMessage:   text('vacation_message'),
  vacationStartAt:   timestamp('vacation_start_at', { withTimezone: true }),
  vacationEndAt:     timestamp('vacation_end_at', { withTimezone: true }),
  vacationModeType:  text('vacation_mode_type'),  // PAUSE_SALES | ALLOW_SALES | CUSTOM — nullable, null when not on vacation
  vacationAutoReplyMessage: text('vacation_auto_reply_message'),
  stripeAccountId:   text('stripe_account_id'),
  stripeCustomerId:  text('stripe_customer_id'),
  stripeOnboarded:   boolean('stripe_onboarded').notNull().default(false),
  trustScore:        real('trust_score').notNull().default(80),
  // A2.1 — trial tracking
  trialListerUsed:     boolean('trial_lister_used').notNull().default(false),
  trialStoreUsed:      boolean('trial_store_used').notNull().default(false),
  trialAutomationUsed: boolean('trial_automation_used').notNull().default(false),
  trialFinanceUsed:    boolean('trial_finance_used').notNull().default(false),
  activatedAt:       timestamp('activated_at', { withTimezone: true }),
  verifiedAt:        timestamp('verified_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // D6 — Authentication Program (Tier 1 Verified Seller badge)
  isAuthenticatedSeller: boolean('is_authenticated_seller').notNull().default(false),
  // Local pickup
  maxMeetupDistanceMiles: integer('max_meetup_distance_miles'),
  // Payout frequency
  payoutFrequency: text('payout_frequency').notNull().default('WEEKLY'),
  // Intelligence layer — goal tracker (Financial Center Canonical §6.1)
  financeGoals:   jsonb('finance_goals'),     // { revenueGoalCents: number | null, profitGoalCents: number | null }
  // G3.6 — Creator Affiliate Listing Links
  affiliateOptIn:         boolean('affiliate_opt_in').notNull().default(true),
  affiliateCommissionBps: integer('affiliate_commission_bps'),  // null = use platform default
  // G4 — Enforcement fields (Seller Score Canonical Section 10.2)
  enforcementLevel:      text('enforcement_level'),              // 'COACHING' | 'WARNING' | 'RESTRICTION' | 'PRE_SUSPENSION' | null
  enforcementStartedAt:  timestamp('enforcement_started_at', { withTimezone: true }),
  warningExpiresAt:      timestamp('warning_expires_at', { withTimezone: true }),
  bandOverride:          performanceBandEnum('band_override'),
  bandOverrideExpiresAt: timestamp('band_override_expires_at', { withTimezone: true }),
  bandOverrideReason:    text('band_override_reason'),
  bandOverrideBy:        text('band_override_by'),
  // G4.1 — Seller Score Engine (Seller Score Canonical Section 10.2)
  sellerScore:           integer('seller_score').notNull().default(0),
  sellerScoreUpdatedAt:  timestamp('seller_score_updated_at', { withTimezone: true }),
  isNew:                 boolean('is_new').notNull().default(true),
  boostCreditCents:      integer('boost_credit_cents').notNull().default(0),
  // Decision #144 — Geo-proximity search (city centroid from profile zip)
  sellerLat:             real('seller_lat'),
  sellerLng:             real('seller_lng'),
}, (table) => ({
  userIdx:       index('sp_user').on(table.userId),
  storeSlugIdx:  index('sp_store_slug').on(table.storeSlug),
  statusIdx:     index('sp_status').on(table.status),
  bandIdx:       index('sp_band').on(table.performanceBand),
}));

// §2.4 businessInfo
export const businessInfo = pgTable('business_info', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  businessName:    text('business_name').notNull(),
  businessType:    businessTypeEnum('business_type').notNull(),
  ein:             text('ein'),
  address1:        text('address1').notNull(),
  address2:        text('address2'),
  city:            text('city').notNull(),
  state:           text('state').notNull(),
  zip:             text('zip').notNull(),
  country:         text('country').notNull().default('US'),
  phone:           text('phone'),
  website:         text('website'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §2.5 address
export const address = pgTable('address', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  userId:        text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  label:         text('label'),
  name:          text('name').notNull(),
  address1:      text('address1').notNull(),
  address2:      text('address2'),
  city:          text('city').notNull(),
  state:         text('state').notNull(),
  zip:           text('zip').notNull(),
  country:       text('country').notNull().default('US'),
  phone:         text('phone'),
  isDefault:     boolean('is_default').notNull().default(false),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:       index('addr_user').on(table.userId),
}));
