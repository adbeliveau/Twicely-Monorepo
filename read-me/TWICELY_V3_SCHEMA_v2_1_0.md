# TWICELY V3 — Complete Drizzle Schema
**Version:** v2.1.3
**Status:** LOCKED
**Date:** 2026-03-14
**Tables:** 145 | **Enums:** 77
**Purpose:** Every table, every column, every enum, every index for the entire Twicely V3 platform. This IS the database. No table exists that isn't in this file.

**Governing documents:** User Model, Pricing Canonical v3.2, Finance Engine Canonical, Lister Canonical, Actors & Security Canonical, Feature Lock-in, Platform Settings Canonical, Helpdesk Canonical

---

## CONVENTIONS

**IDs:** All primary keys: `text('id').primaryKey().$defaultFn(() => createId())` — CUID2. Exception: Better Auth managed tables use their own ID format.

**Money:** All monetary values as **integer cents** — never floats. Column suffix: `Cents`. Currency as ISO 4217 string, default `'USD'`.

**Timestamps:** All `timestamp('...', { withTimezone: true })`. Every table has `createdAt` + `updatedAt` (both `.notNull().defaultNow()`).

**Naming:** Tables: `snake_case`. Columns: `snake_case` in DB, `camelCase` in TS via Drizzle. Enums: `snake_case`. Indexes: short prefix + columns. FKs: `{entity}Id`.

**Arrays:** `text('...').array().notNull().default(sql\`'{}'::text[]\`)`. JSON: `jsonb('...').notNull().default('{}')`.

**Imports (top of schema file):**

```typescript
import { pgTable, text, integer, boolean, timestamp, jsonb, pgEnum,
         index, unique, uniqueIndex, real, varchar, bigint, uuid, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
```

---

## 1. ENUMS

### 1.1 Identity & Auth

```typescript
export const sellerTypeEnum = pgEnum('seller_type', ['PERSONAL', 'BUSINESS']);
export const sellerStatusEnum = pgEnum('seller_status', ['ACTIVE', 'RESTRICTED', 'SUSPENDED']);
export const businessTypeEnum = pgEnum('business_type', ['SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP']);
export const platformRoleEnum = pgEnum('platform_role', [
  'HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER',
  'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN'
]);
export const delegationStatusEnum = pgEnum('delegation_status', ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED']);
```

### 1.2 Subscriptions

```typescript
export const storeTierEnum = pgEnum('store_tier', ['NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE']);
export const listerTierEnum = pgEnum('lister_tier', ['NONE', 'FREE', 'LITE', 'PRO']);
export const financeTierEnum = pgEnum('finance_tier', ['FREE', 'PRO']);
export const performanceBandEnum = pgEnum('performance_band', ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING', 'PENDING']);
// Bundle subscription tier (Decision #102)
export const bundleTierEnum = pgEnum('bundle_tier', ['NONE', 'STARTER', 'PRO', 'POWER']);
// Crosslister credit types (F4 — publish credit ledger)
export const creditTypeEnum = pgEnum('credit_type', ['MONTHLY', 'OVERAGE', 'BONUS']);
```

### 1.3 Listings

```typescript
export const listingStatusEnum = pgEnum('listing_status', ['DRAFT', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'REMOVED', 'RESERVED']);
export const listingConditionEnum = pgEnum('listing_condition', [
  'NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE'
]);
export const enforcementStateEnum = pgEnum('enforcement_state', ['CLEAR', 'FLAGGED', 'SUPPRESSED', 'REMOVED']);
export const fulfillmentTypeEnum = pgEnum('fulfillment_type', ['SHIP_ONLY', 'LOCAL_ONLY', 'SHIP_AND_LOCAL']);
export const authenticationStatusEnum = pgEnum('authentication_status', [
  'NONE', 'SELLER_VERIFIED',
  'AI_PENDING', 'AI_AUTHENTICATED', 'AI_INCONCLUSIVE', 'AI_COUNTERFEIT',
  'EXPERT_PENDING', 'EXPERT_AUTHENTICATED', 'EXPERT_COUNTERFEIT',
  'CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED'
]);
```

### 1.4 Commerce

```typescript
export const cartStatusEnum = pgEnum('cart_status', ['ACTIVE', 'CONVERTED', 'EXPIRED', 'ABANDONED']);
export const offerStatusEnum = pgEnum('offer_status', ['PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN', 'CANCELED']);
export const offerTypeEnum = pgEnum('offer_type', ['BEST_OFFER', 'WATCHER_OFFER', 'BUNDLE']);
export const orderStatusEnum = pgEnum('order_status', [
  'CREATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT',
  'DELIVERED', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED'
]);
export const cancelInitiatorEnum = pgEnum('cancel_initiator', ['BUYER', 'SELLER', 'SYSTEM', 'ADMIN']);
```

### 1.5 Shipping

```typescript
export const shipmentStatusEnum = pgEnum('shipment_status', [
  'PENDING', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'FAILED', 'RETURNED',
  'LOST',
  'DAMAGED_IN_TRANSIT',
  'RETURN_TO_SENDER'
]);

export const combinedShippingModeEnum = pgEnum('combined_shipping_mode', [
  'NONE', 'FLAT', 'PER_ADDITIONAL', 'AUTO_DISCOUNT', 'QUOTED'
]);
export const localTransactionStatusEnum = pgEnum('local_transaction_status', [
  'SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN', 'BOTH_CHECKED_IN',
  'RECEIPT_CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED',
  'ADJUSTMENT_PENDING', 'RESCHEDULE_PENDING'
]);
export const localFraudFlagSeverityEnum = pgEnum('local_fraud_flag_severity', [
  'CONFIRMED', 'STRONG_SIGNAL', 'MANUAL_REVIEW'
]);
export const localFraudFlagStatusEnum = pgEnum('local_fraud_flag_status', [
  'OPEN', 'CONFIRMED', 'DISMISSED'
]);
```

### 1.6 Returns & Disputes

```typescript
export const returnStatusEnum = pgEnum('return_status', [
  'PENDING_SELLER', 'APPROVED', 'DECLINED', 'PARTIAL_OFFERED',
  'BUYER_ACCEPTS_PARTIAL', 'BUYER_DECLINES_PARTIAL',
  'LABEL_GENERATED', 'SHIPPED', 'DELIVERED',
  'REFUND_ISSUED', 'CONDITION_DISPUTE', 'BUYER_ACCEPTS', 'ESCALATED', 'CLOSED'
]);
export const returnReasonEnum = pgEnum('return_reason', ['INAD', 'DAMAGED', 'INR', 'COUNTERFEIT', 'REMORSE', 'WRONG_ITEM']);
export const returnFaultEnum = pgEnum('return_fault', ['SELLER', 'BUYER', 'CARRIER', 'PLATFORM']);
export const returnReasonBucketEnum = pgEnum('return_reason_bucket', [
  'SELLER_FAULT', 'BUYER_REMORSE', 'PLATFORM_CARRIER_FAULT', 'EDGE_CONDITIONAL'
]);
export const disputeStatusEnum = pgEnum('dispute_status', [
  'OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'APPEALED', 'APPEAL_RESOLVED', 'CLOSED'
]);
export const claimTypeEnum = pgEnum('claim_type', ['INR', 'INAD', 'DAMAGED', 'COUNTERFEIT', 'REMORSE']);
```

### 1.7 Reviews

```typescript
export const reviewStatusEnum = pgEnum('review_status', ['PENDING', 'APPROVED', 'FLAGGED', 'REMOVED']);
export const buyerQualityTierEnum = pgEnum('buyer_quality_tier', ['GREEN', 'YELLOW', 'RED']);
```

### 1.8 Messaging & Notifications

```typescript
export const conversationStatusEnum = pgEnum('conversation_status', ['OPEN', 'READ_ONLY', 'ARCHIVED']);
export const notificationChannelEnum = pgEnum('notification_channel', ['EMAIL', 'PUSH', 'IN_APP', 'SMS']);
export const notificationPriorityEnum = pgEnum('notification_priority', ['CRITICAL', 'HIGH', 'NORMAL', 'LOW']);
```

### 1.9 Finance

```typescript
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'ORDER_PAYMENT_CAPTURED', 'ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'ORDER_STRIPE_PROCESSING_FEE',
  'REFUND_FULL', 'REFUND_PARTIAL', 'SELLER_ADJUSTMENT',
  'REFUND_TF_REVERSAL', 'REFUND_BOOST_REVERSAL', 'REFUND_STRIPE_REVERSAL',
  'CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE',
  'SHIPPING_LABEL_PURCHASE', 'SHIPPING_LABEL_REFUND',
  'INSERTION_FEE', 'INSERTION_FEE_WAIVER',
  'SUBSCRIPTION_CHARGE', 'SUBSCRIPTION_CREDIT', 'OVERAGE_CHARGE',
  'PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED',
  'RESERVE_HOLD', 'RESERVE_RELEASE',
  'MANUAL_CREDIT', 'MANUAL_DEBIT', 'PLATFORM_ABSORBED_COST',
  'AUTH_FEE_BUYER', 'AUTH_FEE_SELLER', 'AUTH_FEE_REFUND',
  'LOCAL_TRANSACTION_FEE', 'FINANCE_SUBSCRIPTION_CHARGE',
  'BUYER_REFERRAL_CREDIT_ISSUED', 'BUYER_REFERRAL_CREDIT_REDEEMED',
  'AFFILIATE_COMMISSION_PAYOUT',
  'CROSSLISTER_SALE_REVENUE', 'CROSSLISTER_PLATFORM_FEE',
  'LOCAL_FRAUD_REVERSAL', 'LOCAL_PRICE_ADJUSTMENT',
]);
export const ledgerEntryStatusEnum = pgEnum('ledger_entry_status', ['PENDING', 'POSTED', 'REVERSED']);
export const payoutStatusEnum = pgEnum('payout_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED']);
export const payoutBatchStatusEnum = pgEnum('payout_batch_status', ['CREATED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED']);
// Retained from pre-v3.2 — category.feeBucket column still exists but NOT used in TF calc. v3.2 uses progressive volume brackets.
export const feeBucketEnum = pgEnum('fee_bucket', ['ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY']);
```

### 1.10 Crosslister

```typescript
export const channelEnum = pgEnum('channel', [
  'TWICELY', 'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL'
]);
export const authMethodEnum = pgEnum('auth_method', ['OAUTH', 'API_KEY', 'SESSION']);
export const accountStatusEnum = pgEnum('account_status', ['ACTIVE', 'PAUSED', 'REVOKED', 'ERROR', 'REAUTHENTICATION_REQUIRED']);
export const channelListingStatusEnum = pgEnum('channel_listing_status', [
  'DRAFT', 'PUBLISHING', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'DELISTING', 'DELISTED', 'ERROR', 'ORPHANED', 'UNMANAGED'
]);
export const publishJobStatusEnum = pgEnum('publish_job_status', ['PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED']);
export const publishJobTypeEnum = pgEnum('publish_job_type', ['CREATE', 'UPDATE', 'DELIST', 'RELIST', 'SYNC', 'VERIFY']);
export const importBatchStatusEnum = pgEnum('import_batch_status', [
  'CREATED', 'FETCHING', 'DEDUPLICATING', 'TRANSFORMING', 'IMPORTING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED'
]);
export const pollTierEnum = pgEnum('poll_tier', ['HOT', 'WARM', 'COLD', 'LONGTAIL']);
```

### 1.11 Helpdesk & KB

```typescript
export const caseTypeEnum = pgEnum('case_type', [
  'SUPPORT', 'ORDER', 'RETURN', 'DISPUTE', 'CHARGEBACK', 'BILLING', 'ACCOUNT', 'MODERATION', 'SYSTEM'
]);
export const caseStatusEnum = pgEnum('case_status', [
  'NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED'
]);
export const casePriorityEnum = pgEnum('case_priority', ['CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW']);
export const caseChannelEnum = pgEnum('case_channel', ['WEB', 'EMAIL', 'SYSTEM', 'INTERNAL']);
export const caseMessageDirectionEnum = pgEnum('case_message_direction', ['INBOUND', 'OUTBOUND', 'INTERNAL', 'SYSTEM']);
export const caseMessageDeliveryStatusEnum = pgEnum('case_message_delivery_status', ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED']);
export const kbArticleStatusEnum = pgEnum('kb_article_status', ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']);
export const kbAudienceEnum = pgEnum('kb_audience', ['ALL', 'BUYER', 'SELLER', 'AGENT_ONLY']);
export const kbBodyFormatEnum = pgEnum('kb_body_format', ['MARKDOWN', 'HTML', 'RICHTEXT']);
```

### 1.12 Promotions & Infrastructure

```typescript
export const promotionTypeEnum = pgEnum('promotion_type', ['PERCENT_OFF', 'AMOUNT_OFF', 'FREE_SHIPPING', 'BUNDLE_DISCOUNT']);
export const promotionScopeEnum = pgEnum('promotion_scope', ['STORE_WIDE', 'CATEGORY', 'SPECIFIC_LISTINGS']);
export const auditSeverityEnum = pgEnum('audit_severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const featureFlagTypeEnum = pgEnum('feature_flag_type', ['BOOLEAN', 'PERCENTAGE', 'TARGETED']);
export const moduleStateEnum = pgEnum('module_state', ['ENABLED', 'DISABLED', 'BETA', 'DEPRECATED']);
```

### 1.13 Provider System

```typescript
export const providerAdapterSourceEnum = pgEnum('provider_adapter_source', ['BUILT_IN', 'HTTP_CUSTOM']);
export const providerServiceTypeEnum = pgEnum('provider_service_type', [
  'STORAGE', 'EMAIL', 'SEARCH', 'SMS', 'PUSH', 'PAYMENTS', 'SHIPPING', 'REALTIME', 'CACHE', 'CROSSLISTER'
]);
export const providerInstanceStatusEnum = pgEnum('provider_instance_status', ['ACTIVE', 'DISABLED', 'TESTING']);
export const affiliateTierEnum = pgEnum('affiliate_tier', ['COMMUNITY', 'INFLUENCER']);
export const affiliateStatusEnum = pgEnum('affiliate_status', [
  'PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED'
]);
export const referralStatusEnum = pgEnum('referral_status', [
  'CLICKED', 'SIGNED_UP', 'TRIALING', 'CONVERTED', 'CHURNED'
]);
export const promoCodeTypeEnum = pgEnum('promo_code_type', [
  'AFFILIATE', 'PLATFORM'
]);
export const promoDiscountTypeEnum = pgEnum('promo_discount_type', [
  'PERCENTAGE', 'FIXED'
]);
export const commissionStatusEnum = pgEnum('commission_status', [
  'PENDING', 'PAYABLE', 'PAID', 'REVERSED'
]);
export const interestSourceEnum = pgEnum('interest_source', [
  'EXPLICIT', 'PURCHASE', 'WATCHLIST', 'CLICK', 'SEARCH'
]);
export const buyerReferralStatusEnum = pgEnum('buyer_referral_status', [
  'PENDING', 'SIGNED_UP', 'REDEEMED', 'EXPIRED'
]);
```

### 1.14 Social & Discovery

```typescript
export const liveSessionStatusEnum = pgEnum('live_session_status', ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED']);
```

---

## 2. IDENTITY & AUTH

### 2.1 user

Better Auth manages core auth fields. We extend with marketplace fields via `additionalFields`.

```typescript
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
  referredByAffiliateId: text('referred_by_affiliate_id').references(() => affiliate.id),
  creditBalanceCents:   integer('credit_balance_cents').notNull().default(0),
  isBanned:            boolean('is_banned').notNull().default(false),
  bannedAt:            timestamp('banned_at', { withTimezone: true }),
  bannedReason:        text('banned_reason'),
  localFraudBannedAt:  timestamp('local_fraud_banned_at', { withTimezone: true }),
}, (table) => ({
  emailIdx:      index('usr_email').on(table.email),
  usernameIdx:   index('usr_username').on(table.username),
  isSellerIdx:   index('usr_is_seller').on(table.isSeller),
}));
```

### 2.2 session, account, verification (Better Auth Managed)

