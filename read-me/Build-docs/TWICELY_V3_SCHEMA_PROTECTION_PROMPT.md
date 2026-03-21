# TWICELY V3 — Pre-Phase-C Schema Protection

## Context
You are adding ONE new table to the schema that must exist before Phase D (Promotions) to prevent data loss. When promotions, coupons, or manual price edits change a listing's price, we need to record the change. If this table doesn't exist when D2 ships, every price change is lost and we'd need to backfill.

You are NOT building UI, NOT building server actions, NOT adding hooks to existing code. You are ONLY adding the table definition and generating a migration.

## What You Are Adding

### Table: `listingPriceHistory`

Add this to `src/lib/db/schema/listings.ts` (it belongs with listing-related tables).

```typescript
export const listingPriceHistory = pgTable('listing_price_history', {
  id:                text('id').primaryKey().$defaultFn(() => createId()),
  listingId:         text('listing_id').notNull().references(() => listing.id, { onDelete: 'cascade' }),
  priceCents:        integer('price_cents').notNull(),
  previousPriceCents: integer('previous_price_cents'),
  changeType:        text('change_type').notNull(),      // 'INITIAL' | 'INCREASE' | 'DECREASE' | 'RESTORED'
  changePercent:     real('change_percent'),
  source:            text('source').notNull(),            // 'SELLER_UPDATE' | 'PROMOTION' | 'SYSTEM'
  promotionId:       text('promotion_id'),
  recordedAt:        timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  listingIdx:        index('lph_listing').on(table.listingId, table.recordedAt),
  changeTypeIdx:     index('lph_change_type').on(table.listingId, table.changeType),
}));
```

## Rules

1. Add the table to `src/lib/db/schema/listings.ts` — at the END of the file, after existing tables.
2. Make sure `real` is imported from `drizzle-orm/pg-core` (it may not be imported yet — check first).
3. Do NOT create a new schema file. This goes in listings.ts.
4. Do NOT add any enums for changeType or source. These use plain text columns with TypeScript union validation (to keep the enum file clean for low-cardinality values that don't need DB-level enforcement).
5. Do NOT create any server actions, commerce functions, or hooks. Just the table definition.
6. Do NOT modify any existing tables or columns.
7. Do NOT touch the seed files.

## Verification

After adding the table:

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Lint passes
pnpm lint

# 3. Table is exported (should appear in schema index via listings.ts wildcard export)
grep "listingPriceHistory" src/lib/db/schema/listings.ts

# 4. Generate migration snapshot
npx drizzle-kit generate

# 5. Push to database
npx drizzle-kit push

# 6. Build passes
pnpm build

# 7. Tests still pass
pnpm test
```

Show full output for ALL verification steps.

## Commit

```bash
git add -A && git commit -m "schema: add listingPriceHistory table for price tracking (pre-D2 protection)"
```

## STOP after this commit. Do not continue to any other work.
