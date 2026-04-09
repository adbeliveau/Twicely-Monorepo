# TWICELY V2 - Install Phase 17: Search Ranking Pipeline
**Status:** LOCKED (v1.0)  
**Backend-first:** Signals  ->  Ranker  ->  API integration  ->  Health  ->  UI  ->  Doctor  
**Canonicals:** TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md, TWICELY_RATINGS_TRUST_CANONICAL.md

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_17_SEARCH_RANKING_PIPELINE.md`  
> Prereq: Phase 16 complete.

---

## 0) What this phase installs

### Backend
- Deterministic ranking pipeline for SearchIndex
- Trust gating (hard gate restricted sellers)
- Cap-only protection for new sellers
- Freshness scoring
- Price normalization
- Relevance scoring (text match)
- Promoted listing boost
- Ranking explanation trace (debug)
- Search analytics tracking

### UI (Corp)
- Search debug page (score breakdown)
- Ranking configuration editor

### Ops
- Health provider: `search_ranking`
- Doctor checks: determinism, trust gating, cap-only protection

---

## 1) Prisma Schema

```prisma
// =============================================================================
// SEARCH RANKING
// =============================================================================

model SearchRankTrace {
  id              String   @id @default(cuid())
  queryKey        String   // Hash of query params
  queryText       String?
  listingId       String
  
  // Final score
  finalScore      Float
  
  // Score components
  relevanceScore  Float
  freshnessScore  Float
  priceScore      Float
  trustMultiplier Float
  promoBoost      Float
  
  // Seller context
  sellerId        String
  sellerTrustScore Float
  sellerTrustBand String
  sellerOrderCount Int
  
  // Debug info
  components      Json     @default("{}")
  
  createdAt       DateTime @default(now())

  @@index([queryKey, createdAt])
  @@index([listingId, createdAt])
  @@index([sellerId, createdAt])
}

model SearchQuery {
  id              String   @id @default(cuid())
  
  // Query details
  queryText       String?
  queryHash       String
  filters         Json     @default("{}")
  
  // User context
  userId          String?
  sessionId       String?
  
  // Results
  resultCount     Int
  pageNumber      Int      @default(1)
  
  // Performance
  latencyMs       Int?
  
  // Tracking
  clickedListingId String?
  clickedAt       DateTime?
  purchasedListingId String?
  purchasedAt     DateTime?
  
  createdAt       DateTime @default(now())

  @@index([queryHash, createdAt])
  @@index([userId, createdAt])
  @@index([queryText, createdAt])
}

model SearchRankingConfig {
  id              String   @id @default(cuid())
  version         String   @unique
  
  effectiveAt     DateTime
  isActive        Boolean  @default(true)
  
  // Weights
  relevanceWeight Float    @default(1.0)
  freshnessWeight Float    @default(0.1)
  priceWeight     Float    @default(0.05)
  trustWeight     Float    @default(0.3)
  
  // Freshness decay
  freshnessHalfLifeDays Int @default(30)
  freshnessMinScore Float  @default(0.85)
  
  // Promo boost
  promoBoostMax   Float    @default(1.5)
  
  // Trust settings
  trustConfigJson Json     @default("{}")
  
  createdByStaffId String
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([isActive, effectiveAt])
}

// Add to SearchIndex (if not already present from Phase 5)
// Ensure these fields exist:
// - sellerTrustScore Float
// - sellerTrustBand String
// - sellerCompletedOrdersWindow Int
// - promoBoostRate Float?
// - isPromoted Boolean @default(false)
```

Run migration:
```bash
npx prisma migrate dev --name search_ranking_phase17
```

---

## 2) Ranking Types

Create `packages/core/search/types.ts`:

```ts
export type TrustBand = "EXCELLENT" | "GOOD" | "WATCH" | "LIMITED" | "RESTRICTED";

export type TrustContext = {
  band: TrustBand;
  completedOrdersInWindow: number;
  trustScore: number;
};

export type TrustSettings = {
  minOrdersNeutralCap: number;      // 10 - below this, multiplier = 1.0
  minOrdersFullWeight: number;      // 50 - at/above this, full band multiplier
  restrictedHardGateScore: number;  // 40 - below this, excluded from search
  multipliers: Record<TrustBand, { min: number; max: number }>;
  cappedRange: { between10And49: { min: number; max: number } };
};

