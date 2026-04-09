# TWICELY V2 — Install Phase 16: Buyer Experience + Reviews
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema → API → Trust hooks → Health → UI → Doctor  
**Canonicals:** TWICELY_BUYER_EXPERIENCE_CANONICAL.md, TWICELY_RATINGS_TRUST_CANONICAL.md

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_16_BUYER_EXPERIENCE_REVIEWS.md`  
> Prereq: Phase 15 complete.

---

## 0) What this phase installs

### Backend
- Review model (one per order, trust event emission)
- ReviewModerationAction for audit trail
- WatchlistItem model (CRITICAL-3 fix)
- SavedSearch model
- RecentlyViewed model
- BuyerPreferences model
- Idempotent trust event emission

### UI
- Buyer: Leave review, order timeline, watchlist, saved searches
- Corp: Review moderation queue

### Ops
- Health provider: `buyer_experience`
- Doctor checks: one review per order, trust event idempotency

---

## 1) Prisma Schema

```prisma
enum ReviewStatus {
  VISIBLE
  HIDDEN
  REMOVED
  PENDING_REVIEW
}

model Review {
  id              String        @id @default(cuid())
  orderId         String        @unique
  sellerId        String
  buyerId         String
  rating          Int
  title           String?
  comment         String?
  itemAsDescribed Int?
  shipping        Int?
  communication   Int?
  photoUrls       String[]      @default([])
  status          ReviewStatus  @default(VISIBLE)
  isVerifiedPurchase Boolean    @default(true)
  isFeatured      Boolean       @default(false)
  sellerResponse  String?
  sellerRespondedAt DateTime?
  trustEventKey   String?       @unique
  trustEventEmittedAt DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  editedAt        DateTime?
  
  moderationActions ReviewModerationAction[]
  helpfulVotes    ReviewHelpfulVote[]

  @@index([sellerId, status, createdAt])
  @@index([buyerId, createdAt])
}

model ReviewModerationAction {
  id              String   @id @default(cuid())
  reviewId        String
  review          Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  staffId         String
  action          String
  reason          String?
  internalNotes   String?
  previousStatus  String?
  newStatus       String?
  createdAt       DateTime @default(now())

  @@index([reviewId, createdAt])
}

model ReviewHelpfulVote {
  id        String   @id @default(cuid())
  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  userId    String
  isHelpful Boolean
  createdAt DateTime @default(now())

  @@unique([reviewId, userId])
}

model WatchlistItem {
  id              String   @id @default(cuid())
  userId          String
  listingId       String
  notifyOnPriceDrop Boolean @default(true)
  notifyOnEndingSoon Boolean @default(true)
  priceWhenAdded  Int
  lowestPriceSeen Int?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, listingId])
  @@index([userId, createdAt])
}

model SavedSearch {
  id              String   @id @default(cuid())
  userId          String
  name            String
  queryJson       Json
  notifyOnNewResults Boolean @default(true)
  notifyFrequency String   @default("daily")
  lastCheckedAt   DateTime?
  lastResultCount Int?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, isActive])
}

model RecentlyViewed {
  id        String   @id @default(cuid())
  userId    String
  listingId String
  viewedAt  DateTime @default(now())
  viewCount Int      @default(1)

  @@unique([userId, listingId])
  @@index([userId, viewedAt])
}

