# D-Phase Spec-Compliance Repair

**Scope:** 15 defects across 6 streams, ~20 files modified
**Baseline:** 1378 tests, 0 TS errors — must not decrease

---

## Files to Create or Modify

| # | File | Action | Description |
|---|---|---|---|
| 1 | `src/lib/casl/authorize.ts` | MODIFY | Populate delegation context from delegatedAccess table |
| 2 | `src/lib/casl/ability.ts` | MODIFY | Fix Payout condition sellerId→userId |
| 3 | `src/lib/actions/storefront.ts` | MODIFY | Replace getAuthenticatedUserId() with authorize() + ability.can(); write branding to storefront table |
| 4 | `src/lib/actions/storefront-pages.ts` | MODIFY | Replace getAuthenticatedUserId() with authorize(); add revalidatePath to savePuckData |
| 5 | `src/lib/actions/storefront-pages-helpers.ts` | MODIFY | Read page limits from platform_settings; remove getAuthenticatedUserId |
| 6 | `src/lib/actions/promotions.ts` | MODIFY | Replace getAuthenticatedUserId() with authorize() |
| 7 | `src/lib/actions/boosting.ts` | MODIFY | Replace getAuthenticatedUserId() with authorize() |
| 8 | `src/lib/actions/create-subscription-checkout.ts` | MODIFY | Replace auth.api.getSession() with authorize() |
| 9 | `src/lib/actions/change-subscription.ts` | MODIFY | Fix CASL check to use sellerId instead of userId |
| 10 | `src/lib/queries/storefront-public.ts` | MODIFY | Read branding from storefront table instead of sellerProfile |
| 11 | `src/lib/stripe/trials.ts` | MODIFY | Remove inline trialUsage table; import from schema |
| 12 | `src/lib/db/schema/subscriptions.ts` | MODIFY | Add trialUsage table definition |
| 13 | `src/lib/mutations/apply-pending-downgrade.ts` | MODIFY | Replace console.error with logger |
| 14 | `src/app/(hub)/my/selling/orders/[id]/_components/payment-summary.tsx` | MODIFY | Fix "Net Earnings" → "Net earnings" |
| 15 | `src/components/storefront/public-storefront.tsx` | MODIFY | Extract sub-component to bring under 300 lines |
| 16 | `src/app/api/webhooks/subscriptions/route.ts` | MODIFY | Return 500 on handler error |

---

## Stream 1: CASL Authorization (CRITICAL — D-001, D-002, D-003)

### 1a. authorize.ts — Populate delegation context (D-001)

Read `src/lib/casl/authorize.ts`. Find where delegationId, onBehalfOfSellerId, delegatedScopes are set to null/empty (around lines 59-61).

**Fix:** Before building the CASL context, query the `delegatedAccess` table for an ACTIVE record where `staffUserId` matches `session.user.id` and the record is not expired:

```typescript
// After getting session, before building CASL context:
import { delegatedAccess } from '@/lib/db/schema/subscriptions';
import { eq, and, or, isNull, gt } from 'drizzle-orm';

// Look up active delegation for this user
const now = new Date();
const activeDelegation = await db.query.delegatedAccess.findFirst({
  where: and(
    eq(delegatedAccess.staffUserId, session.user.id),
    eq(delegatedAccess.status, 'ACTIVE'),
    or(isNull(delegatedAccess.expiresAt), gt(delegatedAccess.expiresAt, now))
  ),
});

// Populate delegation context
const delegationId = activeDelegation?.id ?? null;
const onBehalfOfSellerId = activeDelegation?.sellerUserId ?? null;
const delegatedScopes = activeDelegation?.scopes ?? [];
```

Pass these into the CASL context builder so ability.ts staff rules fire correctly.

### 1b. storefront.ts — Add CASL authorize() (D-002)

Read `src/lib/actions/storefront.ts`. It has 4 actions using a local `getAuthenticatedUserId()` helper.

**For each action (updateStorefrontSettings, publishStorefront, unpublishStorefront, updateStoreCategories):**
1. Remove the local `getAuthenticatedUserId()` helper
2. Import `authorize` from `@/lib/casl`
3. Replace `const userId = await getAuthenticatedUserId()` with:
```typescript
const { session, ability } = await authorize();
const userId = session.user.id;
```
4. Add ability check: `if (!ability.can('update', sub('Storefront', { userId }))) throw new Error('Forbidden');`
5. Use `sub()` from `@casl/ability` for subject creation

### 1c. storefront-pages.ts — Add CASL authorize() (D-003)

Read `src/lib/actions/storefront-pages.ts`. Remove the TODO comment on line 1. For all 6 actions:
1. Import `authorize` from `@/lib/casl`
2. Replace `getAuthenticatedUserId()` calls with `authorize()`
3. Add ability checks before operations
4. In `savePuckData`: add `revalidatePath()` after the DB update

### 1d. promotions.ts — Add CASL authorize() (D-002)

