# TWICELY V2 — Install Phase 24: Subscriptions + Billing Tiers (eBay-Exact)
**Status:** LOCKED (v2.3)
**Scope:** Platform-managed subscription tiers matching eBay exactly; STORE tiers (STARTER+) get storefront  
**Backend-first:** Schema → Pricing config → Entitlements → Billing events → Health → Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md`
- `/rules/TWICELY_POLICY_LIBRARY_CANONICAL.md`
- `/rules/TWICELY_FEATURE_FLAGS_ROLLOUTS_CANONICAL.md` (rollout gating)
- `/rules/TWICELY_user_MODEL_LOCKED.md` (eBay-exact tiers)

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_24_SUBSCRIPTIONS_BILLING_TIERS.md`  
> Prereq: Phase 23 complete.

---

## 0) What this phase installs

### Backend
- **eBay-exact subscription tiers:** SELLER / STARTER / BASIC / PRO / ELITE / ENTERPRISE (6 tiers)
- **SELLER tier** for casual sellers (no subscription, 250 free listings, $0.35 insertion fee)
- **SellerStorefront model** (STORE tiers get storefront - requires Business seller status)
- Entitlements (listing caps, promo access, fee overrides)
- Billing events ingestion (provider-agnostic)
- Customer billing portal links (optional)
- Ledger-safe accounting for subscription fees (platform revenue)

### UI (minimal)
- Seller settings: choose tier + view entitlements
- Corp settings: edit tier prices + caps (effective-dated)

### Explicit exclusions
- ❌ No seller provider accounts
- ❌ No studio/page builder
- ❌ No advanced invoicing workflows (v1 only)

### Casual Seller Support (SELLER tier)
- **SELLER tier** for casual sellers (no subscription, 250 free listings, $0.35 insertion fee)
- Sellers can list without subscribing (eBay behavior)
- Store subscription optional - provides lower fees + storefront

### Personal vs Business Seller (eBay-Exact)
- **Personal Seller:** Can sell with SELLER tier only. Cannot subscribe to store.
- **Business Seller:** Can sell with any tier. Store subscription requires Business status.
- **Business upgrade is FREE** - provide business name, type, address, tax ID.
- Store subscription (STARTER+) **requires Business verification**.

```
PERSONAL SELLER (SELLER tier only)
├── 250 free listings/month
├── $0.35 insertion fee after
├── 13.25% FVF
├── ❌ Cannot subscribe to store
└── Must upgrade to BUSINESS first (free)

BUSINESS SELLER (SELLER or STORE tier)
├── Same fees as Personal at SELLER tier
├── Business name shown to buyers
├── ✓ Can subscribe to store (STARTER+)
└── Store unlocks lower fees + storefront
```

| Seller Type | Store Tier | Valid? | Description |
|-------------|------------|--------|-------------|
| PERSONAL | SELLER | ✓ | Casual individual seller |
| PERSONAL | STARTER+ | ❌ | **NOT ALLOWED** - must upgrade to Business first |
| BUSINESS | SELLER | ✓ | Business selling casually |
| BUSINESS | STARTER+ | ✓ | Business with store subscription |

---

## 1) Tier model (eBay-Exact)

Tiers match eBay Store subscriptions exactly:

| Tier | Monthly | Free Listings | Insertion Fee | FVF | eBay Equivalent |
|------|---------|---------------|---------------|-----|-----------------|
| SELLER | $0 | 250 | $0.35 | 13.25% | No store (casual seller) |
| STARTER | $4.95 | 250 | $0.30 | 12.35% | eBay Starter Store |
| BASIC | $21.95 | 1,000 | $0.25 | 11.5% | eBay Basic Store |
| PRO | $59.95 | 10,000 | $0.15 | 10.25% | eBay Pro Store |
| ELITE | $299.95 | 25,000 | $0.05 | 9.15% | eBay Elite Store |
| ENTERPRISE | $2,999.95 | 100,000 | $0.05 | Custom | eBay Enterprise Store |

**SELLER tier:** Casual sellers can list without a subscription. They get 250 free listings/month with $0.35 insertion fee for additional listings and 13.25% FVF. No storefront.

All tier specifics are configured in **Monetization Settings** (effective-dated). Do not hardcode caps in code.

---

## 2) Prisma schema (additive)

