# TWICELY V2 — Install Phase 38: Buyer Protection UX + Returns Automation
**Status:** LOCKED (v2.0)  
**Backend-first:** Schema → Policy Engine → Claims → Automation → Refunds → Health → Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_RETURNS_REFUNDS_DISPUTES_CANONICAL.md`
- `/rules/TWICELY_BUYER_EXPERIENCE_CANONICAL.md`
- `/rules/TWICELY_TRUST_SAFETY_CANONICAL.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_38_BUYER_PROTECTION.md`  
> Prereq: Phase 37 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Buyer protection claim workflow
- Return policy engine (category-based rules)
- Category-specific coverage limits (NEW)
- Seller protection score (0-100) (NEW)
- Seller appeal process (NEW)
- Automated refund triggers by rule evaluation
- Return shipping responsibility determination
- Claim escalation to support
- Dispute timeline tracking (NEW)

### UI (Buyer)
- Order Detail → "I have a problem" → Claim Wizard
- Claim Status → Track resolution with timeline (NEW)
- Return Label → Download (if provided)
- Protection badge on all listings (NEW)

### UI (Seller)
- Seller → Returns → Incoming Returns Queue
- Seller → Returns → Respond to Claim
- Seller → Dashboard → Protection Score (NEW)
- Seller → Appeals → File/Track Appeals (NEW)

### UI (Corp)
- Corp → Returns → Escalated Claims
- Corp → Returns → Policy Configuration
- Corp → Protection → Category Coverage Limits (NEW)
- Corp → Protection → Seller Appeals Queue (NEW)

### Public
- `/protection` — Public transparency page (NEW)

### Ops
- Health provider: `buyer_protection`
- Doctor checks: claim creation, policy evaluation, auto-refunds, shipping assignment, protection scores

---

## 1) Buyer Protection Invariants (non-negotiable)

- Buyers can always file a claim within return window
- Policy rules determine return eligibility + shipping responsibility
- Automated refunds have spending limits
- Escalation path to human review always available
- All claim actions are audited
- Protection badges show coverage status on all listings
- Sellers can appeal decisions with evidence

Claim types:
- `ITEM_NOT_RECEIVED` — Item never arrived
- `ITEM_NOT_AS_DESCRIBED` — Item differs from listing
- `ITEM_DAMAGED` — Item arrived damaged
- `COUNTERFEIT` — Item is counterfeit
- `BUYER_REMORSE` — Buyer changed mind (if policy allows)
- `OTHER` — Other issues

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
// =============================================================================
// BUYER PROTECTION CLAIMS
// =============================================================================

model BuyerProtectionClaim {
  id                    String    @id @default(cuid())
  orderId               String
  buyerId               String
  sellerId              String
  type                  ClaimType
  status                ClaimStatus @default(OPEN)
  description           String
  evidenceUrls          String[]
  buyerPaysReturn       Boolean   @default(false)
  refundAmountCents     Int?
  refundType            RefundType?
  returnRequired        Boolean   @default(false)
  returnTrackingNumber  String?
  resolution            ClaimResolution?
  resolvedAt            DateTime?
  resolvedByType        ResolverType?
  resolvedById          String?
  sellerResponseDeadline DateTime?
  escalatedAt           DateTime?
  
  // NEW: Protection Plus fields
  coverageLimitCents    Int?                    // Category-specific coverage limit
  coveragePercentUsed   Int?                    // How much of coverage used (0-100)
  appealId              String?                 // Link to seller appeal if filed
  timelineEvents        Json      @default("[]") // Timeline of all events
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  order    Order   @relation(fields: [orderId], references: [id])
  buyer    User    @relation("BuyerClaims", fields: [buyerId], references: [id])
  seller   User    @relation("SellerClaims", fields: [sellerId], references: [id])
  messages BuyerProtectionClaimMessage[]
  appeal   SellerAppeal? @relation(fields: [appealId], references: [id])

  @@index([orderId])
  @@index([buyerId, createdAt])
  @@index([sellerId, status])
  @@index([status, createdAt])
}

enum ClaimType {
  ITEM_NOT_RECEIVED
  ITEM_NOT_AS_DESCRIBED
  ITEM_DAMAGED
  COUNTERFEIT
  BUYER_REMORSE
  OTHER
}

enum ClaimStatus {
  OPEN
  SELLER_RESPONSE
  ESCALATED
  UNDER_REVIEW
  RESOLVED
  CLOSED
  APPEALED
}

enum ClaimResolution {
  REFUNDED
  PARTIAL_REFUND
  REPLACED
  DENIED
  WITHDRAWN
  APPEAL_GRANTED
}

enum RefundType {
  FULL
  PARTIAL
  NONE
}

enum ResolverType {
  AUTO
  SELLER
  STAFF
  APPEAL
}

model BuyerProtectionClaimMessage {
  id          String    @id @default(cuid())
  claimId     String
  authorType  AuthorType
  authorId    String
  body        String
  attachments String[]
  isInternal  Boolean   @default(false)  // Staff-only notes
  createdAt   DateTime  @default(now())

  claim BuyerProtectionClaim @relation(fields: [claimId], references: [id])

  @@index([claimId, createdAt])
}

enum AuthorType {
  BUYER
  SELLER
  STAFF
}

// =============================================================================
// RETURN POLICIES
// =============================================================================

model ReturnPolicy {
  id                      String    @id @default(cuid())
  name                    String
  categoryIds             String[]
  sellerId                String?
  returnWindowDays        Int       @default(30)
  acceptsReturns          Boolean   @default(true)
  buyerPaysReturnShipping Boolean   @default(false)
  restockingFeeBps        Int       @default(0)
  conditionRequired       String    @default("any")
  isActive                Boolean   @default(true)
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  seller User? @relation(fields: [sellerId], references: [id])

  @@index([sellerId])
  @@index([isActive])
}

// =============================================================================
// CATEGORY COVERAGE LIMITS (NEW)
// =============================================================================

model CategoryCoverageLimit {
  id                  String   @id @default(cuid())
  categoryId          String   @unique
  maxCoverageCents    Int                         // Max refund for this category
  deductibleCents     Int      @default(0)        // Buyer deductible
  requiresEvidence    Boolean  @default(true)     // Photos required
  autoApproveUnder    Int?                        // Auto-approve claims under this amount
  specialRules        Json     @default("{}")     // Category-specific rules
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  category Category @relation(fields: [categoryId], references: [id])

  @@index([isActive])
}

// =============================================================================
// SELLER PROTECTION SCORE (NEW)
// =============================================================================

model SellerProtectionScore {
  id                    String   @id @default(cuid())
  sellerId              String   @unique
  score                 Int      @default(100)    // 0-100, starts at 100
  claimsLast90Days      Int      @default(0)
  claimsResolvedFavorably Int    @default(0)      // Resolved in seller's favor
  claimsLostCount       Int      @default(0)
  appealWinRate         Decimal  @default(0) @db.Decimal(5, 2)
  averageResponseHours  Decimal? @db.Decimal(5, 2)
  lastComputedAt        DateTime @default(now())
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  seller User @relation(fields: [sellerId], references: [id])
}

// =============================================================================
// SELLER APPEALS (NEW)
// =============================================================================

model SellerAppeal {
  id                String       @id @default(cuid())
  claimId           String       @unique
  sellerId          String
  reason            AppealReason
  description       String
  evidenceUrls      String[]
  status            AppealStatus @default(PENDING)
  reviewedById      String?
  reviewedAt        DateTime?
  decision          AppealDecision?
  decisionNotes     String?
  originalResolution String?
  newResolution     String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  claim    BuyerProtectionClaim[]
  seller   User    @relation("SellerAppeals", fields: [sellerId], references: [id])
  reviewer User?   @relation("AppealReviewer", fields: [reviewedById], references: [id])

  @@index([sellerId, status])
  @@index([status, createdAt])
}

enum AppealReason {
  BUYER_ABUSE
  EVIDENCE_INVALID
  POLICY_MISAPPLIED
  ITEM_RETURNED_DAMAGED
  TRACKING_SHOWS_DELIVERED
  OTHER
}

enum AppealStatus {
  PENDING
  UNDER_REVIEW
  APPROVED
  DENIED
  WITHDRAWN
}

enum AppealDecision {
  OVERTURN_FULL       // Full reversal - seller gets funds back
  OVERTURN_PARTIAL    // Partial reversal
  UPHELD              // Original decision stands
  MODIFIED            // Modified but not fully overturned
}

// =============================================================================
// AUTO-REFUND RULES
// =============================================================================

model AutoRefundRule {
  id              String    @id @default(cuid())
  name            String
  claimType       ClaimType
  maxAmountCents  Int
  conditions      Json      @default("{}")
  priority        Int       @default(0)
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())

  @@index([claimType, isActive])
}

// =============================================================================
// REFUND RECORDS
// =============================================================================

model RefundRecord {
  id              String    @id @default(cuid())
  claimId         String?
  orderId         String
  amountCents     Int
  reason          String
  status          RefundStatus @default(PENDING)
  processedAt     DateTime?
  stripeRefundId  String?
  createdAt       DateTime  @default(now())
  
  claim BuyerProtectionClaim? @relation(fields: [claimId], references: [id])
  order Order @relation(fields: [orderId], references: [id])

  @@index([orderId])
  @@index([claimId])
  @@index([status])
}

enum RefundStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  REVERSED
}

// =============================================================================
// RETURN SHIPMENTS
// =============================================================================

model ReturnShipment {
  id              String    @id @default(cuid())
  claimId         String
  orderId         String
  paidBy          ShippingPayer
  costCents       Int
  carrier         String?
  trackingNumber  String?
  labelUrl        String?
  status          ReturnShipmentStatus @default(PENDING)
  shippedAt       DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime  @default(now())
  
  claim BuyerProtectionClaim @relation(fields: [claimId], references: [id])
  order Order @relation(fields: [orderId], references: [id])

  @@index([claimId])
  @@index([orderId])
  @@index([status])
}

enum ShippingPayer {
  BUYER
  SELLER
  PLATFORM
}

enum ReturnShipmentStatus {
  PENDING
  LABEL_CREATED
  SHIPPED
  DELIVERED
  CANCELLED
}
```

