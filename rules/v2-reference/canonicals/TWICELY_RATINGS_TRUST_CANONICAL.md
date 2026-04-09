# TWICELY_RATINGS_TRUST_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Ratings, seller trust scoring, decay, thresholds, badges, and direct integration into Search/Browse/Discovery ranking pipeline.  
**Audience:** Trust & Safety, Search, Marketplace, Payments/Ops, and AI agents.  
**Non-Goal:** UI styling; this defines behavior + data + settings.

---

## 1) Purpose

This canonical defines how Twicely measures and uses seller trust:
- what buyers see (ratings)
- what the platform uses (trust score)
- what gets gated (eligibility)
- what gets boosted/suppressed (ranking)

**Cap-only rule (launch default):** sellers with low volume are **not demoted** by trust; trust effects are capped to neutral until the seller reaches the minimum volume threshold.

---

## 2) Core Principles

1. **Separate signals:** buyer-visible rating ≠ internal trust score.
2. **Negative events weigh more** than positive events.
3. **Recency matters:** old events decay.
4. **Volume normalization:** low volume is capped (growth-friendly).
5. **Trust affects discovery in a gated pipeline:** eligibility first, then ranking multiplier.
6. **Everything is configurable via a settings page** (effective-dated), but defaults are locked in v1.

---

## 3) Data Concepts

### 3.1 Buyer-Visible Rating (Public)
- 1–5 stars
- computed from completed orders with eligible reviews
- recency-weighted average, rounded to 0.1
- displayed on seller/store surfaces and listing cards

### 3.2 Internal Trust Score (Platform, 0–100)
Authoritative score used for:
- search ranking multiplier
- eligibility gating
- seller health bands
- enforcement triggers

### 3.3 Risk Flags (Binary / Escalation)
Used for:
- payout holds
- manual review queues
- visibility gating (hard)

---

## 4) Trust Events (Canonical Inputs)

Trust is computed from **events**. Events must be:
- idempotent
- timestamped
- attributable to an order (where applicable)

### 4.1 Required Trust Event Types (v1)

| Event Type | Source | Notes |
|---|---|---|
| `review.submitted` | buyer | eligible after COMPLETED |
| `order.late_shipment` | system | computed from SLA |
| `order.canceled_by_seller` | seller | reason required |
| `dispute.opened` | buyer/provider | |
| `dispute.closed_seller_fault` | staff/system | stronger negative |
| `policy.violation` | trust | strongest negative |
| `chargeback` | provider | strong negative |
| `refund` | seller/support | negative depends on reason |

---

## 5) Default Thresholds & Bands (v1)

### 5.1 Volume Thresholds (Cap-only)
These thresholds control how much trust can affect discovery.

| Completed Orders (rolling) | Trust effect in search |
|---:|---|
| `< 10` | **CAPPED to neutral** (multiplier = 1.0) |
| `10–49` | **CAPPED range** (multiplier limited) |
| `>= 50` | Full trust weighting |

> “Completed orders” means `order.status == COMPLETED` within the volume window.

### 5.2 Trust Bands (Internal)
Trust score is mapped to a band:

| Score | Band | Notes |
|---:|---|---|
| 90–100 | EXCELLENT | eligible for best boost |
| 75–89 | GOOD | neutral/positive |
| 60–74 | WATCH | soft suppression begins (full-volume only) |
| 40–59 | LIMITED | strong suppression (full-volume only) |
| < 40 | RESTRICTED | eligibility loss (hard gate) |

**Cap-only rule:** if seller is below volume thresholds, we do not demote below neutral. Restricted eligibility still applies for severe policy/risk flags.

---

## 6) Decay Rules (Recency Weighting)

Each event has a weight that decays over time:

### 6.1 Exponential Decay (default)
```ts
// daysHalfLife controls how quickly old events matter less
export function decayWeight(daysSince: number, daysHalfLife: number): number {
  // half-life model: weight halves every `daysHalfLife` days
  return Math.pow(0.5, daysSince / daysHalfLife);
}
```

**Default:** `daysHalfLife = 90`

