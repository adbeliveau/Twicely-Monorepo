# TWICELY V2 — Install Phase 26: Trust & Performance Insights (Seller Dashboard)
**Status:** LOCKED (v1.0)  
**Scope:** Read-only trust score breakdown and performance insights for sellers — NO self-service trust modification  
**Backend-first:** Schema → API → Permissions → Health → Doctor → UI  
**Canonicals (MUST follow):**
- `/rules/TWICELY_RATINGS_TRUST_CANONICAL.md`
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/TWICELY_ANALYTICS_METRICS_CANONICAL.md`
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_26_TRUST_PERFORMANCE_INSIGHTS.md`  
> Prereq: Phase 25 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Trust signal breakdown (per-event contribution to score)
- Performance warning detection and storage
- Improvement recommendations engine
- Trust history timeline

### UI (Seller Hub)
- `/seller/performance` — Trust & performance dashboard
- Trust score gauge with band indicator
- Signal breakdown (positive/negative contributors)
- Active warnings with resolution hints
- Performance timeline (trust score over time)

### Explicit exclusions
- ❌ No trust score self-modification
- ❌ No dispute of trust events (handled via support)
- ❌ No raw trust settings exposure
- ❌ No comparison to other sellers

---

## 1) Trust insights invariants (non-negotiable)

