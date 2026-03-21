# [G1-FIX] Affiliate & Promo Code Audit Blockers

**Feature Name:** G1 Super Audit V2 — 5 Blocker Fixes
**One-line Summary:** Fix 1 security vulnerability (exposed server action), 1 broken UI link, and 3 hardcoded values that must come from platform_settings.
**Canonical Sources:**
- `TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL.md` — Section 2.4 (promo code rules), Section 6 (platform settings)
- `CLAUDE.md` — fee calculations server-side only, money as integer cents, no hardcoded rates

---

## 1. PREREQUISITES

- G1.5 (Promo Code System) must be complete
- These files must already exist:
  - `src/lib/actions/promo-codes-platform.ts` (contains `recordPromoCodeRedemption`)
  - `src/lib/actions/promo-codes.ts` (barrel re-export)
  - `src/lib/actions/promo-codes-helpers.ts` (shared helpers, NOT a 'use server' file)
  - `src/lib/actions/promo-codes-affiliate.ts` (contains hardcoded limits)
  - `src/lib/actions/create-subscription-checkout.ts` (imports `recordPromoCodeRedemption`)
  - `src/components/affiliate/affiliate-commission-table.tsx` (has broken link)
  - `src/lib/db/seed/seed-affiliate-settings.ts` (platform settings seed)
  - `src/lib/actions/__tests__/promo-codes-platform-validate-record.test.ts`
  - `src/lib/actions/__tests__/promo-codes-affiliate-create.test.ts`

---

## 2. SCOPE — EXACTLY WHAT TO FIX

### B1. Security: Move `recordPromoCodeRedemption` Out of 'use server' File

**Problem:** `recordPromoCodeRedemption` is an exported function in `src/lib/actions/promo-codes-platform.ts` which has `'use server'` at the top. This makes it a callable server action from the client. It accepts raw `userId`, `promoCodeId`, and `discountAppliedCents` with NO `authorize()` call. A malicious client could record fake promo code redemptions for any user.

It is also re-exported from `src/lib/actions/promo-codes.ts` (another `'use server'` barrel file), doubling the exposure.

**Fix — 3 changes:**

**Change 1: Move the function to `src/lib/actions/promo-codes-helpers.ts`**

This file already exists and does NOT have `'use server'`. It currently contains only `deactivateStripeIfExists()`. Add `recordPromoCodeRedemption` here.

Cut the entire function (lines 185-211 of `promo-codes-platform.ts`) and paste it into `promo-codes-helpers.ts`. Add the necessary imports at the top of `promo-codes-helpers.ts`:

```typescript
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { promoCode, promoCodeRedemption } from '@/lib/db/schema';
```

The moved function signature is:

```typescript
export async function recordPromoCodeRedemption(
  promoCodeId: string,
  userId: string,
  product: string,
  discountAppliedCents: number,
  durationMonths: number,
  stripePromotionCodeId: string,
): Promise<void> {
  await db.insert(promoCodeRedemption).values({
    promoCodeId,
    userId,
    subscriptionProduct: product,
    discountAppliedCents,
    monthsRemaining: durationMonths,
    stripePromotionCodeId,
  });

  await db
    .update(promoCode)
    .set({
      usageCount: sql`${promoCode.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(promoCode.id, promoCodeId));
}
```

**Change 2: Remove `recordPromoCodeRedemption` from `src/lib/actions/promo-codes-platform.ts`**

Delete the function AND the comment header above it (`// --- recordPromoCodeRedemption ---`). Also remove any imports that were only used by this function (check if `sql` is used elsewhere in the file — it is NOT, so remove `sql` from the `drizzle-orm` import. Also remove `promoCodeRedemption` from the schema import if not used elsewhere — it is NOT used elsewhere).

After this change, `promo-codes-platform.ts` should have these imports:

```typescript
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { promoCode, auditEvent } from '@/lib/db/schema';
```

**Change 3: Remove `recordPromoCodeRedemption` from the barrel re-export in `src/lib/actions/promo-codes.ts`**

Current line 13: `recordPromoCodeRedemption,` — DELETE this line.

The barrel file should become:

```typescript
'use server';

export {
  createAffiliatePromoCode,
  updateAffiliatePromoCode,
  deleteAffiliatePromoCode,
} from './promo-codes-affiliate';

export {
  createPlatformPromoCode,
  updatePlatformPromoCode,
  validatePromoCode,
} from './promo-codes-platform';
```

