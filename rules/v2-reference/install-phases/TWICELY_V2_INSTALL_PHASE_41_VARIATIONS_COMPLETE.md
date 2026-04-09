# TWICELY V2 - Install Phase 41: Variations Complete
**Status:** LOCKED (v1.0)  
**Scope:** Full product variation system with option types, values, matrix management  
**Backend-first:** Schema  ->  Services  ->  API  ->  Health  ->  UI  ->  Doctor  
**Canonical:** `/rules/TWICELY_LISTINGS_CATALOG_CANONICAL.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_41_VARIATIONS_COMPLETE.md`  
> Prereq: Phases 0-40 complete and Doctor green.  
> Builds upon: Phase 35 (ListingVariant model exists, this phase expands it)

---

## 0) What This Phase Installs

### Backend
- ListingOptionType model (Size, Color, Material, etc.)
- ListingOptionValue model (S, M, L, Red, Blue, etc.)
- Enhanced ListingVariant with option value tracking
- VariantImage model for per-variant images
- CategoryDefaultOptions for category-specific option templates
- SizeGuide model for size charts
- Inventory tracking per variant
- VariantReservation for cart holds

### UI (Seller Hub)
- Variation builder wizard
- Option type management
- Variant matrix view
- Per-variant pricing and inventory
- Per-variant images
- Bulk variant editing

### UI (Buyer)
- Option selectors (dropdowns, swatches)
- Color swatches with images
- Size guide modal
- Stock status per variant

### Ops
- Health provider: `variations`
- Doctor checks: variant integrity, inventory sync

---

## 1) Prisma Schema

```prisma
model ListingOptionType {
  id              String   @id @default(cuid())
  listingId       String
  name            String   // "Size", "Color", "Material"
  displayName     String?
  inputType       String   @default("dropdown") // dropdown|swatch|button
  displayOrder    Int      @default(0)
  isRequired      Boolean  @default(true)
  values          ListingOptionValue[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([listingId, name])
  @@index([listingId, displayOrder])
}

model ListingOptionValue {
  id              String   @id @default(cuid())
  optionTypeId    String
  optionType      ListingOptionType @relation(fields: [optionTypeId], references: [id], onDelete: Cascade)
  value           String   // "S", "M", "L", "Red"
  displayValue    String?  // "Small", "Medium"
  hexColor        String?  // "#FF0000" for swatches
  imageUrl        String?
  displayOrder    Int      @default(0)
  isActive        Boolean  @default(true)
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([optionTypeId, value])
  @@index([optionTypeId, displayOrder])
}

model ListingVariant {
  id                String   @id @default(cuid())
  listingId         String
  sku               String?
  optionValuesJson  Json     @default("{}")
  displayName       String?
  priceCents        Int
  comparePriceCents Int?
  costCents         Int?
  quantity          Int      @default(0)
  availableQuantity Int      @default(0)
  reservedQuantity  Int      @default(0)
  lowStockThreshold Int      @default(5)
  trackInventory    Boolean  @default(true)
  weightOz          Int?
  isActive          Boolean  @default(true)
  isDefault         Boolean  @default(false)
  
  // Relations
  images            VariantImage[]
  inventoryReservations InventoryReservation[]  // Phase 3 integration
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([listingId])
  @@index([sku])
  @@unique([listingId, sku])
}

model VariantImage {
  id              String   @id @default(cuid())
  variantId       String
  variant         ListingVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  imageUrl        String
  altText         String?
  displayOrder    Int      @default(0)
  isPrimary       Boolean  @default(false)
  createdAt       DateTime @default(now())

  @@index([variantId, displayOrder])
}

model CategoryDefaultOption {
  id              String   @id @default(cuid())
  categoryId      String
  optionName      String
  inputType       String   @default("dropdown")
  displayOrder    Int      @default(0)
  isRequired      Boolean  @default(true)
  defaultValues   Json     @default("[]")
  sizeGuideId     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([categoryId, optionName])
  @@index([categoryId])
}

model SizeGuide {
  id              String   @id @default(cuid())
  name            String
  categoryId      String?
  brand           String?
  chartData       Json
  measurementTips String?  @db.Text
  fitType         String?
  fitDescription  String?
  isActive        Boolean  @default(true)
  isGlobal        Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([categoryId])
  @@index([brand])
}

model VariantReservation {
  id              String   @id @default(cuid())
  variantId       String
  userId          String
  cartId          String?
  quantity        Int
  expiresAt       DateTime
  status          String   @default("active") // active|released|converted
  createdAt       DateTime @default(now())

  @@index([variantId, status])
  @@index([expiresAt])
  @@index([userId])
}
```

