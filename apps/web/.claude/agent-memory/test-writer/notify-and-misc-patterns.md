---
name: Notify mock and miscellaneous patterns
description: notify mock hoisting, makeInsertSequence, key architecture facts for testing
type: feedback
---

## notify mock with vi.hoisted — prevents vi.clearAllMocks() breakage

When a module calls `promise.catch(() => {})` on the notify result, `vi.clearAllMocks()` is safe ONLY if you re-apply `mockResolvedValue(undefined)` in beforeEach. Use vi.hoisted to declare the mock and re-apply in beforeEach:

```typescript
const mockNotify = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/lib/notifications/service', () => ({ notify: mockNotify }));
// In beforeEach:
mockNotify.mockResolvedValue(undefined);
```

Do NOT use `vi.resetAllMocks()` when other mocks like `getPlatformSetting` need their implementations preserved.

## makeInsertSequence for two-insert actions (code + audit)

```typescript
function makeInsertSequence(row: Record<string, unknown>) {
  mockInsert
    .mockReturnValueOnce({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([row]) }) } as never)
    .mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) } as never);
}
```

## affiliate-commission-admin.ts: getPlatformSetting required for INFLUENCER tier checks

The INFLUENCER min/max BPS bounds are read from platform settings, not hardcoded. Tests MUST mock `getPlatformSetting` for INFLUENCER path tests:

```typescript
function mockInfluencerPlatformSettings() {
  mockGetPlatformSetting
    .mockResolvedValueOnce(2000)  // affiliate.influencer.minCommissionRateBps
    .mockResolvedValueOnce(3000); // affiliate.influencer.maxCommissionRateBps
}
```

Without this, `getPlatformSetting` returns `undefined` after `vi.resetAllMocks()`, the check `data.commissionRateBps < undefined` is false, and the rate error never fires.

Also: the error message is a template literal using the actual min/max from settings — assert with `toContain()` not `toEqual()`.

The COMMUNITY path also calls `getPlatformSetting` once (for the default rate used in deviation tracking).

Use `vi.hoisted()` for mock functions when the test file uses static imports (not dynamic import + vi.resetModules()). Dynamic import pattern avoids hoisting issues but vi.hoisted() + static import is cleaner.

## Key Architecture Facts

- `rollover-manager.ts` plain TS module (not 'use server'); called by publish-meter + webhooks
- `checkout-webhooks.ts` not 'use server'; called from API route after Stripe verification
- `lister-downgrade-warnings.ts` has circular import with `subscription-engine.ts` — mock price-map to avoid issues
- `forfeitExcessRollover` orders DESC (newest first), keeps newest, forfeits oldest
- `consumeCredits` is inside `db.transaction()` — mock tx.select and tx.update separately
- `getAvailableCredits` select ends at `.orderBy()` (no `.limit()`) — requires thenable pattern
- `checkout-webhooks` innerJoin: select chain must include `innerJoin` method
- `meterColor` at exactly 75%: returns GREEN (condition is `>75` not `>=75`)

## Promise.all with shared mockReturnValueOnce queues — avoid shared DB mocks

When testing aggregator functions that use `Promise.all([checkA, checkB, checkC])` where each sub-check makes DB calls, `mockReturnValueOnce` queues are consumed in the order microtasks resolve — which is non-deterministic across concurrent promises.

**Pattern 1 (isolation):** Set `mockReturnValue` (non-queued) default before `mockReturnValueOnce` overrides. The default handles any call that falls through after the queue is exhausted.

**Pattern 2 (spies):** Use `vi.spyOn(module, 'checkA').mockResolvedValue(...)` — but ONLY works if sub-functions are exported and the aggregator calls them via the module namespace. If the aggregator calls them directly in the same scope (not via export), spying won't intercept.

**Pattern 3 (threshold tricks):** Set all thresholds to 999 (or very high) so nothing flags regardless of row data. Then for the specific check you want to flag, set threshold to 1 and return a single valid row via default `mockReturnValue`. Pros: deterministic. Cons: other checks might accidentally match the same row data.

**Bottom line:** Test individual checks (checkRapidChurn, checkBotTraffic, checkGeoAnomaly) in isolation, and test the aggregator's enabled-flag and NONE result. Testing the aggregator's highestOf logic when multiple checks fire is best done with threshold tricks or by testing it at the types level (`highestOf` unit tests).

## G3.7 Vacation Mode — coverage pattern

`vacation.ts` exports 3 actions: `activateVacation`, `deactivateVacation`, `adminForceDeactivateVacation`. All three are in the SAME file, so use `vi.resetModules()` + dynamic imports in `beforeEach`.

Key gaps to cover when reviewing generated tests:
- `deactivateVacation` has a CASL check — must have a test where `ability.can()` returns false
- `activateVacation` CUSTOM mode uses `maxPauseDays` (same as PAUSE_SALES) not `maxAllowSalesDays`
- `vacation-cron.ts`'s `processVacationAutoEnd` is a separate file — needs its own test in `commerce/__tests__/`
- Schema uses `.strict()` — extra fields test is required for each schema in validation tests
- `adminForceDeactivateVacationSchema.sellerId` uses `.cuid2()` — test with a real-format CUID2 string

Split strategy used: actions/vacation.test.ts (base) + vacation-edge-cases.test.ts (supplemental edge cases) + validations/vacation.test.ts (Zod) + commerce/vacation-cron.test.ts (cron)

## G4.2 enforcement-appeals.ts: uses `authorize()` NOT `auth.api.getSession`

`submitEnforcementAppealAction` uses `authorize()` from `@/lib/casl/authorize` directly (not `auth.api.getSession` via next/headers). Mock correctly:

```typescript
vi.mock('@/lib/casl/authorize', () => ({ authorize: vi.fn() }));
// Session shape: { userId: string, email: string, isSeller: boolean }
// Null session = { session: null, ability: { can: vi.fn() } }
```

The `authorize()` function does `db.select().from().innerJoin()` internally for delegation lookup. If you mock `@/lib/auth/server` instead of `@/lib/casl/authorize`, the delegation query in `authorize.ts` will fail with "innerJoin is not a function" because `db.select` mock returns a plain chain without `innerJoin`.

Also: `enforcement-appeals.ts` fetches `maxAppealsPerAction` platform setting but the current implementation does NOT use it — `existingAction.appealedAt !== null` is an unconditional check. Do not write tests that expect `maxAppeals=0` to bypass the check.

`reviewEnforcementAppealAction` correctly uses `staffAuthorize` (no change needed there).

## Drizzle query chain — thenable pattern for queries without .limit()

Some Drizzle queries end at `.where()` with no `.limit()` call (bare SELECT aggregations). The standard `makeSelectChain` that resolves at `.limit()` will fail with "(intermediate value) is not iterable".

Use the thenable proxy pattern that resolves at any terminal point:

```typescript
function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  ['from', 'where', 'groupBy', 'limit', 'orderBy', 'innerJoin'].forEach((k) => {
    chain[k] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}
```

This was needed in `form-1099nec-generator.test.ts` — the commission sum query uses `const [totals] = await db.select(...).from(...).where(...)` with no `.limit()`.

## encryption.ts — static imports work fine (env var read lazily per-call)

`getKey()` reads `process.env.ENCRYPTION_KEY` on every call, so static `import { encrypt, decrypt } from '@/lib/encryption'` works correctly with `beforeEach(() => { process.env.ENCRYPTION_KEY = VALID_KEY; })`. No dynamic imports or `vi.resetModules()` needed.
