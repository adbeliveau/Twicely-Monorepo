import { pgTable, text, boolean, timestamp, jsonb, index, integer, real } from 'drizzle-orm/pg-core';
import { buyerQualityTierEnum } from './enums';

// §2.1 user
export const user = pgTable('user', {
  // Better Auth Core
  id:                  text('id').primaryKey(),
  name:                text('name').notNull(),
  email:               text('email').notNull().unique(),
  emailVerified:       boolean('email_verified').notNull().default(false),
  image:               text('image'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

  // Marketplace Extensions
  displayName:         text('display_name'),
  username:            text('username').unique(),
  bio:                 text('bio'),
  phone:               text('phone'),
  phoneVerified:       boolean('phone_verified').notNull().default(false),
  avatarUrl:           text('avatar_url'),
  defaultAddressId:    text('default_address_id'),
  isSeller:            boolean('is_seller').notNull().default(false),
  buyerQualityTier:    buyerQualityTierEnum('buyer_quality_tier').notNull().default('GREEN'),
  dashboardLayoutJson: jsonb('dashboard_layout_json'),
  marketingOptIn:      boolean('marketing_opt_in').notNull().default(false),
  deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
  isBanned:            boolean('is_banned').notNull().default(false),
  bannedAt:            timestamp('banned_at', { withTimezone: true }),
  bannedReason:        text('banned_reason'),
  // A2.1 — buyer acquisition & affiliate tracking
  creditBalanceCents:    integer('credit_balance_cents').notNull().default(0),
  // FK to affiliate.id — enforced via migration, not Drizzle (circular import: auth -> affiliates -> auth)
  referredByAffiliateId: text('referred_by_affiliate_id'),
  // G2.8 — Local Reliability System (Decision #114)
  localReliabilityMarks:   integer('local_reliability_marks').notNull().default(0),
  localTransactionCount:   integer('local_transaction_count').notNull().default(0),
  localCompletionRate:     real('local_completion_rate'),
  localSuspendedUntil:     timestamp('local_suspended_until', { withTimezone: true }),
  // G2.15 — Escrow Fraud Detection (Addendum §A12)
  localFraudBannedAt:      timestamp('local_fraud_banned_at', { withTimezone: true }),
  // G10.10 — Stripe Customer for marketplace payments (separate from sellerProfile.stripeCustomerId which is for billing)
  stripeCustomerId:        text('stripe_customer_id'),
  // G8.3 — Cookie Consent Management
  cookieConsentJson:       jsonb('cookie_consent_json'),
}, (table) => ({
  emailIdx:      index('usr_email').on(table.email),
  usernameIdx:   index('usr_username').on(table.username),
  isSellerIdx:   index('usr_is_seller').on(table.isSeller),
}));

// §2.2 session (Better Auth Managed)
export const session = pgTable('session', {
  id:            text('id').primaryKey(),
  userId:        text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token:         text('token').notNull().unique(),
  expiresAt:     timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress:     text('ip_address'),
  userAgent:     text('user_agent'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §2.2 account (Better Auth Managed)
export const account = pgTable('account', {
  id:                    text('id').primaryKey(),
  userId:                text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId:             text('account_id').notNull(),
  providerId:            text('provider_id').notNull(),
  accessToken:           text('access_token'),
  refreshToken:          text('refresh_token'),
  accessTokenExpiresAt:  timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope:                 text('scope'),
  password:              text('password'),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// §2.2 verification (Better Auth Managed)
export const verification = pgTable('verification', {
  id:          text('id').primaryKey(),
  identifier:  text('identifier').notNull(),
  value:       text('value').notNull(),
  expiresAt:   timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
