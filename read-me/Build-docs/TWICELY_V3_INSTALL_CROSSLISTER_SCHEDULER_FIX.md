# TWICELY V3 — Crosslister Scheduler Fix Prompts
# Two prompts in sequence. Prompt 1 fixes correctness bugs. Prompt 2 builds missing architecture.
# Date: 2026-03-07
# Source: Lister Canonical §8.1–§8.5, §23.2

---

## PROMPT 1: Crosslister Correctness Fixes (3 bugs)

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md
  Focus: §8.3 Rate Limiting Per Platform, §8.4 Scheduling Algorithm, §8.5 Burst Protection, §23.2 Rate Limit Overrides
- src\lib\crosslister\queue\rate-limiter.ts         (read entire file)
- src\lib\crosslister\channel-registry.ts           (read entire file)
- src\lib\crosslister\services\publish-service.ts   (read entire file)
- src\lib\crosslister\queue\lister-queue.ts         (read entire file)
- src\lib\db\seed\seed-crosslister.ts               (read entire file)
- src\lib\db\schema\crosslister.ts                  (read entire file)

CONTEXT:
Audit identified three correctness bugs in the crosslister. None require new architecture.
All three are precise fixes to existing files. Do NOT rewrite anything beyond what is specified.

---

### BUG 1: Rate limits read from hardcoded channel-registry instead of platform settings

PROBLEM:
rate-limiter.ts reads callsPerHourPerSeller from channel-registry.ts at startup.
seed-crosslister.ts correctly seeds all 8 platform rate limit settings in the DB.
But the rate limiter never reads the DB — admin changes to those settings have zero effect.
This violates Lister Canonical §23.2: "Admins can adjust rate limits per platform without code deployment."

FIX:
Update rate-limiter.ts to read rate limits from platform_settings at runtime, not from channel-registry.
The channel-registry values become the fallback defaults ONLY when the DB setting is missing or unparseable.

Implementation:
1. In rate-limiter.ts, add a function getRateLimitForChannel(channel: ExternalChannel): Promise<number>
   - Query platform_settings for key: `crosslister.rateLimit.{channelLower}.callsPerHourPerSeller`
     where channelLower is the channel enum value lowercased
     e.g. EBAY → 'crosslister.rateLimit.ebay.callsPerHourPerSeller'
     e.g. FB_MARKETPLACE → 'crosslister.rateLimit.fbMarketplace.callsPerHourPerSeller'
   - Parse the result as a positive integer
   - If the DB key is missing or invalid: fall back to the channel-registry default value
   - Cache the result for 60 seconds in a Map<string, {value: number, expiresAt: number}>
     to avoid a DB query on every rate limit check
   - Never throw — always return a valid positive integer

2. Update all call sites in rate-limiter.ts that currently read
   meta.rateLimit.callsPerHourPerSeller to call getRateLimitForChannel(channel) instead.

3. Channel name → settings key mapping (must be exact — these match seed-crosslister.ts):
   EBAY          → crosslister.rateLimit.ebay.callsPerHourPerSeller
   POSHMARK      → crosslister.rateLimit.poshmark.callsPerHourPerSeller
   MERCARI       → crosslister.rateLimit.mercari.callsPerHourPerSeller
   DEPOP         → crosslister.rateLimit.depop.callsPerHourPerSeller
   ETSY          → crosslister.rateLimit.etsy.callsPerHourPerSeller
   FB_MARKETPLACE → crosslister.rateLimit.fbMarketplace.callsPerHourPerSeller
   GRAILED       → crosslister.rateLimit.grailed.callsPerHourPerSeller
   THEREALREAL   → crosslister.rateLimit.therealreal.callsPerHourPerSeller

4. Do NOT remove the values from channel-registry.ts — they remain as fallback defaults.
   Add a comment to channel-registry.ts on each rateLimit block:
   // Fallback default — live value read from platform_settings at runtime via rate-limiter.ts

