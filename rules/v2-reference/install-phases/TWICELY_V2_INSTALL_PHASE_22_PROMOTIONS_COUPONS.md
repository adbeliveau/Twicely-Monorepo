# TWICELY V2 — Install Phase 22: Promotions + Coupons
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema → Coupon Engine → Campaign Management → Checkout Integration → Ledger → Health → Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`
- `/rules/TWICELY_POLICY_LIBRARY_CANONICAL.md`
- `/rules/TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/canonicals/install-phases/TWICELY_V2_INSTALL_PHASE_22_PROMOTIONS_COUPONS.md`  
> Prereq: Phase 21 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Coupon model with all discount types
- Promotion campaign model
- Coupon validation engine
- Checkout integration for discount application
- Redemption tracking and limits
- Ledger integration for promotional discounts
- Corp management APIs

### UI (Seller)
- Seller → Marketing → Coupons (create/manage)
- Seller → Marketing → Campaigns (create/manage)

### UI (Buyer)
- Checkout → Apply Coupon Code
- Cart → Discount display

### UI (Corp)
- Corp → Promotions → Coupons (list/manage)
- Corp → Promotions → Campaigns (list/manage)
- Corp → Promotions → Analytics (usage/ROI)
- Corp → Promotions → Settings (platform-wide promo limits)

### Ops
- Health provider: `promotions`
- Doctor checks:
  - coupon creation
  - validation logic
  - redemption tracking
  - ledger posting

---

## 1) Promotions Invariants (non-negotiable)

- Coupons are **code-based** and unique
- Discounts are applied **at checkout** before payment intent
- Redemption limits are **strictly enforced**
- All discounts are recorded in the **ledger** for reconciliation
- Expired/inactive coupons return **clear error messages**
- Seller coupons only apply to **that seller's listings**
- Platform coupons can apply **marketplace-wide**

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
// =============================================================================
// COUPON
// =============================================================================

enum CouponDiscountType {
  PERCENTAGE      // e.g., 10% off
  FIXED_AMOUNT    // e.g., $5 off
  FREE_SHIPPING   // removes shipping cost
}

enum CouponScope {
  PLATFORM        // created by platform, applies to all eligible
  SELLER          // created by seller, applies to their listings only
}

model Coupon {
  id                String             @id @default(cuid())
  code              String             @unique
  name              String
  description       String?
  
  scope             CouponScope        @default(SELLER)
  sellerId          String?            // null for PLATFORM scope
  
  discountType      CouponDiscountType
  discountValue     Int                // cents for FIXED_AMOUNT, basis points for PERCENTAGE
  
  // Limits
  minPurchaseCents  Int?               // minimum cart subtotal
  maxDiscountCents  Int?               // cap for percentage discounts
  usageLimit        Int?               // total redemptions allowed (null = unlimited)
  usagePerUser      Int                @default(1) // per-user limit
  usedCount         Int                @default(0)
  
  // Targeting
  categoryIds       String[]           @default([]) // empty = all categories
  listingIds        String[]           @default([]) // empty = all listings (within scope)
  userTierRequired  String?            // STARTER|BASIC|PRO|ELITE|ENTERPRISE or null for any
  newUsersOnly      Boolean            @default(false)

  // Bundle interaction (Phase 3 Bundle Builder)
  excludeBundledItems Boolean          @default(false) // If true, coupon doesn't apply to items in a bundle
  
  // Schedule
  startsAt          DateTime?
  expiresAt         DateTime?
  isActive          Boolean            @default(true)
  
  // Audit
  createdByUserId   String
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  
  redemptions       CouponRedemption[]
  
  @@index([code])
  @@index([sellerId, isActive])
  @@index([scope, isActive, expiresAt])
}

// =============================================================================
// COUPON REDEMPTION
// =============================================================================

model CouponRedemption {
  id              String    @id @default(cuid())
  couponId        String
  coupon          Coupon    @relation(fields: [couponId], references: [id])
  
  orderId         String    @unique
  userId          String
  
  discountCents   Int       // actual discount applied
  originalSubtotalCents Int // cart subtotal before discount
  
  redeemedAt      DateTime  @default(now())
  
  // Idempotency
  idempotencyKey  String    @unique
  
  @@index([couponId, redeemedAt])
  @@index([userId, redeemedAt])
  @@index([orderId])
}

// =============================================================================
// PROMOTION CAMPAIGN
// =============================================================================

enum CampaignType {
  SALE              // site-wide or category sale
  FLASH_SALE        // time-limited sale
  SEASONAL          // holiday/seasonal
  CLEARANCE         // clearance pricing
  LOYALTY           // loyalty member exclusive
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  ACTIVE
  PAUSED
  ENDED
  CANCELED
}

model PromotionCampaign {
  id                String         @id @default(cuid())
  name              String
  description       String?
  type              CampaignType
  status            CampaignStatus @default(DRAFT)
  
  // Discount
  discountType      CouponDiscountType
  discountValue     Int
  maxDiscountCents  Int?
  
  // Budget
  budgetCents       Int?           // null = unlimited
  spentCents        Int            @default(0)
  
  // Schedule
  startsAt          DateTime
  endsAt            DateTime
  
  // Targeting
  scope             CouponScope    @default(PLATFORM)
  sellerId          String?        // for SELLER scope
  categoryIds       String[]       @default([])
  listingIds        String[]       @default([])
  
  // Auto-generated coupon code (optional)
  couponCode        String?        @unique
  
  // Audit
  createdByUserId   String
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  @@index([status, startsAt, endsAt])
  @@index([sellerId, status])
}

// =============================================================================
// PROMOTION SETTINGS (Platform-wide)
// =============================================================================

model PromotionSettings {
  id                    String   @id @default(cuid())
  version               String
  effectiveAt           DateTime
  isActive              Boolean  @default(true)
  
  // Seller coupon limits
  sellerMaxCouponsActive    Int  @default(10)
  sellerMaxDiscountPercent  Int  @default(50)  // 50%
  sellerMinPurchaseCents    Int  @default(0)
  
  // Platform coupon limits
  platformMaxStackedCoupons Int  @default(1)   // how many coupons can stack
  
  // Campaign limits
  maxCampaignDurationDays   Int  @default(30)
  
  createdByStaffId      String
  createdAt             DateTime @default(now())
  
  @@index([effectiveAt])
}
```

