# [I1] Categories & Catalog -- Admin Panel V2-to-V3 Port

**One-line Summary:** Enrich the stub `/categories` hub page into a full category management panel with tree view, CRUD, drag-reorder, attribute schema management, and a catalog browser.

**Canonical Sources (read ALL before starting):**

| Doc | Why |
|-----|-----|
| `TWICELY_V3_SCHEMA_v2_1_0.md` section 4.1 (category) + 4.2 (categoryAttributeSchema) | Table definitions |
| `TWICELY_V3_PAGE_REGISTRY.md` row 123 (`/categories`) | Route gate: ADMIN, Build Phase B1 |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` sections 2.2, 3.1, 3.5, 3.6, 4.3.4 | CASL subjects: `Category` (view, create, edit, delete) |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` | No dedicated Categories domain; categories are a platform-wide taxonomy referenced in many domains |
| `TWICELY_V3_TESTING_STANDARDS.md` | Test patterns |
| `CLAUDE.md` | All code rules |

---

## 1. PREREQUISITES

### Phases/Steps That Must Be Complete
- Phase A-G: all 183 steps COMPLETE
- Phase H: H1.1-H3.1 COMPLETE (crosslister extension + connectors; irrelevant to this step)
- The `/categories` page already exists as a stub: `src/app/(hub)/categories/page.tsx`

### Tables That Must Already Exist
- `category` table (`src/lib/db/schema/catalog.ts` section 4.1) -- EXISTS, 15 columns
- `categoryAttributeSchema` table (`src/lib/db/schema/catalog.ts` section 4.2) -- EXISTS, 13 columns
- `listing` table (`src/lib/db/schema/listings.ts` section 5.1) -- EXISTS (for listing counts)

### Existing Code Inventory (DO NOT recreate; extend or import from)

| File | What It Has | What It Lacks |
|------|-------------|---------------|
| `src/lib/db/schema/catalog.ts` | Full `category` (15 cols) + `categoryAttributeSchema` (13 cols) tables with indexes | Nothing -- complete |
| `src/lib/queries/categories.ts` | `getCategoryTree()`, `getCategoryBySlug()`, `getSubcategory()`, `getCategoryById()` -- 4 public queries | All filter `isActive=true`. Admin needs ALL categories including inactive. |
| `src/lib/queries/category-search.ts` | `searchCategories(query)` with ILIKE + parent join, `getCategoryById(id)` with parentName | Also filters `isActive=true`; admin version needed without that filter |
| `src/lib/db/seed/seed-categories.ts` | 16 seed categories (4 root + 12 leaf) with hardcoded IDs in `CATEGORY_IDS` | Reference only -- do not modify |
| `src/app/(hub)/categories/page.tsx` | 47-line stub page with total + root count stat cards | Needs full tree view, CRUD actions, reorder, attribute schemas |
| `src/lib/casl/platform-abilities.ts` | ADMIN gets `manage all` (includes Category). MODERATION does NOT have Category permissions. | MODERATION needs `can('read', 'Category')` -- see CASL Gap below |
| `src/lib/casl/subjects.ts` | `'Category'` registered at line 24 | Nothing |
| `src/lib/casl/permission-registry-data.ts` | `Category` subject with name/description/category COMMERCE | Nothing |
| `src/lib/hub/admin-nav.ts` | Categories nav entry at lines 146-151: `roles: ['ADMIN', 'MODERATION']`, `href: '/categories'`, `icon: 'FolderOpen'` | DO NOT MODIFY -- reserved for I17 |
| `src/types/listings.ts` | `CategoryData` interface (id, name, slug, description, parentId, children?) | Public-facing type; admin needs extended type |
| `src/components/admin/admin-page-header.tsx` | `AdminPageHeader` component with title, description, actions slot | Reuse this in new pages |

### CASL Gap -- MODERATION Role

**Current state:** `platform-abilities.ts` does NOT grant any Category permissions to the MODERATION role. However, `admin-nav.ts` shows `roles: ['ADMIN', 'MODERATION']` for the Categories nav item.

**Actors & Security canonical (section 3.5):** The agent permissions matrix does NOT list "Manage categories" for MODERATION. However, section 3.6 (Admin) lists "Manage categories" at audit level MEDIUM. Section 4.3.4 lists `Category | view, create, edit, delete` as a custom-role permission subject. Page Registry row 123 says gate is `ADMIN` only.

**Resolution:** Follow the Page Registry (ADMIN-only gate on the page) but allow MODERATION to READ categories since the nav entry grants them sidebar visibility. All write operations remain ADMIN-only via `manage all`.

**Action for installer:** Add `can('read', 'Category')` to the MODERATION block in `src/lib/casl/platform-abilities.ts` (around line 84, inside the `if (roles.includes('MODERATION'))` block). All write operations (create/update/delete) remain ADMIN-only via `manage all`.

---

## 2. SCOPE -- EXACTLY WHAT TO BUILD

### 2.1 Database

