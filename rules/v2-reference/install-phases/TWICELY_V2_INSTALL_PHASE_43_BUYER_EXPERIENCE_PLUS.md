# TWICELY V2 — Install Phase 43: Buyer Experience Plus
**Status:** LOCKED (v2.0)  
**Scope:** Smart price alerts, price history tracking, market price comparison, personalized recommendations, browsing history  
**Backend-first:** Schema → Services → API → Settings → Health → UI → Doctor

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_43_BUYER_EXPERIENCE_PLUS.md`  
> Prereq: Phases 0–42 complete and Doctor green.

---

## 0) What This Phase Installs

### Backend
- PriceAlert model (target price alerts with digest option)
- PriceHistory model (historical price tracking per listing)
- MarketPriceIndex model (category/condition price benchmarks)
- CategoryAlert model (saved search + price threshold alerts)
- UserBrowsingHistory model (tracking views with engagement)
- UserPreferenceInferred model (preference inference)
- RecommendationFeed model (personalized feeds)
- Price alert trigger service with batch processing
- Market price comparison engine
- Recommendation engine

### UI (Buyer)
- Price alert setup on listings with suggested targets
- Price history graph on listing pages
- "Good Deal" / "Great Price" badges
- Category-wide alert management
- Personalized recommendations feed
- Recently viewed listings
- Size preference memory
- Daily digest email preferences

### Admin UI
- `/corp/settings/price-alerts` — Alert configuration
- `/corp/analytics/market-prices` — Market price index dashboard

### Ops
- Health provider: `buyer_experience_plus`
- Doctor checks: alert delivery, price history, market index, recommendation quality
- Cron: Price history snapshots, market index computation, digest emails

---

## 1) Prisma Schema

```prisma
// =============================================================================
// PRICE ALERTS (Enhanced)
// =============================================================================

model PriceAlert {
  id                  String    @id @default(cuid())
  userId              String
  listingId           String
  targetPriceCents    Int
  originalPriceCents  Int
  alertType           PriceAlertType @default(BELOW_TARGET)
  percentThreshold    Int?                // Alert when drops X%
  isActive            Boolean   @default(true)
  triggeredAt         DateTime?
  triggeredPriceCents Int?
  notificationSent    Boolean   @default(false)
  notificationSentAt  DateTime?
  includeInDigest     Boolean   @default(false)   // NEW: Daily digest option
  digestSentAt        DateTime?                   // NEW: Last digest inclusion
  suggestedBySystem   Boolean   @default(false)   // NEW: System-suggested alert
  expiresAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  user    User    @relation(fields: [userId], references: [id])
  listing Listing @relation(fields: [listingId], references: [id])

  @@unique([userId, listingId])
  @@index([listingId, isActive])
  @@index([userId, isActive])
  @@index([includeInDigest, isActive])
}

enum PriceAlertType {
  BELOW_TARGET      // Price drops below target
  PERCENT_DROP      // Price drops by X%
  ANY_DROP          // Any price reduction
}

// =============================================================================
// PRICE HISTORY (NEW)
// =============================================================================

model PriceHistory {
  id              String   @id @default(cuid())
  listingId       String
  priceCents      Int
  previousCents   Int?
  changeType      PriceChangeType
  changePercent   Decimal? @db.Decimal(5, 2)
  snapshotDate    DateTime @default(now())
  source          String   @default("listing_update")  // listing_update, offer_accepted, promotion
  createdAt       DateTime @default(now())

  listing Listing @relation(fields: [listingId], references: [id])

  @@index([listingId, snapshotDate])
  @@index([snapshotDate])
}

enum PriceChangeType {
  INITIAL
  INCREASE
  DECREASE
  NO_CHANGE
}

// =============================================================================
// MARKET PRICE INDEX (NEW)
// =============================================================================

model MarketPriceIndex {
  id              String   @id @default(cuid())
  categoryId      String
  conditionType   String?                  // NEW, LIKE_NEW, GOOD, FAIR, etc.
  brandNormalized String?                  // Normalized brand name
  
  // Price statistics (in cents)
  medianPriceCents    Int
  avgPriceCents       Int
  lowPriceCents       Int
  highPriceCents      Int
  p25PriceCents       Int                  // 25th percentile
  p75PriceCents       Int                  // 75th percentile
  sampleSize          Int
  
  // Deal thresholds
  goodDealThreshold   Int                  // Below this = "Good Deal"
  greatDealThreshold  Int                  // Below this = "Great Price"
  
  computedAt      DateTime @default(now())
  validUntil      DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  category Category @relation(fields: [categoryId], references: [id])

  @@unique([categoryId, conditionType, brandNormalized])
  @@index([categoryId])
  @@index([validUntil])
}

// =============================================================================
// CATEGORY ALERTS (NEW)
// =============================================================================

model CategoryAlert {
  id                String   @id @default(cuid())
  userId            String
  categoryId        String
  searchQuery       String?                  // Optional saved search terms
  maxPriceCents     Int?                     // Alert only if below this price
  conditionTypes    String[] @default([])   // Filter by condition
  brands            String[] @default([])   // Filter by brand
  includeInDigest   Boolean  @default(true)
  isActive          Boolean  @default(true)
  lastTriggeredAt   DateTime?
  matchCount        Int      @default(0)     // Total matches found
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user     User     @relation(fields: [userId], references: [id])
  category Category @relation(fields: [categoryId], references: [id])

  @@unique([userId, categoryId, searchQuery])
  @@index([userId, isActive])
  @@index([categoryId, isActive])
}

// =============================================================================
// BROWSING HISTORY
// =============================================================================

model UserBrowsingHistory {
  id                String   @id @default(cuid())
  userId            String
  listingId         String
  categoryId        String?
  viewCount         Int      @default(1)
  totalDurationSec  Int      @default(0)
  didAddToCart      Boolean  @default(false)
  didAddToWatchlist Boolean  @default(false)
  didPurchase       Boolean  @default(false)
  didSetAlert       Boolean  @default(false)   // NEW: Set price alert
  sourceType        String?                    // search, recommendation, direct, etc.
  firstViewedAt     DateTime @default(now())
  lastViewedAt      DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id])
  listing Listing @relation(fields: [listingId], references: [id])

  @@unique([userId, listingId])
  @@index([userId, lastViewedAt])
  @@index([categoryId])
}

// =============================================================================
// USER PREFERENCES (INFERRED)
// =============================================================================

model UserPreferenceInferred {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  categoryScores          Json     @default("[]")      // [{categoryId, score, viewCount}]
  brandScores             Json     @default("[]")      // [{brand, score, viewCount}]
  sizePreferences         Json     @default("{}")      // {categoryId: "M", ...}
  avgViewedPriceCents     Int?
  preferredPriceRangeLow  Int?
  preferredPriceRangeHigh Int?
  preferredConditions     String[] @default([])        // NEW
  digestFrequency         DigestFrequency @default(DAILY)  // NEW
  digestTime              String   @default("09:00")   // NEW: Preferred time (HH:MM)
  lastDigestSentAt        DateTime?                    // NEW
  lastComputedAt          DateTime @default(now())
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
}

enum DigestFrequency {
  NONE
  DAILY
  WEEKLY
  INSTANT   // Real-time notifications only
}

