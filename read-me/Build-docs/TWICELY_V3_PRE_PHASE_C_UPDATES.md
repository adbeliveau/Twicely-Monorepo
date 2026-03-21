# TWICELY V3 — Pre-Phase-C Schema & Config Updates
**Date:** 2026-02-17  
**Purpose:** Apply all gap-analysis-driven schema additions before starting Phase C  
**Checkpoint:** Create `twicely-pre-c-updates.tar` after completion  
**Commit message:** `Pre-Phase-C schema updates: review weights, trust display, return fee allocation`

---

## Overview

Three clusters of changes from the V2→V3 gap analysis (Supplements #3 and #4):

| Cluster | Tables Affected | Fields Added | Source |
|---------|----------------|--------------|--------|
| A. Review Weighting & Trust Display | `review`, `seller_performance` | 11 fields | Supp #4 §9 |
| B. Return Fee Allocation | `return_request` + new enum | 7 fields + 1 enum | Supp #3 §2 |
| C. Page Registry Addition | N/A (doc only) | N/A | Supp #4 §8.5 |

---

## A. Review Weighting & Trust Display Fields

### A1. Add fields to `review` table (schema/reviews.ts)

Add these fields AFTER the existing `flaggedByUserId` field:

```typescript
// Review weighting (V2 Trust Display Amendment — anti-gaming)
orderValueCents:     integer('order_value_cents'),              // snapshot of order total at review time
hadDispute:          boolean('had_dispute').notNull().default(false),
disputeOutcome:      text('dispute_outcome'),                   // BUYER_FAVOR | SELLER_FAVOR | SPLIT | null
trustWeight:         real('trust_weight').notNull().default(1.0),
trustWeightFactors:  jsonb('trust_weight_factors').notNull().default('{}'),
```

**Why:** Without these, all reviews count equally. A $1 sock-puppet review has the same weight as a $500 legitimate purchase review. The weight formula (orderValue × dispute × recency × verification × quality) is the core anti-gaming measure for the review system.

### A2. Add fields to `seller_performance` table (schema/trust.ts)

Add these fields AFTER the existing `responseTimeMinutes` field:

```typescript
// Trust display layer (V2 Trust Display Amendment — buyer-facing metrics)
onTimeShippingPct:     real('on_time_shipping_pct').notNull().default(100),
avgResponseTimeHours:  real('avg_response_time_hours'),
trustBadge:            text('trust_badge'),                     // TOP_RATED | RELIABLE | FAST_SHIPPER | RESPONSIVE | RISING | null
trustBadgeSecondary:   text('trust_badge_secondary').array().notNull().default(sql`'{}'::text[]`),
displayStars:          real('display_stars'),                    // derived from trust band, NOT raw average
showStars:             boolean('show_stars').notNull().default(false), // requires minimum review count
```

**Why:** `averageRating` is the raw mathematical average. `displayStars` is derived from the seller's trust band — prevents new sellers with 3 five-star reviews from displaying higher than established sellers with 500 reviews at 4.7. Badges are a major buyer trust signal on search results and listing pages.

---

## B. Return Fee Allocation

### B1. Add new enum (schema/enums.ts or schema/returns.ts)

```typescript
export const returnReasonBucketEnum = pgEnum('return_reason_bucket', [
  'SELLER_FAULT',            // INAD, wrong item, counterfeit
  'BUYER_REMORSE',           // Changed mind, doesn't fit, ordered wrong
  'PLATFORM_CARRIER_FAULT',  // Lost in transit, carrier damaged
  'EDGE_CONDITIONAL',        // Partial fault, gray area — needs manual review
]);
```

### B2. Add fields to `return_request` table (schema/returns.ts)

Add these fields AFTER the existing `refundAmountCents` field:

```typescript
// Fee allocation (V2 Returns Fee Allocation Addendum — deterministic refund breakdown)
bucket:              returnReasonBucketEnum('bucket'),           // assigned at creation from reason mapping
refundItemCents:     integer('refund_item_cents'),               // item cost portion of refund
refundShippingCents: integer('refund_shipping_cents'),           // shipping cost portion of refund
refundTaxCents:      integer('refund_tax_cents'),                // tax portion of refund
restockingFeeCents:  integer('restocking_fee_cents'),            // restocking fee (buyer remorse only)
feeAllocationJson:   jsonb('fee_allocation_json'),               // full allocation snapshot for audit
```

**Why:** Without the bucket, every return requires manual classification of who pays what. The bucket drives deterministic fee allocation:

| Bucket | FVF Refund | Processing Fee | Return Shipping |
|--------|-----------|----------------|-----------------|
| SELLER_FAULT | Twicely refunds FVF | Seller absorbs | Seller pays |
| BUYER_REMORSE | Twicely keeps FVF | Buyer absorbs | Buyer pays |
| PLATFORM_CARRIER_FAULT | Twicely refunds FVF | Platform absorbs | Platform pays |
| EDGE_CONDITIONAL | Manual decision | Manual decision | Manual decision |

The breakdown fields (`refundItemCents`, `refundShippingCents`, `refundTaxCents`) replace the current single `refundAmountCents` lump sum. The lump sum stays as the total; the breakdown fields show exactly what it consists of.

---

## C. Page Registry Addition

Add to V3 Page Registry under Public Pages:

```
| # | Path | Title | Layout | Gate | Build Phase | Key Data |
| NEW | `/p/buyer-protection` | Buyer Protection | Twicely | policy | PUBLIC | C5 | Coverage types, claim process, FAQ, trust stats |
```

**This is a doc-only change — no code needed now.** Will be implemented in Phase C5.

---

## Migration SQL (for reference — Drizzle will generate this)

```sql
-- A1: review table additions
ALTER TABLE review ADD COLUMN order_value_cents integer;
ALTER TABLE review ADD COLUMN had_dispute boolean NOT NULL DEFAULT false;
ALTER TABLE review ADD COLUMN dispute_outcome text;
ALTER TABLE review ADD COLUMN trust_weight real NOT NULL DEFAULT 1.0;
ALTER TABLE review ADD COLUMN trust_weight_factors jsonb NOT NULL DEFAULT '{}';

-- A2: seller_performance table additions
ALTER TABLE seller_performance ADD COLUMN on_time_shipping_pct real NOT NULL DEFAULT 100;
ALTER TABLE seller_performance ADD COLUMN avg_response_time_hours real;
ALTER TABLE seller_performance ADD COLUMN trust_badge text;
ALTER TABLE seller_performance ADD COLUMN trust_badge_secondary text[] NOT NULL DEFAULT '{}';
ALTER TABLE seller_performance ADD COLUMN display_stars real;
ALTER TABLE seller_performance ADD COLUMN show_stars boolean NOT NULL DEFAULT false;

-- B1: new enum
CREATE TYPE return_reason_bucket AS ENUM ('SELLER_FAULT', 'BUYER_REMORSE', 'PLATFORM_CARRIER_FAULT', 'EDGE_CONDITIONAL');

-- B2: return_request table additions
ALTER TABLE return_request ADD COLUMN bucket return_reason_bucket;
ALTER TABLE return_request ADD COLUMN refund_item_cents integer;
ALTER TABLE return_request ADD COLUMN refund_shipping_cents integer;
ALTER TABLE return_request ADD COLUMN refund_tax_cents integer;
ALTER TABLE return_request ADD COLUMN restocking_fee_cents integer;
ALTER TABLE return_request ADD COLUMN fee_allocation_json jsonb;
```

---

## Verification Checklist

After running the migration:

- [ ] `pnpm tsc --noEmit` — zero TypeScript errors
- [ ] `pnpm lint` — zero lint errors  
- [ ] `pnpm drizzle-kit push` completes without errors
- [ ] Verify new columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'review' AND column_name LIKE 'trust%';`
- [ ] Verify new columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'seller_performance' AND column_name LIKE 'trust%';`
- [ ] Verify new enum exists: `SELECT enum_range(NULL::return_reason_bucket);`
- [ ] Verify new columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'return_request' AND column_name LIKE 'refund_%';`
- [ ] Seed system still runs clean: `pnpm seed` (idempotent)
- [ ] CASL tests still pass: `pnpm vitest run`
- [ ] No files over 300 lines created or modified

---

## Files to Create or Modify

| # | File | Action | Lines Changed |
|---|------|--------|---------------|
| 1 | `src/lib/db/schema/reviews.ts` | MODIFY — add 5 fields to `review` table | ~5 lines added |
| 2 | `src/lib/db/schema/trust.ts` | MODIFY — add 6 fields to `seller_performance` table | ~6 lines added |
| 3 | `src/lib/db/schema/returns.ts` | MODIFY — add `returnReasonBucketEnum` + 6 fields to `return_request` | ~10 lines added |
| 4 | `src/lib/db/schema/index.ts` | MODIFY — export new enum if needed | ~1 line |

**Total: 4 files modified, ~22 lines added. No new files created.**

---

**END OF PRE-C UPDATES**