NO new tables. Both `category` and `categoryAttributeSchema` already exist in `src/lib/db/schema/catalog.ts`.

**category table columns (reference -- from schema doc section 4.1):**
```
id              text PK (CUID2)
slug            text NOT NULL UNIQUE
parentId        text (nullable, self-referential)
name            text NOT NULL
description     text (nullable)
icon            text (nullable)
feeBucket       feeBucketEnum NOT NULL -- 'ELECTRONICS' | 'APPAREL_ACCESSORIES' | 'HOME_GENERAL' | 'COLLECTIBLES_LUXURY'
sortOrder       integer NOT NULL default 0
isActive        boolean NOT NULL default true
isLeaf          boolean NOT NULL default false
depth           integer NOT NULL default 0
path            text NOT NULL default '' -- materialized path: "electronics.phones-tablets"
metaTitle       text (nullable)
metaDescription text (nullable)
createdAt       timestamp with tz NOT NULL defaultNow
updatedAt       timestamp with tz NOT NULL defaultNow
```
Indexes: `cat_parent` (parentId), `cat_path` (path), `cat_active` (isActive).

**categoryAttributeSchema table columns (reference -- from schema doc section 4.2):**
```
id              text PK (CUID2)
categoryId      text NOT NULL FK -> category.id ON DELETE CASCADE
name            text NOT NULL        -- "brand", "size", "color", "material"
label           text NOT NULL        -- "Brand", "Size", "Color"
fieldType       text NOT NULL        -- "text" | "select" | "multi_select" | "number"
isRequired      boolean NOT NULL default false
isRecommended   boolean NOT NULL default false
showInFilters   boolean NOT NULL default false
showInListing   boolean NOT NULL default true
optionsJson     jsonb NOT NULL default '[]'   -- For select/multi_select
validationJson  jsonb NOT NULL default '{}'
sortOrder       integer NOT NULL default 0
createdAt       timestamp with tz NOT NULL defaultNow
updatedAt       timestamp with tz NOT NULL defaultNow
```
Indexes: `cas_category` (categoryId).

**feeBucketEnum values (from `src/lib/db/schema/enums.ts` line 121):**
```typescript
['ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY']
```
NOTE: Schema doc says this column is "retained from pre-v3.2, NOT used in TF calc" (v3.2 uses progressive volume brackets). Still a required column. Display it in admin UI but with a muted note: "Legacy -- not used for transaction fee calculation."

### 2.2 CASL Update

**File:** `src/lib/casl/platform-abilities.ts`

Add ONE line to the MODERATION block (inside `if (roles.includes('MODERATION'))`, around line 84-105):
```typescript
can('read', 'Category');
```

This allows MODERATION staff to view the category tree (consistent with admin-nav.ts `roles: ['ADMIN', 'MODERATION']`). All write operations remain ADMIN-only via `manage all`.

### 2.3 Zod Validation Schemas

**File:** `src/lib/validations/admin-categories.ts` (NEW)

All schemas use `.strict()` to reject unknown keys.

```typescript
// createCategorySchema
z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  feeBucket: z.enum(['ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY']),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isLeaf: z.boolean().default(false),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
}).strict();

// updateCategorySchema
z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  feeBucket: z.enum(['ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isLeaf: z.boolean().optional(),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
}).strict();

// reorderCategoriesSchema
z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
}).strict();

// createAttributeSchemaInput
z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  fieldType: z.enum(['text', 'select', 'multi_select', 'number']),
  isRequired: z.boolean().default(false),
  isRecommended: z.boolean().default(false),
  showInFilters: z.boolean().default(false),
  showInListing: z.boolean().default(true),
  optionsJson: z.array(z.string()).default([]),
  validationJson: z.record(z.unknown()).default({}),
  sortOrder: z.number().int().min(0).default(0),
}).strict();

// updateAttributeSchemaInput
z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  fieldType: z.enum(['text', 'select', 'multi_select', 'number']).optional(),
  isRequired: z.boolean().optional(),
  isRecommended: z.boolean().optional(),
  showInFilters: z.boolean().optional(),
  showInListing: z.boolean().optional(),
  optionsJson: z.array(z.string()).optional(),
  validationJson: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();
```

### 2.4 Server Actions

**File:** `src/lib/actions/admin-categories.ts` (NEW, `'use server'`)

Follow the established pattern from `src/lib/actions/kb-categories.ts`:
- `'use server'` directive at top
- `staffAuthorize()` for session
- CASL check: `ability.can('manage', 'Category')` for write ops, `ability.can('read', 'Category')` for reads
- Zod `.safeParse()` with `.strict()` schemas
- Explicit field mapping (NEVER spread request body)
- `revalidatePath('/categories')` after mutations
- Return `ActionResult<T>` shape: `{ success: boolean; error?: string; data?: T }`