export type RankSignals = {
  relevance: number;       // 0-1 query match score
  freshnessDays: number;   // days since listing created/updated
  priceScore: number;      // 0-1 normalized price score
  trustMultiplier: number; // 0.5-1.5 based on trust band
  promoBoost: number;      // 1.0 or higher if promoted
};

export type RankConfig = {
  relevanceWeight: number;
  freshnessWeight: number;
  priceWeight: number;
  trustWeight: number;
  freshnessHalfLifeDays: number;
  freshnessMinScore: number;
  promoBoostMax: number;
};

export type RankResult = {
  listingId: string;
  finalScore: number;
  components: {
    relevance: number;
    freshness: number;
    price: number;
    trust: number;
    promo: number;
  };
};

export const DEFAULT_TRUST_SETTINGS: TrustSettings = {
  minOrdersNeutralCap: 10,
  minOrdersFullWeight: 50,
  restrictedHardGateScore: 40,
  multipliers: {
    EXCELLENT: { min: 1.1, max: 1.3 },
    GOOD: { min: 1.0, max: 1.1 },
    WATCH: { min: 0.9, max: 1.0 },
    LIMITED: { min: 0.7, max: 0.9 },
    RESTRICTED: { min: 0.0, max: 0.5 },
  },
  cappedRange: { between10And49: { min: 0.95, max: 1.05 } },
};

export const DEFAULT_RANK_CONFIG: RankConfig = {
  relevanceWeight: 1.0,
  freshnessWeight: 0.1,
  priceWeight: 0.05,
  trustWeight: 0.3,
  freshnessHalfLifeDays: 30,
  freshnessMinScore: 0.85,
  promoBoostMax: 1.5,
};
```

---

## 3) Trust Multiplier Service

Create `packages/core/search/trustMultiplier.ts`:

```ts
import type { TrustBand, TrustContext, TrustSettings } from "./types";
import { DEFAULT_TRUST_SETTINGS } from "./types";

/**
 * Determine trust band from score
 */
export function getTrustBand(trustScore: number): TrustBand {
  if (trustScore >= 90) return "EXCELLENT";
  if (trustScore >= 75) return "GOOD";
  if (trustScore >= 60) return "WATCH";
  if (trustScore >= 40) return "LIMITED";
  return "RESTRICTED";
}

/**
 * Check if seller is eligible for search inclusion
 * Hard gate: RESTRICTED sellers and those below threshold are excluded
 */
export function isSellerSearchEligible(args: {
  trustScore: number;
  band: TrustBand;
  settings?: TrustSettings;
  hasHardRiskFlag?: boolean;
  enforcementState?: string;
}): boolean {
  const settings = args.settings ?? DEFAULT_TRUST_SETTINGS;

  // Hard risk flag = immediate exclusion
  if (args.hasHardRiskFlag) return false;

  // RESTRICTED band = excluded
  if (args.band === "RESTRICTED") return false;

  // Below hard gate score = excluded
  if (args.trustScore < settings.restrictedHardGateScore) return false;

  // Enforcement state check
  if (args.enforcementState === "HARD") return false;

  return true;
}

/**
 * Compute trust multiplier for ranking
 * Cap-only protection: new sellers (< minOrdersNeutralCap) get multiplier = 1.0
 */
export function computeTrustMultiplier(
  ctx: TrustContext,
  settings?: TrustSettings
): number {
  const s = settings ?? DEFAULT_TRUST_SETTINGS;
  const n = ctx.completedOrdersInWindow;

  // Cap-only protection for new sellers
  if (n < s.minOrdersNeutralCap) {
    return 1.0;
  }

  // Transitional range (10-49 orders): use capped range
  if (n < s.minOrdersFullWeight) {
    const range = s.cappedRange.between10And49;
    // Linear interpolation based on trust score within capped range
    const t = (ctx.trustScore - 40) / 60; // Normalize 40-100 to 0-1
    return range.min + t * (range.max - range.min);
  }

  // Full weight: use band multiplier
  const m = s.multipliers[ctx.band];
  // Use midpoint of range
  return (m.min + m.max) / 2;
}

/**
 * Get multiplier explanation for debugging
 */