**Change 4: Update the import in `src/lib/actions/create-subscription-checkout.ts`**

Line 215 currently does:
```typescript
const { recordPromoCodeRedemption } = await import('@/lib/actions/promo-codes-platform');
```

Change to:
```typescript
const { recordPromoCodeRedemption } = await import('@/lib/actions/promo-codes-helpers');
```

The dynamic import pattern is intentional (avoids transitive drizzle-orm/sql import in tests). Keep it as a dynamic import, just change the path.

**Change 5: Update the test file `src/lib/actions/__tests__/promo-codes-platform-validate-record.test.ts`**

The test file currently imports `recordPromoCodeRedemption` from `'../promo-codes-platform'` (line 36). Change this import to `'../promo-codes-helpers'`.

Also update the mock setup. Currently the test file mocks `'../promo-codes-helpers'` (line 26-28). Since `recordPromoCodeRedemption` is now IN that module, the mock for `'../promo-codes-helpers'` must include it:

```typescript
vi.mock('../promo-codes-helpers', () => ({
  deactivateStripeIfExists: vi.fn(),
  recordPromoCodeRedemption: vi.fn(),
}));
```

Wait — actually, the `recordPromoCodeRedemption` tests need the REAL function, not a mock. The tests for `recordPromoCodeRedemption` test its actual behavior (that it calls `db.insert` and `db.update`). So the approach is:

1. Move the `recordPromoCodeRedemption` describe block out of this test file into a NEW test file: `src/lib/actions/__tests__/promo-codes-redemption.test.ts`
2. In the original test file (`promo-codes-platform-validate-record.test.ts`), remove the import of `recordPromoCodeRedemption` and remove the entire `describe('recordPromoCodeRedemption', ...)` block (lines 164-190).
3. Update the mock for `'../promo-codes-helpers'` in the original test file to also mock `recordPromoCodeRedemption` (since `promo-codes-platform.ts` no longer exports it, this mock entry is actually not needed for the remaining tests, but having it does no harm).

**New test file: `src/lib/actions/__tests__/promo-codes-redemption.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: { insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/stripe/server', () => ({
  stripe: {},
}));

vi.mock('@/lib/stripe/promo-codes', () => ({
  deactivateStripePromotionCode: vi.fn(),
}));

import { recordPromoCodeRedemption } from '../promo-codes-helpers';
import { db } from '@/lib/db';

const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);

// ─── recordPromoCodeRedemption ──────────────────────────────────────────────

describe('recordPromoCodeRedemption', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
  });

  it('inserts a redemption record', async () => {
    await recordPromoCodeRedemption('pc-1', 'user-1', 'store', 500, 3, 'promo-stripe-1');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('increments usageCount on the promo code', async () => {
    await recordPromoCodeRedemption('pc-1', 'user-1', 'store', 500, 3, 'promo-stripe-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('performs two DB operations: insert redemption + update usageCount', async () => {
    await recordPromoCodeRedemption('pc-1', 'user-1', 'lister', 1000, 6, 'promo-stripe-2');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
```

Note: The mock for `@/lib/stripe/server` and `@/lib/stripe/promo-codes` is needed because `promo-codes-helpers.ts` imports from `@/lib/stripe/server` and `@/lib/stripe/promo-codes` at the top level (for `deactivateStripeIfExists`).

---

### B2. Broken Link: Remove `/my/selling/affiliate/commissions` Link

**File:** `src/components/affiliate/affiliate-commission-table.tsx`

**Problem:** Lines 63-66 render a "View all commissions" link pointing to `/my/selling/affiliate/commissions`. This route was never created. No page exists at this path. Users who click it will see a 404.

**Fix:** Remove the `showViewAll` prop usage and the link entirely. The commissions are already shown in the main affiliate dashboard — a separate commissions page was never specced.

Replace the entire `{showViewAll && (...)}` block (lines 63-66) with nothing. Specifically, remove:

```tsx
      {showViewAll && (
        <a href="/my/selling/affiliate/commissions" className="text-sm text-primary hover:underline">
          View all commissions
        </a>
      )}
```

Also remove `showViewAll` from the `AffiliateCommissionTableProps` interface and from the destructured props.