| Action | CASL Check | Description |
|--------|------------|-------------|
| `createCategory(formData)` | `manage, Category` | Insert new category. Auto-compute `depth` and `path` from parentId. If parent was isLeaf=true, update parent to isLeaf=false. |
| `updateCategory(formData)` | `manage, Category` | Update category fields. If parentId changes, recompute `depth`, `path`, `isLeaf` for self + all descendants. Prevent circular parent references. |
| `deleteCategory(categoryId)` | `manage, Category` | Soft-delete (set `isActive=false`). Refuse if category has ACTIVE listings. Refuse if category has active subcategories. |
| `reorderCategories(data)` | `manage, Category` | Update `sortOrder` for an array of category IDs. |
| `createAttributeSchema(formData)` | `manage, Category` | Insert new attribute schema row for a category. |
| `updateAttributeSchema(formData)` | `manage, Category` | Update attribute schema fields. Explicit field mapping. |
| `deleteAttributeSchema(id)` | `manage, Category` | Hard-delete attribute schema row (ON DELETE CASCADE exists in schema, but this is an explicit delete of a single attribute schema, not via cascade). |

**Critical business logic for `createCategory`:**
```typescript
// Auto-compute depth and path -- unexported helper
function computeDepthAndPath(parent: { depth: number; path: string } | null, slug: string) {
  if (parent) {
    return { depth: parent.depth + 1, path: parent.path ? `${parent.path}.${slug}` : slug };
  }
  return { depth: 0, path: slug };
}

// When creating a child:
// 1. Look up parent by parentId
// 2. Compute depth + path
// 3. If parent.isLeaf === true, update parent to isLeaf = false
```

**Critical business logic for `deleteCategory` (soft-delete):**
```typescript
// 1. Verify category exists
// 2. Count ACTIVE listings in this category
const [listingCount] = await db.select({ cnt: count() }).from(listing)
  .where(and(eq(listing.categoryId, categoryId), eq(listing.status, 'ACTIVE')));
if (listingCount.cnt > 0) {
  return { success: false, error: `Cannot deactivate: ${listingCount.cnt} active listing(s) in this category.` };
}
// 3. Check for active child categories
const [childCount] = await db.select({ cnt: count() }).from(category)
  .where(and(eq(category.parentId, categoryId), eq(category.isActive, true)));
if (childCount.cnt > 0) {
  return { success: false, error: `Cannot deactivate: ${childCount.cnt} active subcategory(ies) exist.` };
}
// 4. Soft-delete
await db.update(category).set({ isActive: false, updatedAt: new Date() }).where(eq(category.id, categoryId));
```

**Critical business logic for `updateCategory` with parentId change:**
```typescript
// 1. Prevent self-reference: newParentId !== category.id
// 2. Prevent circular reference: check proposed parent's path does NOT start with category's current path
//    (use the `path` column -- if parent.path.startsWith(category.path + '.'), it is a descendant)
// 3. Recompute depth + path for self
// 4. Recompute depth + path for ALL descendants (query by path LIKE 'oldPath.%')
//    For each descendant, replace the oldPath prefix with newPath
```

**CRITICAL: Keep helpers unexported.** Any helper function (e.g., `computeDepthAndPath`, `recomputeDescendants`) must NOT be exported from the `'use server'` file, or it becomes an unintended server action. Use `function` declarations (not `export function`).

### 2.5 Admin Queries

**File:** `src/lib/queries/admin-categories.ts` (NEW)

These are admin-specific queries that return ALL categories (including `isActive=false`). DO NOT modify the existing public queries in `src/lib/queries/categories.ts`.

| Query | Returns | Notes |
|-------|---------|-------|
| `getAdminCategoryTree()` | Full tree with all categories (active + inactive), listing counts per category, attribute schema counts | Used by `/categories` page |
| `getAdminCategoryById(id)` | Single category with all fields, children, listing count, attribute schemas | Used by `/categories/[id]` page |
| `getAdminCatalogBrowser(filters)` | Flat list with search, pagination, filter by isActive/feeBucket/depth | Used by `/categories/catalog` page |

**`getAdminCategoryTree()` return shape:**
```typescript
interface AdminCategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  feeBucket: string;
  sortOrder: number;
  isActive: boolean;
  isLeaf: boolean;
  depth: number;
  path: string;
  listingCount: number;
  attributeSchemaCount: number;
  children: AdminCategoryNode[];
}
```

Query strategy: Two parallel queries -- (1) all categories unfiltered, (2) listing counts grouped by categoryId where status='ACTIVE', (3) attribute schema counts grouped by categoryId. Then build tree in-memory (same pattern as existing `getCategoryTree()` in `src/lib/queries/categories.ts`).

**`getAdminCategoryById(id)` return shape:**
```typescript
interface AdminCategoryDetail {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  description: string | null;
  icon: string | null;
  feeBucket: string;
  sortOrder: number;
  isActive: boolean;
  isLeaf: boolean;
  depth: number;
  path: string;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  listingCount: number;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    sortOrder: number;
    listingCount: number;
  }>;
  attributeSchemas: Array<{
    id: string;
    name: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    isRecommended: boolean;
    showInFilters: boolean;
    showInListing: boolean;
    optionsJson: unknown;
    validationJson: unknown;
    sortOrder: number;
  }>;
}
```