Migration:
```bash
npx prisma migrate dev --name buyer_protection_plus_phase38
```

---

## 3) Platform Settings

```typescript
// packages/core/config/buyerProtectionSettings.ts

export const BUYER_PROTECTION_SETTINGS = {
  // Claim Windows
  CLAIM_WINDOW_DAYS_DEFAULT: 30,
  CLAIM_WINDOW_DAYS_COUNTERFEIT: 180,
  CLAIM_WINDOW_DAYS_ITEM_NOT_RECEIVED: 30,
  
  // Response Deadlines
  SELLER_RESPONSE_DEADLINE_HOURS: 72,
  ESCALATION_AUTO_AFTER_HOURS: 96,
  APPEAL_WINDOW_DAYS: 30,
  
  // Auto-Refund
  AUTO_REFUND_MAX_CENTS: 10000,           // $100 max auto-refund
  AUTO_REFUND_NO_TRACKING_ENABLED: true,
  AUTO_REFUND_NO_DELIVERY_CONFIRM: true,
  
  // Seller Protection Score
  PROTECTION_SCORE_CLAIM_PENALTY: 5,      // Lose 5 points per claim lost
  PROTECTION_SCORE_APPEAL_WIN_BONUS: 3,   // Gain 3 points per appeal won
  PROTECTION_SCORE_MIN: 0,
  PROTECTION_SCORE_MAX: 100,
  PROTECTION_SCORE_RECOMPUTE_HOURS: 24,
  
  // Appeals
  APPEAL_EVIDENCE_REQUIRED: true,
  APPEAL_REVIEW_SLA_HOURS: 48,
  APPEAL_MAX_PER_CLAIM: 1,
  
  // Coverage Limits
  DEFAULT_COVERAGE_LIMIT_CENTS: 500000,   // $5,000 default max
  COVERAGE_DEDUCTIBLE_CENTS: 0,
  
  // UI Badges
  SHOW_PROTECTION_BADGES: true,
  PROTECTION_BADGE_TEXT: "Buyer Protection",
  
  // Abuse Prevention
  MAX_CLAIMS_PER_BUYER_90_DAYS: 5,
  ABUSE_FLAG_THRESHOLD: 3,
  
  // Restocking
  MAX_RESTOCKING_FEE_BPS: 1500,           // 15% max
} as const;
```

---

## 4) Money-Back Guarantee Coverage Engine

Create `packages/core/buyer-protection/coverage.ts`:

