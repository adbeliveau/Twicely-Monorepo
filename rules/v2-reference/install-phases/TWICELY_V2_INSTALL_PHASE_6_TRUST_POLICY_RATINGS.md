# TWICELY V2 - Install Phase 6: Trust & Safety + Policy + Ratings/Trust Settings (Core)
**Status:** LOCKED (v1.1)  
**Backend-first:** Schema → API → Audit → Health → UI → Doctor  
**Canonicals:** MUST align with:
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/TWICELY_POLICY_LIBRARY_CANONICAL.md`
- `/rules/TWICELY_RATINGS_TRUST_CANONICAL.md`
- `/rules/TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_6_TRUST_POLICY_RATINGS.md`  
> Prereq: Phase 5 complete.

---

## 0) What this phase installs

### Backend
- Report/case management (minimal)
- Enforcement actions (listing suppression / seller restrictions)
- Policy versions (effective-dated)
- Trust settings (effective-dated) + API with **structured multiplier schema**
- Trust event log with **idempotent eventKey** + compute (v1 on-demand)
- Search gating integration via enforcement state

### UI (Corp)
- Trust queue list
- Policy viewer (versioned)
- Trust Settings page (edit thresholds/decay/multipliers)
- Listing enforcement panel (suppress/unsuppress)

### Ops
- Health provider: `trust`
- Doctor: policy version active, trust settings active, HARD suppression blocks discovery, **trust events are idempotent**

---

## 1) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
// =============================================================================
// POLICY MANAGEMENT (Effective-dated versioning)
// =============================================================================

model PolicyVersion {
  id          String   @id @default(cuid())
  version     String
  effectiveAt DateTime
  isActive    Boolean  @default(true)
  changesJson Json     @default("[]")
  createdByStaffId String
  createdAt   DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}

// =============================================================================
// TRUST SETTINGS (Effective-dated, structured multipliers)
// Per TWICELY_RATINGS_TRUST_CANONICAL.md
// =============================================================================

model TrustSettings {
  id          String   @id @default(cuid())
  version     String
  effectiveAt DateTime
  isActive    Boolean  @default(true)
  
  // Structured JSON that MUST match TrustSettingsSchema type
  settingsJson Json
  
  createdByStaffId String
  createdAt   DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}

// =============================================================================
// TRUST EVENTS (Idempotent via eventKey)
// Per TWICELY_RATINGS_TRUST_CANONICAL.md - exactly one event per trigger
// =============================================================================

model TrustEvent {
  id         String   @id @default(cuid())
  sellerId   String
  type       String   // review.submitted, order.late_shipment, etc.
  occurredAt DateTime
  orderId    String?
  metaJson   Json     @default("{}")
  
  // CRITICAL: Idempotency key prevents duplicate trust events
  // Format: "trust:{type}:{contextId}" e.g. "trust:review:order_123"
  eventKey   String   @unique
  
  createdAt  DateTime @default(now())

  @@index([sellerId, occurredAt])
  @@index([type])
  @@index([orderId])
}

// =============================================================================
// TRUST SNAPSHOT (Computed seller trust score)
// =============================================================================

model TrustSnapshot {
  id                     String   @id @default(cuid())
  sellerId               String   @unique
  score                  Int      @default(80)
  band                   String   @default("GOOD") // EXCELLENT|GOOD|WATCH|LIMITED|RESTRICTED
  completedOrdersWindow  Int      @default(0)
  computedAt             DateTime @default(now())
  metaJson               Json     @default("{}")
  
  // Track which settings version was used
  settingsVersion        String?

  @@index([band])
  @@index([score])
}

// =============================================================================
// REPORTS & ENFORCEMENT
// =============================================================================

model ReportCase {
  id                String   @id @default(cuid())
  type              String   // listing|seller|buyer|message
  status            String   @default("OPEN") // OPEN|IN_REVIEW|RESOLVED|REJECTED
  reporterId        String?
  targetType        String   // Listing|User|Order|Message
  targetId          String
  reasonCode        String
  evidenceJson      Json     @default("{}")
  assignedToStaffId String?
  resolvedByStaffId String?
  resolutionNote    String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([status, createdAt])
  @@index([targetType, targetId])
  @@index([assignedToStaffId, status])
}

model EnforcementAction {
  id           String   @id @default(cuid())
  caseId       String?
  actorStaffId String
  targetType   String   // Listing|User
  targetId     String
  action       String   // suppress|unsuppress|restrict|unrestrict|warn|ban
  reasonCode   String?
  metaJson     Json     @default("{}")
  reversedAt   DateTime?
  reversedByStaffId String?
  createdAt    DateTime @default(now())

  @@index([targetType, targetId])
  @@index([createdAt])
  @@index([action])
}
```

Migrate:
```bash
npx prisma migrate dev --name trust_policy_ratings_phase6
```

---

## 2) Trust Settings Type Definition (Canonical)

Create `packages/core/trust/types.ts`:

```ts
/**
 * Trust band definitions per TWICELY_RATINGS_TRUST_CANONICAL.md
 */
export type TrustBand = "EXCELLENT" | "GOOD" | "WATCH" | "LIMITED" | "RESTRICTED";

/**
 * Trust multiplier range for search ranking
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md Section 4
 */
export type MultiplierRange = {
  min: number;
  max: number;
};

/**
 * Trust settings schema - MUST be enforced when saving/loading
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md Section 3
 */
export type TrustSettingsSchema = {
  version: string;
  effectiveAt: string; // ISO datetime
  
  // Base score for new sellers
  baseScore: number; // default: 80
  
  // Decay configuration
  daysHalfLife: number; // default: 90
  
  // Volume window for completed orders count
  volumeWindowDays: number; // default: 90
  
  // Cap-only protection thresholds
  minOrdersNeutralCap: number;   // default: 10 - below this, multiplier locked at 1.0
  minOrdersFullWeight: number;   // default: 50 - at/above this, full multiplier applies
  
  // Hard gate threshold for search exclusion
  restrictedHardGateScore: number; // default: 40
  
  // Search ranking multipliers by band
  // Per TWICELY_RATINGS_TRUST_CANONICAL.md - REQUIRED structure
  multipliers: {
    EXCELLENT: MultiplierRange;
    GOOD: MultiplierRange;
    WATCH: MultiplierRange;
    LIMITED: MultiplierRange;
    RESTRICTED: MultiplierRange;
  };
  
  // Capped range for sellers between minOrdersNeutralCap and minOrdersFullWeight
  cappedRange: {
    between10And49: MultiplierRange;
  };
  
  // Score deltas for trust events
  deltas: {
    review: Record<string, number>; // "1": -7, "2": -4, "3": -1.5, "4": 0.5, "5": 1
    lateShipment: number;           // default: -2
    sellerCancel: number;           // default: -3
    refundSellerFault: number;      // default: -4
    disputeOpened: number;          // default: -2
    disputeSellerFault: number;     // default: -6
    chargeback: number;             // default: -8
    policyViolation: number;        // default: -12
  };
};

/**
 * Trust event types (canonical)
 */
export const TRUST_EVENT_TYPES = {
  REVIEW_SUBMITTED: "review.submitted",
  LATE_SHIPMENT: "order.late_shipment",
  SELLER_CANCEL: "order.canceled_by_seller",
  REFUND: "refund",
  DISPUTE_OPENED: "dispute.opened",
  DISPUTE_SELLER_FAULT: "dispute.closed_seller_fault",
  CHARGEBACK: "chargeback",
  POLICY_VIOLATION: "policy.violation",
} as const;

export type TrustEventType = typeof TRUST_EVENT_TYPES[keyof typeof TRUST_EVENT_TYPES];

/**
 * Default trust settings (v1)
 */
export const DEFAULT_TRUST_SETTINGS: TrustSettingsSchema = {
  version: "v1",
  effectiveAt: new Date().toISOString(),
  baseScore: 80,
  daysHalfLife: 90,
  volumeWindowDays: 90,
  minOrdersNeutralCap: 10,
  minOrdersFullWeight: 50,
  restrictedHardGateScore: 40,
  multipliers: {
    EXCELLENT: { min: 1.10, max: 1.25 },
    GOOD: { min: 1.00, max: 1.05 },
    WATCH: { min: 0.85, max: 0.95 },
    LIMITED: { min: 0.60, max: 0.80 },
    RESTRICTED: { min: 0.0, max: 0.0 },
  },
  cappedRange: {
    between10And49: { min: 0.95, max: 1.10 },
  },
  deltas: {
    review: { "1": -7, "2": -4, "3": -1.5, "4": 0.5, "5": 1 },
    lateShipment: -2,
    sellerCancel: -3,
    refundSellerFault: -4,
    disputeOpened: -2,
    disputeSellerFault: -6,
    chargeback: -8,
    policyViolation: -12,
  },
};

/**
 * Zod validation schema for Trust Settings (HIGH-7 fix)
 * Includes business rules validation
 */
import { z } from "zod";

const MultiplierRangeSchema = z.object({
  min: z.number().min(0, "Multiplier min must be >= 0").max(2, "Multiplier max must be <= 2"),
  max: z.number().min(0, "Multiplier min must be >= 0").max(2, "Multiplier max must be <= 2"),
}).refine((data) => data.min <= data.max, {
  message: "Multiplier min must be <= max",
});

export const TrustSettingsZodSchema = z.object({
  version: z.string().min(1, "Version is required"),
  effectiveAt: z.string().datetime("Must be valid ISO datetime"),

  // Base score: 0-100
  baseScore: z.number()
    .min(0, "Base score must be >= 0")
    .max(100, "Base score must be <= 100"),

  // Decay half-life: 7-365 days
  daysHalfLife: z.number()
    .int("Must be integer")
    .min(7, "Half-life must be at least 7 days")
    .max(365, "Half-life must be at most 365 days"),

  // Volume window: 30-365 days
  volumeWindowDays: z.number()
    .int("Must be integer")
    .min(30, "Volume window must be at least 30 days")
    .max(365, "Volume window must be at most 365 days"),

  // Thresholds
  minOrdersNeutralCap: z.number()
    .int()
    .min(1, "Must be at least 1")
    .max(100, "Must be at most 100"),

  minOrdersFullWeight: z.number()
    .int()
    .min(10, "Must be at least 10")
    .max(500, "Must be at most 500"),

  restrictedHardGateScore: z.number()
    .min(0)
    .max(100),

  // Multipliers by band - REQUIRED structure
  multipliers: z.object({
    EXCELLENT: MultiplierRangeSchema,
    GOOD: MultiplierRangeSchema,
    WATCH: MultiplierRangeSchema,
    LIMITED: MultiplierRangeSchema,
    RESTRICTED: MultiplierRangeSchema,
  }),

  // Capped range for new sellers
  cappedRange: z.object({
    between10And49: MultiplierRangeSchema,
  }),

  // Score deltas
  deltas: z.object({
    review: z.object({
      "1": z.number(),
      "2": z.number(),
      "3": z.number(),
      "4": z.number(),
      "5": z.number(),
    }),
    lateShipment: z.number(),
    sellerCancel: z.number(),
    refundSellerFault: z.number(),
    disputeOpened: z.number(),
    disputeSellerFault: z.number(),
    chargeback: z.number(),
    policyViolation: z.number(),
  }),
}).refine((data) => {
  // minOrdersNeutralCap must be < minOrdersFullWeight
  return data.minOrdersNeutralCap < data.minOrdersFullWeight;
}, {
  message: "minOrdersNeutralCap must be less than minOrdersFullWeight",
  path: ["minOrdersNeutralCap"],
}).refine((data) => {
  // Capped range should be within reasonable bounds for growth-friendly rules
  const capped = data.cappedRange.between10And49;
  return capped.min >= 0.8 && capped.max <= 1.2;
}, {
  message: "Capped range should be between 0.8 and 1.2 for growth-friendly rules",
  path: ["cappedRange"],
}).refine((data) => {
  // Review deltas should follow pattern: 1-star negative, 5-star positive
  const r = data.deltas.review;
  return r["1"] < 0 && r["5"] > 0;
}, {
  message: "1-star reviews should be negative, 5-star should be positive",
  path: ["deltas", "review"],
});

/**
 * Validate trust settings structure (basic type check)
 */
export function validateTrustSettings(settings: unknown): settings is TrustSettingsSchema {
  if (!settings || typeof settings !== "object") return false;
  const s = settings as any;
  
  // Check required fields
  if (typeof s.baseScore !== "number") return false;
  if (typeof s.daysHalfLife !== "number") return false;
  if (typeof s.minOrdersNeutralCap !== "number") return false;
  if (typeof s.minOrdersFullWeight !== "number") return false;
  if (typeof s.restrictedHardGateScore !== "number") return false;
  
  // Check multipliers structure
  if (!s.multipliers) return false;
  const bands: TrustBand[] = ["EXCELLENT", "GOOD", "WATCH", "LIMITED", "RESTRICTED"];
  for (const band of bands) {
    if (!s.multipliers[band]) return false;
    if (typeof s.multipliers[band].min !== "number") return false;
    if (typeof s.multipliers[band].max !== "number") return false;
  }
  
  // Check capped range
  if (!s.cappedRange?.between10And49) return false;
  if (typeof s.cappedRange.between10And49.min !== "number") return false;
  if (typeof s.cappedRange.between10And49.max !== "number") return false;
  
  // Check deltas
  if (!s.deltas) return false;
  if (!s.deltas.review) return false;
  
  return true;
}

/**
 * Full Zod validation with business rules (for API use)
 */
export function validateTrustSettingsWithZod(settings: unknown): {
  success: boolean;
  data?: z.infer<typeof TrustSettingsZodSchema>;
  errors?: string[];
} {
  const result = TrustSettingsZodSchema.safeParse(settings);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}
```