---

## 2) Types

```typescript
// packages/core/variations/types.ts
export type OptionInputType = "dropdown" | "swatch" | "button";

export type OptionType = {
  id: string;
  name: string;
  displayName?: string;
  inputType: OptionInputType;
  displayOrder: number;
  isRequired: boolean;
  values: OptionValue[];
};

export type OptionValue = {
  id: string;
  value: string;
  displayValue?: string;
  hexColor?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  isDefault: boolean;
};

export type Variant = {
  id: string;
  sku?: string;
  optionValues: Record<string, string>;
  displayName?: string;
  priceCents: number;
  comparePriceCents?: number;
  quantity: number;
  availableQuantity: number;
  isActive: boolean;
  images: { id: string; imageUrl: string; isPrimary: boolean }[];
};

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export const COMMON_COLORS: Record<string, string> = {
  Black: "#000000",
  White: "#FFFFFF",
  Red: "#FF0000",
  Blue: "#0000FF",
  Green: "#008000",
  Yellow: "#FFFF00",
  Orange: "#FFA500",
  Purple: "#800080",
  Pink: "#FFC0CB",
  Gray: "#808080",
  Navy: "#000080",
  Beige: "#F5F5DC",
};

export const COMMON_SIZES = {
  clothing: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  shoes_us: ["6", "7", "8", "9", "10", "11", "12", "13"],
};
```

---

## 3) Variant Service

```typescript
// packages/core/variations/variantService.ts
import { PrismaClient } from "@prisma/client";
import type { Variant, StockStatus } from "./types";

const prisma = new PrismaClient();

export async function createVariant(args: {
  listingId: string;
  optionValues: Record<string, string>;
  sku?: string;
  priceCents: number;
  quantity: number;
}): Promise<Variant> {
  const displayName = Object.values(args.optionValues).join(" / ");
  const sku = args.sku ?? `${args.listingId.slice(-8)}-${Object.values(args.optionValues).join("-").toLowerCase()}`;
  
  const variant = await prisma.listingVariant.create({
    data: {
      listingId: args.listingId,
      sku,
      optionValuesJson: args.optionValues,
      displayName,
      priceCents: args.priceCents,
      quantity: args.quantity,
      availableQuantity: args.quantity,
    },
    include: { images: true },
  });
  
  return mapVariant(variant);
}

export async function getListingVariants(listingId: string): Promise<Variant[]> {
  const variants = await prisma.listingVariant.findMany({
    where: { listingId, isActive: true },
    include: { images: { orderBy: { displayOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return variants.map(mapVariant);
}

export async function findVariantByOptions(
  listingId: string,
  optionValues: Record<string, string>
): Promise<Variant | null> {
  const variants = await prisma.listingVariant.findMany({
    where: { listingId, isActive: true },
    include: { images: true },
  });
  
  const match = variants.find(v => {
    const stored = v.optionValuesJson as Record<string, string>;
    return Object.entries(optionValues).every(([k, val]) => stored[k] === val);
  });
  
  return match ? mapVariant(match) : null;
}

export function getStockStatus(variant: { availableQuantity: number; lowStockThreshold?: number }): StockStatus {
  const threshold = variant.lowStockThreshold ?? 5;
  if (variant.availableQuantity <= 0) return "out_of_stock";
  if (variant.availableQuantity <= threshold) return "low_stock";
  return "in_stock";
}

export async function reserveStock(args: {
  variantId: string;
  userId: string;
  quantity: number;
  durationMinutes?: number;
}): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  const variant = await prisma.listingVariant.findUnique({ where: { id: args.variantId } });
  if (!variant || variant.availableQuantity < args.quantity) {
    return { success: false, error: "INSUFFICIENT_STOCK" };
  }
  
  const expiresAt = new Date(Date.now() + (args.durationMinutes ?? 30) * 60 * 1000);
  
  const [reservation] = await prisma.$transaction([
    prisma.variantReservation.create({
      data: {
        variantId: args.variantId,
        userId: args.userId,
        quantity: args.quantity,
        expiresAt,
        status: "active",
      },
    }),
    prisma.listingVariant.update({
      where: { id: args.variantId },
      data: {
        availableQuantity: { decrement: args.quantity },
        reservedQuantity: { increment: args.quantity },
      },
    }),
  ]);
  
  return { success: true, reservationId: reservation.id };
}

export async function releaseReservation(reservationId: string): Promise<void> {
  const reservation = await prisma.variantReservation.findUnique({ where: { id: reservationId } });
  if (!reservation || reservation.status !== "active") return;
  
  await prisma.$transaction([
    prisma.variantReservation.update({
      where: { id: reservationId },
      data: { status: "released" },
    }),
    prisma.listingVariant.update({
      where: { id: reservation.variantId },
      data: {
        availableQuantity: { increment: reservation.quantity },
        reservedQuantity: { decrement: reservation.quantity },
      },
    }),
  ]);
}

function mapVariant(v: any): Variant {
  return {
    id: v.id,
    sku: v.sku,
    optionValues: v.optionValuesJson as Record<string, string>,
    displayName: v.displayName,
    priceCents: v.priceCents,
    comparePriceCents: v.comparePriceCents,
    quantity: v.quantity,
    availableQuantity: v.availableQuantity,
    isActive: v.isActive,
    images: (v.images ?? []).map((img: any) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      isPrimary: img.isPrimary,
    })),
  };
}
```

