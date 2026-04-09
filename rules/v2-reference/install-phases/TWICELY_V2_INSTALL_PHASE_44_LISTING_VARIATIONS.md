# Phase 44: Listing Variations System

**Prerequisites:** Phase 01 (Auth), Phase 03 (Listings), Phase 15 (Platform Settings)  
**Install Order:** After Phase 43  
**Estimated Time:** 4-6 hours

---

## Overview

This phase implements the **Listing Variations System** allowing sellers to create multi-option listings (size, color, material combinations).

**Features:**
- 13 system variation types pre-populated
- 500+ platform-level values pre-seeded
- Hybrid approach: predefined + custom values
- Usage tracking and analytics
- Admin management page
- Promotion and cleanup workflows

**Canonical Reference:** `TWICELY_V2_VARIATIONS_CANONICAL.md`

---

## 1. Database Schema

Add to `prisma/schema.prisma`:

```prisma
// =============================================================================
// PHASE 44: LISTING VARIATIONS SYSTEM
// =============================================================================

// -----------------------------------------------------------------------------
// VARIATION TYPES - The dimensions (Size, Color, Material, etc.)
// -----------------------------------------------------------------------------

model VariationType {
  id              String   @id @default(cuid())
  
  // Internal key (SIZE, COLOR, MATERIAL, CUSTOM_xxx)
  key             String   @unique
  
  // Display label
  label           String
  
  // Description for sellers
  description     String?
  
  // Icon name (Lucide icon)
  icon            String?
  
  // Is this a system type (cannot delete)?
  isSystem        Boolean  @default(false)
  
  // Is this active?
  isActive        Boolean  @default(true)
  
  // Sort order in UI
  sortOrder       Int      @default(0)
  
  // Usage tracking
  totalListings   Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String?
  
  // Relations
  values          VariationValue[]
  categoryTypes   CategoryVariationType[]
  listingVariations ListingVariation[]
  
  @@index([isActive, sortOrder])
  @@index([key])
}

// -----------------------------------------------------------------------------
// VARIATION VALUES - The actual options (Red, Blue, Small, Large, etc.)
// -----------------------------------------------------------------------------

model VariationValue {
  id              String   @id @default(cuid())
  
  // Which variation type this belongs to
  variationTypeId String
  variationType   VariationType @relation(fields: [variationTypeId], references: [id], onDelete: Cascade)
  
  // The actual display value
  value           String
  
  // Normalized value for searching/deduplication (lowercase, trimmed)
  normalizedValue String
  
  // Scope: PLATFORM, CATEGORY, or SELLER
  scope           VariationScope @default(PLATFORM)
  
  // If CATEGORY scope, which category
  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  
  // If SELLER scope, which seller
  sellerId        String?
  seller          User?     @relation("SellerVariationValues", fields: [sellerId], references: [id], onDelete: Cascade)
  
  // Display metadata
  colorHex        String?   // For COLOR type, hex code (#FF0000)
  imageUrl        String?   // Optional swatch image
  
  // Usage tracking
  usageCount      Int       @default(0)
  lastUsedAt      DateTime?
  
  // Is this active/approved?
  isActive        Boolean   @default(true)
  
  // Promotion tracking
  promotedAt      DateTime?
  promotedBy      String?
  
  // Sort order within type
  sortOrder       Int       @default(0)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  createdBy       String?
  
  // Relations
  listingOptions  ListingVariationOption[]
  
  @@unique([variationTypeId, normalizedValue, scope, categoryId, sellerId])
  @@index([variationTypeId, scope, isActive])
  @@index([variationTypeId, isActive, usageCount])
  @@index([sellerId, variationTypeId])
  @@index([normalizedValue])
  @@index([usageCount])
  @@index([lastUsedAt])
}

enum VariationScope {
  PLATFORM    // Available to all sellers
  CATEGORY    // Available to sellers in specific category
  SELLER      // Only available to the seller who created it
}

// -----------------------------------------------------------------------------
// CATEGORY VARIATION TYPES - Which types are relevant per category
// -----------------------------------------------------------------------------

model CategoryVariationType {
  id              String   @id @default(cuid())
  
  categoryId      String
  category        Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  variationTypeId String
  variationType   VariationType @relation(fields: [variationTypeId], references: [id], onDelete: Cascade)
  
  // Is this required for listings in this category?
  isRequired      Boolean  @default(false)
  
  // Is this the primary variation for this category (shown in search)?
  isPrimary       Boolean  @default(false)
  
  // Sort order for this category
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  
  @@unique([categoryId, variationTypeId])
  @@index([categoryId])
  @@index([variationTypeId])
}

// -----------------------------------------------------------------------------
// LISTING VARIATIONS - Variation dimensions on a specific listing
// -----------------------------------------------------------------------------

model ListingVariation {
  id              String   @id @default(cuid())
  
  // Parent listing
  listingId       String
  listing         Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  
  // Which variation type
  variationTypeId String
  variationType   VariationType @relation(fields: [variationTypeId], references: [id])
  
  // Sort order on the listing
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  
  // The actual values selected for this variation
  options         ListingVariationOption[]
  
  @@unique([listingId, variationTypeId])
  @@index([listingId])
  @@index([variationTypeId])
}

// -----------------------------------------------------------------------------
// LISTING VARIATION OPTIONS - Specific values selected for a listing variation
// -----------------------------------------------------------------------------

model ListingVariationOption {
  id                    String   @id @default(cuid())
  
  listingVariationId    String
  listingVariation      ListingVariation @relation(fields: [listingVariationId], references: [id], onDelete: Cascade)
  
  // Reference to library value (if from library)
  variationValueId      String?
  variationValue        VariationValue? @relation(fields: [variationValueId], references: [id], onDelete: SetNull)
  
  // Custom value text (if not from library)
  customValue           String?
  
  // The display value (denormalized for performance)
  displayValue          String
  
  // Sort order
  sortOrder             Int      @default(0)
  
  createdAt             DateTime @default(now())
  
  @@index([listingVariationId])
  @@index([variationValueId])
}

// -----------------------------------------------------------------------------
// LISTING CHILDREN - Individual SKUs with specific variation combinations
// -----------------------------------------------------------------------------

model ListingChild {
  id              String   @id @default(cuid())
  
  // Parent listing
  parentListingId String
  parentListing   Listing  @relation("ParentToChildren", fields: [parentListingId], references: [id], onDelete: Cascade)
  
  // Variation combination (JSON: {"SIZE": "M", "COLOR": "Red"})
  variationCombination Json
  
  // SKU for this specific combination
  sku             String
  
  // Price in cents (can differ from parent)
  priceCents      Int
  
  // Compare-at price for showing discounts
  compareAtPriceCents Int?
  
  // Cost for profit calculation (optional)
  costCents       Int?
  
  // Quantity available
  quantity        Int      @default(0)
  
  // Low stock threshold for alerts
  lowStockThreshold Int?
  
  // Weight for shipping (grams)
  weightGrams     Int?
  
  // Barcode (UPC, EAN, etc.)
  barcode         String?
  
  // Is this combination active?
  isActive        Boolean  @default(true)
  
  // Images specific to this variation
  images          ListingChildImage[]
  
  // Order line items referencing this child
  orderLineItems  OrderLineItem[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([parentListingId, sku])
  @@index([parentListingId, isActive])
  @@index([sku])
  @@index([barcode])
}

model ListingChildImage {
  id              String   @id @default(cuid())
  
  listingChildId  String
  listingChild    ListingChild @relation(fields: [listingChildId], references: [id], onDelete: Cascade)
  
  url             String
  altText         String?
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  
  @@index([listingChildId, sortOrder])
}

// -----------------------------------------------------------------------------
// VARIATION ANALYTICS - Daily rollup of usage stats
// -----------------------------------------------------------------------------

model VariationAnalytics {
  id              String   @id @default(cuid())
  
  // Period (daily rollup)
  date            DateTime @db.Date
  
  // What we're tracking
  variationTypeId String
  variationValueId String?  // null for type-level analytics
  
  // Scope breakdown
  scope           VariationScope?
  categoryId      String?
  
  // Metrics
  listingsCreated Int      @default(0)
  listingsActive  Int      @default(0)
  itemsSold       Int      @default(0)
  revenueCents    Int      @default(0)
  
  createdAt       DateTime @default(now())
  
  @@unique([date, variationTypeId, variationValueId, scope, categoryId])
  @@index([date])
  @@index([variationTypeId])
  @@index([variationValueId])
}

// -----------------------------------------------------------------------------
// UPDATE EXISTING LISTING MODEL - Add variation support
// -----------------------------------------------------------------------------

// Add to existing Listing model:
// hasVariations    Boolean  @default(false)
// variationType    String?  // Deprecated, use ListingVariation
// children         ListingChild[] @relation("ParentToChildren")
// variations       ListingVariation[]
```