**`getAdminCatalogBrowser(filters)` filter shape:**
```typescript
interface CatalogBrowserFilters {
  search?: string;           // ILIKE on name
  isActive?: boolean;        // filter by active/inactive
  feeBucket?: string;        // filter by fee bucket
  parentId?: string | null;  // null = root categories only, string = children of this parent
  page?: number;             // 1-indexed, default 1
  pageSize?: number;         // default 50
}
```

Returns `{ categories: Array<FlatCategoryRow>; totalCount: number; page: number; totalPages: number }`.

### 2.6 Pages

#### 2.6.1 Enrich: `/categories` (page.tsx)

**File:** `src/app/(hub)/categories/page.tsx` (MODIFY existing 47-line stub)

**Gate:** `ability.can('read', 'Category')` (allows ADMIN + MODERATION with the new read grant)

Replace the current stub with a full category tree management page:

1. **Summary stats row:** Total categories, Root categories, Active categories, Inactive categories (use existing stat card styling from current stub)
2. **Category tree component:** `CategoryTreeView` showing all categories hierarchically
   - Each node shows: name, slug, fee bucket badge, listing count, active/inactive badge
   - Inactive categories shown with muted/grayed styling
   - Expand/collapse for parent categories
   - Drag-to-reorder within same parent level (calls `reorderCategories` action)
   - Click on category name navigates to `/categories/[id]`
3. **Action buttons (ADMIN only -- hide for MODERATION via `ability.can('manage', 'Category')`):**
   - "Add Root Category" button (navigates to `/categories/new`)
   - "Catalog Browser" link (navigates to `/categories/catalog`)
4. **Quick filters:** Show All / Active Only / Inactive Only

**NAV comment at top of file (do NOT modify admin-nav.ts):**
```typescript
// NAV_ENTRY: { key: 'categories', label: 'Categories', href: '/categories', icon: 'FolderOpen', roles: ['ADMIN', 'MODERATION'] }
```

Use `AdminPageHeader` component from `src/components/admin/admin-page-header.tsx` for the page header.

#### 2.6.2 New: `/categories/[id]` (Category Detail + Edit)

**File:** `src/app/(hub)/categories/[id]/page.tsx` (NEW)

**Gate:** `ability.can('read', 'Category')`

Category detail page with:

1. **Breadcrumb:** Categories > {Parent Name (if any)} > {Category Name}
2. **Header:** Category name + active/inactive badge + Edit/Deactivate buttons (ADMIN only)
3. **Detail card:**
   - Name, slug, description, icon, fee bucket (with "Legacy" muted note), sort order
   - Depth, materialized path
   - Meta title, meta description (SEO fields)
   - Created/updated timestamps
   - Listing count (display as stat; when linking to filtered listings page becomes available in future, add link)
4. **Subcategories section:** (visible only if category has children or isLeaf=false)
   - Table of child categories with name, slug, listing count, active status, sort order
   - Drag-to-reorder children
   - "Add Subcategory" button (ADMIN only, navigates to `/categories/new?parentId={id}`)
5. **Attribute Schemas section:**
   - Table of attribute schemas for this category (using `AttributeSchemaTable` component)
   - Columns: name, label, field type, required, recommended, filter, listing, sort order
   - Add/Edit/Delete buttons (ADMIN only)
6. **Edit form (ADMIN only):**
   - Inline section or slide-out panel using `CategoryForm` component in edit mode
   - All editable fields from the category table
   - Parent selector (dropdown of all categories, excluding self and descendants to prevent cycles)
   - Save / Cancel buttons
   - "Deactivate" button with confirmation dialog showing listing + subcategory counts

```typescript
// NAV_ENTRY: child of /categories -- no separate nav entry needed
```

#### 2.6.3 New: `/categories/new` (Create Category)

**File:** `src/app/(hub)/categories/new/page.tsx` (NEW)

**Gate:** `ability.can('create', 'Category')` (effectively ADMIN-only since only ADMIN has `manage all`)

Create category form using `CategoryForm` component in create mode:

1. **Back link:** "Back to Categories" arrow link (same pattern as `/kb/new`)
2. **Form fields:**
   - Name (text input, required)
   - Slug (text input, auto-generated from name but editable, validated: lowercase alphanumeric with hyphens)
   - Parent category (select: "None (root category)" + all existing active categories; pre-select from `?parentId` query param if present)
   - Description (textarea, optional)
   - Icon (text input for icon name, optional)
   - Fee bucket (select: ELECTRONICS, APPAREL_ACCESSORIES, HOME_GENERAL, COLLECTIBLES_LUXURY)
   - Sort order (number input, default 0)
   - Is active (checkbox, default true)
   - Is leaf (checkbox, default false -- help text: "Leaf categories cannot have subcategories")
   - Meta title (text input, optional, max 70 chars, for SEO)
   - Meta description (textarea, optional, max 160 chars, for SEO)
