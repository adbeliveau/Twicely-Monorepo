# TWICELY V2 - Install Phase 35: Catalog Normalization (Item Specifics, Variants)
**Status:** LOCKED (v1.0)  
**Backend-first:** Schema  ->  Attributes  ->  Variants  ->  Validation  ->  Search  ->  Health  ->  Doctor  
**Canonicals (MUST follow):**
- `/rules/TWICELY_LISTINGS_CATALOG_CANONICAL.md`
- `/rules/TWICELY_SEARCH_BROWSE_DISCOVERY_CANONICAL.md`
- `/rules/System-Health-Canonical-Spec-v1-provider-driven.md`

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_35_CATALOG_NORMALIZATION.md`  
> Prereq: Phase 34 complete and Doctor green.

---

## 0) What this phase installs

### Backend
- Category attribute schemas (item specifics templates)
- Listing variant support (size/color/style)
- Attribute validation on listing create/update
- Search facet generation from attributes
- Duplicate detection hooks (optional)

### UI (Seller)
- Seller  ->  Create Listing  ->  Item Specifics form (dynamic)
- Seller  ->  Create Listing  ->  Variant Matrix

### UI (Buyer)
- Browse  ->  Filters based on item specifics
- Listing Detail  ->  Variant selector

### UI (Corp)
- Corp  ->  Catalog  ->  Attribute Management
- Corp  ->  Catalog  ->  Category Tree

### Ops
- Health provider: `catalog`
- Doctor checks: attributes, variants, filters, validation

### Doctor Check Implementation (Phase 35)

Add to `scripts/twicely-doctor.ts`:

```typescript
async function checkPhase35(): Promise<DoctorCheckResult[]> {
  const checks: DoctorCheckResult[] = [];

  // 1. Create category with attributes
  const testCategory = await prisma.category.create({
    data: {
      name: "Doctor Test Category",
      slug: `doctor-test-${Date.now()}`,
      path: `doctor-test-${Date.now()}`,
      level: 0,
    },
  });

  const attribute = await prisma.categoryAttribute.create({
    data: {
      categoryId: testCategory.id,
      name: "Size",
      key: "size",
      type: "enum",
      options: ["S", "M", "L", "XL"],
      isRequired: true,
      sortOrder: 1,
    },
  });
  checks.push({
    phase: 35,
    name: "catalog.attribute_create",
    status: attribute?.id ? "PASS" : "FAIL",
    details: `Attribute: ${attribute?.name} (${attribute?.type})`,
  });

  // 2. Create listing with variants
  const testListing = await prisma.listing.create({
    data: {
      ownerUserId: "doctor_user",
      title: "Doctor Test Listing",
      description: "Test listing with variants",
      categoryId: testCategory.id,
      priceCents: 2000,
      status: "DRAFT",
      type: "VARIATION",
    },
  });

  const variant = await prisma.listingVariant.create({
    data: {
      listingId: testListing.id,
      attributeCombo: { size: "M" },
      sku: `DOCTOR-M-${Date.now()}`,
      priceCents: 2000,
      availableQuantity: 5,
    },
  });
  checks.push({
    phase: 35,
    name: "catalog.variant_create",
    status: variant?.id ? "PASS" : "FAIL",
    details: `Variant SKU: ${variant?.sku}`,
  });

  // 3. Filters generated from attributes
  const categoryAttributes = await prisma.categoryAttribute.findMany({
    where: { categoryId: testCategory.id },
  });
  const hasFilters = categoryAttributes.length > 0;
  checks.push({
    phase: 35,
    name: "catalog.filters_generated",
    status: hasFilters ? "PASS" : "FAIL",
    details: `Filter keys: ${categoryAttributes.map(a => a.key).join(", ")}`,
  });

  // 4. Validation enforces required attributes
  const requiredAttrs = await prisma.categoryAttribute.findMany({
    where: { categoryId: testCategory.id, isRequired: true },
  });
  const missingRequired = requiredAttrs.filter(attr => {
    const combo = variant.attributeCombo as Record<string, string>;
    return !combo[attr.key];
  });
  // Variant has size:M, so validation should pass
  const validationPasses = missingRequired.length === 0;
  checks.push({
    phase: 35,
    name: "catalog.validation_required",
    status: validationPasses ? "PASS" : "FAIL",
    details: validationPasses ? "All required attrs present" : `Missing: ${missingRequired.map(a => a.key).join(", ")}`,
  });

  // Cleanup
  await prisma.listingVariant.delete({ where: { id: variant.id } });
  await prisma.listing.delete({ where: { id: testListing.id } });
  await prisma.categoryAttribute.delete({ where: { id: attribute.id } });
  await prisma.category.delete({ where: { id: testCategory.id } });

  return checks;
}
```


---

## 1) Catalog Invariants (non-negotiable)

- Attributes are defined per category
- Required attributes block listing publish
- Variants share parent listing's base data
- Each variant has unique SKU (optional) and attribute combo
- Search facets auto-generate from attribute keys

Attribute types:
- `string` - free text
- `number` - numeric value
- `enum` - predefined options
- `bool` - true/false

---

## 2) Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model Category {
  id          String    @id @default(cuid())
  parentId    String?
  name        String
  slug        String    @unique
  description String?
  level       Int       @default(0)
  path        String    // materialized path e.g., "electronics/phones/smartphones"
  isActive    Boolean   @default(true)
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([parentId])
  @@index([path])
}

model CategoryAttribute {
  id          String    @id @default(cuid())
  categoryId  String
  key         String    // e.g., "brand", "size", "color"
  label       String    // display name
  type        String    // string|number|enum|bool
  options     String[]  // for enum type
  required    Boolean   @default(false)
  filterable  Boolean   @default(true)  // show in search filters
  sortOrder   Int       @default(0)
  helpText    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([categoryId, key])
  @@index([categoryId, sortOrder])
}

model ListingVariant {
  id          String    @id @default(cuid())
  listingId   String
  sku         String?
  attributes  Json      // { size: "M", color: "Black" }
  priceCents  Int
  comparePriceCents Int?  // strike-through price
  quantity    Int       @default(0)
  isDefault   Boolean   @default(false)
  isActive    Boolean   @default(true)
  imageUrl    String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([listingId])
  @@index([sku])
  @@unique([listingId, sku])
}

model ListingAttribute {
  id          String    @id @default(cuid())
  listingId   String
  key         String
  value       String
  createdAt   DateTime  @default(now())

  @@unique([listingId, key])
  @@index([listingId])
  @@index([key, value])  // for faceted search
}
```

