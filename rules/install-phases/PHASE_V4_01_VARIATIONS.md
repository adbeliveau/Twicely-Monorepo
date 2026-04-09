# PHASE V4.01 -- Product Variations System

**Canonical:** `rules/canonicals/03_VARIATIONS_CATALOG.md` sections 4, 5, 6, 8, 9, 10
**Prerequisites:** V3 complete (listing, category, categoryAttributeSchema tables exist)
**Estimated:** 6-8 hours
**Scope:** Schema + seed + service layer + seller UI + buyer UI + search integration + CASL

---

## Step 1: Schema File

Create `packages/db/src/schema/variations.ts`.

### 1.1 Enums

```ts
// packages/db/src/schema/enums.ts -- ADD these two enums
export const variationValueScopeEnum = pgEnum('variation_value_scope', [
  'PLATFORM', 'CATEGORY', 'SELLER',
]);

export const variantReservationStatusEnum = pgEnum('variant_reservation_status', [
  'ACTIVE', 'RELEASED', 'CONVERTED',
]);
```

### 1.2 Tables (exact Drizzle definitions)

File: `packages/db/src/schema/variations.ts`

Tables to define (see canonical 03 section 4 for exact column definitions):

| Table | Canonical Ref | Columns (key) |
|---|---|---|
| `variationType` | 4.1 | id, key, label, description, icon, isSystem, isActive, sortOrder, totalListings |
| `variationValue` | 4.2 | id, variationTypeId, value, normalizedValue, scope, categoryId, sellerId, colorHex, imageUrl, usageCount, lastUsedAt, isActive, promotedAt, promotedBy, sortOrder |
| `categoryVariationType` | 4.3 | id, categoryId, variationTypeId, isRequired, isPrimary, sortOrder |
| `listingVariation` | 4.4 | id, listingId, variationTypeId, sortOrder |
| `listingVariationOption` | 4.5 | id, listingVariationId, variationValueId, customValue, displayValue, sortOrder |
| `listingChild` | 4.6 | id, parentListingId, variationCombination, sku, priceCents, compareAtPriceCents, costCents, quantity, availableQuantity, reservedQuantity, lowStockThreshold, weightOz, barcode, isActive, isDefault |
| `listingChildImage` | 4.7 | id, listingChildId, url, altText, sortOrder, isPrimary |
| `variantReservation` | 4.8 | id, listingChildId, userId, cartId, quantity, expiresAt, status |
| `sizeGuide` | 4.9 | id, name, categoryId, brand, chartDataJson, measurementTips, fitType, fitDescription, isActive, isGlobal |

### 1.3 Listing Column Addition

Add to `packages/db/src/schema/listings.ts`:

```ts
hasVariations: boolean('has_variations').notNull().default(false),
```

### 1.4 Exports

Update `packages/db/src/schema/index.ts` to export all new tables:

```ts
export * from './variations';
```

### 1.5 Migration

```bash
cd packages/db && npx drizzle-kit generate --name variations_v4_01
```

---

## Step 2: Seed Data

File: `packages/db/src/seed/variation-types.ts`

### 2.1 System Variation Types (13)

```ts
const SYSTEM_TYPES = [
  { key: 'SIZE',      label: 'Size',             icon: 'Ruler',          sortOrder: 1 },
  { key: 'COLOR',     label: 'Color',            icon: 'Palette',        sortOrder: 2 },
  { key: 'MATERIAL',  label: 'Material',         icon: 'Layers',         sortOrder: 3 },
  { key: 'STYLE',     label: 'Style',            icon: 'Shirt',          sortOrder: 4 },
  { key: 'PATTERN',   label: 'Pattern',          icon: 'Grid3X3',        sortOrder: 5 },
  { key: 'SCENT',     label: 'Scent/Fragrance',  icon: 'Wind',           sortOrder: 6 },
  { key: 'FLAVOR',    label: 'Flavor',           icon: 'Coffee',         sortOrder: 7 },
  { key: 'LENGTH',    label: 'Length',            icon: 'MoveHorizontal', sortOrder: 8 },
  { key: 'WIDTH',     label: 'Width',             icon: 'MoveVertical',   sortOrder: 9 },
  { key: 'CAPACITY',  label: 'Capacity/Volume',  icon: 'Box',            sortOrder: 10 },
  { key: 'PACK_SIZE', label: 'Pack Size',         icon: 'Package',        sortOrder: 11 },
  { key: 'FINISH',    label: 'Finish',            icon: 'Sparkles',       sortOrder: 12 },
  { key: 'POWER',     label: 'Power/Voltage',     icon: 'Zap',            sortOrder: 13 },
] as const;
```

