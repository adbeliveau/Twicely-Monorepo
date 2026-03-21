# TWICELY V3 — Schema Addendum v1.4

**Version:** v1.4 (addendum to v1.3)
**Date:** 2026-02-19
**Purpose:** Personalization & Interest System tables. Apply on top of v1.3 changes. See `TWICELY_V3_PERSONALIZATION_CANONICAL.md` for full business rules.

---

## CHANGE LOG (v1.4 additions only)

| Change | Source Decision | Section |
|--------|----------------|---------|
| `interestSourceEnum` added | Signal source tracking | §1 |
| `interestTag` table added | Platform-curated interest tags | §2 |
| `userInterest` table added | Per-user interest weights with decay | §2 |

---

## §1. NEW ENUMS

```typescript
// Interest signal source — how was this interest recorded?
export const interestSourceEnum = pgEnum('interest_source', [
  'EXPLICIT',   // User picked in onboarding or settings
  'PURCHASE',   // Bought an item matching this interest
  'WATCHLIST',  // Added matching item to watchlist
  'CLICK',      // Clicked matching listing with >5 sec dwell
  'SEARCH',     // Search query matched this interest's categories
]);
```

---

## §2. NEW TABLES

### `interestTag` — Platform-Curated Interest Tags

```typescript
export const interestTag = pgTable('interest_tag', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 50 }).unique().notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  group: varchar('group', { length: 50 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  description: varchar('description', { length: 200 }),
  categoryIds: text('category_ids').array(),
  attributes: jsonb('attributes'),
  cardEmphasis: varchar('card_emphasis', { length: 50 }).notNull().default('default'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Column notes:**
- `group`: One of `fashion`, `electronics`, `home`, `collectibles`, `lifestyle`. Used for grouping in settings page.
- `categoryIds`: Array of category UUIDs this tag maps to. One tag can span multiple categories (e.g., "Vintage" → fashion + home + collectibles).
- `attributes`: Optional JSONB for extra filters. Example: `{"condition": "vintage", "era": "pre-2000"}` for the "Vintage" tag.
- `cardEmphasis`: One of `social`, `specs`, `collectible`, `default`. Determines listing card visual variant for buyers with this as top interest.

### `userInterest` — Per-User Interest Weights

```typescript
export const userInterest = pgTable('user_interest', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tagSlug: varchar('tag_slug', { length: 50 }).notNull().references(() => interestTag.slug),
  weight: decimal('weight', { precision: 6, scale: 3 }).notNull().default('1.0'),
  source: interestSourceEnum('source').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserTagSource: unique().on(table.userId, table.tagSlug, table.source),
  userIdIdx: index('idx_user_interest_user_id').on(table.userId),
  expiresAtIdx: index('idx_user_interest_expires_at').on(table.expiresAt),
}));
```

**Column notes:**
- `weight`: Signal strength. See Personalization Canonical §6 for weight values per source.
- `source`: How this interest was recorded. Unique constraint on (userId, tagSlug, source) means one row per source type per tag per user. Weights from different sources stack in the feed query via SUM.
- `expiresAt`: NULL for EXPLICIT source (never expires). Set to future date for behavioral signals (PURCHASE=90d, WATCHLIST=60d, CLICK=14d, SEARCH=7d). Nightly cron deletes expired rows.

---

## §3. INDEXES

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `interestTag` | (primary key) | `id` | — |
| `interestTag` | `interest_tag_slug_key` | `slug` UNIQUE | FK lookups, API access |
| `interestTag` | `idx_interest_tag_group` | `group` | Settings page grouping query |
| `userInterest` | (primary key) | `id` | — |
| `userInterest` | `user_interest_user_id_tag_slug_source_key` | `(userId, tagSlug, source)` UNIQUE | Upsert on signal recording |
| `userInterest` | `idx_user_interest_user_id` | `userId` | Feed query performance |
| `userInterest` | `idx_user_interest_expires_at` | `expiresAt` | Nightly decay job performance |

---

## §4. SIGNAL RECORDING REFERENCE

Quick reference for implementers. Full rules in Personalization Canonical §6.

| Source | Weight | expiresAt | Trigger Point |
|--------|--------|-----------|---------------|
| EXPLICIT | 10.0 | NULL | Onboarding picker or settings page |
| PURCHASE | 2.0 | NOW() + 90 days | `finalizeOrder` in checkout.ts |
| WATCHLIST | 0.5 | NOW() + 60 days | Watchlist add action |
| CLICK | 0.1 | NOW() + 14 days | Listing page view (>5 sec dwell, background job) |
| SEARCH | 0.05 | NOW() + 7 days | Search query execution (background job) |

All signal inserts use `ON CONFLICT (userId, tagSlug, source) DO UPDATE` to extend `expiresAt` and refresh `updatedAt` on repeat signals.

---

## §5. MIGRATION ORDER

1. Create `interestSourceEnum`
2. Create `interestTag` table
3. Create `userInterest` table with FK to `interestTag.slug`
4. Seed `interestTag` with 30+ initial tags (separate seed migration)

No existing tables are modified. No existing columns change. Pure additive.
