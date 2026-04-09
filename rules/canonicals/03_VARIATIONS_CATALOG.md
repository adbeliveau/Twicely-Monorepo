# Canonical 03 -- Variations, Catalog Normalization & Category Taxonomy

**Status:** DRAFT (V4)
**Domain:** Catalog, Product Variations, Inventory, Category Taxonomy, Product Matching
**Depends on:** Canonical 01 (Listings Core), Canonical 02 (Search & Discovery)
**Package:** `packages/db` (schema), `packages/commerce` (actions), `packages/search` (indexing), `packages/jobs` (reservation cleanup)
**V2 lineage:** `TWICELY_PRODUCT_VARIATIONS_CANONICAL`, `TWICELY_LISTINGS_CATALOG_CANONICAL` sections 6-9, Install Phases 35/41/44
**V3 baseline:** `packages/db/src/schema/catalog.ts` (category + categoryAttributeSchema), `packages/db/src/schema/listings.ts` (listing.attributesJson), `packages/search/src/typesense-schema.ts`

> **Law:** This file is the single source of truth for product variations, catalog attributes, category taxonomy, product matching/deduplication, size guides, and stock reservations. If V2 canonicals conflict, this file wins.
> **Platform Settings Authority:** All thresholds and limits live in `platform_settings`. Hardcoded values are fallbacks only.

---

## 1. Purpose

This canonical defines the complete product variation, catalog attribute, and category normalization system for Twicely V4. It governs:

- How categories define required/optional attributes (item specifics)
- How sellers create multi-dimensional product variations (size, color, material)
- How variants track independent inventory and pricing
- How stock reservations prevent overselling during cart holds
- How catalog data feeds Typesense search facets and filters
- How duplicate/similar products are detected and matched via canonical product records
- How AI assists sellers with option suggestions from images and descriptions
- How size guides and color swatches enhance the buyer experience

**If behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Category-driven attributes**: Required fields and item specifics are defined per category in `categoryAttributeSchema`, not ad-hoc.
2. **Three-tier variation value scope**: PLATFORM (admin-managed, global) > CATEGORY (category-specific) > SELLER (user-created, private).
3. **Every purchasable combination is an explicit variant row**: Variants are explicit `listingChild` rows, never computed at runtime.
4. **Inventory is per-variant**: Each `listingChild` has independent `quantity`. Parent listing quantity is the sum.
5. **Reservation prevents overselling**: Cart holds temporarily decrement `availableQuantity` via `variantReservation`.
6. **Options affect display, not identity**: All variants share the parent listing's identity (ID, reviews, URL, SEO).
7. **Search indexes variant data**: Typesense flattens variant attributes into the parent document for filtering.
8. **Integer cents for all money**: `priceCents`, `compareAtPriceCents`, `costCents` -- never floats.
9. **All limits from platform_settings**: Max dimensions, max SKUs, cleanup thresholds -- all configurable.
10. **AI-assisted, never AI-mandatory**: AI suggests options/categories; sellers always have final control.

---

## 3. Schema -- Existing V3 Tables (Preserved)

These tables already exist in V3 and are NOT modified:

### 3.1 `category` (packages/db/src/schema/catalog.ts)

```ts
// Already exists -- id, slug, parentId, name, description, icon, feeBucket,
// sortOrder, isActive, isLeaf, depth, path, metaTitle, metaDescription,
// createdAt, updatedAt
```

### 3.2 `categoryAttributeSchema` (packages/db/src/schema/catalog.ts)

```ts
// Already exists -- id, categoryId, name, label, fieldType, isRequired,
// isRecommended, showInFilters, showInListing, optionsJson, validationJson,
// sortOrder, createdAt, updatedAt
```

### 3.3 `listing.attributesJson` (packages/db/src/schema/listings.ts)

```ts
// Already exists -- JSONB column storing key-value attribute pairs
// per the category's attribute schema
```

---

## 4. Schema -- New V4 Tables

All new tables go in `packages/db/src/schema/variations.ts`.

### 4.1 `variationType` -- Variation Dimensions

