# A-Phase Compliance Repair — Install Prompt

**Goal:** Fix 14 canonical compliance violations in Phase A (Foundation) files. Two parallel streams, no new files created.

**CRITICAL:** Read `CLAUDE.md` before starting. No `as any`, no `@ts-ignore`, no files over 300 lines, no banned terms. Run `./twicely-lint.sh` after all changes.

---

## File Approval List

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `src/lib/db/schema/identity.ts` | MODIFY | Add 2 missing sellerProfile columns |
| 2 | `src/lib/db/schema/personalization.ts` | MODIFY | Add `{ withTimezone: true }` to 5 timestamp calls |
| 3 | `src/lib/db/schema/shipping.ts` | MODIFY | Add `.notNull().default('{}')` to feeAllocationJson |
| 4 | `src/lib/db/schema/listings.ts` | MODIFY | Add 2 missing indexes |
| 5 | `src/lib/db/schema/auth.ts` | MODIFY | Add FK reference to referredByAffiliateId |
| 6 | `src/lib/casl/ability.ts` | MODIFY | Fix Listing CASL conditions + seller SellerProfile condition |
| 7 | `src/lib/casl/__tests__/ability-seller-staff.test.ts` | MODIFY | Update test assertions for new CASL conditions |
| 8 | `src/lib/auth/server.ts` | MODIFY | Replace 10 console.log with logger + add 6 missing additionalFields |
| 9 | `src/lib/auth/actions.ts` | MODIFY | Replace TypeScript interface with Zod schema + replace console.error with logger |
| 10 | `src/lib/stripe/webhooks.ts` | MODIFY | Replace 8 console.error + 2 console.log + 1 console.warn with logger |
| 11 | `src/middleware.ts` | MODIFY | Remove `/admin/` prefix handling (hub routes via proxy.ts) |

**Total: 11 files modified, 0 files created.**

---

## Stream 1: Schema + CASL Fixes (CRITICAL)

### Fix 1.1: Add missing sellerProfile columns to `identity.ts`

**File:** `src/lib/db/schema/identity.ts`
**Spec reference:** `TWICELY_V3_SCHEMA_v2_0_7.md` lines 337-379 (Section 2.3)

The spec defines `payoutFrequency` and `maxMeetupDistanceMiles` on sellerProfile. The implementation is missing both.

**Where in the spec:**
```
isAuthenticatedSeller: boolean('is_authenticated_seller').notNull().default(false),
maxMeetupDistanceMiles: integer('max_meetup_distance_miles'),
payoutFrequency:    text('payout_frequency').notNull().default('WEEKLY'),
trialListerUsed:    boolean('trial_lister_used').notNull().default(false),
```

**Current code (lines 52-54):**
```typescript
  // D6 — Authentication Program (Tier 1 Verified Seller badge)
  isAuthenticatedSeller: boolean('is_authenticated_seller').notNull().default(false),
}, (table) => ({
```

**Replace with:**
```typescript
  // D6 — Authentication Program (Tier 1 Verified Seller badge)
  isAuthenticatedSeller: boolean('is_authenticated_seller').notNull().default(false),
  // Local pickup
  maxMeetupDistanceMiles: integer('max_meetup_distance_miles'),
  // Payout frequency
  payoutFrequency:    text('payout_frequency').notNull().default('WEEKLY'),
}, (table) => ({
```

**Why:** The spec places `maxMeetupDistanceMiles` and `payoutFrequency` right after `isAuthenticatedSeller` and before the trial tracking fields. However, in our implementation the trial fields come earlier (lines 33-37) and `isAuthenticatedSeller` comes last before the index block. Place the two new columns between `isAuthenticatedSeller` and the closing `}, (table) =>`.

---

### Fix 1.2: Fix personalization.ts timestamps

**File:** `src/lib/db/schema/personalization.ts`
**Spec reference:** `TWICELY_V3_SCHEMA_v2_0_7.md` lines 3316-3352 (Sections 22.1 & 22.2)

The spec shows `timestamp('created_at')` WITHOUT `{ withTimezone: true }` for interestTag and userInterest. The implementation currently matches the spec -- both tables use `timestamp('created_at').defaultNow().notNull()` without `{ withTimezone: true }`.

**HOWEVER:** The CLAUDE.md and project convention is that ALL timestamps use `{ withTimezone: true }`. Every other table in the codebase uses `{ withTimezone: true }` on every timestamp. The spec is likely just abbreviated here. The spec doc itself has tables where timestamps are written with `{ withTimezone: true }` (e.g., Section 2.3 sellerProfile) and tables where the shorthand is used. The project standard is `withTimezone: true` on every timestamp.

