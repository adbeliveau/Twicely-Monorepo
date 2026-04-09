# TWICELY V2 - Install Phase 2: Listings + Catalog (Core)
**Status:** LOCKED (v1.1)  
**Backend-first:** Schema  ->  API  ->  Audit  ->  Health  ->  UI  ->  Doctor  
**Canonicals:** MUST align with:
- `/rules/TWICELY_LISTINGS_CATALOG_CANONICAL.md`
- `/rules/TWICELY_user_MODEL_LOCKED.md`
- `/rules/TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md`
- `/rules/TWICELY_RBAC_DELEGATED_ACCESS_LOCKED.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_2_LISTINGS_CATALOG.md`  
> Prereq: Phase 0 + Phase 1 complete and Doctor passes.

---

## 0) What this phase installs

### Backend
- Listing model (single-owner `ownerUserId`)
- Category model + required attribute schema
- Listing media (images + optional video)
- **Tags for search enhancement**
- Listing lifecycle endpoints: draft  ->  activate  ->  pause  ->  end  ->  relist
- **Best Offer feature** (ListingOffer model + offer/counter flow) - HIGH-2 fix
- **Listing Fees** (insertion fees, overage fees) - HIGH-5 fix
- **Multi-quantity support** (availableQuantity tracking) - HIGH-6 fix
- Listing version snapshots
- Audit events for listing mutations and transitions

### UI (minimal)
- Seller listing create/edit/activate
- Corp listing lookup (read-only for now)

### Ops
- System Health provider: `listings`
- Doctor checks for listing lifecycle and eligibility

---

## 1) Prisma schema (additive)

Edit `prisma/schema.prisma` and add models/enums below.

```prisma
// =============================================================================
// LISTING STATUS (State Machine)
// Per TWICELY_CORE_COMMERCE_STATE_MACHINES_LOCKED.md
// =============================================================================

enum ListingStatus {
  DRAFT
  PENDING_REVIEW
  ACTIVE
  SOLD
  PAUSED
  ENDED
  REMOVED
}

enum ListingType {
  SINGLE_ITEM
  MULTI_QUANTITY
  VARIATION
}

// =============================================================================
// CATEGORY
// =============================================================================

model Category {
  id                 String     @id @default(cuid())
  slug               String     @unique
  name               String
  parentId           String?
  parent             Category?  @relation("CategoryParent", fields: [parentId], references: [id])
  children           Category[] @relation("CategoryParent")

  // Required attributes for listings in this category
  requiredAttributes String[]
  
  // JSON Schema for category-specific attributes
  attributesSchema   Json       @default("{}")
  
  // SEO/Display
  description        String?
  imageUrl           String?
  displayOrder       Int        @default(0)
  isActive           Boolean    @default(true)

  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  listings           Listing[]

  @@index([parentId])
  @@index([isActive, displayOrder])
}

// =============================================================================
// LISTING
// Per TWICELY_LISTINGS_CATALOG_CANONICAL.md
// =============================================================================

model Listing {
  id              String        @id @default(cuid())
  ownerUserId     String        // Always a User id (single-owner model)

  status          ListingStatus @default(DRAFT)
  type            ListingType   @default(SINGLE_ITEM)

  // Core fields
  title           String?
  description     String?
  categoryId      String?
  category        Category?     @relation(fields: [categoryId], references: [id])

  // Item attributes
  condition       String?       // new|like_new|good|fair|poor
  brand           String?
  size            String?
  color           String?
  material        String?
  gender          String?       // mens|womens|unisex|boys|girls

  // Pricing
  priceCents      Int?
  originalPriceCents Int?       // For showing discounts
  currency        String        @default("USD")
  quantity        Int           @default(1)
  availableQuantity Int?        // For multi-quantity: tracks remaining (HIGH-6 fix)

  // Best Offer settings (HIGH-2 fix)
  allowOffers           Boolean   @default(false)
  autoAcceptOfferCents  Int?      // Auto-accept offers at or above this price
  autoDeclineOfferCents Int?      // Auto-decline offers below this price

  // Shipping
  shippingProfileId String?
  weightOz        Int?          // Weight in ounces for shipping calc
  
  // Dimensions (optional)
  lengthIn        Float?
  widthIn         Float?
  heightIn        Float?

  // Tags for search enhancement
  // Per TWICELY_LISTINGS_CATALOG_CANONICAL.md - optional but useful
  tags            String[]      @default([])

  // Media
  videoUrl        String?       // Optional video URL (future feature)

  // Custom attributes (category-specific)
  customAttributesJson Json     @default("{}")

  // Eligibility tracking
  requiredAttributesComplete Boolean @default(false)
  
  // Enforcement state (trust/safety)
  enforcementState String       @default("CLEAR") // CLEAR|SOFT|HARD

  // Deal badge (computed, cached) - Phase 43 integration
  dealBadgeType         String?   // "GREAT_DEAL" | "GOOD_DEAL" | "PRICE_DROP" | "LOWEST_PRICE" | "BELOW_MARKET"
  dealBadgeLabel        String?   // Display text
  dealBadgeConfidence   String?   // "HIGH" | "MEDIUM" | "LOW"
  dealBadgeComputedAt   DateTime?

  // Market price comparison - Phase 43 integration
  marketIndexId         String?
  marketIndex           MarketPriceIndex? @relation(fields: [marketIndexId], references: [id])

  // Timestamps
  activatedAt     DateTime?
  pausedAt        DateTime?
  endedAt         DateTime?
  soldAt          DateTime?
  
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  images          ListingImage[]
  versions        ListingVersion[]
  offers          ListingOffer[]
  fees            ListingFee[]

  @@index([ownerUserId, status])
  @@index([ownerUserId, createdAt])
  @@index([categoryId])
  @@index([status, createdAt])
  @@index([enforcementState])
}

// =============================================================================
// LISTING OFFERS (Best Offer Feature - HIGH-2)
// Per eBay marketplace parity
// =============================================================================

enum OfferStatus {
  PENDING
  ACCEPTED
  DECLINED
  COUNTERED
  EXPIRED
  WITHDRAWN
}

model ListingOffer {
  id                String      @id @default(cuid())
  listingId         String
  listing           Listing     @relation(fields: [listingId], references: [id], onDelete: Cascade)
  
  buyerId           String
  sellerId          String      // Denormalized for query efficiency
  
  // Offer details
  offerCents        Int
  quantity          Int         @default(1)
  currency          String      @default("USD")
  message           String?     // Optional buyer message
  
  // Status tracking
  status            OfferStatus @default(PENDING)
  expiresAt         DateTime    // Auto-expire if not responded
  
  // Seller response
  counterOfferCents Int?
  counterMessage    String?
  respondedAt       DateTime?
  respondedBy       String?     // Could be delegated staff
  
  // Buyer response to counter
  counterResponseAt DateTime?
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@index([listingId, status])
  @@index([buyerId, status])
  @@index([sellerId, status])
  @@index([expiresAt, status])
}

// =============================================================================
// LISTING FEES (Insertion + Upgrades - HIGH-5)
// Per eBay marketplace parity
// =============================================================================

enum ListingFeeType {
  INSERTION         // Base fee to list an item
  INSERTION_OVERAGE // Fee for listings over monthly cap
  UPGRADE_BOLD      // Bold title upgrade
  UPGRADE_FEATURED  // Featured listing upgrade
  UPGRADE_GALLERY   // Gallery plus upgrade
  SUBTITLE          // Subtitle addition
}

model ListingFee {
  id              String         @id @default(cuid())
  listingId       String
  listing         Listing        @relation(fields: [listingId], references: [id], onDelete: Cascade)
  
  sellerId        String
  type            ListingFeeType
  amountCents     Int
  currency        String         @default("USD")
  
  // Fee schedule reference
  feeScheduleId   String?
  
  // For overage fees, track which month
  billingPeriod   String?        // "2026-01" format
  
  // Waiver tracking
  waived          Boolean        @default(false)
  waivedReason    String?
  waivedByStaffId String?
  
  createdAt       DateTime       @default(now())

  @@index([sellerId, createdAt])
  @@index([listingId])
  @@index([type, createdAt])
}

// =============================================================================
// LISTING IMAGE
// =============================================================================

model ListingImage {
  id          String   @id @default(cuid())
  listingId   String
  listing     Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

  url         String
  position    Int      // 0 = primary image
  altText     String?
  
  // Image metadata (optional)
  width       Int?
  height      Int?
  sizeBytes   Int?

  createdAt   DateTime @default(now())

  @@unique([listingId, position])
  @@index([listingId])
}

// =============================================================================
// LISTING VERSION (Snapshot for audit trail)
// =============================================================================

model ListingVersion {
  id          String   @id @default(cuid())
  listingId   String
  listing     Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)

  snapshotJson Json
  
  // What triggered this version
  changeReason String?  // created|updated|activated|paused|ended|price_change|etc.
  changedByUserId String?

  createdAt   DateTime @default(now())

  @@index([listingId, createdAt])
}
```

