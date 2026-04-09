# Canonical 13 -- Promotions, Campaigns & Promoted Listings

**Status:** DRAFT (V4)
**Domain:** commerce, finance, jobs, search
**Depends on:** Canonical 01 (Commerce/Orders), Canonical 05 (Finance/Ledger), Canonical 10 (Jobs/BullMQ), Canonical 08 (Search/Typesense)
**Package:** `packages/commerce` (engine), `packages/db` (schema), `packages/jobs` (scheduling)
**V2 Sources:** Phase 22 (Promotions/Coupons), Phase 25 (Promotions Automation)
**V3 Sources:** `packages/db/src/schema/promotions.ts`, `packages/commerce/src/promotions.ts`

---

## 1. Purpose

This canonical defines all platform promotion and campaign mechanics: coupon
validation, discount calculation, campaign lifecycle, budget enforcement,
promoted listings (paid search boosts), seller promotions (tier-gated), AI
campaign suggestions, and ledger integration. It merges V2's comprehensive
Prisma-based design with V3's Drizzle ORM monorepo architecture.

---

## 2. Core Principles

| # | Principle |
|---|-----------|
| P-1 | All money values are integer cents. Never floats. |
| P-2 | Coupon codes are uppercase, 4-20 chars, alphanumeric + hyphens. |
| P-3 | Budget enforcement is server-side, inside a DB transaction. |
| P-4 | Scheduling is atomic -- start/end times honored exactly via BullMQ cron with `tz: 'UTC'`. |
| P-5 | Attribution is immutable -- once a promotion is applied, the link is permanent. |
| P-6 | Auto-disable on budget exhaust -- no overspend allowed. |
| P-7 | All discounts create ledger entries (type `PROMOTION_FEE`). |
| P-8 | Redemption is idempotent (keyed on `promotionId + orderId`). |
| P-9 | Stacking: max 1 coupon + 1 campaign per order (read `promotions.maxStackedCoupons`). |
| P-10 | All configurable values from `platform_settings`, never hardcoded. |
| P-11 | Seller promotions gated by seller tier (from `@twicely/scoring`). |

---

## 3. Schema (Drizzle pgTable)

### 3.1 Existing tables (packages/db/src/schema/promotions.ts)

| Table | Purpose | Status |
|-------|---------|--------|
| `promotion` | Core promotion record (seller or platform) | EXISTS in V3 |
| `promotionUsage` | Per-order redemption tracking | EXISTS in V3 |
| `promotedListing` | Boost/promoted listing ads | EXISTS in V3 |
| `promotedListingEvent` | Attribution events (impression/click/sale) for boosts | EXISTS in V3 |

### 3.2 New tables (V4 additive)

#### promotionCampaign

Groups related promotions into a managed campaign with lifecycle, budget, and
scheduling controls. Platform-staff only.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| name | text NOT NULL | Campaign display name |
| description | text | Optional |
| campaignType | promotionCampaignTypeEnum | FLASH_SALE, SEASONAL, BUNDLE_DISCOUNT, SELLER_PROMOTION, PLATFORM_WIDE |
| status | promotionCampaignStatusEnum | DRAFT, SCHEDULED, ACTIVE, PAUSED, ENDED, CANCELED |
| startsAt | timestamptz NOT NULL | Campaign start |
| endsAt | timestamptz NOT NULL | Campaign end |
| timezone | text default 'UTC' | For display; scheduling uses UTC |
| budgetCents | integer | null = unlimited |
| spentCents | integer default 0 | Running total of discount spend |
| maxRedemptions | integer | null = unlimited; total redemption count cap |
| maxTotalDiscountCents | integer | null = unlimited; total discount amount cap |
| budgetAlertPct | integer default 80 | Trigger alert notification at this % |
| autoDisableOnExhaust | boolean default true | Auto-transition to ENDED when budget/caps hit |
| targetingRules | jsonb default '{}' | { categories: string[], tiers: string[], minOrderCents: number } |
| sellerId | text | Non-null for SELLER_PROMOTION type (FK to user) |
| createdByStaffId | text NOT NULL | Staff who created (or approved seller request) |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