Migration:
```bash
npx prisma migrate dev --name promotions_phase22
```

---

## 3) Coupon Validation Service

Create `packages/core/promotions/coupon-validator.ts`:

```typescript
import { PrismaClient, CouponDiscountType } from "@prisma/client";

const prisma = new PrismaClient();

export type CouponValidationResult =
  | { valid: true; couponId: string; discountCents: number; discountType: CouponDiscountType }
  | { valid: false; error: CouponValidationError };

export type CouponValidationError =
  | "COUPON_NOT_FOUND"
  | "COUPON_INACTIVE"
  | "COUPON_EXPIRED"
  | "COUPON_NOT_STARTED"
  | "COUPON_LIMIT_REACHED"
  | "USER_LIMIT_REACHED"
  | "MIN_PURCHASE_NOT_MET"
  | "CATEGORY_NOT_ELIGIBLE"
  | "LISTING_NOT_ELIGIBLE"
  | "SELLER_MISMATCH"
  | "TIER_NOT_ELIGIBLE"
  | "NEW_USERS_ONLY";

export type CartItem = {
  listingId: string;
  sellerId: string;
  categoryId: string;
  priceCents: number;
  quantity: number;
};

export async function validateCoupon(args: {
  code: string;
  userId: string;
  userTier: string;
  isNewUser: boolean;
  cartItems: CartItem[];
  subtotalCents: number;
  sellerId?: string; // for seller-specific coupons
}): Promise<CouponValidationResult> {
  // Normalize code
  const normalizedCode = args.code.toUpperCase().trim();
  
  // Find coupon
  const coupon = await prisma.coupon.findUnique({ 
    where: { code: normalizedCode },
    include: {
      redemptions: {
        where: { userId: args.userId },
      },
    },
  });
  
  if (!coupon) {
    return { valid: false, error: "COUPON_NOT_FOUND" };
  }
  
  // Check active status
  if (!coupon.isActive) {
    return { valid: false, error: "COUPON_INACTIVE" };
  }
  
  // Check date range
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { valid: false, error: "COUPON_NOT_STARTED" };
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { valid: false, error: "COUPON_EXPIRED" };
  }
  
  // Check global usage limit
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, error: "COUPON_LIMIT_REACHED" };
  }
  
  // Check per-user limit
  if (coupon.redemptions.length >= coupon.usagePerUser) {
    return { valid: false, error: "USER_LIMIT_REACHED" };
  }
  
  // Check minimum purchase
  if (coupon.minPurchaseCents && args.subtotalCents < coupon.minPurchaseCents) {
    return { valid: false, error: "MIN_PURCHASE_NOT_MET" };
  }
  
  // Check seller scope
  if (coupon.scope === "SELLER" && coupon.sellerId) {
    const cartSellers = new Set(args.cartItems.map(i => i.sellerId));
    if (!cartSellers.has(coupon.sellerId)) {
      return { valid: false, error: "SELLER_MISMATCH" };
    }
  }
  
  // Check category eligibility
  if (coupon.categoryIds.length > 0) {
    const cartCategories = new Set(args.cartItems.map(i => i.categoryId));
    const hasEligibleCategory = coupon.categoryIds.some(c => cartCategories.has(c));
    if (!hasEligibleCategory) {
      return { valid: false, error: "CATEGORY_NOT_ELIGIBLE" };
    }
  }
  
  // Check listing eligibility
  if (coupon.listingIds.length > 0) {
    const cartListings = new Set(args.cartItems.map(i => i.listingId));
    const hasEligibleListing = coupon.listingIds.some(l => cartListings.has(l));
    if (!hasEligibleListing) {
      return { valid: false, error: "LISTING_NOT_ELIGIBLE" };
    }
  }
  
  // Check user tier requirement
  if (coupon.userTierRequired && coupon.userTierRequired !== args.userTier) {
    return { valid: false, error: "TIER_NOT_ELIGIBLE" };
  }
  
  // Check new users only
  if (coupon.newUsersOnly && !args.isNewUser) {
    return { valid: false, error: "NEW_USERS_ONLY" };
  }

  // Check bundle exclusion (Phase 3 Bundle Builder integration)
  // If coupon excludes bundled items, filter them out
  let eligibleItems = args.cartItems;
  if (coupon.excludeBundledItems) {
    eligibleItems = args.cartItems.filter(i => !i.bundleId);
    if (eligibleItems.length === 0) {
      return { valid: false, error: "COUPON_NOT_APPLICABLE_TO_BUNDLED_ITEMS" };
    }
  }

  // Calculate discount
  const discountCents = calculateDiscount({
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountCents: coupon.maxDiscountCents,
    subtotalCents: args.subtotalCents,
    cartItems: args.cartItems,
    sellerId: coupon.sellerId,
  });
  
  return {
    valid: true,
    couponId: coupon.id,
    discountCents,
    discountType: coupon.discountType,
  };
}

function calculateDiscount(args: {
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountCents: number | null;
  subtotalCents: number;
  cartItems: CartItem[];
  sellerId: string | null;
}): number {
  // Calculate eligible subtotal (for seller-specific coupons)
  let eligibleSubtotal = args.subtotalCents;
  if (args.sellerId) {
    eligibleSubtotal = args.cartItems
      .filter(i => i.sellerId === args.sellerId)
      .reduce((sum, i) => sum + (i.priceCents * i.quantity), 0);
  }
  
  let discount = 0;
  
  switch (args.discountType) {
    case "PERCENTAGE":
      // discountValue is in basis points (e.g., 1000 = 10%)
      discount = Math.floor(eligibleSubtotal * args.discountValue / 10000);
      break;
      
    case "FIXED_AMOUNT":
      // discountValue is in cents
      discount = args.discountValue;
      break;
      
    case "FREE_SHIPPING":
      // This would be handled separately in shipping calculation
      // Return 0 here, handle in checkout
      discount = 0;
      break;
  }
  
  // Apply max discount cap
  if (args.maxDiscountCents && discount > args.maxDiscountCents) {
    discount = args.maxDiscountCents;
  }
  
  // Cannot exceed eligible subtotal
  if (discount > eligibleSubtotal) {
    discount = eligibleSubtotal;
  }
  
  return discount;
}
```