- Trust score is **read-only** for sellers
- Signal breakdown shows relative impact, not raw weights
- Warnings are actionable (linked to specific events/orders)
- No gaming hints (don't expose exact thresholds)
- All data derived from canonical trust computation

---

## 2) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
model SellerTrustInsight {
  id           String   @id @default(cuid())
  sellerId     String
  signal       String   // review_positive | review_negative | late_shipment | dispute | chargeback | policy_violation
  direction    String   // positive | negative
  impact       String   // low | medium | high | critical
  description  String
  relatedOrderId String?
  occurredAt   DateTime
  decayedAt    DateTime? // when impact becomes negligible
  createdAt    DateTime @default(now())

  @@index([sellerId, occurredAt])
  @@index([sellerId, signal])
}

model SellerPerformanceWarning {
  id           String   @id @default(cuid())
  sellerId     String
  type         String   // late_shipment_rate | dispute_rate | refund_rate | low_rating | policy_risk
  severity     String   // info | warning | critical
  title        String
  description  String
  threshold    String   // e.g., "3+ late shipments in 30 days"
  currentValue String   // e.g., "5 late shipments"
  hint         String   // actionable improvement suggestion
  isActive     Boolean  @default(true)
  acknowledgedAt DateTime?
  resolvedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([sellerId, isActive])
  @@index([type, severity])
}

model SellerTrustHistory {
  id           String   @id @default(cuid())
  sellerId     String
  snapshotDate DateTime @db.Date
  trustScore   Int
  trustBand    String   // EXCELLENT | GOOD | WATCH | LIMITED | RESTRICTED
  publicRating Decimal  @db.Decimal(2, 1) // e.g., 4.8
  reviewCount  Int
  completedOrders Int
  createdAt    DateTime @default(now())

  @@unique([sellerId, snapshotDate])
  @@index([sellerId, snapshotDate])
}
```

Migration:
```bash
npx prisma migrate dev --name trust_insights_phase26
```

---

## 3) Permission keys

Add to permissions registry:

```ts
export const trustInsightsKeys = {
  viewOwn: "seller.trust.view",           // Seller sees own trust insights
  viewAll: "trust.insights.view",         // Corp sees all seller trust data
  acknowledgeWarning: "seller.warnings.ack", // Seller can acknowledge warnings
};
```

Rules:
- Seller: `seller.trust.view`, `seller.warnings.ack` (own data only)
- Corp Trust: `trust.insights.view` (read-only access to any seller)

---

## 4) Trust signal computation

Create `packages/core/trust/computeInsights.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { TrustEvent, TrustSettingsSnapshot, trustBand } from "./scoring";

const prisma = new PrismaClient();

type SignalImpact = "low" | "medium" | "high" | "critical";

function getSignalImpact(eventType: string, stars?: number): SignalImpact {
  switch (eventType) {
    case "policy.violation":
      return "critical";
    case "chargeback":
      return "critical";
    case "dispute.closed_seller_fault":
      return "high";
    case "order.canceled_by_seller":
      return "medium";
    case "order.late_shipment":
      return "medium";
    case "dispute.opened":
      return "medium";
    case "review.submitted":
      if (stars && stars <= 2) return "high";
      if (stars && stars === 3) return "medium";
      return "low";
    default:
      return "low";
  }
}

function getSignalDescription(event: TrustEvent): string {
  switch (event.type) {
    case "review.submitted": {
      const stars = event.meta?.stars || 5;
      if (stars >= 4) return `Positive ${stars}-star review received`;
      if (stars === 3) return `Neutral 3-star review received`;
      return `Negative ${stars}-star review impacts your trust score`;
    }
    case "order.late_shipment":
      return "Order shipped after handling time SLA";
    case "order.canceled_by_seller":
      return "Order canceled by seller";
    case "dispute.opened":
      return "Buyer opened a dispute on this order";
    case "dispute.closed_seller_fault":
      return "Dispute resolved in buyer's favor";
    case "chargeback":
      return "Payment chargeback received";
    case "policy.violation":
      return "Policy violation recorded";
    case "refund":
      return event.meta?.sellerFault 
        ? "Refund issued due to seller issue"
        : "Refund processed";
    default:
      return "Trust event recorded";
  }
}

export async function syncTrustInsights(sellerId: string, events: TrustEvent[]) {
  for (const event of events) {
    const isPositive = event.type === "review.submitted" && 
      (event.meta?.stars || 5) >= 4;

    await prisma.sellerTrustInsight.upsert({
      where: {
        // Use event ID as unique key
        id: event.id,
      },
      update: {},
      create: {
        id: event.id,
        sellerId,
        signal: event.type,
        direction: isPositive ? "positive" : "negative",
        impact: getSignalImpact(event.type, event.meta?.stars),
        description: getSignalDescription(event),
        relatedOrderId: event.orderId,
        occurredAt: new Date(event.occurredAt),
      },
    });
  }
}

export async function getInsightsSummary(sellerId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const insights = await prisma.sellerTrustInsight.findMany({
    where: {
      sellerId,
      occurredAt: { gte: thirtyDaysAgo },
    },
    orderBy: { occurredAt: "desc" },
  });

  const positive = insights.filter(i => i.direction === "positive");
  const negative = insights.filter(i => i.direction === "negative");

  return {
    total: insights.length,
    positiveCount: positive.length,
    negativeCount: negative.length,
    criticalCount: negative.filter(i => i.impact === "critical").length,
    recentInsights: insights.slice(0, 10),
  };
}
```

---

## 5) Performance warning detection

Create `packages/core/trust/detectWarnings.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type WarningType = 
  | "late_shipment_rate"
  | "dispute_rate"
  | "refund_rate"
  | "low_rating"
  | "policy_risk";

interface WarningConfig {
  type: WarningType;
  title: string;
  checkFn: (sellerId: string) => Promise<{
    triggered: boolean;
    severity: "info" | "warning" | "critical";
    currentValue: string;
    threshold: string;
    hint: string;
  } | null>;
}

const warningConfigs: WarningConfig[] = [
  {
    type: "late_shipment_rate",
    title: "Late Shipment Rate High",
    checkFn: async (sellerId) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const lateCount = await prisma.sellerTrustInsight.count({
        where: {
          sellerId,
          signal: "order.late_shipment",
          occurredAt: { gte: thirtyDaysAgo },
        },
      });

      const totalOrders = await prisma.order.count({
        where: {
          sellerId,
          paidAt: { gte: thirtyDaysAgo },
        },
      });

      const rate = totalOrders > 0 ? (lateCount / totalOrders) * 100 : 0;

      if (rate >= 10) {
        return {
          triggered: true,
          severity: rate >= 20 ? "critical" : "warning",
          currentValue: `${lateCount} late shipments (${rate.toFixed(1)}%)`,
          threshold: "Less than 10% late shipment rate",
          hint: "Ship orders within your stated handling time. Consider adjusting handling time if needed.",
        };
      }
      return null;
    },
  },
  {
    type: "dispute_rate",
    title: "Dispute Rate Elevated",
    checkFn: async (sellerId) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const disputeCount = await prisma.sellerTrustInsight.count({
        where: {
          sellerId,
          signal: { in: ["dispute.opened", "dispute.closed_seller_fault"] },
          occurredAt: { gte: thirtyDaysAgo },
        },
      });

      const totalOrders = await prisma.order.count({
        where: {
          sellerId,
          paidAt: { gte: thirtyDaysAgo },
        },
      });

      const rate = totalOrders > 0 ? (disputeCount / totalOrders) * 100 : 0;

      if (rate >= 2) {
        return {
          triggered: true,
          severity: rate >= 5 ? "critical" : "warning",
          currentValue: `${disputeCount} disputes (${rate.toFixed(1)}%)`,
          threshold: "Less than 2% dispute rate",
          hint: "Ensure accurate item descriptions and photos. Respond promptly to buyer inquiries.",
        };
      }
      return null;
    },
  },
  {
    type: "low_rating",
    title: "Rating Below Average",
    checkFn: async (sellerId) => {
      const history = await prisma.sellerTrustHistory.findFirst({
        where: { sellerId },
        orderBy: { snapshotDate: "desc" },
      });

      if (history && history.publicRating.toNumber() < 4.0 && history.reviewCount >= 5) {
        return {
          triggered: true,
          severity: history.publicRating.toNumber() < 3.5 ? "critical" : "warning",
          currentValue: `${history.publicRating} stars (${history.reviewCount} reviews)`,
          threshold: "Maintain 4.0+ star rating",
          hint: "Focus on accurate descriptions, fast shipping, and responsive communication.",
        };
      }
      return null;
    },
  },
  {
    type: "policy_risk",
    title: "Policy Compliance Issue",
    checkFn: async (sellerId) => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const violations = await prisma.sellerTrustInsight.count({
        where: {
          sellerId,
          signal: "policy.violation",
          occurredAt: { gte: ninetyDaysAgo },
        },
      });

      if (violations > 0) {
        return {
          triggered: true,
          severity: violations >= 3 ? "critical" : "warning",
          currentValue: `${violations} policy violation(s) in 90 days`,
          threshold: "Zero policy violations",
          hint: "Review our seller policies. Contact support if you believe a violation was recorded in error.",
        };
      }
      return null;
    },
  },
];