TESTS to add in src\lib\crosslister\queue\__tests__\rate-limiter.test.ts
(create file if it doesn't exist):
  - getRateLimitForChannel returns DB value when setting exists
  - getRateLimitForChannel returns channel-registry fallback when setting is missing
  - getRateLimitForChannel returns channel-registry fallback when DB value is not a valid integer
  - getRateLimitForChannel caches result for 60 seconds (mock Date.now to advance time)
  - getRateLimitForChannel re-fetches after cache expires
  Minimum 5 tests, all must pass.

---

### BUG 2: Idempotency key uses Date.now() instead of 1-minute bucket

PROBLEM:
Lister Canonical §24.1 specifies idempotency keys as:
  sellerId + listingId + channel + jobType + timestamp bucket (1-minute granularity)
Current implementation uses Date.now() (millisecond precision).
Two identical publishes triggered within 1 minute create duplicate jobs instead of deduplicating.
This defeats the entire purpose of the idempotency key.

AFFECTED FILES:
- src\lib\crosslister\services\publish-service.ts
  Line ~262: const idempotencyKey = `publish:${listingId}:${channel}:${Date.now()}`;
  Line ~344: const idempotencyKey = `sync:${projectionId}:${Date.now()}`;
- src\lib\actions\crosslister-publish.ts
  Line ~167: const idempotencyKey = `delist:${projection.id}:${Date.now()}`;

FIX:
Create a shared utility function and replace all three call sites.

1. Create src\lib\crosslister\utils\idempotency.ts:

  /**
   * Generate a crosslister idempotency key with 1-minute bucket granularity.
   * Spec: Lister Canonical §24.1
   * Format: {jobType}:{entityId}:{channel}:{minuteBucket}
   * where minuteBucket = Math.floor(Date.now() / 60_000)
   *
   * This ensures two identical jobs triggered within the same minute
   * produce the same key and deduplicate via BullMQ's jobId uniqueness.
   */
  export function buildIdempotencyKey(
    jobType: 'publish' | 'sync' | 'delist' | 'import' | 'verify',
    entityId: string,
    channel: string,
  ): string {
    const minuteBucket = Math.floor(Date.now() / 60_000);
    return `${jobType}:${entityId}:${channel}:${minuteBucket}`;
  }

2. Replace all three existing idempotency key constructions:

  In publish-service.ts publish job:
    OLD: const idempotencyKey = `publish:${listingId}:${channel}:${Date.now()}`;
    NEW: const idempotencyKey = buildIdempotencyKey('publish', listingId, channel);

  In publish-service.ts sync job:
    OLD: const idempotencyKey = `sync:${projectionId}:${Date.now()}`;
    NEW: const idempotencyKey = buildIdempotencyKey('sync', projectionId, channel);
    Note: sync jobs need the channel passed in — verify it is available at the call site.
    If it is not, fetch it from the channelProjection row before building the key.

  In crosslister-publish.ts delist job:
    OLD: const idempotencyKey = `delist:${projection.id}:${Date.now()}`;
    NEW: const idempotencyKey = buildIdempotencyKey('delist', projection.id, projection.channel);

3. Do NOT change the BullMQ jobId assignment — that already uses the idempotencyKey correctly.

TESTS to add in src\lib\crosslister\utils\__tests__\idempotency.test.ts:
  - Two calls with same args within same minute return identical key
  - Two calls with same args in different minutes return different keys
  - Different jobType produces different key
  - Different entityId produces different key
  - Different channel produces different key
  - Key format matches expected pattern {jobType}:{entityId}:{channel}:{bucket}
  Minimum 6 tests, all must pass.

---

### BUG 3: Burst protection — scheduledFor is never written for distributed spreading

PROBLEM:
crossJob.scheduledFor column exists. burstAllowance is defined per platform.
But when publishListingToChannel is called for a batch of 500 items × 3 platforms (1,500 jobs),
every job is created with scheduledFor = null (immediate).
All 1,500 hit the queue simultaneously, creating burst patterns that trigger platform detection.
Lister Canonical §8.5: jobs must be spread across the rolling 24-hour window.

FIX:
Add a scheduling function that computes a staggered scheduledFor timestamp
for each job in a batch, and pass it through to the BullMQ job options.

1. Create src\lib\crosslister\utils\burst-scheduler.ts:

  import { getConnectorMeta } from '../channel-registry';
  import type { ExternalChannel } from '../db-types';

  /**
   * Compute a staggered scheduledFor timestamp for a job within a batch.
   * Spreads jobs across a 24-hour window based on platform rate limits.
   * Spec: Lister Canonical §8.5
   *
   * @param channel      - Target platform
   * @param jobIndex     - 0-based index of this job within the batch
   * @param batchSize    - Total number of jobs in the batch
   * @returns            - Date to pass as BullMQ delay, or undefined if immediate
   */
  export function computeScheduledFor(
    channel: ExternalChannel,
    jobIndex: number,
    batchSize: number,
  ): Date | undefined {
    // Batches under the burst allowance threshold fire immediately
    const meta = getConnectorMeta(channel);
    const burstAllowance = meta.rateLimit.burstAllowance;
    if (batchSize <= burstAllowance) return undefined;

    // Spread remaining jobs (beyond burst allowance) across 24 hours
    // First burstAllowance jobs are immediate; rest are staggered
    if (jobIndex < burstAllowance) return undefined;

    const spreadJobs = batchSize - burstAllowance;
    const spreadIndex = jobIndex - burstAllowance;
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours in ms

    // Evenly distribute spread jobs across the window
    const delayMs = Math.floor((spreadIndex / spreadJobs) * windowMs);
    return new Date(Date.now() + delayMs);
  }

  /**
   * Convert a scheduledFor Date to a BullMQ delay (milliseconds from now).
   * Returns 0 if undefined (immediate).
   */
  export function toDelay(scheduledFor: Date | undefined): number {
    if (!scheduledFor) return 0;
    return Math.max(0, scheduledFor.getTime() - Date.now());
  }

2. Update publish-service.ts publishListingToChannel:
   - The function is called per listing per channel.
   - The call site in crosslister-publish.ts (publishListings action) loops over
     listings × channels and calls publishListingToChannel for each.
   - Add jobIndex: number and batchSize: number parameters to publishListingToChannel.
   - Inside publishListingToChannel, call computeScheduledFor(channel, jobIndex, batchSize)
     and pass the result to both:
     a. The crossJob DB insert: scheduledFor field
     b. The BullMQ queue.add options: delay: toDelay(scheduledFor)

3. Update the call site in crosslister-publish.ts publishListings:
   - The loop over listings × channels already runs in order.
   - Pass the loop index as jobIndex and total count as batchSize.
   Example:
     const jobs = listings.flatMap(l => channels.map(c => ({ listing: l, channel: c })));
     for (let i = 0; i < jobs.length; i++) {
       await publishListingToChannel(
         jobs[i].listing,
         jobs[i].channel,
         sellerId,
         i,           // jobIndex
         jobs.length  // batchSize
       );
     }

4. For single-listing publishes (jobIndex=0, batchSize=1):
   burstAllowance is always ≥ 1, so scheduledFor returns undefined → immediate.
   Single publishes are never delayed. Correct.

5. Update the crossJob DB insert to write scheduledFor when not undefined.
   Confirm the scheduledFor column accepts null (it does — nullable in schema).

TESTS to add in src\lib\crosslister\utils\__tests__\burst-scheduler.test.ts:
  - Batch ≤ burstAllowance: all jobs return undefined (immediate)
  - Batch > burstAllowance: first N jobs (burstAllowance) return undefined
  - Batch > burstAllowance: remaining jobs return future Date
  - Spread is monotonically increasing (job N+1 is always later than job N)
  - Last job in large batch is within 24 hours from now
  - batchSize=1 always returns undefined
  - toDelay(undefined) returns 0
  - toDelay(future date) returns positive integer
  Minimum 8 tests, all must pass.

---

RULES (apply to all three bugs):
- No `as any`. No `as unknown as`. No `@ts-ignore`.
- No floating point on money. (Not relevant here but blanket rule.)
- Max 300 lines per file. If a file exceeds 300 lines after edits, extract helpers.
- Run `npx tsc --noEmit` after all changes — must compile clean with zero errors.
- Run `npx vitest run` — test count must INCREASE (new tests added).
- Do NOT touch any file not listed above.
- Do NOT modify business logic — only the three bugs described.

STOP. Report:
1. BUG 1 — rate-limiter.ts: confirm DB lookup with 60s cache implemented.
   Show the getRateLimitForChannel function signature.
   Confirm channel-registry.ts fallback comment added.
   Test count for rate-limiter.test.ts: must be ≥5.

2. BUG 2 — idempotency.ts: confirm buildIdempotencyKey created.
   Show the function. Confirm all 3 call sites updated.
   Test count for idempotency.test.ts: must be ≥6.

3. BUG 3 — burst-scheduler.ts: confirm computeScheduledFor and toDelay created.
   Confirm publishListingToChannel signature updated with jobIndex + batchSize.
   Confirm call site in publishListings updated to pass index and total.
   Test count for burst-scheduler.test.ts: must be ≥8.

4. TypeScript errors: 0
5. Total test count delta vs baseline (must be positive — minimum +19 new tests)
```

---

## PROMPT 2: Crosslister Scheduler — Missing Architecture

```
READ FIRST:
- C:\Users\XPS-15\Projects\Twicely\read-me\TWICELY_V3_LISTER_CANONICAL.md
  Focus: §8.1 Core Principles, §8.2 Priority Order, §8.3 Rate Limiting,
         §8.4 Scheduling Algorithm, §8.5 Burst Protection, §23.2 Admin Controls,
         §24.1 Idempotent Jobs, §24 Reliability & Recovery
- src\lib\crosslister\queue\lister-worker.ts        (read entire file)
- src\lib\crosslister\queue\lister-queue.ts         (read entire file)
- src\lib\crosslister\queue\rate-limiter.ts         (read entire file — already updated in Prompt 1)
- src\lib\crosslister\queue\constants.ts            (read entire file)
- src\lib\crosslister\channel-registry.ts           (read entire file)
- src\lib\crosslister\services\job-executor.ts      (read entire file)
- src\lib\crosslister\db-types.ts                   (read entire file)
- src\lib\db\schema\crosslister.ts                  (read entire file)
- src\lib\db\seed\seed-crosslister.ts               (read entire file)

CONTEXT:
Four architectural components are missing from the crosslister scheduler.
Audit confirmed their complete absence. These are NOT refactors — they are new modules
that integrate with existing infrastructure.
Build order: A → B → C → D. Each builds on the previous.

---

### COMPONENT A: Per-Seller Fairness Quota

SPEC: Lister Canonical §8.1
"No single seller can monopolize queue capacity. Fair-share scheduling ensures
1,000 sellers with 50 items each get equivalent throughput."

PURPOSE:
Prevents a single seller with 10,000 queued jobs from blocking all other sellers.
Each seller gets a time-sliced quota of jobs per scheduler tick.

IMPLEMENTATION:

1. Create src\lib\crosslister\queue\fairness-quota.ts

  /**
   * Per-seller fairness quota for the crosslister scheduler.
   * Enforces that no single seller can monopolize BullMQ throughput.
   * Spec: Lister Canonical §8.1
   */

  /** In-process quota window. Resets every QUOTA_WINDOW_MS. */
  const QUOTA_WINDOW_MS = 60_000; // 1 minute window

  interface SellerQuota {
    jobsDispatchedThisWindow: number;
    windowStartsAt: number;
  }

  const quotaMap = new Map<string, SellerQuota>();

  /**
   * Read max jobs per seller per minute from platform settings.
   * Key: crosslister.fairness.maxJobsPerSellerPerMinute
   * Default: 10
   * Falls back to default if setting is missing or invalid.
   * Cached for 5 minutes.
   */
  let cachedMaxJobs: number | null = null;
  let cacheExpiresAt = 0;

  export async function getMaxJobsPerSellerPerMinute(): Promise<number> {
    const now = Date.now();
    if (cachedMaxJobs !== null && now < cacheExpiresAt) return cachedMaxJobs;
    // Query platform_settings for 'crosslister.fairness.maxJobsPerSellerPerMinute'
    // Parse as positive integer, default 10 if missing/invalid
    // Set cacheExpiresAt = now + 5 * 60_000
    // Store result in cachedMaxJobs
    // Return result
  }

  /**
   * Check if a seller has remaining quota in the current window.
   * Returns true if the seller can dispatch another job, false if exhausted.
   */
  export function hasQuota(sellerId: string, maxPerWindow: number): boolean {
    const now = Date.now();
    const quota = quotaMap.get(sellerId);
    // If no quota entry OR window has expired: create/reset and return true
    // If quota.jobsDispatchedThisWindow < maxPerWindow: return true
    // Else: return false
  }

  /**
   * Record that a job was dispatched for a seller.
   * Call this AFTER a job passes all gates and is actually dispatched.
   */
  export function recordDispatch(sellerId: string): void {
    const now = Date.now();
    const quota = quotaMap.get(sellerId);
    if (!quota || now >= quota.windowStartsAt + QUOTA_WINDOW_MS) {
      quotaMap.set(sellerId, { jobsDispatchedThisWindow: 1, windowStartsAt: now });
    } else {
      quota.jobsDispatchedThisWindow += 1;
    }
  }

  /**
   * Reset quota for a specific seller (used in tests and admin override).
   */
  export function resetQuota(sellerId: string): void {
    quotaMap.delete(sellerId);
  }

  /**
   * Reset all quota state (used in tests).
   */
  export function resetAllQuotas(): void {
    quotaMap.clear();
    cachedMaxJobs = null;
    cacheExpiresAt = 0;
  }

2. Seed the new platform setting in seed-crosslister.ts:
   Add to the existing settings array:
   { key: 'crosslister.fairness.maxJobsPerSellerPerMinute', value: 10, type: 'number',
     description: 'Max crosslister jobs dispatched per seller per minute (fairness quota)' }

TESTS: src\lib\crosslister\queue\__tests__\fairness-quota.test.ts
  - hasQuota returns true for new seller
  - hasQuota returns true when below limit
  - hasQuota returns false when at limit
  - hasQuota returns true after window resets (mock Date.now to advance 61 seconds)
  - recordDispatch increments counter
  - recordDispatch resets counter when new window starts
  - resetQuota clears seller state
  - getMaxJobsPerSellerPerMinute returns DB value
  - getMaxJobsPerSellerPerMinute returns default 10 when setting missing
  Minimum 9 tests.

---

### COMPONENT B: Tier Weighting

SPEC: Lister Canonical §8.1
"Higher ListerTier subscribers get priority weighting within the fairness algorithm.
Enterprise sellers process faster than Free tier. But fairness still applies —
a Power seller can't starve a Free seller entirely."

PURPOSE:
PRO sellers get a larger quota slice per window than FREE sellers.
This is applied as a multiplier on the fairness quota, not as a separate queue.

IMPLEMENTATION:

1. Create src\lib\crosslister\queue\tier-weight.ts

  import type { ListerTier } from '@/lib/db/schema/enums';

  /**
   * Tier weight multipliers for the fairness quota.
   * A PRO seller gets 3× the quota slots of a FREE seller per minute.
   * Spec: Lister Canonical §8.1
   *
   * These multipliers are applied to the base quota (crosslister.fairness.maxJobsPerSellerPerMinute).
   * Example: base=10, NONE multiplier=0.5 → 5 jobs/min
   *          base=10, FREE multiplier=1 → 10 jobs/min
   *          base=10, PRO multiplier=3 → 30 jobs/min
   */
  export const TIER_WEIGHT: Record<ListerTier, number> = {
    NONE:       0.5,   // Limited — just enough to process any queued imports
    FREE:       1.0,   // Baseline
    LITE:       1.5,
    PRO:        3.0,
    ENTERPRISE: 5.0,
  };

  /**
   * Compute effective quota for a seller given their ListerTier.
   * Always returns a minimum of 1 to ensure no seller is completely starved.
   */
  export function effectiveQuota(baseQuota: number, tier: ListerTier): number {
    const weight = TIER_WEIGHT[tier] ?? 1.0;
    return Math.max(1, Math.floor(baseQuota * weight));
  }

  Note: ListerTier enum values — verify exact values against
  src\lib\db\schema\enums.ts before writing. Use whatever is defined there.
  If enum values differ from NONE/FREE/LITE/PRO/ENTERPRISE, adjust accordingly.

2. Update fairness-quota.ts (from Component A):
   - hasQuota(sellerId, maxPerWindow) already takes maxPerWindow as a parameter.
   - The caller (Component D scheduler) will pass effectiveQuota(baseQuota, sellerTier)
     as the maxPerWindow argument. No changes needed to fairness-quota.ts itself.
   - The tier lookup happens in the scheduler (Component D).

3. Seed tier weight settings in seed-crosslister.ts so admin can override per tier:
   { key: 'crosslister.tierWeight.none',       value: 0.5, type: 'number', description: 'Quota multiplier for NONE tier' }
   { key: 'crosslister.tierWeight.free',       value: 1.0, type: 'number', description: 'Quota multiplier for FREE tier' }
   { key: 'crosslister.tierWeight.lite',       value: 1.5, type: 'number', description: 'Quota multiplier for LITE tier' }
   { key: 'crosslister.tierWeight.pro',        value: 3.0, type: 'number', description: 'Quota multiplier for PRO tier' }
   { key: 'crosslister.tierWeight.enterprise', value: 5.0, type: 'number', description: 'Quota multiplier for ENTERPRISE tier' }

   Update tier-weight.ts to read these from platform settings at runtime
   (same 60-second cache pattern as rate-limiter.ts from Prompt 1).
   Fall back to the hardcoded TIER_WEIGHT values if setting is missing.

TESTS: src\lib\crosslister\queue\__tests__\tier-weight.test.ts
  - effectiveQuota returns correct value for each tier
  - effectiveQuota returns minimum 1 even for very low base × weight
  - effectiveQuota floors to integer (no fractional jobs)
  - NONE tier gets less quota than FREE
  - PRO tier gets more quota than FREE
  - ENTERPRISE tier gets most quota
  - Reads from platform settings when available
  - Falls back to hardcoded values when setting missing
  Minimum 8 tests.

---

### COMPONENT C: Circuit Breaker

SPEC: Lister Canonical §8.4
"Check connector health → if circuit-breaker open, skip"
Lister Canonical §23.4: per-connector success rate, error breakdown, circuit breaker status.

PURPOSE:
When a platform's API is failing, stop hammering it. Let it recover.
Three states: CLOSED (healthy), OPEN (failing — skip all jobs), HALF_OPEN (testing recovery).

IMPLEMENTATION:

1. Create src\lib\crosslister\queue\circuit-breaker.ts

  /**
   * Circuit breaker per platform connector.
   * Prevents the scheduler from hammering a failing external platform API.
   * Spec: Lister Canonical §8.4, §23.4
   *
   * States:
   *   CLOSED   — healthy, jobs dispatch normally
   *   OPEN     — failing, all jobs for this platform are skipped
   *   HALF_OPEN — one probe job allowed through to test recovery
   */

  import type { ExternalChannel } from '../db-types';

  export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  interface CircuitData {
    state: CircuitState;
    failures: number;          // Consecutive failures in current window
    successes: number;         // Consecutive successes in HALF_OPEN (for recovery)
    lastFailureAt: number;     // Timestamp of most recent failure
    openedAt: number;          // Timestamp when circuit last opened
    halfOpenAt: number;        // Timestamp when circuit last entered HALF_OPEN
  }

  const circuits = new Map<ExternalChannel, CircuitData>();

  // Thresholds — all admin-configurable via platform settings
  // crosslister.circuitBreaker.failureThreshold   default: 5
  // crosslister.circuitBreaker.recoveryWindowMs   default: 300000 (5 minutes)
  // crosslister.circuitBreaker.halfOpenSuccesses  default: 2

  /**
   * Get current circuit state for a platform.
   * Auto-transitions OPEN → HALF_OPEN when recoveryWindowMs has elapsed.
   */
  export function getCircuitState(channel: ExternalChannel): CircuitState {
    const circuit = circuits.get(channel);
    if (!circuit) return 'CLOSED';

    if (circuit.state === 'OPEN') {
      const recoveryWindowMs = 300_000; // TODO: read from settings (5 min default)
      if (Date.now() - circuit.openedAt >= recoveryWindowMs) {
        circuit.state = 'HALF_OPEN';
        circuit.halfOpenAt = Date.now();
        circuit.successes = 0;
      }
    }

    return circuit.state;
  }

  /**
   * Record a successful job execution for a platform.
   * CLOSED: resets failure count.
   * HALF_OPEN: increments success count; transitions to CLOSED after threshold.
   */
  export function recordSuccess(channel: ExternalChannel): void {
    const circuit = circuits.get(channel) ?? initCircuit();
    if (circuit.state === 'HALF_OPEN') {
      const halfOpenSuccesses = 2; // TODO: read from settings
      circuit.successes += 1;
      if (circuit.successes >= halfOpenSuccesses) {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        circuit.successes = 0;
      }
    } else {
      circuit.failures = 0; // Reset on success in CLOSED state
    }
    circuits.set(channel, circuit);
  }

  /**
   * Record a failed job execution for a platform.
   * Increments failure counter. Transitions to OPEN when threshold exceeded.
   * HALF_OPEN failures immediately reopen the circuit.
   */
  export function recordFailure(channel: ExternalChannel): void {
    const circuit = circuits.get(channel) ?? initCircuit();
    const failureThreshold = 5; // TODO: read from settings
    circuit.failures += 1;
    circuit.lastFailureAt = Date.now();

    if (circuit.state === 'HALF_OPEN' || circuit.failures >= failureThreshold) {
      circuit.state = 'OPEN';
      circuit.openedAt = Date.now();
    }

    circuits.set(channel, circuit);
  }

  /**
   * Returns true if a job can be dispatched for this platform.
   * CLOSED → true (always dispatch)
   * HALF_OPEN → true (one probe allowed — caller must record result)
   * OPEN → false (skip)
   */
  export function canDispatch(channel: ExternalChannel): boolean {
    const state = getCircuitState(channel);
    return state !== 'OPEN';
  }

  function initCircuit(): CircuitData {
    return { state: 'CLOSED', failures: 0, successes: 0,
             lastFailureAt: 0, openedAt: 0, halfOpenAt: 0 };
  }

  /**
   * Get full circuit status for all platforms (used by admin dashboard §23.4).
   */
  export function getAllCircuitStatuses(): Record<string, CircuitState> {
    const result: Record<string, CircuitState> = {};
    for (const [channel, data] of circuits.entries()) {
      result[channel] = getCircuitState(channel);
    }
    return result;
  }

  /** Reset a specific circuit (admin override). */
  export function resetCircuit(channel: ExternalChannel): void {
    circuits.delete(channel);
  }

  /** Reset all circuits (tests only). */
  export function resetAllCircuits(): void {
    circuits.clear();
  }

2. Replace hardcoded threshold values with platform settings reads:
   Add getCBSettings(): Promise<{failureThreshold: number, recoveryWindowMs: number, halfOpenSuccesses: number}>
   Cache for 60 seconds.
   Keys:
     crosslister.circuitBreaker.failureThreshold   (default: 5)
     crosslister.circuitBreaker.recoveryWindowMs   (default: 300000)
     crosslister.circuitBreaker.halfOpenSuccesses  (default: 2)

3. Seed these settings in seed-crosslister.ts:
   { key: 'crosslister.circuitBreaker.failureThreshold',  value: 5,      type: 'number' }
   { key: 'crosslister.circuitBreaker.recoveryWindowMs',  value: 300000, type: 'number' }
   { key: 'crosslister.circuitBreaker.halfOpenSuccesses', value: 2,      type: 'number' }

4. Wire circuit breaker results back from job-executor.ts:
   In job-executor.ts, after each connector call:
   - On success: call recordSuccess(channel)
   - On failure (non-retryable OR final retry): call recordFailure(channel)
   - On retryable failure (still retrying): do NOT call recordFailure yet — only on final failure
   Find the existing success/failure branches in job-executor.ts and add these calls.

TESTS: src\lib\crosslister\queue\__tests__\circuit-breaker.test.ts
  - New channel starts CLOSED
  - canDispatch returns true when CLOSED
  - canDispatch returns false when OPEN
  - canDispatch returns true when HALF_OPEN (probe allowed)
  - 5 consecutive failures → state transitions to OPEN
  - recordSuccess in CLOSED resets failure count
  - OPEN → HALF_OPEN after recoveryWindowMs (mock Date.now)
  - HALF_OPEN + failure → back to OPEN immediately
  - HALF_OPEN + 2 successes → CLOSED (recovery)
  - getAllCircuitStatuses returns all tracked channels
  - resetCircuit clears state for one channel
  Minimum 11 tests.

---

### COMPONENT D: Scheduler Dispatch Loop

SPEC: Lister Canonical §8.4
"Every 5 seconds:
  1. Pull next batch of PENDING jobs from each queue (ordered by priority, then scheduledFor)
  2. For each job:
     a. Check platform rate limit bucket → if exhausted, skip
     b. Check seller fairness quota → if exhausted, skip
     c. Check connector health → if circuit-breaker open, skip
     d. Dispatch to connector for execution
  3. Update rate limit buckets
  4. Emit metrics to Prometheus"

IMPORTANT: BullMQ already processes jobs as workers — we do NOT replace BullMQ's worker.
The scheduler loop is a GATE that runs before BullMQ's concurrency.
Implementation: A BullMQ Sandbox Processor OR a setInterval loop that:
  - Promotes eligible jobs (changes status from WAITING → ACTIVE conditionally)
  - OR uses BullMQ's rate limiter + jobScheduler features to enforce the gates

Preferred approach: Custom setInterval gate loop running alongside the worker.
The loop queries pending crossJob rows, applies the three gates (rate, fairness, circuit),
and for jobs that pass: ensures they are enqueued in BullMQ with correct priority.
For jobs that fail a gate: leaves them in PENDING status, they will be re-evaluated next tick.

1. Create src\lib\crosslister\queue\scheduler-loop.ts

  /**
   * Crosslister scheduler dispatch loop.
   * Runs every 5 seconds. Applies three gates before dispatching:
   *   1. Platform rate limit (per seller per hour)
   *   2. Seller fairness quota (per seller per minute, weighted by ListerTier)
   *   3. Circuit breaker (per platform)
   *
   * Spec: Lister Canonical §8.4
   */

  import { getRateLimitForChannel } from './rate-limiter';
  import { hasQuota, recordDispatch, getMaxJobsPerSellerPerMinute } from './fairness-quota';
  import { canDispatch, getAllCircuitStatuses } from './circuit-breaker';
  import { effectiveQuota } from './tier-weight';
  import type { ExternalChannel } from '../db-types';
  import type { ListerTier } from '@/lib/db/schema/enums';

  const TICK_INTERVAL_MS = 5_000;
  const BATCH_PULL_SIZE = 50; // Jobs to evaluate per tick

  let schedulerInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the scheduler loop.
   * Safe to call multiple times — no-op if already running.
   */
  export function startSchedulerLoop(): void {
    if (schedulerInterval) return;
    schedulerInterval = setInterval(runTick, TICK_INTERVAL_MS);
  }

  /**
   * Stop the scheduler loop (graceful shutdown).
   */
  export function stopSchedulerLoop(): void {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
  }

  /**
   * Single scheduler tick.
   * Pulls PENDING jobs, applies gates, dispatches passing jobs to BullMQ.
   */
  async function runTick(): Promise<void> {
    try {
      // 1. Pull next BATCH_PULL_SIZE PENDING crossJob rows
      //    ordered by priority ASC, scheduledFor ASC NULLS FIRST
      //    WHERE status = 'PENDING' AND (scheduledFor IS NULL OR scheduledFor <= NOW())
      //    Join to sellerProfile to get listerTier for fairness weighting

      // 2. Track per-platform call counts this tick (for rate limit gate)
      //    Map<ExternalChannel, number> — incremented as jobs are dispatched

      // 3. For each job:
      //    a. RATE LIMIT GATE:
      //       - Get callsPerHourPerSeller for the channel (from rate-limiter.ts)
      //       - Check if this seller has remaining capacity this hour
      //       - Track using a tick-local Map<`${sellerId}:${channel}`, number>
      //       - If exhausted: skip (continue to next job)
      //
      //    b. FAIRNESS GATE:
      //       - Get base quota from getMaxJobsPerSellerPerMinute()
      //       - Get seller's ListerTier from the join
      //       - Compute effectiveSellerQuota = effectiveQuota(baseQuota, listerTier)
      //       - Call hasQuota(sellerId, effectiveSellerQuota)
      //       - If no quota: skip (continue to next job)
      //
      //    c. CIRCUIT BREAKER GATE:
      //       - Call canDispatch(channel)
      //       - If false (OPEN): skip (continue to next job)
      //
      //    d. DISPATCH:
      //       - Update crossJob status from PENDING → RUNNING in DB
      //       - Add job to listerPublishQueue (BullMQ) with:
      //           jobId: job.idempotencyKey
      //           priority: job.priority
      //           delay: 0 (scheduledFor already enforced by WHERE clause above)
      //       - Call recordDispatch(sellerId) to consume fairness quota
      //       - Increment tick-local rate limit counter for this seller+channel

      // 4. Emit metrics:
      //    Log: dispatched count, skipped-rate count, skipped-fairness count,
      //         skipped-circuit count, tick duration ms
      //    Use existing logger — no new monitoring dependencies

    } catch (err) {
      // Log error but DO NOT throw — tick failures must not crash the loop
      logger.error('[schedulerLoop] Tick error', { error: String(err) });
    }
  }

  Fill in the complete implementation of runTick following the pseudocode above.
  Use Drizzle ORM for the DB queries (same pattern as other services).
  The join to get listerTier: join crossJob → crosslisterAccount → sellerProfile to get listerTier.

2. Wire rate limit tracking properly:
   The rate limiter from Prompt 1 tracks calls using a Valkey/in-process bucket.
   The scheduler tick needs to check remaining capacity before dispatching.
   Add a function to rate-limiter.ts:

   export async function checkAndConsumeRateLimit(
     sellerId: string,
     channel: ExternalChannel,
   ): Promise<boolean>
   - Returns true if the seller has capacity and consumes one slot
   - Returns false if rate limit exhausted (does not consume)
   - Uses a Valkey INCR+EXPIRE pattern (1-hour TTL, key: `rl:{channel}:{sellerId}`)
   - Falls back to in-process tracking if Valkey unavailable

3. Start the loop from worker-init.ts:
   Find the existing worker initialisation in src\lib\crosslister\queue\worker-init.ts
   After workers are created, call startSchedulerLoop().
   On process shutdown signals (SIGTERM, SIGINT): call stopSchedulerLoop() before worker.close().

4. Expose circuit breaker status for admin dashboard:
   Create src\app\api\hub\crosslister\circuit-status\route.ts
   GET handler. Returns getAllCircuitStatuses().
   Auth: authorize() — ADMIN or SUPER_ADMIN only.
   Shape: { [channel: string]: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }

5. Add GET handler for scheduler health:
   Create src\app\api\hub\crosslister\scheduler-health\route.ts
   Returns: { running: boolean, lastTickAt: string | null, lastTickDurationMs: number | null }
   Track lastTickAt and lastTickDurationMs in module-level variables, updated each tick.
   Auth: authorize() — ADMIN or SUPER_ADMIN only.

TESTS: src\lib\crosslister\queue\__tests__\scheduler-loop.test.ts
  - startSchedulerLoop starts the interval
  - stopSchedulerLoop clears the interval
  - startSchedulerLoop is idempotent (calling twice starts only one interval)
  - runTick skips job when rate limit exhausted (mock checkAndConsumeRateLimit → false)
  - runTick skips job when fairness quota exhausted (mock hasQuota → false)
  - runTick skips job when circuit breaker OPEN (mock canDispatch → false)
  - runTick dispatches job when all gates pass
  - runTick calls recordDispatch after successful dispatch
  - runTick does not throw on DB error (tick error is swallowed)
  - Jobs with scheduledFor in the future are excluded from the batch
  - Higher priority jobs dispatched before lower priority jobs
  Minimum 11 tests.

---

### FINAL WIRING CHECK

After all four components are built, run these greps to confirm wiring:

grep -rn "startSchedulerLoop" src/ --include="*.ts"
  → Must appear in worker-init.ts

grep -rn "recordSuccess\|recordFailure" src/lib/crosslister/services/job-executor.ts
  → Must appear (circuit breaker feedback)

grep -rn "checkAndConsumeRateLimit" src/lib/crosslister/queue/ --include="*.ts"
  → Must appear in scheduler-loop.ts

grep -rn "hasQuota\|recordDispatch" src/lib/crosslister/queue/ --include="*.ts"
  → Must appear in scheduler-loop.ts

grep -rn "canDispatch" src/lib/crosslister/queue/ --include="*.ts"
  → Must appear in scheduler-loop.ts

grep -rn "effectiveQuota" src/lib/crosslister/queue/ --include="*.ts"
  → Must appear in scheduler-loop.ts

grep -rn "circuit-status\|scheduler-health" src/app/api/hub/crosslister/ --include="*.ts"
  → Must appear (admin routes exist)

---

RULES (apply to all four components):
- No `as any`. No `as unknown as`. No `@ts-ignore`. Fix types properly.
- Max 300 lines per file. Split if needed — helpers in separate files.
- All thresholds and config values in platform settings, never hardcoded.
  Exception: the TICK_INTERVAL_MS = 5_000 constant may remain in code
  (changing this requires careful coordination with BullMQ worker restart).
- authorize() from @/lib/casl on every new API route — never raw auth.api.getSession().
- Run `npx tsc --noEmit` after all changes — zero errors.
- Run `npx vitest run` — test count must increase significantly.
- Do NOT modify any existing test files.
- Do NOT touch any files outside the crosslister directory and the two new API routes,
  except: job-executor.ts (circuit breaker feedback), worker-init.ts (loop start),
  seed-crosslister.ts (new settings), rate-limiter.ts (checkAndConsumeRateLimit).

STOP. Report:
1. Component A — fairness-quota.ts: confirm hasQuota, recordDispatch, resetAllQuotas exported.
   New setting seeded: crosslister.fairness.maxJobsPerSellerPerMinute.
   Test count: ≥9.

2. Component B — tier-weight.ts: confirm TIER_WEIGHT map and effectiveQuota exported.
   5 new settings seeded (one per tier).
   Settings read from DB with 60s cache.
   Test count: ≥8.

3. Component C — circuit-breaker.ts: confirm canDispatch, recordSuccess, recordFailure exported.
   3 new settings seeded.
   Feedback wired in job-executor.ts (show the two lines added).
   Test count: ≥11.

4. Component D — scheduler-loop.ts: confirm startSchedulerLoop and stopSchedulerLoop exported.
   Wired in worker-init.ts (show the line added).
   All three gates (rate, fairness, circuit) present in runTick.
   Admin routes created: /api/hub/crosslister/circuit-status and /api/hub/crosslister/scheduler-health.
   Test count: ≥11.

5. Final wiring grep results — all 7 greps must return matches.

6. TypeScript errors: 0.

7. Total test count delta vs Prompt 1 output (must be ≥39 new tests across both prompts).

8. All new platform settings — complete list (Prompt 1 + Prompt 2 combined).
```
