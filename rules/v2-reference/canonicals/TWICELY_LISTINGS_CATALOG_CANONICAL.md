# TWICELY_LISTINGS_CATALOG_CANONICAL.md
**Status:** LOCKED (v1)  
**Scope:** Core marketplace behavior for listings, catalog, categories, attributes, inventory, and media.  
**Audience:** Backend, frontend, data, search, and AI agents.  
**Non-Goal:** This document does NOT describe UI styling or implementation frameworks.

---

## 1. Purpose

This canonical defines **what a listing is**, **how it behaves**, and **how it moves through its lifecycle** in Twicely.

It exists to prevent:
- inconsistent listing behavior
- ad-hoc fields
- broken inventory logic
- search/index drift
- seller confusion

If behavior is not defined here, it **does not exist**.

---

## 2. Core Principles

1. **Seller-owned listings**  
   Every listing is owned by exactly one **owner user** (never by a store object).

2. **Single source of truth**  
   Listings are authoritative in Twicely, even when imported or cross-posted.

3. **State-driven behavior**  
   Listing behavior is determined by state, not UI.

4. **Immutable history**  
   Edits update versions; prior states are auditable.

5. **Search-safe defaults**  
   Only valid, complete, and policy-compliant listings are discoverable.

6. **Category-driven attributes**  
   Required fields are defined by category, not ad-hoc.

---

## 3. Listing Types

### 3.1 Supported Listing Types (v1)

| Type | Description |
|---|---|
| SINGLE_ITEM | One physical item, quantity = 1 |
| MULTI_QUANTITY | Identical items, quantity > 1 |
| VARIATION | One listing with selectable variants |

### 3.2 Unsupported (explicitly)
- Auctions (future)
- Digital goods
- Services
- Bundles (future)

---

## 4. Listing Lifecycle States

Listings MUST conform to the Core Commerce State Machines.

### 4.1 Canonical States

| State | Description | Searchable |
|---|---|---|
| DRAFT | Seller editing, not visible | ❌ |
| PENDING_REVIEW | Automated or manual checks | ❌ |
| ACTIVE | Live and purchasable | ✅ |
| SOLD | Inventory depleted | ❌ |
| PAUSED | Seller-paused | ❌ |
| ENDED | Seller-ended | ❌ |
| REMOVED | Policy removal | ❌ |

### 4.2 State Rules
- Only **ACTIVE** listings may appear in search.
- SOLD is terminal unless relisted.
- REMOVED requires Trust & Safety authority.

---

## 5. Listing Data Model (Canonical Fields)

### 5.1 Identity
- `id`
- `ownerUserId`
- `status`
- `createdAt`
- `updatedAt`

### 5.2 Core Attributes (required to activate)
- `title`
- `description`
- `categoryId`
- `condition`
- `priceCents`
- `currency`
- `quantity`
- `shippingProfileId`

### 5.3 Standard Optional Attributes
- `brand`
- `size`
- `color`
- `material`
- `gender`
- `tags[]`

### 5.4 Category-Specific Attributes
- Defined by `CategoryAttributeSchema`
- See Section 6 for details

### 5.5 Media
- `images[]` (1–12)
- `videoUrl?` (future)

---

## 6. Category & Attribute System

### 6.1 Category Attribute Schema

Each category defines its attributes via `CategoryAttributeSchema`:

```ts
type CategoryAttributeSchema = {
  id: string;
  categoryId: string;
  attributeKey: string;      // e.g., "brand", "size", "color"
  label: string;             // Display name
  description?: string;
  
  // Type
  type: AttributeType;
  scope: AttributeScope;
  
  // Validation
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  
  // For SELECT/MULTI_SELECT
  options?: string[];
  allowCustom: boolean;      // Allow values not in options
  
  // Display
  displayOrder: number;
  showInFilters: boolean;
  showInCard: boolean;
  showInSearch: boolean;
  
  // Inheritance
  inheritToChildren: boolean;
  
  isActive: boolean;
};

type AttributeType = 
  | "TEXT"
  | "NUMBER"
  | "SELECT"
  | "MULTI_SELECT"
  | "BOOLEAN"
  | "DATE"
  | "COLOR"
  | "SIZE"
  | "DIMENSION";

type AttributeScope =
  | "REQUIRED"      // Must be filled to activate
  | "RECOMMENDED"   // Suggested but optional
  | "OPTIONAL";     // Fully optional
```

### 6.2 Attribute Rules

1. **REQUIRED attributes must be filled to activate listing**
2. **SELECT/MULTI_SELECT values must match options** (unless allowCustom)
3. **Validation rules enforced at save**
4. **Attributes with showInFilters appear in search filters**
5. **Attributes with showInCard appear on listing cards**

### 6.3 Attribute Inheritance

Categories form a hierarchy. Attributes inherit down:

```
Electronics (brand: REQUIRED)
  └── Phones (storage: REQUIRED, carrier: OPTIONAL)
       └── iPhones (model: REQUIRED)
```

Rules:
- Parent attributes with `inheritToChildren: true` apply to children
- Child categories may override inherited attributes
- Child categories may add additional attributes

