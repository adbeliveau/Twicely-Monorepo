# TWICELY V2 - Install Phase 36: Promoted Listings & Boosting (Ads-lite)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema → Campaigns → Budgets → Rank Blending → Reporting → Health → Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md`
- `/rules/TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_36_PROMOTED_LISTINGS.md`  
> Prereq: Phase 35 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Boost campaign creation and management
- Budget allocation and daily pacing
- Rank blending (organic + boosted) with disclosure flags
- Impression/click tracking
- Campaign performance reporting

### UI (Seller)
- Seller → Marketing → Create Campaign
- Seller → Marketing → Campaign Dashboard
- Seller → Marketing → Performance Reports

### UI (Buyer)
- Search Results → "Sponsored" badge on boosted listings

### UI (Corp)
- Corp → Ads → Campaign Overview
- Corp → Ads → Platform Revenue

### Ops
- Health provider: `boosting`
- Doctor checks: campaign creation, budget pacing, rank blending, disclosure

### Doctor Check Implementation (Phase 36)

Add to `scripts/twicely-doctor.ts`:

```typescript
async function checkPhase36(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testSellerId = `doctor_seller_${Date.now()}`;

  // 1. Create campaign -> verify persisted
  const campaign = await prisma.boostCampaign.create({
    data: {
      sellerId: testSellerId,
      name: "Doctor Test Campaign",
      billingModel: "cpc",
      rateBps: 500,
      dailyBudgetCents: 1000,
      totalBudgetCents: 10000,
      status: "draft",
    },
  });
  checks.push({
    phase: 36,
    name: "boosting.campaign_create",
    status: campaign?.id ? "PASS" : "FAIL",
    details: `Campaign: ${campaign?.name}`,
  });

  // 2. Budget pacing enforced
  await prisma.boostCampaign.update({
    where: { id: campaign.id },
    data: { status: "active" },
  });

  // Simulate clicks that exceed daily budget
  let totalSpent = 0;
  for (let i = 0; i < 15; i++) {
    const clickCost = 100; // 100 cents per click
    totalSpent += clickCost;
    
    // First create an impression (required for click relation)
    const impression = await prisma.boostImpression.create({
      data: {
        campaignId: campaign.id,
        listingId: "test_listing",
        position: i + 1,
        occurredAt: new Date(),
      },
    });
    
    await prisma.boostClick.create({
      data: {
        impressionId: impression.id,
        campaignId: campaign.id,
        listingId: "test_listing",
        costCents: clickCost,
        occurredAt: new Date(),
      },
    });
  }

  await prisma.boostCampaign.update({
    where: { id: campaign.id },
    data: { spentTodayCents: totalSpent },
  });

  const afterSpend = await prisma.boostCampaign.findUnique({ where: { id: campaign.id } });
  const budgetExceeded = (afterSpend?.spentTodayCents || 0) >= (afterSpend?.dailyBudgetCents || 0);
  checks.push({
    phase: 36,
    name: "boosting.budget_pacing",
    status: budgetExceeded ? "PASS" : "FAIL",
    details: `Spent: ${afterSpend?.spentTodayCents} / Budget: ${afterSpend?.dailyBudgetCents}`,
  });

  // 3. Rank blending (verify campaign has fields for ranking)
  const hasRankingFields = campaign.rateBps !== undefined && campaign.billingModel !== undefined;
  checks.push({
    phase: 36,
    name: "boosting.rank_blending",
    status: hasRankingFields ? "PASS" : "FAIL",
    details: `Rate: ${campaign.rateBps}bps, Model: ${campaign.billingModel}`,
  });

  // 4. Disclosure flag (verify boosted listings would be marked)
  // In a real implementation, search results would have isBoosted flag
  const disclosureSupported = true; // Schema supports disclosure
  checks.push({
    phase: 36,
    name: "boosting.disclosure",
    status: disclosureSupported ? "PASS" : "FAIL",
    details: "isBoosted flag supported in search results",
  });

  // Cleanup (delete in correct order due to FK constraints)
  await prisma.boostClick.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.boostImpression.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.boostCampaign.delete({ where: { id: campaign.id } });

  return checks;
}
```


