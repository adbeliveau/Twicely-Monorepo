# TWICELY V3 — Pricing, Payments & Payout Canonical v3.2

**Version:** 3.2 | **Date:** 2026-02-23 | **Status:** LOCKED
**Owner:** Adrian | **Approved:** 2026-02-23
**Supersedes:** TWICELY_V3_MONETIZATION_PRICING_CANONICAL_v2_0, TWICELY_V3_PRICING_RESTRUCTURE_v3_1

---

## 0. PURPOSE

This document is the single source of truth for all pricing, fees, subscriptions, payout rules, escrow logic, and payment UX language in Twicely V3. Claude Code must READ THIS FIRST before touching any fee calculation, payout logic, subscription management, checkout flow, or seller dashboard component.

**Companion documents (read in order):**
1. This document (pricing, tiers, fees, payouts)
2. `TWICELY_V3_ORDER_LIFECYCLE_PAYMENT_FLOW.md` (escrow pipeline, fund release, BullMQ jobs, Shippo integration)
3. `Twicely_Payments_UX_Legal_Microcopy_Pack.pdf` (mandatory UI copy for all money screens)
4. `TWICELY_V3_PLATFORM_SETTINGS_CANONICAL.md` (admin-configurable keys for every value in this doc)

**Core rule:** Every number in this document has a corresponding admin-configurable key in Platform Settings. Zero hardcoded business logic values in application code. If it's in this spec, it's in a setting.

---

## 1. REVENUE STREAMS

| # | Stream | Type | How It Works |
|---|--------|------|-------------|
| 1 | **Transaction Fee (TF)** | Transactional | 8–11% progressive brackets on Twicely marketplace sales |
| 2 | **Store Subscriptions** | Recurring | NONE / STARTER / PRO / POWER / ENTERPRISE |
| 3 | **Crosslister Subscriptions** | Recurring | NONE / FREE / LITE / PRO |
| 4 | **Finance Subscriptions** | Recurring | FREE / PRO (standalone or bundled) |
| 5 | **Automation Add-On** | Recurring | $9.99/mo (annual) / $12.99/mo |
| 6 | **Bundles** | Recurring | Discounted Store + Crosslister + Finance combos |
| 7 | **Boosting** | Transactional | 1–8% seller-controlled promoted placement |
| 8 | **Insertion Fees** | Transactional | $0.05–$0.35 per listing over monthly free allowance |
| 9 | **Authentication** | Per-item | $19.99 buyer/seller; $39.99 expert |
| 10 | **Local Transaction Fee** | Transactional | 5% on in-app local payments |
| 11 | **Overage Packs** | Usage-based | $9 per pack |
| 12 | **Payout Fees** | Transactional | $1.00/daily payout, $2.50 instant |

**What is NOT revenue:**
- Stripe processing fees (2.9% + $0.30) — pass-through, shown separately to seller
- Off-platform sales fees — $0 by design
- Import fees — $0, always free, always exempt from insertion fees

---

## 2. TRANSACTION FEE (TF) — 8 Progressive Brackets

### 2.1 Bracket Structure

Calendar month. Marginal rates (each dollar taxed at its bracket rate, like income tax).

| Bracket | Monthly Twicely GMV | Marginal TF Rate | Seller Segment |
|---------|-------------------|-----------------|----------------|
| 1 | $0 – $499 | **10.0%** | New/casual — welcome rate |
| 2 | $500 – $1,999 | **11.0%** | Hobbyist — standard ceiling |
| 3 | $2,000 – $4,999 | **10.5%** | Part-time |
| 4 | $5,000 – $9,999 | **10.0%** | Full-time |
| 5 | $10,000 – $24,999 | **9.5%** | Established |
| 6 | $25,000 – $49,999 | **9.0%** | Power seller |
| 7 | $50,000 – $99,999 | **8.5%** | Top seller |
| 8 | $100,000+ | **8.0%** | Enterprise/whale — floor |

### 2.2 Rules

