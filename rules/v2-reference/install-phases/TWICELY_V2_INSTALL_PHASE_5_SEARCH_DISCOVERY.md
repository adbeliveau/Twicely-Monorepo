# TWICELY V2 - Install Phase 5: Search + Browse + Discovery (Core)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema  ->  API  ->  Indexing  ->  Health  ->  UI  ->  Doctor  
**Canonicals:** MUST align with:
- `/rules/TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md`
- `/rules/TWICELY_LISTINGS_CATALOG_CANONICAL.md`
- `/rules/TWICELY_RATINGS_TRUST_CANONICAL.md` (trust gating + multiplier hooks)

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_5_SEARCH_DISCOVERY.md`  
> Prereq: Phase 4 complete.

---

## 0) What this phase installs

### Backend
- SearchIndex table (v1: DB-backed index) with deterministic query behavior
- SearchIndexStatus for tracking index health
- Indexing job triggered on listing activation and updates
- Eligibility filter gates (ACTIVE + requiredAttributesComplete + inventory > 0 + enforcement clear)
- Trust gating hook points (no demotion for low-volume sellers per trust canonical)
- Search API endpoints: query + browse by category + filters + sorting

### UI (minimal)
- Browse page by category
- Search results page with filters and sorting
- Listing cards show price/condition and seller rating placeholder

### Ops
- Health provider: `search`
- Doctor checks: eligible listings appear; ineligible never appear; stable sort order

---

## 1) Prisma schema (additive)

Add to `prisma/schema.prisma`:

```prisma
// ============================================================
// PHASE 5: SEARCH & DISCOVERY
// ============================================================

model SearchIndex {
  id              String   @id @default(cuid())
  listingId       String   @unique
  
  // Searchable content (denormalized for performance)
  searchableText  String   // concatenated title + description + tags
  normalizedTitle String   // lowercase, trimmed
  categoryPath    String[] // ancestor category IDs for faceting
  tags            String[]
  brand           String?
  
  // Core listing attributes (denormalized)
  priceCents      Int
  currency        String   @default("USD")
  condition       String?
  size            String?
  color           String?
  
  // Trust integration (per TWICELY_RATINGS_TRUST_CANONICAL.md)
  sellerId        String
  sellerTrustScore Float   @default(80)
  sellerCompletedOrders Int @default(0)
  trustMultiplier  Float   @default(1.0)  // Computed from trust band + volume
  
  // Eligibility (hard gate)
  isEligible      Boolean  @default(true)
  eligibilityReason String? // Reason if not eligible
  
  // Ranking signals
  salesCount      Int      @default(0)
  viewCount       Int      @default(0)
  favoriteCount   Int      @default(0)
  
  // Timestamps
  listingCreatedAt DateTime
  listingUpdatedAt DateTime
  indexedAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Indexes for efficient queries
  @@index([isEligible, categoryPath])
  @@index([sellerId])
  @@index([priceCents])
  @@index([indexedAt])
}

model SearchIndexStatus {
  id            String   @id @default(cuid())
  entityType    String   @unique // Listing|Category|Seller
  lastIndexedAt DateTime
  documentCount Int
  pendingCount  Int      @default(0)
  status        String   @default("HEALTHY") // HEALTHY|STALE|REBUILDING|ERROR
  errorMessage  String?
  updatedAt     DateTime @updatedAt
}

model SearchLog {
  id          String   @id @default(cuid())
  query       String
  userId      String?
  sessionId   String?
  resultCount Int
  filters     Json     @default("{}")
  sortBy      String?
  page        Int      @default(1)
  durationMs  Int?
  occurredAt  DateTime @default(now())
  
  @@index([occurredAt])
  @@index([userId, occurredAt])
}
```

Migrate:
```bash
npx prisma migrate dev --name search_phase5
```

---

## 2) Search Index Types

Create `packages/core/search/types.ts`:

```ts
/**
 * Search eligibility requirements per TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md
 */
export type EligibilityResult = {
  isEligible: boolean;
  reason?: string;
};

export type SearchFilters = {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  brand?: string;
  size?: string;
  color?: string;
  sellerId?: string;
};

export type SortOption = 
  | "best_match"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "popular";

export type SearchRequest = {
  query?: string;
  filters?: SearchFilters;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  total: number;
  page: number;
  pageSize: number;
  results: SearchIndexRow[];
  facets?: SearchFacets;
};

export type SearchIndexRow = {
  id: string;
  listingId: string;
  normalizedTitle: string;
  priceCents: number;
  currency: string;
  condition?: string;
  brand?: string;
  sellerId: string;
  sellerTrustScore: number;
  trustMultiplier: number;
  salesCount: number;
  listingCreatedAt: Date;
};