model BuyerPreferences {
  id              String   @id @default(cuid())
  userId          String   @unique
  defaultSortOrder String  @default("best_match")
  resultsPerPage  Int      @default(48)
  emailOrderUpdates Boolean @default(true)
  emailPriceDrops Boolean  @default(true)
  emailSavedSearches Boolean @default(true)
  emailPromotions Boolean  @default(false)
  showPurchaseHistory Boolean @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

Run migration:
```bash
npx prisma migrate dev --name buyer_experience_phase16
```

---

## 2) Trust Event Helper (Idempotent)

Create `packages/core/trust/events.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function emitTrustEvent(args: {
  sellerId: string;
  type: string;
  occurredAt?: Date;
  orderId?: string;
  meta?: any;
  eventKey: string;
}) {
  const existing = await prisma.trustEvent.findUnique({
    where: { eventKey: args.eventKey },
  });
  if (existing) return { created: false, eventId: existing.id };

  const event = await prisma.trustEvent.create({
    data: {
      sellerId: args.sellerId,
      type: args.type,
      occurredAt: args.occurredAt ?? new Date(),
      orderId: args.orderId,
      metaJson: args.meta ?? {},
      eventKey: args.eventKey,
    },
  });
  return { created: true, eventId: event.id };
}

export function reviewTrustEventKey(orderId: string): string {
  return `trust:review:${orderId}`;
}

export function getReviewTrustDelta(stars: number): number {
  return { 1: -5, 2: -2, 3: 0, 4: 2, 5: 4 }[stars] ?? 0;
}
```

---

## 3) Review Service

Create `packages/core/reviews/service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitTrustEvent, reviewTrustEventKey, getReviewTrustDelta } from "../trust/events";

const prisma = new PrismaClient();
const REVIEW_WINDOW_DAYS = 60;

export async function createReview(args: {
  orderId: string;
  buyerId: string;
  rating: number;
  title?: string;
  comment?: string;
  photoUrls?: string[];
}) {
  if (![1,2,3,4,5].includes(args.rating)) throw new Error("INVALID_RATING");

  const order = await prisma.order.findUnique({ where: { id: args.orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.buyerId !== args.buyerId) throw new Error("NOT_ORDER_BUYER");
  if (order.status !== "COMPLETED") throw new Error("ORDER_NOT_COMPLETED");

  const completedAt = order.completedAt ?? order.deliveredAt;
  if (!completedAt) throw new Error("ORDER_NOT_DELIVERED");

  const daysSince = Math.floor((Date.now() - completedAt.getTime()) / 86400000);
  if (daysSince > REVIEW_WINDOW_DAYS) throw new Error("REVIEW_WINDOW_EXPIRED");

  const existing = await prisma.review.findUnique({ where: { orderId: args.orderId } });
  if (existing) throw new Error("REVIEW_ALREADY_EXISTS");

  const eventKey = reviewTrustEventKey(args.orderId);

  const review = await prisma.review.create({
    data: {
      orderId: args.orderId,
      sellerId: order.sellerId,
      buyerId: args.buyerId,
      rating: args.rating,
      title: args.title,
      comment: args.comment,
      photoUrls: args.photoUrls ?? [],
      status: "VISIBLE",
      trustEventKey: eventKey,
    },
  });

  const trustResult = await emitTrustEvent({
    sellerId: order.sellerId,
    type: "review.submitted",
    orderId: args.orderId,
    meta: { stars: args.rating, delta: getReviewTrustDelta(args.rating) },
    eventKey,
  });

  if (trustResult.created) {
    await prisma.review.update({
      where: { id: review.id },
      data: { trustEventEmittedAt: new Date() },
    });
  }

  await prisma.notification.create({
    data: {
      userId: order.sellerId,
      type: "REVIEW_RECEIVED",
      title: "New Review",
      body: `You received a ${args.rating}-star review`,
      dataJson: { reviewId: review.id },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: args.buyerId,
      action: "review.created",
      entityType: "Review",
      entityId: review.id,
      metaJson: { rating: args.rating },
    },
  });

  return review;
}

export async function addSellerResponse(reviewId: string, sellerId: string, response: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error("REVIEW_NOT_FOUND");
  if (review.sellerId !== sellerId) throw new Error("NOT_REVIEW_SELLER");
  if (review.sellerResponse) throw new Error("RESPONSE_EXISTS");

  return prisma.review.update({
    where: { id: reviewId },
    data: { sellerResponse: response, sellerRespondedAt: new Date() },
  });
}

export async function getSellerReviewStats(sellerId: string) {
  const reviews = await prisma.review.findMany({
    where: { sellerId, status: "VISIBLE" },
    select: { rating: true },
  });
  const total = reviews.length;
  if (total === 0) return { total: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  const sum = reviews.reduce((a, r) => a + r.rating, 0);
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => dist[r.rating as keyof typeof dist]++);
  return { total, average: Math.round((sum / total) * 10) / 10, distribution: dist };
}
```

---

## 4) Review Moderation

Create `packages/core/reviews/moderation.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function moderateReview(args: {
  reviewId: string;
  staffId: string;
  action: "HIDE" | "RESTORE" | "REMOVE" | "FLAG" | "FEATURE";
  reason?: string;
}) {
  const review = await prisma.review.findUnique({ where: { id: args.reviewId } });
  if (!review) throw new Error("REVIEW_NOT_FOUND");

  const prev = review.status;
  let next = prev;
  if (args.action === "HIDE") next = "HIDDEN";
  if (args.action === "RESTORE") next = "VISIBLE";
  if (args.action === "REMOVE") next = "REMOVED";
  if (args.action === "FLAG") next = "PENDING_REVIEW";

  const update: any = {};
  if (next !== prev) update.status = next;
  if (args.action === "FEATURE") update.isFeatured = true;

  const updated = await prisma.review.update({ where: { id: args.reviewId }, data: update });

  await prisma.reviewModerationAction.create({
    data: {
      reviewId: args.reviewId,
      staffId: args.staffId,
      action: args.action,
      reason: args.reason,
      previousStatus: prev,
      newStatus: next,
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: args.staffId,
      action: `review.${args.action.toLowerCase()}`,
      entityType: "Review",
      entityId: args.reviewId,
      metaJson: { reason: args.reason },
    },
  });

  return updated;
}
```

---

## 5) Watchlist Service

Create `packages/core/buyer/watchlist.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function addToWatchlist(userId: string, listingId: string) {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if (listing.ownerUserId === userId) throw new Error("CANNOT_WATCH_OWN");

  return prisma.watchlistItem.upsert({
    where: { userId_listingId: { userId, listingId } },
    update: { updatedAt: new Date() },
    create: { userId, listingId, priceWhenAdded: listing.priceCents ?? 0 },
  });
}

export async function removeFromWatchlist(userId: string, listingId: string) {
  await prisma.watchlistItem.delete({ where: { userId_listingId: { userId, listingId } } });
}

export async function getWatchlist(userId: string) {
  return prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
```

---

## 6) Saved Search Service

Create `packages/core/buyer/savedSearches.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function createSavedSearch(userId: string, name: string, queryJson: any) {
  return prisma.savedSearch.create({ data: { userId, name, queryJson } });
}

export async function getSavedSearches(userId: string) {
  return prisma.savedSearch.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "desc" } });
}

export async function deleteSavedSearch(userId: string, id: string) {
  const s = await prisma.savedSearch.findUnique({ where: { id } });
  if (!s || s.userId !== userId) throw new Error("NOT_FOUND");
  await prisma.savedSearch.update({ where: { id }, data: { isActive: false } });
}
```

---

## 7) Recently Viewed Service

Create `packages/core/buyer/recentlyViewed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function recordView(userId: string, listingId: string) {
  await prisma.recentlyViewed.upsert({
    where: { userId_listingId: { userId, listingId } },
    update: { viewedAt: new Date(), viewCount: { increment: 1 } },
    create: { userId, listingId },
  });
}

export async function getRecentlyViewed(userId: string, limit = 20) {
  return prisma.recentlyViewed.findMany({
    where: { userId },
    orderBy: { viewedAt: "desc" },
    take: limit,
  });
}
```

---

## 8) API Endpoints

### 8.1 Create Review

`apps/web/app/api/buyer/orders/[orderId]/review/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createReview } from "@/packages/core/reviews/service";

export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  const buyerId = "twi_u_replace"; // TODO: requireUserAuth()
  const body = await req.json();
  try {
    const review = await createReview({ orderId: params.orderId, buyerId, ...body });
    return NextResponse.json({ review }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 8.2 Order Timeline

`apps/web/app/api/buyer/orders/[orderId]/timeline/route.ts`:
```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: { orderId: string } }) {
  const buyerId = "twi_u_replace"; // TODO: requireUserAuth()
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { shipment: true, review: true },
  });
  if (!order || order.buyerId !== buyerId) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const timeline = [
    order.createdAt && { key: "created", at: order.createdAt, label: "Order placed" },
    order.paidAt && { key: "paid", at: order.paidAt, label: "Payment confirmed" },
    order.shippedAt && { key: "shipped", at: order.shippedAt, label: "Shipped" },
    order.deliveredAt && { key: "delivered", at: order.deliveredAt, label: "Delivered" },
    order.completedAt && { key: "completed", at: order.completedAt, label: "Completed" },
  ].filter(Boolean);

  return NextResponse.json({ order: { id: order.id, status: order.status }, timeline });
}
```

### 8.3 Watchlist

`apps/web/app/api/buyer/watchlist/route.ts`:
```ts
import { NextResponse } from "next/server";
import { addToWatchlist, getWatchlist } from "@/packages/core/buyer/watchlist";