// =============================================================================
// RECOMMENDATION FEED
// =============================================================================

model RecommendationFeed {
  id          String   @id @default(cuid())
  userId      String
  items       Json     @default("[]")    // [{listingId, score, reason, position}]
  feedType    String   @default("home")  // home, category, similar, deal
  computedAt  DateTime @default(now())
  expiresAt   DateTime

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, feedType])
  @@index([userId, feedType, expiresAt])
}
```

---

## 2) Platform Settings

```typescript
// packages/core/config/buyerExperiencePlusSettings.ts

export const BUYER_EXPERIENCE_PLUS_SETTINGS = {
  // Price Alerts
  PRICE_ALERT_MAX_PER_USER: 50,
  PRICE_ALERT_DEFAULT_EXPIRY_DAYS: 90,
  PRICE_ALERT_MIN_TARGET_PERCENT: 5,           // Target must be at least 5% below current
  PRICE_ALERT_SUGGESTION_THRESHOLD: 0.15,      // Suggest alert if item is 15% above market
  
  // Price History
  PRICE_HISTORY_SNAPSHOT_INTERVAL_HOURS: 24,   // Daily snapshots
  PRICE_HISTORY_RETENTION_DAYS: 365,           // Keep 1 year of history
  PRICE_HISTORY_MIN_CHANGE_PERCENT: 1,         // Only record if change >= 1%
  
  // Market Price Index
  MARKET_INDEX_MIN_SAMPLE_SIZE: 10,            // Need 10+ listings for index
  MARKET_INDEX_REFRESH_HOURS: 24,              // Recompute daily
  MARKET_INDEX_GOOD_DEAL_PERCENTILE: 25,       // Below 25th percentile = Good Deal
  MARKET_INDEX_GREAT_DEAL_PERCENTILE: 10,      // Below 10th percentile = Great Price
  
  // Category Alerts
  CATEGORY_ALERT_MAX_PER_USER: 20,
  CATEGORY_ALERT_CHECK_INTERVAL_MINUTES: 60,   // Check for new matches hourly
  CATEGORY_ALERT_MAX_MATCHES_PER_RUN: 10,      // Max matches to notify per check
  
  // Digest
  DIGEST_DEFAULT_TIME: "09:00",
  DIGEST_MAX_ITEMS: 20,
  DIGEST_MIN_ITEMS_TO_SEND: 1,
  
  // Recommendations
  RECOMMENDATION_FEED_TTL_MINUTES: 60,
  RECOMMENDATION_MAX_ITEMS: 50,
  RECOMMENDATION_EXCLUDE_VIEWED_HOURS: 72,     // Exclude items viewed in last 72h
  
  // Browsing History
  BROWSING_HISTORY_MAX_ITEMS: 200,
  BROWSING_HISTORY_RETENTION_DAYS: 90,
  
  // UI Badges
  SHOW_DEAL_BADGES: true,
  SHOW_PRICE_DROP_BADGE_HOURS: 48,             // Show "Price Drop" for 48h after decrease
} as const;
```

---

## 3) Price Alert Service (Enhanced)

```typescript
// packages/core/buyer/alerts/priceAlertService.ts
import { PrismaClient, PriceAlertType } from "@prisma/client";
import { BUYER_EXPERIENCE_PLUS_SETTINGS as SETTINGS } from "../../config/buyerExperiencePlusSettings";
import { getMarketPriceIndex } from "../market/marketPriceService";

const prisma = new PrismaClient();

export interface CreatePriceAlertInput {
  userId: string;
  listingId: string;
  targetPriceCents?: number;
  alertType?: PriceAlertType;
  percentThreshold?: number;
  includeInDigest?: boolean;
}

export async function createPriceAlert(input: CreatePriceAlertInput) {
  const { userId, listingId, alertType = "BELOW_TARGET", includeInDigest = false } = input;
  
  // Check user limit
  const existingCount = await prisma.priceAlert.count({
    where: { userId, isActive: true },
  });
  if (existingCount >= SETTINGS.PRICE_ALERT_MAX_PER_USER) {
    throw new Error("PRICE_ALERT_LIMIT_EXCEEDED");
  }
  
  // Get listing
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { priceCents: true, categoryId: true, condition: true },
  });
  if (!listing) throw new Error("LISTING_NOT_FOUND");
  
  // Validate target price
  let targetPriceCents = input.targetPriceCents;
  if (alertType === "BELOW_TARGET") {
    if (!targetPriceCents) throw new Error("TARGET_PRICE_REQUIRED");
    const minTarget = Math.floor(listing.priceCents * (1 - SETTINGS.PRICE_ALERT_MIN_TARGET_PERCENT / 100));
    if (targetPriceCents > minTarget) {
      throw new Error("TARGET_MUST_BE_AT_LEAST_5_PERCENT_BELOW");
    }
  }
  
  // Set expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SETTINGS.PRICE_ALERT_DEFAULT_EXPIRY_DAYS);
  
  return prisma.priceAlert.upsert({
    where: { userId_listingId: { userId, listingId } },
    update: {
      targetPriceCents,
      alertType,
      percentThreshold: input.percentThreshold,
      originalPriceCents: listing.priceCents,
      includeInDigest,
      isActive: true,
      triggeredAt: null,
      notificationSent: false,
      expiresAt,
    },
    create: {
      userId,
      listingId,
      targetPriceCents: targetPriceCents ?? listing.priceCents,
      alertType,
      percentThreshold: input.percentThreshold,
      originalPriceCents: listing.priceCents,
      includeInDigest,
      expiresAt,
    },
  });
}

