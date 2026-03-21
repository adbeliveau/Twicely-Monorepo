# Twicely V3 — Decision Rationale

**Purpose:** This document captures WHY we made specific decisions — not just what was decided. Every entry includes the problem context, options considered, competitive analysis where relevant, and the reasoning that drove the final ruling. This is the institutional memory that explains Twicely's design philosophy to future engineers, support staff, and Adrian himself when he forgets why something works the way it does.

**Relationship to other docs:** The Decisions Log (`TWICELY_V3_DECISIONS_LOG.md`) records WHAT was decided. This document records WHY. When they reference the same decision, the rationale here is the authoritative explanation.

## Consolidation Notes

This consolidated version merges the base rationale, additions, duplicate copies, and addendum into a single file. No substantive content was omitted. Conflicting section numbers from standalone additions/addenda were renumbered to maintain a single continuous sequence. Original numbering is preserved in the source files.

**Last Updated:** 2026-03-20 (Decisions #140-141: VESTIAIRE enum shortname, extension tables removed)

---

## Table of Contents

**Commerce & Product Decisions (1–18)**
1. [TF Treatment on Returns](#1-tf-treatment-on-returns)
2. [Offer System: Stripe Hold Logic](#2-offer-system-stripe-hold-logic)
3. [Offer Type Enum Design](#3-offer-type-enum-design)
4. [Offer Limits: Three Distinct Caps](#4-offer-limits-three-distinct-caps)
5. [Watcher Offers as Separate Entity](#5-watcher-offers-as-separate-entity)
6. [Offer Accept Modes (INSTANT / BEST_IN_WINDOW / MANUAL)](#6-offer-accept-modes)
7. [Offer Competitiveness Signal](#7-offer-competitiveness-signal)
8. [Seller Response Window: Business Days Not Hours](#8-seller-response-window-business-days-not-hours)
9. [Review System Defaults](#9-review-system-defaults)
10. [Buyer Protection Coverage Limits (PARKED)](#10-buyer-protection-coverage-limits)
11. [Cross-Spec Conflict Resolutions](#11-cross-spec-conflict-resolutions)
12. [Checkout Integrity: SELECT FOR UPDATE](#12-checkout-integrity-select-for-update)
13. [Prepaid Offers (Authorization Holds)](#13-prepaid-offers-authorization-holds)
14. [No Auctions — Fixed Price + Offers Only](#14-no-auctions-fixed-price-plus-offers-only)
15. [Three Independent Subscription Axes](#15-three-independent-subscription-axes)
16. [Imports Go Active Immediately](#16-imports-go-active-immediately)
17. [Crosslister as Supply Engine](#17-crosslister-as-supply-engine)
18. [Personalization: Three-Layer System](#18-personalization-three-layer-system)

**Tech Stack Decisions (19–27)**
19. [Drizzle ORM over Prisma](#19-drizzle-orm-over-prisma)
20. [Better Auth over NextAuth](#20-better-auth-over-nextauth)
21. [CASL over Custom RBAC](#21-casl-over-custom-rbac)
22. [Typesense over Meilisearch](#22-typesense-over-meilisearch)
23. [Cloudflare R2 over MinIO and S3](#23-cloudflare-r2-over-minio-and-s3)
24. [Centrifugo over Soketi and Pusher](#24-centrifugo-over-soketi-and-pusher)
25. [Coolify on Hetzner over Vercel](#25-coolify-on-hetzner-over-vercel)
26. [Built-in Helpdesk over Zendesk](#26-built-in-helpdesk-over-zendesk)
27. [Puck for Storefronts, Not for KB](#27-puck-for-storefronts-not-for-kb)

**Architecture & Engineering Decisions (28–38)**
28. [Vertical Slices over Horizontal Layers](#28-vertical-slices-over-horizontal-layers)
29. [Category-Based TF over Flat-Rate](#29-category-based-tf-over-flat-rate)
30. [No Per-Order Fee on Twicely Sales](#30-no-per-order-fee-on-twicely-sales)
31. [No Fees on Off-Platform Sales](#31-no-fees-on-off-platform-sales)
32. [Boosting: 7-Day Attribution with 30% Cap](#32-boosting-7-day-attribution-with-30-cap)
33. [Append-Only Ledger Architecture](#33-append-only-ledger-architecture)
34. [Payout Frequency Gated by Store Tier](#34-payout-frequency-gated-by-store-tier)
35. [Provider Abstraction Pattern](#35-provider-abstraction-pattern)
36. [300-Line File Limit](#36-300-line-file-limit)
37. [Soft Cart Reservation](#37-soft-cart-reservation)
38. [One Conversation per Buyer-Seller-Listing](#38-one-conversation-per-buyer-seller-listing)

**Trust, Local & Authentication Decisions (39–44)**
39. [Authentication Cost Split Model](#39-authentication-cost-split-model)
40. [Never Trust External Authentication](#40-never-trust-external-authentication)
41. [QR Code Escrow for Local Pickup](#41-qr-code-escrow-for-local-pickup)
42. [Local Transaction Fee Model](#42-local-transaction-fee-model)
43. [No-Show Penalty for Local Meetups](#43-no-show-penalty-for-local-meetups)
44. [Combined Shipping: Five Modes](#44-combined-shipping-five-modes)

**G2 Local Extensions (128–129)**
128. [RESERVED as New Listing Status Enum Value](#128-reserved-as-new-listing-status-enum-value)
129. [Immediate Unreserve on NO_SHOW](#129-immediate-unreserve-on-no_show)

**Financial & Subscription Decisions (45–52)**
45. [Financial Center as Fourth Subscription Axis](#45-financial-center-as-fourth-subscription-axis)
46. [Finance Included in Store Tiers Plus Standalone](#46-finance-included-in-store-tiers-plus-standalone)
47. [Three-Product Lock-In Strategy](#47-three-product-lock-in-strategy)
48. [Variation Scope Hierarchy](#48-variation-scope-hierarchy)
49. [BNPL on Offers](#49-bnpl-on-offers)
50. [Returns Fee Allocation Bucket System](#50-returns-fee-allocation-bucket-system)
51. [Finance Engine as Standalone Canonical](#51-finance-engine-as-standalone-canonical)
52. [Provider Abstraction for Expansion](#52-provider-abstraction-for-expansion)
53. [Seller Score Engine and Performance Rewards](#53-seller-score-engine-and-performance-rewards)

---


**Offer System Deep-Dive Additions (57–61)**
57. [Three-Tier Offer Spam Prevention](#57-three-tier-offer-spam-prevention)
58. [Offer Counter Chain Model (Parent-Child, Not Flat)](#58-offer-counter-chain-model-parent-child-not-flat)
59. [Stripe Hold Logic on Counter-Offers](#59-stripe-hold-logic-on-counter-offers)
60. [Offer Chain Query Optimization (Deferred)](#60-offer-chain-query-optimization-deferred)
61. [Checkout Hotfix Before Offers (Dependency Ordering)](#61-checkout-hotfix-before-offers-dependency-ordering)

**Deployment & Build Sequence Addendum (62–63)**
62. [Railway over Coolify + Hetzner](#62-railway-over-coolify-hetzner)
63. [Social & Discovery Step Numbering Resolution](#63-social-discovery-step-numbering-resolution)

**Pricing, Market Intelligence & Tier Restructure (64–68)**
64. [Store Premium Tier ($99.99/mo) as Feature Ceiling](#64-store-premium-tier-9999mo-as-feature-ceiling)
65. [Market Intelligence Architecture](#65-market-intelligence-architecture)
66. [Market Intelligence Tier Gating](#66-market-intelligence-tier-gating)
67. [Revised Bundle Ladder with Seller Scale](#67-revised-bundle-ladder-with-seller-scale)
68. [Seller Power Bundle Price Lock ($99.99)](#68-seller-power-bundle-price-lock-9999)

**Buyer Acquisition & Growth (69–74)**
69. [Buyer Acquisition: Five Organic Channels Over Paid](#69-buyer-acquisition-five-organic-channels-over-paid)
70. [Google Shopping Feed: Phase B2, Not Phase G](#70-google-shopping-feed-phase-b2-not-phase-g)
71. [SOLD Listings: Index for 90 Days (Page Registry Override)](#71-sold-listings-index-for-90-days-page-registry-override)
72. [Buyer Referral: $5 Credit at $50 Minimum, True Breakeven](#72-buyer-referral-5-credit-at-50-minimum-true-breakeven)
73. [Twicely.Local Is Nationwide, Not a Geo-Targeted Launch Strategy](#73-twicelylocal-is-nationwide-not-a-geo-targeted-launch-strategy)
74. [Creator Market Intelligence as Content Angle](#74-creator-market-intelligence-as-content-angle)

**Pricing Restructure v3.2 (75–83)**
75. [Progressive TF Brackets Replace Category TF](#75-progressive-tf-brackets-replace-category-tf)
76. [Store Tiers Simplified to Five](#76-store-tiers-simplified-to-five)
77. [Crosslister Three Tiers with LITE](#77-crosslister-three-tiers-with-lite)
78. [Finance Pro at $9.99](#78-finance-pro-at-999)
79. [Stripe Fee Displayed Separately](#79-stripe-fee-displayed-separately)
80. [Payout UX Language Pack](#80-payout-ux-language-pack)
81. [PERSONAL Seller Profile vs BUSINESS Storefront](#81-personal-seller-profile-vs-business-storefront)
82. [Storefront Activation Three Gates](#82-storefront-activation-three-gates)
83. [72-Hour Configurable Escrow](#83-72-hour-configurable-escrow)

**Order Lifecycle & Payment Flow (84–92)**
84. [Delivery + 72hr Payout Hold](#84-delivery-72hr-payout-hold)
85. [Payout Ledger System (Not "Available for payout")](#85-payout-ledger-system-not-twicely-balance)
86. [PERSONAL Manual-Only Payouts](#86-personal-manual-only-payouts)
87. [BUSINESS Auto-Payout Weekly](#87-business-auto-payout-weekly)
88. [Daily Payout Gated to Store Power](#88-daily-payout-gated-to-store-power)
89. [$2.50 Instant Payout Fee](#89-250-instant-payout-fee)
90. [$15 Minimum Payout](#90-15-minimum-payout)
91. [On-Platform Payout Spending](#91-on-platform-payout-spending)
92. [Post-Release Claim Recovery Waterfall](#92-post-release-claim-recovery-waterfall)

**Subscription Upgrade/Downgrade (93–97)**
93. [Proration Strategy: create_prorations](#93-proration-strategy-create_prorations-stripe-default)
94. [Keep Original Billing Cycle Anchor](#94-keep-original-billing-cycle-anchor)
95. [Allow Monthly→Annual Switch Mid-Cycle](#95-allow-monthlyannual-switch-mid-cycle)
96. [Downgrade Timing: At Period End](#96-downgrade-timing-at-period-end)
97. [Downgrade Mechanism: DB pendingTier + Webhook](#97-downgrade-mechanism-db-pendingtier-webhook)

**Bundle Subscriptions (98–104)**
98. [Three Bundles Only (Pricing Canonical §9 Wins)](#98-three-bundles-only-pricing-canonical-9-wins)
99. [Bundles Are Single Stripe Products](#99-bundles-are-single-stripe-products)
100. [Finance Pro Permanent on Bundle](#100-finance-pro-permanent-on-bundle)
101. [New bundleSubscription Table (Option A)](#101-new-bundlesubscription-table-option-a)
102. [bundleTier Denormalized on sellerProfile](#102-bundletier-denormalized-on-sellerprofile)
103. [Individual→Bundle: Cancel Immediately with Proration](#103-individualbundle-cancel-immediately-with-proration)
104. [Bundle Cancel: Component Tiers Revert at Period End](#104-bundle-cancel-component-tiers-revert-at-period-end)

**Crosslister & Listing Lifecycle (105–113)**
105. [FREE ListerTier Redefined as Time-Limited Teaser](#105-free-listertier-redefined-as-time-limited-teaser-5-publishes--6-months)
106. [NONE ListerTier Clarified — Import Remains Free and Universal](#106-none-listertier-clarified--import-remains-free-and-universal)
107. [Platform Setting Keys: crosslister.* Everywhere](#107-platform-setting-keys-crosslister-everywhere-xlister-retired)
108. [Adaptive Polling Engine — All Values Locked](#108-adaptive-polling-engine--all-values-locked)
109. [Sold Listing Auto-Archive — Seller Cannot Delete](#109-sold-listing-auto-archive--seller-cannot-delete-mercari-model)
110. [Financial Records: 7-Year Retention](#110-financial-records-7-year-retention-ebay--irs-model)
111. [Image Retention Policy — Tiered by Age and Account Status](#111-image-retention-policy--tiered-by-age-and-account-status)
112. [Projection States: UNMANAGED and ORPHANED](#112-projection-states-unmanaged-and-orphaned)
113. [External Listing Dedup + Auto-Import of Unknown Projections](#113-external-listing-dedup--auto-import-of-unknown-projections)

**Twicely Local (114–124)**
114. [Local Reliability System — No Monetary Penalties](#114-local-reliability-system--no-monetary-penalties)
115. [Twicely Local Is a Fulfillment Option, Not a Product](#115-twicely-local-is-a-fulfillment-option-not-a-product)
116. [Twicely Local Monetization — Cash Is Top of Funnel](#116-twicely-local-monetization--cash-is-top-of-funnel)
117. [Meetup Time Picker — Minimal Structured Scheduling](#117-meetup-time-picker--minimal-structured-scheduling)
118. [Twicely SafeTrade — Complete Local Escrow Model](#118-twicely-safetrade--complete-local-escrow-model)
119. [Implicit Nonce via confirmedAt — No Separate Table](#119-implicit-nonce-via-confirmedat--no-separate-table)
120. [Local Reliability Display Tiers — Owner-Confirmed Thresholds](#120-local-reliability-display-tiers--owner-confirmed-thresholds)
121. [Pre-Meetup Cancellation — canceledByParty Text Field, Not Enum](#121-pre-meetup-cancellation--canceledbyparty-text-field-not-enum)
122. [Day-of Confirmation as Column-State, Not Status Enum](#122-day-of-confirmation-as-column-state-not-status-enum)
123. [SELLER_DARK Mark: Option A Minimal Escalation](#123-seller_dark-mark-option-a-minimal-escalation)
124. [Reschedule Counts as Valid Day-of Confirmation Response](#124-reschedule-counts-as-valid-day-of-confirmation-response)


## 1. TF Treatment on Returns

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C4 (Returns & Disputes)

### The Problem

When a buyer returns an item, what happens to the Transaction Fee (TF) that Twicely already charged the seller? Four possible approaches, each with different revenue and fairness implications.

### How eBay Does It

eBay refunds TF proportionally on all seller-initiated refunds. Full refund = full TF credit. Partial refund = proportional TF credit. They only keep the $0.30 per-order transaction fee. The exception: if eBay has to "step in" and force the refund because the seller didn't cooperate, eBay keeps ALL fees as a penalty. This incentivizes sellers to handle returns quickly without escalation.

### Why We Don't Copy eBay Exactly

eBay can afford to eat 100% of TF on every return because they process billions in transactions. Twicely is a new platform. Refunding 100% of TF on every buyer-remorse return means Twicely earns zero revenue on any transaction that gets returned — even when the seller did absolutely nothing wrong. A buyer returning a shirt because it didn't fit isn't the seller's fault. The seller described it accurately, shipped promptly, packed well. Penalizing them with full TF loss is punitive. But if we refund 100% to sellers, Twicely absorbs all the processing cost of returns with zero revenue.

### The Twicely Hybrid Model

| Scenario | TF Treatment | Rationale |
|----------|--------------|-----------|
| **SELLER_FAULT** (INAD, WRONG_ITEM, COUNTERFEIT) | Twicely keeps 100% of TF | Seller caused the problem. Same as eBay's penalty model. Incentivizes accurate listings and honest descriptions. If you list a "Large" and ship a "Medium," you bear the full cost. |
| **BUYER_REMORSE** (didn't fit, changed mind) | Twicely refunds 50% of TF | Seller did nothing wrong — Twicely meets them halfway. Seller still loses time and incurs restocking costs, but Twicely shares the financial pain rather than dumping it all on one party. |
| **PLATFORM_CARRIER_FAULT** (damaged in transit with Twicely label) | Twicely refunds 100% of TF | Nobody on the platform caused this. Twicely chose the carrier (our label, our rate negotiation). Full TF refund because neither buyer nor seller should pay for a carrier issue on Twicely's infrastructure. |
| **SELLER COOPERATES** (accepts return promptly, no escalation) | Bonus: +10% TF credit on above | Mirrors eBay's "cooperate and we reward" principle. A seller who accepts a remorse return within 24h gets 60% back instead of 50%. Incentivizes fast, friction-free returns. |
| **SELLER FORCES ESCALATION** (Twicely must step in) | Twicely keeps 100% of TF | Identical to eBay. You fought the return, you lost, you eat everything. This is the stick that makes the cooperation carrot work. |

### Why 50% on Buyer Remorse Specifically

- **Revenue protection:** A new marketplace can't afford to eat 100% of fees on every return. 50% retention means Twicely still earns something on returned transactions.
- **Seller fairness signal:** "Twicely shares the cost of returns with sellers" — no other platform frames it this way. It's a marketing angle and a genuine fairness improvement.
- **Anti-gaming:** 100% TF refund + restocking fee means sellers could theoretically profit from buyer-remorse returns. 50% retention eliminates that incentive.
- **Partial refund rule stays:** On all seller-initiated partial refunds (adjustments), Twicely keeps TF calculated on the FULL original sale price. This prevents the gaming scenario where sellers issue tiny partial refunds to trigger TF credits.

### Competitive Differentiation

| Platform | TF on Returns |
|----------|---------------|
| eBay | Full refund (keeps $0.30 only) |
| Poshmark | No returns except INAD |
| Mercari | Full refund on approved returns |
| **Twicely** | **Fault-based hybrid with cooperation bonus** |

Twicely is the only platform that explicitly ties fee treatment to fault AND cooperation behavior.

---

## 2. Offer System: Stripe Hold Logic

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C2 (Offer System)

### The Problem

Offers are prepaid — the buyer's card is authorized (held) when they submit. But counter-offers create complexity: who holds what, when?

### The Rule: Holds Only Exist When the Buyer Set the Current Price

This is the core principle. A Stripe authorization hold represents a buyer's financial commitment. Only the buyer can commit their own money.

| Event | Hold Action | Why |
|-------|------------|-----|
| Buyer submits offer | Create hold at offer amount | Buyer proposed a price → buyer's money is committed |
| Seller accepts | Capture at offer amount | Deal done, money moves |
| Seller counters | Release buyer's hold | Seller proposed a NEW price → buyer hasn't agreed yet. No hold exists because the buyer hasn't committed to the counter amount. |
| Buyer accepts seller counter | Capture at counter amount | Buyer agreed to seller's price. Capture directly — no need for an intermediate hold because acceptance is immediate and final. |
| Buyer counter-offers back | New hold at buyer's new amount | Buyer proposed a new price → buyer's money committed again |
| Offer expires | Release hold | Time ran out, no deal |
| Buyer cancels | Release hold | Buyer withdrew |

### Why Not Hold on Seller Counter?

If the seller counters at $75 and we immediately hold $75 on the buyer's card, we're authorizing a charge the buyer never agreed to. That's both a bad UX (buyer sees a surprise hold on their statement) and potentially a Stripe policy violation. The buyer must take an affirmative action (accept or counter) before their card is touched.

### Why Capture Directly on Accept (No Intermediate Hold)?

When a buyer clicks "Accept" on a seller's counter-offer, the transaction is complete. Creating a hold and then immediately capturing it adds latency and an extra Stripe API call for no benefit. Direct capture on acceptance is cleaner.

---

## 3. Offer Type Enum Design

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C2 (Offer System)

### The Problem

Feature Lock-in §1 lists offer types as `BEST_OFFER / COUNTER / WATCHER_OFFER / BUNDLE`. But putting COUNTER in a "type" enum creates ambiguity: is a counter-offer type=COUNTER or type=BEST_OFFER with a parentOfferId?

### The Decision

`offerTypeEnum` has THREE values only: `BEST_OFFER | WATCHER_OFFER | BUNDLE`

Counter-offers are NOT a type. They're a relationship. A counter-offer is identified by:
- `parentOfferId IS NOT NULL` (points to the offer being countered)
- `status = COUNTERED` on the parent offer
- The original offer's `type` field stays unchanged throughout the chain

### Why This Matters

If COUNTER were a type, you'd have two ways to identify a counter-offer: `type = COUNTER` OR `parentOfferId IS NOT NULL`. That's redundant data that WILL fall out of sync. One source of truth (the parent chain) is always better than two. The type field answers "what kind of negotiation is this?" (best offer, watcher broadcast, bundle deal). The parent chain answers "where are we in the negotiation?" These are orthogonal questions that deserve separate fields.

---

## 4. Offer Limits: Three Distinct Caps

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C2 (Offer System)

### The Problem

Feature Lock-in §31 specifies "max 3 per buyer per seller" and "max 10 per buyer total." Platform Settings §8.2 has `maxOffersPerBuyer: 3` without specifying what scope that limit applies to. Three different limits were being conflated.

### The Three Limits

| Limit | Value | Scope | Purpose |
|-------|-------|-------|---------|
| `commerce.offer.maxPerBuyerPerListing` | 3 | One buyer → one listing | Prevents spamming the same listing with offers |
| `commerce.offer.maxPerBuyerPerSeller` | 3 | One buyer → one seller (across all their listings) | Prevents a buyer from harassing one seller across their inventory |
| `commerce.offer.maxPerBuyerGlobal` | 10 | One buyer → all sellers | Prevents offer-spamming the entire platform |

### Why Three Separate Limits

A single limit can't handle all abuse vectors. A buyer with a global limit of 10 could send all 10 offers to one seller — that's harassment. A per-seller limit of 3 doesn't prevent a buyer from making 100 offers across 34 sellers — that's spam. You need all three to cover: listing-level repetition, seller-level harassment, and platform-level abuse.

---

## 5. Watcher Offers as Separate Entity

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C2.2 (Offer to Watchers)

### The Problem

Watcher offers (seller broadcasts a discounted price to all watchers) look superficially like regular offers, but they're fundamentally different.

### Why a Separate `watcherOffer` Table

A regular offer is a 1:1 negotiation: one buyer proposes a price to one seller on one listing. A watcher offer is a 1:many broadcast: one seller announces a price to N watchers. If you store watcher offers in the `listingOffer` table, you'd need either one row per watcher (N rows for one broadcast — wasteful) or one row with no buyerId (breaks the schema constraint). Neither works cleanly.

The `watcherOffer` table stores the broadcast: `listingId, sellerId, discountedPriceCents, expiresAt, watchersNotifiedCount`. Each watcher who clicks "Buy Now" creates a regular checkout flow at the discounted price — no offer negotiation needed. It's a promotional tool, not a negotiation mechanism.

---

## 6. Offer Accept Modes

**Date:** 2026-02-20
**Status:** LOCKED (INSTANT + MANUAL for C2; BEST_IN_WINDOW deferred to C2.1+)
**Builds in:** C2 base, C2.1 or C2.2 for BEST_IN_WINDOW

### The Problem

Adrian identified that the standard auto-accept model (instant acceptance at threshold) leaves money on the table. If a seller sets auto-accept at $35 and the first offer is $35, it accepts immediately — even if the next offer would have been $50.

### The Three Modes

| Mode | Behavior | Available |
|------|----------|-----------|
| `INSTANT` | First offer at/above auto-accept threshold triggers immediate acceptance | C2 base |
| `MANUAL` | Seller reviews and accepts/declines manually. Default when no auto-accept set. | C2 base |
| `BEST_IN_WINDOW` | Collects all offers above the auto-accept floor during the full expiry window. At window close, auto-accepts the highest. | C2.1+ |

### Why BEST_IN_WINDOW Is Powerful

This is essentially a sealed-bid silent auction without calling it an auction (Twicely has no auctions — that's a locked decision). The seller sets a floor, the system collects bids, and the highest wins. Sellers maximize revenue. Buyers compete on price, not speed. Nobody else in the resale space does this.

### Stripe Hold Implications

BEST_IN_WINDOW means multiple simultaneous authorization holds on a single listing. All qualifying offers hold buyer funds for the full window. Only the winner's hold captures; all others release at expiry. Stripe authorization holds typically last 7 days; our max offer window is 72h, so timing works. Edge cases (buyer cancels mid-window, card limit changes) need handling but are manageable.

### Why Defer BEST_IN_WINDOW

The base offer system (INSTANT + MANUAL) covers 90% of use cases. BEST_IN_WINDOW requires additional queue infrastructure (scheduled job to evaluate at window close), more complex hold management, and buyer UX for "your offer is pending evaluation." Ship the simple version first, add the advanced mode when the offer infrastructure is proven.

---

## 7. Offer Competitiveness Signal

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C2 base

### The Feature

When a buyer submits an offer, the system can respond: "Your offer is below the current highest offer on this item." No amounts revealed. Buyer can revise upward or stand pat.

### Why This Exists

It creates organic price discovery without an auction format. The buyer knows they're competing, which naturally pushes offers upward — directly benefiting the seller. This works in both INSTANT and BEST_IN_WINDOW modes:

- **INSTANT mode:** Offers below auto-accept sit as pending. The signal tells the buyer "you're not winning" without revealing what would win.
- **BEST_IN_WINDOW mode:** Multiple offers compete. The signal creates urgency to bid higher.

### Privacy Preserved

The signal only says "below current highest" — never reveals the amount, the number of competing offers with specific amounts, or who else has offered. The existing public display ("X offers received") stays as-is for social proof. This private signal is only shown to the buyer who just submitted.

### Competitive Analysis

eBay shows "other offers" count but not competitiveness. Poshmark and Mercari show nothing. This is a Twicely differentiator that genuinely helps both buyers (they know where they stand) and sellers (offers trend higher).

---

## 8. Seller Response Window: Business Days Not Hours

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C4 (Returns), C5 (Buyer Protection)

### The Conflict

Buyer Protection Canonical §2 said "72 hours." Feature Lock-in §25 and §42 said "3 business days." Platform Settings used `sellerResponseDays: 3` (business days).

### The Decision: 3 Business Days

72 hours ≠ 3 business days. A claim filed Friday at 5PM:
- 72 hours = Monday 5PM deadline
- 3 business days = Wednesday 5PM deadline

That's a 2-day difference. On a holiday weekend, it could be 3+ days. Many Twicely sellers are individuals or small businesses who don't work weekends. A 72-hour clock that ticks through Saturday and Sunday punishes sellers for having a weekend. Business days are fairer and match seller expectations from eBay (which also uses business days for response windows).

### The Fix

Buyer Protection Canonical §2 updated from "72 hours" to "3 business days" to match Feature Lock-in majority and Platform Settings.

---

## 9. Review System Defaults

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C1 (Ratings & Reviews)

### Conflicts Found

Four mismatches between Feature Lock-in §4 (the product spec) and Platform Settings §10.3 (the configuration defaults):

| Setting | Feature Lock-in Says | Platform Settings Default | Resolution |
|---------|---------------------|--------------------------|------------|
| Edit window | 48 hours | 24 hours | **Changed to 48h** — FL is the product spec |
| Review window | 30 days post-delivery | 60 days | **Changed to 30d** — matches eBay standard and FL intent |
| Moderation | "Visible immediately, no queue" | `moderationEnabled: true`, `autoApproveAboveStars: 0` (all moderated) | **Changed to moderationEnabled: false** — FL explicitly rejects approval queues |
| Seller response window | Not specified in FL | 30 days | **Added to FL §4** — "Seller can respond within 30 days of review submission" |

### Why Feature Lock-in Wins

Platform Settings defines configurable defaults. Feature Lock-in defines product behavior. When they conflict, the product spec is authoritative — that's what we told users the product does. The Platform Settings defaults must match the product spec at seed time. Admins can change them later, but the out-of-the-box experience must match what the docs promise.

### Review Moderation Philosophy

Feature Lock-in says "no approval queue unless flagged by automated content scan." This means reviews publish immediately and an async content scanner flags problematic ones for removal — NOT that reviews sit in a queue waiting for human approval. This is the right call for a marketplace: review velocity builds trust. Delayed reviews feel like censorship and reduce buyer engagement.

---

## 10. Buyer Protection Coverage Limits

**Date:** 2026-02-20
**Status:** PARKED — Discuss before C5 slice

### The Situation

Two numbers exist in the specs:
- **$5,000** — Default per-category coverage limit (shown on protection badge). Source: Feature Lock-in §25, Platform Settings.
- **$25,000** — Absolute platform ceiling requiring manual review. Source: Buyer Protection Canonical §3.

### Why This Is Parked

For a new platform with no loss history, $25,000 per-claim exposure is dangerous. Before implementing C5, we need to discuss:
- What's the realistic maximum claim we can absorb at launch?
- Should we start with $5,000 as both the badge amount AND the absolute ceiling?
- When do we raise the ceiling (at what GMV threshold, what loss ratio)?
- Do we need insurance or reserve requirements before going above $5,000?

This is a financial risk decision, not a technical one. It needs a dedicated conversation with actual numbers.

---

## 11. Cross-Spec Conflict Resolutions

**Date:** 2026-02-20
**Status:** LOCKED

### Seller Protection Score Inputs

Two documents listed different metrics:
- **Buyer Protection Canonical §5:** on-time shipping (25%), response time (15%), INAD rate (25%), return rate (15%), counterfeit rate (10%), buyer satisfaction (10%)
- **Feature Lock-in §25:** "claim rate, resolution rate, response time, return rate, chargeback rate"

**Resolution:** Buyer Protection Canonical §5 has the detailed breakdown with explicit weights — that's authoritative. Feature Lock-in §25 updated to reference "See Buyer Protection Canonical §5 for detailed weights" instead of maintaining a separate, conflicting list.

### Auto-Approve on Non-Response Logic

Three rules appeared to stack or conflict:
- Buyer Protection Canonical §2: "No response → auto-approved in buyer's favor" (sounds unconditional)
- Buyer Protection Canonical §5: FAIR sellers auto-approve at 48h; POOR sellers auto-approve immediately
- Platform Settings: `autoApproveThresholdCents: 2500` ($25 limit)

**Resolution:** The logic layers are:
1. Claims under $25 (`autoApproveThresholdCents`): auto-approve on non-response regardless of seller score
2. Claims over $25: seller score determines behavior per §5 table (EXCELLENT gets manual review, POOR gets auto-approve)
3. §2 describes the general principle (non-response favors buyer), not an override of the threshold

### TF on Seller-Fault Returns

- **Buyer Protection Canonical §4:** "Twicely keeps original"
- **Feature Lock-in §42:** "Twicely refunds TF"

**Resolution:** See Section 1 of this document. The full fault-based hybrid model supersedes both individual statements. Feature Lock-in §42 table updated to match the hybrid model.

### Review Schema: Missing DSR Columns

Schema doc's `review` table has a single `rating` field, but Feature Lock-in §4 requires 4 DSR dimensions plus overall — that's 5 fields total.

**Resolution:** Four columns added to review table before C1:
- `itemAsDescribedRating` (integer, 1-5)
- `shippingSpeedRating` (integer, 1-5)
- `communicationRating` (integer, 1-5)
- `packagingRating` (integer, 1-5)
- Existing `rating` field serves as the overall rating

### Missing Platform Settings Keys

Eight Feature Lock-in admin settings had no corresponding Platform Settings entries, meaning they'd never be seeded and Claude Code would hardcode them.

**Resolution:** Batch-added to Platform Settings Canonical:
- `listing.titleMaxLength: 80`
- `listing.descriptionMaxLength: 5000`
- `listing.maxImages: 12`
- `condition.requireFlawDescription: true`
- `returns.autoApproveUnderCents: 1000`
- `returns.maxReturnsPerBuyerPerMonth: 10`
- `commerce.offer.maxPerBuyerPerSeller: 3`
- `commerce.offer.maxPerBuyerGlobal: 10`

---

## 12. Checkout Integrity: SELECT FOR UPDATE

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** B3 hotfix (before C2)

### The Problem

The checkout flow in `checkout.ts` had two bugs:
1. **No SELECT FOR UPDATE on listing:** Two buyers could simultaneously purchase the same single-quantity item. Without a database-level lock, the race condition allows overselling.
2. **Cart set to CONVERTED before payment confirmed:** If the Stripe PaymentIntent fails after the cart status changes, the buyer's cart is gone but no order exists. They lose their cart contents.

### Why This Is a Prerequisite for Offers

The offer system depends on correct payment flow. If checkout can oversell, offers that trigger auto-accept + capture will also oversell. If cart status changes prematurely, offer acceptance that feeds into checkout will corrupt cart state. These bugs must be fixed BEFORE building offers on top of them.

### The Fix

1. Wrap entire checkout in a single Drizzle transaction
2. SELECT FOR UPDATE on the listing row — if listing is no longer ACTIVE inside the transaction, abort with 409 Conflict
3. Move cart CONVERTED status update to AFTER Stripe confirmation
4. If payment fails, cart remains intact, order is not created

---

## 13. Prepaid Offers (Authorization Holds)

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** C2 (Offer System)

### Why Prepaid, Not "Promise to Pay"

Most resale platforms (Poshmark, Mercari) let buyers make offers with no financial commitment. The buyer can offer $50 and simply never pay if accepted. This creates:
- Wasted seller time evaluating non-serious offers
- False demand signals (offers that will never convert)
- Seller frustration when "accepted" offers fall through

Prepaid offers (Stripe authorization holds) solve all three. The buyer's card is verified and funds are held when they offer. Acceptance triggers immediate capture. This means every offer is backed by real money, sellers can trust that accepted offers will actually pay, and conversion rate from accepted-offer to completed-sale approaches 100%.

### The Tradeoff

Authorization holds tie up buyer funds. A buyer with 5 pending offers at $50 each has $250 temporarily unavailable. This could discourage offer-making, especially for buyers with lower credit limits. We mitigate this with:
- Clear messaging: "Your card will be authorized for $X. You won't be charged unless the seller accepts."
- Easy cancellation: buyer can cancel any time before acceptance, immediately releasing the hold
- Reasonable limits: max 10 active offers globally prevents excessive hold accumulation

---

## 14. No Auctions — Fixed Price + Offers Only

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### Why No Auctions

eBay built its reputation on auctions. But auction volume on eBay has declined from ~80% of transactions in 2005 to under 15% today. The market has spoken: buyers want predictable pricing, not bidding wars. Auctions create anxiety ("will I get outbid?"), require time investment ("I have to watch the clock"), and often result in lower final prices than fixed-price because of thin bidder pools.

The BEST_IN_WINDOW offer mode (see Section 6) gives sellers the price-discovery benefit of auctions without the buyer-hostile UX. Sellers set a floor, offers accumulate, highest wins. Same economic outcome, better experience for everyone.

---

## 15. Three Independent Subscription Axes

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The Problem

V2 had a single `SellerTier` that bundled everything: store features, crosslisting, analytics, etc. This forced sellers to buy features they didn't want to get features they did.

### Why Three Axes

| Axis | What It Controls | Who Needs It |
|------|-----------------|-------------|
| StoreTier | Twicely storefront, branding, staff, TF discounts | Sellers who primarily sell ON Twicely |
| ListerTier | Crosslisting, platform connections, sync | Sellers who sell on multiple platforms |
| PerformanceBand | Earned (not purchased) from metrics | All sellers automatically |

A seller who only crosslists doesn't need a Twicely storefront. A seller who only sells on Twicely doesn't need crosslisting. Forcing them into a single tier that bundles both means one group always overpays. Independent axes let each seller buy exactly what they use.

### Revenue Implication

Independent axes actually increase revenue: a power seller might subscribe to BOTH a PRO Store ($39.99/mo) AND a POWER Lister ($29.99/mo) = $69.98/mo. A bundled tier at that level would have been priced lower to seem competitive. We offer bundle discounts (14-17%) for sellers who want both, which still yields more than a single-tier equivalent.

---

## 16. Imports Go Active Immediately

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### Why Not Draft?

Every import from eBay, Poshmark, or Mercari goes ACTIVE on Twicely immediately — never draft. This is the growth engine decision. If imports went to draft, sellers would need to manually review and activate every listing. A seller importing 500 listings from eBay would face a 500-item review queue. Most would abandon the process.

Active-immediately means: seller connects their eBay account → 500 listings appear on Twicely within hours → those listings are immediately searchable and purchasable by Twicely buyers → Twicely's marketplace has 500 new listings. The supply flywheel spins with zero friction.

### The Risk

Some imported listings might have inaccurate data, missing photos, or policy violations. We mitigate with:
- Async moderation scan after import (flag, don't block)
- Import quality score shown to seller ("87% of your imports are complete")
- Missing-field prompts: "3 listings need category assignment"
- No insertion fees on imports (locked decision) — removing any financial penalty for imperfect imports

---

## 17. Crosslister as Supply Engine

**Date:** Pre-V3 (strategic decision)
**Status:** LOCKED

### The Chicken-and-Egg Problem

Every marketplace faces this: buyers won't come without listings, sellers won't list without buyers. eBay solved it by being first. Everyone since has struggled.

### Twicely's Solution

The crosslister IS the supply engine. Here's how the flywheel works:

1. **Seller signs up for crosslister** (free tier available) to manage listings across eBay, Poshmark, Mercari
2. **Twicely is the canonical hub** — all crosslisted inventory lives on Twicely first, then syncs outward
3. **Free one-time import** from any platform brings existing inventory onto Twicely
4. **Listings are immediately active** on Twicely's marketplace
5. **Buyers discover Twicely** through search/SEO/social because the marketplace now has real inventory
6. **Sales happen on Twicely** → seller earns revenue → TF to Twicely
7. **Seller sees value** → upgrades crosslister tier → more subscription revenue

The seller thinks they're using a crosslisting tool. They're actually populating Twicely's marketplace. This is not deceptive — Twicely is genuinely useful as a crosslister. But the strategic insight is that every crosslister subscriber is also a marketplace supplier, whether they think of themselves that way or not.

### Why This Works

- Sellers have EXISTING inventory on other platforms. Import is zero-effort supply.
- Sellers are motivated by the crosslister value prop (manage everything in one place), not by "list on yet another marketplace."
- The marketplace grows organically from crosslister adoption, not from marketing spend on buyer acquisition.

---

## 18. Personalization: Three-Layer System

**Date:** 2026-02-19
**Status:** LOCKED
**Builds in:** Signals from B3+, UI in Phase G

### The Problem

Multi-category marketplaces are noisy. A sneakerhead doesn't want to see vintage furniture on their homepage. But aggressive filtering creates echo chambers — users never discover new categories they might love.

### The Three Layers

1. **Content Curation:** "For You" feed filtered by interest tags and behavioral signals. Homepage tabs (For You / Explore / Categories) let users switch context.
2. **Presentation Adaptation:** Card emphasis changes based on buyer's interest group. A collectibles buyer sees detailed specs on cards. A fashion buyer sees social signals (watcher count, brand prominence).
3. **Discovery Behavior:** Weighted signals that decay over time. Recent activity matters more than old activity. Explicit interests (picked in onboarding) weigh more than implicit (browsed once).

### Why Not ML

No machine learning in V1. Pure SQL feed queries. Reasons:
- ML needs training data. At launch, we have none.
- SQL queries are debuggable. When a user asks "why am I seeing this?", we can trace the exact query.
- ML models are expensive to train and serve. Our target infrastructure cost is $400-500/mo per 1,000 sellers.
- If the SQL approach works well enough (and it will for V1 scale), ML is unnecessary complexity.

### The Non-Negotiables

- **Search is NEVER interest-filtered.** If someone searches "vintage lamp," they see ALL vintage lamps, not just ones matching their interest profile. Search is intent-driven; personalization is discovery-driven.
- **Categories are NEVER interest-filtered.** Browsing a category shows everything in that category. Users must never feel trapped in a personalization bubble.
- **Interest tags are platform-curated, not user-generated.** Prevents spam, maintains quality, enables consistent categorization.

---

---

# TECH STACK DECISIONS

---

## 19. Drizzle ORM over Prisma

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The V2 Pain

V2 used Prisma. The problems were severe:

1. **Binary engine.** Prisma ships a Rust-compiled query engine as a binary. This binary must match the deployment OS exactly. Docker builds failed when the binary was compiled for the wrong platform. Cold starts were slow because the binary had to initialize. The binary added ~15MB to every deployment.

2. **Schema drift was invisible.** Prisma's migration system generates SQL from the schema file, but there's no way to see the actual SQL before it runs without extra tooling. Developers would change the schema, run `prisma migrate dev`, and only discover the SQL was wrong after it executed against the database.

3. **TypeScript inference was shallow.** Prisma generates types, but they're in a separate `@prisma/client` package that must be regenerated after every schema change. The types don't compose well — you can't easily derive a "listing with seller and images" type without hand-writing it. In V2 this led to 100+ hand-written type definitions that drifted from the actual schema.

4. **Raw SQL was a second-class citizen.** When Prisma's query builder couldn't express a query (common with CTEs, window functions, complex joins), you had to drop to `prisma.$queryRaw` which returns `unknown` and has no type safety at all. V2 had 30+ raw SQL calls that were completely untyped.

### Why Drizzle

Drizzle is SQL-first with TypeScript inference built into the schema definition. The schema IS the type system — no generation step, no separate package, no binary. When you define a table in Drizzle, TypeScript immediately knows the insert type, select type, and all relations. Raw SQL and the query builder are the same type system — you can mix them freely.

Drizzle generates standard SQL migrations that you can read, edit, and understand before running. No binary engine. No cold start penalty. ~2KB added to the bundle instead of 15MB.

### The Tradeoff

Drizzle's documentation was thinner than Prisma's at time of decision. Prisma has a larger community and more StackOverflow answers. But the engineering benefits outweigh the ecosystem gap — especially for a project that values TypeScript strictness as an absolute requirement.

---

## 20. Better Auth over NextAuth

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The V2 Pain

V2 used NextAuth (now Auth.js). The problems:

1. **No built-in 2FA.** NextAuth has no native two-factor authentication. V2 had to bolt on a custom TOTP implementation that was fragile and untested. For a marketplace handling money, 2FA is non-negotiable — it can't be an afterthought.

2. **Session management was opaque.** NextAuth manages sessions internally with limited control over token structure, expiry, or revocation. V2 needed to revoke specific sessions (e.g., when a seller changes their password, all other sessions should invalidate). NextAuth made this difficult.

3. **Social login was configuration hell.** Each OAuth provider required extensive configuration with subtle differences. Google, Apple, and Facebook each had their own callback URL requirements, token formats, and edge cases. NextAuth abstracted these differences but the abstraction leaked constantly.

4. **Database adapter limitations.** NextAuth's Prisma adapter had specific schema requirements that conflicted with V2's user model. The `Account` and `Session` tables had fixed schemas that couldn't be extended without forking the adapter.

### Why Better Auth

Better Auth provides 2FA (TOTP + backup codes) out of the box — no custom implementation. Session management gives full control: list active sessions, revoke by ID, set custom expiry. The database schema is flexible and works with Drizzle natively. Social login is simpler because the library handles provider quirks internally rather than exposing them as configuration options.

Better Auth is also designed for the App Router from the ground up, unlike NextAuth which was retrofitted from Pages Router. Server Actions and Route Handlers work without workarounds.

### The Tradeoff

Better Auth has a smaller community than NextAuth/Auth.js. NextAuth has years of battle-testing across thousands of production apps. But Better Auth's feature set is specifically what a marketplace needs (2FA, session control, flexible schema), and the smaller community is offset by cleaner documentation and more predictable behavior.

---

## 21. CASL over Custom RBAC

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The V2 Pain

V2 had custom RBAC spread across 4 separate files. The problems:

1. **Role-based, not attribute-based.** V2 checked "is this user a SELLER?" but couldn't check "is this user the OWNER of this specific listing?" Ownership checks were hand-written per route, inconsistent, and often missing entirely. This is how IDOR vulnerabilities happen.

2. **No frontend/backend unification.** V2 had one permission system for API routes (middleware) and a completely separate system for UI (conditional rendering). They drifted apart — buttons rendered for users who couldn't use them, and API routes were accessible to users who shouldn't reach them.

3. **No delegation support.** When V2 tried to add seller staff (employees who act on behalf of a store), the RBAC system couldn't express "this user can manage listings, but only for this specific seller, and only listings — not orders or payouts." Custom scoping had to be bolted on per route.

4. **Permissions were stringly-typed.** Role names and permission names were strings, not enums. Typos in permission checks (`"manage_listing"` vs `"manage_listings"`) silently failed — the check returned false instead of throwing an error.

### Why CASL

CASL is attribute-based access control (ABAC), not just role-based. It can express "User X can UPDATE Listing WHERE listing.sellerId = user.sellerId" as a single rule. The same rule works on both frontend (hide the edit button) and backend (reject the API call). Conditions are checked against the actual database record, not just the user's role.

CASL subjects are TypeScript-typed. You can't check a permission on a subject that doesn't exist — the compiler catches it. Delegation is natural: define a restricted ability set for staff, scoped to the delegating seller's resources.

The V3 Actors Security Canonical defines 200+ permission rules. Without CASL's composable rule system, implementing these as hand-written `if/else` checks would require thousands of lines of error-prone code.

---

## 22. Typesense over Meilisearch

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### What V2 Planned

V2 planned to use Meilisearch but never implemented search. The evaluation for V3 compared both options.

### Why Typesense Won

1. **Single-index multi-sort.** Meilisearch requires creating separate indexes for each sort order (price-asc, price-desc, newest, relevance). For a marketplace with 10+ sort options across hundreds of categories, this means duplicating the entire dataset 10+ times. Typesense sorts on any field from a single index. This alone saves enormous storage and indexing overhead.

2. **Geo search built-in.** Typesense has native geo-point fields with distance-based sorting and filtering. Critical for local pickup features. Meilisearch added geo search later but it's less mature.

3. **Faceted search with counts.** Typesense returns facet counts (e.g., "Nike: 234, Adidas: 156") in the same query as results. This powers the filter sidebar without a separate query. Meilisearch has facets but the API is less flexible for dynamic category-driven filters.

4. **Written in C++.** Typesense is compiled C++ with predictable memory usage and latency. Meilisearch is Rust — also fast, but Typesense consistently benchmarks faster on large datasets (100K+ documents) with complex filters.

5. **Vector search.** Typesense supports vector embeddings natively, which enables "similar items" features without a separate vector database. Not needed at launch but removes a future integration.

### The Tradeoff

Meilisearch has better developer experience for simple use cases — it's genuinely easier to get started with. Typesense's configuration is more complex. But for a marketplace with millions of listings, complex filters, geo search, and multiple sort orders, Typesense's architecture is fundamentally better suited.

---

## 23. Cloudflare R2 over MinIO and S3

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The Economics

A marketplace serves images. Lots of images. Every listing has 1-12 photos. Every search result page loads thumbnails. Every storefront loads banners and logos. Image egress (bandwidth for serving images to browsers) is the #1 infrastructure cost for image-heavy platforms.

| Provider | Storage/GB/mo | Egress/GB | 1TB egress/mo cost |
|----------|--------------|-----------|-------------------|
| AWS S3 | $0.023 | $0.09 | **$90** |
| MinIO (self-hosted) | ~$0.01 (disk) | Free (self-hosted) | **$0** + server cost |
| Cloudflare R2 | $0.015 | **$0.00** | **$0** |

R2 has zero egress fees. At scale (10TB/mo egress with 100K listings getting browsed), this saves $900/mo vs S3. At larger scale, the savings are enormous.

### Why Not MinIO (Self-Hosted)

V2 planned MinIO. The problems with self-hosting object storage:

1. **Ops burden.** MinIO requires managing disk space, replication, backup, monitoring, and security. One misconfiguration exposes all user images publicly.
2. **No CDN.** Self-hosted MinIO serves from one location. Users far from the server experience slow image loads. Adding a CDN in front defeats the self-hosting cost advantage.
3. **Scaling is manual.** When you run out of disk, you add disks. When you need more throughput, you add nodes. R2 scales automatically.

### Why R2 Specifically

R2 is S3-compatible (same API, same SDKs), so the Provider abstraction pattern means we can swap to S3 or Backblaze B2 later without code changes. R2 includes automatic CDN distribution through Cloudflare's network — images served from the nearest edge location globally. Zero config.

The $0.015/GB storage cost is cheaper than S3, and the zero egress makes budgeting predictable. At our target of $400-500/mo infrastructure cost, egress fees from S3 would blow the budget on images alone.

---

## 24. Centrifugo over Soketi and Pusher

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### Why Real-Time Matters

A marketplace needs real-time for: message delivery (buyer-seller chat), order status updates, offer notifications (accepted/declined/countered), helpdesk case updates (agent-to-user), and auction-like offer windows. Without WebSockets, these all require polling, which means delayed UX and wasted server resources.

### Why Centrifugo

1. **Go binary, single process.** Centrifugo is a compiled Go server that handles 1M+ concurrent connections on modest hardware. It runs as a single binary with no dependencies — no Node.js, no JVM, no runtime. This matters for Hetzner deployment where we control the server.

2. **MIT licensed.** No usage-based pricing. No per-connection fees. No vendor lock-in. Pusher charges per connection per message — at marketplace scale (10K+ concurrent users), this becomes thousands per month.

3. **Server-side publishing.** The Next.js backend publishes events to Centrifugo via HTTP API. Centrifugo handles the fan-out to connected clients. This means the application server never manages WebSocket connections directly — it just sends HTTP POSTs.

4. **Channel-based security.** Private channels (`private-user.{userId}`, `private-case.{caseId}`) with JWT-based subscription tokens. Users can only subscribe to channels they're authorized for. This maps perfectly to CASL — the JWT token encodes what channels the user can access.

### Why Not Soketi

Soketi is a Pusher-compatible open-source server. It's Node.js-based, which means it shares the event loop with the application. Under load, WebSocket handling competes with API request handling. Centrifugo being a separate Go process eliminates this entirely.

### Why Not Pusher

Cost. Pusher's pricing is per-connection and per-message. A marketplace with 10K concurrent users sending real-time updates would cost $500+/mo on Pusher. Centrifugo on our existing Hetzner server costs $0 additional.

---

## 25. Coolify on Hetzner over Vercel

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The Cost Model

| Scale | Vercel Pro | Hetzner + Coolify |
|-------|-----------|-------------------|
| Dev/staging | $20/mo | $5/mo (CX22) |
| 1K sellers, moderate traffic | $100-300/mo | $40/mo (CX32) |
| 10K sellers, high traffic | $1,000-5,000/mo | $80-160/mo (CX42 + CX32 worker) |
| 100K sellers | $5,000-15,000/mo | $400-800/mo (dedicated servers) |

Vercel's pricing is usage-based: bandwidth, serverless function invocations, build minutes. For a marketplace with image-heavy pages, high API call volume, and background jobs, Vercel costs escalate rapidly. The $400-500/mo per 1,000 sellers target from the project brief is impossible on Vercel at scale.

### Why Not Just Hetzner + Docker

Raw Docker on Hetzner requires managing: nginx configuration, SSL certificates, deployment pipelines, rollbacks, log aggregation, environment variables, and health checks. That's a full-time DevOps job.

### Why Coolify

Coolify is a self-hosted PaaS that provides Vercel-like developer experience on your own servers: git push deploy, automatic SSL via Let's Encrypt, Docker-based isolation, environment variable management, one-click rollbacks, and built-in log viewing. It's the bridge between "cheap Hetzner server" and "expensive Vercel convenience."

Coolify runs on the same Hetzner server as the application. Total infrastructure: one Hetzner CX32 ($15/mo) running Coolify + PostgreSQL + Valkey + Centrifugo + the Next.js app. Under $50/mo for the entire stack at launch. Try that on Vercel.

### The Tradeoff

Vercel has better edge caching, automatic image optimization, and zero-config scaling. Coolify requires more manual configuration for advanced features. But for a team of one (Adrian) building to profitability, the 10-50x cost difference is decisive. Vercel is a luxury for funded startups. Coolify is infrastructure for bootstrappers.

---

## 26. Built-in Helpdesk over Zendesk

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### Why Not Zendesk

1. **Cost at scale.** Zendesk charges $55-115/agent/month. At 10 agents, that's $550-$1,150/mo for a tool that still needs heavy customization to understand our commerce model.

2. **Commerce context gap.** When a buyer files a claim about a damaged item, the agent needs to see: the order details, the listing photos, the seller's return policy, the tracking information, the buyer's claim photos, and the seller's response — all in one view. No third-party helpdesk provides this natively. Building a Zendesk integration that pulls all this data requires custom API work, and it breaks every time Zendesk updates their API.

3. **Data sovereignty.** Case data includes buyer PII, seller financial information, dispute evidence, and internal resolution decisions. Storing this in a third-party system means data processing agreements, GDPR compliance with a vendor, and export gymnastics if we ever switch.

4. **Unified real-time.** Our helpdesk updates via the same Centrifugo infrastructure as orders and messages. A third-party helpdesk would need its own WebSocket layer or polling, creating inconsistent real-time behavior.

5. **Brand continuity.** Buyers submit cases at `/h/contact` on twicely.co. Agents work at `/hd/*` on hub.twicely.co. Same design system, same auth, same app. A Zendesk widget looks and feels foreign.

### The Tradeoff We Accept

We build more code. The helpdesk canonical is 1,500+ lines of specification. Implementation will take weeks. But the code is simpler than building + maintaining a Zendesk integration forever, and we own every pixel of the agent experience. The commerce context panel — showing order, listing, seller, return, and dispute data in one sidebar — is the feature that makes our helpdesk genuinely better than Zendesk for our use case.

---

## 27. Puck for Storefronts, Not for KB

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED (KB editor deferred)

### The Distinction

Storefronts and knowledge base articles are fundamentally different content types:

| Dimension | Storefront | KB Article |
|-----------|-----------|------------|
| Content type | Visual layout (hero banners, product grids, brand colors) | Structured text (headings, paragraphs, steps, code blocks) |
| Editor persona | Seller (non-technical, wants drag-and-drop) | Support staff (semi-technical, wants formatting control) |
| Output | Custom page layout with widgets | Document with headings, links, images |
| Analogous to | Shopify theme editor | Google Docs / Notion |

### Why Puck for Storefronts

Puck is a React page builder. Sellers drag components (hero banner, featured listings grid, about section, custom text block) onto a canvas and arrange them visually. This is perfect for storefronts — sellers need visual impact without code. Puck generates a JSON config that renders deterministically. Available at Elite+ Store tier.

### Why NOT Puck for KB

A page builder is overkill for articles. KB authors need: headings, bold/italic, bullet lists, numbered steps, images, code blocks, tables, internal links. That's a document editor, not a page builder. Using Puck for articles would mean building custom "paragraph block," "heading block," "list block" components that replicate what a rich text editor does natively.

The KB editor decision is deferred (not in first 10 slices). Candidates: Tiptap (via Novel), BlockNote, or Lexical. All are proper document editors that output structured content. The decision will be made when we reach the KB slice, evaluated against the specific needs of support staff authoring help articles.

---

# ARCHITECTURE & ENGINEERING DECISIONS

---

## 28. Vertical Slices over Horizontal Layers

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The V2 Disaster

V2 built horizontally: all database models first (241 Prisma models), then all API routes (184 routes), then all pages. The result:

- 241 models existed with no UI to test them. Nobody knew if the models worked together until months later when pages were built.
- 184 API routes existed that nobody called. Half returned the wrong data because they were built without knowing what the UI needed.
- Integration debt was massive. Connecting pages → APIs → models revealed hundreds of mismatches.
- Nothing was shippable until everything was done. There was no point at which a user could complete a single flow.

### Why Vertical Slices

A vertical slice delivers one complete user journey: UI → API → DB → back to UI. After Slice B1 (Browse & Search), a real user can search for listings and view them. After B3 (Cart & Checkout), a buyer can actually purchase something. Each slice is independently shippable and testable.

This means:

- **Bugs surface early.** When the UI, API, and database are built together, integration issues appear immediately — not months later.
- **Prioritization is meaningful.** If we run out of time, we have a working marketplace with N features, not a non-working marketplace with all features half-built.
- **Testing is natural.** Each slice has a clear E2E test: "can a user complete this flow?" You can't write that test for a horizontal layer.
- **Morale is real.** Shipping working features feels good. Shipping 50 database models that nobody can use feels like busywork.

### The Rule

Build order within each slice: UI first (what does the user see?), then API (what data does the UI need?), then schema (what does the database need?), then background jobs (what happens async?). If a user can't see it and interact with it, it doesn't exist yet.

---

## 29. Category-Based TF over Flat-Rate

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### How eBay Does It

eBay charges different transaction fees by category. Electronics is typically lower (around 9-13% depending on sub-category) because margins are thin and competition from Amazon is fierce. Collectibles and luxury goods are higher (up to 15%) because margins are fat and buyers expect to pay more.

This isn't arbitrary — it reflects the economics of each vertical. Electronics sellers operate on 10-20% margins and won't list on a platform that takes 15%. Vintage clothing sellers operate on 60-80% margins and barely notice 12%.

### Why Not Flat-Rate

A flat 10% fee seems simpler. But it creates two problems:

1. **Loses electronics sellers.** A flat 10% is too high for electronics (where eBay charges 9%). Sellers comparing platforms will choose the one with lower fees for their category. Electronics is the highest-volume category in resale — losing it means losing supply.

2. **Leaves money on the table for luxury.** Collectibles and luxury sellers are willing to pay more because their margins support it and the platform provides trust infrastructure (authentication, buyer protection) that's more valuable for high-value items. Charging them 10% when they'd pay 11.5% is free revenue lost.

### Twicely's Four Buckets

| Bucket | Rate | Categories | Rationale |
|--------|------|-----------|-----------|
| ELECTRONICS | 9% (900bps) | Electronics, phones, computers, gaming | Competitive with eBay's 9-13% range. Attracts volume. |
| APPAREL_ACCESSORIES | 10% (1000bps) | Clothing, shoes, bags, accessories | Standard marketplace rate. Fashion is the core of resale. |
| HOME_GENERAL | 10% (1000bps) | Home goods, sporting, automotive, everything else | Catch-all at the median rate. |
| COLLECTIBLES_LUXURY | 11.5% (1150bps) | Collectibles, jewelry, watches, art, antiques | Higher margin supports higher fee. Authentication value justifies premium. |

Store tier discounts (0.1% to 0.75% off) apply on top, incentivizing subscription upgrades. The TF is calculated as a pure function: `(itemPrice + shipping) × (baseRate - tierDiscount)`. No async, no DB calls, fully deterministic and testable.

---

## 30. No Per-Order Fee on Twicely Sales

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### What Competitors Do

| Platform | TF | Per-Order Fee | Total on $50 item |
|----------|-----|-------------|-------------------|
| eBay | 13.25% | $0.30 | $6.93 |
| Poshmark | 20% (flat) | $0 | $10.00 |
| Mercari | 10% | $0 | $5.00 |
| **Twicely** | **10%** | **$0** | **$5.00** |

### Why No Per-Order Fee

Per-order fees ($0.30, $0.50) disproportionately hurt low-price sellers. A $5 item with a $0.30 per-order fee means 6% of the sale goes to the fixed fee alone, on top of the percentage-based TF. Resale marketplaces have many low-price items ($5-$20 range). A per-order fee makes listing these items uneconomical.

Removing the per-order fee is a seller recruitment tool. When comparing Twicely to eBay, the $0.30 per-order fee disappearing is an easy-to-understand advantage. "We take 10%, period. No hidden fees." This messaging is cleaner than "we take 10% plus $0.30 per order."

The revenue we lose on per-order fees is negligible compared to the TF revenue. At $50 average order value, $0.30 is 0.6% of the sale. We'd rather have the cleaner pricing story.

---

## 31. No Fees on Off-Platform Sales

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The Strategic Reasoning

The crosslister helps sellers manage listings on eBay, Poshmark, Mercari, etc. When a sale happens on eBay, should Twicely take a cut?

No. And here's why:

1. **Crosslister revenue comes from subscriptions.** Sellers pay $9.99-$79.99/mo for the crosslisting tool. That's the revenue model. Adding per-sale fees on external platforms would make the crosslister uncompetitive with standalone tools like List Perfectly or Vendoo, which don't charge per-sale fees.

2. **Trust is the growth engine.** Sellers need to trust that connecting their eBay account to Twicely won't cost them money on eBay sales. If we took fees on external sales, sellers would hesitate to connect their accounts, killing the import flywheel.

3. **Double-dipping perception.** A seller paying $29.99/mo for crosslisting AND paying 5% on every eBay sale feels like being charged twice. Even if the economics work out to less than a competitor, the perception of double-dipping is toxic for retention.

4. **The real play is migration.** Sellers who crosslist eventually realize Twicely's fees (10%) are lower than eBay's (13%+) and Poshmark's (20%). Over time, sellers naturally shift volume to Twicely — where we DO earn TF. No per-sale fee on external platforms accelerates this migration because there's no penalty for selling anywhere.

---

## 32. Boosting: 7-Day Attribution with 30% Cap

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### What Boosting Is

Sellers pay 1-8% of the sale price (their choice) to promote their listings in search results. Boosted listings appear above organic results with a subtle "Promoted" label.

### Why 7-Day Attribution

When a buyer sees a boosted listing in search on Monday and buys it on Thursday, did the boost cause the sale? Attribution windows answer this question.

- **1-day window:** Too short. Buyers browse, add to watchlist, and return later. A 1-day window would credit almost no sales to boosting, making the feature seem worthless.
- **30-day window:** Too long. A buyer who saw a boosted listing a month ago and buys it today probably forgot about the boost. Attributing that sale to boosting means sellers pay for coincidences.
- **7-day window:** The sweet spot. Resale buyers typically decide within a week. Long enough to capture browse-then-buy behavior, short enough to maintain credible attribution. eBay Promoted Listings uses a 30-day window — we're more seller-friendly by using 7 days.

### Why 30% Maximum in Search Results

If every listing in search results is boosted, the results become an ad feed, not a search engine. Buyers lose trust that results are relevant. eBay struggles with this — some categories show 50%+ promoted listings, degrading the search experience.

30% cap means in a page of 20 results, maximum 6 are promoted. The other 14 are organic. This preserves search quality while giving boosted listings meaningful visibility. The cap also creates scarcity — not every seller who boosts gets top placement, which maintains the value of boosting.

### Why Refunded on Returns

If a buyer purchases a boosted listing and returns it, the seller shouldn't pay the boost fee on a sale that didn't stick. Refunding the boost on returns aligns incentives: sellers only pay for boost on successful, completed sales.

---

## 33. Append-Only Ledger Architecture

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED
**Builds in:** C3 (Stripe Connect)

### Why Not Simple Balance Tracking

The simple approach: seller has a `balance` column. Sale happens, increment balance. Payout happens, decrement balance. Return happens, decrement balance. This is what many tutorials teach. It's wrong for a marketplace.

Problems with mutable balance:

1. **No audit trail.** If a seller's balance is $500, you can't explain how it got there without querying every order, return, and payout. If a bug sets it to $5,000, you can't tell when or why.

2. **Concurrent mutation.** Two sales completing simultaneously both read balance=$100, both add $50, both write $150. The correct balance is $200. This requires database locks on every balance update, which becomes a bottleneck at scale.

3. **No reconciliation.** Stripe says you transferred $1,000 to sellers this month. Your database says $1,050. Which is right? With mutable balances, you can't trace the discrepancy. With a ledger, you can replay every entry and find the exact transaction that diverged.

### Why Append-Only Ledger

The ledger is a sequence of immutable entries. Each entry records: amount (positive or negative), type (SALE_CREDIT, TF_DEBIT, PAYOUT, REFUND, etc.), order reference, and timestamp. The seller's balance is the SUM of all their ledger entries. Delete the cached balance, replay the ledger, get the same number.

Corrections are new entries, not edits. If a $50 fee was charged incorrectly, you don't change the original entry — you add a reversal entry for -$50 that references the original. Both entries exist forever. The audit trail is complete.

This is how real financial systems work. Banks don't edit transaction histories. They add correction entries. Twicely's ledger follows the same principle because we handle real money and must be able to explain every cent at any point in time.

---

## 34. Payout Frequency Gated by Store Tier

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The Hidden Cost of Daily Payouts

Stripe Connect charges $0.25 per payout transfer. This seems trivial until you multiply:

| Frequency | Cost/Seller/Month | At 10K Sellers | At 100K Sellers |
|-----------|-------------------|---------------|----------------|
| Daily | $7.50 | $75,000/mo | **$750,000/mo** |
| 2x/week | $2.00 | $20,000/mo | $200,000/mo |
| Weekly | $1.00 | $10,000/mo | $100,000/mo |

Daily payouts for 100K sellers costs $9M/year. That's real money that comes directly out of Twicely's margin.

### The Solution: Gate by Store Tier

| Store Tier | Payout Frequency | Stripe Cost/Seller/Mo |
|-----------|-----------------|----------------------|
| No Store | Weekly (Friday) | $1.00 |
| Starter | Weekly (configurable day) | $1.00 |
| Basic | 2x/week | $2.00 |
| Pro | Daily | $7.50 |
| Elite+ | Daily or on-demand | $7.50+ |

Sellers who want faster payouts upgrade to a higher Store tier — which has a monthly subscription fee that more than covers the Stripe payout cost. A Pro seller paying $39.99/mo generates enough subscription revenue to cover the $7.50/mo payout cost with margin to spare.

This is what eBay does. Weekly payouts are default. Faster payouts require store subscriptions. It's a proven model that controls costs while giving power sellers the cash flow they need.

---

## 35. Provider Abstraction Pattern

**Date:** Pre-V3 (architectural decision)
**Status:** LOCKED

### The Principle

The tech stack is locked for development — we don't debate Drizzle vs Prisma. But the tech stack is NOT locked for production. The platform must be able to swap Cloudflare R2 → Amazon S3, Resend → SES, Typesense → Algolia from the admin UI without deploying new code.

### Why This Matters

1. **Vendor risk.** If Cloudflare has an outage, we can switch to S3 by changing a config row in the database. If Resend raises prices 10x, we switch to SES without a code deployment.

2. **Cost optimization at scale.** At 1,000 sellers, Resend is cheaper than SES because of DX savings. At 100,000 sellers, SES is cheaper because of volume pricing. The provider pattern lets us switch when the economics shift.

3. **Testing.** In development, we can use local storage instead of R2, console email instead of Resend, and SQLite-backed search instead of Typesense. No external service dependencies for running tests.

### How It Works

Three database tables: ProviderAdapter (what's available), ProviderInstance (configured with credentials), ProviderUsageMapping (routes usage to instance). Application code calls `getProvider("listing-images")` and gets back whichever storage provider is configured. The interface is the same regardless of whether the backend is R2, S3, or a test mock.

### What We Don't Abstract

Stripe. Payments are too deeply integrated and too critical to abstract. The cost of a payment provider bug is orders of magnitude higher than a storage provider bug. Stripe stays as a direct dependency. If we ever need to switch payment processors (unlikely), it's a deliberate engineering project, not a config change.

---

## 36. 300-Line File Limit

**Date:** Pre-V3 (engineering standard)
**Status:** LOCKED

### Why 300 Lines

1. **Cognitive load.** Research on code comprehension shows that developers lose context when reading files longer than ~300 lines. They scroll, forget what was at the top, scroll back. Split files force separation of concerns — each file has ONE job.

2. **Code review quality.** V2 had files over 1,000 lines. Code reviewers (both human and AI) skim long files. Important bugs hide in line 847 of a 1,200-line file. In a 200-line file, every line gets read.

3. **AI code generation accuracy.** Claude Code performs measurably worse on long files. It "forgets" constraints from the top of the file when generating code at the bottom. It conflates functions that are 500 lines apart. Keeping files under 300 lines means Claude Code can hold the entire file in working memory.

4. **Merge conflicts.** Two developers editing a 1,000-line file almost always conflict. Two developers editing separate 200-line files rarely conflict. This matters less for a solo project but becomes critical when Claude Code runs in parallel sessions.

### What Counts

Lines of actual code, not blank lines or comments. If a file hits 300 lines, find the natural seam and split: extract a helper function, separate a sub-component, move types to a shared file.

### What Doesn't Count

Generated files (migrations, seed data) can exceed 300 lines. But hand-written application code follows the limit without exception.

---

## 37. Soft Cart Reservation

**Date:** Pre-V3 (product decision)
**Status:** LOCKED

### What "Soft" Means

Adding an item to the cart does NOT prevent other buyers from purchasing it. If Buyer A adds an item to cart and Buyer B buys it at checkout, Buyer A sees "This item has been sold" in their cart.

### Why Not Hard Reservation

Hard reservation (locking an item when it enters a cart) creates three problems:

1. **False scarcity.** A buyer adds 10 items to cart while browsing, leaves for lunch, and comes back 2 hours later. Those 10 items were locked for 2 hours with no purchase intent. Other serious buyers were blocked from purchasing.

2. **Cart abandonment weaponization.** Competitors (or trolls) could add every listing from a seller to their cart, locking the seller's entire inventory. Even with expiry times, this creates windows of artificial unavailability.

3. **Expiry UX complexity.** Hard reservation requires a countdown timer ("this item is reserved for 15 minutes"), which creates purchase pressure that feels manipulative on a resale platform. eBay doesn't do this. Amazon does it for high-demand items only.

### What We Show Instead

Instead of fake reservation urgency, we show real social proof: "14 people watching this item · 3 offers pending." This creates genuine urgency (this item IS in demand) without locking inventory or lying about scarcity. The watcher count and offer count are real numbers, not inflated.

### The One Exception

During the checkout flow itself (after the buyer clicks "Pay"), we DO lock the item via SELECT FOR UPDATE in the database transaction. This is a seconds-long technical lock to prevent the oversell race condition, not a user-facing reservation. If another buyer completes checkout first, the second buyer gets a 409 Conflict.

---

## 38. One Conversation per Buyer-Seller-Listing

**Date:** Pre-V3 (product decision)
**Status:** LOCKED

### The Rule

Every buyer-seller messaging conversation is tied to a specific listing. There is no free-form messaging between users without a listing context. "Ask seller a question" on a listing page creates or reopens a conversation about THAT listing. One conversation per buyer-seller-listing combination.

### Why Require a Listing Context

1. **Anti-spam.** Without a listing requirement, bad actors can message every user on the platform. With it, messaging requires engaging with a real listing — which means the sender has at least some legitimate interest.

2. **Commerce context.** When a buyer messages about damaged item photos, the agent resolving the dispute needs to see which listing and which order the conversation is about. Listing-linked conversations provide this context automatically. Free-form conversations would need manual tagging.

3. **Off-platform transaction detection.** Messages are scanned for phone numbers, email addresses, and external payment mentions ("Venmo", "CashApp"). This scanning is meaningful when the conversation is about a specific listing. In free-form chat, the false positive rate would be unmanageable.

4. **Conversation lifecycle management.** When a listing sells, the conversation automatically gets the order linked. When the order is delivered, the conversation stays open for 30 days (return window). After that, it becomes read-only. These lifecycle rules only work because the conversation is tied to a specific commerce entity.

### What This Prevents

A seller can't message buyers to promote their store. A buyer can't message sellers without engaging with their inventory. There's no "social" messaging layer — Twicely is a marketplace, not a social network. If a buyer wants to ask about multiple items, they use the messaging thread for each listing separately, or make a bundle offer (which creates its own conversation context).

---

---

# TRUST, LOCAL & AUTHENTICATION DECISIONS

---

## 39. Authentication Cost Split Model

**Date:** 2026-02-17
**Status:** LOCKED
**Builds in:** D1 (Storefront — badge), G (AI tier), Post-launch (Expert tier)

### The Problem

When Twicely authenticates an item, who pays? Three options: buyer pays all, seller pays all, or split. Each creates different incentives.

### Why 50/50 Split on Authentic Items

| Result | Who Pays | Why |
|--------|----------|-----|
| **Authentic** | 50/50 — seller $9.99, buyer $9.99 | Both parties benefit. Seller gets a trust badge that increases sale probability and price. Buyer gets peace of mind. Shared cost means neither party bears an unfair burden. |
| **Counterfeit** | Seller pays full $19.99 + listing removed + strike | Seller caused the problem by listing a fake. Full cost + punitive consequences disincentivize fraud. |
| **Inconclusive** | Twicely absorbs | Rare outcome. Neither party should pay for uncertainty. Cost of doing business for the platform. |

### The Seller Incentive

Sellers SHOULD want authentication. If they're selling authentic luxury goods, $9.99 to prove it is trivial — they'll sell faster, at higher prices, with fewer disputes. If they're selling fakes, they won't opt in because they'll eat $19.99 + get a strike. Authentication becomes a self-selection filter for honest sellers.

### Money Flows Within the Transaction

Adrian's critical rule: no lingering credits, no "deduct from next payout." Everything settles within THIS transaction.

For buyer-initiated: buyer pays $19.99 at checkout. If authentic, seller's $9.99 share is deducted from item proceeds before payout — same line item as TF. Seller sees: "Authentication cost share: -$9.99" on their payout statement. If counterfeit, buyer gets full refund including the $19.99. Seller is charged $19.99 against their Stripe Connect balance.

For seller-initiated pre-listing: seller pays $19.99 upfront. If authentic, badge applied, seller recoups through higher sale price. If counterfeit, $19.99 captured, listing blocked, strike issued.

---

## 40. Never Trust External Authentication

**Date:** 2026-02-17
**Status:** LOCKED

### The StockX Tag Problem

Documented on Reddit, YouTube, and sneaker forums: someone buys real Jordans from StockX, gets the green tag, returns fakes to StockX (or swaps), and now has a real StockX tag on a fake shoe. Lists on any platform: "StockX Authenticated ✓." Buyer trusts the tag. Buys a counterfeit.

StockX's authentication is a one-time, point-in-time event tied to a physical tag. Once the tag leaves StockX's chain of custody, it's meaningless. The tag can be cloned, transferred, or faked.

### Twicely's Three Principles

**Principle 1: Only Twicely authentication earns a Twicely badge.** A seller saying "StockX authenticated" gets zero Twicely trust indicators. They can mention it in their description, but the platform displays: "This is a seller-provided claim. Twicely has not independently verified this item. [Request Twicely Authentication — $9.99 your share]." Honest + drives revenue.

**Principle 2: Per-item, per-transaction certificates.** Every Twicely authentication is tied to a specific `listingId` + `authenticationRequestId` + timestamped photos + unique certificate number (TW-AUTH-XXXXX). If the item is relisted, the old certificate invalidates. Certificates don't transfer — they die with the transaction.

**Principle 3: Photo fingerprinting (pHash).** Timestamped photos from authentication are perceptually hashed. If someone screenshots a certificate and tries to apply it to a different item, the photo fingerprint won't match. Public verification URL (`twicely.co/verify/TW-AUTH-XXXXX`) shows the original authentication photos — buyer can visually confirm the item matches.

### Competitive Advantage

| | StockX | eBay | The RealReal | **Twicely** |
|---|--------|------|-------------|-------------|
| Tags fakeable? | **Yes** | Less common | Less common | **Per-item pHash + non-transferable cert** |
| Transfers to resale? | Tag stays on item | No | No | **Certificate invalidates on relist** |
| External claims honored? | N/A | N/A | N/A | **Never — explicit disclaimer + nudge to Twicely auth** |

---

## 41. QR Code Escrow for Local Pickup

**Date:** 2026-02-17
**Status:** LOCKED
**Builds in:** Per Build Sequence Tracker

### The Problem

Local pickup transactions need a physical confirmation moment — the buyer has inspected the item and is satisfied. An "I confirm receipt" button could be tapped accidentally, under pressure, or before actual inspection.

### Why QR Code

The QR scan is a deliberate physical action that requires both parties to be present:

1. Buyer pays through Twicely → auth hold placed (escrow)
2. Buyer and seller meet at agreed location
3. Buyer inspects item → satisfied
4. Seller shows QR code in their app (single-use, time-limited, generated per-transaction)
5. Buyer scans QR code → confirmation modal: "Release $X to seller?" → taps "Confirm"
6. Payment captured → seller gets paid

The QR code is the digital equivalent of a handshake. It requires physical proximity (can't scan remotely), conscious action (modal confirmation), and is cryptographically unique (can't reuse or forge).

### Offline Fallback

No cell signal at the meetup location? Two fallback layers:

1. **6-digit numeric code:** Seller reads code aloud → buyer enters in app → same confirmation flow. Works on minimal connectivity.
2. **Full offline:** Both parties have no signal. Buyer enters offline code, app stores confirmation locally, syncs to server when connectivity returns. Grace period: 2 hours. If sync doesn't happen within 2 hours, auto-escalation to support.

### Why Not Just a Button

A button on the buyer's phone has no proof of physical presence. A dishonest buyer could tap "confirm" before meeting, or a seller could pressure the buyer to confirm before inspection. The QR code creates a verifiable moment: the buyer's phone camera captured the seller's screen, proving proximity and deliberate action.

---

## 42. Local Transaction Fee Model

**Date:** 2026-02-17
**Status:** LOCKED

### The Structure

| Payment Method | Fee | Buyer Protection |
|---------------|-----|-----------------|
| In-app (Stripe) | 5% local fee + Stripe processing (2.9% + $0.30) | Full escrow protection, dispute resolution |
| Cash at meetup | 0% | None — disclosed clearly before checkout |

### Why 5% for In-App

The 5% covers the cost of the escrow infrastructure, dispute resolution, and buyer protection for local transactions. It's lower than the standard TF (9-11.5%) because there's no shipping, no packaging, and lower risk of damage-in-transit claims.

### Why 0% for Cash

If the buyer pays cash, Twicely has no financial involvement in the transaction. We can't escrow cash, can't reverse it, can't protect either party. Charging a fee for zero service would be dishonest. The 0% cash rate also serves a strategic purpose: it gets sellers onto the platform even if they don't want to pay fees. Once they're listing on Twicely for local sales, they're discoverable by shipped-order buyers — pulling them into the TF revenue stream.

### No Minimum Transaction Value

Any price can be sold locally. A $3 thrift store find is just as valid as a $300 handbag. No floor.

---

## 43. No-Show Penalty for Local Meetups

**Date:** 2026-02-17
**Status:** LOCKED

### The Rule

$5 fee to the other party. Three no-shows within 90 days = 90-day suspension from local transactions.

### Why $5

High enough to discourage casual no-shows. Low enough that it doesn't feel punitive for genuine emergencies (car broke down, sick kid). The $5 goes to the party who DID show up — compensating their time and gas. It's not a Twicely revenue stream; it's a fairness mechanism.

### Why 3 Strikes

One no-show can happen to anyone. Two is a pattern. Three is abuse. The 90-day ban is from local transactions only — the seller/buyer can still use shipped transactions. This is proportional: the punishment matches the behavior (unreliable for meetups → can't do meetups).

---

## 44. Combined Shipping: Five Modes

**Date:** 2026-02-17
**Status:** LOCKED

### The Five Modes

| Mode | How It Works | Auto-Apply? |
|------|-------------|------------|
| **Individual** | Each item ships separately at its listed rate | Yes (default) |
| **Flat Combined** | Seller sets one flat rate for any multi-item order | Yes |
| **Per-Additional** | First item = full rate, each additional = reduced rate | Yes |
| **Auto-Discount %** | System applies X% discount on combined shipping | Yes |
| **Seller-Quoted** | System holds items in escrow, seller provides custom combined rate | No — requires seller response |

First four auto-apply at checkout with no friction. Fifth mode is an escrow flow.

### Why Seller-Quoted Gets a 48-Hour Penalty

When a buyer selects "Request Combined Shipping Quote," the items are held pending the seller's response. If the seller doesn't respond within 48 hours, the buyer gets 25% off the combined shipping automatically. This prevents sellers from enabling the quote option and then ignoring requests — wasting buyer time and locking up their purchase intent.

The 48-hour window is admin-configurable via Platform Settings. The 25% penalty is also configurable. Both are defaults, not hardcoded.

---

# FINANCIAL & SUBSCRIPTION DECISIONS

---

## 45. Financial Center as Fourth Subscription Axis

**Date:** 2026-02-17
**Status:** LOCKED

### The Vision

Adrian's directive: "We want them to run their resale business from Twicely." The crosslister keeps sellers on Twicely for listings. The Financial Center keeps them on Twicely for money. Every reason to leave the platform disappears.

### Why a Fourth Axis (Not Just Store Bundling)

Initially, the Financial Center was proposed as a Store tier feature only. But many sellers crosslist without having a Twicely store — they're eBay/Poshmark sellers using Twicely as a management tool. These sellers still need P&L reports, expense tracking, and tax prep. Gating Finance behind Store subscriptions would exclude the crosslister-only segment, which is a huge part of the user base.

Making Finance an independent axis (FinanceTier) follows the same pattern as Store/Lister/Automation: buy what you need, nothing more. A BUSINESS seller doing $2K/month with no store and no crosslister can buy Finance Pro at $4.99/mo for P&L reports.

### The Tiers

| Tier | Price (annual/mo) | Key Features |
|------|-------------------|-------------|
| FREE | $0 | Revenue dashboard, last 30 days |
| Lite | $4.99/$6.99 | P&L, unlimited expenses, COGS, CSV export, 1yr history |
| Plus | $9.99/$12.99 | + Receipt scanning (AI), mileage tracker, tax prep, 3yr history |
| Pro | $19.99/$24.99 | + Balance sheet, cash flow, inventory aging, QuickBooks/Xero sync, 7yr history |
| Enterprise | Custom | + API access, multi-entity, custom reports, 10yr history |

### Gate: Requires BUSINESS Status

Same gate as Store subscriptions. A casual PERSONAL seller flipping 5 items a month doesn't need P&L statements. They see the FREE dashboard only. BUSINESS upgrade is free — it's a status, not a paywall.

---

## 46. Finance Included in Store Tiers Plus Standalone

**Date:** 2026-02-17
**Status:** LOCKED

### Dual Access Model

| Store Tier | Finance Included |
|-----------|-----------------|
| No Store | Finance FREE only |
| Starter | Finance Pro |
| Basic | Finance Pro |
| Pro | Finance Pro |
| Elite | Finance Pro |
| Enterprise | Finance Pro |

Sellers wanting a higher Finance tier than what their Store includes can upgrade Finance independently. The subscription system tracks which Finance tier came from Store inclusion vs. standalone purchase.

### Why This Structure

Store subscribers get Finance as a value-add that reinforces the subscription. "Your Pro store includes expense tracking and mileage logging" — that's a meaningful differentiator when comparing Store tiers. But non-Store sellers aren't locked out — they can buy Finance à la carte. This mirrors the crosslister model: included in bundles, available standalone.

---

## 47. Three-Product Lock-In Strategy

**Date:** 2026-02-17
**Status:** LOCKED (strategic)

### The Moat

A seller using all three products has catastrophic switching costs:

1. **Crosslister** — "All my listings across 6 platforms are managed here."
2. **Financial Center** — "All my business finances, expenses, mileage, and tax data for the last 3 years are here."
3. **Marketplace** — "My lowest fees and best buyer trust are here."

Leaving Twicely means: re-listing on a new crosslisting tool (hours of work), losing financial history (can't export 3 years of categorized expenses easily), and losing the marketplace's trust signals (ratings, protection, authentication badges).

### Why This Is Defensible

eBay won't build a crosslister (it sends volume to competitors). Vendoo and List Perfectly won't build a financial center (they're listing tools, not business tools). QuickBooks won't build a marketplace. No single competitor can replicate all three products. The moat is the ecosystem, not any single feature.

Every time a seller opens the Financial Center and sees Twicely's lower effective take rate compared to eBay, it reinforces why they should push more volume through Twicely. The Financial Center is a strategic weapon disguised as a bookkeeping tool.

---

## 48. Variation Scope Hierarchy

**Date:** 2026-02-17
**Status:** LOCKED (adopted from V2)

### The Three Tiers

**PLATFORM level** — Twicely defines the master list of 13 variation types (SIZE, COLOR, MATERIAL, STYLE, PATTERN, FINISH, STORAGE_CAPACITY, CONNECTIVITY, VOLTAGE, WEIGHT, LENGTH, INSEAM, WIDTH). Every category starts with access to all of them.

**CATEGORY level** — Platform admins restrict which types apply per category. Electronics gets SIZE + STORAGE_CAPACITY but not COLOR. Clothing gets SIZE + COLOR but not STORAGE_CAPACITY. Also controls valid VALUES — Clothing/SIZE offers XS-5XL, Shoes/SIZE offers 4-16 with half sizes.

**SELLER level** — Individual sellers narrow from what the category allows, but never add types the category doesn't permit. A clothing seller can offer SIZE only (no COLOR) for a simple tee, but can't add STORAGE_CAPACITY.

### Why Not Flat (All Types, All Categories)

A book seller shouldn't see COLOR/MATERIAL options. A phone seller shouldn't see INSEAM. Showing all 13 types to every seller regardless of category creates confusion, bad data quality (sellers picking irrelevant types), and polluted search filters. The hierarchy costs almost nothing to implement (seed data + one filter at listing creation) and prevents garbage data from entering the system.

---

## 49. BNPL on Offers

**Date:** 2026-02-17
**Status:** LOCKED

### The Decision

Buy Now Pay Later works on offers. Stripe handles it transparently.

### Why This Is Simple

Stripe's BNPL (Affirm, Klarna, Afterpay) works at the payment method level, not the transaction type level. When a buyer's offer is accepted and the authorization hold captures, Stripe handles the BNPL split payments internally. Twicely receives the full amount immediately — Stripe absorbs the BNPL credit risk.

No special offer logic needed. No different payment flows. The buyer selects a BNPL payment method when making the offer, the authorization hold is placed through that method, and capture works identically. Twicely doesn't even know if a payment was BNPL or not in most cases — it's Stripe's problem.

---

## 50. Returns Fee Allocation Bucket System

**Date:** 2026-02-17
**Status:** LOCKED
**Builds in:** C4 (Returns & Disputes)

### The Problem

"Fault-based fee allocation" was referenced in multiple V3 docs but never formalized. Without a stored bucket on each return record, every return requires manual classification by support staff.

### The Four Buckets

| Bucket | Return Reasons | Who Pays Return Shipping | Restocking | TF Treatment |
|--------|---------------|-------------------------|-----------|--------------|
| `SELLER_FAULT` | INAD, DAMAGED, WRONG_ITEM, COUNTERFEIT | Seller | 0% | Per hybrid model (§1) |
| `BUYER_REMORSE` | Changed mind, didn't fit, ordered wrong | Buyer | Up to 15% | Per hybrid model (§1) |
| `PLATFORM_CARRIER_FAULT` | LOST, DAMAGED_IN_TRANSIT (Twicely label) | Platform absorbs | 0% | Full refund to seller |
| `EDGE_CONDITIONAL` | Partial damage, wrong variant, grey areas | Staff must reclassify | Negotiated | Case-by-case |

### Why `EDGE_CONDITIONAL` Exists

Not every return fits cleanly into fault buckets. "Item mostly matches description but has a small flaw not shown in photos" — is that SELLER_FAULT or BUYER_REMORSE? Rather than forcing bad classification, EDGE_CONDITIONAL pauses automated allocation and routes to support staff who reclassify after reviewing evidence. No refund processes until reclassification.

### Schema Impact

`returnReasonBucket` stored as an enum on the return record. Deterministic mapping: `ReturnReason → ReturnReasonBucket` runs automatically, but staff can override. Refund breakdown tracked per-return: `refundItemCents`, `refundShippingCents`, `refundTaxCents`, `restockingFeeCents`, `feeAllocationJson`.

---

## 51. Finance Engine as Standalone Canonical

**Date:** 2026-02-16
**Status:** LOCKED (document structure decision)

### The Separation

Monetization Canonical defines WHAT to charge (fee rates, tier pricing, TF rules). Finance Engine Canonical defines HOW money flows through the system (ledger entries, posting rules, balance derivation, payout batching, reconciliation).

### Why Not One Document

The Finance Engine Canonical is 1,000+ lines of ledger architecture, posting rules, double-entry patterns, and reconciliation logic. Bolting that onto the 637-line Monetization Canonical would create a 1,600+ line document covering two different concerns. Different audiences read each: product managers read Monetization (what do we charge?), engineers read Finance Engine (how does money actually move?).

The separation follows the Lister Canonical pattern — crosslisting is a domain complex enough to warrant its own doc, and so is finance.

---

## 52. Provider Abstraction for Expansion

**Date:** 2026-02-16
**Status:** LOCKED

### The Initial Mistake

The initial assessment dismissed the Provider System entirely because V3's tech stack is locked. "There's no 'pick your provider' flexibility."

### Adrian's Correction

The Provider System isn't about indecision — it's about operational control. The admin needs a place to store API keys, view connection status, and swap providers when business needs change. It's the admin control panel for all external service integrations.

### What It Actually Is

Three database tables: ProviderAdapter (what adapters exist), ProviderInstance (configured with encrypted credentials), ProviderUsageMapping (maps usage contexts to instances). Admin UI at `hub.twicely.co/cfg/providers` lets staff view status, rotate keys, and swap instances.

### Why It Matters

1. **Key rotation.** API keys expire, get compromised, or need rotation. Without a provider system, keys live in `.env` files and require a code deployment to change. With provider tables, an admin changes a key in the UI and it's live immediately.
2. **Redundancy.** If Resend goes down, switch email to SES by changing the provider mapping. No deployment needed.
3. **Expansion.** When Twicely adds a new shipping carrier (FedEx alongside Shippo), it's a new ProviderAdapter row + configuration, not a code change.
4. **AES-256-GCM encryption.** API keys stored encrypted at rest in the database. Displayed masked in the UI (last 4 chars only). Better security than plaintext `.env` files.

---

---

## 53. Seller Score Engine and Performance Rewards

**Date:** 2026-02-20
**Status:** LOCKED
**Builds in:** B5 (Seller Dashboard — score display), C1 (Ratings — score inputs), D4 (Analytics — progression visualization), E5 (Monitoring — daily recalc job)

### The Problem

V3's PerformanceBand system had the right concept but five structural flaws: discrete labels on what should be a continuous score, unexplained multiplier ranges, no category-aware thresholds, no trend/velocity component, and no volume weighting. Additionally, the rewards for high-performing sellers were limited to badges and search multipliers — no tangible incentives comparable to eBay's Top Rated program.

### How eBay Does It (And Why We Diverge)

eBay's Top Rated Plus program gates its best reward — 10% TF discount — behind a **policy concession**: sellers must offer same/1-day handling AND 30-day free returns. This forces sellers to absorb return shipping costs to access a fee discount they've earned through performance. Sellers widely resent this. The program conflates "being a good seller" with "offering free returns," which are separate concerns.

eBay also gives Top Rated Sellers $30/quarter in promoted listing credits, search ranking boosts, enhanced seller protection, and higher shipping label discounts. The volume-based Power Seller tiers (Bronze through Titanium) were quietly deprecated but the benefits persist informally.

### Why Twicely Does It Differently

**Principle: Performance rewards must never cannibalize the TF revenue axis, and must never require policy concessions.**

TF discounts are owned by Store subscriptions — that's a business decision the seller makes. Performance rewards operate on a separate axis: visibility, operational perks, and promotional credits. The two systems don't interact on pricing. A TOP_RATED seller with no Store subscription pays the same TF as a STANDARD seller with no Store subscription. They earn their rewards through visibility and trust, not fee reductions.

No policy concessions. Sellers don't have to offer free returns, free shipping, or same-day handling to be TOP_RATED. They just have to be good: ship on time, describe accurately, communicate well, keep defect rates low. This is the fundamental philosophical split from eBay.

### The Scoring Layer (Continuous)

Replace the discrete-only PerformanceBand with a continuous **Seller Score (0–1000)** computed from weighted, category-adjusted, Bayesian-smoothed inputs:

| Input Metric | Weight | Why This Weight |
|-------------|--------|----------------|
| On-Time Shipping Rate | 25% | Most controllable by seller, most impactful on buyer experience |
| INAD Claim Rate | 20% | Strongest quality signal — item didn't match description |
| Review Average (DSR) | 20% | Direct buyer satisfaction measurement |
| Response Time | 15% | Communication quality, affects buyer confidence |
| Return Rate (seller-fault only) | 10% | Quality signal, but must be category-adjusted |
| Cancellation Rate | 10% | Reliability signal — seller listed what they couldn't fulfill |

**Category adjustment:** Each metric's threshold is set per fee bucket via Platform Settings. Electronics has higher industry-normal return rates than apparel — an electronics seller with 4% returns is performing normally, while a clothing seller with 4% has a problem. Thresholds stored as: `performance.returnRate.warning.ELECTRONICS: 5%` vs `performance.returnRate.warning.APPAREL: 3%`.

**Trend modifier:** ±5% based on 30-day vs 90-day trajectory. A seller whose recent metrics are declining gets dampened before they cross a threshold. A seller who's improving gets a lift. Catches problems early and rewards effort.

**Bayesian smoothing (factor 30):** A seller with 2 orders (both perfect) doesn't get score 1000. Their score is pulled toward the platform mean. At 30+ orders, their actual performance dominates. At 500+ orders, smoothing is negligible. Formula: `adjustedScore = (sellerScore × orderCount + platformMean × smoothingFactor) / (orderCount + smoothingFactor)`.

**Recalculation:** Daily BullMQ cron job. Snapshot stored in `seller_performance_snapshots` for historical tracking and trend analysis.

### The Band Layer (Derived Labels)

Bands are labels derived from the continuous score. The search multiplier is a smooth function of the score, clamped within each band's range to prevent cliff effects at boundaries.

| Score Range | Band | Badge | Search Multiplier (score/800, global clamp 0.60–1.25) |
|-------------|------|-------|------------------|
| 900–1000 | POWER_SELLER | Purple | 1.125–1.25x |
| 750–899 | TOP_RATED | Gold | 0.9375–1.124x |
| 550–749 | ESTABLISHED | Green | 0.6875–0.936x |
| 0–549 | EMERGING | None | 0.60–0.686x |
| — | SUSPENDED | None | 0.00 (admin action, not score-derived) |

The search multiplier is a single global formula `clamp(score / 800, 0.60, 1.25)` — no band-specific floors or ceilings. Band labels are cosmetic (badges, rewards, helpdesk routing). Per-band clamps were removed because they reintroduced cliff effects at band boundaries, contradicting the continuous scoring design.

No cliff when crossing 899→900. The multiplier transitions smoothly because it's score-driven, not band-driven. The band is cosmetic — the score is mechanical.

### The Rewards Layer

**CFO-validated.** Every reward was stress-tested against revenue projections at 1K, 10K, and 100K seller scale.

| Reward | POWER_SELLER | TOP_RATED | ESTABLISHED | EMERGING |
|--------|-------------|-----------|-------------|----------|
| Badge on listings/storefront | Purple star | Gold star | Green check | None |
| Tag in search results | "Power Seller" | "Top Seller" | None | None |
| Search multiplier (score/800) | 1.125–1.25x | 0.9375–1.124x | 0.6875–0.936x | 0.60–0.686x |
| Monthly boost credit | **$15/mo** | **$10/mo** | $0 | $0 |
| Priority helpdesk queue | Yes | Yes | No | No |
| Benefit of doubt on claims | All claims manually reviewed | All claims manually reviewed | Standard flow | Standard flow |
| Early access to new features | Yes | No | No | No |
| Seller Protection Score boost | +15 points | +10 points | +5 points | 0 |
| Dedicated support channel | Yes (future) | No | No | No |

**What's explicitly NOT a reward:**
- ❌ TF discount (owned by Store tier axis — CFO rejected stacking at 7.6% revenue cost at scale)
- ❌ Boost credits for ESTABLISHED (35%+ of sellers is too broad — CFO rejected)
- ❌ Shipping rate discounts (deferred — depends on Shippo contract structure)
- ❌ Any reward gated behind policy concessions (no "offer free returns to earn X")

### CFO Stress Test Summary

| Reward | Cost at 1K sellers | Cost at 100K sellers | As % of related revenue | Verdict |
|--------|-------------------|---------------------|------------------------|---------|
| $15/mo boost credit (POWER_SELLER) | $750/mo | $75,000/mo | ~5% of boost revenue | **APPROVED** |
| $10/mo boost credit (TOP_RATED) | $1,000/mo | $100,000/mo | ~6.7% of boost revenue | **APPROVED** — drives adoption, converts to paid |
| Priority helpdesk routing | $0 | $0 | 0% | **APPROVED** — routing rule only |
| Early feature access | $0 | $0 | 0% | **APPROVED** — beta features, zero marginal cost |
| Tags in search | $0 | $0 | 0% | **APPROVED** — drives conversion, costs nothing |

Total annual cost at 100K sellers: ~$2.1M (boost credits only). Against projected $29.4M TF + $1.5M boost revenue = ~6.8% of total revenue. Acceptable — credits drive boost adoption.

### What Changes from Original Spec

| Original (User Model §4.4 + Feature Lock-in §44) | New | Why |
|--------------------------------------------------|-----|-----|
| 5 bands with fixed multiplier ranges | Continuous score (0-1000) with bands as derived labels | Eliminates cliff effects, enables smooth search ranking |
| Metrics defined but no formula | Weighted formula: 6 inputs, category-adjusted, Bayesian-smoothed | Deterministic, auditable, testable as a pure function |
| Same thresholds all categories | Per-fee-bucket thresholds via Platform Settings | Electronics sellers aren't penalized for industry-normal patterns |
| No trend component | 30-day vs 90-day trajectory modifier (±5%) | Early warning for declining sellers, faster reward for improving ones |
| No volume smoothing beyond 50-order cutoff | Bayesian smoothing (factor 30) continuously | No artificially perfect scores from low sample sizes |
| Rewards = badge + search multiplier only | + $15/$10 boost credits, priority support, early access, "Power Seller"/"Top Seller" tags, protection score boost | Tangible rewards that don't cannibalize TF |
| Recalc frequency unspecified | Daily BullMQ cron job | Defined and implementable |
| PerformanceBand enum: TOP_RATED, ABOVE_STANDARD, STANDARD, BELOW_STANDARD, SUSPENDED | **POWER_SELLER, TOP_RATED, ESTABLISHED, EMERGING, SUSPENDED** — aspirational naming, no negative buyer-facing labels | See Seller Score Canonical for full spec |

---

# SOCIAL, DISCOVERY & DEFERRED FEATURES

---

## 54. BEST_IN_WINDOW Deferred to Post-Launch

**Date:** 2026-02-21
**Status:** DEFERRED (post-launch, data-dependent)

### The Concept

Sealed-bid silent auction using existing offer infrastructure. Seller sets a deadline ("Offers close Friday 5PM"), multiple buyers submit offers with Stripe authorization holds, highest offer wins at deadline, lower holds release.

### Evolution During Analysis

**Original concern:** Buyer hostage problem — early buyers have money locked for days and might lose. Fixed by releasing lower holds immediately when a higher offer arrives.

**New concern:** Release-on-higher-offer creates a competitive rebidding loop. B1 offers $80, B2 offers $85 (B1's hold releases, B1 notified), B1 comes back at $90 (B2's hold releases), B2 comes back at $95... This is functionally an auction with a different name.

**Key insight:** Whether this matters depends on perspective. eBay auctions are toxic because of countdown timers, live bid history, and sniping UI. BEST_IN_WINDOW has none of that — quiet notification, think on your own time, no pressure. But the behavioral loop (outbid → resubmit → outbid → resubmit) is identical to auction dynamics.

### Why Deferred (Not Killed)

1. **No demand density yet.** BEST_IN_WINDOW requires multiple competing buyers per listing. At launch, Twicely won't have enough buyer traffic for most listings to receive 2+ simultaneous offers. Building the feature now means maintaining code that sits unused.

2. **Existing system is sufficient.** FIRST_ACCEPTABLE + MANUAL_REVIEW cover all launch offer scenarios. MANUAL_REVIEW already lets sellers collect offers and pick the best one — the only gap is automated deadline enforcement, which saves ~10 seconds of seller effort.

3. **Data trigger defined.** Revisit when multi-offer density shows 5%+ of active listings receiving 2+ offers within 72 hours. This metric will be tracked automatically from the offers table.

4. **Zero engineering cost.** No schema, no spec maintenance, no edge cases. When the data justifies it, the infrastructure (offers + Stripe holds + BullMQ) will already exist.

5. **Coming Soon placeholder.** The listing settings page shows "Live Offers — Coming Soon" greyed out with tooltip. Signals platform direction, creates seller anticipation, costs zero backend code.

### Timing Decision Still Open

Three options for window mechanics when/if it ships. Adrian has not yet picked:
- **Option A:** Fixed duration (24/48/72h), clock starts on first offer
- **Option B:** Seller sets specific end date/time — "Offers close Friday 5PM EST"
- **Option C:** Rolling window with hard cap (each offer extends by 12h, max 72h total)

Decision deferred to C2.1+ or whenever data trigger is met.

---

## 55. Social Philosophy: Discovery, Not Obligation

**Date:** 2026-02-21
**Status:** LOCKED
**Builds in:** Various phases (see §56 and Build Sequence Tracker)

### The Problem

eBay has zero social features and acquired Depop because it couldn't bolt social onto its DNA. Poshmark built its entire growth engine on social — sharing, parties, following — but made it a chore that sellers resent. Depop succeeded with social-first discovery without punishing non-participation. TikTok Shop exploded via creator affiliates. Where does Twicely land?

### Competitive Analysis

**Poshmark's failure:** The algorithm punishes sellers who don't share their closet 3x daily, share others' items, join parties, and follow back. "Social" became unpaid labor. Sellers spend hours sharing instead of sourcing and listing. The social is a tax on selling, not a benefit. This is what drove the locked decision "No Poshmark share-to-promote model."

**Depop's success:** Post, it shows up. Followers see your stuff. The algorithm doesn't punish non-participation. Visual-first profiles make stores feel like Instagram accounts. Social is discovery, not obligation.

**TikTok Shop's weapon:** Creator affiliate program. External content creators become the sales force — they post content with affiliate links, buyers click, platform gets the sale. Social happens OFF-platform, purchase happens ON-platform. Explosive growth without building internal social features.

**eBay's admission:** Buying Depop = admitting social can't be retrofitted. Two products, two user bases, two experiences running in parallel.

### The Decision: Option B — Light Social Layer

Social features enhance discovery but **never gate visibility**. Following a seller gives the BUYER a better feed. It never gives the SELLER better search ranking. Sharing a listing to Instagram drives external traffic. It never affects internal placement. Seller score and boosting handle visibility — social is a separate, optional layer.

### Core Principle

**"Social enhances discovery, never gates visibility. No Poshmark sharing tax."**

- Following = notification subscription to a seller's new inventory. Optional.
- Feed = personalized view of followed sellers' listings + algorithmic suggestions. Optional.
- Sharing = native OS share sheet with good Open Graph metadata. No internal algorithm impact.
- No parties, no sharing requirements, no closet sharing, no follow-back incentives.
- No social metric affects seller score, search multiplier, or listing visibility.
- No mandatory community participation.

### What's Explicitly Rejected (Permanently)

| Feature | Why Rejected |
|---------|-------------|
| Sharing requirements / closet sharing | Unpaid labor. Poshmark's biggest seller complaint. |
| Posh Parties / themed events | Artificial engagement that doesn't drive real sales |
| Social activity affecting search rank | Conflates engagement with quality. Seller score handles ranking. |
| Follow-back incentives | Fake social graph. If following isn't voluntary, the signal is worthless. |
| Mandatory community participation | Tax on sellers' time. Every hour sharing is an hour not sourcing. |
| Unstructured comment sections | Become spam, lowball offers, and drama. Q&A is structured alternative. |

---

## 56. Competitive Social Features — Build Commitments

**Date:** 2026-02-21
**Status:** LOCKED
**Reference:** Feature Lock-in §51 (Social & Discovery)

### What Each Platform Does Right (Stripped of Garbage)

**From Poshmark:**
- ✅ Bundle from seller's store — buyer picks items, private price negotiation thread. Higher AOV, deeper browsing.
- ✅ Offers to likers — already spec'd in Automation add-on.
- ❌ Closet sharing, parties, share-to-promote — rejected permanently.

**From Depop:**
- ✅ Visual-first seller profiles — store renders as photo grid by default. Brand-building.
- ✅ Explore/Discovery feed — algorithm-driven, not search-driven. Trending, staff picks, personalized.
- ❌ Nothing rejected — Depop's model is clean.

**From TikTok Shop:**
- ✅ Creator affiliate program — external creators drive traffic via affiliate links. Already partially spec'd in G1/G3 affiliate system, expanded to cover "link to any listing" model.
- ✅ Algorithm-driven discovery — personalization engine already has the data, needed the UI commitment.
- ⏸ Live selling — massive engagement, massive engineering. 6-12 months post-launch.

**From Amazon:**
- ✅ Structured Q&A on listings — buyer asks, seller answers, visible to all. Better than Poshmark's unstructured comments.

### Seven Features Committed

| # | Feature | Source | V3 Phase | Post-Launch |
|---|---------|--------|----------|-------------|
| 1 | Video on listings (1 per listing, 15-60s, R2 storage) | Depop/Posh/eBay | Schema: next addendum. Upload: B2 update. Mobile UX: G1. | |
| 2 | Bundle negotiation from seller store | Poshmark | C2 (with offers) | |
| 3 | Public Q&A on listings (structured, not comments) | Amazon | Schema: next addendum. UI: E1. | |
| 4 | Explore/Discovery feed (`/explore`) | Depop/TikTok | G3 | |
| 5 | Visual grid default store view | Depop | D1 (storefront) | |
| 6 | Creator affiliate program (link to any listing) | TikTok Shop | G1/G3 (extends existing affiliate spec) | |
| 7 | Live selling (video stream + real-time purchase) | TikTok Shop/Whatnot | | ✅ 6-12 months |

### Video on Listings — Why Table Stakes

Depop has it. Poshmark added it. eBay is rolling it out. Buyers increasingly expect to see items in motion — try-on videos, condition walkthroughs, detail shots that photos can't capture. A marketplace launching in 2026 without video support feels dated. One video per listing, 15-60 seconds, stored in R2, displayed above the photo gallery. Not TikTok-style infinite scroll — just "here's the item moving."

### Bundle Negotiation — Why It Drives Revenue

Poshmark's bundle feature drives 20%+ of their GMV. Buyer browses a seller's store, selects 3 items ($40 + $50 + $60 = $150), taps "Request Bundle Price." Seller offers $120. Buyer accepts. One transaction, one shipment, higher AOV. The seller saves on shipping, the buyer gets a discount, Twicely earns TF on $120 instead of potentially losing 2 of 3 individual sales. This is a private offer thread tied to a bundle — uses existing offer infrastructure.

### Creator Affiliate — Why It's a Growth Engine

The existing affiliate spec (G1.2-G3.5) covers community affiliates and influencer applications. The "creator affiliate" extension means: any approved affiliate can generate a link to ANY listing on Twicely (not just referral codes for signup). A fashion TikToker posts "look at this vintage Chanel I found on Twicely" with an affiliate link → viewer clicks → buys → creator earns commission. This doesn't require user density to work — one creator with 200K followers can drive traffic day one.

### Live Selling — Why Post-Launch

Requires: video streaming infrastructure (WebRTC or HLS), real-time purchasing during stream, chat moderation, product queue management, stream recording/replay. Whatnot raised $280M building this for collectibles. It's not a feature — it's a product. Twicely needs marketplace maturity and seller density first. Committed to 6-12 months post-launch. Designed during Phase G (data model for live sessions, product queue schema) but not built.
---

## Imported and Renumbered Sections from `TWICELY_V3_DECISION_RATIONALE_ADDITIONS.md`

## 57. Three-Tier Offer Spam Prevention

**Problem:** How many concurrent offers should a buyer be allowed? One limit isn't enough — different abuse patterns require different limits.

**Three limits, three abuse patterns:**

| Limit | Value | What it prevents |
|-------|-------|-----------------|
| Per buyer per listing | 3 | Buyer hedging with multiple amounts on one item ($50, $55, $60 all PENDING). Creates 3 Stripe holds on same item, clutters seller inbox, lets buyer avoid committing to a price. |
| Per buyer per seller | 3 | Buyer flooding one seller across their entire catalog. 30 offers on 30 listings = inbox spam + hold pressure. |
| Per buyer global | 10 | Platform-wide spray-and-pray. Buyer submitting 50 offers hoping 1 sticks. Ties up Stripe authorization capacity. |

**Why all three are needed:** The per-seller limit (3) doesn't catch 3 offers on 1 listing — that's ≤ 3 per seller, passes. The global limit (10) doesn't catch it either — 3 ≤ 10, passes. Only the per-listing limit blocks the hedging pattern. Each limit has a distinct enforcement gap that the others don't cover.

**Platform Settings keys:**
- `commerce.offer.maxPerBuyerPerListing`: 3
- `commerce.offer.maxPerBuyerPerSeller`: 3
- `commerce.offer.maxPerBuyerGlobal`: 10

All admin-configurable. Enforcement in business logic, not database constraints (allows flexibility without migrations).

---

## 58. Offer Counter Chain Model (Parent-Child, Not Flat)

**Problem:** V1 schema stored counter-offers as fields on the original offer row (`counterOfferCents`, `counterMessage`). This breaks at 3 rounds of negotiation.

**Why flat fails:**
```
Round 1: Buyer offers $50        → row 1, status=PENDING
Round 2: Seller counters $65     → row 1, status=COUNTERED, counterOfferCents=6500
Round 3: Buyer counters $60      → ??? No place to store this. Can't overwrite counterOfferCents.
```

**Chain model:** Each counter is a new row with `parentOfferId` pointing to the previous offer. The original offer's `type` stays BEST_OFFER; counters are identified by `parentOfferId IS NOT NULL`, not by a separate type enum value.

**Why this is better:**
1. Each counter gets its own Stripe authorization hold (different amounts need different holds)
2. Each counter gets its own expiry window (48h from when it was created)
3. Each row has a clean single status — no ambiguity about "is the counterOfferCents field the active price?"
4. Full audit trail is automatic — every price in the negotiation is a permanent row
5. Max depth enforcement is trivial: `counterCount >= 5` on the latest offer = reject

**`counterCount` kept as denormalized integer** on each row for fast depth checks without walking the chain. Incremented on each new child. Value 0 = original offer, 1 = first counter, etc.

**`COUNTER` removed from `offerTypeEnum`:** Counter is a relationship (has parent), not a type. The enum has 3 values: `BEST_OFFER`, `WATCHER_OFFER`, `BUNDLE`. A counter on a best offer is still type `BEST_OFFER` with `parentOfferId` set. This avoids "is it a type or a status?" confusion.

---

## 59. Stripe Hold Logic on Counter-Offers

**Problem:** When a seller counters at a higher price, who holds funds and when?

**Options considered:**
1. Hold at every counter amount (both parties) — complex, ties up buyer funds on prices they haven't agreed to
2. No holds until acceptance — risk of buyer not having funds when they accept
3. **Holds only when buyer sets the price** — clean, minimal hold management

**Decision:** Option 3. The rule is: **Stripe authorization holds exist only when the buyer proposed the current price.**

| Action | Hold behavior |
|--------|--------------|
| Buyer submits offer at $50 | Create hold at $50 |
| Seller accepts $50 | Capture $50 hold |
| Seller counters at $65 | Release $50 hold. No new hold — buyer hasn't agreed to $65 |
| Buyer accepts $65 counter | Create hold + capture at $65 in one step |
| Buyer counter-offers $60 | Create new hold at $60 |
| Seller accepts $60 | Capture $60 hold |

**Why no hold on seller counters:** The seller is proposing a price the buyer hasn't consented to. Holding $65 on a buyer's card when they only offered $50 would be unauthorized. The buyer might decline, might counter back, might walk away. Creating a hold without buyer action is both a bad UX and potentially a Stripe policy violation.

**Why capture-on-accept for seller counters:** When the buyer clicks "Accept $65", we create a PaymentIntent at $65 and immediately capture. This is a single Stripe API call (not auth-then-capture), which is simpler and avoids the 7-day hold expiry window. The buyer explicitly clicked accept — consent is clear.

**Edge case:** Buyer accepts seller counter but card declines → offer stays PENDING, buyer notified "Payment failed — update your payment method and try again." Offer doesn't auto-expire from this; the regular 48h expiry still applies.

---

## 60. Offer Chain Query Optimization (Deferred)

**Problem:** `getOfferChain()` walks the parent chain with N+1 individual SELECT queries. A 3-round counter chain (6 offers) = 12 database round trips.

**Why deferred to Phase E:** Max chain depth is 6 rows (3 rounds of countering). 12 primary-key lookups complete in <10ms total on a local database. The function is called on individual offer detail views, not in list views. At this scale, optimization is premature.

**Phase E optimization:** Replace with a single recursive CTE:
```sql
WITH RECURSIVE chain AS (
  SELECT * FROM listing_offer WHERE id = ?
  UNION ALL
  SELECT lo.* FROM listing_offer lo JOIN chain c ON lo.id = c.parent_offer_id
)
SELECT * FROM chain ORDER BY counter_count ASC
```

This becomes necessary when the seller offers page shows chains for 20+ offers simultaneously (20 × 12 = 240 queries → 20 recursive CTEs = 20 queries).

---

## 61. Checkout Hotfix Before Offers (Dependency Ordering)

**Problem:** Bugs #39 (oversell) and #44-45 (cart converted before payment) existed in checkout.ts. The offer system creates orders from accepted offers using the same order creation pipeline. Building offers on top of broken checkout would inherit both bugs.

**Decision:** Hotfix checkout in a separate commit BEFORE starting offer work. Not bundled into the offer PR.

**Why separate:** If offers introduce a regression, git bisect points to the offer commit. If the checkout fix is bundled in, you can't tell whether the regression is from the fix or from offers. Separate commits = clean blame history.

**Fixes applied (commit 5073066):**
- `SELECT ... FOR UPDATE` on listing rows inside a Drizzle transaction before creating PaymentIntent
- Cart stays `ACTIVE` until `finalizeOrder` confirms Stripe payment succeeded, then converts to `CONVERTED`
- If listing is no longer ACTIVE inside the locked transaction, throws error and rolls back
- All quantity/status checks happen under the row lock — no race condition window
---

## Imported and Renumbered Sections from `TWICELY_V3_DECISION_RATIONALE_ADDENDUM.md`

## 62. Railway over Coolify + Hetzner

**Date:** 2026-02-21
**Status:** LOCKED
**Builds in:** All phases (deployment)

### The Problem

The original deployment plan specified Coolify (self-hosted PaaS) on Hetzner bare metal servers. This optimizes for cost at scale (~$400-500/mo for 1K active sellers) but requires DevOps expertise for server management, SSL, networking, process supervision, and disaster recovery. At pre-launch with zero sellers and zero revenue, the DevOps time cost exceeds the dollar cost savings.

### Options Considered

| Platform | Monthly Cost (Launch) | Monthly Cost (1K Sellers) | DevOps Burden | Persistent Workers |
|----------|----------------------|--------------------------|---------------|-------------------|
| Coolify + Hetzner | ~$50-80 | ~$400-500 | High | ✅ |
| Vercel | ~$150 | ~$2-3K | None | ❌ (no BullMQ) |
| Railway | ~$100-200 | ~$400-800 | Low | ✅ |
| Render | ~$100-200 | ~$400-800 | Low | ✅ |
| Fly.io | ~$30-60 | ~$100-250 | Medium | ✅ |

### Why Not Vercel

Vercel is serverless. Twicely runs 5+ persistent services: Next.js app, BullMQ worker (offer expiry, score recalc, notification dispatch), Valkey (cache + queue backend), Centrifugo (WebSockets), Typesense (search). BullMQ requires a long-running process — Vercel can't host it. You'd need Vercel for the app plus a separate VPS for workers, splitting infrastructure management across two platforms.

### Why Railway over Fly.io

Both handle the full stack. Railway wins on DX: visual project dashboard showing all 5 services connected, one-click Docker image deploys, better logs UI. Fly.io is cheaper ($30-60 vs $100-200 at launch) but requires CLI-driven management and individual `fly.toml` configs per service. For a solo founder, the visual clarity of Railway's project graph is worth the premium. If the bill becomes painful, migrating to Fly.io is a day's work — no application code changes.

### The Decision

Railway for deployment. Zero application code changes from the original Coolify plan — Next.js, Drizzle, BullMQ, Valkey, Centrifugo, Typesense all deploy as Docker containers regardless of host. Migrate to self-hosted (Hetzner + Dokku or Coolify) when monthly costs justify the DevOps investment.

### Tech Stack Update

| Layer | Old | New |
|-------|-----|-----|
| Deployment | Coolify (self-hosted on Hetzner) | **Railway** |

Everything else unchanged.

---

## 63. Social & Discovery Step Numbering Resolution

**Date:** 2026-02-21
**Status:** LOCKED
**Reference:** Feature Lock-in §51, Build Sequence Tracker v1.2

### The Problem

The Social & Discovery additions document (2026-02-21) introduced 13 new build steps that collided with existing step IDs in the Build Sequence Tracker v1.1:

| Step ID | Existing (v1.1) | New Addition | Conflict Type |
|---------|-----------------|-------------|---------------|
| B1.4 | Recently viewed carousel | OG meta tags | ID collision |
| C2.2 | Offer to Watchers | Bundle negotiation | ID collision |
| E1.1 | Notification preferences | Q&A notifications | ID collision |

### Resolution

| Existing Step | Keeps ID | New Addition | Gets ID | Rationale |
|---------------|----------|-------------|---------|-----------|
| B1.4 Recently viewed carousel | **B1.4** | OG meta tags | **B1.6** | OG tags are trivial, shouldn't displace existing numbering |
| C2.2 Offer to Watchers | **C2.2** | Bundle negotiation | **C2.3** | C2.3 was the old "Bundle Offers" slot anyway — natural fit |
| E1.1 Notification preferences | **E1.1** | Q&A notifications | **E1.3** | Preferences is simpler and ships first; Q&A depends on schema v1.5 |

### Additional Renumbering

| Old ID | New ID | Feature | Reason |
|--------|--------|---------|--------|
| D1.2 (Puck page builder) | **D1.3** | Puck page builder (Elite+) | D1.2 now occupied by Visual Grid Default Store View |
| E1.3 (Similar items) | **E1.5** | Similar items recommendations | E1.3-E1.4 now occupied by Q&A |

### Offer to Watchers vs Offer-to-Likers Clarification

- **C2.2 Offer to Watchers:** Seller broadcasts a discounted price to all users watching a specific listing via the `watcherOffer` table. This is a manual seller action on a per-listing basis.
- **F6.1 Offer-to-Likers (Automation Add-On):** Automated system sends offers to users who liked/watched items after configurable delay. Part of the $9.99/mo Automation add-on. Different feature, different infrastructure, different phase.

Both exist. Neither replaces the other.

---

## 64. Store Premium Tier ($99.99/mo) as Feature Ceiling

**Date:** 2026-02-21
**Status:** LOCKED
**Builds in:** D3 (Store Subscriptions), all feature-gated phases
**Rationale Entry:** 64

### The Problem

Store Pro ($49.99) → Elite ($199.99) is a 4x price jump with no landing spot in between. Sellers doing $8K-$15K/mo GMV who outgrow Pro's toolset face a painful decision: stay on Pro and miss features, or quadruple their subscription cost. This gap pushes exactly the sellers most likely to churn toward the exit.

### Options Considered

| Option | Price | Risk |
|--------|-------|------|
| Do nothing (Pro → Elite) | $50 → $200 (4x) | Seller churn at the Pro ceiling |
| Add "Pro Plus" with incremental features | $79.99 | Creates a "slightly better Pro" that nobody cares about |
| **Add Premium as feature ceiling** | **$99.99** | **Clean 2x step, all features unlock** |
| Drop Elite pricing to $149.99 | $149.99 | Devalues dedicated rep, compresses Enterprise |

### The Decision

**Store Premium at $99.99/mo (annual) / $119.99/mo (monthly).** Premium is the **feature ceiling** — every marketplace feature, intelligence tool, automation, integration, and export unlocks at Premium. Elite and Enterprise exist for **volume** (more listings, more staff) and **white-glove service** (dedicated rep, API access, on-demand payouts).

### Updated Store Tier Ladder

| Tier | Annual/mo | Monthly | Free Listings | Insertion | TF Discount | Staff | Finance |
|---|---|---|---|---|---|---|---|
| No Store | $0 | $0 | 250 | $0.25 | 0% | 0 | FREE |
| Starter | $4.99 | $6.99 | 500 | $0.20 | 0% | 1 | Lite |
| Basic | $19.99 | $24.99 | 2,000 | $0.15 | -0.25% | 3 | Lite |
| Pro | $49.99 | $59.99 | 10,000 | $0.10 | -0.50% | 10 | Plus |
| **Premium** | **$99.99** | **$119.99** | **15,000** | **$0.08** | **-0.75%** | **15** | **Pro** |
| Elite | $199.99 | $239.99 | 25,000 | $0.05 | -1.0% | 25 | Pro |
| Enterprise | $999+ | Negotiated | 100,000+ | Custom | -1.5% | 100+ | Enterprise |

Price jumps: $0 → $5 → $20 → $50 → $100 (2x) → $200 (2x) → $999+. Each step roughly 2x, never a jarring 4x.

### Premium Unlocks (Everything That Was Elite-Only)

- Auto-reprice rules (market intelligence-driven, Twicely listings only)
- Custom market alerts ("notify when vintage Nike sell-through drops below 30%")
- Auto-counter rules for offers
- QuickBooks/Xero sync (Finance Pro included in tier)
- Puck custom page builder for storefronts
- Data export (CSV)
- 12-month historical trends
- Full inventory health dashboard with batch actions

### Elite Exclusives (Volume + White Glove Only)

- Dedicated account rep (real human cost — this is why Elite is 2x Premium)
- API access (programmatic integrations)
- On-demand payouts ($0.25/hit Stripe cost justifies gating)
- 5x API rate multiplier
- 10,000 more free listings than Premium (worth $800/mo in insertion fees at Premium rate)
- Extra -0.25% TF over Premium (saves $25/mo per $10K GMV)

### Why This Is Correct

Elite math only works for power sellers doing $25K+/mo GMV where TF savings alone justify the jump. Below that, Premium has everything. The feature ceiling at $99.99 means no seller ever thinks "I'm missing out on tools" — they're only missing volume capacity and white-glove service that requires human cost to deliver.

### Enum Update

`StoreTier` enum values (v3.2): `NONE | STARTER | PRO | POWER | ENTERPRISE`

SUPERSEDED by v3.2: StoreTier simplified to NONE|STARTER|PRO|POWER|ENTERPRISE.

---

## 65. Market Intelligence Architecture

**Date:** 2026-02-21
**Status:** LOCKED
**Builds in:** F1 (eBay Import — sales history pull), D4 (Seller Analytics — UI), B2 (Listing Creation — price suggestion hooks)
**Rationale Entry:** 65

### The Problem

Sellers on eBay pay $29-$99/mo for ZIK Analytics to answer basic questions: "What should I price this at? Is this category hot? Should I list on Poshmark or eBay?" Twicely wants to provide this intelligence natively, but eBay locked down their sold listings data (Finding API's findCompletedItems decommissioned Feb 2025, Marketplace Insights API requires partner approval that gets denied).

### Data Acquisition Strategy

**The crosslister backdoor:** When sellers connect eBay accounts for crosslisting (Phase F), Twicely gets OAuth access to eBay Sell APIs. This includes complete sales history via Fulfillment API (90 days) and Finances API (longer). This is consented, first-party data — no partner approval needed, no scraping.

**The flywheel:**
1. Seller connects eBay for crosslisting
2. Import pulls active listings + 90-day sales history
3. Anonymize and aggregate across all connected sellers
4. Every Twicely seller benefits from collective intelligence
5. More sellers connect → better data → more value → more sellers connect

At 1,000 connected accounts: meaningful category pricing data. At 10,000: rivals Terapeak.

**Supplementary sources:**
- eBay Browse API (public, no auth): Active listing prices for supply-side intelligence
- Twicely native transactions: First-party marketplace data, grows over time
- Poshmark/Mercari when connectors ship

### Schema Tables

```
market_price_point          — Individual sold data points (anonymized, no seller attribution)
market_category_summary     — Daily/weekly rollup per category+condition+brand
market_listing_intelligence — Per-listing computed signals (cached, rebuilt nightly)
market_offer_intelligence   — Offer acceptance patterns (anonymized aggregate)
```

### Build Integration Points

- **Phase B2 (Listing Creation):** Hook for `getPriceSuggestion()` — returns null until data exists. Zero-cost to wire now.
- **Phase C2 (Offers):** Hook for `getOfferGuidance()` — returns null until data exists.
- **Phase D4 (Seller Analytics):** Market Insights UI reading from aggregated tables.
- **Phase F1 (eBay Import):** Sales history pull alongside listing import (~20 lines extra code on the import job).
- **Phase F1+ (Background):** BullMQ cron job hitting eBay Browse API daily for top 500 categories.

### Minimum Sample Size Rule

No intelligence displayed if sample < 20 data points for category + condition + brand combination. Shows "Not enough data yet" instead of bad numbers. This prevents misleading guidance from thin data.

### Buyer-Facing Intelligence — Ungated

All buyers see: offer guidance ("offers between $34-$38 have highest acceptance rate"), deal badges ("Great Price", "Price Drop", "Fast Seller", "Last One"), and sold comps. This improves marketplace health for everyone and costs nothing to gate.

---

## 66. Market Intelligence Tier Gating

**Date:** 2026-02-21
**Status:** LOCKED
**Builds in:** D4 (Seller Analytics), F1+ (data pipeline), all tier-gated phases
**Rationale Entry:** 66

### The Problem

Market intelligence features must be gated to drive subscription upgrades, but gating too aggressively hurts marketplace health. Need a matrix across three subscription axes (Store, Lister, Finance) that maximizes upsell pressure while keeping basic intelligence freely available.

### Gating Philosophy

**Show the pain, gate the solution.** Free sellers see directional intelligence ("this category is trending down") but not actionable specifics ("relist on Poshmark where sell-through is 22% higher"). Platform names visible to free users (creates FOMO). Numbers gated behind subscription (makes it actionable).

### Seller-Side by Store Tier (Key Features)

| Feature | No Store | Starter | Basic | Pro | Premium | Elite |
|---|---|---|---|---|---|---|
| Price guidance | Range only | + Median | + Time-to-sell | + Price curve | + 12-mo trend | Same |
| Listing health | 4 states text | + Nudge | + Specific $ | + Batch view | + Auto-reprice | + Auto-delist |
| Sell-through data | ❌ | Your vs avg | + By category | + By brand | + Custom segments | + Export |
| Offer analytics | ❌ | ❌ | Accept % | + Counter suggest | + Auto-counter | Same |
| Data export | ❌ | ❌ | ❌ | ❌ | CSV ✅ | CSV + API |

### Crosslister-Side by Lister Tier (Key Features)

| Feature | No Lister | Free | Lite | Plus | Power | Max |
|---|---|---|---|---|---|---|
| Cross-platform price | ❌ | ❌ | Teaser only | + Numbers | Full breakdown | + Historical |
| Best platform rec | ❌ | ❌ | Teaser only | Platform + reason | + Ranked list | + Auto-route |
| Stale listing nudge | Generic | Same | "Upgrade →" | "22% faster on Posh →" | + One-click | + Auto-crosslist |

### Key Design Rules

- **Auto-reprice** (Store Premium+) vs **Auto price drops** (Automation add-on, $9.99): Different triggers. Auto-reprice is market intelligence-driven ("stay within 5% of category median"). Automation price drops are time-based ("drop 10% after 14 days"). No overlap.
- Performance bands (TOP_RATED, POWER_SELLER) do NOT gate intelligence. Intelligence gated by subscription only. Maintains three-axis independence.
- Minimum sample size (20) enforced at every display point. No bad data.

---

## 67. Revised Bundle Ladder with Seller Scale

**Date:** 2026-02-21
**Status:** ~~LOCKED~~ → SUPERSEDED by Decision #98 (2026-03-01)
**Superseded by:** Pricing Canonical v3.2 §9 — 3 bundles (Starter/Pro/Power), not 5. Growth/Scale/Elite removed. Store Premium tier doesn't exist post-Decision #76.
**Builds in:** D3 (Store Subscriptions), platform settings
**Rationale Entry:** 67

### The Problem

Original bundles (v2.1 addendum) had 4 bundles (Starter, Growth, Power, Elite). Adding Premium tier requires a corresponding bundle. The old Power bundle at $94.99 had a 27% discount — too generous relative to the ladder. Need to restructure.

### The New Bundle Ladder

| Bundle | Components | Separate | Bundle | Savings |
|---|---|---|---|---|
| **Seller Starter** | Store Starter + Lister Lite + Finance Pro | $19.97 | **$16.99** | 15% |
| **Seller Growth** | Store Starter + Lister Lite + Finance Pro | $54.97 | **$44.99** | 18% |
| **Seller Power** | Store Pro + Lister Pro + Finance Pro + Automation | $129.96 | **$99.99** | 23% |
| **Seller Scale** | Store Premium + Lister Pro + Finance Pro + Automation | $199.97 | **$159.99** | 20% |
| **Seller Elite** | Store Power + Lister Pro + Finance Pro + Automation | $319.96 | **$249.99** | 22% |

Ladder: $17 → $45 → **$100** → $160 → $250 → custom. No jarring jumps. Clear "I have everything" ceiling at $160.

### Competitive Position at $159.99 (Seller Scale)

| Platform | Monthly Cost | What You Get |
|---|---|---|
| **Twicely full stack** | **$160** | Marketplace + crosslister + finance + automation + market intelligence |
| eBay Anchor Store | $300 | Just eBay. No crosslisting, finance, or intelligence |
| eBay Premium + Vendoo | $85 | eBay + basic crosslister (no intelligence, no finance) |
| eBay Premium + List Perfectly | $109 | Same — no intelligence, no finance |

Full-time seller doing $8K/mo GMV pays 2% of revenue for the complete Twicely toolset.

### Stripe Product IDs

```
twicely_bundle_starter  | Subscription | $16.99/mo annual
twicely_bundle_growth   | Subscription | $44.99/mo annual
twicely_bundle_power    | Subscription | $99.99/mo annual  (includes Automation)
twicely_bundle_scale    | Subscription | $159.99/mo annual (includes Automation)
twicely_bundle_elite    | Subscription | $249.99/mo annual (includes Automation)
```

---

## 68. Seller Power Bundle Price Lock ($99.99)

**Date:** 2026-02-21
**Status:** ~~LOCKED~~ → SUPERSEDED by Pricing Canonical v3.2 §9 (2026-02-23)
**Superseded by:** Seller Power bundle is $89.99/mo annual, $109.99/mo monthly per Pricing Canonical v3.2 §9. The $99.99 price was from the 5-bundle ladder (Decision #67) which no longer applies.
**Builds in:** D3 (Store Subscriptions)
**Rationale Entry:** 68

### The Problem

Original Seller Power bundle was $94.99 (27% discount off $129.96 à la carte). 27% is the highest discount in the entire bundle ladder, breaking the expected pattern where higher spend = higher reward.

### Options Considered

| Price | Discount | Ladder Pattern | Notes |
|---|---|---|---|
| $94.99 | 27% | Broken (highest in ladder) | Original proposal |
| **$99.99** | **23%** | Slightly hot (highest by 1-3pp) | Sub-$100 psychology |
| $104.99 | 19% | Clean ascending (15→18→19→20→22) | Ugly number |

### Why $99.99

$99.99 is a **psychological price barrier** — it's the last number before triple digits. "Everything for under $100/mo" is a materially stronger conversion message than $104.99. The 23% discount is 3-5pp above the adjacent bundles (18% Growth, 20% Scale), but Power is the **inflection bundle** — the point where sellers have Store Pro + Lister Pro + Finance Pro + Automation. That's full lock-in across all four product axes. Making Power the most attractive bundle by discount percentage is strategically correct: it's where you want the bulk of serious sellers to land.

### eBay Distribution Context

eBay doesn't publish tier distribution data, but industry analysis of their 18M sellers suggests ~370K+ are on Basic ($22-$28/mo) and ~140K on Premium ($60-$75/mo). These are sellers doing $5K-$15K/mo — exactly the Twicely crosslister audience. Seller Power at $99.99 packages Store Pro + crosslister + finance + automation (equivalent to eBay Premium $60 + Vendoo $25-$40 + accounting $15-$30 = $100-$130 separately) into a clean sub-$100 number.

The ~160-170K sellers at eBay Premium+ represent the addressable market for Twicely's mid-tier bundles.


---

## 69. Buyer Acquisition: Five Organic Channels Over Paid

**Date:** 2026-02-21
**Status:** LOCKED
**Source:** `TWICELY_V3_BUYER_ACQUISITION_ADDENDUM.md`

### The Problem

The crosslister solves supply (seller acquisition). Nothing in the existing specs solved demand (buyer acquisition). Every marketplace that solved supply but not demand failed — sellers see zero views, check twice, leave. Flywheel never spins.

### Channels Considered

| # | Channel | Selected | Why |
|---|---------|----------|-----|
| 1 | Google Shopping free listings | ✅ | Zero cost, compounds with inventory growth, highest leverage |
| 2 | Miami-first local marketing | ❌ | Twicely.Local is nationwide — no need for geo-targeted spend |
| 3 | Resale creator affiliates | ✅ | Creators are both sellers AND buyer magnets. Depop's entire growth model. |
| 4 | SEO long-tail product pages | ✅ | Every listing is an indexable page. 500K imports = 500K pages. |
| 5 | Google Ads (PLAs) | ❌ | Linear spend, no compounding. Add as accelerant post-launch if needed. |
| 6 | "Sold For" price reference pages | ✅ | Competes with eBay completed listings for price research queries. |
| 7 | Buyer referral ($5 off $50+) | ✅ | Multiplier on organic traffic. Breakeven on first order. |

### Why These Five

All five are compounding channels — each unit of activity makes the next more effective. Google Shopping feeds SEO feeds "Sold For" pages feeds more Google Shopping impressions. Creators drive buyers who generate transactions that generate "Sold For" data that gives creators better content. Buyer referral multiplies everything.

Channels 2 and 5 have linear returns proportional to spend. They're accelerants, not foundations.

---

## 70. Google Shopping Feed: Phase B2, Not Phase G

**Date:** 2026-02-21
**Status:** LOCKED

### The Problem

Google Merchant Center integration was not in any phase. It's the single highest-leverage buyer acquisition tool — every active listing gets free Google visibility.

### Decision

Add Google Shopping feed generator to Phase B2 (listing creation). Three additions:
- B2.2: Google Merchant Center feed generator (full + incremental, ~3 days)
- B2.3: Enhanced Product JSON-LD with shipping + return policy structured data (~1 day)
- B2.4: SOLD listing indexing + page behavior (~2 days)

New table: `google_category_mapping` (Schema Addendum v1.6).

### Why B2 Not Later

Every day the marketplace exists without Google Shopping is a day every listing is invisible to Google's hundreds of millions of shopping searches. The crosslister imports go ACTIVE immediately — they should be in Google Shopping the same day. The feed generator is ~3 days of work with massive ongoing ROI.

---

## 71. SOLD Listings: Index for 90 Days (Page Registry Override)

**Date:** 2026-02-21
**Status:** LOCKED
**Overrides:** Page Registry §11.2 (previously: SOLD → noindex)

### The Problem

Page Registry §11.2 marks SOLD listings as `noindex`. This prevents Channel 6 ("Sold For" pages) from working. SOLD listings with prices are valuable SEO assets — people constantly search "how much is [item] worth" and eBay's completed listings currently own those queries.

### Decision

| Status | Old Rule | New Rule |
|--------|----------|----------|
| SOLD (≤90 days) | ❌ noindex | ✅ index |
| SOLD (>90 days) | ❌ noindex | ❌ noindex (unchanged) |
| ENDED (unsold) | ❌ noindex | ❌ noindex (unchanged) |

90-day window prevents stale out-of-stock pages from accumulating (Google penalizes this). After 90 days, SOLD listings flip to noindex via daily cron but remain accessible via direct URL.

New sitemap file: `sitemap-sold.xml` (SOLD listings from last 90 days, paginated at 50K).

SOLD page title pattern: `{Item Title} — Sold for ${soldPrice} | Twicely`

SOLD page behavior: sold price prominently displayed, original photos/description visible, "See similar items for sale" section with active listings in same category + condition + brand. No cart/offer buttons.

### Schema Impact

Two fields added to `listing`: `soldAt` (timestamp) and `soldPriceCents` (integer). Set when order transitions to PAID. `soldPriceCents` captures actual transaction price (may differ from list price if offer accepted).

---

## 72. Buyer Referral: $5 Credit at $50 Minimum, True Breakeven

**Date:** 2026-02-21
**Status:** LOCKED

### The Problem

Need a buyer referral multiplier on organic traffic. Must be financially sustainable — can't subsidize below cost.

### The Math

$50 order × 10% TF = $5.00 to Twicely. Stripe fees are the seller's cost (deducted from seller payout), not Twicely's. Twicely collects $5 clean, spends $5 on referral credit. **True breakeven, no loss.** Second purchase from referred buyer is pure TF revenue.

Below $50 it's underwater: $30 × 10% = $3 TF vs $5 credit = -$2 loss per referral.

### Rules Locked

- $5 to both referrer and referred buyer
- $50 minimum order (pre-shipping)
- 30-day expiry (forces action, prevents credit hoarding)
- Credit usable on any purchase (buyer or seller side)
- Cannot stack with affiliate or platform promo codes
- One referral per new account
- No referrer cap
- Anti-fraud: same payment method / IP / device → rejected

### Schema

New table: `buyer_referral` (Schema Addendum v1.6). New field: `user.creditBalanceCents`. New ledger types: `BUYER_REFERRAL_CREDIT_ISSUED`, `BUYER_REFERRAL_CREDIT_REDEEMED`.

---

## 73. Twicely.Local Is Nationwide, Not a Geo-Targeted Launch Strategy

**Date:** 2026-02-21
**Status:** LOCKED

### The Context

Initial buyer acquisition analysis included "Miami first — local marketplace play" as a channel. Adrian correctly identified this was unnecessary.

### The Decision

Twicely.Local with QR code escrow and 5% local fee is already spec'd as a nationwide product feature (Local Canonical). It's not a city-by-city rollout — it's a feature that works everywhere from day one. Any buyer in any city sees local inventory near them automatically via Mapbox geocoding.

When a seller in Austin imports 200 listings, buyers in Austin see local pickup options immediately. No marketing spend, no local partnerships, no geo-targeted campaigns needed. The crosslister import IS the local supply strategy.

Miami-specific marketing is deferred indefinitely. Can be reconsidered as a paid accelerant post-launch if the organic channels underperform.

---

## 74. Creator Market Intelligence as Content Angle

**Date:** 2026-02-21
**Status:** LOCKED (strategy, not code)

### The Insight

No other resale platform gives sellers market intelligence they can flex in content. Twicely's market intelligence (spec'd in Market Intelligence Canonical) gives creators unique content angles:

- "Twicely told me this sells for $55 on Poshmark but $68 on eBay"
- "My sell-through on Women's Tops is 68% — here's how"
- "Twicely says this is a Great Price — bottom 20% for the category"

ZIK Analytics charges $30-99/mo for this data. Twicely embeds it in the workflow. This makes Twicely content-creator-friendly in a way competitors can't match without rebuilding their entire intelligence layer.

### Activation

Pre-launch: identify 20 mid-tier resale creators (10K-100K followers). Offer Influencer affiliate tier + free Seller Power bundle ($99.99 value) for 6 months. Build relationships before affiliate tracking ships in G1.

Cost: ~$2K/month in comped subscriptions. No code changes required.

---

---

## 75. Progressive TF Brackets Replace Category TF

**Date:** 2026-02-23
**Status:** LOCKED
**Supersedes:** Decision #29 (Category-Based TF over Flat-Rate)

### The Problem

Category-based TF (9-11.5% varying by category) required a category-to-rate mapping table, created seller confusion ("why is electronics different from clothing?"), and made the fee story harder to market. Sellers couldn't predict their fees without knowing the category rate table.

### The Decision

8-bracket progressive Transaction Fee (TF) model. Marginal rates like income tax — each dollar taxed at its bracket rate:

| Bracket | Monthly Twicely GMV | Marginal TF Rate |
|---------|-------------------|-----------------|
| 1 | $0 – $499 | 10.0% (welcome) |
| 2 | $500 – $1,999 | 11.0% (ceiling) |
| 3 | $2,000 – $4,999 | 10.5% |
| 4 | $5,000 – $9,999 | 10.0% |
| 5 | $10,000 – $24,999 | 9.5% |
| 6 | $25,000 – $49,999 | 9.0% |
| 7 | $50,000 – $99,999 | 8.5% |
| 8 | $100,000+ | 8.0% (floor) |

Calendar month reset. Minimum $0.50 per order. All rates admin-configurable in platform_settings.

### Why 11% Ceiling Not 12%

At 10K sellers with $5M monthly GMV, 11% ceiling costs ~$240K/year vs 12%. But it enables "Twicely is cheaper than eBay at EVERY volume level" — a marketing position worth far more than $240K. The sacrifice is <0.5% of operating margin.

### Why Progressive Not Flat

Progressive rewards growth. A seller doing $500/mo and a seller doing $50,000/mo shouldn't pay the same rate. Progressive brackets give new sellers a low entry point (10%) while giving power sellers an incentive to consolidate on Twicely (8%). This is eBay's fundamental model — they just don't execute it as cleanly.

### Impact on Code

- Rename all `tf` → `tf` in variables, types, UI strings, database columns
- Replace category lookup with progressive bracket calculator
- ~40-60 tests affected
- See TWICELY_V3_CLAUDE_CODE_PROMPTS_PRICING_v3_2.md for migration plan

---

## 76. Store Tiers Simplified to Five

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

7 Store tiers (old: NONE/STARTER/BASIC/PRO/ELITE/ENTERPRISE) caused decision paralysis. BASIC vs STARTER and ELITE vs PRO distinctions were unclear to sellers in user testing.

### The Decision

5 tiers: NONE ($0), STARTER ($6.99/mo annual), PRO ($29.99), POWER ($59.99), ENTERPRISE (custom $499+).
```typescript
enum StoreTier { NONE = 'NONE', STARTER = 'STARTER', PRO = 'PRO', POWER = 'POWER', ENTERPRISE = 'ENTERPRISE' }
```

[APPLIED] BASIC removed — features merged into STARTER. ELITE removed — replaced by POWER with clearer feature set (Puck builder, daily payouts, market intelligence, 25 staff).

### Why

Starter at $6.99 is a loss-leader (acknowledged). It converts Free sellers into the subscription habit. Pro at $29.99 is the main revenue tier. Power at $59.99 is the aspiration tier. Three meaningful upgrade steps instead of five confusing ones. All pricing is admin-configurable.

---

## 77. Crosslister Three Tiers with LITE

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

6+ Lister tiers (NONE/FREE/LITE/PLUS/POWER/MAX/ENTERPRISE) was too many for a SaaS upsell. Gap analysis showed FREE (25 publishes) → PRO (2,000 publishes) was too wide. Casual crosslisters needing 100-200 publishes/month had no option and churned.

### The Decision
```typescript
enum ListerTier { NONE = 'NONE', FREE = 'FREE', LITE = 'LITE', PRO = 'PRO' }
```

| Tier | Price (annual) | Price (monthly) | Publishes/mo |
|------|---------------|----------------|-------------|
| Free | $0 | $0 | 25 |
| Lite | $9.99/mo | $13.99/mo | 200 |
| Pro | $29.99/mo | $39.99/mo | 2,000 |

LITE captures the casual crosslister with 40-50 active listings refreshing 3-4x/month. $9.99 is the "just pay for it" price point. 3 tiers: easy to display, understand, sell.

---

## 78. Finance Pro at $9.99

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Finance Pro at $14.99 competed directly with QuickBooks Self-Employed ($15/mo) which has 20 years of features, Schedule C, bank feeds. Twicely's unique advantage — auto-populated sales data from marketplace + crosslister — is strong but not "$15 strong" against an incumbent.

### The Decision

Finance Pro = $9.99/mo annual / $14.99/mo monthly. 6 months free with Seller Pro or Power bundle.

### Why

At $9.99, Twicely is clearly cheaper than QB AND the auto-populated data is something QB literally can't do. Retention value (sellers who see P&L inside Twicely don't leave Twicely) exceeds subscription revenue. If trial-to-paid conversion is under 30%, bundle Finance into Store tiers instead of standalone. Monitor closely.

---

## 79. Stripe Fee Displayed Separately

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

If Twicely bundles Stripe processing (2.9%+$0.30) into the displayed fee, our 11% TF becomes "14.5% total" — comparable to eBay (15.6%), not clearly better. The marketing story collapses.

### The Decision

Always show Stripe processing as a separate line item. Seller sees:
- Transaction Fee (10%): -$5.00 ← Twicely's cut
- Payment Processing: -$1.75 ← Stripe (pass-through)

### Why

Twicely's fee looks lower (10% vs eBay's 13.25%) even though buyer totals are comparable. Transparency builds trust. Positions Twicely for future PayFac: when we become the processor, the Stripe line becomes Twicely revenue — the UI doesn't change, just where the money goes. Marketing: "Twicely: 10%. eBay: 13.25%. You do the math."

---

## 80. Payout UX Language Pack

**Date:** 2026-02-23
**Status:** LOCKED
**Source:** `Twicely_Payments_UX_Legal_Microcopy_Pack.pdf`

### The Problem

Holding user funds (or appearing to) triggers state money transmitter licensing in 48 states. UI labels like "Available for payout" or "Stripe connected account balance" create a perception that Twicely holds money, regardless of whether Stripe technically custodies funds.

### The Decision

Adopt UX Language Pack v1.0. Canonical copy set:

**NEVER:** "Available for payout", "Stripe connected account balance", "Funds in your Twicely account", "Withdraw from Twicely"

**ALWAYS:** "Available for payout", "Pending payout", "Paid out", "Processed and paid out through Stripe"

Standard disclosure on every money screen: "Funds are processed and paid out through Stripe. Twicely displays payout status and transaction activity."

### Why

Eliminates money transmitter risk without deferring payout features. Sellers get identical functionality — only labels change. The UX Language Pack includes: dashboard card copy, payout page copy, transaction row labels, notification templates, tooltip library, and support agent scripts. If "balance" is used at all, anchor it to payout status (e.g., "Available payout balance") and include Stripe disclosure nearby. Never combine "Balance" with "Twicely" as the owner.

---

## 81. PERSONAL Seller Profile vs BUSINESS Storefront

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Marketing "free storefront for everyone" creates bait-and-switch when PERSONAL sellers see BUSINESS sellers' branded storefronts with banners, custom URLs, and accent colors.

### The Decision

- **PERSONAL sellers:** Get "seller profile" — listing grid + ratings + follow button. Displayed as "More from this seller" panel on listing detail pages. No `/st/` URL. No banner, logo, bio, accent color, announcement bar, social links, custom categories.
- **BUSINESS sellers:** Full branded storefront at `/st/{slug}`. Features gated by Store tier.

The word "storefront" only applies to BUSINESS. PERSONAL sellers have a "seller profile." PERSONAL → BUSINESS upgrade is free (requires legal name + tax ID).

### Why

Zero confusion, zero bait-and-switch. "Seller profile" is genuinely free and genuinely useful for discovery. "Storefront" is the premium BUSINESS experience. The distinction is natural and defensible.

---

## 82. Storefront Activation Three Gates

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Original spec required 5 gates: BUSINESS status + 1 active listing + profile photo + store name + (1 completed sale OR 5 active listings). Import flywheel sellers have listings but no sales or photos yet.

### The Decision

Storefront activates when ALL of:
1. BUSINESS seller status
2. Store name set
3. At least 1 active listing

Three gates, done in 2 minutes. Profile photo and completed sales are nudged ("Complete your storefront" checklist) but NOT required for activation. Store name can auto-populate from import (e.g., eBay store name).

### Why

Import is the primary acquisition channel. Imported sellers must see value immediately. Blocking on photo or sales history kills the flywheel at the exact moment it needs to spin.

---

## 83. 72-Hour Configurable Escrow

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Need buyer protection holdback without penalizing seller cash flow. eBay releases on delivery confirmation. Poshmark gives 3-day acceptance window.

### The Decision

72-hour hold after delivery confirmation. Admin-configurable via `commerce.escrow.holdHours` (default: 72). Buyer can accept early (releases immediately). Buyer can flag issue within hold period.

### Why

72hr is conservative — protects buyers, enables item inspection, aligns with Poshmark's proven model. Configurable makes the 48hr vs 72hr debate moot — can adjust based on data. Early acceptance is the escape valve for trusted transactions. Prepares for future PayFac where fund timing control is critical infrastructure.

---

## 84. Delivery + 72hr Payout Hold

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

When should seller funds become available? eBay releases on delivery confirmation (instant). Mercari and Poshmark hold for 3 days after delivery for buyer inspection. Instant release enables payout scams (ship empty box, get paid before buyer can complain). Held release penalizes seller cash flow.

### The Decision

Funds never transfer to seller until carrier confirms delivery + 72-hour buyer inspection window passes. Buyer can accept early (immediate release) or flag a problem (cancels release, holds funds). No action after 72 hours = auto-release.

Configurable via admin setting `commerce.escrow.holdHours` (default: 72). Shippo webhook listener maps tracking events to order status transitions. BullMQ delayed job scheduled at deliveredAt + 72hrs handles auto-release.

### Why

Mercari and Poshmark both launched with this model and never changed it. Every platform that started with instant payouts (eBay, Depop, Etsy) is moving toward holds. No platform has ever moved from escrow to instant. Twicely launches with the proven model from day one — no legacy migration battle. 72hrs is conservative enough for buyer inspection but short enough that sellers aren't materially impacted (typical eBay payout is 2-4 business days anyway). The configurable setting makes the 48hr vs 72hr debate moot — adjust based on data post-launch.

---

## 85. Payout Ledger System (Not "Available for payout")

**Date:** 2026-02-23
**Status:** LOCKED
**Related:** Decision #80 (Payout UX Language Pack)

### The Problem

Sellers need an internal ledger tracking pending, available, and processed funds. But calling it "Available for payout" or "wallet" implies Twicely holds custody of funds, triggering money transmitter licensing risk in 48 states. The underlying functionality is identical — only labels create legal exposure.

### The Decision

All sellers get an internal payout ledger. Backend table name: `seller_balance` (internal naming is fine — it's UI labels that create legal exposure). Funds transfer from Twicely platform account → seller's Stripe connected account after 72hr window. Payouts (connected account → bank) happen on a separate schedule.

UI labels per UX Language Pack v1.0:
- "Available for payout" (not "balance")
- "Pending payout" (not "pending balance")
- "Paid out" (not "withdrawn")
- Standard disclosure on every money screen: "Funds are processed and paid out through Stripe."

Ledger enables: on-platform spending (zero Stripe fees), acts as buffer for post-release claims, and provides audit trail for all fund movements.

### Why

Identical seller functionality with zero money transmitter risk. The UX Language Pack (Decision #80) provides canonical copy for every screen: dashboard cards, payout pages, transaction rows, notification templates, tooltip library, and support agent scripts. Backend ledger is standard accounting infrastructure — legal risk comes exclusively from UI labels implying custodial possession.

---

## 86. PERSONAL Manual-Only Payouts

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Casual sellers (1-5 items/month) generate tiny payouts — $8, $12, $22. Stripe charges $0.25 + 0.25% per payout plus 0.25% funds routing. A $12 payout costs Twicely $0.28 in Stripe fees (2.3% of the payout amount). Auto-payouts on these micro-amounts create disproportionate infrastructure cost with minimal seller benefit.

### The Decision

PERSONAL sellers get manual payout request only. $15 minimum. Free ACH bank transfer (1-3 business days). $2.50 instant payout to debit card ($15 minimum, $250 max per transaction). No auto-payout.

### Why

Matches Mercari and Poshmark model exactly — both require manual withdrawal with minimums ($10 Mercari, $15 Poshmark). $15 minimum keeps Stripe cost per payout at ~2.2% ($0.33 on $15) vs 5.2% ($0.26 on $5) or 25% ($0.25 on $1). Manual-only encourages payout balance accumulation, which enables on-platform spending (Decision #91) — a retention mechanism. Upgrading to BUSINESS (free, requires tax info) unlocks weekly auto-payout.

---

## 87. BUSINESS Auto-Payout Weekly

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Serious sellers need predictable cash flow without manually requesting every payout. But daily auto-payouts at this tier would cost ~$48/month in Stripe fees for a full-time seller ($8K GMV), eating into Twicely's TF revenue.

### The Decision

BUSINESS sellers (free upgrade from PERSONAL — requires legal name + tax ID) get free weekly auto-payout every Friday at 6AM UTC. $1 minimum per payout. Can still request manual payouts anytime between auto-payout cycles.

### Why

Weekly batching naturally aggregates 5-7 days of sales into larger payouts, keeping Stripe cost per payout reasonable (~2.7% of TF revenue for a $5K/month seller). Friday payout means funds typically arrive Monday-Tuesday — start of the seller's business week. $1 minimum prevents empty payout attempts while being low enough that no real revenue is trapped.

---

## 88. Daily Payout Gated to Store Power

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

High-volume sellers want daily access to funds. Daily auto-payouts cost ~5x more in Stripe fees than weekly ($48/mo vs $11/mo for a full-time seller at $8K GMV). This is a premium feature that needs to fund itself.

### The Decision

Daily auto-payout (Monday-Friday, 6AM UTC) available at Store Power tier ($59.99/mo annual). $1.00 per payout fee covers Stripe infrastructure cost. Store Enterprise gets daily payouts free (negotiated terms).

### Why

$1.00/payout × ~22 business days = ~$22/month in payout fees. Stripe cost on 22 daily payouts for an $8K/month seller is ~$48/month. Store Power subscription ($59.99/mo) + payout fees ($22/mo) = $82/month revenue vs $48/month cost. The feature is self-funding at the tier where it's offered. Sellers who need daily payouts are doing enough volume that $1/payout is negligible relative to their GMV.

---

## 89. $2.50 Instant Payout Fee

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Stripe Instant Payouts cost 1% of payout amount (minimum $0.50). Need a flat fee that's profitable on small amounts without being punitive on larger ones.

### The Decision

$2.50 flat fee for instant payout to debit card. $15 minimum payout. $250 maximum per instant transaction. Available at Store Starter tier and above. Processing time: ~30 minutes.

### Why

$2.50 fee vs Stripe's 1% cost: profitable on payouts under $250 (Stripe cost on $250 = $2.50, break-even). On a $50 instant payout, Twicely pays $0.50 to Stripe and keeps $2.00. On a $15 minimum payout, Twicely pays $0.50 and keeps $2.00. The $250 cap per transaction prevents larger payouts where the flat fee becomes a subsidy (on $500, Stripe would charge $5.00 but Twicely only collects $2.50). Sellers needing larger instant amounts can split into multiple transactions or use free standard payout. Matches Poshmark's $2 instant fee and Mercari's $3 instant fee.

---

## 90. $15 Minimum Payout

**Date:** 2026-02-23
**Status:** LOCKED

### The Problem

Stripe payout cost as percentage of amount: $15 = 2.2%, $10 = 2.8%, $5 = 5.2%, $1 = 25%. Micro-payouts destroy margin.

### The Decision

$15 minimum for PERSONAL seller manual payouts and for all instant payouts. BUSINESS sellers on auto-payout get $1 minimum (weekly batching naturally aggregates above $15). Store Power/Enterprise on daily auto-payout get $1 minimum.

### Why

$15 matches Poshmark's minimum. Mercari uses $10. At $15, Stripe cost is ~2.2% — acceptable. The higher minimum for PERSONAL (manual-only) sellers encourages balance accumulation and on-platform spending. BUSINESS sellers can have $1 minimum because weekly auto-payouts naturally aggregate multiple sales into larger payouts, so the $15 threshold is effectively met by volume.

---

## 91. On-Platform Payout Spending — Narrow Scope

**Date:** 2026-02-23
**Status:** LOCKED
**Updated:** 2026-02-23 (narrowed from broad marketplace spending to platform fees only)

### The Problem

Sellers with available payout amounts who also buy Twicely services (subscriptions, boost, insertion fees) currently pay with card — incurring Stripe processing fees on money that's already in Stripe. Double fees, unnecessary friction.

Broader version (sellers buying from other sellers using payout balance) was considered but creates three risk layers: custody perception risk (UX implies spendable wallet), functional wallet risk (internal ledger becomes payment instrument), and regulatory classification risk (money transmission / stored value).

### The Decision

**Ship narrow scope only:** Sellers can pay Twicely platform charges (subscriptions, boost, insertion fees, overage packs, authentication) using their Stripe connected account balance. Stripe remains system of record. Twicely never maintains an internal spendable balance.

**Defer broad scope:** Seller-to-seller marketplace purchases using payout balance deferred until fintech counsel review confirms no money transmitter or stored-value implications.

### The Line

| Scope | Status | Risk |
|-------|--------|------|
| Pay Twicely subscriptions via Stripe connected balance | ✅ Ship | Low — Stripe-native, platform-owned charges |
| Pay Twicely boost/insertion/overage via Stripe balance | ✅ Ship | Low — same as above |
| Buy from another seller using payout balance | ❌ Deferred | High — looks and feels like wallet |
| Partial payout balance + card for marketplace purchase | ❌ Deferred | High — Twicely ledger becomes payment instrument |
| Internal Twicely credits redeemable broadly | ❌ Never | Very high — stored value regulation |

### Build Rules

- Stripe objects/transactions are source of truth, not Twicely DB
- No "wallet" or "Available for payout" terminology anywhere
- Label: "Pay with available Stripe payout balance"
- Audit trail: amount, charge/invoice ID, source = stripe_balance, service purchased
- Feature-flagged by jurisdiction (`payout.onPlatformFeePaymentEnabled`)
- Twicely DB logs transactions but does NOT maintain spendable balance

### Why Narrow Is Still Valuable

Pure margin on platform charges — zero Stripe processing cost on subscriptions/boost paid from connected balance. Keeps funds circulating in the Twicely ecosystem without creating regulatory exposure. When legal review clears the broader scope, the Stripe-native infrastructure already exists.

---

## 92. Post-Release Claim Recovery Waterfall

**Date:** 2026-02-23
**Status:** LOCKED
**Related:** Buyer Protection Canonical §4 (Fee Allocation by Fault Type)

### The Problem

72-hour auto-release transfers funds to the seller's Stripe connected account. But buyer protection claim windows extend to 30/60/90 days from delivery (depending on claim type — see Buyer Protection Canonical). If a buyer files a valid claim after funds were released and the seller has already withdrawn to their bank, how does Twicely recover?

### The Decision

Priority waterfall for post-release claim recovery:
1. **Freeze seller's available payout balance** — immediate, zero cost
2. **Hold future payout releases** — funds from new sales accumulate but don't transfer
3. **Stripe transfer reversal** — creates negative balance on seller's connected account; Stripe debits their bank
4. **Twicely absorbs from Buyer Protection Fund** — 0.5% of GMV reserved monthly for unrecoverable losses

### Why

Steps 1-3 recover funds at zero cost to Twicely in ~95% of cases (most sellers have ongoing sales or available balance). Step 4 is the backstop for sellers who disappear or have no recoverable funds. 0.5% reserve rate is conservative — Mercari's dispute rate is ~1.2% of GMV but most resolve via steps 1-3. The waterfall ensures buyers are always made whole regardless of seller's payout status, which is critical for buyer trust and Buyer Protection brand credibility.

Fee treatment per Buyer Protection Canonical §4:
- SELLER_FAULT: Twicely keeps original TF, seller bears full refund cost
- BUYER_REMORSE: Twicely keeps original TF, buyer pays restocking + return shipping
- PLATFORM_CARRIER_FAULT: Full TF refund to seller, Twicely absorbs from Protection Fund
- EDGE_CONDITIONAL: Case-by-case resolution

---

---

## 93. Proration Strategy: create_prorations (Stripe Default)

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S4 (Upgrade/Downgrade)

### The Problem

When a seller changes subscription tier mid-cycle, how should the price difference be handled? Stripe offers three proration behaviors: `create_prorations` (credit/charge on next invoice), `always_invoice` (immediate invoice), and `none` (no adjustment).

### The Decision

Use `create_prorations` for all upgrades and interval upgrades. Use `none` when applying pending downgrades at renewal (since the downgrade takes effect at the new period, no proration needed).

### Why

Stripe default. Fair to sellers — they get immediate access to upgraded features while the price difference settles naturally on the next invoice. No custom proration math in Twicely code. `always_invoice` was considered for upgrades (charge immediately for confirmed payment before granting features), but `create_prorations` achieves the same outcome — seller gets the new tier immediately and Stripe handles the math. The invoice just settles on the next billing date.

---

## 94. Keep Original Billing Cycle Anchor

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S4 (Upgrade/Downgrade)

### The Problem

When a seller changes plans, should their billing date reset to today or stay on the original anchor?

### The Decision

Keep original anchor. Seller signs up Jan 15, bills on the 15th forever regardless of plan changes.

### Why

Resetting anchor on every plan change creates unpredictable billing dates. Sellers lose track of when they're charged. Stripe does this by default with `proration_behavior: 'create_prorations'` — the billing cycle anchor is preserved unless explicitly changed. Simple, predictable, no implementation work.

---

## 95. Allow Monthly→Annual Switch Mid-Cycle

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S4 (Upgrade/Downgrade)

### The Problem

Can a seller on a monthly plan switch to annual billing mid-cycle (or vice versa)?

### The Decision

Yes. Monthly→annual is classified as INTERVAL_UPGRADE (effective immediately with proration). Annual→monthly is classified as INTERVAL_DOWNGRADE (effective at period end, stored as pending change).

### Why

Monthly→annual is the revenue-positive upsell path. Seller on monthly Pro ($39.99/mo) switches to annual Pro ($29.99/mo billed as $359.88/yr). Stripe credits remaining monthly days, charges the annual amount. Seller saves money, Twicely gets committed revenue. No reason to gate this behind "wait until period end." Annual→monthly is a de-commitment — treated like a downgrade. Seller keeps their current paid period, switch takes effect at renewal.

---

## 96. Downgrade Timing: At Period End

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S4 (Upgrade/Downgrade)

### The Problem

When a seller downgrades (e.g., Power → Pro), should they lose features immediately or keep them until their paid period expires?

### The Decision

At period end. Seller keeps current tier features until the paid period expires, then drops to the lower tier.

### Why

"I paid for Power this month but got demoted to Pro today" is a terrible experience. Every major SaaS (Shopify, Stripe, Slack, GitHub) handles downgrades this way. The seller made a payment commitment — honor it. This also matches the existing cancel-at-period-end pattern from D3-S3, so the UX is consistent: both cancel and downgrade give you access until the end of what you paid for.

---

## 97. Downgrade Mechanism: DB pendingTier + Webhook

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S4 (Upgrade/Downgrade)

### The Problem

If downgrades take effect at period end, how do we schedule them? Options: (A) Stripe Subscription Schedules, (B) BullMQ delayed job, (C) Store pending state in DB and apply via webhook at renewal.

### The Decision

Option C. Store `pendingTier`, `pendingBillingInterval`, and `pendingChangeAt` columns on the subscription tables. When the `customer.subscription.updated` webhook fires at renewal, check for pending changes and apply them via `stripe.subscriptions.update()` with `proration_behavior: 'none'`.

### Why

Stripe Subscription Schedules (option A) add significant API complexity — they're a separate object model with phases, transitions, and their own webhook events. Overkill for "change the price at next renewal." BullMQ delayed jobs (option B) are fragile — if the job fails or the server restarts, the downgrade is lost. DB columns (option C) are simple, persistent, inspectable, and the webhook is already being processed. The `customer.subscription.updated` event fires reliably at renewal. If it doesn't fire (Stripe outage), the subscription stays on the current tier — safe default. The pending change can be cancelled by the seller at any time before period end by clearing the columns.

---

## 98. Three Bundles Only (Pricing Canonical §9 Wins)

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S5 (Bundle Checkout)

### The Problem

What bundle combinations should Twicely offer? The pricing canonical lists three bundles (Starter Bundle, Pro Bundle, Power Bundle). However, math suggests up to 20 possible Store × Lister tier combinations. Which is correct?

### The Decision

Three bundles only. Pricing Canonical §9 is the source of truth.

| Bundle | Components | Monthly | Annual |
|--------|------------|---------|--------|
| Starter Bundle | Store Starter + Lister Lite | $24.99 | $249.99 |
| Pro Bundle | Store Pro + Lister Pro | $59.99 | $599.99 |
| Power Bundle | Store Power + Lister Pro | $99.99 | $999.99 |

### Why

Bundles exist for simplicity — "one subscription, everything you need" — not for combinatorial flexibility. 20 bundles would overwhelm the UI and confuse sellers. The three bundles map cleanly to three seller personas: hobbyist (Starter), growing reseller (Pro), and professional operation (Power). Buyers of bundled subscriptions are committing to the Twicely ecosystem — the price lock guarantees predictable costs as they scale. If a seller wants Store PRO + Lister LITE (not a bundle combination), they buy them separately. The individual subscriptions remain available — bundles are a pricing vehicle, not a restriction.

---

## 99. Bundles Are Single Stripe Products

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S5 (Bundle Checkout)

### The Problem

How should bundles be modeled in Stripe? Options: (A) Single product with bundled price, (B) Multi-item checkout with Store + Lister line items, (C) Custom proration logic to combine separate subscriptions.

### The Decision

Option A. Each bundle is a single Stripe product with its own price ID. Three products × two intervals = six Stripe Prices for bundles.

### Why

Multi-item subscriptions (option B) create sync complexity — what if one line item fails? What if the seller wants to cancel only one component? Custom proration (option C) is a maintenance nightmare. A single product keeps the Stripe model simple: one subscription ID, one price, one billing event. The fact that the bundle "contains" Store + Lister features is a Twicely business concept, not a Stripe concept. Stripe bills the bundle price; Twicely's webhook sets `bundleTier` and grants both Store and Lister features.

---

## 100. Finance Pro Permanent on Bundle

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S5 (Bundle Checkout), Finance Engine

### The Problem

The Power Bundle includes Finance Pro. But Finance Pro is normally a separate $9.99/mo add-on with its own subscription. How do these interact?

### The Decision

Finance Pro is included in the Power Bundle as a permanent benefit — sellers do not see a separate Finance subscription. When a seller has an active Power Bundle, `financeTier` on sellerProfile is set to `PRO`. If they downgrade to Pro Bundle or Starter Bundle, `financeTier` reverts to `FREE`. There is no separate `financeSubscription` row for bundled Finance — it's implicit in the bundle tier.

### Why

Creating a separate `financeSubscription` row for bundled Finance creates sync problems: what happens if someone cancels the Finance row but keeps the Power Bundle? The bundle price includes Finance — you can't unbundle it. The simplest model is: bundle tier determines finance access. Power Bundle → Finance Pro. Anything else → Finance Free (unless they have a separate standalone Finance subscription).

---

## 101. New bundleSubscription Table (Option A)

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S5 (Bundle Checkout), Schema Addendum

### The Problem

Where do we store bundle subscription data? Options: (A) New `bundleSubscription` table parallel to `storeSubscription` / `listerSubscription`, (B) Store in `storeSubscription` with a "bundle" flag, (C) Store in a generic `subscription` table with a product discriminator.

### The Decision

Option A. Create a new `bundleSubscription` table with the same shape as the other subscription tables: `id`, `sellerProfileId`, `stripeSubscriptionId`, `stripePriceId`, `tier` (STARTER_BUNDLE / PRO_BUNDLE / POWER_BUNDLE), `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `pendingTier`, `pendingBillingInterval`, `pendingChangeAt`, `createdAt`, `updatedAt`.

### Why

Bundles are not stores and not listers — they're a distinct product type. Conflating them with store subscriptions (option B) creates ambiguity: does `storeSubscription.tier = 'POWER'` mean Power Store or Power Bundle? A generic table (option C) adds unnecessary abstraction — the four subscription types have different enough semantics that keeping them separate makes queries clearer. The `bundleSubscription` table follows the same pattern as other subscription tables, so the upsert/cancel/webhook logic can be mostly copy-pasted with minimal changes.

---

## 102. bundleTier Denormalized on sellerProfile

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S5 (Bundle Checkout)

### The Problem

How do we quickly check if a seller has an active bundle? Options: (A) Query `bundleSubscription` table every time, (B) Denormalize `bundleTier` on `sellerProfile` like we do for `storeTier` / `listerTier`.

### The Decision

Option B. Add `bundleTier` column to `sellerProfile` with values: `NONE` (default), `STARTER_BUNDLE`, `PRO_BUNDLE`, `POWER_BUNDLE`.

### Why

This matches the existing pattern for `storeTier`, `listerTier`, `financeTier`, and `hasAutomation`. Feature gating throughout the app can check `sellerProfile.bundleTier` without joining to subscription tables. The denormalized value is updated by the webhook handler when bundle status changes. Trade-off: data could become inconsistent if webhook fails. Mitigation: periodic reconciliation job (same as other subscription tiers).

---

## 103. Individual→Bundle: Cancel Immediately with Proration

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S5 (Bundle Checkout), D3-S4 (Upgrade/Downgrade)

### The Problem

Seller has individual Store PRO ($39.99/mo) and Lister PRO ($19.99/mo) subscriptions. They want to switch to Pro Bundle ($59.99/mo). How do we handle the transition?

### The Decision

Cancel both individual subscriptions immediately with proration. Create a new bundle subscription. Stripe credits the unused portions of the individual subscriptions and charges the bundle price. Net effect on next invoice: (bundle price) - (store credit) - (lister credit) = first bundle payment.

### Why

"At period end" for individual subscriptions would mean the seller pays twice until the current period expires — once for the individuals, once for the bundle. That's a terrible experience. Immediate cancellation with proration means the seller switches cleanly: they stop paying for individuals, start paying for the bundle, and Stripe settles the difference. The seller might see a small charge or credit depending on timing, but the math is fair. This is the same logic Stripe uses for any subscription replacement.

---

## 104. Bundle Cancel: Component Tiers Revert at Period End

**Date:** 2026-03-01
**Status:** LOCKED
**Related:** D3-S5 (Bundle Checkout)

### The Problem

Seller cancels their Pro Bundle. What happens to their Store PRO and Lister PRO access?

### The Decision

At period end (when the bundle actually cancels), `bundleTier` reverts to `NONE`. `storeTier` reverts to `NONE`. `listerTier` reverts to `FREE` (the default crosslister tier). The seller does NOT automatically get individual subscriptions — they lose access to paid features unless they purchase individual plans.

### Why

Bundles are a pricing commitment. When you cancel the commitment, you lose the bundled features. Auto-creating individual subscriptions would be confusing ("I cancelled but I'm still being charged?"). The clean exit is: bundle ends, access ends, seller returns to free tiers. If they want to keep Store PRO separately, they must explicitly purchase it. The UI should make this clear during cancellation: "When your bundle ends, you'll lose access to Store PRO and Lister PRO features. You can purchase individual plans if you'd like to keep some features."

---

## 105. FREE ListerTier Redefined as Time-Limited Teaser (5 Publishes × 6 Months)

**Date:** 2026-03-07
**Status:** LOCKED
**Replaces:** Pricing Canonical v3.2 §6.2 (FREE = 25 publishes/mo, no expiry)
**Affects:** `crosslister.publishes.FREE`, `sellerProfile.listerFreeExpiresAt`, `crosslister.tierWeight.free`, Pricing Canonical §6, Lister Canonical §7.3

### The Problem

FREE ListerTier was previously specced at 25 publishes/month with no expiry. Two problems emerged:

1. **No revenue on external sales.** A FREE seller pushing 25 listings to eBay generates $0 for Twicely if those items sell on eBay. The free publishes were a pure cost center — API quota consumed, scheduler load generated, zero monetization.

2. **No urgency to upgrade.** An unlimited free tier with 25 publishes gives casual crosslisters no reason to pay. They stay on FREE indefinitely.

### Options Considered

| Option | Publishes | Expiry | Risk |
|--------|-----------|--------|------|
| Keep FREE at 25/mo forever | 25 | None | Zero revenue on external sales, no upgrade pressure |
| Make FREE import-only (0 publishes) | 0 | None | No product taste, LITE at $9.99 is a cold ask |
| **Time-limited teaser** | **5/mo** | **6 months** | **Revenue exposure limited, creates upgrade urgency** |
| Trial via Stripe ($0 sub, 14-day) | 200 | 14 days | Too short to feel value, Stripe overhead for $0 product |

### The Decision

**FREE ListerTier = 5 publishes/month for 6 months from account creation, then auto-downgrades to NONE.**

- 5 publishes is enough to feel the crosslister product (connect eBay, push 5 listings, watch them go live)
- 6 months is enough time to build the habit
- After 6 months: tier drops to NONE, existing projections stay alive (no forced delist), seller sees upsell banner with their publish history ("You crosslisted X listings in 6 months — upgrade to LITE to keep going")
- No Stripe subscription created for FREE tier — expiry tracked via `sellerProfile.listerFreeExpiresAt` (set to `createdAt + 6 months` on seller profile creation)
- Nightly cron: `listerFreeExpiresAt < now() AND listerTier = 'FREE'` → set `listerTier = 'NONE'`

### Why Not Stripe

FREE crosslister is implicit on signup. No checkout flow, no card required. A $0 Stripe subscription adds webhook surface area, a subscription row, and trial state machine complexity for a product that costs nothing. A single timestamp column on `sellerProfile` is the correct implementation — lightweight, no external dependency, easy to extend (admin can bump expiry per user if needed).

### Updated ListerTier Feature Matrix

| Tier | Price | Publishes/mo | Expiry | AI Credits | Rollover | Re-import | Automation |
|------|-------|-------------|--------|-----------|----------|-----------|------------|
| NONE | $0 | 0 | — | 0 | None | No | No |
| FREE | $0 | 5 | 6 months | 0 | None | No | No |
| LITE | $9.99/mo annual | 200 | None | 25 | 60 days, max 600 | Yes | Yes |
| PRO | $29.99/mo annual | 2,000 | None | 200 | 60 days, max 6,000 | Yes | Yes |

### Platform Settings

```
crosslister.publishes.FREE        = 5       (was 25)
crosslister.freeTierMonths        = 6       (new — admin-configurable)
crosslister.tierWeight.free       = 1.0     (unchanged — they can crosslist)
crosslister.polling.budget.FREE   = 20 polls/hr  (5 active projections max)
```

### Schema Addition

```typescript
// sellerProfile table
listerFreeExpiresAt: timestamp('lister_free_expires_at', { withTimezone: true })
```

Set to `createdAt + crosslister.freeTierMonths` on seller profile creation. Null for accounts created before this decision (treat as already expired — NONE, or grandfathered at admin discretion).

### Upsell Moment

On expiry, seller sees modal + persistent banner:

> "Your free crosslister period has ended. You published [N] listings across [P] platforms in 6 months.
> Upgrade to LITE ($9.99/mo) to keep crosslisting."

This is a data-driven conversion message — personalized with their actual usage history.

---

## 106. NONE ListerTier Clarified — Import Remains Free and Universal

**Date:** 2026-03-07
**Status:** LOCKED
**Clarifies:** Lister Canonical §6.1 (free one-time import), Pricing Canonical §6.3 (import rules)

### The Problem

With FREE redefined as a time-limited teaser (entry #105), the question arose: what does NONE mean for sellers? Does NONE block import? Is NONE only for buyers?

### The Decision

**NONE is the floor for everyone — buyers and sellers alike. Import is always free regardless of ListerTier, including NONE.**

| Scenario | ListerTier | Can Import? | Can Crosslist? |
|----------|-----------|-------------|----------------|
| New seller, never touched crosslister | NONE | ✅ Yes — always free | ❌ No |
| Seller whose FREE teaser expired | NONE | ✅ Yes — always free | ❌ No |
| Buyer account | NONE | N/A | N/A |
| Active crosslister subscriber | LITE or PRO | ✅ Yes | ✅ Yes |

The "free one-time import per marketplace" rule (Lister Canonical §6.1) is unconditional. No ListerTier gate on import. Ever. This is the supply flywheel — blocking import under any circumstance kills the business model.

### Why NONE ≠ "Buyer Only"

NONE is not a buyer-specific tier. It's the default state for any account that has no active crosslister subscription. A seller who cancels LITE goes back to NONE. A seller whose FREE teaser expires goes back to NONE. A brand new seller starts at NONE. All of them can still import.

### Scheduler Impact

NONE sellers only ever generate IMPORT jobs (one-time, MEDIUM priority queue). They never generate PUBLISH, SYNC, or DELIST jobs (no crosslisting). The `crosslister.tierWeight.none = 0.5` scheduler multiplier applies only to import job fairness — correct and unchanged.

---

## 107. Platform Setting Keys: `crosslister.*` Everywhere (xlister.* Retired)

**Date:** 2026-03-07
**Status:** LOCKED
**Affects:** Pricing Canonical v3.2 §6.4, `src/lib/db/seed/v32-platform-settings.ts`, all code reading `xlister.*` keys

### The Problem

The Pricing Canonical v3.2 §6.4 introduced `xlister.*` as the platform settings namespace for crosslister subscription settings. The rest of the codebase — Lister Canonical, seed-crosslister.ts, rate-limiter, scheduler — all use `crosslister.*`. Two namespaces for one product causes confusion and split lookups.

### The Decision

**All platform settings for the crosslister product use `crosslister.*`. The `xlister.*` namespace is retired.**

| Old Key (retired) | New Key (canonical) |
|-------------------|---------------------|
| `xlister.publishes.FREE` | `crosslister.publishes.FREE` |
| `xlister.publishes.LITE` | `crosslister.publishes.LITE` |
| `xlister.publishes.PRO` | `crosslister.publishes.PRO` |
| `xlister.pricing.lite.annualCents` | `crosslister.pricing.lite.annualCents` |
| `xlister.pricing.lite.monthlyCents` | `crosslister.pricing.lite.monthlyCents` |
| `xlister.pricing.pro.annualCents` | `crosslister.pricing.pro.annualCents` |
| `xlister.pricing.pro.monthlyCents` | `crosslister.pricing.pro.monthlyCents` |
| `xlister.aiCredits.LITE` | `crosslister.aiCredits.LITE` |
| `xlister.aiCredits.PRO` | `crosslister.aiCredits.PRO` |
| `xlister.bgRemovals.LITE` | `crosslister.bgRemovals.LITE` |
| `xlister.bgRemovals.PRO` | `crosslister.bgRemovals.PRO` |
| `xlister.rolloverDays` | `crosslister.rolloverDays` |
| `xlister.rolloverMaxMultiplier` | `crosslister.rolloverMaxMultiplier` |
| `xlister.freeTierMonths` | `crosslister.freeTierMonths` |

### Document Updates Required

- Pricing Canonical v3.2 §6.4: replace all `xlister.*` keys with `crosslister.*`
- Install prompts referencing `xlister.*` keys: replace with `crosslister.*` equivalents

### Why

One product, one namespace. `crosslister.*` is already the established pattern across every other setting file. Pricing Canonical was written early and used `xlister` as shorthand. That shorthand is now a liability.

---

## 108. Adaptive Polling Engine — All Values Locked

**Date:** 2026-03-07
**Status:** LOCKED
**Builds in:** Polling Queue (Phase F, after F1 eBay import)
**Spec:** Lister Canonical §13 (framework), this entry (exact values)

### The Problem

Lister Canonical §13 defines the polling architecture with interval ranges and tier criteria but leaves all numeric values as ranges. Code requires single values. Budget per ListerTier, exact intervals, HOT decay path, and double-sell threshold were all unspecced.

### Decisions

#### Polling Intervals

| Tier | Locked Value | Rationale |
|------|-------------|-----------|
| HOT | **90 seconds** | Floor of the 1-3 min spec range. Sale detection on session platforms (Poshmark, Mercari) needs to be fast. 90s means a sold item is detected within 1.5 minutes worst case — well within the §12.4 target of <3 min for Tier B platforms. |
| WARM | **10 minutes** | Midpoint of 5-15 min range. Activity signal is present but not urgent. |
| COLD | **45 minutes** | Midpoint of 30-60 min range. Low activity, budget conservation priority. |
| LONGTAIL | **4 hours** | Midpoint of 2-6 hr range. Stale listings. Infrastructure cost minimum. |

#### Budget Per ListerTier (polls/hour, all platforms combined per seller)

| ListerTier | Polls/hr | Reasoning |
|-----------|---------|-----------|
| NONE | **10** | NONE sellers still have ChannelProjection rows from their free import on session platforms (Poshmark, Mercari, Depop). These have no webhooks — polling is the only sale detection method. 10 polls/hr covers ~15 COLD-tier projections. Cannot be 0 or NONE sellers get double-sells with no detection. |
| FREE | **20** | 5 publishes/month max — ~5 active projections. 20 polls/hr comfortably covers 5 HOT + some COLD projections. |
| LITE | **200** | Standard crosslister. 200 active listings across 3-4 platforms. |
| PRO | **1000** | Heavy crosslister. Large catalogues, multiple platforms, HOT-tier coverage for active listings. |

#### HOT Decay Path

When a HOT promotion timer expires (e.g., 1hr after watcher added):

**Decision: Step through WARM before returning to COLD.**

```
HOT (timer expires) → WARM (for 30 min) → previous tier (COLD or LONGTAIL)
```

Rationale: Jumping HOT → COLD directly risks missing a second activity signal that arrives shortly after the first. Stepping through WARM gives a 30-minute buffer where the listing is still monitored at reasonable frequency. The cost is minimal — 30 minutes of WARM polling is negligible.

Exception: If listing was LONGTAIL before HOT promotion, decay path is HOT → WARM → LONGTAIL (not COLD).

#### Double-Sell Rate Threshold

**Decision: 2% (0.02) — 2 double-sells per 100 completed sales.**

When a seller's rolling 30-day double-sell rate exceeds 2%, all their active projections are elevated to HOT tier until the rate drops below 1% for 7 consecutive days.

Rationale: 2% is aggressive enough to catch problematic sellers before they cause significant buyer harm, but lenient enough to not punish sellers for the occasional race condition on a slow poll cycle. The 1% / 7-day release threshold prevents thrashing.

### Platform Settings Keys (all `crosslister.*`)

```
crosslister.polling.hot.intervalMs        = 90000     (90 seconds)
crosslister.polling.warm.intervalMs       = 600000    (10 minutes)
crosslister.polling.cold.intervalMs       = 2700000   (45 minutes)
crosslister.polling.longtail.intervalMs   = 14400000  (4 hours)

crosslister.polling.budget.NONE           = 10        (polls/hr)
crosslister.polling.budget.FREE           = 20        (polls/hr)
crosslister.polling.budget.LITE           = 200       (polls/hr)
crosslister.polling.budget.PRO            = 1000      (polls/hr)

crosslister.polling.hotDecayDwellMs       = 1800000   (30 min WARM dwell after HOT expires)
crosslister.polling.doubleSellThreshold   = 0.02      (2%)
crosslister.polling.doubleSellReleaseRate = 0.01      (1% — rate to drop below before releasing HOT)
crosslister.polling.doubleSellReleaseDays = 7         (consecutive days below release rate)
```

### Schema Additions (channelProjection table)

Three columns added to `channel_projection`:

```typescript
pollTier:     pollTierEnum('poll_tier').notNull().default('COLD'),
nextPollAt:   timestamp('next_poll_at', { withTimezone: true }),
lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
```

`pollTierEnum` already exists in schema: `['HOT', 'WARM', 'COLD', 'LONGTAIL']`.

### Architecture (4 files)

| File | Responsibility |
|------|---------------|
| `src/lib/crosslister/polling/poll-budget.ts` | Tracks polls/hr per seller, gates whether a poll can execute |
| `src/lib/crosslister/polling/poll-tier-manager.ts` | Promotion/demotion logic, writes `pollTier` + `nextPollAt` |
| `src/lib/crosslister/polling/poll-scheduler.ts` | Finds projections due for polling (`nextPollAt < now()`), enqueues POLL jobs |
| `src/lib/crosslister/polling/poll-executor.ts` | Executes a single poll via connector, handles sale detected / status changed / no change |

### Polling Queue

Uses existing `lister:polling` BullMQ queue (LOW priority, concurrency 20 — already defined in §4.3). No new queue needed.

### Forbidden Patterns

- ❌ Polling projections with `status != 'ACTIVE'` (SOLD, DELISTED, ENDED projections must not be polled)
- ❌ Polling eBay/Etsy projections at HOT/WARM intervals (webhooks are primary; only COLD/LONGTAIL as safety net per §13.5)
- ❌ Hardcoding any interval or budget value (all must read from platform settings)
- ❌ Polling when circuit breaker for that platform is OPEN
- ❌ Setting `nextPollAt` without respecting the seller's polling budget

---

## 109. Sold Listing Auto-Archive — Seller Cannot Delete (Mercari Model)

**Date:** 2026-03-07
**Status:** LOCKED
**Affects:** Feature Lock-in §24 (Listing States), Feature Lock-in §37 (Data Retention), Page Registry §11.2

### The Problem

The original spec allowed sellers to delete listings freely, including sold ones. This creates three problems:

1. **Transaction integrity.** A buyer can open a dispute 30 days after delivery. If the seller deleted the listing, there's no record of what was sold, at what condition, with what photos. Dispute resolution collapses.
2. **Tax compliance.** The seller's own sales history is part of their financial record. Deleting it harms them as much as it harms Twicely.
3. **Market intelligence.** Sold listings are the primary data source for pricing comps and market intelligence. Deletion destroys the dataset.

### The Decision (Mercari Model)

**Sold listings are auto-archived on sale. Sellers cannot delete them. Ever.**

| Listing Status | Seller Can Delete? | Behavior |
|---------------|-------------------|---------|
| DRAFT | ✅ Yes | Hard deleted immediately — no commerce significance |
| ACTIVE | ✅ Yes | Triggers delist cascade if active projections exist (hub enforcement) |
| PAUSED | ✅ Yes | Triggers delist cascade if active projections exist |
| ENDED (unsold) | ✅ Yes | Hard deleted — no transaction, no financial record |
| SOLD | ❌ No | Auto-archived. Seller can hide from dashboard view. Record is permanent. |

**"Hide from dashboard" is not deletion.** The seller can filter their sold history to clean up their view. The listing record, images (per retention policy), and all associated order/financial data remain in the database.

**Why sellers actually benefit:**
- Full sold history for tax preparation
- Dispute protection — Twicely can always reconstruct what was sold
- Price history for their own analytics ("I sold 12 of these at $45 last year")

### Archive vs Delete UX

On the seller dashboard, SOLD listings show an "Archive" button (hide from default view) not a "Delete" button. The copy reads:

> *"Sold listings are kept on record for your protection. You can hide this listing from your dashboard — it will still appear in your sales history and tax exports."*

---

## 110. Financial Records: 7-Year Retention (eBay / IRS Model)

**Date:** 2026-03-07
**Status:** LOCKED
**Affects:** Feature Lock-in §37 (Data Retention), Actors & Security Canonical §4.3 (GDPR), Finance Engine Canonical

### The Decision

**All financial records are retained for 7 years regardless of account status, account deletion, or any seller request.**

Financial records subject to 7-year retention:

| Record Type | Table | Retention |
|-------------|-------|-----------|
| Order records | `order`, `order_item`, `order_payment` | 7 years from transaction date |
| Ledger entries | `ledger_entry` | 7 years from entry date |
| Payout records | `payout`, `payout_batch` | 7 years from payout date |
| Fee records | `listing_fee`, `fee_schedule` | 7 years from fee date |
| Tax records | `tax_info`, `tax_quote` | 7 years from tax year end |
| Subscription billing | `store_subscription`, `lister_subscription` | 7 years from billing date |
| Affiliate commissions | `affiliate_commission`, `affiliate_payout` | 7 years from commission date |

### Interaction with Account Deletion

When a seller deletes their account:
1. PII (name, email, phone, address) — hard deleted after 30-day cooling off
2. Financial records — **pseudonymized** (seller replaced with `deleted_user_[hash]`), retained 7 years
3. Ledger entries — already immutable (DB trigger). Pseudonymized. Retained 7 years.
4. The `deleted_user_[hash]` is a one-way hash — no reverse mapping stored

**The seller's right to erasure (GDPR) does not override legal financial retention requirements.** GDPR explicitly carves out exceptions for legal obligations. 7-year financial retention is a legal obligation under US tax law (IRS Publication 583) and EU equivalents. This is documented in Twicely's Privacy Policy.

### GDPR Data Export Includes Financial History

The seller's data export at `/my/settings/privacy → Download My Data` must include:
- Full sold listing history
- Complete order history
- Complete payout history
- Complete ledger entries for their account
- 1099-K data if applicable

This is their right under GDPR portability (Article 20) — they can take their financial history with them even though Twicely retains a copy.

### Ledger Immutability Reinforced

The existing DB-level immutability trigger (reject UPDATE/DELETE on `ledger_entry`) is not just an architectural choice — it is now a legal compliance requirement. No code path, admin action, or migration may bypass it.

---

## 111. Image Retention Policy — Tiered by Age and Account Status

**Date:** 2026-03-07
**Status:** LOCKED
**Affects:** Feature Lock-in §37 (Data Retention), Lister Canonical §19 (Image Handling)

### The Decision

Images follow a tiered retention policy based on listing age and account status.

### Standard Listing Image Lifecycle

| Stage | What's Kept | Rationale |
|-------|------------|-----------|
| Active listing | Full stack: originals + all platform variants + thumbnail | Commerce-active, full quality needed |
| Days 0–120 after sold/ended | Full stack retained | Covers returns (30 days), buyer protection (30-90 days), dispute escalation |
| Day 120 → 2 years | Main high-res (cover image slot 0) + thumbnail only | Sold comps, market intelligence, "Sold For" pages |
| After 2 years | All images deleted | Listing record also deleted at this point |

**"Main image"** is defined as the cover image (slot 0 at time of sale/end). Not the first uploaded, but whatever the seller designated as primary. This is the image that appears on sold comp pages and market intelligence.

**Platform variants** (Poshmark square crop, eBay resized, Mercari compressed, etc.) are deleted at day 120. They have zero value after the listing ends — they were only needed for active crosslisting.

### Account Deletion Image Lifecycle

| Stage | What's Kept | Rationale |
|-------|------------|-----------|
| Account deletion requested | Full stack until day 120 | 30-day cooling off + dispute window |
| After 30-day cooling off | De-linked from identity | Seller FK nulled, EXIF metadata stripped |
| Day 120 post-deletion | Main image + thumbnail only | Anonymous data mining |
| 2 years post-deletion | All images deleted | End of data mining retention |

**De-linking on deletion:** When the 30-day cooling off expires and deletion is confirmed:
- `listing.sellerId` → set to null (or pseudonymized FK)
- EXIF metadata stripped from all images in R2 (GPS coordinates, device info, timestamps)
- Images are now anonymous market data — no path back to the seller identity

**Face detection on deletion:** Any image flagged as containing a human face at upload time (via automated detection) is **hard deleted immediately** on account deletion confirmation. A face in an image is personal data. The seller's right to erasure applies regardless of the retention policy for anonymous market data.

### ORPHANED Projection Images

When a crosslister account is closed and projections transition to ORPHANED:
- Images follow the standard sold/ended retention timeline from the `orphanedAt` timestamp
- Day 120: variants deleted, main + thumbnail retained
- 2 years: all images deleted
- Images are de-linked from seller identity at account deletion (same as above)

### Storage Reality

At 500K active listings, 5 images each, Cloudflare R2 at $0.015/GB/month:

| Stage | Est. Storage | Monthly Cost |
|-------|-------------|-------------|
| Active (full stack) | ~400GB | ~$6 |
| Post-120 days (main + thumbnail) | ~300GB | ~$4.50 |
| Post-2 years (thumbnail only) | ~7.5GB | ~$0.11 |

Image storage is not a cost problem. The tiered policy exists for legal compliance and data quality — not infrastructure savings.

---

## 112. Projection States: UNMANAGED and ORPHANED

**Date:** 2026-03-07
**Status:** LOCKED
**Affects:** Lister Canonical §25.4, Schema crosslister.ts (projectionStatusEnum), Stripe webhook handlers

### The Problem

The current `projectionStatusEnum` has no states for projections that are externally live but no longer managed by Twicely. Two scenarios require distinct states:

1. **Subscription cancellation / FREE teaser expiry** — seller still has a Twicely account, just not paying for crosslisting
2. **Account closure** — seller is leaving Twicely entirely

### The Decision

Two new projection statuses added to `projectionStatusEnum`:

```typescript
export const projectionStatusEnum = pgEnum('projection_status', [
  'DRAFT', 'QUEUED', 'PUBLISHING', 'ACTIVE', 'SOLD', 'ENDED', 'DELISTED',
  'ERROR', 'FAILED',
  'UNMANAGED',  // NEW: externally live, subscription lapsed, Twicely not managing
  'ORPHANED',   // NEW: account closed, externally live, Twicely has no connection
]);
```

### UNMANAGED

**Triggered by:**
- Lister subscription cancelled (`subscription.deleted` Stripe webhook for lister product)
- FREE teaser expires (nightly cron sets `listerTier = NONE`)
- Seller downgrades below the tier required for the platform

**Behavior:**
- Projection stays live on external platform — Twicely does NOT delist
- Scheduler skips UNMANAGED projections entirely (no PUBLISH, SYNC, POLL jobs)
- Seller loses crosslister dashboard visibility for these projections — they appear under a "Unmanaged Listings" section with a locked icon
- No sale detection. No sync. No polling. The seller is fully responsible.
- On resubscribe (upgrade back to LITE+): all UNMANAGED projections for that seller transition back to ACTIVE. Polling resumes. Scheduler picks them up.

**Seller-facing message on teaser expiry:**
> *"Your free crosslister period has ended. Your [N] listings on [platforms] are still live but are no longer managed by Twicely. You are responsible for managing those listings directly, including removing them if they sell. Upgrade to LITE to restore full management."*

**Double-sell on UNMANAGED is the seller's responsibility.** Twicely provided clear notice. The seller chose not to maintain a paid subscription.

### ORPHANED

**Triggered by:**
- Seller account enters deletion flow (30-day cooling off begins)

**Behavior:**
- Projection stays live on external platform — Twicely does NOT delist (we have no obligation to)
- CrosslisterAccount tokens revoked immediately
- All scheduler jobs for this seller cancelled
- No sale detection, no sync, no polling
- `orphanedAt` timestamp set — triggers 90-day hard delete clock
- After 90 days: `channel_projection` rows hard deleted
- Images follow account deletion image retention policy (entry #111)

**Reactivation during 30-day cooling off:**
- If seller reactivates account before deletion completes: ORPHANED projections → UNMANAGED (not auto-ACTIVE — subscription may have lapsed)
- Seller sees: *"Welcome back. Your [N] crosslisted listings are unmanaged. Resubscribe to LITE to restore management."*

### Subscription Downgrade Cascade (Critical Gap Fixed)

The Stripe webhook handler for `customer.subscription.deleted` must be updated:

```
IF product = 'crosslister_lite' OR product = 'crosslister_pro':
  SET sellerProfile.listerTier = 'NONE'
  SET all channel_projection WHERE sellerId = ? AND status = 'ACTIVE' → 'UNMANAGED'
  Cancel all PENDING/SCHEDULED crosslister jobs for this seller (except EMERGENCY_DELIST)
  Send seller notification: "Your crosslister subscription has ended..."
```

EMERGENCY_DELIST jobs are never cancelled — a sale is a sale regardless of subscription status.

### Account Deletion Order Check (Critical Gap Fixed)

The account deletion flow must check for blocking orders before proceeding:

**Deletion blocked if seller has:**
- Any order with status `PAID` and `shippedAt IS NULL` (paid but not shipped)
- Any order with status `SHIPPED` and `deliveredAt IS NULL` and `shippedAt > now() - 30 days` (shipped, not yet delivered, within normal delivery window)
- Any open `dispute` with status not in (`CLOSED`, `RESOLVED`, `WITHDRAWN`)
- Any open `return_request` with status not in (`COMPLETED`, `REJECTED`, `CANCELLED`)

**Deletion NOT blocked by:**
- Completed orders (delivered, no open dispute)
- External platform sales (not Twicely orders)
- Pending offers (no financial commitment)
- Unread messages

### Platform Disconnect Behavior (Critical Gap Fixed)

When a seller disconnects a specific platform account (e.g., removes their eBay connection):

**Old behavior (wrong):** projections "archived"
**New behavior:** projections → `UNMANAGED`

Tokens revoked. No delists triggered. Seller owns the eBay listing — Twicely just stops managing it. Seller sees: *"eBay disconnected. Your [N] eBay listings are still live but no longer managed by Twicely."*

### Resubscribe Reactivation Path

When seller upgrades from NONE → LITE or NONE → PRO:

```
SET sellerProfile.listerTier = 'LITE' (or 'PRO')
SET all channel_projection WHERE sellerId = ? AND status = 'UNMANAGED' → 'ACTIVE'
Schedule nextPollAt for all reactivated projections (use COLD tier as starting point)
Send seller notification: "Your crosslister is back. [N] listings are now being managed again."
```

This path does not exist today — it must be built as part of the subscription upgrade handler.

---

## 113. External Listing Dedup + Auto-Import of Unknown Projections

**Date:** 2026-03-08
**Status:** LOCKED
**Affects:** Lister Canonical §9 (Connector Registry), Lister Canonical §14 (Import Dedupe), Schema crosslister.ts

### The Problem

Two related issues in the same layer:

**Issue A — Duplicate projections on re-import:**
The current dedupe logic matches on `title + price + platform`. This is fuzzy and breaks when the same eBay listing is ingested via two paths — e.g., initial import AND a subsequent sync sweep picking up the same listing. The result is duplicate `channel_projection` rows for the same external listing.

**Issue B — Seller creates listing directly on external platform:**
A seller with an active crosslister subscription creates a new listing on the eBay app (not through Twicely). On the next sync, Twicely sees an eBay listing ID it has never encountered. The old approach was to prompt the seller: "We found a new listing — do you want us to manage it?" This breaks down at scale — a seller with 200 eBay listings who creates 10 directly on eBay sees 10 prompts on next sync. Prompts become noise. Sellers ignore them or get annoyed.

### The Decision

**Auto-import unknown external listings. No prompt. No confirmation required.**

When the sync sweep encounters an external listing ID that has no matching `channel_projection` row for that seller:
1. Auto-create the `channel_projection` row with `source = 'AUTO_DETECTED'`
2. Auto-import the listing to Twicely as an active listing
3. Start managing it immediately — polling, sync, sale detection
4. Surface it in the seller's crosslister dashboard with a `SOURCE: eBay (auto-imported)` badge

This is the "populate don't punish" philosophy applied to the crosslister. The seller signed up for Twicely to manage their external inventory. A listing they created directly on eBay is still their external inventory. Twicely absorbs it, puts it on the Twicely marketplace, and starts managing it. That is the product working as designed.

**The seller experience:** They open Twicely. The new eBay listing is already there. They didn't have to do anything.

### Hard Dedup Constraint (Issue A Fix)

Add a unique constraint on `channel_projection`:

```sql
ALTER TABLE channel_projection
  ADD CONSTRAINT uq_projection_external
  UNIQUE (seller_id, platform, external_listing_id);
```

And in the Drizzle schema:

```typescript
// In channel_projection table definition
}, (table) => ({
  externalUnique: uniqueIndex('uq_projection_external')
    .on(table.sellerId, table.platform, table.externalListingId),
}))
```

Any attempt to insert a duplicate `(sellerId, platform, externalListingId)` becomes an upsert:

```typescript
await db.insert(channelProjection)
  .values(projectionData)
  .onConflictDoUpdate({
    target: [
      channelProjection.sellerId,
      channelProjection.platform,
      channelProjection.externalListingId,
    ],
    set: {
      lastSyncedAt: sql`now()`,
      // update sync fields, never overwrite user edits
    },
  });
```

This single constraint fixes both Issue A (dedup) and Issue B (auto-import idempotency — re-running the sweep never creates duplicates).

### What Auto-Import Does NOT Do

- Does NOT prompt the seller
- Does NOT require seller confirmation
- Does NOT delist the external listing (it's already live, leave it)
- Does NOT apply to UNMANAGED or ORPHANED sellers — auto-import only runs for sellers with an active LITE+ subscription

### Reconciliation Gap #10 — Closed

A seller sells an item externally, then relists it as a new external listing with a new ID. The old projection with the old ID is `SOLD` or `ENDED` — clean. The new external ID has no `channel_projection` row. On the next sync sweep, auto-import picks it up and creates a fresh projection. No manual review needed. A new external ID is by definition a new listing — there is nothing to reconcile.

---

---

## 114. Local Reliability System — No Monetary Penalties

**Date:** 2026-03-10
**Status:** LOCKED
**Supersedes:** Local Canonical §7 (No-Show Penalties), `commerce.local.noShowFeeCents`
**Related:** Decision #42 (Local Transaction Fee Model)

### The Problem

The original spec charged $5 to the no-show party, paid to the other as compensation. The intent was fairness — buyer drives to a meetup, seller doesn't show, buyer deserves something for their time. Reasonable in isolation.

The problem is context. Twicely Local competes with Facebook Marketplace and Craigslist — both zero fee, zero friction, zero penalties. Sellers and buyers don't have to use Twicely for local transactions. The moment Twicely deducts money from a seller's payout because a meetup failed, the rational response is to take the next transaction off-platform entirely. "Meet me at Starbucks, pay cash, skip the app." Twicely loses the 5% local fee AND the relationship. The $5 penalty costs Twicely more than it recovers.

### The Decision

**Drop all monetary penalties for meetup failures. Replace with a Local Reliability Score.**

Zero financial consequences for cancellations, no-shows, or late responses. The only exception is escrow fraud — selling an item after escrow is captured is theft, not a reliability failure. Hard consequences stay for fraud (see Decision #115 scope).

### Local Reliability Score

A separate trust axis, independent of the standard buyer/seller star rating. Visible to both parties on the meetup screen before confirming.

**Display tiers:**
```
🟢 Reliable     — X local meetups, Y% completion rate
⚠️ Inconsistent — cancellations in last 90 days
🔴 Unreliable   — multiple no-shows, proceed with caution
```

Buyers see seller's score. Sellers see buyer's score. Both have accountability without financial friction.

### Reliability Marks

| Behavior | Marks | Who |
|----------|-------|-----|
| Cancel 24hr+ before scheduled time | 0 | Either — life happens |
| Cancel under 24hr before | -1 | Either |
| Cancel same day under 2hr | -2 | Either |
| No-show | -3 | Either |
| Seller dark on meetup day (no response to day-of confirmation within 2hr) | -1 | Seller |
| Reschedule more than twice on same transaction | -1 | Either |

### Suspension Threshold

```
commerce.local.suspensionMarkThreshold: 9   (9 marks in 90 days → local suspended)
commerce.local.suspensionDays: 90
commerce.local.markDecayDays: 180           (marks older than 180 days stop counting)
```

Suspension is access removal, not a financial penalty. Suspended users can still use shipped transactions. 9-mark threshold differentiates genuine bad actors (3 no-shows = 9 marks) from people who cancel politely (3 graceful cancellations = 0 marks).

### Refund Policy

Full refund always, regardless of who cancelled or why, regardless of timing. Buyer never loses money. The escrow exists precisely for this protection. No partial refunds, no cancellation fees, no restocking on local transactions.

### Schema

**New table: `local_reliability_event`**
```typescript
{
  id:            text primaryKey
  userId:        text → user.id
  transactionId: text → localTransaction.id
  eventType:     enum (see below)
  marksApplied:  integer
  decaysAt:      timestamp  // createdAt + markDecayDays
  createdAt:     timestamp
}

eventType enum:
'BUYER_CANCEL_GRACEFUL' | 'BUYER_CANCEL_LATE' | 'BUYER_CANCEL_SAMEDAY'
'BUYER_NOSHOW' | 'SELLER_CANCEL_GRACEFUL' | 'SELLER_CANCEL_LATE'
'SELLER_CANCEL_SAMEDAY' | 'SELLER_NOSHOW' | 'SELLER_DARK' | 'RESCHEDULE_EXCESS'
```

**New fields on `user`:**
```typescript
localReliabilityMarks:  integer   // rolling active marks within decay window
localTransactionCount:  integer   // total completed local transactions
localCompletionRate:    real      // completed / total attempted
localSuspendedUntil:    timestamp // null if not suspended
```

### Platform Settings Deprecated

- `commerce.local.noShowFeeCents` — removed
- `commerce.local.noShowStrikeLimit` — removed

### Platform Settings Added

- `commerce.local.suspensionMarkThreshold: 9`
- `commerce.local.suspensionDays: 90`
- `commerce.local.markDecayDays: 180`

### Impact on G2.3 (Already Built)

`local-noshow-strikes.ts` → remove fee charge logic, replace with reliability mark posting.
`local-noshow-check.ts` → remove `noShowFeeCents` deduction.
Both files are targeted changes only, no structural rebuild required.

### Why This Is Better Than Fees

A seller with a 60% local completion rate listed on Twicely is better for Twicely than a seller who left for Facebook because they got hit with a $5 deduction. The reliability rating does the same accountability job socially — a seller with a poor reliability score struggles to get buyers to commit to meetups. That's a stronger long-term consequence than $5, and it keeps the seller in the ecosystem where future transactions generate 5% local fee revenue.

---

## 115. Twicely Local Is a Fulfillment Option, Not a Product

**Date:** 2026-03-10
**Status:** LOCKED
**Related:** Local Canonical §1, §2, Decision #73

### The Decision

Twicely Local is not a separate app, separate mode, separate signup, or separate product. It is a **fulfillment option on a listing** — the same as selecting a shipping carrier. Every Twicely user already has access to it. No upgrade required, no separate onboarding, no feature gate.

### The Entry Point

`listing.fulfillmentType` is the entire entry point:

```
'SHIP_ONLY'      — standard shipped transaction. Local never activates.
'LOCAL_ONLY'     — meetup only. localTransaction always created at checkout.
'SHIP_AND_LOCAL' — buyer chooses at checkout. localTransaction created only if buyer selects local.
```

The entire Twicely.Local infrastructure — escrow, QR codes, dual tokens, reliability scores, safe meetup spots, safety timers — activates automatically when a buyer selects local pickup at checkout on an eligible listing. Neither party "uses Twicely Local" as a conscious product decision. They just buy and sell things nearby.

### Seller Setup

At `/my/selling/settings/local`:
- Default fulfillment preference
- Max meetup distance (default 25 miles, max 50 miles)
- Preferred pickup address or safe meetup spot selection

One address required for distance calculation. If seller enables local pickup with no address saved, they are prompted to add one before the listing activates. That is the complete onboarding for Twicely Local.

### Buyer Experience

Buyer browses normally. Listing shows "📍 Local Pickup Available — 3.2 mi away" badge. Buyer adds to cart, selects local pickup at checkout. The escrow, QR, and meetup coordination activate transparently. Buyer never thinks about "local" as a feature — they just bought something nearby.

### Listing Gate (Only Gate)

Seller must have a saved address with geocoded coordinates for distance filtering to work. No tier gate, no subscription gate, no approval process. Available to all sellers — PERSONAL and BUSINESS — on all listing types.

### Why This Matters Architecturally

- No separate route namespace for "local" listings — they live at `/i/{slug}` like all listings
- No separate order type — `order.isLocalPickup: boolean` is the only branch
- No separate user role — any user can be a local buyer or seller
- Local transactions share the same ledger, same CASL rules, same Financial Center reporting
- The feature scales automatically as sellers add addresses and enable local pickup

---

## 116. Twicely Local Monetization — Cash Is Top of Funnel

**Date:** 2026-03-10
**Status:** LOCKED
**Related:** Decision #42 (Local Transaction Fee Model), Decision #114 (No Monetary Penalties)

### The Problem

When a buyer pays cash at the meetup, Twicely has zero financial involvement. No Stripe, no escrow, no payment processing. Direct monetization on cash transactions is unenforceable and dishonest — Twicely didn't process the payment and can't charge a fee on it.

### The Decision

**Cash local transactions are a free acquisition channel, not a revenue line.** Twicely does not attempt to monetize cash transactions directly. The goal for cash transactions is to make the experience good enough that both parties return and use escrow next time.

### How Twicely Makes Money on Local

| Source | When | Amount |
|--------|------|--------|
| 5% local fee | Buyer pays via escrow | 5% of transaction |
| Boosting | Seller promotes local listing | 1-8% seller-set |
| Insertion fees | Seller exceeds tier listing limit | Per canonical rates |
| Lister/Store subscription | Seller is already subscribed | Monthly recurring |
| TF on future shipped orders | Buyer/seller returns for shipped transaction | 8-11% progressive |

### The Cash Conversion Nudge

Cash transactions logged in seller's Financial Center display:

```
Cash sale — $140.00
⚠️ Not covered by Twicely Buyer Protection
Tip: Use in-app payment next time to protect both parties
```

This is education, not a penalty. Over time sellers who start with cash migrate to escrow because buyers request the protection. No forced conversion, no friction.

### What Twicely Does NOT Do

- Charge a listing fee specifically for local listings
- Take a percentage of logged cash sales
- Gate local pickup behind a paid subscription tier
- Penalize sellers for cash transactions

### Why Free Cash Transactions Are Strategic

OfferUp attempted to force in-app payments and sellers migrated to Facebook Marketplace. The cash option being genuinely free is what keeps sellers logging transactions at all. A logged cash transaction means:
- Seller stays in the Twicely ecosystem
- Transaction appears in seller analytics and Financial Center
- Buyer is now a Twicely account holder available for future shipped purchases
- Both parties experience the Twicely platform and are candidates for the 5% escrow flow next time

The local cash transaction is a free customer acquisition event. The 5% escrow, boosting, subscriptions, and TF on shipped orders are where the revenue lives.

---

## 117. Meetup Time Picker — Minimal Structured Scheduling

**Date:** 2026-03-10
**Status:** LOCKED
**Builds in:** G2.9

### The Problem

`localTransaction.scheduledAt` was set at checkout with no mechanism for how it actually gets a value. Every time-dependent feature in Twicely Local — 24hr reminders, 1hr reminders, no-show detection, auto-cancel, day-of confirmation window — anchors to `scheduledAt`. Without a structured way to set it, the entire safety and notification infrastructure has nothing to key off.

Free-form messaging was the original coordination mechanism. That works socially but leaves `scheduledAt` null indefinitely, meaning BullMQ jobs never enqueue and the auto-cancel fires off a meaningless placeholder value.

### The Decision

Minimal structured time picker inside the order screen. Either party proposes a date and time. The other accepts or counters. Once both parties agree, `scheduledAt` is set and all time-dependent jobs enqueue.

### Why Minimal (Option 1) Over Full Scheduling System (Option 3)

A full availability-based scheduling system is post-launch scope. What's needed at launch is simply a confirmed timestamp in the database so the existing safety infrastructure works correctly. A date picker + accept/counter flow achieves this with minimal build effort and no new architectural concepts.

### Key Rules

- Check-in button locked until `scheduledAt` confirmed by both parties
- No proposal limit during initial scheduling (unlike reschedule which caps at 2)
- Minimum lead time: 1 hour from now. Maximum: 30 days out.
- Any change after confirmation routes through Reschedule Flow (A7/G2.10), not back to time picker
- If `scheduledAt` still null 24hr after checkout — nudge notification to both parties

### New Platform Setting

`commerce.local.scheduleReminderHours: 24` — hours after checkout before nudging unscheduled transactions

---

## 118. Twicely SafeTrade — Complete Local Escrow Model

**Date:** 2026-03-10
**Status:** LOCKED
**Supersedes:** Decision #42 (Local Transaction Fee Model), Local Canonical §8 (Payment Options)
**Related:** Decision #114 (Reliability System), Decision #116 (Cash Monetization)

---

### The Name

The feature is called **SafeTrade**. Not "escrow." True escrow is a regulated financial service requiring a license in most US states. Twicely is using Stripe Connect's payment timing — collecting funds, holding on the platform account, releasing on QR confirmation. That is a marketplace payment hold, not licensed escrow.

**UI language:** "SafeTrade", "SafeTrade Fee", "SafeTrade Required", "SafeTrade Available"
**Legal language (ToS):** "payment processing and platform protection fee"
**Never say:** "escrow fee", "escrow service", "escrow agent"

SafeTrade is a trademark-able brand asset. Get legal confirmation before launch.

---

### What SafeTrade Is

SafeTrade is a mutual commitment mechanism for local transactions. It is not primarily buyer protection — it is a **serious buyer signal to the seller**. When a buyer activates SafeTrade, they are saying: "I have the funds, I am committed, I will not waste your time." The Stripe hold is a deposit of intent.

The 20% of power sellers who require it will love it. They have been burned by tire-kickers on Facebook Marketplace and OfferUp. SafeTrade is the only mechanism in any local marketplace that lets a seller require proof of commitment before agreeing to meet.

---

### Three Seller States

| State | Badge | Buyer Experience at Checkout |
|-------|-------|------------------------------|
| **SafeTrade Required** | `📍 Local · SafeTrade Required` | No choice — SafeTrade is mandatory |
| **SafeTrade Available** (default) | `📍 Local · SafeTrade Available` | Buyer chooses: SafeTrade or Cash |
| **Cash Only** | `📍 Local · Cash Only` | No SafeTrade option shown |

Set per listing or as a default in `/my/selling/settings/local`.

---

### The SafeTrade Fee

Stripe charges Twicely **2.9% + $0.30** on every captured payment. The SafeTrade Fee is Twicely recovering that cost from the parties who activated SafeTrade.

**Fee formula:** `(itemPriceCents × 0.029) + 30` cents

On a $200 item: **$6.10**

Both parties pay the SafeTrade Fee at the moment escrow is activated — regardless of who requested it. This is the deterrent. Neither party can ghost for free.

- **Seller's card on file:** Charged immediately at escrow creation
- **Buyer's card:** Included in the auth hold (`item price + SafeTrade Fee`)

---

### Three Scenarios

---

#### S1 — Seller Requires SafeTrade

Seller required it — seller absorbs their SafeTrade Fee as cost of the requirement.

**At escrow creation:**
```
Seller's card charged:          $6.10  (SafeTrade Fee — immediate)
Buyer's auth hold placed:      $206.10 ($200 item + $6.10 SafeTrade Fee bundled)
```

**At sale completion:**
```
Stripe captures buyer's $206.10
Stripe bills Twicely:                    -$6.28 (2.9% × $206.10 + $0.30)
Seller SafeTrade already collected:      +$6.10
Stripe net cost to Twicely:              -$0.18

TF (9% on $200):                        +$18.00
Twicely total:                          +$23.44 (after all Stripe costs)

Seller receives: $200 - $18 TF =        $182.00
```

**If buyer renigs:**
```
Partial capture from auth hold:          $6.10  (buyer's SafeTrade Fee kept)
Release remaining:                      $200.00 (item price returned to buyer)
Stripe fee on $6.10 capture:            -$0.48
Twicely nets:                            $5.62

Seller's $6.10 SafeTrade refunded in full
Reliability mark on buyer
```

**If seller renigs:**
```
Full auth hold released to buyer:       $206.10 (FREE — hold released, not captured)
Seller's $6.10 SafeTrade forfeited — Twicely keeps it
Stripe fee on seller's original charge: -$0.48 (already paid at creation, not recovered)
Twicely nets:                            $5.62
Reliability mark on seller
```

---

#### S2 — Buyer Requests SafeTrade (Seller Available or Default)

Buyer chose it — same mechanics. Both still pay.

**At escrow creation:**
```
Seller's card charged:          $6.10  (SafeTrade Fee — both always pay)
Buyer's auth hold placed:      $206.10
```

Settlement, fault outcomes: identical to S1.

**Key rule:** "Buyer requested vs seller required" only determines who initiated. Both parties pay the moment SafeTrade is active. No exceptions. A seller who accepts SafeTrade has skin in the game too — this is what prevents seller ghosting on buyer-requested SafeTrade.

---

#### S3 — Cash / Off-Platform

Pure FBMP. No Stripe. No SafeTrade. No fees. No infrastructure.

```
Buyer messages seller — they coordinate independently
Seller marks complete manually
Financial Center logs: Cash sale — $X.XX
⚠️ Not covered by Twicely Buyer Protection
```

Twicely makes $0. This is acquisition, not revenue.

---

### Complete Fee Math — All Outcomes

$200 item, 9% TF, SafeTrade Fee $6.10.

| Outcome | Stripe Cost | SafeTrade Collected | TF | Twicely Total |
|---------|-------------|--------------------|----|---------------|
| Sale completes | $6.76 | $12.20 (both) | $18.00 | **+$23.44** |
| Buyer renigs | $0.96 | $6.10 (buyer forfeits) | $0 | **+$5.14** |
| Seller renigs | $0.48 | $6.10 (seller forfeits) | $0 | **+$5.62** |
| No fault expiry | $0.48 | $0 (both refunded) | $0 | **-$0.48** |

---

### No-Fault Expiry — The Only Loss Scenario

Auth hold expires after 7 days (6-day meetup cap + 1-day buffer). If neither party is at fault — both SafeTrade fees refunded. Twicely eats $0.48 in Stripe fees.

**Decision:** Accept the $0.48 loss on no-fault expiry (Option B). The 6-day meetup cap and time picker requirement minimize expiry frequency. Revisit only if expiry rate climbs above 5% of SafeTrade transactions.

Monitor via: `local.safetradeExpiredCount` and `local.safetradeExpiredCostMtd` in platform metrics.

---

### Auth Hold — Why Not a Charge

Charging the SafeTrade Fee as a separate immediate charge creates double Stripe fees:

```
Stripe charges on the $6.10 SafeTrade charge:   $0.48
Stripe charges on the $200 capture:             $6.10
Total Stripe cost:                              $6.58
SafeTrade collected:                            $6.10
Twicely shortfall:                             -$0.48 per completed transaction
```

Bundling the SafeTrade Fee into the auth hold means one Stripe interaction at capture. Clean, no double billing.

**Buyer sees at checkout:**
```
Item price:      $200.00  → released if cancelled
SafeTrade Fee:     $6.10  → kept if you cancel
─────────────────────────
Auth hold:       $206.10
```

---

### TF for Local Escrow

**Same as shipped orders. Category-based. No local discount.**

`LOCAL_ONLY` and `SHIP_AND_LOCAL` (local selected) use the same `feeBucket` TF rate as shipped orders (9-11.5%). The 5% local rate is deprecated entirely.

Rationale: the full SafeTrade infrastructure — dual-token QR, BullMQ jobs, Centrifugo channels, dispute resolution, fraud detection — is not cheaper to operate than a shipped order. Charging less for more infrastructure was wrong. The feature set justifies the same rate.

`commerce.local.transactionFeePercent: 5.0` — **DEPRECATED. Remove from seed and platform settings.**

---

### Gaming Prevention

Same TF as shipped orders eliminates the entire arbitrage incentive. A seller cannot reduce their fee burden by routing shipped transactions through fake local orders. The financial incentive to game is zero.

Remaining guard: hard block on Shippo label purchase for `order.isLocalPickup === true`. Single line in the label purchase action. Not for arbitrage prevention — for order integrity.

---

### Seller Requirements for SafeTrade

Seller must have a valid card on file to enable SafeTrade (Required or Available). Without a card on file, SafeTrade options are hidden on their listings. Prompt at listing creation if they attempt to enable SafeTrade without a card saved.

---

### What SafeTrade Unlocks (Full Suite)

SafeTrade activates the entire Twicely Local infrastructure. Cash (S3) gets none of it.

| Feature | SafeTrade | Cash |
|---------|-----------|------|
| Meetup map (Leaflet + OSM) | ✅ | ❌ |
| Meetup time picker | ✅ | ❌ |
| Safe meetup spots | ✅ | ❌ |
| Check-in | ✅ | ❌ |
| Safety timer + escalation | ✅ | ❌ |
| No-show detection | ✅ | ❌ |
| Day-of confirmation | ✅ | ❌ |
| Reminders (24hr + 1hr) | ✅ | ❌ |
| QR + dual-token Ed25519 | ✅ | ❌ |
| Offline mode | ✅ | ❌ |
| Price adjustment flow | ✅ | ❌ |
| Meetup photo evidence | ✅ | ❌ |
| Listing auto-reserve | ✅ | ❌ |
| Escrow fraud detection | ✅ | ❌ |
| Buyer protection claims | ✅ | ❌ |
| Large item flags | ✅ | ❌ |
| Full Financial Center breakdown | ✅ | ❌ |
| Reliability score tracking | ✅ | ✅ |
| In-app messaging | ✅ | ✅ |

---

### Platform Settings — Final Local Set

```
# SafeTrade
commerce.local.safeTradeEnabled: true
commerce.local.escrowMaxDays: 6
commerce.local.authHoldExpiryDays: 7
commerce.local.noFaultExpiryRefund: true
commerce.local.safeTradeExpiryThresholdPercent: 5  (alert if expiry rate exceeds this)

# TF — local uses category feeBucket, no separate setting
# commerce.local.transactionFeePercent  → DEPRECATED, REMOVE

# Reliability
commerce.local.suspensionMarkThreshold: 9
commerce.local.suspensionDays: 90
commerce.local.markDecayDays: 180

# Scheduling
commerce.local.escrowMaxDays: 6
commerce.local.dayOfConfirmationWindowHours: 12
commerce.local.dayOfConfirmationResponseHours: 2
commerce.local.rescheduleMaxCount: 2
commerce.local.scheduleReminderHours: 24
commerce.local.maxAdjustmentPercent: 33

# Safety
commerce.local.safetyNudgeMinutes: 30
commerce.local.safetyEscalationMinutes: 15
commerce.local.meetupAutoCancelMinutes: 30
commerce.local.offlineGraceHours: 2
commerce.local.claimWindowDays: 7

# Tokens
commerce.local.preloadTokensOnEscrow: true
commerce.local.offlineModeEnabled: true
commerce.local.tokenExpiryHours: 48

# DEPRECATED — REMOVE FROM SEED
# commerce.local.transactionFeePercent
# commerce.local.noShowFeeCents
# commerce.local.noShowStrikeLimit
```

---

### Ledger Entries

| Event | Entry Type | Debit | Credit |
|-------|-----------|-------|--------|
| SafeTrade fee charged — seller | `LOCAL_SAFETRADE_FEE_SELLER` | Seller | Twicely |
| SafeTrade fee captured — buyer | `LOCAL_SAFETRADE_FEE_BUYER` | Buyer | Twicely |
| Sale completes | `LOCAL_SALE` | Buyer auth hold | Seller |
| TF deducted | `LOCAL_TF` | Seller | Twicely |
| Buyer renigs — fee forfeited | `LOCAL_SAFETRADE_FORFEITED_BUYER` | Buyer | Twicely |
| Seller renigs — fee forfeited | `LOCAL_SAFETRADE_FORFEITED_SELLER` | Seller | Twicely |
| No fault expiry — both refunded | `LOCAL_SAFETRADE_REFUND` | Twicely | Both |
| Buyer protection refund | `LOCAL_FRAUD_REVERSAL` | Twicely | Buyer |

---

## 119. Implicit Nonce via confirmedAt — No Separate Table

**Date:** 2026-03-11
**Status:** LOCKED
**Builds in:** G2.7 (Dual-Token Ed25519 + Offline Mode)
**Related:** Decision #41 (QR Code Escrow for Local Pickup), Decision #118 (Twicely SafeTrade)

### The Problem

Ed25519-signed QR tokens prevent tampering, but token replay attacks are possible if a confirmation code is captured and reused. Preventing replay requires a nonce — a unique-per-use value. Two options existed:

1. **Separate nonce table:** create `escrowCodeNonce(escrowCodeId, nonce, usedAt)` to track which codes have been confirmed
2. **Implicit nonce via confirmedAt:** use the `confirmedAt` timestamp on the `localTransaction` record as the implicit nonce

### The Decision

**Use implicit nonce via confirmedAt. No separate table.**

When a buyer or seller scans their QR code and confirms, the `localTransaction.confirmedAt` field is set. On any subsequent scan attempt with the same token, the system checks:
1. Does a `localTransaction` with this buyer/seller/listing combo exist?
2. Is `confirmedAt` already set (not null)?
3. If yes to both: reject the confirmation as "already confirmed" — the code has been used

This uses the existing schema without adding a nonce table.

### Why This Is Better Than a Separate Nonce Table

- **No new table:** Reduces schema complexity. The `localTransaction` table is the source of truth for escrow state.
- **No additional queries:** Checking `confirmedAt` is part of the existing ledger lookup. No extra round-trip to a nonce table.
- **Temporal ordering is automatic:** `confirmedAt` is a timestamp. If someone tries to use the same code twice, the second attempt will always see `confirmedAt` already set to the first scan's timestamp. This naturally orders events.
- **Ledger alignment:** The ledger system (immutable, append-only) already records confirmation events as entries with their own timestamps. The `confirmedAt` timestamp must match the ledger entry timestamp for the confirmation to be valid.

### Edge Cases Handled

- **Buyer confirms, seller tries to confirm same code:** Buyer's `confirmedAt` is set. Seller's scan sees `confirmedAt != null`, rejected.
- **Network retry on same scan:** If the buyer scans, the system processes the confirmation and sets `confirmedAt`, but the response is lost and the user rescans the same QR code, the second attempt finds `confirmedAt` already set and rejects gracefully.
- **Token expiry:** Each token has a 48-hour TTL (`commerce.local.tokenExpiryHours: 48`). The nonce check happens during the scope of that TTL. Expired tokens are invalid regardless of `confirmedAt` state.

### Why Not a Separate Nonce Table

- Adds operational complexity: now there are two places that record whether a code was used (nonce table + ledger)
- Requires cleanup: stale nonces for expired codes must be garbage-collected; `confirmedAt` needs no cleanup because it's already on the transaction
- Query cost: a separate lookup is slower than checking a field on an already-fetched row

---

## 120. Local Reliability Display Tiers — Owner-Confirmed Thresholds

**Date:** 2026-03-11
**Status:** LOCKED
**Builds in:** G2.8 (Local Reliability System)
**Related:** Decision #114 (Local Reliability System — No Monetary Penalties)

### The Display Thresholds

Reliability score is displayed to buyers and sellers on the meetup confirmation screen using three color-coded tiers:

```
🟢 RELIABLE      — 0 to 2 marks
⚠️  INCONSISTENT — 3 to 8 marks
🔴 UNRELIABLE    — 9+ marks (suspension possible)
```

### Owner-Confirmed Logic

The tier thresholds are derived from the suspension behavior:

- **One no-show = 3 marks** → immediately moves a user to INCONSISTENT
- **Three no-shows = 9 marks** → triggers suspension, bumps to UNRELIABLE
- **Graceful cancellations (24+ hours before) = 0 marks** → user stays RELIABLE even after many cancellations

A user who cancels politely dozens of times remains in the RELIABLE tier. A user with a single no-show drops to INCONSISTENT. Three confirmed failures push to UNRELIABLE and suspension.

### Buyer Protection

Buyers always see the seller's reliability tier before confirming a meetup. Sellers always see the buyer's reliability tier. This information asymmetry is eliminated — both parties have full visibility into each other's reliability history.

### Mark Decay

All marks decay after 180 days (`commerce.local.markDecayDays: 180`). A user who had a single no-show 6 months ago returns to RELIABLE if no new marks have accrued. This prevents permanent scarring from a single incident in the past.

### Implementation in G2.8

- New table: `local_reliability_event` — 10 event types, marks applied, decay timestamp
- New fields on `user`: `localReliabilityMarks`, `localTransactionCount`, `localCompletionRate`, `localSuspendedUntil`
- Helper function: `calculateReliabilityTier(userId)` — sums active marks, checks decay, returns RELIABLE | INCONSISTENT | UNRELIABLE
- Display logic on meetup confirmation screen: render tier badge, fetch seller/buyer profiles, show mark count and decay date
- Platform settings: suspension threshold (9 marks), suspension window (90 days), decay window (180 days)

---

## 121. Pre-Meetup Cancellation — canceledByParty Text Field, Not Enum

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.11 (Pre-Meetup Cancellation Flow)
**Related:** Decision #114 (Local Reliability System), Decision #119 (Implicit Nonce via confirmedAt)

### The Problem

When either buyer or seller cancels a scheduled meetup before meeting (while in CONFIRMED or SCHEDULED status), the system needs to:
1. Track WHO cancelled (buyer or seller)
2. Apply the correct reliability marks (0/−1/−2/−3 depending on time until meetup)
3. Release the Stripe hold, reactivate the listing, and clean up any BullMQ reminder jobs
4. Track the cancellation reason for dispute/moderation

The state machine design question: should `canceledByParty` be an enum with values like `CANCELED_BY_BUYER` / `CANCELED_BY_SELLER`, or a text field?

### Options Considered

**Option A: New enum values in localTransactionStatus**
```
enum localTransactionStatus = 'CONFIRMED' | 'SCHEDULED' | 'CANCELED_BY_BUYER' | 'CANCELED_BY_SELLER' | ...
```
Problem: This couples the state machine to every permutation of WHO cancelled. If we add a new reason (e.g., CANCELED_DUE_TO_WEATHER), we have to modify the enum. The state machine becomes a description of every possible cancellation variant.

**Option B: Keep CANCELED as single terminal status + canceledByParty text field**
```
enum localTransactionStatus = 'CONFIRMED' | 'SCHEDULED' | ... | 'CANCELED'
column canceledByParty: text (values: 'BUYER' | 'SELLER')
column cancelReason: text (e.g., 'COULDN_T_MAKE_IT', 'ITEM_SOLD', 'SAFETY_CONCERN')
```

### The Decision

**Use Option B: Keep CANCELED as a single terminal status on localTransaction. Store WHO cancelled in a separate `canceledByParty` text field (not an enum).**

### Why This Design Wins

**1. State machine remains pure.** The state machine only cares about who confirmed, who can act next, and whether the transaction is terminal. `CANCELED` is terminal. The reason and actor are metadata, not state.

**2. Flexibility for new cancellation types.** If we discover that cancellations due to weather, safety concerns, or seller item-sold events need special handling, we add a `cancelReason` field without touching the status enum.

**3. User-facing restrictions are in the action layer, not the state machine.** The rule "you cannot cancel if both parties are CHECKED_IN" is a business rule enforced in `cancelMeetupAction()`, not a state constraint. This keeps concerns separated.

**4. Simpler queries.** Fetching "all canceled meetups" is `WHERE status = 'CANCELED'`. Counting "cancellations by buyer" is `WHERE status = 'CANCELED' AND canceledByParty = 'BUYER'`. No enum explosion.

**5. Reliability marks logic stays clean.** The mark calculation (−1 for late cancel, −2 for same-day, 0 for graceful) depends on `(now - scheduledAt)`, not on status values. A text field for `canceledByParty` doesn't complicate the mark engine.

### Implementation in G2.11

- Existing `localTransaction` table has `CANCELED` as terminal status value
- Two new nullable columns:
  - `canceledByParty: text` — 'BUYER' or 'SELLER' (only set if status = 'CANCELED')
  - `cancelReason: text` — optional reason for moderation (e.g., 'ITEM_SOLD', 'SAFETY_CONCERN', 'COULDNT_MAKE_IT')
- `cancelMeetupAction()` checks preconditions: not already COMPLETED, not already CANCELED, not CHECKED_IN for both parties
- On cancel, system applies reliability marks based on `(now - scheduledAt)` thresholds
- Stripe hold released, listing re-activated, reminder jobs cleaned up (BullMQ)
- `CancelMeetupButton` component shows "Cancel meetup?" dialog with optional reason selector

### Why Not Text — Why Not a New Enum?

A true enum (`enum CanceledByParty = BUYER | SELLER`) would be enforced at schema validation time. But since we may add `ADMIN` cancellations in the future (dispute resolution forces a cancel), a text field is more forward-compatible. We can always add validation in the app layer (Zod) without schema migrations.

---

## 122. Day-of Confirmation as Column-State, Not Status Enum

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.12 (Day-of Confirmation Request)
**Related:** Decision #121 (Pre-Meetup Cancellation)

### The Problem

Within 12 hours before a scheduled local meetup, the buyer sends a "Are we still on?" confirmation request. The seller must respond within 2 hours with one of three actions:
1. Confirm the meetup is still happening
2. Propose a reschedule (RESCHEDULE_PENDING status)
3. Do nothing (2-hour timeout fires SELLER_DARK mark)

Should this flow create new status enum values like `DAY_OF_CONFIRMATION_PENDING`, or should it be tracked via column state (like Decision #121)?

### The Decision

**Use Option B: Column-based state, like pre-meetup cancellation.** Track the day-of confirmation via three nullable columns on localTransaction:
- `dayOfConfirmationSentAt: timestamp with time zone` — when buyer sent the confirmation request
- `dayOfConfirmationRespondedAt: timestamp with time zone` — when seller responded (confirm or reschedule)
- `dayOfConfirmationExpired: boolean` — true if 2-hour timeout fired without response

The transaction **stays in its current status** (CONFIRMED or SCHEDULED) throughout the flow. The day-of confirmation is metadata, not a state transition.

### Why This Design Wins

**1. Status remains clean.** CONFIRMED and SCHEDULED are meaningful states. A 12-hour pre-meetup check is a notification, not a state change. Mixing them in the status enum creates combinatorial explosion (CONFIRMED_WITH_PENDING_DOC, SCHEDULED_WITH_PENDING_DOC, etc.).

**2. Mirrors the cancellation pattern.** Decision #121 established that WHO did something (buyer vs seller, confirmed vs canceled) is metadata, not state. Day-of confirmation follows the same principle: WHAT happened (confirmation pending/responded/expired) is column data.

**3. Simpler queries.** Fetching "all active transactions awaiting day-of confirmation" is `WHERE dayOfConfirmationSentAt IS NOT NULL AND dayOfConfirmationRespondedAt IS NULL`. No enum value needed.

**4. Extensible for future confirmation types.** If we add "3-day pre-meetup courtesy check" or "post-delivery verification," we reuse the same pattern without enum sprawl.

---

## 123. SELLER_DARK Mark: Option A Minimal Escalation

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.12 (Day-of Confirmation Request)
**Related:** Decision #114 (Local Reliability System), Decision #120 (Display Tiers)

### The Problem

When a seller doesn't respond to the buyer's day-of confirmation request within the 2-hour timeout window, the system must apply reliability marks. Two options exist:

**Option A (Minimal Escalation):** Apply a single SELLER_DARK mark (−1) immediately on timeout. The separate no-show detection runs on its own 30-minute schedule post-meetup time and may apply additional marks.

**Option B (Aggressive Escalation):** Apply the full no-show chain immediately (−3 for no-show, potentially −4 total if combined with SELLER_DARK).

### The Decision

**Use Option A: Apply SELLER_DARK mark (−1) immediately on timeout. Let the normal no-show detection (Decision #114) run separately on its schedule.**

### Why This Design Wins

**1. Timeout enforcement is immediate and clear.** A seller who ignores the day-of confirmation gets a mark right away. This is a fast feedback loop: "You didn't respond to the confirmation request → you get marked."

**2. No-show detection remains independent.** The 30-minute post-meetup timer doesn't know about the day-of timeout. If the meetup actually happens (seller shows up at location 2:01 PM after timeout), the system doesn't double-mark. The seller has already paid the −1 for not confirming, which is fair.

**3. Combined marks accurately reflect behavior.** A truly bad actor (ignored day-of + didn't show) gets −4 total (−1 SELLER_DARK + −3 no-show), which correctly escalates them from INCONSISTENT (3–8 marks) toward UNRELIABLE (9+). The doubling happens naturally, not via special escalation logic.

**4. Prevents aggressive over-marking.** If we aggressively applied the full no-show chain on timeout, a seller with a dead phone battery could get −4 marks before we even know if they no-show. By separating concerns, we let reality (did they actually meet?) determine the final outcome.

---

## 124. Reschedule Counts as Valid Day-of Confirmation Response

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.12 (Day-of Confirmation Request)
**Related:** Decision #123 (SELLER_DARK Mark), Decision #10 (Pre-Meetup Cancellation)

### The Problem

A seller's response to the day-of confirmation request can be:
1. "Yes, I'm coming" (confirmMeetupAction)
2. "Let's reschedule instead" (proposeRescheduleAction)
3. Silence (2-hour timeout → SELLER_DARK mark)

Should option 2 (reschedule proposal) count as a valid day-of confirmation response, or should it be treated as "no response, timeout fires"?

### The Decision

**Reschedule PENDING counts as a valid day-of confirmation response. The timeout worker checks if status = RESCHEDULE_PENDING and does NOT apply the SELLER_DARK mark.**

### Why This Design Wins

**1. Seller engagement is rewarded.** A seller who actively proposes a reschedule (even if buyer declines it) has shown they care about the meetup. Punishing them with SELLER_DARK is wrong. Decision #123 applies the mark to unresponsive sellers; a reschedule proposal proves responsiveness.

**2. Prevents gaming the timeout.** If rescheduling didn't count, a lazy seller could propose a reschedule just before the 2-hour window closes, then propose another reschedule, indefinitely delaying the decision. By counting the proposal as a valid response (triggering dayOfConfirmationRespondedAt), we move the buyer-side decision to accept/decline into the buyer's hands. Seller's obligation is discharged.

**3. Encourages flexibility.** The day-of confirmation flow exists to catch dead-beats. A seller who says "yes, but different time" is still engaged. They're not a dead-beat; they're accommodating. Mark them accordingly.

**4. Simplifies the confirmation timer logic.** The timeout worker has a single rule: if dayOfConfirmationRespondedAt IS NOT NULL, do nothing. If NULL, fire the mark. A reschedule proposal sets dayOfConfirmationRespondedAt, so the logic is clean.

---

## 125. Meetup Reminder Intervals — Hardcoded Constants, Not Admin-Configurable

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.13 (Meetup Reminder Notifications)
**Related:** Decision #117 (Meetup Time Picker)

### The Problem

Meetup reminders must be sent at specific intervals before the scheduled meetup time. The question is: should the intervals (24 hours, 1 hour) be hardcoded as constants in the job file, or stored in platform_settings for admin configurability?

### The Decision

**Hardcode the intervals (24hr and 1hr) as constants in the reminder worker file. Do NOT add platform_settings keys for reminder_intervals.**

### Why This Design Wins

**1. Reminders are foundational, not tunable.** Unlike fees (which vary by seller tier and market conditions), reminder timing is a fixed UX pattern. All users expect a 24-hour notice and a 1-hour heads-up. These timings are proven from eBay, Amazon, and Airbnb. They don't need to be tuned by admins.

**2. Reduces operational complexity.** Every new admin-configurable setting adds a UI control, a database entry, a documentation page, and potential for misconfiguration. Keeping reminders as code constants means one less thing for admins to accidentally break.

**3. Can be made configurable later without breaking change.** If (in the future) evidence shows a need to tune reminder timing, extracting the constants to platform_settings is a simple refactor that doesn't require a migration or API change.

**4. Keeps reminder logic co-located with job logic.** The job executor knows when the reminder should fire. Having the intervals next to the job scheduling code (not in the database) makes the relationship explicit.

---

## 126. Reminder Data Resolved at Fire-Time, Not Enqueue-Time

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.13 (Meetup Reminder Notifications)
**Related:** Decision #125 (Meetup Reminder Intervals)

### The Problem

When enqueueing a reminder job, should the job payload include a snapshot of the listing title and safe meetup location name (at enqueue time), or should the job resolve those values from the database when the job fires (at fire-time)?

**Option A (Snapshot):** Store listing.title and safeMeetupLocation.name in the job payload at enqueue time.
**Option B (Fire-time):** Query the database when the reminder job fires to fetch the latest values.

### The Decision

**Use Option B: Resolve reminder data (listing.title, safeMeetupLocation.name) from the database at fire-time, not at enqueue-time.**

### Why This Design Wins

**1. Resilient to late edits.** If a seller edits the listing title between the meetup being scheduled and the reminder firing, the reminder shows the current title, not the stale one. This is more accurate.

**2. Handles safe location changes.** If an admin changes a safe meetup location's address (due to a reported safety issue or venue closure), reminders fired after the change reflect the new address. A snapshot would miss this critical update.

**3. Avoids job payload bloat.** Job payloads should be minimal (just IDs). Storing strings in the payload increases payload size and makes debugging harder. A single lookup query at fire-time is negligible cost.

**4. Simplifies schema changes.** If the safe location data structure changes, fire-time resolution automatically adapts. A snapshot approach would require a migration to update old job records.

**5. Fire-time queries are performant.** Reminders fire at most 2-3 times per transaction (24hr and 1hr). Batching a few queries is not a bottleneck.

---

## 127. Skip Past Reminder Windows — Don't Fire With Zero Delay

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.13 (Meetup Reminder Notifications)
**Related:** Decision #125 (Meetup Reminder Intervals), Decision #126 (Fire-time Resolution)

### The Problem

When a meetup is scheduled less than 24 hours in the future, should the 24-hour reminder still be enqueued (and fired immediately with delay = 0), or should it be skipped entirely?

**Option A (Fire Immediately):** Enqueue the 24-hour reminder with `delay: 0`. It fires right away, sending a message like "Your meetup is scheduled for tomorrow" even though the meetup is in 8 hours.

**Option B (Skip Past Windows):** If the meetup is less than 24 hours away, skip the 24-hour reminder entirely. Only enqueue reminders that make temporal sense.

### The Decision

**Use Option B: Skip past reminder windows. If a meetup is scheduled <24 hours away, do NOT enqueue the 24-hour reminder. Only send reminders that occur after the current time.**

### Why This Design Wins

**1. Messaging is accurate.** A reminder saying "Your meetup is tomorrow" when it's in 8 hours is confusing. The user has already been in the conversation flow, so they don't need a delayed confirmation of what they just scheduled.

**2. Reduces reminder spam.** If a user schedules a meetup 2 hours before the original 24-hour window, sending both the old 24-hour window AND the new 1-hour window creates noise. Only the 1-hour reminder is timely.

**3. Respects user intent.** A user scheduling a meetup for tonight already knows when it's happening. Sending them a "tomorrow" reminder is counterproductive. Skip it.

**4. Handles edge cases gracefully.** If a user reschedules a meetup to a time already past the 24-hour window, the job still executes but discovers the condition via the skip logic. This prevents need for a "cancel old reminder" pathway.

**5. Mirrors real-world behavior.** Airbnb, Booking.com, and other platforms don't send a "24 hours until checkin" message if checkin is in 4 hours. They adapt the reminder cadence to the schedule. V3 should do the same.

---

## 128. RESERVED as New Listing Status Enum Value

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.14 (Listing Auto-Reserve on Escrow)
**Related:** Decision #118 (Twicely SafeTrade), Decision #42 (Local Transaction Fee Model)

### The Problem

When a buyer creates a local transaction (schedules a meetup with escrow), the listing should be marked as unavailable to other buyers. Currently, the listing remains in ACTIVE status, which allows other buyers to purchase it while the first transaction is pending. This creates a double-booking problem.

The question is: should the listing status transition to a new value (RESERVED), or should it be marked as unavailable through a separate flag?

### The Decision

**Add RESERVED to the listingStatusEnum. Listings transition ACTIVE→RESERVED when a local escrow transaction is created, RESERVED→ACTIVE when the transaction is cancelled or marked NO_SHOW, and RESERVED→SOLD when the transaction is completed.**

### Why This Design Wins

**1. RESERVED is semantically correct.** The listing is held for a specific buyer pending confirmation. "Reserved" is the precise term for this state. A separate flag (like `reservedByTransactionId` boolean) would be ambiguous in logs and reports.

**2. RESERVED listings are hidden from search and discovery.** They don't appear in category pages, search results, or recommendations. This prevents customer confusion ("why can't I buy this?") and eliminates the double-booking race condition entirely. Buyers can still access the listing via direct URL if they have it bookmarked.

**3. RESERVED listings still have a detail page.** The listing isn't unlisted — it's just unavailable. The buyer and seller can still view it during the transaction. A blue banner ("This item is reserved for pickup on [date]") explains the status.

**4. Offers are auto-declined while RESERVED.** Any new offer on a RESERVED listing is immediately declined with the message "This item is no longer available. The seller has it reserved for another buyer." This is cleaner than accepting and immediately declining.

**5. The status lifecycle is clear.** ACTIVE ↔ RESERVED ↔ SOLD is a complete, understandable state machine with no ambiguity. Developers reading the code instantly understand what RESERVED means.

**6. RESERVED is reversible.** Unlike SOLD (which is final), RESERVED can revert to ACTIVE if the escrow transaction is cancelled or no-shown. This mirrors real-world behavior: a reserved item goes back on sale if the buyer ghosts.

---

## 129. Immediate Unreserve on NO_SHOW

**Date:** 2026-03-12
**Status:** LOCKED
**Builds in:** G2.14 (Listing Auto-Reserve on Escrow)
**Related:** Decision #128 (RESERVED as Listing Status), Decision #118 (Twicely SafeTrade), Decision #43 (No-Show Penalty for Local Meetups), Decision #120 (Local Reliability Display Tiers)

### The Problem

When a local transaction is marked NO_SHOW, the listing is reserved for that transaction. Should the listing remain RESERVED until some time period passes (e.g., 24 hours, awaiting seller appeal), or should it immediately revert to ACTIVE?

**Option A (Delayed Unreserve):** Keep the listing RESERVED for 24 hours after a NO_SHOW. This allows the seller to appeal the no-show decision if it was a false positive (e.g., app crash).
**Option B (Immediate Unreserve):** Immediately revert the listing to ACTIVE when marked NO_SHOW. The seller can relist immediately.

### The Decision

**Use Option B: Immediately revert the listing to ACTIVE when the transaction is marked NO_SHOW. The seller can relist immediately, the next day, or whenever they choose.**

### Why This Design Wins

**1. The penalty is already severe.** A no-show incurs a -3 reliability mark, which instantly moves the seller into the INCONSISTENT tier (3-8 marks). This affects their trust score, buyer visibility, and conversion rates. Delaying the listing return would be piling on punishment without added protection.

**2. Sellers need flexibility.** A seller whose buyer no-showed might want to immediately reach out to another interested party for the same item. Forcing a 24-hour hold prevents that. The seller should regain control of their inventory immediately.

**3. Appeals happen through support, not automatically.** If a seller disputes a no-show claim (e.g., "I sent my photo, the app didn't submit it"), they open a support ticket. The helpdesk reviews evidence and can reverse the mark if warranted. A 24-hour hold doesn't help this process; it just wastes time.

**4. The mark itself is the seller's incentive.** Three -3 marks in 90 days = 9 marks = suspended from local transactions. That's a proportional, meaningful consequence. No need to compound it with delayed listing unreserve.

**5. Matches the user expectation.** When a buyer no-shows, the seller's frustration is immediate and intense. Letting them immediately relist the item is the fastest path to a better outcome (finding a serious buyer). Forcing a 24-hour hold feels punitive and arbitrary to the seller.

**6. Simplifies the transaction state machine.** NO_SHOW is a terminal state. The listing unreserve is immediate and unconditional. No need to track a "reserved pending appeal" state or introduce a scheduled job to unreserve after 24 hours.

---

## 132. Affiliate Fraud: Multi-Signal Detection + Three-Strikes Escalation

**Date:** 2026-03-13
**Status:** LOCKED
**Builds in:** G3.5 (Affiliate Anti-Fraud Detection & Escalation)
**Related:** Decision #112 (Affiliate Program Structure)

### The Problem

Affiliate programs are prime targets for fraud: self-referrals (earning commission on your own sales), credential stuffing (bulk account creation with stolen payment methods), velocity abuse (flooding the system), and device/IP collusion (coordinated fraud networks). The question is not IF to detect fraud, but HOW to respond proportionally without over-banning legitimate affiliates.

Should violations result in immediate bans, gradual escalation, or manual review on a per-case basis?

### Options Considered

**Option A (Immediate Ban):** Any fraud signal → instant permanent ban. Fast, decisive, zero false positives accepted.
**Downside:** A single false positive (e.g., user checking their own listing from work, then home) results in permanent affiliate loss. High false positive cost.

**Option B (Manual Review Only):** All fraud signals → escalate to staff. No automatic enforcement.
**Downside:** Staff review is slow (hours to days). Fraud networks scale faster than humans can respond. Layering many weak signals goes unnoticed.

**Option C (Three-Strikes Escalation):** Weak signals accumulate. One strong signal escalates immediately. Ban occurs when threshold is crossed.
**Upside:** Proportional response. Multiple small issues can be monitored. Repeat offenders are caught. Single false positives don't end careers.

### The Decision

**Use Option C: Three-strikes escalation. Each fraud signal (IP mismatch, device fingerprint, velocity spike, etc.) increments a counter. Counter crosses thresholds: 2 strikes = staff review required (STRONG_SIGNAL), confirmed strong signals = instant ban. Automated ban enforcement is immediate; reversals require staff action.**

### Why This Design Wins

**1. Protects the system from coordinated attacks.** Fraud rings typically cross multiple signals: same IP + different payment methods + rapid account creation. A multi-signal system catches these patterns before they metastasize.

**2. Proportional to the risk.** A user viewing their own listing from home and work is low-risk and probably legitimate. But that same pattern + a new payment method + refusal to provide identity proof is higher risk. Signals stack; response escalates.

**3. Legitimate affiliates get warnings, not bans.** If an affiliate's account shows 1–2 weak signals, they get monitored. If they're clean, the counter decays over time. They don't get banned for owning both a home and an office.

**4. Automation scales with growth.** As the affiliate program grows, staff can't manually review every suspicious account. Automated signals catch the obvious cases; staff focus on edge cases. This is how Uber, Airbnb, and DoorDash manage abuse: signals + escalation + human override.

**5. Reversals are possible.** If a ban was incorrect, an affiliate can appeal through support. Staff review the history, lift the ban if warranted. A three-strikes system provides audit trail and data for fair reversals.

**6. Prevents repeat offenders.** If an affiliate is caught abusing the system once (strong signal = review + ban), they can't just create a new account under a different name — IP/device/payment tracking will flag the new account immediately.

### Implementation Notes

- **Six fraud checks:** self-referral (IP + device at click time), credential stuffing (velocity of new payment methods), velocity abuse (accounts created per IP/device window), payment method changes (churn pattern), browser fingerprinting (device consistency), geographic velocity (impossible travel).
- **Counter increments:** Weak signals (1 point), strong signals (2 points). Threshold = 3 points triggers review + escalation.
- **Scan cadence:** Every 6 hours via BullMQ cron job. Checks for accumulated signals since last run.
- **Automatic enforcement:** Staff-confirmed bans enforce immediately via 30-day `affiliateFraudBannedAt` timestamp. Reversals require explicit staff action to clear the timestamp.

---

## 133. Impersonation Session Storage: Stateless HMAC Cookie

**Date:** 2026-03-18
**Status:** LOCKED
**Builds in:** G10.8 (Staff impersonation "view as user")

### The Problem

Staff members need to debug user-reported issues by temporarily viewing the marketplace from the user's perspective (impersonation). The question is how to store the impersonation session state. Options include:

**Option A (Database table):** Create an `impersonationSession` table with userId, staffUserId, createdAt, expiresAt columns. Allows remote revocation, audit trail, and recovery of lost sessions.
**Option B (Stateless HMAC cookie):** Sign a JWT-like cookie with HMAC, containing staffUserId + targetUserId + issuedAt. No server-side state needed, but revocation requires waiting for expiry.
**Option C (Redis/Valkey cache):** Store session in cache with TTL. Fast revocation, medium complexity.

### Options Considered

**Option A (DB table):**
- Upside: Centralized audit trail, remote revocation, staff can list/manage active impersonations.
- Downside: Schema change, DB query on every request to validate active session, adds operational load.

**Option B (Stateless HMAC cookie):**
- Upside: No schema change, no server-side state, cryptographically verified (tamper-proof), minimal request overhead.
- Downside: Cannot revoke mid-session (must wait for TTL expiry), no easy way to list active impersonations.

**Option C (Redis/Valkey cache):**
- Upside: Remote revocation, reasonably fast, audit-friendly.
- Downside: Requires cache layer, TTL management, single point of failure if cache goes down.

### The Decision

**Use Option B: Stateless HMAC-signed cookie. Sign with Node.js `crypto.createHmac()`, verify on every impersonated request, with a 15-minute TTL.**

### Why This Design Wins

**1. No schema change.** G10.8 is late-stage work. Adding a new table is overhead we don't need — impersonation is a support-only feature used by 5–10 staff members, not a core product feature.

**2. Cryptographically secure.** HMAC ensures the cookie cannot be forged. A malicious user cannot impersonate staff or extend their session. The signature is verified on every request.

**3. Fast, stateless verification.** No DB queries, no cache lookups. Just hash + compare. Impersonation is already a rare operation; stateless verification adds zero overhead.

**4. 15-minute TTL is adequate for support.** Staff debug a user's issue (5–10 minutes typical). If the session expires mid-investigation, they re-authenticate and start a new impersonation. This is acceptable friction for a rare operation.

**5. Prevents abuse without infrastructure.** A staff member who logs out (or their session ends) automatically loses impersonation because the session cookie is cleared. No stale sessions left behind.

**6. Audit trail is simple.** Log impersonation start/end in the audit log with staffUserId + targetUserId + timestamp. No need to query a stale table.

**7. Revocation is straightforward in emergencies.** If we discover staff is abusing impersonation, we force-rotate the HMAC key, invalidating all outstanding tokens. This is a rare operation.

### Implementation Notes

- **Cookie name:** `twicely.impersonation_token`
- **TTL:** 15 minutes
- **Cookie signature:** HMAC-SHA256 (key from environment)
- **Payload:** { staffUserId, targetUserId, issuedAt }
- **Verification:** On every request to `/api/hub/*` and `/d/*`, check if impersonation cookie is present and valid
- **Routes:**
  - `POST /api/hub/impersonation/start` — Create impersonation session (requires staff role)
  - `POST /api/hub/impersonation/end` — Clear impersonation session
  - `GET /api/hub/impersonation/me` — Check current impersonation state
- **UI indicator:** ImpersonationBanner component in app layout showing "You are viewing as [User Name]" with "Exit" button
- **Audit log:** Entries recorded on start/end with staffUserId, targetUserId, reason (if provided)

---

## 134. Buyer stripeCustomerId Stored on User Table (Separate from Seller Connect ID)

**Date:** 2026-03-18
**Status:** LOCKED
**Builds in:** G10.10 (Saved payment methods page at /my/settings/payments)

### The Problem

Buyers need to save payment methods for one-click checkout. To save payment methods in Stripe, we must create a Stripe Customer object and store its ID. However, sellers also need a Stripe connection (for payouts). Both use Stripe, but for different purposes:
- **Buyers:** Stripe Customer ID (for saving payment methods via SetupIntent)
- **Sellers:** Stripe Connect Account ID (for receiving payouts to their bank)

The question is where to store the buyer Stripe Customer ID. Options:

**Option A (User table, new column `stripeCustomerId`):** Add nullable `stripeCustomerId` text column directly on the `user` table. Buyer is the primary owner entity (per ownership model).

**Option B (sellerProfile column):** Store on sellerProfile (where Connect ID lives). Simpler unified location, but conflates buyer and seller concerns.

**Option C (New buyerProfile table):** Create a dedicated `buyerProfile` table with buyer-specific metadata. Mirrors the seller architecture but adds unnecessary complexity.

**Option D (Ephemeral, no storage):** Generate SetupIntent without storing Customer ID, only for immediate payment. Re-prompt on each purchase.

### Options Considered

**Option A (User table):**
- Upside: Follows ownership model (everything traces to userId). User is the primary entity. Customer ID is buyer metadata, not seller metadata.
- Downside: Adds 1 column to user table. Slightly denormalizes schema (Connect ID is on sellerProfile, Customer ID is on user). Minor operational overhead.

**Option B (sellerProfile):**
- Upside: Centralized — both Stripe IDs on one table.
- Downside: Violates separation of concerns. Not all users are sellers, so this adds noise to sellerProfile (nullable column). Confuses reader: is `stripeCustomerId` for buyers or sellers? Naming becomes ambiguous (`connectedAccountId` vs `stripeCustomerId`).

**Option C (buyerProfile):**
- Upside: Mirrors seller architecture, future-proof if buyer-specific features grow.
- Downside: Over-engineered for current feature set. Adds table, migrations, schema complexity. Buyer is a mode, not a distinct entity like "seller" — no need for separate profile table.

**Option D (Ephemeral):**
- Upside: No storage needed.
- Downside: Terrible UX — users must re-enter card every time. Defeats the purpose of "saved payment methods." Not viable.

### The Decision

**Use Option A: Add nullable `stripeCustomerId` text column to the `user` table. Store Stripe Customer ID only for buyers who have explicitly saved payment methods.**

### Why This Design Wins

**1. Ownership model clarity.** The user is the primary entity. Stripe Customer ID is a marketplace buyer's data. It belongs on the `user` table, not buried in `sellerProfile`.

**2. Clean separation from seller Connect account.** sellerProfile holds `stripeConnectedAccountId` (a business/tax entity). User table holds `stripeCustomerId` (payment method storage). These are orthogonal concerns with different Stripe objects. Keeping them separate makes the schema self-documenting.

**3. Not all users are sellers.** If we stored Customer ID on sellerProfile, every buyer who hasn't activated as a seller would have a nullable column with no context. Puts "buyer" metadata in the "seller" entity.

**4. Migration path for future buyer features.** If buyer-specific features grow (buyer preferences, buyer reputation, buyer verification), we have a clear location to extend — the user table. Avoids the "all seller stuff here, all buyer stuff there" confusion.

**5. Minimal schema impact.** One column, nullable, indexed. No new table, no migration complexity. Follows the pattern of other buyer metadata (e.g., `stripeDefaultPaymentMethodId` if we add that later).

**6. Existing Twicely V2 precedent.** V2 stores Stripe Customer IDs on the user/buyer entity, not on seller profiles. This maintains consistency.

### Implementation Notes

- **Column name:** `stripeCustomerId` (text, nullable, default NULL)
- **Schema location:** `user` table
- **Indexing:** Index on `(stripeCustomerId)` for fast lookup during payment flows
- **Encryption:** Not encrypted (public non-sensitive ID, same as other Stripe IDs in our schema)
- **Related tables:** `paymentMethod` table stores saved card metadata (card brand, last4, expiry, isDefault). Foreign key: `paymentMethod.userId`.
- **Stripe flow:**
  - Buyer clicks "Save payment method" on /my/settings/payments
  - Server checks if user.stripeCustomerId exists; if not, create Stripe Customer (POST /v1/customers)
  - Store Customer ID in user.stripeCustomerId
  - Create SetupIntent (POST /v1/setup_intents) for Stripe Elements Card capture
  - After success, create paymentMethod record in DB
- **Distinct from seller payouts:** sellerProfile.stripeConnectedAccountId is the Stripe Connect Account (for receiving payouts). No connection to buyer Customer ID.

---

## 135. Newsletter Subscriber Table Added Outside Schema v2.1.0 (G10.12)

**Date:** 2026-03-18
**Status:** ACTIVE

### The Problem

G10.12 (Newsletter subscribe form) requires persistent storage of newsletter subscriber emails, unsubscribe tokens, and subscription state. Schema v2.1.0 (§23 Buyer Acquisition) does not include a newsletter table. The canonical schema was built during earlier phases before newsletter functionality was planned. Now that G10.12 is implemented, we need to document why a new table was created outside the formal schema doc.

### The Decision

**Created `newsletter_subscriber` table in a new dedicated schema file `src/lib/db/schema/newsletter.ts` following the existing modular pattern. This table was NOT added to schema v2.1.0 because:**

1. **Schema v2.1.0 is locked.** The schema doc was finalized during Phase C/D and has been the source of truth for 144 tables through G10.11. Retrofitting newsletter into that doc would create ambiguity about which version it belongs to and when it was added.

2. **Modular schema files.** Twicely's schema is split across multiple files by domain (buyer, seller, order, search, social, etc.). Newsletter is its own minimal domain (3 columns + 1 enum). It deserves its own file following the precedent.

3. **Public feature, not schema-breaking.** The newsletter table does not connect to existing tables (no foreign keys, no dependent enums). It's a standalone, self-contained feature. Adding it to schema v2.1.0 would bloat that doc without adding architectural clarity.

### The Design

**Table name:** `newsletter_subscriber`
**Columns:**
- `id` — CUID2, primary key
- `email` — text, unique, indexed
- `unsubscribeToken` — CUID2, unique, indexed (used in unsubscribe links and API routes)
- `confirmedAt` — timestamptz, nullable (set on insert for single opt-in; NULL means pending if double opt-in were added later)
- `unsubscribedAt` — timestamptz, nullable (soft delete — NULL means active subscriber)
- `createdAt` — timestamptz, default now()
- `updatedAt` — timestamptz, default now()

**Enum:** `newsletter_source` (SOURCE_HOMEPAGE, SOURCE_FOOTER, SOURCE_POPUP, SOURCE_REFERRAL)

**API routes:**
- `POST /api/newsletter/subscribe` — public, accepts email + source, creates subscriber with unsubscribeToken, sends Resend welcome email with RFC 8058 List-Unsubscribe header linking to unsubscribe endpoint
- `POST /api/newsletter/unsubscribe` — public, accepts unsubscribeToken, sets unsubscribedAt (soft delete)

**Single opt-in model:** confirmedAt is set on insert (immediate), not on email confirmation. This matches modern SaaS/newsletter practices and reduces friction. GDPR compliance is maintained through explicit unsubscribe and List-Unsubscribe header.

### Why Not Update Schema v2.1.0?

Schema v2.1.0 was published as the authoritative frozen snapshot of the Twicely database design through Phase C/D. Creating a v2.1.1 or amending v2.1.0 mid-Phase-G would:

1. **Retroactively change the schema doc version** — creates confusion about "what was in the schema when feature X was built?"
2. **Split the definition** — newsletter would be partially in v2.1 and partially in schema.ts comments
3. **Violate append-only pattern** — schema v2.X.Y versions should be immutable snapshots

Instead, the newsletter.ts file is self-documenting and will be rolled into the **next formal schema update** (v2.2, post-Phase G) which will consolidate all G-phase addenda into a single authoritative doc.

### Implementation Status

- **Files:** `src/lib/db/schema/newsletter.ts` (table + enum definitions), `src/lib/queries/newsletter.ts` (getSubscriber, createSubscriber), `src/lib/actions/newsletter.ts` (subscribe, unsubscribe server actions)
- **Tests:** 44 new tests across schema validation, API routes, Resend integration, token generation
- **Dates:** Implemented 2026-03-18 (G10.12 complete)
- **No breaking changes:** Standalone feature, zero impact on existing schema

---

## 136. Browser Extension Architecture — Chrome MV3 Only, Dev-Only Unpacked Distribution

**Date:** 2026-03-18
**Status:** ACTIVE
**Builds in:** H1.1 (Extension scaffold + registration)

### The Problem

Building a browser extension for Twicely to help sellers quick-list from eBay/Posh/Mercari. Must decide:
1. Which browsers to support (Chrome, Firefox, Safari, Edge)?
2. Manifest version (v2 or v3)?
3. Distribution model (Chrome Web Store, dev-only, sideloading)?

Chrome v2 is deprecated, v3 is mandatory for new submissions. But different browsers have different v3 implementations. Trade-off between feature parity and scope.

### Options Considered

**Option A (Chrome + Firefox + Safari, MV3):** Support all major browsers with unified Manifest v3.
- Upside: Maximum reach, includes European Firefox users.
- Downside: MV3 feature set differs across browsers (Firefox has weaker CSP model, Safari has limitations on service workers). Requires multiple conditional code paths, testing burden, delayed rollouts.

**Option B (Chrome only, MV3):** Support Chrome exclusively with clean Manifest v3 implementation.
- Upside: Single browser, single spec, no conditional logic. Chrome dominance in resale (eBay/Posh sellers). Faster development. Easier testing/debugging.
- Downside: Excludes Firefox/Safari users. Smaller addressable market.

**Option C (Multiple browsers, v2 + v3 shims):** Try to support both v2 (legacy) and v3 in same codebase.
- Upside: Gradual transition, support more users.
- Downside: Massive technical debt. Duplicated logic, hard to maintain, bug surface area explodes.

**Option D (Web-only, no extension):** Use Tier C (extension-less) detection only.
- Upside: No extension distribution burden.
- Downside: Doesn't achieve seller workflow acceleration goal. Manual copy/paste required.

### The Decision

**Use Option B: Chrome only, Manifest v3, dev-only unpacked distribution.**

**Implementation:**
- Manifest file: `src/extension/manifest.json` (Chrome MV3)
- Service worker: `src/extension/service-worker.ts` (message routing, popup state)
- Popup UI: `src/extension/popup.html` + popup.tsx (React)
- Content script: `src/extension/content-script.ts` (platform detection, data extraction)
- Unpacked distribution: developers install from disk (chrome://extensions → "Load unpacked")
- No Web Store listing (dev-only, not distributed publicly)

### Why This Design Wins

**1. Chrome dominance in resale.** eBay, Poshmark, Mercari users skew Chrome. Firefox is <2% of target demographic. Supporting Firefox adds 10% engineering effort for <0.5% user gain.

**2. MV3 is the future.** MV3 has better security (stricter CSP, no eval), better privacy (less background processing). Chrome will enforce v3 exclusively in 2025. Supporting v2 would require deprecation cycle anyway.

**3. Unpacked distribution avoids review delays.** Chrome Web Store has 2-4 week review cycle. Developers can install immediately from source. Faster iteration on early features.

**4. Service worker + postMessage simplicity.** MV3 service workers are more constrained than background pages, but simpler to reason about. Combined with content script → popup messaging, architecture is clean.

**5. Future multiplatform porting.** Once Chrome version stabilizes (after H2), porting to Firefox (with `browser.` API instead of `chrome.`) takes days, not weeks. Single-browser foundation lets us expand later.

### Implementation Notes

- **Manifest version:** 3
- **Service worker:** No background page; service worker handles messages, routing, timer cleanup
- **Content script:** Detects platform (eBay, Posh, Mercari, etc.) via URL pattern, extracts JSON listing data
- **Popup:** React component with iframe sandboxing for auth flow
- **Message flow:** popup → service worker → content script → popup (request/response)
- **Storage:** chrome.storage.local for session tokens (cleared on logout)
- **Permissions:** `activeTab`, `scripting`, `storage`, host patterns for eBay/Posh/Mercari/Etsy/etc.
- **Security:** Content Security Policy strict; no inline scripts; all JS in separate files

### Future: Firefox Port

When H1 stabilizes (H1.4+), Firefox version will:
1. Use `browser.` API instead of `chrome.`
2. Reuse popup/content script logic
3. Create separate manifest.json for Firefox (loaded conditionally at build time)
4. Share 90% of code; 10% platform-specific wrappers

---

## 137. Extension Registration Flow — localStorage + postMessage Token Relay

**Date:** 2026-03-18
**Status:** ACTIVE
**Builds in:** H1.1

### The Problem

Extension needs to authenticate with Twicely API. Can't use same session cookies as marketplace (privacy isolation, different origin). Must establish secure token exchange:
1. User clicks "Register" in popup
2. Opens Twicely auth page
3. User logs in, grants permission
4. Receives 30-day session token
5. Extension needs to store + use this token

Options:
- **Shared localStorage** — violate origin isolation
- **Service worker memory** — lost on reload
- **postMessage token relay** — pass token from popup to background, store in service worker
- **Stripe OAuth pattern** — no, overkill for internal auth

### The Decision

**Use postMessage bridge from popup (auth window) to service worker. Token stored in localStorage (within extension context, not shared with web). Separate storage key namespace (`ext_*`) to prevent collision.**

**Flow:**
1. `GET /api/extension/authorize` — generates registration token, returns OAuth-style redirect
2. User lands on `/api/extension/callback?token=<TOKEN>` (rendered HTML page)
3. Page extracts token from URL, sends `postMessage({ type: 'extension_register', token })` to parent/opener window
4. Service worker listens for message, validates token with `/api/extension/register` (POST)
5. Server returns 30-day JWT session token
6. Service worker stores in `chrome.storage.local.ext_sessionToken` + fallback `localStorage.ext_sessionToken`
7. Popup retrieves token on startup, sends heartbeat to `/api/extension/heartbeat`

**Token payload (JWT):**
```
{
  sub: userId,
  extensionId: "chrome-extension://xyz",
  sessionType: "extension",
  iat: <timestamp>,
  exp: <timestamp + 30 days>
}
```

### Why This Design Wins

**1. Origin isolation preserved.** Extension context (chrome-extension://) is separate from web context (twicely.co). Each has own localStorage. No security violation.

**2. postMessage is iframe-safe.** Even if redirect page is sandboxed iframe, postMessage works. Standard browser API, no custom hacks.

**3. 30-day session > OAuth.** OAuth adds Stripe/Auth0 dependency. Simple JWT is stateless, easier to revoke (admin can invalidate all extension tokens via invalidateSessionBefore timestamp).

**4. Fallback to chrome.storage.local.** If localStorage unavailable, chrome.storage.local provides guaranteed persistence across reloads. Double safety net.

**5. Handles logout gracefully.** User clicks "Logout" in popup, service worker clears both localStorage and chrome.storage. Next heartbeat fails, user re-authenticates.

### Implementation Notes

- **Message format:** `{ type, token, ...metadata }`
- **Service worker listener:** `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => ...)`
- **Error handling:** If `/api/extension/register` fails, show "Registration failed" in popup, offer retry
- **Token refresh:** Not needed (30 days is long). If needed later, add `/api/extension/refresh` route
- **HTTPS only:** Manifest specifies `https://twicely.co/*` — no insecure channels

---

## 138. Extension JWT Library Choice — jose

**Date:** 2026-03-18
**Status:** ACTIVE
**Builds in:** H1.1

### The Problem

Extension needs to validate JWT tokens from server (for offline fallback, detect tampering). Must choose JWT library for browser:
- **jsonwebtoken (node-jsonwebtoken)** — Node.js only, too large for browser
- **jwt-decode** — decoding only, no verification (unsafe for untrusted tokens)
- **jose** — pure JS, browser + Node.js, has verification, modern async API
- **tweetnacl.js** — for Ed25519 signatures (if using asymmetric)

Which library for token validation?

### The Decision

**Use `jose` (by Panva, open-source) for JWT validation in browser. Server signs with Node.js crypto.subtle (HMAC-SHA256 or RS256).**

**Rationale:**
- Jose is 10kb minified, 2.5kb gzipped — acceptable for extension
- Pure JS, no native deps, works in browser worker contexts
- Supports HS256 (HMAC, symmetric) — sufficient for session tokens
- Async API: `jose.jwtVerify(token, secret)` with automatic claims validation (iat, exp, sub)
- Well-maintained (used by Next.js Auth.js library)

**Server-side signing:**
```typescript
import jose from 'jose';
const secret = new TextEncoder().encode(process.env.EXTENSION_JWT_SECRET);
const jwt = await new jose.SignJWT({ sub: userId, extensionId })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('30d')
  .sign(secret);
```

**Extension-side verification:**
```typescript
import * as jose from 'jose';
const secret = new TextEncoder().encode(process.env.VITE_EXTENSION_JWT_SECRET); // shared key
const verified = await jose.jwtVerify(token, secret);
if (verified.payload.exp < Date.now() / 1000) throw new Error('Token expired');
```

### Why jose Over Alternatives

**vs jsonwebtoken:** Too large, Node.js only. Jose compiles to 2.5kb in browser, jsonwebtoken is 50kb+.

**vs jwt-decode:** Decoding only. Doesn't prevent tampering. If server signs, we must verify in extension (offline fallback). Decode-only is a footgun.

**vs tweetnacl.js:** Asymmetric crypto is slower, more complex. Symmetric (HMAC) sufficient for same-organization tokens. Can upgrade to RS256 later if needed.

**vs custom implementation:** Never do crypto in-house. Jose is audited, standard.

### Implementation Notes

- **Secret management:** Same JWT_SECRET used server+client. Managed in .env, not committed.
- **Algorithm:** HS256 (HMAC-SHA256) for now. Can migrate to RS256 (RSA) later if needed.
- **Claims validated automatically:** iat (issued at), exp (expiration), custom sub (user ID), extensionId (chrome-extension://...)
- **Offline mode:** If server unreachable, extension checks local token validity (not expired). Heartbeat will fail when online.

---

## 139. Extension Session TTL — 30-Day Manual Re-authentication Required

**Date:** 2026-03-18
**Status:** ACTIVE
**Builds in:** H1.1

### The Problem

How long should an extension session token last?
- **1 day** — users annoyed, too frequent re-auth
- **7 days** — reasonable, but still requires frequent login
- **30 days** — long enough to feel "persistent" without forgetting password
- **90 days** — too long, higher account takeover risk
- **365 days (1 year)** — unacceptable, violates OAuth best practices

Extension is lower-risk than web (sandboxed, can't steal cookies from other tabs), but still needs security baseline.

### The Decision

**30-day session TTL. No automatic refresh or sliding window. Manual re-authentication required every 30 days.**

**Rationale:**
1. **Marketplace seller safety.** Extension has permission to POST listings to eBay/Posh/Mercari. If compromised, 30-day window limits damage. If TTL were 365 days and a seller's device was stolen, attacker could list their items for 11 months.

2. **JWT stateless, no refresh.** With stateless JWT, refresh tokens add complexity. 30 days is long enough that "remember me" feel is achieved, without token rotation overhead.

3. **Industry standard.** Google sign-in tokens: 1 hour. Stripe API keys: indefinite (but scoped). Salesforce access tokens: 24 hours. Extension tokens at 30 days are conservative, secure.

4. **Can upgrade to sliding window later.** If users complain, we can implement "extend session on each heartbeat" (sliding window) without changing infrastructure.

### Implementation

- **JWT iat (issued at):** set on `/api/extension/register`
- **JWT exp (expiration):** `iat + 30 days` in seconds
- **Heartbeat validation:** `/api/extension/heartbeat` checks `exp` server-side, returns 401 if expired
- **Popup behavior:** If heartbeat returns 401, show "Session expired" message, button to re-register
- **Logout:** User can log out early (button in popup), clears token immediately

**Example JWT payload:**
```json
{
  "sub": "user_abc123",
  "extensionId": "chrome-extension://xyz",
  "sessionType": "extension",
  "iat": 1710777600,
  "exp": 1713456000
}
```

### Trade-offs Accepted

- **No refresh tokens:** Simpler implementation, slightly higher re-auth friction. Acceptable.
- **No "remember me" upgrade path:** If we later want "extend my session," requires schema change (sessionLastActiveAt). Acceptable, deferred to H2.
- **Expires on unused:** If user doesn't use extension for 30 days, must re-auth. This is intentional.

### Future Enhancement: Sliding Window

If analytics show >80% of sessions expire mid-action (users close popup for 30 days then return), we can add:
- `/api/extension/extend` — extends exp by 30 days if called within 7 days of expiration
- Service worker calls on heartbeat if exp < 3 days away
- Zero impact on user experience (automatic), same security (still max 30 days active)

---

*Decisions 136–139 locked for H1.1 (Browser Extension Scaffold + Registration). When next extension feature (H1.2+) is built, add rationale for platform detection, connector script architecture, etc.*

---

## 140. channelEnum Value: VESTIAIRE (Not VESTIAIRE_COLLECTIVE)

**Date:** 2026-03-20
**Status:** ACTIVE
**Builds in:** H4.1, H4.2

### The Problem

Schema Addendum A2.4 specified the channelEnum value as `VESTIAIRE_COLLECTIVE` (matching the full brand name). During H4.1/H4.2 implementation, the shortened form `VESTIAIRE` was used consistently across ~20 files (connector, normalizer, schemas, tests, admin pages, extension routes, channel registry).

### The Decision

**Approve `VESTIAIRE` as the canonical enum value. Update Schema Addendum A2.4 to match.**

**Rationale:**
1. **Consistency with existing values.** Other enum values use short names: `EBAY` (not `EBAY_INC`), `FB_MARKETPLACE` (not `FACEBOOK_MARKETPLACE`), `THEREALREAL` (not `THE_REALREAL`). `VESTIAIRE` follows this convention.
2. **Brevity.** `VESTIAIRE_COLLECTIVE` is 22 characters — unnecessarily long for an internal enum value that appears in DB queries, logs, and config keys.
3. **Risk of rename.** Changing 20+ files, DB migration to alter the enum, and updating all seed/test data for zero functional gain introduces unnecessary breakage risk.
4. **Internal consistency.** The codebase is 100% consistent on `VESTIAIRE`. The only drift is the pre-implementation spec doc.

### Implementation

- No code changes needed (already correct)
- Update Schema Addendum A2.4: replace `VESTIAIRE_COLLECTIVE` → `VESTIAIRE`
- channelEnum: 12 values (TWICELY, EBAY, POSHMARK, MERCARI, DEPOP, FB_MARKETPLACE, ETSY, GRAILED, THEREALREAL, WHATNOT, SHOPIFY, VESTIAIRE)

---

## 141. Extension Tables Removed — JWT + Valkey Architecture

**Date:** 2026-03-20
**Status:** ACTIVE
**Builds in:** H1.1

### The Problem

Schema Addendum A2.4 specified two tables (`extensionInstallation`, `extensionJob`) and three enums (`extensionBrowserEnum`, `extensionJobStatusEnum`, `extensionJobTypeEnum`) for extension tracking. During H1.1 implementation, a simpler architecture was adopted using JWT tokens + Valkey cache, making these tables unnecessary.

### The Decision

**Do not build the extension tables. Remove them from the schema addendum. The JWT + Valkey approach is the canonical architecture.**

**Rationale:**
1. **`extensionInstallation` duplicates JWT payload.** The JWT already tracks userId, browser (implicitly — Chrome-only per Decision #136), version (checked at register time), and install timestamp (JWT `iat`). A DB table would need sync logic for uninstall detection (impossible without an uninstall hook — Chrome doesn't provide one reliably).
2. **`extensionJob` overlaps with BullMQ.** Crosslister operations already use BullMQ job tracking (`crossJob` table + BullMQ queue state). A separate `extensionJob` table would create dual bookkeeping.
3. **Schema bloat.** At 144 tables, every new table must justify its existence. These tables would be written to but rarely queried — no admin page reads from them, no business logic depends on them.
4. **Simpler architecture.** JWT for auth + Valkey for ephemeral scrape cache is stateless, horizontally scalable, and requires no migrations. The extension works correctly in production today with this approach.
5. **A2.4 was speculative.** The addendum was written before H1.1 implementation. The implementation found a cleaner path — the spec should reflect reality.

### Implementation

- No code changes needed (tables were never built)
- Update Schema Addendum A2.4: remove `extensionInstallation`, `extensionJob`, and 3 enum definitions
- Add note: "Extension tracking handled via stateless JWT + Valkey. See Decision #141."