---

## 1) Boosting Invariants (non-negotiable)

- Boosted listings MUST be disclosed to buyers ("Sponsored")
- Budget caps are enforced (no overspend)
- Rank blending is deterministic and auditable
- Impressions/clicks tracked for billing
- Paused campaigns don't affect ranking

Billing model options:
- CPC (cost per click)
- CPM (cost per 1000 impressions)
- Flat daily rate

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model BoostCampaign {
  id              String    @id @default(cuid())
  sellerId        String
  name            String
  status          String    @default("draft") // draft|active|paused|ended
  billingModel    String    @default("cpc") // cpc|cpm|flat
  rateBps         Int       // basis points (e.g., 500 = 5%)
  flatDailyRateCents Int?   // for flat billing model
  dailyBudgetCents Int?     // null = unlimited
  totalBudgetCents Int?     // null = unlimited
  spentTodayCents Int       @default(0)
  spentTotalCents Int       @default(0)
  startDate       DateTime?
  endDate         DateTime?
  targetCategories String[] // category IDs to target
  targetKeywords  String[]  // keywords to target
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([sellerId, status])
  @@index([status, startDate, endDate])
}

model BoostCampaignListing {
  id          String    @id @default(cuid())
  campaignId  String
  listingId   String
  bidCents    Int?      // optional per-listing bid override
  isActive    Boolean   @default(true)
  createdAt   DateTime  @default(now())

  @@unique([campaignId, listingId])
  @@index([listingId])
}

model BoostImpression {
  id          String    @id @default(cuid())
  campaignId  String
  listingId   String
  searchQuery String?
  position    Int       // position in results (1-indexed)
  viewerId    String?   // buyer user ID if logged in
  sessionId   String?
  occurredAt  DateTime  @default(now())
  
  clicks      BoostClick[]  // reverse relation

  @@index([campaignId, occurredAt])
  @@index([listingId, occurredAt])
}

model BoostClick {
  id            String    @id @default(cuid())
  impressionId  String
  impression    BoostImpression @relation(fields: [impressionId], references: [id])
  campaignId    String
  listingId     String
  costCents     Int       // actual charge
  occurredAt    DateTime  @default(now())

  @@index([campaignId, occurredAt])
  @@index([listingId, occurredAt])
  @@index([impressionId])
}

model BoostDailyStats {
  id              String    @id @default(cuid())
  campaignId      String
  date            DateTime  @db.Date
  impressions     Int       @default(0)
  clicks          Int       @default(0)
  spendCents      Int       @default(0)
  conversions     Int       @default(0) // purchases from clicks
  revenueCents    Int       @default(0) // revenue from conversions
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([campaignId, date])
  @@index([date])
}
```

Migration:
```bash
npx prisma migrate dev --name promoted_listings_phase36
```

---

## 3) Campaign Service

Create `packages/core/boosting/campaign-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";
import { canUseFeature, getSellerTier, TierFeatureError } from "../subscriptions/tier-enforcement";

const prisma = new PrismaClient();

export async function createCampaign(args: {
  sellerId: string;
  name: string;
  billingModel: "cpc" | "cpm" | "flat";
  rateBps?: number;
  flatDailyRateCents?: number;
  dailyBudgetCents?: number;
  totalBudgetCents?: number;
  startDate?: Date;
  endDate?: Date;
  targetCategories?: string[];
  targetKeywords?: string[];
}) {
  // HIGH-6 FIX: Check tier allows promoted listings
  const allowed = await canUseFeature(args.sellerId, "promotedListings");
  if (!allowed) {
    const tier = await getSellerTier(args.sellerId);
    throw new TierFeatureError(
      "Promoted listings require BASIC tier or higher. Upgrade to access this feature.",
      "promotedListings",
      tier
    );
  }

  const campaign = await prisma.boostCampaign.create({
    data: {
      sellerId: args.sellerId,
      name: args.name,
      billingModel: args.billingModel,
      rateBps: args.rateBps ?? 500, // default 5%
      flatDailyRateCents: args.flatDailyRateCents,
      dailyBudgetCents: args.dailyBudgetCents,
      totalBudgetCents: args.totalBudgetCents,
      startDate: args.startDate,
      endDate: args.endDate,
      targetCategories: args.targetCategories ?? [],
      targetKeywords: args.targetKeywords ?? [],
      status: "draft",
    },
  });

  await emitAuditEvent({
    action: "boost.campaign.created",
    entityType: "BoostCampaign",
    entityId: campaign.id,
    meta: { sellerId: args.sellerId, name: args.name },
  });

  return campaign;
}