```typescript
import { PrismaClient, ClaimType } from "@prisma/client";
import { BUYER_PROTECTION_SETTINGS as SETTINGS } from "../config/buyerProtectionSettings";

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

export type CoverageDecision = {
  covered: boolean;
  coverageType: "full" | "partial" | "none";
  maxRefundCents: number;
  coverageLimitCents: number;
  deductibleCents: number;
  reason: string;
  buyerResponsibilities: string[];
  sellerResponsibilities: string[];
  returnRequired: boolean;
  returnShippingPaidBy: "buyer" | "seller" | "platform";
  estimatedResolutionDays: number;
  autoApproveEligible: boolean;
};

export type CoverageContext = {
  orderId: string;
  claimType: ClaimType;
  orderTotalCents: number;
  categoryId?: string;
  daysSinceDelivery: number;
  daysSincePurchase: number;
  itemConditionReported?: string;
  hasTrackingProof: boolean;
  hasDeliveryConfirmation: boolean;
  sellerResponseRequired: boolean;
  previousClaimsByBuyer: number;
  sellerProtectionScore: number;
};

// =============================================================================
// COVERAGE RULES (eBay Money Back Guarantee Equivalent)
// =============================================================================

const COVERAGE_RULES = {
  ITEM_NOT_RECEIVED: {
    maxDaysFromPurchase: 30,
    waitForDeliveryDays: 3,
    autoApproveIfNoTracking: true,
    autoApproveIfNoDeliveryConfirmation: true,
    returnRequired: false,
    coveragePercent: 100,
    sellerMustProvideProof: true,
  },
  
  ITEM_NOT_AS_DESCRIBED: {
    maxDaysFromDelivery: 30,
    returnRequired: true,
    returnPaidBy: "seller" as const,
    coveragePercent: 100,
    requiresEvidence: true,
    autoApproveEligible: false,
  },
  
  ITEM_DAMAGED: {
    maxDaysFromDelivery: 30,
    returnRequired: true,
    returnPaidBy: "seller" as const,
    coveragePercent: 100,
    requiresPhotos: true,
    reportToCarrierRequired: true,
  },
  
  COUNTERFEIT: {
    maxDaysFromDelivery: 180,
    returnRequired: false,
    coveragePercent: 100,
    autoEscalateToTrust: true,
    sellerAccountReview: true,
  },
  
  BUYER_REMORSE: {
    maxDaysFromDelivery: 30,
    returnRequired: true,
    returnPaidBy: "buyer" as const,
    coveragePercent: 0,
    restockingFeeAllowed: true,
    maxRestockingFeeBps: 1500,
    subjectToSellerPolicy: true,
  },
  
  OTHER: {
    maxDaysFromDelivery: 30,
    returnRequired: true,
    returnPaidBy: "seller" as const,
    coveragePercent: 100,
    autoApproveEligible: false,
  },
};

// =============================================================================
// CATEGORY COVERAGE LIMITS (NEW)
// =============================================================================

export async function getCategoryCoverageLimit(categoryId?: string): Promise<{
  maxCoverageCents: number;
  deductibleCents: number;
  requiresEvidence: boolean;
  autoApproveUnder: number | null;
}> {
  if (!categoryId) {
    return {
      maxCoverageCents: SETTINGS.DEFAULT_COVERAGE_LIMIT_CENTS,
      deductibleCents: SETTINGS.COVERAGE_DEDUCTIBLE_CENTS,
      requiresEvidence: true,
      autoApproveUnder: null,
    };
  }
  
  const limit = await prisma.categoryCoverageLimit.findUnique({
    where: { categoryId, isActive: true },
  });
  
  if (!limit) {
    return {
      maxCoverageCents: SETTINGS.DEFAULT_COVERAGE_LIMIT_CENTS,
      deductibleCents: SETTINGS.COVERAGE_DEDUCTIBLE_CENTS,
      requiresEvidence: true,
      autoApproveUnder: null,
    };
  }
  
  return {
    maxCoverageCents: limit.maxCoverageCents,
    deductibleCents: limit.deductibleCents,
    requiresEvidence: limit.requiresEvidence,
    autoApproveUnder: limit.autoApproveUnder,
  };
}

// =============================================================================
// COVERAGE DETERMINATION
// =============================================================================

export async function determineCoverage(
  context: CoverageContext
): Promise<CoverageDecision> {
  const rules = COVERAGE_RULES[context.claimType];
  
  if (!rules) {
    return notCovered("UNKNOWN_CLAIM_TYPE", "This claim type is not recognized");
  }
  
  // Get category-specific limits
  const categoryLimits = await getCategoryCoverageLimit(context.categoryId);
  
  // Check time window
  if (context.claimType === "ITEM_NOT_RECEIVED") {
    if (context.daysSincePurchase > rules.maxDaysFromPurchase) {
      return notCovered("WINDOW_EXPIRED", "Claim window has expired (30 days from purchase)");
    }
  } else if ("maxDaysFromDelivery" in rules) {
    if (context.daysSinceDelivery > rules.maxDaysFromDelivery) {
      return notCovered("WINDOW_EXPIRED", `Claim window has expired (${rules.maxDaysFromDelivery} days from delivery)`);
    }
  }
  
  // Check for abuse
  if (context.previousClaimsByBuyer > SETTINGS.MAX_CLAIMS_PER_BUYER_90_DAYS) {
    return notCovered("ABUSE_SUSPECTED", "Account flagged for review due to claim history");
  }
  
  // Calculate max refund with category limits
  const maxRefundCents = Math.min(
    context.orderTotalCents,
    categoryLimits.maxCoverageCents
  ) - categoryLimits.deductibleCents;
  
  // Check auto-approve eligibility based on category limits
  let autoApproveEligible = false;
  if (categoryLimits.autoApproveUnder && context.orderTotalCents <= categoryLimits.autoApproveUnder) {
    autoApproveEligible = true;
  }
  
  // Build decision based on claim type
  switch (context.claimType) {
    case "ITEM_NOT_RECEIVED":
      return handleItemNotReceived(context, rules, maxRefundCents, categoryLimits, autoApproveEligible);
    
    case "ITEM_NOT_AS_DESCRIBED":
      return handleItemNotAsDescribed(context, rules, maxRefundCents, categoryLimits);
    
    case "ITEM_DAMAGED":
      return handleItemDamaged(context, rules, maxRefundCents, categoryLimits);
    
    case "COUNTERFEIT":
      return handleCounterfeit(context, rules, maxRefundCents, categoryLimits);
    
    case "BUYER_REMORSE":
      return handleBuyerRemorse(context, rules, categoryLimits);
    
    default:
      return handleOther(context, maxRefundCents, categoryLimits);
  }
}

function handleItemNotReceived(
  context: CoverageContext,
  rules: typeof COVERAGE_RULES.ITEM_NOT_RECEIVED,
  maxRefundCents: number,
  limits: Awaited<ReturnType<typeof getCategoryCoverageLimit>>,
  categoryAutoApprove: boolean
): CoverageDecision {
  const autoApprove = categoryAutoApprove ||
    (rules.autoApproveIfNoTracking && !context.hasTrackingProof) ||
    (rules.autoApproveIfNoDeliveryConfirmation && !context.hasDeliveryConfirmation);
  
  return {
    covered: true,
    coverageType: "full",
    maxRefundCents,
    coverageLimitCents: limits.maxCoverageCents,
    deductibleCents: limits.deductibleCents,
    reason: "ITEM_NOT_RECEIVED_COVERED",
    buyerResponsibilities: [
      "Wait for seller response (3 business days)",
      "Provide any relevant communication about the delivery",
    ],
    sellerResponsibilities: [
      "Provide tracking information with delivery confirmation",
      "Respond within 3 business days",
      "If no proof of delivery, issue refund",
    ],
    returnRequired: false,
    returnShippingPaidBy: "seller",
    estimatedResolutionDays: autoApprove ? 1 : 5,
    autoApproveEligible: autoApprove,
  };
}

function handleItemNotAsDescribed(
  context: CoverageContext,
  rules: typeof COVERAGE_RULES.ITEM_NOT_AS_DESCRIBED,
  maxRefundCents: number,
  limits: Awaited<ReturnType<typeof getCategoryCoverageLimit>>
): CoverageDecision {
  return {
    covered: true,
    coverageType: "full",
    maxRefundCents,
    coverageLimitCents: limits.maxCoverageCents,
    deductibleCents: limits.deductibleCents,
    reason: "ITEM_NOT_AS_DESCRIBED_COVERED",
    buyerResponsibilities: [
      "Provide clear photos showing the discrepancy",
      "Describe how item differs from listing",
      "Return item in original condition within 5 business days of approval",
    ],
    sellerResponsibilities: [
      "Respond to claim within 3 business days",
      "Accept return if claim is valid",
      "Provide prepaid return shipping label",
      "Issue full refund upon receipt of returned item",
    ],
    returnRequired: true,
    returnShippingPaidBy: "seller",
    estimatedResolutionDays: 7,
    autoApproveEligible: false,
  };
}

function handleItemDamaged(
  context: CoverageContext,
  rules: typeof COVERAGE_RULES.ITEM_DAMAGED,
  maxRefundCents: number,
  limits: Awaited<ReturnType<typeof getCategoryCoverageLimit>>
): CoverageDecision {
  return {
    covered: true,
    coverageType: "full",
    maxRefundCents,
    coverageLimitCents: limits.maxCoverageCents,
    deductibleCents: limits.deductibleCents,
    reason: "ITEM_DAMAGED_COVERED",
    buyerResponsibilities: [
      "Provide photos of damaged item",
      "Retain original packaging if possible",
      "Report damage to carrier if requested",
      "Return item if requested by seller",
    ],
    sellerResponsibilities: [
      "Respond within 3 business days",
      "Issue refund OR file carrier insurance claim",
      "Pay for return shipping if return is required",
    ],
    returnRequired: rules.returnRequired,
    returnShippingPaidBy: "seller",
    estimatedResolutionDays: 5,
    autoApproveEligible: false,
  };
}

function handleCounterfeit(
  context: CoverageContext,
  rules: typeof COVERAGE_RULES.COUNTERFEIT,
  maxRefundCents: number,
  limits: Awaited<ReturnType<typeof getCategoryCoverageLimit>>
): CoverageDecision {
  return {
    covered: true,
    coverageType: "full",
    maxRefundCents,
    coverageLimitCents: limits.maxCoverageCents,
    deductibleCents: limits.deductibleCents,
    reason: "COUNTERFEIT_COVERED",
    buyerResponsibilities: [
      "Provide evidence of authenticity concerns",
      "DO NOT return the item (will be destroyed/surrendered to authorities)",
      "Cooperate with any brand authentication process",
    ],
    sellerResponsibilities: [
      "Account will be reviewed for authenticity violations",
      "Refund will be issued automatically",
      "Repeated violations may result in account suspension",
    ],
    returnRequired: false,
    returnShippingPaidBy: "platform",
    estimatedResolutionDays: 3,
    autoApproveEligible: true,
  };
}

function handleBuyerRemorse(
  context: CoverageContext,
  rules: typeof COVERAGE_RULES.BUYER_REMORSE,
  limits: Awaited<ReturnType<typeof getCategoryCoverageLimit>>
): CoverageDecision {
  return {
    covered: false,
    coverageType: "none",
    maxRefundCents: 0,
    coverageLimitCents: limits.maxCoverageCents,
    deductibleCents: 0,
    reason: "BUYER_REMORSE_NOT_COVERED",
    buyerResponsibilities: [
      "Request return through seller's return policy",
      "Pay for return shipping",
      "Accept any applicable restocking fee (up to 15%)",
      "Return item in original condition",
    ],
    sellerResponsibilities: [
      "Honor your stated return policy",
      "Respond to return request within 3 business days",
      "Provide return address",
    ],
    returnRequired: true,
    returnShippingPaidBy: "buyer",
    estimatedResolutionDays: 7,
    autoApproveEligible: false,
  };
}

function handleOther(
  context: CoverageContext,
  maxRefundCents: number,
  limits: Awaited<ReturnType<typeof getCategoryCoverageLimit>>
): CoverageDecision {
  return {
    covered: true,
    coverageType: "full",
    maxRefundCents,
    coverageLimitCents: limits.maxCoverageCents,
    deductibleCents: limits.deductibleCents,
    reason: "OTHER_CLAIM_UNDER_REVIEW",
    buyerResponsibilities: [
      "Describe the issue in detail",
      "Provide any relevant evidence",
    ],
    sellerResponsibilities: [
      "Respond within 3 business days",
      "Work with buyer to resolve",
    ],
    returnRequired: true,
    returnShippingPaidBy: "seller",
    estimatedResolutionDays: 7,
    autoApproveEligible: false,
  };
}

function notCovered(code: string, message: string): CoverageDecision {
  return {
    covered: false,
    coverageType: "none",
    maxRefundCents: 0,
    coverageLimitCents: 0,
    deductibleCents: 0,
    reason: code,
    buyerResponsibilities: [message],
    sellerResponsibilities: [],
    returnRequired: false,
    returnShippingPaidBy: "buyer",
    estimatedResolutionDays: 0,
    autoApproveEligible: false,
  };
}
```