Updated interface:
```typescript
interface AffiliateCommissionTableProps {
  commissions: CommissionRow[];
}
```

Updated function signature:
```typescript
export function AffiliateCommissionTable({ commissions }: AffiliateCommissionTableProps) {
```

**Then update the single caller** in `src/components/affiliate/affiliate-dashboard.tsx` at line 122:

Current:
```tsx
<AffiliateCommissionTable commissions={recentCommissions} showViewAll={totalCommissions > 5} />
```

Change to:
```tsx
<AffiliateCommissionTable commissions={recentCommissions} />
```

Verify no other callers exist by searching: `grep -rn "showViewAll" src/ --include="*.ts" --include="*.tsx"`

---

### B3. Hardcoded Duration Limits -> Platform Settings

**File:** `src/lib/actions/promo-codes-affiliate.ts`, line 62

**Current (hardcoded):**
```typescript
const maxDuration = isCommunity ? 3 : 6;
```

**Fix:** Add 2 new platform settings to `src/lib/db/seed/seed-affiliate-settings.ts`, then use `getPlatformSetting()` in the action.

**New settings to add (in the AFFILIATE PROGRAM section of `seed-affiliate-settings.ts`):**

```typescript
{ key: 'affiliate.community.maxPromoCodeDurationMonths', value: 3, type: 'number', category: 'affiliate', description: 'Community max promo code duration (months)' },
{ key: 'affiliate.influencer.maxPromoCodeDurationMonths', value: 6, type: 'number', category: 'affiliate', description: 'Influencer max promo code duration (months)' },
```

**Updated code in `promo-codes-affiliate.ts` (replace lines 61-65):**

```typescript
  // Duration limits
  const maxDuration = isCommunity
    ? await getPlatformSetting('affiliate.community.maxPromoCodeDurationMonths', 3)
    : await getPlatformSetting('affiliate.influencer.maxPromoCodeDurationMonths', 6);
  if (data.durationMonths > maxDuration) {
    return { success: false, error: `Duration exceeds maximum allowed (${maxDuration} months)` };
  }
```

Note: `getPlatformSetting` is already imported in this file (line 8). No new import needed.

---

### B4. Hardcoded Active Code Limits -> Platform Settings

**File:** `src/lib/actions/promo-codes-affiliate.ts`, line 68

**Current (hardcoded):**
```typescript
const maxCodes = isCommunity ? 3 : 10;
```

**Fix:** Add 2 new platform settings to `src/lib/db/seed/seed-affiliate-settings.ts`, then use `getPlatformSetting()`.

**New settings to add:**

```typescript
{ key: 'affiliate.community.maxActivePromoCodes', value: 3, type: 'number', category: 'affiliate', description: 'Community max active promo codes' },
{ key: 'affiliate.influencer.maxActivePromoCodes', value: 10, type: 'number', category: 'affiliate', description: 'Influencer max active promo codes' },
```

**Updated code in `promo-codes-affiliate.ts` (replace lines 67-75):**

```typescript
  // Active code limits
  const maxCodes = isCommunity
    ? await getPlatformSetting('affiliate.community.maxActivePromoCodes', 3)
    : await getPlatformSetting('affiliate.influencer.maxActivePromoCodes', 10);
  const [activeCount] = await db
    .select({ total: count() })
    .from(promoCode)
    .where(and(eq(promoCode.affiliateId, affiliateRecord.id), eq(promoCode.isActive, true)));
  if ((activeCount?.total ?? 0) >= maxCodes) {
    return { success: false, error: `Maximum active promo codes reached (${maxCodes})` };
  }
```

---

### B5. Hardcoded Fixed Discount Cap -> Platform Settings

**File:** `src/lib/actions/promo-codes-affiliate.ts`, line 56

**Current (hardcoded, no tier differentiation):**
```typescript
  } else {
    if (data.discountValue > 5000) {
      return { success: false, error: 'Fixed discount exceeds maximum allowed ($50)' };
    }
  }
```

**Fix:** Add 2 new platform settings to `src/lib/db/seed/seed-affiliate-settings.ts`, then use `getPlatformSetting()` with tier differentiation.

**New settings to add:**

```typescript
{ key: 'affiliate.community.maxFixedPromoDiscountCents', value: 5000, type: 'cents', category: 'affiliate', description: 'Community max fixed promo discount (cents)' },
{ key: 'affiliate.influencer.maxFixedPromoDiscountCents', value: 10000, type: 'cents', category: 'affiliate', description: 'Influencer max fixed promo discount (cents)' },
```

