# TWICELY V3 — Slice A4: CASL Authorization

## Prerequisites
- A3 complete: Better Auth working, signup/login/logout functional
- `@casl/ability` already installed (A1 scaffold)
- User table has `isSeller` field (A2 schema)
- Session available via `auth.api.getSession()` on server

## What This Slice Builds

CASL authorization for the **marketplace side only**. 4 actor types now, 2 deferred:

| Actor | Built Now | How Detected |
|-------|-----------|-------------|
| Guest | ✅ | No session |
| Buyer | ✅ | Session exists, `isSeller === false` |
| Seller | ✅ | Session exists, `isSeller === true` |
| Seller Staff | ✅ | Session exists, `delegationId !== null` |
| Platform Agent | ❌ Phase E | `isPlatformStaff === true` |
| Platform Admin | ❌ Phase E | `isPlatformStaff === true` + admin role |

## Tech Stack (Locked)

- `@casl/ability` — core CASL library (already installed)
- `@casl/react` — install this now: `pnpm add @casl/react`
- NO custom RBAC. NO role strings. CASL only.

---

## FILE PLAN (~10 files)

**Get approval before writing any code.**

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `src/lib/casl/subjects.ts` | Typed subject enum — every CASL subject as a string union |
| 2 | `src/lib/casl/actions.ts` | Typed action enum — read, create, update, delete, manage |
| 3 | `src/lib/casl/types.ts` | AppAbility type, AppSubjects type, session-to-CASL mapping types |
| 4 | `src/lib/casl/ability.ts` | `defineAbilitiesFor(session)` — the ability factory |
| 5 | `src/lib/casl/authorize.ts` | Server-side `authorize()` helper for API routes and server actions |
| 6 | `src/lib/casl/index.ts` | Barrel export |
| 7 | `src/components/Can.tsx` | Client-side `<Can>` component for UI gating |
| 8 | `src/lib/casl/__tests__/ability.test.ts` | Vitest tests for ability factory — all 4 actor types |
| 9 | `src/lib/casl/__tests__/authorize.test.ts` | Vitest tests for server authorize helper |

That's 9 files. Do NOT create any others without asking.

---

## SESSION SHAPE

The ability factory needs a session object. Use this type — it extends what Better Auth gives us with marketplace fields:

```typescript
// This is the INPUT to defineAbilitiesFor()
// On the server, build this from auth.api.getSession() + DB lookups
export interface CaslSession {
  userId: string;
  email: string;
  
  // Marketplace identity
  isSeller: boolean;
  sellerId: string | null;          // sellerProfile.id if isSeller
  sellerStatus: string | null;      // 'ACTIVE' | 'SUSPENDED' | etc.
  
  // Delegation (populated when staff acts for a seller)
  delegationId: string | null;
  onBehalfOfSellerId: string | null;
  delegatedScopes: string[];
  
  // Platform staff — STUB for now, always false
  isPlatformStaff: false;
  platformRoles: [];
}
```

For A4, `isPlatformStaff` is always `false` and `platformRoles` is always `[]`. Platform actors come in Phase E.

---

## SUBJECTS (Typed String Union)

Every CASL subject. Define as a const array and derive the type:

```typescript
export const SUBJECTS = [
  'Listing',
  'Order',
  'Cart',
  'Shipment',
  'Return',
  'Dispute',
  'Payout',
  'LedgerEntry',
  'Review',
  'Message',
  'HelpdeskCase',
  'Notification',
  'User',
  'SellerProfile',
  'DelegatedAccess',
  'Subscription',
  'Promotion',
  'PromotedListing',
  'Category',
  'Policy',
  'FeatureFlag',
  'AuditEvent',
  'Setting',
  'Analytics',
  'HealthCheck',
] as const;

export type Subject = (typeof SUBJECTS)[number];
```

Do NOT add subjects not in this list. Do NOT rename any.

## ACTIONS

```typescript
export const ACTIONS = ['read', 'create', 'update', 'delete', 'manage'] as const;
export type Action = (typeof ACTIONS)[number];
```

---

## ABILITY FACTORY — `defineAbilitiesFor(session)`

This is the core function. It takes a `CaslSession | null` and returns a CASL `AppAbility`.

### Guest (session === null)

Guests can browse. They cannot act.