**5 timestamps to fix in this file:**

1. **Line 27** — `interestTag.createdAt`:
   - Current: `createdAt: timestamp('created_at').defaultNow().notNull(),`
   - Change to: `createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),`

2. **Line 28** — `interestTag.updatedAt`:
   - Current: `updatedAt: timestamp('updated_at').defaultNow().notNull(),`
   - Change to: `updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),`

3. **Line 40** — `userInterest.expiresAt`:
   - Current: `expiresAt: timestamp('expires_at'),`
   - Change to: `expiresAt: timestamp('expires_at', { withTimezone: true }),`

4. **Line 41** — `userInterest.createdAt`:
   - Current: `createdAt: timestamp('created_at').defaultNow().notNull(),`
   - Change to: `createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),`

5. **Line 42** — `userInterest.updatedAt`:
   - Current: `updatedAt: timestamp('updated_at').defaultNow().notNull(),`
   - Change to: `updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),`

---

### Fix 1.3: Fix returnRequest feeAllocationJson

**File:** `src/lib/db/schema/shipping.ts`
**Spec reference:** `TWICELY_V3_SCHEMA_v2_0_7.md` line 1144

The spec says:
```
feeAllocationJson:   jsonb('fee_allocation_json').notNull().default('{}'),
```

**Current code (line 59):**
```typescript
  feeAllocationJson:   jsonb('fee_allocation_json'),
```

**Replace with:**
```typescript
  feeAllocationJson:   jsonb('fee_allocation_json').notNull().default('{}'),
```

---

### Fix 1.4: Add missing listing indexes

**File:** `src/lib/db/schema/listings.ts`
**Spec reference:** `TWICELY_V3_SCHEMA_v2_0_7.md` lines 775-778

The spec defines two indexes the implementation is missing:
```
fulfillmentIdx:  index('lst_fulfillment').on(table.fulfillmentType),
authStatusIdx:   index('lst_auth_status').on(table.authenticationStatus),
```

**Current code (lines 85-95):**
```typescript
}, (table) => ({
  ownerStatusIdx:  index('lst_owner_status').on(table.ownerUserId, table.status),
  ownerCreatedIdx: index('lst_owner_created').on(table.ownerUserId, table.createdAt),
  categoryIdx:     index('lst_category').on(table.categoryId),
  storefrontCatIdx: index('lst_storefront_cat').on(table.storefrontCategoryId),
  statusCreatedIdx: index('lst_status_created').on(table.status, table.createdAt),
  priceIdx:        index('lst_price').on(table.priceCents),
  slugIdx:         index('lst_slug').on(table.slug),
  enforcementIdx:  index('lst_enforcement').on(table.enforcementState),
  expiresIdx:      index('lst_expires').on(table.expiresAt),
}));
```

**Replace with:**
```typescript
}, (table) => ({
  ownerStatusIdx:  index('lst_owner_status').on(table.ownerUserId, table.status),
  ownerCreatedIdx: index('lst_owner_created').on(table.ownerUserId, table.createdAt),
  categoryIdx:     index('lst_category').on(table.categoryId),
  storefrontCatIdx: index('lst_storefront_cat').on(table.storefrontCategoryId),
  statusCreatedIdx: index('lst_status_created').on(table.status, table.createdAt),
  priceIdx:        index('lst_price').on(table.priceCents),
  slugIdx:         index('lst_slug').on(table.slug),
  enforcementIdx:  index('lst_enforcement').on(table.enforcementState),
  expiresIdx:      index('lst_expires').on(table.expiresAt),
  fulfillmentIdx:  index('lst_fulfillment').on(table.fulfillmentType),
  authStatusIdx:   index('lst_auth_status').on(table.authenticationStatus),
}));
```

---

### Fix 1.5: Add referredByAffiliateId FK reference

**File:** `src/lib/db/schema/auth.ts`
**Spec reference:** `TWICELY_V3_SCHEMA_v2_0_7.md` line 285

The spec says:
```
referredByAffiliateId: text('referred_by_affiliate_id').references(() => affiliate.id),
```

**Current code (line 33):**
```typescript
  referredByAffiliateId: text('referred_by_affiliate_id'),
```

This is missing the `.references(() => affiliate.id)` FK constraint.