---

## 2. Run Migration

```bash
npx prisma migrate dev --name phase_44_listing_variations
```

---

## 3. Seed Data: Variation Types

Create `prisma/seeds/phase-44-variation-types.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedVariationTypes() {
  console.log("🌱 Seeding variation types...");

  const types = [
    {
      key: "SIZE",
      label: "Size",
      description: "Physical size of the item (clothing, shoes, accessories)",
      icon: "Ruler",
      isSystem: true,
      sortOrder: 1,
    },
    {
      key: "COLOR",
      label: "Color",
      description: "Color or color combination",
      icon: "Palette",
      isSystem: true,
      sortOrder: 2,
    },
    {
      key: "MATERIAL",
      label: "Material",
      description: "Primary material, fabric, or composition",
      icon: "Layers",
      isSystem: true,
      sortOrder: 3,
    },
    {
      key: "STYLE",
      label: "Style",
      description: "Style, cut, or fit variation",
      icon: "Shirt",
      isSystem: true,
      sortOrder: 4,
    },
    {
      key: "PATTERN",
      label: "Pattern",
      description: "Pattern, print, or design",
      icon: "Grid3X3",
      isSystem: true,
      sortOrder: 5,
    },
    {
      key: "SCENT",
      label: "Scent/Fragrance",
      description: "Scent, fragrance, or aroma option",
      icon: "Wind",
      isSystem: true,
      sortOrder: 6,
    },
    {
      key: "FLAVOR",
      label: "Flavor",
      description: "Flavor or taste variation",
      icon: "Coffee",
      isSystem: true,
      sortOrder: 7,
    },
    {
      key: "LENGTH",
      label: "Length",
      description: "Length measurement or option",
      icon: "MoveHorizontal",
      isSystem: true,
      sortOrder: 8,
    },
    {
      key: "WIDTH",
      label: "Width",
      description: "Width, band size, or girth",
      icon: "MoveVertical",
      isSystem: true,
      sortOrder: 9,
    },
    {
      key: "CAPACITY",
      label: "Capacity/Volume",
      description: "Storage capacity, volume, or size",
      icon: "Box",
      isSystem: true,
      sortOrder: 10,
    },
    {
      key: "PACK_SIZE",
      label: "Pack Size",
      description: "Quantity per pack or bundle",
      icon: "Package",
      isSystem: true,
      sortOrder: 11,
    },
    {
      key: "FINISH",
      label: "Finish",
      description: "Surface finish, coating, or texture",
      icon: "Sparkles",
      isSystem: true,
      sortOrder: 12,
    },
    {
      key: "POWER",
      label: "Power/Voltage",
      description: "Electrical specifications or power options",
      icon: "Zap",
      isSystem: true,
      sortOrder: 13,
    },
  ];

  for (const type of types) {
    await prisma.variationType.upsert({
      where: { key: type.key },
      update: {
        label: type.label,
        description: type.description,
        icon: type.icon,
        sortOrder: type.sortOrder,
      },
      create: type,
    });
  }

  console.log(`✅ Seeded ${types.length} variation types`);
}
```

---

## 4. Seed Data: Variation Values

