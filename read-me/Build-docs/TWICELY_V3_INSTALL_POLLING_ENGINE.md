# TWICELY V3 — Install Prompt: Adaptive Polling Engine + crosslister.* Key Rename

## READ FIRST

Before writing any code, read these files in full:
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md` — §12 (sale detection), §13 (adaptive polling engine)
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_SCHEMA_v2_0_4.md` — channelProjection table, pollTierEnum
- `C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_DECISION_RATIONALE.md` — entries #95 and #96
- `C:\Users\XPS-15\Projects\Twicely\read-me\Build-docs\TWICELY_V3_INSTALL_CROSSLISTER_SCHEDULER_FIX.md` — existing rate-limiter and circuit breaker patterns to follow

---

## Context

Two things happen in this prompt:

1. **Key rename** — all `xlister.*` platform settings keys are renamed to `crosslister.*`. This is a find-and-replace across one seed file plus any code that reads those keys.
2. **Polling engine** — 4 new files implementing adaptive polling: budget tracking, tier promotion/demotion, scheduler (enqueue), and executor (run poll).

---

## Part 1 — Rename xlister.* → crosslister.*

### 1a. MODIFY — `src/lib/db/seed/v32-platform-settings.ts`

Find and replace all occurrences:

| Old key | New key |
|---------|---------|
| `xlister.publishes.FREE` | `crosslister.publishes.FREE` |
| `xlister.publishes.LITE` | `crosslister.publishes.LITE` |
| `xlister.publishes.PRO` | `crosslister.publishes.PRO` |
| `xlister.pricing.lite.annualCents` | `crosslister.pricing.lite.annualCents` |
| `xlister.pricing.lite.monthlyCents` | `crosslister.pricing.lite.monthlyCents` |
| `xlister.pricing.pro.annualCents` | `crosslister.pricing.pro.annualCents` |
| `xlister.pricing.pro.monthlyCents` | `crosslister.pricing.pro.monthlyCents` |
| `xlister.aiCredits.LITE` | `crosslister.aiCredits.LITE` |
| `xlister.aiCredits.PRO` | `crosslister.aiCredits.PRO` |
| `xlister.bgRemovals.LITE` | `crosslister.bgRemovals.LITE` |
| `xlister.bgRemovals.PRO` | `crosslister.bgRemovals.PRO` |
| `xlister.rolloverDays` | `crosslister.rolloverDays` |
| `xlister.rolloverMaxMultiplier` | `crosslister.rolloverMaxMultiplier` |
| `xlister.freeTierMonths` | `crosslister.freeTierMonths` |