Indexes: `(status, startsAt)`, `(status, endsAt)`, `(sellerId, status)`

#### campaignRule

Conditions that gate when a campaign's discounts apply. Evaluated at checkout.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| campaignId | text FK -> promotionCampaign.id | onDelete: cascade |
| ruleType | text NOT NULL | min_order, category_match, listing_set, seller_tier, new_user_only |
| condition | jsonb NOT NULL | Type-specific condition payload |
| isActive | boolean default true | |
| createdAt | timestamptz | |

Index: `(campaignId, ruleType)`

Condition payload examples:
- `min_order`: `{ "minCents": 5000 }`
- `category_match`: `{ "categoryIds": ["cat_1", "cat_2"] }`
- `listing_set`: `{ "listingIds": ["lst_1"] }`
- `seller_tier`: `{ "minTier": "PRO" }`
- `new_user_only`: `{ "maxOrderCount": 0 }`

#### campaignRedemption

Per-use tracking of campaign-level redemptions. Separate from `promotionUsage`
because a campaign may encompass multiple promotions.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| campaignId | text FK -> promotionCampaign.id | onDelete: cascade |
| promotionId | text FK -> promotion.id | onDelete: restrict |
| orderId | text FK -> order.id | onDelete: restrict |
| buyerId | text NOT NULL | |
| discountCents | integer NOT NULL | Actual discount applied |
| idempotencyKey | text UNIQUE | `campaign:{campaignId}:{orderId}` |
| createdAt | timestamptz | |

Indexes: `(campaignId, createdAt)`, `(buyerId, campaignId)`, `(orderId)`

#### campaignPromotion

Join table linking campaigns to their promotions (M:N).

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| campaignId | text FK -> promotionCampaign.id | onDelete: cascade |
| promotionId | text FK -> promotion.id | onDelete: restrict |
| priority | integer default 100 | Lower = higher priority within campaign |

Unique constraint: `(campaignId, promotionId)`

#### campaignBudgetLog

Audit trail for all budget mutations.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| campaignId | text FK -> promotionCampaign.id | onDelete: cascade |
| action | text NOT NULL | spend, refund, adjustment, alert, disable |
| amountCents | integer NOT NULL | Positive for spend, negative for refund |
| balanceCents | integer NOT NULL | Remaining budget after action |
| orderId | text | For spend/refund entries |
| staffId | text | For manual adjustments |
| reason | text | Human-readable explanation |
| createdAt | timestamptz | |

Index: `(campaignId, createdAt)`

#### scheduledPromoTask

Time-based activation/deactivation tasks processed by BullMQ scheduler.

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | cuid2 |
| campaignId | text FK -> promotionCampaign.id | onDelete: cascade |
| taskType | text NOT NULL | activate, deactivate, alert |
| scheduledFor | timestamptz NOT NULL | When to execute |
| status | text default 'pending' | pending, completed, failed, canceled |
| executedAt | timestamptz | |
| errorMessage | text | |
| createdAt | timestamptz | |

Indexes: `(scheduledFor, status)`, `(campaignId)`

### 3.3 Enums (additive to packages/db/src/schema/enums.ts)

```ts
export const promotionCampaignTypeEnum = pgEnum('promotion_campaign_type', [
  'FLASH_SALE', 'SEASONAL', 'BUNDLE_DISCOUNT', 'SELLER_PROMOTION', 'PLATFORM_WIDE',
]);

export const promotionCampaignStatusEnum = pgEnum('promotion_campaign_status', [
  'DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELED',
]);
```

---

## 4. Promotion Engine (pure functions -- V3 canonical)

