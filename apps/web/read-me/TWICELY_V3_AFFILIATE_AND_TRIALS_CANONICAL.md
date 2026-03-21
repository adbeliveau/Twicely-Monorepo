# TWICELY V3 — Affiliate Program & Free Trials Canonical

**Version:** v1.0  
**Status:** LOCKED — single source of truth for referral program, affiliate commissions, promo codes, and free trials  
**Date:** 2026-02-17  
**Author:** Platform Architect  
**Purpose:** Define the affiliate/referral program, influencer partnerships, promotional code system, and free trial mechanics for Twicely V3. All code referencing referrals, affiliates, promo codes, or trials must conform to this document.

---

## 1. OVERVIEW

Two growth levers covered here:

1. **Affiliate Program** — Referral links and promo codes that reward people (sellers, influencers, partners) for bringing new users to Twicely. Commission on referred users' subscriptions for 12 months.
2. **Free Trials** — Time-limited access to paid subscription tiers so new sellers can experience the product before committing. Powered by Stripe trial periods.

These are independent systems that work together: an influencer shares a link → new user signs up → gets a 14-day free trial of Lister Lite → converts to paid → influencer earns commission for 12 months.

---

## 2. AFFILIATE PROGRAM

### 2.1 Two-Tier Structure

| Tier | Who | How They Join | Commission Rate | Attribution Window | Commission Duration |
|------|-----|---------------|-----------------|-------------------|---------------------|
| **Community** | Any Twicely seller | Self-serve signup in seller dashboard | 15% of referred subscription revenue | 30-day cookie | 12 months from signup |
| **Influencer** | Invited creators, bloggers, YouTubers, resale educators | Application → manual approval by admin | 20–30% (negotiated per partner) | 60-day cookie | 12 months from signup |

### 2.2 What Earns Commission

| Revenue Source | Commissionable? | Why |
|----------------|-----------------|-----|
| Store subscriptions | ✅ Yes | Recurring revenue, high LTV |
| Crosslister subscriptions | ✅ Yes | Recurring revenue, high LTV |
| Finance subscriptions | ✅ Yes | Recurring revenue |
| Automation add-on | ✅ Yes | Recurring revenue |
| Bundles | ✅ Yes | Treated as combined subscription |
| Overage packs | ❌ No | One-time, low-margin |
| TF (marketplace fees) | ❌ No | Transactional, margin too thin |
| Boosting spend | ❌ No | Transactional, pass-through |
| Insertion fees | ❌ No | Transactional, micro-amounts |
| Authentication fees | ❌ No | Cost-plus pricing, no margin |

**Commission base:** Net subscription revenue (after Stripe processing fees, before Twicely margin). If referred user pays $13.99/mo for Lister Lite and Stripe takes ~$0.71, commission base is $13.28. At 15%, community affiliate earns $1.99/mo.

### 2.3 Attribution Rules

| Rule | Detail |
|------|--------|
| **First-touch attribution** | The FIRST affiliate link a user clicks gets the credit. No last-touch override. |
| **Cookie duration** | Community: 30 days. Influencer: 60 days. |
| **Self-referral** | Forbidden. Affiliate cannot refer themselves or accounts sharing the same payment method. |
| **Existing users** | No commission. Only NEW account signups qualify. Account must not exist at time of click. |
| **Multiple affiliates** | First click wins. If user clicks Affiliate A's link, then Affiliate B's link 5 days later, Affiliate A gets credit. |
| **Trial conversion required** | Commission starts ONLY when the referred user's first paid invoice is successfully charged. No commission during free trial period. |
| **Cancellation** | If referred user cancels, commission stops immediately. No clawback on already-paid commissions. |
| **Refund** | If a subscription payment is refunded, the corresponding commission is reversed in the next payout cycle. |
| **Chargeback** | Commission reversed + affiliate flagged for review if pattern emerges. |

### 2.4 Promo Codes

Affiliates can create custom promo codes that give referred users a discount AND attribute the signup to the affiliate.