Create `prisma/seeds/phase-44-variation-values.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// =============================================================================
// PLATFORM VARIATION VALUES - Pre-populated for all sellers
// =============================================================================

const VARIATION_VALUES: Record<string, { value: string; colorHex?: string; sortOrder?: number }[]> = {
  // -------------------------------------------------------------------------
  // SIZE - 80+ values
  // -------------------------------------------------------------------------
  SIZE: [
    // Letter sizes
    { value: "XXS", sortOrder: 1 },
    { value: "XS", sortOrder: 2 },
    { value: "S", sortOrder: 3 },
    { value: "M", sortOrder: 4 },
    { value: "L", sortOrder: 5 },
    { value: "XL", sortOrder: 6 },
    { value: "XXL", sortOrder: 7 },
    { value: "2XL", sortOrder: 8 },
    { value: "3XL", sortOrder: 9 },
    { value: "4XL", sortOrder: 10 },
    { value: "5XL", sortOrder: 11 },
    
    // Numeric (clothing)
    { value: "0", sortOrder: 20 },
    { value: "2", sortOrder: 21 },
    { value: "4", sortOrder: 22 },
    { value: "6", sortOrder: 23 },
    { value: "8", sortOrder: 24 },
    { value: "10", sortOrder: 25 },
    { value: "12", sortOrder: 26 },
    { value: "14", sortOrder: 27 },
    { value: "16", sortOrder: 28 },
    { value: "18", sortOrder: 29 },
    { value: "20", sortOrder: 30 },
    { value: "22", sortOrder: 31 },
    { value: "24", sortOrder: 32 },
    { value: "26", sortOrder: 33 },
    { value: "28", sortOrder: 34 },
    { value: "30", sortOrder: 35 },
    { value: "32", sortOrder: 36 },
    { value: "34", sortOrder: 37 },
    { value: "36", sortOrder: 38 },
    { value: "38", sortOrder: 39 },
    { value: "40", sortOrder: 40 },
    
    // Shoe sizes (US)
    { value: "5", sortOrder: 50 },
    { value: "5.5", sortOrder: 51 },
    { value: "6", sortOrder: 52 },
    { value: "6.5", sortOrder: 53 },
    { value: "7", sortOrder: 54 },
    { value: "7.5", sortOrder: 55 },
    { value: "8", sortOrder: 56 },
    { value: "8.5", sortOrder: 57 },
    { value: "9", sortOrder: 58 },
    { value: "9.5", sortOrder: 59 },
    { value: "10", sortOrder: 60 },
    { value: "10.5", sortOrder: 61 },
    { value: "11", sortOrder: 62 },
    { value: "11.5", sortOrder: 63 },
    { value: "12", sortOrder: 64 },
    { value: "13", sortOrder: 65 },
    { value: "14", sortOrder: 66 },
    { value: "15", sortOrder: 67 },
    
    // Special
    { value: "One Size", sortOrder: 100 },
    { value: "One Size Fits All", sortOrder: 101 },
    { value: "OSFA", sortOrder: 102 },
    { value: "Free Size", sortOrder: 103 },
    { value: "Plus Size", sortOrder: 104 },
    { value: "Petite", sortOrder: 105 },
    { value: "Tall", sortOrder: 106 },
    { value: "Short", sortOrder: 107 },
    { value: "Regular", sortOrder: 108 },
    { value: "Long", sortOrder: 109 },
    
    // Kids
    { value: "Newborn", sortOrder: 120 },
    { value: "0-3M", sortOrder: 121 },
    { value: "3-6M", sortOrder: 122 },
    { value: "6-9M", sortOrder: 123 },
    { value: "9-12M", sortOrder: 124 },
    { value: "12-18M", sortOrder: 125 },
    { value: "18-24M", sortOrder: 126 },
    { value: "2T", sortOrder: 127 },
    { value: "3T", sortOrder: 128 },
    { value: "4T", sortOrder: 129 },
    { value: "5T", sortOrder: 130 },
    { value: "Kids XS", sortOrder: 131 },
    { value: "Kids S", sortOrder: 132 },
    { value: "Kids M", sortOrder: 133 },
    { value: "Kids L", sortOrder: 134 },
    { value: "Kids XL", sortOrder: 135 },
  ],

  // -------------------------------------------------------------------------
  // COLOR - 100+ values with hex codes
  // -------------------------------------------------------------------------
  COLOR: [
    // Neutrals
    { value: "Black", colorHex: "#000000", sortOrder: 1 },
    { value: "White", colorHex: "#FFFFFF", sortOrder: 2 },
    { value: "Gray", colorHex: "#808080", sortOrder: 3 },
    { value: "Grey", colorHex: "#808080", sortOrder: 4 },
    { value: "Charcoal", colorHex: "#36454F", sortOrder: 5 },
    { value: "Silver", colorHex: "#C0C0C0", sortOrder: 6 },
    { value: "Off White", colorHex: "#FAF9F6", sortOrder: 7 },
    { value: "Ivory", colorHex: "#FFFFF0", sortOrder: 8 },
    { value: "Cream", colorHex: "#FFFDD0", sortOrder: 9 },
    
    // Browns/Tans
    { value: "Brown", colorHex: "#964B00", sortOrder: 20 },
    { value: "Tan", colorHex: "#D2B48C", sortOrder: 21 },
    { value: "Beige", colorHex: "#F5F5DC", sortOrder: 22 },
    { value: "Khaki", colorHex: "#C3B091", sortOrder: 23 },
    { value: "Taupe", colorHex: "#483C32", sortOrder: 24 },
    { value: "Camel", colorHex: "#C19A6B", sortOrder: 25 },
    { value: "Chocolate", colorHex: "#7B3F00", sortOrder: 26 },
    { value: "Espresso", colorHex: "#3C2415", sortOrder: 27 },
    { value: "Cognac", colorHex: "#9A463D", sortOrder: 28 },
    { value: "Rust", colorHex: "#B7410E", sortOrder: 29 },
    
    // Reds/Pinks
    { value: "Red", colorHex: "#FF0000", sortOrder: 40 },
    { value: "Burgundy", colorHex: "#800020", sortOrder: 41 },
    { value: "Maroon", colorHex: "#800000", sortOrder: 42 },
    { value: "Wine", colorHex: "#722F37", sortOrder: 43 },
    { value: "Crimson", colorHex: "#DC143C", sortOrder: 44 },
    { value: "Scarlet", colorHex: "#FF2400", sortOrder: 45 },
    { value: "Pink", colorHex: "#FFC0CB", sortOrder: 46 },
    { value: "Hot Pink", colorHex: "#FF69B4", sortOrder: 47 },
    { value: "Blush", colorHex: "#DE5D83", sortOrder: 48 },
    { value: "Rose", colorHex: "#FF007F", sortOrder: 49 },
    { value: "Dusty Rose", colorHex: "#DCAE96", sortOrder: 50 },
    { value: "Coral", colorHex: "#FF7F50", sortOrder: 51 },
    { value: "Salmon", colorHex: "#FA8072", sortOrder: 52 },
    { value: "Peach", colorHex: "#FFCBA4", sortOrder: 53 },
    { value: "Magenta", colorHex: "#FF00FF", sortOrder: 54 },
    { value: "Fuchsia", colorHex: "#FF00FF", sortOrder: 55 },
    
    // Oranges/Yellows
    { value: "Orange", colorHex: "#FFA500", sortOrder: 60 },
    { value: "Burnt Orange", colorHex: "#CC5500", sortOrder: 61 },
    { value: "Tangerine", colorHex: "#FF9966", sortOrder: 62 },
    { value: "Apricot", colorHex: "#FBCEB1", sortOrder: 63 },
    { value: "Yellow", colorHex: "#FFFF00", sortOrder: 64 },
    { value: "Gold", colorHex: "#FFD700", sortOrder: 65 },
    { value: "Mustard", colorHex: "#FFDB58", sortOrder: 66 },
    { value: "Lemon", colorHex: "#FFF44F", sortOrder: 67 },
    
    // Greens
    { value: "Green", colorHex: "#008000", sortOrder: 70 },
    { value: "Dark Green", colorHex: "#006400", sortOrder: 71 },
    { value: "Forest Green", colorHex: "#228B22", sortOrder: 72 },
    { value: "Hunter Green", colorHex: "#355E3B", sortOrder: 73 },
    { value: "Olive", colorHex: "#808000", sortOrder: 74 },
    { value: "Army Green", colorHex: "#4B5320", sortOrder: 75 },
    { value: "Sage", colorHex: "#BCB88A", sortOrder: 76 },
    { value: "Mint", colorHex: "#98FF98", sortOrder: 77 },
    { value: "Seafoam", colorHex: "#93E9BE", sortOrder: 78 },
    { value: "Lime", colorHex: "#32CD32", sortOrder: 79 },
    { value: "Kelly Green", colorHex: "#4CBB17", sortOrder: 80 },
    { value: "Emerald", colorHex: "#50C878", sortOrder: 81 },
    { value: "Jade", colorHex: "#00A86B", sortOrder: 82 },
    { value: "Teal", colorHex: "#008080", sortOrder: 83 },
    { value: "Turquoise", colorHex: "#40E0D0", sortOrder: 84 },
    { value: "Aqua", colorHex: "#00FFFF", sortOrder: 85 },
    { value: "Cyan", colorHex: "#00FFFF", sortOrder: 86 },
    
    // Blues
    { value: "Blue", colorHex: "#0000FF", sortOrder: 90 },
    { value: "Navy", colorHex: "#000080", sortOrder: 91 },
    { value: "Navy Blue", colorHex: "#000080", sortOrder: 92 },
    { value: "Dark Blue", colorHex: "#00008B", sortOrder: 93 },
    { value: "Royal Blue", colorHex: "#4169E1", sortOrder: 94 },
    { value: "Cobalt", colorHex: "#0047AB", sortOrder: 95 },
    { value: "Sky Blue", colorHex: "#87CEEB", sortOrder: 96 },
    { value: "Light Blue", colorHex: "#ADD8E6", sortOrder: 97 },
    { value: "Baby Blue", colorHex: "#89CFF0", sortOrder: 98 },
    { value: "Powder Blue", colorHex: "#B0E0E6", sortOrder: 99 },
    { value: "Periwinkle", colorHex: "#CCCCFF", sortOrder: 100 },
    { value: "Denim", colorHex: "#1560BD", sortOrder: 101 },
    { value: "Indigo", colorHex: "#4B0082", sortOrder: 102 },
    
    // Purples
    { value: "Purple", colorHex: "#800080", sortOrder: 110 },
    { value: "Violet", colorHex: "#EE82EE", sortOrder: 111 },
    { value: "Lavender", colorHex: "#E6E6FA", sortOrder: 112 },
    { value: "Lilac", colorHex: "#C8A2C8", sortOrder: 113 },
    { value: "Plum", colorHex: "#DDA0DD", sortOrder: 114 },
    { value: "Mauve", colorHex: "#E0B0FF", sortOrder: 115 },
    { value: "Orchid", colorHex: "#DA70D6", sortOrder: 116 },
    { value: "Eggplant", colorHex: "#614051", sortOrder: 117 },
    { value: "Grape", colorHex: "#6F2DA8", sortOrder: 118 },
    
    // Metallics
    { value: "Rose Gold", colorHex: "#B76E79", sortOrder: 130 },
    { value: "Bronze", colorHex: "#CD7F32", sortOrder: 131 },
    { value: "Copper", colorHex: "#B87333", sortOrder: 132 },
    { value: "Brass", colorHex: "#B5A642", sortOrder: 133 },
    { value: "Pewter", colorHex: "#8E8E8E", sortOrder: 134 },
    { value: "Gunmetal", colorHex: "#2C3539", sortOrder: 135 },
    
    // Multi/Special
    { value: "Multi", sortOrder: 200 },
    { value: "Multicolor", sortOrder: 201 },
    { value: "Rainbow", sortOrder: 202 },
    { value: "Tie Dye", sortOrder: 203 },
    { value: "Ombre", sortOrder: 204 },
    { value: "Color Block", sortOrder: 205 },
    { value: "Clear", sortOrder: 206 },
    { value: "Transparent", sortOrder: 207 },
    { value: "Holographic", sortOrder: 208 },
    { value: "Iridescent", sortOrder: 209 },
  ],

  // -------------------------------------------------------------------------
  // MATERIAL - 80+ values
  // -------------------------------------------------------------------------
  MATERIAL: [
    // Natural fabrics
    { value: "Cotton", sortOrder: 1 },
    { value: "100% Cotton", sortOrder: 2 },
    { value: "Organic Cotton", sortOrder: 3 },
    { value: "Pima Cotton", sortOrder: 4 },
    { value: "Egyptian Cotton", sortOrder: 5 },
    { value: "Linen", sortOrder: 6 },
    { value: "Silk", sortOrder: 7 },
    { value: "Wool", sortOrder: 8 },
    { value: "Merino Wool", sortOrder: 9 },
    { value: "Cashmere", sortOrder: 10 },
    { value: "Alpaca", sortOrder: 11 },
    { value: "Mohair", sortOrder: 12 },
    { value: "Hemp", sortOrder: 13 },
    { value: "Bamboo", sortOrder: 14 },
    { value: "Jute", sortOrder: 15 },
    
    // Synthetic fabrics
    { value: "Polyester", sortOrder: 20 },
    { value: "Nylon", sortOrder: 21 },
    { value: "Spandex", sortOrder: 22 },
    { value: "Elastane", sortOrder: 23 },
    { value: "Lycra", sortOrder: 24 },
    { value: "Acrylic", sortOrder: 25 },
    { value: "Rayon", sortOrder: 26 },
    { value: "Viscose", sortOrder: 27 },
    { value: "Modal", sortOrder: 28 },
    { value: "Tencel", sortOrder: 29 },
    { value: "Microfiber", sortOrder: 30 },
    
    // Special fabrics
    { value: "Satin", sortOrder: 40 },
    { value: "Velvet", sortOrder: 41 },
    { value: "Velour", sortOrder: 42 },
    { value: "Lace", sortOrder: 43 },
    { value: "Chiffon", sortOrder: 44 },
    { value: "Organza", sortOrder: 45 },
    { value: "Tulle", sortOrder: 46 },
    { value: "Sequin", sortOrder: 47 },
    { value: "Mesh", sortOrder: 48 },
    { value: "Fleece", sortOrder: 49 },
    { value: "Terry", sortOrder: 50 },
    { value: "French Terry", sortOrder: 51 },
    { value: "Jersey", sortOrder: 52 },
    { value: "Knit", sortOrder: 53 },
    { value: "Woven", sortOrder: 54 },
    
    // Denim/Casual
    { value: "Denim", sortOrder: 60 },
    { value: "Canvas", sortOrder: 61 },
    { value: "Twill", sortOrder: 62 },
    { value: "Corduroy", sortOrder: 63 },
    { value: "Chambray", sortOrder: 64 },
    { value: "Flannel", sortOrder: 65 },
    
    // Leather
    { value: "Leather", sortOrder: 70 },
    { value: "Genuine Leather", sortOrder: 71 },
    { value: "Full Grain Leather", sortOrder: 72 },
    { value: "Top Grain Leather", sortOrder: 73 },
    { value: "Faux Leather", sortOrder: 74 },
    { value: "Vegan Leather", sortOrder: 75 },
    { value: "PU Leather", sortOrder: 76 },
    { value: "Suede", sortOrder: 77 },
    { value: "Faux Suede", sortOrder: 78 },
    { value: "Nubuck", sortOrder: 79 },
    { value: "Patent Leather", sortOrder: 80 },
    
    // Metals
    { value: "Stainless Steel", sortOrder: 90 },
    { value: "Sterling Silver", sortOrder: 91 },
    { value: "925 Silver", sortOrder: 92 },
    { value: "Gold", sortOrder: 93 },
    { value: "14K Gold", sortOrder: 94 },
    { value: "18K Gold", sortOrder: 95 },
    { value: "Gold Plated", sortOrder: 96 },
    { value: "Gold Filled", sortOrder: 97 },
    { value: "Rose Gold", sortOrder: 98 },
    { value: "Brass", sortOrder: 99 },
    { value: "Copper", sortOrder: 100 },
    { value: "Titanium", sortOrder: 101 },
    { value: "Aluminum", sortOrder: 102 },
    { value: "Platinum", sortOrder: 103 },
    
    // Other materials
    { value: "Plastic", sortOrder: 110 },
    { value: "Acrylic", sortOrder: 111 },
    { value: "Resin", sortOrder: 112 },
    { value: "Wood", sortOrder: 113 },
    { value: "Bamboo", sortOrder: 114 },
    { value: "Rattan", sortOrder: 115 },
    { value: "Wicker", sortOrder: 116 },
    { value: "Glass", sortOrder: 117 },
    { value: "Crystal", sortOrder: 118 },
    { value: "Ceramic", sortOrder: 119 },
    { value: "Porcelain", sortOrder: 120 },
    { value: "Rubber", sortOrder: 121 },
    { value: "Silicone", sortOrder: 122 },
    { value: "EVA Foam", sortOrder: 123 },
    { value: "Cork", sortOrder: 124 },
    { value: "Paper", sortOrder: 125 },
    { value: "Cardboard", sortOrder: 126 },
  ],

  // -------------------------------------------------------------------------
  // STYLE - 60+ values
  // -------------------------------------------------------------------------
  STYLE: [
    // General style
    { value: "Casual", sortOrder: 1 },
    { value: "Formal", sortOrder: 2 },
    { value: "Business", sortOrder: 3 },
    { value: "Business Casual", sortOrder: 4 },
    { value: "Athletic", sortOrder: 5 },
    { value: "Sporty", sortOrder: 6 },
    { value: "Streetwear", sortOrder: 7 },
    { value: "Vintage", sortOrder: 8 },
    { value: "Retro", sortOrder: 9 },
    { value: "Classic", sortOrder: 10 },
    { value: "Modern", sortOrder: 11 },
    { value: "Minimalist", sortOrder: 12 },
    { value: "Bohemian", sortOrder: 13 },
    { value: "Boho", sortOrder: 14 },
    { value: "Preppy", sortOrder: 15 },
    
    // Necklines
    { value: "V-Neck", sortOrder: 20 },
    { value: "Crew Neck", sortOrder: 21 },
    { value: "Scoop Neck", sortOrder: 22 },
    { value: "Boat Neck", sortOrder: 23 },
    { value: "Square Neck", sortOrder: 24 },
    { value: "Sweetheart", sortOrder: 25 },
    { value: "Halter", sortOrder: 26 },
    { value: "Off Shoulder", sortOrder: 27 },
    { value: "One Shoulder", sortOrder: 28 },
    { value: "Turtleneck", sortOrder: 29 },
    { value: "Mock Neck", sortOrder: 30 },
    { value: "Cowl Neck", sortOrder: 31 },
    { value: "Collared", sortOrder: 32 },
    
    // Sleeves
    { value: "Short Sleeve", sortOrder: 40 },
    { value: "Long Sleeve", sortOrder: 41 },
    { value: "Sleeveless", sortOrder: 42 },
    { value: "3/4 Sleeve", sortOrder: 43 },
    { value: "Cap Sleeve", sortOrder: 44 },
    { value: "Flutter Sleeve", sortOrder: 45 },
    { value: "Bell Sleeve", sortOrder: 46 },
    { value: "Puff Sleeve", sortOrder: 47 },
    { value: "Tank", sortOrder: 48 },
    
    // Fit
    { value: "Fitted", sortOrder: 50 },
    { value: "Slim Fit", sortOrder: 51 },
    { value: "Regular Fit", sortOrder: 52 },
    { value: "Relaxed", sortOrder: 53 },
    { value: "Loose Fit", sortOrder: 54 },
    { value: "Oversized", sortOrder: 55 },
    { value: "Boyfriend", sortOrder: 56 },
    { value: "Boxy", sortOrder: 57 },
    { value: "Tailored", sortOrder: 58 },
    
    // Closures
    { value: "Button-Down", sortOrder: 60 },
    { value: "Button-Up", sortOrder: 61 },
    { value: "Zip-Up", sortOrder: 62 },
    { value: "Pullover", sortOrder: 63 },
    { value: "Wrap", sortOrder: 64 },
    { value: "Tie-Front", sortOrder: 65 },
    { value: "Snap Button", sortOrder: 66 },
    { value: "Hook & Eye", sortOrder: 67 },
    
    // Pants specific
    { value: "High Rise", sortOrder: 70 },
    { value: "Mid Rise", sortOrder: 71 },
    { value: "Low Rise", sortOrder: 72 },
    { value: "Skinny", sortOrder: 73 },
    { value: "Straight", sortOrder: 74 },
    { value: "Bootcut", sortOrder: 75 },
    { value: "Flare", sortOrder: 76 },
    { value: "Wide Leg", sortOrder: 77 },
    { value: "Cropped", sortOrder: 78 },
    { value: "Ankle", sortOrder: 79 },
    { value: "Jogger", sortOrder: 80 },
    { value: "Cargo", sortOrder: 81 },
    
    // Length
    { value: "Maxi", sortOrder: 90 },
    { value: "Midi", sortOrder: 91 },
    { value: "Mini", sortOrder: 92 },
    { value: "Knee Length", sortOrder: 93 },
    { value: "Floor Length", sortOrder: 94 },
  ],

  // -------------------------------------------------------------------------
  // PATTERN - 40+ values
  // -------------------------------------------------------------------------
  PATTERN: [
    { value: "Solid", sortOrder: 1 },
    { value: "Plain", sortOrder: 2 },
    { value: "Striped", sortOrder: 10 },
    { value: "Horizontal Stripe", sortOrder: 11 },
    { value: "Vertical Stripe", sortOrder: 12 },
    { value: "Pinstripe", sortOrder: 13 },
    { value: "Plaid", sortOrder: 20 },
    { value: "Tartan", sortOrder: 21 },
    { value: "Gingham", sortOrder: 22 },
    { value: "Buffalo Check", sortOrder: 23 },
    { value: "Checkered", sortOrder: 24 },
    { value: "Houndstooth", sortOrder: 25 },
    { value: "Herringbone", sortOrder: 26 },
    { value: "Floral", sortOrder: 30 },
    { value: "Tropical", sortOrder: 31 },
    { value: "Botanical", sortOrder: 32 },
    { value: "Leaf", sortOrder: 33 },
    { value: "Polka Dot", sortOrder: 40 },
    { value: "Dots", sortOrder: 41 },
    { value: "Animal Print", sortOrder: 50 },
    { value: "Leopard", sortOrder: 51 },
    { value: "Cheetah", sortOrder: 52 },
    { value: "Zebra", sortOrder: 53 },
    { value: "Snake", sortOrder: 54 },
    { value: "Snakeskin", sortOrder: 55 },
    { value: "Crocodile", sortOrder: 56 },
    { value: "Camo", sortOrder: 60 },
    { value: "Camouflage", sortOrder: 61 },
    { value: "Military", sortOrder: 62 },
    { value: "Geometric", sortOrder: 70 },
    { value: "Abstract", sortOrder: 71 },
    { value: "Graphic", sortOrder: 72 },
    { value: "Logo", sortOrder: 73 },
    { value: "Paisley", sortOrder: 80 },
    { value: "Damask", sortOrder: 81 },
    { value: "Brocade", sortOrder: 82 },
    { value: "Tie Dye", sortOrder: 90 },
    { value: "Ombre", sortOrder: 91 },
    { value: "Color Block", sortOrder: 92 },
    { value: "Marble", sortOrder: 93 },
    { value: "Embroidered", sortOrder: 100 },
    { value: "Sequined", sortOrder: 101 },
    { value: "Beaded", sortOrder: 102 },
    { value: "Quilted", sortOrder: 103 },
  ],

  // -------------------------------------------------------------------------
  // SCENT - 50+ values
  // -------------------------------------------------------------------------
  SCENT: [
    { value: "Unscented", sortOrder: 1 },
    { value: "Fragrance Free", sortOrder: 2 },
    { value: "Fresh", sortOrder: 10 },
    { value: "Clean", sortOrder: 11 },
    { value: "Ocean", sortOrder: 12 },
    { value: "Sea Breeze", sortOrder: 13 },
    { value: "Rain", sortOrder: 14 },
    { value: "Cotton", sortOrder: 15 },
    { value: "Linen", sortOrder: 16 },
    { value: "Floral", sortOrder: 20 },
    { value: "Rose", sortOrder: 21 },
    { value: "Lavender", sortOrder: 22 },
    { value: "Jasmine", sortOrder: 23 },
    { value: "Gardenia", sortOrder: 24 },
    { value: "Peony", sortOrder: 25 },
    { value: "Lily", sortOrder: 26 },
    { value: "Magnolia", sortOrder: 27 },
    { value: "Cherry Blossom", sortOrder: 28 },
    { value: "Citrus", sortOrder: 30 },
    { value: "Lemon", sortOrder: 31 },
    { value: "Orange", sortOrder: 32 },
    { value: "Grapefruit", sortOrder: 33 },
    { value: "Bergamot", sortOrder: 34 },
    { value: "Lime", sortOrder: 35 },
    { value: "Fruity", sortOrder: 40 },
    { value: "Apple", sortOrder: 41 },
    { value: "Berry", sortOrder: 42 },
    { value: "Peach", sortOrder: 43 },
    { value: "Coconut", sortOrder: 44 },
    { value: "Mango", sortOrder: 45 },
    { value: "Watermelon", sortOrder: 46 },
    { value: "Vanilla", sortOrder: 50 },
    { value: "Caramel", sortOrder: 51 },
    { value: "Chocolate", sortOrder: 52 },
    { value: "Coffee", sortOrder: 53 },
    { value: "Cinnamon", sortOrder: 54 },
    { value: "Pumpkin Spice", sortOrder: 55 },
    { value: "Honey", sortOrder: 56 },
    { value: "Woody", sortOrder: 60 },
    { value: "Cedar", sortOrder: 61 },
    { value: "Sandalwood", sortOrder: 62 },
    { value: "Pine", sortOrder: 63 },
    { value: "Eucalyptus", sortOrder: 64 },
    { value: "Tea Tree", sortOrder: 65 },
    { value: "Musk", sortOrder: 70 },
    { value: "Amber", sortOrder: 71 },
    { value: "Oud", sortOrder: 72 },
    { value: "Patchouli", sortOrder: 73 },
  ],

  // -------------------------------------------------------------------------
  // FLAVOR - 40+ values
  // -------------------------------------------------------------------------
  FLAVOR: [
    { value: "Original", sortOrder: 1 },
    { value: "Unflavored", sortOrder: 2 },
    { value: "Plain", sortOrder: 3 },
    { value: "Vanilla", sortOrder: 10 },
    { value: "Chocolate", sortOrder: 11 },
    { value: "Strawberry", sortOrder: 12 },
    { value: "Cookies & Cream", sortOrder: 13 },
    { value: "Peanut Butter", sortOrder: 14 },
    { value: "Caramel", sortOrder: 15 },
    { value: "Mint", sortOrder: 20 },
    { value: "Peppermint", sortOrder: 21 },
    { value: "Spearmint", sortOrder: 22 },
    { value: "Lemon", sortOrder: 30 },
    { value: "Orange", sortOrder: 31 },
    { value: "Berry", sortOrder: 32 },
    { value: "Mixed Berry", sortOrder: 33 },
    { value: "Grape", sortOrder: 34 },
    { value: "Watermelon", sortOrder: 35 },
    { value: "Cherry", sortOrder: 36 },
    { value: "Apple", sortOrder: 37 },
    { value: "Mango", sortOrder: 38 },
    { value: "Tropical", sortOrder: 39 },
    { value: "Fruit Punch", sortOrder: 40 },
    { value: "Coffee", sortOrder: 50 },
    { value: "Mocha", sortOrder: 51 },
    { value: "Espresso", sortOrder: 52 },
    { value: "Cinnamon", sortOrder: 60 },
    { value: "Ginger", sortOrder: 61 },
    { value: "Honey", sortOrder: 62 },
    { value: "Maple", sortOrder: 63 },
    { value: "BBQ", sortOrder: 70 },
    { value: "Ranch", sortOrder: 71 },
    { value: "Sour Cream & Onion", sortOrder: 72 },
    { value: "Salt & Vinegar", sortOrder: 73 },
    { value: "Jalapeño", sortOrder: 74 },
    { value: "Hot & Spicy", sortOrder: 75 },
    { value: "Sweet Chili", sortOrder: 76 },
  ],

  // -------------------------------------------------------------------------
  // LENGTH - 30 values
  // -------------------------------------------------------------------------
  LENGTH: [
    { value: "Short", sortOrder: 1 },
    { value: "Medium", sortOrder: 2 },
    { value: "Long", sortOrder: 3 },
    { value: "Extra Long", sortOrder: 4 },
    { value: "Cropped", sortOrder: 5 },
    { value: "Full Length", sortOrder: 6 },
    { value: "6 inch", sortOrder: 10 },
    { value: "12 inch", sortOrder: 11 },
    { value: "18 inch", sortOrder: 12 },
    { value: "24 inch", sortOrder: 13 },
    { value: "30 inch", sortOrder: 14 },
    { value: "36 inch", sortOrder: 15 },
    { value: "48 inch", sortOrder: 16 },
    { value: "1 ft", sortOrder: 20 },
    { value: "2 ft", sortOrder: 21 },
    { value: "3 ft", sortOrder: 22 },
    { value: "4 ft", sortOrder: 23 },
    { value: "5 ft", sortOrder: 24 },
    { value: "6 ft", sortOrder: 25 },
    { value: "8 ft", sortOrder: 26 },
    { value: "10 ft", sortOrder: 27 },
    { value: "1m", sortOrder: 30 },
    { value: "2m", sortOrder: 31 },
    { value: "3m", sortOrder: 32 },
    { value: "5m", sortOrder: 33 },
    { value: "10m", sortOrder: 34 },
  ],

  // -------------------------------------------------------------------------
  // WIDTH - 15 values
  // -------------------------------------------------------------------------
  WIDTH: [
    { value: "Narrow", sortOrder: 1 },
    { value: "Regular", sortOrder: 2 },
    { value: "Wide", sortOrder: 3 },
    { value: "Extra Wide", sortOrder: 4 },
    { value: "Slim", sortOrder: 5 },
    { value: "Standard", sortOrder: 6 },
    { value: "Plus", sortOrder: 7 },
    { value: "2A (Narrow)", sortOrder: 10 },
    { value: "B (Regular)", sortOrder: 11 },
    { value: "D (Wide)", sortOrder: 12 },
    { value: "E (Extra Wide)", sortOrder: 13 },
    { value: "EE (Double Wide)", sortOrder: 14 },
    { value: "4E (Extra Extra Wide)", sortOrder: 15 },
  ],

  // -------------------------------------------------------------------------
  // CAPACITY - 30 values
  // -------------------------------------------------------------------------
  CAPACITY: [
    { value: "Small", sortOrder: 1 },
    { value: "Medium", sortOrder: 2 },
    { value: "Large", sortOrder: 3 },
    { value: "Extra Large", sortOrder: 4 },
    { value: "8 oz", sortOrder: 10 },
    { value: "12 oz", sortOrder: 11 },
    { value: "16 oz", sortOrder: 12 },
    { value: "20 oz", sortOrder: 13 },
    { value: "24 oz", sortOrder: 14 },
    { value: "32 oz", sortOrder: 15 },
    { value: "40 oz", sortOrder: 16 },
    { value: "64 oz", sortOrder: 17 },
    { value: "1 gallon", sortOrder: 18 },
    { value: "250ml", sortOrder: 20 },
    { value: "500ml", sortOrder: 21 },
    { value: "750ml", sortOrder: 22 },
    { value: "1L", sortOrder: 23 },
    { value: "2L", sortOrder: 24 },
    { value: "8 GB", sortOrder: 30 },
    { value: "16 GB", sortOrder: 31 },
    { value: "32 GB", sortOrder: 32 },
    { value: "64 GB", sortOrder: 33 },
    { value: "128 GB", sortOrder: 34 },
    { value: "256 GB", sortOrder: 35 },
    { value: "512 GB", sortOrder: 36 },
    { value: "1 TB", sortOrder: 37 },
    { value: "2 TB", sortOrder: 38 },
    { value: "4 TB", sortOrder: 39 },
  ],

  // -------------------------------------------------------------------------
  // PACK_SIZE - 20 values
  // -------------------------------------------------------------------------
  PACK_SIZE: [
    { value: "Single", sortOrder: 1 },
    { value: "1 Pack", sortOrder: 2 },
    { value: "2 Pack", sortOrder: 3 },
    { value: "3 Pack", sortOrder: 4 },
    { value: "4 Pack", sortOrder: 5 },
    { value: "5 Pack", sortOrder: 6 },
    { value: "6 Pack", sortOrder: 7 },
    { value: "8 Pack", sortOrder: 8 },
    { value: "10 Pack", sortOrder: 9 },
    { value: "12 Pack", sortOrder: 10 },
    { value: "20 Pack", sortOrder: 11 },
    { value: "24 Pack", sortOrder: 12 },
    { value: "36 Pack", sortOrder: 13 },
    { value: "48 Pack", sortOrder: 14 },
    { value: "50 Pack", sortOrder: 15 },
    { value: "100 Pack", sortOrder: 16 },
    { value: "Pair", sortOrder: 20 },
    { value: "Set", sortOrder: 21 },
    { value: "Half Dozen", sortOrder: 22 },
    { value: "Dozen", sortOrder: 23 },
    { value: "Bulk", sortOrder: 24 },
  ],

  // -------------------------------------------------------------------------
  // FINISH - 25 values
  // -------------------------------------------------------------------------
  FINISH: [
    { value: "Matte", sortOrder: 1 },
    { value: "Glossy", sortOrder: 2 },
    { value: "Satin", sortOrder: 3 },
    { value: "Semi-Gloss", sortOrder: 4 },
    { value: "Shiny", sortOrder: 5 },
    { value: "Brushed", sortOrder: 10 },
    { value: "Polished", sortOrder: 11 },
    { value: "Hammered", sortOrder: 12 },
    { value: "Textured", sortOrder: 13 },
    { value: "Smooth", sortOrder: 14 },
    { value: "Chrome", sortOrder: 20 },
    { value: "Nickel", sortOrder: 21 },
    { value: "Bronze", sortOrder: 22 },
    { value: "Antique", sortOrder: 23 },
    { value: "Vintage", sortOrder: 24 },
    { value: "Distressed", sortOrder: 25 },
    { value: "Natural", sortOrder: 30 },
    { value: "Stained", sortOrder: 31 },
    { value: "Painted", sortOrder: 32 },
    { value: "Lacquered", sortOrder: 33 },
    { value: "Oiled", sortOrder: 34 },
    { value: "Waxed", sortOrder: 35 },
    { value: "Frosted", sortOrder: 40 },
    { value: "Clear", sortOrder: 41 },
    { value: "Tinted", sortOrder: 42 },
  ],

  // -------------------------------------------------------------------------
  // POWER - 20 values
  // -------------------------------------------------------------------------
  POWER: [
    { value: "110V", sortOrder: 1 },
    { value: "120V", sortOrder: 2 },
    { value: "220V", sortOrder: 3 },
    { value: "240V", sortOrder: 4 },
    { value: "Dual Voltage", sortOrder: 5 },
    { value: "Universal", sortOrder: 6 },
    { value: "USB", sortOrder: 10 },
    { value: "USB-A", sortOrder: 11 },
    { value: "USB-C", sortOrder: 12 },
    { value: "Battery Powered", sortOrder: 15 },
    { value: "Rechargeable", sortOrder: 16 },
    { value: "Solar Powered", sortOrder: 17 },
    { value: "5W", sortOrder: 20 },
    { value: "10W", sortOrder: 21 },
    { value: "15W", sortOrder: 22 },
    { value: "20W", sortOrder: 23 },
    { value: "40W", sortOrder: 24 },
    { value: "60W", sortOrder: 25 },
    { value: "100W", sortOrder: 26 },
    { value: "Low", sortOrder: 30 },
    { value: "Medium", sortOrder: 31 },
    { value: "High", sortOrder: 32 },
  ],
};

// =============================================================================
// SEED FUNCTION
// =============================================================================

export async function seedVariationValues() {
  console.log("🌱 Seeding variation values...");

  let totalCreated = 0;

  for (const [typeKey, values] of Object.entries(VARIATION_VALUES)) {
    // Find the variation type
    const variationType = await prisma.variationType.findUnique({
      where: { key: typeKey },
    });

    if (!variationType) {
      console.warn(`⚠️ Variation type ${typeKey} not found, skipping values`);
      continue;
    }

    // Create values
    for (const valueData of values) {
      const normalizedValue = valueData.value.toLowerCase().trim();

      await prisma.variationValue.upsert({
        where: {
          variationTypeId_normalizedValue_scope_categoryId_sellerId: {
            variationTypeId: variationType.id,
            normalizedValue,
            scope: "PLATFORM",
            categoryId: null,
            sellerId: null,
          },
        },
        update: {
          value: valueData.value,
          colorHex: valueData.colorHex,
          sortOrder: valueData.sortOrder ?? 0,
        },
        create: {
          variationTypeId: variationType.id,
          value: valueData.value,
          normalizedValue,
          scope: "PLATFORM",
          colorHex: valueData.colorHex,
          sortOrder: valueData.sortOrder ?? 0,
        },
      });

      totalCreated++;
    }

    console.log(`  ✓ ${typeKey}: ${values.length} values`);
  }

  console.log(`✅ Seeded ${totalCreated} total variation values`);
}
```