Lives in `packages/commerce/src/promotions.ts`. No database access. Takes data
in, returns results. This file EXISTS in V3 and is not replaced.

### 4.1 Types

```
PromotionType   = 'PERCENT_OFF' | 'AMOUNT_OFF' | 'FREE_SHIPPING' | 'BUNDLE_DISCOUNT'
PromotionScope  = 'STORE_WIDE' | 'CATEGORY' | 'SPECIFIC_LISTINGS'
```

### 4.2 Core functions

| Function | Purpose |
|----------|---------|
| `isPromotionActive(promo, now)` | Time-gated activity check |
| `checkBuyerEligibility(promo, usageCount, sellerCartTotal)` | Usage limit + min order validation |
| `getApplicableLineItems(promo, lineItems)` | Scope-based filtering (store/category/listing) |
| `calculateDiscount(promo, items, options?)` | Per-item discount math, integer cents, floor rounding |
| `checkStackingRules(promos)` | Max one coupon code per checkout |
| `validateCouponCodeFormat(code)` | Regex: `^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$` |
| `normalizeCouponCode(code)` | `.toUpperCase().trim()` |

### 4.3 Discount calculation rules

| Type | Math |
|------|------|
| PERCENT_OFF | `floor(itemTotal * discountPercent / 100)` per item, summed |
| AMOUNT_OFF | `min(discountAmountCents, totalCents)` |
| FREE_SHIPPING | Sets `freeShipping: true`; discount = 0 |
| BUNDLE_DISCOUNT | PERCENT_OFF but gated on `minItemCount` from `platform_settings` |

### 4.4 Stacking rules

| Scenario | Behavior |
|----------|----------|
| Bundle discount + percentage coupon | Bundle applied first, then coupon on remainder |
| Bundle discount + fixed amount coupon | Bundle first, then fixed deduction |
| Bundle discount + free shipping | Both apply (different discount types) |
| Coupon excludes bundled items | Bundle discount only |
| Max combined discount | Read `promotions.maxCombinedDiscountPercent` from platform_settings (default 75%) |
| 1 coupon + 1 campaign | Allowed: max 1 coupon-code promotion + 1 auto-applied campaign discount |

---

## 5. Campaign Lifecycle State Machine

```
DRAFT --> SCHEDULED --> ACTIVE --> PAUSED --> ACTIVE (resume)
                                          \--> ENDED
                    \---> CANCELED (from any non-terminal)
ACTIVE --> ENDED (auto: budget exhausted OR maxRedemptions hit OR endsAt reached)
```

### 5.1 Valid transitions

| From | Allowed targets |
|------|----------------|
| DRAFT | SCHEDULED, CANCELED |
| SCHEDULED | ACTIVE, PAUSED, CANCELED |
| ACTIVE | PAUSED, ENDED, CANCELED |
| PAUSED | ACTIVE, CANCELED |
| ENDED | (terminal) |
| CANCELED | (terminal) |

### 5.2 Transition side effects

| Transition | Effect |
|------------|--------|
| -> ACTIVE | Activate all linked promotions (`isActive = true`) |
| -> PAUSED | Deactivate all linked promotions |
| -> ENDED | Deactivate all linked promotions; log final budget stats |
| -> CANCELED | Deactivate all linked promotions; cancel pending scheduled tasks |

---

## 6. Campaign Types

### 6.1 Flash Sale

- Duration: max 24h (read `promotions.flashSale.maxDurationHours` default 24)
- Higher urgency in search ranking signal
- Banner display on marketplace homepage

### 6.2 Seasonal

- Duration: up to `promotions.campaign.maxDurationDays` (default 30)
- Category targeting via `campaignRule`
- Linked to platform editorial calendar

### 6.3 Bundle Discount

- Requires `BUNDLE_DISCOUNT` promotion type
- Min items threshold from campaign rule or promotion's `minimumOrderCents` (overloaded as item count)

### 6.4 Seller Promotion

