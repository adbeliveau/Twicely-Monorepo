---
name: G4.1 Seller Score — Test Patterns
description: Mock setup and edge-case insights for seller score recalc tests
type: project
---

## G4.1 Seller Score Test Patterns

### File locations
- `src/lib/scoring/__tests__/calculate-seller-score.test.ts` — pure function tests (existing)
- `src/lib/scoring/__tests__/calculate-seller-score-edge.test.ts` — edge cases (new)
- `src/lib/scoring/__tests__/metric-queries.test.ts` — DB query tests (existing, 2 PRE-EXISTING failures for getPrimaryFeeBucket groupBy)
- `src/lib/jobs/__tests__/seller-score-recalc.test.ts` — BullMQ job tests (existing)
- `src/lib/jobs/__tests__/seller-score-recalc-helpers.test.ts` — determineEffectiveBand (new)
- `src/lib/jobs/__tests__/seller-score-recalc-enforcement.test.ts` — runAutoEnforcement + notifications (new)

### Pre-existing failures
`metric-queries.test.ts > getPrimaryFeeBucket` — 2 tests fail: `.groupBy is not a function` on the mock chain. This was failing BEFORE G4.1 tests were added (verified with git stash).

### determineEffectiveBand behavior — warning lockout interaction with grace
The warning lockout caps `band` to ESTABLISHED. But if `currentBand > ESTABLISHED`, the grace period logic then runs (ESTABLISHED < currentBand is a downgrade). When grace is not satisfied, the function returns `currentBand` — effectively neutralizing the warning lockout for sellers who are still in grace. This is the actual implementation behavior. Test it as "holds currentBand" not "caps to ESTABLISHED".

**Why:** To confirm the spec vs implementation divergence and document actual code behavior.

### clearAllMocks vs resetAllMocks for recalc-helpers tests
Use `vi.clearAllMocks()` (not `vi.resetAllMocks()`) in beforeEach for test files that use `vi.hoisted` to set `getPlatformSetting` with a default implementation. `vi.resetAllMocks()` wipes implementations and `Number(undefined) = NaN`, breaking `loadEnforcementSettings` tests.

**How to apply:** Use `vi.clearAllMocks()` when mocks need to retain their fallback implementations across tests. Use `vi.resetAllMocks()` only when you need mockReturnValueOnce queues cleared.

### runAutoEnforcement threshold boundaries (spec §6.1)
```
score < 100  → PRE_SUSPENSION
score < 250  → RESTRICTION
score < 400  → WARNING (sets warningExpiresAt)
score < 550  → COACHING
else         → null (clears enforcement)
```
PRE_SUSPENSION has no notification template (not in templateMap). No `enforcement.pre_suspension` notify call.
Clearing (null level) does NOT insert into `enforcementAction` table.