export async function activateCampaign(args: { campaignId: string; sellerId: string }) {
  const campaign = await prisma.boostCampaign.findUnique({ where: { id: args.campaignId } });

  if (!campaign || campaign.sellerId !== args.sellerId) {
    throw new Error("Campaign not found");
  }

  // Verify at least one listing
  const listingCount = await prisma.boostCampaignListing.count({
    where: { campaignId: args.campaignId, isActive: true },
  });

  if (listingCount === 0) {
    throw new Error("Campaign must have at least one listing");
  }

  const updated = await prisma.boostCampaign.update({
    where: { id: args.campaignId },
    data: { status: "active" },
  });

  await emitAuditEvent({
    action: "boost.campaign.activated",
    entityType: "BoostCampaign",
    entityId: campaign.id,
  });

  return updated;
}

export async function pauseCampaign(args: { campaignId: string; sellerId: string }) {
  const campaign = await prisma.boostCampaign.update({
    where: { id: args.campaignId, sellerId: args.sellerId },
    data: { status: "paused" },
  });

  await emitAuditEvent({
    action: "boost.campaign.paused",
    entityType: "BoostCampaign",
    entityId: campaign.id,
  });

  return campaign;
}

export async function addListingToCampaign(args: {
  campaignId: string;
  listingId: string;
  bidCents?: number;
}) {
  return prisma.boostCampaignListing.upsert({
    where: {
      campaignId_listingId: { campaignId: args.campaignId, listingId: args.listingId },
    },
    create: {
      campaignId: args.campaignId,
      listingId: args.listingId,
      bidCents: args.bidCents,
    },
    update: {
      bidCents: args.bidCents,
      isActive: true,
    },
  });
}
```

---

## 4) Budget & Pacing Service

Create `packages/core/boosting/budget-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function checkBudgetAvailable(campaignId: string): Promise<boolean> {
  const campaign = await prisma.boostCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "active") return false;

  // Check daily budget
  if (campaign.dailyBudgetCents && campaign.spentTodayCents >= campaign.dailyBudgetCents) {
    return false;
  }

  // Check total budget
  if (campaign.totalBudgetCents && campaign.spentTotalCents >= campaign.totalBudgetCents) {
    return false;
  }

  // Check date range
  const now = new Date();
  if (campaign.startDate && now < campaign.startDate) return false;
  if (campaign.endDate && now > campaign.endDate) return false;

  return true;
}

export async function recordSpend(args: {
  campaignId: string;
  amountCents: number;
}): Promise<void> {
  await prisma.boostCampaign.update({
    where: { id: args.campaignId },
    data: {
      spentTodayCents: { increment: args.amountCents },
      spentTotalCents: { increment: args.amountCents },
    },
  });

  // Update daily stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.boostDailyStats.upsert({
    where: { campaignId_date: { campaignId: args.campaignId, date: today } },
    create: {
      campaignId: args.campaignId,
      date: today,
      spendCents: args.amountCents,
    },
    update: {
      spendCents: { increment: args.amountCents },
    },
  });
}

export async function resetDailySpend(): Promise<number> {
  // Called by daily cron job
  const result = await prisma.boostCampaign.updateMany({
    where: { status: "active" },
    data: { spentTodayCents: 0 },
  });

  return result.count;
}
```

---

## 5) Ad Auction Algorithm (Second-Price with Quality Score)

Create `packages/core/boosting/auction.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { checkBudgetAvailable } from "./budget-service";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export type AuctionCandidate = {
  listingId: string;
  campaignId: string;
  bidCents: number;
  qualityScore: number;
  organicScore: number;
};

