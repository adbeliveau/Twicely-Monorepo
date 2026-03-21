# I9 — Promotions Admin (Hub CRUD)

**Phase & Step:** `[I9]`
**Feature Name:** Promotions Admin — Hub CRUD for Seller Promotions & Platform Promo Codes
**One-line Summary:** Build three hub admin pages at `/promotions`, `/promotions/[id]`, and `/promotions/new` that give platform staff full CRUD visibility over both seller-created promotions AND platform promo codes, with queries, actions, validations, and tests.
**Depends On:** D2 (Promotions & Coupons) COMPLETE, G1.5 (Promo Code System) COMPLETE
**Test Baseline:** 8603 (CLAUDE.md) — must not decrease

---

## Canonical Sources — Read ALL Before Starting

| Document | Why |
|----------|-----|
| `TWICELY_V3_SCHEMA_v2_1_0.md` Section 15 (promotion, promotionUsage, promotedListing) and Section 21 (promoCode, promoCodeRedemption) | Table/column definitions for both sub-domains |
| `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` Section 2 (Promotions & Coupons) | Business rules: stacking, admin controls, fee handling |
| `TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md` Sections 2.4-2.5, 8 | Platform promo code rules, CASL definitions |
| `TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` | Staff role gates, CASL matrix |
| `TWICELY_V3_PAGE_REGISTRY.md` Row 97b (`/fin/promo-codes`) | Existing hub promo page for reference |
| `TWICELY_V3_BUILD_SEQUENCE_TRACKER.md` Row I9 | Scope definition |
| `TWICELY_V3_TESTING_STANDARDS.md` | Test patterns |
| `CLAUDE.md` | All build rules |

---

## 1. PREREQUISITES

### Already Complete
- **D2**: Seller promotions engine — `promotion` table, `promotionUsage` table, seller CRUD actions (`src/lib/actions/promotions.ts`), seller queries (`src/lib/queries/promotions.ts`), seller UI at `/my/selling/promotions`.
- **G1.5**: Platform promo code system — `promoCode` table, `promoCodeRedemption` table, platform CRUD actions (`src/lib/actions/promo-codes-platform.ts`), affiliate CRUD actions (`src/lib/actions/promo-codes-affiliate.ts`), queries (`src/lib/queries/promo-codes.ts`), hub page at `/fin/promo-codes`.

### Already Exists (DO NOT RECREATE)
- Schema: `src/lib/db/schema/promotions.ts` — `promotion`, `promotionUsage`, `promotedListing`, `promotedListingEvent`
- Schema: `src/lib/db/schema/affiliates.ts` — `promoCode`, `promoCodeRedemption`
- Enums: `promotionTypeEnum` (`PERCENT_OFF`, `AMOUNT_OFF`, `FREE_SHIPPING`, `BUNDLE_DISCOUNT`), `promotionScopeEnum` (`STORE_WIDE`, `CATEGORY`, `SPECIFIC_LISTINGS`), `promoCodeTypeEnum` (`AFFILIATE`, `PLATFORM`), `promoDiscountTypeEnum` (`PERCENTAGE`, `FIXED`)
- CASL subjects: `Promotion`, `PromotedListing`, `PromoCode` (all in `src/lib/casl/subjects.ts`)
- Seller abilities: `manage Promotion` scoped to `{ sellerId }` (in `ability.ts` line 79)
- Platform staff abilities: `manage PromoCode` for FINANCE role (in `platform-abilities.ts` line 124)
- Validations: `src/lib/validations/promo-code.ts` — `createPlatformPromoCodeSchema`, `updatePromoCodeSchema`
- Existing queries: `getSellerPromotions()`, `getPromotionById()`, `getPromotionStats()`, `getAllPromoCodes()`, `getPlatformPromoCodes()`

### Packages Needed
None new — all dependencies already installed.

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

### 2.1 CASL Gap Fix

**Problem:** Platform staff currently have `manage PromoCode` (FINANCE role, `platform-abilities.ts` line 124) but NO `manage Promotion` ability. The new admin pages need to READ seller promotions.

**Fix in `src/lib/casl/platform-abilities.ts`:**