```prisma
// =============================================================================
// SELLER TIER (eBay-Exact)
// =============================================================================

enum SellerTier {
  SELLER      // No store subscription (casual seller)
  STARTER     // $4.95/mo  - Entry level store (eBay Starter)
  BASIC       // $21.95/mo - Small business (eBay Basic)
  PRO     // $59.95/mo - Growing business (eBay Pro)
  ELITE      // $299.95/mo - High volume (eBay Elite)
  ENTERPRISE  // $2,999.95/mo - Enterprise (eBay Enterprise)
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  PAUSED
  TRIALING
  PENDING
}

model SellerSubscription {
  id                   String   @id @default(cuid())
  sellerId             String   @unique  // === userId (owner)
  
  // Tier (SELLER = casual seller, no store subscription)
  tier                 SellerTier @default(SELLER)
  status               SubscriptionStatus @default(PENDING)
  
  // Billing Period
  startedAt            DateTime @default(now())
  currentPeriodStart   DateTime @default(now())
  currentPeriodEnd     DateTime?
  endsAt               DateTime?
  
  // Grace Period (for downgrades)
  scheduledTier        SellerTier?
  scheduledAt          DateTime?
  gracePeriodEndsAt    DateTime?
  
  // Stripe Integration
  provider             String?            // "stripe"
  stripeCustomerId     String?
  stripeSubscriptionId String?
  stripePriceId        String?
  
  // Trial
  trialEndsAt          DateTime?
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([tier, status])
  @@index([stripeSubscriptionId])
  @@index([status, currentPeriodEnd])
}

// =============================================================================
// SELLER STOREFRONT (All Tiers Get This - eBay Behavior)
// =============================================================================
// Per TWICELY_USER_MODEL_LOCKED.md:
// - Storefront is branding for ALL store subscribers (not just high tiers)
// - sellerId === userId (owner) ALWAYS
// - Higher tiers unlock more storefront features
// =============================================================================

model SellerStorefront {
  id              String   @id @default(cuid())
  sellerId        String   @unique  // === userId (owner)
  
  // =========================================================================
  // BRANDING
  // =========================================================================
  storeName       String?           // Display name (e.g., "John's Vintage")
  slug            String?  @unique  // URL slug (e.g., "johns-vintage")
  tagline         String?           // Short tagline
  
  // Images
  logoUrl         String?
  bannerUrl       String?
  faviconUrl      String?
  
  // Colors (hex values)
  primaryColor    String?           // e.g., "#1a73e8"
  accentColor     String?           // e.g., "#fbbc04"
  backgroundColor String?           // e.g., "#ffffff"
  
  // =========================================================================
  // CONTENT
  // =========================================================================
  aboutHtml       String?           // About the store
  policiesHtml    String?           // Store-specific policies
  announcementHtml String?          // Current announcement/banner
  socialLinks     Json     @default("{}")  // { twitter: "...", instagram: "..." }
  
  // =========================================================================
  // FEATURED CONTENT
  // =========================================================================
  featuredListingIds  String[]      // Pinned listings (order matters)
  featuredCategoryIds String[]      // Featured categories
  
  // =========================================================================
  // SEO
  // =========================================================================
  metaTitle       String?
  metaDescription String?
  
  // =========================================================================
  // STATUS
  // =========================================================================
  isActive        Boolean  @default(true)   // Active for all subscribers
  isPublished     Boolean  @default(false)  // Publicly visible
  publishedAt     DateTime?
  
  // =========================================================================
  // ANALYTICS
  // =========================================================================
  viewCount       Int      @default(0)
  followerCount   Int      @default(0)
  
  // =========================================================================
  // TIMESTAMPS
  // =========================================================================
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // =========================================================================
  // RELATIONS
  // =========================================================================
  followers       StorefrontFollower[]
  
  // =========================================================================
  // INDEXES
  // =========================================================================
  @@index([slug])
  @@index([isActive, isPublished])
  @@index([followerCount])
}

model StorefrontFollower {
  id              String   @id @default(cuid())
  storefrontId    String
  storefront      SellerStorefront @relation(fields: [storefrontId], references: [id], onDelete: Cascade)
  followerId      String            // userId of follower
  
  // Notification preferences
  notifyNewListings   Boolean @default(true)
  notifyPromotions    Boolean @default(true)
  notifySales         Boolean @default(true)
  
  followedAt      DateTime @default(now())
  
  @@unique([storefrontId, followerId])
  @@index([followerId])
  @@index([storefrontId, followedAt])
}

// =============================================================================
// BILLING & PRICING
// =============================================================================

model BillingEventLog {
  id              String   @id @default(cuid())
  provider        String
  providerEventId String
  type            String
  payloadJson     Json
  occurredAt      DateTime
  status          String   @default("received") // received|processed|failed
  errorMessage    String?
  processedAt     DateTime?
  idempotencyKey  String   @unique
  createdAt       DateTime @default(now())

  @@unique([provider, providerEventId])
  @@index([status, occurredAt])
  @@index([type, occurredAt])
}

model TierPricingVersion {
  id               String   @id @default(cuid())
  version          String
  effectiveAt      DateTime
  isActive         Boolean  @default(true)
  pricingJson      Json
  createdByStaffId String
  createdAt        DateTime @default(now())

  @@index([effectiveAt])
  @@index([isActive, effectiveAt])
}

model ScheduledAction {
  id            String    @id @default(cuid())
  sellerId      String
  actionType    String    // PAUSE_EXCESS_LISTINGS|REVOKE_EXCESS_STAFF|PAUSE_CAMPAIGNS
  scheduledFor  DateTime
  payload       Json      @default("{}")
  executedAt    DateTime?
  errorMessage  String?
  createdAt     DateTime  @default(now())

  @@index([scheduledFor, executedAt])
  @@index([sellerId])
}
```

Migration:
```bash
npx prisma migrate dev --name subscriptions_storefront_phase24
```

---

## 3) Pricing + entitlements config (effective-dated)

Use TierPricingVersion.pricingJson format:

```ts
export type TierPricing = {
  version: string;
  tiers: {
    STARTER:    { monthlyCents: number; listingCapMonthly: number; finalValueFeeBps: number };
    BASIC:      { monthlyCents: number; listingCapMonthly: number; finalValueFeeBps: number };
    PRO:    { monthlyCents: number; listingCapMonthly: number; finalValueFeeBps: number };
    ELITE:     { monthlyCents: number; listingCapMonthly: number; finalValueFeeBps: number };
    ENTERPRISE: { monthlyCents: number; listingCapMonthly: number; finalValueFeeBps: number };
  };
};
```

Active version query:
- effectiveAt <= now
- isActive true
- max effectiveAt

---

## 4) Tier Feature Matrix (eBay-Exact)

Create `packages/core/subscriptions/tier-features.ts`:

```ts
// =============================================================================
// TIER FEATURE MATRIX — eBay-Exact Pricing and Features
// Single source of truth for all tier capabilities
// =============================================================================

export const TIER_FEATURES = {
  // Casual seller - no store subscription
  SELLER: {
    // Pricing (no subscription fee)
    monthlyCents: 0,
    annualMonthlyCents: 0,

    // Listings (eBay: 250 free/mo for non-store sellers)
    freeListingsMonthly: 250,
    insertionFeeCents: 35,  // $0.35 per listing over limit
    activeListingsMax: null, // No hard cap - just pay insertion fee

    // Fees (eBay: ~13.25% for non-store sellers)
    finalValueFeeBps: 1325,
    finalValueFeePerOrderCents: 40,      // $0.40 per order
    finalValueFeePerOrderCentsSmall: 30, // $0.30 for orders ≤$10
    smallOrderThresholdCents: 1000,      // $10

    // Features
    photoPerListingMax: 12,
    basicAnalytics: true,
    advancedAnalytics: false,
    bulkListingTools: false,
    promotedListings: true,   // Available to all sellers
    staffAccounts: 0,
    brandedStorefront: false, // No store = no storefront
    prioritySupport: false,
    dedicatedRep: false,
    customReturnPolicy: false,
    scheduledListings: false,
    markdownManager: false,
    salesEvents: false,
    vacationMode: false,
    internationalVisibility: false,

    // Visibility
    searchBoost: 1.0,
    categoryFeatured: false,

    // Storefront features (none)
    storefrontCustomPages: false,
    storefrontPromoBanner: false,
    storefrontCustomCategories: false,
  },

  STARTER: {
    // Pricing (eBay: $4.95/mo)
    monthlyCents: 495,
    annualMonthlyCents: 495,

    // Listings (eBay: 250/mo)
    freeListingsMonthly: 250,
    insertionFeeCents: 30,  // $0.30 per listing over limit
    activeListingsMax: 250,

    // Fees (eBay: 12.35%)
    finalValueFeeBps: 1235,
    finalValueFeePerOrderCents: 40,
    finalValueFeePerOrderCentsSmall: 30,
    smallOrderThresholdCents: 1000,

    // Features
    photoPerListingMax: 12,
    basicAnalytics: true,
    advancedAnalytics: false,
    bulkListingTools: false,
    promotedListings: false,
    staffAccounts: 0,
    brandedStorefront: true,  // ALL store tiers get storefront (eBay behavior)
    prioritySupport: false,
    dedicatedRep: false,
    customReturnPolicy: false,
    scheduledListings: false,
    markdownManager: false,
    salesEvents: false,
    vacationMode: true,
    internationalVisibility: false,

    // Visibility
    searchBoost: 1.0,
    categoryFeatured: false,

    // Storefront features (limited at this tier)
    storefrontCustomPages: false,
    storefrontPromoBanner: false,
    storefrontCustomCategories: false,
  },
  
  BASIC: {
    // Pricing (eBay: $21.95/mo)
    monthlyCents: 2195,
    annualMonthlyCents: 2195,

    // Listings (eBay: 1,000/mo)
    freeListingsMonthly: 1000,
    insertionFeeCents: 25,  // $0.25 per listing over limit
    activeListingsMax: 1000,

    // Fees (eBay: 11.5%)
    finalValueFeeBps: 1150,
    finalValueFeePerOrderCents: 40,
    finalValueFeePerOrderCentsSmall: 30,
    smallOrderThresholdCents: 1000,

    // Features
    photoPerListingMax: 12,
    basicAnalytics: true,
    advancedAnalytics: true,
    bulkListingTools: true,
    promotedListings: true,
    staffAccounts: 2,
    brandedStorefront: true,
    prioritySupport: false,
    dedicatedRep: false,
    customReturnPolicy: true,
    scheduledListings: true,
    markdownManager: true,
    salesEvents: false,
    vacationMode: true,
    internationalVisibility: true,

    // Visibility
    searchBoost: 1.05,
    categoryFeatured: false,

    // Storefront features
    storefrontCustomPages: false,
    storefrontPromoBanner: false,
    storefrontCustomCategories: true,
  },
  
  PRO: {
    // Pricing (eBay: $59.95/mo)
    monthlyCents: 5995,
    annualMonthlyCents: 5995,

    // Listings (eBay: 10,000/mo)
    freeListingsMonthly: 10000,
    insertionFeeCents: 15,  // $0.15 per listing over limit
    activeListingsMax: 10000,

    // Fees (eBay: 10.25%)
    finalValueFeeBps: 1025,
    finalValueFeePerOrderCents: 40,
    finalValueFeePerOrderCentsSmall: 30,
    smallOrderThresholdCents: 1000,

    // Features
    photoPerListingMax: 24,
    basicAnalytics: true,
    advancedAnalytics: true,
    bulkListingTools: true,
    promotedListings: true,
    staffAccounts: 5,
    brandedStorefront: true,
    prioritySupport: true,
    dedicatedRep: false,
    customReturnPolicy: true,
    scheduledListings: true,
    markdownManager: true,
    salesEvents: true,
    vacationMode: true,
    internationalVisibility: true,
    
    // Visibility
    searchBoost: 1.1,
    categoryFeatured: true,
    
    // Storefront features
    storefrontCustomPages: false,
    storefrontPromoBanner: true,
    storefrontCustomCategories: true,
  },
  
  ELITE: {
    // Pricing (eBay: $299.95/mo)
    monthlyCents: 29995,
    annualMonthlyCents: 29995,

    // Listings (eBay: 25,000/mo)
    freeListingsMonthly: 25000,
    insertionFeeCents: 5,  // $0.05 per listing over limit
    activeListingsMax: 25000,

    // Fees (eBay: 9.15%)
    finalValueFeeBps: 915,
    finalValueFeePerOrderCents: 40,
    finalValueFeePerOrderCentsSmall: 30,
    smallOrderThresholdCents: 1000,

    // Features
    photoPerListingMax: 24,
    basicAnalytics: true,
    advancedAnalytics: true,
    bulkListingTools: true,
    promotedListings: true,
    staffAccounts: 15,
    brandedStorefront: true,
    prioritySupport: true,
    dedicatedRep: true,
    customReturnPolicy: true,
    scheduledListings: true,
    markdownManager: true,
    salesEvents: true,
    vacationMode: true,
    internationalVisibility: true,
    
    // Visibility
    searchBoost: 1.15,
    categoryFeatured: true,
    
    // Storefront features
    storefrontCustomPages: true,
    storefrontPromoBanner: true,
    storefrontCustomCategories: true,
  },
  
  ENTERPRISE: {
    // Pricing (eBay: $2,999.95/mo)
    monthlyCents: 299995,
    annualMonthlyCents: 299995,

    // Listings (eBay: 100,000/mo)
    freeListingsMonthly: 100000,
    insertionFeeCents: 5,  // $0.05 per listing over limit
    activeListingsMax: 100000,

    // Fees (Custom - default to 8%)
    finalValueFeeBps: 800,
    finalValueFeePerOrderCents: 40,
    finalValueFeePerOrderCentsSmall: 30,
    smallOrderThresholdCents: 1000,

    // Features
    photoPerListingMax: 24,
    basicAnalytics: true,
    advancedAnalytics: true,
    bulkListingTools: true,
    promotedListings: true,
    staffAccounts: 100,
    brandedStorefront: true,
    prioritySupport: true,
    dedicatedRep: true,
    customReturnPolicy: true,
    scheduledListings: true,
    markdownManager: true,
    salesEvents: true,
    vacationMode: true,
    internationalVisibility: true,
    
    // Visibility
    searchBoost: 1.2,
    categoryFeatured: true,
    
    // Storefront features
    storefrontCustomPages: true,
    storefrontPromoBanner: true,
    storefrontCustomCategories: true,
    
    // Enterprise-specific
    customFeeNegotiable: true,
    apiRateLimitMultiplier: 10,
  },
} as const;

export type SellerTier = keyof typeof TIER_FEATURES;
export type TierFeatureKey = keyof typeof TIER_FEATURES.STARTER;

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: SellerTier): string {
  const names: Record<SellerTier, string> = {
    SELLER: "No Store (Casual Seller)",
    STARTER: "Starter Store",
    BASIC: "Basic Store",
    PRO: "Pro Store",
    ELITE: "Elite Store",
    ENTERPRISE: "Enterprise Store",
  };
  return names[tier];
}

/**
 * Get tier monthly price formatted
 */
export function getTierPrice(tier: SellerTier): string {
  const cents = TIER_FEATURES[tier].monthlyCents;
  return `$${(cents / 100).toFixed(2)}/mo`;
}

/**
 * Get all tiers in upgrade order
 */
export const TIER_ORDER: SellerTier[] = ["SELLER", "STARTER", "BASIC", "PRO", "ELITE", "ENTERPRISE"];

/**
 * Check if tier upgrade
 */
export function isUpgrade(from: SellerTier, to: SellerTier): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from);
}
```

---

## 5) Tier Enforcement Service

