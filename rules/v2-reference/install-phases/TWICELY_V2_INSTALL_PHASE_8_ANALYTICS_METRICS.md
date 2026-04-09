# TWICELY V2 — Install Phase 8: Analytics & Metrics (Core)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema → Events → Snapshots → Health → UI → Doctor  
**Canonical:** `/rules/TWICELY_ANALYTICS_METRICS_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_8_ANALYTICS_METRICS.md`  
> Prereq: Phase 7 complete.

---

## 0) What this phase installs

### Backend
- AnalyticsEvent (idempotent event tracking)
- MetricSnapshot (time-series metric storage)
- MetricDefinition (metric configuration)
- Event emitter helpers wired to key flows
- Snapshot computation jobs

### UI (Corp)
- Corp → Analytics → Platform dashboard (GMV, orders, users)
- Corp → Analytics → Event explorer

### Ops
- Health provider: `analytics`
- Doctor checks: event idempotency + snapshot write + metric accuracy

---

## 1) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
// ============================================================
// PHASE 8: ANALYTICS & METRICS
// ============================================================

model AnalyticsEvent {
  id          String   @id @default(cuid())
  
  // Event identification
  eventType   String   // e.g., "listing.viewed", "order.placed"
  eventKey    String   @unique  // Idempotency key
  
  // Actors
  userId      String?  // The user who triggered the event (if known)
  sessionId   String?  // Browser/app session
  sellerId    String?  // Associated seller (if applicable)
  
  // Entities
  listingId   String?
  orderId     String?
  categoryId  String?
  
  // Context
  searchQuery String?  // If from search
  source      String?  // Referrer source
  medium      String?  // Marketing medium
  campaign    String?  // Campaign identifier
  
  // Device info
  deviceType  String?  // desktop|mobile|tablet
  platform    String?  // web|ios|android
  userAgent   String?
  ipHash      String?  // Hashed IP for geo (privacy-safe)
  country     String?
  region      String?
  
  // Event data
  metaJson    Json     @default("{}")
  
  // Timestamps
  occurredAt  DateTime @default(now())
  createdAt   DateTime @default(now())
  
  @@index([eventType, occurredAt])
  @@index([userId, occurredAt])
  @@index([listingId, eventType])
  @@index([orderId, eventType])
  @@index([sessionId, occurredAt])
}