In the ADMIN section, add:
```typescript
can('manage', 'Promotion');
```

In the MODERATION section, add:
```typescript
can('read', 'Promotion');
```

This allows:
- ADMIN + SUPER_ADMIN: full manage on both `Promotion` and `PromoCode`
- FINANCE: manage `PromoCode` (already exists), read `Promotion` (add)
- MODERATION: read `Promotion` (add, for reviewing abusive seller promotions)

Reference: Feature Lock-in Section 2 — "Admin can disable any seller's promotions if abusive."

### 2.2 New Admin Queries — `src/lib/queries/admin-promotions.ts`

This file provides all data access for the hub promotions pages.

**Query 1: `getAllSellerPromotions()`**
```
Input: { limit: number; offset: number; status?: 'active' | 'scheduled' | 'ended' | 'all'; sellerId?: string; search?: string }
Output: { rows: PromotionWithSellerRow[]; total: number }
```
- Joins `promotion` with `user` (on `promotion.sellerId = user.id`) to get seller username/displayName
- Filters by status (active/scheduled/ended using same logic as `getSellerPromotions()`)
- Optional filter by `sellerId` (for per-seller view)
- Optional search by `promotion.name` or `promotion.couponCode` (ILIKE)
- Paginated with limit/offset
- Ordered by `createdAt DESC`

**Query 2: `getPromotionDetailAdmin()`**
```
Input: promotionId: string
Output: { promotion: PromotionWithSellerRow; stats: PromotionStats; recentUsage: PromotionUsageRow[] } | null
```
- Fetches promotion by ID (no ownership filter — admin view)
- Joins `user` to get seller username
- Calls existing `getPromotionStats()` for usage aggregates
- Fetches recent 20 `promotionUsage` rows joined with `user` (buyer) and `order` for context

**Query 3: `getAllPromoCodesAdmin()`**
```
Input: { limit: number; offset: number; type?: 'AFFILIATE' | 'PLATFORM'; search?: string; isActive?: boolean }
Output: { rows: PromoCodeWithContextRow[]; total: number }
```
- Wraps existing `getAllPromoCodes()` but adds:
  - Optional `search` filter by `promoCode.code` (ILIKE)
  - Optional `isActive` filter
  - For AFFILIATE codes: left-joins `affiliate` + `user` to show affiliate name
- Paginated with limit/offset

**Query 4: `getPromoCodeDetailAdmin()`**
```
Input: promoCodeId: string
Output: { promoCode: PromoCodeWithContextRow; redemptions: PromoCodeRedemptionRow[]; redemptionCount: number } | null
```
- Fetches promo code by ID
- For AFFILIATE codes: joins affiliate + user for context
- Fetches recent 20 `promoCodeRedemption` rows joined with `user`

**Query 5: `getPromotionsOverviewStats()`**
```
Input: none
Output: { activeSellerPromotions: number; activePromoCodes: number; totalRedemptions: number; totalDiscountCents: number }
```
- Aggregate counts for the overview page stat cards

**Type definitions** (in the same file):

```typescript
interface PromotionWithSellerRow {
  id: string;
  sellerId: string;
  sellerUsername: string | null;
  sellerDisplayName: string | null;
  name: string;
  type: string; // 'PERCENT_OFF' | 'AMOUNT_OFF' | 'FREE_SHIPPING' | 'BUNDLE_DISCOUNT'
  scope: string; // 'STORE_WIDE' | 'CATEGORY' | 'SPECIFIC_LISTINGS'
  discountPercent: number | null;
  discountAmountCents: number | null;
  minimumOrderCents: number | null;
  maxUsesTotal: number | null;
  maxUsesPerBuyer: number;
  usageCount: number;
  couponCode: string | null;
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
}

interface PromoCodeWithContextRow {
  id: string;
  code: string;
  type: string; // 'AFFILIATE' | 'PLATFORM'
  affiliateId: string | null;
  affiliateUsername: string | null;
  discountType: string; // 'PERCENTAGE' | 'FIXED'
  discountValue: number;
  durationMonths: number;
  scopeProductTypes: unknown;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}
```

