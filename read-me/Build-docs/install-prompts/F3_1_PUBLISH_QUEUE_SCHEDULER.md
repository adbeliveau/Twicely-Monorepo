# Install Prompt: F3.1 — Publish Queue + Scheduler

## 1. HEADER

- **Phase & Step:** `[F3.1]`
- **Feature Name:** Crosslister Publish Queue + Scheduler
- **One-line Summary:** Convert F3's inline (synchronous) publish pipeline to async BullMQ job execution with priority scheduling, per-platform rate limiting, exponential backoff retry, job cancellation, and queue status UI.
- **Canonical Sources (READ ALL BEFORE STARTING):**
  1. `TWICELY_V3_LISTER_CANONICAL.md` -- sections 4.3, 7.2, 8 (full), 9.3, 12, 21, 24
  2. `TWICELY_V3_SCHEMA_v2_0_7.md` -- section 12 (crosslister tables)
  3. `TWICELY_V3_PAGE_REGISTRY.md` -- row 56 (`/my/selling/crosslist`)
  4. `TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` -- sections 42 (Background Jobs), 46 (Crosslister UX)
  5. `TWICELY_V3_DECISION_RATIONALE.md` -- decisions #17 (crosslister as supply engine), #31 (no fees on off-platform sales), #62 (Railway deployment)
  6. `Build-docs/SCHEMA_ADDENDUM_A2_4_PLATFORM_EXPANSION.md` -- section 7 (connector feature flags)

---

## 2. PREREQUISITES

### Completed Steps Required
- **F3 (Crosslist Outbound):** COMPLETE. Built inline publish pipeline: `publish-service.ts`, `listing-transform.ts`, `publish-meter.ts`, `policy-validator.ts`, 8 connector implementations, `crosslister-publish.ts` server actions, 5 UI components, validation schemas.
- **E2.1 (Connector Framework):** COMPLETE. Connector interface, channel/connector registries, types, seed data.
- **All Phases A-E:** COMPLETE. Auth, CASL, schema, all marketplace features.

### Tables That Must Already Exist
- `cross_job` (schema: `src/lib/db/schema/crosslister.ts` lines 82-111)
- `channel_projection` (schema: `src/lib/db/schema/crosslister.ts` lines 46-79)
- `crosslister_account` (schema: `src/lib/db/schema/crosslister.ts` lines 10-43)
- `platform_setting` (schema: `src/lib/db/schema/platform.ts`)
- `feature_flag` (schema: `src/lib/db/schema/platform.ts`)

### Services That Must Already Exist
- `src/lib/jobs/queue.ts` -- BullMQ queue/worker factory with Valkey connection
- `src/lib/crosslister/services/publish-service.ts` -- inline publish pipeline (the refactoring target)
- `src/lib/crosslister/services/publish-meter.ts` -- publish allowance check
- `src/lib/crosslister/services/policy-validator.ts` -- pre-publish validation
- `src/lib/crosslister/services/listing-transform.ts` -- canonical-to-platform transform
- `src/lib/crosslister/channel-registry.ts` -- static channel metadata + rate limits
- `src/lib/crosslister/connector-registry.ts` -- runtime connector lookup
- `src/lib/actions/crosslister-publish.ts` -- server actions (the refactoring target)
- `src/lib/queries/crosslister.ts` -- crosslister data queries
- `src/lib/validations/crosslister.ts` -- Zod schemas including `cancelJobSchema`

### npm Dependencies
- `bullmq` (already installed)
- No new dependencies required. Valkey connection already configured in `src/lib/jobs/queue.ts`.

---

## 3. SCOPE -- EXACTLY WHAT TO BUILD

### 3.1 Database Changes

**NO schema changes required.** The `crossJob` table already has all needed columns:
- `status` enum: `PENDING | QUEUED | IN_PROGRESS | COMPLETED | FAILED | CANCELED`
- `bullmqJobId`: text column for linking to BullMQ job ID
- `priority`: integer (0 = highest, 999 = lowest)
- `scheduledFor`: timestamp for delayed execution
- `attempts` / `maxAttempts`: retry tracking
- `lastError`: error message storage
- `payload` / `result`: JSONB for job data

The `publishJobStatusEnum` in `src/lib/db/schema/enums.ts` already includes `QUEUED`. The current F3 code skips `QUEUED` and goes straight to `IN_PROGRESS`. F3.1 uses the full lifecycle: `PENDING -> QUEUED -> IN_PROGRESS -> COMPLETED | FAILED | CANCELED`.

**IMPORTANT NOTE on enum values:** The Lister Canonical section 5.3 uses `PENDING | SCHEDULED | RUNNING | COMPLETED | FAILED | DEAD_LETTERED | CANCELLED` but the ACTUAL enum in `src/lib/db/schema/enums.ts` is `PENDING | QUEUED | IN_PROGRESS | COMPLETED | FAILED | CANCELED`. USE THE ACTUAL ENUM VALUES, not the canonical sketch values. The canonical is a sketch; the implemented schema is the source of truth.

