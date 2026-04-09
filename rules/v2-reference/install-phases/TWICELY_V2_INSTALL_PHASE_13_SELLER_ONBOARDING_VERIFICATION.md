# TWICELY V2 - Install Phase 13: Seller Onboarding + Verification (Core)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema  ->  API  ->  Audit  ->  Health  ->  UI  ->  Doctor  
**Canonical:** `/rules/TWICELY_SELLER_ONBOARDING_VERIFICATION_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_13_SELLER_ONBOARDING_VERIFICATION.md`  
> Prereq: Phase 12 complete.

---

## 0) What this phase installs

### Backend
- SellerProfile (single-owner)
- SellerVerification workflow with status tracking
- PayoutDestination storage (platform pays out)
- Verification document handling
- Payout gates: destination must be verified before payout execution
- **Seller Vacation Mode** (schedule, auto-pause, auto-reply) - HIGH-3 fix

### UI (Corp)
- Corp  ->  Sellers  ->  Verification queue (pending verifications)
- Corp  ->  Sellers  ->  Seller detail with verification status

### UI (Seller)
- Seller Hub  ->  Settings  ->  Payout destination setup
- Seller Hub  ->  Settings  ->  Verification status

### Ops
- Health provider: `seller_onboarding`
- Doctor checks: payout blocked until destination verified, verification workflow

---

## 1) Prisma schema (additive)

```prisma
enum SellerStatus {
  SELLER_DRAFT      // Started onboarding
  SELLER_PENDING    // Awaiting verification
  SELLER_ACTIVE     // Fully verified, can sell
  SELLER_RESTRICTED // Limited actions
  SELLER_SUSPENDED  // Cannot sell
}

enum PayoutsStatus {
  PAYOUTS_PENDING   // Not yet set up
  PAYOUTS_REVIEW    // Under review
  PAYOUTS_ENABLED   // Can receive payouts
  PAYOUTS_BLOCKED   // Blocked by platform
}

enum VerificationStatus {
  PENDING
  IN_REVIEW
  APPROVED
  REJECTED
  EXPIRED
}

model SellerProfile {
  id                String        @id @default(cuid())
  sellerId          String        @unique  // Owner user ID
  
  // Status
  status            SellerStatus  @default(SELLER_DRAFT)
  payoutsStatus     PayoutsStatus @default(PAYOUTS_PENDING)
  
  // Business info
  businessName      String?
  businessType      String?       // individual|sole_prop|llc|corporation
  taxId             String?       // Encrypted/hashed
  taxIdVerified     Boolean       @default(false)
  
  // Contact
  supportEmail      String?
  supportPhone      String?
  
  // Address
  businessAddress   Json?
  
  // Onboarding progress
  onboardingStep    String        @default("STARTED")
  completedSteps    String[]      @default([])
  
  // Timestamps
  verifiedAt        DateTime?
  suspendedAt       DateTime?
  suspensionReason  String?
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  // Relations
  verifications     SellerVerification[]
  payoutDestinations PayoutDestination[]
}

model SellerVerification {
  id              String             @id @default(cuid())
  sellerId        String
  seller          SellerProfile      @relation(fields: [sellerId], references: [sellerId], onDelete: Cascade)
  
  // Verification type
  verificationType String            // identity|address|tax|business
  status          VerificationStatus @default(PENDING)
  
  // Documents
  documentType    String?            // passport|drivers_license|utility_bill|tax_form
  documentUrl     String?            // Secure storage URL
  documentHash    String?            // For integrity verification
  
  // Review
  reviewedByStaffId String?
  reviewedAt      DateTime?
  reviewNotes     String?
  rejectionReason String?
  
  // Expiration
  expiresAt       DateTime?
  
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  
  @@index([sellerId, verificationType])
  @@index([status, createdAt])
}

model PayoutDestination {
  id              String        @id @default(cuid())
  sellerId        String
  seller          SellerProfile @relation(fields: [sellerId], references: [sellerId], onDelete: Cascade)
  
  // Destination type
  kind            String        // bank|debit|stripe_express
  
  // Provider reference
  providerRef     String?       // Stripe account ID or bank token
  
  // Display info (last 4, bank name, etc.)
  displayName     String?
  last4           String?
  bankName        String?
  
  // Status
  isVerified      Boolean       @default(false)
  verifiedAt      DateTime?
  verifiedByStaffId String?
  
  // Primary
  isPrimary       Boolean       @default(true)
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  @@unique([sellerId, isPrimary])
  @@index([sellerId])
}

// =============================================================================
// SELLER VACATION MODE (HIGH-3)
// Allows sellers to temporarily pause store operations
// =============================================================================

model SellerVacationMode {
  id                String    @id @default(cuid())
  sellerId          String    @unique
  
  // Status
  isActive          Boolean   @default(false)
  
  // Schedule (optional)
  startDate         DateTime?
  endDate           DateTime?
  
  // Display message
  publicMessage     String?   // "Back January 25th!"
  
  // Behavior settings
  hideListings      Boolean   @default(false)  // Remove from search while away
  pauseOrders       Boolean   @default(true)   // Prevent new purchases
  extendHandling    Boolean   @default(true)   // Auto-extend handling time
  extraHandlingDays Int       @default(0)      // Days to add to handling
  
  // Auto-reply for messages
  autoReplyEnabled  Boolean   @default(false)
  autoReplyMessage  String?   // "I'm on vacation until..."
  
  // Audit
  activatedAt       DateTime?
  deactivatedAt     DateTime?
  activatedBy       String?   // Could be scheduled job
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([isActive])
  @@index([endDate, isActive])
}
```