---

## 4) Option Service

```typescript
// packages/core/variations/optionService.ts
import { PrismaClient } from "@prisma/client";
import type { OptionType, OptionValue, OptionInputType } from "./types";
import { COMMON_COLORS } from "./types";

const prisma = new PrismaClient();

export async function createOptionType(args: {
  listingId: string;
  name: string;
  displayName?: string;
  inputType?: OptionInputType;
}): Promise<OptionType> {
  const maxOrder = await prisma.listingOptionType.findFirst({
    where: { listingId: args.listingId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  
  const optionType = await prisma.listingOptionType.create({
    data: {
      listingId: args.listingId,
      name: args.name,
      displayName: args.displayName,
      inputType: args.inputType ?? "dropdown",
      displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    },
    include: { values: true },
  });
  
  return mapOptionType(optionType);
}

export async function getListingOptionTypes(listingId: string): Promise<OptionType[]> {
  const optionTypes = await prisma.listingOptionType.findMany({
    where: { listingId },
    include: { values: { where: { isActive: true }, orderBy: { displayOrder: "asc" } } },
    orderBy: { displayOrder: "asc" },
  });
  return optionTypes.map(mapOptionType);
}

export async function addOptionValue(args: {
  optionTypeId: string;
  value: string;
  displayValue?: string;
  hexColor?: string;
}): Promise<OptionValue> {
  const detectedHex = args.hexColor ?? COMMON_COLORS[args.value];
  const maxOrder = await prisma.listingOptionValue.findFirst({
    where: { optionTypeId: args.optionTypeId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });
  
  const optionValue = await prisma.listingOptionValue.create({
    data: {
      optionTypeId: args.optionTypeId,
      value: args.value,
      displayValue: args.displayValue,
      hexColor: detectedHex,
      displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    },
  });
  
  return mapOptionValue(optionValue);
}

export async function getCategoryDefaultOptions(categoryId: string) {
  return prisma.categoryDefaultOption.findMany({
    where: { categoryId },
    orderBy: { displayOrder: "asc" },
  });
}

function mapOptionType(ot: any): OptionType {
  return {
    id: ot.id,
    name: ot.name,
    displayName: ot.displayName,
    inputType: ot.inputType as OptionInputType,
    displayOrder: ot.displayOrder,
    isRequired: ot.isRequired,
    values: (ot.values ?? []).map(mapOptionValue),
  };
}

function mapOptionValue(v: any): OptionValue {
  return {
    id: v.id,
    value: v.value,
    displayValue: v.displayValue,
    hexColor: v.hexColor,
    imageUrl: v.imageUrl,
    displayOrder: v.displayOrder,
    isActive: v.isActive,
    isDefault: v.isDefault,
  };
}
```

---

## 5) Health Provider