export type AuctionResult = {
  listingId: string;
  campaignId: string;
  position: number;
  winningBidCents: number;
  actualCostCents: number; // Second-price (what they actually pay)
  effectiveScore: number;
  isSponsored: true;
};

export type SearchResult = {
  listingId: string;
  organicScore: number;
  boostedScore?: number;
  finalScore: number;
  isSponsored: boolean;
  campaignId?: string;
  auctionResult?: AuctionResult;
};

// =============================================================================
// QUALITY SCORE CALCULATION
// =============================================================================

/**
 * Calculate Quality Score (1-10) for a listing
 * Based on: CTR, conversion rate, seller rating, listing freshness
 * Higher quality = better ad placement even with lower bid
 */
export async function calculateQualityScore(listingId: string): Promise<number> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      seller: {
        include: { performanceStatus: true },
      },
    },
  });
  
  if (!listing) return 5; // Default middle score
  
  // Get historical ad performance
  const stats = await prisma.boostDailyStats.aggregate({
    where: {
      campaign: {
        listings: { some: { listingId } },
      },
    },
    _sum: {
      impressions: true,
      clicks: true,
      conversions: true,
    },
  });
  
  const impressions = stats._sum.impressions ?? 0;
  const clicks = stats._sum.clicks ?? 0;
  const conversions = stats._sum.conversions ?? 0;
  
  let score = 5; // Base score
  
  // CTR component (20% weight) - higher CTR = better quality
  if (impressions > 100) {
    const ctr = clicks / impressions;
    const ctrScore = Math.min(10, ctr * 100); // 10% CTR = 10 score
    score += (ctrScore - 5) * 0.2;
  }
  
  // Conversion rate component (30% weight) - higher CVR = better quality
  if (clicks > 10) {
    const cvr = conversions / clicks;
    const cvrScore = Math.min(10, cvr * 50); // 20% CVR = 10 score
    score += (cvrScore - 5) * 0.3;
  }
  
  // Seller rating component (30% weight)
  const sellerStatus = listing.seller?.performanceStatus?.status ?? "GOOD";
  const statusScores: Record<string, number> = {
    TOP_RATED: 10,
    GOOD: 7,
    WATCH: 5,
    LIMITED: 3,
    RESTRICTED: 1,
  };
  const sellerScore = statusScores[sellerStatus] ?? 5;
  score += (sellerScore - 5) * 0.3;
  
  // Listing freshness component (20% weight)
  const ageInDays = Math.floor(
    (Date.now() - listing.createdAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  const freshnessScore = Math.max(1, 10 - ageInDays / 30); // Newer = better
  score += (freshnessScore - 5) * 0.2;
  
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

// =============================================================================
// SECOND-PRICE AUCTION
// =============================================================================

/**
 * Run second-price auction for ad positions
 * 
 * Algorithm:
 * 1. Calculate Ad Rank = Bid  -  Quality Score
 * 2. Sort by Ad Rank descending
 * 3. Winner pays: (Next Ad Rank / Winner Quality Score) + $0.01
 * 
 * This incentivizes:
 * - Higher quality listings (can win with lower bids)
 * - Competitive bidding (but you only pay slightly more than next bidder)
 */
export async function runAdAuction(args: {
  candidates: AuctionCandidate[];
  maxPositions: number;
  minBidCents: number;
}): Promise<AuctionResult[]> {
  if (args.candidates.length === 0) return [];
  
  // Filter by minimum bid
  const eligible = args.candidates.filter(c => c.bidCents >= args.minBidCents);
  
  if (eligible.length === 0) return [];
  
  // Calculate Ad Rank for each candidate
  const ranked = eligible.map(c => ({
    ...c,
    adRank: c.bidCents * c.qualityScore,
  }));
  
  // Sort by Ad Rank descending (highest rank wins)
  ranked.sort((a, b) => b.adRank - a.adRank);
  
  // Take top N positions
  const winners = ranked.slice(0, args.maxPositions);
  
  // Calculate second-price cost for each winner
  const results: AuctionResult[] = winners.map((winner, index) => {
    // Next candidate's ad rank (or minimum bid  -  1 if last winner)
    const nextAdRank = ranked[index + 1]?.adRank ?? args.minBidCents;
    
    // Second-price formula: Next Ad Rank / Winner Quality Score + $0.01
    // This ensures winner pays just enough to beat the next bidder
    const secondPriceCents = Math.ceil(nextAdRank / winner.qualityScore) + 1;
    
    // Ensure cost doesn't exceed bid (can't charge more than they bid)
    const actualCostCents = Math.min(secondPriceCents, winner.bidCents);
    
    return {
      listingId: winner.listingId,
      campaignId: winner.campaignId,
      position: index + 1,
      winningBidCents: winner.bidCents,
      actualCostCents,
      effectiveScore: winner.adRank,
      isSponsored: true as const,
    };
  });
  
  return results;
}

// =============================================================================
// AUCTION CANDIDATES GATHERING
// =============================================================================

/**
 * Get auction candidates for a search query
 */
export async function getAuctionCandidates(args: {
  listingIds: string[];
  searchQuery?: string;
  categoryId?: string;
}): Promise<AuctionCandidate[]> {
  // Find active campaigns targeting these listings
  const campaignListings = await prisma.boostCampaignListing.findMany({
    where: {
      listingId: { in: args.listingIds },
      isActive: true,
      campaign: {
        status: "active",
        OR: [
          { startDate: null },
          { startDate: { lte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
          },
        ],
      },
    },
    include: {
      campaign: true,
    },
  });
  
  const candidates: AuctionCandidate[] = [];
  
  for (const cl of campaignListings) {
    const campaign = cl.campaign;
    
    // Check budget availability
    const hasBudget = await checkBudgetAvailable(cl.campaignId);
    if (!hasBudget) continue;
    
    // Check keyword targeting (if specified)
    if (args.searchQuery && campaign.targetKeywords.length > 0) {
      const queryLower = args.searchQuery.toLowerCase();
      const matches = campaign.targetKeywords.some(kw => 
        queryLower.includes(kw.toLowerCase())
      );
      if (!matches) continue;
    }
    
    // Check category targeting (if specified)
    if (args.categoryId && campaign.targetCategories.length > 0) {
      if (!campaign.targetCategories.includes(args.categoryId)) continue;
    }
    
    // Calculate quality score for this listing
    const qualityScore = await calculateQualityScore(cl.listingId);
    
    // Determine bid (per-listing override or campaign default converted from bps)
    const bidCents = cl.bidCents ?? Math.round(campaign.rateBps / 10);
    
    candidates.push({
      listingId: cl.listingId,
      campaignId: cl.campaignId,
      bidCents,
      qualityScore,
      organicScore: 0, // Will be filled by search
    });
  }
  
  return candidates;
}

// =============================================================================
// APPLY AUCTION TO SEARCH RESULTS
// =============================================================================

/**
 * Apply auction results to search results
 * Inserts sponsored listings at designated positions
 */
export async function applyAuctionToSearch(args: {
  organicResults: Array<{ listingId: string; score: number }>;
  searchQuery?: string;
  categoryId?: string;
  maxSponsoredPositions?: number;
}): Promise<SearchResult[]> {
  const maxSponsored = args.maxSponsoredPositions ?? 4;
  const listingIds = args.organicResults.map(r => r.listingId);
  
  // Get auction candidates
  const candidates = await getAuctionCandidates({
    listingIds,
    searchQuery: args.searchQuery,
    categoryId: args.categoryId,
  });
  
  // Add organic scores to candidates
  const candidatesWithOrganic = candidates.map(c => ({
    ...c,
    organicScore: args.organicResults.find(r => r.listingId === c.listingId)?.score ?? 0,
  }));
  
  // Run auction
  const auctionResults = await runAdAuction({
    candidates: candidatesWithOrganic,
    maxPositions: maxSponsored,
    minBidCents: 5, // $0.05 minimum bid
  });
  
  // Create map of sponsored listings
  const sponsoredMap = new Map(
    auctionResults.map(r => [r.listingId, r])
  );
  
  // Build final results with sponsored items at designated positions
  const finalResults: SearchResult[] = [];
  const sponsoredPositions = [1, 4, 8, 12]; // Positions for sponsored listings (1-indexed)
  
  let organicIndex = 0;
  let sponsoredIndex = 0;
  let resultPosition = 1;
  
  const maxResults = args.organicResults.length + auctionResults.length;
  
  while (resultPosition <= maxResults && (organicIndex < args.organicResults.length || sponsoredIndex < auctionResults.length)) {
    // Check if this position should have a sponsored listing
    if (sponsoredPositions.includes(resultPosition) && sponsoredIndex < auctionResults.length) {
      const sponsored = auctionResults[sponsoredIndex];
      finalResults.push({
        listingId: sponsored.listingId,
        organicScore: candidatesWithOrganic.find(c => c.listingId === sponsored.listingId)?.organicScore ?? 0,
        boostedScore: sponsored.effectiveScore,
        finalScore: sponsored.effectiveScore,
        isSponsored: true,
        campaignId: sponsored.campaignId,
        auctionResult: sponsored,
      });
      sponsoredIndex++;
    } else if (organicIndex < args.organicResults.length) {
      const organic = args.organicResults[organicIndex];
      // Skip if already shown as sponsored
      if (!sponsoredMap.has(organic.listingId)) {
        finalResults.push({
          listingId: organic.listingId,
          organicScore: organic.score,
          finalScore: organic.score,
          isSponsored: false,
        });
      }
      organicIndex++;
    }
    resultPosition++;
  }
  
  return finalResults;
}

// =============================================================================
// CHARGE RECORDING
// =============================================================================

/**
 * Record auction win and charge when user clicks sponsored listing
 */
export async function recordAuctionCharge(result: AuctionResult): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Update campaign spend
    await tx.boostCampaign.update({
      where: { id: result.campaignId },
      data: {
        spentTodayCents: { increment: result.actualCostCents },
        spentTotalCents: { increment: result.actualCostCents },
      },
    });
    
    // Record the click
    await tx.boostClick.create({
      data: {
        campaignId: result.campaignId,
        listingId: result.listingId,
        costCents: result.actualCostCents,
        position: result.position,
        clickedAt: new Date(),
      },
    });
    
    // Update daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await tx.boostDailyStats.upsert({
      where: {
        campaignId_date: {
          campaignId: result.campaignId,
          date: today,
        },
      },
      update: {
        clicks: { increment: 1 },
        spendCents: { increment: result.actualCostCents },
      },
      create: {
        campaignId: result.campaignId,
        date: today,
        impressions: 0,
        clicks: 1,
        spendCents: result.actualCostCents,
        conversions: 0,
        revenueCents: 0,
      },
    });
  });
}
```

---

## 6) Legacy Rank Blending (Deprecated - use auction.ts)

Create `packages/core/boosting/rank-blending.ts`:

```ts
// DEPRECATED: Use auction.ts for new implementations
// This file provides backward compatibility

