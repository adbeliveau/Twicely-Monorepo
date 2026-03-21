# A-C Audit Repair Pass

**Phase & Step**: Pre-launch audit repair (Phases A-C defects)
**Feature Name**: A-C Audit Repair -- Fix Security, Validation, Route, and Fee-Loading Defects
**One-line Summary**: Repair 4 categories of defects found by pre-launch audit in completed Phases A-C code.
**Status**: NOT a new feature. This is a repair pass. No new tables, no new pages (except route moves + 2 placeholders).

## Canonical Sources

The installer MUST read these before starting:

| Document | Why |
|---|---|
| `CLAUDE.md` | Master rules -- especially ownership model (userId), Zod validation, banned terms, route prefixes |
| `TWICELY_V3_PAGE_REGISTRY.md` | Correct routes for `/my/selling/finances/*` and `/my/buying/orders/[id]/dispute` |
| `TWICELY_V3_SCHEMA_v2_0_7.md` | Verify column names used in Zod schemas (e.g., `listingOffer.sellerId` references `user.id`) |

---

## PREREQUISITES

- Phases A-C are complete. All 26 Phase C steps are done.
- Current test baseline: >=1152 tests across >=90 files, 0 TS errors.
- All files being modified already exist. No new schema tables needed.

---

## SCOPE -- EXACTLY WHAT TO BUILD

This repair pass has **4 parallel streams**. Each stream is independent and can be executed in any order. No stream blocks another.

### Dependency Graph

```
Stream 1 (Critical)  ─┐
Stream 2 (Auth)       ─┤── all independent, merge at verification
Stream 3 (Zod)        ─┤
Stream 4 (Routes)     ─┘
```

---

## STREAM 1: Critical Fixes (4 files)

### 1a. Fix seller offers page -- wrong ID passed to query

**File**: `src/app/(hub)/my/selling/offers/page.tsx`