---

## 5) Seller Protection Score Service (NEW)

Create `packages/core/buyer-protection/sellerProtectionScore.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import { BUYER_PROTECTION_SETTINGS as SETTINGS } from "../config/buyerProtectionSettings";

const prisma = new PrismaClient();

export async function getSellerProtectionScore(sellerId: string): Promise<{
  score: number;
  claimsLast90Days: number;
  claimsResolvedFavorably: number;
  claimsLostCount: number;
  appealWinRate: number;
  averageResponseHours: number | null;
  tier: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
}> {
  const existing = await prisma.sellerProtectionScore.findUnique({
    where: { sellerId },
  });
  
  if (!existing) {
    // Initialize new seller with perfect score
    await prisma.sellerProtectionScore.create({
      data: { sellerId, score: 100 },
    });
    return {
      score: 100,
      claimsLast90Days: 0,
      claimsResolvedFavorably: 0,
      claimsLostCount: 0,
      appealWinRate: 0,
      averageResponseHours: null,
      tier: "EXCELLENT",
    };
  }
  
  // Check if needs recomputation
  const hoursSinceCompute = (Date.now() - existing.lastComputedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCompute > SETTINGS.PROTECTION_SCORE_RECOMPUTE_HOURS) {
    return recomputeSellerProtectionScore(sellerId);
  }
  
  return {
    score: existing.score,
    claimsLast90Days: existing.claimsLast90Days,
    claimsResolvedFavorably: existing.claimsResolvedFavorably,
    claimsLostCount: existing.claimsLostCount,
    appealWinRate: Number(existing.appealWinRate),
    averageResponseHours: existing.averageResponseHours ? Number(existing.averageResponseHours) : null,
    tier: getScoreTier(existing.score),
  };
}

export async function recomputeSellerProtectionScore(sellerId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  // Get all claims in last 90 days
  const claims = await prisma.buyerProtectionClaim.findMany({
    where: {
      sellerId,
      createdAt: { gte: ninetyDaysAgo },
    },
  });
  
  const claimsLast90Days = claims.length;
  const resolvedClaims = claims.filter(c => c.status === "RESOLVED" || c.status === "CLOSED");
  
  // Claims resolved in seller's favor (denied, appeal granted)
  const claimsResolvedFavorably = resolvedClaims.filter(c => 
    c.resolution === "DENIED" || c.resolution === "APPEAL_GRANTED"
  ).length;
  
  // Claims lost by seller
  const claimsLostCount = resolvedClaims.filter(c =>
    c.resolution === "REFUNDED" || c.resolution === "PARTIAL_REFUND"
  ).length;
  
  // Get appeal statistics
  const appeals = await prisma.sellerAppeal.findMany({
    where: { sellerId, status: { in: ["APPROVED", "DENIED"] } },
  });
  const appealWinRate = appeals.length > 0
    ? appeals.filter(a => a.decision === "OVERTURN_FULL" || a.decision === "OVERTURN_PARTIAL").length / appeals.length
    : 0;
  
  // Calculate average response time
  const claimsWithResponse = await prisma.buyerProtectionClaimMessage.findMany({
    where: {
      claim: { sellerId },
      authorType: "SELLER",
    },
    orderBy: { createdAt: "asc" },
    distinct: ["claimId"],
  });
  
  let avgResponseHours: number | null = null;
  if (claimsWithResponse.length > 0) {
    // This is simplified - real implementation would calculate from claim creation to first response
    avgResponseHours = 24; // Placeholder
  }
  
  // Calculate score
  let score = 100;
  score -= claimsLostCount * SETTINGS.PROTECTION_SCORE_CLAIM_PENALTY;
  score += Math.floor(appealWinRate * 10 * SETTINGS.PROTECTION_SCORE_APPEAL_WIN_BONUS);
  score = Math.max(SETTINGS.PROTECTION_SCORE_MIN, Math.min(SETTINGS.PROTECTION_SCORE_MAX, score));
  
  // Update database
  await prisma.sellerProtectionScore.upsert({
    where: { sellerId },
    update: {
      score,
      claimsLast90Days,
      claimsResolvedFavorably,
      claimsLostCount,
      appealWinRate,
      averageResponseHours: avgResponseHours,
      lastComputedAt: new Date(),
    },
    create: {
      sellerId,
      score,
      claimsLast90Days,
      claimsResolvedFavorably,
      claimsLostCount,
      appealWinRate,
      averageResponseHours: avgResponseHours,
    },
  });
  
  return {
    score,
    claimsLast90Days,
    claimsResolvedFavorably,
    claimsLostCount,
    appealWinRate,
    averageResponseHours: avgResponseHours,
    tier: getScoreTier(score),
  };
}

function getScoreTier(score: number): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
  if (score >= 90) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "FAIR";
  return "POOR";
}
```

---

## 6) Seller Appeal Service (NEW)

Create `packages/core/buyer-protection/appealService.ts`:

```typescript
import { PrismaClient, AppealReason, AppealStatus, AppealDecision } from "@prisma/client";
import { BUYER_PROTECTION_SETTINGS as SETTINGS } from "../config/buyerProtectionSettings";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export interface CreateAppealInput {
  claimId: string;
  sellerId: string;
  reason: AppealReason;
  description: string;
  evidenceUrls?: string[];
}

export async function createAppeal(input: CreateAppealInput) {
  const { claimId, sellerId, reason, description, evidenceUrls = [] } = input;
  
  // Verify claim exists and belongs to seller
  const claim = await prisma.buyerProtectionClaim.findUnique({
    where: { id: claimId },
  });
  
  if (!claim) throw new Error("CLAIM_NOT_FOUND");
  if (claim.sellerId !== sellerId) throw new Error("NOT_YOUR_CLAIM");
  if (claim.status !== "RESOLVED") throw new Error("CLAIM_NOT_RESOLVED");
  if (claim.resolution !== "REFUNDED" && claim.resolution !== "PARTIAL_REFUND") {
    throw new Error("ONLY_REFUND_DECISIONS_APPEALABLE");
  }
  
  // Check appeal window
  const daysSinceResolution = claim.resolvedAt 
    ? Math.floor((Date.now() - claim.resolvedAt.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  if (daysSinceResolution > SETTINGS.APPEAL_WINDOW_DAYS) {
    throw new Error("APPEAL_WINDOW_EXPIRED");
  }
  
  // Check if already appealed
  const existingAppeal = await prisma.sellerAppeal.findUnique({
    where: { claimId },
  });
  if (existingAppeal) throw new Error("ALREADY_APPEALED");
  
  // Check evidence requirement
  if (SETTINGS.APPEAL_EVIDENCE_REQUIRED && evidenceUrls.length === 0) {
    throw new Error("EVIDENCE_REQUIRED");
  }
  
  // Create appeal
  const appeal = await prisma.sellerAppeal.create({
    data: {
      claimId,
      sellerId,
      reason,
      description,
      evidenceUrls,
      originalResolution: claim.resolution,
    },
  });
  
  // Update claim status
  await prisma.buyerProtectionClaim.update({
    where: { id: claimId },
    data: {
      status: "APPEALED",
      appealId: appeal.id,
      timelineEvents: {
        push: {
          type: "APPEAL_FILED",
          timestamp: new Date().toISOString(),
          details: { reason, appealId: appeal.id },
        },
      },
    },
  });
  
  await emitAuditEvent({
    action: "buyer_protection.appeal.created",
    entityType: "SellerAppeal",
    entityId: appeal.id,
    meta: { claimId, reason },
  });
  
  return appeal;
}

export async function getSellerAppeals(sellerId: string) {
  return prisma.sellerAppeal.findMany({
    where: { sellerId },
    include: {
      claim: {
        select: { id: true, type: true, orderId: true, refundAmountCents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewAppeal(args: {
  appealId: string;
  reviewerId: string;
  decision: AppealDecision;
  decisionNotes?: string;
  newRefundAmountCents?: number;
}) {
  const appeal = await prisma.sellerAppeal.findUnique({
    where: { id: args.appealId },
    include: { claim: true },
  });
  
  if (!appeal) throw new Error("APPEAL_NOT_FOUND");
  if (appeal.status !== "PENDING" && appeal.status !== "UNDER_REVIEW") {
    throw new Error("APPEAL_ALREADY_DECIDED");
  }
  
  // Determine new resolution based on decision
  let newResolution: string | null = null;
  if (args.decision === "OVERTURN_FULL") {
    newResolution = "APPEAL_GRANTED";
  } else if (args.decision === "OVERTURN_PARTIAL") {
    newResolution = "PARTIAL_REFUND";
  }
  
  // Update appeal
  const updatedAppeal = await prisma.sellerAppeal.update({
    where: { id: args.appealId },
    data: {
      status: args.decision === "UPHELD" ? "DENIED" : "APPROVED",
      reviewedById: args.reviewerId,
      reviewedAt: new Date(),
      decision: args.decision,
      decisionNotes: args.decisionNotes,
      newResolution,
    },
  });
  
  // Update claim if overturned
  if (args.decision === "OVERTURN_FULL" || args.decision === "OVERTURN_PARTIAL") {
    const claimUpdate: any = {
      resolution: newResolution,
      resolvedByType: "APPEAL",
      timelineEvents: {
        push: {
          type: "APPEAL_DECIDED",
          timestamp: new Date().toISOString(),
          details: { decision: args.decision, notes: args.decisionNotes },
        },
      },
    };
    
    if (args.decision === "OVERTURN_PARTIAL" && args.newRefundAmountCents) {
      claimUpdate.refundAmountCents = args.newRefundAmountCents;
    } else if (args.decision === "OVERTURN_FULL") {
      claimUpdate.refundAmountCents = 0;
    }
    
    await prisma.buyerProtectionClaim.update({
      where: { id: appeal.claimId },
      data: claimUpdate,
    });
    
    // If overturned, reverse the refund (queue for processing)
    if (args.decision === "OVERTURN_FULL") {
      await prisma.refundRecord.updateMany({
        where: { claimId: appeal.claimId, status: "COMPLETED" },
        data: { status: "REVERSED" },
      });
    }
  } else {
    // Upheld - close the appeal
    await prisma.buyerProtectionClaim.update({
      where: { id: appeal.claimId },
      data: {
        status: "CLOSED",
        timelineEvents: {
          push: {
            type: "APPEAL_DENIED",
            timestamp: new Date().toISOString(),
            details: { notes: args.decisionNotes },
          },
        },
      },
    });
  }
  
  await emitAuditEvent({
    actorUserId: args.reviewerId,
    action: "buyer_protection.appeal.decided",
    entityType: "SellerAppeal",
    entityId: args.appealId,
    meta: { decision: args.decision },
  });
  
  return updatedAppeal;
}

export async function getPendingAppeals() {
  return prisma.sellerAppeal.findMany({
    where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
    include: {
      claim: {
        include: {
          order: { select: { id: true, totalCents: true } },
        },
      },
      seller: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
```

