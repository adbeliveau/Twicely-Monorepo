# TWICELY — Monetization + Payouts Canonical (v1.1)

**Version:** v1.1  
**Updated:** 2026-01-22  
**Status:** CANONICAL — Authoritative pricing, fees, and payout specification

*(Pricing tiers + fee table + settings schema + ledger → payouts mapping. TypeScript-first. Module-friendly.)*

> Goal: implement a **seller-friendly** monetization system with clear caps, transparent fees, and a **platform-owned ledger** that drives payouts safely.

---

## 0) What this includes

1. **Pricing tiers**: SELLER (casual) / STARTER / BASIC / PRO / ELITE / ENTERPRISE (eBay-exact)
2. **Fee table** (better seller optics): predictable, simple, fewer "gotchas"
3. **Monetization Settings schema**: what staff can edit (versioned, effective-dated)
4. **Ledger mapping**: how every fee becomes a ledger entry and how payouts are generated
5. **Implementation skeleton**: Prisma models, TS types, Zod schemas, API routes, webhook hooks, UI stubs
6. **RBAC scopes** for corp staff to view/edit/execute

---

## 1) Principles (non-negotiable)

- **Platform-owned ledger is authoritative.** Money-in/out events must resolve to ledger entries.
- **Fees are netted automatically** (sellers don't "pay invoices" for standard fees).
- **Every payout is computed, never hand-edited.**
- **Effective-dated fee schedules** (changes must not retroactively alter past orders).
- **Safe defaults:** read-only for most staff, strict audit log for financial actions.

---

## 2) Twicely Seller Tiers (eBay-Exact)

Twicely has 6 seller tiers matching eBay's structure:
- **SELLER tier** (casual seller) — No subscription, no store
- **STORE tiers** (STARTER through ENTERPRISE) — Paid subscription with storefront

### 2.1 Tier Definitions

| Tier | Monthly | Listings/Mo | Insertion Fee | Final Value Fee | eBay Equivalent |
|------|---------|-------------|---------------|-----------------|-----------------|
| **SELLER** | $0 | 250 free | $0.35 | 13.25% | No store (casual seller) |
| **STARTER** | $4.95 | 250 | $0.30 | 12.35% | eBay Starter Store |
| **BASIC** | $21.95 | 1,000 | $0.25 | 11.5% | eBay Basic Store |
| **PRO** | $59.95 | 10,000 | $0.15 | 10.25% | eBay Pro Store |
| **ELITE** | $299.95 | 25,000 | $0.05 | 9.15% | eBay Elite Store |
| **ENTERPRISE** | $2,999.95 | 100,000 | $0.05 | Custom | eBay Enterprise Store |

> Notes:
- "Listing cap" counts **new listings created in the month** (not inventory count).
- Variations count as **one** listing.
- Cap resets monthly; "scheduled listings" count when they become active.
- **SELLER tier** = casual seller (no subscription, pays insertion fees over 250 free)
- **STORE tiers** (STARTER+) = paid subscription with storefront
- Insertion fee charged per listing over free monthly allowance

### 2.2 Tier Features Matrix

| Feature | SELLER | STARTER | BASIC | PRO | ELITE | ENTERPRISE |
|---------|--------|---------|-------|-----|-------|------------|
| Branded Storefront | - | Yes | Yes | Yes | Yes | Yes |
| Custom Store URL | - | Yes | Yes | Yes | Yes | Yes |
| Vacation Mode | - | Yes | Yes | Yes | Yes | Yes |
| Basic Analytics | Yes | Yes | Yes | Yes | Yes | Yes |
| Advanced Analytics | - | - | Yes | Yes | Yes | Yes |
| Bulk Listing Tools | - | - | Yes | Yes | Yes | Yes |
| Promoted Listings | - | - | Yes | Yes | Yes | Yes |
| Scheduled Listings | - | - | Yes | Yes | Yes | Yes |
| Markdown Manager | - | - | Yes | Yes | Yes | Yes |
| Custom Categories | - | - | Yes | Yes | Yes | Yes |
| Staff Accounts | 0 | 0 | 2 | 5 | 15 | 100 |
| Priority Support | - | - | - | Yes | Yes | Yes |
| Dedicated Rep | - | - | - | - | Yes | Yes |
| Sales Events | - | - | - | Yes | Yes | Yes |
| Custom Pages | - | - | - | - | Yes | Yes |
| API Rate Multiplier | 1x | 1x | 1x | 2x | 5x | 10x |

### 2.3 Enum Definition

```prisma
enum SellerTier {
  SELLER      // $0/mo — Casual seller (no store subscription)
  STARTER     // $4.95/mo  — Entry level store
  BASIC       // $21.95/mo — Small business store
  PRO         // $59.95/mo — Growing business store
  ELITE       // $299.95/mo — High volume store
  ENTERPRISE  // $2,999.95/mo — Enterprise store
}
```

### 2.4 SELLER Tier (Casual Sellers)

The **SELLER tier** is for casual sellers who don't want a store subscription:

| Aspect | SELLER Tier |
|--------|-------------|
| Monthly Fee | $0 |
| Free Listings | 250/month |
| Insertion Fee | $0.35 (over 250) |
| Final Value Fee | 13.25% |
| Storefront | No |
| Personal Seller | Yes (allowed) |
| Business Seller | Yes (allowed) |

This matches eBay's "no store" casual seller option where users can list and sell without subscribing to a store. The SELLER tier:
- Has no monthly subscription cost
- Gets 250 free listings per month (same as STARTER)
- Pays $0.35 insertion fee per listing over 250
- Pays highest FVF rate (13.25%)
- Does NOT get a storefront
- Does NOT get bulk tools, promoted listings, etc.

**Personal sellers are restricted to SELLER tier only.** To subscribe to a store (STARTER+), the seller must upgrade to BUSINESS status (free upgrade, requires business info).

### 2.5 Tier Upgrade/Downgrade Rules

1. **Upgrades:** Immediate, prorated billing
2. **Downgrades:** Effective at end of billing period
3. **Grace period:** 7 days for failed payments before auto-downgrade
4. **Listing pause:** Excess listings paused on downgrade (oldest first)
5. **Staff revoke:** Excess staff accounts revoked on downgrade (newest first)

---

## 3) Fee table (seller-friendly optics)

### 3.1 Fees you charge (eBay-exact)

We keep it simple: **one marketplace fee**, plus **optional add-ons**.

#### Marketplace fee (final value fee)
Applied to: **item price + shipping charged** (exclude taxes for seller optics in v1)

| Tier | Marketplace fee |
|------|----------------:|
| SELLER | 13.25% |
| STARTER | 12.35% |
| BASIC | 11.5% |
| PRO | 10.25% |
| ELITE | 9.15% |
| ENTERPRISE | 8.0% (negotiable) |

#### Insertion fee (per listing over free allowance)
Charged when seller exceeds free monthly listing allowance:

| Tier | Free Listings | Insertion Fee |
|------|---------------|---------------|
| SELLER | 250 | $0.35 |
| STARTER | 250 | $0.30 |
| BASIC | 1,000 | $0.25 |
| PRO | 10,000 | $0.15 |
| ELITE | 25,000 | $0.05 |
| ENTERPRISE | 100,000 | $0.05 |

#### Payment processing fee
You will have a real processing fee from your processor. For seller optics, show it transparently as:
- **Processing fee: pass-through** (exact rate from provider, shown on payout breakdown)

> Implementation: store the *processor fee* as its own ledger entries so the seller can reconcile.

#### Optional: Promoted listing fee (cost-per-sale)
Seller chooses a rate (e.g., 2%-15%). Charged only if the sale is attributed to promotion.

#### Optional: Dispute handling fee
Flat amount charged only if a dispute/chargeback occurs (refunded if seller wins).

---

## 4) Monetization Settings (what staff can edit)

### 4.1 Settings pages (Corp Hub)
- **Settings → Monetization**
  - **Plans**
  - **Fee Schedules**
  - **Promotions**
  - **Disputes & Holds**
  - **Payout Schedule**
  - **Exports**

### 4.2 Effective-dated config (required)
Every change creates a **new version** with:
- `effectiveAt` (ISO)
- `version` (semver or increment)
- `createdByStaffId`
- immutable snapshot of fee schedule used for future orders

---

## 5) Data model (Prisma)

> Adjust names to match your repo conventions, but keep the structure.

```prisma
// prisma/schema.prisma

model MonetizationPlan {
  id            String   @id @default(cuid())
  code          String   @unique  // "SELLER" | "STARTER" | "BASIC" | "PRO" | "ELITE" | "ENTERPRISE"
  name          String
  monthlyPrice  Int      // cents (0 for SELLER)
  listingCapMonthly Int
  insertionFeeCents Int  // charged per listing over cap
  featuresJson  Json     // { storefront: true, staffSeats: 3, ... }
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model FeeSchedule {
  id           String   @id @default(cuid())
  version      String   // "v1.0.0" or "2026-01-17-01"
  effectiveAt  DateTime
  isActive     Boolean  @default(true)

  // main marketplace fee per plan (all 6 tiers)
  marketplaceFeeSeller    Decimal @db.Decimal(5,4) // 0.1325
  marketplaceFeeStarter   Decimal @db.Decimal(5,4) // 0.1235
  marketplaceFeeBasic     Decimal @db.Decimal(5,4) // 0.1150
  marketplaceFeePro       Decimal @db.Decimal(5,4) // 0.1025
  marketplaceFeeElite     Decimal @db.Decimal(5,4) // 0.0915
  marketplaceFeeEnterprise Decimal @db.Decimal(5,4) // 0.0800

  // insertion fees per plan (all 6 tiers)
  insertionFeeSeller      Int     @default(35)  // cents
  insertionFeeStarter     Int     @default(30)
  insertionFeeBasic       Int     @default(25)
  insertionFeePro         Int     @default(15)
  insertionFeeElite       Int     @default(5)
  insertionFeeEnterprise  Int     @default(5)

  // promoted listing min/max (guardrails)
  promoRateMin Decimal @db.Decimal(5,4) // 0.0200
  promoRateMax Decimal @db.Decimal(5,4) // 0.1500

  // dispute fees
  disputeFeeCents Int  @default(0)

  // holds rules (simple)
  holdDaysDefault Int  @default(0) // e.g. 0-7
  holdOnRiskFlag  Boolean @default(true)
  holdOnChargeback Boolean @default(true)

  createdByStaffId String
  createdAt     DateTime @default(now())
}

model SellerSubscription {
  id          String   @id @default(cuid())
  sellerId    String   // User ID (owner)
  planCode    String   // "SELLER" | "STARTER" | "BASIC" | "PRO" | "ELITE" | "ENTERPRISE"
  status      String   // "active" | "past_due" | "canceled"
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  provider     String? // "stripe"
  providerSubId String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([sellerId, status])
}

model ListingMonthlyUsage {
  id        String   @id @default(cuid())
  sellerId  String
  monthKey  String   // "2026-01" (UTC)
  createdCount Int   @default(0)
  updatedAt DateTime @updatedAt

  @@unique([sellerId, monthKey])
}

enum LedgerEntryType {
  // SALES & REVENUE
  SALE_CREDIT           // Gross sale amount credited to seller

  // PLATFORM FEES
  MARKETPLACE_FEE       // Platform commission deducted from seller
  PROCESSING_FEE        // Payment processor fee (Stripe, etc.)
  PROMOTION_FEE         // Promotional/advertising fee (coupon cost absorption)
  SUBSCRIPTION_FEE      // Seller subscription/tier fee
  SHIPPING_LABEL_FEE    // Cost of purchased shipping label (Phase 34)
  PROMOTED_LISTING_FEE  // Cost of promoted listing ads — CPC/CPM/flat (Phase 36)
  INSERTION_FEE         // Fee for listing creation (over free allowance)

  // REFUNDS & DISPUTES
  REFUND                // Refund to buyer (debit from seller)
  REFUND_FEE_REVERSAL   // Fee reversal on refund (credit to seller)
  DISPUTE               // Dispute/chargeback amount
  DISPUTE_FEE           // Dispute fee charged by processor
  DISPUTE_FEE_REVERSAL  // Dispute fee reversal (seller won dispute)

  // HOLDS & RESERVES
  HOLD_PLACE            // Funds placed on hold (not available for payout)
  HOLD_RELEASE          // Funds released from hold

  // ADJUSTMENTS
  ADJUSTMENT_CREDIT     // Manual credit (admin action, requires reason)
  ADJUSTMENT_DEBIT      // Manual debit (admin action, requires reason)

  // PAYOUTS
  PAYOUT                // Funds transferred to seller (negative entry)
}

model LedgerEntry {
  id          String   @id @default(cuid())
  sellerId    String
  orderId     String?
  payoutId    String?
  type        LedgerEntryType
  amountCents Int      // positive = credit, negative = debit
  currency    String   @default("USD")
  source      String   // "order" | "refund" | "admin" | "system"
  sourceRef   String?  // orderId, refundId, etc.
  metaJson    Json?
  createdAt   DateTime @default(now())

  @@index([sellerId, createdAt])
  @@index([orderId])
  @@index([payoutId])
  @@index([type, createdAt])
}

model Payout {
  id          String   @id @default(cuid())
  sellerId    String
  status      String   @default("READY") // READY | PROCESSING | COMPLETED | FAILED
  amountCents Int
  currency    String   @default("USD")
  periodStart DateTime
  periodEnd   DateTime
  providerPayoutId String?
  failureReason String?
  createdByStaffId String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([sellerId, status])
  @@index([status, createdAt])
}

model PayoutHold {
  id          String   @id @default(cuid())
  sellerId    String
  reason      String   // "dispute" | "verification" | "risk" | "manual"
  sourceType  String?  // "order" | "dispute" | "admin"
  sourceId    String?
  amountCents Int?     // null = full balance hold
  isActive    Boolean  @default(true)
  expiresAt   DateTime?
  releasedAt  DateTime?
  releasedByStaffId String?
  createdByStaffId String?
  createdAt   DateTime @default(now())

  @@index([sellerId, isActive])
}
```

---

## 6) Ledger service (TS)

```ts
// packages/core/ledger/post-entries.ts

import { prisma } from "@/lib/prisma";
import { LedgerEntryType } from "@prisma/client";

export async function postSaleEntries(args: {
  sellerId: string;
  orderId: string;
  saleAmountCents: number;
  marketplaceFeeCents: number;
  processingFeeCents: number;
  promotionFeeCents?: number;
}) {
  const entries = [
    {
      sellerId: args.sellerId,
      orderId: args.orderId,
      type: LedgerEntryType.SALE_CREDIT,
      amountCents: args.saleAmountCents,
      source: "order",
      sourceRef: args.orderId,
    },
    {
      sellerId: args.sellerId,
      orderId: args.orderId,
      type: LedgerEntryType.MARKETPLACE_FEE,
      amountCents: -args.marketplaceFeeCents,
      source: "order",
      sourceRef: args.orderId,
    },
    {
      sellerId: args.sellerId,
      orderId: args.orderId,
      type: LedgerEntryType.PROCESSING_FEE,
      amountCents: -args.processingFeeCents,
      source: "order",
      sourceRef: args.orderId,
    },
  ];

  if (args.promotionFeeCents && args.promotionFeeCents > 0) {
    entries.push({
      sellerId: args.sellerId,
      orderId: args.orderId,
      type: LedgerEntryType.PROMOTION_FEE,
      amountCents: -args.promotionFeeCents,
      source: "order",
      sourceRef: args.orderId,
    });
  }

  await prisma.ledgerEntry.createMany({ data: entries });
}

export async function postInsertionFeeEntry(args: {
  sellerId: string;
  listingId: string;
  amountCents: number;
}) {
  await prisma.ledgerEntry.create({
    data: {
      sellerId: args.sellerId,
      type: LedgerEntryType.INSERTION_FEE,
      amountCents: -args.amountCents,
      source: "listing",
      sourceRef: args.listingId,
    },
  });
}

export async function postRefundEntries(args: {
  sellerId: string;
  orderId: string;
  refundAmountCents: number;
  feeReversalCents: number;
}) {
  await prisma.ledgerEntry.createMany({
    data: [
      {
        sellerId: args.sellerId,
        orderId: args.orderId,
        type: LedgerEntryType.REFUND,
        amountCents: -args.refundAmountCents,
        source: "refund",
        sourceRef: args.orderId,
      },
      {
        sellerId: args.sellerId,
        orderId: args.orderId,
        type: LedgerEntryType.REFUND_FEE_REVERSAL,
        amountCents: args.feeReversalCents,
        source: "refund",
        sourceRef: args.orderId,
      },
    ],
  });
}
```

---

## 7) Fee calculation service

```ts
// packages/core/fees/calculate.ts

import { prisma } from "@/lib/prisma";
import type { SellerTier } from "@prisma/client";

const FVF_RATES: Record<SellerTier, number> = {
  SELLER: 0.1325,
  STARTER: 0.1235,
  BASIC: 0.115,
  PRO: 0.1025,
  ELITE: 0.0915,
  ENTERPRISE: 0.08,
};

const INSERTION_FEES: Record<SellerTier, number> = {
  SELLER: 35,     // cents
  STARTER: 30,
  BASIC: 25,
  PRO: 15,
  ELITE: 5,
  ENTERPRISE: 5,
};

const FREE_LISTINGS: Record<SellerTier, number> = {
  SELLER: 250,
  STARTER: 250,
  BASIC: 1000,
  PRO: 10000,
  ELITE: 25000,
  ENTERPRISE: 100000,
};

export function calculateMarketplaceFee(
  saleAmountCents: number,
  tier: SellerTier
): number {
  const rate = FVF_RATES[tier];
  return Math.round(saleAmountCents * rate);
}

export function getInsertionFee(tier: SellerTier): number {
  return INSERTION_FEES[tier];
}

export function getFreeListingAllowance(tier: SellerTier): number {
  return FREE_LISTINGS[tier];
}

export async function checkListingCapAndChargeFee(
  sellerId: string,
  tier: SellerTier
): Promise<{ allowed: boolean; insertionFeeCents: number }> {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const usage = await prisma.listingMonthlyUsage.upsert({
    where: { sellerId_monthKey: { sellerId, monthKey } },
    create: { sellerId, monthKey, createdCount: 1 },
    update: { createdCount: { increment: 1 } },
  });

  const freeAllowance = getFreeListingAllowance(tier);

  if (usage.createdCount <= freeAllowance) {
    return { allowed: true, insertionFeeCents: 0 };
  }

  // Over limit — charge insertion fee
  const insertionFee = getInsertionFee(tier);
  return { allowed: true, insertionFeeCents: insertionFee };
}
```

---

## 8) Hold management

```ts
// packages/core/payouts/holds.ts

import { prisma } from "@/lib/prisma";

export async function placeHold(args: {
  sellerId: string;
  reason: "dispute" | "verification" | "risk" | "manual";
  sourceType?: string;
  sourceId?: string;
  amountCents?: number;
  expiresAt?: Date;
  createdByStaffId?: string;
}) {
  return prisma.payoutHold.create({
    data: {
      sellerId: args.sellerId,
      reason: args.reason,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      amountCents: args.amountCents,
      expiresAt: args.expiresAt,
      createdByStaffId: args.createdByStaffId,
    },
  });
}

export async function releaseHold(holdId: string, staffId: string) {
  return prisma.payoutHold.update({
    where: { id: holdId },
    data: {
      isActive: false,
      releasedAt: new Date(),
      releasedByStaffId: staffId,
    },
  });
}

export async function getActiveHolds(sellerId: string) {
  return prisma.payoutHold.findMany({
    where: { sellerId, isActive: true },
  });
}

export async function hasActiveHold(sellerId: string): Promise<boolean> {
  const count = await prisma.payoutHold.count({
    where: { sellerId, isActive: true },
  });
  return count > 0;
}
```

---

## 9) Seller balance computation

```ts
// packages/core/payouts/balance.ts

import { prisma } from "@/lib/prisma";

export async function getSellerBalance(sellerId: string): Promise<{
  availableCents: number;
  pendingCents: number;
  heldCents: number;
}> {
  // Sum all ledger entries not yet paid out
  const unpaid = await prisma.ledgerEntry.aggregate({
    where: { sellerId, payoutId: null },
    _sum: { amountCents: true },
  });

  const totalUnpaid = unpaid._sum.amountCents || 0;

  // Get active holds
  const holds = await prisma.payoutHold.findMany({
    where: { sellerId, isActive: true },
  });

  let heldCents = 0;
  for (const hold of holds) {
    if (hold.amountCents) {
      heldCents += hold.amountCents;
    } else {
      // Full balance hold
      heldCents = totalUnpaid;
      break;
    }
  }

  const availableCents = Math.max(0, totalUnpaid - heldCents);
  const pendingCents = Math.max(0, totalUnpaid - availableCents);

  return { availableCents, pendingCents, heldCents };
}
```

---

## 10) Payout eligibility + execution

### 10.1 Eligibility check

```ts
// packages/core/payouts/eligibility.ts

import { prisma } from "@/lib/prisma";
import { hasActiveHold } from "./holds";
import { getSellerBalance } from "./balance";

export async function checkPayoutEligibility(sellerId: string): Promise<{
  eligible: boolean;
  reason?: string;
  availableCents: number;
}> {
  // 1. Check seller exists and is active
  const seller = await prisma.user.findUnique({
    where: { id: sellerId },
    include: { sellerPaymentsProfile: true },
  });

  if (!seller || !seller.isSeller) {
    return { eligible: false, reason: "not_seller", availableCents: 0 };
  }

  // 2. Check payments profile
  const profile = seller.sellerPaymentsProfile;
  if (!profile || !profile.payoutsEnabled) {
    return { eligible: false, reason: "payouts_not_enabled", availableCents: 0 };
  }

  // 3. Check for holds
  if (await hasActiveHold(sellerId)) {
    return { eligible: false, reason: "hold_active", availableCents: 0 };
  }

  // 4. Get balance
  const balance = await getSellerBalance(sellerId);
  if (balance.availableCents <= 0) {
    return { eligible: false, reason: "no_balance", availableCents: 0 };
  }

  return { eligible: true, availableCents: balance.availableCents };
}
```

### 10.2 Payout preview

```ts
// packages/core/payouts/preview.ts

import { prisma } from "@/lib/prisma";

export async function buildPayoutPreview(args: {
  sellerId: string;
  periodStart: Date;
  periodEnd: Date;
  minimumPayoutCents: number;
}) {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      sellerId: args.sellerId,
      payoutId: null,
      createdAt: { gte: args.periodStart, lte: args.periodEnd },
    },
  });

  const amount = entries.reduce((sum, e) => sum + e.amountCents, 0);

  if (amount < args.minimumPayoutCents) {
    return { eligible: false, amountCents: amount, entries };
  }

  return { eligible: true, amountCents: amount, entries };
}
```

### 10.3 Execute payout

```ts
// packages/core/payouts/execute.ts

import { prisma } from "@/lib/prisma";

export async function executePayout(args: {
  sellerId: string;
  periodStart: Date;
  periodEnd: Date;
  amountCents: number;
  entryIds: string[];
  createdByStaffId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payout.create({
      data: {
        sellerId: args.sellerId,
        status: "READY",
        amountCents: args.amountCents,
        currency: "USD",
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        createdByStaffId: args.createdByStaffId,
      },
    });

    await tx.ledgerEntry.updateMany({
      where: { id: { in: args.entryIds } },
      data: { payoutId: payout.id },
    });

    await tx.ledgerEntry.create({
      data: {
        sellerId: args.sellerId,
        payoutId: payout.id,
        type: "PAYOUT",
        amountCents: -args.amountCents,
        currency: "USD",
        source: "system",
        sourceRef: "payout_run",
        metaJson: {
          periodStart: args.periodStart.toISOString(),
          periodEnd: args.periodEnd.toISOString(),
        },
      },
    });

    return payout;
  });
}
```

---

## 11) Monetization Settings schema (Zod)

```ts
import { z } from "zod";

export const SellerTierSchema = z.enum([
  "SELLER",
  "STARTER",
  "BASIC",
  "PRO",
  "ELITE",
  "ENTERPRISE",
]);

export const MonetizationPlanSchema = z.object({
  code: SellerTierSchema,
  name: z.string().min(1),
  monthlyPriceCents: z.number().int().nonnegative(),
  listingCapMonthly: z.number().int().positive(),
  insertionFeeCents: z.number().int().nonnegative(),
  features: z.record(z.any()),
  isActive: z.boolean(),
});

export const FeeScheduleSchema = z.object({
  version: z.string().min(1),
  effectiveAt: z.string().datetime(),
  marketplaceFeeByTier: z.object({
    SELLER: z.number().min(0).max(1),
    STARTER: z.number().min(0).max(1),
    BASIC: z.number().min(0).max(1),
    PRO: z.number().min(0).max(1),
    ELITE: z.number().min(0).max(1),
    ENTERPRISE: z.number().min(0).max(1),
  }),
  insertionFeeByTier: z.object({
    SELLER: z.number().int().nonnegative(),
    STARTER: z.number().int().nonnegative(),
    BASIC: z.number().int().nonnegative(),
    PRO: z.number().int().nonnegative(),
    ELITE: z.number().int().nonnegative(),
    ENTERPRISE: z.number().int().nonnegative(),
  }),
  promoRateMin: z.number().min(0).max(1),
  promoRateMax: z.number().min(0).max(1),
  disputeFeeCents: z.number().int().nonnegative(),
  holdDaysDefault: z.number().int().min(0).max(30),
  holdOnRiskFlag: z.boolean(),
  holdOnChargeback: z.boolean(),
});
```

---

## 12) API routes (Next.js Route Handlers)

> Namespaced under Corp Hub.

### 12.1 Read current monetization config
`GET /corp/api/monetization/current`

```ts
// apps/web/app/corp/api/monetization/current/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // requireScope("monetization.read")
  const schedule = await prisma.feeSchedule.findFirst({
    where: { isActive: true },
    orderBy: { effectiveAt: "desc" },
  });
  const plans = await prisma.monetizationPlan.findMany({
    where: { isActive: true },
  });
  return NextResponse.json({ schedule, plans });
}
```

### 12.2 Create a new fee schedule version
`POST /corp/api/monetization/fee-schedules`

```ts
// apps/web/app/corp/api/monetization/fee-schedules/route.ts
import { NextResponse } from "next/server";
import { FeeScheduleSchema } from "@/lib/monetization/schemas";

export async function POST(req: Request) {
  // requireScope("monetization.write")
  const body = await req.json();
  const parsed = FeeScheduleSchema.parse(body);

  const created = await prisma.feeSchedule.create({
    data: {
      version: parsed.version,
      effectiveAt: new Date(parsed.effectiveAt),
      isActive: true,
      marketplaceFeeSeller: parsed.marketplaceFeeByTier.SELLER,
      marketplaceFeeStarter: parsed.marketplaceFeeByTier.STARTER,
      marketplaceFeeBasic: parsed.marketplaceFeeByTier.BASIC,
      marketplaceFeePro: parsed.marketplaceFeeByTier.PRO,
      marketplaceFeeElite: parsed.marketplaceFeeByTier.ELITE,
      marketplaceFeeEnterprise: parsed.marketplaceFeeByTier.ENTERPRISE,
      insertionFeeSeller: parsed.insertionFeeByTier.SELLER,
      insertionFeeStarter: parsed.insertionFeeByTier.STARTER,
      insertionFeeBasic: parsed.insertionFeeByTier.BASIC,
      insertionFeePro: parsed.insertionFeeByTier.PRO,
      insertionFeeElite: parsed.insertionFeeByTier.ELITE,
      insertionFeeEnterprise: parsed.insertionFeeByTier.ENTERPRISE,
      promoRateMin: parsed.promoRateMin,
      promoRateMax: parsed.promoRateMax,
      disputeFeeCents: parsed.disputeFeeCents,
      holdDaysDefault: parsed.holdDaysDefault,
      holdOnRiskFlag: parsed.holdOnRiskFlag,
      holdOnChargeback: parsed.holdOnChargeback,
      createdByStaffId: "staff_user_id", // from auth context
    },
  });

  // write AuditEvent: monetization.fee_schedule.create
  return NextResponse.json({ created }, { status: 201 });
}
```

### 12.3 Payout run preview + execute
- `POST /corp/api/payouts/runs/preview`
- `POST /corp/api/payouts/runs/execute`

(Use `buildPayoutPreview` + `executePayout` helpers above.)

---

## 13) RBAC scopes (minimal set)

### Monetization (staff)
- `monetization.read`
- `monetization.write` (create new versions)
- `plans.write` (edit plan pricing/caps/features)

### Payouts (staff)
- `payouts.read`
- `payouts.run.preview`
- `payouts.run.execute` *(high risk)*
- `payouts.hold.apply` *(high risk)*
- `payouts.destination.view` *(sensitive read)*

### Audit
- `audit.read`

---

## 14) Admin UI wiring (shadcn/Tailwind)

### Pages
- `/corp/monetization` (tabs: Plans, Fee Schedules, Promotions, Disputes/Holds)
- `/corp/payouts` (overview, payout runs, seller balances, exceptions)
- `/corp/payouts/runs/:id`
- `/corp/payouts/sellers/:sellerId`

> All pages hide/disable actions based on scopes.

---

## 15) Webhook hooks (payments provider)

You must post ledger entries when payment settles. Provider-specific logic lives in your payments module; the contract is:

- Identify seller (owner user id) for the order
- Fetch **fee schedule snapshot** effective at order time
- Compute marketplace & promo fees
- Use provider event to extract processing fee
- Write ledger entries in a single transaction
- Mark order as paid/settled

---

## 16) System Health providers (recommended)
Add health providers for:
- `payouts` (payout runs ok, destination errors, failed payouts)
- `payments` (webhook backlog, last webhook time)
- `ledger` (negative balances count, reconciliation drift)

---

## 17) Acceptance checklist (v1.1)

### Monetization
- [ ] Plans exist (SELLER/STARTER/BASIC/PRO/ELITE/ENTERPRISE) with caps + features
- [ ] Fee schedule is effective-dated + versioned
- [ ] Fee schedule includes all 6 tiers
- [ ] Insertion fees tracked in ledger
- [ ] Seller checkout uses schedule snapshot at time of sale
- [ ] UI shows seller a clear fee breakdown per order

### Ledger + payouts
- [ ] Every sale creates ledger entries (credit + fees)
- [ ] Insertion fees create INSERTION_FEE entries
- [ ] Refunds/chargebacks create ledger debits
- [ ] Payout preview is deterministic
- [ ] Payout execution is audited + RBAC gated
- [ ] Payouts create PAYOUT ledger entry and mark included entries
- [ ] Provider payout failures create exceptions and status changes

---

## 18) Implementation notes (keep it lean)
- Avoid retroactive recalcs: store `feeScheduleId` on each fee entry.
- Avoid manual adjustments in v1 if possible; if you must, gate it behind the highest role + audit + reason code.
- Start with weekly payouts; add daily later.
- Start with minimal holds: risk flag + dispute/chargeback.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-01-17 | Initial monetization canonical |
| v1.1 | 2026-01-22 | Added SELLER tier (casual seller), insertion fees, aligned with Phase 24 |

---