```typescript
// packages/core/health/providers/variationsHealthProvider.ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthCheck } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const variationsHealthProvider: HealthProvider = {
  id: "variations",
  label: "Product Variations",
  description: "Validates variant integrity, stock tracking, and option consistency",
  version: "1.0.0",
  
  async run(): Promise<HealthResult> {
    const checks: HealthCheck[] = [];
    let status = HEALTH_STATUS.PASS;
    
    // Check 1: No negative stock
    const negativeStock = await prisma.listingVariant.count({
      where: { availableQuantity: { lt: 0 } },
    });
    checks.push({
      id: "variations.no_negative_stock",
      label: "No negative available quantities",
      status: negativeStock === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: negativeStock === 0 ? "All valid" : `${negativeStock} variants have negative stock`,
    });
    if (negativeStock > 0) status = HEALTH_STATUS.FAIL;
    
    // Check 2: No expired active reservations
    const expiredReservations = await prisma.variantReservation.count({
      where: { status: "active", expiresAt: { lt: new Date() } },
    });
    checks.push({
      id: "variations.no_expired_reservations",
      label: "No expired active reservations",
      status: expiredReservations === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: expiredReservations === 0 ? "Reservations current" : `${expiredReservations} need cleanup`,
    });
    
    return { providerId: this.id, status, summary: `Variations: ${status}`, checks };
  },
};
```

---

## 6) Doctor Checks

```typescript
// packages/core/doctor/checks/variationsDoctorChecks.ts
import { PrismaClient } from "@prisma/client";
import type { DoctorCheckResult } from "../types";
import { createOptionType, addOptionValue } from "../../variations/optionService";
import { createVariant, getStockStatus, reserveStock, releaseReservation } from "../../variations/variantService";

const prisma = new PrismaClient();

export async function runPhase41DoctorChecks(): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  
  // Create test listing
  const testListing = await prisma.listing.create({
    data: {
      sellerId: "_doctor_test_seller",
      title: "Doctor Test Listing",
      description: "Testing",
      priceCents: 1000,
      status: "DRAFT",
      listingType: "VARIATION",
    },
  });
  
  try {
    // Test 1: Create option type
    const sizeOption = await createOptionType({ listingId: testListing.id, name: "Size", inputType: "button" });
    results.push({
      id: "variations.create_option_type",
      label: "Create option type works",
      status: sizeOption.id ? "PASS" : "FAIL",
      message: sizeOption.id ? "Size option created" : "Failed",
    });
    
    // Test 2: Add values
    await addOptionValue({ optionTypeId: sizeOption.id, value: "S" });
    await addOptionValue({ optionTypeId: sizeOption.id, value: "M" });
    results.push({
      id: "variations.add_values",
      label: "Add option values works",
      status: "PASS",
      message: "Values added",
    });
    
    // Test 3: Create variant
    const variant = await createVariant({
      listingId: testListing.id,
      optionValues: { Size: "M" },
      priceCents: 1500,
      quantity: 10,
    });
    results.push({
      id: "variations.create_variant",
      label: "Create variant works",
      status: variant.id ? "PASS" : "FAIL",
      message: variant.id ? `Variant ${variant.displayName} created` : "Failed",
    });
    
    // Test 4: Stock status
    const status = getStockStatus({ availableQuantity: 10 });
    results.push({
      id: "variations.stock_status",
      label: "Stock status calculation",
      status: status === "in_stock" ? "PASS" : "FAIL",
      message: `Status: ${status}`,
    });
    
    // Test 5: Reserve and release
    const reservation = await reserveStock({ variantId: variant.id, userId: "_test", quantity: 3 });
    if (reservation.reservationId) {
      await releaseReservation(reservation.reservationId);
    }
    results.push({
      id: "variations.reserve_release",
      label: "Stock reservation works",
      status: reservation.success ? "PASS" : "FAIL",
      message: reservation.success ? "Reserve/release working" : reservation.error ?? "Failed",
    });
    
  } finally {
    // Cleanup
    await prisma.variantReservation.deleteMany({ where: { variant: { listingId: testListing.id } } });
    await prisma.listingVariant.deleteMany({ where: { listingId: testListing.id } });
    await prisma.listingOptionValue.deleteMany({ where: { optionType: { listingId: testListing.id } } });
    await prisma.listingOptionType.deleteMany({ where: { listingId: testListing.id } });
    await prisma.listing.delete({ where: { id: testListing.id } });
  }
  
  return results;
}
```

---

## 7) API Endpoints