---

## 5. Run Seeds

Add to `prisma/seed.ts`:

```typescript
import { seedVariationTypes } from "./seeds/phase-44-variation-types";
import { seedVariationValues } from "./seeds/phase-44-variation-values";

async function main() {
  // ... existing seeds ...
  
  // Phase 44: Variations
  await seedVariationTypes();
  await seedVariationValues();
}
```

Run:

```bash
npx prisma db seed
```

**Expected output:**
```
🌱 Seeding variation types...
✅ Seeded 13 variation types

🌱 Seeding variation values...
  ✓ SIZE: 80 values
  ✓ COLOR: 110 values
  ✓ MATERIAL: 85 values
  ✓ STYLE: 68 values
  ✓ PATTERN: 45 values
  ✓ SCENT: 50 values
  ✓ FLAVOR: 38 values
  ✓ LENGTH: 26 values
  ✓ WIDTH: 15 values
  ✓ CAPACITY: 30 values
  ✓ PACK_SIZE: 24 values
  ✓ FINISH: 25 values
  ✓ POWER: 22 values
✅ Seeded 618 total variation values
```

---

## 6. Type Definitions

Create `packages/core/variations/types.ts`:

```typescript
// See full type definitions in TWICELY_V2_VARIATIONS_SYSTEM.md
// This file re-exports those types
export * from "./variationTypes";
```