Also update the `value` for `crosslister.publishes.FREE` to `5` (was 25, updated in prior session to 0 — correct value is now 5 per Decision Rationale #93).

### 1b. GREP AND FIX — All code reading xlister.* keys

```bash
grep -rn "xlister\." src/ --include="*.ts" --include="*.tsx"
```

For every file that reads a `xlister.*` key via `getPlatformSetting()`, update the key string to `crosslister.*`. These are runtime reads — the key string in the code must match the seed.

### 1c. ADD — Polling settings to `src/lib/db/seed/v32-platform-settings.ts`

Add the following entries in the `crosslister` category section:

```typescript
// Polling intervals (Decision Rationale #96)
{ key: 'crosslister.polling.hot.intervalMs', value: 90000, type: 'number', category: 'crosslister', description: 'HOT polling interval in ms (90 seconds)' },
{ key: 'crosslister.polling.warm.intervalMs', value: 600000, type: 'number', category: 'crosslister', description: 'WARM polling interval in ms (10 minutes)' },
{ key: 'crosslister.polling.cold.intervalMs', value: 2700000, type: 'number', category: 'crosslister', description: 'COLD polling interval in ms (45 minutes)' },
{ key: 'crosslister.polling.longtail.intervalMs', value: 14400000, type: 'number', category: 'crosslister', description: 'LONGTAIL polling interval in ms (4 hours)' },

// Polling budget per ListerTier (Decision Rationale #96)
{ key: 'crosslister.polling.budget.NONE', value: 10, type: 'number', category: 'crosslister', description: 'Polls/hr for NONE tier (import projections only, sale detection minimum)' },
{ key: 'crosslister.polling.budget.FREE', value: 20, type: 'number', category: 'crosslister', description: 'Polls/hr for FREE tier (5 active projections max)' },
{ key: 'crosslister.polling.budget.LITE', value: 200, type: 'number', category: 'crosslister', description: 'Polls/hr for LITE tier' },
{ key: 'crosslister.polling.budget.PRO', value: 1000, type: 'number', category: 'crosslister', description: 'Polls/hr for PRO tier' },

// HOT decay and double-sell (Decision Rationale #96)
{ key: 'crosslister.polling.hotDecayDwellMs', value: 1800000, type: 'number', category: 'crosslister', description: 'WARM dwell time after HOT expires before returning to previous tier (30 min)' },
{ key: 'crosslister.polling.doubleSellThreshold', value: 0.02, type: 'number', category: 'crosslister', description: 'Double-sell rate threshold that triggers HOT elevation for all seller projections' },
{ key: 'crosslister.polling.doubleSellReleaseRate', value: 0.01, type: 'number', category: 'crosslister', description: 'Rate must drop below this for doubleSellReleaseDays before HOT is released' },
{ key: 'crosslister.polling.doubleSellReleaseDays', value: 7, type: 'number', category: 'crosslister', description: 'Consecutive days below doubleSellReleaseRate before forced HOT is released' },
```

---

## Part 2 — Schema Migration

### 2a. CREATE — `src/lib/db/migrations/XXXX_add_poll_columns_to_channel_projection.sql`

```sql
ALTER TABLE channel_projection
  ADD COLUMN poll_tier poll_tier NOT NULL DEFAULT 'COLD',
  ADD COLUMN next_poll_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN last_polled_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX cp_next_poll_idx ON channel_projection (next_poll_at)
  WHERE status = 'ACTIVE' AND next_poll_at IS NOT NULL;

COMMENT ON COLUMN channel_projection.poll_tier IS 'Current polling tier: HOT/WARM/COLD/LONGTAIL';
COMMENT ON COLUMN channel_projection.next_poll_at IS 'When this projection should next be polled. NULL = not yet scheduled.';
COMMENT ON COLUMN channel_projection.last_polled_at IS 'When this projection was last polled.';
```

### 2b. MODIFY — `src/lib/db/schema/crosslister.ts`

Add three columns to the `channelProjection` Drizzle table definition after `lastPublishError`:

```typescript
pollTier:     pollTierEnum('poll_tier').notNull().default('COLD'),
nextPollAt:   timestamp('next_poll_at', { withTimezone: true }),
lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
```

`pollTierEnum` already exists in this file — do not redefine it.

---

## Part 3 — Polling Engine (4 files)

### 3a. CREATE — `src/lib/crosslister/polling/poll-budget.ts`

Tracks polls consumed per seller per hour. Gates whether a poll job can execute.

**Exports:**
- `canPoll(sellerId: string, listerTier: string): Promise<boolean>` — checks if seller has remaining budget this hour
- `recordPoll(sellerId: string): Promise<void>` — increments seller's poll count for this hour
- `resetAllPollBudgets(): void` — for testing only

**Rules:**
- Budget key: `crosslister.polling.budget.{TIER}` (read from platform settings, 5-min cache)
- Count window: 1 hour, tracked in-memory with `Map<sellerId, { count: number; windowStart: number }>`
- If `Date.now() - windowStart > 3600000` → reset count to 0, set new windowStart
- NONE tier uses `crosslister.polling.budget.NONE` (10 polls/hr)
- If `getPlatformSetting` returns 0 → no polling allowed for that tier

### 3b. CREATE — `src/lib/crosslister/polling/poll-tier-manager.ts`

Handles promotion and demotion of `pollTier` on `channelProjection`. Called by poll-executor after each poll result and by event handlers when activity signals arrive.

**Exports:**
- `promoteTier(projectionId: string, signal: PollSignal): Promise<void>`
- `demoteTier(projectionId: string): Promise<void>` — called by scheduler when no activity
- `scheduleNextPoll(projectionId: string, tier: PollTierEnum): Promise<void>` — writes `nextPollAt` based on tier interval
- `applyDoubleSellElevation(sellerId: string): Promise<void>` — elevates ALL seller projections to HOT

**PollSignal type:**
```typescript
type PollSignal =
  | 'WATCHER_ADDED'     // HOT for 1 hour
  | 'OFFER_RECEIVED'    // HOT for 2 hours
  | 'PRICE_CHANGED'     // WARM for 30 min
  | 'SALE_DETECTED'     // HOT until delisted (nextPollAt = null until delist confirmed)
```

**HOT decay rule (Decision Rationale #96):**
When a HOT timer expires:
1. Check what tier the listing was at BEFORE the HOT promotion (store as `prePollTier` on projection — see note below)
2. Set tier → WARM, schedule WARM dwell (30 min via `crosslister.polling.hotDecayDwellMs`)
3. After WARM dwell: set tier → `prePollTier` (COLD or LONGTAIL)

**Note:** This requires a `prePollTier` column on `channelProjection`. Add it to the migration:
```sql
ADD COLUMN pre_poll_tier poll_tier DEFAULT NULL;
```
And to the Drizzle schema:
```typescript
prePollTier: pollTierEnum('pre_poll_tier'),
```
This stores the tier before a HOT promotion so we can return to it correctly.

**Demotion rules (from Lister Canonical §13.3):**
- `lastPolledAt` older than 7 days with no signal → COLD
- `lastPolledAt` older than 30 days with no signal → LONGTAIL

### 3c. CREATE — `src/lib/crosslister/polling/poll-scheduler.ts`

Runs on a schedule (wired into `worker-init.ts`, every 60 seconds). Finds projections due for polling and enqueues POLL jobs.

**Exports:**
- `runPollSchedulerTick(): Promise<void>` — main tick, called by setInterval in worker-init
- `getPollSchedulerHealth(): { lastTickAt: string | null; lastTickDurationMs: number | null; jobsEnqueuedLastTick: number }` — admin health

**Query:**
```sql
SELECT cp.*, sp.listerTier
FROM channel_projection cp
JOIN listing l ON l.id = cp.listing_id
JOIN seller_profile sp ON sp.user_id = l.seller_id
WHERE cp.status = 'ACTIVE'
  AND cp.next_poll_at IS NOT NULL
  AND cp.next_poll_at <= now()
ORDER BY cp.next_poll_at ASC
LIMIT 100
```

**Per projection, before enqueuing:**
1. Check `canPoll(sellerId, listerTier)` → if false, skip (budget exhausted)
2. Check `cbCanDispatch(channel)` → if false, skip (circuit breaker OPEN)
3. Skip if `channel IN ('EBAY', 'ETSY') AND pollTier IN ('HOT', 'WARM')` (webhooks are primary per §13.5)
4. Enqueue `POLL` job to `lister:polling` BullMQ queue
5. Call `recordPoll(sellerId)` to consume budget

**Admin route:** `src/app/api/hub/crosslister/poll-scheduler-health/route.ts`
- GET — returns `getPollSchedulerHealth()`, protected by `staffAuthorize()`

### 3d. CREATE — `src/lib/crosslister/polling/poll-executor.ts`

Executes a single POLL job. Called by the `lister:polling` BullMQ worker.

**Exports:**
- `executePoll(crossJobId: string): Promise<PollResult>`

**PollResult type:**
```typescript
type PollResult =
  | { outcome: 'NO_CHANGE' }
  | { outcome: 'SALE_DETECTED'; externalOrderId: string }
  | { outcome: 'STATUS_CHANGED'; newStatus: string }
  | { outcome: 'ERROR'; error: string; retryable: boolean }
```

**Flow:**
1. Load `crossJob` by ID — get `projectionId`, `channel`, `sellerId`
2. Load `channelProjection` — verify `status = 'ACTIVE'`, get `externalId`
3. Load connector via `getConnector(channel)`
4. Call `connector.getListingStatus(accountRow, externalId)`
5. Handle result:
   - **ACTIVE** → `promoteTier` not needed, update `lastPolledAt`, call `scheduleNextPoll` with current tier
   - **SOLD** → call sale detection pipeline (enqueue `EMERGENCY_DELIST`), call `recordSuccess(channel)` on circuit breaker
   - **ENDED/DELISTED** → update projection status, notify seller via Centrifugo
   - **ERROR** → call `recordFailure(channel)` on circuit breaker, schedule retry with backoff
6. Update `crossJob.status = 'COMPLETED'` or `'FAILED'`

**Rules:**
- Never throw. Catch all errors, return `{ outcome: 'ERROR', ... }`
- Call `recordSuccess(channel)` on any non-error outcome
- Call `recordFailure(channel)` only on connector/API errors (not on SOLD/ENDED outcomes)

### 3e. MODIFY — `src/lib/crosslister/queue/worker-init.ts`

Add poll scheduler tick alongside the existing scheduler loop:

```typescript
import { runPollSchedulerTick } from '../polling/poll-scheduler';

// After startSchedulerLoop():
let pollSchedulerInterval: ReturnType<typeof setInterval> | null = null;
pollSchedulerInterval = setInterval(() => { void runPollSchedulerTick(); }, 60_000);

// In shutdown handler:
if (pollSchedulerInterval) clearInterval(pollSchedulerInterval);
```

---

## Part 4 — Tests

### 4a. CREATE — `src/lib/crosslister/polling/__tests__/poll-budget.test.ts`

Minimum 8 tests:
1. `canPoll` returns true when under budget
2. `canPoll` returns false when budget exhausted
3. `recordPoll` increments count
4. Budget window resets after 1 hour
5. NONE tier uses budget of 10
6. PRO tier uses budget of 1000
7. Budget 0 → `canPoll` always false
8. `resetAllPollBudgets` clears all counts

### 4b. CREATE — `src/lib/crosslister/polling/__tests__/poll-tier-manager.test.ts`

Minimum 10 tests:
1. `WATCHER_ADDED` signal → promotes to HOT, stores prePollTier
2. `OFFER_RECEIVED` signal → promotes to HOT for 2 hours
3. `PRICE_CHANGED` signal → promotes to WARM for 30 min
4. HOT decay → steps through WARM before returning to prePollTier COLD
5. HOT decay → steps through WARM before returning to prePollTier LONGTAIL
6. `demoteTier` after 7 days inactivity → COLD
7. `demoteTier` after 30 days inactivity → LONGTAIL
8. `scheduleNextPoll` sets correct `nextPollAt` for each tier
9. `applyDoubleSellElevation` elevates all seller projections to HOT
10. SALE_DETECTED signal → sets pollTier HOT, nextPollAt null

### 4c. CREATE — `src/lib/crosslister/polling/__tests__/poll-scheduler.test.ts`

Minimum 9 tests:
1. Projections with `nextPollAt < now()` are enqueued
2. Projections with `nextPollAt > now()` are skipped
3. Projections with `status != ACTIVE` are skipped
4. Seller over budget → projection skipped
5. Circuit breaker OPEN → projection skipped
6. eBay HOT projection → skipped (webhook primary)
7. eBay COLD projection → NOT skipped (safety net)
8. Tick processes max 100 projections per run
9. `getPollSchedulerHealth` returns correct state after tick

### 4d. CREATE — `src/lib/crosslister/polling/__tests__/poll-executor.test.ts`

Minimum 11 tests:
1. ACTIVE result → updates `lastPolledAt`, schedules next poll
2. SOLD result → enqueues EMERGENCY_DELIST job
3. ENDED result → updates projection status
4. ERROR result (retryable) → recordFailure, schedule retry
5. ERROR result (non-retryable) → recordFailure, mark FAILED
6. Non-ACTIVE projection → returns early without calling connector
7. Missing connector → returns ERROR gracefully
8. Circuit breaker: ACTIVE outcome calls `recordSuccess`
9. Circuit breaker: connector error calls `recordFailure`
10. `crossJob.status` set to COMPLETED on success
11. `crossJob.status` set to FAILED on non-retryable error

---

## Verification Checklist

```bash
# 1. No xlister.* keys remain in seed or code
grep -rn "xlister\." src/ --include="*.ts" --include="*.tsx"
# Expected: 0 results

# 2. TypeScript
npx tsc --noEmit 2>&1 | head -20
# Expected: no output (0 errors)

# 3. Tests
npx vitest run 2>&1 | tail -5
# Expected: 3371+ passing (was 3333, +38 minimum: 8+10+9+11)

# 4. Poll columns in schema
grep -n "pollTier\|nextPollAt\|lastPolledAt\|prePollTier" src/lib/db/schema/crosslister.ts
# Expected: 4 lines

# 5. Polling settings seeded
grep -n "crosslister.polling" src/lib/db/seed/v32-platform-settings.ts | wc -l
# Expected: 11

# 6. Poll scheduler wired in worker-init
grep -n "runPollSchedulerTick\|pollSchedulerInterval" src/lib/crosslister/queue/worker-init.ts
# Expected: 2+ lines

# 7. Admin route exists
ls src/app/api/hub/crosslister/poll-scheduler-health/route.ts
# Expected: file exists

# 8. No xlister in Stripe product map
grep -rn "xlister" src/ --include="*.ts"
# Expected: 0 results
```

---

## Rules

- No hardcoded intervals or budget values — all read from `getPlatformSetting()` with appropriate cache TTL
- No polling projections where `status != 'ACTIVE'`
- eBay and Etsy: HOT/WARM polling forbidden (webhooks are primary per §13.5)
- Circuit breaker must be checked before every poll dispatch
- `canPoll()` must be checked before every poll dispatch
- TypeScript strict: true. Zero `as any`. Zero `@ts-ignore`
- 300 lines max per file. Split if needed.
- Tests must increase. Minimum 3371 after this prompt.

---

## Expected Output

```
xlister.* keys remaining: 0 ✅
TypeScript: 0 errors ✅
Tests: 3371+ passing (was 3333, +38 minimum) ✅
Poll columns in schema: 4 ✅
Polling settings seeded: 11 ✅
Poll scheduler wired in worker-init ✅
Admin health route: exists ✅
```