**Updated code in `promo-codes-affiliate.ts` (replace lines 55-58):**

```typescript
  } else {
    const maxFixedCents = isCommunity
      ? await getPlatformSetting('affiliate.community.maxFixedPromoDiscountCents', 5000)
      : await getPlatformSetting('affiliate.influencer.maxFixedPromoDiscountCents', 10000);
    if (data.discountValue > maxFixedCents) {
      const maxDollars = maxFixedCents / 100;
      return { success: false, error: `Fixed discount exceeds maximum allowed ($${maxDollars})` };
    }
  }
```

---

## 3. SEED FILE: ALL 6 NEW SETTINGS TOGETHER

In `src/lib/db/seed/seed-affiliate-settings.ts`, add these 6 entries to the `AFFILIATE_TRIAL_SETTINGS` array, in the AFFILIATE PROGRAM section (after the existing `affiliate.maxInfluencerDiscountBps` entry, before the TRIALS section):

```typescript
  { key: 'affiliate.community.maxPromoCodeDurationMonths', value: 3, type: 'number', category: 'affiliate', description: 'Community max promo code duration (months)' },
  { key: 'affiliate.influencer.maxPromoCodeDurationMonths', value: 6, type: 'number', category: 'affiliate', description: 'Influencer max promo code duration (months)' },
  { key: 'affiliate.community.maxActivePromoCodes', value: 3, type: 'number', category: 'affiliate', description: 'Community max active promo codes' },
  { key: 'affiliate.influencer.maxActivePromoCodes', value: 10, type: 'number', category: 'affiliate', description: 'Influencer max active promo codes' },
  { key: 'affiliate.community.maxFixedPromoDiscountCents', value: 5000, type: 'cents', category: 'affiliate', description: 'Community max fixed promo discount (cents)' },
  { key: 'affiliate.influencer.maxFixedPromoDiscountCents', value: 10000, type: 'cents', category: 'affiliate', description: 'Influencer max fixed promo discount (cents)' },
```

This brings the total from 24 settings (12 affiliate + 12 trial) to 30 settings (18 affiliate + 12 trial).

---

## 4. TEST UPDATES

### 4.1 Update `promo-codes-affiliate-create.test.ts`

The existing tests already mock `getPlatformSetting`. The hardcoded-value tests (duration, active codes, fixed discount) need to be updated to configure `mockGetPlatformSetting` for the new setting keys.

Currently `mockGetPlatformSetting.mockResolvedValue(2000 as never)` is used as a blanket mock (returns 2000 for any key). This works for percentage BPS checks but is wrong for the new settings. Fix the mock to return different values based on the key:

For COMMUNITY tier tests, update `beforeEach` to use `mockGetPlatformSetting.mockImplementation`:

```typescript
mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
  const map: Record<string, unknown> = {
    'affiliate.maxPromoDiscountBps': 2000,
    'affiliate.community.maxFixedPromoDiscountCents': 5000,
    'affiliate.community.maxPromoCodeDurationMonths': 3,
    'affiliate.community.maxActivePromoCodes': 3,
  };
  return Promise.resolve(map[key] ?? fallback);
});
```

For INFLUENCER tier tests:

```typescript
mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
  const map: Record<string, unknown> = {
    'affiliate.maxInfluencerDiscountBps': 5000,
    'affiliate.influencer.maxFixedPromoDiscountCents': 10000,
    'affiliate.influencer.maxPromoCodeDurationMonths': 6,
    'affiliate.influencer.maxActivePromoCodes': 10,
  };
  return Promise.resolve(map[key] ?? fallback);
});
```

Add new test cases:

**COMMUNITY tier — new tests:**

```typescript
it('rejects FIXED discount over community max from platform settings (5000 cents = $50)', async () => {
  const result = await createAffiliatePromoCode({
    ...validCreateInput,
    discountType: 'FIXED',
    discountValue: 5001,
  });
  expect(result.success).toBe(false);
  expect(result.error).toContain('$50');
});

it('accepts FIXED discount at community max (exactly 5000 cents)', async () => {
  mockSelect.mockReturnValueOnce(makeSelectCountChain(0));
  mockGetPromoCodeByCode.mockResolvedValue(null);
  makeInsertSequence({ id: 'pc-new', code: 'FIXED50', discountType: 'FIXED' });
  const result = await createAffiliatePromoCode({
    ...validCreateInput,
    discountType: 'FIXED',
    discountValue: 5000,
  });
  expect(result.success).toBe(true);
});
```