---

## 7) Dispute Timeline Service (NEW)

Create `packages/core/buyer-protection/timelineService.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type TimelineEvent = {
  type: string;
  timestamp: string;
  actor?: string;
  actorType?: "buyer" | "seller" | "staff" | "system";
  details?: Record<string, any>;
};

export async function addTimelineEvent(claimId: string, event: Omit<TimelineEvent, "timestamp">) {
  const claim = await prisma.buyerProtectionClaim.findUnique({
    where: { id: claimId },
    select: { timelineEvents: true },
  });
  
  if (!claim) throw new Error("CLAIM_NOT_FOUND");
  
  const events = (claim.timelineEvents as TimelineEvent[]) || [];
  events.push({
    ...event,
    timestamp: new Date().toISOString(),
  });
  
  await prisma.buyerProtectionClaim.update({
    where: { id: claimId },
    data: { timelineEvents: events },
  });
}

export async function getClaimTimeline(claimId: string): Promise<TimelineEvent[]> {
  const claim = await prisma.buyerProtectionClaim.findUnique({
    where: { id: claimId },
    select: { timelineEvents: true },
  });
  
  if (!claim) return [];
  
  return (claim.timelineEvents as TimelineEvent[]) || [];
}

// Standard timeline event types
export const TIMELINE_EVENTS = {
  CLAIM_OPENED: "CLAIM_OPENED",
  EVIDENCE_ADDED: "EVIDENCE_ADDED",
  SELLER_RESPONDED: "SELLER_RESPONDED",
  BUYER_REPLIED: "BUYER_REPLIED",
  ESCALATED: "ESCALATED",
  AUTO_APPROVED: "AUTO_APPROVED",
  REFUND_ISSUED: "REFUND_ISSUED",
  RETURN_REQUESTED: "RETURN_REQUESTED",
  RETURN_SHIPPED: "RETURN_SHIPPED",
  RETURN_DELIVERED: "RETURN_DELIVERED",
  RESOLVED: "RESOLVED",
  APPEAL_FILED: "APPEAL_FILED",
  APPEAL_DECIDED: "APPEAL_DECIDED",
  APPEAL_DENIED: "APPEAL_DENIED",
  CLOSED: "CLOSED",
} as const;
```

---

## 8) Claim Service (Enhanced)

Create `packages/core/buyer-protection/claimService.ts`:

```typescript
import { PrismaClient, ClaimType } from "@prisma/client";
import { evaluateReturn } from "./policyEngine";
import { determineCoverage, CoverageContext } from "./coverage";
import { addTimelineEvent, TIMELINE_EVENTS } from "./timelineService";
import { getSellerProtectionScore } from "./sellerProtectionScore";
import { emitAuditEvent } from "../audit/emit";
import { BUYER_PROTECTION_SETTINGS as SETTINGS } from "../config/buyerProtectionSettings";

const prisma = new PrismaClient();

export async function createClaim(args: {
  orderId: string;
  buyerId: string;
  type: ClaimType;
  description: string;
  evidenceUrls?: string[];
}) {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: { items: true },
  });

  if (!order) throw new Error("Order not found");
  if (order.buyerId !== args.buyerId) throw new Error("Not your order");

  // Check for existing open claim
  const existingClaim = await prisma.buyerProtectionClaim.findFirst({
    where: { orderId: args.orderId, status: { notIn: ["RESOLVED", "CLOSED"] } },
  });
  if (existingClaim) throw new Error("CLAIM_ALREADY_EXISTS");

  // Calculate days since delivery
  const deliveredAt = order.deliveredAt ?? order.createdAt;
  const daysSinceDelivery = Math.floor(
    (Date.now() - deliveredAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  const daysSincePurchase = Math.floor(
    (Date.now() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Get buyer's claim history
  const previousClaims = await prisma.buyerProtectionClaim.count({
    where: {
      buyerId: args.buyerId,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });

  // Get seller protection score
  const sellerScore = await getSellerProtectionScore(order.sellerId);

  // Build coverage context
  const categoryId = order.items[0]?.categoryId ?? undefined;
  const context: CoverageContext = {
    orderId: args.orderId,
    claimType: args.type,
    orderTotalCents: order.totalCents ?? 0,
    categoryId,
    daysSinceDelivery,
    daysSincePurchase,
    hasTrackingProof: false, // TODO: Check shipments
    hasDeliveryConfirmation: !!order.deliveredAt,
    sellerResponseRequired: true,
    previousClaimsByBuyer: previousClaims,
    sellerProtectionScore: sellerScore.score,
  };

  // Determine coverage
  const coverage = await determineCoverage(context);

  // Evaluate return policy
  const returnDecision = await evaluateReturn({
    orderId: args.orderId,
    categoryId: categoryId ?? "",
    sellerId: order.sellerId,
    claimType: args.type,
    daysSinceDelivery,
  });

  // Create claim
  const claim = await prisma.buyerProtectionClaim.create({
    data: {
      orderId: args.orderId,
      buyerId: args.buyerId,
      sellerId: order.sellerId,
      type: args.type,
      description: args.description,
      evidenceUrls: args.evidenceUrls ?? [],
      buyerPaysReturn: returnDecision.buyerPaysReturn,
      returnRequired: returnDecision.allowed && args.type !== "ITEM_NOT_RECEIVED",
      coverageLimitCents: coverage.coverageLimitCents,
      sellerResponseDeadline: new Date(Date.now() + SETTINGS.SELLER_RESPONSE_DEADLINE_HOURS * 60 * 60 * 1000),
      timelineEvents: [
        {
          type: TIMELINE_EVENTS.CLAIM_OPENED,
          timestamp: new Date().toISOString(),
          actorType: "buyer",
          details: { claimType: args.type, covered: coverage.covered },
        },
      ],
    },
  });

  await emitAuditEvent({
    action: "buyer_protection.claim.created",
    entityType: "BuyerProtectionClaim",
    entityId: claim.id,
    meta: { orderId: args.orderId, type: args.type, covered: coverage.covered },
  });

  // Check for auto-refund eligibility
  if (coverage.autoApproveEligible && coverage.covered) {
    await autoApproveClaim(claim.id, coverage.maxRefundCents);
  }

  return { claim, coverage };
}

async function autoApproveClaim(claimId: string, refundAmountCents: number) {
  await prisma.buyerProtectionClaim.update({
    where: { id: claimId },
    data: {
      status: "RESOLVED",
      resolution: "REFUNDED",
      refundAmountCents,
      refundType: "FULL",
      resolvedAt: new Date(),
      resolvedByType: "AUTO",
    },
  });

  await addTimelineEvent(claimId, {
    type: TIMELINE_EVENTS.AUTO_APPROVED,
    actorType: "system",
    details: { refundAmountCents },
  });

  // Create refund record
  const claim = await prisma.buyerProtectionClaim.findUnique({ where: { id: claimId } });
  if (claim) {
    await prisma.refundRecord.create({
      data: {
        claimId,
        orderId: claim.orderId,
        amountCents: refundAmountCents,
        reason: "Auto-approved claim",
        status: "PENDING",
      },
    });
  }
}

export async function addClaimMessage(args: {
  claimId: string;
  authorType: "BUYER" | "SELLER" | "STAFF";
  authorId: string;
  body: string;
  attachments?: string[];
  isInternal?: boolean;
}) {
  const message = await prisma.buyerProtectionClaimMessage.create({
    data: {
      claimId: args.claimId,
      authorType: args.authorType,
      authorId: args.authorId,
      body: args.body,
      attachments: args.attachments ?? [],
      isInternal: args.isInternal ?? false,
    },
  });

  // Update claim status if seller responds
  if (args.authorType === "SELLER") {
    await prisma.buyerProtectionClaim.update({
      where: { id: args.claimId },
      data: { status: "SELLER_RESPONSE" },
    });
    
    await addTimelineEvent(args.claimId, {
      type: TIMELINE_EVENTS.SELLER_RESPONDED,
      actorType: "seller",
    });
  } else if (args.authorType === "BUYER") {
    await addTimelineEvent(args.claimId, {
      type: TIMELINE_EVENTS.BUYER_REPLIED,
      actorType: "buyer",
    });
  }

  return message;
}

export async function escalateClaim(args: {
  claimId: string;
  buyerId: string;
  reason?: string;
}) {
  const claim = await prisma.buyerProtectionClaim.findUnique({
    where: { id: args.claimId },
  });

  if (!claim || claim.buyerId !== args.buyerId) {
    throw new Error("Claim not found");
  }

  const updated = await prisma.buyerProtectionClaim.update({
    where: { id: args.claimId },
    data: {
      status: "ESCALATED",
      escalatedAt: new Date(),
    },
  });

  await addTimelineEvent(args.claimId, {
    type: TIMELINE_EVENTS.ESCALATED,
    actorType: "buyer",
    details: { reason: args.reason },
  });

  await emitAuditEvent({
    action: "buyer_protection.claim.escalated",
    entityType: "BuyerProtectionClaim",
    entityId: claim.id,
    meta: { reason: args.reason },
  });

  return updated;
}

export async function getClaimWithTimeline(claimId: string) {
  return prisma.buyerProtectionClaim.findUnique({
    where: { id: claimId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      order: {
        select: { id: true, totalCents: true, items: { take: 1 } },
      },
      appeal: true,
    },
  });
}
```

---

## 9) Protection Badge Service (NEW)

Create `packages/core/buyer-protection/badgeService.ts`:

```typescript
import { BUYER_PROTECTION_SETTINGS as SETTINGS } from "../config/buyerProtectionSettings";
import { getCategoryCoverageLimit } from "./coverage";

export interface ProtectionBadgeInfo {
  showBadge: boolean;
  badgeText: string;
  coverageAmountCents: number;
  coverageDescription: string;
  learnMoreUrl: string;
}

export async function getProtectionBadgeInfo(args: {
  categoryId?: string;
  priceCents: number;
}): Promise<ProtectionBadgeInfo> {
  if (!SETTINGS.SHOW_PROTECTION_BADGES) {
    return {
      showBadge: false,
      badgeText: "",
      coverageAmountCents: 0,
      coverageDescription: "",
      learnMoreUrl: "/protection",
    };
  }
  
  const limits = await getCategoryCoverageLimit(args.categoryId);
  const coverageAmount = Math.min(args.priceCents, limits.maxCoverageCents);
  
  return {
    showBadge: true,
    badgeText: SETTINGS.PROTECTION_BADGE_TEXT,
    coverageAmountCents: coverageAmount,
    coverageDescription: `Get a full refund if the item isn't as described or doesn't arrive. Coverage up to $${(coverageAmount / 100).toFixed(2)}.`,
    learnMoreUrl: "/protection",
  };
}
```

---

## 10) Public Protection Page Data

Create `packages/core/buyer-protection/publicProtectionData.ts`:

```typescript
// Data for the public /protection transparency page

export const PROTECTION_PAGE_DATA = {
  headline: "Shop with Confidence",
  subheadline: "Every purchase is protected by Twicely's Money-Back Guarantee",
  
  coverageTypes: [
    {
      icon: "package-x",
      title: "Item Not Received",
      description: "If your item never arrives, we'll give you a full refund.",
      window: "30 days from estimated delivery",
    },
    {
      icon: "alert-circle",
      title: "Item Not as Described",
      description: "If the item doesn't match the listing, return it for a full refund.",
      window: "30 days from delivery",
    },
    {
      icon: "broken-heart",
      title: "Damaged Items",
      description: "Received a damaged item? We'll make it right.",
      window: "30 days from delivery",
    },
    {
      icon: "shield-alert",
      title: "Counterfeit Protection",
      description: "Authentic items guaranteed. Counterfeits get immediate refunds.",
      window: "180 days from delivery",
    },
  ],
  
  howItWorks: [
    {
      step: 1,
      title: "Report an Issue",
      description: "Open a claim from your order details within the coverage window.",
    },
    {
      step: 2,
      title: "We Investigate",
      description: "Our team reviews the claim and contacts the seller if needed.",
    },
    {
      step: 3,
      title: "Get Your Money Back",
      description: "If the claim is valid, we'll process your refund.",
    },
  ],
  
  faq: [
    {
      q: "What's covered by the Money-Back Guarantee?",
      a: "All purchases are covered for items not received, items not as described, damaged items, and counterfeit items.",
    },
    {
      q: "How long do I have to file a claim?",
      a: "You have 30 days from delivery for most issues, and 180 days for counterfeit items.",
    },
    {
      q: "What if I just changed my mind?",
      a: "Buyer's remorse isn't covered by the guarantee, but many sellers accept returns. Check the seller's return policy.",
    },
    {
      q: "How long does a refund take?",
      a: "Most refunds are processed within 3-5 business days after the claim is approved.",
    },
  ],
  
  stats: {
    claimsResolvedPercent: 98,
    averageResolutionDays: 3,
    totalProtected: "Over $10M in purchases protected",
  },
};
```

---

## 11) Health Provider