| Rule | Detail |
|------|--------|
| Minimum TF per order | $0.50 |
| Calendar month reset | GMV counter resets on 1st of each month (not rolling 30-day) |
| Progressive/marginal | Each dollar taxed at its bracket rate. Effective rate declines monotonically |
| Returns | Reduce current month's GMV. TF refunded at rate originally charged on that order |
| Boosted sales | TF applies on full sale price. Boost fee is separate and additional |
| Local sales | Local TF (5%) replaces standard TF brackets. Does NOT count toward monthly GMV |
| Stripe fee | Shown as separate line item to seller. NOT included in TF percentage |
| Dashboard display | Show **effective rate** (always decreasing), not marginal rate |

### 2.3 Effective Rates

| Monthly GMV | Effective TF | + Stripe (~3.2%) | vs eBay No-Store (13.6%) | vs eBay Basic+ (12.7%) |
|-------------|-------------|------------------|--------------------------|------------------------|
| $300 | 10.0% | 13.2% | Beats | Beats (+ no $0.40/order) |
| $1,000 | 10.5% | 13.7% | Beats on <$75 sales | Close |
| $3,000 | 10.67% | 13.87% | Beats on <$75 sales | Close |
| $5,000 | 10.6% | 13.8% | Beats | Close |
| $10,000 | 10.3% | 13.5% | Beats | Beats |
| $25,000 | 9.82% | 13.02% | Beats | Beats |
| $50,000 | 9.41% | 12.61% | Beats | Beats |
| $100,000 | 8.96% | 12.16% | Beats | Beats |

### 2.4 Platform Settings Keys

```
commerce.tf.bracket1.maxCents: 49900
commerce.tf.bracket1.rate: 1000          // basis points (10.00%)
commerce.tf.bracket2.maxCents: 199900
commerce.tf.bracket2.rate: 1100
commerce.tf.bracket3.maxCents: 499900
commerce.tf.bracket3.rate: 1050
commerce.tf.bracket4.maxCents: 999900
commerce.tf.bracket4.rate: 1000
commerce.tf.bracket5.maxCents: 2499900
commerce.tf.bracket5.rate: 950
commerce.tf.bracket6.maxCents: 4999900
commerce.tf.bracket6.rate: 900
commerce.tf.bracket7.maxCents: 9999900
commerce.tf.bracket7.rate: 850
commerce.tf.bracket8.maxCents: null       // unlimited
commerce.tf.bracket8.rate: 800
commerce.tf.minimumCents: 50             // $0.50 minimum TF per order
commerce.tf.gmvWindowType: 'calendar_month'
```

### 2.5 Marketing Headline

> "Your first $500 every month? Just 10%. The more you sell, the lower it goes — all the way down to 8%."

---

## 3. STRIPE FEE DISPLAY

### 3.1 Order Breakdown (Seller View)

```
Sale:                        $50.00
─────────────────────────────────────
Transaction Fee (10%):       -$5.00      ← Twicely revenue
Payment Processing:          -$1.75      ← Stripe (pass-through)
─────────────────────────────────────
Net Earnings:                $43.25
```

### 3.2 Stripe Connect Costs (Twicely Absorbs)

| Cost | Amount | Trigger | Setting Key |
|------|--------|---------|-------------|
| Active account fee | $2.00/month | Only in months payouts sent | `stripe.activeAccountFeeCents: 200` |
| Per payout | $0.25 + 0.25% | Each payout to bank | `stripe.payoutFixedCents: 25` / `stripe.payoutPercentBps: 25` |
| Funds routing | 0.25% of payout volume | All payout volume | `stripe.fundsRoutingBps: 25` |
| Instant payout | 1% of payout volume | Seller-initiated | `stripe.instantPayoutBps: 100` |
| Subscription billing | 0.5% of subscription revenue | Twicely absorbs | `stripe.subscriptionBillingBps: 50` |
| 1099 e-file IRS | $2.99/seller/year | Annual | `stripe.irsEfileCents: 299` |
| 1099 e-file state | $1.49/seller/year | Annual | `stripe.stateEfileCents: 149` |

### 3.3 Payout UX Language (MANDATORY — Per UX Language Pack v1.0)

**NEVER USE in UI, emails, notifications, help center, support scripts:**
- "Twicely Balance"
- "Twicely wallet"
- "Funds in your Twicely account"
- "Withdraw from Twicely"
- "Deposit into Twicely"