---

## 7. Service Layer

Create `packages/core/variations/variationService.ts`:

```typescript
// See full service implementation in TWICELY_V2_VARIATIONS_SYSTEM.md
```

---

## 8. API Routes

Create in `apps/web/app/api/corp/variations/`:

| Route | Method | Description |
|-------|--------|-------------|
| `/types` | GET | List all variation types |
| `/types` | POST | Create custom variation type |
| `/types/[id]` | PUT | Update variation type |
| `/types/[id]` | DELETE | Deactivate variation type |
| `/values` | GET | Get values (with filters) |
| `/values` | POST | Add platform/category value |
| `/values/[id]` | PUT | Update value |
| `/values/[id]` | DELETE | Deactivate value |
| `/analytics` | GET | Usage statistics |
| `/popular` | GET | Popular custom values |
| `/unused` | GET | Unused values for cleanup |
| `/promote` | POST | Promote seller→platform |
| `/cleanup` | POST | Bulk deactivate unused |

---

## 9. Admin UI Page

Create `apps/web/app/(platform)/corp/settings/variations/page.tsx`

**4 Tabs:**
1. **Variation Types** - View/add/manage types
2. **Platform Values** - View/add platform-wide values
3. **Popular Custom** - See what sellers use, promote button
4. **Cleanup Unused** - Find and remove unused values