| Field | Rules |
|-------|-------|
| **Format** | 4–20 characters, alphanumeric + hyphens. Auto-uppercased. Must be unique across platform. |
| **Discount type** | Percentage off first X months OR fixed dollar amount off first month |
| **Max discount** | Community: up to 20% off for up to 3 months. Influencer: up to 50% off for up to 6 months (negotiated). |
| **Usage limit** | Optional cap per code (e.g., "first 100 uses"). Unlimited if not set. |
| **Expiry** | Optional expiry date. No expiry if not set. |
| **Stacking** | Promo code CANNOT stack with platform-wide coupons (§2.5). One promotional discount per checkout. |
| **Scope** | Code can be scoped to specific products (e.g., Lister subscriptions only) or all subscriptions. |

Example: Influencer "ResaleQueen" creates code `RESALE20` → new users get 20% off their first 3 months of any subscription → ResaleQueen earns 25% commission on the (discounted) subscription revenue for 12 months.

### 2.5 Platform Promo Codes (Admin-Created)

Admin can create platform-wide promotional codes separate from affiliate codes.

| Type | Example | Use Case |
|------|---------|----------|
| **Welcome discount** | `WELCOME20` — 20% off first month | New user acquisition campaigns |
| **Seasonal** | `SPRING2026` — 15% off 2 months | Seasonal marketing pushes |
| **Partner** | `EBAYSELLER` — 30% off 3 months of Lister Lite | Platform-specific acquisition |
| **Event** | `POSHFEST26` — 25% off 1 month | Conference/event partnerships |
| **Win-back** | `COMEBACK` — 50% off 1 month | Reactivation for churned users |

Admin promo codes do NOT earn affiliate commission (no affiliate attribution). If a user has both an affiliate cookie AND enters an admin promo code, the affiliate still gets attribution but commission is calculated on the discounted amount.

### 2.6 Payouts

| Rule | Detail |
|------|--------|
| **Minimum payout** | $25. Balance rolls over if under minimum. |
| **Payout frequency** | Monthly, on the 15th, for the prior month's confirmed commissions. |
| **Payout methods** | Stripe Connect (preferred — already integrated) or PayPal. |
| **Hold period** | 30-day hold on commissions before they become payable. Protects against trial churn and refunds. |
| **Tax** | Affiliates earning $600+/year receive 1099-NEC. Must provide tax info (SSN/EIN) before first payout. |
| **Currency** | USD only at launch. |

### 2.7 Affiliate Dashboard (Seller Dashboard Tab)

Every affiliate sees:

```
┌──────────────────────────────────────────────────────────────┐
│  📊 Affiliate Overview                                       │
│                                                              │
│  Referral Link: twicely.co/ref/USERNAME     [Copy]           │
│  Promo Code: MYCODE20                       [Edit]           │
│                                                              │
│  This Month          All Time                                │
│  ─────────           ────────                                │
│  Clicks: 342         Clicks: 4,891                           │
│  Signups: 28         Signups: 412                            │
│  Conversions: 12     Conversions: 187                        │
│  Conv. Rate: 3.5%    Conv. Rate: 3.8%                        │
│  Earnings: $43.20    Total Earned: $2,847.60                 │
│                                                              │
│  Pending Balance: $43.20 (payable after Feb 15)              │
│  Available Balance: $127.40                                  │
│  Next Payout: Mar 15, 2026                                   │
│                                                              │
│  [Request Payout]  [View Referred Users]  [Download Report]  │
└──────────────────────────────────────────────────────────────┘
```

Referred user list shows: username (anonymized after 30 days), signup date, subscription tier, commission earned, status (trialing/active/cancelled).

### 2.8 Influencer Dashboard (Extended)

Influencer tier gets additional features:

- Multiple promo codes (up to 10 active simultaneously)
- Custom landing pages: `twicely.co/p/INFLUENCER-NAME` with personalized messaging
- Campaign tracking: UTM parameter support for multi-channel attribution
- Dedicated affiliate manager contact
- Monthly performance reports via email
- Early access to new features for content creation

### 2.9 Anti-Fraud

| Check | Action |
|-------|--------|
| Same IP/device for affiliate + referred user | Block attribution, flag affiliate |
| Same payment method across accounts | Block attribution, flag affiliate |
| Referred user cancels within 48 hours repeatedly | Flag affiliate after 3 occurrences |
| Bot traffic patterns (high clicks, zero signups) | Throttle link, notify admin |
| Affiliate creates fake accounts | Permanent ban, forfeiture of pending balance |
| Geographic anomaly (clicks from bot farms) | Auto-pause affiliate, admin review |

Three strikes policy: first warning, second suspension (30 days), third permanent ban.

---

## 3. FREE TRIALS