3. **Submit:** Calls `createCategory` server action
4. **On success:** Redirect to `/categories/{newId}`
5. **On error:** Show inline error message

```typescript
// NAV_ENTRY: child of /categories -- no separate nav entry needed
```

#### 2.6.4 New: `/categories/catalog` (Catalog Browser)

**File:** `src/app/(hub)/categories/catalog/page.tsx` (NEW)

**Gate:** `ability.can('read', 'Category')`

Flat catalog view with search, filters, and pagination:

1. **Header:** "Catalog Browser" with back link to `/categories`
2. **Search bar:** Search categories by name
3. **Filters:** Active/Inactive toggle, Fee bucket dropdown, Depth selector (All / Root only / Leaf only)
4. **Results table:** Paginated table with columns:
   - Name (link to `/categories/[id]`)
   - Slug
   - Parent (parent name or "Root")
   - Fee Bucket (badge)
   - Depth
   - Listing Count
   - Active (green/red badge)
5. **Pagination:** Server-side, 50 per page
6. **Sort:** By name, listing count, sort order, created date (via URL search params)

```typescript
// NAV_ENTRY: { key: 'categories-catalog', label: 'Catalog Browser', href: '/categories/catalog', icon: 'Grid', roles: ['ADMIN', 'MODERATION'] }
```

### 2.7 Components

Create reusable `'use client'` components in `src/components/admin/`:

| Component | File | Description |
|-----------|------|-------------|
| `CategoryTreeView` | `category-tree-view.tsx` | Recursive tree with expand/collapse, drag handles for reorder, active/inactive badges, listing count + fee bucket display. Props: `nodes: AdminCategoryNode[]`, `canManage: boolean`, `onReorder: (orderedIds: string[]) => Promise<void>`. |
| `CategoryForm` | `category-form.tsx` | Shared form for create + edit. Props: `mode: 'create' \| 'edit'`, `initialData?: Partial<CategoryFormData>`, `categories: Array<{id, name, depth}>` (for parent selector). Calls `createCategory` or `updateCategory` server actions. Auto-generates slug from name on create (editable). |
| `AttributeSchemaTable` | `attribute-schema-table.tsx` | Table displaying attribute schemas with Add/Edit/Delete controls. Props: `categoryId: string`, `schemas: AdminCategoryDetail['attributeSchemas']`, `canManage: boolean`. |
| `AttributeSchemaForm` | `attribute-schema-form.tsx` | Modal or inline form for creating/editing attribute schemas. Shows `optionsJson` field only when fieldType is `select` or `multi_select`. Calls `createAttributeSchema` or `updateAttributeSchema` server actions. |

All components are `'use client'` since they involve forms, expand/collapse state, or drag interactions.

---

## 3. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
- NO `SellerTier`, `SubscriptionTier`, `FVF`, `Final Value Fee`, `BASIC` (as tier), `ELITE`, `PLUS` (as tier), `MAX`, `PREMIUM`, `STANDARD` (as band), `RISING`
- NO `Twicely Balance`, `wallet`, `Withdraw`
- These are unlikely in categories admin UI but scan all output before committing

### Banned Tech
- NO Prisma (use Drizzle)
- NO NextAuth (use Better Auth -- not relevant here)
- NO tRPC (use server actions)
- NO Zustand/Redux (use React context + server state)

### Banned Code Patterns
- NO `as any`, `as unknown as T`, `@ts-ignore`, `@ts-expect-error`
- NO files over 300 lines (split into separate files if approaching limit)
- NO spreading request body into DB updates (explicit field mapping ONLY)
- NO exported helper functions from `'use server'` files (= unintended server actions)
- NO hardcoded fee rates (feeBucket is a category property, not a rate)
- NO `console.log` in production code

### Route Rules
- All hub pages use the `(hub)` route group
- Categories route is `/categories` (NOT `/cfg/categories`, NOT `/catalog`)
- Sub-routes: `/categories/[id]`, `/categories/new`, `/categories/catalog`

### DO NOT MODIFY These Files
- `src/lib/hub/admin-nav.ts` -- reserved for I17 (final nav wiring step)
- `src/lib/db/schema/catalog.ts` -- schema is locked, tables already exist
- `src/lib/queries/categories.ts` -- public-facing queries; create SEPARATE admin queries file
- `src/lib/queries/category-search.ts` -- listing/seller-facing search; do not touch
- `src/lib/db/seed/seed-categories.ts` -- seed data reference only; do not modify

### Prevent Circular Parent References
When updating a category's `parentId`, validate that the new parent is NOT:
1. The category itself (`newParentId !== categoryId`)
2. Any descendant of the category (would create a cycle)

Use the `path` column for descendant check: if the proposed parent's `path` starts with `{category.path}.`, it is a descendant. This leverages the materialized path pattern already in use.

---

## 4. ACCEPTANCE CRITERIA