```ts
export const variationType = pgTable('variation_type', {
  id:           text('id').primaryKey().$defaultFn(() => createId()),
  key:          text('key').notNull().unique(),              // SIZE, COLOR, MATERIAL, CUSTOM_xxx
  label:        text('label').notNull(),                     // "Size", "Color"
  description:  text('description'),
  icon:         text('icon'),                                // Lucide icon name
  inputType:    text('input_type').notNull().default('dropdown'), // dropdown | swatch | button
  isSystem:     boolean('is_system').notNull().default(false),
  isActive:     boolean('is_active').notNull().default(true),
  sortOrder:    integer('sort_order').notNull().default(0),
  totalListings: integer('total_listings').notNull().default(0),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  activeSortIdx: index('vt_active_sort').on(table.isActive, table.sortOrder),
}));
```

**Rules:**
- 13 system types are permanent (`isSystem: true`): SIZE, COLOR, MATERIAL, STYLE, PATTERN, SCENT, FLAVOR, LENGTH, WIDTH, CAPACITY, PACK_SIZE, FINISH, POWER
- Custom types may be added by admins (`isSystem: false`)
- System types cannot be deleted, only deactivated
- Custom types cannot be deleted if referenced by active listings
- `inputType` auto-detection: "COLOR" defaults to "swatch", "SIZE" defaults to "button", all others default to "dropdown"

### 4.2 `variationValue` -- Value Library

```ts
export const variationValueScopeEnum = pgEnum('variation_value_scope', [
  'PLATFORM', 'CATEGORY', 'SELLER'
]);

export const variationValue = pgTable('variation_value', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  variationTypeId:  text('variation_type_id').notNull()
                      .references(() => variationType.id, { onDelete: 'cascade' }),
  value:            text('value').notNull(),                 // Display: "Extra Large"
  normalizedValue:  text('normalized_value').notNull(),      // Dedup: "extra large"
  scope:            variationValueScopeEnum('scope').notNull().default('PLATFORM'),
  categoryId:       text('category_id')
                      .references(() => category.id, { onDelete: 'set null' }),
  sellerId:         text('seller_id')
                      .references(() => user.id, { onDelete: 'cascade' }),
  colorHex:         text('color_hex'),                       // #FF0000 for COLOR type
  imageUrl:         text('image_url'),                       // Swatch image
  usageCount:       integer('usage_count').notNull().default(0),
  lastUsedAt:       timestamp('last_used_at', { withTimezone: true }),
  isActive:         boolean('is_active').notNull().default(true),
  promotedAt:       timestamp('promoted_at', { withTimezone: true }),
  promotedBy:       text('promoted_by'),
  sortOrder:        integer('sort_order').notNull().default(0),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  typeScopeIdx:  index('vv_type_scope').on(table.variationTypeId, table.scope, table.isActive),
  typeUsageIdx:  index('vv_type_usage').on(table.variationTypeId, table.isActive, table.usageCount),
  sellerTypeIdx: index('vv_seller_type').on(table.sellerId, table.variationTypeId),
  normalizedIdx: index('vv_normalized').on(table.normalizedValue),
  dedupUniq:     unique('vv_dedup').on(
    table.variationTypeId, table.normalizedValue, table.scope, table.categoryId, table.sellerId
  ),
}));
```

**Normalization rule:** `normalizedValue = value.toLowerCase().trim().replace(/\s+/g, ' ')`