```
can('read', 'Listing')     — only ACTIVE listings (condition enforced at query time, not CASL)
can('read', 'Category')
can('read', 'Review')
can('read', 'SellerProfile')
can('read', 'Policy')
can('read', 'Cart')        — session-based cart
can('create', 'Cart')
can('update', 'Cart')
can('delete', 'Cart')
```

Nothing else. Default deny handles the rest.

### Buyer (session.userId exists, isSeller === false)

Inherits all Guest permissions, plus:

```
can('manage', 'Cart', { userId: session.userId })
can('read', 'Order', { buyerId: session.userId })
can('create', 'Order')
can('create', 'Return', { buyerId: session.userId })
can('create', 'Dispute', { buyerId: session.userId })
can('read', 'Return', { buyerId: session.userId })
can('read', 'Dispute', { buyerId: session.userId })
can('create', 'Review', { buyerId: session.userId })
can('read', 'Review')
can('update', 'Review', { buyerId: session.userId })
can('read', 'Message', { participantId: session.userId })
can('create', 'Message')
can('read', 'HelpdeskCase', { userId: session.userId })
can('create', 'HelpdeskCase')
can('manage', 'Notification', { userId: session.userId })
can('read', 'User', { id: session.userId })
can('update', 'User', { id: session.userId })
can('delete', 'User', { id: session.userId })
```

Buyer boundaries — these are NOT separate rules, they're the absence of rules:
- No `Listing` create/update/delete
- No `Subscription` access
- No `SellerProfile` update
- No platform subjects

### Seller (session.isSeller === true)

Inherits ALL Buyer permissions, plus:

```
can('create', 'Listing', { sellerId: session.sellerId })
can('update', 'Listing', { sellerId: session.sellerId })
can('delete', 'Listing', { sellerId: session.sellerId })
can('read', 'Order', { sellerId: session.sellerId })
can('update', 'Order', { sellerId: session.sellerId })
can('create', 'Shipment', { sellerId: session.sellerId })
can('update', 'Shipment', { sellerId: session.sellerId })
can('read', 'Shipment', { sellerId: session.sellerId })
can('read', 'Return', { sellerId: session.sellerId })
can('update', 'Return', { sellerId: session.sellerId })
can('read', 'Dispute', { sellerId: session.sellerId })
can('update', 'Dispute', { sellerId: session.sellerId })
can('read', 'Payout', { sellerId: session.sellerId })
can('read', 'Message', { participantId: session.userId })
can('create', 'Message')
can('update', 'SellerProfile', { id: session.sellerId })
can('read', 'SellerProfile', { id: session.sellerId })
can('manage', 'DelegatedAccess', { sellerId: session.sellerId })
can('read', 'Subscription', { userId: session.userId })
can('create', 'Subscription')
can('update', 'Subscription', { userId: session.userId })
can('manage', 'Promotion', { sellerId: session.sellerId })
can('manage', 'PromotedListing', { sellerId: session.sellerId })
can('read', 'Analytics', { sellerId: session.sellerId })
```

### Seller Staff (session.delegationId !== null)

Staff get ONLY what their scopes allow, scoped to the delegating seller:

```typescript
const scopes = session.delegatedScopes;
const sellerId = session.onBehalfOfSellerId;

// Map each scope to CASL rules
if (scopes.includes('dashboard.view')) {
  can('read', 'Analytics', { sellerId });
}
if (scopes.includes('listings.view')) {
  can('read', 'Listing', { sellerId });
}
if (scopes.includes('listings.manage')) {
  can('read', 'Listing', { sellerId });
  can('create', 'Listing', { sellerId });
  can('update', 'Listing', { sellerId });
  can('delete', 'Listing', { sellerId });
}
if (scopes.includes('orders.view')) {
  can('read', 'Order', { sellerId });
}
if (scopes.includes('orders.manage')) {
  can('read', 'Order', { sellerId });
  can('update', 'Order', { sellerId });
}
if (scopes.includes('shipping.manage')) {
  can('read', 'Shipment', { sellerId });
  can('create', 'Shipment', { sellerId });
  can('update', 'Shipment', { sellerId });
}
if (scopes.includes('returns.respond')) {
  can('read', 'Return', { sellerId });
  can('update', 'Return', { sellerId });
}
if (scopes.includes('messages.view')) {
  can('read', 'Message', { sellerId });
}
if (scopes.includes('messages.send')) {
  can('read', 'Message', { sellerId });
  can('create', 'Message');
}
if (scopes.includes('finance.view')) {
  can('read', 'Payout', { sellerId });
  can('read', 'LedgerEntry', { sellerId });
}
if (scopes.includes('analytics.view')) {
  can('read', 'Analytics', { sellerId });
}
if (scopes.includes('promotions.view')) {
  can('read', 'Promotion', { sellerId });
  can('read', 'PromotedListing', { sellerId });
}
if (scopes.includes('promotions.manage')) {
  can('manage', 'Promotion', { sellerId });
  can('manage', 'PromotedListing', { sellerId });
}
if (scopes.includes('settings.view')) {
  can('read', 'SellerProfile', { id: sellerId });
}
if (scopes.includes('settings.manage')) {
  can('read', 'SellerProfile', { id: sellerId });
  can('update', 'SellerProfile', { id: sellerId });
}
if (scopes.includes('staff.manage')) {
  can('manage', 'DelegatedAccess', { sellerId });
}
```