### Functional
- [ ] `/categories` page renders a full hierarchical tree of ALL categories (active AND inactive)
- [ ] Each tree node shows: name, slug, fee bucket badge, listing count, active/inactive indicator
- [ ] Inactive categories are visually distinct (muted/grayed styling)
- [ ] Clicking a category name navigates to `/categories/[id]`
- [ ] "Add Root Category" button visible only for ADMIN (hidden for MODERATION)
- [ ] `/categories/[id]` shows full category detail including children and attribute schemas
- [ ] `/categories/[id]` shows listing count for this category
- [ ] `/categories/[id]` edit form allows updating all editable fields (ADMIN only)
- [ ] `/categories/new` form creates a category with auto-computed `depth` and `path`
- [ ] `/categories/new?parentId=X` pre-selects parent X in the parent dropdown
- [ ] `/categories/catalog` shows a flat, searchable, filterable, paginated table of all categories
- [ ] Drag-to-reorder works within the same parent level on `/categories` tree and `/categories/[id]` children
- [ ] Attribute schemas can be added, edited, and deleted from the category detail page (ADMIN only)

### Authorization
- [ ] ADMIN can perform all CRUD operations on categories and attribute schemas
- [ ] MODERATION staff can view categories (read-only) but CANNOT create/update/delete
- [ ] MODERATION staff sees the tree but NOT the Add/Edit/Delete buttons
- [ ] Unauthenticated users cannot access any `/categories` hub page (`staffAuthorize()` throws ForbiddenError)
- [ ] CASL check on every server action: `manage, Category` for writes, `read, Category` for reads
- [ ] SUPPORT, FINANCE, DEVELOPER, SRE roles CANNOT access category pages (no `can('read', 'Category')` in their blocks)

### Data Integrity
- [ ] `createCategory` auto-computes `depth` from parent chain
- [ ] `createCategory` auto-computes `path` as materialized dot-separated path (e.g., `electronics.phones-tablets`)
- [ ] When creating a child, parent's `isLeaf` is set to `false` if it was `true`
- [ ] `deleteCategory` refuses if category has ACTIVE listings (returns error with count)
- [ ] `deleteCategory` refuses if category has active subcategories (returns error with count)
- [ ] `deleteCategory` is soft-delete (`isActive=false`), NOT hard-delete
- [ ] `updateCategory` with changed `parentId` recomputes `depth` + `path` for self AND all descendants
- [ ] Circular parent references are prevented (category cannot be its own ancestor)
- [ ] Slug uniqueness is enforced (DB unique constraint on `category.slug` already exists)
- [ ] `deleteAttributeSchema` is a hard-delete of the `categoryAttributeSchema` row

### Validation
- [ ] All inputs pass Zod `.strict()` validation (unknown keys rejected)
- [ ] Slug format: lowercase alphanumeric with hyphens only (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`)
- [ ] Name: 1-100 characters
- [ ] Description: max 500 characters
- [ ] Meta title: max 70 characters
- [ ] Meta description: max 160 characters
- [ ] Fee bucket must be one of the 4 enum values
- [ ] Attribute schema `fieldType` must be one of: `text`, `select`, `multi_select`, `number`

### Code Quality
- [ ] All files under 300 lines
- [ ] Zero `as any`, `@ts-ignore`, `@ts-expect-error`
- [ ] No exported helpers from `'use server'` files
- [ ] Explicit field mapping on ALL DB updates (never spread)
- [ ] TypeScript strict mode: zero errors
- [ ] No `console.log` in production code

---

## 5. TEST REQUIREMENTS

### Unit Tests for Server Actions

**File:** `src/lib/actions/__tests__/admin-categories.test.ts`

Follow the EXACT pattern from `src/lib/actions/__tests__/kb-categories-crud.test.ts`:
- `vi.mock('@/lib/db', () => ({ db: mockDb }))` with mockDb object
- `vi.mock('@/lib/casl/staff-authorize', () => ({ staffAuthorize: mockStaffAuthorize }))`
- `vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))`
- `makeSelectChain(rows)`, `makeInsertChain()`, `makeUpdateChain()`, `makeDeleteChain()` helpers
- `makeAdminSession()` -- ability.can always returns true
- `makeModSession()` -- ability.can returns true for `('read', 'Category')`, false for `('manage', 'Category')`
- `beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); })`
- Dynamic import: `const { createCategory } = await import('../admin-categories');`

```
describe('createCategory')
  it('returns access denied for non-admin (MODERATION)')
  it('rejects invalid slug format (uppercase, spaces)')
  it('creates root category with depth=0 and path=slug')
  it('creates child category with computed depth and path from parent')
  it('sets parent isLeaf to false when adding first child')
  it('rejects unknown keys in input (strict mode)')

describe('updateCategory')
  it('returns access denied for non-admin')
  it('updates name and slug fields')
  it('recomputes path when parentId changes')
  it('rejects circular parent reference (self)')
  it('rejects circular parent reference (descendant via path check)')
  it('always sets updatedAt')

describe('deleteCategory')
  it('returns access denied for non-admin')
  it('refuses to deactivate category with active listings (returns count)')
  it('refuses to deactivate category with active subcategories (returns count)')
  it('soft-deletes category (sets isActive=false, not hard-delete)')
  it('returns not found for nonexistent category')