```typescript
// Created and managed by Better Auth. DO NOT manually create migrations.
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

export const verification = pgTable('verification', {
  id:          text('id').primaryKey(),
  identifier:  text('identifier').notNull(),
  value:       text('value').notNull(),
  expiresAt:   timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 2.3 sellerProfile

```typescript
export const sellerProfile = pgTable('seller_profile', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  sellerType:        sellerTypeEnum('seller_type').notNull().default('PERSONAL'),
  storeTier:         storeTierEnum('store_tier').notNull().default('NONE'),
  listerTier:        listerTierEnum('lister_tier').notNull().default('NONE'),
  bundleTier:        bundleTierEnum('bundle_tier').notNull().default('NONE'),
  hasAutomation:     boolean('has_automation').notNull().default(false),
  financeTier:        financeTierEnum('finance_tier').notNull().default('FREE'),
  isAuthenticatedSeller: boolean('is_authenticated_seller').notNull().default(false),
  maxMeetupDistanceMiles: integer('max_meetup_distance_miles'),
  payoutFrequency:    text('payout_frequency').notNull().default('WEEKLY'),
  trialListerUsed:    boolean('trial_lister_used').notNull().default(false),
  trialStoreUsed:     boolean('trial_store_used').notNull().default(false),
  trialAutomationUsed: boolean('trial_automation_used').notNull().default(false),
  trialFinanceUsed:   boolean('trial_finance_used').notNull().default(false),
  listerFreeExpiresAt: timestamp('lister_free_expires_at', { withTimezone: true }),
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
  vacationAutoReplyMessage: text('vacation_auto_reply_message'),
  stripeAccountId:   text('stripe_account_id'),       // Stripe Connect account (payouts)
  stripeCustomerId:  text('stripe_customer_id'),      // Stripe Customer (billing subscriptions)
  stripeOnboarded:   boolean('stripe_onboarded').notNull().default(false),
  trustScore:        real('trust_score').notNull().default(80),
  activatedAt:       timestamp('activated_at', { withTimezone: true }),
  verifiedAt:        timestamp('verified_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:       index('sp_user').on(table.userId),
  storeSlugIdx:  index('sp_store_slug').on(table.storeSlug),
  statusIdx:     index('sp_status').on(table.status),
  bandIdx:       index('sp_band').on(table.performanceBand),
}));
```

### 2.4 businessInfo

```typescript
export const businessInfo = pgTable('business_info', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  businessName:    text('business_name').notNull(),
  businessType:    businessTypeEnum('business_type').notNull(),
  ein:             text('ein'),          // Encrypted at application layer
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
```

### 2.5 address

```typescript
export const address = pgTable('address', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  userId:        text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  label:         text('label'),           // "Home", "Work", etc.
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
```

### 2.5b storefront

```typescript
export const storefront = pgTable('storefront', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  ownerUserId:         text('owner_user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  slug:                text('slug').unique(),
  name:                text('name'),
  bannerUrl:           text('banner_url'),
  logoUrl:             text('logo_url'),
  accentColor:         text('accent_color'),              // From 12-color preset palette
  announcement:        text('announcement'),              // One-line announcement bar (STARTER+)
  aboutHtml:           text('about_html'),                // Rich text, 2000 char limit
  socialLinksJson:     jsonb('social_links_json').notNull().default('{}'),  // { instagram, youtube, tiktok, twitter, website }
  featuredListingIds:  text('featured_listing_ids').array().notNull().default(sql`'{}'::text[]`),  // Up to 6
  defaultView:         text('default_view').notNull().default('GRID'),  // 'GRID' | 'LIST'
  returnPolicy:        text('return_policy'),             // 2000 char limit
  shippingPolicy:      text('shipping_policy'),           // 2000 char limit
  isPublished:         boolean('is_published').notNull().default(false),
  vacationMode:        boolean('vacation_mode').notNull().default(false),
  vacationMessage:     text('vacation_message'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerIdx:            index('sf_owner').on(table.ownerUserId),
  slugIdx:             index('sf_slug').on(table.slug),
  publishedIdx:        index('sf_published').on(table.isPublished),
}));
```

### 2.5c storefrontCustomCategory

```typescript
export const storefrontCustomCategory = pgTable('storefront_custom_category', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  storefrontId:    text('storefront_id').notNull().references(() => storefront.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),
  description:     text('description'),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  storefrontIdx:   index('scc_storefront').on(table.storefrontId),
  sortIdx:         index('scc_sort').on(table.storefrontId, table.sortOrder),
}));
```

### 2.5d storefrontPage

```typescript
export const storefrontPage = pgTable('storefront_page', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  storefrontId: text('storefront_id').notNull().references(() => storefront.id, { onDelete: 'cascade' }),
  slug:         text('slug').notNull(),
  title:        text('title').notNull(),
  puckData:     jsonb('puck_data').notNull(),
  isPublished:  boolean('is_published').notNull().default(false),
  sortOrder:    integer('sort_order').notNull().default(0),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  storefrontIdx: index('sfp_storefront').on(table.storefrontId),
  sortIdx:       index('sfp_sort').on(table.storefrontId, table.sortOrder),
  uniqueSlug:    uniqueIndex('sfp_unique_slug').on(table.storefrontId, table.slug),
}));
```

### 2.6 staffUser (Platform Staff — Separate from Marketplace)

```typescript
export const staffUser = pgTable('staff_user', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  email:           text('email').notNull().unique(),
  displayName:     text('display_name').notNull(),
  passwordHash:    text('password_hash').notNull(),
  mfaEnabled:      boolean('mfa_enabled').notNull().default(false),
  mfaSecret:       text('mfa_secret'),                    // Encrypted
  recoveryCodes:   text('recovery_codes'),                // Encrypted JSON array of hashed codes
  isActive:        boolean('is_active').notNull().default(true),
  lastLoginAt:     timestamp('last_login_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx:        index('su_email').on(table.email),
}));
```

### 2.7 staffUserRole

```typescript
export const staffUserRole = pgTable('staff_user_role', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  staffUserId:     text('staff_user_id').notNull().references(() => staffUser.id, { onDelete: 'cascade' }),
  role:            platformRoleEnum('role').notNull(),
  grantedByStaffId: text('granted_by_staff_id').notNull(),
  grantedAt:       timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt:       timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  staffRoleIdx:    index('sur_staff_role').on(table.staffUserId, table.role),
}));
```

### 2.8 staffSession

```typescript
export const staffSession = pgTable('staff_session', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  staffUserId:     text('staff_user_id').notNull().references(() => staffUser.id, { onDelete: 'cascade' }),
  token:           text('token').notNull().unique(),
  ipAddress:       text('ip_address'),
  userAgent:       text('user_agent'),
  mfaVerified:     boolean('mfa_verified').notNull().default(false),
  expiresAt:       timestamp('expires_at', { withTimezone: true }).notNull(),
  lastActivityAt:  timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx:        index('ss_token').on(table.token),
  staffIdx:        index('ss_staff').on(table.staffUserId),
}));
```

---

## 3. SUBSCRIPTIONS & DELEGATION

### 3.1 storeSubscription

```typescript
export const storeSubscription = pgTable('store_subscription', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:     text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  tier:                storeTierEnum('tier').notNull(),
  status:              subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId:       text('stripe_price_id'),
  currentPeriodStart:  timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:    timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:   boolean('cancel_at_period_end').notNull().default(false),
  canceledAt:          timestamp('canceled_at', { withTimezone: true }),
  trialEndsAt:         timestamp('trial_ends_at', { withTimezone: true }),
  // Pending change fields (Decision #97) — queued tier/interval change applied at period end
  pendingTier:              storeTierEnum('pending_tier'),
  pendingBillingInterval:   text('pending_billing_interval'),
  pendingChangeAt:          timestamp('pending_change_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.2 listerSubscription

```typescript
export const listerSubscription = pgTable('lister_subscription', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:     text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  tier:                listerTierEnum('tier').notNull(),
  status:              subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId:       text('stripe_price_id'),
  currentPeriodStart:  timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:    timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:   boolean('cancel_at_period_end').notNull().default(false),
  canceledAt:          timestamp('canceled_at', { withTimezone: true }),
  // Pending change fields (Decision #97) — queued tier/interval change applied at period end
  pendingTier:              listerTierEnum('pending_tier'),
  pendingBillingInterval:   text('pending_billing_interval'),
  pendingChangeAt:          timestamp('pending_change_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.3 automationSubscription

```typescript
export const automationSubscription = pgTable('automation_subscription', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:     text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
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
```

### 3.4 delegatedAccess

```typescript
export const delegatedAccess = pgTable('delegated_access', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:        text('seller_id').notNull().references(() => sellerProfile.id, { onDelete: 'cascade' }),
  userId:          text('user_id').notNull().references(() => user.id),
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
```

### 3.5 bundleSubscription

Combined Store + Crosslister bundle subscription (Decision #101).

```typescript
export const bundleSubscription = pgTable('bundle_subscription', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:       text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  stripeSubscriptionId:  text('stripe_subscription_id').unique(),
  stripePriceId:         text('stripe_price_id'),
  tier:                  bundleTierEnum('tier').notNull(),
  status:                subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  currentPeriodStart:    timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:      timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:     boolean('cancel_at_period_end').notNull().default(false),
  // Pending change fields (Decision #97)
  pendingTier:              bundleTierEnum('pending_tier'),
  pendingBillingInterval:   text('pending_billing_interval'),
  pendingChangeAt:          timestamp('pending_change_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 4. CATALOG

### 4.1 category

```typescript
export const category = pgTable('category', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  slug:            text('slug').notNull().unique(),
  parentId:        text('parent_id'),
  name:            text('name').notNull(),
  description:     text('description'),
  icon:            text('icon'),
  feeBucket:       feeBucketEnum('fee_bucket').notNull(),
  sortOrder:       integer('sort_order').notNull().default(0),
  isActive:        boolean('is_active').notNull().default(true),
  isLeaf:          boolean('is_leaf').notNull().default(false),
  depth:           integer('depth').notNull().default(0),
  path:            text('path').notNull().default(''),       // Materialized path: "electronics.phones.iphone"
  metaTitle:       text('meta_title'),
  metaDescription: text('meta_description'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdx:       index('cat_parent').on(table.parentId),
  pathIdx:         index('cat_path').on(table.path),
  activeIdx:       index('cat_active').on(table.isActive),
}));
```

### 4.2 categoryAttributeSchema

```typescript
export const categoryAttributeSchema = pgTable('category_attribute_schema', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:      text('category_id').notNull().references(() => category.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),           // "brand", "size", "color", "material"
  label:           text('label').notNull(),           // "Brand", "Size", "Color"
  fieldType:       text('field_type').notNull(),      // "text", "select", "multi_select", "number"
  isRequired:      boolean('is_required').notNull().default(false),
  isRecommended:   boolean('is_recommended').notNull().default(false),
  showInFilters:   boolean('show_in_filters').notNull().default(false),
  showInListing:   boolean('show_in_listing').notNull().default(true),
  optionsJson:     jsonb('options_json').notNull().default('[]'),  // For select/multi_select
  validationJson:  jsonb('validation_json').notNull().default('{}'),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx:     index('cas_category').on(table.categoryId),
}));
```

---

## 5. LISTINGS

### 5.1 listing

```typescript
export const listing = pgTable('listing', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  ownerUserId:           text('owner_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status:                listingStatusEnum('status').notNull().default('DRAFT'),
  title:                 text('title'),
  description:           text('description'),
  categoryId:            text('category_id').references(() => category.id),
  condition:             listingConditionEnum('condition'),
  brand:                 text('brand'),
  priceCents:            integer('price_cents'),
  originalPriceCents:    integer('original_price_cents'),
  cogsCents:             integer('cogs_cents'),              // Cost of goods (seller-only, analytics)
  currency:              text('currency').notNull().default('USD'),
  quantity:              integer('quantity').notNull().default(1),
  availableQuantity:     integer('available_quantity'),
  soldQuantity:          integer('sold_quantity').notNull().default(0),
  slug:                  text('slug').unique(),

  // Offers
  allowOffers:           boolean('allow_offers').notNull().default(false),
  autoAcceptOfferCents:  integer('auto_accept_offer_cents'),
  autoDeclineOfferCents: integer('auto_decline_offer_cents'),
  offerExpiryHours:      integer('offer_expiry_hours'),          // Seller-configured offer expiry (Feature Lock-in line 51)

  // Shipping
  shippingProfileId:     text('shipping_profile_id'),
  shippingCents:         integer('shipping_cents').notNull().default(0),
  weightOz:              integer('weight_oz'),
  lengthIn:              real('length_in'),
  widthIn:               real('width_in'),
  heightIn:              real('height_in'),
  freeShipping:          boolean('free_shipping').notNull().default(false),

  // Attributes (dynamic per category)
  attributesJson:        jsonb('attributes_json').notNull().default('{}'),
  tags:                  text('tags').array().notNull().default(sql`'{}'::text[]`),

  // Enforcement
  enforcementState:      enforcementStateEnum('enforcement_state').notNull().default('CLEAR'),

  // Deal badge (computed by market index)
  dealBadgeType:         text('deal_badge_type'),
  dealBadgeComputedAt:   timestamp('deal_badge_computed_at', { withTimezone: true }),

  // Boosting
  boostPercent:          real('boost_percent'),               // 1–8%, null = not boosted
  boostStartedAt:        timestamp('boost_started_at', { withTimezone: true }),

  // Listing lifecycle timestamps
  activatedAt:           timestamp('activated_at', { withTimezone: true }),
  pausedAt:              timestamp('paused_at', { withTimezone: true }),
  endedAt:               timestamp('ended_at', { withTimezone: true }),
  soldAt:                timestamp('sold_at', { withTimezone: true }),
  soldPriceCents:         integer('sold_price_cents'),
  expiresAt:             timestamp('expires_at', { withTimezone: true }),
  autoRenew:             boolean('auto_renew').notNull().default(true),
  fulfillmentType:       fulfillmentTypeEnum('fulfillment_type').notNull().default('SHIP_ONLY'),
  localPickupRadiusMiles: integer('local_pickup_radius_miles'),
  authenticationStatus:  authenticationStatusEnum('authentication_status').notNull().default('NONE'),
  authenticationRequestId: text('authentication_request_id'),

  // Archive (SOLD listings hidden from dashboard but kept for records, Decision #97)
  archivedAt:            timestamp('archived_at', { withTimezone: true }),

  // Import source
  importedFromChannel:   channelEnum('imported_from_channel'),
  importedExternalId:    text('imported_external_id'),

  // Video
  videoUrl:              text('video_url'),                   // R2 URL, nullable
  videoThumbUrl:         text('video_thumb_url'),             // First frame thumbnail
  videoDurationSeconds:  integer('video_duration_seconds'),   // 15-60 seconds per platform settings

  // Storefront category (seller's custom taxonomy)
  storefrontCategoryId:  text('storefront_category_id'),

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerStatusIdx:  index('lst_owner_status').on(table.ownerUserId, table.status),
  ownerCreatedIdx: index('lst_owner_created').on(table.ownerUserId, table.createdAt),
  categoryIdx:     index('lst_category').on(table.categoryId),
  statusCreatedIdx: index('lst_status_created').on(table.status, table.createdAt),
  priceIdx:        index('lst_price').on(table.priceCents),
  slugIdx:         index('lst_slug').on(table.slug),
  enforcementIdx:  index('lst_enforcement').on(table.enforcementState),
  expiresIdx:      index('lst_expires').on(table.expiresAt),
  fulfillmentIdx:  index('lst_fulfillment').on(table.fulfillmentType),
  authStatusIdx:   index('lst_auth_status').on(table.authenticationStatus),
}));
```

### 5.2 listingImage

```typescript
export const listingImage = pgTable('listing_image', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  listingId:   text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  url:         text('url').notNull(),
  position:    integer('position').notNull().default(0),
  altText:     text('alt_text'),
  isPrimary:   boolean('is_primary').notNull().default(false),
  width:       integer('width'),
  height:      integer('height'),
  sizeBytes:   integer('size_bytes'),
  blurHash:    text('blur_hash'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingPosIdx: unique().on(table.listingId, table.position),
  listingIdx:    index('li_listing').on(table.listingId),
}));
```

### 5.3 listingOffer

```typescript
export const listingOffer = pgTable('listing_offer', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  listingId:         text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  buyerId:           text('buyer_id').notNull().references(() => user.id),
  type:              offerTypeEnum('type').notNull().default('BEST_OFFER'),
  parentOfferId:     text('parent_offer_id'),
  sellerId:          text('seller_id').notNull(),
  offerCents:        integer('offer_cents').notNull(),
  currency:          text('currency').notNull().default('USD'),
  message:           text('message'),
  status:            offerStatusEnum('status').notNull().default('PENDING'),
  expiresAt:         timestamp('expires_at', { withTimezone: true }).notNull(),
  counterCount:      integer('counter_count').notNull().default(0),
  respondedAt:       timestamp('responded_at', { withTimezone: true }),
  stripeHoldId:      text('stripe_hold_id'),               // Authorization hold for prepaid offers
  counterByRole:     text('counter_by_role'),               // 'BUYER' | 'SELLER' — who initiated this counter
  shippingAddressId: text('shipping_address_id'),           // Buyer's shipping address for this offer
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingStatusIdx:  index('lo_listing_status').on(table.listingId, table.status),
  buyerStatusIdx:    index('lo_buyer_status').on(table.buyerId, table.status),
  sellerStatusIdx:   index('lo_seller_status').on(table.sellerId, table.status),
  parentOfferIdx:    index('lo_parent_offer').on(table.parentOfferId),
  expiresIdx:        index('lo_expires').on(table.expiresAt, table.status),
}));
```

### 5.3b watcherOffer

```typescript
export const watcherOffer = pgTable('watcher_offer', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  listingId:             text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:              text('seller_id').notNull().references(() => user.id),
  discountedPriceCents:  integer('discounted_price_cents').notNull(),
  currency:              text('currency').notNull().default('USD'),
  expiresAt:             timestamp('expires_at', { withTimezone: true }).notNull(),
  watchersNotifiedCount: integer('watchers_notified_count').notNull().default(0),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:            index('wo_listing').on(table.listingId),
  sellerIdx:             index('wo_seller').on(table.sellerId),
  expiresIdx:            index('wo_expires').on(table.expiresAt),
}));
```

### 5.3c offerBundleItem

```typescript
export const offerBundleItem = pgTable('offer_bundle_item', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  offerId:     text('offer_id').notNull().references(() => listingOffer.id, { onDelete: 'cascade' }),
  listingId:   text('listing_id').notNull().references(() => listing.id),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  offerIdx:    index('obi_offer').on(table.offerId),
  listingIdx:  index('obi_listing').on(table.listingId),
}));
```

### 5.4 listingFee

```typescript
export const listingFee = pgTable('listing_fee', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:        text('seller_id').notNull(),
  type:            text('type').notNull(),           // 'insertion', 'renewal'
  amountCents:     integer('amount_cents').notNull(),
  currency:        text('currency').notNull().default('USD'),
  billingPeriod:   text('billing_period'),            // '2026-02' (year-month)
  waived:          boolean('waived').notNull().default(false),
  waivedReason:    text('waived_reason'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:       index('lf_seller').on(table.sellerId, table.createdAt),
  listingIdx:      index('lf_listing').on(table.listingId),
}));
```

### 5.5 listingVersion

```typescript
export const listingVersion = pgTable('listing_version', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  version:         integer('version').notNull(),
  snapshotJson:    jsonb('snapshot_json').notNull(),
  changeReason:    text('change_reason'),
  changedByUserId: text('changed_by_user_id'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingVersionIdx: unique().on(table.listingId, table.version),
}));
```

### 5.6 shippingProfile

```typescript
export const shippingProfile = pgTable('shipping_profile', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:            text('name').notNull(),
  carrier:         text('carrier').notNull().default('USPS'),
  service:         text('service'),
  handlingTimeDays: integer('handling_time_days').notNull().default(3),
  isDefault:       boolean('is_default').notNull().default(false),
  weightOz:        integer('weight_oz'),
  lengthIn:        real('length_in'),
  widthIn:         real('width_in'),
  heightIn:        real('height_in'),
  combinedShippingMode: combinedShippingModeEnum('combined_shipping_mode').notNull().default('NONE'),
  flatCombinedCents: integer('flat_combined_cents'),
  additionalItemCents: integer('additional_item_cents'),
  autoDiscountPercent: real('auto_discount_percent'),
  autoDiscountMinItems: integer('auto_discount_min_items').default(2),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('shp_user').on(table.userId),
}));
```

---

## 6. COMMERCE

### 6.1 cart

```typescript
export const cart = pgTable('cart', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  userId:           text('user_id').references(() => user.id),
  sessionId:        text('session_id'),
  status:           cartStatusEnum('status').notNull().default('ACTIVE'),
  itemCount:        integer('item_count').notNull().default(0),
  subtotalCents:    integer('subtotal_cents').notNull().default(0),
  currency:         text('currency').notNull().default('USD'),
  expiresAt:        timestamp('expires_at', { withTimezone: true }),
  lastActivityAt:   timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  reminderSentAt:   timestamp('reminder_sent_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userActiveIdx:    uniqueIndex('cart_user_active').on(table.userId, table.status),
  sessionIdx:       index('cart_session').on(table.sessionId, table.status),
  expiresIdx:       index('cart_expires').on(table.status, table.expiresAt),
}));
```

### 6.2 cartItem

```typescript
export const cartItem = pgTable('cart_item', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  cartId:            text('cart_id').notNull().references(() => cart.id, { onDelete: 'cascade' }),
  listingId:         text('listing_id').notNull().references(() => listing.id),
  quantity:          integer('quantity').notNull().default(1),
  priceCents:        integer('price_cents').notNull(),
  currency:          text('currency').notNull().default('USD'),
  sellerId:          text('seller_id').notNull(),
  isAvailable:       boolean('is_available').notNull().default(true),
  unavailableReason: text('unavailable_reason'),
  isSavedForLater:   boolean('is_saved_for_later').notNull().default(false),
  addedAt:           timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cartListingIdx:    unique().on(table.cartId, table.listingId),
  listingIdx:        index('ci_listing').on(table.listingId),
  sellerIdx:         index('ci_seller').on(table.sellerId),
}));
```

### 6.3 order

```typescript
export const order = pgTable('order', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  orderNumber:           text('order_number').notNull().unique(),
  buyerId:               text('buyer_id').notNull().references(() => user.id),
  sellerId:              text('seller_id').notNull(),
  status:                orderStatusEnum('status').notNull().default('CREATED'),
  isLocalPickup:         boolean('is_local_pickup').notNull().default(false),
  localTransactionId:    text('local_transaction_id'),
  authenticationOffered: boolean('authentication_offered').notNull().default(false),
  authenticationDeclined: boolean('authentication_declined').notNull().default(false),
  authenticationDeclinedAt: timestamp('authentication_declined_at', { withTimezone: true }),
  authenticationRequestId: text('authentication_request_id'),
  sourceCartId:          text('source_cart_id'),
  combinedShippingQuoteId: text('combined_shipping_quote_id'),

  // Money
  itemSubtotalCents:     integer('item_subtotal_cents').notNull(),
  shippingCents:         integer('shipping_cents').notNull().default(0),
  taxCents:              integer('tax_cents').notNull().default(0),
  discountCents:         integer('discount_cents').notNull().default(0),
  totalCents:            integer('total_cents').notNull(),
  currency:              text('currency').notNull().default('USD'),

  // Shipping
  shippingAddressJson:   jsonb('shipping_address_json').notNull().default('{}'),
  shippingMethod:        text('shipping_method'),
  trackingNumber:        text('tracking_number'),
  trackingUrl:           text('tracking_url'),
  carrierCode:           text('carrier_code'),
  handlingDueDays:       integer('handling_due_days').notNull().default(3),
  handlingDueAt:         timestamp('handling_due_at', { withTimezone: true }),
  isLateShipment:        boolean('is_late_shipment').notNull().default(false),

  // Buyer note
  buyerNote:             text('buyer_note'),
  isGift:                boolean('is_gift').notNull().default(false),
  giftMessage:           text('gift_message'),

  // Stripe
  paymentIntentId:       text('payment_intent_id'),
  checkoutSessionId:     text('checkout_session_id'),

  // Cancel
  canceledByUserId:      text('canceled_by_user_id'),
  cancelInitiator:       cancelInitiatorEnum('cancel_initiator'),
  cancelReason:          text('cancel_reason'),
  cancelCountsAsDefect:  boolean('cancel_counts_as_defect').notNull().default(false),

  // Lifecycle timestamps
  paidAt:                timestamp('paid_at', { withTimezone: true }),
  shippedAt:             timestamp('shipped_at', { withTimezone: true }),
  deliveredAt:           timestamp('delivered_at', { withTimezone: true }),
  completedAt:           timestamp('completed_at', { withTimezone: true }),
  canceledAt:            timestamp('canceled_at', { withTimezone: true }),
  expectedShipByAt:      timestamp('expected_ship_by_at', { withTimezone: true }),
  expectedDeliveryAt:    timestamp('expected_delivery_at', { withTimezone: true }),

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  buyerIdx:        index('ord_buyer').on(table.buyerId, table.createdAt),
  sellerIdx:       index('ord_seller').on(table.sellerId, table.createdAt),
  statusIdx:       index('ord_status').on(table.status),
  orderNumIdx:     index('ord_number').on(table.orderNumber),
  paymentIntentIdx: index('ord_pi').on(table.paymentIntentId),
}));
```

### 6.4 orderItem

```typescript
export const orderItem = pgTable('order_item', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id, { onDelete: 'cascade' }),
  listingId:           text('listing_id').notNull().references(() => listing.id),
  listingSnapshotJson: jsonb('listing_snapshot_json').notNull().default('{}'),
  title:               text('title').notNull(),
  quantity:            integer('quantity').notNull(),
  unitPriceCents:      integer('unit_price_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),
  // Per-item TF supports partial refund calculations on multi-item orders
  tfRateBps:           integer('tf_rate_bps'),
  tfAmountCents:       integer('tf_amount_cents'),
  feeBucket:           feeBucketEnum('fee_bucket'),           // Analytics only, not used in TF calc
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:    index('oi_order').on(table.orderId),
  listingIdx:  index('oi_listing').on(table.listingId),
}));
```

### 6.5 orderPayment

```typescript
export const orderPayment = pgTable('order_payment', {
  id:                     text('id').primaryKey().$defaultFn(() => createId()),
  orderId:                text('order_id').notNull().unique().references(() => order.id, { onDelete: 'cascade' }),
  stripePaymentIntentId:  text('stripe_payment_intent_id'),
  stripeChargeId:         text('stripe_charge_id'),
  status:                 text('status').notNull().default('pending'),  // pending, captured, failed, refunded
  amountCents:            integer('amount_cents').notNull(),
  stripeFeesCents:        integer('stripe_fees_cents'),
  tfAmountCents:         integer('tf_amount_cents'),
  tfRateBps:             integer('tf_rate_bps'),
  boostFeeAmountCents:    integer('boost_fee_amount_cents'),
  boostRateBps:           integer('boost_rate_bps'),
  netToSellerCents:       integer('net_to_seller_cents'),
  currency:               text('currency').notNull().default('USD'),
  capturedAt:             timestamp('captured_at', { withTimezone: true }),
  refundedAt:             timestamp('refunded_at', { withTimezone: true }),
  refundAmountCents:      integer('refund_amount_cents'),
  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 7. SHIPPING & RETURNS

### 7.1 shipment

```typescript
export const shipment = pgTable('shipment', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().unique().references(() => order.id, { onDelete: 'cascade' }),
  carrier:             text('carrier'),
  service:             text('service'),
  tracking:            text('tracking'),
  labelUrl:            text('label_url'),
  status:              shipmentStatusEnum('status').notNull().default('PENDING'),
  shippingCostCents:   integer('shipping_cost_cents'),
  insuranceCostCents:  integer('insurance_cost_cents'),
  weightOz:            real('weight_oz'),
  lengthIn:            real('length_in'),
  widthIn:             real('width_in'),
  heightIn:            real('height_in'),
  lateShipment:        boolean('late_shipment').notNull().default(false),
  fromAddressJson:     jsonb('from_address_json').notNull().default('{}'),
  toAddressJson:       jsonb('to_address_json').notNull().default('{}'),
  trackingEventsJson:  jsonb('tracking_events_json').notNull().default('[]'),
  shippedAt:           timestamp('shipped_at', { withTimezone: true }),
  deliveredAt:         timestamp('delivered_at', { withTimezone: true }),
  expectedDeliveryAt:  timestamp('expected_delivery_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  trackingIdx: index('shp_tracking').on(table.tracking),
  statusIdx:   index('shp_status').on(table.status),
}));
```

### 7.2 returnRequest

```typescript
export const returnRequest = pgTable('return_request', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id),
  buyerId:             text('buyer_id').notNull().references(() => user.id),
  sellerId:            text('seller_id').notNull(),
  status:              returnStatusEnum('status').notNull().default('PENDING_SELLER'),
  reason:              returnReasonEnum('reason').notNull(),
  fault:               returnFaultEnum('fault'),
  bucket:              returnReasonBucketEnum('bucket'),
  refundItemCents:     integer('refund_item_cents'),
  refundShippingCents: integer('refund_shipping_cents'),
  refundTaxCents:      integer('refund_tax_cents'),
  restockingFeeCents:  integer('restocking_fee_cents'),
  feeAllocationJson:   jsonb('fee_allocation_json').notNull().default('{}'),
  description:         text('description'),
  evidencePhotos:      text('evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  sellerResponseNote:  text('seller_response_note'),
  sellerEvidencePhotos: text('seller_evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  partialRefundCents:  integer('partial_refund_cents'),
  refundAmountCents:   integer('refund_amount_cents'),

  // Return shipping
  returnTrackingNumber: text('return_tracking_number'),
  returnCarrier:       text('return_carrier'),
  returnLabelUrl:      text('return_label_url'),
  returnShippingPaidBy: text('return_shipping_paid_by'),  // 'buyer' | 'seller' | 'platform'

  sellerResponseDueAt: timestamp('seller_response_due_at', { withTimezone: true }),
  sellerRespondedAt:   timestamp('seller_responded_at', { withTimezone: true }),
  shippedAt:           timestamp('shipped_at', { withTimezone: true }),
  deliveredAt:         timestamp('delivered_at', { withTimezone: true }),
  refundedAt:          timestamp('refunded_at', { withTimezone: true }),
  escalatedAt:         timestamp('escalated_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:    index('rr_order').on(table.orderId),
  buyerIdx:    index('rr_buyer').on(table.buyerId),
  sellerIdx:   index('rr_seller').on(table.sellerId),
  statusIdx:   index('rr_status').on(table.status),
}));
```

### 7.3 dispute

```typescript
export const dispute = pgTable('dispute', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').notNull().references(() => order.id),
  buyerId:             text('buyer_id').notNull().references(() => user.id),
  sellerId:            text('seller_id').notNull(),
  returnRequestId:     text('return_request_id').references(() => returnRequest.id),
  claimType:           claimTypeEnum('claim_type').notNull(),
  status:              disputeStatusEnum('status').notNull().default('OPEN'),
  description:         text('description').notNull(),
  evidencePhotos:      text('evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  sellerResponseNote:  text('seller_response_note'),
  sellerEvidencePhotos: text('seller_evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  resolutionNote:      text('resolution_note'),
  resolutionAmountCents: integer('resolution_amount_cents'),
  resolvedByStaffId:   text('resolved_by_staff_id'),
  appealNote:          text('appeal_note'),
  appealEvidencePhotos: text('appeal_evidence_photos').array().notNull().default(sql`'{}'::text[]`),
  appealResolvedNote:  text('appeal_resolved_note'),
  deadlineAt:          timestamp('deadline_at', { withTimezone: true }),
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  appealedAt:          timestamp('appealed_at', { withTimezone: true }),
  appealResolvedAt:    timestamp('appeal_resolved_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:    index('dsp_order').on(table.orderId),
  buyerIdx:    index('dsp_buyer').on(table.buyerId),
  sellerIdx:   index('dsp_seller').on(table.sellerId),
  statusIdx:   index('dsp_status').on(table.status),
}));
```

---

## 8. REVIEWS & TRUST

### 8.1 review

```typescript
export const review = pgTable('review', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  orderId:           text('order_id').notNull().unique().references(() => order.id),
  reviewerUserId:    text('reviewer_user_id').notNull().references(() => user.id),
  sellerId:          text('seller_id').notNull(),
  rating:            integer('rating').notNull(),            // 1–5
  // Detailed Seller Ratings (DSR) — 1-5 each (Feature Lock-in lines 110-118)
  dsrItemAsDescribed: integer('dsr_item_as_described'),      // 1–5
  dsrShippingSpeed:   integer('dsr_shipping_speed'),         // 1–5
  dsrCommunication:   integer('dsr_communication'),          // 1–5
  dsrPackaging:       integer('dsr_packaging'),              // 1–5
  orderValueCents:   integer('order_value_cents'),
  hadDispute:        boolean('had_dispute').notNull().default(false),
  disputeOutcome:    text('dispute_outcome'),
  trustWeight:       real('trust_weight').notNull().default(1.0),
  trustWeightFactors: jsonb('trust_weight_factors').notNull().default('{}'),
  title:             text('title'),
  body:              text('body'),
  photos:            text('photos').array().notNull().default(sql`'{}'::text[]`),
  status:            reviewStatusEnum('status').notNull().default('APPROVED'),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(true),
  flagReason:        text('flag_reason'),
  flaggedByUserId:   text('flagged_by_user_id'),
  removedByStaffId:  text('removed_by_staff_id'),
  removedReason:     text('removed_reason'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:     index('rev_seller').on(table.sellerId, table.createdAt),
  reviewerIdx:   index('rev_reviewer').on(table.reviewerUserId),
  ratingIdx:     index('rev_rating').on(table.sellerId, table.rating),
  statusIdx:     index('rev_status').on(table.status),
}));
```

### 8.2 reviewResponse

```typescript
export const reviewResponse = pgTable('review_response', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  reviewId:        text('review_id').notNull().unique().references(() => review.id, { onDelete: 'cascade' }),
  sellerId:        text('seller_id').notNull(),
  body:            text('body').notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.3 sellerPerformance

Cached aggregates for seller performance — rebuilt from orders, reviews, returns, disputes.

```typescript
export const sellerPerformance = pgTable('seller_performance', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:       text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  totalOrders:           integer('total_orders').notNull().default(0),
  completedOrders:       integer('completed_orders').notNull().default(0),
  canceledOrders:        integer('canceled_orders').notNull().default(0),
  totalReviews:          integer('total_reviews').notNull().default(0),
  averageRating:         real('average_rating'),
  lateShipmentRate:      real('late_shipment_rate').notNull().default(0),
  cancelRate:            real('cancel_rate').notNull().default(0),
  returnRate:            real('return_rate').notNull().default(0),
  onTimeShippingPct:     real('on_time_shipping_pct'),
  avgResponseTimeHours:  real('avg_response_time_hours'),
  trustBadge:            text('trust_badge'),
  trustBadgeSecondary:   text('trust_badge_secondary'),
  displayStars:          real('display_stars'),
  showStars:             boolean('show_stars').notNull().default(true),
  defectRate:            real('defect_rate').notNull().default(0),
  inadRate:              real('inad_rate').notNull().default(0),
  chargebackRate:        real('chargeback_rate').notNull().default(0),
  responseTimeMinutes:   real('response_time_minutes'),
  currentBand:           performanceBandEnum('current_band').notNull().default('EMERGING'),
  bandLastEvaluatedAt:   timestamp('band_last_evaluated_at', { withTimezone: true }),
  periodStart:           timestamp('period_start', { withTimezone: true }),
  periodEnd:             timestamp('period_end', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 8.4 buyerReview

Sellers rate buyers after completed orders. Dual-blind: neither party sees the other's review until both submit (or window closes). The `note` field is private — never shown to the buyer.

```typescript
export const buyerReview = pgTable('buyer_review', {
  id:                      text('id').primaryKey().$defaultFn(() => createId()),
  orderId:                 text('order_id').notNull().unique(),
  sellerUserId:            text('seller_user_id').notNull().references(() => user.id),
  buyerUserId:             text('buyer_user_id').notNull().references(() => user.id),
  ratingPayment:           integer('rating_payment').notNull(),           // 1-5 stars
  ratingCommunication:     integer('rating_communication').notNull(),     // 1-5 stars
  ratingReturnBehavior:    integer('rating_return_behavior'),             // 1-5 stars, nullable (only if return occurred)
  overallRating:           integer('overall_rating').notNull(),           // Computed average
  note:                    text('note'),                                  // Private — never shown to buyer
  status:                  reviewStatusEnum('status').notNull().default('APPROVED'),
  visibleAt:               timestamp('visible_at', { withTimezone: true }), // Dual-blind gate
  createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  buyerIdx:                index('br_buyer').on(table.buyerUserId),
  sellerIdx:               index('br_seller').on(table.sellerUserId),
  orderIdx:                index('br_order').on(table.orderId),
}));
```

---

## 9. MESSAGING

### 9.1 conversation

```typescript
export const conversation = pgTable('conversation', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').references(() => listing.id),
  orderId:         text('order_id').references(() => order.id),
  buyerId:         text('buyer_id').notNull().references(() => user.id),
  sellerId:        text('seller_id').notNull(),
  subject:         text('subject'),
  status:          conversationStatusEnum('status').notNull().default('OPEN'),
  lastMessageAt:   timestamp('last_message_at', { withTimezone: true }),
  buyerUnreadCount: integer('buyer_unread_count').notNull().default(0),
  sellerUnreadCount: integer('seller_unread_count').notNull().default(0),
  isFlagged:       boolean('is_flagged').notNull().default(false),
  flagReason:      text('flag_reason'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  buyerIdx:        index('conv_buyer').on(table.buyerId, table.lastMessageAt),
  sellerIdx:       index('conv_seller').on(table.sellerId, table.lastMessageAt),
  listingIdx:      index('conv_listing').on(table.listingId),
  orderIdx:        index('conv_order').on(table.orderId),
}));
```

### 9.2 message

```typescript
export const message = pgTable('message', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  conversationId:  text('conversation_id').notNull().references(() => conversation.id, { onDelete: 'cascade' }),
  senderUserId:    text('sender_user_id').notNull().references(() => user.id),
  body:            text('body').notNull(),
  attachments:     text('attachments').array().notNull().default(sql`'{}'::text[]`),
  isRead:          boolean('is_read').notNull().default(false),
  readAt:          timestamp('read_at', { withTimezone: true }),
  isAutoGenerated: boolean('is_auto_generated').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  conversationIdx: index('msg_conversation').on(table.conversationId, table.createdAt),
}));
```

---

## 10. NOTIFICATIONS

### 10.1 notification

```typescript
export const notification = pgTable('notification', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  channel:         notificationChannelEnum('channel').notNull(),
  priority:        notificationPriorityEnum('priority').notNull().default('NORMAL'),
  templateKey:     text('template_key').notNull(),
  subject:         text('subject'),
  body:            text('body').notNull(),
  dataJson:        jsonb('data_json').notNull().default('{}'),
  isRead:          boolean('is_read').notNull().default(false),
  readAt:          timestamp('read_at', { withTimezone: true }),
  sentAt:          timestamp('sent_at', { withTimezone: true }),
  failedAt:        timestamp('failed_at', { withTimezone: true }),
  failureReason:   text('failure_reason'),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userChannelIdx:  index('notif_user_channel').on(table.userId, table.channel, table.isRead),
  userCreatedIdx:  index('notif_user_created').on(table.userId, table.createdAt),
  templateIdx:     index('notif_template').on(table.templateKey),
}));
```

### 10.2 notificationPreference

```typescript
export const notificationPreference = pgTable('notification_preference', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  templateKey:     text('template_key').notNull(),
  email:           boolean('email').notNull().default(true),
  push:            boolean('push').notNull().default(true),
  inApp:           boolean('in_app').notNull().default(true),
  sms:             boolean('sms').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userTemplateIdx: unique().on(table.userId, table.templateKey),
}));
```

### 10.3 notificationSetting

Per Feature Lock-In Section 27: digest config, quiet hours, seller-specific alert thresholds.
One row per user (global settings, not per-template).

```typescript
export const notificationSetting = pgTable('notification_setting', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }).unique(),
  digestFrequency:   text('digest_frequency').notNull().default('daily'),     // 'daily' | 'weekly'
  digestTimeUtc:     text('digest_time_utc').notNull().default('14:00'),      // HH:MM in UTC
  timezone:          text('timezone').notNull().default('America/New_York'),
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
  quietHoursStart:   text('quiet_hours_start'),                               // HH:MM local time
  quietHoursEnd:     text('quiet_hours_end'),                                 // HH:MM local time
  dailySalesSummary: boolean('daily_sales_summary').notNull().default(false), // Seller-only
  staleListingDays:  integer('stale_listing_days'),                           // null = disabled
  trustScoreAlerts:  boolean('trust_score_alerts').notNull().default(false),  // Seller-only
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 10.4 notificationTemplate