### 2.3 New Admin Actions — `src/lib/actions/admin-promotions.ts`

This file provides staff CRUD operations for the hub.

**Action 1: `adminDeactivatePromotion()`**
```
'use server'
Input: { promotionId: string }
Auth: staffAuthorize() + ability.can('manage', 'Promotion')
Logic:
  1. Zod validate input with .strict()
  2. Fetch promotion by ID (no ownership check — admin)
  3. If not found: return { success: false, error: 'Not found' }
  4. Set isActive = false, updatedAt = new Date()
  5. Insert auditEvent: actorType='STAFF', action='ADMIN_PROMOTION_DEACTIVATED', severity='MEDIUM'
  6. revalidatePath('/promotions')
  7. revalidatePath('/promotions/[id]') — use actual ID
Output: { success: boolean; error?: string }
```

**Action 2: `adminReactivatePromotion()`**
```
'use server'
Input: { promotionId: string }
Auth: staffAuthorize() + ability.can('manage', 'Promotion')
Logic:
  1. Zod validate input with .strict()
  2. Fetch promotion by ID
  3. If not found: return error
  4. If endsAt is in the past: return { success: false, error: 'Cannot reactivate an expired promotion' }
  5. Set isActive = true, updatedAt = new Date()
  6. Insert auditEvent: actorType='STAFF', action='ADMIN_PROMOTION_REACTIVATED', severity='MEDIUM'
  7. revalidatePath('/promotions')
Output: { success: boolean; error?: string }
```

**Action 3: `adminCreatePlatformPromoCode()`**
```
'use server'
Input: { code, discountType, discountValue, durationMonths, scopeProductTypes?, usageLimit?, expiresAt? }
Auth: staffAuthorize() + ability.can('manage', 'PromoCode')
Logic:
  1. Validate with createPlatformPromoCodeSchema (from existing src/lib/validations/promo-code.ts)
  2. Check code uniqueness via getPromoCodeByCode()
  3. Insert into promoCode with type='PLATFORM', createdByUserId=session.staffUserId
  4. Try syncPromoCodeToStripe() (non-blocking on failure)
  5. Insert auditEvent
  6. revalidatePath('/promotions')
Output: { success: boolean; error?: string }
```

NOTE: This largely mirrors `createPlatformPromoCode()` from `promo-codes-platform.ts`. The difference is that the new action ALSO revalidates `/promotions` (the new hub route). You may delegate to the existing function internally OR duplicate the logic. If delegating, the existing function must also revalidate `/promotions`. Preferred approach: call the existing `createPlatformPromoCode()` and then `revalidatePath('/promotions')` as a wrapper.

**Action 4: `adminUpdatePromoCode()`**
```
'use server'
Input: { id, isActive?, usageLimit?, expiresAt? }
Auth: staffAuthorize() + ability.can('manage', 'PromoCode')
Logic:
  1. Validate with updatePromoCodeSchema (existing)
  2. Delegates to existing updatePlatformPromoCode() logic
  3. Also revalidatePath('/promotions')
Output: { success: boolean; error?: string }
```

NOTE: Same delegation pattern. Avoid duplicating logic — wrap or extend the existing action.

### 2.4 New Validation Schema — `src/lib/validations/admin-promotions.ts`

Only add schemas NOT already covered by existing validations:

```typescript
import { z } from 'zod';

export const adminPromotionIdSchema = z.object({
  promotionId: z.string().min(1),
}).strict();

export const adminPromotionsFilterSchema = z.object({
  status: z.enum(['active', 'scheduled', 'ended', 'all']).optional(),
  sellerId: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
}).strict();

export const adminPromoCodesFilterSchema = z.object({
  type: z.enum(['AFFILIATE', 'PLATFORM']).optional(),
  search: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
}).strict();
```

Do NOT recreate schemas for promo code create/update — reuse from `src/lib/validations/promo-code.ts`.

### 2.5 Hub Pages

#### Page 1: `/promotions` — Overview List (Tabbed)