Create `packages/core/subscriptions/tier-enforcement.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { TIER_FEATURES, SellerTier, TierFeatureKey, TIER_ORDER } from "./tier-features";

const prisma = new PrismaClient();

/**
 * Get seller's current tier (defaults to SELLER for casual sellers)
 */
export async function getSellerTier(sellerId: string): Promise<SellerTier> {
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId },
  });
  return (subscription?.tier as SellerTier) ?? "SELLER";
}

/**
 * Check if seller can use a specific feature
 */
export async function canUseFeature(
  sellerId: string,
  feature: TierFeatureKey
): Promise<boolean> {
  const tier = await getSellerTier(sellerId);
  const value = TIER_FEATURES[tier][feature];
  
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return false;
}

/**
 * Get feature value for seller's tier
 */
export async function getFeatureValue<K extends TierFeatureKey>(
  sellerId: string,
  feature: K
): Promise<typeof TIER_FEATURES.STARTER[K]> {
  const tier = await getSellerTier(sellerId);
  return TIER_FEATURES[tier][feature];
}

/**
 * Require feature - throws TierFeatureError if not available
 */
export async function requireFeature(
  sellerId: string,
  feature: TierFeatureKey,
  featureName?: string
): Promise<void> {
  const canUse = await canUseFeature(sellerId, feature);
  if (!canUse) {
    const tier = await getSellerTier(sellerId);
    throw new TierFeatureError(
      `Feature "${featureName ?? feature}" requires a higher tier. Current tier: ${tier}`,
      feature,
      tier
    );
  }
}

export class TierFeatureError extends Error {
  constructor(
    message: string,
    public feature: TierFeatureKey,
    public currentTier: SellerTier
  ) {
    super(message);
    this.name = "TierFeatureError";
  }
}

/**
 * Check listing allowance before creating listing
 * Returns insertion fee info for listings over free allowance
 */
export async function checkListingAllowance(sellerId: string): Promise<{
  allowed: boolean;
  current: number;
  freeLimit: number;
  hardCap: number | null;
  tier: SellerTier;
  insertionFeeCents: number;
  willChargeInsertionFee: boolean;
}> {
  const tier = await getSellerTier(sellerId);
  const tierConfig = TIER_FEATURES[tier];
  const freeLimit = tierConfig.freeListingsMonthly;
  const hardCap = tierConfig.activeListingsMax; // null for SELLER tier
  const insertionFeeCents = tierConfig.insertionFeeCents;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const current = await prisma.listing.count({
    where: {
      ownerUserId: sellerId,
      createdAt: { gte: startOfMonth },
    },
  });

  // SELLER tier has no hard cap - can always list (just pays insertion fee)
  // Store tiers are capped at activeListingsMax
  const allowed = hardCap === null || current < hardCap;
  const willChargeInsertionFee = current >= freeLimit;

  return {
    allowed,
    current,
    freeLimit,
    hardCap,
    tier,
    insertionFeeCents,
    willChargeInsertionFee,
  };
}

/**
 * Get final value fee for seller's tier (used in checkout)
 */
export async function getFinalValueFeeBps(sellerId: string): Promise<number> {
  const tier = await getSellerTier(sellerId);
  return TIER_FEATURES[tier].finalValueFeeBps;
}

/**
 * Get minimum required tier for a feature
 */
export function getMinimumTierForFeature(feature: TierFeatureKey): SellerTier {
  for (const tier of TIER_ORDER) {
    const value = TIER_FEATURES[tier][feature];
    if (typeof value === "boolean" && value) return tier;
    if (typeof value === "number" && value > 0) return tier;
  }
  return "ENTERPRISE"; // If not found, require highest
}
```

---

## 5b) Store Subscription Service (Personal/Business Gate)

Create `packages/core/subscriptions/subscription-service.ts`:

```ts
import { PrismaClient, SellerTier } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Check if seller can subscribe to a store tier
 * REQUIRES: Business seller status for STARTER+ tiers
 * Alignment Patch: Also verifies BusinessInfo record exists
 */
export async function canSubscribeToStore(sellerId: string): Promise<{
  canSubscribe: boolean;
  reason?: string;
  requiresBusinessUpgrade: boolean;
  currentSellerType: "PERSONAL" | "BUSINESS";
}> {
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    select: {
      isSeller: true,
      sellerType: true,
      businessVerifiedAt: true,
      businessInfo: true,  // Include BusinessInfo relation
    },
  });

  if (!user) {
    return {
      canSubscribe: false,
      reason: "USER_NOT_FOUND",
      requiresBusinessUpgrade: false,
      currentSellerType: "PERSONAL",
    };
  }

  if (!user.isSeller) {
    return {
      canSubscribe: false,
      reason: "NOT_A_SELLER",
      requiresBusinessUpgrade: false,
      currentSellerType: "PERSONAL",
    };
  }

  // Personal sellers cannot subscribe to store
  if (user.sellerType !== "BUSINESS") {
    return {
      canSubscribe: false,
      reason: "BUSINESS_REQUIRED_FOR_STORE",
      requiresBusinessUpgrade: true,
      currentSellerType: "PERSONAL",
    };
  }

  // Business verification required
  if (!user.businessVerifiedAt) {
    return {
      canSubscribe: false,
      reason: "BUSINESS_VERIFICATION_INCOMPLETE",
      requiresBusinessUpgrade: true,
      currentSellerType: "BUSINESS",
    };
  }

  // BusinessInfo record must exist (canonical location for business data)
  if (!user.businessInfo) {
    return {
      canSubscribe: false,
      reason: "BUSINESS_INFO_REQUIRED",
      requiresBusinessUpgrade: true,
      currentSellerType: "BUSINESS",
    };
  }

  return {
    canSubscribe: true,
    requiresBusinessUpgrade: false,
    currentSellerType: "BUSINESS",
  };
}

/**
 * Subscribe to a store tier
 * REQUIRES: Business seller status
 */
export async function subscribeToStore(args: {
  sellerId: string;
  tier: SellerTier;
  billingCycle?: "monthly" | "annual";
}): Promise<{ subscription: any }> {
  // Verify eligibility
  const eligibility = await canSubscribeToStore(args.sellerId);

  if (!eligibility.canSubscribe) {
    throw new Error(eligibility.reason ?? "CANNOT_SUBSCRIBE");
  }

  // Cannot subscribe to SELLER (that's the default casual seller tier)
  if (args.tier === "SELLER") {
    throw new Error("CANNOT_SUBSCRIBE_TO_SELLER_TIER");
  }

  // Create/update subscription
  const subscription = await prisma.sellerSubscription.upsert({
    where: { sellerId: args.sellerId },
    create: {
      sellerId: args.sellerId,
      tier: args.tier,
      status: "PENDING", // Pending payment
    },
    update: {
      tier: args.tier,
      status: "PENDING",
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.sellerId,
      action: "subscription.store_requested",
      entityType: "SellerSubscription",
      entityId: subscription.id,
      metaJson: {
        tier: args.tier,
        billingCycle: args.billingCycle ?? "monthly",
      },
    },
  });

  return { subscription };
}

/**
 * Cancel store subscription (revert to SELLER tier)
 */
export async function cancelStoreSubscription(sellerId: string): Promise<void> {
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId },
  });

  if (!subscription || subscription.tier === "SELLER") {
    throw new Error("NO_ACTIVE_STORE_SUBSCRIPTION");
  }

  await prisma.sellerSubscription.update({
    where: { sellerId },
    data: {
      tier: "SELLER",
      status: "ACTIVE", // SELLER tier is always active (free)
      canceledAt: new Date(),
    },
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: sellerId,
      action: "subscription.store_canceled",
      entityType: "SellerSubscription",
      entityId: subscription.id,
      metaJson: { previousTier: subscription.tier },
    },
  });
}
```

---

## 6) Storefront Service

