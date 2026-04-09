# TWICELY_PRODUCT_VARIATIONS_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Product options, variants, inventory per variant, size guides, color swatches, stock reservation.  
**Audience:** Product, engineering, seller tools, search, and AI agents.  
**Extends:** `TWICELY_LISTINGS_CATALOG_CANONICAL.md` (which defines VARIATION listing type)

---

## 1. Purpose

This canonical defines the **complete product variation system** for Twicely.

It ensures:
- sellers can create flexible product options (size, color, material, etc.)
- buyers can select options before purchase
- inventory is tracked per variant
- stock reservations prevent overselling
- variation data is searchable and filterable

**If behavior is not defined here, it must not exist.**

---

## 2. Core Principles

1. **Options are seller-defined, category-guided**  
   Sellers create options; categories provide templates and validation.

2. **Every purchasable combination is a variant**  
   Variants are explicit rows, not computed at runtime.

3. **Inventory is per-variant**  
   Each variant has its own quantity, not shared.

4. **Reservation prevents overselling**  
   Cart holds temporarily reserve stock.

5. **Options affect display, not identity**  
   All variants share the listing identity (ID, reviews, etc.).

6. **Search indexes variants**  
   Filters can match any variant's attributes.

---

## 3. Option Type System

### 3.1 Option Type Model

```ts
type ListingOptionType = {
  id: string;
  listingId: string;
  name: string;              // "Size", "Color", "Material"
  displayName?: string;      // User-friendly override
  inputType: OptionInputType;
  displayOrder: number;
  isRequired: boolean;
  values: ListingOptionValue[];
};

type OptionInputType = 
  | "dropdown"    // Standard select
  | "swatch"      // Color/pattern swatch
  | "button";     // Button group
```

**Rules:**
1. Option names are case-insensitive unique per listing
2. Maximum 5 option types per listing
3. `isRequired: true` means buyer must select before add-to-cart
4. Display order determines UI sequence

### 3.2 Option Value Model

```ts
type ListingOptionValue = {
  id: string;
  optionTypeId: string;
  value: string;             // "S", "M", "L", "Red"
  displayValue?: string;     // "Small", "Medium", "Large"
  hexColor?: string;         // "#FF0000" for swatches
  imageUrl?: string;         // Swatch image for patterns
  displayOrder: number;
  isActive: boolean;
  isDefault: boolean;
};
```

**Rules:**
1. Values are case-sensitive unique per option type
2. Maximum 50 values per option type
3. `hexColor` required for swatch input type if no imageUrl
4. Only one value may be `isDefault: true` per option type
5. Inactive values hidden from buyers, preserved for existing orders

### 3.3 Common Option Names

| Option | Input Type | Common Values |
|--------|------------|---------------|
| Size | button | XS, S, M, L, XL, XXL |
| Color | swatch | Black, White, Red, Blue, etc. |
| Material | dropdown | Cotton, Polyester, Leather |
| Style | dropdown | Regular, Slim, Relaxed |
| Length | button | Short, Regular, Long |

**Auto-Detection:**
- "Color" → inputType defaults to "swatch"
- "Size" → inputType defaults to "button"
- Other → inputType defaults to "dropdown"

---

## 4. Variant System

### 4.1 Variant Model

```ts
type ListingVariant = {
  id: string;
  listingId: string;
  sku?: string;
  optionValues: Record<string, string>;  // { "Size": "M", "Color": "Red" }
  displayName?: string;                   // "Medium / Red"
  
  // Pricing
  priceCents: number;
  comparePriceCents?: number;             // Strike-through price
  costCents?: number;                     // For profit calculations
  
  // Inventory
  quantity: number;
  availableQuantity: number;              // quantity - reserved
  reservedQuantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  
  // Dimensions (for shipping)
  weightOz?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  
  // Status
  isActive: boolean;
  isDefault: boolean;
  
  // Media
  images: VariantImage[];
};
```