**File:** `src/app/(hub)/promotions/page.tsx`
**Metadata:** `{ title: 'Promotions | Twicely Hub' }`
**Auth:** `staffAuthorize()` + `ability.can('read', 'Promotion')` OR `ability.can('manage', 'PromoCode')`
**Layout:** hub

**UI Structure:**
```
AdminPageHeader: "Promotions" / "Manage seller promotions and platform promo codes"

Stat cards row (4 cards):
  - Active Seller Promotions (count)
  - Active Promo Codes (count)
  - Total Redemptions (count)
  - Total Discount Given (formatted cents)

Tabs: [Seller Promotions] [Platform Promo Codes] [Affiliate Promo Codes]

Tab 1 — Seller Promotions:
  Sub-tabs: All | Active | Scheduled | Ended
  Table columns: Name | Seller | Type | Scope | Discount | Uses | Code | Status | Created
  Each row links to /promotions/{id}

Tab 2 — Platform Promo Codes:
  Table columns: Code | Discount | Duration | Scope | Uses | Expires | Status
  Each row links to /promotions/{id}?tab=promo
  [Create Platform Code] button (uses CreatePlatformPromoDialog from existing component)

Tab 3 — Affiliate Promo Codes:
  Table columns: Code | Affiliate | Discount | Duration | Uses | Expires | Status
  Each row links to /promotions/{id}?tab=promo
```

**Pagination:** Same pattern as `/usr/affiliates` page (page param, Previous/Next links).
**Empty state:** "No promotions found" centered text.

The active tab is controlled by `?tab=sellers|platform|affiliate` searchParam (default: `sellers`).

#### Page 2: `/promotions/[id]` — Detail/Edit

**File:** `src/app/(hub)/promotions/[id]/page.tsx`
**Metadata:** Dynamic title based on promotion name
**Auth:** `staffAuthorize()` + `ability.can('read', 'Promotion')` or `ability.can('manage', 'PromoCode')`

This page handles BOTH promotion records and promo code records. It determines which one to display based on a `?tab=promo` param or by attempting to load a `promotion` first, falling back to `promoCode`.

**Strategy:** Try `getPromotionDetailAdmin(id)` first. If not found, try `getPromoCodeDetailAdmin(id)`. If neither found, show "Not found".

**For Seller Promotions:**
```
AdminPageHeader: "{promotion.name}" / Back link to /promotions

Info cards:
  - Seller: {username} (link to /usr/{userId})
  - Type: PERCENT_OFF / AMOUNT_OFF / etc.
  - Scope: STORE_WIDE / CATEGORY / SPECIFIC_LISTINGS
  - Discount: 15% off / $10.00 off / Free Shipping
  - Minimum Order: $50.00 (or "None")
  - Coupon Code: VINTAGE-SPRING20 (or "None")
  - Status: Active / Inactive badge
  - Start: {date} / End: {date or "No end date"}
  - Usage: 42 / 100 (or "42 / Unlimited")

Actions (if ability.can('manage', 'Promotion')):
  - [Deactivate] / [Reactivate] button

Usage stats:
  - Total uses: {number}
  - Total discount given: ${formatted}

Recent usage table (last 20):
  Columns: Buyer | Order | Discount | Date
```

**For Promo Codes:**
```
AdminPageHeader: "Code: {code}" / Back link to /promotions

Info cards:
  - Type: PLATFORM / AFFILIATE
  - Affiliate: {username} (if AFFILIATE, link to /usr/affiliates/{affiliateId})
  - Discount: 50% off for 3 months / $10.00 off for 1 month
  - Scope: All products / Store, Crosslister
  - Usage: 23 / 100 (or "23 / Unlimited")
  - Expires: {date or "Never"}
  - Status: Active / Inactive badge

Actions (if ability.can('manage', 'PromoCode')):
  - [Deactivate] / [Reactivate] toggle
  - [Edit] — opens inline edit for usageLimit, expiresAt, isActive

Recent redemptions table (last 20):
  Columns: User | Product | Discount Applied | Date
```

#### Page 3: `/promotions/new` — Create Platform Promo Code

**File:** `src/app/(hub)/promotions/new/page.tsx`
**Metadata:** `{ title: 'Create Promo Code | Twicely Hub' }`
**Auth:** `staffAuthorize()` + `ability.can('manage', 'PromoCode')`

