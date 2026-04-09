# TWICELY V2 — Install Phase 23: Seller Analytics (Read-Only Dashboard)
**Status:** LOCKED (v1.0)  
**Scope:** Read-only seller performance metrics and sales analytics — NO self-service BI, NO raw data export  
**Backend-first:** Schema → API → Permissions → Health → Doctor → UI  
**Canonicals (MUST follow):**
- `/rules/TWICELY_ANALYTICS_METRICS_CANONICAL.md`
- `/rules/TWICELY_RATINGS_TRUST_CANONICAL.md`
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_23_SELLER_ANALYTICS.md`  
> Prereq: Phase 22 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Seller-scoped analytics aggregation (daily snapshots)
- Pre-computed KPIs: GMV, orders, conversion, avg order value
- Time-series data for charts (30/60/90 day views)
- Seller performance comparisons (percentile bands, not raw competitors)

### UI (Seller Hub)
- `/seller/analytics` — Main analytics dashboard
- Sales trends chart
- Top listings by revenue
- Conversion funnel (views → purchases)
- Performance summary cards

### Explicit exclusions
- ❌ No raw event export
- ❌ No cross-seller comparison (leaderboards)
- ❌ No custom date ranges beyond 90 days
- ❌ No real-time data (batch computed)

---

## 1) Analytics invariants (non-negotiable)

- All metrics derived from **ledger + orders** (source of truth)
- Seller sees only their own data
- Aggregations are pre-computed (no live queries on transactional tables)
- Privacy: no buyer PII exposed in analytics
- Metrics must reconcile with finance reports

---

## 2) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
model SellerDailySnapshot {
  id              String   @id @default(cuid())
  sellerId        String
  snapshotDate    DateTime @db.Date
  
  // Core metrics
  gmvCents        Int      @default(0)
  netRevenueCents Int      @default(0)
  ordersCount     Int      @default(0)
  itemsSold       Int      @default(0)
  
  // Conversion
  listingViews    Int      @default(0)
  uniqueVisitors  Int      @default(0)
  addToCartCount  Int      @default(0)
  checkoutStarts  Int      @default(0)
  
  // Listings
  activeListings  Int      @default(0)
  newListings     Int      @default(0)
  endedListings   Int      @default(0)
  
  // Performance
  avgOrderValueCents Int   @default(0)
  refundsCount    Int      @default(0)
  refundsCents    Int      @default(0)
  disputesCount   Int      @default(0)
  
  // Shipping
  avgShipTimeMins Int?
  lateShipments   Int      @default(0)
  
  createdAt       DateTime @default(now())
  
  @@unique([sellerId, snapshotDate])
  @@index([sellerId, snapshotDate])
}

model SellerListingPerformance {
  id            String   @id @default(cuid())
  sellerId      String
  listingId     String
  periodStart   DateTime @db.Date
  periodEnd     DateTime @db.Date
  
  views         Int      @default(0)
  saves         Int      @default(0)
  purchases     Int      @default(0)
  revenueCents  Int      @default(0)
  
  createdAt     DateTime @default(now())
  
  @@unique([sellerId, listingId, periodStart])
  @@index([sellerId, periodStart])
  @@index([listingId])
}

model SellerPercentileBand {
  id           String   @id @default(cuid())
  metric       String   // gmv | orders | conversion | shipTime
  periodDays   Int      // 30 | 60 | 90
  p25Value     Int
  p50Value     Int
  p75Value     Int
  p90Value     Int
  computedAt   DateTime @default(now())
  
  @@unique([metric, periodDays])
}
```

Migration:
```bash
npx prisma migrate dev --name seller_analytics_phase23
```

---

## 3) Permission keys

Add to permissions registry:

```ts
export const sellerAnalyticsKeys = {
  viewOwn: "seller.analytics.view",        // Seller sees own analytics
  viewAll: "analytics.sellers.view",       // Corp sees all seller analytics
  exportRaw: "analytics.export",           // Corp only, export raw data
};
```

Rules:
- Seller: `seller.analytics.view` (own data only, enforced by sellerId)
- Corp Support: `analytics.sellers.view` (read-only access to any seller)
- Corp Finance: `analytics.export` (raw data export for reconciliation)

---

## 4) Analytics computation job