Seed function: upsert by `key`, set `isSystem: true`, `isActive: true`.

### 2.2 Platform Variation Values (core set)

Seed PLATFORM-scope values for SIZE, COLOR, MATERIAL at minimum:

- **SIZE:** XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL, One Size, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14
- **COLOR:** Black, White, Red, Blue, Green, Yellow, Orange, Purple, Pink, Gray, Navy, Beige, Brown, Cream, Gold, Silver, Burgundy, Teal, Coral, Olive (include `colorHex` for each)
- **MATERIAL:** Cotton, Polyester, Leather, Silk, Wool, Denim, Linen, Nylon, Suede, Velvet, Satin, Canvas, Cashmere

### 2.3 Platform Settings

Seed all keys from canonical section 9 into `platform_settings`.

---

## Step 3: CASL Subjects

### 3.1 Add Subjects

File: `packages/casl/src/subjects.ts` -- add:

```ts
'VariationType',
'VariationValue',
'ListingChild',
'SizeGuide',
```

### 3.2 Abilities

File: `packages/casl/src/platform-abilities.ts` -- add rules per canonical section 8.

File: `packages/casl/src/buyer-abilities.ts` -- add `read` for `ListingChild`, `VariationType`, `VariationValue`, `SizeGuide`.

---

## Step 4: Service Layer

### 4.1 Variation Type Actions

File: `packages/commerce/src/variations/variation-type-actions.ts`

Functions (see canonical 6.1):

```ts
export async function createVariationType(input: {
  key: string; label: string; description?: string; icon?: string;
}): Promise<typeof variationType.$inferSelect>

export async function updateVariationType(id: string, input: {
  label?: string; description?: string; icon?: string; isActive?: boolean;
}): Promise<typeof variationType.$inferSelect>

export async function deactivateVariationType(id: string): Promise<void>

export async function getVariationTypes(opts?: {
  activeOnly?: boolean;
}): Promise<(typeof variationType.$inferSelect)[]>
```

### 4.2 Variation Value Actions

File: `packages/commerce/src/variations/variation-value-actions.ts`

Functions (see canonical 6.2):

```ts
export async function createVariationValue(input: {
  variationTypeId: string;
  value: string;
  scope: 'PLATFORM' | 'CATEGORY' | 'SELLER';
  categoryId?: string;
  sellerId?: string;
  colorHex?: string;
}): Promise<typeof variationValue.$inferSelect>

export async function getVariationValues(args: {
  variationTypeId: string;
  categoryId?: string;
  sellerId?: string;
}): Promise<{
  platform: (typeof variationValue.$inferSelect)[];
  category: (typeof variationValue.$inferSelect)[];
  seller: (typeof variationValue.$inferSelect)[];
}>

export async function promoteValueToPlatform(
  valueId: string, staffUserId: string
): Promise<void>

export async function deactivateValue(valueId: string): Promise<void>

export async function bulkCleanupUnusedValues(args?: {
  dryRun?: boolean;
}): Promise<{ removed: number }>
```

Normalization helper:

```ts
export function normalizeValue(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}
```

### 4.3 Listing Child Actions

File: `packages/commerce/src/variations/listing-child-actions.ts`

Functions (see canonical 6.4):

```ts
export async function createListingChild(input: {
  parentListingId: string;
  variationCombination: Record<string, string>;
  sku?: string;
  priceCents: number;
  quantity: number;
  compareAtPriceCents?: number;
  costCents?: number;
  weightOz?: number;
  barcode?: string;
  isDefault?: boolean;
}): Promise<typeof listingChild.$inferSelect>

export async function updateListingChild(id: string, input: {
  priceCents?: number;
  quantity?: number;
  compareAtPriceCents?: number;
  costCents?: number;
  isActive?: boolean;
  isDefault?: boolean;
}): Promise<typeof listingChild.$inferSelect>

export async function deleteListingChild(id: string): Promise<void>

export async function getListingChildren(
  listingId: string
): Promise<(typeof listingChild.$inferSelect)[]>

export async function bulkCreateChildren(
  listingId: string,
  children: Parameters<typeof createListingChild>[0][]
): Promise<(typeof listingChild.$inferSelect)[]>
```