**INFLUENCER tier — new tests:**

```typescript
it('rejects FIXED discount over influencer max from platform settings (10000 cents = $100)', async () => {
  const result = await createAffiliatePromoCode({
    ...validCreateInput,
    discountType: 'FIXED',
    discountValue: 10001,
  });
  expect(result.success).toBe(false);
  expect(result.error).toContain('$100');
});

it('accepts FIXED discount at influencer max (exactly 10000 cents)', async () => {
  mockSelect.mockReturnValueOnce(makeSelectCountChain(0));
  mockGetPromoCodeByCode.mockResolvedValue(null);
  makeInsertSequence({ id: 'pc-new', code: 'FIXED100', discountType: 'FIXED' });
  const result = await createAffiliatePromoCode({
    ...validCreateInput,
    discountType: 'FIXED',
    discountValue: 10000,
  });
  expect(result.success).toBe(true);
});
```

### 4.2 Update `promo-codes-platform-validate-record.test.ts`

As described in B1 above:
- Remove `recordPromoCodeRedemption` from the import on line 36
- Remove the entire `describe('recordPromoCodeRedemption', ...)` block (lines 164-190)
- These tests are moved to the new `promo-codes-redemption.test.ts` file

### 4.3 New test file: `promo-codes-redemption.test.ts`

As specified in B1 above. Contains the 3 moved tests for `recordPromoCodeRedemption`, now importing from `'../promo-codes-helpers'`.

---

## 5. CONSTRAINTS — WHAT NOT TO DO

- Do NOT add `authorize()` to `recordPromoCodeRedemption` — it is an internal server-side utility called from `createSubscriptionCheckout` which already has its own auth. Adding auth would double-authorize.
- Do NOT create a new file for `recordPromoCodeRedemption` — add it to the existing `promo-codes-helpers.ts`.
- Do NOT change the function signature of `recordPromoCodeRedemption`.
- Do NOT change any logic in `createSubscriptionCheckout.ts` beyond the single import path change.
- Do NOT change the `validatePromoCode` function.
- Do NOT add any new routes or pages.
- Do NOT use `as any` or `@ts-ignore`.
- Do NOT create new tables or columns.
- Money values must remain as integer cents.
- The `getPlatformSetting` fallback values must match the seed values exactly (3, 6, 3, 10, 5000, 10000).

---

## 6. ACCEPTANCE CRITERIA

### Security (B1)
- [ ] `recordPromoCodeRedemption` is NOT in any `'use server'` file
- [ ] `recordPromoCodeRedemption` is exported from `src/lib/actions/promo-codes-helpers.ts` (which has NO `'use server'` directive)
- [ ] `recordPromoCodeRedemption` is NOT exported from `src/lib/actions/promo-codes.ts`
- [ ] `recordPromoCodeRedemption` is NOT exported from `src/lib/actions/promo-codes-platform.ts`
- [ ] `create-subscription-checkout.ts` imports from `'@/lib/actions/promo-codes-helpers'`
- [ ] `promo-codes-helpers.ts` does NOT have `'use server'` at the top

### Broken Link (B2)
- [ ] No reference to `/my/selling/affiliate/commissions` exists anywhere in `src/`
- [ ] `AffiliateCommissionTable` no longer accepts a `showViewAll` prop
- [ ] No callers pass `showViewAll` to `AffiliateCommissionTable`

### Platform Settings (B3/B4/B5)
- [ ] `seed-affiliate-settings.ts` contains exactly 30 entries (was 24, +6 new)
- [ ] No hardcoded `3` or `6` for duration limits in `promo-codes-affiliate.ts`
- [ ] No hardcoded `3` or `10` for active code limits in `promo-codes-affiliate.ts`
- [ ] No hardcoded `5000` for fixed discount cap in `promo-codes-affiliate.ts`
- [ ] All 6 new values are read via `getPlatformSetting()` with correct keys
- [ ] Community fixed discount cap: 5000 cents ($50)
- [ ] Influencer fixed discount cap: 10000 cents ($100)
- [ ] Community duration cap: 3 months
- [ ] Influencer duration cap: 6 months
- [ ] Community active code cap: 3
- [ ] Influencer active code cap: 10