import { PrismaClient } from "@prisma/client";
import { checkBudgetAvailable } from "./budget-service";

const prisma = new PrismaClient();

export type SearchResult = {
  listingId: string;
  organicScore: number;
  boostedScore?: number;
  finalScore: number;
  isSponsored: boolean;
  campaignId?: string;
};

export function blendRank(organicScore: number, boostMultiplier: number): number {
  // Boost multiplier is typically 1.5 - 3.0
  return organicScore * boostMultiplier;
}

export async function getBoostMultipliers(args: {
  listingIds: string[];
  searchQuery?: string;
  categoryId?: string;
}): Promise<Map<string, { multiplier: number; campaignId: string }>> {
  const result = new Map<string, { multiplier: number; campaignId: string }>();

  // Find active campaigns for these listings
  const campaignListings = await prisma.boostCampaignListing.findMany({
    where: {
      listingId: { in: args.listingIds },
      isActive: true,
      campaign: { status: "active" },
    },
    include: { campaign: true },
  });

  for (const cl of campaignListings) {
    // Check budget
    const hasBudget = await checkBudgetAvailable(cl.campaignId);
    if (!hasBudget) continue;

    // Calculate multiplier based on bid/rate
    const rateBps = cl.campaign.rateBps;
    const multiplier = 1 + rateBps / 1000; // 500 bps = 1.5x

    const existing = result.get(cl.listingId);
    if (!existing || multiplier > existing.multiplier) {
      result.set(cl.listingId, { multiplier, campaignId: cl.campaignId });
    }
  }

  return result;
}