Migrate: `npx prisma migrate dev --name seller_onboarding_phase13`

---

## 2) Onboarding Types

Create `packages/core/sellers/types.ts`:

```ts
import type { SellerStatus, PayoutsStatus, VerificationStatus } from "@prisma/client";

export type OnboardingStep = 
  | "STARTED"
  | "BUSINESS_INFO"
  | "TAX_INFO"
  | "IDENTITY_VERIFICATION"
  | "PAYOUT_SETUP"
  | "COMPLETED";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "STARTED",
  "BUSINESS_INFO",
  "TAX_INFO",
  "IDENTITY_VERIFICATION",
  "PAYOUT_SETUP",
  "COMPLETED",
];

export type VerificationType = 
  | "identity"
  | "address"
  | "tax"
  | "business";

export type PayoutEligibilityResult = {
  eligible: boolean;
  reason?: string;
  blockers: string[];
};

export type OnboardingProgress = {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  remainingSteps: OnboardingStep[];
  percentComplete: number;
};
```

---

## 3) Seller Onboarding Service

Create `packages/core/sellers/onboardingService.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { OnboardingStep, OnboardingProgress } from "./types";
import { ONBOARDING_STEPS } from "./types";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

/**
 * Ensure seller has all required profile components
 * Called when user initiates seller setup
 *
 * Creates:
 * - SellerProfile (business info)
 * - SellerSubscription (ACTIVE at SELLER tier - casual seller default)
 * - SellerStorefront (only for STORE tiers - SELLER tier gets no storefront)
 * - SellerSettings (preferences)
 * - SellerVacationMode (inactive by default)
 *
 * Casual Seller Patch: Defaults to SELLER tier (no subscription, just insertion fees)
 */
export async function ensureSellerProfile(userId: string): Promise<{
  profileId: string;
  subscriptionId: string;
  storefrontId: string | null;  // null for SELLER tier (casual sellers)
  requiresPayment: boolean;
}> {
  // 1. Create or get SellerProfile
  let profile = await prisma.sellerProfile.findUnique({
    where: { sellerId: userId },
  });

  if (!profile) {
    profile = await prisma.sellerProfile.create({
      data: {
        sellerId: userId,
        status: "SELLER_DRAFT",
        payoutsStatus: "PAYOUTS_PENDING",
        onboardingStep: "STARTED",
        completedSteps: [],
      },
    });

    await emitAuditEvent({
      eventType: "seller.profile_created",
      actorType: "USER",
      actorId: userId,
      entityType: "SellerProfile",
      entityId: profile.id,
    });
  }

  // 2. Create subscription at SELLER tier (casual seller - active immediately)
  // Casual Seller Patch: SELLER tier is free, no payment required
  const subscription = await prisma.sellerSubscription.upsert({
    where: { sellerId: userId },
    create: {
      sellerId: userId,
      tier: "SELLER",       // Default to SELLER (casual seller, free)
      status: "ACTIVE",   // SELLER tier is immediately active (no payment)
    },
    update: {},
  });

  // 3. Create storefront only for STORE tiers (SELLER tier has no storefront)
  let storefront = await prisma.sellerStorefront.findUnique({
    where: { sellerId: userId },
  });

  // SELLER tier doesn't get a storefront - only create if upgrading later
  if (!storefront && subscription.tier !== "SELLER") {
    storefront = await prisma.sellerStorefront.create({
      data: { sellerId: userId },
    });
  }

  // 4. Create settings
  await prisma.sellerSettings.upsert({
    where: { sellerId: userId },
    create: { sellerId: userId },
    update: {},
  });

  // 5. Create vacation mode (inactive)
  await prisma.sellerVacationMode.upsert({
    where: { sellerId: userId },
    create: { sellerId: userId, isActive: false },
    update: {},
  });

  return {
    profileId: profile.id,
    subscriptionId: subscription.id,
    storefrontId: storefront?.id ?? null, // null for SELLER tier (no storefront)
    requiresPayment: subscription.tier !== "SELLER" && subscription.status === "PENDING",
  };
}

/**
 * Start seller onboarding with tier selection
 * Creates subscription and storefront (if applicable)
 *
 * Casual Seller Patch: SELLER tier supported (immediate activation, no storefront)
 */
export async function startSellerOnboarding(args: {
  userId: string;
  selectedTier: SellerTier;
}): Promise<{
  subscriptionId: string;
  storefrontId: string | null;  // null for SELLER tier
  requiresPayment: boolean;
}> {
  // Validate tier (SELLER through ENTERPRISE all valid)
  const validTiers: SellerTier[] = ["SELLER", "STARTER", "BASIC", "PRO", "ELITE", "ENTERPRISE"];
  if (!validTiers.includes(args.selectedTier)) {
    throw new Error("INVALID_TIER");
  }

  // SELLER tier: immediate activation (no payment)
  // STORE tiers: PENDING until payment
  const isNoneTier = args.selectedTier === "SELLER";
  const subscriptionStatus = isNoneTier ? "ACTIVE" : "PENDING";

  // Create subscription
  const subscription = await prisma.sellerSubscription.upsert({
    where: { sellerId: args.userId },
    create: {
      sellerId: args.userId,
      tier: args.selectedTier,
      status: subscriptionStatus,
    },
    update: {
      tier: args.selectedTier,
      status: subscriptionStatus,
    },
  });

  // Create storefront only for STORE tiers (SELLER tier has no storefront)
  let storefront = null;
  if (!isNoneTier) {
    storefront = await prisma.sellerStorefront.upsert({
      where: { sellerId: args.userId },
      create: { sellerId: args.userId },
      update: {},
    });
  }

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.userId,
      action: "seller.onboarding.started",
      entityType: "SellerSubscription",
      entityId: subscription.id,
      metaJson: { tier: args.selectedTier, requiresPayment: !isNoneTier },
    },
  });

  return {
    subscriptionId: subscription.id,
    storefrontId: storefront?.id ?? null,
    requiresPayment: !isNoneTier, // SELLER tier doesn't require payment
  };
}

/**
 * Complete onboarding after payment confirmed
 *
 * D1 Fix: New function for post-payment activation
 */
export async function completeSellerOnboarding(args: {
  userId: string;
  stripeSubscriptionId: string;
}): Promise<void> {
  // Update subscription to ACTIVE
  await prisma.sellerSubscription.update({
    where: { sellerId: args.userId },
    data: {
      status: "ACTIVE",
      stripeSubscriptionId: args.stripeSubscriptionId,
      currentPeriodStart: new Date(),
    },
  });

  // Publish storefront
  await prisma.sellerStorefront.update({
    where: { sellerId: args.userId },
    data: { isPublished: true, publishedAt: new Date() },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.userId,
      action: "seller.onboarding.completed",
      entityType: "SellerSubscription",
      entityId: args.userId,
    },
  });

  // Send welcome notification
  await prisma.notification.create({
    data: {
      userId: args.userId,
      type: "SELLER_ONBOARDING_COMPLETE",
      title: "Welcome to Twicely!",
      body: "Your seller account is now active. Start listing items to begin selling!",
      channel: "IN_APP",
    },
  });
}

/**
 * Check if seller profile is complete and active
 *
 * D3 Fix: New helper function
 */
export async function isSellerProfileComplete(userId: string): Promise<{
  isComplete: boolean;
  missingSteps: string[];
}> {
  const missingSteps: string[] = [];

  // Check profile exists
  const profile = await prisma.sellerProfile.findUnique({ where: { sellerId: userId } });
  if (!profile) missingSteps.push("profile");

  // Check subscription is ACTIVE
  const subscription = await prisma.sellerSubscription.findUnique({ where: { sellerId: userId } });
  if (!subscription) {
    missingSteps.push("subscription");
  } else if (subscription.status !== "ACTIVE") {
    missingSteps.push("payment");
  }

  // Check storefront exists (only required for STORE tiers, not SELLER)
  if (subscription && subscription.tier !== "SELLER") {
    const storefront = await prisma.sellerStorefront.findUnique({ where: { sellerId: userId } });
    if (!storefront) missingSteps.push("storefront");
  }

  return {
    isComplete: missingSteps.length === 0,
    missingSteps,
  };
}

// =============================================================================
// BUSINESS VERIFICATION SERVICE (Personal â†’ Business Upgrade)
// Uses BusinessInfo model from Phase 1 (per TWICELY_user_MODEL_LOCKED.md)
// =============================================================================

import { BusinessType, TaxIdType } from "@prisma/client";

// Map enum to display labels
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  SOLE_PROPRIETOR: "Sole Proprietor",
  LLC: "Limited Liability Company (LLC)",
  CORPORATION: "Corporation",
  PARTNERSHIP: "Partnership",
};

export const TAX_ID_TYPE_LABELS: Record<TaxIdType, string> = {
  SSN: "Social Security Number (SSN)",
  EIN: "Employer Identification Number (EIN)",
  ITIN: "Individual Taxpayer Identification Number (ITIN)",
};

export interface BusinessUpgradeInput {
  userId: string;
  legalName: string;
  businessType: BusinessType;
  taxId?: string;
  taxIdType?: TaxIdType;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
}

/**
 * Upgrade seller from Personal to Business
 * This is FREE - required before store subscription
 *
 * Alignment Patch: Uses BusinessInfo model instead of User fields
 */
export async function upgradeToBusinessSeller(input: BusinessUpgradeInput): Promise<{
  success: boolean;
  user: any;
  businessInfo: any;
}> {
  const { userId, legalName, businessType, taxId, taxIdType, address } = input;

  // 1. Verify user exists and is a seller
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { businessInfo: true },
  });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (!user.isSeller) throw new Error("NOT_A_SELLER");
  if (user.sellerType === "BUSINESS") throw new Error("ALREADY_BUSINESS");
  if (user.businessInfo) throw new Error("BUSINESS_INFO_EXISTS");

  // 2. Validate required fields
  if (!legalName?.trim()) throw new Error("LEGAL_NAME_REQUIRED");
  if (!businessType) throw new Error("BUSINESS_TYPE_REQUIRED");
  if (!address?.line1 || !address?.city || !address?.state || !address?.postalCode) {
    throw new Error("ADDRESS_INCOMPLETE");
  }

  // 3. Transaction: Update user + create BusinessInfo
  const result = await prisma.$transaction(async (tx) => {
    // Update user to BUSINESS type
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        sellerType: "BUSINESS",
        businessVerifiedAt: new Date(),
        businessName: legalName.trim(), // Also store display name on User
      },
    });

    // Create BusinessInfo record (canonical location for business data)
    const businessInfo = await tx.businessInfo.create({
      data: {
        userId,
        legalName: legalName.trim(),
        businessType,
        taxId,
        taxIdType: taxIdType ?? "EIN",
        addressLine1: address.line1,
        addressLine2: address.line2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country ?? "US",
        verifiedAt: new Date(), // Auto-verify for now
      },
    });

    // Create verification record
    await tx.sellerVerification.create({
      data: {
        sellerId: userId,
        verificationType: "BUSINESS",
        status: "APPROVED",
        submittedAt: new Date(),
        reviewedAt: new Date(),
        metaJson: { legalName, businessType },
      },
    });

    return { updatedUser, businessInfo };
  });

  // 4. Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: userId,
      action: "seller.upgraded_to_business",
      entityType: "User",
      entityId: userId,
      metaJson: { legalName, businessType },
    },
  });

  return {
    success: true,
    user: result.updatedUser,
    businessInfo: result.businessInfo,
  };
}

/**
 * Check if seller can upgrade to Business
 */
export async function canUpgradeToBusiness(userId: string): Promise<{
  canUpgrade: boolean;
  reason?: string;
  currentSellerType: "PERSONAL" | "BUSINESS";
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSeller: true, sellerType: true, businessInfo: true },
  });

  if (!user) {
    return { canUpgrade: false, reason: "USER_NOT_FOUND", currentSellerType: "PERSONAL" };
  }

  if (!user.isSeller) {
    return { canUpgrade: false, reason: "NOT_A_SELLER", currentSellerType: "PERSONAL" };
  }

  if (user.sellerType === "BUSINESS") {
    return { canUpgrade: false, reason: "ALREADY_BUSINESS", currentSellerType: "BUSINESS" };
  }

  return { canUpgrade: true, currentSellerType: "PERSONAL" };
}

/**
 * Get business info for a user
 */
export async function getBusinessInfo(userId: string) {
  return prisma.businessInfo.findUnique({
    where: { userId },
  });
}

/**
 * Update onboarding step
 */
export async function completeOnboardingStep(
  sellerId: string,
  step: OnboardingStep
): Promise<OnboardingProgress> {
  const profile = await prisma.sellerProfile.findUnique({
    where: { sellerId },
  });
  
  if (!profile) {
    throw new Error("SELLER_NOT_FOUND");
  }
  
  const completedSteps = [...profile.completedSteps];
  if (!completedSteps.includes(step)) {
    completedSteps.push(step);
  }
  
  // Determine next step
  const currentIndex = ONBOARDING_STEPS.indexOf(step);
  const nextStep = ONBOARDING_STEPS[currentIndex + 1] ?? "COMPLETED";
  
  // Update profile
  await prisma.sellerProfile.update({
    where: { sellerId },
    data: {
      onboardingStep: nextStep,
      completedSteps,
    },
  });
  
  // Check if fully onboarded
  if (nextStep === "COMPLETED") {
    await prisma.sellerProfile.update({
      where: { sellerId },
      data: {
        status: "SELLER_PENDING", // Awaiting verification
      },
    });
  }
  
  return getOnboardingProgress(sellerId);
}

/**
 * Get onboarding progress
 */
export async function getOnboardingProgress(sellerId: string): Promise<OnboardingProgress> {
  const profile = await prisma.sellerProfile.findUnique({
    where: { sellerId },
  });
  
  if (!profile) {
    return {
      currentStep: "STARTED",
      completedSteps: [],
      remainingSteps: ONBOARDING_STEPS,
      percentComplete: 0,
    };
  }
  
  const completed = profile.completedSteps as OnboardingStep[];
  const remaining = ONBOARDING_STEPS.filter(s => !completed.includes(s));
  const percent = Math.round((completed.length / ONBOARDING_STEPS.length) * 100);
  
  return {
    currentStep: profile.onboardingStep as OnboardingStep,
    completedSteps: completed,
    remainingSteps: remaining,
    percentComplete: percent,
  };
}
```