```typescript
export const notificationTemplate = pgTable('notification_template', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  key:             text('key').notNull().unique(),
  name:            text('name').notNull(),
  description:     text('description'),
  category:        text('category').notNull(),             // 'order', 'listing', 'offer', 'account', 'marketing'
  subjectTemplate: text('subject_template'),
  bodyTemplate:    text('body_template').notNull(),
  htmlTemplate:    text('html_template'),
  channels:        text('channels').array().notNull().default(sql`'{}'::text[]`),
  isSystemOnly:    boolean('is_system_only').notNull().default(false),
  isActive:        boolean('is_active').notNull().default(true),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 11. FINANCE

Reference: Finance Engine Canonical §4–§10.

### 11.1 ledgerEntry

```typescript
export const ledgerEntry = pgTable('ledger_entry', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  type:                ledgerEntryTypeEnum('type').notNull(),
  status:              ledgerEntryStatusEnum('status').notNull().default('PENDING'),
  amountCents:         integer('amount_cents').notNull(),     // Signed: positive = credit to seller, negative = debit
  currency:            text('currency').notNull().default('USD'),

  // Ownership
  userId:              text('user_id').references(() => user.id),

  // Context references
  orderId:             text('order_id').references(() => order.id),
  listingId:           text('listing_id').references(() => listing.id),
  channel:             channelEnum('channel'),

  // Stripe correlation
  stripeEventId:       text('stripe_event_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeTransferId:    text('stripe_transfer_id'),
  stripeChargeId:      text('stripe_charge_id'),
  stripeRefundId:      text('stripe_refund_id'),
  stripeDisputeId:     text('stripe_dispute_id'),

  // Reversal tracking
  reversalOfEntryId:   text('reversal_of_entry_id'),

  // Admin
  createdByStaffId:    text('created_by_staff_id'),
  reasonCode:          text('reason_code'),
  memo:                text('memo'),

  postedAt:            timestamp('posted_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userTypeIdx:         index('le_user_type').on(table.userId, table.type),
  userCreatedIdx:      index('le_user_created').on(table.userId, table.createdAt),
  orderIdx:            index('le_order').on(table.orderId),
  stripeEventIdx:      index('le_stripe_event').on(table.stripeEventId),
  statusIdx:           index('le_status').on(table.status),
  reversalIdx:         index('le_reversal').on(table.reversalOfEntryId),
}));
```

**IMMUTABLE:** Database trigger rejects UPDATE and DELETE on this table.

### 11.2 sellerBalance

```typescript
export const sellerBalance = pgTable('seller_balance', {
  userId:              text('user_id').primaryKey().references(() => user.id),
  pendingCents:        integer('pending_cents').notNull().default(0),
  availableCents:      integer('available_cents').notNull().default(0),
  reservedCents:       integer('reserved_cents').notNull().default(0),
  lastLedgerEntryId:   text('last_ledger_entry_id'),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 11.3 payoutBatch

```typescript
export const payoutBatch = pgTable('payout_batch', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  status:              payoutBatchStatusEnum('status').notNull().default('CREATED'),
  totalSellers:        integer('total_sellers').notNull().default(0),
  processedSellers:    integer('processed_sellers').notNull().default(0),
  successCount:        integer('success_count').notNull().default(0),
  failureCount:        integer('failure_count').notNull().default(0),
  totalAmountCents:    integer('total_amount_cents').notNull().default(0),
  triggeredByStaffId:  text('triggered_by_staff_id'),
  isAutomatic:         boolean('is_automatic').notNull().default(true),
  startedAt:           timestamp('started_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 11.4 payout

```typescript
export const payout = pgTable('payout', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id),
  batchId:             text('batch_id').references(() => payoutBatch.id),
  status:              payoutStatusEnum('status').notNull().default('PENDING'),
  amountCents:         integer('amount_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),
  stripeTransferId:    text('stripe_transfer_id'),
  stripePayoutId:      text('stripe_payout_id'),
  failureReason:       text('failure_reason'),
  isOnDemand:          boolean('is_on_demand').notNull().default(false),
  initiatedAt:         timestamp('initiated_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  failedAt:            timestamp('failed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('po_user').on(table.userId, table.createdAt),
  batchIdx:        index('po_batch').on(table.batchId),
  statusIdx:       index('po_status').on(table.status),
}));
```

### 11.5 feeSchedule

```typescript
export const feeSchedule = pgTable('fee_schedule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  feeBucket:           feeBucketEnum('fee_bucket').notNull(),
  tfRateBps:          integer('tf_rate_bps').notNull(),
  insertionFeeCents:   integer('insertion_fee_cents').notNull(),
  effectiveAt:         timestamp('effective_at', { withTimezone: true }).notNull(),
  expiresAt:           timestamp('expires_at', { withTimezone: true }),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  bucketEffectiveIdx:  index('fs_bucket_effective').on(table.feeBucket, table.effectiveAt),
}));
```

### 11.6 reconciliationReport

```typescript
export const reconciliationReport = pgTable('reconciliation_report', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  periodStart:         timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:           timestamp('period_end', { withTimezone: true }).notNull(),
  status:              text('status').notNull().default('running'),  // running, clean, discrepancies, failed
  totalEntriesChecked: integer('total_entries_checked').notNull().default(0),
  discrepancyCount:    integer('discrepancy_count').notNull().default(0),
  discrepanciesJson:   jsonb('discrepancies_json').notNull().default('[]'),
  summaryJson:         jsonb('summary_json').notNull().default('{}'),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 11.7 manualAdjustment

```typescript
export const manualAdjustment = pgTable('manual_adjustment', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id),
  ledgerEntryId:       text('ledger_entry_id').notNull().references(() => ledgerEntry.id),
  type:                text('type').notNull(),               // 'credit' | 'debit'
  amountCents:         integer('amount_cents').notNull(),
  reasonCode:          text('reason_code').notNull(),
  memo:                text('memo').notNull(),
  approvedByStaffId:   text('approved_by_staff_id').notNull(),
  mfaVerifiedAt:       timestamp('mfa_verified_at', { withTimezone: true }).notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 12. CROSSLISTER

Reference: Lister Canonical §5.

### 12.1 crosslisterAccount

```typescript
export const crosslisterAccount = pgTable('crosslister_account', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  channel:             channelEnum('channel').notNull(),
  externalAccountId:   text('external_account_id'),
  externalUsername:    text('external_username'),

  // Auth
  authMethod:          authMethodEnum('auth_method').notNull(),
  accessToken:         text('access_token'),                // Encrypted at rest
  refreshToken:        text('refresh_token'),               // Encrypted at rest
  sessionData:         jsonb('session_data'),                // Encrypted — Tier C connectors
  tokenExpiresAt:      timestamp('token_expires_at', { withTimezone: true }),
  lastAuthAt:          timestamp('last_auth_at', { withTimezone: true }),

  // Status
  status:              accountStatusEnum('account_status').notNull().default('ACTIVE'),
  lastSyncAt:          timestamp('last_sync_at', { withTimezone: true }),
  lastErrorAt:         timestamp('last_error_at', { withTimezone: true }),
  lastError:           text('last_error'),
  consecutiveErrors:   integer('consecutive_errors').notNull().default(0),

  // Capabilities (set by connector at auth time)
  capabilities:        jsonb('capabilities').notNull().default('{}'),

  // Import tracking
  firstImportCompletedAt: timestamp('first_import_completed_at', { withTimezone: true }),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerChannelIdx:    unique().on(table.sellerId, table.channel),
  statusIdx:           index('ca_status').on(table.status),
}));
```

### 12.2 channelProjection

```typescript
export const channelProjection = pgTable('channel_projection', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  accountId:           text('account_id').notNull().references(() => crosslisterAccount.id),
  channel:             channelEnum('channel').notNull(),
  sellerId:            text('seller_id').notNull(),

  // External identity
  externalId:          text('external_id'),
  externalUrl:         text('external_url'),
  status:              channelListingStatusEnum('status').notNull().default('DRAFT'),
  source:              text('source').notNull().default('MANUAL'), // MANUAL | IMPORT | AUTO_DETECTED

  // Overrides (per-platform deviations from canonical)
  overridesJson:       jsonb('overrides_json').notNull().default('{}'),
  platformDataJson:    jsonb('platform_data_json').notNull().default('{}'),

  // Sync tracking
  syncEnabled:         boolean('sync_enabled').notNull().default(true),
  lastCanonicalHash:   text('last_canonical_hash'),
  hasPendingSync:      boolean('has_pending_sync').notNull().default(false),
  externalDiff:        jsonb('external_diff'),

  // Publish attempts
  publishAttempts:     integer('publish_attempts').notNull().default(0),
  lastPublishError:    text('last_publish_error'),

  // Polling engine (§13 adaptive polling)
  pollTier:            pollTierEnum('poll_tier').notNull().default('COLD'),
  nextPollAt:          timestamp('next_poll_at', { withTimezone: true }),
  lastPolledAt:        timestamp('last_polled_at', { withTimezone: true }),
  prePollTier:         pollTierEnum('pre_poll_tier'),

  // Lifecycle (Decision #112)
  orphanedAt:          timestamp('orphaned_at', { withTimezone: true }),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingAccountIdx:   unique().on(table.listingId, table.accountId, table.channel),
  externalUnique:      uniqueIndex('uq_projection_external').on(table.sellerId, table.channel, table.externalId),
  sellerChannelIdx:    index('cp_seller_channel').on(table.sellerId, table.channel),
  statusIdx:           index('cp_status').on(table.status),
  syncIdx:             index('cp_pending_sync').on(table.hasPendingSync),
  nextPollIdx:         index('cp_next_poll').on(table.nextPollAt),
}));
```

### 12.3 crossJob

```typescript
export const crossJob = pgTable('cross_job', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id),
  projectionId:        text('projection_id').references(() => channelProjection.id),
  accountId:           text('account_id').references(() => crosslisterAccount.id),

  jobType:             publishJobTypeEnum('job_type').notNull(),
  priority:            integer('priority').notNull().default(500),
  idempotencyKey:      text('idempotency_key').notNull().unique(),

  status:              publishJobStatusEnum('status').notNull().default('PENDING'),
  scheduledFor:        timestamp('scheduled_for', { withTimezone: true }),
  startedAt:           timestamp('started_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  attempts:            integer('attempts').notNull().default(0),
  maxAttempts:         integer('max_attempts').notNull().default(3),
  lastError:           text('last_error'),

  payload:             jsonb('payload').notNull(),
  result:              jsonb('result'),
  bullmqJobId:         text('bullmq_job_id'),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerTypeIdx:       index('cj_seller_type').on(table.sellerId, table.jobType),
  statusPriorityIdx:   index('cj_status_priority').on(table.status, table.priority),
  scheduledIdx:        index('cj_scheduled').on(table.scheduledFor),
  idempotencyIdx:      index('cj_idempotency').on(table.idempotencyKey),
}));
```

### 12.4 importBatch

```typescript
export const importBatch = pgTable('import_batch', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id),
  accountId:           text('account_id').notNull().references(() => crosslisterAccount.id),
  channel:             channelEnum('channel').notNull(),
  status:              importBatchStatusEnum('status').notNull().default('CREATED'),

  // Counts
  totalItems:          integer('total_items').notNull().default(0),
  processedItems:      integer('processed_items').notNull().default(0),
  createdItems:        integer('created_items').notNull().default(0),
  deduplicatedItems:   integer('deduplicated_items').notNull().default(0),
  failedItems:         integer('failed_items').notNull().default(0),
  skippedItems:        integer('skipped_items').notNull().default(0),

  isFirstImport:       boolean('is_first_import').notNull(),
  startedAt:           timestamp('started_at', { withTimezone: true }),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  errorSummaryJson:    jsonb('error_summary_json').notNull().default('[]'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerChannelIdx:    index('ib_seller_channel').on(table.sellerId, table.channel),
  statusIdx:           index('ib_status').on(table.status),
}));
```

### 12.5 importRecord

```typescript
export const importRecord = pgTable('import_record', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  batchId:             text('batch_id').notNull().references(() => importBatch.id, { onDelete: 'cascade' }),
  externalId:          text('external_id').notNull(),
  channel:             channelEnum('channel').notNull(),
  status:              text('status').notNull().default('pending'),  // pending, created, deduplicated, failed, skipped
  listingId:           text('listing_id').references(() => listing.id),
  rawDataJson:         jsonb('raw_data_json').notNull().default('{}'),
  normalizedDataJson:  jsonb('normalized_data_json'),
  errorMessage:        text('error_message'),
  dedupeMatchListingId: text('dedupe_match_listing_id'),
  dedupeConfidence:    real('dedupe_confidence'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  batchIdx:            index('ir_batch').on(table.batchId),
  externalIdx:         index('ir_external').on(table.channel, table.externalId),
}));
```

### 12.6 dedupeFingerprint

```typescript
export const dedupeFingerprint = pgTable('dedupe_fingerprint', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:            text('seller_id').notNull(),
  titleHash:           text('title_hash').notNull(),
  imageHash:           text('image_hash'),
  priceRange:          text('price_range'),                  // Bucketed: "10-20", "20-50", etc.
  compositeHash:       text('composite_hash').notNull(),     // Combined fingerprint for matching
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerCompositeIdx:  index('df_seller_composite').on(table.sellerId, table.compositeHash),
  listingIdx:          index('df_listing').on(table.listingId),
}));
```

### 12.7 channelCategoryMapping

```typescript
export const channelCategoryMapping = pgTable('channel_category_mapping', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  channel:             channelEnum('channel').notNull(),
  twicelyCategoryId:   text('twicely_category_id').notNull().references(() => category.id),
  externalCategoryId:  text('external_category_id').notNull(),
  externalCategoryName: text('external_category_name').notNull(),
  confidence:          real('confidence').notNull().default(1.0),
  isVerified:          boolean('is_verified').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelCatIdx:       unique().on(table.channel, table.twicelyCategoryId),
}));
```

### 12.8 channelPolicyRule

```typescript
export const channelPolicyRule = pgTable('channel_policy_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  channel:             channelEnum('channel').notNull(),
  field:               text('field').notNull(),               // 'title', 'description', 'images', etc.
  constraintJson:      jsonb('constraint_json').notNull(),
  guidance:            text('guidance'),
  severity:            text('severity').notNull().default('WARN'),  // 'BLOCK' | 'WARN'
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelFieldIdx:     index('cpr_channel_field').on(table.channel, table.field),
}));
```

### 12.9 automationSetting

```typescript
export const automationSetting = pgTable('automation_setting', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),

  // Auto-relist
  autoRelistEnabled:   boolean('auto_relist_enabled').notNull().default(false),
  autoRelistDays:      integer('auto_relist_days').notNull().default(30),
  autoRelistChannels:  text('auto_relist_channels').array().notNull().default(sql`'{}'::text[]`),

  // Offer-to-likers
  offerToLikersEnabled: boolean('offer_to_likers_enabled').notNull().default(false),
  offerDiscountPercent: integer('offer_discount_percent').notNull().default(10),
  offerMinDaysListed:  integer('offer_min_days_listed').notNull().default(7),

  // Smart price drops
  priceDropEnabled:    boolean('price_drop_enabled').notNull().default(false),
  priceDropPercent:    integer('price_drop_percent').notNull().default(5),
  priceDropIntervalDays: integer('price_drop_interval_days').notNull().default(14),
  priceDropFloorPercent: integer('price_drop_floor_percent').notNull().default(50),

  // Posh sharing
  poshShareEnabled:    boolean('posh_share_enabled').notNull().default(false),
  poshShareTimesPerDay: integer('posh_share_times_per_day').notNull().default(3),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 12.10 publishCreditLedger