---

## 4) Coupon Redemption Service

Create `packages/core/promotions/coupon-redemption.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function redeemCoupon(args: {
  couponId: string;
  orderId: string;
  userId: string;
  discountCents: number;
  originalSubtotalCents: number;
}): Promise<{ redemptionId: string }> {
  const idempotencyKey = `coupon_redeem:${args.couponId}:${args.orderId}`;
  
  // Check idempotency
  const existing = await prisma.couponRedemption.findUnique({
    where: { idempotencyKey },
  });
  
  if (existing) {
    return { redemptionId: existing.id };
  }
  
  // Create redemption in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Increment coupon usage
    await tx.coupon.update({
      where: { id: args.couponId },
      data: { usedCount: { increment: 1 } },
    });
    
    // Create redemption record
    const redemption = await tx.couponRedemption.create({
      data: {
        couponId: args.couponId,
        orderId: args.orderId,
        userId: args.userId,
        discountCents: args.discountCents,
        originalSubtotalCents: args.originalSubtotalCents,
        idempotencyKey,
      },
    });
    
    return redemption;
  });
  
  // Emit audit event
  await emitAuditEvent({
    action: "promotion.coupon.redeemed",
    entityType: "CouponRedemption",
    entityId: result.id,
    actorUserId: args.userId,
    meta: {
      couponId: args.couponId,
      orderId: args.orderId,
      discountCents: args.discountCents,
    },
  });
  
  return { redemptionId: result.id };
}

export async function reverseRedemption(args: {
  orderId: string;
  reason: string;
  actorUserId: string;
}): Promise<void> {
  const redemption = await prisma.couponRedemption.findUnique({
    where: { orderId: args.orderId },
  });
  
  if (!redemption) return;
  
  await prisma.$transaction(async (tx) => {
    // Decrement coupon usage
    await tx.coupon.update({
      where: { id: redemption.couponId },
      data: { usedCount: { decrement: 1 } },
    });
    
    // Delete redemption
    await tx.couponRedemption.delete({
      where: { id: redemption.id },
    });
  });
  
  await emitAuditEvent({
    action: "promotion.coupon.reversed",
    entityType: "CouponRedemption",
    entityId: redemption.id,
    actorUserId: args.actorUserId,
    meta: {
      couponId: redemption.couponId,
      orderId: args.orderId,
      reason: args.reason,
    },
  });
}
```