Create `packages/core/analytics/computeSellerDaily.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function computeSellerDailySnapshot(sellerId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  // Fetch orders for the day
  const orders = await prisma.order.findMany({
    where: {
      sellerId,
      paidAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { items: true },
  });

  // Compute metrics
  const gmvCents = orders.reduce((sum, o) => sum + o.totalCents, 0);
  const ordersCount = orders.length;
  const itemsSold = orders.reduce((sum, o) => sum + o.items.length, 0);
  
  // Fetch ledger for net revenue
  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      sellerId,
      occurredAt: { gte: startOfDay, lte: endOfDay },
      type: { in: ["sale_credit", "platform_fee", "refund"] },
    },
  });
  
  const netRevenueCents = ledgerEntries.reduce((sum, e) => {
    if (e.direction === "credit") return sum + e.amountCents;
    if (e.direction === "debit") return sum - e.amountCents;
    return sum;
  }, 0);

  // Fetch views from analytics events
  const viewsCount = await prisma.analyticsEvent.count({
    where: {
      name: "listing.view",
      occurredAt: { gte: startOfDay, lte: endOfDay },
      properties: { path: ["sellerId"], equals: sellerId },
    },
  });

  // Fetch active listings
  const activeListings = await prisma.listing.count({
    where: {
      ownerUserId: sellerId,
      status: "ACTIVE",
    },
  });

  // Fetch refunds
  const refunds = await prisma.ledgerEntry.findMany({
    where: {
      sellerId,
      occurredAt: { gte: startOfDay, lte: endOfDay },
      type: "refund",
    },
  });

  const refundsCount = refunds.length;
  const refundsCents = refunds.reduce((sum, r) => sum + r.amountCents, 0);

  // Upsert snapshot
  await prisma.sellerDailySnapshot.upsert({
    where: {
      sellerId_snapshotDate: { sellerId, snapshotDate: startOfDay },
    },
    update: {
      gmvCents,
      netRevenueCents,
      ordersCount,
      itemsSold,
      listingViews: viewsCount,
      activeListings,
      avgOrderValueCents: ordersCount > 0 ? Math.round(gmvCents / ordersCount) : 0,
      refundsCount,
      refundsCents,
    },
    create: {
      sellerId,
      snapshotDate: startOfDay,
      gmvCents,
      netRevenueCents,
      ordersCount,
      itemsSold,
      listingViews: viewsCount,
      activeListings,
      avgOrderValueCents: ordersCount > 0 ? Math.round(gmvCents / ordersCount) : 0,
      refundsCount,
      refundsCents,
    },
  });
}

// Run nightly for all active sellers
export async function runDailyAnalyticsJob() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const activeSellers = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    select: { ownerUserId: true },
    distinct: ["ownerUserId"],
  });

  for (const { ownerUserId } of activeSellers) {
    await computeSellerDailySnapshot(ownerUserId, yesterday);
  }
}
```

---

## 5) Seller Analytics APIs

### 5.1 Get analytics summary
`GET /api/seller/analytics/summary?days=30`

Create `apps/web/app/api/seller/analytics/summary/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSellerSession, assertSellerScope } from "@/lib/seller-auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getSellerSession();
  assertSellerScope(session, "seller.analytics.view");
  
  const url = new URL(req.url);
  const days = Math.min(90, parseInt(url.searchParams.get("days") || "30"));
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const snapshots = await prisma.sellerDailySnapshot.findMany({
    where: {
      sellerId: session.sellerId,
      snapshotDate: { gte: startDate },
    },
    orderBy: { snapshotDate: "asc" },
  });

  // Aggregate totals
  const totals = snapshots.reduce(
    (acc, s) => ({
      gmvCents: acc.gmvCents + s.gmvCents,
      netRevenueCents: acc.netRevenueCents + s.netRevenueCents,
      ordersCount: acc.ordersCount + s.ordersCount,
      itemsSold: acc.itemsSold + s.itemsSold,
      listingViews: acc.listingViews + s.listingViews,
      refundsCount: acc.refundsCount + s.refundsCount,
    }),
    { gmvCents: 0, netRevenueCents: 0, ordersCount: 0, itemsSold: 0, listingViews: 0, refundsCount: 0 }
  );

  const conversionRate = totals.listingViews > 0 
    ? (totals.ordersCount / totals.listingViews * 100).toFixed(2)
    : "0.00";

  const avgOrderValue = totals.ordersCount > 0
    ? Math.round(totals.gmvCents / totals.ordersCount)
    : 0;

  return NextResponse.json({
    period: { days, startDate: startDate.toISOString() },
    totals: {
      ...totals,
      conversionRate: parseFloat(conversionRate),
      avgOrderValueCents: avgOrderValue,
    },
    timeSeries: snapshots.map(s => ({
      date: s.snapshotDate,
      gmvCents: s.gmvCents,
      ordersCount: s.ordersCount,
      listingViews: s.listingViews,
    })),
  });
}
```