export type SearchFacets = {
  categories: Array<{ id: string; count: number }>;
  conditions: Array<{ value: string; count: number }>;
  brands: Array<{ value: string; count: number }>;
  priceRanges: Array<{ min: number; max: number; count: number }>;
};
```

---

## 3) Eligibility Computer

Create `packages/core/search/eligibility.ts`:

```ts
import type { EligibilityResult } from "./types";

/**
 * Compute search eligibility for a listing
 * Per TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md Section 4
 */
export function computeEligibility(listing: {
  status: string;
  requiredAttributesComplete: boolean;
  quantity: number;
  enforcementState?: string;
}): EligibilityResult {
  // Rule 1: Must be ACTIVE
  if (listing.status !== "ACTIVE") {
    return { isEligible: false, reason: "LISTING_NOT_ACTIVE" };
  }
  
  // Rule 2: Must have required attributes complete
  if (!listing.requiredAttributesComplete) {
    return { isEligible: false, reason: "REQUIRED_ATTRIBUTES_INCOMPLETE" };
  }
  
  // Rule 3: Must have inventory
  if (listing.quantity <= 0) {
    return { isEligible: false, reason: "OUT_OF_STOCK" };
  }
  
  // Rule 4: Must not be under enforcement
  if (listing.enforcementState && listing.enforcementState !== "CLEAR") {
    return { isEligible: false, reason: "ENFORCEMENT_BLOCK" };
  }
  
  return { isEligible: true };
}

/**
 * Compute trust multiplier for search ranking
 * Per TWICELY_RATINGS_TRUST_CANONICAL.md Section 5
 * 
 * Cap-only protection: sellers with low volume are NOT demoted
 */
export function computeTrustMultiplier(
  trustScore: number,
  completedOrders: number,
  settings: {
    minOrdersNeutralCap: number;   // default: 10
    minOrdersFullWeight: number;   // default: 50
    multipliers: Record<string, { min: number; max: number }>;
    cappedRange: { min: number; max: number };
  }
): number {
  // Get trust band
  const band = getTrustBand(trustScore);
  const bandMultiplier = settings.multipliers[band];
  
  // Cap-only protection for low-volume sellers
  if (completedOrders < settings.minOrdersNeutralCap) {
    // Below minimum threshold: locked to neutral (1.0)
    return 1.0;
  }
  
  if (completedOrders < settings.minOrdersFullWeight) {
    // Between thresholds: capped range
    const cappedMax = Math.min(bandMultiplier.max, settings.cappedRange.max);
    const cappedMin = Math.max(bandMultiplier.min, settings.cappedRange.min);
    return (cappedMin + cappedMax) / 2;
  }
  
  // Full weight: use band multiplier
  return (bandMultiplier.min + bandMultiplier.max) / 2;
}

function getTrustBand(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "WATCH";
  if (score >= 40) return "LIMITED";
  return "RESTRICTED";
}
```

---

## 4) Indexer Service

Create `packages/core/search/indexer.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { computeEligibility, computeTrustMultiplier } from "./eligibility";

const prisma = new PrismaClient();

/**
 * Default trust settings (should be loaded from TrustSettings table)
 */
const DEFAULT_TRUST_SETTINGS = {
  minOrdersNeutralCap: 10,
  minOrdersFullWeight: 50,
  multipliers: {
    EXCELLENT: { min: 1.1, max: 1.25 },
    GOOD: { min: 1.0, max: 1.1 },
    WATCH: { min: 0.9, max: 1.0 },
    LIMITED: { min: 0.7, max: 0.9 },
    RESTRICTED: { min: 0.5, max: 0.7 },
  },
  cappedRange: { min: 0.95, max: 1.05 },
};

/**
 * Upsert a listing into the search index
 */