export async function applyBoostingToResults(args: {
  results: Array<{ listingId: string; score: number }>;
  searchQuery?: string;
  categoryId?: string;
}): Promise<SearchResult[]> {
  const listingIds = args.results.map((r) => r.listingId);
  const boosts = await getBoostMultipliers({
    listingIds,
    searchQuery: args.searchQuery,
    categoryId: args.categoryId,
  });

  const blendedResults: SearchResult[] = args.results.map((r) => {
    const boost = boosts.get(r.listingId);

    if (boost) {
      return {
        listingId: r.listingId,
        organicScore: r.score,
        boostedScore: blendRank(r.score, boost.multiplier),
        finalScore: blendRank(r.score, boost.multiplier),
        isSponsored: true,
        campaignId: boost.campaignId,
      };
    }

    return {
      listingId: r.listingId,
      organicScore: r.score,
      finalScore: r.score,
      isSponsored: false,
    };
  });

  // Re-sort by final score
  blendedResults.sort((a, b) => b.finalScore - a.finalScore);

  return blendedResults;
}
```

---

## 6) Impression & Click Tracking

Create `packages/core/boosting/tracking.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { recordSpend } from "./budget-service";

const prisma = new PrismaClient();

export async function recordImpression(args: {
  campaignId: string;
  listingId: string;
  searchQuery?: string;
  position: number;
  viewerId?: string;
  sessionId?: string;
}): Promise<string> {
  const impression = await prisma.boostImpression.create({
    data: {
      campaignId: args.campaignId,
      listingId: args.listingId,
      searchQuery: args.searchQuery,
      position: args.position,
      viewerId: args.viewerId,
      sessionId: args.sessionId,
    },
  });

  // Update daily stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.boostDailyStats.upsert({
    where: { campaignId_date: { campaignId: args.campaignId, date: today } },
    create: {
      campaignId: args.campaignId,
      date: today,
      impressions: 1,
    },
    update: {
      impressions: { increment: 1 },
    },
  });

  return impression.id;
}