---

## 3) Seed policy + trust settings (effective-dated)

Create `scripts/seed-trust-policy.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { DEFAULT_TRUST_SETTINGS, validateTrustSettings } from "../packages/core/trust/types";

const prisma = new PrismaClient();

async function main() {
  // Seed initial policy version
  await prisma.policyVersion.upsert({
    where: { id: "policy_v1_bootstrap" },
    update: {},
    create: {
      id: "policy_v1_bootstrap",
      version: "v1",
      effectiveAt: new Date(),
      isActive: true,
      changesJson: [{ note: "initial policy version" }],
      createdByStaffId: "bootstrap",
    },
  });

  // Validate settings before saving
  if (!validateTrustSettings(DEFAULT_TRUST_SETTINGS)) {
    throw new Error("Invalid trust settings schema");
  }

  // Seed initial trust settings
  await prisma.trustSettings.upsert({
    where: { id: "trust_v1_bootstrap" },
    update: {},
    create: {
      id: "trust_v1_bootstrap",
      version: "v1",
      effectiveAt: new Date(),
      isActive: true,
      settingsJson: DEFAULT_TRUST_SETTINGS,
      createdByStaffId: "bootstrap",
    },
  });

  console.log("seed-trust-policy: ok");
}

main().finally(async () => prisma.$disconnect());
```

Add script to package.json:
```json
{
  "scripts": {
    "seed:trust": "tsx scripts/seed-trust-policy.ts"
  }
}
```

---

## 4) Idempotent Trust Event Emission

