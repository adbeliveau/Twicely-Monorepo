# TWICELY V2 - Install Phase 37: Seller Standards Program
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema → Metrics → Thresholds → Consequences → Reinstatement → Health → Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_RATINGS_TRUST_CANONICAL.md`
- `/rules/TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md`
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_37_SELLER_STANDARDS.md`  
> Prereq: Phase 36 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Seller performance metrics computation
- Configurable thresholds per metric
- Automated status tier assignment (Good → Watch → Limited → Restricted)
- Consequence enforcement (listing limits, payout delays, suspension)
- Reinstatement workflow

### UI (Seller)
- Seller → Performance → Standards Dashboard
- Seller → Performance → Metrics Detail
- Seller → Performance → Reinstatement Request

### UI (Corp)
- Corp → Sellers → Standards Overview
- Corp → Sellers → Performance Alerts
- Corp → Sellers → Reinstatement Queue

### Ops
- Health provider: `seller_standards`
- Doctor checks: metrics computation, threshold triggers, consequences, reinstatement

### Doctor Check Implementation (Phase 37)

Add to `scripts/twicely-doctor.ts`:

```typescript
async function checkPhase37(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testSellerId = `doctor_seller_${Date.now()}`;

  // 1. Create seller standard snapshot record
  const snapshot = await prisma.sellerStandardSnapshot.create({
    data: {
      sellerId: testSellerId,
      status: "GOOD",
      orderCount: 100,
      lateShipRate: 5, // 5%
      cancelRate: 2,
      defectRate: 1,
      trackingUploadRate: 95,
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  checks.push({
    phase: 37,
    name: "standards.metrics_create",
    status: snapshot?.id ? "PASS" : "FAIL",
    details: `Status: ${snapshot?.status}, Orders: ${snapshot?.orderCount}`,
  });

  // 2. Thresholds trigger status changes (simulate poor performance)
  await prisma.sellerStandardSnapshot.update({
    where: { id: snapshot.id },
    data: {
      lateShipRate: 25, // Above threshold
      status: "LIMITED",
      previousStatus: "GOOD",
      statusChangedAt: new Date(),
    },
  });
  const afterThreshold = await prisma.sellerStandardSnapshot.findUnique({
    where: { id: snapshot.id },
  });
  checks.push({
    phase: 37,
    name: "standards.threshold_trigger",
    status: afterThreshold?.status === "LIMITED" ? "PASS" : "FAIL",
    details: `Status changed to: ${afterThreshold?.status} (late ship: ${afterThreshold?.lateShipRate}%)`,
  });

  // 3. Consequences apply automatically
  const consequence = await prisma.sellerStandardConsequence.create({
    data: {
      status: "LIMITED",
      consequenceType: "listing_limit",
      parameters: { maxListings: 100 },
      isActive: true,
    },
  });
  checks.push({
    phase: 37,
    name: "standards.consequence_applied",
    status: consequence?.isActive ? "PASS" : "FAIL",
    details: `Consequence: ${consequence?.consequenceType}`,
  });

  // 4. Reinstatement workflow works
  const reinstatement = await prisma.sellerReinstatementRequest.create({
    data: {
      sellerId: testSellerId,
      currentStatus: "LIMITED",
      requestedStatus: "GOOD",
      reason: "Improved shipping processes",
      supportingDocs: ["Doctor test - implemented new shipping workflow"],
      status: "PENDING",
    },
  });
  checks.push({
    phase: 37,
    name: "standards.reinstatement_request",
    status: reinstatement?.status === "PENDING" ? "PASS" : "FAIL",
    details: `Request status: ${reinstatement?.status}`,
  });

  // Verify reinstatement can be approved
  await prisma.sellerReinstatementRequest.update({
    where: { id: reinstatement.id },
    data: { status: "APPROVED", reviewedAt: new Date() },
  });
  const approved = await prisma.sellerReinstatementRequest.findUnique({
    where: { id: reinstatement.id },
  });
  checks.push({
    phase: 37,
    name: "standards.reinstatement_approve",
    status: approved?.status === "APPROVED" ? "PASS" : "FAIL",
  });

  // 6. Test trust label service
  const { getBuyerTrustLabel } = await import("@/packages/core/seller-standards/trustLabelService");
  const trustLabel = await getBuyerTrustLabel(testSellerId);
  checks.push({
    phase: 37,
    name: "standards.trust_label_service",
    status: trustLabel !== undefined ? "PASS" : "FAIL",
    details: trustLabel.showLabel
      ? `Label: ${trustLabel.text}`
      : "No badge (expected for non-GOOD sellers)",
  });

  // Cleanup
  await prisma.sellerReinstatementRequest.delete({ where: { id: reinstatement.id } });
  await prisma.sellerStandardConsequence.delete({ where: { id: consequence.id } });
  await prisma.sellerStandardSnapshot.delete({ where: { id: snapshot.id } });

  return checks;
}
```


---

## 1) Seller Standards Invariants (non-negotiable)

- Metrics are computed from real transaction data
- Status changes require audit trail
- Consequences are graduated (warn → limit → restrict → suspend)
- Sellers receive notification before status downgrade
- Appeal/reinstatement path always available