This is a full-page form version of the existing `CreatePlatformPromoDialog`. It provides a better UX for complex promo code creation.

**Form fields** (same as existing dialog but laid out as a full page):
- Code (text, 4-20 chars, auto-uppercased)
- Discount Type (radio: Percentage / Fixed)
- Discount Value (number — BPS for percentage, cents for fixed)
- Duration (number, 1-12 months)
- Scope (checkboxes: Store, Crosslister, Automation, Finance — empty = all)
- Usage Limit (optional number)
- Expires At (optional datetime)

**On submit:** Call `adminCreatePlatformPromoCode()`. On success, redirect to `/promotions`.

NOTE: Admin cannot create seller promotions from the hub — only platform promo codes. Seller promotions are created by sellers via `/my/selling/promotions/new`. Feature Lock-in Section 2 says "Admin can disable any seller's promotions if abusive" — create/edit is seller-only.

### 2.6 Admin Nav Comment (DO NOT MODIFY admin-nav.ts)

Per the decomposer instructions, admin-nav.ts is NOT modified in I9. Navigation entry for `/promotions` is deferred to I17 (Admin Sidebar Final Update).

Leave this comment in the promotions list page for the I17 implementer:
```typescript
// NAV_ENTRY: I17 should add { key: 'promotions', label: 'Promotions', href: '/promotions', icon: 'Ticket', roles: ['ADMIN', 'FINANCE', 'MODERATION'] } to admin-nav.ts
```

---

## 3. CONSTRAINTS — WHAT NOT TO DO

### Banned Terms
- NO `SellerTier`, `SubscriptionTier`, `FVF`, `Final Value Fee`, `BASIC` (as StoreTier), `ELITE`, `PLUS` (as ListerTier), `MAX` (as ListerTier), `PREMIUM`, `Twicely Balance`, `wallet`, `Withdraw`
- NO `discount rule` / `discountRule` — this concept does not exist in the schema. The promotion table IS the discount mechanism.

### Technology
- NO Prisma, NextAuth, Redis, tRPC, Zustand
- Use Drizzle ORM for all queries
- Use `staffAuthorize()` for hub pages (NOT `authorize()`)
- Use CASL `ability.can()` checks (NOT custom role checks)

### Patterns
- NO `as any`, `@ts-ignore`, `@ts-expect-error`
- NO files over 300 lines — split if needed
- NO spreading request body into DB updates — explicit field mapping only
- NO exported helper functions in `'use server'` files (they become unintended server actions)
- ALL Zod schemas must use `.strict()`
- ALL monetary values displayed using `formatCentsToDollars()` from `src/lib/finance/format.ts`
- `revalidatePath()` calls must include BOTH the new `/promotions` routes AND the existing `/fin/promo-codes` route where promo code data changes

### Business Logic
- Admin can DEACTIVATE/REACTIVATE seller promotions but NOT create/edit them (Feature Lock-in Section 2)
- Admin can CREATE/EDIT/DEACTIVATE platform promo codes (Feature Lock-in Section 2, Affiliate Canonical Section 2.5)
- Admin CANNOT modify affiliate promo codes (those belong to the affiliate — only deactivate for abuse)
- Affiliate promo codes are READ-ONLY in admin view (display context but no edit actions)
- Fee handling: "Twicely fees calculated on the final sale price after discounts" — this is display-only context for the admin, no calculation needed

### CASL Subject Distinction
- `Promotion` = seller-created promotions (D2 domain, sellerId-scoped)
- `PromoCode` = affiliate or platform promo codes (G1 domain, affiliateId-scoped or platform-wide)
- These are DIFFERENT CASL subjects. Do NOT mix them.
- The `/promotions` hub page checks BOTH subjects (OR logic for access)

---

## 4. ACCEPTANCE CRITERIA