export async function GET() {
  const userId = "twi_u_replace";
  const items = await getWatchlist(userId);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const userId = "twi_u_replace";
  const { listingId } = await req.json();
  try {
    const item = await addToWatchlist(userId, listingId);
    return NextResponse.json({ item }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 8.4 Corp Review Moderation

`apps/web/app/api/platform/reviews/[id]/moderate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { moderateReview } from "@/packages/core/reviews/moderation";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "reviews.moderate");
  const { action, reason } = await req.json();
  try {
    const review = await moderateReview({ reviewId: params.id, staffId: ctx.actorUserId, action, reason });
    return NextResponse.json({ review });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

---

## 9) Health Provider

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const buyerExperienceHealthProvider: HealthProvider = {
  id: "buyer_experience",
  label: "Buyer Experience",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: Reviews have trust events
    const missing = await prisma.review.count({ where: { status: "VISIBLE", trustEventEmittedAt: null } });
    checks.push({
      id: "reviews.trust_events",
      label: "Reviews have trust events",
      status: missing === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: missing === 0 ? "All have events" : `${missing} missing`,
    });

    // Check 2: One review per order
    const dups = await prisma.$queryRaw`SELECT "orderId" FROM "Review" GROUP BY "orderId" HAVING COUNT(*) > 1` as any[];
    checks.push({
      id: "reviews.unique",
      label: "One review per order",
      status: dups.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: dups.length === 0 ? "No duplicates" : `${dups.length} duplicates`,
    });
    if (dups.length > 0) status = HEALTH_STATUS.FAIL;

    return {
      providerId: "buyer_experience",
      status,
      summary: status === HEALTH_STATUS.PASS ? "Healthy" : "Issues detected",
      providerVersion: "1.0.0",
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 10) Doctor Checks

```ts
async function checkBuyerExperience() {
  const checks = [];

  // 1. Review uniqueness
  const testOrderId = `test_${Date.now()}`;
  await prisma.review.create({ data: { orderId: testOrderId, sellerId: "s", buyerId: "b", rating: 5 } });
  
  try {
    await prisma.review.create({ data: { orderId: testOrderId, sellerId: "s", buyerId: "b", rating: 4 } });
    checks.push({ key: "review.unique", ok: false, details: "Duplicate allowed" });
  } catch {
    checks.push({ key: "review.unique", ok: true, details: "Unique enforced" });
  }

  // 2. Trust event idempotency
  const eventKey = `trust:review:${testOrderId}`;
  await prisma.trustEvent.upsert({ where: { eventKey }, update: {}, create: { sellerId: "s", type: "review.submitted", eventKey, metaJson: {} } });
  await prisma.trustEvent.upsert({ where: { eventKey }, update: {}, create: { sellerId: "s", type: "review.submitted", eventKey, metaJson: {} } });
  const count = await prisma.trustEvent.count({ where: { eventKey } });
  checks.push({ key: "trust.idempotent", ok: count === 1, details: count === 1 ? "Idempotent" : `${count} events` });

  // Cleanup
  await prisma.trustEvent.deleteMany({ where: { eventKey } });
  await prisma.review.deleteMany({ where: { orderId: testOrderId } });

  return checks;
}
```

---

## 11) Phase 16 Completion Criteria

- Review model with one-per-order constraint
- Trust event emitted once (idempotent)
- Review moderation with action logging
- Watchlist model (CRITICAL-3 fix)
- Saved searches
- Recently viewed
- Order timeline endpoint
- Seller response to reviews
- Health provider passes
- Doctor verifies uniqueness and idempotency
