# I1 Categories & Catalog -- Research Findings

## Key Discoveries

### CASL Gap
- MODERATION role has NO Category permissions in `platform-abilities.ts`
- But `admin-nav.ts` line 146-151 shows `roles: ['ADMIN', 'MODERATION']`
- Page Registry row 123 says gate is ADMIN only
- Resolution: Add `can('read', 'Category')` to MODERATION block for read-only access

### Existing Code Inventory
- `src/lib/db/schema/catalog.ts`: category (15 cols) + categoryAttributeSchema (13 cols)
- `src/lib/queries/categories.ts`: 4 public queries (all filter isActive=true)
- `src/lib/queries/category-search.ts`: searchCategories + getCategoryById (with parentName, isLeaf, depth)
- `src/lib/db/seed/seed-categories.ts`: 16 seed categories (4 root + 12 leaf), hardcoded IDs
- `src/app/(hub)/categories/page.tsx`: 47-line stub with total + root counts
- `src/components/admin/admin-page-header.tsx`: reusable header with title/description/actions
- NO existing admin-categories actions or queries

### Schema Details
- `feeBucketEnum`: ELECTRONICS, APPAREL_ACCESSORIES, HOME_GENERAL, COLLECTIBLES_LUXURY (enums.ts line 121)
- `category.path`: materialized path using dot separator (e.g., "electronics.phones-tablets")
- `category.isLeaf`: boolean, must be maintained when adding/removing children
- `category.depth`: integer, 0 for root, must be recomputed on parent change
- `categoryAttributeSchema.fieldType`: text | select | multi_select | number
- `categoryAttributeSchema` has ON DELETE CASCADE from category
- `category.slug` has UNIQUE constraint

### Pattern Match: kb-categories.ts
- Closest existing CRUD pattern is `src/lib/actions/kb-categories.ts`
- Uses: staffAuthorize(), ability.can('manage', 'KbCategory'), Zod validation
- Has: createKbCategory, updateKbCategory, deleteKbCategory, reorderKbCategories
- Test pattern in `__tests__/kb-categories-crud.test.ts`: dynamic imports, makeSelectChain/makeUpdateChain helpers

### Pattern Match: helpdesk-abilities.test.ts
- CASL test pattern: createPlatformStaffSession(roles) -> defineAbilitiesFor(session) -> ability.can() assertions
- Tests both positive (can) and negative (cannot) cases per role

### Feature Lock-in
- No dedicated "Categories" domain section in Feature Lock-in
- Categories referenced in: search filters (section 28), listing form (section 24), buyer protection (coverage limits), KYC (category-specific verification)
- feeBucket column noted as "retained from pre-v3.2, NOT used in TF calc"
- Section 24: Category selection drives dynamic form fields (attribute schemas)
- Section 28: CategoryAttributeSchema with showInFilters=true drives search filters
- Section 29: Condition-specific categories stored in CategoryAttributeSchema

### Spec Inconsistency (Minor)
- Page Registry says ADMIN-only gate for /categories
- admin-nav.ts has ['ADMIN', 'MODERATION'] roles
- Actors doc section 3.5 agent matrix has NO Category row for MODERATION
- Resolution: ADMIN-only writes, MODERATION gets read-only via single CASL line addition

## Current State (2026-03-19)
- Build tracker: v1.87, 8293 tests, 650 files
- CLAUDE.md baseline: 7990 tests (may be stale; tracker is newer)
- H3.1 Shopify OAuth now COMPLETE

## Files Produced
- Install prompt: `.claude/install-prompts/I1-categories-catalog.md`
- 16 files total (14 new + 2 modified), ~53 new tests
- 2 owner decisions flagged (drag library, attribute schema UX)