**ALWAYS USE:**
- "Available for payout" (not "balance")
- "Pending payout" (not "pending balance")
- "Paid out" (not "withdrawn")
- "On hold" (not "frozen" or "reserved")
- "Processed and paid out through Stripe" (disclosure on every money screen)

**Standard disclosure** (appears on dashboard card, payout page, transaction detail, payout settings):
> "Funds are processed and paid out through Stripe. Twicely displays payout status and transaction activity."

**Backend table names** (`seller_balance`, `balance_ledger_entry`) are fine — legal risk comes exclusively from UI labels implying custodial possession, not internal naming.

**Reference:** `Twicely_Payments_UX_Legal_Microcopy_Pack.pdf` for complete copy set including dashboard cards, payout page headers, transaction row labels, notification templates, tooltip library, holds/disputes copy, and support agent scripts.

---

## 4. STORE SUBSCRIPTIONS

### 4.1 Enum

```typescript
enum StoreTier { NONE = 'NONE', STARTER = 'STARTER', PRO = 'PRO', POWER = 'POWER', ENTERPRISE = 'ENTERPRISE' }
```

### 4.2 Pricing

| Tier | Annual/mo | Monthly | Free Listings/mo | Insertion Fee | Key Unlock |
|------|-----------|---------|-----------------|---------------|------------|
| Free (NONE) | $0 | $0 | 100 | $0.35 | Seller profile (PERSONAL) or basic storefront (BUSINESS) |
| Starter | $6.99 | $12.00 | 250 | $0.25 | Announcement bar, social links, templates, weekly auto-payout |
| Pro | $29.99 | $39.99 | 2,000 | $0.10 | Custom categories, bulk tools, markdown manager, coupons, boosting, analytics |
| Power | $59.99 | $79.99 | 15,000 | $0.05 | Puck page builder, auto-counter rules, market intelligence, daily auto-payout, 25 staff |
| Enterprise | Custom ($499+) | Negotiated | 100K+ | Custom | API access, dedicated rep, free daily payouts, no minimums |

### 4.3 Platform Settings Keys

```
store.pricing.starter.annualCents: 699
store.pricing.starter.monthlyCents: 1200
store.pricing.pro.annualCents: 2999
store.pricing.pro.monthlyCents: 3999
store.pricing.power.annualCents: 5999
store.pricing.power.monthlyCents: 7999
fees.insertion.NONE: 35
fees.insertion.STARTER: 25
fees.insertion.PRO: 10
fees.insertion.POWER: 5
fees.insertion.ENTERPRISE: 0
fees.freeListings.NONE: 100
fees.freeListings.STARTER: 250
fees.freeListings.PRO: 2000
fees.freeListings.POWER: 15000
fees.freeListings.ENTERPRISE: 100000
```

### 4.4 Storefront Gate

- **PERSONAL sellers:** Get "seller profile" — listing grid + ratings + follow button. No `/st/` URL. No banner, logo, bio, accent color, announcement bar, social links, custom categories. Appears as "More from this seller" panel on listing detail pages.
- **BUSINESS sellers:** Get full branded storefront at `/st/{slug}`. All storefront features gated by Store tier.
- **BUSINESS status** requires: legal name, EIN or SSN, business address. Free upgrade. Enables 1099 reporting.

### 4.5 Storefront Activation (BUSINESS sellers)

Storefront activates when ALL of:
1. ✅ BUSINESS seller status
2. ✅ Store name set
3. ✅ At least 1 active listing

Three gates, done in 2 minutes. Profile photo and completed sales are nudged but not required.

---

## 5. PAYOUT RULES BY STORE TIER

### 5.1 Payout Tier Matrix

| Tier | Payout Method | Minimum | Auto-Payout | Instant Available | Instant Fee |
|------|-------------|---------|------------|-------------------|-------------|
| Free (NONE) | Manual request only | $15 | ❌ | ❌ | — |
| Starter | Manual + auto | $10 | Weekly (Fri) | ✅ ($10 min, $250 max) | $2.50 |
| Pro | Manual + auto | $1 | Weekly (Fri) | ✅ ($1 min, $250 max) | $2.50 |
| Power | Manual + auto | $1 | Daily M-F ($1/payout fee) | ✅ ($1 min, $250 max) | $2.50 |
| Enterprise | Manual + auto | None | Daily (free) | ✅ (free, negotiated max) | Negotiated |

