# TWICELY V3 — Catalog Normalization (Designed Now, Built Post-Launch)

**Version:** v1.0 | **Date:** 2026-04-08 | **Status:** DEFERRED (post-launch Wave 3, months 6–12)
**Source:** Ported from Twicely V2 `TWICELY_V2_INSTALL_PHASE_35_CATALOG_NORMALIZATION.md`
**Blocks:** `TWICELY_V3_INTERNATIONAL_DEFERRED.md` (catalog must normalize before translation)

---

## 1. WHY DEFERRED

Normalized catalog (item specifics, variants, faceted search) is the foundation for:
- High-quality search and filtering
- Accurate crosslister attribute mapping (eBay, Poshmark, Depop, etc all want size/color/brand)
- Meaningful translation (normalize "Gucci" before translating to Japanese)
- Catalog-wide analytics

Launch can ship with free-text listings. Normalization retrofits well because it's **additive** — existing listings stay valid; new listings get enforced attributes per category.

**Pre-launch sellers will paste brand names inconsistently.** That's fine. The post-launch backfill job canonicalizes them.

---

## 2. CORE MODEL

Four tables. Each listing gets:
- A `Category` with materialized path (`electronics/phones/smartphones`)
- `ListingAttribute` rows for flat facets (brand, color, material)
- `ListingVariant` rows if it has size/color permutations

```typescript
// Drizzle schema (adapt from V2 Prisma)

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  path: text("path").notNull(),         // materialized path
  level: integer("level").default(0),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categoryAttributes = pgTable("category_attributes", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  key: text("key").notNull(),            // "brand", "size", "color"
  label: text("label").notNull(),
  type: text("type").notNull(),          // string|number|enum|bool
  options: text("options").array(),      // for enum
  required: boolean("required").default(false),
  filterable: boolean("filterable").default(true),
  sortOrder: integer("sort_order").default(0),
}, (t) => ({
  categoryKey: uniqueIndex("cat_key_unq").on(t.categoryId, t.key),
}));

export const listingAttributes = pgTable("listing_attributes", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (t) => ({
  listingKey: uniqueIndex("lst_attr_unq").on(t.listingId, t.key),
  facetIdx: index("facet_idx").on(t.key, t.value),
}));

export const listingVariants = pgTable("listing_variants", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  sku: text("sku"),
  attributes: jsonb("attributes").notNull(),  // { size: "M", color: "Black" }
  priceCents: integer("price_cents").notNull(),
  comparePriceCents: integer("compare_price_cents"),
  quantity: integer("quantity").default(0),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  imageUrl: text("image_url"),
});
```

---

## 3. INVARIANTS

1. Attributes are defined per category; children inherit parent attributes (walk the path)
2. Required attributes block listing publish
3. Variants share the parent listing's base data (title, description, images)
4. Each variant has unique `(listingId, attributes)` — no duplicate combos
5. One default variant per listing
6. Faceted search uses `(key, value)` index on `listingAttributes`

---

## 4. ATTRIBUTE TYPES

- `string` — free text (e.g., "Brand": "Gucci")
- `number` — numeric (e.g., "Screen Size": 6.1)
- `enum` — predefined options with validation (e.g., "Condition": ["New", "Used", "Refurbished"])
- `bool` — true/false (e.g., "Is Vintage": true)

Enum validation at publish time. Required validation at publish time. Facets auto-generate from filterable attributes.

---

## 5. MONO-SPECIFIC ADAPTATION

| Concern | V2 Pattern | Mono Adaptation |
|---|---|---|
| Schema | Prisma | Drizzle (see block above) |
| Search index | Phase 17 pipeline | Typesense — register each attribute as a facet field, reindex on backfill |
| Lister integration | Manual seller entry | Importer AI should auto-fill category attributes during listing creation (Claude Vision → known attribute set) |
| Crosslister integration | N/A (V2 excludes crosslister) | Map Mono category attributes → each platform's attribute schema in the connector layer |
| Back-compat with existing listings | N/A | Run a backfill job: free-text brand → canonical brand (fuzzy match + manual review queue for ambiguous) |
| Audit | `emitAuditEvent("catalog.attribute.created")` | Drizzle + Mono audit trail (same event names) |

---

## 6. BACKFILL STRATEGY (critical for post-launch)

Pre-launch listings will have unstructured data. Backfill job:

1. Build canonical brand dictionary (seed from top 500 luxury brands + user-contributed)
2. For each existing listing:
   - Fuzzy-match brand string against dictionary (Levenshtein ≤ 2, case-insensitive)
   - If ≥ 0.9 confidence: write `listingAttributes { key: "brand", value: canonical }`
   - If 0.6–0.9: queue for manual review
   - If < 0.6: leave unattributed, flag for seller re-entry
3. For category migration: infer category from current `categoryId` + attribute hints

Run backfill in shadow mode first (write to `listingAttributes_shadow`), verify quality, then promote.

---

## 7. DEPENDENCIES

**Blocks:**
- International (Phase 40 equivalent) — can't translate "GUCCI" and "gucci" into two different Japanese strings
- Advanced search/filter UX — needs faceted attributes
- Crosslister attribute mapping quality — needs canonical source

**Blocked by:** Nothing pre-launch. Can start anytime post-launch.

---

## 8. TIMELINE

- **Pre-launch:** Reserve table names in Drizzle schema (even if empty). Reserve Typesense facet field naming convention. Keep free-text brand/size fields on listings.
- **Launch + 3 months:** Seed category tree + canonical brand dictionary
- **Launch + 6 months:** Deploy `categories`/`categoryAttributes` tables; attribute entry UI in Lister; begin backfill job in shadow mode
- **Launch + 9 months:** Promote backfill to production; faceted search live; enforce required attributes on new listings
- **Launch + 12 months:** Variants (size/color) live; Crosslister connectors map to canonical attributes

---

## 9. REFERENCE

Full V2 spec (including Prisma schema, services, health checks, Doctor checks):
`Twicely-V2/rules/install-phases/TWICELY_V2_INSTALL_PHASE_35_CATALOG_NORMALIZATION.md`

Scanned and imported 2026-04-08 as part of V2 → Mono gap analysis.