export async function upsertListingIndex(listingId: string): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { 
      category: true,
      images: { take: 1 }
    },
  });
  
  if (!listing) {
    // Listing deleted - remove from index
    await removeFromIndex(listingId);
    return;
  }
  
  // Compute eligibility
  const eligibility = computeEligibility({
    status: listing.status,
    requiredAttributesComplete: listing.requiredAttributesComplete ?? false,
    quantity: listing.quantity,
    enforcementState: (listing as any).enforcementState,
  });
  
  // Get seller trust info
  const sellerTrust = await getSellerTrustInfo(listing.ownerUserId);
  
  // Compute trust multiplier
  const trustMultiplier = computeTrustMultiplier(
    sellerTrust.trustScore,
    sellerTrust.completedOrders,
    DEFAULT_TRUST_SETTINGS
  );
  
  // Build searchable text
  const searchableText = buildSearchableText(listing);
  
  // Build category path
  const categoryPath = listing.categoryId 
    ? await buildCategoryPath(listing.categoryId)
    : [];
  
  // Upsert to index
  await prisma.searchIndex.upsert({
    where: { listingId },
    update: {
      searchableText,
      normalizedTitle: (listing.title ?? "").toLowerCase().trim(),
      categoryPath,
      tags: listing.tags ?? [],
      brand: listing.brand,
      priceCents: listing.priceCents ?? 0,
      currency: listing.currency ?? "USD",
      condition: listing.condition,
      size: listing.size,
      color: listing.color,
      sellerId: listing.ownerUserId,
      sellerTrustScore: sellerTrust.trustScore,
      sellerCompletedOrders: sellerTrust.completedOrders,
      trustMultiplier,
      isEligible: eligibility.isEligible,
      eligibilityReason: eligibility.reason,
      listingUpdatedAt: listing.updatedAt,
      updatedAt: new Date(),
    },
    create: {
      listingId,
      searchableText,
      normalizedTitle: (listing.title ?? "").toLowerCase().trim(),
      categoryPath,
      tags: listing.tags ?? [],
      brand: listing.brand,
      priceCents: listing.priceCents ?? 0,
      currency: listing.currency ?? "USD",
      condition: listing.condition,
      size: listing.size,
      color: listing.color,
      sellerId: listing.ownerUserId,
      sellerTrustScore: sellerTrust.trustScore,
      sellerCompletedOrders: sellerTrust.completedOrders,
      trustMultiplier,
      isEligible: eligibility.isEligible,
      eligibilityReason: eligibility.reason,
      listingCreatedAt: listing.createdAt,
      listingUpdatedAt: listing.updatedAt,
    },
  });
  
  // Update index status
  await updateIndexStatus("Listing");
}

/**
 * Remove a listing from the search index
 */
export async function removeFromIndex(listingId: string): Promise<void> {
  await prisma.searchIndex.deleteMany({
    where: { listingId },
  });
}

/**
 * Rebuild entire search index (idempotent)
 */
export async function rebuildIndex(): Promise<{ indexed: number; skipped: number }> {
  await prisma.searchIndexStatus.upsert({
    where: { entityType: "Listing" },
    update: { status: "REBUILDING", updatedAt: new Date() },
    create: { entityType: "Listing", lastIndexedAt: new Date(), documentCount: 0, status: "REBUILDING" },
  });
  
  let indexed = 0;
  let skipped = 0;
  const batchSize = 100;
  let cursor: string | undefined;
  
  while (true) {
    const listings = await prisma.listing.findMany({
      take: batchSize,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });
    
    if (listings.length === 0) break;
    
    for (const listing of listings) {
      try {
        await upsertListingIndex(listing.id);
        indexed++;
      } catch (e) {
        console.error(`Failed to index listing ${listing.id}:`, e);
        skipped++;
      }
    }
    
    cursor = listings[listings.length - 1].id;
  }
  
  await prisma.searchIndexStatus.update({
    where: { entityType: "Listing" },
    data: { 
      status: "HEALTHY", 
      documentCount: indexed,
      lastIndexedAt: new Date(),
      updatedAt: new Date(),
    },
  });
  
  return { indexed, skipped };
}
```

---

## 4) Search Reindex Trigger Service (HIGH-8)

Create `packages/core/search/reindex-trigger.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { upsertListingIndex } from "./indexer";

const prisma = new PrismaClient();

export type ReindexReason = 
  | "TRUST_SCORE_CHANGE"
  | "SELLER_STATUS_CHANGE"
  | "LISTING_UPDATE"
  | "PRICE_CHANGE"
  | "INVENTORY_CHANGE";

/**
 * Queue all active listings for a seller to be reindexed
 * Used when trust score or seller status changes
 */
export async function queueSellerReindex(args: {
  sellerId: string;
  reason: ReindexReason;
  priority?: "high" | "normal" | "low";
}): Promise<{ queued: number }> {
  const listings = await prisma.listing.findMany({
    where: { ownerUserId: args.sellerId, status: "ACTIVE" },
    select: { id: true },
  });
  
  if (listings.length === 0) return { queued: 0 };
  
  // Use createMany with skipDuplicates to avoid conflicts
  await prisma.searchReindexQueue.createMany({
    data: listings.map(l => ({
      listingId: l.id,
      reason: args.reason,
      priority: args.priority ?? "normal",
      queuedAt: new Date(),
    })),
    skipDuplicates: true,
  });
  
  return { queued: listings.length };
}

/**
 * Queue a single listing for reindex
 */
export async function queueListingReindex(args: {
  listingId: string;
  reason: ReindexReason;
  priority?: "high" | "normal" | "low";
}): Promise<void> {
  await prisma.searchReindexQueue.upsert({
    where: { 
      listingId_reason_processedAt: {
        listingId: args.listingId,
        reason: args.reason,
        processedAt: null,
      },
    },
    update: {
      priority: args.priority ?? "normal",
      queuedAt: new Date(),
    },
    create: {
      listingId: args.listingId,
      reason: args.reason,
      priority: args.priority ?? "normal",
      queuedAt: new Date(),
    },
  }).catch(() => {
    // Ignore duplicate errors
  });
}

