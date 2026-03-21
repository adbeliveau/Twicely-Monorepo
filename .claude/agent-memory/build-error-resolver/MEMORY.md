# Build Error Resolver - Agent Memory

## Fix Patterns

### Missing table in schema mock causes silent crash — downstream db calls never reached
**Class:** 2 (test failure — all DB calls after the crash assert 0 times)
**Error:** `expected "vi.fn()" to be called 4 times, but got 0 times` / `expected undefined to be defined`
**Root cause:** Implementation imports a new table from `@/lib/db/schema` that the test's `vi.mock('@/lib/db/schema', ...)` doesn't export. Accessing `undefinedTable.columnName` throws a TypeError inside a `try/catch` in the outer loop, so execution skips all remaining DB operations for that user.
**Fix:** Add the missing table to the schema mock: `listingImage: { listingId: 'listing_id', url: 'url' }`.
**Also required:** Mock any new modules imported by the implementation (e.g., `@/lib/storage/image-service`, `@/lib/notifications/service`) or the entire function call chain fails.
**Pattern:** When an executor function gains a new `db.select()` call sequence, also update per-test mock position counts (the inline `if (n === ...)` guards) to match the new total call count, returning `[]` for new calls that should be no-ops.

### New notify() call breaks test — schema mock missing notificationPreference
**Class:** 2 (test failure)
**Error:** `[vitest] No "notificationPreference" export is defined on the "@/lib/db/schema" mock`
**Root cause:** `notify()` from `@/lib/notifications/service` queries the `notificationPreference` table from schema. Test mocks `@/lib/db/schema` but doesn't include `notificationPreference`.
**Fix:** Add `vi.mock('@/lib/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }))` to the test file. Mocking the service module directly is simpler than adding `notificationPreference` to the schema mock.

### Sequential db.select() calls — use mockReturnValueOnce per call
**Class:** 2 (test failure)
**Error:** `TypeError: db.select(...).from(...).where(...).limit is not a function`
**Root cause:** Action makes N sequential `db.select()` calls. A single `mockReturnValue` is reused for all, so the second+ calls get a stale chain that is missing `.limit()` (or any method the action adds to the chain after the first call was set up).
**Fix:** Replace `mockReturnValue` with one `mockReturnValueOnce` per sequential `db.select()` call, each with the correct chain depth:
- Lookup without `.limit`: `.from().where()` → `mockResolvedValue([...rows])`
- platformSetting with `.limit(1)`: `.from().where().limit()` → `mockResolvedValue([{ value: '...' }])`

### Zod-first action + vi.clearAllMocks() mock queue contamination
**Class:** 2 (test failure — cross-test contamination)
**Error:** Tests downstream of an early-exit test fail with wrong mock data, "is not iterable", or "Cannot read properties of undefined (reading 'from')"
**Root cause:** `vi.clearAllMocks()` does NOT clear `mockReturnValueOnce` queues. When an action returns early (e.g., Zod validation rejects before any DB calls), unconsumed `mockReturnValueOnce` entries persist and shift mock queue positions in subsequent tests.
**Fix:** Change `vi.clearAllMocks()` to `vi.resetAllMocks()` in `beforeEach`. `resetAllMocks` calls `.mockReset()` which clears BOTH call history AND the `mockReturnValueOnce` queue AND permanent `mockReturnValue` implementations. Also remove any unreachable mock setups in tests that exit via Zod before reaching auth/DB.
**File changed:** `src/lib/actions/__tests__/price-alerts.test.ts`

### Zod v4 error message format
**Note:** When updating test assertions for Zod v4 validation errors:
- `z.number().max(50)` with value 60 → `"Too big: expected number to be <=50"`
- `z.number().min(5)` with value 2 → `"Too small: expected number to be >=5"`
- `z.string().min(1, 'msg')` with empty string → `'msg'` (custom message used)
- Error property: `.error.issues[0]?.message` (NOT `.error.errors[0]`)

### TS2532 in test files — mock array access is possibly undefined
**Class:** 1 (TypeScript error)
**Error:** `Object is possibly 'undefined'` on `mock.calls[0][0]`, `mock.results[0].value`, `result[N].field`
**Root cause:** TypeScript knows array index access returns `T | undefined`. Vitest's `mock.calls` and `mock.results` arrays are typed as `T[]`, so any index is potentially undefined.
**Fix:** Add `!` non-null assertion after each array index access in test code where the mock was already asserted to have been called. Pattern: `mock.calls[0]![0]`, `mock.results[0]!.value`, `result[1]!.severity`. This is safe in tests because we always assert `toHaveBeenCalled()` or the mock was set up before the access.
**Never use:** `as any` or `@ts-ignore` for this — `!` is the correct and minimal fix.