model MetricDefinition {
  id          String   @id @default(cuid())
  key         String   @unique  // e.g., "gmv.daily", "orders.count"
  name        String
  description String?
  
  // Computation
  computationType String @default("SUM")  // SUM|COUNT|AVG|MIN|MAX
  sourceTable     String // Table to compute from
  sourceColumn    String? // Column for SUM/AVG (null for COUNT)
  filterJson      Json    @default("{}") // WHERE conditions
  
  // Dimensions
  dimensions      String[] // Grouping dimensions
  
  // Schedule
  period          String @default("DAILY") // HOURLY|DAILY|WEEKLY|MONTHLY
  isActive        Boolean @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model MetricSnapshot {
  id          String   @id @default(cuid())
  metricKey   String   // References MetricDefinition.key
  
  // Time period
  period      String   // HOURLY|DAILY|WEEKLY|MONTHLY
  periodStart DateTime
  periodEnd   DateTime
  
  // Value
  value       Float
  
  // Dimensions (for sliced metrics)
  dimensions  Json     @default("{}")  // e.g., {"categoryId": "cat_123"}
  
  // Metadata
  computedAt  DateTime @default(now())
  createdAt   DateTime @default(now())
  
  @@unique([metricKey, period, periodStart, dimensions])
  @@index([metricKey, periodStart])
  @@index([period, periodStart])
}

model AnalyticsDashboard {
  id          String   @id @default(cuid())
  key         String   @unique
  name        String
  description String?
  
  // Dashboard configuration
  layoutJson  Json     @default("[]")  // Widget layout
  filtersJson Json     @default("{}")  // Default filters
  
  // Access control
  isPublic    Boolean  @default(false)
  allowedRoles String[] @default([])
  
  createdByStaffId String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Migrate:
```bash
npx prisma migrate dev --name analytics_phase8
```

---

## 2) Analytics Types

Create `packages/core/analytics/types.ts`:

```ts
/**
 * Standard analytics event types
 */
export type AnalyticsEventType =
  // Listing events
  | "listing.viewed"
  | "listing.created"
  | "listing.activated"
  | "listing.ended"
  | "listing.favorited"
  | "listing.unfavorited"
  
  // Search events
  | "search.performed"
  | "search.result.clicked"
  | "search.no_results"
  
  // Order events
  | "order.started"
  | "order.placed"
  | "order.paid"
  | "order.shipped"
  | "order.delivered"
  | "order.completed"
  | "order.canceled"
  
  // User events
  | "user.signed_up"
  | "user.logged_in"
  | "user.seller_onboarded"
  
  // Payout events
  | "payout.requested"
  | "payout.sent"
  
  // Review events
  | "review.submitted";

export type EmitEventArgs = {
  eventType: AnalyticsEventType | string;
  eventKey: string;  // Idempotency key
  userId?: string;
  sessionId?: string;
  sellerId?: string;
  listingId?: string;
  orderId?: string;
  categoryId?: string;
  searchQuery?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  deviceType?: string;
  platform?: string;
  meta?: Record<string, any>;
};

export type MetricPeriod = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";

export type MetricValue = {
  metricKey: string;
  period: MetricPeriod;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  dimensions?: Record<string, string>;
};

export type DashboardWidget = {
  id: string;
  type: "metric" | "chart" | "table";
  metricKey?: string;
  chartType?: "line" | "bar" | "pie";
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
};
```

---

## 3) Event Emitter (Idempotent)

Create `packages/core/analytics/emitEvent.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { EmitEventArgs } from "./types";

const prisma = new PrismaClient();

/**
 * Emit an analytics event (idempotent via eventKey)
 * Per TWICELY_ANALYTICS_METRICS_CANONICAL.md
 */
export async function emitEvent(args: EmitEventArgs): Promise<{ created: boolean; eventId?: string }> {
  const {
    eventType,
    eventKey,
    userId,
    sessionId,
    sellerId,
    listingId,
    orderId,
    categoryId,
    searchQuery,
    source,
    medium,
    campaign,
    deviceType,
    platform,
    meta,
  } = args;
  
  // Check if event already exists (idempotency)
  const existing = await prisma.analyticsEvent.findUnique({
    where: { eventKey },
  });
  
  if (existing) {
    return { created: false, eventId: existing.id };
  }
  
  // Create new event
  const event = await prisma.analyticsEvent.create({
    data: {
      eventType,
      eventKey,
      userId,
      sessionId,
      sellerId,
      listingId,
      orderId,
      categoryId,
      searchQuery,
      source,
      medium,
      campaign,
      deviceType,
      platform,
      metaJson: meta ?? {},
      occurredAt: new Date(),
    },
  });
  
  return { created: true, eventId: event.id };
}

/**
 * Batch emit events (for high-volume scenarios)
 */
export async function emitEventsBatch(events: EmitEventArgs[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  
  // Get existing keys
  const eventKeys = events.map(e => e.eventKey);
  const existing = await prisma.analyticsEvent.findMany({
    where: { eventKey: { in: eventKeys } },
    select: { eventKey: true },
  });
  const existingKeys = new Set(existing.map(e => e.eventKey));
  
  // Filter to new events only
  const newEvents = events.filter(e => !existingKeys.has(e.eventKey));
  skipped = events.length - newEvents.length;
  
  if (newEvents.length > 0) {
    await prisma.analyticsEvent.createMany({
      data: newEvents.map(e => ({
        eventType: e.eventType,
        eventKey: e.eventKey,
        userId: e.userId,
        sessionId: e.sessionId,
        sellerId: e.sellerId,
        listingId: e.listingId,
        orderId: e.orderId,
        categoryId: e.categoryId,
        searchQuery: e.searchQuery,
        source: e.source,
        medium: e.medium,
        campaign: e.campaign,
        deviceType: e.deviceType,
        platform: e.platform,
        metaJson: e.meta ?? {},
        occurredAt: new Date(),
      })),
      skipDuplicates: true,
    });
    created = newEvents.length;
  }
  
  return { created, skipped };
}
```

---

## 4) Event Trigger Helpers

Create `packages/core/analytics/triggers.ts`:

```ts
import { emitEvent } from "./emitEvent";

/**
 * Listing event triggers
 */
export async function trackListingViewed(listingId: string, userId?: string, sessionId?: string) {
  return emitEvent({
    eventType: "listing.viewed",
    eventKey: `listing:${listingId}:view:${sessionId ?? userId ?? Date.now()}`,
    userId,
    sessionId,
    listingId,
  });
}

export async function trackListingCreated(listingId: string, sellerId: string) {
  return emitEvent({
    eventType: "listing.created",
    eventKey: `listing:${listingId}:created`,
    userId: sellerId,
    sellerId,
    listingId,
  });
}

export async function trackListingActivated(listingId: string, sellerId: string, categoryId?: string) {
  return emitEvent({
    eventType: "listing.activated",
    eventKey: `listing:${listingId}:activated`,
    userId: sellerId,
    sellerId,
    listingId,
    categoryId,
  });
}

/**
 * Search event triggers
 */
export async function trackSearchPerformed(
  query: string,
  resultCount: number,
  userId?: string,
  sessionId?: string,
  filters?: Record<string, any>
) {
  return emitEvent({
    eventType: resultCount > 0 ? "search.performed" : "search.no_results",
    eventKey: `search:${sessionId ?? userId ?? "anon"}:${Date.now()}`,
    userId,
    sessionId,
    searchQuery: query,
    meta: { resultCount, filters },
  });
}

export async function trackSearchResultClicked(
  listingId: string,
  query: string,
  position: number,
  userId?: string,
  sessionId?: string
) {
  return emitEvent({
    eventType: "search.result.clicked",
    eventKey: `search:click:${listingId}:${sessionId ?? userId ?? Date.now()}`,
    userId,
    sessionId,
    listingId,
    searchQuery: query,
    meta: { position },
  });
}

/**
 * Order event triggers
 */
export async function trackOrderPlaced(
  orderId: string,
  buyerId: string,
  sellerId: string,
  totalCents: number
) {
  return emitEvent({
    eventType: "order.placed",
    eventKey: `order:${orderId}:placed`,
    userId: buyerId,
    sellerId,
    orderId,
    meta: { totalCents },
  });
}

export async function trackOrderPaid(orderId: string, totalCents: number) {
  return emitEvent({
    eventType: "order.paid",
    eventKey: `order:${orderId}:paid`,
    orderId,
    meta: { totalCents },
  });
}

export async function trackOrderCompleted(orderId: string, gmvCents: number) {
  return emitEvent({
    eventType: "order.completed",
    eventKey: `order:${orderId}:completed`,
    orderId,
    meta: { gmvCents },
  });
}

/**
 * User event triggers
 */
export async function trackUserSignedUp(userId: string, source?: string, medium?: string) {
  return emitEvent({
    eventType: "user.signed_up",
    eventKey: `user:${userId}:signed_up`,
    userId,
    source,
    medium,
  });
}

export async function trackSellerOnboarded(sellerId: string) {
  return emitEvent({
    eventType: "user.seller_onboarded",
    eventKey: `seller:${sellerId}:onboarded`,
    userId: sellerId,
    sellerId,
  });
}
```

---

## 5) Metric Snapshot Computation

Create `packages/core/analytics/snapshotComputer.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { MetricPeriod, MetricValue } from "./types";

const prisma = new PrismaClient();

/**
 * Compute and store daily metrics snapshot
 */
export async function computeDailySnapshot(date: Date = new Date()): Promise<MetricValue[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dayKey = formatDayKey(date);
  
  const metrics: MetricValue[] = [];
  
  // GMV (Gross Merchandise Value) - from completed orders
  const gmvResult = await prisma.order.aggregate({
    where: {
      status: { in: ["PAID", "SHIPPED", "DELIVERED", "COMPLETED"] },
      paidAt: { gte: dayStart, lte: dayEnd },
    },
    _sum: { totalCents: true },
    _count: true,
  });
  
  metrics.push({
    metricKey: "gmv.daily",
    period: "DAILY",
    periodStart: dayStart,
    periodEnd: dayEnd,
    value: gmvResult._sum.totalCents ?? 0,
  });
  
  // Order count
  metrics.push({
    metricKey: "orders.count.daily",
    period: "DAILY",
    periodStart: dayStart,
    periodEnd: dayEnd,
    value: gmvResult._count,
  });
  
  // New users
  const newUsers = await prisma.user.count({
    where: {
      createdAt: { gte: dayStart, lte: dayEnd },
    },
  });
  
  metrics.push({
    metricKey: "users.new.daily",
    period: "DAILY",
    periodStart: dayStart,
    periodEnd: dayEnd,
    value: newUsers,
  });
  
  // New listings
  const newListings = await prisma.listing.count({
    where: {
      createdAt: { gte: dayStart, lte: dayEnd },
    },
  });
  
  metrics.push({
    metricKey: "listings.new.daily",
    period: "DAILY",
    periodStart: dayStart,
    periodEnd: dayEnd,
    value: newListings,
  });
  
  // Active listings (end of day)
  const activeListings = await prisma.listing.count({
    where: { status: "ACTIVE" },
  });
  
  metrics.push({
    metricKey: "listings.active.daily",
    period: "DAILY",
    periodStart: dayStart,
    periodEnd: dayEnd,
    value: activeListings,
  });
  
  // Average order value
  const aov = gmvResult._count > 0 
    ? (gmvResult._sum.totalCents ?? 0) / gmvResult._count 
    : 0;
  
  metrics.push({
    metricKey: "orders.aov.daily",
    period: "DAILY",
    periodStart: dayStart,
    periodEnd: dayEnd,
    value: Math.round(aov),
  });
  
  // Search events
  const searchCount = await prisma.analyticsEvent.count({
    where: {
      eventType: "search.performed",
      occurredAt: { gte: dayStart, lte: dayEnd },
    },
  });
  
  metrics.push({
    metricKey: "search.count.daily",
    period: "DAILY",
    periodStart: dayStart,
    periodEnd: dayEnd,
    value: searchCount,
  });
  
  // Persist all metrics
  for (const metric of metrics) {
    await prisma.metricSnapshot.upsert({
      where: {
        metricKey_period_periodStart_dimensions: {
          metricKey: metric.metricKey,
          period: metric.period,
          periodStart: metric.periodStart,
          dimensions: metric.dimensions ?? {},
        },
      },
      update: { value: metric.value, computedAt: new Date() },
      create: {
        metricKey: metric.metricKey,
        period: metric.period,
        periodStart: metric.periodStart,
        periodEnd: metric.periodEnd,
        value: metric.value,
        dimensions: metric.dimensions ?? {},
      },
    });
  }
  
  return metrics;
}

/**
 * Get metric values for a time range
 */
export async function getMetricSeries(
  metricKey: string,
  period: MetricPeriod,
  startDate: Date,
  endDate: Date
): Promise<MetricValue[]> {
  const snapshots = await prisma.metricSnapshot.findMany({
    where: {
      metricKey,
      period,
      periodStart: { gte: startDate, lte: endDate },
    },
    orderBy: { periodStart: "asc" },
  });
  
  return snapshots.map(s => ({
    metricKey: s.metricKey,
    period: s.period as MetricPeriod,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    value: s.value,
    dimensions: s.dimensions as Record<string, string>,
  }));
}

/**
 * Get latest metric value
 */
export async function getLatestMetric(metricKey: string): Promise<MetricValue | null> {
  const snapshot = await prisma.metricSnapshot.findFirst({
    where: { metricKey },
    orderBy: { periodStart: "desc" },
  });
  
  if (!snapshot) return null;
  
  return {
    metricKey: snapshot.metricKey,
    period: snapshot.period as MetricPeriod,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    value: snapshot.value,
    dimensions: snapshot.dimensions as Record<string, string>,
  };
}

// Helpers
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
```

---

## 6) Snapshot Runner Script

Create `scripts/compute-daily-snapshot.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { computeDailySnapshot } from "../packages/core/analytics/snapshotComputer";

const prisma = new PrismaClient();

async function main() {
  // Compute for yesterday (complete day)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  console.log(`Computing daily snapshot for ${yesterday.toISOString().slice(0, 10)}...`);
  
  const metrics = await computeDailySnapshot(yesterday);
  
  console.log("Computed metrics:");
  for (const m of metrics) {
    console.log(`  ${m.metricKey}: ${m.value}`);
  }
  
  console.log("\nDaily snapshot complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 7) Corp API Endpoints

### 7.1 Platform Dashboard

Create `apps/web/app/api/platform/analytics/dashboard/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";
import { getLatestMetric, getMetricSeries } from "@/packages/core/analytics/snapshotComputer";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  await requirePermission(req, "analytics.read");
  
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? "30");
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get key metrics
  const [gmvSeries, ordersSeries, usersSeries, listingsSeries] = await Promise.all([
    getMetricSeries("gmv.daily", "DAILY", startDate, endDate),
    getMetricSeries("orders.count.daily", "DAILY", startDate, endDate),
    getMetricSeries("users.new.daily", "DAILY", startDate, endDate),
    getMetricSeries("listings.active.daily", "DAILY", startDate, endDate),
  ]);
  
  // Calculate totals for period
  const totalGmv = gmvSeries.reduce((sum, m) => sum + m.value, 0);
  const totalOrders = ordersSeries.reduce((sum, m) => sum + m.value, 0);
  const totalNewUsers = usersSeries.reduce((sum, m) => sum + m.value, 0);
  
  // Get latest values
  const latestActiveListings = await getLatestMetric("listings.active.daily");
  const latestAov = await getLatestMetric("orders.aov.daily");
  
  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString(), days },
    summary: {
      totalGmvCents: totalGmv,
      totalOrders,
      totalNewUsers,
      activeListings: latestActiveListings?.value ?? 0,
      averageOrderValueCents: latestAov?.value ?? 0,
    },
    series: {
      gmv: gmvSeries,
      orders: ordersSeries,
      newUsers: usersSeries,
      activeListings: listingsSeries,
    },
  });
}
```

### 7.2 Event Explorer

Create `apps/web/app/api/platform/analytics/events/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  await requirePermission(req, "analytics.read");
  
  const { searchParams } = new URL(req.url);
  const eventType = searchParams.get("eventType") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const listingId = searchParams.get("listingId") ?? undefined;
  const orderId = searchParams.get("orderId") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(100, Number(searchParams.get("pageSize") ?? "50"));
  
  const where: any = {};
  if (eventType) where.eventType = eventType;
  if (userId) where.userId = userId;
  if (listingId) where.listingId = listingId;
  if (orderId) where.orderId = orderId;
  
  const [total, events] = await Promise.all([
    prisma.analyticsEvent.count({ where }),
    prisma.analyticsEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  
  return NextResponse.json({ total, page, pageSize, events });
}
```

### 7.3 Event Types Summary

Create `apps/web/app/api/platform/analytics/event-types/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/platformAuth";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  await requirePermission(req, "analytics.read");
  
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? "7");
  
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  const eventTypes = await prisma.analyticsEvent.groupBy({
    by: ["eventType"],
    where: { occurredAt: { gte: since } },
    _count: true,
  });
  
  const sorted = eventTypes
    .map(e => ({ eventType: e.eventType, count: e._count }))
    .sort((a, b) => b.count - a.count);
  
  return NextResponse.json({ period: { days }, eventTypes: sorted });
}
```

---

## 8) Seed Metric Definitions

Create `scripts/seed-metric-definitions.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const METRIC_DEFINITIONS = [
  {
    key: "gmv.daily",
    name: "Daily GMV",
    description: "Gross Merchandise Value from paid orders",
    computationType: "SUM",
    sourceTable: "Order",
    sourceColumn: "totalCents",
    period: "DAILY",
  },
  {
    key: "orders.count.daily",
    name: "Daily Order Count",
    description: "Number of paid orders",
    computationType: "COUNT",
    sourceTable: "Order",
    period: "DAILY",
  },
  {
    key: "orders.aov.daily",
    name: "Average Order Value",
    description: "Average value per order",
    computationType: "AVG",
    sourceTable: "Order",
    sourceColumn: "totalCents",
    period: "DAILY",
  },
  {
    key: "users.new.daily",
    name: "New Users",
    description: "Users registered per day",
    computationType: "COUNT",
    sourceTable: "User",
    period: "DAILY",
  },
  {
    key: "listings.new.daily",
    name: "New Listings",
    description: "Listings created per day",
    computationType: "COUNT",
    sourceTable: "Listing",
    period: "DAILY",
  },
  {
    key: "listings.active.daily",
    name: "Active Listings",
    description: "Total active listings (end of day)",
    computationType: "COUNT",
    sourceTable: "Listing",
    period: "DAILY",
  },
  {
    key: "search.count.daily",
    name: "Search Count",
    description: "Number of searches performed",
    computationType: "COUNT",
    sourceTable: "AnalyticsEvent",
    period: "DAILY",
  },
];