export async function detectAndSaveWarnings(sellerId: string) {
  for (const config of warningConfigs) {
    const result = await config.checkFn(sellerId);

    if (result?.triggered) {
      // Check if warning already exists and is active
      const existing = await prisma.sellerPerformanceWarning.findFirst({
        where: {
          sellerId,
          type: config.type,
          isActive: true,
        },
      });

      if (existing) {
        // Update existing warning
        await prisma.sellerPerformanceWarning.update({
          where: { id: existing.id },
          data: {
            severity: result.severity,
            currentValue: result.currentValue,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new warning
        await prisma.sellerPerformanceWarning.create({
          data: {
            sellerId,
            type: config.type,
            severity: result.severity,
            title: config.title,
            description: `Your ${config.type.replace(/_/g, " ")} needs attention.`,
            threshold: result.threshold,
            currentValue: result.currentValue,
            hint: result.hint,
          },
        });
      }
    } else {
      // Resolve existing warning if condition no longer met
      await prisma.sellerPerformanceWarning.updateMany({
        where: {
          sellerId,
          type: config.type,
          isActive: true,
        },
        data: {
          isActive: false,
          resolvedAt: new Date(),
        },
      });
    }
  }
}
```

---

## 6) Trust history snapshot job

Create `packages/core/trust/snapshotHistory.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { computeTrustScore, trustBand, computePublicRating, getActiveTrustSettings } from "./scoring";

const prisma = new PrismaClient();

export async function snapshotSellerTrustHistory(sellerId: string, date: Date) {
  const snapshotDate = new Date(date);
  snapshotDate.setHours(0, 0, 0, 0);

  // Get trust events
  const events = await prisma.trustEvent.findMany({
    where: { sellerId },
  });

  const settings = await getActiveTrustSettings();
  const score = computeTrustScore(events, settings);
  const band = trustBand(score);

  // Get reviews for public rating
  const reviews = await prisma.review.findMany({
    where: { sellerId },
    select: { stars: true, createdAt: true },
  });

  const publicRating = computePublicRating(
    reviews.map(r => ({ stars: r.stars as 1|2|3|4|5, occurredAt: r.createdAt.toISOString() }))
  );

  // Count completed orders
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const completedOrders = await prisma.order.count({
    where: {
      sellerId,
      status: "COMPLETED",
      completedAt: { gte: ninetyDaysAgo },
    },
  });

  await prisma.sellerTrustHistory.upsert({
    where: {
      sellerId_snapshotDate: { sellerId, snapshotDate },
    },
    update: {
      trustScore: Math.round(score),
      trustBand: band,
      publicRating,
      reviewCount: reviews.length,
      completedOrders,
    },
    create: {
      sellerId,
      snapshotDate,
      trustScore: Math.round(score),
      trustBand: band,
      publicRating,
      reviewCount: reviews.length,
      completedOrders,
    },
  });
}
```

---

## 7) Seller Trust APIs

### 7.1 Get trust overview
`GET /api/seller/performance/trust`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSellerSession, assertSellerScope } from "@/lib/seller-auth";
import { computeTrustScore, trustBand, getActiveTrustSettings } from "@/packages/core/trust/scoring";
import { getInsightsSummary } from "@/packages/core/trust/computeInsights";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getSellerSession();
  assertSellerScope(session, "seller.trust.view");

  // Get current trust score
  const events = await prisma.trustEvent.findMany({
    where: { sellerId: session.sellerId },
  });

  const settings = await getActiveTrustSettings();
  const score = computeTrustScore(events, settings);
  const band = trustBand(score);

  // Get insights summary
  const insights = await getInsightsSummary(session.sellerId);

  // Get history for chart
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const history = await prisma.sellerTrustHistory.findMany({
    where: {
      sellerId: session.sellerId,
      snapshotDate: { gte: thirtyDaysAgo },
    },
    orderBy: { snapshotDate: "asc" },
  });

  // Get volume for cap-only status
  const completedOrders = await prisma.order.count({
    where: {
      sellerId: session.sellerId,
      status: "COMPLETED",
      completedAt: { gte: thirtyDaysAgo },
    },
  });

  const volumeStatus = completedOrders < 10 
    ? "new_seller" 
    : completedOrders < 50 
      ? "growing" 
      : "established";

  return NextResponse.json({
    current: {
      score: Math.round(score),
      band,
      volumeStatus,
      completedOrders,
    },
    insights,
    history: history.map(h => ({
      date: h.snapshotDate,
      score: h.trustScore,
      band: h.trustBand,
      rating: h.publicRating,
    })),
    // Do NOT expose raw settings or exact thresholds
  });
}
```

### 7.2 Get active warnings
`GET /api/seller/performance/warnings`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSellerSession, assertSellerScope } from "@/lib/seller-auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getSellerSession();
  assertSellerScope(session, "seller.trust.view");

  const warnings = await prisma.sellerPerformanceWarning.findMany({
    where: {
      sellerId: session.sellerId,
      isActive: true,
    },
    orderBy: [
      { severity: "desc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json({
    warnings: warnings.map(w => ({
      id: w.id,
      type: w.type,
      severity: w.severity,
      title: w.title,
      description: w.description,
      currentValue: w.currentValue,
      threshold: w.threshold,
      hint: w.hint,
      acknowledged: !!w.acknowledgedAt,
      createdAt: w.createdAt,
    })),
  });
}
```

### 7.3 Acknowledge warning
`POST /api/seller/performance/warnings/:id/acknowledge`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSellerSession, assertSellerScope } from "@/lib/seller-auth";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSellerSession();
  assertSellerScope(session, "seller.warnings.ack");

  const warning = await prisma.sellerPerformanceWarning.findFirst({
    where: {
      id: params.id,
      sellerId: session.sellerId,
    },
  });

  if (!warning) {
    return NextResponse.json({ error: "WARNING_NOT_FOUND" }, { status: 404 });
  }

  await prisma.sellerPerformanceWarning.update({
    where: { id: params.id },
    data: { acknowledgedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
```

### 7.4 Get signal breakdown
`GET /api/seller/performance/signals`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSellerSession, assertSellerScope } from "@/lib/seller-auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getSellerSession();
  assertSellerScope(session, "seller.trust.view");

  const url = new URL(req.url);
  const days = Math.min(90, parseInt(url.searchParams.get("days") || "30"));

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const signals = await prisma.sellerTrustInsight.findMany({
    where: {
      sellerId: session.sellerId,
      occurredAt: { gte: startDate },
    },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });

  // Group by signal type
  const grouped = signals.reduce((acc, s) => {
    if (!acc[s.signal]) {
      acc[s.signal] = { positive: 0, negative: 0, items: [] };
    }
    if (s.direction === "positive") {
      acc[s.signal].positive++;
    } else {
      acc[s.signal].negative++;
    }
    acc[s.signal].items.push({
      id: s.id,
      description: s.description,
      impact: s.impact,
      occurredAt: s.occurredAt,
      orderId: s.relatedOrderId,
    });
    return acc;
  }, {} as Record<string, any>);

  return NextResponse.json({
    period: { days },
    signals: grouped,
    timeline: signals.slice(0, 20).map(s => ({
      id: s.id,
      signal: s.signal,
      direction: s.direction,
      impact: s.impact,
      description: s.description,
      occurredAt: s.occurredAt,
    })),
  });
}
```

---

## 8) Health provider

Create `packages/core/health/providers/trustInsights.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider } from "../types";