**CIRCULAR IMPORT CHECK:** `auth.ts` defines `user`. `affiliates.ts` imports `user` from `./auth`. If `auth.ts` imports `affiliate` from `./affiliates`, that creates a circular dependency: `auth.ts -> affiliates.ts -> auth.ts`.

**Resolution:** Do NOT add the FK reference in the Drizzle schema. This would create a circular import. Instead, add a comment explaining why the FK is enforced at the database migration level, not in Drizzle.

**Replace line 33:**
```typescript
  referredByAffiliateId: text('referred_by_affiliate_id'),
```

**With:**
```typescript
  // FK to affiliate.id — enforced via migration, not Drizzle (circular import: auth -> affiliates -> auth)
  referredByAffiliateId: text('referred_by_affiliate_id'),
```

---

### Fix 1.6: Fix CASL Listing conditions (CRITICAL)

**File:** `src/lib/casl/ability.ts`
**Spec reference:** `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` lines 397-412

This is the most critical fix. The spec says:

**For Seller (line 399):**
```
can('manage', 'Listing', { ownerUserId: session.userId });
```

**For Seller Staff (lines 419-421):**
```
if (scopes.includes('listings.view')) can('read', 'Listing', { sellerId: sid });
if (scopes.includes('listings.manage')) {
  can(['create', 'update', 'delete'], 'Listing', { sellerId: sid });
}
```

The listing table column is `ownerUserId` (referencing `user.id`). The spec uses `{ ownerUserId: session.userId }` for seller listing access. The current code uses `{ sellerId }` which is wrong -- `sellerId` in the session is the `sellerProfile.id`, NOT the `user.id`, and the listing table has no `sellerId` column.

**For seller staff:** The spec uses `{ sellerId: sid }` where `sid = session.onBehalfOfSellerId` (a sellerProfile.id). But the listing table has `ownerUserId` (a user.id), not `sellerId`. This is a spec inconsistency. Since the actual DB column is `ownerUserId` and it references `user.id`, staff listing conditions need a different approach. However, since the spec explicitly says `{ sellerId: sid }` for staff, AND since CASL conditions are about the subject model (not necessarily DB columns directly), we need to understand the intent:

- The spec's CASL rules describe the **logical model** for condition matching
- In the actual DB queries, the condition would be translated to the correct column
- For sellers: the spec is clear — use `{ ownerUserId: session.userId }`
- For staff: the spec says `{ sellerId: sid }` — this maps to the logical concept "the seller's listings"

**Decision:** Follow the spec exactly as written. For the **seller** role, fix the Listing condition from `{ sellerId }` to `{ ownerUserId: userId }`. For staff, keep `{ sellerId }` per spec (the condition matching will use logical subject fields, not DB columns directly).

**Also fix:** The seller's `SellerProfile` CASL condition. Current implementation uses `{ id: sellerId }` but the spec says `{ userId: session.userId }`.

#### Changes to `defineSellerAbilities` (lines 95-151):

**Current (lines 95-103):**
```typescript
  // Listings - CRUD own listings
  can('create', 'Listing', { sellerId });
  can('read', 'Listing', { sellerId });
  can('update', 'Listing', { sellerId });
  can('delete', 'Listing', { sellerId });

  // Orders - seller side
  can('read', 'Order', { sellerId });
  can('update', 'Order', { sellerId });
```

**Replace with:**
```typescript
  // Listings - CRUD own listings (ownerUserId = userId per spec §4.2)
  can('manage', 'Listing', { ownerUserId: userId });

  // Orders - seller side
  can('read', 'Order', { sellerId });
  can('update', 'Order', { sellerId });
```

**Current (lines 105-108):**
```typescript
  // Shipments
  can('create', 'Shipment', { sellerId });
  can('read', 'Shipment', { sellerId });
  can('update', 'Shipment', { sellerId });
```

**Replace with:**
```typescript
  // Shipments
  can('manage', 'Shipment', { sellerId });
```

**Current (lines 113-115):**
```typescript
  // Returns - seller side
  can('read', 'Return', { sellerId });
  can('update', 'Return', { sellerId });
```

**Replace with:**
```typescript
  // Returns - seller side (approve/reject)
  can('update', 'Return', { sellerId });
```

**Current (lines 117-119):**
```typescript
  // Disputes - seller side
  can('read', 'Dispute', { sellerId });
  can('update', 'Dispute', { sellerId });
```

**Replace with:**
```typescript
  // Disputes - seller side (respond)
  can('update', 'Dispute', { sellerId });
```