FIFO credit tracking for Crosslister publish allowances. Each row is a credit bucket (monthly allocation, overage pack, or bonus). Credits consumed FIFO by `expiresAt`.

```typescript
export const publishCreditLedger = pgTable('publish_credit_ledger', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  userId:               text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  creditType:           creditTypeEnum('credit_type').notNull(),    // MONTHLY | OVERAGE | BONUS
  totalCredits:         integer('total_credits').notNull(),
  usedCredits:          integer('used_credits').notNull().default(0),
  expiresAt:            timestamp('expires_at', { withTimezone: true }).notNull(),
  periodStart:          timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:            timestamp('period_end', { withTimezone: true }).notNull(),
  listerSubscriptionId: text('lister_subscription_id').references(() => listerSubscription.id),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userExpiresIdx: index('pcl_user_expires').on(table.userId, table.expiresAt),
  subIdx:         index('pcl_sub').on(table.listerSubscriptionId),
}));
```

Remaining credits: `totalCredits - usedCredits`. Rollover: expired buckets with remaining credits create new MONTHLY buckets (capped by `crosslister.rolloverMaxMultiplier`).

---

## 13. HELPDESK & KNOWLEDGE BASE

Reference: Helpdesk Canonical §25. All 18 tables.

### 13.1 helpdeskCase

```typescript
export const helpdeskCase = pgTable('helpdesk_case', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseNumber:          text('case_number').notNull().unique(),
  type:                caseTypeEnum('type').notNull(),
  channel:             caseChannelEnum('channel').notNull().default('WEB'),
  subject:             text('subject').notNull(),
  description:         text('description'),
  status:              caseStatusEnum('status').notNull().default('NEW'),
  priority:            casePriorityEnum('priority').notNull().default('NORMAL'),

  // Requester
  requesterId:         text('requester_id').notNull(),
  requesterEmail:      text('requester_email'),
  requesterType:       text('requester_type').notNull().default('buyer'),

  // Assignment
  assignedTeamId:      text('assigned_team_id'),
  assignedAgentId:     text('assigned_agent_id'),

  // Commerce context
  orderId:             text('order_id'),
  listingId:           text('listing_id'),
  sellerId:            text('seller_id'),
  payoutId:            text('payout_id'),
  disputeCaseId:       text('dispute_case_id'),
  returnRequestId:     text('return_request_id'),
  conversationId:      text('conversation_id'),

  // Classification
  category:            text('category'),
  subcategory:         text('subcategory'),
  tags:                text('tags').array().notNull().default(sql`'{}'::text[]`),

  // SLA
  slaFirstResponseDueAt: timestamp('sla_first_response_due_at', { withTimezone: true }),
  slaResolutionDueAt: timestamp('sla_resolution_due_at', { withTimezone: true }),
  slaFirstResponseBreached: boolean('sla_first_response_breached').notNull().default(false),
  slaResolutionBreached: boolean('sla_resolution_breached').notNull().default(false),
  firstResponseAt:     timestamp('first_response_at', { withTimezone: true }),

  // Merge tracking (§28)
  mergedIntoCaseId:    text('merged_into_case_id'),

  // Lifecycle
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  closedAt:            timestamp('closed_at', { withTimezone: true }),
  reopenedAt:          timestamp('reopened_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  requesterIdx:      index('hdc_requester').on(table.requesterId),
  statusIdx:         index('hdc_status').on(table.status),
  agentIdx:          index('hdc_agent').on(table.assignedAgentId),
  teamIdx:           index('hdc_team').on(table.assignedTeamId),
  orderIdx:          index('hdc_order').on(table.orderId),
  slaResponseIdx:    index('hdc_sla_response').on(table.slaFirstResponseDueAt),
  mergedIntoIdx:     index('hdc_merged_into').on(table.mergedIntoCaseId),
}));
```

### 13.2 caseMessage