**Value resolution order** when displaying suggestions to a seller:
1. PLATFORM values (always first, sorted by usageCount desc)
2. CATEGORY values (for the listing's category + ancestors)
3. SELLER values (that seller's own custom values)

### 4.3 `categoryVariationType` -- Category-Type Mapping

```ts
export const categoryVariationType = pgTable('category_variation_type', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  categoryId:       text('category_id').notNull()
                      .references(() => category.id, { onDelete: 'cascade' }),
  variationTypeId:  text('variation_type_id').notNull()
                      .references(() => variationType.id, { onDelete: 'cascade' }),
  isRequired:       boolean('is_required').notNull().default(false),
  isPrimary:        boolean('is_primary').notNull().default(false),
  sortOrder:        integer('sort_order').notNull().default(0),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  catTypeUniq: unique('cvt_cat_type').on(table.categoryId, table.variationTypeId),
  catIdx:      index('cvt_cat').on(table.categoryId),
}));
```

**Inheritance:** Child categories inherit parent's recommended types. Child can override with own `categoryVariationType` rows.

### 4.4 `listingVariation` -- Variation Dimensions on a Listing

```ts
export const listingVariation = pgTable('listing_variation', {
  id:               text('id').primaryKey().$defaultFn(() => createId()),
  listingId:        text('listing_id').notNull()
                      .references(() => listing.id, { onDelete: 'cascade' }),
  variationTypeId:  text('variation_type_id').notNull()
                      .references(() => variationType.id),
  sortOrder:        integer('sort_order').notNull().default(0),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingTypeUniq: unique('lv_listing_type').on(table.listingId, table.variationTypeId),
  listingIdx:      index('lv_listing').on(table.listingId),
}));
```

**Rules:**
- Maximum variation dimensions per listing: `catalog.variations.maxDimensionsPerListing` (default: 3)
- Maximum 5 hard cap (never configurable above 5)
- Seller picks which variation types apply to their listing

### 4.5 `listingVariationOption` -- Values Selected for a Listing Variation

```ts
export const listingVariationOption = pgTable('listing_variation_option', {
  id:                   text('id').primaryKey().$defaultFn(() => createId()),
  listingVariationId:   text('listing_variation_id').notNull()
                          .references(() => listingVariation.id, { onDelete: 'cascade' }),
  variationValueId:     text('variation_value_id')
                          .references(() => variationValue.id, { onDelete: 'set null' }),
  customValue:          text('custom_value'),
  displayValue:         text('display_value').notNull(),
  sortOrder:            integer('sort_order').notNull().default(0),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  variationIdx: index('lvo_variation').on(table.listingVariationId),
  valueIdx:     index('lvo_value').on(table.variationValueId),
}));
```

### 4.6 `listingChild` -- Individual SKU / Variant

```ts
export const listingChild = pgTable('listing_child', {
  id:                 text('id').primaryKey().$defaultFn(() => createId()),
  parentListingId:    text('parent_listing_id').notNull()
                        .references(() => listing.id, { onDelete: 'cascade' }),
  variationCombination: jsonb('variation_combination').notNull(), // {"SIZE":"M","COLOR":"Red"}
  sku:                text('sku').notNull(),
  priceCents:         integer('price_cents').notNull(),
  compareAtPriceCents: integer('compare_at_price_cents'),
  costCents:          integer('cost_cents'),
  quantity:           integer('quantity').notNull().default(0),
  availableQuantity:  integer('available_quantity').notNull().default(0),
  reservedQuantity:   integer('reserved_quantity').notNull().default(0),
  lowStockThreshold:  integer('low_stock_threshold').notNull().default(5),
  weightOz:           integer('weight_oz'),
  barcode:            text('barcode'),
  isActive:           boolean('is_active').notNull().default(true),
  isDefault:          boolean('is_default').notNull().default(false),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  parentSkuUniq: unique('lc_parent_sku').on(table.parentListingId, table.sku),
  parentActiveIdx: index('lc_parent_active').on(table.parentListingId, table.isActive),
  skuIdx:        index('lc_sku').on(table.sku),
  barcodeIdx:    index('lc_barcode').on(table.barcode),
}));
```

**Invariants:**
- `availableQuantity = quantity - reservedQuantity` (always)
- `priceCents` must be > 0
- `sku` is auto-generated as `{parentListingId}-{dimensionValueAbbrevs}` if not provided by seller
- Only one child may be `isDefault: true` per parent
- Maximum total children per parent: `catalog.variations.maxSkuCombinations` (default: 250)

### 4.7 `listingChildImage` -- Per-Variant Images

```ts
export const listingChildImage = pgTable('listing_child_image', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  listingChildId:  text('listing_child_id').notNull()
                     .references(() => listingChild.id, { onDelete: 'cascade' }),
  url:             text('url').notNull(),
  altText:         text('alt_text'),
  sortOrder:       integer('sort_order').notNull().default(0),
  isPrimary:       boolean('is_primary').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childSortIdx: index('lci_child_sort').on(table.listingChildId, table.sortOrder),
}));
```

**Rules:**
- Maximum 5 images per variant
- If variant has no images, UI falls back to parent listing's primary image
- When buyer selects a color option, gallery switches to that variant's images

### 4.8 `variantReservation` -- Cart Stock Holds

```ts
export const variantReservationStatusEnum = pgEnum('variant_reservation_status', [
  'ACTIVE', 'RELEASED', 'CONVERTED'
]);

export const variantReservation = pgTable('variant_reservation', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  listingChildId: text('listing_child_id').notNull()
                    .references(() => listingChild.id, { onDelete: 'cascade' }),
  userId:        text('user_id').notNull()
                    .references(() => user.id, { onDelete: 'cascade' }),
  cartId:        text('cart_id'),
  quantity:      integer('quantity').notNull(),
  expiresAt:     timestamp('expires_at', { withTimezone: true }).notNull(),
  status:        variantReservationStatusEnum('status').notNull().default('ACTIVE'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childStatusIdx: index('vr_child_status').on(table.listingChildId, table.status),
  expiresIdx:     index('vr_expires').on(table.expiresAt),
  userIdx:        index('vr_user').on(table.userId),
}));
```

### 4.9 `sizeGuide` -- Size Charts

```ts
export const sizeGuide = pgTable('size_guide', {
  id:              text('id').primaryKey().$defaultFn(() => createId()),
  name:            text('name').notNull(),
  categoryId:      text('category_id')
                     .references(() => category.id, { onDelete: 'set null' }),
  brand:           text('brand'),
  chartDataJson:   jsonb('chart_data_json').notNull(),  // {headers:[], rows:[][], unit:"in"|"cm"}
  measurementTips: text('measurement_tips'),
  fitType:         text('fit_type'),    // true_to_size | runs_small | runs_large
  fitDescription:  text('fit_description'),
  isActive:        boolean('is_active').notNull().default(true),
  isGlobal:        boolean('is_global').notNull().default(false),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index('sg_category').on(table.categoryId),
  brandIdx:    index('sg_brand').on(table.brand),
}));
```

**Precedence:** Brand-specific > Category-specific > Global

### 4.10 `productCanonical` -- Catalog Normalization / Product Matching

```ts
export const productCanonical = pgTable('product_canonical', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  name:          text('name').notNull(),
  brand:         text('brand'),
  categoryId:    text('category_id')
                   .references(() => category.id, { onDelete: 'set null' }),
  upc:           text('upc'),
  ean:           text('ean'),
  isbn:          text('isbn'),
  mpn:           text('mpn'),
  attributesJson: jsonb('attributes_json').notNull().default(sql`'{}'`),
  imageUrl:      text('image_url'),
  isVerified:    boolean('is_verified').notNull().default(false),
  listingCount:  integer('listing_count').notNull().default(0),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  upcIdx:    index('pc_upc').on(table.upc),
  eanIdx:    index('pc_ean').on(table.ean),
  isbnIdx:   index('pc_isbn').on(table.isbn),
  brandIdx:  index('pc_brand').on(table.brand),
  catIdx:    index('pc_cat').on(table.categoryId),
}));
```

### 4.11 `brandRegistry` -- Verified Brands

```ts
export const brandRegistry = pgTable('brand_registry', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  name:          text('name').notNull().unique(),
  normalizedName: text('normalized_name').notNull().unique(),
  logoUrl:       text('logo_url'),
  isVerified:    boolean('is_verified').notNull().default(false),
  aliases:       text('aliases').array().notNull().default(sql`'{}'::text[]`),
  listingCount:  integer('listing_count').notNull().default(0),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  normalizedIdx: index('br_normalized').on(table.normalizedName),
}));
```

### 4.12 `listing` Column Addition

Add to `listing` table:

```ts
// New columns on existing listing table
hasVariations:      boolean('has_variations').notNull().default(false),
productCanonicalId: text('product_canonical_id'),  // FK to productCanonical.id
```

---

## 5. Business Rules

### 5.1 Variation Constraints

| Constraint | Default | Setting Key |
|---|---|---|
| Max variation dimensions per listing | 3 | `catalog.variations.maxDimensionsPerListing` |
| Max total SKU combinations | 250 | `catalog.variations.maxSkuCombinations` |
| Max values per dimension | 100 | Hard limit, not configurable |
| Custom value max length | 100 chars | Hard limit |
| Custom value min length | 1 char | Hard limit |

### 5.2 Seller Custom Values

| Rule | Setting Key |
|---|---|
| Allow custom variation values | `catalog.variations.allowCustomValues` (default: true) |
| Auto-save custom values to library | `catalog.variations.autoSaveCustomValues` (default: true) |
| Require admin approval for custom values | `catalog.variations.customValueApprovalRequired` (default: false) |
| Seller value cleanup threshold (days) | `catalog.variations.unusedValueCleanupDays` (default: 90) |

### 5.3 Promotion Criteria (SELLER -> PLATFORM)

Admin can promote popular seller values. Suggestion criteria:
- Used by 10+ different sellers (`catalog.variations.promotionMinSellers`, default: 10)
- Total usage count 50+ (`catalog.variations.promotionMinUsageCount`, default: 50)
- No policy violations flagged

### 5.4 Listing Type Rules

| Type | `hasVariations` | Quantity Tracking |
|---|---|---|
| SINGLE_ITEM | false | `listing.quantity = 1`, transitions to SOLD on purchase |
| MULTI_QUANTITY | false | `listing.quantity` decrements, transitions to ENDED at 0 |
| VARIATION | true | Per-child `quantity`, parent ENDED when ALL children at 0 |

### 5.5 Child Listing (Variant) Requirements

Each `listingChild` MUST have:
- `sku` (unique within parent, auto-generated if not provided)
- `priceCents` (integer cents, can differ from parent)
- `quantity` (>= 0)
- `variationCombination` (JSON with all required dimension values)

### 5.6 Stock Reservation Rules

1. Reservation decrements `availableQuantity`, not `quantity`
2. Default hold: 30 minutes (`catalog.variations.reservationMinutes`, default: 30)
3. Expired reservations auto-released by BullMQ cron every 5 minutes (`catalog.variations.reservationCleanupIntervalMs`, default: 300000)
4. Successful checkout converts reservation (decrements `quantity`)
5. Cart abandonment releases reservation (increments `availableQuantity`)
6. Maximum concurrent reservations per user: 10 (`catalog.variations.maxReservationsPerUser`, default: 10)

### 5.7 Category Attribute Validation

Required attributes (from `categoryAttributeSchema` where `isRequired = true`) block listing activation. Validation runs on:
- Listing publish (DRAFT -> PENDING_REVIEW or ACTIVE)
- Listing update while ACTIVE (re-validate changed attributes)

### 5.8 Duplicate Detection / Product Matching

`productCanonical` rows are matched by:
1. Exact UPC/EAN/ISBN match (highest confidence)
2. Brand + MPN match
3. Title similarity + same category (lowest confidence, staff review required)

Matched listings can share the same `productCanonical`, enabling price comparison and "X sellers have this item" display.

### 5.9 Brand Normalization

- All brand values are matched against `brandRegistry` during listing creation
- Fuzzy matching against `aliases` array (Levenshtein distance <= 2)
- Unmatched brands create a new unverified `brandRegistry` entry
- Admin can merge duplicate brands (updates all referencing listings)

---

## 6. AI Integration

### 6.1 Auto-Suggest Options from Images

When a seller uploads product images during listing creation:

```ts
// packages/commerce/src/variations/ai-suggest.ts
export async function suggestVariationsFromImages(args: {
  listingId: string;
  imageUrls: string[];
  categoryId: string;
}): Promise<VariationSuggestion[]>
```

**Flow:**
1. Vision model analyzes uploaded images
2. Detects visible variation attributes (colors seen, size labels, material textures)
3. Returns suggestions with confidence scores
4. Seller reviews and accepts/rejects each suggestion
5. Accepted suggestions auto-populate the variation builder

**Setting:** `catalog.ai.suggestVariationsEnabled` (default: true)

### 6.2 Auto-Suggest Category from Title/Description

```ts
export async function suggestCategory(args: {
  title: string;
  description?: string;
  brand?: string;
}): Promise<CategorySuggestion[]>
```

Returns top 3 category suggestions with confidence. Seller picks one.

**Setting:** `catalog.ai.suggestCategoryEnabled` (default: true)

### 6.3 Auto-Fill Attributes from Description

```ts
export async function extractAttributes(args: {
  title: string;
  description: string;
  categoryId: string;
}): Promise<Record<string, string>>
```

Parses listing text to pre-fill category attributes (brand, size, color, material). Seller reviews before save.

**Setting:** `catalog.ai.extractAttributesEnabled` (default: true)

### 6.4 AI Constraints

- All AI results are suggestions only -- never auto-committed without seller review
- AI calls are non-blocking -- listing creation works if AI service is unavailable
- Rate limit: 10 AI suggestion requests per minute per seller (`catalog.ai.rateLimitPerMinute`, default: 10)
- AI model provider/endpoint configurable via `catalog.ai.provider` and `catalog.ai.endpoint`

---

## 7. API / Server Actions

All actions live in `packages/commerce/src/variations/`. Use Next.js server actions, not REST endpoints.

### 7.1 Variation Type Management (Admin)

```ts
// packages/commerce/src/variations/variation-type-actions.ts
export async function createVariationType(input: CreateVariationTypeInput): Promise<VariationType>
export async function updateVariationType(id: string, input: UpdateVariationTypeInput): Promise<VariationType>
export async function deactivateVariationType(id: string): Promise<void>
export async function getVariationTypes(opts?: { activeOnly?: boolean }): Promise<VariationType[]>
```

### 7.2 Variation Value Management

```ts
// packages/commerce/src/variations/variation-value-actions.ts
export async function createVariationValue(input: CreateVariationValueInput): Promise<VariationValue>
export async function getVariationValues(args: {
  variationTypeId: string;
  categoryId?: string;
  sellerId?: string;
}): Promise<{ platform: VariationValue[]; category: VariationValue[]; seller: VariationValue[] }>
export async function promoteValueToPlatform(valueId: string, staffUserId: string): Promise<void>
export async function deactivateValue(valueId: string): Promise<void>
export async function bulkCleanupUnusedValues(args: { dryRun?: boolean }): Promise<{ removed: number }>
```

### 7.3 Listing Variation CRUD (Seller)

```ts
// packages/commerce/src/variations/listing-variation-actions.ts
export async function setListingVariations(listingId: string, input: SetVariationsInput): Promise<void>
export async function getListingVariationMatrix(listingId: string): Promise<VariationMatrix>
export async function applyCategoryDefaults(listingId: string, categoryId: string): Promise<void>
```

### 7.4 Listing Child (Variant) CRUD (Seller)

```ts
// packages/commerce/src/variations/listing-child-actions.ts
export async function createListingChild(input: CreateListingChildInput): Promise<ListingChild>
export async function updateListingChild(id: string, input: UpdateListingChildInput): Promise<ListingChild>
export async function deleteListingChild(id: string): Promise<void>
export async function getListingChildren(listingId: string): Promise<ListingChild[]>
export async function bulkCreateChildren(listingId: string, children: CreateListingChildInput[]): Promise<ListingChild[]>
```

### 7.5 Stock Reservation

```ts
// packages/commerce/src/variations/reservation-actions.ts
export async function reserveStock(args: {
  listingChildId: string;
  userId: string;
  quantity: number;
}): Promise<{ success: boolean; reservationId?: string; error?: string }>
export async function releaseReservation(reservationId: string): Promise<void>
export async function convertReservation(reservationId: string): Promise<void>
```

### 7.6 Catalog Normalization

```ts
// packages/commerce/src/catalog/product-matching.ts
export async function matchOrCreateCanonical(listing: Listing): Promise<ProductCanonical | null>
export async function searchCanonicals(args: { upc?: string; brand?: string; query?: string }): Promise<ProductCanonical[]>
export async function mergeDuplicateCanonicals(keepId: string, mergeId: string): Promise<void>
```

### 7.7 Category Attribute Actions

```ts
// packages/commerce/src/catalog/category-attribute-actions.ts
export async function getCategoryAttributes(categoryId: string): Promise<ResolvedAttribute[]>
export async function validateListingAttributes(listingId: string): Promise<ValidationResult>
export async function generateSearchFacets(categoryId: string): Promise<Facet[]>
```

### 7.8 Brand Registry Actions

```ts
// packages/commerce/src/catalog/brand-actions.ts
export async function findOrCreateBrand(name: string): Promise<BrandRegistry>
export async function mergeBrands(keepId: string, mergeId: string): Promise<void>
export async function verifyBrand(brandId: string, staffUserId: string): Promise<void>
export async function searchBrands(query: string): Promise<BrandRegistry[]>
```

### 7.9 Size Guide Actions

```ts
// packages/commerce/src/catalog/size-guide-actions.ts
export async function createSizeGuide(input: CreateSizeGuideInput): Promise<SizeGuide>
export async function updateSizeGuide(id: string, input: UpdateSizeGuideInput): Promise<SizeGuide>
export async function getSizeGuideForListing(args: {
  categoryId: string;
  brand?: string;
}): Promise<SizeGuide | null>
```

---

## 8. UI Pages

### 8.1 Seller Hub (`/my`)

| Route | Component | Purpose |
|---|---|---|
| `/my/selling/create` | Listing create form | Variation builder wizard (step 3) |
| `/my/selling/[id]/edit` | Listing edit form | Variation + child management |
| `/my/selling/[id]/variants` | Variant matrix | Bulk price/quantity editing |
| `/my/selling/[id]/inventory` | Inventory dashboard | Stock levels per variant |

### 8.2 Marketplace (buyer-facing)

| Route | Component | Purpose |
|---|---|---|
| `/i/[slug]` | Listing detail | Variant selector (dropdowns/swatches/buttons), size guide link |
| `/c/[slug]` | Category browse | Faceted filters from attributes |
| `/s` | Search results | Faceted filters, size/color/brand |

### 8.3 Admin Hub (`hub.twicely.co`)

| Route | Component | Purpose |
|---|---|---|
| `(hub)/cfg/catalog/categories` | Category tree editor | Manage categories + attributes |
| `(hub)/cfg/catalog/variations` | Variation type manager | View/add/deactivate types |
| `(hub)/cfg/catalog/variations/values` | Value library browser | Promote/cleanup values |
| `(hub)/cfg/catalog/products` | Product canonical browser | Review matches, merge dupes |
| `(hub)/cfg/catalog/size-guides` | Size guide manager | CRUD size charts |
| `(hub)/cfg/catalog/brands` | Brand registry manager | Verify/merge brands |

---

## 9. Search Integration (Typesense)

### 9.1 Typesense Schema Additions

Add to `packages/search/src/typesense-schema.ts`:

```ts
// New fields for variation support
{ name: 'hasVariations', type: 'bool', facet: true, index: true },
{ name: 'availableSizes', type: 'string[]', facet: true, index: true, optional: true },
{ name: 'availableColors', type: 'string[]', facet: true, index: true, optional: true },
{ name: 'availableMaterials', type: 'string[]', facet: true, index: true, optional: true },
{ name: 'minPriceCents', type: 'int32', index: true, optional: true },
{ name: 'maxPriceCents', type: 'int32', index: true, optional: true },
{ name: 'totalVariantQuantity', type: 'int32', index: true, optional: true },
{ name: 'hasInStockVariants', type: 'bool', facet: true, index: true, optional: true },
{ name: 'productCanonicalId', type: 'string', index: true, optional: true },
```

### 9.2 Indexing Logic

When a listing with variations is indexed:
1. Query all active `listingChild` rows for the parent listing
2. Flatten unique SIZE values into `availableSizes[]`
3. Flatten unique COLOR values into `availableColors[]`
4. Flatten unique MATERIAL values into `availableMaterials[]`
5. Compute `minPriceCents` and `maxPriceCents` from all active children
6. Sum all child `availableQuantity` into `totalVariantQuantity`
7. Set `hasInStockVariants = totalVariantQuantity > 0`

### 9.3 Facet Configuration

Add to facet_by in search: `hasVariations,availableSizes,availableColors,availableMaterials,hasInStockVariants`

### 9.4 Filter Behavior

- Size filter: matches listings where ANY variant has matching size
- Color filter: matches listings where ANY variant has matching color
- Price filter: matches against `minPriceCents` / `maxPriceCents` range
- In Stock filter: `hasInStockVariants: true`

---

## 10. BullMQ Jobs

### 10.1 Reservation Cleanup (packages/jobs)

```ts
// cron: every 5 minutes
// name: 'catalog:release-expired-reservations'
// pattern: read from platform_settings 'catalog.cron.reservationCleanup.pattern' (default: '*/5 * * * *')
// tz: 'UTC'
```

Finds all `variantReservation` rows where `status = 'ACTIVE'` and `expiresAt < now()`, releases them, and increments the corresponding `listingChild.availableQuantity`.

### 10.2 Unused Value Cleanup (packages/jobs)

```ts
// cron: daily at 03:00 UTC
// name: 'catalog:cleanup-unused-values'
// pattern: read from platform_settings 'catalog.cron.valueCleanup.pattern' (default: '0 3 * * *')
// tz: 'UTC'
```

Deletes SELLER-scope `variationValue` rows where `usageCount = 0` and `createdAt < now() - unusedValueCleanupDays`.

---

## 11. RBAC (CASL Abilities)

New CASL subjects to add to `packages/casl/src/subjects.ts`:

```ts
'VariationType',
'VariationValue',
'ListingChild',
'SizeGuide',
'ProductCanonical',
'BrandRegistry',
```

| Action | Subject | Who |
|---|---|---|
| `read` | `VariationType` | Any authenticated user |
| `create` | `VariationType` | `PlatformRole.ADMIN` |
| `update` | `VariationType` | `PlatformRole.ADMIN` |
| `delete` | `VariationType` | `PlatformRole.ADMIN` (only if !isSystem && totalListings === 0) |
| `read` | `VariationValue` | Any authenticated user |
| `create` | `VariationValue` (scope=PLATFORM) | `PlatformRole.ADMIN` |
| `create` | `VariationValue` (scope=SELLER) | Listing owner |
| `manage` | `VariationValue` (promote) | `PlatformRole.ADMIN` |
| `create` / `update` / `delete` | `ListingChild` | Listing owner or delegated |
| `read` | `ListingChild` | Any (public for ACTIVE listings) |
| `manage` | `SizeGuide` | `PlatformRole.ADMIN` |
| `read` | `SizeGuide` | Any authenticated user |
| `manage` | `ProductCanonical` | `PlatformRole.ADMIN` or `PlatformRole.MODERATION` |
| `read` | `ProductCanonical` | Any authenticated user |
| `manage` | `BrandRegistry` | `PlatformRole.ADMIN` |
| `read` | `BrandRegistry` | Any (public) |

---

## 12. Platform Settings Keys

```
catalog.variations.maxDimensionsPerListing       = 3
catalog.variations.maxSkuCombinations            = 250
catalog.variations.allowCustomValues             = true
catalog.variations.autoSaveCustomValues          = true
catalog.variations.customValueApprovalRequired   = false
catalog.variations.unusedValueCleanupDays        = 90
catalog.variations.reservationMinutes            = 30
catalog.variations.reservationCleanupIntervalMs  = 300000
catalog.variations.maxReservationsPerUser         = 10
catalog.variations.promotionMinSellers           = 10
catalog.variations.promotionMinUsageCount        = 50
catalog.variations.lowStockThreshold             = 5
catalog.attribute.validation.enabled             = true
catalog.normalization.duplicateDetection         = true
catalog.normalization.autoMatchUpc               = true
catalog.ai.suggestVariationsEnabled              = true
catalog.ai.suggestCategoryEnabled                = true
catalog.ai.extractAttributesEnabled              = true
catalog.ai.rateLimitPerMinute                    = 10
catalog.ai.provider                              = "openai"
catalog.ai.endpoint                              = ""
catalog.cron.reservationCleanup.pattern          = "*/5 * * * *"
catalog.cron.valueCleanup.pattern                = "0 3 * * *"
```

---

## 13. Observability

| Metric | Type | Description |
|---|---|---|
| `catalog.variations.created` | counter | Variation dimensions created |
| `catalog.children.created` | counter | Listing children (SKUs) created |
| `catalog.reservation.created` | counter | Stock reservations created |
| `catalog.reservation.expired` | counter | Reservations auto-released |
| `catalog.reservation.converted` | counter | Reservations converted to orders |
| `catalog.values.promoted` | counter | Values promoted SELLER -> PLATFORM |
| `catalog.values.cleaned` | counter | Unused values auto-cleaned |
| `catalog.canonical.matched` | counter | Listings matched to product canonical |
| `catalog.canonical.created` | counter | New product canonicals created |
| `catalog.attribute.validation.failed` | counter | Attribute validation failures |
| `catalog.brand.merged` | counter | Brand merge operations |
| `catalog.ai.suggestions.requested` | counter | AI suggestion requests |
| `catalog.ai.suggestions.accepted` | counter | AI suggestions accepted by seller |

### Audit Events

Must emit audit events for:
- Variation type created/updated/deactivated
- Variation value created/promoted/deactivated/cleaned
- Listing child created/updated/deleted
- Stock reserved/released/converted
- Inventory manually adjusted
- Low stock threshold crossed
- Product canonical created/merged
- Category attribute schema created/updated/deleted
- Brand created/verified/merged
- Size guide created/updated/deleted

---

## 14. Out of Scope

- Variant-level promotions (see Promotions canonical 13)
- Variant-level shipping rules (variants inherit parent shipping profile)
- Cross-variant bundles
- Made-to-order / custom options
- Variant-level SEO (all variants share parent URL)
- Auction-style pricing per variant
- International sizing conversion (deferred)
- Barcode scanning hardware integration

---

## 15. Final Rule

Product variations, catalog normalization, and category attributes must never:
- Allow purchase of unavailable combinations
- Oversell inventory (reservation system prevents this)
- Hide stock status from buyers
- Create variants without explicit seller action
- Allow float/dollar values for pricing (integer cents only)
- Hardcode any limits (all from `platform_settings`)
- Auto-commit AI suggestions without seller review

**If behavior is not defined here, it must be rejected or added to this canonical.**