Interpretation:
- ~90 days: event weight is 50%
- ~180 days: 25%
- ~360 days: ~6%

---

## 7) Trust Scoring Model (v1)

Trust score is computed from a weighted baseline with event deltas.

### 7.1 Baseline
- Start at `BASE_SCORE = 80` for all sellers

### 7.2 Event Impact Weights (defaults)
These are **deltas** applied after decay.

#### Reviews (non-linear)
| Stars | Delta |
|---:|---:|
| 5 | +1.0 |
| 4 | +0.5 |
| 3 | -1.5 |
| 2 | -4.0 |
| 1 | -7.0 |

#### Operational / Risk Events
| Event | Delta |
|---|---:|
| late shipment | -2.0 |
| seller cancel | -3.0 |
| refund (seller fault) | -4.0 |
| dispute opened | -2.0 |
| dispute closed seller fault | -6.0 |
| chargeback | -8.0 |
| policy violation | -12.0 |

### 7.3 Score Bounds
- Clamp to `[0, 100]`

```ts
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
```

---

## 8) Compute Trust Score (TypeScript)

### 8.1 Types
```ts
export type TrustBand = "EXCELLENT" | "GOOD" | "WATCH" | "LIMITED" | "RESTRICTED";
export type TrustEventType =
  | "review.submitted"
  | "order.late_shipment"
  | "order.canceled_by_seller"
  | "refund"
  | "dispute.opened"
  | "dispute.closed_seller_fault"
  | "chargeback"
  | "policy.violation";

export type TrustEvent = {
  id: string;
  sellerId: string;
  type: TrustEventType;
  occurredAt: string; // ISO
  orderId?: string;
  meta?: Record<string, any>; // e.g. stars, reason codes
};
```

### 8.2 Settings Snapshot (effective-dated)
```ts
export type TrustSettingsSnapshot = {
  id: string;
  version: string;
  effectiveAt: string;

  baseScore: number;              // default 80
  daysHalfLife: number;           // default 90
  volumeWindowDays: number;       // default 90

  minOrdersNeutralCap: number;    // default 10
  minOrdersFullWeight: number;    // default 50

  multipliers: {
    EXCELLENT: { min: number; max: number };
    GOOD:      { min: number; max: number };
    WATCH:     { min: number; max: number };
    LIMITED:   { min: number; max: number };
    RESTRICTED:{ min: number; max: number };
  };

  // cap-only ranges
  cappedRange: {
    between10And49: { min: number; max: number }; // e.g. 0.95..1.10
  };

  deltas: {
    review: Record<1|2|3|4|5, number>;
    lateShipment: number;
    sellerCancel: number;
    refundSellerFault: number;
    disputeOpened: number;
    disputeSellerFault: number;
    chargeback: number;
    policyViolation: number;
  };

  restrictedHardGateScore: number; // default 40 (below becomes hard gate)
};
```

### 8.3 Scoring function
```ts
function daysSince(iso: string): number {
  const ms = Date.now() - Date.parse(iso);
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function trustDeltaForEvent(e: TrustEvent, s: TrustSettingsSnapshot): number {
  switch (e.type) {
    case "review.submitted": {
      const stars = (e.meta?.stars ?? 5) as 1|2|3|4|5;
      return s.deltas.review[stars];
    }
    case "order.late_shipment": return s.deltas.lateShipment;
    case "order.canceled_by_seller": return s.deltas.sellerCancel;
    case "refund": {
      const sellerFault = Boolean(e.meta?.sellerFault);
      return sellerFault ? s.deltas.refundSellerFault : 0;
    }
    case "dispute.opened": return s.deltas.disputeOpened;
    case "dispute.closed_seller_fault": return s.deltas.disputeSellerFault;
    case "chargeback": return s.deltas.chargeback;
    case "policy.violation": return s.deltas.policyViolation;
    default: return 0;
  }
}

export function computeTrustScore(events: TrustEvent[], settings: TrustSettingsSnapshot): number {
  let score = settings.baseScore;

  for (const e of events) {
    const w = decayWeight(daysSince(e.occurredAt), settings.daysHalfLife);
    score += trustDeltaForEvent(e, settings) * w;
  }

  return clampScore(score);
}

export function trustBand(score: number): TrustBand {
  if (score < 40) return "RESTRICTED";
  if (score < 60) return "LIMITED";
  if (score < 75) return "WATCH";
  if (score < 90) return "GOOD";
  return "EXCELLENT";
}
```