**Rules:**
1. Each variant represents one purchasable option combination
2. `optionValues` must include all required option types
3. `availableQuantity = quantity - reservedQuantity`
4. `sku` is optional but unique across seller if provided
5. Only one variant may be `isDefault: true`
6. Default variant shown when no selection made

### 4.2 Variant Generation

Variants are NOT auto-generated. Seller creates each variant explicitly.

```ts
async function createVariant(args: {
  listingId: string;
  optionValues: Record<string, string>;
  priceCents: number;
  quantity: number;
}): Promise<Variant> {
  // 1. Validate all option values exist
  // 2. Check no duplicate combination exists
  // 3. Generate SKU if not provided
  // 4. Generate displayName from values
  // 5. Create variant record
}
```

**Validation Rules:**
1. All option types with `isRequired: true` must have a value
2. All values must exist in their option type
3. No two variants may have identical optionValues
4. Price must be > 0
5. Quantity must be >= 0

### 4.3 Variant Lookup

```ts
async function findVariantByOptions(
  listingId: string,
  selections: Record<string, string>
): Promise<Variant | null> {
  // Match exact optionValues combination
}
```

**Buyer Flow:**
1. Buyer selects options one by one
2. After each selection, UI shows available remaining options
3. When all required options selected, variant is resolved
4. If no matching variant → show "unavailable"

---

## 5. Inventory Management

### 5.1 Stock Status

```ts
type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

function getStockStatus(variant: Variant): StockStatus {
  if (variant.availableQuantity <= 0) return "out_of_stock";
  if (variant.availableQuantity <= variant.lowStockThreshold) return "low_stock";
  return "in_stock";
}
```

**Display Rules:**
- `in_stock` → no indicator
- `low_stock` → "Only X left!" badge
- `out_of_stock` → option disabled, grayed out

### 5.2 Stock Reservation

```ts
type VariantReservation = {
  id: string;
  variantId: string;
  userId: string;
  cartId?: string;
  quantity: number;
  expiresAt: Date;
  status: "active" | "released" | "converted";
};

async function reserveStock(args: {
  variantId: string;
  userId: string;
  quantity: number;
  durationMinutes?: number;  // Default: 30
}): Promise<ReservationResult>;

async function releaseReservation(reservationId: string): Promise<void>;

async function convertReservation(reservationId: string): Promise<void>;
```

**Reservation Rules:**
1. Reservation decrements `availableQuantity`, not `quantity`
2. Default hold time: 30 minutes
3. Expired reservations auto-release via cron job
4. Successful checkout converts reservation → decrements `quantity`
5. Cart abandonment releases reservation

**Cron Job:**
```ts
// Every 5 minutes
async function releaseExpiredReservations() {
  const expired = await findExpiredActiveReservations();
  for (const reservation of expired) {
    await releaseReservation(reservation.id);
  }
}
```

### 5.3 Inventory Events

| Event | Trigger |
|-------|---------|
| stock_reserved | Item added to cart |
| stock_released | Cart abandoned or item removed |
| stock_decremented | Order placed |
| stock_incremented | Cancellation or return |
| low_stock_alert | Available quantity crosses threshold |
| out_of_stock | Available quantity reaches 0 |

---

## 6. Category Default Options

### 6.1 Category Default Model

```ts
type CategoryDefaultOption = {
  categoryId: string;
  optionName: string;
  inputType: OptionInputType;
  displayOrder: number;
  isRequired: boolean;
  defaultValues: string[];
  sizeGuideId?: string;
};
```

**Purpose:**
- Pre-populate option types when seller creates listing
- Ensure consistency within categories
- Link to appropriate size guides

### 6.2 Applying Defaults

```ts
async function applyCategoryDefaults(
  listingId: string,
  categoryId: string
): Promise<OptionType[]> {
  const defaults = await getCategoryDefaultOptions(categoryId);
  
  for (const d of defaults) {
    // Create option type
    const optionType = await createOptionType({
      listingId,
      name: d.optionName,
      inputType: d.inputType,
    });
    
    // Add default values
    for (const value of d.defaultValues) {
      await addOptionValue({ optionTypeId: optionType.id, value });
    }
  }
}
```