### "No X export defined on @/lib/db/schema mock" — mock the query module instead
**Class:** 2 (test failure)
**Error:** `No "platformSetting" export is defined on the "@/lib/db/schema" mock`
**Root cause:** Test file mocks `@/lib/db/schema` without including a table that an action indirectly uses (e.g., `checkout.ts` calls `getPlatformSetting()` which imports `platformSetting` from schema).
**Fix:** Add `vi.mock('@/lib/queries/platform-settings', () => ({ getPlatformSetting: vi.fn().mockResolvedValue(100) }))` to the test file. This is simpler than adding the table to the schema mock and avoids chaining issues.
**File:** `src/lib/actions/__tests__/checkout-initiate.test.ts`

### TS6133 unused helper in test file
**Class:** 1 (TypeScript error)
**Error:** `'makeXChain' is declared but its value is never read`
**Root cause:** A helper function was copied into a test file but is not called by any test in that file (e.g., `makeInsertChain` in auth/validation-only test files, `makeUpdateChain` in insert-only test files).
**Fix:** Remove the unused function definition. Do NOT suppress with a `_` prefix — just delete it.

### TS6133 unused constants in test file — remove them
**Class:** 1 (TypeScript error)
**Error:** `'emptyKPIs' is declared but its value is never read.`
**Root cause:** Constants defined at module scope in a test file never referenced by any test (copy-pasted from another test file).
**Fix:** Remove the unused const declarations entirely. Files: `src/lib/actions/__tests__/finance-center-extra.test.ts` (emptyKPIs, emptyExpenses, emptyMileage removed).

### CASL Analytics condition key: sellerId not userId
**Class:** 7 (spec violation — critical runtime bug)
**Pattern:** `ability.can('read', sub('Analytics', { userId }))` returns false for ALL sellers.
**Root cause:** `defineSellerAbilities` defines `can('read', 'Analytics', { sellerId })`. Action was checking `{ userId }` — wrong key.
**Fix:** Change `sub('Analytics', { userId })` to `sub('Analytics', { sellerId: userId })` in the action. Update test assertions from `userId: 'xxx'` to `sellerId: 'xxx'`.
**Files fixed:** `src/lib/actions/finance-center.ts` line 46, `src/lib/actions/__tests__/finance-center-dashboard.test.ts` line 132.

### Missing LedgerEntry read rule for sellers
**Class:** 7 (spec violation — critical runtime bug)
**Pattern:** `ability.can('read', sub('LedgerEntry', { userId }))` returns false for ALL sellers.
**Root cause:** `defineSellerAbilities` had no `LedgerEntry` read rule. Staff had one (`finance.view` scope), sellers didn't.
**Fix:** Add `can('read', 'LedgerEntry', { userId })` to Finance Center block in `defineSellerAbilities` in `src/lib/casl/ability.ts`.

### CASL condition keys quick reference
- `Analytics`: uses `{ sellerId }` for both sellers and staff — action must pass `{ sellerId: userId }`
- `LedgerEntry`: uses `{ userId }` — seller rule added in ability.ts Finance Center block
- `Payout`: uses `{ userId }` — both sellers and staff (`{ userId: sellerId }`)
- `Expense`, `FinancialReport`, `MileageEntry`: uses `{ userId }`
- `Listing`: uses `{ ownerUserId }` — NOT `{ sellerId }`
- `SellerProfile`: uses `{ userId }` — NOT `{ sellerId }`

## Recurring Errors

- `TypeError: db.select(...).from(...).where(...).limit is not a function` in checkout-finalize tests — mock chain ends at `.where()` but action calls `.limit(1)` for platformSetting queries. Fix: add `.limit` to the mock chain and use `mockReturnValueOnce`.
- Cross-test mock queue contamination when tests use `vi.resetModules()` + dynamic `import()` — always pair with `vi.resetAllMocks()` (not `vi.clearAllMocks()`).

## False Positives
<!-- Lint terms that look banned but are legitimate in context -->

## Escalation Outcomes
<!-- What the human decided when you escalated, so you can learn for next time -->