---

## 4) Verification Service

Create `packages/core/sellers/verificationService.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

/**
 * Submit verification document
 */
export async function submitVerification(
  sellerId: string,
  verificationType: string,
  documentType: string,
  documentUrl: string
): Promise<any> {
  const verification = await prisma.sellerVerification.create({
    data: {
      sellerId,
      verificationType,
      documentType,
      documentUrl,
      status: "PENDING",
    },
  });
  
  // Update seller status to pending
  await prisma.sellerProfile.update({
    where: { sellerId },
    data: { status: "SELLER_PENDING" },
  });
  
  await emitAuditEvent({
    eventType: "seller.verification_submitted",
    actorType: "USER",
    actorId: sellerId,
    entityType: "SellerVerification",
    entityId: verification.id,
    metaJson: { verificationType, documentType },
  });
  
  return verification;
}

/**
 * Approve verification (staff action)
 */
export async function approveVerification(
  verificationId: string,
  staffId: string,
  notes?: string
): Promise<any> {
  const verification = await prisma.sellerVerification.update({
    where: { id: verificationId },
    data: {
      status: "APPROVED",
      reviewedByStaffId: staffId,
      reviewedAt: new Date(),
      reviewNotes: notes,
    },
  });
  
  // Check if all required verifications are approved
  await checkAndActivateSeller(verification.sellerId);
  
  await emitAuditEvent({
    eventType: "seller.verification_approved",
    actorType: "STAFF",
    actorId: staffId,
    entityType: "SellerVerification",
    entityId: verificationId,
    metaJson: { sellerId: verification.sellerId },
  });
  
  return verification;
}

/**
 * Reject verification (staff action)
 */
export async function rejectVerification(
  verificationId: string,
  staffId: string,
  reason: string
): Promise<any> {
  const verification = await prisma.sellerVerification.update({
    where: { id: verificationId },
    data: {
      status: "REJECTED",
      reviewedByStaffId: staffId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    },
  });
  
  await emitAuditEvent({
    eventType: "seller.verification_rejected",
    actorType: "STAFF",
    actorId: staffId,
    entityType: "SellerVerification",
    entityId: verificationId,
    metaJson: { sellerId: verification.sellerId, reason },
  });
  
  return verification;
}

/**
 * Check if seller can be activated
 */
async function checkAndActivateSeller(sellerId: string): Promise<void> {
  // Get all verifications
  const verifications = await prisma.sellerVerification.findMany({
    where: { sellerId },
  });
  
  // Check required types are approved
  const identityApproved = verifications.some(
    v => v.verificationType === "identity" && v.status === "APPROVED"
  );
  
  // For v1, only identity is required
  if (identityApproved) {
    await prisma.sellerProfile.update({
      where: { sellerId },
      data: {
        status: "SELLER_ACTIVE",
        verifiedAt: new Date(),
      },
    });
  }
}
```