**Current (lines 121-122):**
```typescript
  // Payouts - read only
  can('read', 'Payout', { sellerId });
```

This line is correct per spec.

**Current (lines 128-130):**
```typescript
  // Seller profile
  can('read', 'SellerProfile', { id: sellerId });
  can('update', 'SellerProfile', { id: sellerId });
```

**Replace with:**
```typescript
  // Seller profile (condition uses userId per spec §4.2)
  can('manage', 'SellerProfile', { userId });
```

**Current (lines 132-133):**
```typescript
  // Delegated access (staff management)
  can('manage', 'DelegatedAccess', { sellerId });
```

This line is correct per spec.

**Current (lines 135-138):**
```typescript
  // Subscriptions
  can('read', 'Subscription', { userId });
  can('create', 'Subscription');
  can('update', 'Subscription', { userId });
```

**Replace with (spec uses sellerId):**
```typescript
  // Subscriptions
  can('manage', 'Subscription', { sellerId });
```

**Current (lines 140-142):**
```typescript
  // Promotions
  can('manage', 'Promotion', { sellerId });
  can('manage', 'PromotedListing', { sellerId });
```

These lines are correct per spec.

**Current (lines 144-145):**
```typescript
  // Analytics
  can('read', 'Analytics', { sellerId });
```

This line is correct per spec.

**Current (lines 147-150):**
```typescript
  // Authentication - seller can request pre-listing auth and read/update auth on their listings
  can('create', 'AuthenticationRequest', { sellerId });
  can('read', 'AuthenticationRequest', { sellerId });
  can('update', 'AuthenticationRequest', { sellerId }); // submit photos, update status
```

The spec (lines 397-411) does NOT include AuthenticationRequest in the seller section. However, this was added in D6. Leave as-is since it was added by a later phase. (Do not remove functionality added by subsequent phases.)

#### Complete replacement for `defineSellerAbilities`:

Replace the entire function body (lines 83-151) with:

```typescript
function defineSellerAbilities(
  builder: AbilityBuilder<AppAbility>,
  session: CaslSession
): void {
  const { can } = builder;
  const { userId, sellerId } = session;

  // Inherit all buyer abilities
  defineBuyerAbilities(builder, session);

  if (!sellerId) return;

  // Listings - ownerUserId = userId per spec §4.2
  can('manage', 'Listing', { ownerUserId: userId });

  // Orders - seller side
  can('read', 'Order', { sellerId });
  can('update', 'Order', { sellerId });

  // Shipments
  can('manage', 'Shipment', { sellerId });

  // Shipping profiles
  can('manage', 'ShippingProfile', { userId });

  // Returns - seller side (approve/reject)
  can('update', 'Return', { sellerId });

  // Disputes - seller side (respond)
  can('update', 'Dispute', { sellerId });

  // Payouts - read only
  can('read', 'Payout', { sellerId });

  // Messages (already inherited, but seller context)
  can('read', 'Message', { participantId: userId });
  can('create', 'Message');

  // Seller profile (condition uses userId per spec §4.2)
  can('manage', 'SellerProfile', { userId });

  // Delegated access (staff management)
  can('manage', 'DelegatedAccess', { sellerId });

  // Subscriptions
  can('manage', 'Subscription', { sellerId });

  // Promotions
  can('manage', 'Promotion', { sellerId });
  can('manage', 'PromotedListing', { sellerId });

  // Analytics
  can('read', 'Analytics', { sellerId });

  // Authentication - seller can request pre-listing auth (D6)
  can('create', 'AuthenticationRequest', { sellerId });
  can('read', 'AuthenticationRequest', { sellerId });
  can('update', 'AuthenticationRequest', { sellerId });
}
```

#### Changes to `defineStaffAbilities` (lines 156-261):

The staff SellerProfile conditions need to use `{ sellerId }` per spec (lines 433-434), NOT `{ id: sellerId }`.

**Current (lines 236-238):**
```typescript
  if (scopes.includes('settings.view')) {
    can('read', 'SellerProfile', { id: sellerId });
  }
```

**Replace with:**
```typescript
  if (scopes.includes('settings.view')) {
    can('read', 'SellerProfile', { sellerId });
  }
```

**Current (lines 240-243):**
```typescript
  if (scopes.includes('settings.manage')) {
    can('read', 'SellerProfile', { id: sellerId });
    can('update', 'SellerProfile', { id: sellerId });
  }
```