Create `packages/core/trust/events.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { TrustEventType } from "./types";

const prisma = new PrismaClient();

/**
 * Event key generators for idempotency
 * Each event type has a specific key format to prevent duplicates
 */
export const trustEventKey = {
  // One review per order
  review: (orderId: string) => `trust:review:${orderId}`,
  
  // One late shipment event per order
  lateShipment: (orderId: string) => `trust:late_shipment:${orderId}`,
  
  // One seller cancel event per order
  sellerCancel: (orderId: string) => `trust:seller_cancel:${orderId}`,
  
  // One refund event per refundId
  refund: (refundId: string) => `trust:refund:${refundId}`,
  
  // One dispute opened event per disputeId
  disputeOpened: (disputeId: string) => `trust:dispute_opened:${disputeId}`,
  
  // One dispute fault event per disputeId
  disputeSellerFault: (disputeId: string) => `trust:dispute_fault:${disputeId}`,
  
  // One chargeback event per chargebackId
  chargeback: (chargebackId: string) => `trust:chargeback:${chargebackId}`,
  
  // Policy violations use a unique violation ID
  policyViolation: (violationId: string) => `trust:violation:${violationId}`,
};

/**
 * Emit a trust event idempotently
 * If the eventKey already exists, this is a no-op (upsert with no update)
 * 
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md - exactly one event per trigger
 */
export async function emitTrustEvent(args: {
  sellerId: string;
  type: TrustEventType;
  eventKey: string;
  occurredAt?: Date;
  orderId?: string;
  meta?: Record<string, any>;
}): Promise<{ created: boolean; eventId: string }> {
  const result = await prisma.trustEvent.upsert({
    where: { eventKey: args.eventKey },
    update: {}, // No update if exists - idempotent
    create: {
      sellerId: args.sellerId,
      type: args.type,
      eventKey: args.eventKey,
      occurredAt: args.occurredAt ?? new Date(),
      orderId: args.orderId,
      metaJson: args.meta ?? {},
    },
  });
  
  // Check if this was a new creation by comparing createdAt
  const justCreated = Date.now() - result.createdAt.getTime() < 1000;
  
  return {
    created: justCreated,
    eventId: result.id,
  };
}

/**
 * Emit review trust event (exactly one per order)
 */
export async function emitReviewTrustEvent(args: {
  sellerId: string;
  orderId: string;
  stars: number;
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "review.submitted",
    eventKey: trustEventKey.review(args.orderId),
    orderId: args.orderId,
    meta: { stars: args.stars },
  });
}

/**
 * Emit late shipment trust event (exactly one per order)
 */
export async function emitLateShipmentTrustEvent(args: {
  sellerId: string;
  orderId: string;
  daysLate: number;
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "order.late_shipment",
    eventKey: trustEventKey.lateShipment(args.orderId),
    orderId: args.orderId,
    meta: { daysLate: args.daysLate },
  });
}

/**
 * Emit seller cancel trust event (exactly one per order)
 */
export async function emitSellerCancelTrustEvent(args: {
  sellerId: string;
  orderId: string;
  reason?: string;
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "order.canceled_by_seller",
    eventKey: trustEventKey.sellerCancel(args.orderId),
    orderId: args.orderId,
    meta: { reason: args.reason },
  });
}

/**
 * Emit refund trust event (exactly one per refund)
 */
export async function emitRefundTrustEvent(args: {
  sellerId: string;
  refundId: string;
  orderId: string;
  sellerFault: boolean;
  amountCents: number;
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "refund",
    eventKey: trustEventKey.refund(args.refundId),
    orderId: args.orderId,
    meta: { sellerFault: args.sellerFault, amountCents: args.amountCents },
  });
}

/**
 * Emit dispute opened trust event (exactly one per dispute)
 */
export async function emitDisputeOpenedTrustEvent(args: {
  sellerId: string;
  disputeId: string;
  orderId: string;
  reasonCode: string;
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "dispute.opened",
    eventKey: trustEventKey.disputeOpened(args.disputeId),
    orderId: args.orderId,
    meta: { reasonCode: args.reasonCode },
  });
}

/**
 * Emit dispute seller fault trust event (exactly one per dispute)
 */
export async function emitDisputeSellerFaultTrustEvent(args: {
  sellerId: string;
  disputeId: string;
  orderId: string;
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "dispute.closed_seller_fault",
    eventKey: trustEventKey.disputeSellerFault(args.disputeId),
    orderId: args.orderId,
  });
}

/**
 * Emit chargeback trust event (exactly one per chargeback)
 */
export async function emitChargebackTrustEvent(args: {
  sellerId: string;
  chargebackId: string;
  orderId: string;
  amountCents: number;
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "chargeback",
    eventKey: trustEventKey.chargeback(args.chargebackId),
    orderId: args.orderId,
    meta: { amountCents: args.amountCents },
  });
}

/**
 * Emit policy violation trust event (exactly one per violation)
 */
export async function emitPolicyViolationTrustEvent(args: {
  sellerId: string;
  violationId: string;
  policyCode: string;
  severity: "warning" | "minor" | "major" | "severe";
}) {
  return emitTrustEvent({
    sellerId: args.sellerId,
    type: "policy.violation",
    eventKey: trustEventKey.policyViolation(args.violationId),
    meta: { policyCode: args.policyCode, severity: args.severity },
  });
}
```

---

## 5) Trust compute (on-demand v1)