### 5.2 72-Hour Escrow Hold

All orders, all tiers, no exceptions:
1. Buyer pays → funds captured to Twicely platform account
2. Seller ships → tracking via Shippo
3. Carrier confirms delivery → 72-hour inspection window starts
4. Buyer accepts early OR 72 hours pass with no flag → funds transfer to seller's Stripe connected account
5. Payout schedule (above) governs when funds move from connected account → bank

### 5.3 On-Platform Fee Payment via Stripe Balance (Narrow Scope)

Sellers can pay **Twicely platform charges only** using their Stripe connected account balance:
- ✅ Store subscriptions
- ✅ Crosslister subscriptions
- ✅ Finance Pro subscriptions
- ✅ Automation add-on
- ✅ Boosting spend
- ✅ Insertion fee overage
- ✅ Overage packs
- ✅ Authentication fees
- ❌ **NOT** marketplace purchases from other sellers (deferred pending legal review)
- ❌ **NOT** partial balance + card split for marketplace purchases

**Implementation rules:**
- Stripe connected account balance is the source of truth — NOT a Twicely internal ledger
- All charges flow through Stripe Billing or Stripe payment intents against the connected account
- Twicely DB records the transaction but does NOT maintain a spendable balance
- Audit trail per transaction: amount, Stripe charge/invoice ID, source = `stripe_balance`, service purchased
- Feature-flagged by jurisdiction (`payout.onPlatformFeePaymentEnabled`)
- UI label: "Pay with available Stripe payout balance" — never "Pay with Twicely balance"

**Deferred (requires fintech counsel review):**
- Seller using payout funds to buy goods from another seller
- Partial payout balance + card split for marketplace purchases
- Any flow where Twicely internal ledger becomes a payment instrument

### 5.4 Platform Settings Keys

```
payout.weeklyDay: 5                       // Friday
payout.weeklyTime: '06:00'                // UTC
payout.dailyTime: '06:00'
payout.minimumNoneCents: 1500             // $15
payout.minimumStarterCents: 1000          // $10
payout.minimumProCents: 100               // $1
payout.minimumPowerCents: 100
payout.minimumEnterpriseCents: 0
payout.instantFeeCents: 250               // $2.50
payout.dailyFeeCents: 100                 // $1.00
payout.instantMaxCents: 25000             // $250
payout.instantEnabled: true
payout.onPlatformFeePaymentEnabled: true
commerce.escrow.holdHours: 72
commerce.escrow.autoReleaseEnabled: true
commerce.escrow.buyerEarlyAcceptEnabled: true
```

---

## 6. XLISTER SUBSCRIPTIONS

### 6.1 Enum

```typescript
enum ListerTier { NONE = 'NONE', FREE = 'FREE', LITE = 'LITE', PRO = 'PRO' }
```

### 6.2 Pricing

| Tier | Annual/mo | Monthly | Publishes/mo | AI Credits/mo | BG Removals/mo | Rollover |
|------|-----------|---------|-------------|--------------|----------------|---------|
| None | — | — | 0 | 0 | 0 | — |
| Free | $0 | $0 | 25 | 0 | 0 | None |
| Lite | $9.99 | $13.99 | 200 | 25 | 25 | 60 days, max 600 |
| Pro | $29.99 | $39.99 | 2,000 | 200 | 200 | 60 days, max 6,000 |

### 6.3 Rules

- Crosslister does NOT require Store subscription
- Crosslister does NOT require BUSINESS status
- Publishes = pushes to external platforms (eBay, Poshmark, Mercari, etc.)
- Imports are always FREE and do not consume publish credits
- Re-import requires Crosslister Lite+

### 6.4 Platform Settings Keys