---

## 9) Search Pipeline Integration (Direct Mapping)

This section **maps trust → discovery**.

### 9.1 Pipeline stages (authoritative)
1) **Listing eligibility** (from Listings canonical)  
2) **Seller trust gating** (hard gate)  
3) **Relevance scoring** (text/category/filters)  
4) **Trust multiplier** (soft)  
5) **Final ordering**  
6) **Sponsored injection** (if enabled, clearly labeled)  

### 9.2 Hard gate (eligibility removal)
A listing is removed from results if:
- listing is ineligible (non-ACTIVE, missing attrs, etc.)
- seller is restricted by policy/risk flag
- trust score < `restrictedHardGateScore` **AND** seller meets full enforcement criteria (e.g., severe events)

```ts
export function isSellerSearchEligible(args: {
  trustScore: number;
  hasHardRiskFlag: boolean;
  settings: TrustSettingsSnapshot;
}): boolean {
  if (args.hasHardRiskFlag) return false;
  if (args.trustScore < args.settings.restrictedHardGateScore) return false;
  return true;
}
```

### 9.3 Trust multiplier (soft ranking modifier)
We apply a multiplier after relevance, but with cap-only protection.

**Default multipliers (full-weight sellers >= 50 completed orders):**
- EXCELLENT: 1.10–1.25
- GOOD: 1.00–1.05
- WATCH: 0.85–0.95
- LIMITED: 0.60–0.80
- RESTRICTED: 0.00 (should have been gated already)

**Cap-only rules:**
- `< 10 completed orders`: multiplier forced to **1.0**
- `10–49 completed orders`: multiplier clamped to **0.95–1.10** (no hard demotion)

```ts
export function computeTrustMultiplier(args: {
  band: TrustBand;
  completedOrdersInWindow: number;
  settings: TrustSettingsSnapshot;
}): number {
  const n = args.completedOrdersInWindow;

  // cap-only (growth friendly)
  if (n < args.settings.minOrdersNeutralCap) return 1.0;

  if (n < args.settings.minOrdersFullWeight) {
    // 10–49: clamp to a narrow band (no demotion below capped min)
    const r = args.settings.cappedRange.between10And49;
    // pick mid as default; callers may compute based on score position
    const mid = (r.min + r.max) / 2;
    return mid;
  }

  const m = args.settings.multipliers[args.band];
  return (m.min + m.max) / 2;
}
```

### 9.4 Final ranking formula (v1)
```ts
export function finalSearchScore(args: {
  relevanceScore: number;
  trustMultiplier: number;
}): number {
  return args.relevanceScore * args.trustMultiplier;
}
```

**Important:** trust never overrides filters, category constraints, or listing eligibility.

---

## 10) Buyer-Visible Rating Computation (Public)

Public rating is a recency-weighted average of stars from eligible reviews.

```ts
export function computePublicRating(reviews: Array<{ stars: 1|2|3|4|5; occurredAt: string }>, halfLifeDays = 180) {
  let num = 0;
  let den = 0;

  for (const r of reviews) {
    const w = decayWeight(daysSince(r.occurredAt), halfLifeDays);
    num += r.stars * w;
    den += w;
  }

  const avg = den === 0 ? 0 : num / den;
  return Math.round(avg * 10) / 10; // one decimal place
}
```

---

## 11) Badges (Derived, Not Causal)

Badges are computed from data and do not directly change trust score.

Examples (v1):
- **Fast Shipper**: p95(shipTime) <= SLA threshold for last 30 days
- **Trusted Seller**: trust band EXCELLENT and >= full volume threshold
- **New Seller**: completedOrders < 10

Badges are display-only signals.

---

## 12) Settings Page (Corp Hub) — Required