describe('reorderCategories')
  it('returns access denied for non-admin')
  it('updates sortOrder for each ID in array order')

describe('createAttributeSchema')
  it('returns access denied for non-admin')
  it('creates attribute schema with all fields mapped explicitly')
  it('rejects invalid fieldType value')

describe('updateAttributeSchema')
  it('updates only specified fields, always sets updatedAt')

describe('deleteAttributeSchema')
  it('hard-deletes attribute schema row')
  it('returns not found for nonexistent schema')
```

### Unit Tests for Admin Queries

**File:** `src/lib/queries/__tests__/admin-categories.test.ts`

```
describe('getAdminCategoryTree')
  it('returns all categories including inactive')
  it('builds correct tree structure with nested children')
  it('includes listing counts per category')
  it('includes attribute schema counts per category')

describe('getAdminCategoryById')
  it('returns null for non-existent ID')
  it('returns full detail with children and attribute schemas')
  it('includes parent name when category has a parent')

describe('getAdminCatalogBrowser')
  it('returns paginated results with correct page/totalPages')
  it('filters by search term (name ILIKE)')
  it('filters by isActive flag')
  it('filters by feeBucket enum value')
  it('filters by parentId (null for roots only)')
```

### Unit Tests for Validation Schemas

**File:** `src/lib/validations/__tests__/admin-categories.test.ts`

```
describe('createCategorySchema')
  it('accepts valid input with all fields')
  it('accepts minimal valid input (name + slug + feeBucket only)')
  it('rejects missing name')
  it('rejects invalid slug (uppercase characters)')
  it('rejects invalid slug (spaces)')
  it('rejects unknown keys (strict mode)')
  it('rejects invalid feeBucket value')
  it('rejects name over 100 characters')

describe('updateCategorySchema')
  it('requires id field')
  it('accepts partial updates (only name)')
  it('rejects unknown keys (strict mode)')

describe('createAttributeSchemaInput')
  it('accepts valid input')
  it('rejects invalid fieldType')
  it('defaults isRequired to false')
  it('defaults showInListing to true')
```

### CASL Tests

**File:** `src/lib/casl/__tests__/category-admin-abilities.test.ts`

Follow the pattern from `src/lib/casl/__tests__/helpdesk-abilities.test.ts`:
- Use `createPlatformStaffSession(roles)` helper
- Call `defineAbilitiesFor(session)` directly
- Test actual CASL ability evaluation

```
describe('Category CASL permissions')
  it('ADMIN can manage Category')
  it('MODERATION can read Category')
  it('MODERATION cannot create Category')
  it('MODERATION cannot update Category')
  it('MODERATION cannot delete Category')
  it('SUPPORT cannot read Category')
  it('DEVELOPER cannot read Category')
  it('FINANCE cannot read Category')
  it('HELPDESK_AGENT cannot read Category')
```

### Target Test Count
- Server actions: ~22 tests
- Admin queries: ~10 tests
- Validation schemas: ~12 tests
- CASL: ~9 tests
- **Total: ~53 new tests**

---

## 6. FILE APPROVAL LIST

The installer MUST propose this file list and wait for approval before coding.

### New Files (14)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/validations/admin-categories.ts` | Zod schemas (all with `.strict()`): createCategory, updateCategory, reorderCategories, createAttributeSchema, updateAttributeSchema |
| 2 | `src/lib/actions/admin-categories.ts` | Server actions: createCategory, updateCategory, deleteCategory, reorderCategories, createAttributeSchema, updateAttributeSchema, deleteAttributeSchema |
| 3 | `src/lib/queries/admin-categories.ts` | Admin queries: getAdminCategoryTree, getAdminCategoryById, getAdminCatalogBrowser (all include inactive categories) |
| 4 | `src/app/(hub)/categories/[id]/page.tsx` | Category detail page: breadcrumb, detail card, subcategories table, attribute schemas table, edit form (ADMIN) |
| 5 | `src/app/(hub)/categories/new/page.tsx` | Create category form page with parent pre-selection via query param |
| 6 | `src/app/(hub)/categories/catalog/page.tsx` | Flat catalog browser: search, filters (active/inactive, feeBucket, depth), paginated table |
| 7 | `src/components/admin/category-tree-view.tsx` | Client component: recursive tree with expand/collapse, drag-reorder handles, badges |
| 8 | `src/components/admin/category-form.tsx` | Client component: shared create/edit form with slug auto-generation, parent dropdown |
| 9 | `src/components/admin/attribute-schema-table.tsx` | Client component: attribute schema table with add/edit/delete controls |
| 10 | `src/components/admin/attribute-schema-form.tsx` | Client component: attribute schema create/edit form (conditional optionsJson field) |
| 11 | `src/lib/validations/__tests__/admin-categories.test.ts` | Validation schema tests (~12 tests) |
| 12 | `src/lib/actions/__tests__/admin-categories.test.ts` | Server action tests (~22 tests) |
| 13 | `src/lib/queries/__tests__/admin-categories.test.ts` | Admin query tests (~10 tests) |
| 14 | `src/lib/casl/__tests__/category-admin-abilities.test.ts` | CASL permission tests (~9 tests) |

