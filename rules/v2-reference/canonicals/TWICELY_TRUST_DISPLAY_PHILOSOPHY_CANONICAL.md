# TWICELY_TRUST_DISPLAY_PHILOSOPHY_CANONICAL.md
**Status:** LOCKED (v1.0)  
**Scope:** Trust display philosophy, review weighting, badge system, anti-gaming measures  
**Audience:** All teams, AI agents  
**Depends On:** TWICELY_RATINGS_TRUST_CANONICAL.md, TWICELY_BUYER_EXPERIENCE_CANONICAL.md

---

## 1) Core Philosophy

> **"Stars are for comfort. Trust scores are for truth. Twicely ranks by trust, displays confidence, and never exposes the math."**

### 1.1 The Key Shift

| What Everyone Does | What Twicely Does |
|-------------------|-------------------|
| Simple 5-star averages | Weighted trust computation |
| Lifetime averages that never decay | Recency-weighted (recent behavior matters more) |
| All reviews treated equal | Reviews weighted by order value, dispute status, verification |
| Raw scores publicly exposed | Badges and metrics, never raw numbers |
| Stars everywhere with no context | Contextual trust signals |
| Easy to game with volume/freebies | Gaming-resistant by design |

### 1.2 Two Separate Systems

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERNAL (Platform)                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Trust Score (0-100)                                 │    │
│  │  - Computed from weighted events                     │    │
│  │  - Decays over time                                  │    │
│  │  - Affects search ranking                            │    │
│  │  - Never shown to users                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (Derived, not exposed)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL (Buyers See)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Trust Badges: "Top Rated Seller" ⭐                 │    │
│  │  Display Stars: 4.8 (derived from trust band)        │    │
│  │  Metrics: "98% on-time shipping"                     │    │
│  │  - Simple, confidence-building                       │    │
│  │  - No raw scores or formulas                         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2) Review Weighting System

### 2.1 Principle

Not all reviews are equal. A 5-star review from a verified $200 purchase with no disputes counts significantly more than a 5-star review from an unverified $3 purchase.

### 2.2 Weight Factors

| Factor | Range | Logic |
|--------|-------|-------|
| **Order Value** | 0.5x - 1.5x | Higher value orders indicate more meaningful transactions |
| **Dispute Status** | 0.3x - 1.0x | Disputed orders are less reliable signals |
| **Recency** | 0.1x - 1.0x | Recent reviews matter more (90-day half-life) |
| **Verification** | 0.5x - 1.0x | Verified purchases are more trustworthy |
| **Review Quality** | 0.8x - 1.2x | Photos and detailed comments indicate genuine feedback |

### 2.3 Order Value Tiers

| Order Value | Weight Multiplier | Rationale |
|-------------|-------------------|-----------|
| < $5 | 0.5x | Trivial purchases, easy to fake |
| $5 - $19 | 1.0x | Baseline |
| $20 - $49 | 1.1x | Meaningful purchase |
| $50 - $99 | 1.3x | Significant purchase |
| $100+ | 1.5x | High-value, high-trust signal |

### 2.4 Dispute Impact

| Dispute Outcome | Weight Multiplier | Rationale |
|-----------------|-------------------|-----------|
| No dispute | 1.0x | Normal transaction |
| Seller won | 0.7x | Buyer may have been unreasonable |
| Split decision | 0.5x | Uncertain situation |
| Buyer won | 0.3x | Transaction had problems |

### 2.5 Weight Calculation

```
Final Weight = OrderValue × Dispute × Recency × Verification × Quality
```

**Example:**
- $75 order (1.3x) × no dispute (1.0x) × 30 days old (0.79x) × verified (1.0x) × has photos (1.1x)
- Final Weight = 1.3 × 1.0 × 0.79 × 1.0 × 1.1 = **1.13**

This review counts 13% more than a baseline review.

---

## 3) Display Stars (Derived, Not Averaged)

### 3.1 The Problem with Raw Averages

Raw star averages are:
- Easy to manipulate with volume
- Misleading (4.2 vs 4.3 means nothing to buyers)
- Static (old reviews count same as new)
- Context-free (100 reviews vs 5 reviews shown same way)

### 3.2 Twicely Approach: Stars from Trust Bands

Display stars are **derived from the seller's trust band**, not calculated from raw review averages.

| Trust Band | Display Stars | Shown? |
|------------|---------------|--------|
| EXCELLENT | 5.0 ⭐ | Yes |
| GOOD | 4.5 ⭐ | Yes |
| WATCH | 4.0 ⭐ | Yes (no badge) |
| LIMITED | — | No stars shown |
| RESTRICTED | — | No stars shown |

### 3.3 Minimum Review Threshold

Stars are only shown if the seller has **≥ 5 reviews** in the display window. New sellers show "New Seller" badge instead.

### 3.4 Why This Works

- Buyers see familiar star format
- Stars reflect actual trust, not gaming
- Consistent signal across the platform
- Bad sellers don't get stars at all (not low stars)

---

## 4) Trust Badge System

### 4.1 Available Badges

| Badge | Icon | Requirement | Display Text |
|-------|------|-------------|--------------|
| **Top Rated** | ⭐ | Trust band = EXCELLENT AND orders ≥ 50 | "Top Rated Seller" |
| **Reliable** | ✔️ | Trust band ≥ GOOD AND on-time ≥ 95% | "Reliable Seller" |
| **Fast Shipper** | 🚀 | Avg ship time < 24h (30 days) | "Fast Shipper" |
| **Responsive** | 💬 | Avg response < 4h (30 days) | "Quick Responder" |
| **Rising** | 🌟 | Trust band ≥ GOOD AND orders 10-49 | "Rising Seller" |

### 4.2 Badge Priority