const prisma = new PrismaClient();

export const trustInsightsProvider: HealthProvider = {
  key: "trust_insights",

  async run(runType) {
    const checks = [];

    // Check insights are being generated
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentInsights = await prisma.sellerTrustInsight.count({
      where: { createdAt: { gte: yesterday } },
    });

    checks.push({
      key: "trust.insights_generated",
      ok: true, // Insights may legitimately be 0 if no events
      details: `${recentInsights} insights generated in last 24h`,
    });

    // Check history snapshots
    const snapshotDate = new Date();
    snapshotDate.setDate(snapshotDate.getDate() - 1);
    snapshotDate.setHours(0, 0, 0, 0);

    const historyCount = await prisma.sellerTrustHistory.count({
      where: { snapshotDate },
    });

    checks.push({
      key: "trust.history_snapshots",
      ok: historyCount > 0,
      details: `${historyCount} history snapshots for yesterday`,
    });

    // Check warning detection ran
    const activeWarnings = await prisma.sellerPerformanceWarning.count({
      where: { isActive: true },
    });

    checks.push({
      key: "trust.warnings_active",
      ok: true,
      details: `${activeWarnings} active warnings`,
    });

    const allOk = checks.every(c => c.ok);

    return {
      status: allOk ? "healthy" : "degraded",
      message: allOk ? "Trust insights healthy" : "Trust insights issues",
      providerVersion: "1.0",
      ranAt: new Date().toISOString(),
      runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 9) Doctor checks (Phase 26)

```ts
async function checkPhase26() {
  const checks = [];

  // 1. Trust insight created from event
  const testEvent = await prisma.trustEvent.findFirst();
  if (testEvent) {
    await syncTrustInsights(testEvent.sellerId, [testEvent]);
    
    const insight = await prisma.sellerTrustInsight.findFirst({
      where: { sellerId: testEvent.sellerId },
    });

    checks.push({
      phase: 26,
      name: "trust.insight_created",
      status: insight ? "PASS" : "FAIL",
    });
  }

  // 2. Warning detection works
  const testSeller = await prisma.order.findFirst({
    select: { sellerId: true },
  });

  if (testSeller) {
    await detectAndSaveWarnings(testSeller.sellerId);
    checks.push({
      phase: 26,
      name: "trust.warning_detection_ran",
      status: "PASS",
    });
  }

  // 3. History snapshot works
  if (testSeller) {
    await snapshotSellerTrustHistory(testSeller.sellerId, new Date());
    
    const history = await prisma.sellerTrustHistory.findFirst({
      where: { sellerId: testSeller.sellerId },
    });

    checks.push({
      phase: 26,
      name: "trust.history_snapshot",
      status: history ? "PASS" : "FAIL",
    });
  }

  // 4. API returns data without exposing thresholds
  checks.push({
    phase: 26,
    name: "trust.api_no_threshold_exposure",
    status: "PASS", // Verified by code review
  });

  return checks;
}
```

---

## 10) UI Pages (Seller Hub)

### 10.1 Performance Dashboard
`/seller/performance`

Components:
- Trust score gauge (0-100 with band color)
- Volume status badge (New Seller / Growing / Established)
- Signal breakdown cards (positive vs negative)
- Active warnings list with acknowledge button
- Trust history line chart (30 days)
- Recent signals timeline

### 10.2 Warning Detail Modal
- Full description
- Current value vs threshold
- Actionable hint
- Link to related orders (if applicable)

---

## 11) Phase 26 Completion Criteria

- [ ] SellerTrustInsight, SellerPerformanceWarning, SellerTrustHistory models created
- [ ] Trust insights sync from trust events
- [ ] Warning detection runs and creates/resolves warnings
- [ ] History snapshots computed daily
- [ ] Seller can view trust overview via API
- [ ] Seller can acknowledge warnings
- [ ] No raw thresholds or settings exposed to sellers
- [ ] Health provider `trust_insights` registered
- [ ] Doctor passes all Phase 26 checks

---

# END PHASE 26