- Created by sellers, gated by tier (min `PRO` tier from `@twicely/scoring`)
- `campaignType = 'SELLER_PROMOTION'`, `sellerId` populated
- Seller sees own campaigns at `(hub)/my/selling/promotions`
- Staff approval required if discount > `promotions.seller.maxDiscountPercent` (default 50%)
- Max `promotions.seller.maxActiveCoupons` active coupons per seller (default 10)

### 6.5 Platform-Wide

- Created by staff only
- Applies to all eligible listings
- May carry platform-absorbed budget (ledger: `PROMOTION_FEE` credited to seller)

---

## 7. Promoted Listings (Paid Search Boost)

Uses existing V3 tables: `promotedListing`, `promotedListingEvent`.

### 7.1 Schema (existing)

| Column | Purpose |
|--------|---------|
| `listingId` | FK to listing being promoted |
| `sellerId` | Seller paying for promotion |
| `boostPercent` | Search score multiplier (e.g. 1.3 = 30% boost) |
| `impressions`, `clicks`, `sales` | Running counters |
| `totalFeeCents` | Accumulated charge |

### 7.2 Billing model

- Per-click billing: `bidCents` from `promotedListing` (V4 additive column)
- Daily budget cap: `dailyBudgetCents` (V4 additive column)
- Attribution window: `promotedListingEvent.attributionWindow` (default 7 days)
- Charge on click; attribute sale if purchase within window

### 7.3 V4 additive columns on `promotedListing`

| Column | Type | Notes |
|--------|------|-------|
| dailyBudgetCents | integer | null = no daily cap |
| bidCents | integer default 10 | Cost per click in cents |
| campaignId | text FK -> promotionCampaign.id | Optional campaign linkage |

### 7.4 Typesense integration

Boosted listings receive a `_boost` score multiplier in the Typesense search
query. The multiplier is `1 + (boostPercent / 100)`. Listings where
`promotedListing.isActive = true` have the `isPromoted` flag set to `true` in
the Typesense document, and the search client reads this to apply the ranking
boost.

---

## 8. Budget Management

### 8.1 Spend recording (transactional)

1. Read campaign (check status = ACTIVE, budget not exhausted, maxRedemptions not hit)
2. Inside DB transaction:
   a. Increment `spentCents` on `promotionCampaign`
   b. Create `campaignRedemption` record (idempotent on `campaignId + orderId`)
   c. Create `campaignBudgetLog` (action = 'spend')
   d. Check alert threshold -> if exceeded, log alert
   e. Check exhaustion -> if `spentCents >= budgetCents && autoDisableOnExhaust`, log disable
3. Outside transaction: if exhausted, transition campaign to ENDED

### 8.2 Refund flow

When an order with a promotion is refunded:
1. Read `campaignRedemption` for the order
2. Decrement `spentCents` on the campaign
3. Log `campaignBudgetLog` (action = 'refund')
4. Decrement `usageCount` on the promotion

### 8.3 Budget adjustment (staff-only)

- Requires CASL permission `manage` on `PromotionCampaign`
- Logs `campaignBudgetLog` (action = 'adjustment')
- Emits audit event `campaign.budget_adjusted`
- `reason` field is mandatory

---

## 9. BullMQ Scheduling

### 9.1 Queue: `campaign-scheduler`

Lives in `packages/jobs/src/campaign-scheduler.ts`. Registered as a BullMQ
repeatable job in `cron-jobs.ts` with `tz: 'UTC'`.

| Setting key | Default | Purpose |
|-------------|---------|---------|
| `promotions.scheduler.tickPattern` | `* * * * *` | Cron pattern for scheduler tick |

### 9.2 Tick logic

1. Query `scheduledPromoTask` WHERE `scheduledFor <= now() AND status = 'pending'`
2. For each task:
   - `activate`: transition campaign to ACTIVE
   - `deactivate`: transition campaign to ENDED
   - `alert`: send budget alert notification