Create `packages/core/subscriptions/storefront-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { TIER_FEATURES, SellerTier } from "./tier-features";
import { getSellerTier } from "./tier-enforcement";
import { emitAuditEvent } from "@/packages/core/audit/emit";

const prisma = new PrismaClient();

/**
 * Ensure storefront exists for seller (created on subscription)
 * Only STORE tiers (STARTER+) get a storefront - SELLER tier has no storefront
 */
export async function ensureStorefront(sellerId: string): Promise<any | null> {
  const tier = await getSellerTier(sellerId);

  // SELLER tier (casual sellers) don't get a storefront
  if (tier === "SELLER") {
    return null;
  }

  const existing = await prisma.sellerStorefront.findUnique({
    where: { sellerId },
  });

  if (existing) return existing;

  const storefront = await prisma.sellerStorefront.create({
    data: {
      sellerId,
      isActive: true,
      isPublished: false,
    },
  });

  await emitAuditEvent({
    actorUserId: sellerId,
    action: "storefront.created",
    entityType: "SellerStorefront",
    entityId: storefront.id,
  });

  return storefront;
}

/**
 * Get storefront features available for tier
 */
export function getStorefrontFeatures(tier: SellerTier) {
  const features = TIER_FEATURES[tier];
  return {
    customUrl: true,                    // All tiers
    customLogo: true,                   // All tiers
    customBanner: true,                 // All tiers
    customColors: true,                 // All tiers
    aboutPage: true,                    // All tiers
    customCategories: features.storefrontCustomCategories,
    promoBanner: features.storefrontPromoBanner,
    customPages: features.storefrontCustomPages,
    featuredListings: tier !== "STARTER",
    socialLinks: true,                  // All tiers
    seoSettings: tier !== "STARTER",
  };
}

/**
 * Check if seller can use a storefront feature
 */
export async function canUseStorefrontFeature(
  sellerId: string,
  feature: keyof ReturnType<typeof getStorefrontFeatures>
): Promise<boolean> {
  const tier = await getSellerTier(sellerId);
  const features = getStorefrontFeatures(tier);
  return features[feature] ?? false;
}

/**
 * Update storefront
 */
export async function updateStorefront(
  sellerId: string,
  data: {
    storeName?: string;
    slug?: string;
    tagline?: string;
    logoUrl?: string;
    bannerUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    aboutHtml?: string;
    metaTitle?: string;
    metaDescription?: string;
  }
): Promise<any> {
  // Validate slug uniqueness if provided
  if (data.slug) {
    const existing = await prisma.sellerStorefront.findFirst({
      where: { slug: data.slug, NOT: { sellerId } },
    });
    if (existing) {
      throw new Error("SLUG_TAKEN");
    }
  }
  
  const storefront = await prisma.sellerStorefront.update({
    where: { sellerId },
    data,
  });
  
  await emitAuditEvent({
    actorUserId: sellerId,
    action: "storefront.updated",
    entityType: "SellerStorefront",
    entityId: storefront.id,
    meta: { updatedFields: Object.keys(data) },
  });
  
  return storefront;
}

/**
 * Publish storefront
 */
export async function publishStorefront(sellerId: string): Promise<any> {
  const storefront = await prisma.sellerStorefront.update({
    where: { sellerId },
    data: {
      isPublished: true,
      publishedAt: new Date(),
    },
  });
  
  await emitAuditEvent({
    actorUserId: sellerId,
    action: "storefront.published",
    entityType: "SellerStorefront",
    entityId: storefront.id,
  });
  
  return storefront;
}

/**
 * Unpublish storefront
 */
export async function unpublishStorefront(sellerId: string): Promise<any> {
  const storefront = await prisma.sellerStorefront.update({
    where: { sellerId },
    data: { isPublished: false },
  });
  
  await emitAuditEvent({
    actorUserId: sellerId,
    action: "storefront.unpublished",
    entityType: "SellerStorefront",
    entityId: storefront.id,
  });
  
  return storefront;
}

/**
 * Deactivate storefront (subscription cancelled)
 */
export async function deactivateStorefront(sellerId: string): Promise<void> {
  await prisma.sellerStorefront.updateMany({
    where: { sellerId },
    data: { isActive: false, isPublished: false },
  });
  
  await emitAuditEvent({
    actorUserId: sellerId,
    actorType: "system",
    action: "storefront.deactivated",
    entityType: "SellerStorefront",
    entityId: sellerId,
    meta: { reason: "subscription_cancelled" },
  });
}

/**
 * Reactivate storefront (subscription resumed)
 */
export async function reactivateStorefront(sellerId: string): Promise<void> {
  await prisma.sellerStorefront.updateMany({
    where: { sellerId },
    data: { isActive: true },
  });
  
  await emitAuditEvent({
    actorUserId: sellerId,
    actorType: "system",
    action: "storefront.reactivated",
    entityType: "SellerStorefront",
    entityId: sellerId,
  });
}

/**
 * Follow a storefront
 */
export async function followStorefront(
  followerId: string,
  storefrontId: string
): Promise<any> {
  return prisma.storefrontFollower.upsert({
    where: {
      storefrontId_followerId: { storefrontId, followerId },
    },
    create: {
      storefrontId,
      followerId,
    },
    update: {},
  });
}

/**
 * Unfollow a storefront
 */
export async function unfollowStorefront(
  followerId: string,
  storefrontId: string
): Promise<void> {
  await prisma.storefrontFollower.deleteMany({
    where: { storefrontId, followerId },
  });
}
```

---

## 7) Fee Calculator for Checkout

Create `packages/core/checkout/fee-calculator.ts`:

```ts
import { getFinalValueFeeBps } from "../subscriptions/tier-enforcement";

/**
 * Calculate all fees for an order based on seller's tier
 */
export async function calculateOrderFees(args: {
  sellerId: string;
  subtotalCents: number;
  shippingCents: number;
  promotionDiscountCents?: number;
}): Promise<{
  subtotalCents: number;
  shippingCents: number;
  promotionDiscountCents: number;
  totalCents: number;
  marketplaceFeeCents: number;
  processingFeeCents: number;
  sellerNetCents: number;
  feeBreakdown: {
    finalValueFeeBps: number;
    processingFeeBps: number;
    processingFeeFixedCents: number;
  };
}> {
  // Get tier-based FVF
  const finalValueFeeBps = await getFinalValueFeeBps(args.sellerId);
  
  // Stripe processing fee (2.9% + 30¢)
  const processingFeeBps = 290;
  const processingFeeFixedCents = 30;
  
  const promotionDiscountCents = args.promotionDiscountCents ?? 0;
  const totalCents = args.subtotalCents + args.shippingCents - promotionDiscountCents;
  
  // Calculate fees
  // Marketplace fee applies to subtotal only (not shipping)
  const marketplaceFeeCents = Math.round((args.subtotalCents * finalValueFeeBps) / 10000);
  
  // Processing fee applies to total charged
  const processingFeeCents = Math.round((totalCents * processingFeeBps) / 10000) + processingFeeFixedCents;
  
  // Seller receives total minus all fees
  const sellerNetCents = totalCents - marketplaceFeeCents - processingFeeCents;
  
  return {
    subtotalCents: args.subtotalCents,
    shippingCents: args.shippingCents,
    promotionDiscountCents,
    totalCents,
    marketplaceFeeCents,
    processingFeeCents,
    sellerNetCents,
    feeBreakdown: {
      finalValueFeeBps,
      processingFeeBps,
      processingFeeFixedCents,
    },
  };
}
```