**Replace with:**
```typescript
  if (scopes.includes('settings.manage')) {
    can('read', 'SellerProfile', { sellerId });
    can('update', 'SellerProfile', { sellerId });
  }
```

---

### Fix 1.7: Update CASL tests for new conditions

**File:** `src/lib/casl/__tests__/ability-seller-staff.test.ts`
**Why:** The test file uses `{ sellerId: session.sellerId }` for Listing assertions which will now fail since seller Listing rules use `{ ownerUserId: userId }`.

#### Seller listing test changes:

**Current (lines 16-21):**
```typescript
  test('can CRUD own listings', () => {
    expect(ability.can('create', sub('Listing', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('read', sub('Listing', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('update', sub('Listing', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('delete', sub('Listing', { sellerId: session.sellerId }))).toBe(true);
  });
```

**Replace with:**
```typescript
  test('can CRUD own listings', () => {
    expect(ability.can('create', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
    expect(ability.can('read', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
    expect(ability.can('update', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
    expect(ability.can('delete', sub('Listing', { ownerUserId: session.userId }))).toBe(true);
  });
```

**Current (lines 23-27):**
```typescript
  test('cannot CRUD other sellers listings', () => {
    expect(ability.can('create', sub('Listing', { sellerId: 'other-seller' }))).toBe(false);
    expect(ability.can('update', sub('Listing', { sellerId: 'other-seller' }))).toBe(false);
    expect(ability.can('delete', sub('Listing', { sellerId: 'other-seller' }))).toBe(false);
  });
```

**Replace with:**
```typescript
  test('cannot CRUD other sellers listings', () => {
    expect(ability.can('create', sub('Listing', { ownerUserId: 'other-user' }))).toBe(false);
    expect(ability.can('update', sub('Listing', { ownerUserId: 'other-user' }))).toBe(false);
    expect(ability.can('delete', sub('Listing', { ownerUserId: 'other-user' }))).toBe(false);
  });
```

**Current (lines 44-46):**
```typescript
  test('cannot manage payouts', () => {
    expect(ability.can('manage', sub('Payout', { sellerId: session.sellerId }))).toBe(false);
  });
```

This test needs to stay as-is. Seller can `read` payouts with `{ sellerId }` but cannot `manage` them (no manage rule was granted). This should still pass.

**Current (lines 52-56):**
```typescript
  test('can manage own subscriptions', () => {
    expect(ability.can('read', sub('Subscription', { userId: session.userId }))).toBe(true);
    expect(ability.can('create', 'Subscription')).toBe(true);
    expect(ability.can('update', sub('Subscription', { userId: session.userId }))).toBe(true);
  });
```

**Replace with (seller subscription rules now use `{ sellerId }`):**
```typescript
  test('can manage own subscriptions', () => {
    expect(ability.can('read', sub('Subscription', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('create', sub('Subscription', { sellerId: session.sellerId }))).toBe(true);
    expect(ability.can('update', sub('Subscription', { sellerId: session.sellerId }))).toBe(true);
  });
```

**Staff listing test (line 159):**
```typescript
    expect(ability.can('update', sub('Listing', { sellerId: session.onBehalfOfSellerId }))).toBe(true);
    expect(ability.can('delete', sub('Listing', { sellerId: session.onBehalfOfSellerId }))).toBe(true);
```
These stay as-is — staff listing rules use `{ sellerId }` per spec.

---

## Stream 2: Auth + Middleware Fixes

### Fix 2.1: Add Zod validation to updateProfile in `auth/actions.ts`

**File:** `src/lib/auth/actions.ts`

**Current (lines 1-8, import section):**
```typescript
'use server';

import { headers } from 'next/headers';
import { auth } from './server';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@/lib/casl';
```

**Replace with:**
```typescript
'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { auth } from './server';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@/lib/casl';
import { logger } from '@/lib/logger';
```

**Current (lines 12-19, interface definition):**
```typescript
export interface UpdateProfileData {
  name?: string;
  displayName?: string;
  username?: string;
  bio?: string;
  phone?: string;
  marketingOptIn?: boolean;
}
```

**Replace with:**
```typescript
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  displayName: z.string().max(100).optional(),
  username: z.string().min(3).max(30).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  marketingOptIn: z.boolean().optional(),
}).strict();

export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
```

**Current (line 26, function start):**
```typescript
export async function updateProfile(data: UpdateProfileData): Promise<UpdateProfileResult> {
```

**After the authorize check (insert after line 27, before the CASL check):**