---

## 5) Payout Destination Service

Create `packages/core/sellers/payoutDestinationService.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

/**
 * Add payout destination
 */
export async function addPayoutDestination(
  sellerId: string,
  kind: string,
  providerRef: string,
  displayInfo: { displayName?: string; last4?: string; bankName?: string }
): Promise<any> {
  // Make existing destinations non-primary
  await prisma.payoutDestination.updateMany({
    where: { sellerId, isPrimary: true },
    data: { isPrimary: false },
  });
  
  const destination = await prisma.payoutDestination.create({
    data: {
      sellerId,
      kind,
      providerRef,
      displayName: displayInfo.displayName,
      last4: displayInfo.last4,
      bankName: displayInfo.bankName,
      isPrimary: true,
      isVerified: false,
    },
  });
  
  // Update payouts status
  await prisma.sellerProfile.update({
    where: { sellerId },
    data: { payoutsStatus: "PAYOUTS_REVIEW" },
  });
  
  await emitAuditEvent({
    eventType: "seller.payout_destination_added",
    actorType: "USER",
    actorId: sellerId,
    entityType: "PayoutDestination",
    entityId: destination.id,
    metaJson: { kind, last4: displayInfo.last4 },
  });
  
  return destination;
}

/**
 * Verify payout destination (staff action)
 */
export async function verifyPayoutDestination(
  destinationId: string,
  staffId: string
): Promise<any> {
  const destination = await prisma.payoutDestination.update({
    where: { id: destinationId },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
      verifiedByStaffId: staffId,
    },
  });
  
  // Enable payouts
  await prisma.sellerProfile.update({
    where: { sellerId: destination.sellerId },
    data: { payoutsStatus: "PAYOUTS_ENABLED" },
  });
  
  await emitAuditEvent({
    eventType: "seller.payout_destination_verified",
    actorType: "STAFF",
    actorId: staffId,
    entityType: "PayoutDestination",
    entityId: destinationId,
    metaJson: { sellerId: destination.sellerId },
  });
  
  return destination;
}

/**
 * Check if seller can receive payouts
 */
export async function canReceivePayouts(sellerId: string): Promise<{
  eligible: boolean;
  blockers: string[];
}> {
  const profile = await prisma.sellerProfile.findUnique({
    where: { sellerId },
    include: { payoutDestinations: { where: { isPrimary: true } } },
  });
  
  const blockers: string[] = [];
  
  if (!profile) {
    return { eligible: false, blockers: ["SELLER_NOT_FOUND"] };
  }
  
  if (profile.status !== "SELLER_ACTIVE") {
    blockers.push("SELLER_NOT_ACTIVE");
  }
  
  if (profile.payoutsStatus !== "PAYOUTS_ENABLED") {
    blockers.push("PAYOUTS_NOT_ENABLED");
  }
  
  const primaryDest = profile.payoutDestinations[0];
  if (!primaryDest) {
    blockers.push("NO_PAYOUT_DESTINATION");
  } else if (!primaryDest.isVerified) {
    blockers.push("DESTINATION_NOT_VERIFIED");
  }
  
  return {
    eligible: blockers.length === 0,
    blockers,
  };
}
```