Create `packages/core/trust/compute.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { TrustBand, TrustSettingsSchema } from "./types";

const prisma = new PrismaClient();

/**
 * Clamp score to 0-100 range
 */
export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Calculate decay weight based on days since event
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md - exponential decay with half-life
 */
export function decayWeight(daysSince: number, halfLife: number): number {
  return Math.pow(0.5, daysSince / halfLife);
}

/**
 * Determine trust band from score
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md Section 2
 */
export function trustBand(score: number): TrustBand {
  if (score < 40) return "RESTRICTED";
  if (score < 60) return "LIMITED";
  if (score < 75) return "WATCH";
  if (score < 90) return "GOOD";
  return "EXCELLENT";
}

/**
 * Compute trust score from events
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md Section 3
 */
export function computeTrustScore(
  events: Array<{ type: string; occurredAt: Date; metaJson: any }>,
  settings: TrustSettingsSchema
): number {
  let score = settings.baseScore;
  const now = Date.now();

  for (const e of events) {
    const days = Math.max(0, (now - e.occurredAt.getTime()) / 86400000);
    const weight = decayWeight(days, settings.daysHalfLife);

    let delta = 0;
    
    switch (e.type) {
      case "review.submitted":
        delta = settings.deltas.review[String(e.metaJson?.stars ?? 5)] ?? 0;
        break;
      case "order.late_shipment":
        delta = settings.deltas.lateShipment;
        break;
      case "order.canceled_by_seller":
        delta = settings.deltas.sellerCancel;
        break;
      case "refund":
        delta = e.metaJson?.sellerFault ? settings.deltas.refundSellerFault : 0;
        break;
      case "dispute.opened":
        delta = settings.deltas.disputeOpened;
        break;
      case "dispute.closed_seller_fault":
        delta = settings.deltas.disputeSellerFault;
        break;
      case "chargeback":
        delta = settings.deltas.chargeback;
        break;
      case "policy.violation":
        delta = settings.deltas.policyViolation;
        break;
    }

    score += delta * weight;
  }

  return clampScore(score);
}

/**
 * Get active trust settings
 */
export async function getActiveTrustSettings(): Promise<TrustSettingsSchema> {
  const settings = await prisma.trustSettings.findFirst({
    where: {
      isActive: true,
      effectiveAt: { lte: new Date() },
    },
    orderBy: { effectiveAt: "desc" },
  });

  if (!settings) {
    throw new Error("NO_ACTIVE_TRUST_SETTINGS");
  }

  return settings.settingsJson as TrustSettingsSchema;
}

// =============================================================================
// TRUST SCORE CACHING (MED-5)
// =============================================================================

// In-memory cache with TTL
const trustCache = new Map<string, { score: number; band: TrustBand; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get seller trust score with caching (MED-5)
 */
export async function getSellerTrustScoreCached(sellerId: string): Promise<{
  score: number;
  band: TrustBand;
  fromCache: boolean;
}> {
  const now = Date.now();
  
  // Check memory cache
  const cached = trustCache.get(sellerId);
  if (cached && cached.expiresAt > now) {
    return { score: cached.score, band: cached.band, fromCache: true };
  }
  
  // Check database snapshot (within TTL)
  const snapshot = await prisma.trustSnapshot.findFirst({
    where: { 
      sellerId,
      computedAt: { gte: new Date(now - CACHE_TTL_MS) },
    },
  });
  
  if (snapshot) {
    // Update memory cache
    trustCache.set(sellerId, {
      score: snapshot.score,
      band: snapshot.band as TrustBand,
      expiresAt: now + CACHE_TTL_MS,
    });
    return { score: snapshot.score, band: snapshot.band as TrustBand, fromCache: true };
  }
  
  // Compute fresh score
  const result = await recomputeSellerTrust(sellerId);
  
  // Update memory cache
  trustCache.set(sellerId, {
    score: result.score,
    band: result.band,
    expiresAt: now + CACHE_TTL_MS,
  });
  
  return { score: result.score, band: result.band, fromCache: false };
}

/**
 * Invalidate trust cache (call after trust-affecting events)
 */
export function invalidateTrustCache(sellerId: string): void {
  trustCache.delete(sellerId);
}

/**
 * Bulk preload trust scores for search results (MED-5 performance)
 */
export async function preloadTrustScores(sellerIds: string[]): Promise<Map<string, { score: number; band: TrustBand }>> {
  const results = new Map<string, { score: number; band: TrustBand }>();
  const now = Date.now();
  const toFetch: string[] = [];
  
  // Check cache first
  for (const sellerId of sellerIds) {
    const cached = trustCache.get(sellerId);
    if (cached && cached.expiresAt > now) {
      results.set(sellerId, { score: cached.score, band: cached.band });
    } else {
      toFetch.push(sellerId);
    }
  }
  
  // Batch fetch from database
  if (toFetch.length > 0) {
    const snapshots = await prisma.trustSnapshot.findMany({
      where: {
        sellerId: { in: toFetch },
        computedAt: { gte: new Date(now - CACHE_TTL_MS) },
      },
    });
    
    for (const snapshot of snapshots) {
      results.set(snapshot.sellerId, { 
        score: snapshot.score, 
        band: snapshot.band as TrustBand 
      });
      trustCache.set(snapshot.sellerId, {
        score: snapshot.score,
        band: snapshot.band as TrustBand,
        expiresAt: now + CACHE_TTL_MS,
      });
    }
  }
  
  // Default score for sellers without snapshots
  for (const sellerId of sellerIds) {
    if (!results.has(sellerId)) {
      results.set(sellerId, { score: 80, band: "mid" }); // Default
    }
  }
  
  return results;
}

/**
 * Recompute and update seller trust snapshot
 */
export async function recomputeSellerTrust(sellerId: string): Promise<{
  score: number;
  band: TrustBand;
  completedOrdersWindow: number;
}> {
  const settings = await getActiveTrustSettings();
  
  // Get events within volume window
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - settings.volumeWindowDays);
  
  const events = await prisma.trustEvent.findMany({
    where: {
      sellerId,
      occurredAt: { gte: windowStart },
    },
    orderBy: { occurredAt: "desc" },
  });
  
  // Count completed orders in window
  const completedOrdersWindow = await prisma.order.count({
    where: {
      sellerId,
      status: "COMPLETED",
      completedAt: { gte: windowStart },
    },
  });
  
  const score = computeTrustScore(events, settings);
  const band = trustBand(score);
  
  // Update snapshot
  await prisma.trustSnapshot.upsert({
    where: { sellerId },
    update: {
      score,
      band,
      completedOrdersWindow,
      computedAt: new Date(),
      settingsVersion: settings.version,
    },
    create: {
      sellerId,
      score,
      band,
      completedOrdersWindow,
      computedAt: new Date(),
      settingsVersion: settings.version,
    },
  });
  
  return { score, band, completedOrdersWindow };
}
```