### 3.1 Trial Configuration

| Product | Trial Duration | Trial Tier | Auto-Convert To |
|---------|---------------|------------|-----------------|
| **Crosslister** | 14 days | Lister Lite | Lister Lite (or downgrade to Free if no payment method) |
| **Store** | 7 days | Store Starter | Store Starter (or cancel if no payment method) |
| **Automation** | 14 days | Full access | $9.99/mo (requires Lister Lite+ to activate trial) |
| **Finance** | 14 days | Finance Pro | Finance Pro (or downgrade to Free) |
| **Bundles** | 14 days | Full bundle | Bundle pricing |

**Why these tiers:** Trial should showcase enough value to convert. Lister Lite gives 200 publishes, auto-delist, multi-platform templates — enough to feel the power without giving away the farm. Store Starter gives announcement bar, social links, templates — enough to see the storefront value.

### 3.2 Trial Rules

| Rule | Detail |
|------|--------|
| **One trial per product per account** | User who trials Lister Lite cannot trial it again. Can still trial Store separately. |
| **Payment method required?** | NO for trial start. Required before trial ends to convert. If no payment method at expiry → downgrade to free tier. |
| **Usage during trial** | Full access to the trial tier's features. Publish counts, AI credits, etc. all use trial tier's limits. |
| **Trial extension** | Admin can extend trials per-user (e.g., "user had onboarding issues, give 7 more days"). Max extension: 14 additional days. |
| **Early conversion** | User can convert to paid at any time during trial. Billing starts immediately. |
| **Trial cancellation** | User can cancel trial anytime → immediate downgrade to free tier. No charge. |
| **Trial + affiliate** | If user signed up through affiliate link, affiliate commission starts only AFTER trial converts to paid. |
| **Abuse prevention** | Same email domain rate limit: max 5 trial activations per domain per 30 days (prevents company-wide abuse). |
| **Downgrade behavior** | On trial expiry without payment: all features revert to free tier. Active crosslisted listings remain (no delist). Storefront goes to draft. No data loss. |

### 3.3 Implementation (Stripe-Native)

Trials use Stripe's built-in `trial_end` on subscriptions. No custom trial tracking tables needed.

```
Flow:
1. User clicks "Start Free Trial" on pricing page
2. Stripe subscription created with trial_period_days: 14
3. sellerProfile.listerTier = 'LITE' (or whichever trial tier)
4. Stripe webhook: customer.subscription.trial_will_end (3 days before)
   → Email: "Your trial ends in 3 days. Add payment to keep your features."
5a. User adds payment → Stripe auto-charges at trial end → commission starts
5b. No payment → subscription cancelled → tier reverts to FREE/NONE
   → Email: "Your trial has ended. Upgrade anytime to get your features back."
```

**Platform settings for trials:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `trials.lister.enabled` | boolean | true | Enable crosslister free trials |
| `trials.lister.durationDays` | number | 14 | Crosslister trial duration |
| `trials.lister.tier` | ListerTier | LITE | Tier granted during trial |
| `trials.store.enabled` | boolean | true | Enable store free trials |
| `trials.store.durationDays` | number | 7 | Store trial duration |
| `trials.store.tier` | StoreTier | STARTER | Tier granted during trial |
| `trials.automation.enabled` | boolean | true | Enable automation trial |
| `trials.automation.durationDays` | number | 14 | Automation trial duration |
| `trials.finance.enabled` | boolean | true | Enable finance trial |
| `trials.finance.durationDays` | number | 14 | Finance trial duration |
| `trials.finance.tier` | FinanceTier | PRO | Tier granted during trial |
| `trials.maxExtensionDays` | number | 14 | Max admin trial extension |

### 3.4 Trial UI

**Pricing page:** Each paid tier shows "Start 14-Day Free Trial" button (or "Start 7-Day Free Trial" for store).

**During trial — global banner:**
```
🎉 You're on a free trial of Lister Lite — 11 days remaining.
[Add Payment Method]  [Explore Features]
```

**3 days before expiry — email + in-app notification:**
```
Your Lister Lite trial ends in 3 days. Here's what you've done so far:
- 47 listings crosslisted to 3 platforms
- 6 sales attributed to crosslisting ($342 revenue)
- 2 hours saved with bulk actions

Add a payment method to keep these features → [Upgrade Now]
```

