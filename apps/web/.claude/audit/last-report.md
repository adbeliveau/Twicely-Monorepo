# Super Audit V2 Report
**Date:** 2026-04-01
**Mode:** full (re-run after security fixes)
**Commit:** 1f07b4a
**TypeScript:** PASS (0 errors, all 22 packages)

## Scorecard
| # | Stream | Method | PASS | WARN | BLOCK | Status |
|---|---|---|---|---|---|---|
| 1 | Routes & Pages | Agent | 15 | 1 | 0 | PASS |
| 2 | Auth & CASL | Agent | 154 | 1 | 2 | FAIL |
| 3 | Hardcoded Values | Agent | 575 | 1 | 0 | PASS |
| 4 | Navigation | Agent | 30 | 3 | 0 | PASS |
| 5 | Money & Terms | Shell | ALL | 0 | 0 | PASS |
| 6 | Schema | Agent | 145 | 0 | 0 | PASS |
| 7 | Wiring & Side Effects | Shell | ALL | 0 | 0 | PASS |
| 8 | Stripe & Payments | Shell | ALL | 0 | 0 | PASS |
| 9 | Code Hygiene | Shell | ALL | 0 | 0 | PASS |
| 10a | Smoke Tests | Shell | — | — | — | SKIP |
| 11 | Runtime Safety | Shell | ALL | 0 | 0 | PASS |
| **TOTAL** | | | | **6** | **2** | |

## Blockers (must fix)

### B-01: `getDealBadgeAction` has no auth check — deal-badge.ts:52
Server action with `'use server'` has no `authorize()` call. Accepts client-provided `listingContext` and `marketSummary` including `sellerId`, `priceCents`, `categoryId`. Calls `computeDealBadge` which reads from DB. Unauthenticated callers can probe deal-badge thresholds.
**Fix:** Add `authorize()` + `ability.can('read', 'Listing')` as first operation.

### B-02: `checkAuthOfferAction` has no auth check — auth-offer-check.ts:27
Server action with `'use server'` has no `authorize()` call. Calls `qualifiesForAuthOffer()` and `getAuthOfferConfig()` which expose internal platform threshold (`thresholdCents`) and buyer fee (`buyerFeeCents`) from `platform_settings`.
**Fix:** Add `authorize()` + `ability.can('read', 'Listing')` or `ability.can('read', 'Setting')` as first operation.

## Warnings (should fix)

### W-01: `getReliabilityDisplayAction` has authorize() but no ability.can() — local-reliability.ts:34
Auth present but no CASL gate. Exposes reliability tier, completion rate, suspension status for any userId.

### W-02: `/my/selling/settings/local` unreachable — no inbound navigation link
Page exists but no nav item or link points to it. Not in page registry.

### W-03: `return-fees.ts` — calculateRestockingFee() callable with hardcoded defaults
Lines 91-99: Function parameters have hardcoded defaults that bypass `getReturnFeeConfig()`. Production path is correct. Defaults match seed values.

### W-04: Navigation — 3 medium UX inconsistencies (from Stream 4)

### W-05: `financialProjection` TS property names diverge from spec — finance-center.ts:85-92
TS properties use `Cents` suffix but spec omits it. DB column names match spec. Cosmetic.

### W-06: `sellerScoreSnapshot.sellerProfileId` missing Drizzle FK — finance.ts:188

## Info (context only)

- **Routes:** 50+ hub pages built beyond registry scope. Registry needs update (~202 actual vs ~150 documented).
- **Auth:** 154/161 action files have auth. 150/161 have CASL gates after FP suppression.
- **Hardcoded:** ~575 platform_settings entries in seed. All fallbacks match seed values.
- **Schema:** 145 spec tables + ~17 additions = 162 total. 77 spec enums + 10 additions = 87 total.
- **Smoke:** Skipped (no dev server running).

## Security Fixes Verified (from this audit cycle)

All fixes from the previous round confirmed resolved:
1. `admin-policy-version.ts` — `ability.can('manage', 'Setting')` ✓
2. `phone-verification.ts` — `ability.can('update', sub('User', { id: session.userId }))` ✓
3. `watcher-offers.ts` — 3 actions with proper CASL gates ✓
4. `promo-codes-platform.ts` — `ability.can('read', 'PromoCode')` ✓
5. `geocode.ts` — `ability.can('read', 'SafeMeetupLocation')` on both actions ✓
6. `kb-feedback.ts` — `ability.can('read', 'KbArticle')` ✓
7. `review-visibility.ts` — fallback corrected to 24 (matches seed) ✓
8. `buyer-abilities.ts` — `can('read', 'PromoCode')` added ✓

## Suppressed (known false positives)
<details>
<summary>22 items suppressed</summary>

FP-003, FP-004, FP-010, FP-011, FP-021, FP-030, FP-031, FP-032, FP-062, FP-063, FP-064, FP-065, FP-067, FP-070, FP-071, FP-072, FP-073, FP-074, FP-075, FP-078, FP-079, FP-080, FP-082, FP-083, FP-085, FP-086, FP-087
</details>

## Comparison vs Last Audit

| Metric | Previous Audit | This Audit | Delta |
|--------|---------------|------------|-------|
| Blockers | 2 (PlatformConfig CASL, editWindowHours) | 2 (deal-badge, auth-offer-check) | 0 (different issues) |
| Warnings | 16 | 6 | -10 |
| CASL gaps fixed | — | 6 verified | +6 |

**Previous blockers RESOLVED:** PlatformConfig→Setting ✓, editWindowHours 48→24 ✓
**New blockers FOUND:** deal-badge.ts and auth-offer-check.ts (server actions with no auth)

## Verdict: NOT READY — 2 blockers remain