```typescript
export const caseMessage = pgTable('case_message', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  senderType:          text('sender_type').notNull(),         // 'user' | 'agent' | 'system'
  senderId:            text('sender_id'),
  senderName:          text('sender_name'),
  direction:           caseMessageDirectionEnum('direction').notNull(),
  body:                text('body').notNull(),
  bodyHtml:            text('body_html'),
  attachments:         jsonb('attachments').notNull().default('[]'),
  deliveryStatus:      caseMessageDeliveryStatusEnum('delivery_status').notNull().default('SENT'),
  emailMessageId:      text('email_message_id'),
  fromMergedCaseId:    text('from_merged_case_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseIdx:             index('cm_case').on(table.caseId, table.createdAt),
}));
```

### 13.3 caseEvent

```typescript
export const caseEvent = pgTable('case_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  eventType:           text('event_type').notNull(),
  actorType:           text('actor_type').notNull(),          // 'user' | 'agent' | 'system' | 'automation'
  actorId:             text('actor_id'),
  dataJson:            jsonb('data_json').notNull().default('{}'),
  fromMergedCaseId:    text('from_merged_case_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseIdx:             index('ce_case').on(table.caseId, table.createdAt),
}));
```

### 13.4 caseWatcher

```typescript
export const caseWatcher = pgTable('case_watcher', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  staffUserId:         text('staff_user_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseStaffIdx:        unique().on(table.caseId, table.staffUserId),
}));
```

### 13.5 caseCsat

```typescript
export const caseCsat = pgTable('case_csat', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().unique().references(() => helpdeskCase.id),
  userId:              text('user_id').notNull(),
  rating:              integer('rating').notNull(),            // 1–5
  comment:             text('comment'),
  surveyRequestedAt:   timestamp('survey_requested_at', { withTimezone: true }).notNull(),
  respondedAt:         timestamp('responded_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.6 helpdeskTeam

```typescript
export const helpdeskTeam = pgTable('helpdesk_team', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull().unique(),
  description:         text('description'),
  isDefault:           boolean('is_default').notNull().default(false),
  maxConcurrentCases:  integer('max_concurrent_cases').notNull().default(25),
  roundRobinEnabled:   boolean('round_robin_enabled').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.7 helpdeskTeamMember

```typescript
export const helpdeskTeamMember = pgTable('helpdesk_team_member', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  teamId:              text('team_id').notNull().references(() => helpdeskTeam.id, { onDelete: 'cascade' }),
  staffUserId:         text('staff_user_id').notNull(),
  isAvailable:         boolean('is_available').notNull().default(true),
  activeCaseCount:     integer('active_case_count').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  teamStaffIdx:        unique().on(table.teamId, table.staffUserId),
}));
```

### 13.8 helpdeskRoutingRule

```typescript
export const helpdeskRoutingRule = pgTable('helpdesk_routing_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  conditionsJson:      jsonb('conditions_json').notNull(),
  actionsJson:         jsonb('actions_json').notNull(),
  sortOrder:           integer('sort_order').notNull().default(0),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.9 helpdeskMacro

```typescript
export const helpdeskMacro = pgTable('helpdesk_macro', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  description:         text('description'),
  bodyTemplate:        text('body_template').notNull(),
  actionsJson:         jsonb('actions_json').notNull().default('[]'),
  isShared:            boolean('is_shared').notNull().default(true),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  usageCount:          integer('usage_count').notNull().default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.10 helpdeskSlaPolicy

```typescript
export const helpdeskSlaPolicy = pgTable('helpdesk_sla_policy', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  priority:            casePriorityEnum('priority').notNull().unique(),
  firstResponseMinutes: integer('first_response_minutes').notNull(),
  resolutionMinutes:   integer('resolution_minutes').notNull(),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.11 helpdeskAutomationRule

```typescript
export const helpdeskAutomationRule = pgTable('helpdesk_automation_rule', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  triggerEvent:        text('trigger_event').notNull(),
  conditionsJson:      jsonb('conditions_json').notNull().default('[]'),
  actionsJson:         jsonb('actions_json').notNull(),
  sortOrder:           integer('sort_order').notNull().default(0),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.12 helpdeskSavedView

```typescript
export const helpdeskSavedView = pgTable('helpdesk_saved_view', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull(),
  staffUserId:         text('staff_user_id'),                 // null = shared view
  filtersJson:         jsonb('filters_json').notNull(),
  sortJson:            jsonb('sort_json').notNull().default('{}'),
  isDefault:           boolean('is_default').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.13 helpdeskEmailConfig

```typescript
export const helpdeskEmailConfig = pgTable('helpdesk_email_config', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  fromName:            text('from_name').notNull().default('Twicely Support'),
  fromEmail:           text('from_email').notNull().default('support@twicely.co'),
  replyToPattern:      text('reply_to_pattern').notNull().default('case+{caseId}@support.twicely.co'),
  signatureHtml:       text('signature_html'),
  autoReplyEnabled:    boolean('auto_reply_enabled').notNull().default(true),
  autoReplyTemplateKey: text('auto_reply_template_key').notNull().default('helpdesk.case.auto_reply'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 13.14 kbCategory

```typescript
export const kbCategory = pgTable('kb_category', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  slug:                text('slug').notNull().unique(),
  parentId:            text('parent_id'),
  name:                text('name').notNull(),
  description:         text('description'),
  icon:                text('icon'),
  sortOrder:           integer('sort_order').notNull().default(0),
  isActive:            boolean('is_active').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentIdx:           index('kbc_parent').on(table.parentId),
}));
```

### 13.15 kbArticle

```typescript
export const kbArticle = pgTable('kb_article', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:          text('category_id').references(() => kbCategory.id),
  slug:                text('slug').notNull().unique(),
  title:               text('title').notNull(),
  excerpt:             text('excerpt'),
  body:                text('body').notNull(),
  bodyFormat:          kbBodyFormatEnum('body_format').notNull().default('MARKDOWN'),
  status:              kbArticleStatusEnum('status').notNull().default('DRAFT'),
  audience:            kbAudienceEnum('audience').notNull().default('ALL'),
  authorStaffId:       text('author_staff_id').notNull(),
  tags:                text('tags').array().notNull().default(sql`'{}'::text[]`),
  searchKeywords:      text('search_keywords').array().notNull().default(sql`'{}'::text[]`),
  metaTitle:           text('meta_title'),
  metaDescription:     text('meta_description'),
  isFeatured:          boolean('is_featured').notNull().default(false),
  isPinned:            boolean('is_pinned').notNull().default(false),
  viewCount:           integer('view_count').notNull().default(0),
  helpfulYes:          integer('helpful_yes').notNull().default(0),
  helpfulNo:           integer('helpful_no').notNull().default(0),
  version:             integer('version').notNull().default(1),
  publishedAt:         timestamp('published_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx:         index('kba_category').on(table.categoryId),
  statusIdx:           index('kba_status').on(table.status),
  audienceIdx:         index('kba_audience').on(table.audience),
}));
```

### 13.16 kbArticleAttachment

```typescript
export const kbArticleAttachment = pgTable('kb_article_attachment', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  url:                 text('url').notNull(),
  filename:            text('filename').notNull(),
  mimeType:            text('mime_type').notNull(),
  sizeBytes:           integer('size_bytes').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleIdx:          index('kbaa_article').on(table.articleId),
}));
```

### 13.17 kbArticleRelation

```typescript
export const kbArticleRelation = pgTable('kb_article_relation', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  relatedArticleId:    text('related_article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articlePairIdx:      unique().on(table.articleId, table.relatedArticleId),
}));
```

### 13.18 kbCaseArticleLink

```typescript
export const kbCaseArticleLink = pgTable('kb_case_article_link', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  caseId:              text('case_id').notNull().references(() => helpdeskCase.id, { onDelete: 'cascade' }),
  articleId:           text('article_id').notNull().references(() => kbArticle.id),
  linkedByStaffId:     text('linked_by_staff_id').notNull(),
  sentToCustomer:      boolean('sent_to_customer').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  caseIdx:             index('kcal_case').on(table.caseId),
  articleIdx:          index('kcal_article').on(table.articleId),
}));
```

### 13.19 kbArticleFeedback

```typescript
export const kbArticleFeedback = pgTable('kb_article_feedback', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  articleId:           text('article_id').notNull().references(() => kbArticle.id, { onDelete: 'cascade' }),
  userId:              text('user_id'),
  sessionFingerprint:  text('session_fingerprint'),
  helpful:             boolean('helpful').notNull(),
  comment:             text('comment'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  articleIdx:          index('kbaf_article').on(table.articleId),
  dedupeIdx:           index('kbaf_dedupe').on(table.articleId, table.userId),
}));
```

---

## 14. PLATFORM SETTINGS & INFRASTRUCTURE

Reference: Platform Settings Canonical §1–§5.

### 14.1 platformSetting

```typescript
export const platformSetting = pgTable('platform_setting', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  key:                 text('key').notNull().unique(),
  value:               jsonb('value').notNull(),
  type:                text('type').notNull().default('string'),  // string, number, boolean, json
  category:            text('category').notNull(),
  description:         text('description'),
  isSecret:            boolean('is_secret').notNull().default(false),
  updatedByStaffId:    text('updated_by_staff_id'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx:         index('ps_category').on(table.category),
}));
```

### 14.2 platformSettingHistory

```typescript
export const platformSettingHistory = pgTable('platform_setting_history', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  settingId:           text('setting_id').notNull().references(() => platformSetting.id),
  previousValue:       jsonb('previous_value').notNull(),
  newValue:            jsonb('new_value').notNull(),
  changedByStaffId:    text('changed_by_staff_id').notNull(),
  reason:              text('reason'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  settingIdx:          index('psh_setting').on(table.settingId, table.createdAt),
}));
```

### 14.3 featureFlag

```typescript
export const featureFlag = pgTable('feature_flag', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  key:                 text('key').notNull().unique(),
  name:                text('name').notNull(),
  description:         text('description'),
  type:                featureFlagTypeEnum('type').notNull().default('BOOLEAN'),
  enabled:             boolean('enabled').notNull().default(false),
  percentage:          integer('percentage'),                  // For PERCENTAGE type (0-100)
  targetingJson:       jsonb('targeting_json').notNull().default('{}'),
  createdByStaffId:    text('created_by_staff_id').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 14.4 auditEvent

```typescript
export const auditEvent = pgTable('audit_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  actorType:           text('actor_type').notNull(),           // 'user' | 'staff' | 'system' | 'cron'
  actorId:             text('actor_id'),
  action:              text('action').notNull(),
  subject:             text('subject').notNull(),              // e.g., 'Order', 'Listing', 'User'
  subjectId:           text('subject_id'),
  severity:            auditSeverityEnum('severity').notNull().default('LOW'),
  detailsJson:         jsonb('details_json').notNull().default('{}'),
  ipAddress:           text('ip_address'),
  userAgent:           text('user_agent'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  actorIdx:            index('ae_actor').on(table.actorType, table.actorId),
  subjectIdx:          index('ae_subject').on(table.subject, table.subjectId),
  actionIdx:           index('ae_action').on(table.action, table.createdAt),
  severityIdx:         index('ae_severity').on(table.severity, table.createdAt),
}));
```

### 14.5 sequenceCounter

```typescript
export const sequenceCounter = pgTable('sequence_counter', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  name:                text('name').notNull().unique(),        // 'order_number', 'case_number'
  prefix:              text('prefix').notNull(),               // 'ORD-', 'HD-'
  currentValue:        integer('current_value').notNull().default(0),
  paddedWidth:         integer('padded_width').notNull().default(6),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Sequence generation uses `SELECT ... FOR UPDATE` to prevent race conditions.

---
### 14.5b moduleRegistry

```typescript
export const moduleRegistry = pgTable('module_registry', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  moduleId:            text('module_id').notNull().unique(),
  label:               text('label').notNull(),
  description:         text('description'),
  state:               moduleStateEnum('state').notNull().default('DISABLED'),
  version:             text('version').notNull().default('1.0.0'),
  configPath:          text('config_path'),
  manifestJson:        jsonb('manifest_json').notNull().default(sql`'{}'`),
  installedByStaffId:  text('installed_by_staff_id'),
  installedAt:         timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  stateIdx:            index('mr_state').on(table.state),
}));
```

Extensible module system. Each module has a unique `moduleId`, a state machine (`ENABLED`/`DISABLED`/`BETA`/`DEPRECATED`), and a JSON manifest for configuration.

---
### 14.6 customRole
```typescript
export const customRole = pgTable('custom_role', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  name:              text('name').notNull().unique(),
  code:              text('code').notNull().unique(),
  description:       text('description'),
  permissionsJson:   jsonb('permissions_json').notNull().default('[]'),
  isActive:          boolean('is_active').notNull().default(true),
  createdByStaffId:  text('created_by_staff_id').notNull(),
  updatedByStaffId:  text('updated_by_staff_id'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 14.7 staffUserCustomRole
```typescript
export const staffUserCustomRole = pgTable('staff_user_custom_role', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  staffUserId:       text('staff_user_id').notNull().references(() => staffUser.id, { onDelete: 'cascade' }),
  customRoleId:      text('custom_role_id').notNull().references(() => customRole.id, { onDelete: 'cascade' }),
  grantedByStaffId:  text('granted_by_staff_id').notNull(),
  grantedAt:         timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt:         timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  staffRoleIdx:      unique().on(table.staffUserId, table.customRoleId),
}));
```
---
### 14.8 providerAdapter

```typescript
export const providerAdapter = pgTable('provider_adapter', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  serviceType:       providerServiceTypeEnum('service_type').notNull(),
  code:              text('code').notNull(),                   // "r2", "ses", "typesense", "my-email-provider"
  name:              text('name').notNull(),                   // "Cloudflare R2", "Amazon SES"
  description:       text('description'),
  logoUrl:           text('logo_url'),
  docsUrl:           text('docs_url'),
  configSchemaJson:  jsonb('config_schema_json').notNull().default('[]'),
    // Drives dynamic form in admin UI: [{ key, label, type, required, placeholder, helpText }]
  adapterSource:     providerAdapterSourceEnum('adapter_source').notNull().default('BUILT_IN'),
  httpConfigJson:    jsonb('http_config_json'),
    // Only for HTTP_CUSTOM: { baseUrl, auth, defaultHeaders, endpoints }
    // null for BUILT_IN adapters
  isBuiltIn:         boolean('is_built_in').notNull().default(false),
  enabled:           boolean('enabled').notNull().default(true),
  sortOrder:         integer('sort_order').notNull().default(100),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serviceCodeIdx:    unique().on(table.serviceType, table.code),
  serviceTypeIdx:    index('pa_service_type').on(table.serviceType),
}));
```

### 14.9 providerInstance

```typescript
export const providerInstance = pgTable('provider_instance', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  adapterId:         text('adapter_id').notNull().references(() => providerAdapter.id, { onDelete: 'restrict' }),
  name:              text('name').notNull().unique(),          // "production-images", "transactional-email"
  displayName:       text('display_name').notNull(),           // "Production Image Storage"
  configJson:        jsonb('config_json').notNull().default('{}'),
    // Non-secret config: { bucket, region, cdnUrl, fromEmail, fromName, ... }
  status:            providerInstanceStatusEnum('status').notNull().default('ACTIVE'),
  priority:          integer('priority').notNull().default(100),  // Lower = higher priority
  lastHealthStatus:  text('last_health_status'),               // 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  lastHealthLatencyMs: integer('last_health_latency_ms'),
  lastHealthError:   text('last_health_error'),
  createdByStaffId:  text('created_by_staff_id').notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  adapterIdx:        index('pi_adapter').on(table.adapterId),
  statusIdx:         index('pi_status').on(table.status),
}));
```

### 14.10 providerSecret
```typescript
export const providerSecret = pgTable('provider_secret', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  instanceId:        text('instance_id').notNull().references(() => providerInstance.id, { onDelete: 'cascade' }),
  key:               text('key').notNull(),                    // "apiKey", "secretAccessKey", "password"
  encryptedValue:    text('encrypted_value').notNull(),        // AES-256-GCM encrypted
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  instanceKeyIdx:    unique().on(table.instanceId, table.key),
}));
```

All secret values encrypted with MASTER_ENCRYPTION_KEY via AES-256-GCM. Decrypted at runtime only when the provider is called.

### 14.11 providerUsageMapping
```typescript
export const providerUsageMapping = pgTable('provider_usage_mapping', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  usageKey:            text('usage_key').notNull().unique(),
    // "listing-images", "user-avatars", "transactional-email",
    // "marketing-email", "helpdesk-email", "listing-search",
    // "kb-search", "admin-search", "payment-processing",
    // "shipping-labels", "websocket"
  description:         text('description'),
  serviceType:         providerServiceTypeEnum('service_type').notNull(),
  primaryInstanceId:   text('primary_instance_id').notNull()
    .references(() => providerInstance.id, { onDelete: 'restrict' }),
  fallbackInstanceId:  text('fallback_instance_id')
    .references(() => providerInstance.id, { onDelete: 'set null' }),
  autoFailover:        boolean('auto_failover').notNull().default(false),
  enabled:             boolean('enabled').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  serviceTypeIdx:      index('pum_service_type').on(table.serviceType),
}));
```

### 14.12 providerHealthLog
```typescript
export const providerHealthLog = pgTable('provider_health_log', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  instanceId:        text('instance_id').notNull().references(() => providerInstance.id, { onDelete: 'cascade' }),
  status:            text('status').notNull(),                 // 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  latencyMs:         integer('latency_ms'),
  errorMessage:      text('error_message'),
  detailsJson:       jsonb('details_json').notNull().default('{}'),
  checkedAt:         timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  instanceIdx:       index('phl_instance').on(table.instanceId, table.checkedAt),
}));
```

Health checks run every 15 minutes via BullMQ cron. Auto-failover triggers after 3 consecutive UNHEALTHY checks if `autoFailover` is enabled on the usage mapping.
```

---

## 15. PROMOTIONS

### 15.1 promotion

```typescript
export const promotion = pgTable('promotion', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull(),
  name:                text('name').notNull(),
  type:                promotionTypeEnum('type').notNull(),
  scope:               promotionScopeEnum('scope').notNull(),
  discountPercent:     real('discount_percent'),
  discountAmountCents: integer('discount_amount_cents'),
  minimumOrderCents:   integer('minimum_order_cents'),
  maxUsesTotal:        integer('max_uses_total'),
  maxUsesPerBuyer:     integer('max_uses_per_buyer').notNull().default(1),
  usageCount:          integer('usage_count').notNull().default(0),
  couponCode:          text('coupon_code').unique(),
  applicableCategoryIds: text('applicable_category_ids').array().notNull().default(sql`'{}'::text[]`),
  applicableListingIds: text('applicable_listing_ids').array().notNull().default(sql`'{}'::text[]`),
  isActive:            boolean('is_active').notNull().default(true),
  startsAt:            timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt:              timestamp('ends_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:           index('promo_seller').on(table.sellerId),
  couponIdx:           index('promo_coupon').on(table.couponCode),
  activeIdx:           index('promo_active').on(table.isActive, table.startsAt, table.endsAt),
}));
```

### 15.2 promotionUsage

```typescript
export const promotionUsage = pgTable('promotion_usage', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  promotionId:         text('promotion_id').notNull().references(() => promotion.id),
  orderId:             text('order_id').notNull().references(() => order.id),
  buyerId:             text('buyer_id').notNull().references(() => user.id),
  discountCents:       integer('discount_cents').notNull(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  promotionIdx:        index('pu_promotion').on(table.promotionId),
  buyerPromoIdx:       index('pu_buyer_promo').on(table.buyerId, table.promotionId),
}));
```