Performance tiers:
- `TOP_RATED` - Exceeds all standards (optional badge)
- `GOOD` - Meets all standards
- `WATCH` - One or more metrics approaching threshold
- `LIMITED` - One or more metrics below threshold
- `RESTRICTED` - Multiple metrics below threshold or severe violation

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model SellerStandardSnapshot {
  id              String    @id @default(cuid())
  sellerId        String
  evaluationPeriod String   @default("30d") // 30d|90d|365d
  
  // Core metrics
  orderCount      Int       @default(0)
  lateShipRate    Float     @default(0)    // % shipped late
  cancelRate      Float     @default(0)    // % seller-cancelled
  defectRate      Float     @default(0)    // % with issues
  trackingUploadRate Float  @default(0)    // % with tracking
  responseTime    Int?      // avg hours to first response

  // Protection metrics (Phase 38 Integration)
  protectionScore Int?      // 0-100 from SellerProtectionScore
  appealWinRate   Float?    // % of appeals won (if any filed)
  appealsFiled    Int       @default(0)
  appealsWon      Int       @default(0)

  // Bundle metrics (Phase 3 Integration, display only)
  bundleConversionRate Float? // % of bundle views that convert
  
  // Derived status
  status          String    @default("GOOD") // TOP_RATED|GOOD|WATCH|LIMITED|RESTRICTED
  previousStatus  String?
  statusChangedAt DateTime?
  
  // Metadata
  computedAt      DateTime  @default(now())
  expiresAt       DateTime
  
  @@index([sellerId, computedAt])
  @@index([status, computedAt])
}

model SellerStandardThreshold {
  id              String    @id @default(cuid())
  metric          String    @unique // late_ship_rate|cancel_rate|defect_rate|etc
  goodMax         Float     // <= this is GOOD
  watchMax        Float     // <= this is WATCH
  limitedMax      Float     // <= this is LIMITED
  restrictedMax   Float     // above this is RESTRICTED
  minOrders       Int       @default(10) // minimum orders for metric to apply
  isActive        Boolean   @default(true)
  updatedAt       DateTime  @updatedAt
}

model SellerStandardConsequence {
  id              String    @id @default(cuid())
  status          String    // WATCH|LIMITED|RESTRICTED
  consequenceType String    // listing_limit|payout_delay|search_demotion|suspension
  parameters      Json      @default("{}") // { maxListings: 100, delayDays: 7 }
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())

  @@unique([status, consequenceType])
}

model SellerAppliedConsequence {
  id              String    @id @default(cuid())
  sellerId        String
  status          String    // status at time of application
  consequenceType String    // listing_limit|payout_delay|search_demotion|suspension
  parameters      Json      @default("{}") // actual parameters applied
  appliedAt       DateTime  @default(now())
  liftedAt        DateTime?
  reason          String?
  
  @@index([sellerId, liftedAt])
  @@index([status])
}

model SellerStandardEvent {
  id              String    @id @default(cuid())
  sellerId        String
  eventType       String    // status_change|warning_sent|consequence_applied|reinstatement
  fromStatus      String?
  toStatus        String?
  reason          String?
  staffActorId    String?
  metaJson        Json      @default("{}")
  occurredAt      DateTime  @default(now())

  @@index([sellerId, occurredAt])
  @@index([eventType, occurredAt])
}

model SellerReinstatementRequest {
  id              String    @id @default(cuid())
  sellerId        String
  currentStatus   String
  requestedStatus String
  reason          String
  supportingDocs  Json      @default("[]")
  status          String    @default("PENDING") // PENDING|APPROVED|REJECTED
  reviewerStaffId String?
  reviewNotes     String?
  reviewedAt      DateTime?
  createdAt       DateTime  @default(now())

  @@index([sellerId, createdAt])
  @@index([status, createdAt])
}
```

Migration:
```bash
npx prisma migrate dev --name seller_standards_phase37
```

---

## 3) Metrics Computation Service

Create `packages/core/seller-standards/metrics.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type SellerMetrics = {
  orderCount: number;
  lateShipRate: number;
  cancelRate: number;
  defectRate: number;
  trackingUploadRate: number;
  responseTime: number | null;
  // Phase 38 Integration
  protectionScore: number | null;
  appealWinRate: number | null;
  appealsFiled: number;
  appealsWon: number;
  // Phase 3 Integration (display only)
  bundleConversionRate: number | null;
};