Similarly, the Lister Canonical section 5.3 uses `jobType` values like `IMPORT | PUBLISH | SYNC | DELIST | EMERGENCY_DELIST | VERIFY | POLL | AUTO_RELIST | AUTO_OFFER | AUTO_SHARE | AUTO_PRICE_DROP | REFRESH_LISTING | BULK_IMPORT` but the ACTUAL enum in `src/lib/db/schema/enums.ts` is `CREATE | UPDATE | DELIST | RELIST | SYNC | VERIFY`. USE THE ACTUAL ENUM VALUES.

### 3.2 BullMQ Queue Setup -- `src/lib/crosslister/queue/lister-queue.ts` (NEW)

Create a dedicated BullMQ queue for the crosslister domain using the existing `createQueue` factory from `src/lib/jobs/queue.ts`.

```typescript
// Queue name: 'lister:publish'
// This is the outbound publish queue. Other queues (emergency-delist, sync, polling)
// are future phases.

import { createQueue } from '@/lib/jobs/queue';

export interface ListerPublishJobData {
  crossJobId: string;        // PK of the cross_job row
  listingId: string;
  channel: string;           // ExternalChannel value
  sellerId: string;
  accountId: string;
  projectionId: string;
  overrides: Record<string, unknown> | null;
  jobType: 'CREATE' | 'UPDATE' | 'DELIST' | 'SYNC';
}

export const listerPublishQueue = createQueue<ListerPublishJobData>('lister:publish');
```

**Queue configuration:**
- Default job options set when adding jobs (not on the queue itself):
  - `attempts`: from `crossJob.maxAttempts` (default 3 for PUBLISH, per Lister Canonical section 24.2)
  - `backoff`: `{ type: 'exponential', delay: 30_000 }` (30s, 120s, 300s -- matches Lister Canonical section 24.2 for PUBLISH)
  - `priority`: from `crossJob.priority` (300 for CREATE/publish, 500 for SYNC, 0 for emergency delist)
  - `removeOnComplete`: `{ count: 1000 }` (keep last 1000 completed for debugging)
  - `removeOnFail`: `{ count: 5000 }` (keep failed for admin inspection)

### 3.3 Job Worker -- `src/lib/crosslister/queue/lister-worker.ts` (NEW)

The worker processes queued jobs by calling the existing publish pipeline.

**Worker responsibilities:**
1. Receive `ListerPublishJobData` from BullMQ
2. Update `crossJob.status` to `IN_PROGRESS`, set `startedAt`
3. Load listing + images via `getListingForPublish()` from `src/lib/queries/crosslister.ts`
4. Run the existing pipeline: policy validation -> feature flag check -> account lookup -> transform -> connector execution
5. On success: update `crossJob.status` to `COMPLETED`, update `channelProjection.status` to `ACTIVE` with `externalId`/`externalUrl`
6. On failure: update `crossJob.status` to `FAILED`, increment `attempts`, set `lastError`
7. For SYNC jobs: call `connector.updateListing()` instead of `createListing()`
8. For DELIST jobs: call `connector.delistListing()`, update projection status to `DELISTED`
9. Log all outcomes via `logger`

**Rate limiting (per Lister Canonical section 8.3):**

Use BullMQ's built-in `RateLimiter` on the worker OR implement rate limiting via a simple in-memory token bucket per channel. The channel-registry already defines rate limits:

| Channel | callsPerHourPerSeller | Scheduler Pacing |
|---------|----------------------|------------------|
| EBAY | 200 | Per channel-registry |
| POSHMARK | 60 | Per channel-registry |
| MERCARI | 150 | Per channel-registry |

Implementation approach: Use a BullMQ `rateLimiter` group key of `${channel}:${sellerId}`. The rate limiter ensures no seller exceeds their per-platform rate limit. Use the `callsPerHourPerSeller` from `channel-registry.ts` for the max rate.

However, BullMQ's built-in rate limiter operates per-queue, not per-group natively. The pragmatic V1 approach: check rate limits INSIDE the worker processor before executing. If rate exceeded, throw a specific error that BullMQ retries with delay. This is simpler and matches the "controlled execution" principle.

**Concurrency:** Worker concurrency = 10 (matches Lister Canonical section 4.3 for `lister:publish` queue).

**Worker code pattern:**

```typescript
import { createWorker } from '@/lib/jobs/queue';
import type { Job } from 'bullmq';
import type { ListerPublishJobData } from './lister-queue';

// The processor function
async function processPublishJob(job: Job<ListerPublishJobData>): Promise<void> {
  const { crossJobId, listingId, channel, sellerId, accountId, projectionId, jobType, overrides } = job.data;

  // 1. Mark crossJob IN_PROGRESS
  // 2. Check rate limit for channel+seller
  // 3. Branch on jobType: CREATE | UPDATE | DELIST | SYNC
  // 4. For CREATE: run full publish pipeline (load listing, validate, transform, execute via connector)
  // 5. For UPDATE/SYNC: load listing, transform, call connector.updateListing()
  // 6. For DELIST: call connector.delistListing()
  // 7. Update crossJob + channelProjection on success/failure
}

export const listerWorker = createWorker<ListerPublishJobData>(
  'lister:publish',
  processPublishJob,
  10  // concurrency
);
```