**Staff hardcoded `cannot()` rules — these are IMMUTABLE:**

```typescript
// Staff can NEVER do these, regardless of scopes
cannot('manage', 'Subscription');
cannot('manage', 'Payout');          // can read if finance.view, never manage
cannot('delete', 'SellerProfile');
cannot('update', 'User');            // cannot modify the owner's account
```

Staff also get their own Buyer permissions for their personal account (they're still users).

---

## SERVER-SIDE `authorize()` HELPER

Create a helper that wraps any server action or API route:

```typescript
// Usage in a server action:
export async function createListing(data: CreateListingInput) {
  const { ability, session } = await authorize();
  
  if (!ability.can('create', 'Listing')) {
    throw new ForbiddenError('Not authorized to create listings');
  }
  
  // ... proceed with creation
}
```

Implementation:

```typescript
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { defineAbilitiesFor } from './ability';
import type { CaslSession } from './types';

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function authorize(): Promise<{
  ability: AppAbility;
  session: CaslSession | null;
}> {
  const betterAuthSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!betterAuthSession) {
    // Guest — return guest abilities
    const ability = defineAbilitiesFor(null);
    return { ability, session: null };
  }

  // Build CaslSession from Better Auth session
  // For A4, delegation fields are null (no delegation UI yet)
  // For A4, platform fields are false (no hub auth yet)
  const caslSession: CaslSession = {
    userId: betterAuthSession.user.id,
    email: betterAuthSession.user.email,
    isSeller: (betterAuthSession.user as { isSeller?: boolean }).isSeller || false,
    sellerId: null,    // TODO: lookup from sellerProfile table in B2
    sellerStatus: null,
    delegationId: null,
    onBehalfOfSellerId: null,
    delegatedScopes: [],
    isPlatformStaff: false,
    platformRoles: [],
  };

  const ability = defineAbilitiesFor(caslSession);
  return { ability, session: caslSession };
}
```

Note the `sellerId` TODO — in A4, no one has a seller profile yet. That gets wired up in B2 (listing creation) when the "enable selling" flow is built. For now, `isSeller: false` for everyone and `sellerId: null`.

---

## CLIENT-SIDE `<Can>` COMPONENT

Simple wrapper around `@casl/react`'s `Can` component with proper typing:

```typescript
// src/components/Can.tsx
'use client';

import { createContext, useContext } from 'react';
import { createContextualCan } from '@casl/react';
import type { AppAbility } from '@/lib/casl/types';

export const AbilityContext = createContext<AppAbility>(undefined!);
export const Can = createContextualCan(AbilityContext.Consumer);
```

This needs an `AbilityProvider` that wraps the app and provides the ability instance. For now, create it but don't wire it into the layout — that happens when we have actual UI that needs permission checks (Phase B).

---

## VITEST TESTS (REQUIRED)

### ability.test.ts — Test every actor type

```
describe('Guest abilities', () => {
  test('can read active listings')
  test('can read categories')
  test('can read reviews')
  test('cannot create listings')
  test('cannot read orders')
  test('cannot access any manage action')
})

describe('Buyer abilities', () => {
  test('inherits guest read permissions')
  test('can manage own cart')
  test('cannot manage other users cart')
  test('can create orders')
  test('can read own orders')
  test('cannot read other users orders')
  test('can create returns on own orders')
  test('can create reviews')
  test('can manage own notifications')
  test('cannot create listings')
  test('cannot access seller subjects')
  test('cannot access platform subjects')
})

describe('Seller abilities', () => {
  test('inherits all buyer permissions')
  test('can CRUD own listings')
  test('cannot CRUD other sellers listings')
  test('can read/update own orders (seller side)')
  test('can manage own shipments')
  test('can read own payouts')
  test('cannot manage payouts')
  test('can manage own delegated access')
  test('can manage own subscriptions')
  test('cannot access platform subjects')
})

describe('Seller Staff abilities', () => {
  test('with listings.view scope: can read listings, cannot create')
  test('with listings.manage scope: can CRUD listings')
  test('with orders.view scope: can read orders, cannot update')
  test('with orders.manage scope: can read and update orders')
  test('with finance.view scope: can read payouts and ledger')
  test('CANNOT manage subscriptions regardless of scopes')
  test('CANNOT manage payouts regardless of scopes')
  test('CANNOT update user account regardless of scopes')
  test('CANNOT delete seller profile regardless of scopes')
  test('can only access delegating sellers data')
  test('with empty scopes: can do nothing seller-related')
  test('retains personal buyer permissions')
})

describe('Default deny', () => {
  test('guest cannot access unspecified subjects')
  test('buyer cannot access FeatureFlag')
  test('seller cannot access Setting')
  test('actions not explicitly granted are denied')
})
```

### authorize.test.ts

```
describe('authorize()', () => {
  test('returns guest ability when no session')
  test('returns buyer ability for authenticated non-seller')
  test('returns seller ability when isSeller is true')
  test('ForbiddenError has correct name and message')
})
```

Mock `auth.api.getSession` for these tests.

---

## WHAT TO WIRE INTO EXISTING CODE

After CASL is built, update these existing files:

1. **`src/lib/auth/actions.ts`** — Add an `authorize()` check to `updateProfile`:
   ```typescript
   const { ability } = await authorize();
   if (!ability.can('update', 'User')) {
     return { success: false, error: 'Not authorized' };
   }
   ```

2. **`src/app/(marketplace)/my/layout.tsx`** — No changes needed. The proxy already redirects unauthenticated users. CASL is for resource-level checks, not route-level auth.

Do NOT modify any other existing files.

---

## RULES

1. **Default deny.** If no CASL rule matches, action is FORBIDDEN. This is CASL's default behavior — do not override it.
2. **No `as any`.** No `@ts-ignore`. No `as unknown as T`. Fix the types.
3. **No files over 300 lines.** The ability factory might get close — split delegation logic into a helper if needed.
4. **Subjects are a typed enum.** TypeScript must prevent inventing new subjects.
5. **`cannot()` rules on Staff are hardcoded.** They are NOT configurable. Not from the database, not from admin settings.
6. **Client CASL is for UI gating only.** Server ALWAYS re-verifies. Never trust the client.
7. **Do NOT create files not in the approved file list.**
8. **Do NOT add CASL checks to pages or API routes beyond what's listed above.** Real per-resource checks come in Phase B/C/D slices.

---

## ACCEPTANCE CRITERIA

1. `pnpm vitest run` — all CASL tests pass
2. `npx tsc --noEmit` — zero errors
3. `pnpm lint` — zero errors
4. `defineAbilitiesFor(null)` returns guest abilities
5. `defineAbilitiesFor(buyerSession)` grants buyer permissions, denies seller
6. `defineAbilitiesFor(sellerSession)` grants seller + buyer permissions
7. `defineAbilitiesFor(staffSession)` grants only scoped permissions + hardcoded cannot()
8. `authorize()` returns ability + session from current request context
9. `ForbiddenError` is a proper Error subclass
10. No platform actor logic exists (no Agent, no Admin)

---

## AUDIT CHECKLIST (Run After Completion)

- [ ] `pnpm vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — clean
- [ ] `pnpm lint` — clean
- [ ] `pnpm build` — clean
- [ ] File count matches plan (9 files, no extras)
- [ ] No `as any` anywhere in CASL files
- [ ] All subjects match the SUBJECTS array exactly
- [ ] All actions match the ACTIONS array exactly
- [ ] Staff `cannot()` rules present and hardcoded
- [ ] Guest abilities are read-only
- [ ] Buyer cannot create listings
- [ ] Seller permissions are ownership-scoped
- [ ] `authorize()` wired into `updateProfile` action
- [ ] Save checkpoint: `tar -cf ../twicely-a4-casl.tar --exclude=node_modules --exclude=.next --exclude=.git .`