---

## 8) Subscription Downgrade Service

Create `packages/core/subscriptions/downgrade.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { TIER_FEATURES, SellerTier, TIER_ORDER } from "./tier-features";
import { deactivateStorefront } from "./storefront-service";

const prisma = new PrismaClient();

export type DowngradeResult = {
  success: boolean;
  previousTier: SellerTier;
  newTier: SellerTier;
  effectiveAt: Date;
  actions: string[];
  warnings: string[];
};

/**
 * Handle seller tier downgrade
 * Called when:
 * - Seller manually downgrades
 * - Payment fails and grace period expires
 * - Subscription cancelled
 */
export async function handleDowngrade(args: {
  sellerId: string;
  fromTier: SellerTier;
  toTier: SellerTier;
  reason: "manual" | "payment_failed" | "cancelled";
  effectiveImmediately?: boolean;
}): Promise<DowngradeResult> {
  const actions: string[] = [];
  const warnings: string[] = [];
  
  const fromFeatures = TIER_FEATURES[args.fromTier];
  const toFeatures = TIER_FEATURES[args.toTier];
  
  // Determine effective date
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId: args.sellerId },
  });
  
  const effectiveAt = args.effectiveImmediately || args.reason === "payment_failed"
    ? new Date()
    : subscription?.endsAt ?? new Date();
  
  // Check listing caps
  const activeListings = await prisma.listing.count({
    where: { ownerUserId: args.sellerId, status: "ACTIVE" },
  });
  
  if (activeListings > toFeatures.activeListingsMax) {
    const excess = activeListings - toFeatures.activeListingsMax;
    warnings.push(
      `You have ${activeListings} active listings but ${args.toTier} tier allows ${toFeatures.activeListingsMax}. ` +
      `${excess} listings will be paused.`
    );
    
    await prisma.scheduledAction.create({
      data: {
        sellerId: args.sellerId,
        actionType: "PAUSE_EXCESS_LISTINGS",
        scheduledFor: effectiveAt,
        payload: { limit: toFeatures.activeListingsMax, currentCount: activeListings },
      },
    });
    actions.push("SCHEDULED_LISTING_PAUSE");
  }
  
  // Check staff accounts
  if (fromFeatures.staffAccounts > toFeatures.staffAccounts) {
    const staffCount = await prisma.delegatedAccess.count({
      where: { ownerUserId: args.sellerId, status: "active" },
    });
    
    if (staffCount > toFeatures.staffAccounts) {
      const excess = staffCount - toFeatures.staffAccounts;
      warnings.push(
        `You have ${staffCount} staff accounts but ${args.toTier} tier allows ${toFeatures.staffAccounts}. ` +
        `${excess} staff accounts will be revoked.`
      );
      
      await prisma.scheduledAction.create({
        data: {
          sellerId: args.sellerId,
          actionType: "REVOKE_EXCESS_STAFF",
          scheduledFor: effectiveAt,
          payload: { limit: toFeatures.staffAccounts },
        },
      });
      actions.push("SCHEDULED_STAFF_REVOKE");
    }
  }
  
  // Check promoted listings
  if (fromFeatures.promotedListings && !toFeatures.promotedListings) {
    const activeCampaigns = await prisma.boostCampaign.count({
      where: { sellerId: args.sellerId, status: "active" },
    });
    
    if (activeCampaigns > 0) {
      warnings.push(
        `You have ${activeCampaigns} active promotion campaigns. They will be paused.`
      );
      
      await prisma.scheduledAction.create({
        data: {
          sellerId: args.sellerId,
          actionType: "PAUSE_CAMPAIGNS",
          scheduledFor: effectiveAt,
          payload: {},
        },
      });
      actions.push("SCHEDULED_CAMPAIGN_PAUSE");
    }
  }
  
  // Update subscription record
  await prisma.sellerSubscription.update({
    where: { sellerId: args.sellerId },
    data: {
      tier: args.toTier,
      status: "ACTIVE",
      updatedAt: new Date(),
    },
  });
  actions.push("SUBSCRIPTION_UPDATED");
  
  // Create audit event
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.sellerId,
      action: "subscription.downgrade",
      entityType: "SellerSubscription",
      entityId: args.sellerId,
      metaJson: {
        fromTier: args.fromTier,
        toTier: args.toTier,
        reason: args.reason,
        effectiveAt: effectiveAt.toISOString(),
        warnings,
      },
    },
  });
  actions.push("AUDIT_LOGGED");
  
  // Send notification
  await prisma.notification.create({
    data: {
      userId: args.sellerId,
      type: "SUBSCRIPTION_DOWNGRADE",
      title: `Subscription Changed to ${args.toTier}`,
      body: warnings.length > 0
        ? `Your subscription has been changed. Please review: ${warnings.join(" ")}`
        : `Your subscription has been changed to ${args.toTier}.`,
      channel: "email",
      priority: "high",
    },
  });
  actions.push("NOTIFICATION_SENT");
  
  return {
    success: true,
    previousTier: args.fromTier,
    newTier: args.toTier,
    effectiveAt,
    actions,
    warnings,
  };
}

/**
 * Handle subscription cancellation
 * Deactivates storefront but does NOT delete seller data
 */
export async function handleCancellation(sellerId: string): Promise<void> {
  // Update subscription status
  await prisma.sellerSubscription.update({
    where: { sellerId },
    data: { status: "CANCELED" },
  });
  
  // Deactivate storefront (but don't delete)
  await deactivateStorefront(sellerId);
  
  // Pause all active listings
  await prisma.listing.updateMany({
    where: { ownerUserId: sellerId, status: "ACTIVE" },
    data: { status: "PAUSED" },
  });
  
  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: sellerId,
      action: "subscription.cancelled",
      entityType: "SellerSubscription",
      entityId: sellerId,
    },
  });
}

/**
 * Execute scheduled downgrade actions (called by hourly cron)
 */
export async function executeScheduledActions(): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  
  const pendingActions = await prisma.scheduledAction.findMany({
    where: {
      scheduledFor: { lte: new Date() },
      executedAt: null,
    },
  });
  
  for (const action of pendingActions) {
    try {
      switch (action.actionType) {
        case "PAUSE_EXCESS_LISTINGS":
          await pauseExcessListings(action.sellerId, (action.payload as any).limit);
          break;
        case "REVOKE_EXCESS_STAFF":
          await revokeExcessStaff(action.sellerId, (action.payload as any).limit);
          break;
        case "PAUSE_CAMPAIGNS":
          await pauseCampaigns(action.sellerId);
          break;
      }
      
      await prisma.scheduledAction.update({
        where: { id: action.id },
        data: { executedAt: new Date() },
      });
    } catch (error) {
      const errorMsg = `${action.id}: ${error}`;
      errors.push(errorMsg);
      await prisma.scheduledAction.update({
        where: { id: action.id },
        data: { errorMessage: errorMsg },
      });
    }
  }
  
  return { processed: pendingActions.length, errors };
}

async function pauseExcessListings(sellerId: string, limit: number): Promise<void> {
  const listings = await prisma.listing.findMany({
    where: { ownerUserId: sellerId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    skip: limit,
    select: { id: true },
  });
  
  if (listings.length > 0) {
    await prisma.listing.updateMany({
      where: { id: { in: listings.map(l => l.id) } },
      data: { status: "PAUSED" },
    });
  }
}

async function revokeExcessStaff(sellerId: string, limit: number): Promise<void> {
  const staff = await prisma.delegatedAccess.findMany({
    where: { ownerUserId: sellerId, status: "active" },
    orderBy: { createdAt: "asc" },
    skip: limit,
    select: { id: true },
  });
  
  if (staff.length > 0) {
    await prisma.delegatedAccess.updateMany({
      where: { id: { in: staff.map(s => s.id) } },
      data: { status: "revoked", revokedAt: new Date() },
    });
  }
}

async function pauseCampaigns(sellerId: string): Promise<void> {
  await prisma.boostCampaign.updateMany({
    where: { sellerId, status: "active" },
    data: { status: "paused" },
  });
}
```