**CRITICAL REFACTOR:** The existing `publishListingToChannel()` in `publish-service.ts` does BOTH the pipeline setup AND the connector execution in one function. For F3.1, we need to EXTRACT the connector execution into a separate callable function that the worker invokes. The existing `publishListingToChannel()` function must be split:

- **Pipeline preparation** (validation, feature flag check, account lookup, transform, projection upsert, crossJob creation) -- stays in `publish-service.ts` but NOW returns early after creating the crossJob as QUEUED and enqueueing to BullMQ.
- **Pipeline execution** (connector.createListing, status updates) -- moves to the worker.

This is the core architectural change of F3.1.

### 3.4 Refactored Publish Service -- `src/lib/crosslister/services/publish-service.ts` (MODIFY)

The current `publishListingToChannel()` function must be refactored from:

```
validate -> transform -> create projection -> create crossJob(IN_PROGRESS) -> execute connector -> update status
```

To:

```
validate -> transform -> create projection(QUEUED) -> create crossJob(QUEUED) -> enqueue BullMQ job -> return jobId
```

**New return type:**

```typescript
export interface PublishEnqueueResult {
  success: boolean;
  crossJobId: string | null;
  projectionId: string | null;
  error?: string;
}
```

**What changes:**
1. Projection status set to `QUEUED` (not `PUBLISHING`)
2. CrossJob status set to `QUEUED` (not `IN_PROGRESS`)
3. CrossJob gets `bullmqJobId` populated after `listerPublishQueue.add()`
4. Function returns immediately after enqueue -- does NOT call connector
5. The connector execution now happens in the worker (section 3.3)

**What stays the same:**
- All pre-checks: listing ownership, ACTIVE status, policy validation, feature flag check, account lookup, metering
- Transform logic
- Projection upsert logic (create or reuse existing)
- Idempotency key generation

**NEW function for worker to call:** Add `executePublishJob()` as an UNEXPORTED helper (to avoid creating an unintended server action if this file ever gets `'use server'`). Actually, since `publish-service.ts` is NOT a `'use server'` file, this is safe as a regular export. But keep it in a separate file for clarity.

### 3.5 Job Executor -- `src/lib/crosslister/services/job-executor.ts` (NEW)

This file contains the actual connector execution logic, extracted from the old inline `publishListingToChannel()`. The worker calls this.

```typescript
export interface JobExecutionResult {
  success: boolean;
  externalId: string | null;
  externalUrl: string | null;
  error?: string;
  retryable: boolean;
}

/**
 * Execute a CREATE publish job. Called by the BullMQ worker.
 * Loads listing, transforms, calls connector.createListing().
 */
export async function executeCreateJob(
  crossJobId: string,
  listingId: string,
  channel: ExternalChannel,
  sellerId: string,
  accountId: string,
  projectionId: string,
  overrides: ChannelOverrides | null,
): Promise<JobExecutionResult> { ... }

/**
 * Execute an UPDATE/SYNC job. Called by the BullMQ worker.
 * Loads listing, transforms changes, calls connector.updateListing().
 */
export async function executeUpdateJob(
  crossJobId: string,
  listingId: string,
  channel: ExternalChannel,
  sellerId: string,
  accountId: string,
  projectionId: string,
  externalId: string,
): Promise<JobExecutionResult> { ... }

/**
 * Execute a DELIST job. Called by the BullMQ worker.
 * Calls connector.delistListing().
 */
export async function executeDelistJob(
  crossJobId: string,
  channel: ExternalChannel,
  accountId: string,
  projectionId: string,
  externalId: string,
): Promise<JobExecutionResult> { ... }
```

### 3.6 Rate Limiter -- `src/lib/crosslister/queue/rate-limiter.ts` (NEW)

Simple in-memory sliding window rate limiter per channel+seller.

```typescript
interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

/**
 * Check if a request can proceed within the rate limit.
 * Returns true if allowed, false if rate exceeded.
 */
export function checkRateLimit(channel: string, sellerId: string): boolean { ... }

/**
 * Record a request against the rate limit.
 */
export function recordRequest(channel: string, sellerId: string): void { ... }

/**
 * Get the delay in ms before the next request can proceed.
 * Returns 0 if no delay needed.
 */
export function getDelayMs(channel: string, sellerId: string): number { ... }
```

Rate limits sourced from `channel-registry.ts` `rateLimit.callsPerHourPerSeller`. The sliding window is 1 hour (3600 seconds).

**Important:** This is an in-memory rate limiter. It resets on server restart. This is acceptable for V1 -- a Valkey-backed rate limiter is a future enhancement. The Lister Canonical acknowledges adaptive rate limiting is iterative.

### 3.7 Refactored Server Actions -- `src/lib/actions/crosslister-publish.ts` (MODIFY)

**`publishListings` action:** Change from synchronous loop to enqueue pattern.

Current behavior (F3):
```
for each listing x channel:
  await publishListingToChannel(listingId, channel, sellerId)  // blocks, calls connector
```

New behavior (F3.1):
```
for each listing x channel:
  await publishListingToChannel(listingId, channel, sellerId)  // returns immediately after enqueue
```