Run migration:
```bash
npx prisma migrate dev --name listings_phase2
```

---

## 2) Seed baseline categories (minimal)

Create `scripts/seed-categories.ts`:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const categories = [
    { 
      slug: "apparel", 
      name: "Apparel", 
      requiredAttributes: ["condition", "size"],
      description: "Clothing and fashion items",
    },
    { 
      slug: "shoes", 
      name: "Shoes", 
      requiredAttributes: ["condition", "size"],
      description: "Footwear of all types",
    },
    { 
      slug: "accessories", 
      name: "Accessories", 
      requiredAttributes: ["condition"],
      description: "Bags, jewelry, and accessories",
    },
    {
      slug: "electronics",
      name: "Electronics",
      requiredAttributes: ["condition"],
      description: "Electronic devices and gadgets",
    },
    {
      slug: "home",
      name: "Home & Garden",
      requiredAttributes: ["condition"],
      description: "Home decor and garden items",
    },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { 
        name: c.name, 
        requiredAttributes: c.requiredAttributes,
        description: c.description,
      },
      create: { 
        slug: c.slug, 
        name: c.name, 
        requiredAttributes: c.requiredAttributes,
        description: c.description,
        isActive: true,
      },
    });
  }

  console.log("seed-categories: ok");
}

main().finally(async () => prisma.$disconnect());
```

Add script:
```json
{
  "scripts": {
    "seed:categories": "tsx scripts/seed-categories.ts"
  }
}
```

Run:
```bash
pnpm seed:categories
```

---

## 3) Listing Types & Helpers

Create `packages/core/listings/types.ts`:

```ts
/**
 * Listing status values (state machine)
 */
export const LISTING_STATUS = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  PAUSED: "PAUSED",
  ENDED: "ENDED",
  REMOVED: "REMOVED",
} as const;

export type ListingStatus = typeof LISTING_STATUS[keyof typeof LISTING_STATUS];

/**
 * Listing types
 */
export const LISTING_TYPE = {
  SINGLE_ITEM: "SINGLE_ITEM",
  MULTI_QUANTITY: "MULTI_QUANTITY",
  VARIATION: "VARIATION",
} as const;

export type ListingType = typeof LISTING_TYPE[keyof typeof LISTING_TYPE];

/**
 * Condition values
 */
export const CONDITION = {
  NEW: "new",
  LIKE_NEW: "like_new",
  GOOD: "good",
  FAIR: "fair",
  POOR: "poor",
} as const;

export type Condition = typeof CONDITION[keyof typeof CONDITION];

/**
 * Gender values
 */
export const GENDER = {
  MENS: "mens",
  WOMENS: "womens",
  UNISEX: "unisex",
  BOYS: "boys",
  GIRLS: "girls",
} as const;

export type Gender = typeof GENDER[keyof typeof GENDER];

/**
 * Enforcement state
 */
export const ENFORCEMENT_STATE = {
  CLEAR: "CLEAR",
  SOFT: "SOFT",   // Warning, still visible
  HARD: "HARD",   // Removed from search
} as const;

export type EnforcementState = typeof ENFORCEMENT_STATE[keyof typeof ENFORCEMENT_STATE];

/**
 * Valid status transitions
 */
export const LISTING_STATUS_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ["PENDING_REVIEW", "ACTIVE"],
  PENDING_REVIEW: ["ACTIVE", "DRAFT", "REMOVED"],
  ACTIVE: ["PAUSED", "SOLD", "ENDED", "REMOVED"],
  PAUSED: ["ACTIVE", "ENDED"],
  SOLD: ["ENDED"],
  ENDED: ["ACTIVE"], // Relist
  REMOVED: [], // Terminal state
};