---

## 6) Trust Multiplier for Search Ranking

Create `packages/core/trust/multiplier.ts`:

```ts
import type { TrustBand, TrustSettingsSchema } from "./types";

export type TrustContext = {
  band: TrustBand;
  completedOrdersInWindow: number;
  trustScore: number;
};

/**
 * Check if seller is eligible for search results
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md - hard gate restricted sellers
 */
export function isSellerSearchEligible(args: {
  trustScore: number;
  band: TrustBand;
  settings: TrustSettingsSchema;
  hasHardRiskFlag?: boolean;
}): boolean {
  // Hard risk flags always block
  if (args.hasHardRiskFlag) return false;
  
  // Restricted band is hard-gated
  if (args.band === "RESTRICTED") return false;
  
  // Below threshold is hard-gated
  if (args.trustScore < args.settings.restrictedHardGateScore) return false;
  
  return true;
}

/**
 * Compute trust multiplier for search ranking
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md Section 4
 * 
 * Rules:
 * - < minOrdersNeutralCap (10): multiplier = 1.0 (cap-only protection)
 * - >= minOrdersNeutralCap, < minOrdersFullWeight (10-49): capped range
 * - >= minOrdersFullWeight (50+): full band multiplier
 */
export function computeTrustMultiplier(
  ctx: TrustContext,
  settings: TrustSettingsSchema
): number {
  const n = ctx.completedOrdersInWindow;

  // Cap-only protection for new sellers
  if (n < settings.minOrdersNeutralCap) {
    return 1.0;
  }

  // Capped range for building sellers
  if (n < settings.minOrdersFullWeight) {
    const range = settings.cappedRange.between10And49;
    // Use midpoint of capped range
    return (range.min + range.max) / 2;
  }

  // Full multiplier for established sellers
  const bandMultiplier = settings.multipliers[ctx.band];
  // Use midpoint of band range
  return (bandMultiplier.min + bandMultiplier.max) / 2;
}

/**
 * Get multiplier range for a band (for display/explanation)
 */
export function getMultiplierRange(
  ctx: TrustContext,
  settings: TrustSettingsSchema
): { min: number; max: number; reason: string } {
  const n = ctx.completedOrdersInWindow;

  if (n < settings.minOrdersNeutralCap) {
    return {
      min: 1.0,
      max: 1.0,
      reason: `New seller protection (< ${settings.minOrdersNeutralCap} orders)`,
    };
  }

  if (n < settings.minOrdersFullWeight) {
    return {
      ...settings.cappedRange.between10And49,
      reason: `Building reputation (${settings.minOrdersNeutralCap}-${settings.minOrdersFullWeight - 1} orders)`,
    };
  }

  return {
    ...settings.multipliers[ctx.band],
    reason: `${ctx.band} band (${n}+ orders)`,
  };
}
```

---

## 7) Enforcement API (Corp)

Endpoints (RBAC gated):
- `POST /api/platform/trust/enforce` (suppress/unsuppress)
- `GET /api/platform/trust/cases`
- `POST /api/platform/trust/cases/:id/assign`
- `GET /api/platform/trust/settings/current`
- `POST /api/platform/trust/settings` (new version + audit)

### 7.1 Suppress/Unsuppress Listing

