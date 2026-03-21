---
name: advanced-mock-patterns
description: Advanced Vitest mock patterns for Twicely — Zod edge cases, transaction mocks, vi.hoisted rules, G3/G4/G6 specific patterns
type: reference
---

## Zod regex+transform ordering

When a Zod schema has `.regex()` BEFORE `.transform()`, lowercase input FAILS the regex — the transform never runs. The schema `codeField = z.string().min(4).max(20).regex(/^[A-Z0-9-]+$/).transform(toUpperCase)` requires uppercase INPUT. Test this as "rejects lowercase" not "uppercases via transform".

`applyPromoCodeSchema.code` has NO regex (just min/max/transform) — lowercase input IS valid there.

## vi.hoisted rule — ALL mocks in multi-describe files using resetAllMocks

A static `vi.mock(() => ({ fn: vi.fn() }))` will be reset to undefined by `vi.resetAllMocks()` in `beforeEach`. Always use `vi.hoisted()` for all mocks in multi-describe files that use `resetAllMocks`. Example: G3.6 listing-click route calls `checkSelfReferralByIp`, `escalateAffiliate`, AND `getPlatformSetting` — all hoisted.

## G3.3 affiliate-payout-service: db.transaction with tx.update AND tx.insert

When a service uses `db.transaction(async (tx) => { tx.update(...); tx.insert(...); })`, hoist separate `mockTxUpdate` and `mockTxInsert`. See notify-and-misc-patterns.md for Promise.all interleaving patterns (G3.5).

## G4 enforcement actions

WARNING/COACHING/PRE_SUSPENSION all call `db.update(sellerProfile)` — tests for these must mock `mockDbUpdate` or they'll throw. SUSPENSION/RESTRICTION also update sellerProfile. LISTING_REMOVAL/SUPPRESSION do NOT update listing in implementation (deliberate design — comment in action file explains why).

See [g4-seller-score-patterns.md](g4-seller-score-patterns.md) for G4.1 seller score test patterns, pre-existing failures, and warning lockout + grace period interaction.

## G6 Identity Verification patterns

- `handleVerificationWebhook` verified event: updates BOTH `identityVerification` AND `sellerProfile` — two `db.update()` calls. Mock with two separate `makeUpdateChain()` objects using `mockReturnValueOnce`.
- `isEnhancedVerificationRequired`: calls `getActiveVerification` (one select) then `sellerProfile` lookup (second select) for non-VERIFIED records. Mock with 2 `mockReturnValueOnce` calls.
- `@/lib/queries/platform-settings` mock path (absolute) is correct for query tests. Relative `./platform-settings` does NOT resolve to the same module from `__tests__/` subdirectory.
- `getRetentionDashboard` calls BOTH `getPlatformSettingsByPrefix('retention.')` AND `getPlatformSettingsByPrefix('gdpr.')` — mock must return a Map. Use `restoreMocks()` helper to re-set after `vi.resetAllMocks()` clears the `vi.mock()` factory return values.

## notify-and-misc patterns

See [notify-and-misc-patterns.md](notify-and-misc-patterns.md) for: notify mock pattern, makeInsertSequence, and key architecture facts.

See [upload-route-patterns.md](upload-route-patterns.md) for /api/upload route testing: rate limit contamination fix, hoisted mock setup, meetup-photo position calculation.