## Frequently Problematic Files
- `src/lib/actions/__tests__/checkout-finalize.test.ts` — needs per-call mock chains (`mockReturnValueOnce`) when the action has multiple sequential `db.select()` calls with different chain depths.
- `src/lib/actions/__tests__/price-alerts.test.ts` — mock contamination fixed by switching to `vi.resetAllMocks()`. Zod-first actions cause early exits that leave unconsumed queue entries.
- `src/lib/actions/reviews.ts` — EDIT_WINDOW_HOURS = 48, REVIEW_WINDOW_DAYS = 30. Tests must use 49h+ for "past edit window" and 30 days for solo visibility. `getReviewForOrder` in `src/lib/queries/review-for-order.ts` also uses EDIT_WINDOW_HOURS = 48.
- `src/lib/queries/buyer-reviews.ts` — EDIT_WINDOW_HOURS = 48. Test for hoursUntilEditExpires: 12h ago → 36h remaining (not 12h). Test for past-window: must use 49h+ ago.
- `src/lib/commerce/review-visibility.ts` — EDIT_WINDOW_HOURS = 48 (both reviews: visibleAt = max(createdAt) + 48h), SUBMIT_WINDOW_DAYS = 30 (solo review: visibleAt = deliveredAt + 30 days).
- `src/lib/actions/seller-response.ts` — check current EDIT_WINDOW_HOURS before writing tests. Do not assume 24h.
- `src/lib/commerce/local-fee.ts` — `getLocalTfRateBps` should be synchronous. If async and calling `getPlatformSetting`, tests get `null` from mock instead of `500`.
- `src/lib/notifications/__tests__/service.test.ts` — non-deterministic failures in full test run due to vi.resetModules() + shared mock state. Pre-existing issue, not introduced by fixes.

## Lint Script Notes
- `twicely-lint.sh` check [2/6] (Test Count) always shows "Could not parse" on Windows due to `grep -P` locale issue. Verify test results directly with `pnpm test --run`.
- File size check [5/6]: 12-15 pre-existing violations (all 300-506 lines). Per task instructions, do NOT attempt to fix — escalate.

## Payout CASL Condition: userId, not sellerId
- `can('read', 'Payout', { userId })` — payout table uses `userId` as ownership column, NOT `sellerId`
- Tests: `sub('Payout', { userId: session.userId })` not `{ sellerId: session.sellerId }`

## authorize.ts: sellerId = user.id for sellers (no DB lookup)
- `sellerId = user.isSeller ? user.id : null` — direct assignment, no sellerProfile query
- `session.sellerId` equals `session.userId` for sellers

## Staff Listing CASL: ownerUserId, not sellerId
- `can('read'/'update'/'delete', 'Listing', { ownerUserId: sellerId })` in defineStaffAbilities
- Tests: `sub('Listing', { ownerUserId: session.onBehalfOfSellerId })`

## Staff SellerProfile CASL: userId, not sellerId
- `can('read'/'update', 'SellerProfile', { userId: sellerId })` in defineStaffAbilities
- Tests: `sub('SellerProfile', { userId: session.onBehalfOfSellerId })`

## financeSubscription.pendingTier is text (not financeTierEnum)
- Query layer cast: `financeSub?.pendingTier as 'FREE' | 'PRO' | null`

## bundleSubscription: no canceledAt, no trialEndsAt columns per spec §3.5

## noUncheckedIndexedAccess: Record<string, T> access returns T | undefined
- `(CONFIG[key] ?? CONFIG['FALLBACK'])!` — non-null assert the whole expression