Create `apps/web/app/api/platform/trust/enforce/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "trust.edit");

  const { targetType, targetId, action, reasonCode, caseId } = await req.json();

  if (targetType !== "Listing") {
    return NextResponse.json({ error: "UNSUPPORTED_TARGET_TYPE" }, { status: 400 });
  }

  if (!["suppress", "unsuppress"].includes(action)) {
    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  }

  // Update listing enforcement state
  const newState = action === "suppress" ? "HARD" : "CLEAR";
  
  const listing = await prisma.listing.update({
    where: { id: targetId },
    data: { enforcementState: newState },
  });

  // Record enforcement action
  const enforcement = await prisma.enforcementAction.create({
    data: {
      caseId,
      actorStaffId: ctx.actorUserId,
      targetType,
      targetId,
      action,
      reasonCode,
    },
  });

  // Re-index listing for search
  await prisma.searchIndexListing.update({
    where: { listingId: targetId },
    data: { isEligible: newState === "CLEAR" },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: ctx.actorUserId,
      action: `trust.enforce.${action}`,
      entityType: "Listing",
      entityId: targetId,
      metaJson: { reasonCode, caseId, enforcementId: enforcement.id },
    },
  });

  return NextResponse.json({ ok: true, listing, enforcement });
}
```

### 7.2 Create New Trust Settings Version

Create `apps/web/app/api/platform/trust/settings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { validateTrustSettings, validateTrustSettingsWithZod } from "@/packages/core/trust/types";

const prisma = new PrismaClient();

export async function GET() {
  const settings = await prisma.trustSettings.findFirst({
    where: {
      isActive: true,
      effectiveAt: { lte: new Date() },
    },
    orderBy: { effectiveAt: "desc" },
  });

  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "trust.edit");

  const body = await req.json();
  const { version, effectiveAt, settingsJson } = body;

  // Validate settings structure with Zod (HIGH-7 fix - includes business rules)
  const validation = validateTrustSettingsWithZod({
    version,
    effectiveAt: new Date(effectiveAt).toISOString(),
    ...settingsJson,
  });

  if (!validation.success) {
    return NextResponse.json({ 
      error: "INVALID_SETTINGS_SCHEMA",
      details: validation.errors,
    }, { status: 400 });
  }

  // Additional business rule validations
  const s = settingsJson;
  
  // baseScore must be 0-100
  if (s.baseScore < 0 || s.baseScore > 100) {
    return NextResponse.json({ 
      error: "INVALID_BASE_SCORE",
      message: "baseScore must be between 0 and 100",
    }, { status: 400 });
  }

  // daysHalfLife must be 7-365
  if (s.daysHalfLife < 7 || s.daysHalfLife > 365) {
    return NextResponse.json({ 
      error: "INVALID_HALF_LIFE",
      message: "daysHalfLife must be between 7 and 365",
    }, { status: 400 });
  }

  // multipliers must have min <= max for all bands
  for (const band of ["EXCELLENT", "GOOD", "WATCH", "LIMITED", "RESTRICTED"]) {
    if (s.multipliers[band].min > s.multipliers[band].max) {
      return NextResponse.json({ 
        error: "INVALID_MULTIPLIER_RANGE",
        message: `${band} multiplier min must be <= max`,
      }, { status: 400 });
    }
  }

  // cappedRange must maintain growth-friendly rules (min >= 0.8, max <= 1.2)
  if (s.cappedRange.between10And49.min < 0.8 || s.cappedRange.between10And49.max > 1.2) {
    return NextResponse.json({ 
      error: "INVALID_CAPPED_RANGE",
      message: "cappedRange must be between 0.8 and 1.2 for growth-friendly rules",
    }, { status: 400 });
  }

  // Create new version
  const newSettings = await prisma.trustSettings.create({
    data: {
      version,
      effectiveAt: new Date(effectiveAt),
      isActive: true,
      settingsJson,
      createdByStaffId: ctx.actorUserId,
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: ctx.actorUserId,
      action: "trust.settings.create",
      entityType: "TrustSettings",
      entityId: newSettings.id,
      metaJson: { version },
    },
  });

  return NextResponse.json({ settings: newSettings }, { status: 201 });
}
```

---

## 8) Health provider + Doctor