Read `src/lib/actions/promotions.ts`. For all 4 actions:
1. Replace `getAuthenticatedUserId()` with `authorize()`
2. Add ability checks (use subject-only check since promotions store userId as sellerId)

### 1e. boosting.ts — Add CASL authorize() (D-002)

Read `src/lib/actions/boosting.ts`. For all 3 actions:
1. Replace `getAuthenticatedUserId()` with `authorize()`
2. Add ability checks

### 1f. create-subscription-checkout.ts — Add CASL (D-003b)

Read `src/lib/actions/create-subscription-checkout.ts`. Replace `auth.api.getSession()` with `authorize()`.

---

## Stream 2: CASL Condition Mismatches (HIGH — D-004, D-005)

### 2a. ability.ts — Fix Payout condition (D-005)

Read `src/lib/casl/ability.ts`. Find the Payout CASL rule (around line 115). Change:
```typescript
// WRONG: uses sellerId but payout table has userId
can('read', 'Payout', { sellerId })
// CORRECT: match the schema
can('read', 'Payout', { userId })
```

Also fix `can('create', 'Payout', ...)` if it has the same sellerId mismatch.

### 2b. change-subscription.ts — Fix Subscription condition (D-004)

Read `src/lib/actions/change-subscription.ts`. Find the ability check (around line 88). The ability.ts rule uses `{ sellerId }` so the action must check:
```typescript
// Match what ability.ts defines
ability.can('update', sub('Subscription', { sellerId: session.sellerId }))
```
Not `{ userId: session.userId }`.

---

## Stream 3: Schema Compliance (HIGH — D-006, D-008)

### 3a. Move trialUsage table to schema dir (D-006)

Read `src/lib/stripe/trials.ts` lines 18-26. Cut the `trialUsage` pgTable definition.
Read `src/lib/db/schema/subscriptions.ts`. Paste the trialUsage table there.
In `trials.ts`, add: `import { trialUsage } from '@/lib/db/schema/subscriptions';`

### 3b. Storefront branding — read/write from storefront table (D-008)

Read `src/lib/actions/storefront.ts` updateStorefrontSettings action. Currently it writes branding fields (bannerUrl, logoUrl, accentColor, announcement, aboutHtml, socialLinks, featuredListingIds, defaultStoreView, isStorePublished) to `sellerProfile`.

**Fix:** Write branding fields to the `storefront` table instead. The storefront schema already has these columns (bannerUrl, logoUrl, accentColor, announcement, aboutHtml, socialLinksJson, featuredListingIds, defaultView, isPublished).

Split the update into two parts:
1. Update sellerProfile for profile-level fields (storeName, storeSlug, storeDescription)
2. Update storefront for branding fields

Read `src/lib/queries/storefront-public.ts`. Change the branding query to read from the `storefront` table join instead of sellerProfile.

---

## Stream 4: Medium Fixes (D-010, D-011, D-012, D-013)

### 4a. Fix "Net Earnings" capitalization (D-010)

Read `src/app/(hub)/my/selling/orders/[id]/_components/payment-summary.tsx`. Find "Net Earnings" and change to "Net earnings".

### 4b. Split public-storefront.tsx (D-011)

Read `src/components/storefront/public-storefront.tsx` (308 lines). Extract one section (e.g., the About section or the Listings grid) into a separate component file to bring the main file under 300 lines.

### 4c. Replace console.error (D-012)

Read `src/lib/mutations/apply-pending-downgrade.ts`. Replace all `console.error()` calls with a logger. Check if `@/lib/logger` exists; if not, create a minimal logger utility.

### 4d. Read page limits from platform_settings (D-013)

Read `src/lib/actions/storefront-pages-helpers.ts`. Replace:
```typescript
const MAX_PAGES_POWER = 5;
const MAX_PAGES_ENTERPRISE = 20;
```
With calls to `getPlatformSetting()`:
```typescript
const maxPagesPower = await getPlatformSetting<number>('storefront.pages.maxPower', 5);
const maxPagesEnterprise = await getPlatformSetting<number>('storefront.pages.maxEnterprise', 20);
```

Also remove the `'use server'` directive from this helper file if it only exports utility functions.

---

## Stream 5: Webhook Fix (LOW)

Read `src/app/api/webhooks/subscriptions/route.ts`. Find where handler errors are caught. Change from returning 200 to returning 500:

```typescript
// WRONG: swallows errors, prevents Stripe retries
catch (err) {
  console.error(err);
  return NextResponse.json({ received: true });
}

// CORRECT: enables Stripe retries
catch (err) {
  console.error(err);
  return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
}
```

---

## Verification

After all fixes:
1. `pnpm typecheck` — must be 0 errors
2. `pnpm test` — must be >= 1378 tests passing
3. Grep for banned terms — zero occurrences
4. No files over 300 lines in modified set
5. Every server action must use `authorize()` from `@/lib/casl`