### 15.3 promotedListing

```typescript
export const promotedListing = pgTable('promoted_listing', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sellerId:            text('seller_id').notNull(),
  boostPercent:        real('boost_percent').notNull(),
  isActive:            boolean('is_active').notNull().default(true),
  impressions:         integer('impressions').notNull().default(0),
  clicks:              integer('clicks').notNull().default(0),
  sales:               integer('sales').notNull().default(0),
  totalFeeCents:       integer('total_fee_cents').notNull().default(0),
  startedAt:           timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt:             timestamp('ended_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:          index('pl_listing').on(table.listingId),
  sellerActiveIdx:     index('pl_seller_active').on(table.sellerId, table.isActive),
}));
```

### 15.4 promotedListingEvent

```typescript
export const promotedListingEvent = pgTable('promoted_listing_event', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  promotedListingId:   text('promoted_listing_id').notNull().references(() => promotedListing.id, { onDelete: 'cascade' }),
  eventType:           text('event_type').notNull(),        // 'IMPRESSION' | 'CLICK' | 'SALE'
  orderId:             text('order_id'),
  feeCents:            integer('fee_cents'),
  attributionWindow:   integer('attribution_window').notNull().default(7),   // days
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  promotedListingIdx:  index('ple_promoted').on(table.promotedListingId, table.eventType),
  eventTypeIdx:        index('ple_event_type').on(table.eventType, table.createdAt),
}));
```

Per-event tracking for promoted listings. Each impression, click, or sale is recorded individually for attribution analysis. `attributionWindow` defaults to 7 days (a sale within 7 days of a click counts as attributed).

---

## 16. SOCIAL

### 16.1 follow

```typescript
export const follow = pgTable('follow', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  followerId:          text('follower_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  followedId:          text('followed_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  followerIdx:         index('fol_follower').on(table.followerId),
  followedIdx:         index('fol_followed').on(table.followedId),
  uniquePairIdx:       unique().on(table.followerId, table.followedId),
}));
```

### 16.2 watchlistItem

```typescript
export const watchlistItem = pgTable('watchlist_item', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  notifyPriceDrop:     boolean('notify_price_drop').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userListingIdx:      unique().on(table.userId, table.listingId),
  listingIdx:          index('wl_listing').on(table.listingId),
}));
```

### 16.3 savedSearch

```typescript
export const savedSearch = pgTable('saved_search', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:                text('name').notNull(),
  queryJson:           jsonb('query_json').notNull(),
  notifyNewMatches:    boolean('notify_new_matches').notNull().default(true),
  lastCheckedAt:       timestamp('last_checked_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:             index('ss_user').on(table.userId),
}));
```

---

## 17. TAX

### 17.1 taxInfo (Seller Tax Data)