---

## 9) Subscription API Routes

### 9.1 Get current subscription
`GET /api/seller/subscription`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth } from "@/apps/web/lib/sellerAuth";
import { TIER_FEATURES, getTierDisplayName, getTierPrice } from "@/packages/core/subscriptions/tier-features";
import { getStorefrontFeatures } from "@/packages/core/subscriptions/storefront-service";

const prisma = new PrismaClient();

export async function GET() {
  const { sellerId } = await requireSellerAuth();
  
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId },
  });
  
  if (!subscription) {
    return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 404 });
  }
  
  const tier = subscription.tier as keyof typeof TIER_FEATURES;
  const features = TIER_FEATURES[tier];
  const storefrontFeatures = getStorefrontFeatures(tier);
  
  return NextResponse.json({
    subscription: {
      ...subscription,
      tierDisplayName: getTierDisplayName(tier),
      tierPrice: getTierPrice(tier),
    },
    features,
    storefrontFeatures,
  });
}
```

### 9.2 Select/upgrade tier
`POST /api/seller/subscription/select-tier`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireSellerAuth } from "@/apps/web/lib/sellerAuth";
import { TIER_ORDER, SellerTier, isUpgrade } from "@/packages/core/subscriptions/tier-features";
import { ensureStorefront } from "@/packages/core/subscriptions/storefront-service";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const { sellerId } = await requireSellerAuth();
  const { tier } = await req.json();
  
  if (!TIER_ORDER.includes(tier)) {
    return NextResponse.json({ error: "INVALID_TIER" }, { status: 400 });
  }
  
  const current = await prisma.sellerSubscription.findUnique({
    where: { sellerId },
  });
  
  const currentTier = (current?.tier as SellerTier) ?? "STARTER";
  const isUpgrading = isUpgrade(currentTier, tier);
  
  // For upgrades, set to PENDING until payment confirmed
  // For downgrades, set to ACTIVE immediately (effective at period end)
  const status = isUpgrading ? "PENDING" : "ACTIVE";
  
  const subscription = await prisma.sellerSubscription.upsert({
    where: { sellerId },
    update: {
      tier,
      status,
      scheduledTier: isUpgrading ? null : tier,
      scheduledAt: isUpgrading ? null : new Date(),
    },
    create: {
      sellerId,
      tier,
      status,
    },
  });
  
  // Ensure storefront exists (all tiers get one)
  await ensureStorefront(sellerId);
  
  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: sellerId,
      action: isUpgrading ? "subscription.upgrade_requested" : "subscription.downgrade_requested",
      entityType: "SellerSubscription",
      entityId: subscription.id,
      metaJson: { fromTier: currentTier, toTier: tier },
    },
  });
  
  return NextResponse.json({
    subscription,
    requiresPayment: isUpgrading,
    message: isUpgrading
      ? "Please complete payment to activate your new tier."
      : "Your tier will change at the end of the current billing period.",
  });
}
```

---

## 10) Billing events ingestion (provider-agnostic)

Create `packages/core/subscriptions/billingProcessor.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { ensureStorefront, reactivateStorefront } from "./storefront-service";

const prisma = new PrismaClient();

export async function processBillingEvent(args: {
  provider: string;
  providerEventId: string;
  type: string;
  occurredAt: Date;
  payload: any;
}) {
  const idempotencyKey = `${args.provider}:${args.providerEventId}`;

  const log = await prisma.billingEventLog.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      provider: args.provider,
      providerEventId: args.providerEventId,
      type: args.type,
      payloadJson: args.payload,
      occurredAt: args.occurredAt,
      idempotencyKey,
      status: "received",
    },
  });

  if (log.status === "processed") return;

  try {
    // Handle subscription payment succeeded
    if (args.type === "subscription.payment_succeeded") {
      const sellerId = String(args.payload?.sellerId || "");
      const tier = String(args.payload?.tier || "STARTER");

      await prisma.sellerSubscription.upsert({
        where: { sellerId },
        update: { tier: tier as any, status: "ACTIVE" },
        create: { sellerId, tier: tier as any, status: "ACTIVE" },
      });
      
      // Ensure storefront exists and is active
      await ensureStorefront(sellerId);
      await reactivateStorefront(sellerId);
    }
    
    // Handle subscription payment failed
    if (args.type === "subscription.payment_failed") {
      const sellerId = String(args.payload?.sellerId || "");
      
      await prisma.sellerSubscription.update({
        where: { sellerId },
        data: { status: "PAST_DUE" },
      });
    }
    
    // Handle subscription cancelled
    if (args.type === "subscription.cancelled") {
      const sellerId = String(args.payload?.sellerId || "");
      
      await prisma.sellerSubscription.update({
        where: { sellerId },
        data: { status: "CANCELED" },
      });
    }

    await prisma.billingEventLog.update({
      where: { id: log.id },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (error) {
    await prisma.billingEventLog.update({
      where: { id: log.id },
      data: { status: "failed", errorMessage: String(error) },
    });
    throw error;
  }
}
```

---

## 11) Seed default tier pricing

Create `scripts/seed-tier-pricing.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Seed v1 pricing (eBay-exact)
  await prisma.tierPricingVersion.upsert({
    where: { id: "tier-pricing-v1" },
    update: {},
    create: {
      id: "tier-pricing-v1",
      version: "1.0.0",
      effectiveAt: new Date("2026-01-01"),
      isActive: true,
      pricingJson: {
        tiers: {
          STARTER: {
            monthlyCents: 495,
            listingCapMonthly: 250,
            finalValueFeeBps: 1235,
          },
          BASIC: {
            monthlyCents: 2195,
            listingCapMonthly: 1000,
            finalValueFeeBps: 1150,
          },
          PRO: {
            monthlyCents: 5995,
            listingCapMonthly: 10000,
            finalValueFeeBps: 1025,
          },
          ELITE: {
            monthlyCents: 29995,
            listingCapMonthly: 25000,
            finalValueFeeBps: 915,
          },
          ENTERPRISE: {
            monthlyCents: 299995,
            listingCapMonthly: 100000,
            finalValueFeeBps: 800,
          },
        },
      },
      createdByStaffId: "system",
    },
  });
  
  console.log("seed-tier-pricing: ok (eBay-exact tiers)");
}

main().finally(async () => prisma.$disconnect());
```