---

## 5) Campaign Management Service

Create `packages/core/promotions/campaign-service.ts`:

```typescript
import { PrismaClient, CampaignStatus } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function createCampaign(args: {
  name: string;
  description?: string;
  type: string;
  discountType: string;
  discountValue: number;
  maxDiscountCents?: number;
  budgetCents?: number;
  startsAt: Date;
  endsAt: Date;
  scope: string;
  sellerId?: string;
  categoryIds?: string[];
  listingIds?: string[];
  createdByUserId: string;
}) {
  // Validate date range
  if (args.endsAt <= args.startsAt) {
    throw new Error("End date must be after start date");
  }
  
  // Check settings for max duration
  const settings = await getActivePromotionSettings();
  const durationDays = Math.ceil(
    (args.endsAt.getTime() - args.startsAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (settings && durationDays > settings.maxCampaignDurationDays) {
    throw new Error(`Campaign duration exceeds maximum of ${settings.maxCampaignDurationDays} days`);
  }
  
  const campaign = await prisma.promotionCampaign.create({
    data: {
      name: args.name,
      description: args.description,
      type: args.type as any,
      discountType: args.discountType as any,
      discountValue: args.discountValue,
      maxDiscountCents: args.maxDiscountCents,
      budgetCents: args.budgetCents,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      scope: args.scope as any,
      sellerId: args.sellerId,
      categoryIds: args.categoryIds ?? [],
      listingIds: args.listingIds ?? [],
      status: "DRAFT",
      createdByUserId: args.createdByUserId,
    },
  });
  
  await emitAuditEvent({
    action: "promotion.campaign.created",
    entityType: "PromotionCampaign",
    entityId: campaign.id,
    actorUserId: args.createdByUserId,
    meta: { name: args.name, type: args.type },
  });
  
  return campaign;
}

export async function activateCampaign(args: {
  campaignId: string;
  actorUserId: string;
}) {
  const campaign = await prisma.promotionCampaign.findUnique({
    where: { id: args.campaignId },
  });
  
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw new Error("Campaign cannot be activated from current status");
  }
  
  const now = new Date();
  let newStatus: CampaignStatus = "ACTIVE";
  
  if (campaign.startsAt > now) {
    newStatus = "SCHEDULED";
  }
  
  const updated = await prisma.promotionCampaign.update({
    where: { id: args.campaignId },
    data: { status: newStatus },
  });
  
  await emitAuditEvent({
    action: `promotion.campaign.${newStatus.toLowerCase()}`,
    entityType: "PromotionCampaign",
    entityId: campaign.id,
    actorUserId: args.actorUserId,
  });
  
  return updated;
}

export async function pauseCampaign(args: {
  campaignId: string;
  actorUserId: string;
}) {
  const updated = await prisma.promotionCampaign.update({
    where: { id: args.campaignId },
    data: { status: "PAUSED" },
  });
  
  await emitAuditEvent({
    action: "promotion.campaign.paused",
    entityType: "PromotionCampaign",
    entityId: args.campaignId,
    actorUserId: args.actorUserId,
  });
  
  return updated;
}

export async function endCampaign(args: {
  campaignId: string;
  actorUserId: string;
}) {
  const updated = await prisma.promotionCampaign.update({
    where: { id: args.campaignId },
    data: { status: "ENDED" },
  });
  
  await emitAuditEvent({
    action: "promotion.campaign.ended",
    entityType: "PromotionCampaign",
    entityId: args.campaignId,
    actorUserId: args.actorUserId,
  });
  
  return updated;
}

async function getActivePromotionSettings() {
  return prisma.promotionSettings.findFirst({
    where: {
      isActive: true,
      effectiveAt: { lte: new Date() },
    },
    orderBy: { effectiveAt: "desc" },
  });
}
```

