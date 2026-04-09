# PHASE V4.10 -- Catalog Normalization & Product Matching

**Canonical:** `rules/canonicals/03_VARIATIONS_CATALOG.md` sections 4.10, 5.7, 5.8, 6.6, 6.7, 7.3
**Prerequisites:** PHASE V4.01 (variations schema exists, categories + categoryAttributeSchema exist)
**Estimated:** 4-5 hours
**Scope:** Product canonical table + attribute validation + facet generation + duplicate detection + admin UI

---

## Step 1: Schema (already in V4.01)

The `productCanonical` table (canonical 4.10) is defined in `packages/db/src/schema/variations.ts` from V4.01. Verify it exists:

```ts
// packages/db/src/schema/variations.ts -- productCanonical
// id, name, brand, categoryId, upc, ean, isbn, mpn, attributesJson,
// imageUrl, isVerified, listingCount, createdAt, updatedAt
```

Add CASL subject if not already done in V4.01:

```ts
// packages/casl/src/subjects.ts
'ProductCanonical',
```

---

## Step 2: Category Attribute Validation Service

File: `packages/commerce/src/catalog/attribute-validation.ts`

### 2.1 Types

```ts
export type ValidationError = {
  key: string;
  message: string;
  severity: 'error' | 'warning';
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
};
```

### 2.2 Attribute Resolution (with inheritance)

```ts
export async function getResolvedCategoryAttributes(
  categoryId: string
): Promise<(typeof categoryAttributeSchema.$inferSelect)[]>
```

Logic:
1. Get direct attributes for `categoryId`
2. Walk up parent chain via `category.parentId`
3. Merge: child attributes override parent by `name`
4. Sort by `sortOrder` ascending

### 2.3 Validation

```ts
export async function validateListingAttributes(
  listingId: string
): Promise<ValidationResult>
```

Logic:
1. Load listing with `attributesJson` and `categoryId`
2. Call `getResolvedCategoryAttributes(categoryId)`
3. For each attribute where `isRequired = true`: check key exists in `attributesJson` and is non-empty
4. For each attribute where `isRecommended = true` but missing: add warning
5. For attributes with `fieldType = 'SELECT'`: check value is in `optionsJson` array
6. For attributes with `validationJson.pattern`: validate against regex
7. For attributes with `validationJson.min` / `validationJson.max`: validate range

```ts
export async function validateAttributeValue(
  attribute: typeof categoryAttributeSchema.$inferSelect,
  value: unknown
): Promise<ValidationError | null>
```

### 2.4 Validation Hook

Called from listing publish flow (DRAFT -> ACTIVE):

```ts
export async function blockPublishIfInvalid(listingId: string): Promise<{
  canPublish: boolean;
  errors: ValidationError[];
}>
```

---

## Step 3: Facet Generation Service

File: `packages/commerce/src/catalog/facet-generation.ts`

### 3.1 Types

```ts
export type Facet = {
  key: string;
  label: string;
  fieldType: string;
  values: Array<{ value: string; count: number }>;
};
```

### 3.2 Generate Facets from Category Attributes

```ts
export async function generateSearchFacets(
  categoryId: string
): Promise<Facet[]>
```

Logic:
1. Get all attributes for category where `showInFilters = true`
2. For each attribute:
   - Query all ACTIVE listings in this category (+ child categories)
   - Extract values from `listing.attributesJson->>'{key}'`
   - Group by value, count occurrences
   - Return top 50 values sorted by count desc
3. Return array of facets

### 3.3 Apply Facets to Search

```ts
export async function buildFacetFilterString(
  filters: Record<string, string[]>
): Promise<string>
```

Generates Typesense filter_by clauses. For category-specific attributes, translates attribute keys to `attributesJson` queries. For standard fields (brand, condition, etc.), uses direct Typesense field names.

---

## Step 4: Product Matching / Duplicate Detection

File: `packages/commerce/src/catalog/product-matching.ts`

### 4.1 Match or Create Canonical