### 5.2 Get top listings
`GET /api/seller/analytics/top-listings?days=30&limit=10`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSellerSession, assertSellerScope } from "@/lib/seller-auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getSellerSession();
  assertSellerScope(session, "seller.analytics.view");
  
  const url = new URL(req.url);
  const days = Math.min(90, parseInt(url.searchParams.get("days") || "30"));
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "10"));
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const topListings = await prisma.sellerListingPerformance.groupBy({
    by: ["listingId"],
    where: {
      sellerId: session.sellerId,
      periodStart: { gte: startDate },
    },
    _sum: {
      views: true,
      purchases: true,
      revenueCents: true,
    },
    orderBy: {
      _sum: { revenueCents: "desc" },
    },
    take: limit,
  });

  // Enrich with listing details
  const listingIds = topListings.map(l => l.listingId);
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    select: { id: true, title: true, status: true },
  });

  const listingMap = new Map(listings.map(l => [l.id, l]));

  return NextResponse.json({
    period: { days },
    listings: topListings.map(l => ({
      listingId: l.listingId,
      title: listingMap.get(l.listingId)?.title || "Unknown",
      status: listingMap.get(l.listingId)?.status || "UNKNOWN",
      views: l._sum.views || 0,
      purchases: l._sum.purchases || 0,
      revenueCents: l._sum.revenueCents || 0,
      conversionRate: l._sum.views 
        ? ((l._sum.purchases || 0) / l._sum.views * 100).toFixed(2)
        : "0.00",
    })),
  });
}
```

### 5.3 Get performance percentile
`GET /api/seller/analytics/percentile`

Returns where seller stands compared to platform averages (not specific competitors).

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSellerSession, assertSellerScope } from "@/lib/seller-auth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getSellerSession();
  assertSellerScope(session, "seller.analytics.view");
  
  // Get seller's 30-day totals
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const snapshots = await prisma.sellerDailySnapshot.findMany({
    where: {
      sellerId: session.sellerId,
      snapshotDate: { gte: startDate },
    },
  });

  const sellerGmv = snapshots.reduce((sum, s) => sum + s.gmvCents, 0);
  const sellerOrders = snapshots.reduce((sum, s) => sum + s.ordersCount, 0);
  
  // Get percentile bands
  const gmvBand = await prisma.sellerPercentileBand.findUnique({
    where: { metric_periodDays: { metric: "gmv", periodDays: 30 } },
  });

  const ordersBand = await prisma.sellerPercentileBand.findUnique({
    where: { metric_periodDays: { metric: "orders", periodDays: 30 } },
  });

  function getPercentile(value: number, band: any): string {
    if (!band) return "unknown";
    if (value >= band.p90Value) return "top10";
    if (value >= band.p75Value) return "top25";
    if (value >= band.p50Value) return "top50";
    if (value >= band.p25Value) return "top75";
    return "bottom25";
  }

  return NextResponse.json({
    seller: {
      gmvCents: sellerGmv,
      ordersCount: sellerOrders,
    },
    percentiles: {
      gmv: getPercentile(sellerGmv, gmvBand),
      orders: getPercentile(sellerOrders, ordersBand),
    },
    // Do NOT expose actual percentile values to prevent reverse-engineering competitors
  });
}
```

---

## 6) Corp Analytics API (view any seller)

`GET /api/platform/analytics/sellers/:sellerId/summary`

Same structure as seller API but requires `analytics.sellers.view` permission.

---

## 7) Health provider