Migration:
```bash
npx prisma migrate dev --name catalog_normalization_phase35
```

---

## 3) Category Service

Create `packages/core/catalog/category-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createCategory(args: {
  parentId?: string;
  name: string;
  slug: string;
  description?: string;
}) {
  let path = args.slug;
  let level = 0;

  if (args.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: args.parentId } });
    if (parent) {
      path = `${parent.path}/${args.slug}`;
      level = parent.level + 1;
    }
  }

  return prisma.category.create({
    data: {
      parentId: args.parentId,
      name: args.name,
      slug: args.slug,
      description: args.description,
      path,
      level,
    },
  });
}

export async function getCategoryTree(rootId?: string) {
  const where = rootId ? { parentId: rootId } : { parentId: null };

  const categories = await prisma.category.findMany({
    where,
    orderBy: { sortOrder: "asc" },
  });

  // Recursively fetch children
  const tree = await Promise.all(
    categories.map(async (cat) => ({
      ...cat,
      children: await getCategoryTree(cat.id),
    }))
  );

  return tree;
}

export async function getCategoryAttributes(categoryId: string) {
  // Get attributes for this category and all ancestors
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return [];

  const pathSegments = category.path.split("/");
  const ancestorPaths = pathSegments.map((_, i) => pathSegments.slice(0, i + 1).join("/"));

  const ancestorCategories = await prisma.category.findMany({
    where: { path: { in: ancestorPaths } },
  });

  const categoryIds = ancestorCategories.map((c) => c.id);

  return prisma.categoryAttribute.findMany({
    where: { categoryId: { in: categoryIds } },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });
}
```

---

## 4) Attribute Service

Create `packages/core/catalog/attribute-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function createCategoryAttribute(args: {
  categoryId: string;
  key: string;
  label: string;
  type: "string" | "number" | "enum" | "bool";
  options?: string[];
  required?: boolean;
  filterable?: boolean;
  helpText?: string;
  staffActorId?: string;
}) {
  const attribute = await prisma.categoryAttribute.create({
    data: {
      categoryId: args.categoryId,
      key: args.key.toLowerCase().replace(/\s+/g, "_"),
      label: args.label,
      type: args.type,
      options: args.options ?? [],
      required: args.required ?? false,
      filterable: args.filterable ?? true,
      helpText: args.helpText,
    },
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "catalog.attribute.created",
    entityType: "CategoryAttribute",
    entityId: attribute.id,
    meta: { categoryId: args.categoryId, key: args.key },
  });

  return attribute;
}

export async function updateCategoryAttribute(args: {
  attributeId: string;
  updates: Partial<{
    label: string;
    options: string[];
    required: boolean;
    filterable: boolean;
    helpText: string;
  }>;
  staffActorId?: string;
}) {
  const attribute = await prisma.categoryAttribute.update({
    where: { id: args.attributeId },
    data: args.updates,
  });

  await emitAuditEvent({
    actorUserId: args.staffActorId,
    action: "catalog.attribute.updated",
    entityType: "CategoryAttribute",
    entityId: attribute.id,
    meta: { updates: Object.keys(args.updates) },
  });

  return attribute;
}
```