/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(from: ListingStatus, to: ListingStatus): boolean {
  return LISTING_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## 4) Validation Constants & Helpers (MED-8, MED-9)

Create `packages/core/listings/validation-constants.ts`:

```ts
/**
 * Image upload limits (MED-9)
 */
export const IMAGE_LIMITS = {
  MIN_COUNT: 1,
  MAX_COUNT: 12,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MIN_DIMENSION: 500, // pixels
  MAX_DIMENSION: 4000, // pixels
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp"],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp"],
};

/**
 * Category hierarchy limits (MED-8)
 */
export const CATEGORY_LIMITS = {
  MAX_DEPTH: 4, // e.g., Electronics > Phones > Smartphones > Android
  MAX_NAME_LENGTH: 100,
  MAX_SLUG_LENGTH: 50,
};

/**
 * Listing field limits
 */
export const LISTING_LIMITS = {
  TITLE_MIN_LENGTH: 10,
  TITLE_MAX_LENGTH: 80,
  DESCRIPTION_MAX_LENGTH: 10000,
  MAX_TAGS: 10,
  TAG_MAX_LENGTH: 30,
};
```

Create `packages/core/listings/image-validation.ts`:

```ts
import { IMAGE_LIMITS } from "./validation-constants";

export type ImageValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Validate image upload (MED-9)
 */
export function validateImageUpload(args: {
  fileSize: number;
  mimeType: string;
  filename: string;
  width?: number;
  height?: number;
}): ImageValidationResult {
  const errors: string[] = [];
  
  // File size
  if (args.fileSize > IMAGE_LIMITS.MAX_FILE_SIZE_BYTES) {
    const maxMB = IMAGE_LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024;
    errors.push(`File size exceeds ${maxMB}MB limit`);
  }
  
  // MIME type
  if (!IMAGE_LIMITS.ALLOWED_TYPES.includes(args.mimeType)) {
    errors.push(`File type ${args.mimeType} not allowed. Use JPEG, PNG, or WebP.`);
  }
  
  // Extension
  const ext = args.filename.substring(args.filename.lastIndexOf(".")).toLowerCase();
  if (!IMAGE_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push(`File extension ${ext} not allowed`);
  }
  
  // Dimensions (if provided)
  if (args.width && args.height) {
    if (args.width < IMAGE_LIMITS.MIN_DIMENSION || args.height < IMAGE_LIMITS.MIN_DIMENSION) {
      errors.push(`Image must be at least ${IMAGE_LIMITS.MIN_DIMENSION}x${IMAGE_LIMITS.MIN_DIMENSION} pixels`);
    }
    if (args.width > IMAGE_LIMITS.MAX_DIMENSION || args.height > IMAGE_LIMITS.MAX_DIMENSION) {
      errors.push(`Image must not exceed ${IMAGE_LIMITS.MAX_DIMENSION}x${IMAGE_LIMITS.MAX_DIMENSION} pixels`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate listing image count
 */
export function validateImageCount(currentCount: number, adding: number): ImageValidationResult {
  const errors: string[] = [];
  const newCount = currentCount + adding;
  
  if (newCount > IMAGE_LIMITS.MAX_COUNT) {
    errors.push(`Maximum ${IMAGE_LIMITS.MAX_COUNT} images allowed. You have ${currentCount}.`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
```

Create `packages/core/catalog/category-validation.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { CATEGORY_LIMITS } from "../listings/validation-constants";

const prisma = new PrismaClient();

/**
 * Get category depth (MED-8)
 */
export async function getCategoryDepth(categoryId: string): Promise<number> {
  let depth = 0;
  let currentId: string | null = categoryId;
  
  while (currentId) {
    depth++;
    const category = await prisma.category.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = category?.parentId ?? null;
    
    // Safety check for circular references
    if (depth > 10) {
      throw new Error("Category hierarchy too deep - possible circular reference");
    }
  }
  
  return depth;
}

/**
 * Validate category can have children
 */
export async function canAddChildCategory(parentId: string): Promise<boolean> {
  const depth = await getCategoryDepth(parentId);
  return depth < CATEGORY_LIMITS.MAX_DEPTH;
}

/**
 * Create category with depth validation
 */
export async function createCategory(args: {
  name: string;
  parentId?: string;
  slug: string;
}): Promise<any> {
  if (args.name.length > CATEGORY_LIMITS.MAX_NAME_LENGTH) {
    throw new Error(`Category name exceeds ${CATEGORY_LIMITS.MAX_NAME_LENGTH} characters`);
  }
  
  if (args.slug.length > CATEGORY_LIMITS.MAX_SLUG_LENGTH) {
    throw new Error(`Category slug exceeds ${CATEGORY_LIMITS.MAX_SLUG_LENGTH} characters`);
  }
  
  if (args.parentId) {
    const canAdd = await canAddChildCategory(args.parentId);
    if (!canAdd) {
      throw new Error(`Maximum category depth of ${CATEGORY_LIMITS.MAX_DEPTH} exceeded`);
    }
  }
  
  return prisma.category.create({
    data: {
      name: args.name,
      parentId: args.parentId,
      slug: args.slug,
    },
  });
}

/**
 * Get full category path
 */
export async function getCategoryPath(categoryId: string): Promise<string[]> {
  const path: string[] = [];
  let currentId: string | null = categoryId;
  
  while (currentId) {
    const category = await prisma.category.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true },
    });
    
    if (!category) break;
    path.unshift(category.name);
    currentId = category.parentId;
  }
  
  return path;
}
```

---

## 5.5) Listing Service (D2 Fix)

Create `packages/core/listings/listing-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { checkListingCap } from "@/packages/core/subscriptions/tier-enforcement";
import { createListingVersion } from "./versioning";

const prisma = new PrismaClient();

/**
 * Create a new listing
 * D2 Fix: Requires active subscription and respects listing cap
 */
export async function createListing(args: {
  sellerId: string;
  title: string;
  description?: string;
  priceCents: number;
  categoryId?: string;
  type?: "SINGLE_ITEM" | "MULTI_QUANTITY" | "VARIATION";
}): Promise<any> {
  // Step 1: Verify seller has active subscription
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId: args.sellerId },
  });

  if (!subscription) {
    throw new Error("NO_SUBSCRIPTION");
  }

  if (subscription.status !== "ACTIVE") {
    throw new Error("SUBSCRIPTION_NOT_ACTIVE");
  }

  // Step 2: Check listing cap
  const capCheck = await checkListingCap(args.sellerId);
  if (!capCheck.allowed) {
    throw new Error(`LISTING_CAP_EXCEEDED: ${capCheck.current}/${capCheck.limit} for ${capCheck.tier} tier`);
  }

  // Step 3: Create listing
  const listing = await prisma.listing.create({
    data: {
      ownerUserId: args.sellerId,
      title: args.title,
      description: args.description,
      priceCents: args.priceCents,
      categoryId: args.categoryId,
      type: args.type ?? "SINGLE_ITEM",
      status: "DRAFT",
    },
  });

  // Step 4: Increment monthly usage
  const monthKey = new Date().toISOString().slice(0, 7); // "2026-01"
  await prisma.listingMonthlyUsage.upsert({
    where: {
      sellerId_monthKey: { sellerId: args.sellerId, monthKey },
    },
    create: {
      sellerId: args.sellerId,
      monthKey,
      createdCount: 1,
    },
    update: {
      createdCount: { increment: 1 },
    },
  });

  // Step 5: Create version snapshot
  await createListingVersion({
    listingId: listing.id,
    listing,
    changeReason: "created",
    changedByUserId: args.sellerId,
  });

  // Step 6: Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: args.sellerId,
      action: "listing.created",
      entityType: "Listing",
      entityId: listing.id,
      metaJson: { tier: subscription.tier },
    },
  });

  return listing;
}
```

---

## 6) Listing Eligibility

Create `packages/core/listings/eligibility.ts`:

```ts
export type ListingDraft = {
  categoryRequiredAttributes?: string[];
  condition?: string | null;
  size?: string | null;
  priceCents?: number | null;
  quantity?: number | null;
  imagesCount: number;
  shippingProfileId?: string | null;
  title?: string | null;
  description?: string | null;
};

/**
 * Check if listing has all required attributes complete
 */
export function computeRequiredAttributesComplete(l: ListingDraft): boolean {
  const required = l.categoryRequiredAttributes ?? [];
  
  // Always required
  const hasTitle = Boolean(l.title && l.title.trim().length >= 3);
  const hasPrice = (l.priceCents ?? 0) > 0;
  const hasQty = (l.quantity ?? 0) > 0;
  const hasImage = l.imagesCount >= 1;
  const hasShipping = Boolean(l.shippingProfileId);
  
  // Category-specific
  const hasCondition = !required.includes("condition") || Boolean(l.condition);
  const hasSize = !required.includes("size") || Boolean(l.size);
  
  return hasTitle && hasPrice && hasQty && hasImage && hasShipping && hasCondition && hasSize;
}

/**
 * Get missing requirements for a listing
 */
export function getMissingRequirements(l: ListingDraft): string[] {
  const missing: string[] = [];
  const required = l.categoryRequiredAttributes ?? [];
  
  if (!l.title || l.title.trim().length < 3) missing.push("title");
  if ((l.priceCents ?? 0) <= 0) missing.push("price");
  if ((l.quantity ?? 0) <= 0) missing.push("quantity");
  if (l.imagesCount < 1) missing.push("image");
  if (!l.shippingProfileId) missing.push("shipping_profile");
  
  if (required.includes("condition") && !l.condition) missing.push("condition");
  if (required.includes("size") && !l.size) missing.push("size");
  
  return missing;
}
```

---

## 6) Listing Versioning

Create `packages/core/listings/versioning.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Build a snapshot of listing data for versioning
 */
export function buildListingSnapshot(listing: any): Record<string, any> {
  return {
    id: listing.id,
    ownerUserId: listing.ownerUserId,
    status: listing.status,
    type: listing.type,
    title: listing.title,
    description: listing.description,
    categoryId: listing.categoryId,
    condition: listing.condition,
    brand: listing.brand,
    size: listing.size,
    color: listing.color,
    material: listing.material,
    gender: listing.gender,
    priceCents: listing.priceCents,
    originalPriceCents: listing.originalPriceCents,
    currency: listing.currency,
    quantity: listing.quantity,
    shippingProfileId: listing.shippingProfileId,
    weightOz: listing.weightOz,
    tags: listing.tags,
    videoUrl: listing.videoUrl,
    customAttributesJson: listing.customAttributesJson,
    snapshotAt: new Date().toISOString(),
  };
}

/**
 * Create a version snapshot
 */
export async function createListingVersion(args: {
  listingId: string;
  listing: any;
  changeReason: string;
  changedByUserId?: string;
}): Promise<void> {
  await prisma.listingVersion.create({
    data: {
      listingId: args.listingId,
      snapshotJson: buildListingSnapshot(args.listing),
      changeReason: args.changeReason,
      changedByUserId: args.changedByUserId,
    },
  });
}
```

---

## 6) Seller API Routes

### 6.1 Create draft
`POST /api/listings`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createListingVersion } from "@/packages/core/listings/versioning";
import { checkListingCap } from "@/packages/core/subscriptions/tier-enforcement";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const userId = "twi_u_replace"; // TODO: requireUserAuth()

  const body = await req.json().catch(() => ({}));

  // D2 Fix: Verify seller has active subscription before creating listing
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId: userId },
  });

  if (!subscription) {
    return NextResponse.json({
      error: "NO_SUBSCRIPTION",
      message: "You must have an active subscription to create listings",
    }, { status: 403 });
  }

  if (subscription.status !== "ACTIVE") {
    return NextResponse.json({
      error: "SUBSCRIPTION_NOT_ACTIVE",
      message: "Your subscription must be active to create listings",
      subscriptionStatus: subscription.status,
    }, { status: 403 });
  }

  // D2 Fix: Check listing cap before creating
  const capCheck = await checkListingCap(userId);
  if (!capCheck.allowed) {
    return NextResponse.json({
      error: "LISTING_CAP_EXCEEDED",
      message: `You have reached your listing cap: ${capCheck.current}/${capCheck.limit} for ${capCheck.tier} tier`,
      current: capCheck.current,
      limit: capCheck.limit,
      tier: capCheck.tier,
    }, { status: 403 });
  }

  const listing = await prisma.listing.create({
    data: {
      ownerUserId: userId,
      status: "DRAFT",
      type: body.type ?? "SINGLE_ITEM",
      title: body.title,
      categoryId: body.categoryId,
    },
  });

  await createListingVersion({
    listingId: listing.id,
    listing,
    changeReason: "created",
    changedByUserId: userId,
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: userId,
      action: "listing.create",
      entityType: "Listing",
      entityId: listing.id,
      metaJson: { tier: subscription.tier },
    },
  });

  return NextResponse.json({ listing }, { status: 201 });
}
```

### 6.2 Update listing fields
`PUT /api/listings/:id`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { computeRequiredAttributesComplete } from "@/packages/core/listings/eligibility";
import { createListingVersion } from "@/packages/core/listings/versioning";

const prisma = new PrismaClient();

export async function PUT(req: Request, { params }: any) {
  const userId = "twi_u_replace"; // TODO: requireUserAuth()
  const body = await req.json();

  const existing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { category: true, images: true },
  });
  
  if (!existing || existing.ownerUserId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Only allow edits in DRAFT or limited fields in ACTIVE
  const isActive = existing.status === "ACTIVE";
  
  const allowedKeys = isActive
    ? ["quantity", "priceCents", "description"] // Limited edits when active
    : [
        "title", "description", "categoryId", "condition", "brand", "size",
        "color", "material", "gender", "priceCents", "originalPriceCents",
        "quantity", "shippingProfileId", "weightOz", "lengthIn", "widthIn",
        "heightIn", "tags", "videoUrl", "customAttributesJson"
      ];

  const updateData: any = {};
  for (const k of allowedKeys) {
    if (k in body) updateData[k] = body[k];
  }

  const updated = await prisma.listing.update({
    where: { id: params.id },
    data: updateData,
    include: { category: true, images: true },
  });

  // Recompute eligibility
  const requiredAttributesComplete = computeRequiredAttributesComplete({
    categoryRequiredAttributes: updated.category?.requiredAttributes ?? [],
    condition: updated.condition,
    size: updated.size,
    priceCents: updated.priceCents,
    quantity: updated.quantity,
    imagesCount: updated.images.length,
    shippingProfileId: updated.shippingProfileId,
    title: updated.title,
    description: updated.description,
  });

  const final = await prisma.listing.update({
    where: { id: params.id },
    data: { requiredAttributesComplete },
    include: { category: true, images: true },
  });

  await createListingVersion({
    listingId: final.id,
    listing: final,
    changeReason: "updated",
    changedByUserId: userId,
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: userId,
      action: "listing.update",
      entityType: "Listing",
      entityId: final.id,
      metaJson: { updatedFields: Object.keys(updateData) },
    },
  });

  return NextResponse.json({ listing: final });
}
```