---

## 6) Checkout Integration

Update checkout flow to apply coupons:

```typescript
// In packages/core/checkout/apply-discount.ts

import { validateCoupon, CouponValidationResult } from "../promotions/coupon-validator";
import { redeemCoupon } from "../promotions/coupon-redemption";

export async function applyDiscountToCheckout(args: {
  couponCode: string | null;
  userId: string;
  userTier: string;
  isNewUser: boolean;
  cartItems: CartItem[];
  subtotalCents: number;
}): Promise<{
  discountCents: number;
  couponId: string | null;
  freeShipping: boolean;
}> {
  if (!args.couponCode) {
    return { discountCents: 0, couponId: null, freeShipping: false };
  }
  
  const validation = await validateCoupon({
    code: args.couponCode,
    userId: args.userId,
    userTier: args.userTier,
    isNewUser: args.isNewUser,
    cartItems: args.cartItems,
    subtotalCents: args.subtotalCents,
  });
  
  if (!validation.valid) {
    throw new Error(`COUPON_ERROR:${validation.error}`);
  }
  
  return {
    discountCents: validation.discountCents,
    couponId: validation.couponId,
    freeShipping: validation.discountType === "FREE_SHIPPING",
  };
}

export async function finalizeDiscountOnPayment(args: {
  couponId: string | null;
  orderId: string;
  userId: string;
  discountCents: number;
  subtotalCents: number;
}): Promise<void> {
  if (!args.couponId || args.discountCents === 0) return;
  
  await redeemCoupon({
    couponId: args.couponId,
    orderId: args.orderId,
    userId: args.userId,
    discountCents: args.discountCents,
    originalSubtotalCents: args.subtotalCents,
  });
}
```

---

## 7) Ledger Integration