### Tests
- [ ] Test count >= BASELINE (3816). Must not decrease.
- [ ] All existing tests still pass
- [ ] New `promo-codes-redemption.test.ts` has 3 tests
- [ ] `promo-codes-platform-validate-record.test.ts` no longer tests `recordPromoCodeRedemption`
- [ ] `promo-codes-affiliate-create.test.ts` tests tier-specific fixed discount caps
- [ ] TypeScript: 0 errors

---

## 7. FILE APPROVAL LIST

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `src/lib/actions/promo-codes-helpers.ts` | MODIFY | Add `recordPromoCodeRedemption` + its imports |
| 2 | `src/lib/actions/promo-codes-platform.ts` | MODIFY | Remove `recordPromoCodeRedemption` + unused imports |
| 3 | `src/lib/actions/promo-codes.ts` | MODIFY | Remove `recordPromoCodeRedemption` re-export |
| 4 | `src/lib/actions/create-subscription-checkout.ts` | MODIFY | Change import path for `recordPromoCodeRedemption` |
| 5 | `src/lib/actions/promo-codes-affiliate.ts` | MODIFY | Replace 3 hardcoded values with `getPlatformSetting()` calls |
| 6 | `src/components/affiliate/affiliate-commission-table.tsx` | MODIFY | Remove `showViewAll` prop and broken link |
| 7 | `src/lib/db/seed/seed-affiliate-settings.ts` | MODIFY | Add 6 new platform settings |
| 8 | `src/lib/actions/__tests__/promo-codes-platform-validate-record.test.ts` | MODIFY | Remove `recordPromoCodeRedemption` tests (moved) |
| 9 | `src/lib/actions/__tests__/promo-codes-redemption.test.ts` | CREATE | Moved `recordPromoCodeRedemption` tests |
| 10 | `src/lib/actions/__tests__/promo-codes-affiliate-create.test.ts` | MODIFY | Update mocks for `getPlatformSetting`, add fixed discount tests |
| 11 | `src/components/affiliate/affiliate-dashboard.tsx` | MODIFY | Remove `showViewAll` prop from `AffiliateCommissionTable` usage |

---

## 8. VERIFICATION CHECKLIST

After implementation, run ALL of these and paste RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. All tests
pnpm test

# 3. Verify recordPromoCodeRedemption is NOT in any 'use server' file
grep -rn "recordPromoCodeRedemption" src/lib/actions/ --include="*.ts" | grep -v "__tests__" | grep -v "node_modules"

# 4. Verify no broken link
grep -rn "affiliate/commissions" src/ --include="*.ts" --include="*.tsx"

# 5. Verify no hardcoded limits in promo-codes-affiliate.ts
grep -n "isCommunity ? 3" src/lib/actions/promo-codes-affiliate.ts
grep -n "isCommunity ? 3 : 10" src/lib/actions/promo-codes-affiliate.ts
grep -n "> 5000" src/lib/actions/promo-codes-affiliate.ts

# 6. Verify promo-codes-helpers.ts does NOT have 'use server'
head -3 src/lib/actions/promo-codes-helpers.ts

# 7. Count settings in seed file
grep -c "key:" src/lib/db/seed/seed-affiliate-settings.ts

# 8. File size check
wc -l src/lib/actions/promo-codes-helpers.ts src/lib/actions/promo-codes-platform.ts src/lib/actions/promo-codes-affiliate.ts src/components/affiliate/affiliate-commission-table.tsx

# 9. Run the lint script
./twicely-lint.sh
```

**Expected outcomes:**
1. TypeScript: 0 errors
2. Tests: >= 3816 passing (should be ~3819+ with 3 new tests from moved file and new fixed-discount tests)
3. `recordPromoCodeRedemption` appears only in `promo-codes-helpers.ts` (not in `promo-codes-platform.ts` or `promo-codes.ts`)
4. Zero matches for `affiliate/commissions`
5. Zero matches for all three hardcoded value patterns
6. First line of `promo-codes-helpers.ts` is the JSDoc comment `/**`, NOT `'use server'`
7. Exactly 30 entries in seed file
8. All files under 300 lines

---

## END OF INSTALL PROMPT