### 6.3 Attach image
`POST /api/listings/:id/images`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request, { params }: any) {
  const userId = "twi_u_replace"; // TODO: requireUserAuth()
  const { url, position, altText, width, height } = await req.json();

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  if (!listing || listing.ownerUserId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const image = await prisma.listingImage.upsert({
    where: { listingId_position: { listingId: params.id, position: Number(position ?? 0) } },
    update: { url: String(url), altText, width, height },
    create: {
      listingId: params.id,
      position: Number(position ?? 0),
      url: String(url),
      altText,
      width,
      height,
    },
  });

  return NextResponse.json({ image });
}
```

### 6.4 Activate listing
`POST /api/listings/:id/activate`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { computeRequiredAttributesComplete, getMissingRequirements } from "@/packages/core/listings/eligibility";
import { createListingVersion } from "@/packages/core/listings/versioning";
import { isValidStatusTransition, LISTING_STATUS } from "@/packages/core/listings/types";

const prisma = new PrismaClient();

export async function POST(_: Request, { params }: any) {
  const userId = "twi_u_replace"; // TODO: requireUserAuth()

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { category: true, images: true },
  });
  
  if (!listing || listing.ownerUserId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Check valid transition
  if (!isValidStatusTransition(listing.status as any, LISTING_STATUS.ACTIVE)) {
    return NextResponse.json({ 
      error: "INVALID_STATUS_TRANSITION",
      from: listing.status,
      to: LISTING_STATUS.ACTIVE,
    }, { status: 400 });
  }

  // Check eligibility
  const draftData = {
    categoryRequiredAttributes: listing.category?.requiredAttributes ?? [],
    condition: listing.condition,
    size: listing.size,
    priceCents: listing.priceCents,
    quantity: listing.quantity,
    imagesCount: listing.images.length,
    shippingProfileId: listing.shippingProfileId,
    title: listing.title,
    description: listing.description,
  };

  const isComplete = computeRequiredAttributesComplete(draftData);

  if (!isComplete) {
    const missing = getMissingRequirements(draftData);
    return NextResponse.json({ 
      error: "LISTING_INCOMPLETE",
      missingRequirements: missing,
    }, { status: 400 });
  }

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      status: "ACTIVE",
      requiredAttributesComplete: true,
      activatedAt: new Date(),
    },
    include: { category: true, images: true },
  });

  await createListingVersion({
    listingId: updated.id,
    listing: updated,
    changeReason: "activated",
    changedByUserId: userId,
  });

  // Audit
  await prisma.auditEvent.create({
    data: {
      actorUserId: userId,
      action: "listing.activate",
      entityType: "Listing",
      entityId: updated.id,
    },
  });

  return NextResponse.json({ listing: updated });
}
```

### 6.5 Pause listing
`POST /api/listings/:id/pause`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createListingVersion } from "@/packages/core/listings/versioning";
import { isValidStatusTransition, LISTING_STATUS } from "@/packages/core/listings/types";