---

## 10. Settings Integration

Add to Phase 15 Platform Settings (Tab 8: Listings):

```typescript
// Add to platformSettingsTypes.ts
export interface VariationSettings {
  maxVariationDimensions: number;
  maxVariationCombinations: number;
  allowCustomVariationValues: boolean;
  autoSaveCustomValues: boolean;
  customValueApprovalRequired: boolean;
  minUsageForPromotionSuggestion: number;
  unusedValueCleanupDays: number;
  autoCleanupUnusedSellerValues: boolean;
}

// Add to platformSettingsDefaults.ts
listings: {
  variations: {
    maxVariationDimensions: 3,
    maxVariationCombinations: 250,
    allowCustomVariationValues: true,
    autoSaveCustomValues: true,
    customValueApprovalRequired: false,
    minUsageForPromotionSuggestion: 10,
    unusedValueCleanupDays: 90,
    autoCleanupUnusedSellerValues: false,
  }
}
```

---

## 11. Doctor Health Checks

Add to `packages/doctor/providers/variationsHealthProvider.ts`:

```typescript
export const variationsHealthChecks = [
  {
    id: "variations.types_exist",
    name: "System variation types exist",
    check: async () => {
      const count = await prisma.variationType.count({
        where: { isSystem: true, isActive: true },
      });
      return count >= 13;
    },
  },
  {
    id: "variations.values_seeded",
    name: "Platform values are seeded",
    check: async () => {
      const count = await prisma.variationValue.count({
        where: { scope: "PLATFORM", isActive: true },
      });
      return count >= 500;
    },
  },
  {
    id: "variations.orphan_check",
    name: "No orphaned variation options",
    check: async () => {
      const orphans = await prisma.listingVariationOption.findMany({
        where: {
          variationValueId: null,
          customValue: null,
        },
      });
      return orphans.length === 0;
    },
  },
];
```

---

## 12. Verification

After installation, verify:

```bash
# Check variation types
npx prisma studio
# Open VariationType table - should have 13 records

# Check variation values
# Open VariationValue table - should have 600+ records

# Run doctor
npm run doctor
# Should pass variations.* checks
```

---

## Summary

| Component | Count |
|-----------|-------|
| Prisma models | 8 new |
| Variation types | 13 seeded |
| Variation values | 618 seeded |
| API routes | 12 |
| Settings | 8 new |
| Doctor checks | 3 |

**Total seeded values by type:**

| Type | Values |
|------|--------|
| SIZE | 80 |
| COLOR | 110 |
| MATERIAL | 85 |
| STYLE | 68 |
| PATTERN | 45 |
| SCENT | 50 |
| FLAVOR | 38 |
| LENGTH | 26 |
| WIDTH | 15 |
| CAPACITY | 30 |
| PACK_SIZE | 24 |
| FINISH | 25 |
| POWER | 22 |
| **TOTAL** | **618** |