3. Mark task as completed or failed (with error message)

### 9.3 Budget monitoring job

Separate BullMQ job: `campaign-budget-monitor`. Runs every 5 minutes.
- Checks all ACTIVE campaigns with `budgetCents IS NOT NULL`
- Transitions exhausted campaigns to ENDED if `autoDisableOnExhaust`
- Checks maxRedemptions cap
- Logs budget alerts when threshold exceeded

---

## 10. AI Integration (deferred -- hooks only)

### 10.1 Campaign performance prediction

Future: ML model predicts redemption rate, ROI, and optimal discount level for
a given campaign configuration. V4 installs the hook interface:

```ts
interface CampaignPrediction {
  estimatedRedemptions: number;
  estimatedRevenueLiftCents: number;
  suggestedDiscountPercent: number;
  confidence: number; // 0-1
}
```

### 10.2 Optimal discount suggestion

Future: given a category, season, and historical data, suggest the discount
level that maximizes GMV while respecting margin floors. V4 only defines the
`platform_settings` key for the AI endpoint.

---

## 11. RBAC (CASL Permissions)

### 11.1 Subject: `Promotion`

| Actor | Actions |
|-------|---------|
| Seller | `manage` own promotions (`{ sellerId }` condition) |
| Staff (SUPPORT) | `read` any promotion |
| Staff (SELLER_SUCCESS) | `read` + `manage` for specific seller |
| Platform (ADMIN, OPERATIONS) | `read` all promotions |

### 11.2 Subject: `PromotionCampaign`

| Actor | Actions |
|-------|---------|
| Seller (PRO+) | `create`, `read`, `update` own seller campaigns (`{ sellerId }` condition) |
| Staff (MARKETING) | `read`, `create`, `update` any campaign |
| Staff (FINANCE) | `read`, budget adjustment (`update` with field condition) |
| Staff (ADMIN) | `manage` (includes force activate/deactivate) |
| Staff (OPERATIONS) | `read` |

### 11.3 Subject: `PromotedListing`

| Actor | Actions |
|-------|---------|
| Seller | `manage` own promoted listings (`{ sellerId }` condition) |
| Staff (MARKETING) | `read` all |
| Staff (ADMIN) | `manage` all |

---

## 12. Platform Settings Keys

All promotions settings live in the `platform_settings` table:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `promotions.maxCombinedDiscountPercent` | number | 75 | Max total discount cap |
| `promotions.maxStackedCoupons` | number | 1 | Coupon stacking limit per order |
| `promotions.seller.maxActiveCoupons` | number | 10 | Per-seller active coupon limit |
| `promotions.seller.maxDiscountPercent` | number | 50 | Max seller discount before staff approval |
| `promotions.seller.minTier` | string | PRO | Minimum seller tier to create promotions |
| `promotions.campaign.maxDurationDays` | number | 30 | Max campaign duration |
| `promotions.campaign.budgetAlertDefaultPct` | number | 80 | Default alert threshold |
| `promotions.flashSale.maxDurationHours` | number | 24 | Flash sale max duration |
| `promotions.scheduler.tickPattern` | string | `* * * * *` | Scheduler cron pattern |
| `promotions.budgetMonitor.tickPattern` | string | `*/5 * * * *` | Budget monitor cron pattern |
| `promotions.promotedListing.defaultBidCents` | number | 10 | Default CPC bid |
| `promotions.promotedListing.minBidCents` | number | 5 | Minimum CPC bid |
| `promotions.promotedListing.attributionWindowDays` | number | 7 | Sale attribution window |
| `promotions.ai.predictionEndpoint` | string | (empty) | Future AI prediction endpoint |

---

## 13. Ledger Integration

When a promotion discount is applied at checkout:

```
ledgerEntry {
  type: 'PROMOTION_FEE',
  status: 'POSTED',
  amountCents: discountCents,
  userId: sellerId,
  orderId: orderId,
  memo: 'Promotion discount: {couponCode}',
  idempotencyKey: 'promo:{promotionId}:{orderId}',
}
```

