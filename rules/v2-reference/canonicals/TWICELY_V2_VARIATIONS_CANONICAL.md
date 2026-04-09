# TWICELY V2 — Listing Variations (CANONICAL)

**Version:** 1.0  
**Created:** 2026-01-21  
**Status:** CANONICAL - Defines authoritative variation system rules

---

## CANONICAL RULES

> **Variations allow sellers to offer multiple options (size, color, etc.) within a single listing.**
>
> The system uses a **hybrid approach**: predefined platform values + seller custom values.
>
> **If a variation rule is not defined here, it must not be implemented.**

---

## 1. Variation Architecture

### 1.1 Three-Tier Scope Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ SCOPE: PLATFORM                                             │
│ • Managed by Twicely admins only                           │
│ • Available to ALL sellers on ALL listings                 │
│ • Cannot be deleted, only deactivated                      │
│ • Examples: "Red", "Blue", "S", "M", "L", "XL"            │
├─────────────────────────────────────────────────────────────┤
│ SCOPE: CATEGORY                                             │
│ • Managed by category admins                               │
│ • Available to sellers listing in that category            │
│ • Inherits to child categories                             │
│ • Examples: Clothing→"Petite", Electronics→"110V"          │
├─────────────────────────────────────────────────────────────┤
│ SCOPE: SELLER                                               │
│ • Created by individual sellers                            │
│ • Only visible to that seller in suggestions               │
│ • Can be promoted to PLATFORM by admin                     │
│ • Examples: "Blue/Pink", "Seafoam Green"                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Value Resolution Order

When displaying suggestions to a seller:

```
1. PLATFORM values (always first, sorted by usage)
2. CATEGORY values (for the listing's category)
3. SELLER values (that seller's saved custom values)
```

---

## 2. Variation Types (Dimensions)

### 2.1 System Variation Types

These are **permanent** and cannot be deleted:

| Key | Label | Icon | Description |
|-----|-------|------|-------------|
| `SIZE` | Size | Ruler | Physical size (S, M, L, XL, shoe sizes) |
| `COLOR` | Color | Palette | Color or color combination |
| `MATERIAL` | Material | Layers | Primary material or fabric |
| `STYLE` | Style | Shirt | Style or cut variation |
| `PATTERN` | Pattern | Grid | Pattern or print design |
| `SCENT` | Scent/Fragrance | Wind | Scent or fragrance option |
| `FLAVOR` | Flavor | Coffee | Flavor or taste variation |
| `LENGTH` | Length | MoveHorizontal | Length measurement |
| `WIDTH` | Width | MoveVertical | Width or band size |
| `CAPACITY` | Capacity/Volume | Box | Storage capacity or volume |
| `PACK_SIZE` | Pack Size | Package | Quantity per pack |
| `FINISH` | Finish | Sparkles | Surface finish or coating |
| `POWER` | Power/Voltage | Zap | Electrical specifications |

### 2.2 Custom Variation Types

- Admins MAY add new variation types
- Custom types have `isSystem: false`
- Custom types CAN be deactivated (hidden from new listings)
- Custom types CANNOT be deleted if used by active listings

---

## 3. Constraints

### 3.1 Per-Listing Limits

| Constraint | Value | Configurable? |
|------------|-------|---------------|
| Max variation dimensions per listing | 3 | ✅ Yes (setting) |
| Max total SKU combinations | 250 | ✅ Yes (setting) |
| Max values per dimension | 100 | ❌ No (hard limit) |

**Example of 3 dimensions:**
```
Size (5 values) × Color (10 values) × Material (3 values) = 150 SKUs ✅
Size (10 values) × Color (30 values) = 300 SKUs ❌ Exceeds 250
```

### 3.2 Value Constraints

| Constraint | Rule |
|------------|------|
| Value max length | 100 characters |
| Value min length | 1 character |
| Duplicate check | Case-insensitive within same type+scope |
| Special characters | Allowed: letters, numbers, spaces, `-`, `/`, `&`, `'` |

### 3.3 Child Listing (SKU) Requirements

Each variation combination (child listing) MUST have:

| Field | Required | Notes |
|-------|----------|-------|
| `sku` | ✅ Yes | Unique within parent listing |
| `priceCents` | ✅ Yes | Can differ from parent |
| `quantity` | ✅ Yes | Inventory count |
| `variationCombination` | ✅ Yes | JSON of selected values |
| `images` | ❌ Optional | Can have own images |

---

## 4. Seller Custom Values

### 4.1 Creation Rules

| Rule | Description |
|------|-------------|
| Any seller can create custom values | If `allowCustomVariationValues` setting is `true` |
| Custom values are SELLER scope | Only visible to that seller |
| Auto-save is optional | Controlled by `autoSaveCustomValues` setting |
| Approval can be required | If `customValueApprovalRequired` is `true` |

### 4.2 Normalization

All values are normalized for duplicate detection:

```
Input: "  Blue / Pink  "
Normalized: "blue/pink"

Input: "EXTRA LARGE"
Normalized: "extra large"
```

### 4.3 Promotion to Platform

Admin can promote popular seller values to PLATFORM scope:

```
Criteria for promotion suggestion:
- Used by 10+ different sellers (configurable)
- Total usage count 50+
- No profanity/policy violations
```

---

## 5. Category-Specific Variations

### 5.1 Category Mapping

Categories can specify:

| Property | Description |
|----------|-------------|
| `recommendedTypes` | Variation types shown first for this category |
| `requiredTypes` | Types that MUST be filled (rare) |
| `primaryType` | The main variation (shown in search results) |

### 5.2 Inheritance

```
Category: Clothing
├── recommendedTypes: [SIZE, COLOR, MATERIAL]
│
├── Subcategory: Tops
│   └── Inherits: [SIZE, COLOR, MATERIAL]
│
├── Subcategory: Shoes
│   └── Override: [SIZE, COLOR, WIDTH]
│
└── Subcategory: Jewelry → Rings
    └── Override: [SIZE, MATERIAL, FINISH]
```

---

## 6. Usage Tracking

### 6.1 Tracked Metrics

| Metric | What It Tracks |
|--------|----------------|
| `usageCount` | Times value used in active listings |
| `lastUsedAt` | Last time value was used |
| `totalListings` | Per variation type, total listings using it |

### 6.2 Analytics Rollup (Daily)

```
VariationAnalytics {
  date
  variationTypeId
  variationValueId
  scope
  listingsCreated
  listingsActive
  itemsSold
  revenue
}
```

---

## 7. Cleanup Rules

### 7.1 Auto-Cleanup Eligibility

A value is eligible for cleanup if ALL conditions met:

| Condition | Default |
|-----------|---------|
| Scope is SELLER | Always (never auto-delete PLATFORM/CATEGORY) |
| Usage count ≤ 1 | Configurable |
| Days since last used ≥ 90 | Configurable via `unusedValueCleanupDays` |
| Not used in any active listing | Always |

### 7.2 Cleanup Actions

| Action | What Happens |
|--------|--------------|
| Deactivate | `isActive: false`, hidden from suggestions |
| Delete | Only if never used (`usageCount: 0`) |
| Bulk cleanup | Admin can select and deactivate multiple |

---

## 8. Admin Capabilities

### 8.1 Variation Types Management

| Action | Permission Required |
|--------|---------------------|
| View all types | `variations.read` |
| Add custom type | `variations.write` |
| Edit type (label, icon) | `variations.write` |
| Deactivate type | `variations.admin` |
| Delete type | ❌ Not allowed if in use |

### 8.2 Variation Values Management

| Action | Permission Required |
|--------|---------------------|
| View all values | `variations.read` |
| Add PLATFORM value | `variations.write` |
| Add CATEGORY value | `variations.write` + category admin |
| Edit value | `variations.write` |
| Promote SELLER→PLATFORM | `variations.admin` |
| Deactivate value | `variations.write` |
| Bulk cleanup | `variations.admin` |

### 8.3 Analytics Access

| Action | Permission Required |
|--------|---------------------|
| View usage stats | `variations.read` |
| View popular custom values | `variations.read` |
| View unused values | `variations.read` |
| Export analytics | `variations.admin` |

---

## 9. API Behavior

### 9.1 Listing Creation with Variations

```
POST /api/listings
{
  "title": "Classic T-Shirt",
  "variations": [
    { "type": "SIZE", "values": ["S", "M", "L", "XL"] },
    { "type": "COLOR", "values": ["Black", "White", "Blue/Pink"] }
  ],
  "children": [
    { "sku": "TSHIRT-S-BLK", "combination": {"SIZE": "S", "COLOR": "Black"}, "price": 2999, "quantity": 10 },
    { "sku": "TSHIRT-M-BLK", "combination": {"SIZE": "M", "COLOR": "Black"}, "price": 2999, "quantity": 15 },
    // ... all combinations
  ]
}
```

### 9.2 Value Lookup for Seller

```
GET /api/variations/values?type=COLOR&category=clothing&sellerId=xxx

Response:
{
  "platform": ["Black", "White", "Red", "Blue", ...],
  "category": [],
  "seller": ["Blue/Pink", "Seafoam Green"]
}
```

---

## 10. Display Rules

### 10.1 Search Results

- Show **primary variation** values (e.g., "S, M, L, XL" for clothing)
- Show price range if children have different prices
- Show "X options available" badge

### 10.2 Listing Detail Page

- Show all variation selectors
- Update price/availability on selection
- Show images for specific combination if available
- Gray out unavailable combinations

### 10.3 Cart & Checkout

- Display specific variation combination selected
- SKU visible in order details
- Cannot add parent listing to cart, must select combination

---

## Summary

| Aspect | Rule |
|--------|------|
| **Scope hierarchy** | PLATFORM → CATEGORY → SELLER |
| **Max dimensions** | 3 per listing (configurable) |
| **Max combinations** | 250 SKUs (configurable) |
| **Custom values** | Allowed, saved per seller |
| **Promotion** | Admin can promote popular → platform |
| **Cleanup** | Unused SELLER values after 90 days |
| **System types** | 13 permanent, cannot delete |
| **Custom types** | Admin can add, cannot delete if used |

---

*This canonical defines the variation system rules. Implementation details are in Phase 44.*