All thresholds, decay, and multipliers MUST be editable via a settings page with effective-dated versioning.

### 12.1 Routes (suggested)
- `GET /corp/api/trust/settings/current`
- `POST /corp/api/trust/settings` (create new version)
- `GET /corp/trust/settings` (UI)

### 12.2 Zod schema (TS)
```ts
import { z } from "zod";

export const TrustSettingsSchema = z.object({
  version: z.string().min(1),
  effectiveAt: z.string().datetime(),

  baseScore: z.number().min(0).max(100),
  daysHalfLife: z.number().int().min(7).max(365),
  volumeWindowDays: z.number().int().min(30).max(365),

  minOrdersNeutralCap: z.number().int().min(1).max(100),
  minOrdersFullWeight: z.number().int().min(10).max(500),

  restrictedHardGateScore: z.number().min(0).max(100),

  multipliers: z.object({
    EXCELLENT: z.object({ min: z.number(), max: z.number() }),
    GOOD: z.object({ min: z.number(), max: z.number() }),
    WATCH: z.object({ min: z.number(), max: z.number() }),
    LIMITED: z.object({ min: z.number(), max: z.number() }),
    RESTRICTED: z.object({ min: z.number(), max: z.number() }),
  }),

  cappedRange: z.object({
    between10And49: z.object({ min: z.number(), max: z.number() }),
  }),

  deltas: z.object({
    review: z.object({
      1: z.number(), 2: z.number(), 3: z.number(), 4: z.number(), 5: z.number(),
    }).transform((v) => v as any),
    lateShipment: z.number(),
    sellerCancel: z.number(),
    refundSellerFault: z.number(),
    disputeOpened: z.number(),
    disputeSellerFault: z.number(),
    chargeback: z.number(),
    policyViolation: z.number(),
  }),
});
```

### 12.3 Persistence (Prisma model)
```prisma
model TrustSettings {
  id          String   @id @default(cuid())
  version     String
  effectiveAt DateTime
  isActive    Boolean  @default(true)

  settingsJson Json
  createdByStaffId String
  createdAt   DateTime @default(now())

  @@index([effectiveAt])
}
```

### 12.4 Selecting effective settings
Always choose the latest active settings where `effectiveAt <= now`.

```ts
export async function getActiveTrustSettings(): Promise<TrustSettingsSnapshot> {
  const row = await prisma.trustSettings.findFirst({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });
  if (!row) throw new Error("TRUST_SETTINGS_MISSING");
  return row.settingsJson as any;
}
```

---

## 13) RBAC (Staff)

**Authorization:** Trust settings are governed by **PlatformRole** only.

Required roles:
- **View trust settings:** PlatformRole.ADMIN
- **Modify trust settings:** PlatformRole.ADMIN *(high impact; audited)*
- **Trust enforcement actions:** PlatformRole.ADMIN | PlatformRole.MODERATION *(separate from settings)*

**Note:** Do NOT use invented permission keys like `trust.settings.read`, `trust.settings.write`, or `trust.enforce`. Use PlatformRole authorization only.

All settings changes MUST emit an AuditEvent with `reasonCode`.

---

## 14) Observability & Health Provider

System Health provider (recommended) checks:
- trust settings present and active
- trust scoring job lag (if batch recompute exists)
- anomaly counts (spikes in policy violations or disputes)

---

## 15) Acceptance Checklist (v1)

- [ ] Public rating computed from eligible reviews only
- [ ] Trust score computed from events with decay
- [ ] Trust score clamped 0–100
- [ ] Band mapping correct
- [ ] Cap-only behavior enforced (<10 multiplier = 1.0; 10–49 clamped)
- [ ] Restricted gating removes sellers from search
- [ ] Settings page exists (effective-dated)
- [ ] Settings changes audited
- [ ] Search ranking uses `final = relevance * multiplier`
- [ ] Trust never bypasses listing eligibility filters

---

## 16) Final Rule

Trust controls **visibility** and **confidence**.
It must be transparent in configuration, strict in enforcement, and safe for new sellers via cap-only protection.