---

## 6) Payout Gate (Integration Point)

In Phase 4 payout execution, integrate this gate:

```ts
import { canReceivePayouts } from "@/packages/core/sellers/payoutDestinationService";

export async function executeSellerPayout(payoutId: string) {
  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  
  // Check payout eligibility
  const eligibility = await canReceivePayouts(payout.sellerId);
  if (!eligibility.eligible) {
    throw new Error(`PAYOUT_BLOCKED: ${eligibility.blockers.join(", ")}`);
  }
  
  // Proceed with payout...
}
```

---

## 6.5) Vacation Mode Service (HIGH-3)

Create `packages/core/sellers/vacationMode.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type VacationModeSettings = {
  startDate?: Date;
  endDate?: Date;
  publicMessage?: string;
  hideListings?: boolean;
  pauseOrders?: boolean;
  extendHandling?: boolean;
  extraHandlingDays?: number;
  autoReplyEnabled?: boolean;
  autoReplyMessage?: string;
};

export async function activateVacationMode(
  sellerId: string,
  settings: VacationModeSettings,
  actorUserId: string
) {
  const now = new Date();
  
  // If start date is in future, just save settings
  const shouldActivateNow = !settings.startDate || settings.startDate <= now;

  const vacation = await prisma.sellerVacationMode.upsert({
    where: { sellerId },
    update: {
      isActive: shouldActivateNow,
      startDate: settings.startDate,
      endDate: settings.endDate,
      publicMessage: settings.publicMessage,
      hideListings: settings.hideListings ?? false,
      pauseOrders: settings.pauseOrders ?? true,
      extendHandling: settings.extendHandling ?? true,
      extraHandlingDays: settings.extraHandlingDays ?? 0,
      autoReplyEnabled: settings.autoReplyEnabled ?? false,
      autoReplyMessage: settings.autoReplyMessage,
      activatedAt: shouldActivateNow ? now : null,
      activatedBy: shouldActivateNow ? actorUserId : null,
      deactivatedAt: null,
    },
    create: {
      sellerId,
      isActive: shouldActivateNow,
      startDate: settings.startDate,
      endDate: settings.endDate,
      publicMessage: settings.publicMessage,
      hideListings: settings.hideListings ?? false,
      pauseOrders: settings.pauseOrders ?? true,
      extendHandling: settings.extendHandling ?? true,
      extraHandlingDays: settings.extraHandlingDays ?? 0,
      autoReplyEnabled: settings.autoReplyEnabled ?? false,
      autoReplyMessage: settings.autoReplyMessage,
      activatedAt: shouldActivateNow ? now : null,
      activatedBy: shouldActivateNow ? actorUserId : null,
    },
  });

  if (shouldActivateNow) {
    await applyVacationModeEffects(sellerId, vacation);
  }

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action: shouldActivateNow ? "vacation_mode.activated" : "vacation_mode.scheduled",
      entityType: "SellerVacationMode",
      entityId: vacation.id,
      metaJson: settings,
    },
  });

  return vacation;
}

export async function deactivateVacationMode(sellerId: string, actorUserId: string) {
  const vacation = await prisma.sellerVacationMode.findUnique({
    where: { sellerId },
  });

  if (!vacation || !vacation.isActive) {
    return null;
  }

  const updated = await prisma.sellerVacationMode.update({
    where: { sellerId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
    },
  });

  await removeVacationModeEffects(sellerId);

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId,
      action: "vacation_mode.deactivated",
      entityType: "SellerVacationMode",
      entityId: vacation.id,
    },
  });

  return updated;
}

async function applyVacationModeEffects(sellerId: string, vacation: any) {
  // If hideListings, apply soft enforcement (removes from search)
  if (vacation.hideListings) {
    await prisma.listing.updateMany({
      where: { ownerUserId: sellerId, status: "ACTIVE" },
      data: { enforcementState: "SOFT" },
    });
  }

  // If pauseOrders, pause all active listings
  if (vacation.pauseOrders) {
    await prisma.listing.updateMany({
      where: { ownerUserId: sellerId, status: "ACTIVE" },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
  }
}

async function removeVacationModeEffects(sellerId: string) {
  // Restore paused listings
  await prisma.listing.updateMany({
    where: { 
      ownerUserId: sellerId, 
      status: "PAUSED",
    },
    data: { 
      status: "ACTIVE", 
      enforcementState: "CLEAR",
      activatedAt: new Date(),
    },
  });
}

// Cron job: Check for scheduled vacations to activate/deactivate
export async function processScheduledVacations() {
  const now = new Date();

  // Activate scheduled vacations
  const toActivate = await prisma.sellerVacationMode.findMany({
    where: {
      isActive: false,
      startDate: { lte: now },
      endDate: { gt: now },
    },
  });

  for (const v of toActivate) {
    await prisma.sellerVacationMode.update({
      where: { id: v.id },
      data: { isActive: true, activatedAt: now, activatedBy: "system" },
    });
    await applyVacationModeEffects(v.sellerId, v);
  }

  // Deactivate expired vacations
  const toDeactivate = await prisma.sellerVacationMode.findMany({
    where: {
      isActive: true,
      endDate: { lte: now },
    },
  });

  for (const v of toDeactivate) {
    await deactivateVacationMode(v.sellerId, "system");
  }

  return { activated: toActivate.length, deactivated: toDeactivate.length };
}

// Check if seller is on vacation (for checkout blocking)
export async function isSellerOnVacation(sellerId: string): Promise<boolean> {
  const vacation = await prisma.sellerVacationMode.findUnique({
    where: { sellerId },
  });

  return vacation?.isActive && vacation?.pauseOrders === true;
}

// Get auto-reply message if enabled
export async function getVacationAutoReply(sellerId: string): Promise<string | null> {
  const vacation = await prisma.sellerVacationMode.findUnique({
    where: { sellerId },
  });

  if (vacation?.isActive && vacation?.autoReplyEnabled && vacation?.autoReplyMessage) {
    return vacation.autoReplyMessage;
  }

  return null;
}
```