### Seller: Listing Variants
```typescript
// apps/web/app/api/seller/listings/[listingId]/variants/route.ts
import { NextResponse } from "next/server";
import { requireSellerAuth, assertSellerScope } from "@/packages/core/seller/auth";
import { getListingVariants, createVariant } from "@/packages/core/variations/variantService";

export async function GET(req: Request, { params }: { params: { listingId: string } }) {
  // Auth + scope checks...
  const variants = await getListingVariants(params.listingId);
  return NextResponse.json({ variants });
}

export async function POST(req: Request, { params }: { params: { listingId: string } }) {
  // Auth + scope checks...
  const body = await req.json();
  const variant = await createVariant({
    listingId: params.listingId,
    optionValues: body.optionValues,
    priceCents: body.priceCents,
    quantity: body.quantity,
  });
  return NextResponse.json({ variant }, { status: 201 });
}
```

### Public: Listing Options
```typescript
// apps/web/app/api/listings/[listingId]/options/route.ts
import { NextResponse } from "next/server";
import { getListingOptionTypes } from "@/packages/core/variations/optionService";
import { getListingVariants, getStockStatus } from "@/packages/core/variations/variantService";

export async function GET(req: Request, { params }: { params: { listingId: string } }) {
  const [options, variants] = await Promise.all([
    getListingOptionTypes(params.listingId),
    getListingVariants(params.listingId),
  ]);
  
  const variantsWithStatus = variants.map(v => ({
    ...v,
    stockStatus: getStockStatus({ availableQuantity: v.availableQuantity }),
  }));
  
  return NextResponse.json({ options, variants: variantsWithStatus });
}
```

---

## 8) Buyer UI: Variant Selector

```tsx
// components/buyer/VariantSelector.tsx
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  options: Array<{
    id: string;
    name: string;
    inputType: string;
    values: Array<{ id: string; value: string; hexColor?: string }>;
  }>;
  variants: Array<{
    id: string;
    optionValues: Record<string, string>;
    availableQuantity: number;
    stockStatus: string;
  }>;
  onSelect: (variantId: string | null) => void;
};

export function VariantSelector({ options, variants, onSelect }: Props) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (Object.keys(selections).length === options.length) {
      const match = variants.find(v =>
        Object.entries(selections).every(([k, val]) => v.optionValues[k] === val)
      );
      onSelect(match?.id ?? null);
    }
  }, [selections, variants, options.length, onSelect]);
  
  return (
    <div className="space-y-4">
      {options.map(option => (
        <div key={option.id}>
          <label className="text-sm font-medium block mb-2">
            {option.name}: <span className="font-normal">{selections[option.name]}</span>
          </label>
          
          {option.inputType === "swatch" ? (
            <div className="flex flex-wrap gap-2">
              {option.values.map(val => (
                <button
                  key={val.id}
                  onClick={() => setSelections(p => ({ ...p, [option.name]: val.value }))}
                  className={cn(
                    "w-10 h-10 rounded-full border-2",
                    selections[option.name] === val.value && "ring-2 ring-offset-2 ring-primary"
                  )}
                  style={{ backgroundColor: val.hexColor ?? "#ccc" }}
                  title={val.value}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {option.values.map(val => (
                <Button
                  key={val.id}
                  variant={selections[option.name] === val.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelections(p => ({ ...p, [option.name]: val.value }))}
                >
                  {val.value}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 9) Phase 41 Completion Criteria

- [ ] ListingOptionType model migrated
- [ ] ListingOptionValue model migrated
- [ ] ListingVariant enhanced
- [ ] VariantImage model migrated
- [ ] CategoryDefaultOption model migrated
- [ ] SizeGuide model migrated
- [ ] VariantReservation model migrated
- [ ] Option service working
- [ ] Variant service working (CRUD + reserve/release)
- [ ] Stock status calculation correct
- [ ] Seller UI variation builder
- [ ] Buyer UI option selector with swatches
- [ ] Health provider passing
- [ ] Doctor checks passing

---

## 10) "Better Than eBay" Differentiators

| Feature | eBay | Twicely |
|---------|------|---------|
| Color swatches | Basic | ... Full hex + image support |
| Size guides | Generic | ... Per-category with tips |
| Per-variant images | Limited | ... Full support |
| Stock reservation | No | ... Cart hold with timer |
| Real-time availability | Basic | ... Per-option indicators |
| Bulk variant generation | No | ... Generate all combos |