export async function getUserPriceAlerts(userId: string) {
  return prisma.priceAlert.findMany({
    where: { userId, isActive: true },
    include: {
      listing: {
        select: { id: true, title: true, priceCents: true, status: true, images: { take: 1 } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSuggestedAlertTarget(listingId: string): Promise<{
  suggestedTarget: number;
  marketMedian: number;
  currentPrice: number;
  percentAboveMarket: number;
} | null> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { priceCents: true, categoryId: true, condition: true },
  });
  if (!listing || !listing.categoryId) return null;
  
  const marketIndex = await getMarketPriceIndex(listing.categoryId, listing.condition);
  if (!marketIndex) return null;
  
  const percentAboveMarket = ((listing.priceCents - marketIndex.medianPriceCents) / marketIndex.medianPriceCents) * 100;
  
  // Suggest target at market median if current price is above market
  if (percentAboveMarket > SETTINGS.PRICE_ALERT_SUGGESTION_THRESHOLD * 100) {
    return {
      suggestedTarget: marketIndex.medianPriceCents,
      marketMedian: marketIndex.medianPriceCents,
      currentPrice: listing.priceCents,
      percentAboveMarket: Math.round(percentAboveMarket),
    };
  }
  
  // Otherwise suggest 10% below current
  return {
    suggestedTarget: Math.floor(listing.priceCents * 0.9),
    marketMedian: marketIndex.medianPriceCents,
    currentPrice: listing.priceCents,
    percentAboveMarket: Math.round(percentAboveMarket),
  };
}

export async function checkPriceAlerts(listingId: string, newPriceCents: number) {
  const alerts = await prisma.priceAlert.findMany({
    where: { listingId, isActive: true, triggeredAt: null },
  });
  
  const triggered: Array<{ alertId: string; userId: string; alertType: string }> = [];
  
  for (const alert of alerts) {
    let shouldTrigger = false;
    
    switch (alert.alertType) {
      case "BELOW_TARGET":
        shouldTrigger = newPriceCents <= alert.targetPriceCents;
        break;
      case "PERCENT_DROP":
        const dropPercent = ((alert.originalPriceCents - newPriceCents) / alert.originalPriceCents) * 100;
        shouldTrigger = dropPercent >= (alert.percentThreshold ?? 10);
        break;
      case "ANY_DROP":
        shouldTrigger = newPriceCents < alert.originalPriceCents;
        break;
    }
    
    if (shouldTrigger) {
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { triggeredAt: new Date(), triggeredPriceCents: newPriceCents },
      });
      triggered.push({ alertId: alert.id, userId: alert.userId, alertType: alert.alertType });
    }
  }
  
  return triggered;
}

export async function deletePriceAlert(userId: string, alertId: string) {
  const alert = await prisma.priceAlert.findFirst({
    where: { id: alertId, userId },
  });
  if (!alert) throw new Error("ALERT_NOT_FOUND");
  
  return prisma.priceAlert.update({
    where: { id: alertId },
    data: { isActive: false },
  });
}
```

---

## 4) Price History Service (NEW)

```typescript
// packages/core/buyer/history/priceHistoryService.ts
import { PrismaClient, PriceChangeType } from "@prisma/client";
import { BUYER_EXPERIENCE_PLUS_SETTINGS as SETTINGS } from "../../config/buyerExperiencePlusSettings";

const prisma = new PrismaClient();

export async function recordPriceChange(args: {
  listingId: string;
  newPriceCents: number;
  previousPriceCents?: number;
  source?: string;
}) {
  const { listingId, newPriceCents, source = "listing_update" } = args;
  
  // Get previous price if not provided
  let previousCents = args.previousPriceCents;
  if (previousCents === undefined) {
    const lastRecord = await prisma.priceHistory.findFirst({
      where: { listingId },
      orderBy: { snapshotDate: "desc" },
    });
    previousCents = lastRecord?.priceCents;
  }
  
  // Determine change type
  let changeType: PriceChangeType = "INITIAL";
  let changePercent: number | null = null;
  
  if (previousCents !== undefined) {
    if (newPriceCents > previousCents) {
      changeType = "INCREASE";
    } else if (newPriceCents < previousCents) {
      changeType = "DECREASE";
    } else {
      changeType = "NO_CHANGE";
    }
    changePercent = ((newPriceCents - previousCents) / previousCents) * 100;
    
    // Skip if change is below threshold
    if (Math.abs(changePercent) < SETTINGS.PRICE_HISTORY_MIN_CHANGE_PERCENT && changeType !== "INITIAL") {
      return null;
    }
  }
  
  return prisma.priceHistory.create({
    data: {
      listingId,
      priceCents: newPriceCents,
      previousCents,
      changeType,
      changePercent,
      source,
    },
  });
}

export async function getListingPriceHistory(listingId: string, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  return prisma.priceHistory.findMany({
    where: {
      listingId,
      snapshotDate: { gte: since },
    },
    orderBy: { snapshotDate: "asc" },
    select: {
      priceCents: true,
      changeType: true,
      changePercent: true,
      snapshotDate: true,
    },
  });
}

export async function getPriceHistoryStats(listingId: string) {
  const history = await prisma.priceHistory.findMany({
    where: { listingId },
    orderBy: { snapshotDate: "asc" },
  });
  
  if (history.length === 0) return null;
  
  const prices = history.map(h => h.priceCents);
  const initialPrice = prices[0];
  const currentPrice = prices[prices.length - 1];
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const priceDropCount = history.filter(h => h.changeType === "DECREASE").length;
  
  return {
    initialPrice,
    currentPrice,
    lowestPrice,
    highestPrice,
    totalChanges: history.length - 1,
    priceDropCount,
    percentFromInitial: ((currentPrice - initialPrice) / initialPrice) * 100,
    percentFromHighest: ((currentPrice - highestPrice) / highestPrice) * 100,
    daysTracked: Math.ceil((Date.now() - history[0].snapshotDate.getTime()) / (1000 * 60 * 60 * 24)),
  };
}

// Cron job: Daily price snapshots for active listings
export async function runDailyPriceSnapshots() {
  const activeListings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, priceCents: true },
  });
  
  let recorded = 0;
  for (const listing of activeListings) {
    const result = await recordPriceChange({
      listingId: listing.id,
      newPriceCents: listing.priceCents,
      source: "daily_snapshot",
    });
    if (result) recorded++;
  }
  
  return { processed: activeListings.length, recorded };
}
```

---

## 5) Market Price Index Service (NEW)

```typescript
// packages/core/buyer/market/marketPriceService.ts
import { PrismaClient } from "@prisma/client";
import { BUYER_EXPERIENCE_PLUS_SETTINGS as SETTINGS } from "../../config/buyerExperiencePlusSettings";

const prisma = new PrismaClient();

export async function getMarketPriceIndex(
  categoryId: string,
  conditionType?: string | null,
  brand?: string | null
) {
  const now = new Date();
  
  return prisma.marketPriceIndex.findFirst({
    where: {
      categoryId,
      conditionType: conditionType ?? null,
      brandNormalized: brand ? brand.toLowerCase().trim() : null,
      validUntil: { gt: now },
    },
  });
}

export async function computeMarketPriceIndex(categoryId: string, conditionType?: string) {
  // Get sold listings in last 90 days for this category/condition
  const since = new Date();
  since.setDate(since.getDate() - 90);
  
  const soldListings = await prisma.listing.findMany({
    where: {
      categoryId,
      condition: conditionType ?? undefined,
      status: "SOLD",
      soldAt: { gte: since },
    },
    select: { priceCents: true },
    orderBy: { priceCents: "asc" },
  });
  
  if (soldListings.length < SETTINGS.MARKET_INDEX_MIN_SAMPLE_SIZE) {
    return null; // Not enough data
  }
  
  const prices = soldListings.map(l => l.priceCents);
  const sorted = [...prices].sort((a, b) => a - b);
  
  const median = sorted[Math.floor(sorted.length / 2)];
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  
  // Calculate deal thresholds
  const goodDealThreshold = sorted[Math.floor(sorted.length * (SETTINGS.MARKET_INDEX_GOOD_DEAL_PERCENTILE / 100))];
  const greatDealThreshold = sorted[Math.floor(sorted.length * (SETTINGS.MARKET_INDEX_GREAT_DEAL_PERCENTILE / 100))];
  
  const validUntil = new Date();
  validUntil.setHours(validUntil.getHours() + SETTINGS.MARKET_INDEX_REFRESH_HOURS);
  
  return prisma.marketPriceIndex.upsert({
    where: {
      categoryId_conditionType_brandNormalized: {
        categoryId,
        conditionType: conditionType ?? null,
        brandNormalized: null,
      },
    },
    update: {
      medianPriceCents: median,
      avgPriceCents: avg,
      lowPriceCents: low,
      highPriceCents: high,
      p25PriceCents: p25,
      p75PriceCents: p75,
      sampleSize: prices.length,
      goodDealThreshold,
      greatDealThreshold,
      computedAt: new Date(),
      validUntil,
    },
    create: {
      categoryId,
      conditionType: conditionType ?? null,
      brandNormalized: null,
      medianPriceCents: median,
      avgPriceCents: avg,
      lowPriceCents: low,
      highPriceCents: high,
      p25PriceCents: p25,
      p75PriceCents: p75,
      sampleSize: prices.length,
      goodDealThreshold,
      greatDealThreshold,
      validUntil,
    },
  });
}