For platform-scope campaigns where the platform absorbs the discount, the entry
credits the seller (they receive full payment) and the platform absorbs the cost.

For seller-scope promotions, the discount is deducted from the seller's payout.

For promoted listings (CPC):
```
ledgerEntry {
  type: 'PROMOTED_LISTING_FEE',
  status: 'POSTED',
  amountCents: -bidCents,
  userId: sellerId,
  memo: 'Promoted listing click: {listingId}',
  idempotencyKey: 'pl_click:{promotedListingEventId}',
}
```

---

## 14. Checkout Integration

Discount application order:
1. Calculate item subtotal (live price lookup per SEC-001)
2. Apply bundle discount (if any BUNDLE_DISCOUNT promotion active)
3. Apply coupon discount on post-bundle subtotal
4. Apply campaign auto-discount (if ACTIVE campaign matches `campaignRule` conditions)
5. Enforce `promotions.maxCombinedDiscountPercent` cap
6. Add shipping (may be $0 if FREE_SHIPPING earned)
7. Add tax on final amount (after all discounts)
8. Post ledger entries

---

## 15. Analytics (read-only queries)

| Metric | Source |
|--------|--------|
| Total usages | COUNT(`campaignRedemption`) WHERE campaignId |
| Unique users | COUNT(DISTINCT `buyerId`) WHERE campaignId |
| Total discount spend | SUM(`discountCents`) WHERE campaignId |
| Average discount | AVG(`discountCents`) WHERE campaignId |
| Budget utilization | `spentCents / budgetCents * 100` |
| Daily usage | GROUP BY date_trunc('day', `createdAt`) |
| Top promotions | GROUP BY `promotionId`, ORDER BY SUM(discountCents) DESC |
| Promoted listing CTR | `clicks / impressions * 100` per promoted listing |
| Promoted listing ROAS | `totalSalesCents / totalFeeCents` |

---

## 16. Audit Events

| Event | Trigger |
|-------|---------|
| `promotion.created` | New promotion created |
| `promotion.coupon.redeemed` | Coupon used at checkout |
| `promotion.coupon.reversed` | Order refunded, redemption reversed |
| `campaign.created` | New campaign created |
| `campaign.status_changed` | Any lifecycle transition |
| `campaign.budget_adjusted` | Staff modifies budget |
| `campaign.budget_exhausted` | Auto-disable triggered |
| `campaign.rule_created` | Campaign rule added |
| `promoted_listing.created` | Seller creates promoted listing |
| `promoted_listing.clicked` | Click event recorded |
| `promoted_listing.attributed` | Sale attributed to promoted listing |

---

## 17. Notifications

| Event | Recipients | Template key |
|-------|-----------|-------------|
| Campaign goes ACTIVE | linked sellers | `campaign.activated` |
| Campaign budget alert | creating staff | `campaign.budget_alert` |
| Campaign ENDED | creating staff + linked sellers | `campaign.ended` |
| Seller promotion approved | seller | `promotion.seller_approved` |
| Promoted listing daily budget hit | seller | `promoted_listing.budget_exhausted` |

---

## 18. Out of Scope

- No affiliate/referral programs (separate domain)
- No dynamic pricing rules (algorithmic price adjustment)
- No A/B testing of promotions (deferred)
- No external coupon aggregator integration
- No multi-currency promotions (USD only per V3 baseline)

---

## 19. Version History

| Version | Date | Changes |
|---------|------|---------|
| 4.0 | 2026-04-09 | V4 merge: V2 phases 22+25 + V3 Drizzle schema + pure promotion engine |
| 4.1 | 2026-04-09 | V4 rewrite: added campaignRule, campaignRedemption, seller promotions, promoted listing CPC model, AI hooks, expanded platform_settings |