### 6.4 Attribute Resolution

```ts
async function getCategoryAttributes(categoryId: string): Promise<CategoryAttributeSchema[]> {
  const direct = await getDirectAttributes(categoryId);
  const category = await getCategory(categoryId);
  
  if (!category.parentId) return direct;
  
  const inherited = await getCategoryAttributes(category.parentId);
  const inheritableAttrs = inherited.filter(a => a.inheritToChildren);
  
  // Direct attributes override inherited
  const directKeys = new Set(direct.map(a => a.attributeKey));
  const merged = [
    ...direct,
    ...inheritableAttrs.filter(a => !directKeys.has(a.attributeKey)),
  ];
  
  return merged.sort((a, b) => a.displayOrder - b.displayOrder);
}
```

### 6.5 Listing Attribute Storage

Listing attributes stored as JSON with validation:

```ts
type Listing = {
  // ...core fields...
  attributesJson: Record<string, any>;
  requiredAttributesComplete: boolean;
};

async function validateListingAttributes(listing: Listing): Promise<ValidationResult> {
  const schema = await getCategoryAttributes(listing.categoryId);
  const errors = [];
  
  for (const attr of schema) {
    const value = listing.attributesJson[attr.attributeKey];
    
    // Check required
    if (attr.scope === "REQUIRED" && !value) {
      errors.push({ field: attr.attributeKey, error: "REQUIRED" });
      continue;
    }
    
    // Check type/validation
    if (value && !validateValue(value, attr)) {
      errors.push({ field: attr.attributeKey, error: "INVALID" });
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## 7. Pricing Rules

1. Price is **fixed** in v1.
2. Currency defaults to USD.
3. Price edits on ACTIVE listings:
   - allowed
   - logged
   - reflected immediately in search
4. Price history tracked for watchlist alerts

---

## 8. Inventory Rules

### 8.1 Quantity
- SINGLE_ITEM: quantity always = 1
- MULTI_QUANTITY: quantity decrements on purchase
- VARIATION: quantity tracked per variant

### 8.2 Inventory Depletion

Rules vary by listing type (aligned with Core Commerce State Machines):

**SINGLE_ITEM** (quantity = 1):
- Listing transitions to **SOLD** when purchased
- Removed from search
- Cannot be purchased

**MULTI_QUANTITY** (quantity > 1):
- Listing remains **ACTIVE** while availableQuantity > 0
- Listing transitions to **ENDED** when availableQuantity = 0
- The **SOLD** state is reserved for single-item listings only
- Partial sales decrement availableQuantity atomically

**VARIATION**:
- Listing remains **ACTIVE** while any variant has quantity > 0
- Listing transitions to **ENDED** when all variants have quantity = 0
- Individual variants may be unavailable while listing stays active

---

## 9. Variations (v1 constraints)

- Variations must share:
  - title
  - description
  - category
- Variants may differ by:
  - size
  - color
- Each variant has:
  - SKU
  - price
  - quantity

---

## 10. Media Rules

1. At least **1 image** required to activate.
2. Max 12 images.
3. First image = primary image.
4. Images must be:
   - real photos
   - no watermarks
   - no placeholders
5. Moderation may remove images without deleting listing.

---

## 11. Listing Edits & Versioning

### 11.1 Editable While ACTIVE
- price
- quantity
- description
- media
- optional attributes

### 11.2 Immutable While ACTIVE
- category
- condition
- listing type

Changes create a new **listing version**.

---

## 12. Relisting Rules

1. SOLD or ENDED listings may be relisted.
2. Relisting:
   - creates a new listing ID
   - may copy data
   - resets lifecycle

---

## 13. Policy & Enforcement Hooks

Listings may be:
- flagged automatically
- reported by users
- reviewed by staff

Actions include:
- pause
- remove
- restrict seller

REMOVED listings:
- never searchable
- remain auditable

---

## 14. Search & Indexing Contract

A listing is eligible for indexing only if:
- status == ACTIVE
- required attributes satisfied
- inventory > 0
- no enforcement flags

Search systems must treat this as authoritative.

---

## 15. Cross-Posting / Import Compatibility

Imported listings:
- map into canonical fields
- retain source metadata
- never bypass validation
- Twicely listing ID is authoritative

External IDs are references only.

---

## 16. RBAC & Permissions

| Action | Required Permission |
|---|---|
| Create/Edit Draft | owner or delegated |
| Activate Listing | owner or delegated |
| Pause/End | owner or delegated |
| Remove | Trust & Safety |
| Edit Category Schema | settings.categories.edit |
| View Category Schema | settings.categories.view |

---

## 17. Audit & Logging

All of the following MUST generate audit events:
- state transitions
- price changes
- quantity changes
- attribute changes
- removals
- relists
- category schema changes

---

## 18. Out of Scope (Explicit)

- Promotions (see Monetization canonical)
- Ads
- Reviews
- Auctions
- Internationalization

---

## 19. Final Rule

If a listing behavior is **not described here**, it must:
- be rejected at review, or
- be added to this canonical.

No silent behavior is allowed.