### Vacation Mode API

Create `apps/web/app/api/seller/vacation/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { activateVacationMode, deactivateVacationMode } from "@/packages/core/sellers/vacationMode";

const prisma = new PrismaClient();

// GET /api/seller/vacation - Get vacation mode status
export async function GET(req: Request) {
  const sellerId = "twi_u_replace"; // TODO: requireUserAuth()
  
  const vacation = await prisma.sellerVacationMode.findUnique({
    where: { sellerId },
  });
  
  return NextResponse.json({ vacation });
}

// POST /api/seller/vacation - Activate vacation mode
export async function POST(req: Request) {
  const sellerId = "twi_u_replace"; // TODO: requireUserAuth()
  const body = await req.json();
  
  const vacation = await activateVacationMode(sellerId, {
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    publicMessage: body.publicMessage,
    hideListings: body.hideListings,
    pauseOrders: body.pauseOrders,
    extendHandling: body.extendHandling,
    extraHandlingDays: body.extraHandlingDays,
    autoReplyEnabled: body.autoReplyEnabled,
    autoReplyMessage: body.autoReplyMessage,
  }, sellerId);
  
  return NextResponse.json({ vacation });
}

// DELETE /api/seller/vacation - Deactivate vacation mode
export async function DELETE(req: Request) {
  const sellerId = "twi_u_replace"; // TODO: requireUserAuth()
  
  const vacation = await deactivateVacationMode(sellerId, sellerId);
  
  return NextResponse.json({ vacation });
}
```

