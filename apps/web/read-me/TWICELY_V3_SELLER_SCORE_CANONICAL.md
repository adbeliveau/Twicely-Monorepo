# TWICELY V3 — Seller Score Canonical

**Version:** v1.0
**Status:** LOCKED — single source of truth for seller scoring, performance bands, rewards, enforcement, and dashboard visualization
**Date:** 2026-02-20
**Vocabulary:** PerformanceBand (enum), SellerScore (continuous 0–1000). Never use TrustScore, SellerTier, or SellerRating for this system.

> **Law:** If it isn't in this file, it isn't real for seller scoring. If it conflicts with this file, this file wins.
> **Supersedes:** User Model §4.4 (band table), Feature Lock-in §44 (enforcement tiers), Feature Lock-in §6 (scoring additions) — those docs reference this canonical for scoring specifics.
> **Pricing Authority:** TF rates are based on progressive volume brackets (Pricing Canonical v3.2 §2). No Store tier, no performance band, and no subscription affects TF rates. Performance rewards operate on a separate axis.
> **Review Data:** DSR inputs flow from Feature Lock-in §4 (Detailed Seller Ratings). This doc consumes review data, doesn't define the review system.
> **Enforcement Actions:** This doc defines WHEN enforcement triggers. Feature Lock-in §44 defines WHAT enforcement actions are taken (coaching, warning, restriction, suspension).

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Scoring Engine](#2-scoring-engine)
3. [Performance Bands](#3-performance-bands)
4. [Trend States](#4-trend-states)
5. [Rewards](#5-rewards)
6. [Enforcement Integration](#6-enforcement-integration)
7. [Seller Dashboard](#7-seller-dashboard)
8. [Buyer-Facing Display](#8-buyer-facing-display)
9. [Hub Admin View](#9-hub-admin-view)
10. [Schema](#10-schema)
11. [Platform Settings](#11-platform-settings)
12. [Implementation](#12-implementation)

---

## 1. Design Philosophy

### The eBay Divergence

eBay gates its best seller reward — 10% TF discount — behind a policy concession: sellers must offer same/1-day handling AND 30-day free returns to achieve Top Rated Plus. This conflates "being a good seller" with "offering free returns." Sellers resent it. The program punishes sellers who are excellent at everything but choose not to absorb return shipping costs.

Twicely separates these concerns completely:

- **TF rates** are based on progressive volume brackets (monthly GMV, 8–11%). No Store tier, no performance band, no subscription affects TF. Owned by Pricing Canonical v3.2 §2.
- **Performance rewards** come from being good at selling. Badges, search ranking boosts, operational perks. No fee reductions. Owned by this document.

A TOP_RATED seller pays the same TF rate as an EMERGING seller at the same GMV level. Performance earns visibility and trust signals, not fee reductions. The two axes never interact on pricing.

### No Negative Labels to Buyers

Buyers never see a negative signal about a seller. There are three visible badge tiers (green, gold, purple) or nothing. No "Below Standard" badge, no warning indicators, no declining status. Negative performance is handled through enforcement (visibility reduction, coaching notifications) — never through buyer-facing labels.

### Continuous Score, Discrete Labels

The Seller Score (0–1000) is the mechanical reality. Performance Bands are human-readable labels derived from score ranges. Search multipliers are smooth functions of the score, not stepped functions of the band. No cliff effects when crossing a band boundary.

---

## 2. Scoring Engine

### 2.1 Input Metrics

Six weighted inputs, all calculated on a rolling 90-day window:

| Metric | Weight | Measurement | Why This Weight |
|--------|--------|-------------|----------------|
| On-Time Shipping Rate | 25% | % orders shipped within seller's stated handling time | Most controllable by seller, most impactful on buyer experience |
| INAD Claim Rate | 20% | % orders with Item Not As Described claims | Strongest quality signal — item didn't match listing |
| Review Average (DSR) | 20% | Weighted average of 4 DSR dimensions + overall | Direct buyer satisfaction measurement |
| Response Time | 15% | Median message response time in hours | Communication quality, affects buyer confidence |
| Return Rate (seller-fault) | 10% | % orders returned where bucket = SELLER_FAULT | Quality signal, must be category-adjusted |
| Cancellation Rate | 10% | % orders cancelled by seller | Reliability — seller listed what they couldn't fulfill |

### 2.2 Category-Adjusted Thresholds

Different categories have different baseline performance patterns. An electronics seller with a 4% return rate is performing normally. A clothing seller with 4% has a problem. Thresholds are set per fee bucket via Platform Settings.

| Metric | ELECTRONICS | APPAREL_ACCESSORIES | HOME_GENERAL | COLLECTIBLES_LUXURY |
|--------|------------|--------------------|--------------|--------------------|
| On-Time Shipping (ideal) | ≥ 95% | ≥ 95% | ≥ 95% | ≥ 90% (authentication delays) |
| INAD Rate (ideal) | ≤ 1.5% | ≤ 2.0% | ≤ 2.0% | ≤ 1.0% (higher expectations) |
| Response Time (ideal) | ≤ 4 hours | ≤ 8 hours | ≤ 8 hours | ≤ 4 hours (high-value buyers) |
| Return Rate (ideal) | ≤ 4% | ≤ 3% | ≤ 3% | ≤ 2% |
| Cancellation Rate (ideal) | ≤ 1.5% | ≤ 1.5% | ≤ 1.5% | ≤ 1.0% |

"Ideal" means score 1000 on that metric. Actual thresholds for warning/restriction levels are defined in Platform Settings §11 and follow the ranges from Feature Lock-in §44.

Sellers who list across multiple categories are scored against the primary category of each individual order. The per-metric scores are then weighted by order volume per category before being combined into the final score.

### 2.3 Per-Metric Normalization

Each metric is normalized to 0–1000 using a sigmoid curve centered on the category-specific ideal threshold. This prevents linear scaling issues (the difference between 95% and 96% on-time shipping is NOT the same as the difference between 50% and 51%).

```
metricScore = 1000 / (1 + e^(-k * (value - threshold)))

Where:
  value     = seller's actual metric value
  threshold = category-specific ideal value
  k         = steepness factor (configured per metric in Platform Settings)
```

Sellers at or above the ideal threshold score close to 1000 on that metric. Sellers significantly below score close to 0. The sigmoid prevents a single terrible metric from completely zeroing the overall score while still making poor performance clearly visible.

### 2.4 Bayesian Smoothing

Low-volume sellers must not get artificially extreme scores. A seller with 2 orders (both perfect) is NOT more trustworthy than a seller with 200 orders averaging 4.8 stars.

```
adjustedScore = (rawScore × orderCount + platformMean × smoothingFactor) / (orderCount + smoothingFactor)

Where:
  rawScore        = weighted sum of normalized metric scores
  orderCount      = seller's completed orders in the 90-day window
  platformMean    = global average seller score (recalculated weekly)
  smoothingFactor = 30 (configurable via Platform Settings)
```

Effects by volume:

| Completed Orders | Smoothing Effect |
|-----------------|------------------|
| 5 | Score pulled 86% toward platform mean (almost entirely mean) |
| 15 | Score pulled 67% toward platform mean (mostly mean) |
| 30 | Score pulled 50% toward platform mean (balanced) |
| 60 | Score pulled 33% toward platform mean (mostly actual) |
| 150 | Score pulled 17% toward platform mean (nearly all actual) |
| 500+ | Score pulled < 6% toward platform mean (effectively actual) |

### 2.5 Trend Modifier

A seller whose 30-day metrics are deteriorating should see their score reflect the trajectory, not just the current position.

```
trendModifier = clamp((avg30day - avg90day) / avg90day, -0.05, +0.05)
finalScore = adjustedScore × (1 + trendModifier)
```

Maximum ±5% modification. A seller improving rapidly gets up to +5%. A seller declining rapidly gets up to -5%. Steady sellers get ±0%.

### 2.6 New Seller Handling

Sellers with fewer than 10 completed orders are in `NEW` lifecycle state (not a PerformanceBand value — a UI flag):

- Score is calculated but NOT displayed to the seller as a number
- Band is shown as "NEW" with messaging: "Complete 10 orders to earn your first performance badge"
- Search multiplier fixed at 1.0 (neutral)
- No enforcement applies
- Progress bar shows orders completed toward the 10-order threshold

Between 10 and 49 completed orders, score is fully calculated and displayed, but the search multiplier is clamped to 0.95–1.10 range. No hard demotions during the transitional period.

At 50+ completed orders, full scoring and multiplier range applies.

---

## 3. Performance Bands

### 3.1 Band Definitions

| Score Range | Band Enum | Badge | Badge Color | Buyer-Visible |
|-------------|-----------|-------|-------------|---------------|
| 900–1000 | `POWER_SELLER` | Purple star | #7C3AED (Twicely Amethyst) | Yes |
| 750–899 | `TOP_RATED` | Gold star | #F59E0B | Yes |
| 550–749 | `ESTABLISHED` | Green check | #10B981 | Yes |
| 0–549 | `EMERGING` | None | — | No |
| — | `SUSPENDED` | None | — | No (listings hidden) |

### 3.2 Enum Definition

```typescript
export const performanceBandEnum = pgEnum('performance_band', [
  'POWER_SELLER',
  'TOP_RATED',
  'ESTABLISHED',
  'EMERGING',
  'SUSPENDED',
]);
```

**SUSPENDED** is NOT score-derived. It is an admin action triggered by policy violations (Feature Lock-in §44) or chronic poor performance (90+ days at restriction level). A seller's score can be 800 and they can be SUSPENDED if they committed a policy violation. SUSPENDED overrides any score-derived band.

### 3.3 Search Multiplier

Single global formula. No band-specific floors or ceilings — the band label is cosmetic. The score alone drives the multiplier.

```
if (band === 'SUSPENDED') return 0.0;

searchMultiplier = clamp(score / 800, 0.60, 1.25);
```

| Score | Multiplier | Band (cosmetic) |
|-------|-----------|-----------------|
| 0 | 0.60 | EMERGING |
| 300 | 0.60 | EMERGING |
| 480 | 0.60 | EMERGING |
| 500 | 0.625 | EMERGING |
| 549 | 0.686 | EMERGING |
| 550 | 0.6875 | ESTABLISHED |
| 600 | 0.75 | ESTABLISHED |
| 700 | 0.875 | ESTABLISHED |
| 749 | 0.936 | ESTABLISHED |
| 750 | 0.9375 | TOP_RATED |
| 800 | 1.00 | TOP_RATED |
| 850 | 1.0625 | TOP_RATED |
| 899 | 1.124 | TOP_RATED |
| 900 | 1.125 | POWER_SELLER |
| 950 | 1.1875 | POWER_SELLER |
| 1000 | 1.25 | POWER_SELLER |

The multiplier is continuous and monotonically increasing. No cliff effects at band boundaries. A seller crossing from ESTABLISHED (749) to TOP_RATED (750) sees their multiplier move from 0.936 to 0.9375 — a near-invisible change, not a step function.

**Why no band-specific clamps:** Per-band floor/ceiling clamps reintroduce cliff effects. A floor of 1.00 on TOP_RATED would mean a seller at score 750 (raw 0.9375) jumps to 1.00 — a +0.064 discontinuity. A floor of 0.85 on ESTABLISHED means dropping from 550 to 549 causes a -0.164 crash. Both violate the design principle. The global formula eliminates this entirely.

### 3.4 Band Transition Rules

- Band changes trigger in-app notification: "Congratulations! You've reached TOP_RATED status" or "Your performance status has changed. Here's how to improve."
- Upward transitions are immediate on daily recalc
- Downward transitions have a 7-day grace period — seller must be below the threshold for 7 consecutive daily recalcs before the band changes. This prevents one bad day from dropping a long-term performer.
- SUSPENDED is immediate (admin action, no grace period)
- Band transitions are logged in `seller_performance_snapshots` for audit trail

---

## 4. Trend States

### 4.1 Definition

Trend states are computed on render from score snapshots. They are NOT stored in the database, NOT an enum, and NOT part of the PerformanceBand. They are a visualization layer only.

| Trend | Condition | Icon | Color |
|-------|-----------|------|-------|
| **SURGING** | 30-day avg > 90-day avg by 50+ points | ↑↑ steep arrow | Green |
| **CLIMBING** | 30-day avg > 90-day avg by 10–49 points | ↗ gentle arrow | Green |
| **STEADY** | Within ±10 points | → flat line | Gray |
| **SLIPPING** | 30-day avg < 90-day avg by 10–49 points | ↘ gentle arrow | Yellow |
| **DECLINING** | 30-day avg < 90-day avg by 50+ points | ↓↓ steep arrow | Red |

### 4.2 Computation

```
trend30 = average(last 30 daily scores)
trend90 = average(last 90 daily scores)
delta = trend30 - trend90

if (delta >= 50) return 'SURGING'
if (delta >= 10) return 'CLIMBING'
if (delta <= -50) return 'DECLINING'
if (delta <= -10) return 'SLIPPING'
return 'STEADY'
```

### 4.3 Who Sees Trend

- **Seller:** Always visible on their performance dashboard. Full chart + trend arrow + trend label.
- **Buyers:** NEVER. Buyers see badge or nothing. Trend is internal.
- **Hub admin:** Visible on seller detail page. Helps agents understand seller context during disputes.

---

## 5. Rewards

### 5.1 Reward Table

Every reward was stress-tested against revenue projections at 1K, 10K, and 100K seller scale.

| Reward | POWER_SELLER | TOP_RATED | ESTABLISHED | EMERGING |
|--------|-------------|-----------|-------------|----------|
| Badge on listings + storefront | Purple star | Gold star | Green check | None |
| Tag in search results | "Power Seller" | "Top Seller" | None | None |
| Search multiplier (score/800) | 1.125–1.25x | 0.9375–1.124x | 0.6875–0.936x | 0.60–0.686x |
| Monthly boost credit | **$15** | **$10** | $0 | $0 |
| Priority helpdesk queue | Yes | Yes | No | No |
| Benefit of doubt on claims | All claims manually reviewed | All claims manually reviewed | Standard flow | Standard flow |
| Early access to new features | Yes | No | No | No |
| Seller Protection Score boost | +15 points | +10 points | +5 points | 0 |
| Dedicated support channel | Yes (future) | No | No | No |

### 5.2 Boost Credit Economics

| Scale | POWER_SELLER count (5%) | TOP_RATED count (10%) | Monthly credit pool | As % of est. boost revenue | Verdict |
|-------|------------------------|----------------------|--------------------|--------------------------|---------| 
| 1K sellers | 50 | 100 | $1,750 | 11.7% | Acceptable |
| 10K sellers | 500 | 1,000 | $17,500 | 11.7% | Acceptable |
| 100K sellers | 5,000 | 10,000 | $175,000 | 11.7% | Acceptable — drives adoption |

Boost credits are internal inventory, not cash. They get sellers hooked on boosting — industry data shows 40-60% of users who start with credits convert to paid. At-scale the credit pool is ~12% of boost revenue, which is acceptable customer acquisition cost.

### 5.3 What Is Explicitly NOT a Reward

- ❌ **TF discount.** TF uses progressive volume brackets (Pricing Canonical v3.2 §2) — rates decrease automatically with monthly GMV. No per-tier and no per-band TF discounts exist. Performance + subscription stacking was CFO-rejected.
- ❌ **Shipping rate discounts.** Deferred — depends on Shippo contract structure. Revisit when Shippo volume pricing is negotiated.
- ❌ **Any reward gated behind policy concessions.** No "offer free returns to earn X." No "offer same-day handling to qualify." Rewards are purely metric-driven.
- ❌ **Boost credits for ESTABLISHED.** 35%+ of sellers would qualify — pool too large. CFO rejected.

### 5.4 Boost Credit Mechanics

- Credits issued on the 1st of each month (BullMQ scheduled job)
- Credits expire at end of billing month (no rollover)
- Credits apply before paid boost budget (credits consumed first)
- Credits are NOT transferable and NOT cashable
- If a seller drops below the qualifying band before month-end, credits already issued are NOT clawed back — they expire naturally at month-end
- Ledger entry: `BOOST_CREDIT_ISSUED` with `metadataJson.source = 'PERFORMANCE_REWARD'`

---

## 6. Enforcement Integration

### 6.1 Score-Based Enforcement Triggers

Enforcement operates within the EMERGING band based on score thresholds, NOT based on the band label itself. A seller at EMERGING with score 500 is treated very differently from one at score 150.

| Score Range | Enforcement | Actions |
|-------------|------------|---------|
| 400–549 | **Coaching** | In-app notification with improvement tips per metric. No restrictions. Friendly tone. |
| 250–399 | **Warning** | Email warning. 30-day improvement window. Dashboard shows warning banner. Seller cannot be POWER_SELLER or TOP_RATED even if score improves within warning period. |
| 100–249 | **Restriction** | Listing visibility reduced (search multiplier forced to 0.60). Boosting disabled. No new listings beyond current count. 90-day improvement window. |
| 0–99 | **Pre-Suspension** | All restrictions + account under review. If no improvement in 30 days, escalated to admin for SUSPENDED decision. |

### 6.2 Enforcement Is Additive

A seller can be in enforcement AND have a positive trend. "Your score is 320 (Warning) but CLIMBING ↗." The coaching message adapts: "You're improving! Keep your shipping time above 95% to exit the warning zone in approximately 3 weeks."

### 6.3 Warning Lockout Rule

Sellers with an active Warning cannot achieve POWER_SELLER or TOP_RATED bands, even if their score technically qualifies. They must clear the warning (30-day clean window after all metrics return above threshold) before band promotion.

### 6.4 Policy Violations (Separate System)

Policy violations (counterfeit, prohibited items, shill reviews, fee avoidance, harassment) are NOT score-based. They trigger immediate consequences per Feature Lock-in §44 policy violation table. A seller with score 950 who sells a counterfeit item gets the same treatment as a seller with score 300.

SUSPENDED status from a policy violation overrides the score-derived band entirely. The score continues to be calculated (for potential reinstatement) but the band is locked to SUSPENDED until admin lifts it.

---

## 7. Seller Dashboard

### 7.1 Location

`/my/selling/performance` — accessible from seller dashboard sidebar.

### 7.2 Hero Section

```
┌──────────────────────────────────────────────────────────┐
│  ⭐ TOP_RATED                                            │
│  Score: 812 · ↗ CLIMBING                                │
│                                                          │
│  [═══════════════════════░░░░░] 812 / 900                │
│  88 points to POWER SELLER                              │
└──────────────────────────────────────────────────────────┘
```

- Current band name + badge icon
- Numeric score + trend arrow + trend label
- Progress bar toward next band threshold
- Points remaining to next band
- If seller is POWER_SELLER (top band): progress bar shows "Maintaining Power Seller status" with score within 900–1000 range
- If seller is declining: NO "points to next band" message — just the score and trend. No discouraging projections.

### 7.3 Score Chart (Stock Chart)

90-day line chart. X-axis: date. Y-axis: 0–1000.

Visual elements:
- **Score line:** Primary line in Twicely Amethyst (#7C3AED), 2px weight
- **Band threshold lines:** Horizontal dashed lines at 550 (ESTABLISHED), 750 (TOP_RATED), 900 (POWER_SELLER). Colored to match band badge colors. Labeled on right axis.
- **Band zones:** Subtle background shading per zone. Green tint above 750, neutral above 550, light gray below.
- **Hover tooltip:** Date, score, band at that date, any band transitions highlighted
- **Time range selector:** 30 days / 60 days / 90 days / 6 months / 1 year

Interaction:
- Pinch-to-zoom on mobile
- Hover/tap for exact values on desktop
- Band transition points marked with a dot icon on the chart

### 7.4 Metric Breakdown Cards

Six cards, one per input metric. Each card shows:

```
┌─────────────────────────────────────┐
│  📦 On-Time Shipping                │
│  97.2%  ✅ Top 15% for Electronics  │
│  ↗ +1.3% vs last month             │
│                                     │
│  Threshold: 95%  ·  Your: 97.2%    │
│  [████████████████████░] 972/1000   │
│                                     │
│  Weight: 25% of total score         │
└─────────────────────────────────────┘
```

For underperforming metrics:

```
┌─────────────────────────────────────┐
│  📨 Response Time                   │
│  18.4 hours  ⚠️ Below average       │
│  ↘ +3.2 hours vs last month        │
│                                     │
│  Ideal: ≤ 4 hours  ·  Your: 18.4h  │
│  [████░░░░░░░░░░░░░░░░] 340/1000   │
│                                     │
│  Weight: 15% of total score         │
│                                     │
│  💡 Tip: Enable push notifications  │
│  for new messages to respond faster │
└─────────────────────────────────────┘
```

Coaching tips are contextual, not generic. Each metric has 3-5 pre-written tips that rotate. Tips are stored in Platform Settings as arrays.

### 7.5 Score Projection

Displayed only when trend is CLIMBING or SURGING:

"At your current trajectory, you'll reach TOP_RATED in approximately 45 days."

Linear projection based on trend velocity. Disappears when STEADY, SLIPPING, or DECLINING — no discouraging projections.

### 7.6 Rewards Summary

Below the chart, a card showing current rewards:

```
┌─────────────────────────────────────┐
│  🎁 Your TOP_RATED Rewards          │
│                                     │
│  ✅ Gold badge on all listings      │
│  ✅ "Top Seller" tag in search      │
│  ✅ Search boost: 1.05x             │
│  ✅ $10/mo boost credit (8 remaining│
│  ✅ Priority helpdesk support       │
│  ✅ +10 Seller Protection boost     │
│                                     │
│  🔒 Reach POWER SELLER to unlock:  │
│     · Purple badge                  │
│     · $15/mo boost credit           │
│     · Early access to new features  │
│     · Dedicated support channel     │
└─────────────────────────────────────┘
```

---

## 8. Buyer-Facing Display

### 8.1 What Buyers See

Buyers see THREE badge tiers or NOTHING. No negative indicators ever.

**On listing pages:**
- POWER_SELLER: Purple star badge + "Power Seller" text
- TOP_RATED: Gold star badge + "Top Seller" text
- ESTABLISHED: Green check badge + "Established Seller" text
- EMERGING: Nothing. No badge, no indicator, no "New Seller" tag.

**On storefront pages:**
- Badge displayed next to seller name in header
- "Member since [year]" + "X sales" + badge

**In search results:**
- Badge icon (small) next to seller name
- "Power Seller" or "Top Seller" tag (if applicable)

### 8.2 What Buyers Do NOT See

- ❌ Numeric score
- ❌ Trend direction (CLIMBING, DECLINING, etc.)
- ❌ Any indication of EMERGING status
- ❌ Warning/restriction status
- ❌ Score chart or metrics
- ❌ Any negative label of any kind

### 8.3 Stats Buyers DO See (Storefront)

These are separate from the badge system — factual stats shown regardless of band:

- "Usually ships within X days" (average ship time)
- "Usually responds within X hours" (average response time)
- Overall star rating + review count
- DSR breakdown (4 categories)
- "Member since [year]"
- Total completed sales count

---

## 9. Hub Admin View

### 9.1 Seller Detail Page

Admin sees everything the seller sees PLUS:

- Raw score (not just band)
- All 6 metric values with category-adjusted thresholds highlighted
- Trend state
- Enforcement status (coaching/warning/restriction)
- Score history chart (up to 1 year)
- Band transition log
- Active warnings with expiry dates
- Override controls: admin can manually set band (with reason logged in audit trail)

### 9.2 Platform-Wide Dashboard

`hub.twicely.co/d` (admin dashboard) includes a Seller Health widget:

- Band distribution pie chart (% of sellers per band)
- Average platform score (trend line)
- Sellers entering enforcement (count per week)
- Sellers promoted to TOP_RATED/POWER_SELLER (count per week)

### 9.3 Admin Override

Admins can manually override a seller's band. Use cases:

- New seller with proven external track record → set to ESTABLISHED
- Seller recovering from a platform bug that affected metrics → temporarily set band
- Seller reinstated after wrongful suspension → restore previous band

All overrides are logged with: admin userId, previous band, new band, reason (required text field), timestamp. Overrides expire after 90 days — the score-derived band takes over unless renewed.

---

## 10. Schema

### 10.1 PerformanceBand Enum

```typescript
export const performanceBandEnum = pgEnum('performance_band', [
  'POWER_SELLER',
  'TOP_RATED',
  'ESTABLISHED',
  'EMERGING',
  'SUSPENDED',
]);
```

### 10.2 sellerProfile — Updated Fields

```typescript
// Replace existing performanceBand-related fields:
performanceBand:       performanceBandEnum('performance_band').notNull().default('EMERGING'),
sellerScore:           integer('seller_score').notNull().default(0),
sellerScoreUpdatedAt:  timestamp('seller_score_updated_at'),
isNew:                 boolean('is_new').notNull().default(true),
enforcementLevel:      text('enforcement_level'),      // 'COACHING' | 'WARNING' | 'RESTRICTION' | 'PRE_SUSPENSION' | null
enforcementStartedAt:  timestamp('enforcement_started_at'),
warningExpiresAt:      timestamp('warning_expires_at'),
bandOverride:          performanceBandEnum('band_override'),
bandOverrideExpiresAt: timestamp('band_override_expires_at'),
bandOverrideReason:    text('band_override_reason'),
bandOverrideBy:        uuid('band_override_by').references(() => users.id),
boostCreditCents:      integer('boost_credit_cents').notNull().default(0),
```

### 10.3 seller_performance_snapshots — Daily Snapshot Table

```typescript
export const sellerPerformanceSnapshots = pgTable('seller_performance_snapshots', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  userId:              uuid('user_id').notNull().references(() => users.id),
  snapshotDate:        date('snapshot_date').notNull(),

  // Composite score
  sellerScore:         integer('seller_score').notNull(),
  performanceBand:     performanceBandEnum('performance_band').notNull(),
  searchMultiplier:    real('search_multiplier').notNull(),

  // Raw metric values
  onTimeShippingPct:   real('on_time_shipping_pct'),
  inadClaimRatePct:    real('inad_claim_rate_pct'),
  reviewAverage:       real('review_average'),
  responseTimeHours:   real('response_time_hours'),
  returnRatePct:       real('return_rate_pct'),
  cancellationRatePct: real('cancellation_rate_pct'),

  // Per-metric normalized scores (0-1000)
  shippingScore:       integer('shipping_score'),
  inadScore:           integer('inad_score'),
  reviewScore:         integer('review_score'),
  responseScore:       integer('response_score'),
  returnScore:         integer('return_score'),
  cancellationScore:   integer('cancellation_score'),

  // Context
  orderCount:          integer('order_count').notNull(),
  primaryFeeBucket:    text('primary_fee_bucket'),
  trendModifier:       real('trend_modifier'),
  bayesianSmoothing:   real('bayesian_smoothing'),

  // Band transition tracking
  previousBand:        performanceBandEnum('previous_band'),
  bandChangedAt:       timestamp('band_changed_at'),

  createdAt:           timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userDateIdx: uniqueIndex('seller_perf_user_date_idx').on(table.userId, table.snapshotDate),
  dateIdx: index('seller_perf_date_idx').on(table.snapshotDate),
  bandIdx: index('seller_perf_band_idx').on(table.performanceBand),
}));
```

### 10.4 seller_score_overrides — Audit Table

```typescript
export const sellerScoreOverrides = pgTable('seller_score_overrides', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id').notNull().references(() => users.id),
  adminId:         uuid('admin_id').notNull().references(() => users.id),
  previousBand:    performanceBandEnum('previous_band').notNull(),
  newBand:         performanceBandEnum('new_band').notNull(),
  reason:          text('reason').notNull(),
  expiresAt:       timestamp('expires_at'),
  isActive:        boolean('is_active').notNull().default(true),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  revokedAt:       timestamp('revoked_at'),
  revokedBy:       uuid('revoked_by').references(() => users.id),
});
```

---

## 11. Platform Settings

### 11.1 Score Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `score.smoothingFactor` | number | 30 | Bayesian smoothing factor |
| `score.trendModifierMax` | percent | 0.05 | Maximum trend modifier (±5%) |
| `score.recalcSchedule` | cron | `0 3 * * *` | Daily at 3 AM UTC |
| `score.platformMeanRecalcSchedule` | cron | `0 4 * * 0` | Weekly Sunday 4 AM UTC |
| `score.newSellerOrderThreshold` | number | 10 | Orders before scoring begins |
| `score.transitionOrderThreshold` | number | 50 | Orders before full multiplier range |
| `score.downgradeGraceDays` | number | 7 | Consecutive days below threshold before demotion |

### 11.2 Band Thresholds

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `score.band.powerSeller` | number | 900 | Minimum score for POWER_SELLER |
| `score.band.topRated` | number | 750 | Minimum score for TOP_RATED |
| `score.band.established` | number | 550 | Minimum score for ESTABLISHED |

### 11.3 Metric Weights

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `score.weight.onTimeShipping` | percent | 0.25 | Weight for shipping metric |
| `score.weight.inadRate` | percent | 0.20 | Weight for INAD metric |
| `score.weight.reviewAverage` | percent | 0.20 | Weight for review metric |
| `score.weight.responseTime` | percent | 0.15 | Weight for response time metric |
| `score.weight.returnRate` | percent | 0.10 | Weight for return rate metric |
| `score.weight.cancellationRate` | percent | 0.10 | Weight for cancellation rate metric |

Weights MUST sum to 1.0. Admin UI validates this on save.

### 11.4 Category-Adjusted Thresholds

| Key Pattern | Type | Example Default | Description |
|-------------|------|-----------------|-------------|
| `score.threshold.{feeBucket}.onTimeShipping.ideal` | percent | 0.95 | Ideal on-time rate |
| `score.threshold.{feeBucket}.inadRate.ideal` | percent | 0.02 | Ideal INAD rate |
| `score.threshold.{feeBucket}.responseTime.ideal` | hours | 8 | Ideal response time |
| `score.threshold.{feeBucket}.returnRate.ideal` | percent | 0.03 | Ideal return rate |
| `score.threshold.{feeBucket}.cancellationRate.ideal` | percent | 0.015 | Ideal cancellation rate |
| `score.threshold.{feeBucket}.{metric}.steepness` | number | 10 | Sigmoid steepness factor |

Where `{feeBucket}` is one of: `ELECTRONICS`, `APPAREL_ACCESSORIES`, `HOME_GENERAL`, `COLLECTIBLES_LUXURY`.

### 11.5 Enforcement Thresholds

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `score.enforcement.coachingBelow` | number | 550 | Score triggering coaching |
| `score.enforcement.warningBelow` | number | 400 | Score triggering warning |
| `score.enforcement.restrictionBelow` | number | 250 | Score triggering restriction |
| `score.enforcement.preSuspensionBelow` | number | 100 | Score triggering pre-suspension |
| `score.enforcement.warningDurationDays` | number | 30 | Days to improve during warning |
| `score.enforcement.restrictionDurationDays` | number | 90 | Days before restriction escalates |
| `score.enforcement.preSuspensionDays` | number | 30 | Days before admin review |

### 11.6 Reward Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `score.rewards.powerSellerBoostCreditCents` | cents | 1500 | Monthly boost credit for POWER_SELLER |
| `score.rewards.topRatedBoostCreditCents` | cents | 1000 | Monthly boost credit for TOP_RATED |
| `score.rewards.boostCreditIssueDay` | number | 1 | Day of month to issue credits |
| `score.rewards.boostCreditExpireDays` | number | 30 | Days until credit expires |
| `score.rewards.protectionScoreBoost.powerSeller` | number | 15 | Protection score boost |
| `score.rewards.protectionScoreBoost.topRated` | number | 10 | Protection score boost |
| `score.rewards.protectionScoreBoost.established` | number | 5 | Protection score boost |

### 11.7 Coaching Tips

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `score.tips.onTimeShipping` | string[] | ["Enable shipping reminders...", ...] | Tips for shipping |
| `score.tips.inadRate` | string[] | ["Add more photos showing condition...", ...] | Tips for INAD |
| `score.tips.responseTime` | string[] | ["Enable push notifications...", ...] | Tips for response time |
| `score.tips.returnRate` | string[] | ["Use detailed condition descriptions...", ...] | Tips for returns |
| `score.tips.cancellationRate` | string[] | ["Only list items you have in hand...", ...] | Tips for cancellations |

---

## 12. Implementation

### 12.1 Daily Score Recalculation Job

**Queue:** `seller-score-recalc`
**Schedule:** Daily at 3 AM UTC (`score.recalcSchedule`)
**Concurrency:** 10 workers
**Estimated runtime:** ~5 min at 10K sellers, ~30 min at 100K sellers

```
Job flow:
1. Fetch all sellers with >= 1 completed order
2. For each seller:
   a. Query 90-day metrics (6 queries, all indexed)
   b. Determine primary fee bucket from highest-volume category
   c. Normalize each metric using category thresholds + sigmoid
   d. Apply weights
   e. Apply Bayesian smoothing
   f. Apply trend modifier (from snapshot history)
   g. Derive band from score
   h. Check downgrade grace period (7 consecutive days)
   i. Update sellerProfile.sellerScore and .performanceBand
   j. Insert seller_performance_snapshots row
   k. If band changed: queue notification job
3. After all sellers: update platform mean score
```

### 12.2 Monthly Boost Credit Issuance Job

**Queue:** `boost-credit-issuance`
**Schedule:** 1st of each month at 6 AM UTC

```
Flow:
1. Expire previous month credits (set boostCreditCents = 0 for all sellers)
2. Query sellers with band = POWER_SELLER or TOP_RATED
3. For each: set boostCreditCents, create BOOST_CREDIT_ISSUED ledger entry
```

### 12.3 Required Indexes

```typescript
// On orders (for 90-day metric queries):
orderSellerDateIdx on (orders.sellerId, orders.completedAt)

// On return_requests:
returnSellerBucketIdx on (returnRequests.sellerId, returnRequests.bucket)

// On reviews:
reviewSellerDateIdx on (reviews.sellerId, reviews.createdAt)

// On messages (for response time):
messageSellerResponseIdx on (messages.sellerId, messages.respondedAt)
```

### 12.4 Score as Pure Function

The score calculation MUST be a pure function: same inputs → same output. No randomness, no time-of-day effects, no A/B testing on scoring. The function takes `(metricValues, categoryThresholds, weights, orderCount, platformMean, smoothingFactor, trendData)` and returns `(score, band, multiplier, perMetricScores)`.

Testable with Vitest: seed known metric values, assert expected score. Lives in `src/lib/scoring/calculate-seller-score.ts` (under 300 lines).

### 12.5 Build Phase

| Component | Phase | Depends On |
|-----------|-------|-----------|
| Score calculation pure function | C1 (Ratings) | Review schema exists |
| Daily recalc BullMQ job | C1 | Score function + order/review/return data |
| sellerProfile score fields | C1 | Schema migration |
| seller_performance_snapshots table | C1 | Schema migration |
| Seller dashboard (hero + chart) | D4 (Analytics) | Score data flowing |
| Metric breakdown cards | D4 | Score function |
| Rewards issuance job | D4 | Boost credit mechanics |
| Hub admin seller score view | E3 (Admin Dashboard) | Score data flowing |
| Enforcement integration | Existing (Feature Lock-in §44) | Score thresholds mapped |

---

*This document is the single source of truth for seller scoring. User Model §4.4, Feature Lock-in §44, and Feature Lock-in §6 reference this canonical for all scoring specifics. When conflicts arise, this document wins.*