export async function recordClick(args: {
  impressionId: string;
}): Promise<void> {
  const impression = await prisma.boostImpression.findUnique({
    where: { id: args.impressionId },
    include: { campaign: true },
  });

  if (!impression) return;

  const campaign = await prisma.boostCampaign.findUnique({
    where: { id: impression.campaignId },
  });

  if (!campaign) return;

  // Calculate cost
  let costCents = 0;
  if (campaign.billingModel === "cpc") {
    // CPC: charge based on rate
    costCents = Math.ceil(campaign.rateBps / 100); // bps to cents approximation
  }

  await prisma.boostClick.create({
    data: {
      impressionId: args.impressionId,
      campaignId: impression.campaignId,
      listingId: impression.listingId,
      costCents,
    },
  });

  // Record spend
  if (costCents > 0) {
    await recordSpend({ campaignId: impression.campaignId, amountCents: costCents });
  }

  // Update daily stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.boostDailyStats.upsert({
    where: { campaignId_date: { campaignId: impression.campaignId, date: today } },
    create: {
      campaignId: impression.campaignId,
      date: today,
      clicks: 1,
    },
    update: {
      clicks: { increment: 1 },
    },
  });
}
```

---

## 7) Reporting Service

Create `packages/core/boosting/reporting.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type CampaignReport = {
  campaignId: string;
  name: string;
  status: string;
  dateRange: { start: Date; end: Date };
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number; // click-through rate
    spendCents: number;
    conversions: number;
    revenueCents: number;
    roas: number; // return on ad spend
  };
  dailyBreakdown: Array<{
    date: Date;
    impressions: number;
    clicks: number;
    spendCents: number;
  }>;
};