### Integration Points

**In checkout flow (Phase 3):**
```ts
import { isSellerOnVacation } from "@/packages/core/sellers/vacationMode";

// Before creating order
const onVacation = await isSellerOnVacation(listing.ownerUserId);
if (onVacation) {
  return NextResponse.json({ error: "SELLER_ON_VACATION" }, { status: 400 });
}
```

**In messaging (Phase 27):**
```ts
import { getVacationAutoReply } from "@/packages/core/sellers/vacationMode";

// After buyer sends message
const autoReply = await getVacationAutoReply(sellerId);
if (autoReply) {
  await createAutoReplyMessage(conversationId, autoReply);
}
```

### Business Upgrade API Route

Create `apps/web/app/api/seller/business/upgrade/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  upgradeToBusinessSeller,
  canUpgradeToBusiness,
  getBusinessInfo,
} from "@/packages/core/sellers/businessUpgrade";
import { z } from "zod";

const UpgradeSchema = z.object({
  legalName: z.string().min(1).max(200),
  businessType: z.enum(["SOLE_PROPRIETOR", "LLC", "CORPORATION", "PARTNERSHIP"]),
  taxId: z.string().optional(),
  taxIdType: z.enum(["SSN", "EIN", "ITIN"]).optional(),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().default("US"),
  }),
});

// GET /api/seller/business/upgrade - Check eligibility
export async function GET() {
  const ctx = await requireAuth();

  const [eligibility, businessInfo] = await Promise.all([
    canUpgradeToBusiness(ctx.userId),
    getBusinessInfo(ctx.userId),
  ]);

  return NextResponse.json({ ...eligibility, businessInfo });
}

// POST /api/seller/business/upgrade - Perform upgrade
export async function POST(req: Request) {
  const ctx = await requireAuth();

  const body = await req.json();
  const parsed = UpgradeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await upgradeToBusinessSeller({
      userId: ctx.userId,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
```

---

## 7) Health Provider

Create `packages/core/health/providers/sellerOnboardingHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const sellerOnboardingHealthProvider: HealthProvider = {
  id: "seller_onboarding",
  label: "Seller Onboarding & Verification",
  description: "Validates seller onboarding flow and verification workflow",
  version: "1.0.0",
  
  async run(): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;
    
    // Check 1: No stuck pending verifications (>7 days)
    const stuckVerifications = await prisma.sellerVerification.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 7 * 86400000) },
      },
    });
    checks.push({
      id: "seller.no_stuck_verifications",
      label: "No stuck verification requests",
      status: stuckVerifications === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: stuckVerifications === 0 
        ? "All verifications processed"
        : `${stuckVerifications} pending >7 days`,
    });
    if (stuckVerifications > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 2: Active sellers have verified destinations
    const activeSellersWithoutDest = await prisma.sellerProfile.count({
      where: {
        status: "SELLER_ACTIVE",
        payoutsStatus: "PAYOUTS_ENABLED",
        payoutDestinations: { none: { isVerified: true } },
      },
    });
    checks.push({
      id: "seller.active_have_destinations",
      label: "Active sellers have verified payout destinations",
      status: activeSellersWithoutDest === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: activeSellersWithoutDest === 0 
        ? "All active sellers configured"
        : `${activeSellersWithoutDest} active sellers missing verified destination`,
    });
    if (activeSellersWithoutDest > 0 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;
    
    // Check 3: No payouts-enabled without verification
    const enabledWithoutVerified = await prisma.sellerProfile.count({
      where: {
        payoutsStatus: "PAYOUTS_ENABLED",
        payoutDestinations: { none: { isVerified: true } },
      },
    });
    checks.push({
      id: "seller.payouts_require_verification",
      label: "Payouts enabled only with verified destination",
      status: enabledWithoutVerified === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: enabledWithoutVerified === 0 
        ? "Payout gate enforced"
        : `${enabledWithoutVerified} sellers have payouts enabled without verified destination!`,
    });
    if (enabledWithoutVerified > 0) status = HEALTH_STATUS.FAIL;
    
    // Check 4: Seller status distribution
    const statusCounts = await prisma.sellerProfile.groupBy({
      by: ["status"],
      _count: true,
    });
    const statusSummary = statusCounts.map(s => `${s.status}: ${s._count}`).join(", ");
    checks.push({
      id: "seller.status_distribution",
      label: "Seller status distribution",
      status: HEALTH_STATUS.PASS,
      message: statusSummary || "No sellers",
    });
    
    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS ? "Seller onboarding healthy" : "Seller onboarding has issues",
      checks,
    };
  },
};
```