```typescript
export const taxInfo = pgTable('tax_info', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  taxIdType:           text('tax_id_type'),                   // 'SSN' | 'EIN' | 'ITIN'
  taxIdEncrypted:      text('tax_id_encrypted'),              // AES-256-GCM encrypted
  taxIdLastFour:       text('tax_id_last_four'),
  legalName:           text('legal_name'),
  businessName:        text('business_name'),
  address1:            text('address1'),
  city:                text('city'),
  state:               text('state'),
  zip:                 text('zip'),
  country:             text('country').notNull().default('US'),
  w9ReceivedAt:        timestamp('w9_received_at', { withTimezone: true }),
  form1099Threshold:   boolean('form_1099_threshold').notNull().default(false),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 17.2 taxQuote

```typescript
export const taxQuote = pgTable('tax_quote', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  orderId:             text('order_id').references(() => order.id),
  buyerState:          text('buyer_state').notNull(),
  sellerState:         text('seller_state'),
  subtotalCents:       integer('subtotal_cents').notNull(),
  shippingCents:       integer('shipping_cents').notNull().default(0),
  taxCents:            integer('tax_cents').notNull(),
  taxRatePercent:      real('tax_rate_percent').notNull(),
  jurisdictionJson:    jsonb('jurisdiction_json').notNull().default('{}'),
  isMarketplaceFacilitator: boolean('is_marketplace_facilitator').notNull().default(true),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:            index('tq_order').on(table.orderId),
}));
```

---


---

## 18. FINANCE CENTER

### 18.1 financeSubscription

```typescript
export const financeSubscription = pgTable('finance_subscription', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:       text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  tier:                  financeTierEnum('tier').notNull(),
  status:                subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  stripeSubscriptionId:  text('stripe_subscription_id').unique(),
  stripePriceId:         text('stripe_price_id'),
  currentPeriodStart:    timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd:      timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd:     boolean('cancel_at_period_end').notNull().default(false),
  canceledAt:            timestamp('canceled_at', { withTimezone: true }),
  // Pending change fields (Decision #97) — finance is binary (FREE/PRO), so pendingTier is text
  pendingTier:              text('pending_tier'),
  pendingBillingInterval:   text('pending_billing_interval'),
  pendingChangeAt:          timestamp('pending_change_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 18.2 expense

```typescript
export const expense = pgTable('expense', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  category:            text('category').notNull(),     // From platform setting: finance.expenseCategories
  amountCents:         integer('amount_cents').notNull(),
  currency:            text('currency').notNull().default('USD'),
  vendor:              text('vendor'),
  description:         text('description'),
  receiptUrl:          text('receipt_url'),             // R2 stored receipt photo
  receiptDataJson:     jsonb('receipt_data_json'),      // AI-extracted receipt data
  expenseDate:         timestamp('expense_date', { withTimezone: true }).notNull(),
  isRecurring:         boolean('is_recurring').notNull().default(false),
  recurringFrequency:  text('recurring_frequency'),    // 'WEEKLY' | 'MONTHLY' | 'ANNUAL'
  recurringEndDate:    timestamp('recurring_end_date', { withTimezone: true }),
  parentExpenseId:     text('parent_expense_id'),      // Self-ref for recurring source
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userDateIdx:         index('exp_user_date').on(table.userId, table.expenseDate),
  userCatIdx:          index('exp_user_cat').on(table.userId, table.category),
}));
```

### 18.3 mileageEntry

```typescript
export const mileageEntry = pgTable('mileage_entry', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  description:     text('description').notNull(),
  miles:           real('miles').notNull(),
  ratePerMile:     real('rate_per_mile').notNull(),     // IRS rate from platform setting
  deductionCents:  integer('deduction_cents').notNull(),
  tripDate:        timestamp('trip_date', { withTimezone: true }).notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userDateIdx:     index('mi_user_date').on(table.userId, table.tripDate),
}));
```

### 18.4 financialReport

```typescript
export const financialReport = pgTable('financial_report', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  reportType:      text('report_type').notNull(),      // 'PNL' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'TAX_PREP' | 'INVENTORY_AGING'
  periodStart:     timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:       timestamp('period_end', { withTimezone: true }).notNull(),
  snapshotJson:    jsonb('snapshot_json').notNull(),
  format:          text('format').notNull(),            // 'JSON' | 'CSV' | 'PDF'
  fileUrl:         text('file_url'),                    // R2 stored exported file
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userTypeIdx:     index('fr_user_type').on(table.userId, table.reportType),
}));
```

### 18.5 accountingIntegration

```typescript
export const accountingIntegration = pgTable('accounting_integration', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  userId:            text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  provider:          text('provider').notNull(),        // 'QUICKBOOKS' | 'XERO'
  accessToken:       text('access_token'),              // Encrypted at app layer
  refreshToken:      text('refresh_token'),             // Encrypted at app layer
  externalAccountId: text('external_account_id'),
  lastSyncAt:        timestamp('last_sync_at', { withTimezone: true }),
  status:            text('status').notNull(),          // 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userProviderIdx:   unique().on(table.userId, table.provider),
}));
```

### 18.6 financialProjection

Nightly-computed cache for intelligence layer metrics. One row per seller.

```typescript
export const financialProjection = pgTable('financial_projection', {
  id:                        text('id').primaryKey().$defaultFn(() => createId()),
  sellerProfileId:           text('seller_profile_id').notNull().unique().references(() => sellerProfile.id),
  projectedRevenue30d:       integer('projected_revenue_30d'),          // cents
  projectedExpenses30d:      integer('projected_expenses_30d'),         // cents
  projectedProfit30d:        integer('projected_profit_30d'),           // cents
  sellThroughRate90d:        integer('sell_through_rate_90d'),          // basis points
  avgSalePrice90d:           integer('avg_sale_price_90d'),             // cents
  effectiveFeeRate90d:       integer('effective_fee_rate_90d'),         // basis points
  avgDaysToSell90d:          integer('avg_days_to_sell_90d'),
  breakEvenRevenue:          integer('break_even_revenue'),             // cents
  breakEvenOrders:           integer('break_even_orders'),
  healthScore:               integer('health_score'),                   // 0-100
  healthScoreBreakdownJson:  jsonb('health_score_breakdown_json'),
  inventoryTurnsPerMonth:    integer('inventory_turns_per_month'),      // basis points
  performingPeriodsJson:     jsonb('performing_periods_json'),
  dataQualityScore:          integer('data_quality_score').notNull().default(0),
  computedAt:                timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 18.7 recurringExpense

Rules for auto-creating expense entries on schedule. Each rule spawns `expense` rows via cron.

```typescript
export const recurringExpense = pgTable('recurring_expense', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  userId:        text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  category:      text('category').notNull(),
  amountCents:   integer('amount_cents').notNull(),
  vendor:        text('vendor'),
  description:   text('description'),
  frequency:     text('frequency').notNull(),     // 'MONTHLY' | 'WEEKLY' | 'ANNUAL'
  startDate:     date('start_date').notNull(),
  endDate:       date('end_date'),
  isActive:      boolean('is_active').notNull().default(true),
  lastCreatedAt: date('last_created_at'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userActiveIdx: index('re_user_active').on(table.userId, table.isActive),
}));
```

---

## 19. LOCAL, AUTHENTICATION & COMBINED SHIPPING

### 19.1 localTransaction

```typescript
export const localTransaction = pgTable('local_transaction', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  orderId:               text('order_id').notNull().references(() => order.id),
  buyerId:               text('buyer_id').notNull().references(() => user.id),
  sellerId:              text('seller_id').notNull().references(() => user.id),
  meetupLocationId:      text('meetup_location_id').references(() => safeMeetupLocation.id),
  status:                localTransactionStatusEnum('status').notNull().default('SCHEDULED'),
  scheduledAt:           timestamp('scheduled_at', { withTimezone: true }).notNull(),

  // QR code escrow release
  confirmationCode:      text('confirmation_code').notNull().unique(),    // Single-use, generates QR
  offlineCode:           text('offline_code').notNull(),                  // 6-digit fallback for no signal
  confirmationMethod:    text('confirmation_method'),                    // 'QR_SCAN' | 'MANUAL_CODE'

  // Two-way check-in
  sellerCheckedIn:       boolean('seller_checked_in').notNull().default(false),
  sellerCheckedInAt:     timestamp('seller_checked_in_at', { withTimezone: true }),
  buyerCheckedIn:        boolean('buyer_checked_in').notNull().default(false),
  buyerCheckedInAt:      timestamp('buyer_checked_in_at', { withTimezone: true }),

  // Completion
  confirmedAt:           timestamp('confirmed_at', { withTimezone: true }),
  offlineConfirmedAt:    timestamp('offline_confirmed_at', { withTimezone: true }),  // Device timestamp
  syncedAt:              timestamp('synced_at', { withTimezone: true }),             // Server received confirmation

  // Safety
  safetyAlertSent:       boolean('safety_alert_sent').notNull().default(false),
  safetyAlertAt:         timestamp('safety_alert_at', { withTimezone: true }),

  // No-show tracking
  noShowParty:           text('no_show_party'),          // 'BUYER' | 'SELLER' | null
  noShowFeeCents:        integer('no_show_fee_cents'),
  noShowFeeChargedAt:    timestamp('no_show_fee_charged_at', { withTimezone: true }),

  // At-meetup photo evidence (G2.16)
  meetupPhotoUrls:       text('meetup_photo_urls').array().notNull().default(sql`'{}'::text[]`),
  meetupPhotosAt:        timestamp('meetup_photos_at', { withTimezone: true }),

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:              index('lt_order').on(table.orderId),
  buyerIdx:              index('lt_buyer').on(table.buyerId),
  sellerIdx:             index('lt_seller').on(table.sellerId),
  statusIdx:             index('lt_status').on(table.status),
  confirmCodeIdx:        index('lt_confirm').on(table.confirmationCode),
}));
```

### 19.2 safeMeetupLocation

```typescript
export const safeMeetupLocation = pgTable('safe_meetup_location', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  name:              text('name').notNull(),
  address:           text('address').notNull(),
  city:              text('city').notNull(),
  state:             text('state').notNull(),
  zip:               text('zip').notNull(),
  country:           text('country').notNull().default('US'),
  latitude:          real('latitude').notNull(),
  longitude:         real('longitude').notNull(),
  type:              text('type').notNull(),            // 'POLICE_STATION' | 'RETAIL' | 'COMMUNITY' | 'CUSTOM'
  verifiedSafe:      boolean('verified_safe').notNull().default(false),
  operatingHoursJson: jsonb('operating_hours_json'),
  meetupCount:       integer('meetup_count').notNull().default(0),
  rating:            real('rating'),
  isActive:          boolean('is_active').notNull().default(true),
  addedByStaffId:    text('added_by_staff_id'),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cityStateIdx:      index('sml_city').on(table.city, table.state),
  geoIdx:            index('sml_geo').on(table.latitude, table.longitude),
}));
```

### 19.3 combinedShippingQuote

```typescript
export const combinedShippingQuote = pgTable('combined_shipping_quote', {
  id:                      text('id').primaryKey().$defaultFn(() => createId()),
  orderId:                 text('order_id').notNull().references(() => order.id),
  sellerId:                text('seller_id').notNull().references(() => user.id),
  buyerId:                 text('buyer_id').notNull().references(() => user.id),
  status:                  text('status').notNull(),
  // 'PENDING_SELLER' | 'PENDING_BUYER' | 'ACCEPTED' | 'DISPUTED' | 'EXPIRED' | 'PENALTY_APPLIED'
  maxShippingCents:        integer('max_shipping_cents').notNull(),      // Sum of individual rates (hold ceiling)
  quotedShippingCents:     integer('quoted_shipping_cents'),             // Seller's actual quote
  penaltyApplied:          boolean('penalty_applied').notNull().default(false),
  penaltyDiscountPercent:  real('penalty_discount_percent'),             // 25% default
  finalShippingCents:      integer('final_shipping_cents'),
  savingsCents:            integer('savings_cents'),
  sellerDeadline:          timestamp('seller_deadline', { withTimezone: true }).notNull(),  // 48hr from order
  sellerQuotedAt:          timestamp('seller_quoted_at', { withTimezone: true }),
  buyerRespondedAt:        timestamp('buyer_responded_at', { withTimezone: true }),
  createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  orderIdx:                index('csq_order').on(table.orderId),
  sellerDeadlineIdx:       index('csq_deadline').on(table.sellerDeadline, table.status),
}));
```

### 19.4 authenticationRequest

```typescript
export const authenticationRequest = pgTable('authentication_request', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  listingId:             text('listing_id').notNull().references(() => listing.id),
  orderId:               text('order_id'),                                // null if seller-initiated pre-listing
  sellerId:              text('seller_id').notNull().references(() => user.id),
  buyerId:               text('buyer_id'),                                // null if seller-initiated
  initiator:             text('initiator').notNull(),                     // 'BUYER' | 'SELLER'
  tier:                  text('tier').notNull(),                          // 'AI' | 'EXPERT'
  status:                authenticationStatusEnum('status').notNull(),

  // Cost tracking — settled within the transaction, never deferred
  totalFeeCents:         integer('total_fee_cents').notNull(),
  buyerFeeCents:         integer('buyer_fee_cents'),                      // $9.99 if authentic, $0 if counterfeit
  sellerFeeCents:        integer('seller_fee_cents'),                     // $9.99 if authentic, full if counterfeit
  refundedBuyerCents:    integer('refunded_buyer_cents').notNull().default(0),

  // Provider
  providerRef:           text('provider_ref'),                           // Entrupy reference ID
  authenticatorId:       text('authenticator_id').references(() => authenticatorPartner.id),

  // Certificate — per-item, per-transaction, non-transferable
  certificateNumber:     text('certificate_number').unique(),            // TW-AUTH-XXXXX
  certificateUrl:        text('certificate_url'),
  verifyUrl:             text('verify_url'),                             // twicely.co/verify/TW-AUTH-XXXXX

  // Anti-fraud: photo fingerprinting
  photosHash:            text('photos_hash'),                            // Perceptual hash of auth photos
  photoUrls:             text('photo_urls').array(),

  // Results
  resultJson:            jsonb('result_json'),
  resultNotes:           text('result_notes'),

  submittedAt:           timestamp('submitted_at', { withTimezone: true }),
  completedAt:           timestamp('completed_at', { withTimezone: true }),
  expiresAt:             timestamp('expires_at', { withTimezone: true }),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:            index('ar_listing').on(table.listingId),
  sellerIdx:             index('ar_seller').on(table.sellerId),
  certIdx:               index('ar_cert').on(table.certificateNumber),
  statusIdx:             index('ar_status').on(table.status),
}));
```

### 19.5 localFraudFlag

Per Addendum §A12 — SafeTrade fraud detection. Tracks fraud signals per local transaction.

```typescript
export const localFraudFlag = pgTable('local_fraud_flag', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:            text('seller_id').notNull().references(() => user.id),
  localTransactionId:  text('local_transaction_id').notNull().references(() => localTransaction.id),
  listingId:           text('listing_id').notNull().references(() => listing.id),
  trigger:             text('trigger').notNull(),  // 'SAME_LISTING_SOLD' | 'PHASH_DUPLICATE' | 'NOSHOW_RELIST' | 'BUYER_CLAIM'
  severity:            localFraudFlagSeverityEnum('severity').notNull(),
  status:              localFraudFlagStatusEnum('status').notNull().default('OPEN'),
  detailsJson:         jsonb('details_json').notNull().default(sql`'{}'`),
  // Resolution
  resolvedByStaffId:   text('resolved_by_staff_id'),
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  resolutionNote:      text('resolution_note'),
  // Consequence tracking
  refundIssuedAt:      timestamp('refund_issued_at', { withTimezone: true }),
  listingRemovedAt:    timestamp('listing_removed_at', { withTimezone: true }),
  sellerBannedAt:      timestamp('seller_banned_at', { withTimezone: true }),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:           index('lff_seller').on(table.sellerId),
  transactionIdx:      index('lff_transaction').on(table.localTransactionId),
  statusIdx:           index('lff_status').on(table.status),
  severityIdx:         index('lff_severity').on(table.severity),
}));
```

### 19.6 authenticatorPartner

```typescript
export const authenticatorPartner = pgTable('authenticator_partner', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  name:                  text('name').notNull(),
  email:                 text('email').notNull(),
  specialties:           text('specialties').array().notNull(),           // ['HANDBAGS', 'WATCHES', 'SNEAKERS', 'TRADING_CARDS']
  isActive:              boolean('is_active').notNull().default(true),
  completedCount:        integer('completed_count').notNull().default(0),
  accuracyRate:          real('accuracy_rate'),
  avgTurnaroundHours:    real('avg_turnaround_hours'),
  payoutAccountId:       text('payout_account_id'),                     // Stripe Connect for payouts
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

## 20. GROWTH, ALERTS & MARKET INTELLIGENCE

### 27.1 listingPriceHistory

```typescript
export const listingPriceHistory = pgTable('listing_price_history', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  priceCents:      integer('price_cents').notNull(),
  previousCents:   integer('previous_cents'),
  changeReason:    text('change_reason').notNull(),    // 'MANUAL' | 'PROMOTION' | 'COUPON' | 'SMART_DROP' | 'IMPORT' | 'OFFER_ACCEPTED'
  changedByUserId: text('changed_by_user_id'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:      index('lph_listing').on(table.listingId, table.createdAt),
}));
```

### 27.2 browsingHistory

```typescript
export const browsingHistory = pgTable('browsing_history', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  userId:              text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:           text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  categoryId:          text('category_id'),
  sellerId:            text('seller_id'),
  viewCount:           integer('view_count').notNull().default(1),
  totalDurationSec:    integer('total_duration_sec').notNull().default(0),
  lastViewDurationSec: integer('last_view_duration_sec').notNull().default(0),
  didAddToCart:        boolean('did_add_to_cart').notNull().default(false),
  didAddToWatchlist:   boolean('did_add_to_watchlist').notNull().default(false),
  didMakeOffer:        boolean('did_make_offer').notNull().default(false),
  didPurchase:         boolean('did_purchase').notNull().default(false),
  didSetPriceAlert:    boolean('did_set_price_alert').notNull().default(false),
  sourceType:          text('source_type'),             // 'search' | 'category' | 'recommendation' | 'alert' | 'direct'
  searchQuery:         text('search_query'),
  firstViewedAt:       timestamp('first_viewed_at', { withTimezone: true }).notNull().defaultNow(),
  lastViewedAt:        timestamp('last_viewed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:             index('bh_user').on(table.userId, table.lastViewedAt),
  userListingUnique:   unique().on(table.userId, table.listingId),
  listingIdx:          index('bh_listing').on(table.listingId),
}));
```

### 27.3 priceAlert

```typescript
export const priceAlert = pgTable('price_alert', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  listingId:       text('listing_id').references(() => listing.id, { onDelete: 'cascade' }),
  alertType:       text('alert_type').notNull(),       // 'ANY_DROP' | 'TARGET_PRICE' | 'PERCENT_DROP' | 'BACK_IN_STOCK'
  targetPriceCents: integer('target_price_cents'),     // For TARGET_PRICE type
  percentDrop:     real('percent_drop'),               // For PERCENT_DROP type (e.g., 20.0 = 20%)
  priceCentsAtCreation: integer('price_cents_at_creation'),  // Snapshot of listing price when alert created
  isActive:        boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('pa_user').on(table.userId),
  listingIdx:      index('pa_listing').on(table.listingId),
  activeIdx:       index('pa_active').on(table.isActive, table.listingId),
}));
```

### 27.4 categoryAlert

```typescript
export const categoryAlert = pgTable('category_alert', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  categoryId:      text('category_id').notNull().references(() => category.id),
  filtersJson:     jsonb('filters_json').notNull().default('{}'),  // Optional filters: brand, condition, price range
  isActive:        boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  expiresAt:       timestamp('expires_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:         index('ca_user').on(table.userId),
  categoryIdx:     index('ca_category').on(table.categoryId),
}));
```

### 20.5 buyerBlockList

```typescript
export const buyerBlockList = pgTable('buyer_block_list', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  blockerId:       text('blocker_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  blockedId:       text('blocked_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  reason:          text('reason'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  blockerIdx:      index('bbl_blocker').on(table.blockerId),
  blockedIdx:      index('bbl_blocked').on(table.blockedId),
  uniquePairIdx:   unique().on(table.blockerId, table.blockedId),
}));
```

### 20.6 marketPricePoint

```typescript
export const marketPricePoint = pgTable('market_price_point', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  source:            text('source').notNull(),             // 'TWICELY_NATIVE' | 'EBAY_SELLER' | 'EBAY_PUBLIC' | 'POSHMARK_SELLER' | 'MERCARI_SELLER'
  categoryId:        text('category_id').notNull().references(() => category.id),
  brand:             text('brand'),
  conditionBucket:   text('condition_bucket'),              // 'NEW' | 'LIKE_NEW' | 'GOOD' | 'ACCEPTABLE'
  priceCents:        integer('price_cents').notNull(),
  shippingCents:     integer('shipping_cents'),
  soldAt:            timestamp('sold_at', { withTimezone: true }).notNull(),
  daysToSell:        integer('days_to_sell'),                // list-to-sell duration (null if unknown)
  platform:          text('platform'),                       // 'TWICELY' | 'EBAY' | 'POSHMARK' | 'MERCARI' | 'FACEBOOK'
  // NO seller ID, NO buyer ID — anonymized
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryBrandIdx:  index('mpp_cat_cond_brand_sold').on(table.categoryId, table.conditionBucket, table.brand, table.soldAt),
  soldAtIdx:         index('mpp_sold_at').on(table.soldAt),
  sourceIdx:         index('mpp_source').on(table.source),
}));
```

### 20.7 marketCategorySummary

```typescript
export const marketCategorySummary = pgTable('market_category_summary', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:        text('category_id').notNull().references(() => category.id),
  brand:             text('brand'),                          // null = all brands in category
  conditionBucket:   text('condition_bucket'),                // null = all conditions
  periodType:        text('period_type').notNull(),           // 'DAILY' | 'WEEKLY' | 'MONTHLY'
  periodStart:       timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:         timestamp('period_end', { withTimezone: true }).notNull(),

  // Price stats
  sampleSize:        integer('sample_size').notNull(),
  medianPriceCents:  integer('median_price_cents').notNull(),
  avgPriceCents:     integer('avg_price_cents').notNull(),
  p25PriceCents:     integer('p25_price_cents').notNull(),
  p75PriceCents:     integer('p75_price_cents').notNull(),
  minPriceCents:     integer('min_price_cents').notNull(),
  maxPriceCents:     integer('max_price_cents').notNull(),

  // Sell-through stats
  avgDaysToSell:     integer('avg_days_to_sell'),
  medianDaysToSell:  integer('median_days_to_sell'),
  sellThroughRate:   real('sell_through_rate'),               // sold / (sold + expired) in period

  // Volume
  totalSoldCount:    integer('total_sold_count').notNull(),
  totalGmvCents:     bigint('total_gmv_cents', { mode: 'number' }).notNull(),

  // Trend
  priceChangePct:    real('price_change_pct'),                // vs previous period
  volumeChangePct:   real('volume_change_pct'),               // vs previous period

  // Sources contributing
  dataSourcesJson:   jsonb('data_sources_json').notNull().default('{}'),  // { TWICELY_NATIVE: 45, EBAY_SELLER: 120, ... }
  confidence:        text('confidence').notNull(),            // 'HIGH' (50+) | 'MEDIUM' (20-49) | 'LOW' (< 20)

  computedAt:        timestamp('computed_at', { withTimezone: true }).notNull(),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryPeriodIdx: index('mcs_cat_period').on(table.categoryId, table.periodType, table.periodStart),
  brandIdx:          index('mcs_brand').on(table.brand),
  uniqCategoryWindow: unique('mcs_unique_dim_period').on(table.categoryId, table.conditionBucket, table.brand, table.periodType, table.periodStart),
}));
```

### 20.8 marketListingIntelligence

```typescript
export const marketListingIntelligence = pgTable('market_listing_intelligence', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  listingId:             text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  categoryId:            text('category_id').notNull(),

  // Price guidance
  marketMedianCents:     integer('market_median_cents'),
  marketLowCents:        integer('market_low_cents'),
  marketHighCents:       integer('market_high_cents'),
  sweetSpotLowCents:     integer('sweet_spot_low_cents'),
  sweetSpotHighCents:    integer('sweet_spot_high_cents'),
  sampleSize:            integer('sample_size').notNull(),

  // Time-to-sell
  estimatedDaysToSell:   integer('estimated_days_to_sell'),
  categoryAvgDays:       integer('category_avg_days'),

  // Health signal
  healthSignal:          text('health_signal'),               // 'SELLING_FAST' | 'ON_TRACK' | 'SLOW_MOVER' | 'STALE'
  healthNudgeText:       text('health_nudge_text'),           // Human-readable nudge

  // Platform recommendation (crosslister sellers only)
  bestPlatform:          text('best_platform'),               // 'EBAY' | 'POSHMARK' | 'MERCARI' | 'FACEBOOK'
  bestPlatformReason:    text('best_platform_reason'),
  platformPricesJson:    jsonb('platform_prices_json'),       // { EBAY: { median: 4800 }, POSHMARK: { median: 5500 }, ... }

  // Sources
  dataSourcesJson:       jsonb('data_sources_json'),
  computedAt:            timestamp('computed_at', { withTimezone: true }).notNull(),
  expiresAt:             timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:            index('mli_listing').on(table.listingId),
  expiresIdx:            index('mli_expires').on(table.expiresAt),
}));
```

### 20.9 marketOfferIntelligence

```typescript
export const marketOfferIntelligence = pgTable('market_offer_intelligence', {
  id:                      text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:              text('category_id').notNull().references(() => category.id),
  conditionBucket:         text('condition_bucket'),
  priceBucketCents:        integer('price_bucket_cents'),     // rounded to nearest $10

  // Offer patterns
  avgAcceptedPctOfAsk:     real('avg_accepted_pct_of_ask'),   // e.g., 0.82 = 82% of asking
  medianAcceptedPctOfAsk:  real('median_accepted_pct_of_ask'),
  acceptanceRate:          real('acceptance_rate'),            // % of offers accepted
  counterRate:             real('counter_rate'),               // % of offers countered
  avgCounterPctOfAsk:      real('avg_counter_pct_of_ask'),    // avg counter as % of ask

  sampleSize:              integer('sample_size').notNull(),
  periodStart:             timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:               timestamp('period_end', { withTimezone: true }).notNull(),
  computedAt:              timestamp('computed_at', { withTimezone: true }).notNull(),
  createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryCondIdx:         index('moi_cat_cond').on(table.categoryId, table.conditionBucket),
  priceBucketIdx:          index('moi_price_bucket').on(table.priceBucketCents),
}));
```

## 21. AFFILIATES, REFERRALS & PROMO CODES

### 21.1 affiliate

```typescript
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
  suspendedReason:     text('suspended_reason'),
  applicationNote:     text('application_note'),                    // For influencer applications
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx:             index('aff_user').on(table.userId),
  statusIdx:           index('aff_status').on(table.status),
}));
```

### 21.2 referral

```typescript
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
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  affiliateIdx:        index('ref_affiliate').on(table.affiliateId),
  referredUserIdx:     index('ref_referred').on(table.referredUserId),
  statusIdx:           index('ref_status').on(table.status),
  expiresIdx:          index('ref_expires').on(table.expiresAt),
}));
```

### 21.3 promoCode

```typescript
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
```

### 21.4 promoCodeRedemption

```typescript
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
```

### 21.5 affiliateCommission

```typescript
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
```

### 21.6 affiliatePayout

```typescript
export const affiliatePayout = pgTable('affiliate_payout', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  affiliateId:         text('affiliate_id').notNull().references(() => affiliate.id),
  amountCents:         integer('amount_cents').notNull(),
  method:              text('method').notNull(),                     // 'stripe_connect' | 'paypal'
  externalPayoutId:    text('external_payout_id'),                   // Stripe transfer ID or PayPal batch ID
  status:              text('status').notNull().default('PENDING'),   // PENDING | PROCESSING | COMPLETED | FAILED
  periodStart:         timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:           timestamp('period_end', { withTimezone: true }).notNull(),
  failedReason:        text('failed_reason'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  affiliateIdx:        index('ap_affiliate').on(table.affiliateId),
  statusIdx:           index('ap_status').on(table.status),
}));
```

## 22. PERSONALIZATION

### 22.1 interestTag

```typescript
export const interestTag = pgTable('interest_tag', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  group: varchar('group', { length: 50 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  description: varchar('description', { length: 200 }),
  categoryIds: text('category_ids').array(),
  attributes: jsonb('attributes'),
  cardEmphasis: varchar('card_emphasis', { length: 50 }).notNull().default('default'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 22.2 userInterest

```typescript
export const userInterest = pgTable('user_interest', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tagSlug: varchar('tag_slug', { length: 50 }).notNull().references(() => interestTag.slug),
  weight: decimal('weight', { precision: 6, scale: 3 }).notNull().default('1.0'),
  source: interestSourceEnum('source').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserTagSource: unique().on(table.userId, table.tagSlug, table.source),
  userIdIdx: index('idx_user_interest_user_id').on(table.userId),
  expiresAtIdx: index('idx_user_interest_expires_at').on(table.expiresAt),
}));
```

## 23. BUYER ACQUISITION

### 23.1 googleCategoryMapping

```typescript
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
```

### 23.2 buyerReferral

```typescript
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
```

## 24. SOCIAL & DISCOVERY

### 24.1 listingQuestion

```typescript
export const listingQuestion = pgTable('listing_question', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  askerId:         text('asker_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  questionText:    text('question_text').notNull(),         // 500 char max (enforced in app)
  answerText:      text('answer_text'),                     // 1000 char max (nullable until answered)
  answeredAt:      timestamp('answered_at', { withTimezone: true }),
  answeredBy:      text('answered_by').references(() => user.id), // seller or staff delegate
  isPinned:        boolean('is_pinned').notNull().default(false), // seller can pin up to 3
  isHidden:        boolean('is_hidden').notNull().default(false), // moderation or seller-hidden
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:      index('lq_listing').on(table.listingId),
  askerIdx:        index('lq_asker').on(table.askerId),
  pinnedIdx:       index('lq_pinned').on(table.listingId, table.isPinned),
}));
```

### 24.2 curatedCollection

```typescript
export const curatedCollection = pgTable('curated_collection', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  title:           text('title').notNull(),
  slug:            text('slug').notNull().unique(),
  description:     text('description'),
  coverImageUrl:   text('cover_image_url'),
  curatedBy:       text('curated_by').notNull().references(() => user.id), // staff user
  isPublished:     boolean('is_published').notNull().default(false),
  startDate:       timestamp('start_date', { withTimezone: true }),        // seasonal/themed
  endDate:         timestamp('end_date', { withTimezone: true }),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIdx:         index('cc_slug').on(table.slug),
  publishedIdx:    index('cc_published').on(table.isPublished, table.sortOrder),
}));
```

### 24.3 curatedCollectionItem

```typescript
export const curatedCollectionItem = pgTable('curated_collection_item', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  collectionId:    text('collection_id').notNull().references(() => curatedCollection.id, { onDelete: 'cascade' }),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  sortOrder:       integer('sort_order').notNull().default(0),
  addedBy:         text('added_by').notNull().references(() => user.id),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  collectionIdx:   index('cci_collection').on(table.collectionId, table.sortOrder),
  uniqueItem:      unique().on(table.collectionId, table.listingId),
}));
```

### 24.4 (reserved — offerBundleItem is at §5.3c)

### 24.5 liveSession

Design-only — no UI until 6-12 months post-launch.

```typescript
export const liveSession = pgTable('live_session', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  sellerId:        text('seller_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title:           text('title').notNull(),
  description:     text('description'),
  status:          liveSessionStatusEnum('status').notNull().default('SCHEDULED'),
  scheduledAt:     timestamp('scheduled_at', { withTimezone: true }),
  startedAt:       timestamp('started_at', { withTimezone: true }),
  endedAt:         timestamp('ended_at', { withTimezone: true }),
  viewerCount:     integer('viewer_count').notNull().default(0),
  peakViewerCount: integer('peak_viewer_count').notNull().default(0),
  streamUrl:       text('stream_url'),
  thumbnailUrl:    text('thumbnail_url'),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sellerIdx:       index('ls_seller').on(table.sellerId),
  statusIdx:       index('ls_status').on(table.status),
  scheduledIdx:    index('ls_scheduled').on(table.scheduledAt),
}));
```

### 24.6 liveSessionProduct

```typescript
export const liveSessionProduct = pgTable('live_session_product', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  sessionId:       text('session_id').notNull().references(() => liveSession.id, { onDelete: 'cascade' }),
  listingId:       text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  featuredAt:      timestamp('featured_at', { withTimezone: true }),
  sortOrder:       integer('sort_order').notNull().default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sessionIdx:      index('lsp_session').on(table.sessionId, table.sortOrder),
  uniqueItem:      unique().on(table.sessionId, table.listingId),
}));
```

---

## 25. TABLE INVENTORY

| # | Table | Section | Domain |
|---|---|---|---|
| 1 | user | §2.1 | IDENTITY & AUTH |
| 2 | session | §2.2 | IDENTITY & AUTH |
| 3 | account | §2.2 | IDENTITY & AUTH |
| 4 | verification | §2.2 | IDENTITY & AUTH |
| 5 | seller_profile | §2.3 | IDENTITY & AUTH |
| 6 | business_info | §2.4 | IDENTITY & AUTH |
| 7 | address | §2.5 | IDENTITY & AUTH |
| 8 | staff_user | §2.6 | IDENTITY & AUTH |
| 9 | staff_user_role | §2.7 | IDENTITY & AUTH |
| 10 | staff_session | §2.8 | IDENTITY & AUTH |
| 11 | storefront | §2.5b | IDENTITY & AUTH |
| 12 | storefront_custom_category | §2.5c | IDENTITY & AUTH |
| 12b | storefront_page | §2.5d | IDENTITY & AUTH |
| 13 | store_subscription | §3.1 | SUBSCRIPTIONS & DELEGATION |
| 14 | lister_subscription | §3.2 | SUBSCRIPTIONS & DELEGATION |
| 15 | automation_subscription | §3.3 | SUBSCRIPTIONS & DELEGATION |
| 15b | bundle_subscription | §3.5 | SUBSCRIPTIONS & DELEGATION |
| 16 | delegated_access | §3.4 | SUBSCRIPTIONS & DELEGATION |
| 17 | category | §4.1 | CATALOG |
| 18 | category_attribute_schema | §4.2 | CATALOG |
| 19 | listing | §5.1 | LISTINGS |
| 20 | listing_image | §5.2 | LISTINGS |
| 21 | listing_offer | §5.3 | LISTINGS |
| 22 | watcher_offer | §5.3b | LISTINGS |
| 23 | offer_bundle_item | §5.3c | LISTINGS |
| 24 | listing_fee | §5.4 | LISTINGS |
| 25 | listing_version | §5.5 | LISTINGS |
| 26 | shipping_profile | §5.6 | LISTINGS |
| 27 | cart | §6.1 | COMMERCE |
| 28 | cart_item | §6.2 | COMMERCE |
| 29 | order | §6.3 | COMMERCE |
| 30 | order_item | §6.4 | COMMERCE |
| 31 | order_payment | §6.5 | COMMERCE |
| 32 | shipment | §7.1 | SHIPPING & RETURNS |
| 33 | return_request | §7.2 | SHIPPING & RETURNS |
| 34 | dispute | §7.3 | SHIPPING & RETURNS |
| 35 | review | §8.1 | REVIEWS & TRUST |
| 36 | review_response | §8.2 | REVIEWS & TRUST |
| 37 | seller_performance | §8.3 | REVIEWS & TRUST |
| 38 | buyer_review | §8.4 | REVIEWS & TRUST |
| 39 | conversation | §9.1 | MESSAGING |
| 40 | message | §9.2 | MESSAGING |
| 41 | notification | §10.1 | NOTIFICATIONS |
| 42 | notification_preference | §10.2 | NOTIFICATIONS |
| 43 | notification_template | §10.3 | NOTIFICATIONS |
| 44 | ledger_entry | §11.1 | FINANCE |
| 45 | seller_balance | §11.2 | FINANCE |
| 46 | payout_batch | §11.3 | FINANCE |
| 47 | payout | §11.4 | FINANCE |
| 48 | fee_schedule | §11.5 | FINANCE |
| 49 | reconciliation_report | §11.6 | FINANCE |
| 50 | manual_adjustment | §11.7 | FINANCE |
| 51 | crosslister_account | §12.1 | CROSSLISTER |
| 52 | channel_projection | §12.2 | CROSSLISTER |
| 53 | cross_job | §12.3 | CROSSLISTER |
| 54 | import_batch | §12.4 | CROSSLISTER |
| 55 | import_record | §12.5 | CROSSLISTER |
| 56 | dedupe_fingerprint | §12.6 | CROSSLISTER |
| 57 | channel_category_mapping | §12.7 | CROSSLISTER |
| 58 | channel_policy_rule | §12.8 | CROSSLISTER |
| 59 | automation_setting | §12.9 | CROSSLISTER |
| 59b | publish_credit_ledger | §12.10 | CROSSLISTER |
| 60 | helpdesk_case | §13.1 | HELPDESK & KNOWLEDGE BASE |
| 61 | case_message | §13.2 | HELPDESK & KNOWLEDGE BASE |
| 62 | case_event | §13.3 | HELPDESK & KNOWLEDGE BASE |
| 63 | case_watcher | §13.4 | HELPDESK & KNOWLEDGE BASE |
| 64 | case_csat | §13.5 | HELPDESK & KNOWLEDGE BASE |
| 65 | helpdesk_team | §13.6 | HELPDESK & KNOWLEDGE BASE |
| 66 | helpdesk_team_member | §13.7 | HELPDESK & KNOWLEDGE BASE |
| 67 | helpdesk_routing_rule | §13.8 | HELPDESK & KNOWLEDGE BASE |
| 68 | helpdesk_macro | §13.9 | HELPDESK & KNOWLEDGE BASE |
| 69 | helpdesk_sla_policy | §13.10 | HELPDESK & KNOWLEDGE BASE |
| 70 | helpdesk_automation_rule | §13.11 | HELPDESK & KNOWLEDGE BASE |
| 71 | helpdesk_saved_view | §13.12 | HELPDESK & KNOWLEDGE BASE |
| 72 | helpdesk_email_config | §13.13 | HELPDESK & KNOWLEDGE BASE |
| 73 | kb_category | §13.14 | HELPDESK & KNOWLEDGE BASE |
| 74 | kb_article | §13.15 | HELPDESK & KNOWLEDGE BASE |
| 75 | kb_article_attachment | §13.16 | HELPDESK & KNOWLEDGE BASE |
| 76 | kb_article_relation | §13.17 | HELPDESK & KNOWLEDGE BASE |
| 77 | kb_case_article_link | §13.18 | HELPDESK & KNOWLEDGE BASE |
| 78 | kb_article_feedback | §13.19 | HELPDESK & KNOWLEDGE BASE |
| 79 | platform_setting | §14.1 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 80 | platform_setting_history | §14.2 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 81 | feature_flag | §14.3 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 82 | audit_event | §14.4 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 83 | sequence_counter | §14.5 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 83b | module_registry | §14.5b | PLATFORM SETTINGS & INFRASTRUCTURE |
| 84 | custom_role | §14.6 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 85 | staff_user_custom_role | §14.7 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 86 | provider_adapter | §14.8 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 87 | provider_instance | §14.9 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 88 | provider_secret | §14.10 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 89 | provider_usage_mapping | §14.11 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 90 | provider_health_log | §14.12 | PLATFORM SETTINGS & INFRASTRUCTURE |
| 91 | promotion | §15.1 | PROMOTIONS |
| 92 | promotion_usage | §15.2 | PROMOTIONS |
| 93 | promoted_listing | §15.3 | PROMOTIONS |
| 93b | promoted_listing_event | §15.4 | PROMOTIONS |
| 94 | follow | §16.1 | SOCIAL |
| 95 | watchlist_item | §16.2 | SOCIAL |
| 96 | saved_search | §16.3 | SOCIAL |
| 97 | buyer_block_list | §20.5 | SOCIAL |
| 97b | trial_usage | §3.6 | SUBSCRIPTIONS & DELEGATION |
| 98 | tax_info | §17.1 | TAX |
| 99 | tax_quote | §17.2 | TAX |
| 100 | finance_subscription | §18.1 | FINANCE CENTER |
| 101 | expense | §18.2 | FINANCE CENTER |
| 102 | mileage_entry | §18.3 | FINANCE CENTER |
| 103 | financial_report | §18.4 | FINANCE CENTER |
| 104 | accounting_integration | §18.5 | FINANCE CENTER |
| 104b | financial_projection | §18.6 | FINANCE CENTER |
| 104c | recurring_expense | §18.7 | FINANCE CENTER |
| 105 | local_transaction | §19.1 | LOCAL, AUTHENTICATION & COMBINED SHIPPING |
| 106 | safe_meetup_location | §19.2 | LOCAL, AUTHENTICATION & COMBINED SHIPPING |
| 107 | combined_shipping_quote | §19.3 | LOCAL, AUTHENTICATION & COMBINED SHIPPING |
| 108 | authentication_request | §19.4 | LOCAL, AUTHENTICATION & COMBINED SHIPPING |
| 109 | authenticator_partner | §19.5 | LOCAL, AUTHENTICATION & COMBINED SHIPPING |
| 110 | listing_price_history | §27.1 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 111 | browsing_history | §27.2 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 112 | price_alert | §27.3 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 113 | category_alert | §27.4 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 114 | market_price_point | §20.6 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 115 | market_category_summary | §20.7 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 116 | market_listing_intelligence | §20.8 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 117 | market_offer_intelligence | §20.9 | GROWTH, ALERTS & MARKET INTELLIGENCE |
| 118 | affiliate | §21.1 | AFFILIATES, REFERRALS & PROMO CODES |
| 119 | referral | §21.2 | AFFILIATES, REFERRALS & PROMO CODES |
| 120 | promo_code | §21.3 | AFFILIATES, REFERRALS & PROMO CODES |
| 121 | promo_code_redemption | §21.4 | AFFILIATES, REFERRALS & PROMO CODES |
| 122 | affiliate_commission | §21.5 | AFFILIATES, REFERRALS & PROMO CODES |
| 123 | affiliate_payout | §21.6 | AFFILIATES, REFERRALS & PROMO CODES |
| 124 | interest_tag | §22.1 | PERSONALIZATION |
| 125 | user_interest | §22.2 | PERSONALIZATION |
| 126 | google_category_mapping | §23.1 | BUYER ACQUISITION |
| 127 | buyer_referral | §23.2 | BUYER ACQUISITION |
| 128 | listing_question | §24.1 | SOCIAL & DISCOVERY |
| 129 | curated_collection | §24.2 | SOCIAL & DISCOVERY |
| 130 | curated_collection_item | §24.3 | SOCIAL & DISCOVERY |
| 131 | live_session | §24.5 | SOCIAL & DISCOVERY |
| 132 | live_session_product | §24.6 | SOCIAL & DISCOVERY |
| 133 | stripe_event_log | §11.8 | FINANCE |
| 134 | buyer_protection_claim | §11.9 | FINANCE |
| 135 | seller_score_snapshot | §8.5 | REVIEWS & TRUST |

**Total: 144 tables** (75 enums).

---

## 26. TYPESENSE SEARCH INDEXES

| Index | Searchable Fields (weight) | Facets | Sort |
|-------|---------------------------|--------|------|
| `listings` | title (5), description (1), brand (4), tags (3), categoryPath (2) | category, condition, brand, priceRange, freeShipping, sellerStoreName | priceCents, createdAt, relevance, soldQuantity |
| `kb_articles` | title (5), excerpt (3), body (1), tags (4), searchKeywords (4) | category, audience | viewCount, helpfulRatio, publishedAt, relevance |
| `users` (admin) | name (3), email (5), username (4), phone (2) | isSeller, isBanned, buyerQualityTier | createdAt |
| `stores` | storeName (5), storeDescription (2), sellerUsername (3) | performanceBand, storeTier | averageRating, totalOrders |

Listing index updated on: listing create/update/delete, status change, boost change, price change.  
KB index updated on: article publish/unpublish/archive.

---

## 27. MIGRATION STRATEGY

### 27.1 Migration Tooling

- Drizzle Kit for migration generation (`drizzle-kit generate`)
- Migrations run in CI via GitHub Actions before deploy
- Each migration has a `up` and `down` function
- Migrations are sequential (timestamped prefix)

### 27.2 Phase-Gated Migrations

| Phase | Tables Created |
|-------|---------------|
| Phase A | user, session, account, verification, seller_profile, business_info, address, staff_user, staff_user_role, staff_session, platform_setting, platform_setting_history, feature_flag, audit_event, sequence_counter, category, category_attribute_schema, custom_role, staff_user_custom_role, provider_adapter, provider_instance, provider_secret, provider_usage_mapping, provider_health_log |
| Phase B | listing, listing_image, listing_version, listing_fee, shipping_profile, watcher_offer, offer_bundle_item, cart, cart_item, order, order_item, order_payment, shipment |
| Phase C | review, review_response, seller_performance, listing_offer, return_request, dispute, ledger_entry, seller_balance, fee_schedule, local_transaction, safe_meetup_location, combined_shipping_quote, authentication_request, authenticator_partner, listing_price_history, buyer_review |
| Phase D | storefront, storefront_custom_category, storefront_page, store_subscription, bundle_subscription, finance_subscription, expense, mileage_entry, financial_report, accounting_integration, promotion, promotion_usage, promoted_listing, delegated_access, browsing_history, price_alert, category_alert, market_price_point, market_category_summary, market_listing_intelligence, market_offer_intelligence |
| Phase E | conversation, message, notification, notification_preference, notification_template, helpdesk_case, case_message, case_event, case_watcher, case_csat, helpdesk_team, helpdesk_team_member, helpdesk_routing_rule, helpdesk_macro, helpdesk_sla_policy, helpdesk_automation_rule, helpdesk_saved_view, helpdesk_email_config, kb_category, kb_article, kb_article_attachment, kb_article_relation, kb_case_article_link, kb_article_feedback |
| Phase F | crosslister_account, channel_projection, cross_job, import_batch, import_record, dedupe_fingerprint, channel_category_mapping, channel_policy_rule, automation_setting, lister_subscription, automation_subscription |
| Phase G | tax_info, tax_quote, follow, watchlist_item, saved_search, payout_batch, payout, reconciliation_report, manual_adjustment, affiliate, referral, promo_code, promo_code_redemption, affiliate_commission, affiliate_payout, interest_tag, user_interest, google_category_mapping, buyer_referral |
| Phase A2 (schema addenda) | listing_question, curated_collection, curated_collection_item, live_session, live_session_product |

### 27.3 Database-Level Constraints

1. **Ledger immutability trigger:** Reject UPDATE/DELETE on `ledger_entry`
2. **Sequence counter locking:** `SELECT ... FOR UPDATE` on `sequence_counter` rows
3. **Cascade deletes:** Only on child tables (images, items, messages). Never cascade on financial or audit tables.
4. **Soft deletes:** Users, listings, orders are never hard-deleted. Use status fields and `deletionRequestedAt`.

### 27.4 Seeded Data (Phase A)

- 4 top-level categories with 2 levels of subcategories
- Fee schedules for all 4 fee buckets
- SLA policies for all 5 priorities
- Default helpdesk teams (5)
- Default routing rules (7)
- Default notification templates
- Sequence counters (order_number, case_number)
- Platform settings (all defaults from Platform Settings Canonical)
- Built-in provider adapters (20+): R2, S3, Backblaze B2, SES, SendGrid, Resend, Typesense, Algolia, Telnyx, Twilio, FCM, OneSignal, Stripe, Shippo, Centrifugo, Valkey, Console Logger (dev), with config schemas
- 1 SUPER_ADMIN staff user (dev only)

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 2.1.3 | 2026-03-14 | Added vacation mode auto-reply system (G3.7). Added vacationAutoReplyMessage column to sellerProfile (§2.3, text, nullable, default NULL). Separate from vacationMessage to allow custom seller message + auto-reply to buyer inquiries during vacation. Supports vacation mode feature with automatic response system. |
| 2.1.2 | 2026-03-12 | Added at-meetup photo evidence system (G2.16). Added meetupPhotoUrls text[] column to localTransaction (§19.1, default empty, not null) for R2 URLs. Added meetupPhotosAt timestamp column to localTransaction (§19.1, timestamp with time zone, nullable) for capture timestamp. Supports PhotoEvidenceCapture component with base64 encoding, encrypted upload, server-side validation, and fraud audit trail. Decision #130. |
| 2.1.1 | 2026-03-12 | Added escrow fraud detection system (G2.15). Added localFraudFlag table (§19.5) with userId, severity, status, reason, flaggedBy, reviewedBy fields. Added localFraudBannedAt column to user table (§2.1, timestamp with time zone, nullable). Added 2 new enums: localFraudFlagSeverityEnum (CONFIRMED/STRONG_SIGNAL/MANUAL_REVIEW), localFraudFlagStatusEnum (OPEN/CONFIRMED/DISMISSED). Added LOCAL_FRAUD_REVERSAL to ledgerEntryTypeEnum (§1.9). Renumbered authenticatorPartner from 19.5→19.6. Updated table count 144→145, enum count 75→77. |
| 2.1.0 | 2026-03-08 | Full reconciliation pass against codebase. Added 5 missing tables: publishCreditLedger (§12.10, F4), moduleRegistry (§14.5b), promotedListingEvent (§15.4), financialProjection (§18.6), recurringExpense (§18.7). Added 3 missing enums: creditTypeEnum (§1.2), moduleStateEnum (§1.12). Fixed channelListingStatusEnum to include UNMANAGED (Decision #112). Fixed pollTierEnum order + added LONGTAIL value (Decision #108). Updated table count 139→144, enum count →75. |
| 2.0.10 | 2026-03-08 | Added listerFreeExpiresAt column to sellerProfile (§2.3, timestamp with time zone, nullable, default NULL). Purpose: When the FREE ListerTier teaser expires (6 months from account creation). NULL = never had FREE tier or already on paid tier. Existing accounts with FREE tier + NULL listerFreeExpiresAt are grandfathered. Supports F5-Teaser feature (free tier auto-downgrade via Decision #105). 134 tables total. |
| 2.0.9 | 2026-03-08 | Added pollTierEnum (§1.10, 'COLD' \| 'WARM' \| 'HOT'). Added 4 polling columns to channelProjection (§12.2): pollTier (enum, default COLD), nextPollAt (timestamp), lastPolledAt (timestamp), prePollTier (enum). Added nextPollIdx index on channelProjection for scheduling optimization. Supports F5-S1 adaptive polling engine (Decision #96). 134 tables total. |
| 2.0.8 | 2026-03-03 | Added storefront_page table (§2.5d) for Puck custom pages (POWER+ tier). Added bundleTierEnum (§1.2, Decision #102). Added bundleTier + stripeCustomerId to sellerProfile (§2.3). Added bundleSubscription table (§3.5, Decision #101). Added pending change columns (pendingTier, pendingBillingInterval, pendingChangeAt) to storeSubscription (§3.1), listerSubscription (§3.2), financeSubscription (§18.1), and bundleSubscription (§3.5) per Decision #97. Added offerExpiryHours + shippingCents to listing (§5.1, Feature Lock-in line 51). Added counterByRole + shippingAddressId to listingOffer (§5.3). Added per-item TF columns (tfRateBps, tfAmountCents, feeBucket) to orderItem (§6.4). Added DSR columns (dsrItemAsDescribed, dsrShippingSpeed, dsrCommunication, dsrPackaging) to review (§8.1, Feature Lock-in lines 110-118). 134 tables total. |
| 2.0.7 | 2026-02-26 | A2.1 fix: renamed blocked_buyer → buyer_block_list (§20.5) with correct columns (blockerId, blockedId). Added 4 missing Finance Center tables (§18.2–18.5). A2.2: replaced §24 placeholders with 5 real Social & Discovery table definitions (§24.1–24.6). Added liveSessionStatusEnum (§1.14). Added 3 video fields to listing §5.1 (videoUrl, videoThumbUrl, videoDurationSeconds). Documented 3 previously undocumented addenda tables: buyer_review (§8.4), watcher_offer (§5.3b), offer_bundle_item (§5.3c). 132 tables total. |
| 2.0.5 | 2026-02-24 | Aligned enums with Pricing Canonical v3.2: StoreTier 7→5 (removed BASIC/PREMIUM/ELITE, added POWER), ListerTier 7→4 (removed PLUS/POWER/MAX/ENTERPRISE, added PRO), PerformanceBand 5→4 (EMERGING/ESTABLISHED/TOP_RATED/POWER_SELLER replaces old bands), FinanceTier 5→2 (FREE/PRO). |
| 2.0.6 | 2026-02-25 | Added storefront + storefront_custom_category tables (§2.5b, §2.5c). Added listing.storefrontCategoryId. Added PENDING to delegationStatusEnum. Fixed performanceBand default STANDARD→EMERGING. Renamed FVF→TF (ledger types, order, fee_schedule columns). Moved finance tables from Phase F→D. Added feeBucket deprecation comment. 124 tables total. |
| 2.0.4 | 2026-02-21 | Removed vestigial listing_offer flat counter fields (counterOfferCents, counterMessage) to enforce parent-child counter-offer chain model. |
| 2.0.3 | 2026-02-21 | Added missing offerTypeEnum and listing_offer chain fields (type, parentOfferId), inlined 8 missing enum declarations, and fixed consolidation gaps carried from v2.0.1. |
| 1.0 | 2026-02-15 | Initial schema lock. 88 tables, 52 enums, 4 Typesense indexes. |
| 1.1 | 2026-02-15 | Added provider system (§14.8–§14.12), custom roles (§14.6–§14.7), HTTP custom adapters. Provider enums in §1.13. 93 tables, 55 enums, 4 Typesense indexes. |
| 2.0 | 2026-02-21 | Consolidated base v1.1 with addenda v1.2/v1.3/v1.4/v1.6, inlined authoritative market intelligence tables, applied market intel review-note fixes, and reserved v1.5 social placeholders. 122 tables total. |

---

**Vocabulary: StoreTier (storefront subscription), ListerTier (crosslister subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**

**END OF SCHEMA — TWICELY_V3_SCHEMA.md**