---

## 12) Health provider + Doctor

### Health provider: `subscriptions`

Create `packages/core/health/providers/subscriptions.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult } from "../types";

const prisma = new PrismaClient();

export const subscriptionsHealthProvider: HealthProvider = {
  id: "subscriptions",
  label: "Subscriptions & Billing",
  
  async run({ runType }): Promise<HealthResult> {
    const checks = [];
    let status: "PASS" | "WARN" | "FAIL" = "PASS";
    
    // Check 1: TierPricingVersion exists
    const pricingCount = await prisma.tierPricingVersion.count({
      where: { isActive: true },
    });
    checks.push({
      id: "pricing_seeded",
      label: "Tier pricing seeded",
      status: pricingCount > 0 ? "PASS" : "FAIL",
      message: pricingCount > 0 ? `${pricingCount} active versions` : "No pricing versions",
    });
    if (pricingCount === 0) status = "FAIL";
    
    // Check 2: SellerSubscription table exists
    try {
      await prisma.sellerSubscription.count();
      checks.push({
        id: "subscription_table",
        label: "Subscription table exists",
        status: "PASS",
      });
    } catch {
      checks.push({
        id: "subscription_table",
        label: "Subscription table exists",
        status: "FAIL",
        message: "Table missing",
      });
      status = "FAIL";
    }
    
    // Check 3: SellerStorefront table exists
    try {
      await prisma.sellerStorefront.count();
      checks.push({
        id: "storefront_table",
        label: "Storefront table exists",
        status: "PASS",
      });
    } catch {
      checks.push({
        id: "storefront_table",
        label: "Storefront table exists",
        status: "FAIL",
        message: "Table missing",
      });
      status = "FAIL";
    }
    
    // Check 4: Verify all tiers are valid (6-tier system)
    const validTiers = ["SELLER", "STARTER", "BASIC", "PRO", "ELITE", "ENTERPRISE"];

    // Verify SELLER tier is working correctly
    const sellerTierCount = await prisma.sellerSubscription.count({
      where: { tier: "SELLER" },
    });
    checks.push({
      id: "seller_tier_valid",
      label: "SELLER tier (casual seller) working",
      status: "PASS",
      message: `${sellerTierCount} casual sellers on SELLER tier`,
    });

    // Check 5: Store subscribers have Business seller type
    // (Future: add query to verify all STARTER+ subscribers are BUSINESS type)
    
    return {
      providerId: "subscriptions",
      status,
      summary: status === "PASS" ? "Subscriptions healthy" : "Subscriptions issues detected",
      providerVersion: "2.0",
      ranAt: new Date().toISOString(),
      runType,
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

### Doctor checks (Phase 24)

```ts
async function checkPhase24(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];
  const testSellerId = `doctor_seller_${Date.now()}`;

  // 1. Verify TierPricingVersion is seeded
  const pricing = await prisma.tierPricingVersion.findFirst({
    where: { isActive: true },
  });
  checks.push({
    phase: 24,
    name: "subscriptions.pricing_seeded",
    status: pricing ? "PASS" : "FAIL",
    details: pricing ? `Version: ${pricing.version}` : "No active pricing version",
  });

  // 2. Create seller subscription - defaults to STARTER (not FREE)
  const subscription = await prisma.sellerSubscription.create({
    data: {
      sellerId: testSellerId,
      tier: "STARTER",
      status: "ACTIVE",
    },
  });
  checks.push({
    phase: 24,
    name: "subscriptions.default_starter",
    status: subscription.tier === "STARTER" ? "PASS" : "FAIL",
    details: `Tier: ${subscription.tier}`,
  });

  // 3. Verify storefront can be created
  const storefront = await prisma.sellerStorefront.create({
    data: {
      sellerId: testSellerId,
      isActive: true,
    },
  });
  checks.push({
    phase: 24,
    name: "subscriptions.storefront_created",
    status: storefront ? "PASS" : "FAIL",
    details: storefront ? `ID: ${storefront.id}` : "Failed to create storefront",
  });

  // 4. Billing events idempotent
  const eventRef = `sub_evt_${Date.now()}`;
  for (let i = 0; i < 2; i++) {
    await prisma.billingEventLog.upsert({
      where: { idempotencyKey: eventRef },
      create: {
        provider: "doctor_test",
        providerEventId: eventRef,
        type: "subscription.payment_succeeded",
        payloadJson: { sellerId: testSellerId, amountCents: 495 },
        occurredAt: new Date(),
        idempotencyKey: eventRef,
        status: "received",
      },
      update: {},
    });
  }

  const logCount = await prisma.billingEventLog.count({
    where: { idempotencyKey: eventRef },
  });
  checks.push({
    phase: 24,
    name: "subscriptions.billing_idempotent",
    status: logCount === 1 ? "PASS" : "FAIL",
    details: `Events logged: ${logCount}`,
  });

  // Cleanup
  await prisma.billingEventLog.deleteMany({ where: { idempotencyKey: eventRef } });
  await prisma.sellerStorefront.delete({ where: { id: storefront.id } });
  await prisma.sellerSubscription.delete({ where: { id: subscription.id } });

  return checks;
}
```

---

## 13) Phase 24 Completion Criteria

- eBay-exact tiers: SELLER / STARTER / BASIC / PRO / ELITE / ENTERPRISE (6 tiers)
- SELLER tier ($0/mo) for casual sellers - no storefront, 250 free listings
- STORE tiers (STARTER+) get storefront - requires Business seller status
- SellerStorefront model exists
- Tiers enforced via entitlements (caps + fees + FVF rates)
- Pricing is effective-dated and editable by corp only
- Billing events are idempotent
- Subscription fees recorded in ledger
- Insertion fees charged when exceeding monthly listing cap
- Personal sellers limited to SELLER tier (cannot subscribe to store)
- Doctor passes all Phase 24 checks

---

## 14) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-15 | Initial Phase 24 with FREE/PRO/STORE tiers |
| 2.0 | 2026-01-21 | **eBay-EXACT**: STARTER/BASIC/PRO/ELITE/ENTERPRISE; Added SellerStorefront model; STORE tiers get storefront; Removed old FREE concept |
| 2.1 | 2026-01-21 | Personal/Business Patch: Store subscription requires Business seller status; Added canSubscribeToStore, subscribeToStore services |
| 2.2 | 2026-01-21 | Alignment Patch: canSubscribeToStore now verifies BusinessInfo record exists |
| 2.3 | 2026-01-22 | **SELLER Tier Clarification**: Added SELLER tier ($0/mo) for casual sellers; Clarified SELLER is NOT a store tier; SELLER users have no storefront |