```ts
export async function matchOrCreateCanonical(
  listing: {
    id: string;
    title: string;
    brand: string | null;
    categoryId: string | null;
    attributesJson: Record<string, unknown>;
  }
): Promise<{
  canonicalId: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  isNew: boolean;
}>
```

Logic:
1. Extract UPC/EAN/ISBN from `attributesJson` if present
2. If UPC/EAN/ISBN exists: exact match against `productCanonical.upc` / `ean` / `isbn`
   - Match found: return `{ canonicalId, confidence: 'HIGH', isNew: false }`
3. If brand + MPN: match against `productCanonical.brand` + `productCanonical.mpn`
   - Match found: return `{ canonicalId, confidence: 'MEDIUM', isNew: false }`
4. If `catalog.normalization.duplicateDetection` setting is true:
   - Title similarity search (Typesense or pg_trgm) within same category
   - If similarity > 0.8: return `{ canonicalId, confidence: 'LOW', isNew: false }`
5. If no match and UPC/EAN exists: create new `productCanonical` row
   - Return `{ canonicalId, confidence: 'HIGH', isNew: true }`
6. If no match and no barcode: return `{ canonicalId: null, confidence: null, isNew: false }`

### 4.2 Search Canonicals (Admin)

```ts
export async function searchCanonicals(args: {
  upc?: string;
  brand?: string;
  query?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: (typeof productCanonical.$inferSelect)[];
  totalCount: number;
}>
```

### 4.3 Merge Duplicate Canonicals (Admin)

```ts
export async function mergeDuplicateCanonicals(
  keepId: string,
  mergeId: string
): Promise<void>
```

Logic:
1. Verify both exist
2. Update all listings pointing to `mergeId` canonical -> `keepId`
3. Sum `listingCount` onto keep
4. Delete `mergeId` row
5. Emit audit event

---

## Step 5: Category Management Actions (Admin)

File: `packages/commerce/src/catalog/category-attribute-actions.ts`

### 5.1 Attribute CRUD

```ts
export async function createCategoryAttribute(input: {
  categoryId: string;
  name: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'COLOR' | 'SIZE';
  isRequired?: boolean;
  isRecommended?: boolean;
  showInFilters?: boolean;
  showInListing?: boolean;
  optionsJson?: string[];
  validationJson?: Record<string, unknown>;
  sortOrder?: number;
}): Promise<typeof categoryAttributeSchema.$inferSelect>

export async function updateCategoryAttribute(
  id: string,
  input: Partial<Parameters<typeof createCategoryAttribute>[0]>
): Promise<typeof categoryAttributeSchema.$inferSelect>

export async function deleteCategoryAttribute(id: string): Promise<void>

export async function getCategoryAttributes(
  categoryId: string
): Promise<(typeof categoryAttributeSchema.$inferSelect)[]>
```

### 5.2 Category Tree Actions

```ts
export async function getCategoryTree(
  parentId?: string
): Promise<CategoryTreeNode[]>

export async function updateCategoryPath(
  categoryId: string
): Promise<void>
```

`CategoryTreeNode`:
```ts
type CategoryTreeNode = typeof category.$inferSelect & {
  children: CategoryTreeNode[];
  attributeCount: number;
};
```

---

## Step 6: Listing Column for Canonical Link

Add optional column to `listing` table:

```ts
// packages/db/src/schema/listings.ts -- ADD
productCanonicalId: text('product_canonical_id'),
```

Index:
```ts
canonicalIdx: index('lst_canonical').on(table.productCanonicalId),
```

This links a listing to its matched `productCanonical`. Nullable; only set when a match is found.

---

## Step 7: Typesense Update

Add to `packages/search/src/typesense-schema.ts` (if not already from V4.01):

```ts
{ name: 'productCanonicalId', type: 'string', index: true, optional: true },
```

Update indexer in `packages/search/src/typesense-index.ts` to include `productCanonicalId` from `listing.productCanonicalId`.

---

## Step 8: Admin UI Pages

### 8.1 Category Attribute Manager

Route: `apps/web/src/app/(hub)/cfg/catalog/categories/page.tsx`