Insert a Zod validation guard right at the beginning of the function, after the authorize call:

**Current (lines 26-31):**
```typescript
export async function updateProfile(data: UpdateProfileData): Promise<UpdateProfileResult> {
  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }
```

**Replace with:**
```typescript
export async function updateProfile(data: unknown): Promise<UpdateProfileResult> {
  const parsed = updateProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { ability, session } = await authorize();

  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }
```

Then replace `data.` references in lines 39-67 with `parsed.data.`:

**Current (line 39):**
```typescript
  if (data.username) {
```

**Replace with:**
```typescript
  if (parsed.data.username) {
```

**Current (line 42):**
```typescript
      .where(eq(user.username, data.username))
```

**Replace with:**
```typescript
      .where(eq(user.username, parsed.data.username))
```

**Current (lines 62-67):**
```typescript
    if (data.name !== undefined) updateData.name = data.name;
    if (data.displayName !== undefined) updateData.displayName = data.displayName || null;
    if (data.username !== undefined) updateData.username = data.username || null;
    if (data.bio !== undefined) updateData.bio = data.bio || null;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.marketingOptIn !== undefined) updateData.marketingOptIn = data.marketingOptIn;
```

**Replace with:**
```typescript
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName || null;
    if (parsed.data.username !== undefined) updateData.username = parsed.data.username || null;
    if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio || null;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone || null;
    if (parsed.data.marketingOptIn !== undefined) updateData.marketingOptIn = parsed.data.marketingOptIn;
```

### Fix 2.2: Replace console.error in `auth/actions.ts`

**Current (line 76):**
```typescript
    console.error('Failed to update profile:', error);
```

**Replace with:**
```typescript
    logger.error('Failed to update profile', { error: error instanceof Error ? error.message : String(error) });
```

---

### Fix 2.3: Replace console.log in `auth/server.ts`

**File:** `src/lib/auth/server.ts`

Add import at top of file. **Current (lines 1-4):**
```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
```

**Replace with:**
```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { logger } from '@/lib/logger';
```

**Current (lines 74-80, password reset handler):**
```typescript
    sendResetPassword: async ({ user, url }) => {
      console.log('========================================');
      console.log('PASSWORD RESET EMAIL');
      console.log('To:', user.email);
      console.log('Reset URL:', url);
      console.log('========================================');
    },
```

**Replace with:**
```typescript
    sendResetPassword: async ({ user, url }) => {
      logger.info('Password reset email', { to: user.email, resetUrl: url });
    },
```

**Current (lines 83-89, email verification handler):**
```typescript
    sendVerificationEmail: async ({ user, url }) => {
      console.log('========================================');
      console.log('EMAIL VERIFICATION');
      console.log('To:', user.email);
      console.log('Verification URL:', url);
      console.log('========================================');
    },
```

**Replace with:**
```typescript
    sendVerificationEmail: async ({ user, url }) => {
      logger.info('Email verification', { to: user.email, verificationUrl: url });
    },
```

---

### Fix 2.4: Add missing Better Auth additionalFields in `auth/server.ts`

**File:** `src/lib/auth/server.ts`
**Spec reference:** User table in `auth.ts` lines 25-33

The user table has these columns that are missing from `additionalFields`:
- `dashboardLayoutJson` (jsonb, nullable) — line 25
- `deletionRequestedAt` (timestamp, nullable) — line 27
- `referredByAffiliateId` (text, nullable) — line 33
- `creditBalanceCents` (integer, default 0) — line 32
- `bannedAt` (timestamp, nullable) — line 29
- `bannedReason` (text, nullable) — line 30

**Current (lines 63-67, end of additionalFields):**
```typescript
      isBanned: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
    },
```

**Replace with:**
```typescript
      isBanned: {
        type: 'boolean',
        required: false,
        defaultValue: false,
      },
      dashboardLayoutJson: {
        type: 'string',
        required: false,
      },
      deletionRequestedAt: {
        type: 'string',
        required: false,
      },
      referredByAffiliateId: {
        type: 'string',
        required: false,
      },
      creditBalanceCents: {
        type: 'number',
        required: false,
        defaultValue: 0,
      },
      bannedAt: {
        type: 'string',
        required: false,
      },
      bannedReason: {
        type: 'string',
        required: false,
      },
    },
```

**Also update the `UserAdditionalFields` interface (lines 115-127):**