async function main() {
  for (const def of METRIC_DEFINITIONS) {
    await prisma.metricDefinition.upsert({
      where: { key: def.key },
      update: def,
      create: def as any,
    });
  }
  
  console.log(`Seeded ${METRIC_DEFINITIONS.length} metric definitions`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## 9) Health Provider

Create `packages/core/health/providers/analyticsHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const analyticsHealthProvider: HealthProvider = {
  id: "analytics",
  label: "Analytics & Metrics",
  description: "Validates event tracking, metric snapshots, and data pipeline health",
  version: "1.0.0",
  
  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;
    
    // Check 1: Recent events exist
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEventCount = await prisma.analyticsEvent.count({
      where: { occurredAt: { gte: oneDayAgo } },
    });
    
    checks.push({
      id: "analytics.recent_events",
      label: "Recent events recorded (24h)",
      status: recentEventCount > 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${recentEventCount} events in last 24 hours`,
    });
    if (recentEventCount === 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 2: Daily snapshots exist
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.toISOString().slice(0, 10));
    
    const gmvSnapshot = await prisma.metricSnapshot.findFirst({
      where: {
        metricKey: "gmv.daily",
        periodStart: yesterdayStart,
      },
    });
    
    checks.push({
      id: "analytics.daily_snapshot_exists",
      label: "Yesterday's daily snapshot exists",
      status: gmvSnapshot ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: gmvSnapshot 
        ? `GMV snapshot: ${gmvSnapshot.value}` 
        : "No snapshot for yesterday - run daily job",
    });
    if (!gmvSnapshot && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 3: Metric definitions seeded
    const defCount = await prisma.metricDefinition.count();
    
    checks.push({
      id: "analytics.definitions_seeded",
      label: "Metric definitions configured",
      status: defCount >= 5 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${defCount} metric definitions`,
    });
    if (defCount < 5 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 4: Event idempotency (no duplicates)
    const duplicateCheck = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT "eventKey" FROM "AnalyticsEvent"
        GROUP BY "eventKey"
        HAVING COUNT(*) > 1
      ) as duplicates
    `;
    
    const hasDuplicates = Number(duplicateCheck[0]?.count ?? 0) > 0;
    checks.push({
      id: "analytics.no_duplicate_events",
      label: "Event idempotency integrity",
      status: hasDuplicates ? HEALTH_STATUS.FAIL : HEALTH_STATUS.PASS,
      message: hasDuplicates ? "Duplicate event keys found!" : "No duplicates",
    });
    if (hasDuplicates) status = HEALTH_STATUS.FAIL;
    
    // Check 5: Event types coverage
    const eventTypes = await prisma.analyticsEvent.groupBy({
      by: ["eventType"],
      _count: true,
    });
    
    const coreTypes = ["listing.viewed", "order.placed", "search.performed"];
    const missingTypes = coreTypes.filter(t => !eventTypes.some(e => e.eventType === t));
    
    checks.push({
      id: "analytics.core_event_types",
      label: "Core event types being tracked",
      status: missingTypes.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: missingTypes.length === 0 
        ? "All core event types present"
        : `Missing: ${missingTypes.join(", ")}`,
    });
    if (missingTypes.length > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 6: Snapshot not stale
    const latestSnapshot = await prisma.metricSnapshot.findFirst({
      orderBy: { computedAt: "desc" },
    });
    
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const snapshotStale = !latestSnapshot || latestSnapshot.computedAt < twoDaysAgo;
    
    checks.push({
      id: "analytics.snapshot_freshness",
      label: "Metric snapshots not stale",
      status: snapshotStale ? HEALTH_STATUS.WARN : HEALTH_STATUS.PASS,
      message: latestSnapshot 
        ? `Last computed: ${latestSnapshot.computedAt.toISOString()}`
        : "No snapshots found",
    });
    if (snapshotStale && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS 
        ? "Analytics pipeline healthy"
        : status === HEALTH_STATUS.WARN
          ? "Analytics pipeline has warnings"
          : "Analytics pipeline has failures",
      checks,
      meta: {
        recentEventCount,
        metricDefinitions: defCount,
        eventTypeCount: eventTypes.length,
        lastSnapshotAt: latestSnapshot?.computedAt?.toISOString(),
      },
    };
  },
};
```

---

## 10) Doctor Checks

Add to `scripts/twicely-doctor.ts` phase 8 section:

```ts
// ============================================================
// PHASE 8: ANALYTICS DOCTOR CHECKS
// ============================================================

async function runPhase8DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: Event emit is idempotent
  const testKey = `doctor_test_event_${Date.now()}`;
  
  const emit1 = await emitEvent({
    eventType: "listing.viewed",
    eventKey: testKey,
    userId: "doctor_test_user",
    listingId: "doctor_test_listing",
  });
  
  const emit2 = await emitEvent({
    eventType: "listing.viewed",
    eventKey: testKey,
    userId: "doctor_test_user",
    listingId: "doctor_test_listing",
  });
  
  results.push({
    id: "analytics.event_idempotent",
    label: "Event emit is idempotent",
    status: emit1.created && !emit2.created ? "PASS" : "FAIL",
    message: emit1.created && !emit2.created 
      ? "Second emit correctly skipped"
      : "ERROR: Duplicate event created",
  });
  
  // Test 2: Snapshot write works
  const snapshotDate = new Date();
  snapshotDate.setDate(snapshotDate.getDate() - 7); // 7 days ago
  
  const testMetricKey = "doctor.test.metric";
  const testSnapshot = await prisma.metricSnapshot.upsert({
    where: {
      metricKey_period_periodStart_dimensions: {
        metricKey: testMetricKey,
        period: "DAILY",
        periodStart: startOfDay(snapshotDate),
        dimensions: {},
      },
    },
    update: { value: 12345 },
    create: {
      metricKey: testMetricKey,
      period: "DAILY",
      periodStart: startOfDay(snapshotDate),
      periodEnd: endOfDay(snapshotDate),
      value: 12345,
      dimensions: {},
    },
  });
  
  const readBack = await prisma.metricSnapshot.findUnique({
    where: { id: testSnapshot.id },
  });
  
  results.push({
    id: "analytics.snapshot_write",
    label: "Metric snapshot write and read",
    status: readBack?.value === 12345 ? "PASS" : "FAIL",
    message: readBack?.value === 12345 
      ? "Snapshot written and read correctly"
      : "ERROR: Snapshot mismatch",
  });
  
  // Test 3: Daily snapshot computation
  const beforeCount = await prisma.metricSnapshot.count({
    where: { metricKey: "gmv.daily" },
  });
  
  await computeDailySnapshot(snapshotDate);
  
  const afterCount = await prisma.metricSnapshot.count({
    where: { metricKey: "gmv.daily" },
  });
  
  results.push({
    id: "analytics.daily_snapshot_compute",
    label: "Daily snapshot computation",
    status: afterCount >= beforeCount ? "PASS" : "FAIL",
    message: `Snapshots: ${beforeCount} → ${afterCount}`,
  });
  
  // Test 4: Event types indexed correctly
  const eventTypeIndex = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes 
    WHERE tablename = 'AnalyticsEvent' 
    AND indexdef LIKE '%eventType%'
  `;
  
  results.push({
    id: "analytics.event_type_indexed",
    label: "Event type column indexed",
    status: eventTypeIndex.length > 0 ? "PASS" : "WARN",
    message: eventTypeIndex.length > 0 
      ? "Index exists"
      : "Consider adding index on eventType",
  });
  
  // Cleanup
  await prisma.analyticsEvent.deleteMany({
    where: { eventKey: testKey },
  });
  await prisma.metricSnapshot.delete({
    where: { id: testSnapshot.id },
  }).catch(() => {});
  
  return results;
}

// Helpers
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
```

---

## 11) Phase 8 Completion Criteria

- [ ] AnalyticsEvent model migrated
- [ ] MetricSnapshot model migrated
- [ ] MetricDefinition model migrated
- [ ] Event emit is idempotent
- [ ] Event triggers wired to key flows
- [ ] Daily snapshot computation works
- [ ] Dashboard endpoint returns data
- [ ] Event explorer endpoint works
- [ ] Metric definitions seeded
- [ ] Health provider registered and passing
- [ ] Doctor passes all Phase 8 checks

---

## 12) Migration Checklist

1. Run migration: `npx prisma migrate dev --name analytics_phase8`
2. Seed definitions: `npx ts-node scripts/seed-metric-definitions.ts`
3. Set up daily cron: `0 1 * * * npx ts-node scripts/compute-daily-snapshot.ts`
4. Wire event triggers to order/listing/search flows
5. Verify health provider passes
6. Run Doctor checks