**On expiry without payment — email:**
```
Your trial has ended, but your listings and data are safe.
Upgrade anytime to pick up where you left off → [See Plans]
```

### 3.5 Trial + Affiliate Interaction

When a user arrives via affiliate link AND starts a trial:

1. Affiliate cookie is set (30 or 60 day)
2. `referral` record created with `convertedAt = NULL`
3. Trial starts, user gets full tier access
4. **No commission accrues during trial**
5. On paid conversion: `referral.convertedAt` set, commission tracking begins
6. If trial expires without conversion: referral record stays (cookie still valid), user can convert later within cookie window

---

## 4. SCHEMA

### 4.1 Enums

```typescript
export const affiliateTierEnum = pgEnum('affiliate_tier', ['COMMUNITY', 'INFLUENCER']);

export const affiliateStatusEnum = pgEnum('affiliate_status', [
  'PENDING',     // Applied, awaiting approval (influencer only)
  'ACTIVE',      // Approved and earning
  'SUSPENDED',   // Temporarily suspended (fraud review)
  'BANNED',      // Permanently banned
]);

export const referralStatusEnum = pgEnum('referral_status', [
  'CLICKED',     // Link clicked, no signup yet
  'SIGNED_UP',   // Account created, no subscription
  'TRIALING',    // On free trial
  'CONVERTED',   // First paid invoice charged
  'CHURNED',     // Cancelled subscription
]);

export const promoCodeTypeEnum = pgEnum('promo_code_type', [
  'AFFILIATE',   // Created by affiliate, attributes to them
  'PLATFORM',    // Created by admin, no affiliate attribution
]);

export const promoDiscountTypeEnum = pgEnum('promo_discount_type', [
  'PERCENTAGE',  // X% off
  'FIXED',       // $X off
]);

export const commissionStatusEnum = pgEnum('commission_status', [
  'PENDING',     // Within 30-day hold period
  'PAYABLE',     // Hold cleared, eligible for payout
  'PAID',        // Included in a payout
  'REVERSED',    // Refund/chargeback reversal
]);
```

### 4.2 Tables

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
  referralCodeIdx:     unique().on(table.referralCode),
  userIdx:             index('aff_user').on(table.userId),
  statusIdx:           index('aff_status').on(table.status),
}));

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

export const promoCode = pgTable('promo_code', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  code:                text('code').notNull().unique(),              // Uppercased, 4-20 chars
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
  codeIdx:             unique().on(table.code),
  affiliateIdx:        index('pc_affiliate').on(table.affiliateId),
  typeIdx:             index('pc_type').on(table.type),
}));

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

**Table count: 6 new tables** (affiliate, referral, promoCode, promoCodeRedemption, affiliateCommission, affiliatePayout).

**Enum count: 6 new enums** (affiliateTier, affiliateStatus, referralStatus, promoCodeType, promoDiscountType, commissionStatus).

### 4.3 Field Additions to Existing Tables

```typescript
// sellerProfile — add:
trialListerUsed:       boolean('trial_lister_used').notNull().default(false),
trialStoreUsed:        boolean('trial_store_used').notNull().default(false),
trialAutomationUsed:   boolean('trial_automation_used').notNull().default(false),
trialFinanceUsed:      boolean('trial_finance_used').notNull().default(false),

// user — add:
referredByAffiliateId: text('referred_by_affiliate_id').references(() => affiliate.id),
```

---

## 5. STRIPE INTEGRATION

### 5.1 Trials

```
Stripe subscription create:
  trial_period_days: 14  (or 7 for store)
  payment_behavior: 'default_incomplete'  (no charge during trial)

Webhooks:
  customer.subscription.trial_will_end  → Send "trial ending" email (3 days before)
  invoice.paid (first after trial)       → Set referral.convertedAt, start commission tracking
  customer.subscription.deleted          → Revert tier, set referral.churnedAt
```

### 5.2 Promo Codes

Promo codes are synced to Stripe as `PromotionCode` objects linked to `Coupon` objects.

```
On promo code creation in Twicely:
  1. Create Stripe Coupon (percent_off or amount_off, duration: repeating, duration_in_months)
  2. Create Stripe PromotionCode (code, coupon, max_redemptions, expires_at)
  3. Store Stripe IDs on promoCode record

On checkout:
  1. User enters code → validate against Twicely promoCode table
  2. Apply Stripe PromotionCode to subscription
  3. Create promoCodeRedemption record
```