### Access Control
- [ ] Staff with ADMIN role can access all three `/promotions` pages
- [ ] Staff with FINANCE role can access all three pages (manages PromoCode, reads Promotion)
- [ ] Staff with MODERATION role can access list and detail pages (read Promotion only, no PromoCode access)
- [ ] Staff with SUPPORT role CANNOT access `/promotions` pages (no Promotion or PromoCode ability)
- [ ] Unauthenticated users cannot access any `/promotions` hub page
- [ ] `staffAuthorize()` is called on every page (not `authorize()`)

### Seller Promotions Tab
- [ ] Lists all seller promotions across the platform (not scoped to one seller)
- [ ] Shows seller username joined from user table
- [ ] Status sub-tabs correctly filter: Active (isActive AND startsAt <= now AND endsAt null or > now), Scheduled (startsAt > now), Ended (not active or expired)
- [ ] Search by promotion name or coupon code works
- [ ] Pagination works with page param
- [ ] Each row links to `/promotions/{id}` detail page
- [ ] Empty state shown when no results

### Platform Promo Codes Tab
- [ ] Lists only type='PLATFORM' promo codes
- [ ] Shows discount formatted correctly (BPS as percentage, cents as dollars)
- [ ] "Create Platform Code" button visible when `ability.can('manage', 'PromoCode')`
- [ ] Each row links to detail page

### Affiliate Promo Codes Tab
- [ ] Lists only type='AFFILIATE' promo codes
- [ ] Shows affiliate username joined from affiliate+user tables
- [ ] NO edit/create actions (read-only for affiliate codes)

### Detail Page — Seller Promotion
- [ ] Shows all promotion fields with correct formatting
- [ ] Links seller to `/usr/{userId}` user management page
- [ ] [Deactivate] button visible when `ability.can('manage', 'Promotion')` and promotion is active
- [ ] [Reactivate] button visible when `ability.can('manage', 'Promotion')` and promotion is inactive AND not expired
- [ ] Deactivation creates audit event with severity='MEDIUM'
- [ ] Usage stats displayed correctly
- [ ] Recent usage table shows buyer, order, discount, date

### Detail Page — Promo Code
- [ ] Shows all promo code fields with correct formatting
- [ ] For AFFILIATE codes: shows affiliate name with link to `/usr/affiliates/{affiliateId}`
- [ ] [Deactivate]/[Reactivate] visible when `ability.can('manage', 'PromoCode')`
- [ ] For AFFILIATE codes: no edit capability beyond deactivate
- [ ] For PLATFORM codes: edit usageLimit, expiresAt, isActive inline
- [ ] Recent redemptions table shows user, product, discount, date

### Create Page
- [ ] Only accessible when `ability.can('manage', 'PromoCode')`
- [ ] Form validates: code 4-20 chars alphanumeric+hyphens, auto-uppercase
- [ ] Discount value validated as positive integer
- [ ] Duration 1-12 months
- [ ] Scope checkboxes for store/lister/automation/finance (empty = all)
- [ ] Optional usage limit and expiry
- [ ] On success: redirects to `/promotions`
- [ ] Code uniqueness validated server-side
- [ ] Audit event created on successful creation

### Data Integrity
- [ ] All monetary values displayed using `formatCentsToDollars()` (integer cents in DB, formatted dollars in UI)
- [ ] No `as any` or type assertions in any file
- [ ] All Zod schemas use `.strict()`
- [ ] No files exceed 300 lines
- [ ] No banned terms in UI text or code

### Vocabulary
- [ ] Tab label says "Promo Codes" not "Discount Rules"
- [ ] Seller promotions labeled as "Seller Promotions" not "Discount Rules"
- [ ] Zero banned terms in all created files

---

## 5. TEST REQUIREMENTS

### Unit Tests — `src/lib/queries/__tests__/admin-promotions.test.ts`