Create ledger entry for promotional discounts:

```typescript
// Add to packages/core/ledger/promotion-entry.ts

import { PrismaClient, LedgerEntryType, LedgerDirection } from "@prisma/client";

const prisma = new PrismaClient();

export async function postPromotionDiscountLedgerEntry(args: {
  orderId: string;
  sellerId: string;
  discountCents: number;
  couponId: string;
  redemptionId: string;
}): Promise<void> {
  const ledgerKey = `stripe:promotion:${args.orderId}:PROMOTION_DISCOUNT`;
  
  await prisma.ledgerEntry.upsert({
    where: { ledgerKey },
    update: {},
    create: {
      ledgerKey,
      provider: "stripe",
      providerObjectType: "promotion",
      providerObjectId: args.couponId,
      sellerId: args.sellerId,
      orderId: args.orderId,
      type: "PROMOTION_FEE",
      direction: "CREDIT", // Credit to seller since platform absorbs discount
      amountCents: args.discountCents,
      currency: "USD",
      occurredAt: new Date(),
      metadataJson: {
        couponId: args.couponId,
        redemptionId: args.redemptionId,
      },
    },
  });
}
```

---

## 8) Seller APIs

```typescript
// GET /api/seller/coupons
// POST /api/seller/coupons
// PUT /api/seller/coupons/:id
// DELETE /api/seller/coupons/:id (soft delete - sets isActive: false)
// GET /api/seller/coupons/:id/analytics

// GET /api/seller/campaigns
// POST /api/seller/campaigns
// PUT /api/seller/campaigns/:id
// POST /api/seller/campaigns/:id/activate
// POST /api/seller/campaigns/:id/pause
// POST /api/seller/campaigns/:id/end
// GET /api/seller/campaigns/:id/analytics
```

---

## 9) Corp APIs

```typescript
// GET /api/platform/promotions/coupons
// POST /api/platform/promotions/coupons (platform-scope)
// PUT /api/platform/promotions/coupons/:id
// DELETE /api/platform/promotions/coupons/:id

// GET /api/platform/promotions/campaigns
// POST /api/platform/promotions/campaigns (platform-scope)
// PUT /api/platform/promotions/campaigns/:id
// POST /api/platform/promotions/campaigns/:id/activate
// POST /api/platform/promotions/campaigns/:id/pause

// GET /api/platform/promotions/analytics
// GET /api/platform/promotions/settings/current
// POST /api/platform/promotions/settings

// RBAC: requires "promotions.view" / "promotions.manage"
```

---

## 10) Health Provider