---

## 5) Listing Attribute Validation

Create `packages/core/catalog/attribute-validation.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type ValidationError = {
  key: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export async function validateListingAttributes(args: {
  categoryId: string;
  attributes: Record<string, string | number | boolean>;
}): Promise<ValidationResult> {
  const categoryAttributes = await prisma.categoryAttribute.findMany({
    where: { categoryId: args.categoryId },
  });

  const errors: ValidationError[] = [];

  for (const attr of categoryAttributes) {
    const value = args.attributes[attr.key];

    // Check required
    if (attr.required && (value === undefined || value === null || value === "")) {
      errors.push({ key: attr.key, message: `${attr.label} is required` });
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type validation
    switch (attr.type) {
      case "number":
        if (typeof value !== "number" && isNaN(Number(value))) {
          errors.push({ key: attr.key, message: `${attr.label} must be a number` });
        }
        break;

      case "enum":
        if (!attr.options.includes(String(value))) {
          errors.push({
            key: attr.key,
            message: `${attr.label} must be one of: ${attr.options.join(", ")}`,
          });
        }
        break;

      case "bool":
        if (typeof value !== "boolean" && !["true", "false", "1", "0"].includes(String(value))) {
          errors.push({ key: attr.key, message: `${attr.label} must be true or false` });
        }
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

## 6) Variant Service

Create `packages/core/catalog/variant-service.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { emitAuditEvent } from "../audit/emit";

const prisma = new PrismaClient();

export async function createVariant(args: {
  listingId: string;
  sku?: string;
  attributes: Record<string, string>;
  priceCents: number;
  comparePriceCents?: number;
  quantity: number;
  isDefault?: boolean;
  imageUrl?: string;
}) {
  // Validate unique attribute combination
  const existing = await prisma.listingVariant.findMany({
    where: { listingId: args.listingId },
  });

  const attrKey = JSON.stringify(args.attributes);
  const duplicate = existing.find((v) => JSON.stringify(v.attributes) === attrKey);

  if (duplicate) {
    throw new Error("Variant with these attributes already exists");
  }

  // If this is default, unset other defaults
  if (args.isDefault) {
    await prisma.listingVariant.updateMany({
      where: { listingId: args.listingId },
      data: { isDefault: false },
    });
  }

  const variant = await prisma.listingVariant.create({
    data: {
      listingId: args.listingId,
      sku: args.sku,
      attributes: args.attributes,
      priceCents: args.priceCents,
      comparePriceCents: args.comparePriceCents,
      quantity: args.quantity,
      isDefault: args.isDefault ?? false,
      imageUrl: args.imageUrl,
    },
  });

  await emitAuditEvent({
    action: "catalog.variant.created",
    entityType: "ListingVariant",
    entityId: variant.id,
    meta: { listingId: args.listingId, attributes: args.attributes },
  });

  return variant;
}

export async function updateVariantInventory(args: {
  variantId: string;
  quantity: number;
}) {
  return prisma.listingVariant.update({
    where: { id: args.variantId },
    data: { quantity: args.quantity },
  });
}