```
describe('getAllSellerPromotions', () => {
  it('returns promotions with seller username joined');
  it('filters by status=active correctly');
  it('filters by status=scheduled correctly');
  it('filters by status=ended correctly');
  it('filters by sellerId when provided');
  it('searches by promotion name with ILIKE');
  it('searches by coupon code with ILIKE');
  it('paginates with limit and offset');
  it('returns total count for pagination');
  it('returns empty rows when no promotions match');
});

describe('getPromotionDetailAdmin', () => {
  it('returns promotion with seller info and stats');
  it('returns recent usage with buyer and order info');
  it('returns null when promotion not found');
});

describe('getAllPromoCodesAdmin', () => {
  it('returns all promo codes when no filter');
  it('filters by type=PLATFORM');
  it('filters by type=AFFILIATE');
  it('filters by isActive');
  it('searches by code with ILIKE');
  it('includes affiliate username for AFFILIATE codes');
  it('paginates correctly');
});

describe('getPromoCodeDetailAdmin', () => {
  it('returns promo code with redemption history');
  it('returns affiliate info for AFFILIATE codes');
  it('returns null for non-existent ID');
});

describe('getPromotionsOverviewStats', () => {
  it('returns aggregate counts for active promotions and codes');
  it('returns zero counts when no data');
});
```

### Unit Tests — `src/lib/actions/__tests__/admin-promotions.test.ts`

```
describe('adminDeactivatePromotion', () => {
  it('deactivates an active promotion');
  it('returns error for non-existent promotion');
  it('returns Forbidden when staff lacks manage Promotion ability');
  it('creates audit event on deactivation');
  it('revalidates /promotions path');
});

describe('adminReactivatePromotion', () => {
  it('reactivates an inactive promotion');
  it('returns error when promotion has expired (endsAt < now)');
  it('returns error for non-existent promotion');
  it('returns Forbidden when staff lacks manage Promotion ability');
  it('creates audit event on reactivation');
});

describe('adminCreatePlatformPromoCode', () => {
  it('creates a platform promo code successfully');
  it('rejects duplicate codes');
  it('returns Forbidden when staff lacks manage PromoCode ability');
  it('validates input with strict schema');
  it('creates audit event on creation');
  it('revalidates both /promotions and /fin/promo-codes');
});

describe('adminUpdatePromoCode', () => {
  it('updates usageLimit on a promo code');
  it('updates expiresAt on a promo code');
  it('deactivates a promo code');
  it('returns Forbidden when staff lacks manage PromoCode ability');
  it('returns error for non-existent promo code');
});
```

### Test Patterns
- Mock `staffAuthorize()` using `vi.mock('@/lib/casl/staff-authorize')` with `makeStaffSession()` helper
- Mock `db` using standard `selectChain`/`insertChain` helpers
- Test both positive (authorized) and negative (forbidden) cases
- Verify `revalidatePath` calls
- Verify `auditEvent` inserts

---

## 6. FILE APPROVAL LIST

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/casl/platform-abilities.ts` | ADD `can('manage', 'Promotion')` for ADMIN, `can('read', 'Promotion')` for MODERATION and FINANCE |
| 2 | `src/lib/queries/admin-promotions.ts` | NEW — 5 query functions for hub promotions pages |
| 3 | `src/lib/actions/admin-promotions.ts` | NEW — 4 server actions for admin promotion/promo code management |
| 4 | `src/lib/validations/admin-promotions.ts` | NEW — Zod schemas for admin promotion filters and ID validation |
| 5 | `src/app/(hub)/promotions/page.tsx` | NEW — Tabbed overview page (seller promos + platform codes + affiliate codes) |
| 6 | `src/app/(hub)/promotions/[id]/page.tsx` | NEW — Detail page for either a promotion or promo code |
| 7 | `src/app/(hub)/promotions/new/page.tsx` | NEW — Full-page form for creating platform promo codes |
| 8 | `src/lib/queries/__tests__/admin-promotions.test.ts` | NEW — Tests for admin promotion queries |
| 9 | `src/lib/actions/__tests__/admin-promotions.test.ts` | NEW — Tests for admin promotion actions |

**Total: 9 files (1 modified, 8 new)**

---

## 7. VERIFICATION CHECKLIST

After implementation, run these checks and paste the FULL raw output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Test suite (must be >= 8603)
pnpm test

# 3. Lint check
./twicely-lint.sh

# 4. Banned terms check in new files
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|Twicely Balance\|wallet\|Withdraw\|discountRule\|discount_rule" \
  src/lib/queries/admin-promotions.ts \
  src/lib/actions/admin-promotions.ts \
  src/lib/validations/admin-promotions.ts \
  src/app/\(hub\)/promotions/

# 5. Route prefix check — verify no wrong routes
grep -rn "/admin\|/dashboard\|/listing/\|/store/" \
  src/app/\(hub\)/promotions/

# 6. File size check
wc -l src/lib/queries/admin-promotions.ts \
  src/lib/actions/admin-promotions.ts \
  src/lib/validations/admin-promotions.ts \
  src/app/\(hub\)/promotions/page.tsx \
  src/app/\(hub\)/promotions/\[id\]/page.tsx \
  src/app/\(hub\)/promotions/new/page.tsx

# 7. Verify no exported helpers in 'use server' files
grep -n "^export function\|^export async function\|^export const" src/lib/actions/admin-promotions.ts
# Only server actions should be exported, not helper functions

# 8. Verify CASL gap fix
grep -n "Promotion" src/lib/casl/platform-abilities.ts
```

