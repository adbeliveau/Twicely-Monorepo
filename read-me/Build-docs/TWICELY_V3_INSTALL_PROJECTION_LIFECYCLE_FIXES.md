# Install Prompt: Projection Lifecycle Fixes + Image Retention + Auto-Import
# Slice: F-FIX-01
# Depends on: F1, F6 complete

## READ FIRST

Before writing any code, read these files in full:

- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md` (§9 connector registry, §13 polling, §14 import dedupe, §19 image handling, §25.4 projection states)
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md` (crosslister tables: channel_projection, crosslister_account)
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` (§24 listing states, §37 data retention)
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_DECISION_RATIONALE.md` (entries #97–101)
- `C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_INSTALL_PROJECTION_LIFECYCLE_FIXES.md` (this file)

Do not write any code until all files above are read. Do not invent logic not specified here.

---

## What This Slice Builds

Six discrete fixes to the crosslister and listing lifecycle systems. Each fix is independent and must be committed separately with its own test suite passing before moving to the next.

---

## Fix 1 — Add UNMANAGED and ORPHANED to projectionStatusEnum

### Files to modify
- `src/db/schema/crosslister.ts`
- `src/db/migrations/` (new migration file)

### Schema change

```typescript
// src/db/schema/crosslister.ts
export const projectionStatusEnum = pgEnum('projection_status', [
  'DRAFT', 'QUEUED', 'PUBLISHING', 'ACTIVE', 'SOLD', 'ENDED', 'DELISTED',
  'ERROR', 'FAILED',
  'UNMANAGED',
  'ORPHANED',
]);
```

Add to `channelProjection` table:
```typescript
orphanedAt: timestamp('orphaned_at'),
```

### Migration

Generate and run the migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Tests
- `projectionStatusEnum` includes `UNMANAGED` and `ORPHANED`
- `channelProjection` table has `orphanedAt` column nullable timestamp
- Migration runs clean with no errors
- Existing rows unaffected (no status column changes, only new enum values added)

---

## Fix 2 — externalListingId Unique Constraint + Upsert

### Files to modify
- `src/db/schema/crosslister.ts`
- `src/db/migrations/` (new migration)
- `src/lib/crosslister/import/dedupe.ts`

### Schema change

Add unique constraint to `channelProjection`:

```typescript
// In channelProjection table definition, add to indexes:
}, (table) => ({
  externalUnique: uniqueIndex('uq_projection_external')
    .on(table.sellerId, table.platform, table.externalListingId),
}))
```

### Dedupe logic

`src/lib/crosslister/import/dedupe.ts` — replace fuzzy title+price matching with hard constraint upsert:

```typescript
export async function upsertProjection(
  db: DrizzleDb,
  data: NewChannelProjection,
): Promise<ChannelProjection> {
  const [result] = await db
    .insert(channelProjection)
    .values(data)
    .onConflictDoUpdate({
      target: [
        channelProjection.sellerId,
        channelProjection.platform,
        channelProjection.externalListingId,
      ],
      set: {
        lastSyncedAt: sql`now()`,
        pollTier: data.pollTier,
        nextPollAt: data.nextPollAt,
        // Never overwrite: title, price, images, description (user edits)
      },
    })
    .returning();
  return result;
}
```

All import paths (eBay, Poshmark, Mercari, Depop, Facebook) must call `upsertProjection` instead of `db.insert(channelProjection)`. Find every direct insert call and replace it.

### Tests
- Inserting same `(sellerId, platform, externalListingId)` twice → one row, not two
- Upsert updates `lastSyncedAt` but does not overwrite `title`
- Upsert does not overwrite `price` set by user after import
- Unique constraint violation is never thrown to the caller — upsert handles it silently
- All existing import tests still pass

---

## Fix 3 — Auto-Import Unknown External Listings During Sync

### Files to modify
- `src/lib/crosslister/sync/sweep.ts` (or equivalent sync sweep worker)
- `src/lib/crosslister/import/auto-import.ts` (new file)

### Logic

During the sync sweep for a seller with `listerTier IN ('LITE', 'PLUS', 'POWER', 'MAX', 'ENTERPRISE')`:

```typescript
// src/lib/crosslister/import/auto-import.ts

export async function autoImportUnknownListings(
  db: DrizzleDb,
  sellerId: string,
  platform: Platform,
  externalListings: ExternalListing[],
): Promise<{ imported: number }> {
  // Get all known externalListingIds for this seller+platform
  const known = await db
    .select({ externalListingId: channelProjection.externalListingId })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        eq(channelProjection.platform, platform),
      ),
    );

  const knownIds = new Set(known.map((r) => r.externalListingId));

  const unknown = externalListings.filter(
    (l) => !knownIds.has(l.externalListingId),
  );

  if (unknown.length === 0) return { imported: 0 };

  for (const listing of unknown) {
    await upsertProjection(db, {
      sellerId,
      platform,
      externalListingId: listing.externalListingId,
      status: 'ACTIVE',
      source: 'AUTO_DETECTED',
      pollTier: 'COLD',
      nextPollAt: new Date(Date.now() + 45 * 60 * 1000), // COLD = 45 min
      // map remaining fields from ExternalListing
    });

    // Also create/upsert the canonical Twicely listing
    await upsertCanonicalListing(db, sellerId, listing);
  }

  return { imported: unknown.length };
}
```

**CRITICAL:** Auto-import ONLY runs for sellers with `listerTier IN ('LITE', 'PLUS', 'POWER', 'MAX', 'ENTERPRISE')`. Never run for `NONE` or `FREE` or `UNMANAGED`/`ORPHANED` sellers.

The `source` field on `channelProjection` must support `'AUTO_DETECTED'` as a value. Add to the source enum if not present.

The canonical listing created by auto-import must show a badge in the seller dashboard: `"Imported from [Platform]"`. Store `autoImportedAt` timestamp on the listing row.

### Tests
- Sync sweep on seller with 3 unknown eBay listings → 3 new projections created with `source = 'AUTO_DETECTED'`
- Sweep runs twice → still 3 projections, not 6 (upsert idempotency)
- Auto-import does NOT run for seller with `listerTier = 'NONE'`
- Auto-import does NOT run for seller with `listerTier = 'FREE'`
- Auto-import does NOT run for UNMANAGED seller
- Canonical Twicely listing created for each auto-imported external listing
- `autoImportedAt` is set on canonical listing

---

## Fix 4 — Stripe Webhook: subscription.deleted → UNMANAGED Cascade

### Files to modify
- `src/app/api/webhooks/stripe/route.ts` (or equivalent Stripe webhook handler)

### Logic to add

Inside the `customer.subscription.deleted` handler, after setting `listerTier = 'NONE'`:

```typescript
// Transition all ACTIVE projections to UNMANAGED
await db
  .update(channelProjection)
  .set({ status: 'UNMANAGED' })
  .where(
    and(
      eq(channelProjection.sellerId, sellerId),
      eq(channelProjection.status, 'ACTIVE'),
    ),
  );

// Cancel all pending/scheduled crosslister jobs for this seller
// EXCEPT jobs with type = 'EMERGENCY_DELIST'
await cancelCrosslisterJobsForSeller(sellerId, {
  excludeTypes: ['EMERGENCY_DELIST'],
});

// Send seller notification
await sendNotification(sellerId, {
  type: 'LISTER_SUBSCRIPTION_ENDED',
  body: `Your crosslister subscription has ended. Your listings on external platforms are still live but are no longer managed by Twicely. You are responsible for managing those listings directly, including removing them if they sell. Upgrade to restore full management.`,
});
```

**CRITICAL:** `EMERGENCY_DELIST` jobs must NEVER be cancelled regardless of subscription status. A sale is a sale.

### Tests
- `subscription.deleted` for lister product → all seller's ACTIVE projections become UNMANAGED
- `subscription.deleted` → `sellerProfile.listerTier` set to `NONE`
- `subscription.deleted` → pending SYNC jobs for seller cancelled
- `subscription.deleted` → pending PUBLISH jobs for seller cancelled
- `subscription.deleted` → EMERGENCY_DELIST jobs NOT cancelled
- `subscription.deleted` → seller notification sent with correct copy
- `subscription.deleted` for store product → crosslister projections unaffected

---

## Fix 5 — Resubscribe Reactivation Path: UNMANAGED → ACTIVE

### Files to modify
- `src/lib/subscriptions/lister-upgrade.ts` (or equivalent subscription upgrade handler)

### Logic

When seller upgrades `listerTier` from `NONE` → any active tier (`LITE`, `PLUS`, `POWER`, `MAX`, `ENTERPRISE`):

```typescript
// Reactivate all UNMANAGED projections for this seller
await db
  .update(channelProjection)
  .set({
    status: 'ACTIVE',
    pollTier: 'COLD',
    nextPollAt: new Date(Date.now() + 45 * 60 * 1000),
  })
  .where(
    and(
      eq(channelProjection.sellerId, sellerId),
      eq(channelProjection.status, 'UNMANAGED'),
    ),
  );

// Count reactivated projections for notification
const reactivated = await db
  .select({ count: count() })
  .from(channelProjection)
  .where(
    and(
      eq(channelProjection.sellerId, sellerId),
      eq(channelProjection.status, 'ACTIVE'),
    ),
  );

// Send seller notification
await sendNotification(sellerId, {
  type: 'LISTER_REACTIVATED',
  body: `Your crosslister is back. ${reactivated[0].count} listings are now being managed again.`,
});
```

**Note:** ORPHANED projections are NOT reactivated by a subscription upgrade. ORPHANED requires account reactivation (separate flow, see Fix 6).

### Tests
- Seller upgrades NONE → LITE → all UNMANAGED projections become ACTIVE
- Reactivated projections have `pollTier = 'COLD'` and `nextPollAt` set ~45 min from now
- Seller notification sent with correct count
- ORPHANED projections NOT affected by subscription upgrade
- Seller upgrades NONE → PRO → same behavior

---

## Fix 6 — Account Deletion: Order Check + ORPHANED Cascade + Platform Disconnect

### Files to modify
- `src/app/api/account/delete/route.ts` (or equivalent deletion handler)
- `src/lib/crosslister/platform-disconnect.ts` (or equivalent disconnect handler)
- `src/lib/account/deletion-check.ts` (new file)

### 6a — Deletion order check

```typescript
// src/lib/account/deletion-check.ts

export async function getAccountDeletionBlockers(
  db: DrizzleDb,
  sellerId: string,
): Promise<DeletionBlocker[]> {
  const blockers: DeletionBlocker[] = [];

  // Unpaid or unshipped orders
  const openOrders = await db
    .select()
    .from(order)
    .where(
      and(
        eq(order.sellerId, sellerId),
        inArray(order.status, ['PAID', 'SHIPPED']),
        or(
          and(eq(order.status, 'PAID'), isNull(order.shippedAt)),
          and(
            eq(order.status, 'SHIPPED'),
            isNull(order.deliveredAt),
            gt(order.shippedAt, sql`now() - interval '30 days'`),
          ),
        ),
      ),
    );

  if (openOrders.length > 0) {
    blockers.push({
      type: 'OPEN_ORDERS',
      count: openOrders.length,
      message: `You have ${openOrders.length} order(s) that must be completed before closing your account.`,
    });
  }

  // Open disputes
  const openDisputes = await db
    .select()
    .from(dispute)
    .where(
      and(
        eq(dispute.sellerId, sellerId),
        notInArray(dispute.status, ['CLOSED', 'RESOLVED', 'WITHDRAWN']),
      ),
    );

  if (openDisputes.length > 0) {
    blockers.push({
      type: 'OPEN_DISPUTES',
      count: openDisputes.length,
      message: `You have ${openDisputes.length} open dispute(s) that must be resolved before closing your account.`,
    });
  }

  // Open return requests
  const openReturns = await db
    .select()
    .from(returnRequest)
    .where(
      and(
        eq(returnRequest.sellerId, sellerId),
        notInArray(returnRequest.status, ['COMPLETED', 'REJECTED', 'CANCELLED']),
      ),
    );

  if (openReturns.length > 0) {
    blockers.push({
      type: 'OPEN_RETURNS',
      count: openReturns.length,
      message: `You have ${openReturns.length} open return request(s) that must be resolved before closing your account.`,
    });
  }

  return blockers;
}
```

The deletion API route must call `getAccountDeletionBlockers` and return a 409 with the blocker list if any exist. The UI must surface each blocker with a link to resolve it.

### 6b — ORPHANED projection cascade on deletion

When the 30-day cooling off begins (not when confirmed — begin ORPHANED immediately):

```typescript
await db
  .update(channelProjection)
  .set({
    status: 'ORPHANED',
    orphanedAt: new Date(),
  })
  .where(
    and(
      eq(channelProjection.sellerId, sellerId),
      inArray(channelProjection.status, ['ACTIVE', 'UNMANAGED', 'QUEUED', 'PUBLISHING']),
    ),
  );

// Revoke all crosslister platform tokens immediately
await revokeCrosslisterTokens(sellerId);

// Cancel all scheduler jobs
await cancelCrosslisterJobsForSeller(sellerId, {
  excludeTypes: [], // Cancel everything including EMERGENCY_DELIST — account is closing
});
```

**ORPHANED reactivation during cooling-off:** If seller cancels deletion during the 30-day window:

```typescript
// ORPHANED → UNMANAGED (not ACTIVE — subscription may have lapsed)
await db
  .update(channelProjection)
  .set({ status: 'UNMANAGED', orphanedAt: null })
  .where(
    and(
      eq(channelProjection.sellerId, sellerId),
      eq(channelProjection.status, 'ORPHANED'),
    ),
  );
```

### 6c — Platform disconnect → UNMANAGED (not archived)

```typescript
// src/lib/crosslister/platform-disconnect.ts

export async function disconnectPlatform(
  db: DrizzleDb,
  sellerId: string,
  platform: Platform,
): Promise<void> {
  // Revoke tokens for this platform
  await db
    .update(crosslisterAccount)
    .set({ accessToken: null, refreshToken: null, tokenExpiresAt: null })
    .where(
      and(
        eq(crosslisterAccount.sellerId, sellerId),
        eq(crosslisterAccount.platform, platform),
      ),
    );

  // Transition ACTIVE projections to UNMANAGED (NOT archived)
  await db
    .update(channelProjection)
    .set({ status: 'UNMANAGED' })
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        eq(channelProjection.platform, platform),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    );

  // Cancel pending jobs for this platform
  await cancelCrosslisterJobsForSellerPlatform(sellerId, platform, {
    excludeTypes: ['EMERGENCY_DELIST'],
  });

  // Notify seller
  await sendNotification(sellerId, {
    type: 'PLATFORM_DISCONNECTED',
    body: `${platform} disconnected. Your listings on ${platform} are still live but are no longer managed by Twicely.`,
  });
}
```

### Tests (Fix 6)
- Account deletion with PAID unshipped order → 409 with blocker list
- Account deletion with open dispute → 409 with blocker list
- Account deletion with open return → 409 with blocker list
- Account deletion with only COMPLETED orders → proceeds to cooling off
- Deletion cooling off begins → all ACTIVE projections become ORPHANED
- Deletion cooling off begins → `orphanedAt` set on all ORPHANED projections
- Deletion cooling off begins → crosslister tokens revoked
- Deletion cooling off begins → all scheduler jobs cancelled
- Seller cancels deletion during cooling off → ORPHANED projections become UNMANAGED
- Seller cancels deletion during cooling off → `orphanedAt` nulled
- Platform disconnect → ACTIVE projections become UNMANAGED (not archived)
- Platform disconnect → tokens revoked for that platform only
- Platform disconnect → other platform projections unaffected
- Platform disconnect → EMERGENCY_DELIST jobs not cancelled

---

## Fix 7 — Sold Listing Auto-Archive (Seller Cannot Delete)

### Files to modify
- `src/lib/listings/delete.ts` (or equivalent listing deletion handler)
- `src/app/api/listings/[id]/route.ts` DELETE handler

### Logic

Listings with `status = 'SOLD'` cannot be deleted. The DELETE endpoint must reject:

```typescript
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { user, ability } = await authorize(req);

  const listing = await db.query.listing.findFirst({
    where: eq(listings.id, params.id),
  });

  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // SOLD listings cannot be deleted — ever
  if (listing.status === 'SOLD') {
    return NextResponse.json(
      {
        error: 'SOLD_LISTING_UNDELETABLE',
        message: 'Sold listings are kept on record for your protection and cannot be deleted. You can hide this listing from your dashboard.',
      },
      { status: 403 },
    );
  }

  // Auth check
  if (ability.cannot('delete', listing)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // DRAFT, ENDED (unsold) → hard delete
  // ACTIVE, PAUSED → delist cascade then delete
  await deleteListing(db, listing, user.id);

  return NextResponse.json({ success: true });
}
```

The seller dashboard must show an "Archive" button (not "Delete") for SOLD listings. The Archive action sets `archivedAt` on the listing row — it disappears from the default dashboard view but remains in "Sales History" and tax exports.

Add `archivedAt: timestamp('archived_at')` to the `listing` table if not already present.

### Tests
- DELETE `/api/listings/[soldListingId]` → 403 with `SOLD_LISTING_UNDELETABLE`
- DELETE `/api/listings/[draftListingId]` → 200, listing hard deleted
- DELETE `/api/listings/[endedUnsoldListingId]` → 200, listing hard deleted
- DELETE `/api/listings/[activeListingId]` → 200, delist cascade triggered
- POST `/api/listings/[soldListingId]/archive` → 200, `archivedAt` set
- Archived listing does not appear in default dashboard listing query
- Archived listing does appear in sales history query
- Archived listing does appear in tax export data

---

## Commit Order

Complete each fix with passing tests before starting the next. Commit message format:

```
fix(crosslister): add UNMANAGED/ORPHANED projection states [Fix 1]
fix(crosslister): external listing dedup unique constraint + upsert [Fix 2]
fix(crosslister): auto-import unknown external listings during sync [Fix 3]
fix(stripe): subscription.deleted cascades projections to UNMANAGED [Fix 4]
fix(crosslister): resubscribe reactivation path UNMANAGED → ACTIVE [Fix 5]
fix(account): deletion order check + ORPHANED cascade + disconnect [Fix 6]
fix(listings): sold listing auto-archive seller cannot delete [Fix 7]
```

---

## Test Count Requirement

Current test count before this slice: [RECORD BEFORE STARTING]
Minimum tests to add: 52 (counted across all 7 fixes above)
Tests must increase, never decrease.

Run full suite after each fix:
```bash
npx vitest run
```

TypeScript must compile clean after each fix:
```bash
npx tsc --noEmit
```

---

## Definition of Done

- [ ] All 7 fixes committed with passing tests
- [ ] `projectionStatusEnum` includes UNMANAGED and ORPHANED
- [ ] `channelProjection` has unique constraint on (sellerId, platform, externalListingId)
- [ ] `channelProjection` has `orphanedAt` column
- [ ] Stripe webhook cascades to UNMANAGED on subscription cancel
- [ ] Resubscribe handler reactivates UNMANAGED → ACTIVE
- [ ] Account deletion blocked by open orders/disputes/returns
- [ ] Platform disconnect → UNMANAGED (not archived)
- [ ] SOLD listings return 403 on DELETE
- [ ] Auto-import runs for LITE+ sellers during sync sweep
- [ ] TypeScript compiles clean, zero errors
- [ ] Test count increased by minimum 52