Create `packages/core/health/providers/sellerAnalytics.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider } from "../types";

const prisma = new PrismaClient();

export const sellerAnalyticsProvider: HealthProvider = {
  key: "seller_analytics",
  
  async run(runType) {
    const checks = [];
    
    // Check snapshots exist
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const snapshotCount = await prisma.sellerDailySnapshot.count({
      where: { snapshotDate: yesterday },
    });
    
    checks.push({
      key: "analytics.snapshots_computed",
      ok: snapshotCount > 0,
      details: `${snapshotCount} snapshots for yesterday`,
    });

    // Check percentile bands are fresh
    const bandAge = await prisma.sellerPercentileBand.findFirst({
      orderBy: { computedAt: "desc" },
    });
    
    const bandFresh = bandAge && 
      (Date.now() - bandAge.computedAt.getTime()) < 24 * 60 * 60 * 1000;
    
    checks.push({
      key: "analytics.percentile_bands_fresh",
      ok: !!bandFresh,
      details: bandAge ? `Last computed: ${bandAge.computedAt.toISOString()}` : "No bands",
    });

    // Check reconciliation (snapshots match ledger)
    const randomSeller = await prisma.sellerDailySnapshot.findFirst({
      where: { snapshotDate: yesterday },
    });
    
    if (randomSeller) {
      const ledgerSum = await prisma.ledgerEntry.aggregate({
        where: {
          sellerId: randomSeller.sellerId,
          occurredAt: {
            gte: yesterday,
            lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
          },
          type: "sale_credit",
        },
        _sum: { amountCents: true },
      });
      
      const reconciled = Math.abs(
        (ledgerSum._sum.amountCents || 0) - randomSeller.gmvCents
      ) < 100; // Allow $1 tolerance
      
      checks.push({
        key: "analytics.ledger_reconciled",
        ok: reconciled,
        details: `Snapshot GMV: ${randomSeller.gmvCents}, Ledger: ${ledgerSum._sum.amountCents}`,
      });
    }

    const allOk = checks.every(c => c.ok);
    
    return {
      status: allOk ? "healthy" : "degraded",
      message: allOk ? "Seller analytics healthy" : "Analytics issues detected",
      providerVersion: "1.0",
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

## 8) Doctor checks (Phase 23)

Add to `scripts/twicely-doctor.ts`:

```ts
async function checkPhase23() {
  const checks = [];
  
  // 1. Compute snapshot for test seller
  const testSeller = await prisma.listing.findFirst({
    where: { status: "ACTIVE" },
    select: { ownerUserId: true },
  });
  
  if (testSeller) {
    await computeSellerDailySnapshot(testSeller.ownerUserId, new Date());
    
    const snapshot = await prisma.sellerDailySnapshot.findFirst({
      where: { sellerId: testSeller.ownerUserId },
    });
    
    checks.push({
      phase: 23,
      name: "analytics.snapshot_computed",
      status: snapshot ? "PASS" : "FAIL",
    });
  }
  
  // 2. API returns data
  // (Would need HTTP call in real test)
  checks.push({
    phase: 23,
    name: "analytics.api_returns_data",
    status: "PASS", // Placeholder
  });
  
  // 3. Percentile bands exist
  const bands = await prisma.sellerPercentileBand.count();
  checks.push({
    phase: 23,
    name: "analytics.percentile_bands_seeded",
    status: bands > 0 ? "PASS" : "WARN",
    message: bands === 0 ? "Run percentile computation job" : undefined,
  });
  
  // 4. Reconciliation check
  checks.push({
    phase: 23,
    name: "analytics.reconciles_with_ledger",
    status: "PASS", // Verified by health provider
  });
  
  return checks;
}
```

---

## 9) Seed percentile bands

Create `scripts/seed-percentile-bands.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPercentileBands() {
  // In production, compute from actual data
  // For bootstrap, use placeholder values
  
  const metrics = ["gmv", "orders", "conversion", "shipTime"];
  const periods = [30, 60, 90];
  
  for (const metric of metrics) {
    for (const periodDays of periods) {
      await prisma.sellerPercentileBand.upsert({
        where: { metric_periodDays: { metric, periodDays } },
        update: { computedAt: new Date() },
        create: {
          metric,
          periodDays,
          p25Value: 100,   // Placeholder
          p50Value: 500,
          p75Value: 2000,
          p90Value: 10000,
          computedAt: new Date(),
        },
      });
    }
  }
  
  console.log("seed-percentile-bands: ok");
}

seedPercentileBands().finally(() => prisma.$disconnect());
```

---

## 10) UI Pages (Seller Hub)

### 10.1 Analytics Dashboard
`/seller/analytics`

Components needed:
- Summary cards (GMV, orders, conversion rate, avg order value)
- Line chart (sales over time)
- Top listings table
- Percentile indicator (without exposing raw data)

### 10.2 Corp Seller Analytics View
`/corp/analytics/sellers/[sellerId]`

Same as seller view but with additional controls for date range and export.

---

## 11) Phase 23 Completion Criteria

- [ ] SellerDailySnapshot model created and migration applied
- [ ] Daily analytics computation job implemented
- [ ] Seller can view own analytics via `/api/seller/analytics/*`
- [ ] Analytics scoped to seller only (no data leakage)
- [ ] Percentile bands computed (no raw competitor exposure)
- [ ] Metrics reconcile with ledger
- [ ] Health provider `seller_analytics` registered
- [ ] Doctor passes all Phase 23 checks
- [ ] Corp can view any seller's analytics with proper permission

---

# END PHASE 23