const prisma = new PrismaClient();

export async function POST(_: Request, { params }: any) {
  const userId = "twi_u_replace"; // TODO: requireUserAuth()

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  
  if (!listing || listing.ownerUserId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (!isValidStatusTransition(listing.status as any, LISTING_STATUS.PAUSED)) {
    return NextResponse.json({ 
      error: "INVALID_STATUS_TRANSITION",
      from: listing.status,
      to: LISTING_STATUS.PAUSED,
    }, { status: 400 });
  }

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      status: "PAUSED",
      pausedAt: new Date(),
    },
  });

  await createListingVersion({
    listingId: updated.id,
    listing: updated,
    changeReason: "paused",
    changedByUserId: userId,
  });

  return NextResponse.json({ listing: updated });
}
```

### 6.6 End listing
`POST /api/listings/:id/end`

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createListingVersion } from "@/packages/core/listings/versioning";
import { isValidStatusTransition, LISTING_STATUS } from "@/packages/core/listings/types";

const prisma = new PrismaClient();

export async function POST(_: Request, { params }: any) {
  const userId = "twi_u_replace"; // TODO: requireUserAuth()

  const listing = await prisma.listing.findUnique({ where: { id: params.id } });
  
  if (!listing || listing.ownerUserId !== userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (!isValidStatusTransition(listing.status as any, LISTING_STATUS.ENDED)) {
    return NextResponse.json({ 
      error: "INVALID_STATUS_TRANSITION",
      from: listing.status,
      to: LISTING_STATUS.ENDED,
    }, { status: 400 });
  }

  const updated = await prisma.listing.update({
    where: { id: listing.id },
    data: {
      status: "ENDED",
      endedAt: new Date(),
    },
  });

  await createListingVersion({
    listingId: updated.id,
    listing: updated,
    changeReason: "ended",
    changedByUserId: userId,
  });

  return NextResponse.json({ listing: updated });
}
```

### 6.6 Best Offer Service (HIGH-2)

Create `packages/core/offers/service.ts`:

```ts
import { PrismaClient, OfferStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_OFFER_EXPIRY_HOURS = 48;

export type CreateOfferArgs = {
  listingId: string;
  buyerId: string;
  offerCents: number;
  quantity?: number;
  message?: string;
};

export async function createOffer(args: CreateOfferArgs) {
  const listing = await prisma.listing.findUnique({
    where: { id: args.listingId },
  });

  if (!listing) throw new Error("LISTING_NOT_FOUND");
  if (listing.status !== "ACTIVE") throw new Error("LISTING_NOT_ACTIVE");
  if (!listing.allowOffers) throw new Error("OFFERS_NOT_ALLOWED");
  if (listing.ownerUserId === args.buyerId) throw new Error("CANNOT_OFFER_OWN_LISTING");
  
  const quantity = args.quantity ?? 1;
  const available = listing.availableQuantity ?? listing.quantity;
  if (quantity > available) throw new Error("INSUFFICIENT_QUANTITY");

  // Check for existing pending offer from this buyer
  const existingOffer = await prisma.listingOffer.findFirst({
    where: {
      listingId: args.listingId,
      buyerId: args.buyerId,
      status: "PENDING",
    },
  });
  if (existingOffer) throw new Error("EXISTING_PENDING_OFFER");

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + DEFAULT_OFFER_EXPIRY_HOURS);

  // Check auto-accept threshold
  if (listing.autoAcceptOfferCents && args.offerCents >= listing.autoAcceptOfferCents) {
    const offer = await prisma.listingOffer.create({
      data: {
        listingId: args.listingId,
        buyerId: args.buyerId,
        sellerId: listing.ownerUserId,
        offerCents: args.offerCents,
        quantity,
        message: args.message,
        status: "ACCEPTED",
        expiresAt,
        respondedAt: new Date(),
      },
    });
    
    // TODO: Auto-create order from accepted offer
    return { offer, autoAccepted: true };
  }

  // Check auto-decline threshold
  if (listing.autoDeclineOfferCents && args.offerCents < listing.autoDeclineOfferCents) {
    const offer = await prisma.listingOffer.create({
      data: {
        listingId: args.listingId,
        buyerId: args.buyerId,
        sellerId: listing.ownerUserId,
        offerCents: args.offerCents,
        quantity,
        message: args.message,
        status: "DECLINED",
        expiresAt,
        respondedAt: new Date(),
      },
    });
    
    return { offer, autoDeclined: true };
  }

  // Create pending offer
  const offer = await prisma.listingOffer.create({
    data: {
      listingId: args.listingId,
      buyerId: args.buyerId,
      sellerId: listing.ownerUserId,
      offerCents: args.offerCents,
      quantity,
      message: args.message,
      status: "PENDING",
      expiresAt,
    },
  });

  // TODO: Send notification to seller

  return { offer, autoAccepted: false, autoDeclined: false };
}

export async function respondToOffer(args: {
  offerId: string;
  sellerId: string;
  action: "accept" | "decline" | "counter";
  counterOfferCents?: number;
  counterMessage?: string;
  actorUserId: string;
}) {
  const offer = await prisma.listingOffer.findUnique({
    where: { id: args.offerId },
    include: { listing: true },
  });

  if (!offer) throw new Error("OFFER_NOT_FOUND");
  if (offer.sellerId !== args.sellerId) throw new Error("NOT_OFFER_OWNER");
  if (offer.status !== "PENDING") throw new Error("OFFER_NOT_PENDING");
  if (new Date() > offer.expiresAt) throw new Error("OFFER_EXPIRED");

  const now = new Date();

  if (args.action === "accept") {
    const updated = await prisma.listingOffer.update({
      where: { id: args.offerId },
      data: {
        status: "ACCEPTED",
        respondedAt: now,
        respondedBy: args.actorUserId,
      },
    });
    
    // TODO: Auto-create order from accepted offer
    return updated;
  }

  if (args.action === "decline") {
    return prisma.listingOffer.update({
      where: { id: args.offerId },
      data: {
        status: "DECLINED",
        respondedAt: now,
        respondedBy: args.actorUserId,
      },
    });
  }

  if (args.action === "counter") {
    if (!args.counterOfferCents) throw new Error("COUNTER_AMOUNT_REQUIRED");
    if (args.counterOfferCents <= offer.offerCents) {
      throw new Error("COUNTER_MUST_BE_HIGHER_THAN_OFFER");
    }
    if (args.counterOfferCents >= (offer.listing.priceCents ?? 0)) {
      throw new Error("COUNTER_MUST_BE_LOWER_THAN_LIST_PRICE");
    }

    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + DEFAULT_OFFER_EXPIRY_HOURS);

    return prisma.listingOffer.update({
      where: { id: args.offerId },
      data: {
        status: "COUNTERED",
        counterOfferCents: args.counterOfferCents,
        counterMessage: args.counterMessage,
        respondedAt: now,
        respondedBy: args.actorUserId,
        expiresAt: newExpiresAt, // Reset expiry for buyer response
      },
    });
  }

  throw new Error("INVALID_ACTION");
}

export async function respondToCounter(args: {
  offerId: string;
  buyerId: string;
  action: "accept" | "decline";
}) {
  const offer = await prisma.listingOffer.findUnique({
    where: { id: args.offerId },
  });

  if (!offer) throw new Error("OFFER_NOT_FOUND");
  if (offer.buyerId !== args.buyerId) throw new Error("NOT_OFFER_BUYER");
  if (offer.status !== "COUNTERED") throw new Error("NO_COUNTER_PENDING");
  if (new Date() > offer.expiresAt) throw new Error("COUNTER_EXPIRED");

  const now = new Date();

  if (args.action === "accept") {
    const updated = await prisma.listingOffer.update({
      where: { id: args.offerId },
      data: {
        status: "ACCEPTED",
        counterResponseAt: now,
      },
    });
    
    // TODO: Auto-create order at counterOfferCents price
    return updated;
  }

  return prisma.listingOffer.update({
    where: { id: args.offerId },
    data: {
      status: "DECLINED",
      counterResponseAt: now,
    },
  });
}

// Cron job to expire old offers
export async function expireStaleOffers() {
  const now = new Date();
  
  const expired = await prisma.listingOffer.updateMany({
    where: {
      status: { in: ["PENDING", "COUNTERED"] },
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
    },
  });

  return expired.count;
}
```

### 6.7 Offer API Endpoints

Create `apps/web/app/api/offers/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createOffer } from "@/packages/core/offers/service";

// POST /api/offers - Create new offer
export async function POST(req: Request) {
  const buyerId = "twi_u_replace"; // TODO: requireUserAuth()
  const { listingId, offerCents, quantity, message } = await req.json();

  try {
    const result = await createOffer({
      listingId,
      buyerId,
      offerCents,
      quantity,
      message,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

Create `apps/web/app/api/offers/[id]/respond/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { respondToOffer, respondToCounter } from "@/packages/core/offers/service";