```
crosslister.pricing.lite.annualCents: 999
crosslister.pricing.lite.monthlyCents: 1399
crosslister.pricing.pro.annualCents: 2999
crosslister.pricing.pro.monthlyCents: 3999
crosslister.publishes.FREE: 25
crosslister.publishes.LITE: 200
crosslister.publishes.PRO: 2000
crosslister.aiCredits.LITE: 25
crosslister.aiCredits.PRO: 200
crosslister.bgRemovals.LITE: 25
crosslister.bgRemovals.PRO: 200
crosslister.rolloverDays: 60
crosslister.rolloverMaxMultiplier: 3
```

---

## 7. FINANCE SUBSCRIPTIONS

### 7.1 Pricing

| Tier | Annual/mo | Monthly | Key Features |
|------|-----------|---------|-------------|
| Free | $0 | $0 | 30-day revenue dashboard, Twicely sales only |
| Pro | $11.99 | $14.99 | Full P&L, cross-platform revenue, expense tracking, receipt scanning, mileage, tax prep, 2yr history |

> **Superseded by FC v3.0 §2** — Finance PRO pricing is $11.99 annual / $14.99 monthly. Earlier drafts listed $9.99 annual; that value is retired. Code uses $11.99 via `packages/subscriptions/src/price-map.ts` `FALLBACK_FINANCE_CENTS.PRO = { monthlyCents: 1499, annualMonthlyCents: 1199 }`.

### 7.2 Rules

- Finance is standalone — does NOT require Store or Crosslister
- Finance Pro gets 6 months free with Seller Pro or Seller Power bundle (per FC v3.0 §2, trial activation wiring is Phase D4 work)
- If trial-to-paid conversion < 30%, fold Finance into Store tiers instead of standalone (monitor closely)

### 7.3 Platform Settings Keys

```
finance.pricing.pro.annualCents: 1199    // $11.99 (FC v3.0 §2 supersedes the earlier $9.99)
finance.pricing.pro.monthlyCents: 1499   // $14.99
finance.trialMonths.bundlePromo: 6
finance.foldThreshold: 30                // conversion % below which Finance gets folded into Store
```

---

## 8. AUTOMATION ADD-ON

| | Annual/mo | Monthly | Actions/mo |
|--|-----------|---------|-----------|
| Automation AI | $9.99 | $12.99 | 2,000 |

- Available at ANY Store tier (including Free)
- Actions: auto-relist, offer-to-likers, smart price drops, Posh sharing, stale listing refresh
- Overage: $9 per 1,000 additional actions

```
automation.pricing.annualCents: 999
automation.pricing.monthlyCents: 1299
automation.actionsPerMonth: 2000
automation.overagePackSize: 1000
automation.overagePackCents: 900
```

---

## 9. BUNDLES

| Bundle | Annual/mo | Monthly | Includes | Savings vs Separate |
|--------|-----------|---------|----------|-------------------|
| Seller Starter | $17.99 | $24.99 | Store Starter + Finance Pro | ~$4/mo |
| Seller Pro | $59.99 | $74.99 | Store Pro + Crosslister Pro + Finance Pro (6mo free) | ~$20/mo |
| Seller Power | $89.99 | $109.99 | Store Power + Crosslister Pro + Finance Pro + Automation | ~$30/mo |

### Rules

- Bundles are single Stripe subscription products (not combined components)
- Downgrading from bundle to individual preserves remaining Finance Pro trial
- Upgrading individual to bundle: prorated credit applied
- Enterprise does not bundle (custom pricing)

```
bundle.starter.annualCents: 1799
bundle.starter.monthlyCents: 2499
bundle.pro.annualCents: 5999
bundle.pro.monthlyCents: 7499
bundle.power.annualCents: 8999
bundle.power.monthlyCents: 10999
```

---

## 10. BOOSTING

| Setting | Value | Setting Key |
|---------|-------|-------------|
| Min boost rate | 1% | `boost.minRateBps: 100` |
| Max boost rate | 8% | `boost.maxRateBps: 800` |
| Attribution window | 7 days | `boost.attributionDays: 7` |
| Max promoted in search | 30% | `boost.maxPromotedPercent: 30` |
| Refund on returns | Yes | `boost.refundOnReturn: true` |
| Minimum Store tier | Pro | `boost.minimumStoreTier: 'PRO'` |