### 5.3 Affiliate Payouts

```
Monthly payout job (15th of each month):
  1. Query all PAYABLE commissions where holdExpiresAt < now
  2. Group by affiliate
  3. For each affiliate with balance >= $25:
     a. If method = 'stripe_connect': Create Stripe Transfer to connected account
     b. If method = 'paypal': Add to PayPal batch payout
  4. Create affiliatePayout record
  5. Update affiliate.availableBalanceCents and affiliate.totalPaidCents
  6. Move commission status to PAID
```

### 5.4 Stripe Product Mapping (Additions)

```
twicely_affiliate_payout  | Transfer    | Affiliate commission payout
```

No new Stripe subscription products needed — trials use existing subscription products with `trial_period_days`.

---

## 6. PLATFORM SETTINGS

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `affiliate.enabled` | boolean | true | Master switch for affiliate program |
| `affiliate.community.enabled` | boolean | true | Allow self-serve affiliate signup |
| `affiliate.community.commissionRateBps` | number | 1500 | Default community commission (15%) |
| `affiliate.community.cookieDays` | number | 30 | Community cookie duration |
| `affiliate.influencer.enabled` | boolean | true | Allow influencer applications |
| `affiliate.influencer.defaultCommissionRateBps` | number | 2500 | Default influencer commission (25%) |
| `affiliate.influencer.cookieDays` | number | 60 | Influencer cookie duration |
| `affiliate.commissionDurationMonths` | number | 12 | How long commissions last |
| `affiliate.holdDays` | number | 30 | Hold period before commission is payable |
| `affiliate.minPayoutCents` | number | 2500 | Minimum payout threshold ($25) |
| `affiliate.maxPromoDiscountBps` | number | 2000 | Max community promo discount (20%) |
| `affiliate.maxInfluencerDiscountBps` | number | 5000 | Max influencer promo discount (50%) |
| `trials.lister.enabled` | boolean | true | Enable crosslister free trials |
| `trials.lister.durationDays` | number | 14 | Crosslister trial duration |
| `trials.lister.tier` | string | LITE | Tier granted during trial |
| `trials.store.enabled` | boolean | true | Enable store free trials |
| `trials.store.durationDays` | number | 7 | Store trial duration |
| `trials.store.tier` | string | STARTER | Tier granted during trial |
| `trials.automation.enabled` | boolean | true | Enable automation trial |
| `trials.automation.durationDays` | number | 14 | Automation trial duration |
| `trials.finance.enabled` | boolean | true | Enable finance trial |
| `trials.finance.durationDays` | number | 14 | Finance trial duration |
| `trials.finance.tier` | string | PRO | Finance tier during trial |
| `trials.maxExtensionDays` | number | 14 | Max admin extension |

---

## 7. ROUTES

### 7.1 Marketplace Routes

| Route | Purpose | Gate |
|-------|---------|------|
| `/ref/{code}` | Affiliate referral redirect (sets cookie, redirects to signup) | Public |
| `/p/{slug}` | Influencer custom landing page | Public |
| `/my/selling/affiliate` | Affiliate dashboard (join, stats, promo codes, payouts) | SELLER |
| `/my/selling/affiliate/payouts` | Payout history | SELLER + affiliate |
| `/my/selling/affiliate/referrals` | Referred users list | SELLER + affiliate |

### 7.2 Hub Routes (Admin)

| Route | Purpose | Gate |
|-------|---------|------|
| `/cfg/affiliates` | Affiliate program settings | SUPER_ADMIN or finance scope |
| `/cfg/trials` | Trial configuration | SUPER_ADMIN or finance scope |
| `/usr/affiliates` | Manage affiliates (approve, suspend, ban) | SUPER_ADMIN or finance scope |
| `/usr/affiliates/{id}` | Individual affiliate detail | SUPER_ADMIN or finance scope |
| `/fin/affiliate-payouts` | Payout batch management | SUPER_ADMIN or finance scope |
| `/fin/promo-codes` | Platform promo code management | SUPER_ADMIN or marketing scope |

---

## 8. CASL PERMISSIONS