const prisma = new PrismaClient();

// POST /api/offers/:id/respond
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = "twi_u_replace"; // TODO: requireUserAuth()
  const { action, counterOfferCents, counterMessage, role } = await req.json();

  try {
    const offer = await prisma.listingOffer.findUnique({ where: { id: params.id } });
    if (!offer) {
      return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404 });
    }

    // Determine if this is seller responding to offer or buyer responding to counter
    if (role === "seller" && offer.sellerId === userId) {
      const result = await respondToOffer({
        offerId: params.id,
        sellerId: userId,
        action,
        counterOfferCents,
        counterMessage,
        actorUserId: userId,
      });
      return NextResponse.json({ offer: result });
    }

    if (role === "buyer" && offer.buyerId === userId) {
      const result = await respondToCounter({
        offerId: params.id,
        buyerId: userId,
        action,
      });
      return NextResponse.json({ offer: result });
    }

    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 6.8 Insertion Fee Service (HIGH-5)

Create `packages/core/fees/insertionFees.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function calculateInsertionFee(
  sellerId: string,
  listingId: string
): Promise<{ amountCents: number; type: string; waived: boolean; reason?: string }> {
  // Get seller's tier (defaults to SELLER for casual sellers)
  const subscription = await prisma.sellerSubscription.findUnique({
    where: { sellerId },
  });
  const tier = subscription?.tier ?? "SELLER";

  // Get active fee schedule (for admin overrides)
  const feeSchedule = await prisma.feeSchedule.findFirst({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });

  // Get this month's billing period
  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Count listings activated this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activatedThisMonth = await prisma.listing.count({
    where: {
      ownerUserId: sellerId,
      activatedAt: { gte: monthStart },
    },
  });

  // Tier-specific free allowances and insertion fees (eBay-exact)
  const tierConfig: Record<string, { freeListings: number; insertionFeeCents: number }> = {
    SELLER:       { freeListings: 250,    insertionFeeCents: 35 },  // $0.35
    STARTER:    { freeListings: 250,    insertionFeeCents: 30 },  // $0.30
    BASIC:      { freeListings: 1000,   insertionFeeCents: 25 },  // $0.25
    PRO:    { freeListings: 10000,  insertionFeeCents: 15 },  // $0.15
    ELITE:     { freeListings: 25000,  insertionFeeCents: 5 },   // $0.05
    ENTERPRISE: { freeListings: 100000, insertionFeeCents: 5 },   // $0.05
  };

  // Check TierPricingVersion for admin overrides
  const tierPricing = await prisma.tierPricingVersion.findFirst({
    where: { isActive: true, effectiveAt: { lte: new Date() } },
    orderBy: { effectiveAt: "desc" },
  });

  const pricingJson = tierPricing?.pricingJson as any;
  const config = tierConfig[tier] ?? tierConfig.SELLER;
  const freeAllowance = pricingJson?.tiers?.[tier]?.freeListingsMonthly ?? config.freeListings;
  const insertionFeeCents = pricingJson?.tiers?.[tier]?.insertionFeeCents ?? config.insertionFeeCents;

  // Check fee schedule for admin override on insertion fee
  const adminOverrideInsertionFee = feeSchedule?.insertionFeeCentsOverride;

  // If within free allowance, no fee
  if (activatedThisMonth < freeAllowance) {
    return { amountCents: 0, type: "INSERTION", waived: true, reason: "WITHIN_FREE_ALLOWANCE" };
  }

  // Insertion fee applies for listings over free allowance
  const finalInsertionFee = adminOverrideInsertionFee ?? insertionFeeCents;

  return {
    amountCents: finalInsertionFee,
    type: "INSERTION_OVERAGE",
    waived: false,
  };
}

export async function recordListingFee(args: {
  listingId: string;
  sellerId: string;
  type: string;
  amountCents: number;
  feeScheduleId?: string;
  billingPeriod?: string;
  waived?: boolean;
  waivedReason?: string;
}) {
  return prisma.listingFee.create({
    data: {
      listingId: args.listingId,
      sellerId: args.sellerId,
      type: args.type as any,
      amountCents: args.amountCents,
      feeScheduleId: args.feeScheduleId,
      billingPeriod: args.billingPeriod,
      waived: args.waived ?? false,
      waivedReason: args.waivedReason,
    },
  });
}

// Call this when activating a listing
export async function processListingActivation(
  listingId: string,
  sellerId: string
): Promise<void> {
  const fee = await calculateInsertionFee(sellerId, listingId);
  
  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await recordListingFee({
    listingId,
    sellerId,
    type: fee.type,
    amountCents: fee.amountCents,
    billingPeriod,
    waived: fee.waived,
    waivedReason: fee.reason,
  });

  // If fee is non-zero and not waived, create ledger entry
  if (fee.amountCents > 0 && !fee.waived) {
    await prisma.ledgerEntry.create({
      data: {
        ledgerKey: `listing_fee:${listingId}:${billingPeriod}`,
        provider: "platform",
        providerObjectType: "listing_fee",
        providerObjectId: listingId,
        sellerId,
        type: "MARKETPLACE_FEE",
        direction: "DEBIT",
        amountCents: fee.amountCents,
        currency: "USD",
        occurredAt: new Date(),
        description: `Insertion fee: ${fee.type}`,
      },
    });
  }
}
```

---

## 8) Health Provider: Listings