**Current:**
```typescript
export interface UserAdditionalFields {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  avatarUrl?: string | null;
  defaultAddressId?: string | null;
  isSeller?: boolean;
  buyerQualityTier?: string;
  marketingOptIn?: boolean;
  isBanned?: boolean;
}
```

**Replace with:**
```typescript
export interface UserAdditionalFields {
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  phone?: string | null;
  phoneVerified?: boolean;
  avatarUrl?: string | null;
  defaultAddressId?: string | null;
  isSeller?: boolean;
  buyerQualityTier?: string;
  marketingOptIn?: boolean;
  isBanned?: boolean;
  dashboardLayoutJson?: string | null;
  deletionRequestedAt?: string | null;
  referredByAffiliateId?: string | null;
  creditBalanceCents?: number;
  bannedAt?: string | null;
  bannedReason?: string | null;
}
```

---

### Fix 2.5: Replace console.log/error/warn in `stripe/webhooks.ts`

**File:** `src/lib/stripe/webhooks.ts`

Add import. **Current (lines 8-12):**
```typescript
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { order, sellerProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncAccountStatus } from './connect';
```

**Replace with:**
```typescript
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { order, sellerProfile } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncAccountStatus } from './connect';
import { logger } from '@/lib/logger';
```

Then replace every `console.error`, `console.log`, and `console.warn` with logger calls:

| Line | Current | Replacement |
|------|---------|-------------|
| 114 | `console.error('Error handling payment_intent.succeeded:', error);` | `logger.error('Error handling payment_intent.succeeded', { error: error instanceof Error ? error.message : String(error) });` |
| 160 | `console.error('Error handling payment_intent.payment_failed:', error);` | `logger.error('Error handling payment_intent.payment_failed', { error: error instanceof Error ? error.message : String(error) });` |
| 176 | `console.error('Error handling account.updated:', error);` | `logger.error('Error handling account.updated', { error: error instanceof Error ? error.message : String(error) });` |
| 193 | `console.warn('Trial ending webhook missing userId metadata');` | `logger.warn('Trial ending webhook missing userId metadata');` |
| 219 | `console.error('Error handling customer.subscription.trial_will_end:', error);` | `logger.error('Error handling customer.subscription.trial_will_end', { error: error instanceof Error ? error.message : String(error) });` |
| 246 | ``console.log(`Trial converted for user ${userId}`);`` | `logger.info('Trial converted', { userId });` |
| 266 | ``console.log(`Trial expired for user ${userId}, downgraded to NONE tier`);`` | `logger.info('Trial expired, downgraded to NONE tier', { userId });` |
| 272 | `console.error('Error handling customer.subscription.updated:', error);` | `logger.error('Error handling customer.subscription.updated', { error: error instanceof Error ? error.message : String(error) });` |
| 288 | `console.error('Error handling charge.dispute.created:', error);` | `logger.error('Error handling charge.dispute.created', { error: error instanceof Error ? error.message : String(error) });` |
| 304 | `console.error('Error handling charge.dispute resolution:', error);` | `logger.error('Error handling charge.dispute resolution', { error: error instanceof Error ? error.message : String(error) });` |

---

### Fix 2.6: Fix middleware — remove `/admin/` prefix handling

**File:** `src/middleware.ts`

Hub admin routes are handled by `proxy.ts` subdomain routing (`hub.twicely.co`). The `/admin/` prefix in the marketplace middleware is incorrect — there is no `/admin/` route in the page registry.

**Current (lines 44-46):**
```typescript
const ADMIN_PREFIXES = [
  '/admin/',
];
```

**Replace with:**
```typescript
const ADMIN_PREFIXES: string[] = [];
```

**Current (lines 91-97):**
```typescript
  // 3. Admin routes - require auth (staff role check in Phase E)
  if (isAdminPath(pathname)) {
    if (!hasSession(request)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }
```

**Remove this entire block.** Replace it with a comment:

```typescript
  // 3. Admin routes — handled by hub.twicely.co subdomain via proxy.ts
```

**Also remove the `isAdminPath` function (lines 62-64):**
```typescript
function isAdminPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
```

**Replace with nothing** (delete these 3 lines). Also remove the `ADMIN_PREFIXES` constant entirely.

**Complete replacement for middleware.ts:**