export function explainTrustMultiplier(
  ctx: TrustContext,
  settings?: TrustSettings
): { multiplier: number; reason: string } {
  const s = settings ?? DEFAULT_TRUST_SETTINGS;
  const n = ctx.completedOrdersInWindow;
  const multiplier = computeTrustMultiplier(ctx, settings);

  if (n < s.minOrdersNeutralCap) {
    return {
      multiplier,
      reason: `New seller protection: ${n} orders < ${s.minOrdersNeutralCap} threshold`,
    };
  }

  if (n < s.minOrdersFullWeight) {
    return {
      multiplier,
      reason: `Transitional range: ${n} orders, capped multiplier`,
    };
  }

  return {
    multiplier,
    reason: `Full weight: ${ctx.band} band with ${n} orders`,
  };
}
```

---

## 4) Relevance Scoring

Create `packages/core/search/relevance.ts`:

```ts
/**
 * Compute relevance score based on text matching
 * Simple TF-IDF-like scoring for v1
 */
export function computeRelevanceScore(args: {
  query: string;
  title: string;
  description?: string;
  categoryName?: string;
  tags?: string[];
}): number {
  if (!args.query || args.query.trim() === "") {
    // No query = browse mode, all items equally relevant
    return 1.0;
  }

  const queryTerms = args.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (queryTerms.length === 0) return 1.0;

  const title = args.title.toLowerCase();
  const description = (args.description ?? "").toLowerCase();
  const category = (args.categoryName ?? "").toLowerCase();
  const tags = (args.tags ?? []).map((t) => t.toLowerCase()).join(" ");

  let score = 0;
  let maxScore = queryTerms.length * 4; // Max possible score

  for (const term of queryTerms) {
    // Title match (highest weight)
    if (title.includes(term)) {
      score += 4;
      // Exact title start bonus
      if (title.startsWith(term)) score += 2;
    }
    // Category match (high weight)
    else if (category.includes(term)) {
      score += 3;
    }
    // Tags match (medium weight)
    else if (tags.includes(term)) {
      score += 2;
    }
    // Description match (lower weight)
    else if (description.includes(term)) {
      score += 1;
    }
  }

  // Normalize to 0-1 range
  return Math.min(1.0, score / maxScore);
}

/**
 * Compute query match quality for ranking explanation
 */
export function explainRelevance(args: {
  query: string;
  title: string;
  description?: string;
}): { score: number; matches: string[] } {
  const queryTerms = args.query.toLowerCase().split(/\s+/).filter(Boolean);
  const title = args.title.toLowerCase();
  const description = (args.description ?? "").toLowerCase();

  const matches: string[] = [];

  for (const term of queryTerms) {
    if (title.includes(term)) {
      matches.push(`title:${term}`);
    }
    if (description.includes(term)) {
      matches.push(`desc:${term}`);
    }
  }

  return {
    score: computeRelevanceScore({ query: args.query, title: args.title, description: args.description }),
    matches,
  };
}
```

---

## 5) Freshness Scoring

Create `packages/core/search/freshness.ts`:

```ts
import type { RankConfig } from "./types";
import { DEFAULT_RANK_CONFIG } from "./types";

/**
 * Compute freshness score with exponential decay
 * Newer listings score higher, but never below minimum
 */
export function computeFreshnessScore(
  daysSinceCreation: number,
  config?: RankConfig
): number {
  const c = config ?? DEFAULT_RANK_CONFIG;

  // Exponential decay with half-life
  const decayFactor = Math.pow(0.5, daysSinceCreation / c.freshnessHalfLifeDays);

  // Clamp to minimum
  return Math.max(c.freshnessMinScore, decayFactor);
}

/**
 * Compute days since a date
 */