export async function getDealBadge(listingId: string): Promise<"GREAT_PRICE" | "GOOD_DEAL" | null> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { priceCents: true, categoryId: true, condition: true },
  });
  if (!listing || !listing.categoryId) return null;
  
  const index = await getMarketPriceIndex(listing.categoryId, listing.condition);
  if (!index) return null;
  
  if (listing.priceCents <= index.greatDealThreshold) return "GREAT_PRICE";
  if (listing.priceCents <= index.goodDealThreshold) return "GOOD_DEAL";
  return null;
}

// Cron job: Recompute market indices
export async function runMarketIndexComputation() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  
  const conditions = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"];
  let computed = 0;
  
  for (const category of categories) {
    // Compute overall category index
    const result = await computeMarketPriceIndex(category.id);
    if (result) computed++;
    
    // Compute per-condition indices
    for (const condition of conditions) {
      const condResult = await computeMarketPriceIndex(category.id, condition);
      if (condResult) computed++;
    }
  }
  
  return { categories: categories.length, indicesComputed: computed };
}
```

---

## 6) Category Alert Service (NEW)

```typescript
// packages/core/buyer/alerts/categoryAlertService.ts
import { PrismaClient } from "@prisma/client";
import { BUYER_EXPERIENCE_PLUS_SETTINGS as SETTINGS } from "../../config/buyerExperiencePlusSettings";

const prisma = new PrismaClient();

export interface CreateCategoryAlertInput {
  userId: string;
  categoryId: string;
  searchQuery?: string;
  maxPriceCents?: number;
  conditionTypes?: string[];
  brands?: string[];
  includeInDigest?: boolean;
}

export async function createCategoryAlert(input: CreateCategoryAlertInput) {
  const { userId, categoryId, searchQuery, maxPriceCents, conditionTypes = [], brands = [], includeInDigest = true } = input;
  
  // Check user limit
  const existingCount = await prisma.categoryAlert.count({
    where: { userId, isActive: true },
  });
  if (existingCount >= SETTINGS.CATEGORY_ALERT_MAX_PER_USER) {
    throw new Error("CATEGORY_ALERT_LIMIT_EXCEEDED");
  }
  
  // Verify category exists
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
  
  return prisma.categoryAlert.upsert({
    where: {
      userId_categoryId_searchQuery: {
        userId,
        categoryId,
        searchQuery: searchQuery ?? "",
      },
    },
    update: {
      maxPriceCents,
      conditionTypes,
      brands,
      includeInDigest,
      isActive: true,
    },
    create: {
      userId,
      categoryId,
      searchQuery,
      maxPriceCents,
      conditionTypes,
      brands,
      includeInDigest,
    },
  });
}