```typescript
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Middleware - Route protection and auth checks
 *
 * Route types:
 * - PUBLIC: Pass through, no auth check
 * - AUTHENTICATED: Redirect to /auth/login if no session
 * - CRON: Require Authorization: Bearer <CRON_SECRET>
 * - ADMIN: Handled by hub.twicely.co subdomain via proxy.ts
 */

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/s',
];

const PUBLIC_PREFIXES = [
  '/i/',       // Listing detail
  '/c/',       // Categories
  '/st/',      // Storefronts
  '/auth/',    // Auth pages
  '/api/auth/', // Better Auth catch-all
  '/api/webhooks/', // Stripe webhooks (signature verified internally)
  '/api/categories/', // Public category search
  '/p/',       // Policies
  '/h/',       // Help center
  '/_next/',   // Static assets
];

const AUTH_REQUIRED_PREFIXES = [
  '/my/',      // User hub
  '/checkout/', // Checkout flow
  '/api/upload', // Upload API
  '/api/returns/', // Returns API
  '/api/protection/', // Buyer protection API
];

const CRON_PREFIXES = [
  '/api/cron/',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname === '/favicon.ico') return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRequired(pathname: string): boolean {
  return AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isCronPath(pathname: string): boolean {
  return CRON_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasSession(request: NextRequest): boolean {
  // Check for Better Auth session cookie (prefixed with 'twicely')
  const sessionCookie = request.cookies.get('twicely.session_token');
  return !!sessionCookie?.value;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // 1. CRON routes - require CRON_SECRET
  if (isCronPath(pathname)) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 2. Public routes - pass through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 3. Admin routes — handled by hub.twicely.co subdomain via proxy.ts

  // 4. Auth-required routes - redirect to login if no session
  if (isAuthRequired(pathname)) {
    if (!hasSession(request)) {
      const isApiRoute = pathname.startsWith('/api/');
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 5. Default - pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## Acceptance Criteria

Run these checks after all changes:

1. **TypeScript:** `pnpm typecheck` — must report 0 errors
2. **Tests:** `pnpm test --run` — must be >= 1152 passing (BASELINE_TESTS from CLAUDE.md)
3. **Lint:** `./twicely-lint.sh` — no new violations
4. **Manual verification:**
   - Grep for `console.log` in the 4 modified files — must be 0 occurrences
   - Grep for `console.error` in the 4 modified files — must be 0 occurrences
   - Grep for `console.warn` in the 4 modified files — must be 0 occurrences
   - Grep for `/admin/` in `middleware.ts` — must be 0 occurrences
   - Verify `feeAllocationJson` in `shipping.ts` has `.notNull().default('{}')`
   - Verify `payoutFrequency` and `maxMeetupDistanceMiles` exist in `identity.ts`
   - Verify `fulfillmentIdx` and `authStatusIdx` exist in `listings.ts`
   - Verify seller Listing CASL condition uses `{ ownerUserId: userId }` not `{ sellerId }`
   - Verify all 5 personalization.ts timestamps have `{ withTimezone: true }`

## Summary of All Changes

| Stream | Fix | File | What Changed |
|--------|-----|------|-------------|
| 1 | 1.1 | identity.ts | +2 columns: `payoutFrequency`, `maxMeetupDistanceMiles` |
| 1 | 1.2 | personalization.ts | +`{ withTimezone: true }` on 5 timestamps |
| 1 | 1.3 | shipping.ts | `feeAllocationJson` gained `.notNull().default('{}')` |
| 1 | 1.4 | listings.ts | +2 indexes: `fulfillmentIdx`, `authStatusIdx` |
| 1 | 1.5 | auth.ts | +comment explaining circular FK on `referredByAffiliateId` |
| 1 | 1.6 | ability.ts | Seller Listing: `{ sellerId }` -> `{ ownerUserId: userId }` + SellerProfile: `{ id: sellerId }` -> `{ userId }` + Subscription: `{ userId }` -> `{ sellerId }` + compacted rules to match spec |
| 1 | 1.7 | ability-seller-staff.test.ts | Updated test assertions for new Listing/Subscription conditions |
| 2 | 2.1 | actions.ts | TypeScript interface -> Zod `.strict()` schema + safeParse guard |
| 2 | 2.2 | actions.ts | `console.error` -> `logger.error` |
| 2 | 2.3 | server.ts | 10x `console.log` -> `logger.info` |
| 2 | 2.4 | server.ts | +6 missing `additionalFields` + updated `UserAdditionalFields` interface |
| 2 | 2.5 | webhooks.ts | 6x `console.error` + 2x `console.log` + 1x `console.warn` -> logger |
| 2 | 2.6 | middleware.ts | Removed `/admin/` prefix handling (hub via proxy.ts) |