---

## 8) Doctor Checks

```ts
async function runPhase13DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Test 1: Seller can create profile
  const testSellerId = `doctor_test_seller_${Date.now()}`;
  const profile = await ensureSellerProfile(testSellerId);
  
  results.push({
    id: "seller.can_create_profile",
    label: "Seller can create profile",
    status: profile ? "PASS" : "FAIL",
    message: profile ? `Profile created: ${profile.id}` : "Failed to create",
  });
  
  // Test 2: Destination saved unverified
  const destination = await addPayoutDestination(
    testSellerId,
    "bank",
    "test_ref",
    { displayName: "Test Bank", last4: "1234" }
  );
  
  results.push({
    id: "seller.destination_unverified",
    label: "Destination saved as unverified",
    status: !destination.isVerified ? "PASS" : "FAIL",
    message: !destination.isVerified ? "Correctly unverified" : "Should be unverified",
  });
  
  // Test 3: Payout blocked until verified
  const eligibility1 = await canReceivePayouts(testSellerId);
  
  results.push({
    id: "seller.payout_blocked_unverified",
    label: "Payout blocked until destination verified",
    status: !eligibility1.eligible ? "PASS" : "FAIL",
    message: !eligibility1.eligible 
      ? `Blocked: ${eligibility1.blockers.join(", ")}`
      : "Should be blocked",
  });
  
  // Test 4: After verification, payout passes gate
  // Activate seller and verify destination
  await prisma.sellerProfile.update({
    where: { sellerId: testSellerId },
    data: { status: "SELLER_ACTIVE", payoutsStatus: "PAYOUTS_ENABLED" },
  });
  await prisma.payoutDestination.update({
    where: { id: destination.id },
    data: { isVerified: true, verifiedAt: new Date(), verifiedByStaffId: "doctor" },
  });
  
  const eligibility2 = await canReceivePayouts(testSellerId);
  
  results.push({
    id: "seller.payout_passes_after_verify",
    label: "Payout passes gate after verification",
    status: eligibility2.eligible ? "PASS" : "FAIL",
    message: eligibility2.eligible 
      ? "Gate passed"
      : `Still blocked: ${eligibility2.blockers.join(", ")}`,
  });
  
  // Cleanup
  await prisma.payoutDestination.deleteMany({ where: { sellerId: testSellerId } });
  await prisma.sellerVerification.deleteMany({ where: { sellerId: testSellerId } });
  await prisma.sellerProfile.delete({ where: { sellerId: testSellerId } }).catch(() => {});
  
  return results;
}
```

---

## 9) Phase 13 Completion Criteria

- [ ] SellerProfile model migrated
- [ ] SellerVerification model migrated
- [ ] PayoutDestination model migrated
- [ ] Seller can create profile
- [ ] Seller can submit verification
- [ ] Staff can approve/reject verification
- [ ] Destination saved unverified by default
- [ ] Staff can verify destination
- [ ] Payout blocked until destination verified
- [ ] After verification, payout gate passes
- [ ] Corp verification queue UI
- [ ] Seller payout settings UI
- [ ] Health provider passing
- [ ] Doctor checks passing
- [ ] **Casual Seller:** `ensureSellerProfile` creates ACTIVE subscription at SELLER tier (casual seller default)
- [ ] **Casual Seller:** `startSellerOnboarding` validates all tiers (SELLER-ENTERPRISE), SELLER tier is immediate activation
- [ ] **Casual Seller:** `completeSellerOnboarding` activates STORE tier subscriptions after payment

---

## 10) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 13 implementation |
| 1.1 | 2026-01-21 | D1/D3: Added tier-aware onboarding, no FREE tier, PENDING subscription at STARTER |
| 1.2 | 2026-01-21 | Casual Seller Patch: Default to SELLER tier, immediate activation, no storefront for casual sellers |
| 1.3 | 2026-01-21 | Personal/Business Patch: Added upgradeToBusinessSeller, canUpgradeToBusiness services |
| 1.4 | 2026-01-21 | Alignment Patch: Uses BusinessInfo model, added API route, getBusinessInfo service |