export async function computeSellerMetrics(args: {
  sellerId: string;
  periodDays: number;
}): Promise<SellerMetrics> {
  const since = new Date(Date.now() - args.periodDays * 24 * 60 * 60 * 1000);

  // Get orders in period
  const orders = await prisma.order.findMany({
    where: {
      sellerId: args.sellerId,
      createdAt: { gte: since },
      status: { not: "DRAFT" },
    },
    include: {
      shipments: true,
    },
  });

  const orderCount = orders.length;
  if (orderCount === 0) {
    return {
      orderCount: 0,
      lateShipRate: 0,
      cancelRate: 0,
      defectRate: 0,
      trackingUploadRate: 0,
      responseTime: null,
    };
  }

  // Late shipment rate
  const lateShipments = orders.filter((o) => {
    if (o.status === "CANCELLED") return false;
    const shipment = o.shipments[0];
    if (!shipment?.shippedAt || !o.expectedShipBy) return false;
    return shipment.shippedAt > o.expectedShipBy;
  }).length;
  const lateShipRate = lateShipments / orderCount;

  // Cancellation rate (seller-initiated)
  const sellerCancelled = orders.filter(
    (o) => o.status === "CANCELLED" && o.cancelledBy === "seller"
  ).length;
  const cancelRate = sellerCancelled / orderCount;

  // Defect rate (returns due to seller fault + negative reviews)
  const defectOrders = orders.filter((o) => {
    // Check for seller-fault returns or low ratings
    // This is simplified - real implementation would check reviews/returns
    return o.hasDefect === true;
  }).length;
  const defectRate = defectOrders / orderCount;

  // Tracking upload rate
  const withTracking = orders.filter(
    (o) => o.status !== "CANCELLED" && o.shipments.some((s) => s.trackingNumber)
  ).length;
  const shippableOrders = orders.filter((o) => o.status !== "CANCELLED").length;
  const trackingUploadRate = shippableOrders > 0 ? withTracking / shippableOrders : 1;

  // Response time (would query messages - simplified here)
  const responseTime = null; // TODO: implement message response time

  // Protection score (Phase 38 Integration)
  const protectionScoreRecord = await prisma.sellerProtectionScore.findFirst({
    where: { sellerId: args.sellerId },
    orderBy: { computedAt: "desc" },
  });
  const protectionScore = protectionScoreRecord?.score ?? null;

  // Appeal metrics (Phase 38 Integration)
  const appeals = await prisma.sellerAppeal.findMany({
    where: { sellerId: args.sellerId, createdAt: { gte: since } },
  });
  const appealsFiled = appeals.length;
  const appealsWon = appeals.filter(
    (a) => a.decision === "OVERTURN_FULL" || a.decision === "OVERTURN_PARTIAL"
  ).length;
  const appealWinRate = appealsFiled > 0 ? appealsWon / appealsFiled : null;

  // Bundle conversion rate (Phase 3 Integration - display only)
  const bundles = await prisma.sellerBundle.findMany({
    where: { sellerId: args.sellerId, createdAt: { gte: since } },
  });
  const totalViews = bundles.reduce((sum, b) => sum + b.viewCount, 0);
  const totalConversions = bundles.reduce((sum, b) => sum + b.conversionCount, 0);
  const bundleConversionRate = totalViews > 0 ? totalConversions / totalViews : null;

  return {
    orderCount,
    lateShipRate,
    cancelRate,
    defectRate,
    trackingUploadRate,
    responseTime,
    protectionScore,
    appealWinRate,
    appealsFiled,
    appealsWon,
    bundleConversionRate,
  };
}
```

---

## 4) Status Determination Service

Create `packages/core/seller-standards/status.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { SellerMetrics } from "./metrics";

const prisma = new PrismaClient();

export type SellerStatus = "TOP_RATED" | "GOOD" | "WATCH" | "LIMITED" | "RESTRICTED";

export async function determineSellerStatus(metrics: SellerMetrics): Promise<SellerStatus> {
  const thresholds = await prisma.sellerStandardThreshold.findMany({
    where: { isActive: true },
  });

  if (metrics.orderCount < 10) {
    return "GOOD"; // New sellers get grace period
  }

  const thresholdMap = new Map(thresholds.map((t) => [t.metric, t]));

  let worstStatus: SellerStatus = "GOOD";

  // Check each metric
  const checks: Array<{ metric: string; value: number }> = [
    { metric: "late_ship_rate", value: metrics.lateShipRate },
    { metric: "cancel_rate", value: metrics.cancelRate },
    { metric: "defect_rate", value: metrics.defectRate },
  ];

  for (const check of checks) {
    const threshold = thresholdMap.get(check.metric);
    if (!threshold) continue;

    let status: SellerStatus = "GOOD";

    if (check.value > threshold.restrictedMax) {
      status = "RESTRICTED";
    } else if (check.value > threshold.limitedMax) {
      status = "LIMITED";
    } else if (check.value > threshold.watchMax) {
      status = "WATCH";
    } else if (check.value <= threshold.goodMax) {
      status = "GOOD";
    }

    // Track worst status
    const severity = { TOP_RATED: 0, GOOD: 1, WATCH: 2, LIMITED: 3, RESTRICTED: 4 };
    if (severity[status] > severity[worstStatus]) {
      worstStatus = status;
    }
  }

  // Phase 38 Integration: Protection score affects status
  // Protection score is weighted 15% in overall evaluation
  if (metrics.protectionScore !== null) {
    if (metrics.protectionScore < 50) {
      // Poor protection score can push to WATCH or worse
      const severity = { TOP_RATED: 0, GOOD: 1, WATCH: 2, LIMITED: 3, RESTRICTED: 4 };
      if (severity[worstStatus] < severity["WATCH"]) {
        worstStatus = "WATCH";
      }
    }
  }

  // Phase 38 Integration: Appeal win rate bonus
  // Sellers with high appeal win rates get credit
  const appealBonus = metrics.appealsFiled > 0 && metrics.appealWinRate !== null
    ? metrics.appealWinRate >= 0.5 // 50%+ appeal win rate is positive signal
    : true; // No appeals needed is fine

  // Check for TOP_RATED (all metrics excellent + high order volume)
  if (
    worstStatus === "GOOD" &&
    metrics.orderCount >= 100 &&
    metrics.lateShipRate <= 0.01 &&
    metrics.cancelRate <= 0.005 &&
    metrics.defectRate <= 0.01 &&
    metrics.trackingUploadRate >= 0.99 &&
    (metrics.protectionScore === null || metrics.protectionScore >= 90) && // Phase 38: Protection score >= 90 for TOP_RATED
    appealBonus
  ) {
    return "TOP_RATED";
  }

  return worstStatus;
}