export async function getVariantMatrix(listingId: string) {
  const variants = await prisma.listingVariant.findMany({
    where: { listingId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  // Extract unique attribute keys and values
  const attributeKeys = new Set<string>();
  const attributeValues: Record<string, Set<string>> = {};

  for (const variant of variants) {
    const attrs = variant.attributes as Record<string, string>;
    for (const [key, value] of Object.entries(attrs)) {
      attributeKeys.add(key);
      if (!attributeValues[key]) attributeValues[key] = new Set();
      attributeValues[key].add(value);
    }
  }

  return {
    variants,
    dimensions: Array.from(attributeKeys).map((key) => ({
      key,
      values: Array.from(attributeValues[key] ?? []),
    })),
  };
}
```

---

## 7) Search Facet Generation

Create `packages/core/catalog/facets.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type Facet = {
  key: string;
  label: string;
  type: string;
  values: Array<{ value: string; count: number }>;
};

export async function generateFacets(args: {
  categoryId?: string;
  searchQuery?: string;
}): Promise<Facet[]> {
  // Get filterable attributes for category
  const attributes = args.categoryId
    ? await prisma.categoryAttribute.findMany({
        where: { categoryId: args.categoryId, filterable: true },
        orderBy: { sortOrder: "asc" },
      })
    : [];

  const facets: Facet[] = [];

  for (const attr of attributes) {
    // Count values for this attribute
    const valueCounts = await prisma.listingAttribute.groupBy({
      by: ["value"],
      where: { key: attr.key },
      _count: { value: true },
      orderBy: { _count: { value: "desc" } },
      take: 50,
    });

    facets.push({
      key: attr.key,
      label: attr.label,
      type: attr.type,
      values: valueCounts.map((v) => ({
        value: v.value,
        count: v._count.value,
      })),
    });
  }

  return facets;
}

export async function applyFacetFilters(args: {
  baseQuery: any;
  filters: Record<string, string[]>;
}) {
  const listingIds = new Set<string>();
  let initialized = false;

  for (const [key, values] of Object.entries(args.filters)) {
    if (!values.length) continue;

    const matchingAttributes = await prisma.listingAttribute.findMany({
      where: { key, value: { in: values } },
      select: { listingId: true },
    });

    const ids = new Set(matchingAttributes.map((a) => a.listingId));

    if (!initialized) {
      ids.forEach((id) => listingIds.add(id));
      initialized = true;
    } else {
      // Intersection
      for (const id of listingIds) {
        if (!ids.has(id)) listingIds.delete(id);
      }
    }
  }

  return Array.from(listingIds);
}
```

---

## 8) Corp APIs

### Categories
- `GET /api/platform/catalog/categories` - get category tree
- `POST /api/platform/catalog/categories` - create category
- `PUT /api/platform/catalog/categories/:id` - update category
- RBAC: requires `catalog.categories.manage`

### Attributes
- `GET /api/platform/catalog/categories/:id/attributes` - get category attributes
- `POST /api/platform/catalog/categories/:id/attributes` - create attribute
- `PUT /api/platform/catalog/attributes/:id` - update attribute
- `DELETE /api/platform/catalog/attributes/:id` - delete attribute
- RBAC: requires `catalog.attributes.manage`

---

## 9) Seller APIs

- `GET /api/seller/catalog/categories/:id/attributes` - get attributes for listing form
- `POST /api/seller/listings/:id/variants` - add variant
- `PUT /api/seller/listings/:id/variants/:variantId` - update variant
- `DELETE /api/seller/listings/:id/variants/:variantId` - remove variant

---

## 10) Health Provider

Create `packages/core/health/providers/catalog.ts`:

```ts
import { HealthCheckResult } from "../types";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function checkCatalog(): Promise<HealthCheckResult> {
  const errors: string[] = [];

  try {
    await prisma.category.count();
    await prisma.categoryAttribute.count();
    await prisma.listingVariant.count();
  } catch {
    errors.push("Catalog tables not accessible");
  }

  // Check for categories without attributes
  const categoriesWithoutAttrs = await prisma.category.count({
    where: {
      isActive: true,
      level: { gt: 0 }, // not root
    },
  });

  // This is a warning, not an error
  // Could add to health metadata

  return {
    provider: "catalog",
    status: errors.length === 0 ? "healthy" : "degraded",
    errors,
    checkedAt: new Date().toISOString(),
  };
}
```

---

## 11) Doctor Checks (Phase 35)

Doctor must:
1. Create category  ->  verify persisted with path
2. Create attribute for category  ->  verify persisted
3. Validate listing with missing required attribute  ->  verify error returned
4. Validate listing with valid attributes  ->  verify success
5. Create variant  ->  verify persisted
6. Create duplicate variant (same attributes)  ->  verify rejected
7. Generate facets for category  ->  verify facet values returned
8. Apply facet filter  ->  verify correct listings returned

---

## 12) Phase 35 Completion Criteria

- [ ] Category, CategoryAttribute, ListingVariant, ListingAttribute tables created
- [ ] Category tree with path materialization working
- [ ] Attributes inherit from parent categories
- [ ] Attribute validation blocks invalid listings
- [ ] Variants support size/color/etc combinations
- [ ] Faceted search generates from attributes
- [ ] All actions emit audit events
- [ ] Health provider `catalog` reports status
- [ ] Doctor passes all Phase 35 checks