The action's return type changes from `PublishSummary` (with `published`/`failed` counts) to:

```typescript
interface EnqueueSummary {
  queued: number;
  failed: number;
  errors: Array<{ listingId: string; channel: string; error: string }>;
}
```

The `published` count is now `queued` -- the action no longer knows if publishes succeeded because execution is async.

**`delistFromChannel` action:** Change from inline delist to enqueue a DELIST job.

Current behavior: calls `connector.delistListing()` synchronously.
New behavior: creates crossJob(DELIST, QUEUED), enqueues BullMQ job, returns immediately.

**`cancelJob` action (NEW -- implement the existing `cancelJobSchema`):**

The `cancelJobSchema` already exists in `src/lib/validations/crosslister.ts` (line 85-87) and the import exists in `crosslister-publish.ts` (line 29) but the action is not implemented (line 281: `void cancelJobSchema`).

Implement `cancelJob`:
1. Parse input with `cancelJobSchema`
2. Authorize: `ability.can('delete', 'CrossJob')`
3. Load crossJob, verify `sellerId` matches session
4. Only cancel if status is `PENDING` or `QUEUED` -- cannot cancel `IN_PROGRESS`
5. If BullMQ job exists (via `bullmqJobId`), remove it from queue: `listerPublishQueue.remove(bullmqJobId)`
6. Update `crossJob.status` to `CANCELED`
7. If the job was a CREATE, revert projection status from `QUEUED` to `DRAFT`
8. `revalidatePath('/my/selling/crosslist')`

**`getJobQueueStatus` action (NEW):**

New action to get queue summary for the crosslister dashboard sidebar widget.

```typescript
export async function getJobQueueStatus(): Promise<ActionResult<QueueStatus>> {
  // authorize
  // query cross_job table: count by status WHERE sellerId = session.userId
  // return { queued: N, inProgress: N, completed: N, failed: N }
}
```

### 3.8 Pending Sync Execution

When `updateProjectionOverrides` sets `hasPendingSync = true` (existing behavior in `crosslister-publish.ts` line 254-255), AND the projection is ACTIVE with sync enabled, enqueue an UPDATE job.

Add to `updateProjectionOverrides` after the existing DB update:

```typescript
if (hasPendingSync && projection.status === 'ACTIVE' && projection.externalId) {
  // Enqueue a SYNC job
  await enqueueSyncJob(projection.id, sellerId);
}
```

Create helper `enqueueSyncJob()` in `publish-service.ts` that:
1. Creates a crossJob with `jobType: 'UPDATE'`, `priority: 500`, `status: 'QUEUED'`
2. Enqueues to `listerPublishQueue` with the same `ListerPublishJobData` shape but `jobType: 'UPDATE'`

SYNC jobs (UPDATE type) do NOT consume publishes (Lister Canonical section 7.1: "Update synced listing = 0 publishes").

### 3.9 Queue Status Query -- `src/lib/queries/crosslister.ts` (MODIFY)

Add a new query function:

```typescript
export interface QueueStatusSummary {
  queued: number;
  inProgress: number;
  completed: number;  // last 24h only
  failed: number;     // last 24h only
}

export async function getSellerQueueStatus(sellerId: string): Promise<QueueStatusSummary> {
  // Single query with conditional aggregation:
  // SELECT
  //   COUNT(*) FILTER (WHERE status = 'QUEUED') as queued,
  //   COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress,
  //   COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at > now() - interval '24 hours') as completed,
  //   COUNT(*) FILTER (WHERE status = 'FAILED' AND updated_at > now() - interval '24 hours') as failed
  // FROM cross_job WHERE seller_id = $1
}
```

### 3.10 UI: Queue Status on Crosslister Dashboard

**Modify `src/app/(hub)/my/selling/crosslist/page.tsx`:**

Add queue status to the page data fetch. Display a queue summary section between the publish meter and the projections table.

**New component: `src/components/crosslister/queue-status-card.tsx` (NEW)**

A small card showing:
```
Queue Status
5 publishing  ·  12 queued  ·  2 failed (last 24h)
```

This matches the Feature Lock-in section 46: "Queue summary: '5 publishing . 12 queued' -- tells seller the system is working without clicking into anything."

If all counts are 0, show "No active jobs" in muted text.

Color coding: queued = default, inProgress = blue, failed = red/destructive.

**Modify `src/components/crosslister/publish-dialog.tsx`:**

The publish dialog currently shows synchronous results. Change messaging to reflect async behavior:
- Before: "Published 3 listings to 2 platforms" (success/failure counts)
- After: "Queued 6 jobs for publishing. You can track progress on the crosslister dashboard."

### 3.11 Worker Lifecycle Management -- `src/lib/crosslister/queue/worker-init.ts` (NEW)

Workers need to be started somewhere. In the Railway deployment model, the Next.js app runs as a single process. BullMQ workers run in the same process (not a separate worker dyno) for now.

Create a file that initializes the worker on application startup. This file is imported by the Next.js instrumentation hook (`src/instrumentation.ts`) or a custom server startup script.