## CASL Condition Key: Listing uses ownerUserId, not sellerId (after Phase A Fix 1.6)
- `can('manage', 'Listing', { ownerUserId: userId })` — NOT `{ sellerId }`
- Tests must use `sub('Listing', { ownerUserId: session.userId })` not `{ sellerId: session.sellerId }`
- Staff CASL rules for listings still use `{ sellerId }` (different field — the delegating seller's ID)
- Subscription after Fix 1.6: `can('manage', 'Subscription', { sellerId })` — bare `can('create', 'Subscription')` without subject returns false. Tests must use `sub('Subscription', { sellerId: session.sellerId })`

## Resolved Pre-existing Test Failures (now fixed)
These 10 tests were fixed by updating test assertions to match current implementation:
- `checkout-initiate.test.ts` — 4 failures fixed by mocking `@/lib/queries/platform-settings` directly
- `reviews.test.ts` — 1 failure fixed (25h → 49h for canEdit=false test with 48h window)
- `review-visibility.test.ts` — 3 failures fixed (24h → 48h, 14 days → 30 days)
- `buyer-reviews.test.ts` — 2 failures fixed (hoursRemaining: 12 → 36; 25h → 49h for past-window test)
Total passing after fix: 1378

## AC-Audit Streams 1+2 Complete State
- Stream 1+2 completed. `isBuyerBlocked`/`getBlockedBuyerCount` in `src/lib/queries/buyer-block.ts`.
- `updateEngagement` in `src/lib/actions/browsing-history-helpers.ts` (no `'use server'`).
- `getSellerPendingReviews` in `seller-response.ts` now takes no args; derives sellerId from session.
- `generateUniqueCertNumber` in `authentication.ts` has auth guard as first line.
- `getSellerProfileForUser`/`getStorefrontIdForOwner` removed from `storefront-pages-helpers.ts`.
  - `storefront-pages.ts` (actions) imports `getSellerProfile` from `@/lib/queries/seller` and `getStorefrontIdForOwner` from `@/lib/queries/storefront-pages`.
- Test mock paths updated: `offer-engine.test.ts` mocks `@/lib/queries/buyer-block` and `@/lib/actions/browsing-history-helpers`.

## Directory Move Without Bash (Stream 4 Pattern)
- Cannot rename/move directories without bash permission.
- Write new files at new paths (Write tool), update all link hrefs (Edit tool), document old directories for user to delete manually.
- Old files in deprecated directories retain old routes — expected, they are being deleted by the user.

## Zod Method Names (v4)
- Use `.nonnegative()` not `.nonneg()` — TypeScript TS2339 error if you use `.nonneg()`.
- Use `.positive()` for must-be-positive integers.
- `.cuid2()` is available on `z.string()` via the Zod v4 extension imported in the project.
- Tests using string IDs like `'listing-1'` will fail `z.string().cuid2()` validation. Replace with real cuid2 IDs (e.g., `'wnrw7r9n3j5h2wzb1fuz3knt'`) when Zod is added to actions.
- Tests asserting old error messages fail when Zod schema replaces manual validation. Use `.toContain()` with a substring of the Zod v4 message rather than exact match.
- `.min(1)` on array schemas rejects empty arrays — tests expecting `{ success: true, count: 0 }` for empty input must be updated to expect the validation error.

## Pre-existing Non-deterministic Failures
These test files fail intermittently in the full run due to module isolation issues. They are not regressions:
- `src/lib/notifications/__tests__/service.test.ts` — `creates IN_APP notification row` and `sends email when email channel enabled`
- `src/lib/actions/__tests__/storefront.test.ts` and `storefront-extended.test.ts` — time out (5000ms) when run together due to shared `vi.mock('@/lib/casl', ...)` factory with `vi.resetModules()`. Pass individually.
- `src/lib/actions/__tests__/storefront-pages.test.ts` and `storefront-pages-manage.test.ts` — also fail intermittently in full run for same reason. Pass individually.
- `src/lib/actions/__tests__/promotions-crud.test.ts`, `authentication-complete.test.ts`, `delegation-revoke-accept.test.ts` — intermittent failures due to contamination.
- Root cause: `vi.resetModules()` + dynamic `await import()` doesn't fully reset shared mock factory state between tests in the same run

## getSellerProfileIdByUserId mock pattern
**When:** Actions call `getSellerProfileIdByUserId(session.userId)` instead of using `session.sellerId` directly.
**Mock factory:** `vi.mock('@/lib/queries/subscriptions', () => ({ getSellerProfileIdByUserId: vi.fn().mockResolvedValue('sp_1') }))` — use the sellerProfileId value that matches FK references in your test data.
**"Seller profile not found" tests:** Need `mockGetSellerProfileId.mockResolvedValueOnce(null)` in the test body (the default factory value is truthy).
**"Belongs to different seller" tests:** Need `mockGetSellerProfileId.mockResolvedValueOnce('seller-other')` to make the ownership mismatch fire. The factory default matches the record's sellerId, so the check passes without an override.
**Files affected:** `change-subscription.ts`, `delegation.ts`, `manage-subscription.ts` — all call `getSellerProfileIdByUserId`. Test files for these must mock `@/lib/queries/subscriptions`.
**`sub` export also required:** When production code uses `import { authorize, sub } from '@/lib/casl'`, the test mock must export both. Pattern: `vi.mock('@/lib/casl', () => ({ authorize: vi.fn(), sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }) }))`.

## Return-type change on shared helper breaks test mock queues
**Class:** 2 (test failure)
**Root cause:** When a helper's return type changes (e.g., `string | undefined` → `{ id, maxShippingCents, sellerDeadline } | undefined`), all callers must update their destructuring. But tests are more fragile: adding a NEW `db.select()` call between two existing ones (e.g., for `orderNumber`) shifts every `mockReturnValueOnce` entry in the queue by one position. All happy-path tests need a new `mockSelectChain(...)` inserted at the correct position to match the new call sequence.
**Fix checklist:** (1) Update the helper's return type and return statement. (2) Update the caller to destructure the new shape. (3) For every happy-path test: insert `mockSelectChain([{ newField: 'value' }])` immediately after the mock for the previous select and before the next mock in sequence.
**Files affected:** `src/lib/commerce/create-quote.ts`, `src/lib/actions/shipping-quote.ts`, all 4 shipping-quote test files.

## S1/S2 security fix changes test assertions on ownership errors
**Class:** 7/spec compliance
**Pattern:** When ownership-check error messages are unified (not-found + wrong-owner → same generic error), tests that previously asserted `toContain('permission')` for the ownership case must be updated to `toContain('not found')`. The not-found tests that already used `toContain('not found')` stay the same.
**Example:** `'rejects seller submitting quote for another seller order'` → `toContain('not found')` (was `toContain('permission')`).

## Schema Field Migration Pattern (branding fields from sellerProfile → storefront)
**Task:** Move 9 branding fields from `sellerProfile` table to `storefront` table.
**Critical write order to avoid VS Code on-save linter reverting files:**
1. Write query files first (that READ branding fields) — they now read from `storefront` table. While `identity.ts` still has the fields, NO TypeScript errors exist.
2. Write action files (that WRITE branding fields) — they now write to `storefront` table.
3. Run `pnpm typecheck` to confirm 0 errors.
4. THEN write `identity.ts` to remove the migrated fields.
**Column name mappings to know:**
- `sellerProfile.socialLinks` → `storefront.socialLinksJson`
- `sellerProfile.defaultStoreView` → `storefront.defaultView`
- `sellerProfile.isStorePublished` → `storefront.isPublished`
**Consumer-facing interface keeps old names:** `StorefrontBranding` keeps `socialLinks`, `defaultStoreView`, `isStorePublished` — mapping happens in query layer.
**storefront-public.ts:** uses `innerJoin(storefront, ...)` to get branding in same query as seller profile.
**storefront-owner.ts:** uses existing two-query approach (sellerProfile first, then storefront as separate query).

## channelListingStatusEnum vs publishJobStatusEnum — QUEUED only valid for crossJob
- `channelListingStatusEnum` values: DRAFT, PUBLISHING, ACTIVE, PAUSED, SOLD, ENDED, DELISTING, DELISTED, ERROR, ORPHANED — NO QUEUED
- `publishJobStatusEnum` values: PENDING, QUEUED, IN_PROGRESS, COMPLETED, FAILED, CANCELED — QUEUED is valid here
- Install prompts may use QUEUED for channelProjection.status — always replace with PUBLISHING
- `channelProjection.status = 'QUEUED'` causes TS2367 (comparison), TS2322 (assignment), TS2769 (Drizzle overload)
- Test assertions on `projValues?.status` for projection inserts must use 'PUBLISHING' not 'QUEUED'

## TS2352 narrowed type cast through unknown in tests
- `result.data as Record<string, unknown>` fails when `result.data` is typed `SomeInterface | undefined`
- Fix: `result.data as unknown as Record<string, unknown>` — cast through unknown is the correct pattern when the original type has no index signature
- This is NOT `as any` — it's a valid double-cast for test assertions only

## Processor type widening in worker tests — jobType literal too narrow
- Worker tests typed as `((job: typeof MOCK_JOB_BASE) => ...)` where MOCK_JOB_BASE.data.jobType is `'CREATE' as const`
- Spread objects with `jobType: 'UPDATE' as const` or `'DELIST' as const` become TS2345 (argument not assignable)
- Fix: widen processor type annotation to use `jobType: string` instead of `typeof MOCK_JOB_BASE`

## Pre-existing failures as of F3.1 (not regressions)
- `src/lib/actions/__tests__/browsing-history.test.ts` — 6 failures (pre-existing)
- `src/lib/actions/__tests__/price-drop.test.ts` — 3 failures (pre-existing)
- `src/lib/actions/__tests__/watchlist.test.ts` — 10 failures (pre-existing)
- `src/lib/crosslister/__tests__/channel-registry.test.ts` — 1 failure (pre-existing)

## Extended patterns reference
See `patterns.md` for: Drizzle `as unknown as` test mock pattern, authorize() vs auth.api.getSession() session shape, empty stub test files, banned terms in it() descriptions, type assertion elimination, snapshotJson type guards, URL injection fix, HTML injection fix.