Sellers can earn multiple badges but only **one primary badge** is shown in compact views (search results, listing cards). Priority order:

1. Top Rated (highest)
2. Reliable
3. Fast Shipper
4. Responsive
5. Rising (lowest)

Full badge list shown on seller profile page.

### 4.3 Critical Rule: NO Negative Labels

**NEVER show buyers:**
- ❌ "Below Standard"
- ❌ "Limited Seller"
- ❌ "Restricted"
- ❌ "Warning"
- ❌ "Under Review"
- ❌ Any star rating below 4.0
- ❌ Red/yellow warning colors

**Bad sellers simply have NO badge.** The absence of a badge is the signal.

### 4.4 Badge Loss

Badges can be lost if:
- Trust score drops below threshold
- Metrics fall below requirements
- Policy violation occurs

Badge loss is **not announced** to buyers. The badge simply disappears.

---

## 5) Buyer-Visible Metrics

### 5.1 What Buyers CAN See

| Metric | Format | Example |
|--------|--------|---------|
| On-time shipping | Percentage | "98% on-time shipping" |
| Response time | Human text | "Usually responds within 4 hours" |
| Sales count | Number | "1,234 sales" |
| Member since | Year | "Member since 2023" |
| Review count | Number | "156 reviews" |

### 5.2 What Buyers CANNOT See

| Hidden Data | Reason |
|-------------|--------|
| Trust score (0-100) | Internal ranking signal |
| Trust band name | Could be gamed |
| Exact dispute rate | Negative framing |
| Review weights | Proprietary |
| Decay calculations | Too complex |
| Search ranking factors | Competitive |

### 5.3 Metric Display Rules

- **Always round favorably:** 97.6% → "98%"
- **Use human language:** "4 hours" not "3.7 hours"
- **Hide bad metrics:** Don't show "2% dispute rate" - just don't mention disputes
- **Context matters:** "98% on-time (last 90 days)" is better than just "98%"

---

## 6) Anti-Gaming Measures

### 6.1 Volume Gaming Prevention

**Attack:** Seller generates many cheap orders with friends for 5-star reviews.

**Defense:** 
- Low-value orders (< $5) have 0.5x weight
- Unverified purchases have 0.5x weight
- Combined: a fake $2 unverified review = 0.25x weight

### 6.2 Review Bombing Prevention

**Attack:** Competitor or angry buyer leaves multiple bad reviews.

**Defense:**
- One review per order (enforced at DB level)
- Reviews require completed order
- Unusual patterns flagged for review

### 6.3 Decay Prevents "Banking"

**Attack:** Seller builds great reputation, then quality drops.

**Defense:**
- 90-day half-life on all events
- Recent behavior always matters more
- Trust score reflects current reality

### 6.4 Dispute Awareness

**Attack:** Seller resolves disputes off-platform to avoid record.

**Defense:**
- Dispute history affects all reviews from that order
- Even seller-won disputes reduce review weight
- Pattern of disputes affects trust score directly

---

## 7) Trust Affects Everything

### 7.1 Search Ranking

Trust score directly multiplies search relevance:

```
Final Score = Relevance × Trust Multiplier
```

Bad actors don't just "look worse" - they **disappear** from results.

### 7.2 Visibility

| Trust Band | Search Visibility |
|------------|-------------------|
| EXCELLENT | Full + boost |
| GOOD | Full |
| WATCH | Reduced (0.85x - 0.95x) |
| LIMITED | Heavily reduced (0.6x - 0.8x) |
| RESTRICTED | Removed from search |

### 7.3 Feature Eligibility

| Feature | Minimum Trust |
|---------|---------------|
| Promoted listings | GOOD |
| Featured placement | EXCELLENT |
| Priority support | GOOD |
| Beta features | GOOD |

---

## 8) Implementation Requirements

### 8.1 Review Creation

When a review is created:
1. Capture order value snapshot
2. Check for disputes on order
3. Compute weight factors
4. Store weight with review
5. Emit trust event with weight

### 8.2 Trust Computation

When computing trust score:
1. Fetch all trust events for seller
2. Apply decay to each event
3. For review events, apply stored weight
4. Sum weighted deltas from baseline
5. Clamp to 0-100

### 8.3 Badge Computation

When computing badges:
1. Get current trust band
2. Get current metrics (on-time, response time)
3. Check each badge requirement
4. Return highest-priority earned badge

### 8.4 Public Metrics Update

Daily job:
1. Compute all buyer-visible metrics
2. Derive display stars from trust band
3. Compute current badge
4. Update SellerPublicMetrics record

---

## 9) Settings (Corp Admin)

All thresholds are configurable:

| Setting | Default | Description |
|---------|---------|-------------|
| `orderValueTier1Max` | 499 | Cents threshold for 0.5x weight |
| `orderValueTier5Min` | 10000 | Cents threshold for 1.5x weight |
| `disputeBuyerFavorWeight` | 0.3 | Weight for buyer-won disputes |
| `decayHalfLifeDays` | 90 | Days for 50% decay |
| `minReviewsForStars` | 5 | Reviews needed to show stars |
| `badgeTopRatedMinOrders` | 50 | Orders for Top Rated badge |

---

## 10) Audit Requirements

All trust-related actions must be audited:

- Review created (with weight factors)
- Trust score recomputed
- Badge earned/lost
- Public metrics updated
- Trust settings changed

---

## 11) Final Rules

1. **Trust score is NEVER shown to users** - not buyers, not sellers
2. **Stars are derived from trust bands** - never raw averages
3. **Bad sellers get NO badge** - not negative labels
4. **Recent behavior > old praise** - decay is non-negotiable
5. **High-value transactions count more** - anti-gaming by design
6. **Transparency without exposure** - show metrics, hide formulas

---

## 12) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-24 | Initial canonical |

---

# END CANONICAL