export function daysSince(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

/**
 * Get freshness explanation
 */
export function explainFreshness(
  daysSinceCreation: number,
  config?: RankConfig
): { score: number; label: string } {
  const score = computeFreshnessScore(daysSinceCreation, config);

  let label: string;
  if (daysSinceCreation < 1) {
    label = "Just listed";
  } else if (daysSinceCreation < 7) {
    label = "New this week";
  } else if (daysSinceCreation < 30) {
    label = "Listed this month";
  } else if (daysSinceCreation < 90) {
    label = "Listed recently";
  } else {
    label = "Established listing";
  }

  return { score, label };
}
```

---

## 6) Price Scoring

Create `packages/core/search/price.ts`:

```ts
/**
 * Compute price score (v1 simple)
 * Future: normalize within category price distribution
 */
export function computePriceScore(priceCents: number): number {
  // v1: All valid prices get neutral score
  // Invalid/zero prices get slight penalty
  if (priceCents <= 0) return 0.9;
  return 1.0;
}

/**
 * Compute price score with category context (v2)
 */
export function computePriceScoreWithCategory(args: {
  priceCents: number;
  categoryMedianCents?: number;
  categoryMinCents?: number;
  categoryMaxCents?: number;
}): number {
  if (args.priceCents <= 0) return 0.9;

  // Without category context, use simple scoring
  if (!args.categoryMedianCents) {
    return 1.0;
  }

  // Slight boost for prices near median (perceived fair value)
  const ratio = args.priceCents / args.categoryMedianCents;

  if (ratio >= 0.7 && ratio <= 1.3) {
    // Near median = good
    return 1.0;
  } else if (ratio < 0.5) {
    // Very cheap = slight boost (bargain)
    return 1.05;
  } else if (ratio > 2.0) {
    // Very expensive = slight penalty
    return 0.95;
  }

  return 1.0;
}
```

---

## 7) Ranking Engine

Create `packages/core/search/rankingEngine.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { RankSignals, RankConfig, RankResult, TrustSettings, TrustContext } from "./types";
import { DEFAULT_RANK_CONFIG, DEFAULT_TRUST_SETTINGS } from "./types";
import { computeTrustMultiplier, getTrustBand, isSellerSearchEligible } from "./trustMultiplier";
import { computeRelevanceScore } from "./relevance";
import { computeFreshnessScore, daysSince } from "./freshness";
import { computePriceScore } from "./price";

const prisma = new PrismaClient();

export type RankingCandidate = {
  listingId: string;
  sellerId: string;
  title: string;
  description?: string;
  categoryName?: string;
  tags?: string[];
  priceCents: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  sellerTrustScore: number;
  sellerCompletedOrdersWindow: number;
  isPromoted: boolean;
  promoBoostRate?: number;
  enforcementState?: string;
};

/**
 * Compute final ranking score for a candidate
 */
export function computeRankScore(
  candidate: RankingCandidate,
  query: string,
  config?: RankConfig,
  trustSettings?: TrustSettings
): RankResult | null {
  const c = config ?? DEFAULT_RANK_CONFIG;
  const ts = trustSettings ?? DEFAULT_TRUST_SETTINGS;

  // Get trust context
  const trustBand = getTrustBand(candidate.sellerTrustScore);
  const trustCtx: TrustContext = {
    band: trustBand,
    completedOrdersInWindow: candidate.sellerCompletedOrdersWindow,
    trustScore: candidate.sellerTrustScore,
  };

  // Check eligibility (hard gate)
  if (!isSellerSearchEligible({
    trustScore: candidate.sellerTrustScore,
    band: trustBand,
    settings: ts,
    enforcementState: candidate.enforcementState,
  })) {
    return null; // Excluded from search
  }

  // Compute individual signals
  const relevance = computeRelevanceScore({
    query,
    title: candidate.title,
    description: candidate.description,
    categoryName: candidate.categoryName,
    tags: candidate.tags,
  });

  const freshnessDays = daysSince(candidate.updatedAt || candidate.createdAt);
  const freshness = computeFreshnessScore(freshnessDays, c);

  const price = computePriceScore(candidate.priceCents);

  const trustMultiplier = computeTrustMultiplier(trustCtx, ts);

  // Promo boost (capped)
  let promoBoost = 1.0;
  if (candidate.isPromoted && candidate.promoBoostRate) {
    promoBoost = Math.min(c.promoBoostMax, 1 + candidate.promoBoostRate);
  }

  // Weighted combination
  const baseScore =
    relevance * c.relevanceWeight +
    freshness * c.freshnessWeight +
    price * c.priceWeight;

  // Apply trust multiplier and promo boost
  const finalScore = baseScore * trustMultiplier * promoBoost;

  return {
    listingId: candidate.listingId,
    finalScore,
    components: {
      relevance,
      freshness,
      price,
      trust: trustMultiplier,
      promo: promoBoost,
    },
  };
}

/**
 * Rank a list of candidates
 * Returns sorted results with deterministic tie-breaking
 */
export function rankCandidates(
  candidates: RankingCandidate[],
  query: string,
  config?: RankConfig,
  trustSettings?: TrustSettings
): RankResult[] {
  const results: RankResult[] = [];

  for (const candidate of candidates) {
    const result = computeRankScore(candidate, query, config, trustSettings);
    if (result) {
      results.push(result);
    }
  }

  // Sort by score descending, with deterministic tie-breaking
  results.sort((a, b) => {
    // Primary: score descending
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    // Tie-breaker: listingId ascending (deterministic)
    return a.listingId.localeCompare(b.listingId);
  });

  return results;
}

/**
 * Get current ranking config
 */
export async function getCurrentRankingConfig(): Promise<RankConfig> {
  const config = await prisma.searchRankingConfig.findFirst({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });

  if (!config) {
    return DEFAULT_RANK_CONFIG;
  }

  return {
    relevanceWeight: config.relevanceWeight,
    freshnessWeight: config.freshnessWeight,
    priceWeight: config.priceWeight,
    trustWeight: config.trustWeight,
    freshnessHalfLifeDays: config.freshnessHalfLifeDays,
    freshnessMinScore: config.freshnessMinScore,
    promoBoostMax: config.promoBoostMax,
  };
}
```

---

## 8) Search Index Refresh

Create `packages/core/search/indexRefresh.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { getTrustBand } from "./trustMultiplier";

const prisma = new PrismaClient();

/**
 * Reindex a seller's listings with updated trust data
 * Called when TrustSnapshot is updated
 */
export async function reindexSellerTrust(sellerId: string): Promise<number> {
  const snapshot = await prisma.trustSnapshot.findUnique({
    where: { sellerId },
  });

  if (!snapshot) {
    return 0;
  }

  const band = getTrustBand(snapshot.score);

  const result = await prisma.searchIndex.updateMany({
    where: { sellerId },
    data: {
      sellerTrustScore: snapshot.score,
      sellerTrustBand: band,
      sellerCompletedOrdersWindow: snapshot.completedOrdersWindow ?? 0,
    },
  });

  return result.count;
}

/**
 * Reindex a single listing
 */
export async function reindexListing(listingId: string): Promise<void> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { category: true },
  });

  if (!listing || listing.status !== "ACTIVE") {
    // Remove from index if not active
    await prisma.searchIndex.deleteMany({
      where: { listingId },
    });
    return;
  }

  // Get seller trust data
  const snapshot = await prisma.trustSnapshot.findUnique({
    where: { sellerId: listing.ownerUserId },
  });

  const trustScore = snapshot?.score ?? 70;
  const trustBand = getTrustBand(trustScore);
  const ordersWindow = snapshot?.completedOrdersWindow ?? 0;

  await prisma.searchIndex.upsert({
    where: { listingId },
    update: {
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents ?? 0,
      categoryId: listing.categoryId,
      categoryName: listing.category?.name,
      sellerId: listing.ownerUserId,
      sellerTrustScore: trustScore,
      sellerTrustBand: trustBand,
      sellerCompletedOrdersWindow: ordersWindow,
      isEligible: listing.enforcementState !== "HARD",
      updatedAt: new Date(),
    },
    create: {
      listingId,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents ?? 0,
      categoryId: listing.categoryId,
      categoryName: listing.category?.name,
      sellerId: listing.ownerUserId,
      sellerTrustScore: trustScore,
      sellerTrustBand: trustBand,
      sellerCompletedOrdersWindow: ordersWindow,
      isEligible: listing.enforcementState !== "HARD",
    },
  });
}