**Expected outcomes:**
- TypeScript: 0 errors
- Tests: >= 8603 (new tests increase count)
- Banned terms: 0 matches
- Wrong routes: 0 matches
- All files under 300 lines
- No exported helpers in server action files
- `platform-abilities.ts` shows `Promotion` in ADMIN and MODERATION sections

---

## 8. SPEC GAPS & DECISIONS NEEDED

### Gap 1: `/promotions` NOT in Page Registry
The Page Registry (`TWICELY_V3_PAGE_REGISTRY.md`) does NOT have a `/promotions` hub route. The Build Sequence Tracker (I9 row) specifies it. This is a documentation gap — the build tracker is authoritative for Phase I enrichment steps. Proceed with the routes as specified by the tracker.

### Gap 2: No `manage Promotion` for Platform Staff
The Actors/Security canonical gives platform staff `manage PromoCode` (FINANCE) but NOT `manage Promotion`. Feature Lock-in Section 2 says "Admin can disable any seller's promotions if abusive." This install prompt adds the CASL rule. The owner may want to update the canonical docs.

### Gap 3: `discountRule` Does Not Exist
The decomposer mentioned "discount rules" as a sub-domain. There is no `discountRule` table in the schema. The `promotion` table with `promotionTypeEnum` (PERCENT_OFF, AMOUNT_OFF, FREE_SHIPPING, BUNDLE_DISCOUNT) and `promotionScopeEnum` (STORE_WIDE, CATEGORY, SPECIFIC_LISTINGS) covers all discount types. The UI should say "Seller Promotions" not "Discount Rules."

### Gap 4: Dual-ID Detail Page
The `/promotions/[id]` page must handle IDs from two different tables (`promotion` vs `promoCode`). Since both use CUID2 IDs and there's no overlap risk, the page should try `promotion` first, then `promoCode`. This is a pragmatic design choice — the alternative (separate routes like `/promotions/promo/{id}` and `/promotions/code/{id}`) would be cleaner but is NOT in the build tracker spec.

---

## 9. CROSS-REFERENCES

| Existing File | Relationship |
|---------------|-------------|
| `src/app/(hub)/fin/promo-codes/page.tsx` | Existing platform promo code view — `/promotions` SUPPLEMENTS this (financial view stays at `/fin/promo-codes`, admin CRUD view at `/promotions`) |
| `src/components/hub/create-platform-promo-dialog.tsx` | Reuse in `/promotions` overview page for quick-create |
| `src/lib/actions/promo-codes-platform.ts` | Existing platform promo code actions — delegate where possible, don't duplicate |
| `src/lib/actions/promotions.ts` | Seller-side promotion CRUD — admin uses READ queries only, deactivate/reactivate are new admin-specific actions |
| `src/lib/queries/promotions.ts` | Seller-side promotion queries — admin queries reuse `getPromotionStats()` |
| `src/lib/queries/promo-codes.ts` | Existing promo code queries — admin queries extend with joins |
| `src/lib/validations/promo-code.ts` | Existing Zod schemas — reuse `createPlatformPromoCodeSchema`, `updatePromoCodeSchema` |

---

**END OF INSTALL PROMPT — I9 Promotions Admin**