SKU auto-generation:

```ts
function generateSku(listingId: string, combo: Record<string, string>): string {
  const suffix = Object.values(combo).join('-').toLowerCase().replace(/\s+/g, '').slice(0, 20);
  return `${listingId.slice(-8)}-${suffix}`;
}
```

### 4.4 Reservation Actions

File: `packages/commerce/src/variations/reservation-actions.ts`

Functions (see canonical 6.5):

```ts
export async function reserveStock(args: {
  listingChildId: string;
  userId: string;
  quantity: number;
}): Promise<{ success: boolean; reservationId?: string; error?: string }>

export async function releaseReservation(reservationId: string): Promise<void>

export async function convertReservation(reservationId: string): Promise<void>
```

`reserveStock` must use a transaction:
1. SELECT listingChild FOR UPDATE
2. Check `availableQuantity >= args.quantity`
3. INSERT variantReservation (status=ACTIVE, expiresAt = now + setting minutes)
4. UPDATE listingChild SET availableQuantity -= quantity, reservedQuantity += quantity

### 4.5 Listing Variation Actions

File: `packages/commerce/src/variations/listing-variation-actions.ts`

Functions (see canonical 6.3):

```ts
export async function setListingVariations(listingId: string, input: {
  dimensions: Array<{
    variationTypeId: string;
    values: Array<{ variationValueId?: string; customValue?: string; displayValue: string }>;
  }>;
}): Promise<void>

export async function getListingVariationMatrix(listingId: string): Promise<{
  dimensions: Array<{
    variationTypeId: string;
    typeName: string;
    values: Array<{ id: string; displayValue: string; variationValueId?: string }>;
  }>;
  children: (typeof listingChild.$inferSelect)[];
}>

export async function applyCategoryDefaults(
  listingId: string, categoryId: string
): Promise<void>
```

---

## Step 5: Typesense Schema Update

File: `packages/search/src/typesense-schema.ts`

Add fields (see canonical 10.1):

```ts
{ name: 'hasVariations', type: 'bool', facet: true, index: true },
{ name: 'availableSizes', type: 'string[]', facet: true, index: true, optional: true },
{ name: 'availableColors', type: 'string[]', facet: true, index: true, optional: true },
{ name: 'availableMaterials', type: 'string[]', facet: true, index: true, optional: true },
{ name: 'minPriceCents', type: 'int32', index: true, optional: true },
{ name: 'maxPriceCents', type: 'int32', index: true, optional: true },
{ name: 'totalVariantQuantity', type: 'int32', index: true, optional: true },
{ name: 'hasInStockVariants', type: 'bool', facet: true, index: true, optional: true },
```

Update `packages/search/src/typesense-index.ts`: indexing function must query `listingChild` + `listingVariation` + `listingVariationOption` to populate the new fields when `hasVariations = true`.

Update facet_by in `packages/search/src/listings.ts`:

```ts
facet_by: 'condition,categoryId,brand,freeShipping,fulfillmentType,sellerPerformanceBand,hasVariations,availableSizes,availableColors,availableMaterials,hasInStockVariants',
```

---

## Step 6: BullMQ Jobs

### 6.1 Expired Reservation Cleanup

File: `packages/jobs/src/workers/release-expired-reservations.ts`

Cron: every 5 minutes (`*/5 * * * *`)

```ts
export async function releaseExpiredReservations(): Promise<{ released: number }>
// SELECT variantReservation WHERE status='ACTIVE' AND expiresAt < NOW()
// For each: call releaseReservation(id)
```

### 6.2 Variation Value Cleanup

File: `packages/jobs/src/workers/cleanup-variation-values.ts`

Cron: daily at 04:00 UTC