Server component that renders:
- Category tree (collapsible)
- Click category to show its attributes
- Add/edit/delete attributes
- Mark attributes as required/recommended/filterable

### 8.2 Product Canonical Browser

Route: `apps/web/src/app/(hub)/cfg/catalog/products/page.tsx`

Server component that renders:
- Search by UPC, brand, name
- Table: name, brand, category, UPC, listing count, verified badge
- Click to view matched listings
- Merge action (select two canonicals, choose keeper)

### 8.3 Size Guide Manager

Route: `apps/web/src/app/(hub)/cfg/catalog/size-guides/page.tsx`

Server component for CRUD of `sizeGuide` entries. Table editor for chart data.

---

## Step 9: Tests

### 9.1 Unit Tests

| File | Tests |
|---|---|
| `packages/commerce/src/catalog/__tests__/attribute-validation.test.ts` | Required check, type validation, inheritance, SELECT options |
| `packages/commerce/src/catalog/__tests__/facet-generation.test.ts` | Facet counts, top-N values, filter string building |
| `packages/commerce/src/catalog/__tests__/product-matching.test.ts` | UPC match, brand+MPN match, title similarity, merge |
| `packages/commerce/src/catalog/__tests__/category-attribute-actions.test.ts` | CRUD, tree, path update |

### 9.2 Key Assertions

- Required attribute blocks listing publish when missing
- Optional attribute does not block publish
- SELECT validation rejects values not in options
- Inherited attributes from parent category appear in child
- Child attribute overrides parent attribute with same name
- UPC match returns HIGH confidence
- Brand+MPN match returns MEDIUM confidence
- Title similarity returns LOW confidence
- Merge updates listing references and deletes merged canonical
- Facet generation returns correct counts per value

---

## Step 10: Files Created Summary

| # | File Path | Purpose |
|---|---|---|
| 1 | `packages/commerce/src/catalog/attribute-validation.ts` | Attribute validation service |
| 2 | `packages/commerce/src/catalog/facet-generation.ts` | Facet generation service |
| 3 | `packages/commerce/src/catalog/product-matching.ts` | Product matching / dedup |
| 4 | `packages/commerce/src/catalog/category-attribute-actions.ts` | Category attribute CRUD |
| 5 | `packages/db/src/schema/listings.ts` (modify) | Add `productCanonicalId` |
| 6 | `packages/search/src/typesense-schema.ts` (modify) | Add `productCanonicalId` |
| 7 | `packages/search/src/typesense-index.ts` (modify) | Index canonical ID |
| 8 | `packages/casl/src/subjects.ts` (modify) | Add `ProductCanonical` if not done |
| 9 | `packages/casl/src/platform-abilities.ts` (modify) | ProductCanonical admin rules |
| 10 | `apps/web/src/app/(hub)/cfg/catalog/categories/page.tsx` | Category attribute manager |
| 11 | `apps/web/src/app/(hub)/cfg/catalog/products/page.tsx` | Product canonical browser |
| 12 | `apps/web/src/app/(hub)/cfg/catalog/size-guides/page.tsx` | Size guide manager |
| 13-16 | `packages/commerce/src/catalog/__tests__/*.test.ts` | 4 test files |

---

## Completion Criteria

- [ ] `productCanonical` table populated for barcode-based matches
- [ ] `listing.productCanonicalId` column added and indexed
- [ ] Attribute validation blocks publish for missing required attributes
- [ ] Attribute validation supports TEXT, NUMBER, SELECT, BOOLEAN, COLOR, SIZE types
- [ ] Attribute inheritance from parent categories works
- [ ] Facet generation produces correct counts
- [ ] Product matching: UPC exact match (HIGH), brand+MPN (MEDIUM), title similarity (LOW)
- [ ] Merge canonicals updates all linked listings
- [ ] Admin UI: category attribute manager functional
- [ ] Admin UI: product canonical browser with search
- [ ] Admin UI: size guide CRUD
- [ ] All tests passing
- [ ] `npx turbo typecheck` -- 0 errors
- [ ] `npx turbo test` -- baseline maintained or increased