```typescript
import { listerWorker } from './lister-worker';
import { logger } from '@/lib/logger';

let initialized = false;

export function initListerWorker(): void {
  if (initialized) return;
  initialized = true;

  listerWorker.on('completed', (job) => {
    logger.info('[listerWorker] Job completed', { jobId: job.id, crossJobId: job.data.crossJobId });
  });

  listerWorker.on('failed', (job, err) => {
    logger.error('[listerWorker] Job failed', { jobId: job?.id, error: String(err) });
  });

  logger.info('[listerWorker] Initialized with concurrency=10');
}
```

**Next.js integration:** Add to `src/instrumentation.ts` (or create it if it doesn't exist):

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initListerWorker } = await import('@/lib/crosslister/queue/worker-init');
    initListerWorker();
  }
}
```

If `src/instrumentation.ts` already exists, add the worker init to the existing `register()` function.

### 3.12 CASL Rules

No new CASL subjects or rules needed. The existing rules cover all operations:

- `create ChannelProjection` -- publish (enqueue)
- `delete ChannelProjection` -- delist (enqueue)
- `update ChannelProjection` -- override updates + sync enqueue
- `read CrossJob` -- view job status
- `delete CrossJob` -- cancel pending jobs

All verified in `src/lib/casl/subjects.ts` and `src/lib/casl/platform-abilities.ts`.

### 3.13 Real-Time Updates (Centrifugo)

Per the F3 install prompt's deferral note: "Centrifugo is deferred -- use polling fallback." This remains true for F3.1.

The queue status on the dashboard is fetched via server-side query on page load. For real-time updates, the page can use `revalidatePath` after actions or the user can refresh. Full Centrifugo integration (Lister Canonical section 21) is Phase G scope.

Do NOT implement Centrifugo WebSocket publishing in this step.

---

## 4. CONSTRAINTS -- WHAT NOT TO DO

### Banned Terms
- NO `SellerTier` -- use `StoreTier` or `ListerTier`
- NO `FVF` / `Final Value Fee` -- use `TF` / `Transaction Fee`
- NO `wallet` in seller UI -- use `payout`
- NO `Twicely Balance` -- use `Available for payout`
- NO `Redis` in comments/code -- use `Valkey`
- NO `Bull` without `MQ` -- always `BullMQ`

### Banned Tech
- NO Prisma -- Drizzle only
- NO NextAuth -- Better Auth only
- NO Redis -- Valkey + BullMQ
- NO tRPC -- server actions + API routes
- NO Zustand/Redux -- React context + server state

### Banned Patterns
- NO `as any` or `@ts-ignore`
- NO files over 300 lines
- NO hardcoded fee rates
- NO `console.log` in production code
- NO spreading request body into DB updates
- NO `storeId` as ownership key -- always `userId` (mapped to `sellerId` in crosslister domain)

### Gotchas from Canonical Docs
1. **Enum mismatch:** The Lister Canonical sketches use different enum values than what's actually implemented. Always use the ACTUAL values from `src/lib/db/schema/enums.ts`: `publishJobStatusEnum` = `PENDING | QUEUED | IN_PROGRESS | COMPLETED | FAILED | CANCELED`, `publishJobTypeEnum` = `CREATE | UPDATE | DELIST | RELIST | SYNC | VERIFY`.
2. **`sellerProfile.id` is NOT `userId`:** The `sellerProfile` table has its own CUID2 PK. Ownership is via `sellerProfile.userId`. The crosslister tables correctly use `sellerId` which references `user.id`, not `sellerProfile.id`.
3. **Exported helpers in 'use server' files:** `crosslister-publish.ts` is a `'use server'` file. Any exported function becomes a server action. Keep helper functions unexported or in separate non-server files.
4. **Publish metering is COUNT-based:** Usage is derived from `crossJob` rows with `jobType='CREATE'` and non-canceled status in the current calendar month. Creating a `crossJob` IS the recording. No separate counter needed.
5. **SYNC/UPDATE/DELIST jobs do NOT consume publishes.** Only CREATE jobs count against the monthly limit (Lister Canonical section 7.1).
6. **The `cancelJobSchema` already exists and is imported.** Do not recreate it. The current code has `void cancelJobSchema` as a placeholder -- implement the actual action.
7. **Worker runs in-process:** Railway runs Next.js as a single Docker container. BullMQ workers run in the same Node.js process via `instrumentation.ts`. A dedicated worker process is a future optimization.
8. **Rate limiter is in-memory V1:** The sliding window resets on restart. This is acceptable. A Valkey-backed implementation is Phase G.

---

## 5. ACCEPTANCE CRITERIA

### Functional -- Enqueue Pattern
- [ ] `publishListings` action creates `crossJob` rows with status `QUEUED` (not `IN_PROGRESS`)
- [ ] `publishListings` action returns `{ queued: N }` count (not `published`)
- [ ] `publishListings` action populates `crossJob.bullmqJobId` after enqueue
- [ ] `channelProjection` status is set to `QUEUED` (not `PUBLISHING`) during enqueue
- [ ] BullMQ job is added to `lister:publish` queue with correct data shape

### Functional -- Worker Execution
- [ ] Worker processes jobs from `lister:publish` queue
- [ ] Worker updates `crossJob.status` to `IN_PROGRESS` on pickup, `COMPLETED` on success, `FAILED` on failure
- [ ] Worker updates `channelProjection.status` to `ACTIVE` on successful CREATE, `DELISTED` on successful DELIST
- [ ] Worker sets `channelProjection.externalId` and `externalUrl` on success
- [ ] Worker sets `crossJob.lastError` on failure
- [ ] Worker increments `crossJob.attempts` on each execution

### Functional -- Retry & Backoff
- [ ] PUBLISH/CREATE jobs retry 3 times with exponential backoff (30s, 120s, 300s)
- [ ] DELIST jobs retry 3 times with exponential backoff (30s, 120s, 300s)
- [ ] SYNC/UPDATE jobs retry 3 times with exponential backoff (60s, 300s, 900s)
- [ ] After max retries exhausted, job status remains `FAILED` (BullMQ moves to failed set)

### Functional -- Priority
- [ ] CREATE jobs enqueued with priority 300
- [ ] SYNC/UPDATE jobs enqueued with priority 500
- [ ] DELIST jobs enqueued with priority 100
- [ ] BullMQ processes higher priority (lower number) jobs first

### Functional -- Rate Limiting
- [ ] Worker checks per-channel per-seller rate limit before executing
- [ ] Rate limits match `channel-registry.ts` values (eBay: 200/hr, Poshmark: 60/hr, Mercari: 150/hr)
- [ ] When rate limit exceeded, job is delayed (not failed)

### Functional -- Cancellation
- [ ] `cancelJob` action cancels jobs with status `PENDING` or `QUEUED`
- [ ] `cancelJob` action rejects cancellation of `IN_PROGRESS` jobs
- [ ] `cancelJob` removes BullMQ job from queue when `bullmqJobId` exists
- [ ] `cancelJob` sets `crossJob.status` to `CANCELED`
- [ ] `cancelJob` reverts projection status from `QUEUED` to `DRAFT` for CREATE jobs

### Functional -- Pending Sync
- [ ] `updateProjectionOverrides` enqueues UPDATE job when `hasPendingSync` is true and projection is ACTIVE
- [ ] Sync jobs do NOT consume publish credits

### Functional -- Queue Status
- [ ] `getJobQueueStatus` action returns counts by status for authenticated seller
- [ ] Crosslister dashboard page displays queue status card
- [ ] Queue status card shows queued, in-progress, and failed counts

### Functional -- Delist Enqueue
- [ ] `delistFromChannel` action enqueues DELIST job instead of executing inline
- [ ] DELIST jobs have priority 100 (higher than publish at 300)

### Authorization
- [ ] `publishListings` requires `create ChannelProjection` CASL permission
- [ ] `cancelJob` requires `delete CrossJob` CASL permission
- [ ] `delistFromChannel` requires `delete ChannelProjection` CASL permission
- [ ] `getJobQueueStatus` requires `read CrossJob` CASL permission
- [ ] All actions verify `sellerId` matches session user (ownership check)
- [ ] Unauthenticated users cannot access any crosslister action

### Data Integrity
- [ ] All monetary values stored as integer cents
- [ ] Every crossJob has a unique `idempotencyKey`
- [ ] `bullmqJobId` links crossJob to BullMQ job for cancellation
- [ ] No orphaned projections in QUEUED state if job fails permanently

### Vocabulary
- [ ] No banned terms in any created/modified file
- [ ] UI text says "queued" not "pending" for user-facing status
- [ ] UI says "XLister" not "Crosslister subscription" or "Lister plan"

### Backward Compatibility
- [ ] Existing `publish-meter.ts` continues to work (no interface change)
- [ ] Existing `listing-transform.ts` continues to work (no interface change)
- [ ] Existing `policy-validator.ts` continues to work (no interface change)
- [ ] Existing connector implementations continue to work (no interface change)
- [ ] All existing tests still pass (test count >= baseline)

---

## 6. TEST REQUIREMENTS

### Unit Tests

**`src/lib/crosslister/queue/__tests__/lister-queue.test.ts` (NEW)**
- `listerPublishQueue` is created with name 'lister:publish'
- Queue accepts `ListerPublishJobData` shaped payloads
- Job options include exponential backoff configuration

**`src/lib/crosslister/queue/__tests__/rate-limiter.test.ts` (NEW)**
- `checkRateLimit` returns true when under limit
- `checkRateLimit` returns false when limit exceeded
- `recordRequest` increments the count
- Sliding window expires old entries after 1 hour
- `getDelayMs` returns 0 when under limit
- `getDelayMs` returns positive ms when limit exceeded
- Different channel+seller combos have independent buckets

**`src/lib/crosslister/services/__tests__/job-executor.test.ts` (NEW)**
- `executeCreateJob` calls connector.createListing with transformed data
- `executeCreateJob` updates projection to ACTIVE on success
- `executeCreateJob` updates projection to ERROR on non-retryable failure
- `executeCreateJob` returns retryable=true for transient errors
- `executeUpdateJob` calls connector.updateListing
- `executeDelistJob` calls connector.delistListing
- `executeDelistJob` updates projection to DELISTED on success

**`src/lib/crosslister/services/__tests__/publish-service.test.ts` (MODIFY)**
- Existing tests must be updated to reflect new return type (`PublishEnqueueResult`)
- New test: `publishListingToChannel` creates crossJob with status QUEUED
- New test: `publishListingToChannel` adds job to BullMQ queue
- New test: `publishListingToChannel` populates bullmqJobId on crossJob
- New test: returns early without calling connector (connector NOT called during enqueue)
- Existing tests that check projection status ACTIVE after publish need to be updated -- projection is now QUEUED after enqueue, ACTIVE after worker execution

**`src/lib/crosslister/queue/__tests__/lister-worker.test.ts` (NEW)**
- Worker processor calls `executeCreateJob` for CREATE job type
- Worker processor calls `executeUpdateJob` for UPDATE job type
- Worker processor calls `executeDelistJob` for DELIST job type
- Worker updates crossJob status to IN_PROGRESS at start
- Worker updates crossJob status to COMPLETED on success
- Worker updates crossJob status to FAILED on failure
- Worker sets crossJob.lastError on failure

**`src/lib/actions/__tests__/crosslister-publish.test.ts` (MODIFY or NEW)**
- `publishListings` returns `{ queued: N }` instead of `{ published: N }`
- `cancelJob` cancels QUEUED jobs
- `cancelJob` rejects IN_PROGRESS jobs
- `cancelJob` reverts projection to DRAFT
- `getJobQueueStatus` returns correct counts
- `delistFromChannel` enqueues DELIST job (does not execute inline)
- `updateProjectionOverrides` enqueues SYNC job when hasPendingSync

### Test Patterns (Follow Existing Conventions)
- Mock `db` with `vi.mock('@/lib/db', ...)` using selectChain/insertChain helpers
- Mock BullMQ with `vi.mock('bullmq', ...)` -- mock Queue.add() to return job ID
- Mock connectors with `vi.mock('@/lib/crosslister/connector-registry', ...)`
- Mock `authorize` with `vi.mock('@/lib/casl', ...)`
- Use `beforeEach(() => { vi.clearAllMocks(); })` for test isolation
- Follow the `fromCall` counter pattern used in existing publish-service tests

### Edge Cases to Cover
- Enqueue with 0 listings (should reject via Zod validation)
- Enqueue 500 listings x 3 channels = 1500 jobs (max boundary)
- Cancel a job that doesn't exist (should return error)
- Cancel a job owned by different seller (should return "Not found")
- Rate limit exceeded (job should be delayed, not failed)
- Worker picks up job for disabled channel (feature flag off) -- should fail gracefully
- Worker picks up job for disconnected account (status REVOKED) -- should fail gracefully
- BullMQ queue connection failure (Valkey down) -- should handle error gracefully

---

## 7. FILE APPROVAL LIST

### New Files (12)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/crosslister/queue/lister-queue.ts` | BullMQ queue definition + job data interface |
| 2 | `src/lib/crosslister/queue/lister-worker.ts` | BullMQ worker that processes publish jobs |
| 3 | `src/lib/crosslister/queue/rate-limiter.ts` | In-memory sliding window rate limiter per channel+seller |
| 4 | `src/lib/crosslister/queue/worker-init.ts` | Worker lifecycle init (imported by instrumentation.ts) |
| 5 | `src/lib/crosslister/services/job-executor.ts` | Extracted connector execution logic for CREATE/UPDATE/DELIST |
| 6 | `src/components/crosslister/queue-status-card.tsx` | Queue summary card for dashboard |
| 7 | `src/lib/crosslister/queue/__tests__/lister-queue.test.ts` | Queue setup tests |
| 8 | `src/lib/crosslister/queue/__tests__/rate-limiter.test.ts` | Rate limiter tests |
| 9 | `src/lib/crosslister/queue/__tests__/lister-worker.test.ts` | Worker processor tests |
| 10 | `src/lib/crosslister/services/__tests__/job-executor.test.ts` | Job executor tests |
| 11 | `src/lib/actions/__tests__/crosslister-publish-queue.test.ts` | Server action tests for queue pattern |
| 12 | `src/lib/crosslister/queue/constants.ts` | Priority constants, backoff configs, queue names |