/**
 * Full reindex job (for cron/maintenance)
 */
export async function fullReindex(): Promise<{ indexed: number; removed: number }> {
  // Get all active listings
  const activeListings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const activeIds = new Set(activeListings.map((l) => l.id));

  // Remove stale index entries
  const stale = await prisma.searchIndex.findMany({
    where: { listingId: { notIn: Array.from(activeIds) } },
    select: { listingId: true },
  });

  await prisma.searchIndex.deleteMany({
    where: { listingId: { in: stale.map((s) => s.listingId) } },
  });

  // Reindex all active listings
  for (const listing of activeListings) {
    await reindexListing(listing.id);
  }

  return { indexed: activeListings.length, removed: stale.length };
}
```

---

## 9) Search API Integration

Create `apps/web/app/api/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { rankCandidates, getCurrentRankingConfig } from "@/packages/core/search/rankingEngine";
import type { RankingCandidate } from "@/packages/core/search/rankingEngine";
import { DEFAULT_TRUST_SETTINGS } from "@/packages/core/search/types";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("category");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const sortBy = searchParams.get("sort") ?? "best_match";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "48"), 100);

  const startTime = Date.now();

  // Build filters
  const where: any = { isEligible: true };
  if (categoryId) where.categoryId = categoryId;
  if (minPrice) where.priceCents = { ...where.priceCents, gte: parseInt(minPrice) };
  if (maxPrice) where.priceCents = { ...where.priceCents, lte: parseInt(maxPrice) };

  // Fetch candidates
  const candidates = await prisma.searchIndex.findMany({
    where,
    take: 500, // Cap candidates for ranking
  });

  // Get ranking config
  const rankConfig = await getCurrentRankingConfig();

  // Convert to ranking candidates
  const rankingCandidates: RankingCandidate[] = candidates.map((c) => ({
    listingId: c.listingId,
    sellerId: c.sellerId,
    title: c.title,
    description: c.description ?? undefined,
    categoryName: c.categoryName ?? undefined,
    priceCents: c.priceCents,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    sellerTrustScore: c.sellerTrustScore ?? 70,
    sellerCompletedOrdersWindow: c.sellerCompletedOrdersWindow ?? 0,
    isPromoted: c.isPromoted ?? false,
    promoBoostRate: c.promoBoostRate ?? undefined,
    enforcementState: c.enforcementState ?? undefined,
  }));

  // Rank candidates
  let results = rankCandidates(rankingCandidates, query, rankConfig, DEFAULT_TRUST_SETTINGS);

  // Apply sort override if not best_match
  if (sortBy === "price_asc") {
    results.sort((a, b) => {
      const priceA = candidates.find((c) => c.listingId === a.listingId)?.priceCents ?? 0;
      const priceB = candidates.find((c) => c.listingId === b.listingId)?.priceCents ?? 0;
      return priceA - priceB;
    });
  } else if (sortBy === "price_desc") {
    results.sort((a, b) => {
      const priceA = candidates.find((c) => c.listingId === a.listingId)?.priceCents ?? 0;
      const priceB = candidates.find((c) => c.listingId === b.listingId)?.priceCents ?? 0;
      return priceB - priceA;
    });
  } else if (sortBy === "newest") {
    results.sort((a, b) => {
      const dateA = candidates.find((c) => c.listingId === a.listingId)?.createdAt ?? new Date(0);
      const dateB = candidates.find((c) => c.listingId === b.listingId)?.createdAt ?? new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }

  // Paginate
  const total = results.length;
  const offset = (page - 1) * limit;
  const pagedResults = results.slice(offset, offset + limit);

  // Get listing details for response
  const listingIds = pagedResults.map((r) => r.listingId);
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    select: {
      id: true,
      title: true,
      priceCents: true,
      currency: true,
      imageUrls: true,
      status: true,
      ownerUserId: true,
    },
  });

  // Preserve ranking order
  const listingsMap = new Map(listings.map((l) => [l.id, l]));
  const orderedListings = listingIds.map((id) => listingsMap.get(id)).filter(Boolean);

  const latencyMs = Date.now() - startTime;

  // Log search query for analytics
  const queryHash = crypto.createHash("md5").update(JSON.stringify({ query, categoryId, minPrice, maxPrice })).digest("hex");
  await prisma.searchQuery.create({
    data: {
      queryText: query || null,
      queryHash,
      filters: { categoryId, minPrice, maxPrice },
      resultCount: total,
      pageNumber: page,
      latencyMs,
    },
  });

  // Phase 37 Integration: Add seller trust labels to search results
  const { getBuyerTrustLabels } = await import("@/packages/core/seller-standards/trustLabelService");
  const sellerIds = [...new Set(orderedListings.map((l: any) => l.ownerUserId))];
  const trustLabels = await getBuyerTrustLabels(sellerIds);

  // Add trust label to each listing
  const resultsWithLabels = orderedListings.map((listing: any) => ({
    ...listing,
    sellerTrustLabel: trustLabels.get(listing.ownerUserId),
  }));

  return NextResponse.json({
    results: resultsWithLabels,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    meta: {
      query,
      sortBy,
      latencyMs,
    },
  });
}
```

---

## 10) Corp Search Debug API

Create `apps/web/app/api/platform/search/debug/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { computeRankScore, getCurrentRankingConfig } from "@/packages/core/search/rankingEngine";
import { DEFAULT_TRUST_SETTINGS } from "@/packages/core/search/types";
import { explainTrustMultiplier, getTrustBand } from "@/packages/core/search/trustMultiplier";
import { explainRelevance } from "@/packages/core/search/relevance";
import { explainFreshness, daysSince } from "@/packages/core/search/freshness";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "search.debug");

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  const query = searchParams.get("q") ?? "";

  if (!listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  const indexed = await prisma.searchIndex.findUnique({
    where: { listingId },
  });

  if (!indexed) {
    return NextResponse.json({ error: "Listing not in search index" }, { status: 404 });
  }

  const config = await getCurrentRankingConfig();

  const candidate = {
    listingId: indexed.listingId,
    sellerId: indexed.sellerId,
    title: indexed.title,
    description: indexed.description ?? undefined,
    categoryName: indexed.categoryName ?? undefined,
    priceCents: indexed.priceCents,
    createdAt: indexed.createdAt,
    updatedAt: indexed.updatedAt,
    sellerTrustScore: indexed.sellerTrustScore ?? 70,
    sellerCompletedOrdersWindow: indexed.sellerCompletedOrdersWindow ?? 0,
    isPromoted: indexed.isPromoted ?? false,
    promoBoostRate: indexed.promoBoostRate ?? undefined,
    enforcementState: indexed.enforcementState ?? undefined,
  };

  const result = computeRankScore(candidate, query, config, DEFAULT_TRUST_SETTINGS);

  const trustBand = getTrustBand(candidate.sellerTrustScore);
  const trustExplain = explainTrustMultiplier(
    { band: trustBand, completedOrdersInWindow: candidate.sellerCompletedOrdersWindow, trustScore: candidate.sellerTrustScore },
    DEFAULT_TRUST_SETTINGS
  );

  const relevanceExplain = explainRelevance({ query, title: candidate.title, description: candidate.description });
  const freshnessExplain = explainFreshness(daysSince(candidate.updatedAt || candidate.createdAt), config);

  return NextResponse.json({
    listingId,
    query,
    result,
    explanation: {
      trust: trustExplain,
      relevance: relevanceExplain,
      freshness: freshnessExplain,
      seller: {
        trustScore: candidate.sellerTrustScore,
        trustBand,
        ordersInWindow: candidate.sellerCompletedOrdersWindow,
      },
      config,
    },
  });
}
```

---

## 11) Health Provider

Create `packages/core/health/providers/searchRankingHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";
import { rankCandidates } from "../search/rankingEngine";
import { DEFAULT_RANK_CONFIG, DEFAULT_TRUST_SETTINGS } from "../search/types";