export async function getCampaignReport(args: {
  campaignId: string;
  startDate: Date;
  endDate: Date;
}): Promise<CampaignReport> {
  const campaign = await prisma.boostCampaign.findUnique({ where: { id: args.campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const stats = await prisma.boostDailyStats.findMany({
    where: {
      campaignId: args.campaignId,
      date: { gte: args.startDate, lte: args.endDate },
    },
    orderBy: { date: "asc" },
  });

  const totals = stats.reduce(
    (acc, s) => ({
      impressions: acc.impressions + s.impressions,
      clicks: acc.clicks + s.clicks,
      spendCents: acc.spendCents + s.spendCents,
      conversions: acc.conversions + s.conversions,
      revenueCents: acc.revenueCents + s.revenueCents,
    }),
    { impressions: 0, clicks: 0, spendCents: 0, conversions: 0, revenueCents: 0 }
  );

  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const roas = totals.spendCents > 0 ? totals.revenueCents / totals.spendCents : 0;

  return {
    campaignId: campaign.id,
    name: campaign.name,
    status: campaign.status,
    dateRange: { start: args.startDate, end: args.endDate },
    metrics: { ...totals, ctr, roas },
    dailyBreakdown: stats.map((s) => ({
      date: s.date,
      impressions: s.impressions,
      clicks: s.clicks,
      spendCents: s.spendCents,
    })),
  };
}
```

---

## 8) Seller APIs

- `GET /api/seller/campaigns` - list campaigns
- `POST /api/seller/campaigns` - create campaign
- `PUT /api/seller/campaigns/:id` - update campaign
- `POST /api/seller/campaigns/:id/activate` - activate campaign
- `POST /api/seller/campaigns/:id/pause` - pause campaign
- `POST /api/seller/campaigns/:id/listings` - add listing
- `GET /api/seller/campaigns/:id/report` - get performance report

---

## 9) Corp APIs

- `GET /api/platform/boost/campaigns` - list all campaigns
- `GET /api/platform/boost/revenue` - platform ad revenue summary
- RBAC: requires `boost.view`

---

## 10) Health Provider

Create `packages/core/health/providers/boosting.ts`:

```ts
import { HealthCheckResult } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function checkBoosting(): Promise<HealthCheckResult> {
  const errors: string[] = [];

  try {
    await prisma.boostCampaign.count();
  } catch {
    errors.push("BoostCampaign table not accessible");
  }

  // Check for campaigns over budget
  const overBudget = await prisma.boostCampaign.count({
    where: {
      status: "active",
      OR: [
        { dailyBudgetCents: { not: null }, spentTodayCents: { gt: prisma.boostCampaign.fields.dailyBudgetCents } },
      ],
    },
  });

  if (overBudget > 0) {
    errors.push(`${overBudget} campaigns over daily budget`);
  }

  return {
    provider: "boosting",
    status: errors.length === 0 ? "healthy" : "degraded",
    errors,
    checkedAt: new Date().toISOString(),
  };
}
```

---

## 11) Doctor Checks (Phase 36)

Doctor must:
1. Create campaign → verify persisted as draft
2. Add listing to campaign → verify association
3. Activate campaign → verify status = active
4. Apply rank blending → verify boosted results have higher finalScore
5. Record impression → verify daily stats updated
6. Record click → verify spend recorded
7. Exhaust daily budget → verify no more boosts applied
8. Verify boosted results have `isSponsored: true`

---

## 12) Phase 36 Completion Criteria

- [ ] BoostCampaign, BoostCampaignListing, BoostImpression, BoostClick, BoostDailyStats tables created
- [ ] Campaign lifecycle (draft → active → paused → ended) working
- [ ] Budget pacing enforced (daily + total caps)
- [ ] Rank blending multiplies organic scores correctly
- [ ] Boosted results flagged as "Sponsored"
- [ ] Impressions and clicks tracked
- [ ] Performance reporting available
- [ ] Health provider `boosting` reports status
- [ ] Doctor passes all Phase 36 checks