### Modified Files (5)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/crosslister/services/publish-service.ts` | Refactor: enqueue instead of inline execute |
| 2 | `src/lib/actions/crosslister-publish.ts` | Refactor: async return, add cancelJob + getJobQueueStatus |
| 3 | `src/lib/queries/crosslister.ts` | Add `getSellerQueueStatus()` query |
| 4 | `src/app/(hub)/my/selling/crosslist/page.tsx` | Add queue status to dashboard |
| 5 | `src/instrumentation.ts` | Add worker initialization (create if not exists) |

### Modified Test Files (2)

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `src/lib/crosslister/services/__tests__/publish-service.test.ts` | Update for new enqueue return type |
| 2 | `src/lib/crosslister/services/__tests__/publish-service-edge.test.ts` | Update for new enqueue return type (if affected) |

---

## 8. PARALLEL STREAMS

This step can be decomposed into two parallel streams that converge at the end:

### Stream A: Queue Infrastructure (can start immediately)
1. `queue/constants.ts` -- priority values, backoff configs
2. `queue/rate-limiter.ts` + tests
3. `queue/lister-queue.ts` + tests
4. `services/job-executor.ts` + tests (extract execution logic)
5. `queue/lister-worker.ts` + tests

### Stream B: Action Refactor + UI (can start immediately, converges with A)
1. Refactor `publish-service.ts` return type + enqueue pattern
2. Refactor `crosslister-publish.ts` actions (publishListings, delistFromChannel, cancelJob, getJobQueueStatus)
3. Update `queries/crosslister.ts` with queue status query
4. Create `queue-status-card.tsx` component
5. Update crosslister dashboard page