---

## 11. INSERTION FEES

| Store Tier | Free Listings/mo | Overage Fee |
|-----------|-----------------|-------------|
| Free (NONE) | 100 | $0.35 |
| Starter | 250 | $0.25 |
| Pro | 2,000 | $0.10 |
| Power | 15,000 | $0.05 |
| Enterprise | 100K+ | Custom |

**Imported listings are ALWAYS exempt from insertion fees.** Monthly free allowance counts ONLY manually created new listings.

---

## 12. FREE IMPORT (Supply Flywheel)

| Rule | Detail |
|------|--------|
| Available to | ALL sellers at ANY tier, including zero subscriptions |
| Cost | FREE — no charge, no insertion fees on imported items |
| Limit | ONE import per external platform per account |
| Item limit | No limit on items per import |
| Listing state | Imported listings go ACTIVE immediately |
| Re-import | Requires Crosslister Lite+ |

---

## 13. OVERAGE PACKS

| Pack | Quantity | Price | Setting Key |
|------|----------|-------|-------------|
| Publishes | +500 | $9 | `overage.publishes.qty: 500` / `overage.publishes.cents: 900` |
| AI Credits | +500 | $9 | `overage.aiCredits.qty: 500` / `overage.aiCredits.cents: 900` |
| BG Removals | +500 | $9 | `overage.bgRemovals.qty: 500` / `overage.bgRemovals.cents: 900` |
| Automation Actions | +1,000 | $9 | `overage.automation.qty: 1000` / `overage.automation.cents: 900` |

One-time purchases. Credits expire at end of billing period. Auto-purchase opt-in with configurable cap.

---

## 14. AUTHENTICATION

| Type | Price | Who Pays | Setting Key |
|------|-------|----------|-------------|
| Buyer-initiated | $19.99 | Buyer | `auth.buyerFeeCents: 1999` |
| Seller pre-listing | $19.99 | Seller | `auth.sellerFeeCents: 1999` |
| Expert (human) | $39.99 | Requester | `auth.expertFeeCents: 3999` |

---

## 15. LOCAL TRANSACTION FEE

- 5% flat on in-app local payments (`local.tfRateBps: 500`)
- Replaces standard TF brackets (does not stack)
- Does NOT count toward monthly GMV for bracket calculation

---

## 16. STRIPE PRODUCT MAPPING

```
# Store Subscriptions
twicely_store_starter       | Subscription | $6.99/mo (annual) / $12.00/mo
twicely_store_pro           | Subscription | $29.99/mo (annual) / $39.99/mo
twicely_store_power         | Subscription | $59.99/mo (annual) / $79.99/mo
twicely_store_enterprise    | Subscription | Custom

# Crosslister Subscriptions
twicely_crosslister_lite        | Subscription | $9.99/mo (annual) / $13.99/mo
twicely_crosslister_pro         | Subscription | $29.99/mo (annual) / $39.99/mo

# Finance
twicely_finance_pro         | Subscription | $9.99/mo (annual) / $14.99/mo

# Automation
twicely_automation          | Subscription | $9.99/mo (annual) / $12.99/mo

# Bundles
twicely_bundle_starter      | Subscription | $17.99/mo (annual) / $24.99/mo
twicely_bundle_pro          | Subscription | $59.99/mo (annual) / $74.99/mo
twicely_bundle_power        | Subscription | $89.99/mo (annual) / $109.99/mo

# Transactional
twicely_boost_spend         | Metered      | Promoted listing spend
twicely_insertion_fee       | One-time     | Listing insertion overage
twicely_overage_pack        | One-time     | +credits pack ($9 each)
twicely_auth_buyer          | One-time     | $19.99 buyer auth
twicely_auth_seller         | One-time     | $19.99 seller auth
twicely_auth_expert         | One-time     | $39.99 expert auth
twicely_local_fee           | Transactional| 5% local transaction fee
```

**Total Stripe products:** 11 subscription + 6 transactional = 17

---

## 17. ENUM REFERENCE (Single Source of Truth)