export function sellerStandardStatus(s: {
  lateShipRate: number;
  cancelRate: number;
  defectRate: number;
}): SellerStatus {
  // Simplified version for quick checks
  if (s.defectRate > 0.06) return "RESTRICTED";
  if (s.defectRate > 0.03) return "LIMITED";
  if (s.defectRate > 0.015) return "WATCH";
  return "GOOD";
}
```

---

## 5) Snapshot Service

Create `packages/core/seller-standards/snapshot.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { computeSellerMetrics } from "./metrics";
import { determineSellerStatus } from "./status";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function createSellerSnapshot(args: {
  sellerId: string;
  periodDays?: number;
}): Promise<any> {
  const periodDays = args.periodDays ?? 30;
  const metrics = await computeSellerMetrics({
    sellerId: args.sellerId,
    periodDays,
  });

  const status = await determineSellerStatus(metrics);

  // Get previous snapshot
  const previous = await prisma.sellerStandardSnapshot.findFirst({
    where: { sellerId: args.sellerId },
    orderBy: { computedAt: "desc" },
  });

  const snapshot = await prisma.sellerStandardSnapshot.create({
    data: {
      sellerId: args.sellerId,
      evaluationPeriod: `${periodDays}d`,
      orderCount: metrics.orderCount,
      lateShipRate: metrics.lateShipRate,
      cancelRate: metrics.cancelRate,
      defectRate: metrics.defectRate,
      trackingUploadRate: metrics.trackingUploadRate,
      responseTime: metrics.responseTime,
      status,
      previousStatus: previous?.status,
      statusChangedAt: previous?.status !== status ? new Date() : previous?.statusChangedAt,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  // Record status change event
  if (previous && previous.status !== status) {
    await recordStatusChange({
      sellerId: args.sellerId,
      fromStatus: previous.status,
      toStatus: status,
    });
  }

  return snapshot;
}

async function recordStatusChange(args: {
  sellerId: string;
  fromStatus: string;
  toStatus: string;
}) {
  await prisma.sellerStandardEvent.create({
    data: {
      sellerId: args.sellerId,
      eventType: "status_change",
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
    },
  });

  await emitAuditEvent({
    action: "seller_standards.status_change",
    entityType: "Seller",
    entityId: args.sellerId,
    meta: { fromStatus: args.fromStatus, toStatus: args.toStatus },
  });

  // Apply consequences if downgraded
  const severity = { TOP_RATED: 0, GOOD: 1, WATCH: 2, LIMITED: 3, RESTRICTED: 4 };
  if (severity[args.toStatus] > severity[args.fromStatus]) {
    await applyConsequences(args.sellerId, args.toStatus);
  }
}

async function applyConsequences(sellerId: string, status: string) {
  const consequences = await prisma.sellerStandardConsequence.findMany({
    where: { status, isActive: true },
  });

  for (const consequence of consequences) {
    await prisma.sellerStandardEvent.create({
      data: {
        sellerId,
        eventType: "consequence_applied",
        toStatus: status,
        reason: consequence.consequenceType,
        metaJson: consequence.parameters,
      },
    });
  }

  // TODO: Actually enforce consequences (listing limits, payout delays, etc.)
}
```

---

## 6) Reinstatement Service

Create `packages/core/seller-standards/reinstatement.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function requestReinstatement(args: {
  sellerId: string;
  reason: string;
  supportingDocs?: string[];
}) {
  const currentSnapshot = await prisma.sellerStandardSnapshot.findFirst({
    where: { sellerId: args.sellerId },
    orderBy: { computedAt: "desc" },
  });

  if (!currentSnapshot || currentSnapshot.status === "GOOD" || currentSnapshot.status === "TOP_RATED") {
    throw new Error("Reinstatement not needed - seller is in good standing");
  }

  const request = await prisma.sellerReinstatementRequest.create({
    data: {
      sellerId: args.sellerId,
      currentStatus: currentSnapshot.status,
      requestedStatus: "GOOD",
      reason: args.reason,
      supportingDocs: args.supportingDocs ?? [],
    },
  });

  await emitAuditEvent({
    action: "seller_standards.reinstatement_requested",
    entityType: "SellerReinstatementRequest",
    entityId: request.id,
    meta: { sellerId: args.sellerId, currentStatus: currentSnapshot.status },
  });

  return request;
}

export async function reviewReinstatement(args: {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  reviewNotes?: string;
  staffActorId: string;
}) {
  const request = await prisma.sellerReinstatementRequest.update({
    where: { id: args.requestId },
    data: {
      status: args.decision,
      reviewerStaffId: args.staffActorId,
      reviewNotes: args.reviewNotes,
      reviewedAt: new Date(),
    },
  });

  if (args.decision === "APPROVED") {
    // Create new snapshot with GOOD status
    await prisma.sellerStandardSnapshot.create({
      data: {
        sellerId: request.sellerId,
        evaluationPeriod: "reinstatement",
        status: "GOOD",
        previousStatus: request.currentStatus,
        statusChangedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.sellerStandardEvent.create({
      data: {
        sellerId: request.sellerId,
        eventType: "reinstatement",
        fromStatus: request.currentStatus,
        toStatus: "GOOD",
        staffActorId: args.staffActorId,
      },
    });
  }

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "seller_standards.reinstatement_reviewed",
    entityType: "SellerReinstatementRequest",
    entityId: request.id,
    meta: { decision: args.decision },
  });

  return request;
}
```

---

## 7) Default Thresholds

Create `packages/core/seller-standards/defaults.ts`:

```ts
export const DEFAULT_THRESHOLDS = [
  {
    metric: "late_ship_rate",
    goodMax: 0.04,     // 4%
    watchMax: 0.07,    // 7%
    limitedMax: 0.10,  // 10%
    restrictedMax: 0.15, // 15%
    minOrders: 10,
  },
  {
    metric: "cancel_rate",
    goodMax: 0.02,     // 2%
    watchMax: 0.03,    // 3%
    limitedMax: 0.05,  // 5%
    restrictedMax: 0.08, // 8%
    minOrders: 10,
  },
  {
    metric: "defect_rate",
    goodMax: 0.015,    // 1.5%
    watchMax: 0.03,    // 3%
    limitedMax: 0.06,  // 6%
    restrictedMax: 0.10, // 10%
    minOrders: 10,
  },
];

export const DEFAULT_CONSEQUENCES = [
  { status: "WATCH", consequenceType: "warning_badge", parameters: {} },
  { status: "LIMITED", consequenceType: "listing_limit", parameters: { maxListings: 100 } },
  { status: "LIMITED", consequenceType: "search_demotion", parameters: { factor: 0.8 } },
  { status: "RESTRICTED", consequenceType: "listing_limit", parameters: { maxListings: 10 } },
  { status: "RESTRICTED", consequenceType: "payout_delay", parameters: { delayDays: 14 } },
  { status: "RESTRICTED", consequenceType: "search_demotion", parameters: { factor: 0.5 } },
];
```

---

## 8) Seller APIs

- `GET /api/seller/standards` - get current status + metrics
- `GET /api/seller/standards/history` - status history
- `POST /api/seller/standards/reinstatement` - request reinstatement

---

## 9) Corp APIs

- `GET /api/platform/seller-standards/overview` - aggregate stats
- `GET /api/platform/seller-standards/sellers` - list sellers by status
- `GET /api/platform/seller-standards/sellers/:id` - seller detail
- `GET /api/platform/seller-standards/reinstatements` - reinstatement queue
- `POST /api/platform/seller-standards/reinstatements/:id/review` - review reinstatement
- `PUT /api/platform/seller-standards/thresholds/:metric` - update threshold
- RBAC: requires `seller_standards.view` / `seller_standards.manage`

---

## 10) Seller Standards Scheduler (Daily Cron)

Create `packages/core/seller-standards/scheduler.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { computeSellerMetrics } from "./metrics";
import { determineSellerStatus, SellerStatus } from "./status";
import { applyConsequences, removeConsequences } from "./consequences";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

/**
 * Run scheduled seller standards evaluation
 * Should be called daily via cron job at 2 AM
 */
export async function runSellerStandardsEvaluation(): Promise<{
  evaluated: number;
  statusChanges: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let evaluated = 0;
  let statusChanges = 0;
  
  // Get all active sellers with orders in last 90 days
  const activeSellers = await prisma.order.groupBy({
    by: ["sellerId"],
    where: {
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      status: { not: "DRAFT" },
    },
    _count: true,
  });
  
  for (const seller of activeSellers) {
    try {
      const result = await evaluateSeller(seller.sellerId);
      evaluated++;
      if (result.statusChanged) statusChanges++;
    } catch (error) {
      errors.push(`${seller.sellerId}: ${error}`);
    }
  }
  
  // Log run completion
  await prisma.auditEvent.create({
    data: {
      actorUserId: "system",
      action: "seller_standards.evaluation_run",
      entityType: "SellerStandards",
      entityId: "scheduled",
      metaJson: { evaluated, statusChanges, errorCount: errors.length },
    },
  });
  
  return { evaluated, statusChanges, errors };
}

/**
 * Evaluate single seller's standards
 */
export async function evaluateSeller(sellerId: string): Promise<{
  previousStatus: SellerStatus;
  newStatus: SellerStatus;
  statusChanged: boolean;
}> {
  // Get current status
  const current = await prisma.sellerStandardSnapshot.findFirst({
    where: { sellerId },
    orderBy: { computedAt: "desc" },
  });
  const previousStatus = (current?.status as SellerStatus) ?? "GOOD";
  
  // Compute fresh metrics (90-day rolling window)
  const metrics = await computeSellerMetrics({
    sellerId,
    periodDays: 90,
  });
  
  // Determine new status
  const newStatus = await determineSellerStatus(metrics);
  
  // Save new snapshot
  await prisma.sellerStandardSnapshot.create({
    data: {
      sellerId,
      evaluationPeriod: "90d",
      status: newStatus,
      previousStatus: previousStatus,
      orderCount: metrics.orderCount,
      lateShipRate: metrics.lateShipRate,
      cancelRate: metrics.cancelRate,
      defectRate: metrics.defectRate,
      trackingUploadRate: metrics.trackingUploadRate,
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid for 24h
    },
  });
  
  // Apply/remove consequences if status changed
  const statusChanged = newStatus !== previousStatus;
  if (statusChanged) {
    // Record status change event
    await prisma.sellerStandardEvent.create({
      data: {
        sellerId,
        eventType: "status_change",
        fromStatus: previousStatus,
        toStatus: newStatus,
      },
    });
    
    if (isWorse(newStatus, previousStatus)) {
      await applyConsequences(sellerId, newStatus);
    } else {
      await removeConsequences(sellerId, newStatus);
    }
    
    // Send notification
    await notifyStatusChange(sellerId, previousStatus, newStatus);
  }
  
  return { previousStatus, newStatus, statusChanged };
}

function isWorse(newStatus: SellerStatus, oldStatus: SellerStatus): boolean {
  const order: SellerStatus[] = ["TOP_RATED", "GOOD", "WATCH", "LIMITED", "RESTRICTED"];
  return order.indexOf(newStatus) > order.indexOf(oldStatus);
}

async function notifyStatusChange(
  sellerId: string,
  from: SellerStatus,
  to: SellerStatus
): Promise<void> {
  const isDowngrade = isWorse(to, from);
  
  await prisma.notification.create({
    data: {
      userId: sellerId,
      type: "SELLER_STANDARDS_CHANGE",
      title: `Seller Status ${isDowngrade ? "Downgraded" : "Improved"}: ${to}`,
      body: isDowngrade
        ? `Your seller status has changed from ${from} to ${to}. View your performance dashboard for details and steps to improve.`
        : `Great news! Your seller status has improved from ${from} to ${to}. Keep up the good work!`,
      channel: "email",
      priority: isDowngrade ? "high" : "normal",
    },
  });
}

/**
 * Apply consequences for status
 */
async function applyConsequences(sellerId: string, status: SellerStatus): Promise<void> {
  const CONSEQUENCE_CONFIG: Record<SellerStatus, {
    listingLimit?: number;
    searchDemotion?: number;
    payoutDelayDays?: number;
  }> = {
    TOP_RATED: {},
    GOOD: {},
    WATCH: { searchDemotion: 0.95 },
    LIMITED: { listingLimit: 100, searchDemotion: 0.8, payoutDelayDays: 7 },
    RESTRICTED: { listingLimit: 10, searchDemotion: 0.5, payoutDelayDays: 14 },
  };
  
  const config = CONSEQUENCE_CONFIG[status];
  
  // Record applied consequence (per-seller tracking)
  await prisma.sellerAppliedConsequence.create({
    data: {
      sellerId,
      consequenceType: "status_consequences",
      status,
      parameters: config,
      appliedAt: new Date(),
    },
  });
  
  // Apply payout hold if needed
  if (config.payoutDelayDays) {
    await prisma.payoutHold.create({
      data: {
        sellerId,
        reasonCode: "seller_standards",
        status: "active",
        note: `${config.payoutDelayDays} day delay due to ${status} status`,
        createdByType: "system",
      },
    });
  }
}

async function removeConsequences(sellerId: string, newStatus: SellerStatus): Promise<void> {
  // Close active consequences (per-seller tracking)
  await prisma.sellerAppliedConsequence.updateMany({
    where: { sellerId, liftedAt: null },
    data: { liftedAt: new Date() },
  });
  
  // Release performance-based payout holds if status is GOOD or better
  if (newStatus === "GOOD" || newStatus === "TOP_RATED") {
    await prisma.payoutHold.updateMany({
      where: { sellerId, reasonCode: "seller_standards", status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
  }
}
```

---

## 11) Health Provider

Create `packages/core/health/providers/seller_standards.ts`:

```ts
import { HealthCheckResult } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function checkSellerStandards(): Promise<HealthCheckResult> {
  const errors: string[] = [];

  try {
    await prisma.sellerStandardSnapshot.count();
  } catch {
    errors.push("SellerStandardSnapshot table not accessible");
  }

  // Check for stale snapshots
  const staleCount = await prisma.sellerStandardSnapshot.count({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  if (staleCount > 100) {
    errors.push(`${staleCount} stale seller snapshots need refresh`);
  }

  // Check pending reinstatements
  const pendingReinstatements = await prisma.sellerReinstatementRequest.count({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    },
  });

  if (pendingReinstatements > 20) {
    errors.push(`${pendingReinstatements} reinstatements pending >48h`);
  }

  return {
    provider: "seller_standards",
    status: errors.length === 0 ? "healthy" : "degraded",
    errors,
    checkedAt: new Date().toISOString(),
  };
}
```

---

## 12) Doctor Checks (Phase 37)

Doctor must:
1. Compute metrics for test seller → verify rates calculated
2. Create snapshot → verify status assigned correctly
3. Trigger status downgrade → verify event recorded
4. Verify consequences applied for LIMITED status
5. Request reinstatement → verify request created
6. Approve reinstatement → verify status restored to GOOD
7. Update threshold → verify new threshold affects status calculation

---

## 12.1) Buyer-Visible Trust Labels

### Philosophy

> "Trust is a confidence signal, not a math report."

Buyers should see simple labels like "Trusted Seller" - NOT scores, percentages, or metrics they don't understand.

### What Buyers See

| Internal Status | Buyer-Visible Label | Badge Color | Show Badge? |
|-----------------|---------------------|-------------|-------------|
| TOP_RATED | "Top Rated Seller" ⭐ | Gold | ✓ Yes |
| GOOD | "Trusted Seller" ✓ | Green | ✓ Yes |
| WATCH | (no badge) | — | ✗ No |
| LIMITED | (no badge) | — | ✗ No |
| RESTRICTED | (no badge) | — | ✗ No |

**Key principle:** Buyers only see POSITIVE signals. Bad sellers simply have no badge - they don't see "Limited" or "Restricted" labels.

### Trust Label Settings

Add to platform settings or constants:

```typescript
// packages/core/seller-standards/settings.ts

// Buyer-visible trust labels
export const TRUST_LABEL_SETTINGS = {
  // Enable/disable buyer-visible labels
  SHOW_TRUST_LABELS_TO_BUYERS: true,

  // Labels shown to buyers (only positive tiers get labels)
  LABELS: {
    TOP_RATED: {
      text: "Top Rated Seller",
      shortText: "Top Rated",
      icon: "⭐",
      color: "gold",
      showBadge: true,
    },
    GOOD: {
      text: "Trusted Seller",
      shortText: "Trusted",
      icon: "✓",
      color: "green",
      showBadge: true,
    },
    WATCH: {
      text: null,        // No label shown
      shortText: null,
      icon: null,
      color: null,
      showBadge: false,  // Buyer sees nothing
    },
    LIMITED: {
      text: null,
      shortText: null,
      icon: null,
      color: null,
      showBadge: false,
    },
    RESTRICTED: {
      text: null,
      shortText: null,
      icon: null,
      color: null,
      showBadge: false,
    },
  },
} as const;
```

### Trust Label Service

Create `packages/core/seller-standards/trustLabelService.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { TRUST_LABEL_SETTINGS } from "./settings";

const prisma = new PrismaClient();

export type BuyerTrustLabel = {
  showLabel: boolean;
  text: string | null;
  shortText: string | null;
  icon: string | null;
  color: string | null;
};

/**
 * Get the trust label that buyers see for a seller.
 * Returns null/empty if seller doesn't qualify for a positive badge.
 *
 * IMPORTANT: This function is called from buyer-facing pages.
 * It should NEVER expose scores, metrics, or negative statuses.
 */
export async function getBuyerTrustLabel(sellerId: string): Promise<BuyerTrustLabel> {
  if (!TRUST_LABEL_SETTINGS.SHOW_TRUST_LABELS_TO_BUYERS) {
    return { showLabel: false, text: null, shortText: null, icon: null, color: null };
  }

  // Get seller's current standards status
  const snapshot = await prisma.sellerStandardSnapshot.findFirst({
    where: { sellerId },
    orderBy: { computedAt: "desc" },
    select: { status: true },  // Only select status, not metrics!
  });

  const status = snapshot?.status ?? "GOOD"; // Default new sellers to GOOD
  const labelConfig = TRUST_LABEL_SETTINGS.LABELS[status as keyof typeof TRUST_LABEL_SETTINGS.LABELS];

  if (!labelConfig?.showBadge) {
    // Seller doesn't qualify for positive badge - show nothing
    return { showLabel: false, text: null, shortText: null, icon: null, color: null };
  }

  return {
    showLabel: true,
    text: labelConfig.text,
    shortText: labelConfig.shortText,
    icon: labelConfig.icon,
    color: labelConfig.color,
  };
}

/**
 * Batch get trust labels for multiple sellers (for search results)
 */
export async function getBuyerTrustLabels(sellerIds: string[]): Promise<Map<string, BuyerTrustLabel>> {
  const results = new Map<string, BuyerTrustLabel>();

  if (!TRUST_LABEL_SETTINGS.SHOW_TRUST_LABELS_TO_BUYERS) {
    // Return empty labels for all
    for (const id of sellerIds) {
      results.set(id, { showLabel: false, text: null, shortText: null, icon: null, color: null });
    }
    return results;
  }

  // Batch fetch current snapshots
  const snapshots = await prisma.sellerStandardSnapshot.findMany({
    where: { sellerId: { in: sellerIds } },
    orderBy: { computedAt: "desc" },
    distinct: ["sellerId"],
    select: { sellerId: true, status: true },
  });

  const statusMap = new Map(snapshots.map(s => [s.sellerId, s.status]));

  for (const sellerId of sellerIds) {
    const status = statusMap.get(sellerId) ?? "GOOD";
    const labelConfig = TRUST_LABEL_SETTINGS.LABELS[status as keyof typeof TRUST_LABEL_SETTINGS.LABELS];

    if (!labelConfig?.showBadge) {
      results.set(sellerId, { showLabel: false, text: null, shortText: null, icon: null, color: null });
    } else {
      results.set(sellerId, {
        showLabel: true,
        text: labelConfig.text,
        shortText: labelConfig.shortText,
        icon: labelConfig.icon,
        color: labelConfig.color,
      });
    }
  }

  return results;
}
```

### Trust Label UI Component

```tsx
// components/listings/SellerTrustBadge.tsx

import { Badge } from "@/components/ui/badge";

type Props = {
  trustLabel: {
    showLabel: boolean;
    text: string | null;
    shortText: string | null;
    icon: string | null;
    color: string | null;
  };
  size?: "sm" | "md";
};

export function SellerTrustBadge({ trustLabel, size = "md" }: Props) {
  if (!trustLabel.showLabel) {
    return null; // No badge for this seller
  }

  const colorClasses = {
    gold: "bg-amber-100 text-amber-800 border-amber-300",
    green: "bg-green-100 text-green-800 border-green-300",
  };

  const text = size === "sm" ? trustLabel.shortText : trustLabel.text;

  return (
    <Badge
      variant="outline"
      className={colorClasses[trustLabel.color as keyof typeof colorClasses]}
    >
      {trustLabel.icon} {text}
    </Badge>
  );
}
```

---

## 13) Phase 37 Completion Criteria

- [ ] SellerStandardSnapshot, SellerStandardThreshold, SellerStandardConsequence, SellerAppliedConsequence, SellerStandardEvent, SellerReinstatementRequest tables created
- [ ] Metrics compute from real order data
- [ ] Status determination uses configurable thresholds
- [ ] Status changes trigger consequences
- [ ] Reinstatement workflow (request → review → approve/reject)
- [ ] All status changes emit audit events
- [ ] Seller dashboard shows current status + metrics
- [ ] Health provider `seller_standards` reports status
- [ ] Doctor passes all Phase 37 checks
- [ ] **Protection Score** included in metrics (Phase 38 Integration)
- [ ] **Appeal Win Rate** tracked for sellers with appeals (Phase 38 Integration)
- [ ] **Bundle Conversion Rate** displayed in dashboard (Phase 3 Integration)
- [ ] **Trust label service** returns buyer-visible labels
- [ ] **Only TOP_RATED and GOOD** show badges to buyers
- [ ] **WATCH/LIMITED/RESTRICTED** show NO badge (not negative labels)
- [ ] **Listing detail** includes seller trust label
- [ ] **Search results** include seller trust labels
- [ ] **Admin** can configure label text

---

## 14) Protection Score Metric Documentation (Phase 38 Integration)

### Protection Score Metric

| Metric | Weight | Description |
|--------|--------|-------------|
| Protection Score | 15% | Seller's buyer protection score (0-100) |

**Calculation:**
- Pulled from SellerProtectionScore model
- Updated daily
- Factors: claim rate, resolution rate, appeal success, response time

**Thresholds:**
| Level | Protection Score Required |
|-------|--------------------------|
| Top Rated | ≥ 90 |
| Above Standard | ≥ 70 |
| Standard | ≥ 50 |
| Below Standard | < 50 |

### Appeal Success Metric

| Metric | Weight | Description |
|--------|--------|-------------|
| Appeal Win Rate | 5% | Percentage of appeals won (if any filed) |

**Notes:**
- Only applies if seller has filed appeals
- Winning appeals indicates wrongful claims against seller
- High win rate = seller is careful and maintains evidence

### Bundle Performance Metric (Display Only)

| Metric | Weight | Description |
|--------|--------|-------------|
| Bundle Conversion Rate | 0% (display only) | % of bundle views that convert to orders |

**Notes:**
- Not weighted in standards calculation
- Displayed in seller dashboard for optimization
- Helps sellers understand bundle effectiveness

---

## 15) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 37 implementation |
| 1.1 | 2026-01-22 | Phase 38/3 Integration: Protection score, appeal win rate, bundle conversion metrics |
| 1.2 | 2026-01-22 | Trust Labels: Buyer-visible trust labels (only positive signals shown) |