Create `packages/core/health/providers/buyerProtectionHealthProvider.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthCheck } from "../types";
import { HEALTH_STATUS } from "../types";
import { BUYER_PROTECTION_SETTINGS as SETTINGS } from "../../config/buyerProtectionSettings";

const prisma = new PrismaClient();

export const buyerProtectionHealthProvider: HealthProvider = {
  id: "buyer_protection",
  label: "Buyer Protection",
  description: "Validates claims, refunds, appeals, and protection scores",
  version: "2.0.0",

  async run(): Promise<HealthResult> {
    const checks: HealthCheck[] = [];
    let overallStatus = HEALTH_STATUS.PASS;

    // Check 1: Expired seller response deadlines
    const expiredDeadlines = await prisma.buyerProtectionClaim.count({
      where: {
        status: "OPEN",
        sellerResponseDeadline: { lt: new Date() },
      },
    });
    checks.push({
      id: "protection.expired_deadlines",
      label: "Expired seller response deadlines",
      status: expiredDeadlines <= 20 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: expiredDeadlines === 0 ? "None" : `${expiredDeadlines} claims with expired deadlines`,
    });
    if (expiredDeadlines > 20) overallStatus = HEALTH_STATUS.WARN;

    // Check 2: Escalated claims backlog (>48h)
    const escalatedBacklog = await prisma.buyerProtectionClaim.count({
      where: {
        status: "ESCALATED",
        escalatedAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    });
    checks.push({
      id: "protection.escalated_backlog",
      label: "Escalated claims backlog",
      status: escalatedBacklog <= 10 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: escalatedBacklog === 0 ? "None" : `${escalatedBacklog} claims escalated >48h`,
    });
    if (escalatedBacklog > 10) overallStatus = HEALTH_STATUS.WARN;

    // Check 3: Pending refunds
    const pendingRefunds = await prisma.refundRecord.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    checks.push({
      id: "protection.pending_refunds",
      label: "Stale pending refunds",
      status: pendingRefunds === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: pendingRefunds === 0 ? "All processed" : `${pendingRefunds} refunds pending >24h`,
    });

    // Check 4: Appeal backlog
    const appealBacklog = await prisma.sellerAppeal.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - SETTINGS.APPEAL_REVIEW_SLA_HOURS * 60 * 60 * 1000) },
      },
    });
    checks.push({
      id: "protection.appeal_backlog",
      label: "Appeal review backlog",
      status: appealBacklog === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: appealBacklog === 0 ? "All reviewed" : `${appealBacklog} appeals past SLA`,
    });

    // Check 5: Protection score computation
    const staleScores = await prisma.sellerProtectionScore.count({
      where: {
        lastComputedAt: { lt: new Date(Date.now() - SETTINGS.PROTECTION_SCORE_RECOMPUTE_HOURS * 2 * 60 * 60 * 1000) },
      },
    });
    checks.push({
      id: "protection.score_freshness",
      label: "Protection score freshness",
      status: staleScores < 100 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: staleScores < 100 ? "Scores up to date" : `${staleScores} stale scores`,
    });

    return {
      providerId: this.id,
      status: overallStatus,
      summary: `Buyer Protection: ${overallStatus}`,
      checks,
    };
  },
};
```

---

## 12) Doctor Checks

```typescript
// packages/core/doctor/checks/buyerProtectionDoctorChecks.ts
import { PrismaClient } from "@prisma/client";
import type { DoctorCheckResult } from "../types";
import { createClaim } from "../../buyer-protection/claimService";
import { createAppeal } from "../../buyer-protection/appealService";
import { getSellerProtectionScore } from "../../buyer-protection/sellerProtectionScore";
import { getProtectionBadgeInfo } from "../../buyer-protection/badgeService";

const prisma = new PrismaClient();

export async function runPhase38DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  const testBuyerId = "_doctor_buyer_38";
  const testSellerId = "_doctor_seller_38";
  const testOrderId = `_doctor_order_${Date.now()}`;

  // Create test fixtures
  const testOrder = await prisma.order.create({
    data: {
      id: testOrderId,
      buyerId: testBuyerId,
      sellerId: testSellerId,
      status: "DELIVERED",
      totalCents: 5000,
      deliveredAt: new Date(),
    },
  });

  try {
    // Test 1: Create claim
    const claimResult = await createClaim({
      orderId: testOrderId,
      buyerId: testBuyerId,
      type: "ITEM_NOT_AS_DESCRIBED",
      description: "Doctor test - item not as described",
      evidenceUrls: ["https://example.com/photo.jpg"],
    });
    results.push({
      id: "protection.create_claim",
      label: "Create protection claim",
      status: claimResult.claim.id ? "PASS" : "FAIL",
      message: claimResult.claim.id ? "Claim created" : "Failed",
    });

    // Test 2: Coverage determination
    results.push({
      id: "protection.coverage_determination",
      label: "Coverage determination",
      status: claimResult.coverage.covered ? "PASS" : "FAIL",
      message: `Covered: ${claimResult.coverage.covered}, Max: $${(claimResult.coverage.maxRefundCents / 100).toFixed(2)}`,
    });

    // Test 3: Timeline tracking
    const claim = await prisma.buyerProtectionClaim.findUnique({
      where: { id: claimResult.claim.id },
    });
    const timeline = (claim?.timelineEvents as any[]) || [];
    results.push({
      id: "protection.timeline_tracking",
      label: "Timeline event tracking",
      status: timeline.length > 0 ? "PASS" : "FAIL",
      message: `${timeline.length} timeline events`,
    });

    // Test 4: Seller protection score
    const score = await getSellerProtectionScore(testSellerId);
    results.push({
      id: "protection.seller_score",
      label: "Seller protection score",
      status: score.score >= 0 && score.score <= 100 ? "PASS" : "FAIL",
      message: `Score: ${score.score}, Tier: ${score.tier}`,
    });

    // Test 5: Protection badge
    const badge = await getProtectionBadgeInfo({ priceCents: 5000 });
    results.push({
      id: "protection.badge_info",
      label: "Protection badge generation",
      status: badge.coverageAmountCents > 0 ? "PASS" : "FAIL",
      message: badge.showBadge ? `Coverage: $${(badge.coverageAmountCents / 100).toFixed(2)}` : "Badges disabled",
    });

    // Test 6: Return policy evaluation
    const policy = await prisma.returnPolicy.create({
      data: {
        name: "Doctor Test Policy",
        sellerId: testSellerId,
        returnWindowDays: 30,
        acceptsReturns: true,
        buyerPaysReturnShipping: false,
      },
    });
    results.push({
      id: "protection.return_policy",
      label: "Return policy creation",
      status: policy.id ? "PASS" : "FAIL",
      message: `Policy: ${policy.returnWindowDays} day window`,
    });

    // Clean up policy
    await prisma.returnPolicy.delete({ where: { id: policy.id } });

  } finally {
    // Cleanup
    await prisma.buyerProtectionClaimMessage.deleteMany({ where: { claim: { orderId: testOrderId } } });
    await prisma.sellerAppeal.deleteMany({ where: { sellerId: testSellerId } });
    await prisma.refundRecord.deleteMany({ where: { orderId: testOrderId } });
    await prisma.buyerProtectionClaim.deleteMany({ where: { orderId: testOrderId } });
    await prisma.sellerProtectionScore.deleteMany({ where: { sellerId: testSellerId } });
    await prisma.order.delete({ where: { id: testOrderId } });
  }

  return results;
}
```

---

## 13) Admin UI: Category Coverage Limits