---

## 7. Size Guides

### 7.1 Size Guide Model

```ts
type SizeGuide = {
  id: string;
  name: string;
  categoryId?: string;
  brand?: string;
  chartData: SizeChartData;
  measurementTips?: string;
  fitType?: "true_to_size" | "runs_small" | "runs_large";
  fitDescription?: string;
  isGlobal: boolean;
};

type SizeChartData = {
  headers: string[];     // ["Size", "Chest", "Waist", "Hips"]
  rows: string[][];      // [["S", "34", "28", "36"], ...]
  unit: "in" | "cm";
};
```

**Rules:**
1. Global guides available across all categories
2. Category-specific guides take precedence
3. Brand-specific guides take highest precedence
4. measurementTips help buyers measure themselves
5. fitType informs sizing recommendations

### 7.2 Size Guide Display

```ts
// Show size guide when:
// 1. Option type name is "Size"
// 2. Category or listing has associated size guide
// 3. Buyer clicks "Size Guide" link
```

---

## 8. Variant Images

### 8.1 Variant Image Model

```ts
type VariantImage = {
  id: string;
  variantId: string;
  imageUrl: string;
  altText?: string;
  displayOrder: number;
  isPrimary: boolean;
};
```

**Rules:**
1. Each variant can have its own images
2. Primary image shown in option selection
3. If variant has no images, use listing's primary image
4. Maximum 5 images per variant

### 8.2 Image Switching

When buyer selects an option (especially Color):
1. Find variants matching current selections
2. If all matching variants share an image → show it
3. If exact variant selected → show variant's primary image

---

## 9. Search Integration

### 9.1 Indexing

Variations are indexed to support filtering:

```ts
type ListingSearchDocument = {
  listingId: string;
  // ... other fields
  
  // Variation data (flattened)
  availableSizes: string[];      // ["S", "M", "L"]
  availableColors: string[];     // ["Red", "Blue"]
  minPriceCents: number;         // Lowest variant price
  maxPriceCents: number;         // Highest variant price
  totalQuantity: number;         // Sum of all variant quantities
  hasInStockVariants: boolean;
};
```

### 9.2 Filter Behavior

- Size filter: show listings with any variant matching size
- Color filter: show listings with any variant matching color
- Price filter: match against min/max variant prices
- In Stock filter: `hasInStockVariants: true`

---

## 10. RBAC & Permissions

| Action | Required Permission |
|--------|---------------------|
| Create option type | listing.owner OR listing.edit |
| Add option value | listing.owner OR listing.edit |
| Create variant | listing.owner OR listing.edit |
| Update variant price/quantity | listing.owner OR listing.edit |
| Delete variant | listing.owner OR listing.edit |
| Reserve stock | buyer (any) |
| Manage category defaults | settings.categories.edit |
| Manage size guides | settings.catalog.edit |

---

## 11. Health Checks

| Check | Pass Condition |
|-------|----------------|
| No negative stock | All variants have availableQuantity >= 0 |
| Reservations valid | reservedQuantity <= quantity |
| No orphaned variants | All listingIds reference valid listings |
| No expired reservations | All active reservations have future expiresAt |
| Active listings have variants | VARIATION type listings have >= 1 active variant |

---

## 12. Audit Requirements

**Must emit audit events:**
- Option type created/updated/deleted
- Option value added/updated/deleted
- Variant created/updated/deleted
- Stock reserved/released/converted
- Inventory adjusted (manual)
- Low stock threshold crossed

---

## 13. Out of Scope

- Variant-level promotions (see Promotions canonical)
- Variant-level shipping rules
- Cross-variant bundles
- Made-to-order/custom options
- Variant-level SEO

---

## 14. Final Rule

Product variations must never:
- Allow purchase of unavailable combinations
- Oversell inventory
- Hide stock status from buyers
- Create variants without explicit seller action

**If behavior is not defined here, it must be rejected or added to this canonical.**