Create `packages/core/health/providers/listings.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const listingsHealthProvider: HealthProvider = {
  id: "listings",
  label: "Listings & Catalog",
  description: "Listing lifecycle and catalog health",
  version: "1.1.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status: typeof HEALTH_STATUS[keyof typeof HEALTH_STATUS] = HEALTH_STATUS.PASS;

    // Check 1: Categories seeded
    const categoryCount = await prisma.category.count({ where: { isActive: true } });
    checks.push({
      id: "categories_seeded",
      label: "Categories seeded",
      status: categoryCount >= 3 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: `${categoryCount} active categories`,
    });
    if (categoryCount < 3) status = HEALTH_STATUS.FAIL;

    // Check 2: No orphaned listings (category deleted)
    const orphanedListings = await prisma.listing.count({
      where: {
        categoryId: { not: null },
        category: null,
      },
    });
    checks.push({
      id: "no_orphaned_listings",
      label: "No orphaned listings",
      status: orphanedListings === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: orphanedListings === 0 ? "No orphans" : `${orphanedListings} orphaned`,
    });
    if (orphanedListings > 0 && status !== HEALTH_STATUS.FAIL) status = HEALTH_STATUS.WARN;

    // Check 3: Active listings have required attributes
    const activeIncomplete = await prisma.listing.count({
      where: {
        status: "ACTIVE",
        requiredAttributesComplete: false,
      },
    });
    checks.push({
      id: "active_listings_complete",
      label: "Active listings have required attributes",
      status: activeIncomplete === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: activeIncomplete === 0 ? "All complete" : `${activeIncomplete} incomplete active listings`,
    });
    if (activeIncomplete > 0) status = HEALTH_STATUS.FAIL;

    // Check 4: Active listings have images
    const activeNoImages = await prisma.listing.count({
      where: {
        status: "ACTIVE",
        images: { none: {} },
      },
    });
    checks.push({
      id: "active_listings_have_images",
      label: "Active listings have images",
      status: activeNoImages === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: activeNoImages === 0 ? "All have images" : `${activeNoImages} without images`,
    });
    if (activeNoImages > 0) status = HEALTH_STATUS.FAIL;

    return {
      providerId: this.id,
      status,
      summary: status === HEALTH_STATUS.PASS ? "Listings healthy" : "Listing issues detected",
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

## 9) Doctor Checks (Phase 2)

```ts
async function checkListings() {
  const checks = [];

  // Categories seeded
  const categoryCount = await prisma.category.count({ where: { isActive: true } });
  checks.push({
    key: "listings.categories_seeded",
    ok: categoryCount >= 3,
    details: `${categoryCount} categories`,
  });

  // Create draft test
  const testListing = await prisma.listing.create({
    data: {
      ownerUserId: "doctor_test",
      status: "DRAFT",
      type: "SINGLE_ITEM",
    },
  });
  checks.push({
    key: "listings.create_draft",
    ok: testListing.status === "DRAFT",
    details: "Draft created",
  });

  // Activation should fail when incomplete
  const isComplete = false; // No title, price, image, shipping
  checks.push({
    key: "listings.activate_gate_blocks_incomplete",
    ok: !isComplete,
    details: "Gate enforced",
  });

  // Update to make complete
  const category = await prisma.category.findFirst({ where: { isActive: true } });
  await prisma.listing.update({
    where: { id: testListing.id },
    data: {
      title: "Test Listing",
      priceCents: 1000,
      quantity: 1,
      categoryId: category?.id,
      condition: "good",
      size: "M",
      shippingProfileId: "test_profile",
      tags: ["test", "doctor"],
    },
  });
  await prisma.listingImage.create({
    data: {
      listingId: testListing.id,
      url: "https://example.com/test.jpg",
      position: 0,
    },
  });

  // Now activation should work
  const updatedListing = await prisma.listing.update({
    where: { id: testListing.id },
    data: {
      status: "ACTIVE",
      requiredAttributesComplete: true,
      activatedAt: new Date(),
    },
  });
  checks.push({
    key: "listings.activate_success_when_complete",
    ok: updatedListing.status === "ACTIVE",
    details: "Activation successful",
  });

  // Version snapshot exists
  const versionCount = await prisma.listingVersion.count({
    where: { listingId: testListing.id },
  });
  checks.push({
    key: "listings.version_snapshot_written",
    ok: versionCount >= 1,
    details: `${versionCount} versions`,
  });

  // Tags saved
  checks.push({
    key: "listings.tags_saved",
    ok: updatedListing.tags?.length === 2,
    details: `${updatedListing.tags?.length ?? 0} tags`,
  });

  // Cleanup
  await prisma.listingImage.deleteMany({ where: { listingId: testListing.id } });
  await prisma.listingVersion.deleteMany({ where: { listingId: testListing.id } });
  await prisma.listing.delete({ where: { id: testListing.id } });

  return checks;
}
```

---

## 9.1) Trust Labels Integration (Phase 37)

### Listing Detail API Enhancement

When returning a listing detail to buyers, include the seller's trust label:

```typescript
// In apps/web/app/api/listings/[id]/route.ts GET handler

import { getBuyerTrustLabel } from "@/packages/core/seller-standards/trustLabelService";

export async function GET(req: Request, { params }: any) {
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      images: { orderBy: { displayOrder: "asc" } },
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Get seller info
  const seller = await prisma.user.findUnique({
    where: { id: listing.ownerUserId },
    select: { id: true, name: true, avatarUrl: true },
  });

  // Get seller's trust label (Phase 37 integration)
  const trustLabel = await getBuyerTrustLabel(listing.ownerUserId);

  return NextResponse.json({
    listing,
    seller: {
      id: seller?.id,
      name: seller?.name,
      avatarUrl: seller?.avatarUrl,
      trustLabel: trustLabel,  // Buyer-visible trust badge
    },
  });
}
```

### Trust Label Display

The seller's trust label should be displayed prominently on:
- Listing detail page (near seller name)
- Listing cards in search results
- Cart (next to seller name for each item)

**Key Rule:** Only show positive badges. If `trustLabel.showLabel` is false, render nothing.

---

## 10) Phase 2 Completion Criteria

- Categories exist and seeded
- Draft  ->  update  ->  activate works
- Activation gate blocks incomplete listings
- Version snapshots exist with changeReason
- **Tags field** saves and retrieves correctly
- **VideoUrl field** exists for future use
- State machine transitions enforced
- Health provider passes all checks
- Doctor passes all Phase 2 checks
- **Deal badge freshness** - All badges recomputed within 24h of price change (Phase 43)
- **Seller trust label** - Listing detail includes seller trust badge (Phase 37)

---

## 11) Canonical Alignment Notes

| Canonical Requirement | Implementation |
|----------------------|----------------|
| `tags String[]` | Added to Listing model |
| `videoUrl String?` | Added for future video support |
| State machine transitions | `isValidStatusTransition()` helper |
| Version snapshots | `ListingVersion` with `changeReason` |
| Required attributes check | `computeRequiredAttributesComplete()` |
| Single-owner model | `ownerUserId` field only |
| Phase 43 (Buyer Experience Plus) | Deal badge computation on price change |
| Phase 43 (Buyer Experience Plus) | Market price index lookup for listings |

---

## 12) Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-01 | Initial Phase 2 implementation |
| 1.1 | 2026-01-15 | Added Best Offer, Listing Fees, Multi-quantity |
| 1.2 | 2026-01-20 | MED-8: Category depth limit, MED-9: Image upload limits |
| 1.3 | 2026-01-21 | D2: Subscription check required before listing creation |
| 1.4 | 2026-01-22 | Phase 43 integration: Deal badge fields, market index relation |
| 1.5 | 2026-01-22 | Phase 37 integration: Seller trust labels on listing detail |