const prisma = new PrismaClient();

export const searchRankingHealthProvider: HealthProvider = {
  id: "search_ranking",
  label: "Search Ranking",
  description: "Validates ranking determinism and trust gating",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: Ranking config exists
    const config = await prisma.searchRankingConfig.findFirst({
      where: { isActive: true },
    });
    checks.push({
      id: "ranking.config_exists",
      label: "Ranking config exists",
      status: config ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: config ? `v${config.version}` : "Using defaults",
    });

    // Check 2: Ranking is deterministic
    const testCandidates = [
      { listingId: "test1", sellerId: "s1", title: "Test A", priceCents: 1000, createdAt: new Date(), updatedAt: new Date(), sellerTrustScore: 80, sellerCompletedOrdersWindow: 100, isPromoted: false },
      { listingId: "test2", sellerId: "s2", title: "Test B", priceCents: 2000, createdAt: new Date(), updatedAt: new Date(), sellerTrustScore: 90, sellerCompletedOrdersWindow: 100, isPromoted: false },
    ];

    const results1 = rankCandidates(testCandidates as any, "test", DEFAULT_RANK_CONFIG, DEFAULT_TRUST_SETTINGS);
    const results2 = rankCandidates(testCandidates as any, "test", DEFAULT_RANK_CONFIG, DEFAULT_TRUST_SETTINGS);

    const orderMatch = results1.map((r) => r.listingId).join(",") === results2.map((r) => r.listingId).join(",");
    checks.push({
      id: "ranking.deterministic",
      label: "Ranking is deterministic",
      status: orderMatch ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: orderMatch ? "Same inputs = same order" : "Non-deterministic!",
    });
    if (!orderMatch) status = HEALTH_STATUS.FAIL;

    // Check 3: Restricted sellers excluded
    const restrictedCandidate = [
      { listingId: "restricted", sellerId: "sr", title: "Test", priceCents: 1000, createdAt: new Date(), updatedAt: new Date(), sellerTrustScore: 30, sellerCompletedOrdersWindow: 100, isPromoted: false },
    ];
    const restrictedResults = rankCandidates(restrictedCandidate as any, "test", DEFAULT_RANK_CONFIG, DEFAULT_TRUST_SETTINGS);
    checks.push({
      id: "ranking.restricted_excluded",
      label: "Restricted sellers excluded",
      status: restrictedResults.length === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: restrictedResults.length === 0 ? "Excluded" : "NOT excluded!",
    });
    if (restrictedResults.length > 0) status = HEALTH_STATUS.FAIL;

    // Check 4: Index coverage
    const activeListings = await prisma.listing.count({ where: { status: "ACTIVE" } });
    const indexedListings = await prisma.searchIndex.count({ where: { isEligible: true } });
    const coverage = activeListings > 0 ? Math.round((indexedListings / activeListings) * 100) : 100;
    checks.push({
      id: "ranking.index_coverage",
      label: "Index coverage",
      status: coverage >= 90 ? HEALTH_STATUS.PASS : coverage >= 70 ? HEALTH_STATUS.WARN : HEALTH_STATUS.FAIL,
      message: `${coverage}% (${indexedListings}/${activeListings})`,
    });

    return {
      providerId: "search_ranking",
      status,
      summary: status === HEALTH_STATUS.PASS ? "Search ranking healthy" : "Issues detected",
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

## 12) Doctor Checks

```ts
async function checkSearchRanking() {
  const checks = [];

  // 1. Deterministic ranking
  const candidates = [
    { listingId: "a", sellerId: "s1", title: "Widget", priceCents: 1000, createdAt: new Date(), updatedAt: new Date(), sellerTrustScore: 85, sellerCompletedOrdersWindow: 60, isPromoted: false },
    { listingId: "b", sellerId: "s2", title: "Widget Pro", priceCents: 1500, createdAt: new Date(), updatedAt: new Date(), sellerTrustScore: 75, sellerCompletedOrdersWindow: 60, isPromoted: false },
  ];

  const r1 = rankCandidates(candidates as any, "widget");
  const r2 = rankCandidates(candidates as any, "widget");
  checks.push({
    key: "ranking.deterministic",
    ok: JSON.stringify(r1) === JSON.stringify(r2),
    details: "Same query returns same order",
  });

  // 2. Trust gating excludes RESTRICTED
  const restricted = [{ ...candidates[0], listingId: "r", sellerTrustScore: 30 }];
  const rr = rankCandidates(restricted as any, "widget");
  checks.push({
    key: "ranking.trust_gating",
    ok: rr.length === 0,
    details: rr.length === 0 ? "RESTRICTED excluded" : "RESTRICTED NOT excluded",
  });

  // 3. Cap-only protection
  const newSeller = [{ ...candidates[0], listingId: "n", sellerTrustScore: 50, sellerCompletedOrdersWindow: 5 }];
  const nr = rankCandidates(newSeller as any, "widget");
  checks.push({
    key: "ranking.cap_only",
    ok: nr.length === 1 && nr[0].components.trust === 1.0,
    details: nr.length === 1 ? `Multiplier: ${nr[0].components.trust}` : "Not returned",
  });

  // 4. Trust multiplier affects order
  const highTrust = { ...candidates[0], listingId: "h", sellerTrustScore: 95, sellerCompletedOrdersWindow: 100 };
  const lowTrust = { ...candidates[0], listingId: "l", sellerTrustScore: 65, sellerCompletedOrdersWindow: 100 };
  const tr = rankCandidates([highTrust, lowTrust] as any, "widget");
  checks.push({
    key: "ranking.trust_reorders",
    ok: tr[0].listingId === "h",
    details: tr[0].listingId === "h" ? "High trust ranks first" : "Trust not affecting order",
  });

  return checks;
}
```

---

## 13) Phase 17 Completion Criteria

- Deterministic ranking pipeline
- Trust gating excludes RESTRICTED sellers
- Cap-only protection for new sellers (< 10 orders)
- Freshness scoring with decay
- Price normalization
- Promo boost support
- Search index refresh on trust updates
- Corp debug endpoint
- Health provider passes
- Doctor verifies determinism and trust rules
- **Seller trust labels** included in search results (Phase 37)

---

## 14) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 17 implementation |
| 1.1 | 2026-01-22 | Phase 37 integration: Seller trust labels in search results |