**The Bug**: Line 40 passes `sellerProfile.id` (the `seller_profile` table's CUID2 primary key) to `getSellerOffers()`. But `getSellerOffers()` calls `getActiveOffersForSeller()` which filters by `listingOffer.sellerId` -- and `listingOffer.sellerId` references `user.id`, NOT `sellerProfile.id`. These are different CUID2 values. Result: the query always returns zero offers.

**The Fix**: Pass `session.userId` instead of `sellerProfile.id`.

**Current code** (line 40):
```typescript
const { offers, total, perPage } = await getSellerOffers(sellerProfile.id, {
```

**Corrected code**:
```typescript
const { offers, total, perPage } = await getSellerOffers(session.userId, {
```

**Verification**: `sellerProfile` is still fetched on line 25 (needed for the isSeller gate). Only the argument to `getSellerOffers` changes.

---

### 1b. Fix calculateTf callers -- must load brackets from platform_settings

**Files**:
- `src/lib/commerce/create-order.ts`
- `src/lib/commerce/offer-to-order.ts`

**The Bug**: Both files call `calculateTf(gmvCents, salePriceCents)` with only 2 arguments, which causes `calculateTf` to use the `DEFAULT_TF_BRACKETS` and `DEFAULT_MINIMUM_TF_CENTS` hardcoded fallbacks. CLAUDE.md rule: "Fee calculations server-side only from `platform_settings` table. Never hardcode rates."

The async loaders `getTfBrackets()` and `getMinimumTfCents()` already exist in `tf-calculator.ts` (lines 76-83). They just need to be called.

**The Fix for create-order.ts**:

1. Add imports at the top:
```typescript
import { calculateTf, getTfBrackets, getMinimumTfCents } from './tf-calculator';
```
(Change from the current `import { calculateTf } from './tf-calculator';`)

2. Before the `for (const [sellerId, sellerCartItems] of cartItemsBySeller)` loop (before line 103), load the brackets once:
```typescript
const tfBrackets = await getTfBrackets();
const minimumTfCents = await getMinimumTfCents();
```

3. Change the `calculateTf` call (currently at line 222) from:
```typescript
const tfResult = calculateTf(cumulativeGmv, salePriceCents);
```
to:
```typescript
const tfResult = calculateTf(cumulativeGmv, salePriceCents, tfBrackets, minimumTfCents);
```

Note: The `tfBrackets` and `minimumTfCents` variables must be accessible inside the transaction callback. They are loaded BEFORE the transaction loop, so they will be in scope.

**The Fix for offer-to-order.ts**:

1. Add imports at the top:
```typescript
import { calculateTf, getTfBrackets, getMinimumTfCents } from './tf-calculator';
```
(Change from the current `import { calculateTf } from './tf-calculator';`)

2. Before the transaction (before line 126, after step 4 "Get seller's monthly GMV"), load brackets:
```typescript
const tfBrackets = await getTfBrackets();
const minimumTfCents = await getMinimumTfCents();
```

3. Change the `calculateTf` call (currently at line 209) from:
```typescript
const tfResult = calculateTf(sellerMonthlyGmv, salePriceCents);
```
to:
```typescript
const tfResult = calculateTf(sellerMonthlyGmv, salePriceCents, tfBrackets, minimumTfCents);
```

---

### 1c. Add .strict() to 3 offer action schemas

**File**: `src/lib/actions/offers.ts`

**The Bug**: Three inline Zod schemas (`acceptOfferInputSchema`, `declineOfferInputSchema`, `cancelOfferInputSchema`) are missing `.strict()`. Per CLAUDE.md: "Zod schemas on every API input. Strict mode -- unknown keys rejected."

**The Fix**: Add `.strict()` to each schema definition.

Line 75-78 -- change:
```typescript
const acceptOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
  paymentMethodId: z.string().optional(), // Required only when buyer accepts seller counter
});
```
to:
```typescript
const acceptOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
  paymentMethodId: z.string().optional(),
}).strict();
```

Line 121-123 -- change:
```typescript
const declineOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
});
```
to:
```typescript
const declineOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
}).strict();
```

Line 194-196 -- change:
```typescript
const cancelOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
});
```
to:
```typescript
const cancelOfferInputSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
}).strict();
```

---

## STREAM 2: Auth Fixes (6 files)

### Problem Pattern

Several functions in `'use server'` files accept a `userId` or `sellerId` as a parameter from the caller without verifying auth. In a `'use server'` file, every exported function is a server action callable from the client. If a function takes `userId` as a parameter, a malicious client can pass any userId.

There are two fix strategies:
- **Strategy A (unexport)**: If the function is only called by other server-side code (not directly from client components), remove the `export` keyword so it becomes a module-internal function. This removes it from the server action surface.
- **Strategy B (add auth)**: If the function IS called from client components, add `authorize()` and derive the ID from `session.userId`.
- **Strategy C (move to query file)**: If the function is read-only and called by other server-side code, move it to a query file (not a `'use server'` file) so it's not client-callable.

### 2a. updateEngagement -- unexport (Strategy A)

**File**: `src/lib/actions/browsing-history.ts`

The `updateEngagement()` function (line 111) takes `userId` as a parameter. It is exported from a `'use server'` file, making it client-callable. However, it is designed as a fire-and-forget helper called by OTHER server actions (cart, watchlist, offer, purchase actions) -- not directly from client components.

**Fix**: Remove the `export` keyword from line 111:
```typescript
// Before:
export async function updateEngagement(
// After:
async function updateEngagement(
```

**Verification**: Search the codebase for `updateEngagement` imports. If any client component imports it directly, that import will break at build time and must be routed through its parent action instead. If only server-side action files import it, they can still import a non-exported function from the same module IF they are in the same file. If `updateEngagement` is imported by OTHER action files, then instead of unexporting it, move it to a helper file without the `'use server'` directive. Check which approach is needed:

```bash
grep -r "updateEngagement" --include="*.ts" --include="*.tsx" src/
```

If other files import it, create a new file `src/lib/actions/browsing-history-helpers.ts` (WITHOUT `'use server'` at top) and move `updateEngagement` there. The callers then import from the helper file.

---

### 2b. isBuyerBlocked and getBlockedBuyerCount -- move to query file (Strategy C)

**File**: `src/lib/actions/buyer-block.ts`

Two functions are read-only queries that don't need to be server actions:
- `isBuyerBlocked(sellerId, buyerId)` (line 142) -- used by offer-engine and cart to prevent transactions. These are server-side callers.
- `getBlockedBuyerCount(sellerId)` (line 205) -- used by server-side code only.

**Fix**: Move both functions to `src/lib/queries/buyer-block.ts` (new file, no `'use server'` directive):

```typescript
import { db } from '@/lib/db';
import { buyerBlockList } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

/**
 * Check if a buyer is blocked by a seller.
 * Used in offer-engine and cart to prevent transactions.
 */
export async function isBuyerBlocked(
  sellerId: string,
  buyerId: string
): Promise<boolean> {
  const [result] = await db
    .select({ id: buyerBlockList.id })
    .from(buyerBlockList)
    .where(
      and(
        eq(buyerBlockList.blockerId, sellerId),
        eq(buyerBlockList.blockedId, buyerId)
      )
    )
    .limit(1);

  return !!result;
}

/**
 * Get count of blocked buyers for a seller.
 */
export async function getBlockedBuyerCount(sellerId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(buyerBlockList)
    .where(eq(buyerBlockList.blockerId, sellerId));

  return result?.count ?? 0;
}
```

Then remove both functions from `src/lib/actions/buyer-block.ts` and update all imports that reference them to use the new query file path.

```bash
grep -r "isBuyerBlocked\|getBlockedBuyerCount" --include="*.ts" --include="*.tsx" src/
```

---

### 2c. getSellerPendingReviews -- add auth (Strategy B)

**File**: `src/lib/actions/seller-response.ts`

The `getSellerPendingReviews(sellerId)` function (line 187) takes `sellerId` as a parameter and is exported from a `'use server'` file. A malicious client could pass any sellerId to see another seller's pending reviews.

**Fix**: Add authorization and derive sellerId from session.

Change the function signature and add auth:
```typescript
/**
 * Get reviews awaiting seller response for the current authenticated user.
 */
export async function getSellerPendingReviews(): Promise<
  Array<{
    reviewId: string;
    orderId: string;
    rating: number;
    title: string | null;
    body: string | null;
    createdAt: Date;
    daysRemaining: number;
  }>
> {
  const { session } = await authorize();
  if (!session) return [];

  const sellerId = session.userId;
  // ... rest of function body unchanged from line 198 onward
```

Then update ALL callers of `getSellerPendingReviews` to call it with no arguments:
```bash
grep -r "getSellerPendingReviews" --include="*.ts" --include="*.tsx" src/
```

---

### 2d. getOrCreateCart -- unexport (Strategy A)

**File**: `src/lib/actions/cart-helpers.ts`

`getOrCreateCart(userId)` (line 18) is exported and takes userId as a parameter. It should only be called by other cart actions (in the same file or sibling files), not directly by clients.

**Fix**: Remove the `export` keyword:
```typescript
// Before:
export async function getOrCreateCart(userId: string): Promise<string> {
// After:
async function getOrCreateCart(userId: string): Promise<string> {
```

**Verification**: Check if any OTHER files import `getOrCreateCart`:
```bash
grep -r "getOrCreateCart" --include="*.ts" --include="*.tsx" src/
```

If other files import it, determine if those are also server-side only. If so, move `getOrCreateCart` to a shared helper without `'use server'`, or have those files derive the cartId differently.

---

### 2e. getSellerProfileForUser and getStorefrontIdForOwner -- unexport (Strategy A)

**File**: `src/lib/actions/storefront-pages-helpers.ts`

Two helper functions are exported from a `'use server'` file but only called by sibling actions:
- `getSellerProfileForUser(userId)` (line 29)
- `getStorefrontIdForOwner(userId)` (line 43)

**Fix**: Remove the `export` keyword from both:
```typescript
// Before:
export async function getSellerProfileForUser(userId: string) {
// After:
async function getSellerProfileForUser(userId: string) {
```

```typescript
// Before:
export async function getStorefrontIdForOwner(userId: string): Promise<string | null> {
// After:
async function getStorefrontIdForOwner(userId: string): Promise<string | null> {
```

**Verification**: Check for external imports:
```bash
grep -r "getSellerProfileForUser\|getStorefrontIdForOwner" --include="*.ts" --include="*.tsx" src/
```

If other files import these, they need to import from a different path (or the functions should be moved to a query file without `'use server'`).

---

### 2f. generateUniqueCertNumber -- add auth (Strategy B)

**File**: `src/lib/actions/authentication.ts`

`generateUniqueCertNumber()` (line 42) is exported from a `'use server'` file. It generates certificate numbers by querying the DB. While the function itself doesn't expose sensitive data, an unauthenticated client could call it to generate cert numbers and cause DB queries.

**Fix**: Add authorization check:
```typescript
export async function generateUniqueCertNumber(): Promise<string> {
  const { session } = await authorize();
  if (!session) throw new Error('Authentication required');

  for (let attempt = 0; attempt < 10; attempt++) {
    // ... rest unchanged
```

Note: `authorize` is already imported in this file (line 8).

---

## STREAM 3: Zod Validation for 14 Action Files

### General Pattern

For each file, add inline Zod schemas with `.strict()` and use `.safeParse()` on inputs. Follow the established pattern from existing code:

```typescript
import { z } from 'zod';

const someActionSchema = z.object({
  someId: z.string().cuid2(),
  someData: z.string().min(1).max(200),
}).strict();

export async function someAction(rawInput: unknown): Promise<ActionResult> {
  // ... auth check ...
  const parsed = someActionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const { someId, someData } = parsed.data;
  // ... use parsed.data fields explicitly, never rawInput ...
}
```

**IMPORTANT RULES for this stream**:
- All schemas must use `.strict()` (reject unknown keys)
- Use `z.string().cuid2()` for all entity IDs
- Use `z.string().min(1)` for required strings
- Use `z.number().int().nonneg()` for money amounts (integer cents)
- Do NOT change the function's external behavior -- same return types, same logic, just add input validation
- If the function signature currently uses typed parameters (e.g., `listingId: string`), change to accept `unknown` and parse with Zod. Alternatively, keep the typed parameter if it's only called from other server code and add Zod safeParse inside.
- **Important tradeoff**: Some actions are called with typed arguments from other server-side code. For these, you can either: (a) change the signature to `unknown` and update all callers, or (b) keep the typed signature and add a safeParse guard inside. Option (b) is less disruptive. Use your judgment per file.

### 3.1 listings-create.ts

Add a Zod schema for the `ListingFormData` shape. Since `ListingFormData` is a complex type imported from `@/types/listing-form`, create a validation schema that mirrors its structure. The function signature changes from `(data: ListingFormData, status: 'DRAFT' | 'ACTIVE')` to still accept `ListingFormData` (since it's called from client components via the form) but add safeParse inside.

Key fields to validate:
- `title`: z.string().min(1).max(200)
- `description`: z.string().max(10000).optional()
- `priceCents`: z.number().int().positive()
- `categoryId`: z.string().cuid2().optional()
- `condition`: z.enum([...valid conditions...])
- `imageUrls`: z.array(z.string().url()).min(1).max(20)
- etc. (mirror the existing ListingFormData type)

Also validate the `status` parameter: `z.enum(['DRAFT', 'ACTIVE'])`.

### 3.2 listings-update.ts

Add validation for `listingId` (z.string().cuid2()) and the data shape. Similar to listings-create but all fields optional (partial update).

### 3.3 listings-delete.ts

Simple schema:
```typescript
const deleteListingSchema = z.object({
  listingId: z.string().cuid2(),
}).strict();
```

### 3.4 bulk-listings.ts

```typescript
const bulkActionSchema = z.object({
  listingIds: z.array(z.string().cuid2()).min(1).max(100),
  action: z.enum(['ACTIVATE', 'DEACTIVATE', 'DELETE', 'PRICE_ADJUST']),
  priceAdjustment: z.object({
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number(),
    direction: z.enum(['INCREASE', 'DECREASE']),
  }).strict().optional(),
}).strict();
```

### 3.5 seller-listings.ts

```typescript
const bulkStatusSchema = z.object({
  listingIds: z.array(z.string().cuid2()).min(1).max(100),
  newStatus: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'SOLD']),
}).strict();
```

### 3.6 storefront.ts

Add Zod schema for `updateStorefrontSettings` data parameter. Validate all the optional fields:
- `storeName`: z.string().min(1).max(100).optional()
- `storeSlug`: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/).optional()
- `storeDescription`: z.string().max(2000).optional()
- `returnPolicy`: z.string().max(5000).optional()
- `bannerUrl`, `logoUrl`: z.string().url().nullable().optional()
- `accentColor`: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()
- `announcement`: z.string().max(500).nullable().optional()
- `aboutHtml`: z.string().max(10000).nullable().optional()
- `socialLinks`: z.record(z.string(), z.string().url()).optional()
- `featuredListingIds`: z.array(z.string().cuid2()).max(20).optional()
- `defaultStoreView`: z.enum(['grid', 'list']).optional()
- `shippingPolicy`: z.string().max(5000).nullable().optional()

### 3.7 promotions.ts

Replace the manual `validateCreateInput()` function (lines 37-63) with a Zod schema:
```typescript
const createPromotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENT_OFF', 'AMOUNT_OFF', 'FREE_SHIPPING', 'BUNDLE_DISCOUNT']),
  scope: z.enum(['STORE_WIDE', 'CATEGORY', 'SPECIFIC_LISTINGS']),
  discountPercent: z.number().int().min(1).max(100).optional(),
  discountAmountCents: z.number().int().positive().optional(),
  minimumOrderCents: z.number().int().nonneg().optional(),
  maxUsesTotal: z.number().int().positive().optional(),
  maxUsesPerBuyer: z.number().int().positive().optional(),
  couponCode: z.string().min(4).max(20).regex(/^[A-Z0-9-]+$/i).optional(),
  applicableCategoryIds: z.array(z.string().cuid2()).optional(),
  applicableListingIds: z.array(z.string().cuid2()).optional(),
  startsAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), 'Invalid date'),
  endsAt: z.string().refine((s) => !isNaN(new Date(s).getTime()), 'Invalid date').optional(),
}).strict().refine(
  (data) => {
    if (data.endsAt && data.startsAt) {
      return new Date(data.endsAt) > new Date(data.startsAt);
    }
    return true;
  },
  { message: 'End date must be after start date' }
);
```

Then replace the `validateCreateInput(data)` call with `createPromotionSchema.safeParse(data)`.

### 3.8 boosting.ts

```typescript
const activateBoostSchema = z.object({
  listingId: z.string().cuid2(),
  boostPercent: z.number().min(1).max(100),
}).strict();
```

Apply to `activateBoost` and any other exported actions in the file (deactivateBoost, etc.).

### 3.9 shipping.ts

```typescript
const fetchRatesSchema = z.object({
  orderId: z.string().cuid2(),
}).strict();

const purchaseLabelSchema = z.object({
  orderId: z.string().cuid2(),
  rateObjectId: z.string().min(1),
}).strict();
```

### 3.10 payout-settings.ts

For `getPayoutsAction`:
```typescript
const getPayoutsSchema = z.object({
  limit: z.number().int().positive().max(100).default(10),
  cursor: z.string().optional(),
}).strict();
```

For `updatePayoutScheduleAction`:
```typescript
const updateScheduleSchema = z.object({
  interval: z.enum(['manual', 'daily', 'weekly', 'monthly']),
  options: z.object({
    weeklyAnchor: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']).optional(),
    monthlyAnchor: z.number().int().min(1).max(28).optional(),
  }).strict().optional(),
}).strict();
```

### 3.11 browsing-history.ts

For `recordViewAction`:
```typescript
const recordViewSchema = z.object({
  listingId: z.string().cuid2(),
  options: z.object({
    sourceType: z.enum(['search', 'category', 'recommendation', 'alert', 'direct']).optional(),
    searchQuery: z.string().max(200).optional(),
  }).strict().optional(),
}).strict();
```

For `removeFromHistoryAction`:
```typescript
const removeHistorySchema = z.object({
  listingId: z.string().cuid2(),
}).strict();
```

### 3.12 notifications.ts

For `markAsRead`:
```typescript
const markAsReadSchema = z.object({
  notificationId: z.string().cuid2(),
}).strict();
```

For `updatePreferences`:
```typescript
const updatePreferencesSchema = z.object({
  preferences: z.array(z.object({
    templateKey: z.string().min(1),
    email: z.boolean(),
    inApp: z.boolean(),
  }).strict()).min(1),
}).strict();
```

### 3.13 follow.ts

For `toggleFollow`:
```typescript
const toggleFollowSchema = z.object({
  sellerUserId: z.string().cuid2(),
}).strict();
```

### 3.14 buyer-block.ts

For `blockBuyerAction`:
```typescript
const blockBuyerSchema = z.object({
  buyerId: z.string().cuid2(),
  reason: z.string().max(500).optional(),
}).strict();
```

For `unblockBuyerAction`:
```typescript
const unblockBuyerSchema = z.object({
  buyerId: z.string().cuid2(),
}).strict();
```

---

## STREAM 4: Route Fixes (2 directory renames + link updates)

### 4a. Rename claim -> dispute

**Page Registry reference**: Row 28 shows `/my/buying/orders/[id]/dispute` as the correct route.

**Current state**: Directory exists at `src/app/(hub)/my/buying/orders/[id]/claim/` with files:
- `claim-form.tsx`
- `page.tsx`

**Steps**:
1. Rename directory: `claim/` -> `dispute/`
2. Rename `claim-form.tsx` -> `dispute-form.tsx` (or keep as-is if the component name is generic)
3. Inside `page.tsx`, update the import: `import { ProtectionClaimForm } from './claim-form'` -> `import { ProtectionClaimForm } from './dispute-form'`
4. Update all links referencing the old path. Known occurrences:
   - `src/app/(hub)/my/buying/orders/[id]/return/page.tsx` line 99: `/claim` -> `/dispute`
   - `src/app/(hub)/my/buying/orders/[id]/page.tsx` line 183: `/claim` -> `/dispute`
5. The `claim-form.tsx` component internally calls `fetch('/api/protection/claim', ...)` -- this API route name is SEPARATE from the page route and should NOT be renamed (the API endpoint may be correct as-is or may need its own audit, but that is out of scope for this pass).

**Verify**: `grep -r "/claim" --include="*.tsx" --include="*.ts" src/app/ src/components/ src/lib/` to find any remaining references.

---

### 4b. Rename /my/selling/payouts -> /my/selling/finances route tree

**Page Registry reference**:
- Row 50: `/my/selling/finances` (Finances overview)
- Row 51: `/my/selling/finances/transactions`
- Row 52: `/my/selling/finances/payouts`
- Row 53: `/my/selling/finances/statements`

**Current state**: Pages exist at:
- `src/app/(hub)/my/selling/payouts/page.tsx` (should be `/finances`)
- `src/app/(hub)/my/selling/payouts/payout-balance-card.tsx` (component)
- `src/app/(hub)/my/selling/payouts/payout-history-table.tsx` (component)
- `src/app/(hub)/my/selling/payouts/settings/page.tsx` (should be `/finances/payouts`)
- `src/app/(hub)/my/selling/payouts/settings/payout-schedule-form.tsx` (component)

**Hub navigation state**: `src/lib/hub/hub-nav.ts` already uses correct `/my/selling/finances/*` routes (lines 119-124). The old sidebar in `src/components/shared/selling-sidebar.tsx` line 36 still references `/my/selling/payouts`.

**Steps**:

1. Create directory: `src/app/(hub)/my/selling/finances/`

2. Move main page:
   - `payouts/page.tsx` -> `finances/page.tsx`
   - Inside: update redirect URL from `/my/selling/payouts` to `/my/selling/finances`

3. Move component files:
   - `payouts/payout-balance-card.tsx` -> `finances/payout-balance-card.tsx`
   - `payouts/payout-history-table.tsx` -> `finances/payout-history-table.tsx`

4. Move settings directory to payouts:
   - `payouts/settings/page.tsx` -> `finances/payouts/page.tsx`
   - `payouts/settings/payout-schedule-form.tsx` -> `finances/payouts/payout-schedule-form.tsx`
   - Inside: update all `/my/selling/payouts` and `/my/selling/payouts/settings` references to `/my/selling/finances` and `/my/selling/finances/payouts`

5. Create placeholder pages:
   - `src/app/(hub)/my/selling/finances/transactions/page.tsx`:
     ```typescript
     import { redirect } from 'next/navigation';
     import { authorize } from '@/lib/casl';

     export const metadata = {
       title: 'Transactions | Twicely',
     };

     export default async function TransactionsPage() {
       const { session } = await authorize();
       if (!session) redirect('/auth/login?callbackUrl=/my/selling/finances/transactions');

       return (
         <div className="space-y-6">
           <div>
             <h1 className="text-2xl font-bold">Transactions</h1>
             <p className="text-muted-foreground">View your transaction history</p>
           </div>
           <p className="text-muted-foreground">Coming soon.</p>
         </div>
       );
     }
     ```
   - `src/app/(hub)/my/selling/finances/statements/page.tsx` (same pattern, title "Statements | Twicely")

6. Update link references:
   - `src/components/shared/selling-sidebar.tsx` line 36: change href from `/my/selling/payouts` to `/my/selling/finances`
   - Also change the label from `Payouts` to `Finances`
   - `src/lib/stripe/connect.ts` lines 99-100: update default paths from `/my/selling/payouts/return` and `/my/selling/payouts/setup` to `/my/selling/finances/return` and `/my/selling/finances/setup`

7. Delete the old `payouts/` directory after everything is moved.

**Verify**: `grep -r "/my/selling/payouts" --include="*.ts" --include="*.tsx" src/` should return zero results after completion.

---

## CONSTRAINTS -- WHAT NOT TO DO

- Do NOT add new schema tables
- Do NOT create new API routes
- Do NOT change the behavior of any function (only add validation/auth guards)
- Do NOT rename any exported types/interfaces (only function signatures where auth is added)
- Do NOT touch test files in this stream (except if imports break due to file moves)
- Do NOT modify `tf-calculator.ts` itself -- only its callers
- Do NOT change the `calculateTf` function signature -- it already accepts optional brackets/minimumTfCents params
- Do NOT use `as any` or `@ts-ignore` or `@ts-expect-error` anywhere
- Do NOT hardcode any fee rates
- Do NOT use banned terms (see CLAUDE.md vocabulary table)
- Maintain max 300 lines per file

---

## ACCEPTANCE CRITERIA

### Stream 1 -- Critical Fixes
- [ ] `src/app/(hub)/my/selling/offers/page.tsx` passes `session.userId` to `getSellerOffers()`, NOT `sellerProfile.id`
- [ ] `src/lib/commerce/create-order.ts` calls `getTfBrackets()` and `getMinimumTfCents()` and passes results to `calculateTf()`
- [ ] `src/lib/commerce/offer-to-order.ts` calls `getTfBrackets()` and `getMinimumTfCents()` and passes results to `calculateTf()`
- [ ] All three offer schemas (`acceptOfferInputSchema`, `declineOfferInputSchema`, `cancelOfferInputSchema`) have `.strict()`
- [ ] No call to `calculateTf` anywhere in the codebase passes fewer than 2 arguments without the defaults being loaded from platform_settings (verify with grep)

### Stream 2 -- Auth Fixes
- [ ] `updateEngagement` is NOT exported from any `'use server'` file (or is moved to a non-server file)
- [ ] `isBuyerBlocked` and `getBlockedBuyerCount` are NOT in a `'use server'` file
- [ ] `getSellerPendingReviews` no longer takes `sellerId` as parameter -- derives from session
- [ ] `getOrCreateCart` is NOT exported from a `'use server'` file
- [ ] `getSellerProfileForUser` and `getStorefrontIdForOwner` are NOT exported from `storefront-pages-helpers.ts`
- [ ] `generateUniqueCertNumber` has an auth check as its first line

### Stream 3 -- Zod Validation
- [ ] All 14 files listed have Zod schemas with `.strict()`
- [ ] All schemas use `.safeParse()` (never `.parse()`)
- [ ] All entity IDs validated with `z.string().cuid2()`
- [ ] All money amounts validated with `z.number().int()` (integer cents)
- [ ] No function spreads request body into DB operations (explicit field mapping only)

### Stream 4 -- Route Fixes
- [ ] No directory or file at `src/app/(hub)/my/buying/orders/[id]/claim/` (renamed to `dispute`)
- [ ] No directory or file at `src/app/(hub)/my/selling/payouts/` (renamed to `finances`)
- [ ] `src/app/(hub)/my/selling/finances/page.tsx` exists and renders
- [ ] `src/app/(hub)/my/selling/finances/payouts/page.tsx` exists and renders
- [ ] `src/app/(hub)/my/selling/finances/transactions/page.tsx` exists (placeholder)
- [ ] `src/app/(hub)/my/selling/finances/statements/page.tsx` exists (placeholder)
- [ ] `grep -r "/my/selling/payouts" --include="*.ts" --include="*.tsx" src/` returns zero results
- [ ] `grep -r "orders/[^]]*]/claim" --include="*.ts" --include="*.tsx" src/` returns zero results (note: be careful with regex escaping -- look for literal `/claim` in order detail paths)
- [ ] `selling-sidebar.tsx` links to `/my/selling/finances`, label is "Finances"

### Cross-Cutting
- [ ] TypeScript: 0 errors (`pnpm typecheck`)
- [ ] Tests: count >= 1152 (BASELINE_TESTS), count did NOT decrease
- [ ] No banned terms in any modified file
- [ ] No files over 300 lines
- [ ] No `as any`, `@ts-ignore`, `@ts-expect-error` in any modified file

---

## TEST REQUIREMENTS

### Existing Tests
- Run full test suite after completion. No existing test should break.
- If a test imports from a moved function (e.g., `isBuyerBlocked` from `buyer-block.ts`), update the import path.

### New Tests (Optional but Recommended)
If time allows, add tests for the Zod validation in the most critical files:
- `offers.ts` -- verify `.strict()` rejects unknown keys
- `create-order.ts` / `offer-to-order.ts` -- verify `getTfBrackets` is called (mock the function and verify it was invoked)

Test descriptions:
- `should reject acceptOfferAction input with unknown keys`
- `should reject declineOfferAction input with unknown keys`
- `should call getTfBrackets when creating order from cart`
- `should call getMinimumTfCents when creating order from offer`

---

## FILE APPROVAL LIST

### Stream 1 -- Critical Fixes
| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/app/(hub)/my/selling/offers/page.tsx` | Fix sellerProfile.id -> session.userId |
| MODIFY | `src/lib/commerce/create-order.ts` | Load TF brackets from platform_settings |
| MODIFY | `src/lib/commerce/offer-to-order.ts` | Load TF brackets from platform_settings |
| MODIFY | `src/lib/actions/offers.ts` | Add .strict() to 3 schemas |

### Stream 2 -- Auth Fixes
| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/lib/actions/browsing-history.ts` | Unexport updateEngagement (or move to helper) |
| CREATE | `src/lib/queries/buyer-block.ts` | Move isBuyerBlocked + getBlockedBuyerCount here |
| MODIFY | `src/lib/actions/buyer-block.ts` | Remove moved functions, add Zod (overlaps Stream 3) |
| MODIFY | `src/lib/actions/seller-response.ts` | Add auth to getSellerPendingReviews |
| MODIFY | `src/lib/actions/cart-helpers.ts` | Unexport getOrCreateCart |
| MODIFY | `src/lib/actions/storefront-pages-helpers.ts` | Unexport 2 helper functions |
| MODIFY | `src/lib/actions/authentication.ts` | Add auth to generateUniqueCertNumber |

### Stream 3 -- Zod Validation
| Action | File | Description |
|--------|------|-------------|
| MODIFY | `src/lib/actions/listings-create.ts` | Add Zod schema for ListingFormData |
| MODIFY | `src/lib/actions/listings-update.ts` | Add Zod schema for update data |
| MODIFY | `src/lib/actions/listings-delete.ts` | Add Zod schema for listingId |
| MODIFY | `src/lib/actions/bulk-listings.ts` | Add Zod schema for bulk actions |
| MODIFY | `src/lib/actions/seller-listings.ts` | Add Zod schema for bulk status |
| MODIFY | `src/lib/actions/storefront.ts` | Add Zod schema for settings data |
| MODIFY | `src/lib/actions/promotions.ts` | Replace manual validation with Zod |
| MODIFY | `src/lib/actions/boosting.ts` | Add Zod schema for boost input |
| MODIFY | `src/lib/actions/shipping.ts` | Add Zod schema for orderId/rateObjectId |
| MODIFY | `src/lib/actions/payout-settings.ts` | Add Zod schema for interval/cursor |
| MODIFY | `src/lib/actions/browsing-history.ts` | Add Zod schema (combined with Stream 2) |
| MODIFY | `src/lib/actions/notifications.ts` | Add Zod schema for notificationId/preferences |
| MODIFY | `src/lib/actions/follow.ts` | Add Zod schema for sellerUserId |
| MODIFY | `src/lib/actions/buyer-block.ts` | Add Zod schema (combined with Stream 2) |

### Stream 4 -- Route Fixes
| Action | File | Description |
|--------|------|-------------|
| RENAME | `src/app/(hub)/my/buying/orders/[id]/claim/` | -> `.../dispute/` |
| RENAME | `src/app/(hub)/my/buying/orders/[id]/claim/claim-form.tsx` | -> `.../dispute/dispute-form.tsx` |
| MODIFY | `src/app/(hub)/my/buying/orders/[id]/dispute/page.tsx` | Update import path |
| MODIFY | `src/app/(hub)/my/buying/orders/[id]/return/page.tsx` | Update /claim -> /dispute link |
| MODIFY | `src/app/(hub)/my/buying/orders/[id]/page.tsx` | Update /claim -> /dispute link |
| MOVE | `src/app/(hub)/my/selling/payouts/page.tsx` | -> `finances/page.tsx` |
| MOVE | `src/app/(hub)/my/selling/payouts/payout-balance-card.tsx` | -> `finances/payout-balance-card.tsx` |
| MOVE | `src/app/(hub)/my/selling/payouts/payout-history-table.tsx` | -> `finances/payout-history-table.tsx` |
| MOVE | `src/app/(hub)/my/selling/payouts/settings/page.tsx` | -> `finances/payouts/page.tsx` |
| MOVE | `src/app/(hub)/my/selling/payouts/settings/payout-schedule-form.tsx` | -> `finances/payouts/payout-schedule-form.tsx` |
| CREATE | `src/app/(hub)/my/selling/finances/transactions/page.tsx` | Placeholder page |
| CREATE | `src/app/(hub)/my/selling/finances/statements/page.tsx` | Placeholder page |
| MODIFY | `src/components/shared/selling-sidebar.tsx` | Update href + label |
| MODIFY | `src/lib/stripe/connect.ts` | Update default path constants |
| DELETE | `src/app/(hub)/my/selling/payouts/` | Remove old directory |

### Totals
- **MODIFY**: ~22 files
- **CREATE**: 3 files (1 query file + 2 placeholder pages)
- **RENAME/MOVE**: 7 files
- **DELETE**: 1 directory (old payouts/)

---

## DEFERRED -- DO NOT INCLUDE

The following defects were found in the audit but are explicitly OUT OF SCOPE for this repair pass:

| # | Issue | Reason Deferred |
|---|---|---|
| 22 | Payout execution flow (escrow release, requestPayout) | Needs its own build step (complex Stripe integration) |
| 23 | Rate columns real() vs basis points | Spec ambiguity -- owner decision needed |
| 25 | sellerProfile storefront field migration | Needs schema migration |
| 26 | bundleTierEnum | Spec ambiguity -- owner decision needed |
| 28 | Admin actions missing revalidatePath | E3 is still in progress |

---

## VERIFICATION CHECKLIST

After all 4 streams are complete, run these checks:

```bash
# 1. TypeScript -- must be 0 errors
pnpm typecheck

# 2. Tests -- must be >= 1152, must not decrease
pnpm test

# 3. Banned terms check
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC\b\|ELITE\b\|PLUS\b\|MAX\b\|PREMIUM\b\|Twicely Balance\|wallet" --include="*.ts" --include="*.tsx" src/

# 4. Route check -- old routes must not exist
grep -rn "/my/selling/payouts" --include="*.ts" --include="*.tsx" src/
grep -rn "orders/\[id\]/claim" --include="*.ts" --include="*.tsx" src/

# 5. File size check -- no files over 300 lines
find src/ -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -20

# 6. Auth surface check -- verify no unguarded exports in 'use server' files
grep -rn "^export async function" src/lib/actions/ | grep -v "Action\b" | head -30
# (Functions not ending in "Action" in server files are suspicious -- review manually)

# 7. Strict check -- all Zod schemas use .strict()
grep -rn "z\.object(" src/lib/actions/ --include="*.ts" | grep -v "\.strict()" | head -20
# (Any z.object() without .strict() in action files is a defect)
```

**Expected outcomes**:
1. TypeScript: 0 errors
2. Tests: >= 1152 passing, 0 failing
3. Banned terms: 0 matches
4. Old routes: 0 matches for both queries
5. File sizes: no file over 300 lines
6. Auth surface: review output -- all exported functions should have auth or end in "Action"
7. Strict check: 0 matches (all z.object() have .strict())

Run `./twicely-lint.sh` for the full verification suite and paste the raw output.