Create `packages/core/health/providers/promotions.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const promotionsHealthProvider: HealthProvider = {
  id: "promotions",
  label: "Promotions & Coupons",
  description: "Coupon and campaign health",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;

    // Check 1: Active coupons exist
    const activeCoupons = await prisma.coupon.count({ where: { isActive: true } });
    checks.push({
      id: "coupons_accessible",
      label: "Coupon table accessible",
      status: HEALTH_STATUS.PASS,
      message: `${activeCoupons} active coupons`,
    });

    // Check 2: No expired coupons marked active
    const expiredActive = await prisma.coupon.count({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
    });
    checks.push({
      id: "no_expired_active_coupons",
      label: "No expired coupons marked active",
      status: expiredActive === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: expiredActive === 0 ? "None" : `${expiredActive} expired but active`,
    });
    if (expiredActive > 0 && status !== HEALTH_STATUS.FAIL) status = HEALTH_STATUS.WARN;

    // Check 3: Campaigns with passed end dates are ended
    const overdueActive = await prisma.promotionCampaign.count({
      where: {
        status: "ACTIVE",
        endsAt: { lt: new Date() },
      },
    });
    checks.push({
      id: "no_overdue_active_campaigns",
      label: "No overdue active campaigns",
      status: overdueActive === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: overdueActive === 0 ? "None" : `${overdueActive} should be ended`,
    });
    if (overdueActive > 0 && status !== HEALTH_STATUS.FAIL) status = HEALTH_STATUS.WARN;

    // Check 4: Promotion settings exist
    const settingsExist = await prisma.promotionSettings.count({ where: { isActive: true } }) > 0;
    checks.push({
      id: "settings_exist",
      label: "Promotion settings configured",
      status: settingsExist ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: settingsExist ? "Configured" : "Using defaults",
    });

    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS ? "Promotions healthy" : "Promotion issues detected",
      providerVersion: this.version,
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
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

## 11) Doctor Checks (Phase 22)

```typescript
async function checkPromotions() {
  const checks = [];

  // 1. Create coupon
  const testCoupon = await prisma.coupon.create({
    data: {
      code: `DOCTOR_TEST_${Date.now()}`,
      name: "Doctor Test Coupon",
      scope: "PLATFORM",
      discountType: "PERCENTAGE",
      discountValue: 1000, // 10%
      isActive: true,
      createdByUserId: "doctor",
    },
  });
  checks.push({
    key: "promotions.coupon_create",
    ok: testCoupon.code !== null,
    details: `Created coupon ${testCoupon.code}`,
  });

  // 2. Validate coupon
  const validation = await validateCoupon({
    code: testCoupon.code,
    userId: "doctor_user",
    userTier: "STARTER",
    isNewUser: false,
    cartItems: [{ listingId: "l1", sellerId: "s1", categoryId: "c1", priceCents: 1000, quantity: 1 }],
    subtotalCents: 1000,
  });
  checks.push({
    key: "promotions.coupon_validate",
    ok: validation.valid === true,
    details: validation.valid ? `Discount: ${validation.discountCents}` : `Error: ${validation.error}`,
  });

  // 3. Test expired coupon rejection
  const expiredCoupon = await prisma.coupon.create({
    data: {
      code: `EXPIRED_TEST_${Date.now()}`,
      name: "Expired Coupon",
      scope: "PLATFORM",
      discountType: "FIXED_AMOUNT",
      discountValue: 500,
      expiresAt: new Date(Date.now() - 86400000), // yesterday
      isActive: true,
      createdByUserId: "doctor",
    },
  });
  const expiredValidation = await validateCoupon({
    code: expiredCoupon.code,
    userId: "doctor_user",
    userTier: "STARTER",
    isNewUser: false,
    cartItems: [{ listingId: "l1", sellerId: "s1", categoryId: "c1", priceCents: 1000, quantity: 1 }],
    subtotalCents: 1000,
  });
  checks.push({
    key: "promotions.expired_coupon_rejected",
    ok: expiredValidation.valid === false && expiredValidation.error === "COUPON_EXPIRED",
    details: expiredValidation.valid ? "ERROR: Should reject" : "Correctly rejected",
  });

  // 4. Test usage limit
  const limitedCoupon = await prisma.coupon.create({
    data: {
      code: `LIMITED_TEST_${Date.now()}`,
      name: "Limited Coupon",
      scope: "PLATFORM",
      discountType: "FIXED_AMOUNT",
      discountValue: 500,
      usageLimit: 1,
      usedCount: 1, // already used
      isActive: true,
      createdByUserId: "doctor",
    },
  });
  const limitValidation = await validateCoupon({
    code: limitedCoupon.code,
    userId: "doctor_user",
    userTier: "STARTER",
    isNewUser: false,
    cartItems: [{ listingId: "l1", sellerId: "s1", categoryId: "c1", priceCents: 1000, quantity: 1 }],
    subtotalCents: 1000,
  });
  checks.push({
    key: "promotions.usage_limit_enforced",
    ok: limitValidation.valid === false && limitValidation.error === "COUPON_LIMIT_REACHED",
    details: limitValidation.valid ? "ERROR: Should reject" : "Correctly rejected",
  });

  // 5. Test min purchase
  const minPurchaseCoupon = await prisma.coupon.create({
    data: {
      code: `MINPURCHASE_TEST_${Date.now()}`,
      name: "Min Purchase Coupon",
      scope: "PLATFORM",
      discountType: "FIXED_AMOUNT",
      discountValue: 500,
      minPurchaseCents: 5000,
      isActive: true,
      createdByUserId: "doctor",
    },
  });
  const minValidation = await validateCoupon({
    code: minPurchaseCoupon.code,
    userId: "doctor_user",
    userTier: "STARTER",
    isNewUser: false,
    cartItems: [{ listingId: "l1", sellerId: "s1", categoryId: "c1", priceCents: 1000, quantity: 1 }],
    subtotalCents: 1000, // below min
  });
  checks.push({
    key: "promotions.min_purchase_enforced",
    ok: minValidation.valid === false && minValidation.error === "MIN_PURCHASE_NOT_MET",
    details: minValidation.valid ? "ERROR: Should reject" : "Correctly rejected",
  });

  // 6. Test redemption and usage increment
  const redemptionTestCoupon = await prisma.coupon.create({
    data: {
      code: `REDEMPTION_TEST_${Date.now()}`,
      name: "Redemption Test",
      scope: "PLATFORM",
      discountType: "FIXED_AMOUNT",
      discountValue: 500,
      usedCount: 0,
      isActive: true,
      createdByUserId: "doctor",
    },
  });
  await redeemCoupon({
    couponId: redemptionTestCoupon.id,
    orderId: `doctor_order_${Date.now()}`,
    userId: "doctor_user",
    discountCents: 500,
    originalSubtotalCents: 1000,
  });
  const afterRedemption = await prisma.coupon.findUnique({ where: { id: redemptionTestCoupon.id } });
  checks.push({
    key: "promotions.redemption_increments_usage",
    ok: afterRedemption?.usedCount === 1,
    details: `usedCount: ${afterRedemption?.usedCount}`,
  });

  // Cleanup
  await prisma.couponRedemption.deleteMany({ where: { couponId: redemptionTestCoupon.id } });
  await prisma.coupon.deleteMany({
    where: {
      createdByUserId: "doctor",
    },
  });

  return checks;
}
```

---

## 12) Phase 22 Completion Criteria

- [ ] Coupon, CouponRedemption, PromotionCampaign, PromotionSettings tables created
- [ ] Coupon validation enforces all rules (expiry, limits, min purchase, targeting)
- [ ] Redemption increments usage count
- [ ] Redemption is idempotent
- [ ] Seller can create coupons for their listings
- [ ] Platform can create marketplace-wide coupons
- [ ] Campaign lifecycle (draft → active → paused → ended) works
- [ ] Checkout applies discount correctly
- [ ] Ledger entry posted for promotional discounts
- [ ] Health provider `promotions` reports status
- [ ] Doctor passes all Phase 22 checks

---

## 13) Canonical Alignment Notes

| Canonical Requirement | Implementation |
|----------------------|----------------|
| Effective-dated settings | PromotionSettings with effectiveAt |
| Ledger integration | PROMOTION_FEE entry type |
| Idempotent redemption | idempotencyKey on CouponRedemption |
| Audit trail | AuditEvent on all coupon/campaign actions |
| RBAC gating | promotions.view / promotions.manage scopes |

---

## 14) Bundle and Coupon Stacking Rules (Phase 3 Integration)

When both seller bundles and coupons apply to the same order:

| Scenario | Behavior |
|----------|----------|
| Bundle discount + percentage coupon | Bundle applied first, then coupon on remaining |
| Bundle discount + fixed amount coupon | Bundle applied first, then fixed deduction |
| Bundle discount + free shipping coupon | Both apply (different discount types) |
| Coupon excludes bundled items | Bundle discount only, coupon skipped |

### Calculation Order

1. Calculate item subtotal
2. Apply bundle discount (if any)
3. Calculate coupon eligibility on post-bundle subtotal
4. Apply coupon discount (if eligible)
5. Add shipping (may be $0 if free shipping earned)
6. Add tax on final amount

### Platform Settings

| Setting | Default | Description |
|---------|---------|-------------|
| ALLOW_BUNDLE_COUPON_STACK | true | Allow coupons on bundled orders |
| MAX_COMBINED_DISCOUNT_PERCENT | 75 | Cap total discount at 75% |

---

## 15) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 22 implementation |
| 1.1 | 2026-01-22 | Phase 3 Integration: Bundle exclusion flag, stacking rules |