```typescript
// Affiliate subject
{ action: 'read', subject: 'Affiliate', conditions: { userId } }     // Own affiliate record
{ action: 'manage', subject: 'Affiliate', conditions: { userId } }   // Own record (create, update)

// PromoCode subject
{ action: 'create', subject: 'PromoCode', conditions: { affiliateId } }  // Own codes
{ action: 'read', subject: 'PromoCode', conditions: { affiliateId } }
{ action: 'update', subject: 'PromoCode', conditions: { affiliateId } }
{ action: 'delete', subject: 'PromoCode', conditions: { affiliateId } }

// Referral subject (read-only for affiliates)
{ action: 'read', subject: 'Referral', conditions: { affiliateId } }

// Commission subject (read-only for affiliates)
{ action: 'read', subject: 'AffiliateCommission', conditions: { affiliateId } }

// Staff abilities
{ action: 'manage', subject: 'Affiliate' }        // finance.manage scope
{ action: 'manage', subject: 'PromoCode' }         // marketing.manage scope
{ action: 'manage', subject: 'AffiliatePayout' }   // finance.manage scope
```

---

## 9. LEDGER INTEGRATION

Commission payouts create ledger entries in the finance engine:

```
Event: Affiliate payout executed

Entries:
  1. AFFILIATE_COMMISSION_PAYOUT    -{payoutAmountCents}

metadata: { affiliateId, payoutId, method, periodStart, periodEnd, commissionCount }
```

This is a platform expense, not a seller balance deduction. Tracked for P&L reporting.

---

## 10. BUILD PHASE

| Feature | Phase | Depends On |
|---------|-------|------------|
| Free trials (Stripe trial_period_days) | C3 (Stripe Connect) | Stripe subscription setup |
| Trial UI (banner, pricing page CTAs) | C3 | Trial backend |
| Affiliate schema + tables | G1 (Onboarding) | Schema addendum |
| Community affiliate self-serve | G1 | Affiliate schema |
| Affiliate dashboard | G1 | Community affiliate |
| Promo code system | G1 | Affiliate + Stripe promo codes |
| Influencer applications + approval | G2 | Community affiliate |
| Influencer landing pages | G2 | Influencer approval |
| Affiliate payouts (monthly job) | G3 | Finance engine + affiliate schema |
| Admin affiliate management | G3 | Hub admin pages |
| Anti-fraud checks | G3 | Affiliate + referral data |

**Trials go in Phase C3** (small addition to Stripe subscription setup).  
**Affiliate program goes in Phase G** (growth feature, needs working marketplace first).

---

## 11. WHAT IS EXPLICITLY FORBIDDEN

❌ Last-touch attribution (always first-touch)  
❌ Commission on TF, boosting, insertion fees, authentication, or overage packs  
❌ Self-referral or same-payment-method referral  
❌ Commission during free trial period (only on paid conversion)  
❌ Stacking affiliate promo code + platform promo code  
❌ Unlimited trial extensions (max 14 additional days)  
❌ Paying commissions before 30-day hold clears  
❌ Clawback on already-paid commissions (only reverse PENDING/PAYABLE)  
❌ Multiple trials of the same product per account  
❌ Hardcoding commission rates (must use platform settings, per-affiliate overrides)  
❌ Using `SellerTier` or `SubscriptionTier` anywhere in affiliate code  

---

## 12. REVENUE IMPACT

Updated revenue streams (additions to Pricing Canonical v3.2 §1):

| # | Stream | Type |
|---|--------|------|
| 12 | **Affiliate commissions** | Expense (contra-revenue on subscriptions) |

Affiliate commissions are NOT a new revenue stream — they are a customer acquisition cost that reduces net subscription revenue. Track separately in P&L as "Affiliate Commission Expense."

Expected metrics at scale:
- 15-25% of new signups come through affiliates
- Average commission: ~$4/mo per converted referral
- CAC through affiliates: ~$48/year vs ~$80-120 for paid ads
- Breakeven if referred user retains 4+ months (typical SaaS retention: 8-14 months)

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-17 | Initial lock. Two-tier affiliate program (Community 15% + Influencer 20-30%). Promo code system (affiliate + platform). Free trials (Stripe-native, 7-14 days). 6 new tables, 6 new enums. Build: trials in C3, affiliate in G. |

---

**This document is the single source of truth for Twicely V3 affiliate program and free trial mechanics.**  
**Vocabulary: ListerTier (crosslister subscription), StoreTier (storefront subscription), PerformanceBand (earned). Never use SellerTier or SubscriptionTier.**

**END OF DOCUMENT — TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md**