/**
 * Process the reindex queue
 * Should be run every 5 minutes via cron
 */
export async function processReindexQueue(): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Get pending items, prioritized by priority then age
  const pending = await prisma.searchReindexQueue.findMany({
    where: { processedAt: null },
    orderBy: [
      { priority: "asc" }, // high < normal < low alphabetically
      { queuedAt: "asc" },
    ],
    take: 100,
  });
  
  for (const item of pending) {
    try {
      // Reindex the listing
      await upsertListingIndex(item.listingId);
      
      // Mark as processed
      await prisma.searchReindexQueue.update({
        where: { id: item.id },
        data: { processedAt: new Date() },
      });
    } catch (error) {
      errors.push(`${item.listingId}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Mark as processed anyway to avoid infinite loop
      await prisma.searchReindexQueue.update({
        where: { id: item.id },
        data: { 
          processedAt: new Date(),
          // Store error for debugging
        },
      });
    }
  }
  
  return { processed: pending.length, errors };
}

/**
 * Called when a seller's trust score changes significantly
 */
export async function onTrustScoreChange(args: {
  sellerId: string;
  oldScore: number;
  newScore: number;
}): Promise<void> {
  const delta = Math.abs(args.newScore - args.oldScore);
  
  // Only reindex if change is significant (>5 points)
  if (delta < 5) return;
  
  await queueSellerReindex({
    sellerId: args.sellerId,
    reason: "TRUST_SCORE_CHANGE",
    priority: delta > 20 ? "high" : "normal",
  });
}

/**
 * Called when seller status changes (e.g., TOP_RATED -> GOOD)
 */
export async function onSellerStatusChange(args: {
  sellerId: string;
  oldStatus: string;
  newStatus: string;
}): Promise<void> {
  await queueSellerReindex({
    sellerId: args.sellerId,
    reason: "SELLER_STATUS_CHANGE",
    priority: "high",
  });
}

/**
 * Get queue status for monitoring
 */
export async function getReindexQueueStatus(): Promise<{
  pending: number;
  byPriority: Record<string, number>;
  oldestPending: Date | null;
}> {
  const pending = await prisma.searchReindexQueue.count({
    where: { processedAt: null },
  });
  
  const byPriority = await prisma.searchReindexQueue.groupBy({
    by: ["priority"],
    where: { processedAt: null },
    _count: true,
  });
  
  const oldest = await prisma.searchReindexQueue.findFirst({
    where: { processedAt: null },
    orderBy: { queuedAt: "asc" },
    select: { queuedAt: true },
  });
  
  return {
    pending,
    byPriority: Object.fromEntries(byPriority.map(p => [p.priority, p._count])),
    oldestPending: oldest?.queuedAt ?? null,
  };
}
```

### Schema Addition

Add to `prisma/schema.prisma`:

```prisma
model SearchReindexQueue {
  id          String    @id @default(cuid())
  listingId   String
  reason      String    // TRUST_SCORE_CHANGE|SELLER_STATUS_CHANGE|LISTING_UPDATE|etc
  priority    String    @default("normal") // high|normal|low
  queuedAt    DateTime  @default(now())
  processedAt DateTime?

  @@unique([listingId, reason, processedAt])
  @@index([processedAt, priority, queuedAt])
}

// =============================================================================
// SEARCH SETTINGS (Admin Configurable)
// =============================================================================

model SearchSettings {
  id                        String   @id @default(cuid())
  version                   String
  effectiveAt               DateTime
  isActive                  Boolean  @default(true)

  // Relevance Weights
  titleWeight               Float    @default(3.0)
  descriptionWeight         Float    @default(1.0)
  categoryWeight            Float    @default(2.0)
  attributeWeight           Float    @default(1.5)

  // Trust Integration
  trustMultiplierEnabled    Boolean  @default(true)
  trustMultiplierWeight     Float    @default(0.3)

  // Freshness Boost
  freshnessBoostEnabled     Boolean  @default(true)
  freshnessDecayDays        Int      @default(30)
  freshnessMaxBoost         Float    @default(1.2)

  // Price Normalization
  priceNormalizationEnabled Boolean  @default(false)

  // Pagination
  defaultPageSize           Int      @default(48)
  maxPageSize               Int      @default(100)

  // Filters
  enabledFilters            String[] @default(["category", "price", "condition", "shipping", "location"])

  // Synonyms
  synonymsJson              Json     @default("{}")

  // Audit
  createdByStaffId          String
  createdAt                 DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}
```

### Cron Configuration

```ts
// cron/jobs/search-reindex.ts
import { processReindexQueue } from "@/packages/core/search/reindex-trigger";

// Schedule: */5 * * * * (every 5 minutes)
export async function runReindexQueueJob() {
  const result = await processReindexQueue();
  if (result.processed > 0) {
    console.log(`[CRON] Search reindex: ${result.processed} processed, ${result.errors.length} errors`);
  }
  return result;
}
```

---

## 5) Helper functions

```ts
// Helper functions

async function getSellerTrustInfo(sellerId: string): Promise<{ trustScore: number; completedOrders: number }> {
  // Try to get from TrustSnapshot if available (Phase 6)
  const snapshot = await prisma.trustSnapshot.findFirst({
    where: { sellerId },
    orderBy: { computedAt: "desc" },
  }).catch(() => null);
  
  if (snapshot) {
    return {
      trustScore: snapshot.score,
      completedOrders: snapshot.volumeCount ?? 0,
    };
  }
  
  // Fallback: count completed orders
  const completedOrders = await prisma.order.count({
    where: { 
      sellerId,
      status: "COMPLETED",
    },
  }).catch(() => 0);
  
  return { trustScore: 80, completedOrders };
}

function buildSearchableText(listing: any): string {
  const parts = [
    listing.title ?? "",
    listing.description ?? "",
    ...(listing.tags ?? []),
    listing.brand ?? "",
  ].filter(Boolean);
  
  return parts.join(" ").toLowerCase();
}

async function buildCategoryPath(categoryId: string): Promise<string[]> {
  const path: string[] = [];
  let currentId: string | null = categoryId;
  
  while (currentId) {
    const category = await prisma.category.findUnique({
      where: { id: currentId },
      select: { id: true, parentId: true },
    });
    
    if (!category) break;
    path.unshift(category.id);
    currentId = category.parentId;
  }
  
  return path;
}

async function updateIndexStatus(entityType: string): Promise<void> {
  const count = await prisma.searchIndex.count();
  
  await prisma.searchIndexStatus.upsert({
    where: { entityType },
    update: { 
      documentCount: count,
      lastIndexedAt: new Date(),
      status: "HEALTHY",
      updatedAt: new Date(),
    },
    create: {
      entityType,
      documentCount: count,
      lastIndexedAt: new Date(),
      status: "HEALTHY",
    },
  });
}
```

---

## 5) Search Query Service

Create `packages/core/search/queryService.ts`:

```ts
import { PrismaClient, Prisma } from "@prisma/client";
import type { SearchRequest, SearchResult, SearchFilters, SortOption } from "./types";

const prisma = new PrismaClient();

/**
 * Execute a search query against the index
 */
export async function executeSearch(request: SearchRequest): Promise<SearchResult> {
  const {
    query,
    filters = {},
    sort = "best_match",
    page = 1,
    pageSize = 24,
  } = request;
  
  const safePageSize = Math.min(50, Math.max(1, pageSize));
  const safePage = Math.max(1, page);
  
  // Build where clause
  const where = buildWhereClause(query, filters);
  
  // Build order by
  const orderBy = buildOrderBy(sort);
  
  // Execute query
  const [total, results] = await Promise.all([
    prisma.searchIndex.count({ where }),
    prisma.searchIndex.findMany({
      where,
      orderBy,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ]);
  
  // Log search (async, non-blocking)
  logSearch(query, filters, sort, safePage, total).catch(() => {});
  
  return {
    total,
    page: safePage,
    pageSize: safePageSize,
    results,
  };
}

function buildWhereClause(query?: string, filters?: SearchFilters): Prisma.SearchIndexWhereInput {
  const where: Prisma.SearchIndexWhereInput = {
    isEligible: true,
  };
  
  // Text search
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    where.OR = [
      { normalizedTitle: { contains: q, mode: "insensitive" } },
      { searchableText: { contains: q, mode: "insensitive" } },
      { tags: { has: q } },
    ];
  }
  
  // Filters
  if (filters?.categoryId) {
    where.categoryPath = { has: filters.categoryId };
  }
  
  if (filters?.minPrice !== undefined) {
    where.priceCents = { ...where.priceCents as object, gte: filters.minPrice };
  }
  
  if (filters?.maxPrice !== undefined) {
    where.priceCents = { ...where.priceCents as object, lte: filters.maxPrice };
  }
  
  if (filters?.condition) {
    where.condition = filters.condition;
  }
  
  if (filters?.brand) {
    where.brand = { contains: filters.brand, mode: "insensitive" };
  }
  
  if (filters?.size) {
    where.size = filters.size;
  }
  
  if (filters?.color) {
    where.color = { contains: filters.color, mode: "insensitive" };
  }
  
  if (filters?.sellerId) {
    where.sellerId = filters.sellerId;
  }
  
  return where;
}

function buildOrderBy(sort: SortOption): Prisma.SearchIndexOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ listingCreatedAt: "desc" }];
    case "price_asc":
      return [{ priceCents: "asc" }];
    case "price_desc":
      return [{ priceCents: "desc" }];
    case "popular":
      return [{ salesCount: "desc" }, { viewCount: "desc" }];
    case "best_match":
    default:
      // Best match: trust-weighted relevance
      return [
        { trustMultiplier: "desc" },
        { salesCount: "desc" },
        { listingUpdatedAt: "desc" },
      ];
  }
}

async function logSearch(
  query: string | undefined,
  filters: SearchFilters,
  sort: string,
  page: number,
  resultCount: number
): Promise<void> {
  await prisma.searchLog.create({
    data: {
      query: query ?? "",
      resultCount,
      filters,
      sortBy: sort,
      page,
      occurredAt: new Date(),
    },
  });
}
```

---

## 6) Search API Routes

### 6.1 Search Endpoint

Create `apps/web/app/api/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { executeSearch } from "@/packages/core/search/queryService";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  
  const query = searchParams.get("q") ?? undefined;
  const categoryId = searchParams.get("category") ?? undefined;
  const sort = (searchParams.get("sort") ?? "best_match") as any;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "24");
  
  const minPrice = searchParams.get("minPrice") 
    ? Number(searchParams.get("minPrice")) 
    : undefined;
  const maxPrice = searchParams.get("maxPrice") 
    ? Number(searchParams.get("maxPrice")) 
    : undefined;
  
  const condition = searchParams.get("condition") ?? undefined;
  const brand = searchParams.get("brand") ?? undefined;
  const size = searchParams.get("size") ?? undefined;
  const color = searchParams.get("color") ?? undefined;
  
  const result = await executeSearch({
    query,
    filters: {
      categoryId,
      minPrice,
      maxPrice,
      condition,
      brand,
      size,
      color,
    },
    sort,
    page,
    pageSize,
  });
  
  return NextResponse.json(result);
}
```

### 6.2 Browse by Category

Create `apps/web/app/api/browse/[categoryId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { executeSearch } from "@/packages/core/search/queryService";

const prisma = new PrismaClient();

export async function GET(req: Request, { params }: { params: { categoryId: string } }) {
  const { searchParams } = new URL(req.url);
  const { categoryId } = params;
  
  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, slug: true },
  });
  
  if (!category) {
    return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 404 });
  }
  
  const sort = (searchParams.get("sort") ?? "best_match") as any;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "24");
  
  const result = await executeSearch({
    filters: { categoryId },
    sort,
    page,
    pageSize,
  });
  
  return NextResponse.json({
    category,
    ...result,
  });
}
```

---

## 7) Health Provider

Create `packages/core/health/providers/searchHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const searchHealthProvider: HealthProvider = {
  id: "search",
  label: "Search & Discovery",
  description: "Validates search index integrity, eligibility gates, and query functionality",
  version: "1.0.0",
  
  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;
    
    // Check 1: Index status exists
    const indexStatus = await prisma.searchIndexStatus.findUnique({
      where: { entityType: "Listing" },
    });
    
    checks.push({
      id: "search.index_status_exists",
      label: "Search index status tracking",
      status: indexStatus ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: indexStatus 
        ? `Status: ${indexStatus.status}, Documents: ${indexStatus.documentCount}`
        : "No index status found - run rebuild",
    });
    if (!indexStatus) status = HEALTH_STATUS.FAIL;
    
    // Check 2: Index not stale (updated within last hour)
    if (indexStatus) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const isStale = indexStatus.updatedAt < oneHourAgo;
      
      checks.push({
        id: "search.index_freshness",
        label: "Search index freshness",
        status: isStale ? HEALTH_STATUS.WARN : HEALTH_STATUS.PASS,
        message: isStale 
          ? `Last updated ${indexStatus.updatedAt.toISOString()}`
          : "Index is fresh",
      });
      if (isStale && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    }
    
    // Check 3: No ineligible listings in index marked eligible
    const activeListings = await prisma.listing.count({
      where: { status: "ACTIVE" },
    });
    const eligibleInIndex = await prisma.searchIndex.count({
      where: { isEligible: true },
    });
    
    const eligibilityMismatch = eligibleInIndex > activeListings;
    checks.push({
      id: "search.eligibility_integrity",
      label: "Eligibility gate integrity",
      status: eligibilityMismatch ? HEALTH_STATUS.WARN : HEALTH_STATUS.PASS,
      message: `Active listings: ${activeListings}, Eligible in index: ${eligibleInIndex}`,
    });
    if (eligibilityMismatch && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 4: Search query functional
    try {
      const testResult = await prisma.searchIndex.findMany({
        where: { isEligible: true },
        take: 1,
      });
      
      checks.push({
        id: "search.query_functional",
        label: "Search query execution",
        status: HEALTH_STATUS.PASS,
        message: "Search queries executing successfully",
      });
    } catch (e) {
      checks.push({
        id: "search.query_functional",
        label: "Search query execution",
        status: HEALTH_STATUS.FAIL,
        message: `Query failed: ${e}`,
      });
      status = HEALTH_STATUS.FAIL;
    }
    
    // Check 5: Trust multiplier populated
    const noTrustMultiplier = await prisma.searchIndex.count({
      where: { trustMultiplier: 0 },
    });
    
    checks.push({
      id: "search.trust_multiplier_populated",
      label: "Trust multiplier integration",
      status: noTrustMultiplier > 0 ? HEALTH_STATUS.WARN : HEALTH_STATUS.PASS,
      message: noTrustMultiplier > 0 
        ? `${noTrustMultiplier} listings with zero trust multiplier`
        : "All listings have trust multipliers",
    });
    if (noTrustMultiplier > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 6: Index has documents (if listings exist)
    if (activeListings > 0 && eligibleInIndex === 0) {
      checks.push({
        id: "search.index_populated",
        label: "Search index populated",
        status: HEALTH_STATUS.FAIL,
        message: "Active listings exist but none indexed",
      });
      status = HEALTH_STATUS.FAIL;
    } else {
      checks.push({
        id: "search.index_populated",
        label: "Search index populated",
        status: HEALTH_STATUS.PASS,
        message: `${eligibleInIndex} listings indexed`,
      });
    }
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS 
        ? "Search index healthy"
        : status === HEALTH_STATUS.WARN
          ? "Search index has warnings"
          : "Search index has failures",
      checks,
      meta: {
        indexedCount: eligibleInIndex,
        activeListings,
        lastIndexed: indexStatus?.lastIndexedAt?.toISOString(),
      },
    };
  },
};
```

---

## 8) Doctor Checks

Add to `scripts/twicely-doctor.ts` phase 5 section:

```ts
// ============================================================
// PHASE 5: SEARCH & DISCOVERY DOCTOR CHECKS
// ============================================================

async function runPhase5DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: Create incomplete listing - should NOT be indexed
  const incompleteListing = await prisma.listing.create({
    data: {
      title: "DOCTOR_TEST_INCOMPLETE",
      ownerUserId: "doctor_test_user",
      status: "DRAFT",
      priceCents: 1000,
      currency: "USD",
      quantity: 1,
      requiredAttributesComplete: false,
    },
  });
  
  await upsertListingIndex(incompleteListing.id);
  
  const incompleteIndexed = await prisma.searchIndex.findUnique({
    where: { listingId: incompleteListing.id },
  });
  
  results.push({
    id: "search.incomplete_not_eligible",
    label: "Incomplete listing not search-eligible",
    status: incompleteIndexed?.isEligible === false ? "PASS" : "FAIL",
    message: incompleteIndexed?.isEligible === false 
      ? "Correctly marked ineligible"
      : "ERROR: Incomplete listing marked eligible",
  });
  
  // Test 2: Activate listing - should be indexed as eligible
  await prisma.listing.update({
    where: { id: incompleteListing.id },
    data: { 
      status: "ACTIVE",
      requiredAttributesComplete: true,
    },
  });
  
  await upsertListingIndex(incompleteListing.id);
  
  const activeIndexed = await prisma.searchIndex.findUnique({
    where: { listingId: incompleteListing.id },
  });
  
  results.push({
    id: "search.active_is_eligible",
    label: "Active listing is search-eligible",
    status: activeIndexed?.isEligible === true ? "PASS" : "FAIL",
    message: activeIndexed?.isEligible === true 
      ? "Correctly marked eligible"
      : "ERROR: Active listing not marked eligible",
  });
  
  // Test 3: End listing - should be removed or marked ineligible
  await prisma.listing.update({
    where: { id: incompleteListing.id },
    data: { status: "ENDED" },
  });
  
  await upsertListingIndex(incompleteListing.id);
  
  const endedIndexed = await prisma.searchIndex.findUnique({
    where: { listingId: incompleteListing.id },
  });
  
  results.push({
    id: "search.ended_not_eligible",
    label: "Ended listing not search-eligible",
    status: !endedIndexed || endedIndexed.isEligible === false ? "PASS" : "FAIL",
    message: !endedIndexed || endedIndexed.isEligible === false
      ? "Correctly removed/marked ineligible"
      : "ERROR: Ended listing still eligible",
  });
  
  // Test 4: Verify search returns only eligible listings
  const searchResults = await executeSearch({ query: "DOCTOR_TEST", page: 1, pageSize: 10 });
  const hasIneligible = searchResults.results.some(
    r => r.listingId === incompleteListing.id && !r.isEligible
  );
  
  results.push({
    id: "search.only_eligible_returned",
    label: "Search returns only eligible listings",
    status: !hasIneligible ? "PASS" : "FAIL",
    message: !hasIneligible 
      ? "Search correctly filters ineligible"
      : "ERROR: Search returned ineligible listing",
  });
  
  // Test 5: Pagination stability (no duplicates across pages)
  const page1 = await executeSearch({ page: 1, pageSize: 5 });
  const page2 = await executeSearch({ page: 2, pageSize: 5 });
  
  const page1Ids = new Set(page1.results.map(r => r.listingId));
  const hasDuplicates = page2.results.some(r => page1Ids.has(r.listingId));
  
  results.push({
    id: "search.pagination_stable",
    label: "Pagination produces no duplicates",
    status: !hasDuplicates ? "PASS" : "FAIL",
    message: !hasDuplicates 
      ? "Pagination is stable"
      : "ERROR: Duplicate listings across pages",
  });
  
  // Test 6: Trust multiplier is bounded
  const unboundedMultiplier = await prisma.searchIndex.findFirst({
    where: {
      OR: [
        { trustMultiplier: { lt: 0 } },
        { trustMultiplier: { gt: 2 } },
      ],
    },
  });
  
  results.push({
    id: "search.trust_multiplier_bounded",
    label: "Trust multiplier within bounds (0-2)",
    status: !unboundedMultiplier ? "PASS" : "FAIL",
    message: !unboundedMultiplier 
      ? "All multipliers within bounds"
      : `ERROR: Found unbounded multiplier: ${unboundedMultiplier.trustMultiplier}`,
  });
  
  // Cleanup
  await prisma.searchIndex.deleteMany({ where: { listingId: incompleteListing.id } });
  await prisma.listing.delete({ where: { id: incompleteListing.id } });
  
  return results;
}
```

---

## 9) Index Trigger Hooks

Update listing activation endpoint (Phase 2) to trigger indexing:

```ts
// In apps/web/app/api/listings/[id]/activate/route.ts
// After successful activation:

import { upsertListingIndex } from "@/packages/core/search/indexer";

// ... after status update to ACTIVE
await upsertListingIndex(listing.id);
```

Update listing update endpoint to re-index on relevant field changes:

```ts
// In apps/web/app/api/listings/[id]/route.ts PATCH handler
// After update:

const REINDEX_FIELDS = ["title", "description", "priceCents", "status", "quantity", "categoryId", "tags", "brand"];

if (REINDEX_FIELDS.some(f => f in updateData)) {
  await upsertListingIndex(listing.id);
}
```

---

## 10) Corp Admin UI

### 10.1 Index Status Page

Create `apps/web/app/(platform)/corp/search/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SearchAdminPage() {
  const [status, setStatus] = useState<any>(null);
  const [rebuilding, setRebuilding] = useState(false);
  
  useEffect(() => {
    fetchStatus();
  }, []);
  
  async function fetchStatus() {
    const res = await fetch("/api/platform/search/status");
    const data = await res.json();
    setStatus(data);
  }
  
  async function triggerRebuild() {
    setRebuilding(true);
    await fetch("/api/platform/search/rebuild", { method: "POST" });
    await fetchStatus();
    setRebuilding(false);
  }
  
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Search Index Status</h1>
      
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Index Health
              <Badge variant={status.status === "HEALTHY" ? "default" : "destructive"}>
                {status.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Documents indexed: {status.documentCount}</p>
            <p>Last indexed: {new Date(status.lastIndexedAt).toLocaleString()}</p>
            <p>Pending: {status.pendingCount}</p>
            
            <Button onClick={triggerRebuild} disabled={rebuilding}>
              {rebuilding ? "Rebuilding..." : "Rebuild Index"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## 11) Phase 5 Completion Criteria

- [ ] SearchIndex model migrated
- [ ] SearchIndexStatus model migrated
- **SearchSettings** seeded with defaults
- Admin UI at `/corp/settings/search`
- [ ] SearchLog model migrated
- [ ] Eligibility computer function works
- [ ] Trust multiplier computation with cap-only protection
- [ ] Indexer upserts listings correctly
- [ ] Search endpoint returns eligible listings only
- [ ] Browse by category works
- [ ] Sorting works (newest, price_asc, price_desc, best_match)
- [ ] Ineligible listings never appear in search results
- [ ] Pagination is stable (no duplicates)
- [ ] Health provider registered and passing
- [ ] Doctor passes all Phase 5 checks
- [ ] Index status page visible in Corp Admin

---

## 12) Migration Checklist

1. Run migration: `npx prisma migrate dev --name search_phase5`
2. Deploy indexer code
3. Rebuild index: `npx ts-node scripts/rebuild-search-index.ts`
4. Verify health provider passes
5. Run Doctor checks
6. Enable search API routes

---

## 13) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 5 implementation |
| 1.1 | 2026-01-20 | HIGH-8: Search reindex trigger service |
| 1.2 | 2026-01-20 | Added SearchSettings (Compliance Fix) |