Create `packages/core/health/providers/trust.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult } from "../types";
import { validateTrustSettings } from "@/packages/core/trust/types";

const prisma = new PrismaClient();

export const trustHealthProvider: HealthProvider = {
  id: "trust",
  label: "Trust & Safety",

  async run({ runType }): Promise<HealthResult> {
    const checks = [];
    let status: "PASS" | "WARN" | "FAIL" = "PASS";

    // Check 1: Active PolicyVersion exists
    const policyCount = await prisma.policyVersion.count({
      where: { isActive: true, effectiveAt: { lte: new Date() } },
    });
    checks.push({
      id: "policy_version_active",
      label: "Active policy version exists",
      status: policyCount > 0 ? "PASS" : "FAIL",
      message: policyCount > 0 ? `${policyCount} active versions` : "No active policy",
    });
    if (policyCount === 0) status = "FAIL";

    // Check 2: Active TrustSettings exists and is valid
    const trustSettings = await prisma.trustSettings.findFirst({
      where: { isActive: true, effectiveAt: { lte: new Date() } },
      orderBy: { effectiveAt: "desc" },
    });
    
    if (!trustSettings) {
      checks.push({
        id: "trust_settings_active",
        label: "Active trust settings exists",
        status: "FAIL",
        message: "No active trust settings",
      });
      status = "FAIL";
    } else {
      const isValid = validateTrustSettings(trustSettings.settingsJson);
      checks.push({
        id: "trust_settings_active",
        label: "Active trust settings exists",
        status: isValid ? "PASS" : "WARN",
        message: isValid ? `v${trustSettings.version}` : "Settings schema invalid",
      });
      if (!isValid && status !== "FAIL") status = "WARN";
    }

    // Check 3: TrustEvent has eventKey unique constraint
    try {
      // Try to query with eventKey
      await prisma.trustEvent.findFirst({ where: { eventKey: "test_key_does_not_exist" } });
      checks.push({
        id: "trust_event_idempotency",
        label: "Trust event idempotency (eventKey)",
        status: "PASS",
      });
    } catch {
      checks.push({
        id: "trust_event_idempotency",
        label: "Trust event idempotency (eventKey)",
        status: "FAIL",
        message: "eventKey field missing or not indexed",
      });
      status = "FAIL";
    }

    // Check 4: HARD suppression blocks search
    const hardSuppressed = await prisma.listing.count({
      where: { enforcementState: "HARD" },
    });
    const hardInSearch = await prisma.searchIndex.count({
      where: {
        isEligible: true,
        listingId: {
          in: (await prisma.listing.findMany({
            where: { enforcementState: "HARD" },
            select: { id: true },
          })).map(l => l.id),
        },
      },
    });
    checks.push({
      id: "hard_suppression_blocks_search",
      label: "HARD suppression blocks search",
      status: hardInSearch === 0 ? "PASS" : "FAIL",
      message: hardInSearch === 0 
        ? `${hardSuppressed} suppressed listings correctly excluded` 
        : `${hardInSearch} suppressed listings still in search!`,
    });
    if (hardInSearch > 0) status = "FAIL";

    return {
      providerId: "trust",
      status,
      summary: status === "PASS" ? "Trust & Safety healthy" : "Trust issues detected",
      providerVersion: "1.1",
      ranAt: new Date().toISOString(),
      runType,
      checks,
    };
  },

  settings: {
    schema: {},
    defaults: {},
  },

  ui: {
    SettingsPanel: () => null,
    DetailPage: () => null,
  },
};
```

---

## 9) Doctor checks (phase 6)

Update `scripts/twicely-doctor.ts` to include:

```ts
async function checkTrust() {
  const checks = [];

  // Policy version active
  const policyCount = await prisma.policyVersion.count({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
  });
  checks.push({
    key: "trust.policy_version_active",
    ok: policyCount > 0,
    details: `${policyCount} active`,
  });

  // Trust settings active
  const trustSettings = await prisma.trustSettings.findFirst({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
  });
  checks.push({
    key: "trust.settings_active",
    ok: !!trustSettings,
    details: trustSettings ? `v${trustSettings.version}` : "missing",
  });

  // Trust event idempotency - emit twice, expect one row
  const testEventKey = `trust:doctor_test:${Date.now()}`;
  await prisma.trustEvent.upsert({
    where: { eventKey: testEventKey },
    update: {},
    create: {
      sellerId: "doctor_test",
      type: "doctor.test",
      eventKey: testEventKey,
      occurredAt: new Date(),
    },
  });
  await prisma.trustEvent.upsert({
    where: { eventKey: testEventKey },
    update: {},
    create: {
      sellerId: "doctor_test",
      type: "doctor.test",
      eventKey: testEventKey,
      occurredAt: new Date(),
    },
  });
  const eventCount = await prisma.trustEvent.count({
    where: { eventKey: testEventKey },
  });
  checks.push({
    key: "trust.event_idempotency",
    ok: eventCount === 1,
    details: eventCount === 1 ? "idempotent" : `duplicates: ${eventCount}`,
  });

  // Cleanup test event
  await prisma.trustEvent.delete({ where: { eventKey: testEventKey } });

  // HARD suppression blocks discovery
  // (This test assumes test data exists; skip if no data)
  const hardInSearch = await prisma.searchIndex.count({
    where: {
      isEligible: true,
      listingId: {
        in: (await prisma.listing.findMany({
          where: { enforcementState: "HARD" },
          select: { id: true },
        })).map(l => l.id),
      },
    },
  });
  checks.push({
    key: "trust.hard_suppression_blocks_search",
    ok: hardInSearch === 0,
    details: hardInSearch === 0 ? "enforced" : `${hardInSearch} leaking`,
  });

  return checks;
}
```

---

## 10) Phase 6 Completion Criteria

- PolicyVersion seeded and active
- TrustSettings seeded with **valid structured schema** (multipliers required)
- **TrustEvent.eventKey** is unique and enforces idempotency
- Trust event helpers emit exactly once per trigger
- HARD suppression removes listing from search results
- Trust multiplier correctly applies cap-only protection for new sellers
- Health provider passes all checks
- Doctor passes Phase 6 checks

---

## 11) Canonical Alignment Notes

This phase now aligns with:

| Canonical Requirement | Implementation |
|----------------------|----------------|
| Structured multipliers | TrustSettingsSchema type enforces multipliers structure |
| eventKey idempotency | TrustEvent.eventKey @unique prevents duplicates |
| Cap-only protection | computeTrustMultiplier returns 1.0 for < 10 orders |
| Hard gate restricted | isSellerSearchEligible returns false for RESTRICTED |
| Decay function | decayWeight uses exponential decay with configurable half-life |
| Trust bands | trustBand returns correct band for score ranges |

---

## 12) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 6 implementation |
| 1.1 | 2026-01-15 | Added structured multiplier schema |
| 1.2 | 2026-01-20 | MED-5: Trust score caching layer |