```typescript
// Store tiers — storefront features + payout gates
enum StoreTier { NONE = 'NONE', STARTER = 'STARTER', PRO = 'PRO', POWER = 'POWER', ENTERPRISE = 'ENTERPRISE' }

// Crosslister tiers — crosslisting features
enum ListerTier { NONE = 'NONE', FREE = 'FREE', LITE = 'LITE', PRO = 'PRO' }

// Performance bands — EARNED, not purchased
enum PerformanceBand { EMERGING = 'EMERGING', ESTABLISHED = 'ESTABLISHED', TOP_RATED = 'TOP_RATED', POWER_SELLER = 'POWER_SELLER' }

// Seller type — account type
type SellerType = 'PERSONAL' | 'BUSINESS'

// Seller status — account standing
type SellerStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED'

// Fund status — per order
enum FundsStatus { HELD = 'HELD', RELEASED = 'RELEASED', CLAIMED = 'CLAIMED', REFUNDED = 'REFUNDED', REVERSED = 'REVERSED' }

// Order status — full lifecycle
enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  AWAITING_SHIPMENT = 'AWAITING_SHIPMENT',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  BUYER_REVIEW = 'BUYER_REVIEW',       // 72hr inspection window
  COMPLETED = 'COMPLETED',
  CLAIM_OPEN = 'CLAIM_OPEN',
  RETURN_IN_PROGRESS = 'RETURN_IN_PROGRESS',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
  AUTO_CANCELLED = 'AUTO_CANCELLED',
}
```

**NEVER create:** `SellerTier`, `SubscriptionTier`, `FinanceTier` (as enum), `TF`, `tf` (anywhere in code or UI). Finance level is derived from subscription state. Use `TF` / `tf` for transaction fees.

---

## 18. WHAT IS EXPLICITLY FORBIDDEN

❌ Per-order fee on Twicely sales (TF covers it)
❌ Fees on off-platform sales
❌ Insertion fees on imported listings
❌ Using "Twicely Balance", "wallet", or custodial language (per UX Language Pack)
❌ Requiring Store to use Crosslister or vice versa
❌ Hiding Stripe processing fees (must be shown separately to seller)
❌ Hardcoding ANY fee rate, threshold, minimum, or schedule in application code
❌ Charging boost fees on returned/refunded orders
❌ Removing organic results to make room for promoted listings (30% max cap)
❌ Auctions or bidding of any kind
❌ Using `SellerTier` or `SubscriptionTier` enum names
❌ Using `TF` or `tf` anywhere in code, UI, docs, or comments
❌ Releasing funds before delivery confirmation + escrow hold
❌ Reducing escrow hold for any seller tier (configurable by admin only)
❌ Auto-payout for Free (NONE) tier sellers
❌ Instant payout for Free (NONE) tier sellers
❌ Daily auto-payout for tiers below Power
❌ Showing marginal rate on seller dashboard (show effective rate only)
❌ Combining "Balance" with "Twicely" as owner label in any UI context

---

## 19. DECISION RATIONALE REFERENCES

Entries #75–#83 in `TWICELY_V3_DECISION_RATIONALE.md` cover:
- #75: Progressive TF Brackets Replace Category TF
- #76: Store Tiers Simplified to Five
- #77: Crosslister Three Tiers with LITE
- #78: Finance Pro at $9.99
- #79: Stripe Fee Displayed Separately
- #80: Payout UX Language Pack
- #81: PERSONAL Seller Profile vs BUSINESS Storefront
- #82: Storefront Activation Three Gates
- #83: 72-Hour Configurable Escrow

Entries #84–#92 (pending append) cover:
- #84: Delivery + 72hr Payout Hold
- #85: Payout Ledger System (Not "Twicely Balance")
- #86: PERSONAL Manual-Only Payouts
- #87: BUSINESS Auto-Payout Weekly
- #88: Daily Payout Gated to Store Power
- #89: $2.50 Instant Payout Fee
- #90: $15 Minimum Payout
- #91: On-Platform Payout Spending
- #92: Post-Release Claim Recovery Waterfall

---

*End of Pricing, Payments & Payout Canonical v3.2*