### Convergence
- `worker-init.ts` + `instrumentation.ts` (depends on both streams)
- Update existing publish-service tests (depends on refactored return type)
- Final integration verification

**Recommended build order if sequential:** constants -> rate-limiter -> lister-queue -> job-executor -> refactor publish-service -> refactor actions -> lister-worker -> worker-init -> instrumentation -> queue-status UI -> tests

---

## 9. VERIFICATION CHECKLIST

After implementation, run ALL of these and paste the RAW output:

```bash
# 1. TypeScript check
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Banned terms grep
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC.*StoreTier\|ELITE.*StoreTier\|PLUS.*ListerTier\|MAX.*ListerTier\|PREMIUM\|Twicely Balance\|wallet.*seller\|Withdraw.*seller" src/lib/crosslister/queue/ src/lib/crosslister/services/job-executor.ts src/lib/actions/crosslister-publish.ts src/components/crosslister/queue-status-card.tsx src/app/\(hub\)/my/selling/crosslist/page.tsx

# 4. Route prefix check (no wrong routes)
grep -rn '"/l/\|"/listing/\|"/store/\|"/shop/\|"/dashboard\|"/admin\|"/search"' src/lib/crosslister/queue/ src/components/crosslister/queue-status-card.tsx

# 5. File size check
wc -l src/lib/crosslister/queue/*.ts src/lib/crosslister/services/job-executor.ts src/lib/actions/crosslister-publish.ts src/components/crosslister/queue-status-card.tsx

# 6. as any / ts-ignore check
grep -rn 'as any\|@ts-ignore\|@ts-expect-error\|as unknown as' src/lib/crosslister/queue/ src/lib/crosslister/services/job-executor.ts

# 7. Console.log check
grep -rn 'console.log' src/lib/crosslister/queue/ src/lib/crosslister/services/job-executor.ts src/lib/actions/crosslister-publish.ts src/components/crosslister/queue-status-card.tsx

# 8. Verify BullMQ import (not Bull)
grep -rn "from 'bull'" src/lib/crosslister/queue/ | grep -v bullmq

# 9. Verify Valkey (not Redis) in comments
grep -rni "redis" src/lib/crosslister/queue/ | grep -vi valkey | grep -vi "maxRetriesPerRequest"
```