```ts
export async function cleanupUnusedVariationValues(): Promise<{ deactivated: number }>
// SELECT variationValue WHERE scope='SELLER' AND usageCount <= 1
//   AND lastUsedAt < NOW() - unusedValueCleanupDays
//   AND NOT EXISTS (active listing using this value)
// For each: SET isActive = false
```

---

## Step 7: Tests

### 7.1 Unit Tests

| File | Tests |
|---|---|
| `packages/commerce/src/variations/__tests__/variation-type-actions.test.ts` | CRUD, deactivation rules, system type protection |
| `packages/commerce/src/variations/__tests__/variation-value-actions.test.ts` | Create, normalize, promote, cleanup |
| `packages/commerce/src/variations/__tests__/listing-child-actions.test.ts` | Create, update, delete, bulk create, SKU generation |
| `packages/commerce/src/variations/__tests__/reservation-actions.test.ts` | Reserve, release, convert, insufficient stock |
| `packages/commerce/src/variations/__tests__/listing-variation-actions.test.ts` | Set variations, get matrix, category defaults |

### 7.2 Test Assertions (minimum)

- System types cannot be deleted
- Custom types cannot be deleted if `totalListings > 0`
- Duplicate `normalizedValue` within same type+scope+category+seller is rejected
- Max dimensions per listing enforced (read from platform_settings mock)
- Max SKU combinations enforced
- Reservation decrements `availableQuantity`, not `quantity`
- Expired reservation release restores `availableQuantity`
- Converted reservation decrements `quantity`
- SKU auto-generation produces unique strings

---

## Step 8: Files Created Summary

| # | File Path | Purpose |
|---|---|---|
| 1 | `packages/db/src/schema/variations.ts` | All variation tables |
| 2 | `packages/db/src/schema/enums.ts` (modify) | Add 2 enums |
| 3 | `packages/db/src/schema/listings.ts` (modify) | Add `hasVariations` column |
| 4 | `packages/db/src/schema/index.ts` (modify) | Export variations |
| 5 | `packages/db/src/seed/variation-types.ts` | Seed 13 types + values |
| 6 | `packages/casl/src/subjects.ts` (modify) | Add 4 subjects |
| 7 | `packages/casl/src/platform-abilities.ts` (modify) | Admin rules |
| 8 | `packages/casl/src/buyer-abilities.ts` (modify) | Buyer read rules |
| 9 | `packages/commerce/src/variations/variation-type-actions.ts` | Type CRUD |
| 10 | `packages/commerce/src/variations/variation-value-actions.ts` | Value CRUD + promote |
| 11 | `packages/commerce/src/variations/listing-child-actions.ts` | Child CRUD |
| 12 | `packages/commerce/src/variations/reservation-actions.ts` | Stock reservation |
| 13 | `packages/commerce/src/variations/listing-variation-actions.ts` | Variation matrix |
| 14 | `packages/search/src/typesense-schema.ts` (modify) | Add variation fields |
| 15 | `packages/search/src/typesense-index.ts` (modify) | Index variation data |
| 16 | `packages/search/src/listings.ts` (modify) | Add facets |
| 17 | `packages/jobs/src/workers/release-expired-reservations.ts` | Cron job |
| 18 | `packages/jobs/src/workers/cleanup-variation-values.ts` | Cron job |
| 19-23 | `packages/commerce/src/variations/__tests__/*.test.ts` | 5 test files |

---

## Completion Criteria

- [ ] All 9 tables created and migration generated
- [ ] 13 system variation types seeded
- [ ] Platform values seeded for SIZE, COLOR, MATERIAL
- [ ] Platform settings seeded (all `catalog.variations.*` keys)
- [ ] CASL subjects and abilities added
- [ ] All 5 service files with full CRUD
- [ ] Reservation system with transactional stock management
- [ ] Typesense schema updated with variation fields
- [ ] Indexer populates variation fields for VARIATION-type listings
- [ ] Search facets include size/color/material filters
- [ ] Expired reservation cleanup cron running
- [ ] Unused value cleanup cron running
- [ ] All tests passing
- [ ] `npx turbo typecheck` -- 0 errors
- [ ] `npx turbo test` -- baseline maintained or increased