```typescript
// apps/web/app/corp/protection/category-limits/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

interface CategoryLimit {
  id: string;
  categoryId: string;
  categoryName: string;
  maxCoverageCents: number;
  deductibleCents: number;
  requiresEvidence: boolean;
  autoApproveUnder: number | null;
  isActive: boolean;
}

export default function CategoryCoverageLimitsPage() {
  const [limits, setLimits] = useState<CategoryLimit[]>([]);
  const [editingLimit, setEditingLimit] = useState<CategoryLimit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/corp/protection/category-limits")
      .then(res => res.json())
      .then(data => {
        setLimits(data.limits);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!editingLimit) return;
    
    try {
      const res = await fetch("/api/corp/protection/category-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLimit),
      });
      if (!res.ok) throw new Error("Failed to save");
      
      setLimits(limits.map(l => l.id === editingLimit.id ? editingLimit : l));
      setEditingLimit(null);
      toast.success("Saved");
    } catch (err) {
      toast.error("Failed to save");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Category Coverage Limits</h1>
      <p className="text-muted-foreground">
        Configure maximum coverage amounts and rules per category.
      </p>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Max Coverage</TableHead>
                <TableHead>Deductible</TableHead>
                <TableHead>Auto-Approve Under</TableHead>
                <TableHead>Evidence Required</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.map(limit => (
                <TableRow key={limit.id}>
                  <TableCell>{limit.categoryName}</TableCell>
                  <TableCell>${(limit.maxCoverageCents / 100).toFixed(2)}</TableCell>
                  <TableCell>${(limit.deductibleCents / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    {limit.autoApproveUnder ? `$${(limit.autoApproveUnder / 100).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>{limit.requiresEvidence ? "Yes" : "No"}</TableCell>
                  <TableCell>{limit.isActive ? "✓" : "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setEditingLimit(limit)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingLimit} onOpenChange={() => setEditingLimit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Coverage Limit</DialogTitle>
          </DialogHeader>
          {editingLimit && (
            <div className="space-y-4">
              <div>
                <Label>Category</Label>
                <Input value={editingLimit.categoryName} disabled />
              </div>
              <div>
                <Label>Max Coverage ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(editingLimit.maxCoverageCents / 100).toFixed(2)}
                  onChange={e => setEditingLimit({
                    ...editingLimit,
                    maxCoverageCents: Math.round(parseFloat(e.target.value) * 100),
                  })}
                />
              </div>
              <div>
                <Label>Deductible ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(editingLimit.deductibleCents / 100).toFixed(2)}
                  onChange={e => setEditingLimit({
                    ...editingLimit,
                    deductibleCents: Math.round(parseFloat(e.target.value) * 100),
                  })}
                />
              </div>
              <div>
                <Label>Auto-Approve Under ($, leave empty to disable)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingLimit.autoApproveUnder ? (editingLimit.autoApproveUnder / 100).toFixed(2) : ""}
                  onChange={e => setEditingLimit({
                    ...editingLimit,
                    autoApproveUnder: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null,
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Requires Evidence</Label>
                <Switch
                  checked={editingLimit.requiresEvidence}
                  onCheckedChange={checked => setEditingLimit({ ...editingLimit, requiresEvidence: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={editingLimit.isActive}
                  onCheckedChange={checked => setEditingLimit({ ...editingLimit, isActive: checked })}
                />
              </div>
              <Button onClick={handleSave} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## 14) Seller UI: Protection Score Dashboard

```typescript
// apps/web/app/seller/dashboard/protection-score/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ProtectionScoreData {
  score: number;
  tier: string;
  claimsLast90Days: number;
  claimsResolvedFavorably: number;
  claimsLostCount: number;
  appealWinRate: number;
  averageResponseHours: number | null;
}

export default function SellerProtectionScorePage() {
  const [data, setData] = useState<ProtectionScoreData | null>(null);

  useEffect(() => {
    fetch("/api/seller/protection-score")
      .then(res => res.json())
      .then(setData);
  }, []);

  if (!data) return <div>Loading...</div>;

  const tierColors: Record<string, string> = {
    EXCELLENT: "bg-green-500",
    GOOD: "bg-blue-500",
    FAIR: "bg-yellow-500",
    POOR: "bg-red-500",
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Protection Score</h1>
      <p className="text-muted-foreground">
        Your protection score reflects your claim resolution performance.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold">{data.score}</div>
              <div>
                <Badge className={tierColors[data.tier]}>{data.tier}</Badge>
                <p className="text-sm text-muted-foreground mt-1">out of 100</p>
              </div>
            </div>
            <Progress value={data.score} className="mt-4" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last 90 Days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Total Claims</span>
              <span className="font-medium">{data.claimsLast90Days}</span>
            </div>
            <div className="flex justify-between">
              <span>Resolved in Your Favor</span>
              <span className="font-medium text-green-600">{data.claimsResolvedFavorably}</span>
            </div>
            <div className="flex justify-between">
              <span>Claims Lost</span>
              <span className="font-medium text-red-600">{data.claimsLostCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Appeal Win Rate</span>
              <span className="font-medium">{(data.appealWinRate * 100).toFixed(0)}%</span>
            </div>
            {data.averageResponseHours && (
              <div className="flex justify-between">
                <span>Avg Response Time</span>
                <span className="font-medium">{data.averageResponseHours.toFixed(1)}h</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Improve Your Score</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>✓ Respond to claims within 24 hours</li>
            <li>✓ Provide clear, accurate listings to prevent "not as described" claims</li>
            <li>✓ Ship items securely to prevent damage claims</li>
            <li>✓ Use tracking with delivery confirmation</li>
            <li>✓ Appeal unfair decisions with evidence</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 15) Buyer UI: Dispute Timeline

```typescript
// apps/web/components/buyer/ClaimTimeline.tsx
"use client";

import { CheckCircle, Clock, AlertCircle, MessageSquare, Truck, DollarSign } from "lucide-react";

interface TimelineEvent {
  type: string;
  timestamp: string;
  actorType?: string;
  details?: Record<string, any>;
}

interface Props {
  events: TimelineEvent[];
}

const EVENT_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  CLAIM_OPENED: { icon: AlertCircle, label: "Claim Opened", color: "text-blue-500" },
  EVIDENCE_ADDED: { icon: CheckCircle, label: "Evidence Added", color: "text-blue-500" },
  SELLER_RESPONDED: { icon: MessageSquare, label: "Seller Responded", color: "text-green-500" },
  BUYER_REPLIED: { icon: MessageSquare, label: "You Replied", color: "text-blue-500" },
  ESCALATED: { icon: AlertCircle, label: "Escalated to Support", color: "text-orange-500" },
  AUTO_APPROVED: { icon: CheckCircle, label: "Auto-Approved", color: "text-green-500" },
  REFUND_ISSUED: { icon: DollarSign, label: "Refund Issued", color: "text-green-500" },
  RETURN_REQUESTED: { icon: Truck, label: "Return Requested", color: "text-blue-500" },
  RETURN_SHIPPED: { icon: Truck, label: "Return Shipped", color: "text-blue-500" },
  RETURN_DELIVERED: { icon: Truck, label: "Return Delivered", color: "text-green-500" },
  RESOLVED: { icon: CheckCircle, label: "Resolved", color: "text-green-500" },
  APPEAL_FILED: { icon: AlertCircle, label: "Seller Filed Appeal", color: "text-orange-500" },
  APPEAL_DECIDED: { icon: CheckCircle, label: "Appeal Decided", color: "text-green-500" },
  APPEAL_DENIED: { icon: AlertCircle, label: "Appeal Denied", color: "text-red-500" },
  CLOSED: { icon: CheckCircle, label: "Closed", color: "text-gray-500" },
};

export function ClaimTimeline({ events }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium">Timeline</h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
        
        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.type] || { icon: Clock, label: event.type, color: "text-gray-500" };
          const Icon = config.icon;
          
          return (
            <div key={i} className="relative pl-10 pb-4">
              <div className={`absolute left-2 w-5 h-5 rounded-full bg-white border-2 flex items-center justify-center ${config.color}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div>
                <p className="font-medium text-sm">{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
                {event.details?.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{event.details.notes}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 16) Phase 38 Completion Criteria

- [ ] BuyerProtectionClaim model migrated (with timeline, coverage limit, appeal link)
- [ ] BuyerProtectionClaimMessage model migrated (with isInternal)
- [ ] ReturnPolicy model migrated
- [ ] CategoryCoverageLimit model migrated (NEW)
- [ ] SellerProtectionScore model migrated (NEW)
- [ ] SellerAppeal model migrated (NEW)
- [ ] AutoRefundRule model migrated
- [ ] RefundRecord model migrated
- [ ] ReturnShipment model migrated
- [ ] Coverage engine with category-specific limits
- [ ] Seller protection score computation
- [ ] Seller appeal workflow (create, review, decide)
- [ ] Dispute timeline tracking
- [ ] Protection badge service
- [ ] Claim lifecycle with timeline events
- [ ] Messages between buyer/seller/staff
- [ ] Escalation path to corp support
- [ ] All claim actions emit audit events
- [ ] Public `/protection` page data
- [ ] Admin UI: Category coverage limits
- [ ] Admin UI: Seller appeals queue
- [ ] Seller UI: Protection score dashboard
- [ ] Seller UI: Appeal management
- [ ] Buyer UI: Claim timeline visualization
- [ ] Protection badges on listings
- [ ] Health provider `buyer_protection` reports status
- [ ] Doctor passes all Phase 38 checks

---

## 17) "Better Than eBay" Differentiators

| Feature | eBay | Twicely |
|---------|------|---------|
| Protection guarantee | Yes | ✅ Enhanced with category limits |
| Public transparency page | Limited | ✅ Full /protection page |
| Protection badges on listings | No | ✅ Show coverage amount |
| Category-specific coverage | No | ✅ Configurable per category |
| Seller protection score | No | ✅ 0-100 score with tier |
| Seller appeal process | Limited | ✅ Full appeal workflow |
| Dispute timeline | Basic | ✅ Visual timeline with all events |
| Auto-approve by category | No | ✅ Configurable thresholds |
| Claim evidence upload | Yes | ✅ Enhanced with requirements |
| Counterfeit extended window | 30 days | ✅ 180 days |

---

## 18) Integration Points

- **Phase 2 (Listings):** Display protection badge on listing pages
- **Phase 3 (Orders):** Link claims to orders
- **Phase 4 (Payments):** Process refunds through payment provider
- **Phase 14 (Returns):** Coordinate with returns flow
- **Phase 28 (Disputes):** Share dispute resolution infrastructure
- **Phase 37 (Seller Standards):** Factor claim rate into seller metrics