### Expected Outcomes
1. TypeScript: 0 errors
2. Tests: >= BASELINE_TESTS (currently 3076 per build tracker)
3. Banned terms: 0 matches
4. Wrong routes: 0 matches
5. All new files under 300 lines
6. Zero `as any` / `@ts-ignore`
7. Zero `console.log`
8. Zero bare `bull` imports (only `bullmq`)
9. Zero `redis` references (only `valkey`)

---

## 10. IMPLEMENTATION NOTES

### What This Step Does NOT Build
- Emergency delist queue (separate `lister:emergency-delist` queue) -- that's F5 scope
- Polling queue (`lister:polling`) -- Phase G scope
- Automation queue (`lister:automation`) -- Phase G scope
- Centrifugo real-time job updates -- Phase G scope (polling fallback is fine)
- Valkey-backed rate limiter -- in-memory is V1
- Dedicated worker process -- in-process is V1 (Railway single container)
- BullMQ dashboard admin page (`hub.twicely.co/jobs`) -- separate admin step
- Scheduler fairness algorithm (per-seller fair-share) -- V2 enhancement
- Circuit breakers -- V2 enhancement (worker handles errors, but no circuit breaker pattern yet)

### Architecture Decisions Locked
- **Decision #62 (Railway):** Workers run in-process, not as separate dynos
- **Decision #31 (No off-platform fees):** Crosslister jobs never trigger fee calculations
- **Decision #17 (Crosslister supply engine):** Queue infrastructure supports the flywheel -- high throughput, no artificial bottlenecks
- **Lister Canonical section 1:** "Unlimited intent, controlled execution" -- seller queues everything immediately, scheduler paces execution

### Key Behavioral Change for Users
- **Before (F3):** "Publish" button blocks UI until all connector calls complete. Seller waits 5-30 seconds for results. Immediate success/failure feedback.
- **After (F3.1):** "Publish" button returns instantly with "X jobs queued." Seller sees queue status on dashboard. Results arrive asynchronously. Much better UX for bulk operations (500 listings x 3 platforms = instant return vs 25+ minute wait).