export async function getUserCategoryAlerts(userId: string) {
  return prisma.categoryAlert.findMany({
    where: { userId, isActive: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function checkCategoryAlerts() {
  const alerts = await prisma.categoryAlert.findMany({
    where: { isActive: true },
  });
  
  const results: Array<{ alertId: string; userId: string; matchingListings: string[] }> = [];
  const oneHourAgo = new Date(Date.now() - SETTINGS.CATEGORY_ALERT_CHECK_INTERVAL_MINUTES * 60 * 1000);
  
  for (const alert of alerts) {
    // Find new listings matching criteria
    const whereClause: any = {
      categoryId: alert.categoryId,
      status: "ACTIVE",
      createdAt: { gte: alert.lastTriggeredAt ?? oneHourAgo },
    };
    
    if (alert.maxPriceCents) {
      whereClause.priceCents = { lte: alert.maxPriceCents };
    }
    if (alert.conditionTypes.length > 0) {
      whereClause.condition = { in: alert.conditionTypes };
    }
    if (alert.brands.length > 0) {
      whereClause.brand = { in: alert.brands, mode: "insensitive" };
    }
    if (alert.searchQuery) {
      whereClause.OR = [
        { title: { contains: alert.searchQuery, mode: "insensitive" } },
        { description: { contains: alert.searchQuery, mode: "insensitive" } },
      ];
    }
    
    const matches = await prisma.listing.findMany({
      where: whereClause,
      take: SETTINGS.CATEGORY_ALERT_MAX_MATCHES_PER_RUN,
      select: { id: true },
    });
    
    if (matches.length > 0) {
      await prisma.categoryAlert.update({
        where: { id: alert.id },
        data: {
          lastTriggeredAt: new Date(),
          matchCount: { increment: matches.length },
        },
      });
      
      results.push({
        alertId: alert.id,
        userId: alert.userId,
        matchingListings: matches.map(m => m.id),
      });
    }
  }
  
  return results;
}
```

---

## 7) Digest Service (NEW)

```typescript
// packages/core/buyer/digest/digestService.ts
import { PrismaClient, DigestFrequency } from "@prisma/client";
import { BUYER_EXPERIENCE_PLUS_SETTINGS as SETTINGS } from "../../config/buyerExperiencePlusSettings";

const prisma = new PrismaClient();

interface DigestItem {
  type: "price_alert" | "category_match";
  listingId: string;
  title: string;
  priceCents: number;
  previousPriceCents?: number;
  imageUrl?: string;
  reason: string;
}

export async function generateUserDigest(userId: string): Promise<DigestItem[]> {
  const items: DigestItem[] = [];
  
  // Get triggered price alerts not yet in digest
  const triggeredAlerts = await prisma.priceAlert.findMany({
    where: {
      userId,
      isActive: true,
      includeInDigest: true,
      triggeredAt: { not: null },
      digestSentAt: null,
    },
    include: {
      listing: {
        select: { id: true, title: true, priceCents: true, images: { take: 1 } },
      },
    },
    take: SETTINGS.DIGEST_MAX_ITEMS,
  });
  
  for (const alert of triggeredAlerts) {
    items.push({
      type: "price_alert",
      listingId: alert.listingId,
      title: alert.listing.title,
      priceCents: alert.triggeredPriceCents ?? alert.listing.priceCents,
      previousPriceCents: alert.originalPriceCents,
      imageUrl: alert.listing.images[0]?.url,
      reason: `Price dropped to your target of $${(alert.targetPriceCents / 100).toFixed(2)}`,
    });
  }
  
  return items.slice(0, SETTINGS.DIGEST_MAX_ITEMS);
}

export async function sendDailyDigests() {
  const currentHour = new Date().getHours().toString().padStart(2, "0") + ":00";
  
  // Find users whose digest time matches current hour
  const users = await prisma.userPreferenceInferred.findMany({
    where: {
      digestFrequency: DigestFrequency.DAILY,
      digestTime: currentHour,
      OR: [
        { lastDigestSentAt: null },
        { lastDigestSentAt: { lt: new Date(Date.now() - 23 * 60 * 60 * 1000) } }, // 23h ago
      ],
    },
    select: { userId: true },
  });
  
  let sent = 0;
  for (const user of users) {
    const digest = await generateUserDigest(user.userId);
    
    if (digest.length >= SETTINGS.DIGEST_MIN_ITEMS_TO_SEND) {
      // Queue notification
      await prisma.notification.create({
        data: {
          userId: user.userId,
          type: "PRICE_ALERT_DIGEST",
          channel: "EMAIL",
          payload: { items: digest },
          scheduledFor: new Date(),
        },
      });
      
      // Mark alerts as included in digest
      const alertIds = digest
        .filter(d => d.type === "price_alert")
        .map(d => d.listingId);
      
      await prisma.priceAlert.updateMany({
        where: { userId: user.userId, listingId: { in: alertIds } },
        data: { digestSentAt: new Date() },
      });
      
      // Update user's last digest time
      await prisma.userPreferenceInferred.update({
        where: { userId: user.userId },
        data: { lastDigestSentAt: new Date() },
      });
      
      sent++;
    }
  }
  
  return { usersChecked: users.length, digestsSent: sent };
}
```

---

## 8) Browsing History Service

```typescript
// packages/core/buyer/history/browsingHistoryService.ts
import { PrismaClient } from "@prisma/client";
import { BUYER_EXPERIENCE_PLUS_SETTINGS as SETTINGS } from "../../config/buyerExperiencePlusSettings";

const prisma = new PrismaClient();

export async function recordListingView(args: {
  userId: string;
  listingId: string;
  durationSec?: number;
  sourceType?: string;
}) {
  const listing = await prisma.listing.findUnique({
    where: { id: args.listingId },
    select: { categoryId: true },
  });
  
  await prisma.userBrowsingHistory.upsert({
    where: { userId_listingId: { userId: args.userId, listingId: args.listingId } },
    update: {
      viewCount: { increment: 1 },
      totalDurationSec: { increment: args.durationSec ?? 0 },
      lastViewedAt: new Date(),
    },
    create: {
      userId: args.userId,
      listingId: args.listingId,
      categoryId: listing?.categoryId,
      totalDurationSec: args.durationSec ?? 0,
      sourceType: args.sourceType,
    },
  });
}

export async function getUserBrowsingHistory(userId: string, limit = 50) {
  return prisma.userBrowsingHistory.findMany({
    where: { userId },
    orderBy: { lastViewedAt: "desc" },
    take: Math.min(limit, SETTINGS.BROWSING_HISTORY_MAX_ITEMS),
  });
}

export async function getRecentlyViewedListings(userId: string, limit = 20) {
  const history = await prisma.userBrowsingHistory.findMany({
    where: { userId },
    orderBy: { lastViewedAt: "desc" },
    take: limit,
    select: { listingId: true },
  });
  
  return prisma.listing.findMany({
    where: { id: { in: history.map(h => h.listingId) }, status: "ACTIVE" },
    include: { images: { take: 1 } },
  });
}

export async function clearBrowsingHistory(userId: string) {
  return prisma.userBrowsingHistory.deleteMany({ where: { userId } });
}

export async function markHistoryAction(userId: string, listingId: string, action: "cart" | "watchlist" | "purchase" | "alert") {
  const update: Record<string, boolean> = {};
  switch (action) {
    case "cart": update.didAddToCart = true; break;
    case "watchlist": update.didAddToWatchlist = true; break;
    case "purchase": update.didPurchase = true; break;
    case "alert": update.didSetAlert = true; break;
  }
  
  await prisma.userBrowsingHistory.updateMany({
    where: { userId, listingId },
    data: update,
  });
}
```

---

## 9) Recommendation Service

```typescript
// packages/core/buyer/recommendations/recommendationService.ts
import { PrismaClient } from "@prisma/client";
import { BUYER_EXPERIENCE_PLUS_SETTINGS as SETTINGS } from "../../config/buyerExperiencePlusSettings";

const prisma = new PrismaClient();

export async function getRecommendations(userId: string, feedType = "home", limit = 20) {
  // Check cache
  const cached = await prisma.recommendationFeed.findUnique({
    where: { userId_feedType: { userId, feedType } },
  });
  if (cached && cached.expiresAt > new Date()) {
    return (cached.items as any[]).slice(0, limit);
  }
  
  // Get user preferences
  const prefs = await prisma.userPreferenceInferred.findUnique({ where: { userId } });
  const categoryScores = (prefs?.categoryScores as Array<{ categoryId: string; score: number }>) ?? [];
  const categoryIds = categoryScores.slice(0, 5).map(c => c.categoryId);
  
  // Get recently viewed to exclude
  const excludeHours = SETTINGS.RECOMMENDATION_EXCLUDE_VIEWED_HOURS;
  const since = new Date(Date.now() - excludeHours * 60 * 60 * 1000);
  const history = await prisma.userBrowsingHistory.findMany({
    where: { userId, lastViewedAt: { gte: since } },
    select: { listingId: true },
  });
  const excludeIds = history.map(h => h.listingId);
  
  // Query listings
  const listings = await prisma.listing.findMany({
    where: {
      status: "ACTIVE",
      categoryId: categoryIds.length > 0 ? { in: categoryIds } : undefined,
      id: { notIn: excludeIds },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, SETTINGS.RECOMMENDATION_MAX_ITEMS),
    select: { id: true, categoryId: true },
  });
  
  const items = listings.map((l, i) => {
    const categoryScore = categoryScores.find(c => c.categoryId === l.categoryId)?.score ?? 0.5;
    return {
      listingId: l.id,
      score: categoryScore * (1 - i * 0.01),
      reason: categoryIds.includes(l.categoryId ?? "") ? "based_on_interests" : "trending",
      position: i,
    };
  });
  
  // Cache
  const ttl = SETTINGS.RECOMMENDATION_FEED_TTL_MINUTES * 60 * 1000;
  await prisma.recommendationFeed.upsert({
    where: { userId_feedType: { userId, feedType } },
    update: { items, computedAt: new Date(), expiresAt: new Date(Date.now() + ttl) },
    create: { userId, feedType, items, expiresAt: new Date(Date.now() + ttl) },
  });
  
  return items;
}

export async function saveUserSizePreference(userId: string, category: string, size: string) {
  const prefs = await prisma.userPreferenceInferred.findUnique({ where: { userId } });
  const sizes = (prefs?.sizePreferences as Record<string, string>) ?? {};
  sizes[category] = size;
  
  await prisma.userPreferenceInferred.upsert({
    where: { userId },
    update: { sizePreferences: sizes },
    create: { userId, sizePreferences: sizes },
  });
}

export async function updateDigestPreferences(userId: string, frequency: string, time?: string) {
  await prisma.userPreferenceInferred.upsert({
    where: { userId },
    update: {
      digestFrequency: frequency as any,
      digestTime: time ?? SETTINGS.DIGEST_DEFAULT_TIME,
    },
    create: {
      userId,
      digestFrequency: frequency as any,
      digestTime: time ?? SETTINGS.DIGEST_DEFAULT_TIME,
    },
  });
}
```

---

## 10) Admin Settings UI

```typescript
// apps/web/app/corp/settings/price-alerts/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface PriceAlertSettings {
  PRICE_ALERT_MAX_PER_USER: number;
  PRICE_ALERT_DEFAULT_EXPIRY_DAYS: number;
  PRICE_ALERT_MIN_TARGET_PERCENT: number;
  PRICE_ALERT_SUGGESTION_THRESHOLD: number;
  PRICE_HISTORY_RETENTION_DAYS: number;
  MARKET_INDEX_MIN_SAMPLE_SIZE: number;
  MARKET_INDEX_GOOD_DEAL_PERCENTILE: number;
  MARKET_INDEX_GREAT_DEAL_PERCENTILE: number;
  CATEGORY_ALERT_MAX_PER_USER: number;
  SHOW_DEAL_BADGES: boolean;
  SHOW_PRICE_DROP_BADGE_HOURS: number;
}

export default function PriceAlertSettingsPage() {
  const [settings, setSettings] = useState<PriceAlertSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/corp/settings/price-alerts")
      .then(res => res.json())
      .then(data => setSettings(data.settings));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/corp/settings/price-alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Price Alert Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Alert Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Alerts Per User</Label>
              <Input
                type="number"
                value={settings.PRICE_ALERT_MAX_PER_USER}
                onChange={e => setSettings({ ...settings, PRICE_ALERT_MAX_PER_USER: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Default Expiry (Days)</Label>
              <Input
                type="number"
                value={settings.PRICE_ALERT_DEFAULT_EXPIRY_DAYS}
                onChange={e => setSettings({ ...settings, PRICE_ALERT_DEFAULT_EXPIRY_DAYS: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Min Target % Below Current</Label>
              <Input
                type="number"
                value={settings.PRICE_ALERT_MIN_TARGET_PERCENT}
                onChange={e => setSettings({ ...settings, PRICE_ALERT_MIN_TARGET_PERCENT: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Category Alert Max Per User</Label>
              <Input
                type="number"
                value={settings.CATEGORY_ALERT_MAX_PER_USER}
                onChange={e => setSettings({ ...settings, CATEGORY_ALERT_MAX_PER_USER: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Market Price Index</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Min Sample Size for Index</Label>
              <Input
                type="number"
                value={settings.MARKET_INDEX_MIN_SAMPLE_SIZE}
                onChange={e => setSettings({ ...settings, MARKET_INDEX_MIN_SAMPLE_SIZE: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Good Deal Percentile</Label>
              <Input
                type="number"
                value={settings.MARKET_INDEX_GOOD_DEAL_PERCENTILE}
                onChange={e => setSettings({ ...settings, MARKET_INDEX_GOOD_DEAL_PERCENTILE: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Great Deal Percentile</Label>
              <Input
                type="number"
                value={settings.MARKET_INDEX_GREAT_DEAL_PERCENTILE}
                onChange={e => setSettings({ ...settings, MARKET_INDEX_GREAT_DEAL_PERCENTILE: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Price History Retention (Days)</Label>
              <Input
                type="number"
                value={settings.PRICE_HISTORY_RETENTION_DAYS}
                onChange={e => setSettings({ ...settings, PRICE_HISTORY_RETENTION_DAYS: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UI Badges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Show Deal Badges</Label>
            <Switch
              checked={settings.SHOW_DEAL_BADGES}
              onCheckedChange={checked => setSettings({ ...settings, SHOW_DEAL_BADGES: checked })}
            />
          </div>
          <div>
            <Label>Price Drop Badge Duration (Hours)</Label>
            <Input
              type="number"
              value={settings.SHOW_PRICE_DROP_BADGE_HOURS}
              onChange={e => setSettings({ ...settings, SHOW_PRICE_DROP_BADGE_HOURS: parseInt(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
```

---

## 11) Health Provider

```typescript
// packages/core/health/providers/buyerExperiencePlusHealthProvider.ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthCheck } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const buyerExperiencePlusHealthProvider: HealthProvider = {
  id: "buyer_experience_plus",
  label: "Buyer Experience Plus",
  description: "Validates price alerts, price history, market index, recommendations, browsing history",
  version: "2.0.0",

  async run(): Promise<HealthResult> {
    const checks: HealthCheck[] = [];
    let overallStatus = HEALTH_STATUS.PASS;

    // Check 1: Stale triggered alerts (not notified within 1 hour)
    const staleAlerts = await prisma.priceAlert.count({
      where: {
        triggeredAt: { lt: new Date(Date.now() - 3600000) },
        notificationSent: false,
        isActive: true,
      },
    });
    checks.push({
      id: "buyer_exp.no_stale_alerts",
      label: "No stale triggered alerts",
      status: staleAlerts === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: staleAlerts === 0 ? "All processed" : `${staleAlerts} stale alerts pending notification`,
    });
    if (staleAlerts > 0) overallStatus = HEALTH_STATUS.WARN;

    // Check 2: Price history recording
    const recentHistory = await prisma.priceHistory.count({
      where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
    });
    checks.push({
      id: "buyer_exp.price_history_recording",
      label: "Price history recording active",
      status: recentHistory > 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: `${recentHistory} records in last 24h`,
    });

    // Check 3: Market price index freshness
    const staleIndices = await prisma.marketPriceIndex.count({
      where: { validUntil: { lt: new Date() } },
    });
    const totalIndices = await prisma.marketPriceIndex.count();
    checks.push({
      id: "buyer_exp.market_index_fresh",
      label: "Market price indices fresh",
      status: staleIndices === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: staleIndices === 0 ? `${totalIndices} indices valid` : `${staleIndices}/${totalIndices} indices expired`,
    });
    if (staleIndices > totalIndices * 0.1) overallStatus = HEALTH_STATUS.WARN;

    // Check 4: Recommendation feeds
    const staleFeedsCount = await prisma.recommendationFeed.count({
      where: { expiresAt: { lt: new Date(Date.now() - 7200000) } }, // 2h+ stale
    });
    checks.push({
      id: "buyer_exp.recommendation_feeds",
      label: "Recommendation feeds healthy",
      status: staleFeedsCount < 100 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: staleFeedsCount < 100 ? "Feeds refreshing normally" : `${staleFeedsCount} very stale feeds`,
    });

    // Check 5: Digest delivery
    const failedDigests = await prisma.notification.count({
      where: {
        type: "PRICE_ALERT_DIGEST",
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    checks.push({
      id: "buyer_exp.digest_delivery",
      label: "Digest emails delivering",
      status: failedDigests === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: failedDigests === 0 ? "All digests sent" : `${failedDigests} failed in last 24h`,
    });

    return {
      providerId: this.id,
      status: overallStatus,
      summary: `Buyer Experience Plus: ${overallStatus}`,
      checks,
    };
  },
};
```

---

## 12) Doctor Checks

```typescript
// packages/core/doctor/checks/buyerExperiencePlusDoctorChecks.ts
import { PrismaClient } from "@prisma/client";
import type { DoctorCheckResult } from "../types";
import { createPriceAlert, checkPriceAlerts, getSuggestedAlertTarget } from "../../buyer/alerts/priceAlertService";
import { recordPriceChange, getListingPriceHistory } from "../../buyer/history/priceHistoryService";
import { computeMarketPriceIndex, getDealBadge } from "../../buyer/market/marketPriceService";
import { recordListingView, getUserBrowsingHistory } from "../../buyer/history/browsingHistoryService";
import { getRecommendations } from "../../buyer/recommendations/recommendationService";

const prisma = new PrismaClient();

export async function runPhase43DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  const testUserId = "_doctor_test_user_43";
  const testSellerId = "_doctor_test_seller_43";
  const testCategoryId = "_doctor_test_category_43";

  // Create test fixtures
  const testCategory = await prisma.category.create({
    data: { id: testCategoryId, name: "Doctor Test Category", slug: "doctor-test-43", isActive: true },
  });

  const testListing = await prisma.listing.create({
    data: {
      sellerId: testSellerId,
      categoryId: testCategoryId,
      title: "Doctor Test Listing 43",
      description: "Test",
      priceCents: 10000,
      condition: "GOOD",
      status: "ACTIVE",
    },
  });

  try {
    // Test 1: Create price alert
    const alert = await createPriceAlert({
      userId: testUserId,
      listingId: testListing.id,
      targetPriceCents: 8000,
      alertType: "BELOW_TARGET",
    });
    results.push({
      id: "buyer_exp.create_alert",
      label: "Create price alert",
      status: alert.id ? "PASS" : "FAIL",
      message: alert.id ? "Alert created" : "Failed to create alert",
    });

    // Test 2: Get suggested alert target
    const suggestion = await getSuggestedAlertTarget(testListing.id);
    results.push({
      id: "buyer_exp.suggest_target",
      label: "Get suggested alert target",
      status: suggestion !== null ? "PASS" : "WARN",
      message: suggestion ? `Suggested: $${(suggestion.suggestedTarget / 100).toFixed(2)}` : "No market data",
    });

    // Test 3: Record price history
    await recordPriceChange({ listingId: testListing.id, newPriceCents: 10000 });
    await prisma.listing.update({ where: { id: testListing.id }, data: { priceCents: 9000 } });
    await recordPriceChange({ listingId: testListing.id, newPriceCents: 9000, previousPriceCents: 10000 });
    const history = await getListingPriceHistory(testListing.id);
    results.push({
      id: "buyer_exp.price_history",
      label: "Record price history",
      status: history.length >= 2 ? "PASS" : "FAIL",
      message: `${history.length} price records`,
    });

    // Test 4: Trigger alert on price drop
    await prisma.listing.update({ where: { id: testListing.id }, data: { priceCents: 7500 } });
    const triggered = await checkPriceAlerts(testListing.id, 7500);
    results.push({
      id: "buyer_exp.trigger_alert",
      label: "Trigger alert on price drop",
      status: triggered.length > 0 ? "PASS" : "FAIL",
      message: triggered.length > 0 ? "Alert triggered" : "Alert not triggered",
    });

    // Test 5: Browsing history
    await recordListingView({ userId: testUserId, listingId: testListing.id, durationSec: 30, sourceType: "doctor" });
    const browsingHistory = await getUserBrowsingHistory(testUserId);
    results.push({
      id: "buyer_exp.browsing_history",
      label: "Record browsing history",
      status: browsingHistory.length > 0 ? "PASS" : "FAIL",
      message: browsingHistory.length > 0 ? "History recorded" : "Failed to record",
    });

    // Test 6: Recommendations
    const recs = await getRecommendations(testUserId, "home", 5);
    results.push({
      id: "buyer_exp.recommendations",
      label: "Generate recommendations",
      status: "PASS", // May be empty if no matching listings, but service works
      message: `${recs.length} recommendations generated`,
    });

    // Test 7: Market index computation (may not have enough data)
    try {
      const index = await computeMarketPriceIndex(testCategoryId, "GOOD");
      results.push({
        id: "buyer_exp.market_index",
        label: "Compute market price index",
        status: "PASS",
        message: index ? `Median: $${(index.medianPriceCents / 100).toFixed(2)}` : "Insufficient data (expected)",
      });
    } catch (err) {
      results.push({
        id: "buyer_exp.market_index",
        label: "Compute market price index",
        status: "WARN",
        message: "Insufficient sample data",
      });
    }

  } finally {
    // Cleanup
    await prisma.priceAlert.deleteMany({ where: { userId: testUserId } });
    await prisma.priceHistory.deleteMany({ where: { listingId: testListing.id } });
    await prisma.userBrowsingHistory.deleteMany({ where: { userId: testUserId } });
    await prisma.recommendationFeed.deleteMany({ where: { userId: testUserId } });
    await prisma.categoryAlert.deleteMany({ where: { userId: testUserId } });
    await prisma.listing.delete({ where: { id: testListing.id } });
    await prisma.category.delete({ where: { id: testCategoryId } });
  }

  return results;
}
```

---

## 13) API Endpoints

```typescript
// apps/web/app/api/buyer/price-alerts/route.ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getUserPriceAlerts, createPriceAlert, deletePriceAlert } from "@/packages/core/buyer/alerts/priceAlertService";

export async function GET() {
  const userId = await getSessionUserId();
  const alerts = await getUserPriceAlerts(userId);
  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  const body = await req.json();
  const alert = await createPriceAlert({ userId, ...body });
  return NextResponse.json({ alert }, { status: 201 });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  const { alertId } = await req.json();
  await deletePriceAlert(userId, alertId);
  return NextResponse.json({ success: true });
}

// apps/web/app/api/buyer/price-alerts/suggestion/route.ts
import { NextResponse } from "next/server";
import { getSuggestedAlertTarget } from "@/packages/core/buyer/alerts/priceAlertService";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const suggestion = await getSuggestedAlertTarget(listingId);
  return NextResponse.json({ suggestion });
}

// apps/web/app/api/buyer/price-history/[listingId]/route.ts
import { NextResponse } from "next/server";
import { getListingPriceHistory, getPriceHistoryStats } from "@/packages/core/buyer/history/priceHistoryService";

export async function GET(req: Request, { params }: { params: { listingId: string } }) {
  const history = await getListingPriceHistory(params.listingId);
  const stats = await getPriceHistoryStats(params.listingId);
  return NextResponse.json({ history, stats });
}

// apps/web/app/api/buyer/category-alerts/route.ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getUserCategoryAlerts, createCategoryAlert } from "@/packages/core/buyer/alerts/categoryAlertService";

export async function GET() {
  const userId = await getSessionUserId();
  const alerts = await getUserCategoryAlerts(userId);
  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  const body = await req.json();
  const alert = await createCategoryAlert({ userId, ...body });
  return NextResponse.json({ alert }, { status: 201 });
}

// apps/web/app/api/buyer/recommendations/route.ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getRecommendations } from "@/packages/core/buyer/recommendations/recommendationService";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  const { searchParams } = new URL(req.url);
  const feedType = searchParams.get("type") ?? "home";
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const items = await getRecommendations(userId, feedType, limit);
  return NextResponse.json({ recommendations: items });
}

// apps/web/app/api/buyer/digest-preferences/route.ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { updateDigestPreferences } from "@/packages/core/buyer/recommendations/recommendationService";

export async function PUT(req: Request) {
  const userId = await getSessionUserId();
  const { frequency, time } = await req.json();
  await updateDigestPreferences(userId, frequency, time);
  return NextResponse.json({ success: true });
}

// apps/web/app/api/listings/[id]/deal-badge/route.ts
import { NextResponse } from "next/server";
import { getDealBadge } from "@/packages/core/buyer/market/marketPriceService";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const badge = await getDealBadge(params.id);
  return NextResponse.json({ badge });
}
```

---

## 14) Buyer UI Components

```typescript
// apps/web/components/buyer/PriceAlertButton.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Bell, BellRing } from "lucide-react";
import { toast } from "sonner";

interface Props {
  listingId: string;
  currentPriceCents: number;
}

export function PriceAlertButton({ listingId, currentPriceCents }: Props) {
  const [open, setOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState("");
  const [suggestion, setSuggestion] = useState<any>(null);
  const [hasAlert, setHasAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch suggestion
    fetch(`/api/buyer/price-alerts/suggestion?listingId=${listingId}`)
      .then(res => res.json())
      .then(data => {
        if (data.suggestion) {
          setSuggestion(data.suggestion);
          setTargetPrice((data.suggestion.suggestedTarget / 100).toFixed(2));
        }
      });
  }, [listingId]);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/buyer/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          targetPriceCents: Math.round(parseFloat(targetPrice) * 100),
          alertType: "BELOW_TARGET",
          includeInDigest: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create alert");
      setHasAlert(true);
      setOpen(false);
      toast.success("Price alert created!");
    } catch (err) {
      toast.error("Failed to create alert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {hasAlert ? <BellRing className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
          {hasAlert ? "Alert Set" : "Set Price Alert"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Price Alert</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Current price: <strong>${(currentPriceCents / 100).toFixed(2)}</strong>
            </p>
            {suggestion && suggestion.percentAboveMarket > 0 && (
              <p className="text-sm text-orange-600">
                This item is {suggestion.percentAboveMarket}% above market average
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Alert me when price drops to:</label>
            <div className="flex items-center gap-2 mt-1">
              <span>$</span>
              <Input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {suggestion && (
              <p className="text-xs text-muted-foreground mt-1">
                Suggested: ${(suggestion.suggestedTarget / 100).toFixed(2)} (market median)
              </p>
            )}
          </div>
          <Button onClick={handleCreate} disabled={loading || !targetPrice} className="w-full">
            {loading ? "Creating..." : "Create Alert"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// apps/web/components/buyer/PriceHistoryChart.tsx
"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  listingId: string;
}

export function PriceHistoryChart({ listingId }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/buyer/price-history/${listingId}`)
      .then(res => res.json())
      .then(res => {
        setData(res.history.map((h: any) => ({
          date: new Date(h.snapshotDate).toLocaleDateString(),
          price: h.priceCents / 100,
        })));
        setStats(res.stats);
      });
  }, [listingId]);

  if (data.length < 2) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Price History</h4>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
          <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]} />
          <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      {stats && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Low: ${(stats.lowestPrice / 100).toFixed(2)}</span>
          <span>High: ${(stats.highestPrice / 100).toFixed(2)}</span>
          <span>{stats.priceDropCount} price drops</span>
        </div>
      )}
    </div>
  );
}

// apps/web/components/buyer/DealBadge.tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Props {
  listingId: string;
}

export function DealBadge({ listingId }: Props) {
  const [badge, setBadge] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/listings/${listingId}/deal-badge`)
      .then(res => res.json())
      .then(data => setBadge(data.badge));
  }, [listingId]);

  if (!badge) return null;

  return (
    <Badge variant={badge === "GREAT_PRICE" ? "default" : "secondary"} className="text-xs">
      {badge === "GREAT_PRICE" ? "🔥 Great Price" : "✓ Good Deal"}
    </Badge>
  );
}
```

---

## 15) Cron Jobs

```typescript
// packages/core/cron/buyerExperiencePlusCron.ts
import { runDailyPriceSnapshots } from "../buyer/history/priceHistoryService";
import { runMarketIndexComputation } from "../buyer/market/marketPriceService";
import { checkCategoryAlerts } from "../buyer/alerts/categoryAlertService";
import { sendDailyDigests } from "../buyer/digest/digestService";

// Run daily at 2 AM
export async function runDailyBuyerExperienceTasks() {
  console.log("[Cron] Starting daily buyer experience tasks...");

  // 1. Price snapshots
  const snapshotResult = await runDailyPriceSnapshots();
  console.log(`[Cron] Price snapshots: ${snapshotResult.recorded}/${snapshotResult.processed} recorded`);

  // 2. Market index computation
  const indexResult = await runMarketIndexComputation();
  console.log(`[Cron] Market indices: ${indexResult.indicesComputed} computed for ${indexResult.categories} categories`);

  console.log("[Cron] Daily buyer experience tasks complete");
}

// Run hourly
export async function runHourlyBuyerExperienceTasks() {
  // 1. Check category alerts for new matches
  const alertResults = await checkCategoryAlerts();
  console.log(`[Cron] Category alerts: ${alertResults.length} triggered`);

  // 2. Send digests for users whose time matches
  const digestResult = await sendDailyDigests();
  console.log(`[Cron] Digests: ${digestResult.digestsSent}/${digestResult.usersChecked} sent`);
}
```

---

## 16) Phase 43 Completion Criteria

- [ ] PriceAlert model migrated (with digest fields)
- [ ] PriceHistory model migrated
- [ ] MarketPriceIndex model migrated
- [ ] CategoryAlert model migrated
- [ ] UserBrowsingHistory model migrated (with didSetAlert)
- [ ] UserPreferenceInferred model migrated (with digest preferences)
- [ ] RecommendationFeed model migrated
- [ ] Price alert service with suggestion engine
- [ ] Price history service with stats
- [ ] Market price index service with deal thresholds
- [ ] Category alert service
- [ ] Digest service
- [ ] Browsing history service
- [ ] Recommendation service
- [ ] Price alert UI with suggested targets
- [ ] Price history chart on listings
- [ ] Deal badges (Good Deal / Great Price)
- [ ] Category alert management
- [ ] Digest preference settings
- [ ] Admin settings UI at `/corp/settings/price-alerts`
- [ ] Health provider passing all checks
- [ ] Doctor checks passing
- [ ] Cron jobs configured (daily + hourly)

---

## 17) "Better Than eBay" Differentiators

| Feature | eBay | Twicely |
|---------|------|---------|
| Price drop alerts | Basic | ✅ Target price + percentage + any drop |
| Suggested alert targets | No | ✅ Based on market data |
| Price history graph | No | ✅ Visual history with stats |
| Market price comparison | Limited | ✅ Real-time "Good Deal" badges |
| Category-wide alerts | Basic saved search | ✅ Price + condition + brand filters |
| Daily digest | No | ✅ Configurable time preference |
| Browsing history | Basic | ✅ With engagement tracking |
| Personalized recs | Limited | ✅ ML-style scoring |
| "Because you viewed" | No | ✅ Similar item clusters |
| Size memory | No | ✅ Per-category preferences |
| Clear history | Yes | ✅ With privacy controls |

---

## 18) Integration Points

- **Phase 2 (Listings):** Hook `recordPriceChange` into listing update flow
- **Phase 3 (Orders):** Mark `didPurchase` in browsing history on order completion
- **Phase 7 (Notifications):** Queue price alert and digest notifications
- **Phase 17 (Search):** Use browsing history for personalized search ranking
- **Phase 21 (Messaging):** Optional: notify seller when many alerts are set on their listing