### Modified Files (2)

| # | File Path | Change Description |
|---|-----------|-------------------|
| 15 | `src/app/(hub)/categories/page.tsx` | Replace 47-line stub with full tree management page using AdminPageHeader + CategoryTreeView + stats |
| 16 | `src/lib/casl/platform-abilities.ts` | Add `can('read', 'Category')` to the MODERATION block (one line addition) |

### Files NOT Modified (Explicitly Locked)

| File | Reason |
|------|--------|
| `src/lib/hub/admin-nav.ts` | Reserved for I17 (final nav wiring) |
| `src/lib/db/schema/catalog.ts` | Schema is locked; tables already exist |
| `src/lib/queries/categories.ts` | Public-facing queries; admin queries go in separate file |
| `src/lib/queries/category-search.ts` | Listing/seller-facing search; do not touch |
| `src/lib/db/seed/seed-categories.ts` | Seed data reference only |

---

## 7. VERIFICATION CHECKLIST

After implementation, run these commands and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Full test suite
pnpm test

# 3. Unified lint check
./twicely-lint.sh

# 4. Banned terms check in new files (should return 0 matches)
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|STANDARD\|RISING\|Twicely Balance\|wallet\|Withdraw" \
  src/lib/actions/admin-categories.ts \
  src/lib/queries/admin-categories.ts \
  src/lib/validations/admin-categories.ts \
  "src/app/(hub)/categories/" \
  src/components/admin/category-*.tsx \
  src/components/admin/attribute-schema-*.tsx \
  || echo "No banned terms found"

# 5. File size check (all files must be under 300 lines)
wc -l \
  src/lib/actions/admin-categories.ts \
  src/lib/queries/admin-categories.ts \
  src/lib/validations/admin-categories.ts \
  "src/app/(hub)/categories/page.tsx" \
  "src/app/(hub)/categories/[id]/page.tsx" \
  "src/app/(hub)/categories/new/page.tsx" \
  "src/app/(hub)/categories/catalog/page.tsx" \
  src/components/admin/category-tree-view.tsx \
  src/components/admin/category-form.tsx \
  src/components/admin/attribute-schema-table.tsx \
  src/components/admin/attribute-schema-form.tsx

# 6. Verify CASL update was applied
grep -n "Category" src/lib/casl/platform-abilities.ts

# 7. Verify no exported helpers from 'use server' file
grep -n "^export " src/lib/actions/admin-categories.ts | grep -v "async function"
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= BASELINE_TESTS (currently 8293 per build tracker v1.87; check CLAUDE.md for authoritative baseline)
- All new/modified files under 300 lines each
- Zero banned terms in new code
- MODERATION block in platform-abilities.ts includes `can('read', 'Category')`
- No exported non-async-function symbols from admin-categories.ts actions file
- twicely-lint.sh passes all 7 checks

---

## 8. DECOMPOSITION NOTES

This step is sized for a single implementation pass (~60-90 minutes). If the installer finds it too large, split into:

- **I1.1:** Validation schemas + server actions + action tests (~35 min)
- **I1.2:** Admin queries + query tests (~20 min)
- **I1.3:** Pages + components + CASL update + CASL tests (~35 min)

However, a single pass is recommended since the pages depend on queries/actions and testing them end-to-end is more reliable than testing in isolation.

---

## 9. SPEC GAPS AND OWNER DECISIONS NEEDED

1. **Drag-to-reorder implementation:** The spec does not mandate a specific drag-and-drop library. Options: (a) `@dnd-kit/core` for full drag-and-drop, or (b) simpler up/down arrow buttons. **NOT SPECIFIED -- owner decision needed: Which drag-reorder approach?** Recommendation: up/down arrow buttons for simplicity (less client JS, no new dependency). Can upgrade to dnd-kit later.

2. **Attribute schema editing UX:** The spec does not specify whether attribute schema editing should use inline editing, a modal dialog, or a separate page. **NOT SPECIFIED -- owner decision needed: Inline table editing, modal form, or separate page?** Recommendation: modal dialog (consistent with shadcn/ui patterns, keeps page clean).

3. **feeBucket display:** The schema has `feeBucket` as NOT NULL but the schema doc says it's "retained from pre-v3.2" and "NOT used in TF calc." The admin UI should display it as an editable field with a muted note explaining it is legacy. This is not an owner decision -- just documenting the approach for clarity.

4. **Category deletion strategy:** Soft-delete (`isActive=false`) is used rather than hard-delete. Hard-delete would cascade `categoryAttributeSchema` (via ON DELETE CASCADE) but would orphan `listing.categoryId` references. **Decision: Soft-delete is correct.** This is consistent with the existing isActive pattern and protects referential integrity.
