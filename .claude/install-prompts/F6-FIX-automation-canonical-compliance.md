# [F6-FIX] Automation Canonical Compliance Fixes

**Phase & Step:** F6-FIX (post-F6/F6.1 compliance repair)
**Feature Name:** Automation Canonical Compliance Fixes
**One-line Summary:** Fix 5 gaps between the installed F6 automation code and the Lister Canonical + Pricing Canonical requirements: auth pattern, feature flags, retry strategy, per-seller circuit breaker, and follow/unfollow engine.
**Canonical Sources:**
- `read-me/TWICELY_V3_LISTER_CANONICAL.md` — Sections 16.3, 17.1, 17.3, 24.2, 27.1
- `read-me/TWICELY_V3_ACTORS_SECURITY_CANONICAL.md` — Section 2 (CASL), delegation
- `read-me/TWICELY_V3_PAGE_REGISTRY.md` — Row 60
- `read-me/TWICELY_V3_PRICING_PAYMENTS_PAYOUT_CANONICAL_v3_2.md` — Section 8 (automation pricing)
- `read-me/TWICELY_V3_FEATURE_LOCKIN_ALL_DOMAINS.md` — crosslister automation rules

---

## 1. PREREQUISITES

**Completed phases:** F6 and F6.1 are fully installed (build tracker v1.31, 3490 tests).

**Existing files that must already exist (verified):**
- `src/lib/crosslister/automation/auto-relist-engine.ts` (159 lines)
- `src/lib/crosslister/automation/price-drop-engine.ts` (219 lines)
- `src/lib/crosslister/automation/offer-to-likers-engine.ts` (177 lines)
- `src/lib/crosslister/automation/posh-share-engine.ts` (169 lines)
- `src/lib/crosslister/automation/automation-scheduler.ts` (62 lines)
- `src/lib/crosslister/automation/constants.ts` (52 lines)
- `src/lib/crosslister/queue/automation-queue.ts` (25 lines)
- `src/lib/crosslister/queue/automation-worker.ts` (146 lines)
- `src/lib/crosslister/queue/circuit-breaker.ts` (157 lines)
- `src/lib/crosslister/connector-interface.ts` (70 lines)
- `src/lib/jobs/queue.ts` (34 lines)
- `src/lib/db/seed/v32-platform-settings.ts`
- `src/lib/casl/authorize.ts` (93 lines)
- `src/app/(hub)/my/selling/crosslist/automation/page.tsx` (146 lines)

**Key schema facts (verified against actual enums.ts):**
- `publishJobTypeEnum`: `['CREATE', 'UPDATE', 'DELIST', 'RELIST', 'SYNC', 'VERIFY']` — NEVER use canonical doc's PUBLISH/IMPORT/etc.
- `publishJobStatusEnum`: `['PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED']`
- `crossJob.maxAttempts` default is 3 (schema line 108)
- `channelProjection.sellerId` is `text('seller_id')` referencing user.id
- `channelProjection.externalId` is `text('external_id')` (NOT `externalListingId`)

---

## 2. SCOPE — EXACTLY WHAT TO BUILD

### FIX 1: Page Auth — Switch to `authorize()` with delegation + CASL

**File:** `src/app/(hub)/my/selling/crosslist/automation/page.tsx`

**Problem:** Uses `auth.api.getSession()` + `headers()` instead of `authorize()`. Missing CASL gate and delegation support. Per Page Registry Row 60: gate is "SELLER or DELEGATE(crosslister.manage)".

**Changes:**
1. Remove imports: `import { headers } from 'next/headers'` and `import { auth } from '@/lib/auth'`
2. Add import: `import { authorize } from '@/lib/casl/authorize'`
3. Replace the auth block:

```typescript
// BEFORE (wrong):
const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user) { redirect(...); }
if (!session.user.isSeller) { redirect(...); }
const userId = session.user.id;

// AFTER (correct):
const { session, ability } = await authorize();
if (!session) {
  redirect('/auth/login?callbackUrl=/my/selling/crosslist/automation');
}
// Delegation: if delegate, operate on behalf of the seller they're delegated to
const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
// CASL gate: seller (isSeller) or delegate with crosslister.manage scope
if (!session.isSeller && !session.delegationId) {
  redirect('/my/selling/onboarding');
}
```

4. The `isSeller` check on the original code redirected to onboarding. With delegation, a non-seller delegate with `crosslister.manage` scope should be able to access this page. The CASL ability already handles this (see `ability.ts` line 225 and `staff-abilities.ts` line 139). The page does not need an explicit `ability.can()` check because the queries themselves are scoped to `userId` which is derived from the delegation context.

**Reference pattern:** `src/app/(hub)/my/settings/notifications/page.tsx` (lines 1-15)

---

### FIX 2: Per-Platform Feature Flag Check in All Engines

**Canonical:** Lister Canonical Section 27.1: `automation.{platform}.enabled` — controls whether automation features are available for each platform.

**Problem:** No engine checks if automation is enabled for the specific platform before processing.

**Fix — Add to each engine:**

In all 4 engines, BEFORE creating crossJob entries for a projection, check the platform feature flag. Import `getPlatformSetting` where not already imported.

**auto-relist-engine.ts** — Inside the `for (const proj of projections)` loop, BEFORE the connector capability check:
```typescript
// Check platform automation feature flag
const platformEnabled = await getPlatformSetting<boolean>(
  `automation.${proj.channel.toLowerCase()}.enabled`,
  true // default enabled if not seeded
);
if (!platformEnabled) continue;
```
Add import: `import { getPlatformSetting } from '@/lib/queries/platform-settings';`

**price-drop-engine.ts** — Inside the `for (const proj of projections)` loop (the inner loop at line 190 that iterates per projection), BEFORE creating the crossJob:
```typescript
const platformEnabled = await getPlatformSetting<boolean>(
  `automation.${proj.channel.toLowerCase()}.enabled`,
  true
);
if (!platformEnabled) continue;
```
Add import (not already imported).

**offer-to-likers-engine.ts** — Inside the `for (const proj of projections)` loop, BEFORE the connector capability check:
```typescript
const platformEnabled = await getPlatformSetting<boolean>(
  `automation.${proj.channel.toLowerCase()}.enabled`,
  true
);
if (!platformEnabled) continue;
```
Add import: `import { getPlatformSetting } from '@/lib/queries/platform-settings';`

**posh-share-engine.ts** — At the START of `processSellerSharing()`, check POSHMARK specifically:
```typescript
const platformEnabled = await getPlatformSetting<boolean>(
  'automation.poshmark.enabled',
  true
);
if (!platformEnabled) return;
```
`getPlatformSetting` is already imported in this file.

**Seed file** — Add 8 new platform settings to `src/lib/db/seed/v32-platform-settings.ts`:
```typescript
{ key: 'automation.ebay.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for eBay' },
{ key: 'automation.poshmark.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Poshmark' },
{ key: 'automation.mercari.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Mercari' },
{ key: 'automation.depop.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Depop' },
{ key: 'automation.fb_marketplace.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Facebook Marketplace' },
{ key: 'automation.etsy.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Etsy' },
{ key: 'automation.grailed.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for Grailed' },
{ key: 'automation.therealreal.enabled', value: true, type: 'boolean', category: 'automation', description: 'Enable automation features for TheRealReal' },
```

---

### FIX 3: Retry Strategy — Max 2 Attempts for Automation Jobs

**Canonical:** Lister Canonical Section 24.2: AUTOMATION jobs have max 2 attempts, 60s/300s backoff, dead-letter after 2 failures.

**Part A — crossJob maxAttempts in engines:**

In all 4 engines, when inserting `crossJob` rows, add `maxAttempts: 2`.

**auto-relist-engine.ts** — line 137 `db.insert(crossJob).values({...})` — add field:
```typescript
maxAttempts: AUTOMATION_MAX_ATTEMPTS,
```

**price-drop-engine.ts** — line 193 `db.insert(crossJob).values({...})` — add field:
```typescript
maxAttempts: AUTOMATION_MAX_ATTEMPTS,
```

**offer-to-likers-engine.ts** — line 153 `db.insert(crossJob).values({...})` — add field:
```typescript
maxAttempts: AUTOMATION_MAX_ATTEMPTS,
```

**posh-share-engine.ts** — line 147 `db.insert(crossJob).values({...})` — add field:
```typescript
maxAttempts: AUTOMATION_MAX_ATTEMPTS,
```

**Part B — Constants:**

Add to `src/lib/crosslister/automation/constants.ts`:
```typescript
/** Max retry attempts for AUTOMATION jobs (Lister Canonical Section 24.2). */
export const AUTOMATION_MAX_ATTEMPTS = 2;

/** Backoff delays in ms for AUTOMATION jobs: 60s first retry, 300s second. */
export const AUTOMATION_BACKOFF_DELAYS = [60_000, 300_000] as const;
```

**Part C — BullMQ Queue default job options:**

Modify `src/lib/jobs/queue.ts` to accept optional `defaultJobOptions`:

```typescript
import { Queue, Worker, type ConnectionOptions, type Processor, type QueueOptions } from 'bullmq';

// ... connection unchanged ...

export function createQueue<T>(
  name: string,
  opts?: Pick<QueueOptions, 'defaultJobOptions'>,
): Queue<T> {
  return new Queue<T>(name, { connection, ...opts });
}
```

Modify `src/lib/crosslister/queue/automation-queue.ts`:
```typescript
import { createQueue } from '@/lib/jobs/queue';
import { LISTER_AUTOMATION_QUEUE } from './constants';
import { AUTOMATION_MAX_ATTEMPTS, AUTOMATION_BACKOFF_DELAYS } from '../automation/constants';

// ... AutomationJobData interface unchanged ...

export const automationQueue = createQueue<AutomationJobData>(LISTER_AUTOMATION_QUEUE, {
  defaultJobOptions: {
    attempts: AUTOMATION_MAX_ATTEMPTS,
    backoff: {
      type: 'fixed',
      delay: AUTOMATION_BACKOFF_DELAYS[0], // 60s — BullMQ uses this for first retry
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
```

Note: BullMQ `fixed` backoff applies the same delay for all retries. With `attempts: 2` there is only 1 retry, so the first delay (60s) is correct. The 300s second delay from the canonical is moot because jobs dead-letter after 2 total attempts (1 initial + 1 retry).

---

### FIX 4: Per-Seller Automation Circuit Breaker

**Canonical:** Lister Canonical Section 16.3: "Circuit breaker: 3 failures → pause for 1 hour, 5 failures → pause for 24 hours."

**Problem:** The existing circuit breaker in `src/lib/crosslister/queue/circuit-breaker.ts` is per-platform (global), not per-seller. The canonical requires per-seller escalating thresholds for Poshmark automation specifically.

**New file:** `src/lib/crosslister/automation/automation-circuit-breaker.ts` (~90 lines)

This is a per-SELLER in-memory circuit breaker with 2 escalating levels:

```typescript
/**
 * Per-seller automation circuit breaker.
 * Escalating pause: 3 failures → 1 hour, 5 failures → 24 hours.
 * Spec: Lister Canonical Section 16.3.
 *
 * In-memory (V1). Valkey-backed version planned for Phase G.
 */

import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@/lib/logger';

interface SellerCircuitState {
  consecutiveFailures: number;
  pausedUntil: number; // epoch ms, 0 = not paused
}

const sellerCircuits = new Map<string, SellerCircuitState>();

// Cache thresholds (read once, cached for process lifetime)
let thresholds: {
  level1Failures: number;
  level1PauseMs: number;
  level2Failures: number;
  level2PauseMs: number;
} | null = null;

async function loadThresholds() {
  if (thresholds) return thresholds;
  const [l1f, l1p, l2f, l2p] = await Promise.all([
    getPlatformSetting<number>('automation.circuitBreaker.level1Failures', 3),
    getPlatformSetting<number>('automation.circuitBreaker.level1PauseMs', 3_600_000),
    getPlatformSetting<number>('automation.circuitBreaker.level2Failures', 5),
    getPlatformSetting<number>('automation.circuitBreaker.level2PauseMs', 86_400_000),
  ]);
  thresholds = {
    level1Failures: l1f,
    level1PauseMs: l1p,
    level2Failures: l2f,
    level2PauseMs: l2p,
  };
  return thresholds;
}

export async function canPerformAutomation(sellerId: string): Promise<boolean> {
  const state = sellerCircuits.get(sellerId);
  if (!state) return true;
  if (state.pausedUntil === 0) return true;
  if (Date.now() >= state.pausedUntil) {
    // Pause expired — allow but don't reset failures (next failure re-pauses)
    state.pausedUntil = 0;
    return true;
  }
  return false;
}

export async function recordAutomationSuccess(sellerId: string): Promise<void> {
  // Success resets consecutive failures entirely
  sellerCircuits.set(sellerId, { consecutiveFailures: 0, pausedUntil: 0 });
}

export async function recordAutomationFailure(sellerId: string): Promise<void> {
  const t = await loadThresholds();
  const state = sellerCircuits.get(sellerId) ?? { consecutiveFailures: 0, pausedUntil: 0 };
  state.consecutiveFailures += 1;

  if (state.consecutiveFailures >= t.level2Failures) {
    state.pausedUntil = Date.now() + t.level2PauseMs;
    logger.warn('[automationCircuitBreaker] Level 2 pause (24h)', {
      sellerId,
      failures: state.consecutiveFailures,
    });
  } else if (state.consecutiveFailures >= t.level1Failures) {
    state.pausedUntil = Date.now() + t.level1PauseMs;
    logger.warn('[automationCircuitBreaker] Level 1 pause (1h)', {
      sellerId,
      failures: state.consecutiveFailures,
    });
  }

  sellerCircuits.set(sellerId, state);
}

/** Reset all circuits (tests only). */
export function resetAllSellerCircuits(): void {
  sellerCircuits.clear();
  thresholds = null;
}
```

**Wire into automation-worker.ts:**

After successful job completion, call `recordAutomationSuccess(sellerId)`.
After job failure, call `recordAutomationFailure(sellerId)`.

Add import:
```typescript
import {
  recordAutomationSuccess,
  recordAutomationFailure,
} from '../automation/automation-circuit-breaker';
```

In the `processAutomationJob` function, wrap the engine dispatch in try/catch:
- On success (no throw): `await recordAutomationSuccess(sellerId);` then mark crossJob COMPLETED.
- On failure (catch): `await recordAutomationFailure(sellerId);` then mark crossJob FAILED.

Currently the worker does NOT mark COMPLETED — it only marks IN_PROGRESS and FAILED. Add a `markCompleted` helper:
```typescript
async function markCompleted(crossJobId: string, result: Record<string, unknown>): Promise<void> {
  await db.update(crossJob).set({
    status: 'COMPLETED',
    completedAt: new Date(),
    result,
    updatedAt: new Date(),
  }).where(eq(crossJob.id, crossJobId));
}
```

Each engine branch should call `markCompleted` on success and the circuit breaker accordingly.

**Wire into posh-share-engine.ts (and posh-follow-engine.ts):**

At the start of `processSellerSharing()`, after the Poshmark account check:
```typescript
import { canPerformAutomation } from './automation-circuit-breaker';

// In processSellerSharing, after poshAccount check:
const circuitOk = await canPerformAutomation(userId);
if (!circuitOk) {
  logger.warn('[poshShareEngine] Seller paused by circuit breaker', { userId });
  return;
}
```

**Seed file** — Add 4 new platform settings:
```typescript
{ key: 'automation.circuitBreaker.level1Failures', value: 3, type: 'number', category: 'automation', description: 'Consecutive failures before Level 1 automation pause' },
{ key: 'automation.circuitBreaker.level1PauseMs', value: 3600000, type: 'number', category: 'automation', description: 'Level 1 automation pause duration (1 hour)' },
{ key: 'automation.circuitBreaker.level2Failures', value: 5, type: 'number', category: 'automation', description: 'Consecutive failures before Level 2 automation pause' },
{ key: 'automation.circuitBreaker.level2PauseMs', value: 86400000, type: 'number', category: 'automation', description: 'Level 2 automation pause duration (24 hours)' },
```

---

### FIX 5: Poshmark Follow/Unfollow Engine

**Canonical:** Lister Canonical Section 16.3 Mode 3 actions include "Follow/unfollow (grow follower base)". Section 17.1 features table lists "Follow/unfollow | Poshmark | Grow follower base automatically".

**New file:** `src/lib/crosslister/automation/posh-follow-engine.ts` (~130 lines)

Follow the exact pattern of `posh-share-engine.ts`:
- Query sellers with `hasAutomation = true` AND `poshShareEnabled = true` (follow/unfollow is part of Mode 3 Poshmark automation, governed by the same toggle)
- Check `automation.poshmark.enabled` feature flag
- Check seller has ACTIVE Poshmark account
- Check automation meter (`canPerformAutomationAction`)
- Check per-seller circuit breaker (`canPerformAutomation`)
- Count today's follow jobs already created (separate from share count)
- Daily follow limit from platform_settings: `automation.poshmark.dailyFollowLimit` (default: 50)
- Create SYNC crossJobs with `automationEngine: 'POSH_FOLLOW'` and `maxAttempts: AUTOMATION_MAX_ATTEMPTS`
- Idempotency key: `posh-follow:{accountId}:{monthKey}:{tsKey}`

```typescript
/**
 * Posh Follow/Unfollow Engine (F6-FIX)
 *
 * Grows seller follower base on Poshmark by following relevant users.
 * Part of Mode 3 Poshmark automation (Section 16.3).
 * Enabled when poshShareEnabled is true (same Mode 3 toggle).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { db } from '@/lib/db';
import {
  sellerProfile,
  automationSetting,
  crosslisterAccount,
  crossJob,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { canPerformAutomationAction } from '../services/automation-meter';
import { canPerformAutomation } from './automation-circuit-breaker';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  AUTOMATION_JOB_PRIORITY,
  AUTOMATION_ENGINE,
  AUTOMATION_MAX_ATTEMPTS,
  POSH_DAILY_FOLLOW_LIMIT_SETTING,
  POSH_DAILY_FOLLOW_LIMIT_DEFAULT,
} from './constants';

export async function runPoshFollowEngine(): Promise<void> {
  logger.info('[poshFollowEngine] Starting run');

  // Check platform feature flag
  const platformEnabled = await getPlatformSetting<boolean>(
    'automation.poshmark.enabled',
    true,
  );
  if (!platformEnabled) {
    logger.info('[poshFollowEngine] Poshmark automation disabled — skipping');
    return;
  }

  const sellers = await db
    .select({
      userId: sellerProfile.userId,
    })
    .from(sellerProfile)
    .innerJoin(automationSetting, eq(automationSetting.sellerId, sellerProfile.userId))
    .where(
      and(
        eq(sellerProfile.hasAutomation, true),
        eq(automationSetting.poshShareEnabled, true), // follow/unfollow uses same Mode 3 toggle
      ),
    );

  logger.info('[poshFollowEngine] Found eligible sellers', { count: sellers.length });

  const dailyLimit = await getPlatformSetting<number>(
    POSH_DAILY_FOLLOW_LIMIT_SETTING,
    POSH_DAILY_FOLLOW_LIMIT_DEFAULT,
  );

  for (const seller of sellers) {
    await processSellerFollows(seller.userId, dailyLimit);
  }

  logger.info('[poshFollowEngine] Run complete');
}

async function processSellerFollows(
  userId: string,
  dailyLimit: number,
): Promise<void> {
  // 1. Verify ACTIVE Poshmark account
  const [poshAccount] = await db
    .select({ id: crosslisterAccount.id })
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.sellerId, userId),
        eq(crosslisterAccount.channel, 'POSHMARK'),
        eq(crosslisterAccount.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  if (!poshAccount) return;

  // 2. Circuit breaker check
  const circuitOk = await canPerformAutomation(userId);
  if (!circuitOk) {
    logger.warn('[poshFollowEngine] Seller paused by circuit breaker', { userId });
    return;
  }

  // 3. Automation meter check
  const meter = await canPerformAutomationAction(userId);
  if (!meter.allowed) {
    logger.warn('[poshFollowEngine] Seller at action limit — skipping', { userId });
    return;
  }

  // 4. Count follow jobs already created today
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const [todayCount] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(crossJob)
    .where(
      and(
        eq(crossJob.sellerId, userId),
        sql`${crossJob.payload}->>'automationEngine' = ${AUTOMATION_ENGINE.POSH_FOLLOW}`,
        sql`${crossJob.createdAt} >= ${dayStart}`,
      ),
    );

  const followsToday = todayCount?.total ?? 0;
  const remainingSlots = dailyLimit - followsToday;
  if (remainingSlots <= 0) return;

  // 5. Create follow jobs (up to remaining daily limit)
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  let actionsCreated = 0;

  for (let i = 0; i < remainingSlots; i++) {
    const currentMeter = await canPerformAutomationAction(userId);
    if (!currentMeter.allowed) break;

    const tsKey = Date.now() + actionsCreated;
    const idempotencyKey = `posh-follow:${poshAccount.id}:${monthKey}:${tsKey}`;

    await db.insert(crossJob).values({
      sellerId: userId,
      accountId: poshAccount.id,
      jobType: 'SYNC',
      priority: AUTOMATION_JOB_PRIORITY,
      idempotencyKey,
      status: 'PENDING',
      maxAttempts: AUTOMATION_MAX_ATTEMPTS,
      payload: {
        automationEngine: AUTOMATION_ENGINE.POSH_FOLLOW,
        channel: 'POSHMARK',
        accountId: poshAccount.id,
      },
    });

    actionsCreated++;
  }

  if (actionsCreated > 0) {
    logger.info('[poshFollowEngine] Created follow jobs', { userId, actionsCreated });
  }
}
```

**Note:** The follow engine creates SYNC-type crossJobs (like posh-share) because follow/unfollow is a non-publish maintenance action. No `projectionId` since follow actions target accounts, not specific listings.

**Constants additions** to `src/lib/crosslister/automation/constants.ts`:
```typescript
/** Platform setting key for Poshmark daily follow limit. */
export const POSH_DAILY_FOLLOW_LIMIT_SETTING = 'automation.poshmark.dailyFollowLimit';

/** Fallback Poshmark daily follow limit per seller. */
export const POSH_DAILY_FOLLOW_LIMIT_DEFAULT = 50;
```

Add to `AUTOMATION_ENGINE`:
```typescript
export const AUTOMATION_ENGINE = {
  AUTO_RELIST: 'AUTO_RELIST',
  PRICE_DROP: 'PRICE_DROP',
  OFFER_TO_LIKERS: 'OFFER_TO_LIKERS',
  POSH_SHARE: 'POSH_SHARE',
  POSH_FOLLOW: 'POSH_FOLLOW',
} as const;
```

**Update `AutomationEngine` type** — this happens automatically since it derives from `AUTOMATION_ENGINE`.

**Connector interface** — Add optional method to `src/lib/crosslister/connector-interface.ts`:
```typescript
// After shareListing:
followUser?(account: CrosslisterAccount, targetUserId: string): Promise<UpdateResult>;
```

**AutomationJobData** — Update `src/lib/crosslister/queue/automation-queue.ts`:
```typescript
automationEngine: 'AUTO_RELIST' | 'PRICE_DROP' | 'OFFER_TO_LIKERS' | 'POSH_SHARE' | 'POSH_FOLLOW';
```

**Automation scheduler** — Add to `src/lib/crosslister/automation/automation-scheduler.ts`:
```typescript
import { runPoshFollowEngine } from './posh-follow-engine';

// In runAutomationTick(), after posh-share block:
await runPoshFollowEngine().catch((err) => {
  logger.error('[automationScheduler] poshFollowEngine failed', { error: String(err) });
});
```

**Automation worker** — Add POSH_FOLLOW branch to `src/lib/crosslister/queue/automation-worker.ts`:
```typescript
if (automationEngine === 'POSH_FOLLOW') {
  const [accountRow] = await db.select().from(crosslisterAccount).where(eq(crosslisterAccount.id, accountId)).limit(1);
  if (!accountRow) {
    await markFailed(crossJobId, 'Account not found.', (job.attemptsMade ?? 0) + 1);
    await recordAutomationFailure(sellerId);
    return;
  }
  const connector = getConnector(externalChannel);
  if (!connector.followUser) {
    logger.info('[automationWorker] followUser not yet implemented — V1', { channel });
    await markFailed(crossJobId, 'Not implemented', (job.attemptsMade ?? 0) + 1);
    return;
  }
  const targetUserId = (job.data.payload?.targetUserId as string | undefined) ?? '';
  const result = await connector.followUser(accountRow, targetUserId);
  if (result.success) {
    await markCompleted(crossJobId, { followed: true });
    await recordAutomationSuccess(sellerId);
  } else {
    await markFailed(crossJobId, result.error ?? 'Follow failed', (job.attemptsMade ?? 0) + 1);
    await recordAutomationFailure(sellerId);
  }
  return;
}
```

**Seed file** — Add to `v32-platform-settings.ts`:
```typescript
{ key: 'automation.poshmark.dailyFollowLimit', value: 50, type: 'number', category: 'automation', description: 'Max Poshmark follow actions per seller per day' },
```

---

## 3. CONSTRAINTS — WHAT NOT TO DO

- Do NOT change any Drizzle schema files — no new tables or columns needed
- Do NOT add any new pgEnum values — the existing `publishJobTypeEnum` already has SYNC and RELIST
- Do NOT create a separate settings column for follow/unfollow — it uses `poshShareEnabled` (Mode 3 toggle)
- Do NOT use `as any` or `@ts-ignore` anywhere
- Do NOT hardcode retry counts or backoff delays — use constants from `constants.ts`
- Do NOT use the canonical doc's job status names (PENDING/SCHEDULED/RUNNING/DEAD_LETTERED/CANCELLED) — use actual enum values (PENDING/QUEUED/IN_PROGRESS/COMPLETED/FAILED/CANCELED)
- Do NOT add console.log — use `logger` from `@/lib/logger`
- All files must stay under 300 lines
- `channelProjection.externalId` is the correct column name (NOT `externalListingId`)

---

## 4. ACCEPTANCE CRITERIA

### FIX 1 (Page Auth):
- [ ] `authorize()` is used instead of `auth.api.getSession()`
- [ ] `headers` is NOT imported from `next/headers`
- [ ] `auth` is NOT imported from `@/lib/auth`
- [ ] `authorize` IS imported from `@/lib/casl/authorize`
- [ ] Delegation is supported: `userId` derives from `session.onBehalfOfSellerId` when delegated
- [ ] Non-authenticated users redirect to `/auth/login?callbackUrl=/my/selling/crosslist/automation`
- [ ] Non-seller non-delegate users redirect to `/my/selling/onboarding`

### FIX 2 (Feature Flags):
- [ ] `auto-relist-engine.ts` checks `automation.{channel}.enabled` before creating RELIST jobs
- [ ] `price-drop-engine.ts` checks `automation.{channel}.enabled` per projection before creating UPDATE jobs
- [ ] `offer-to-likers-engine.ts` checks `automation.{channel}.enabled` per projection before creating offer jobs
- [ ] `posh-share-engine.ts` checks `automation.poshmark.enabled` at the start of `processSellerSharing`
- [ ] 8 `automation.{platform}.enabled` platform settings are added to seed file
- [ ] All settings have `type: 'boolean'` and `category: 'automation'`
- [ ] Channel names in settings keys use lowercase (e.g., `automation.ebay.enabled`, `automation.fb_marketplace.enabled`)

### FIX 3 (Retry Strategy):
- [ ] All 4 engines insert crossJob with `maxAttempts: 2` (not the default 3)
- [ ] `AUTOMATION_MAX_ATTEMPTS = 2` is exported from `constants.ts`
- [ ] `AUTOMATION_BACKOFF_DELAYS = [60_000, 300_000]` is exported from `constants.ts`
- [ ] `createQueue` in `queue.ts` accepts optional `defaultJobOptions` parameter
- [ ] `automationQueue` is created with `attempts: 2` and `backoff` configuration
- [ ] The `createQueue` signature change does NOT break existing callers (the publish queue at `lister-queue.ts` still works without the second argument)

### FIX 4 (Circuit Breaker):
- [ ] `automation-circuit-breaker.ts` exists with `canPerformAutomation`, `recordAutomationSuccess`, `recordAutomationFailure`, `resetAllSellerCircuits`
- [ ] Level 1: 3 consecutive failures = 1 hour pause (3,600,000 ms)
- [ ] Level 2: 5 consecutive failures = 24 hour pause (86,400,000 ms)
- [ ] Success resets consecutive failures to 0
- [ ] Thresholds are loaded from platform_settings (not hardcoded)
- [ ] 4 circuit breaker platform settings are added to seed file
- [ ] `posh-share-engine.ts` checks `canPerformAutomation()` before processing each seller
- [ ] `automation-worker.ts` calls `recordAutomationSuccess` on successful job completion
- [ ] `automation-worker.ts` calls `recordAutomationFailure` on job failure
- [ ] Worker has a `markCompleted` helper that sets status to COMPLETED with timestamp

### FIX 5 (Follow Engine):
- [ ] `posh-follow-engine.ts` exists and follows the same pattern as `posh-share-engine.ts`
- [ ] Follow engine uses `poshShareEnabled` as its gate (not a separate toggle)
- [ ] Follow engine checks `automation.poshmark.enabled` feature flag
- [ ] Follow engine checks per-seller circuit breaker
- [ ] Follow engine checks automation meter
- [ ] Follow engine has a daily limit from `automation.poshmark.dailyFollowLimit` (default 50)
- [ ] Follow jobs use `jobType: 'SYNC'` (not a new enum value)
- [ ] Follow jobs have `maxAttempts: 2`
- [ ] Follow jobs have `automationEngine: 'POSH_FOLLOW'`
- [ ] `AUTOMATION_ENGINE.POSH_FOLLOW` is added to constants
- [ ] `followUser?` method is added to `PlatformConnector` interface
- [ ] `AutomationJobData.automationEngine` type includes `'POSH_FOLLOW'`
- [ ] `automation-scheduler.ts` dispatches `runPoshFollowEngine` on every tick
- [ ] `automation-worker.ts` handles `POSH_FOLLOW` engine type
- [ ] Seed file has `automation.poshmark.dailyFollowLimit` setting

### Global:
- [ ] No banned terms appear anywhere in new/modified code
- [ ] All files under 300 lines
- [ ] TypeScript compiles with zero errors
- [ ] Test count >= 3490 (current baseline from build tracker v1.31)
- [ ] No `as any`, `@ts-ignore`, `@ts-expect-error` in any file
- [ ] All monetary values remain as integer cents
- [ ] Ownership model uses `userId` throughout (never `storeId`)

---

## 5. TEST REQUIREMENTS

### New test files to create:

**`src/lib/crosslister/automation/__tests__/automation-circuit-breaker.test.ts`** (~120 lines)
Tests:
- `canPerformAutomation returns true when no failures recorded`
- `canPerformAutomation returns true after fewer than level1 failures`
- `canPerformAutomation returns false after 3 consecutive failures (level 1 pause)`
- `canPerformAutomation returns false after 5 consecutive failures (level 2 pause)`
- `canPerformAutomation returns true after level 1 pause expires`
- `recordAutomationSuccess resets consecutive failures to 0`
- `recordAutomationSuccess after pause allows automation again`
- `resetAllSellerCircuits clears all state`

Mock `getPlatformSetting` to return test thresholds. Use `vi.useFakeTimers()` to control time for pause expiry tests.

**`src/lib/crosslister/automation/__tests__/posh-follow-engine.test.ts`** (~130 lines)
Follow the exact pattern of `posh-share-engine.test.ts`. Tests:
- `finds eligible sellers and creates follow jobs`
- `skips when automation.poshmark.enabled is false`
- `skips seller without active Poshmark account`
- `skips seller paused by circuit breaker`
- `skips seller at action limit`
- `respects daily follow limit`
- `creates jobs with jobType=SYNC and automationEngine=POSH_FOLLOW`
- `creates jobs with maxAttempts=2`

### Existing test modifications:

Update existing engine tests to verify the new behavior. Add ONE test per engine:

**`auto-relist-engine.test.ts`** — add:
- `skips projection when platform automation is disabled` (mock getPlatformSetting to return false for the channel)
- `creates crossJob with maxAttempts=2`

**`price-drop-engine.test.ts`** — add:
- `skips projection when platform automation is disabled`
- `creates crossJob with maxAttempts=2`

**`offer-to-likers-engine.test.ts`** — add:
- `skips projection when platform automation is disabled`
- `creates crossJob with maxAttempts=2`

**`posh-share-engine.test.ts`** — add:
- `skips when automation.poshmark.enabled is false`
- `skips seller paused by circuit breaker`
- `creates crossJob with maxAttempts=2`

### Test pattern reference:

All engine tests follow the same mock pattern (verified from existing tests):
```typescript
vi.mock('@/lib/db', () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock('@/lib/db/schema', () => ({ /* column name mocks */ }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn(), sql: ... }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/crosslister/services/automation-meter', () => ({ canPerformAutomationAction: vi.fn() }));
vi.mock('@/lib/queries/platform-settings', () => ({ getPlatformSetting: vi.fn() }));
```

For circuit breaker tests in engine files, also mock:
```typescript
vi.mock('../automation-circuit-breaker', () => ({ canPerformAutomation: vi.fn() }));
```

---

## 6. FILE APPROVAL LIST

### NEW files (3):
| # | Path | Description |
|---|------|-------------|
| 1 | `src/lib/crosslister/automation/automation-circuit-breaker.ts` | Per-seller escalating circuit breaker (3 fail=1h, 5 fail=24h) |
| 2 | `src/lib/crosslister/automation/posh-follow-engine.ts` | Poshmark follow/unfollow engine (Mode 3) |
| 3 | `src/lib/crosslister/automation/__tests__/automation-circuit-breaker.test.ts` | Circuit breaker unit tests |
| 4 | `src/lib/crosslister/automation/__tests__/posh-follow-engine.test.ts` | Follow engine unit tests |

### MODIFIED files (13):
| # | Path | Changes |
|---|------|---------|
| 5 | `src/app/(hub)/my/selling/crosslist/automation/page.tsx` | Switch from `auth.api.getSession` to `authorize()` + delegation |
| 6 | `src/lib/crosslister/automation/auto-relist-engine.ts` | Add feature flag check + maxAttempts: 2 + import getPlatformSetting |
| 7 | `src/lib/crosslister/automation/price-drop-engine.ts` | Add feature flag check per projection + maxAttempts: 2 + import getPlatformSetting |
| 8 | `src/lib/crosslister/automation/offer-to-likers-engine.ts` | Add feature flag check + maxAttempts: 2 + import getPlatformSetting |
| 9 | `src/lib/crosslister/automation/posh-share-engine.ts` | Add feature flag check + maxAttempts: 2 + circuit breaker check |
| 10 | `src/lib/crosslister/automation/automation-scheduler.ts` | Add posh-follow engine dispatch |
| 11 | `src/lib/crosslister/automation/constants.ts` | Add POSH_FOLLOW, AUTOMATION_MAX_ATTEMPTS, AUTOMATION_BACKOFF_DELAYS, follow limit constants |
| 12 | `src/lib/crosslister/queue/automation-worker.ts` | Handle POSH_FOLLOW + circuit breaker recording + markCompleted |
| 13 | `src/lib/crosslister/queue/automation-queue.ts` | Add BullMQ defaultJobOptions with retry config + update AutomationJobData type |
| 14 | `src/lib/crosslister/connector-interface.ts` | Add `followUser?` optional method |
| 15 | `src/lib/db/seed/v32-platform-settings.ts` | Add 13 new settings (8 feature flags + 4 circuit breaker + 1 follow limit) |
| 16 | `src/lib/jobs/queue.ts` | Accept optional `defaultJobOptions` parameter in `createQueue` |
| 17 | `src/lib/crosslister/automation/__tests__/auto-relist-engine.test.ts` | Add 2 tests (feature flag + maxAttempts) |
| 18 | `src/lib/crosslister/automation/__tests__/price-drop-engine.test.ts` | Add 2 tests (feature flag + maxAttempts) |
| 19 | `src/lib/crosslister/automation/__tests__/offer-to-likers-engine.test.ts` | Add 2 tests (feature flag + maxAttempts) |
| 20 | `src/lib/crosslister/automation/__tests__/posh-share-engine.test.ts` | Add 3 tests (feature flag + circuit breaker + maxAttempts) |

**Total:** 4 new files + 16 modified files = 20 files

---

## 7. VERIFICATION CHECKLIST

Run after implementation:

```bash
# 1. TypeScript — must show 0 errors
pnpm typecheck

# 2. Tests — must be >= 3490
pnpm test

# 3. Banned terms check
grep -rn "SellerTier\|SubscriptionTier\|FVF\|Final Value Fee\|BASIC\|ELITE\|PLUS\|MAX\|PREMIUM\|STANDARD\|RISING\|Twicely Balance\|wallet\|Withdraw\|FinanceTier" \
  src/lib/crosslister/automation/ \
  src/lib/crosslister/queue/automation-worker.ts \
  src/lib/crosslister/queue/automation-queue.ts \
  src/lib/jobs/queue.ts \
  src/app/\(hub\)/my/selling/crosslist/automation/page.tsx \
  || echo "No banned terms found"

# 4. File size check — all must be < 300 lines
wc -l \
  src/lib/crosslister/automation/*.ts \
  src/lib/crosslister/queue/automation-worker.ts \
  src/lib/crosslister/queue/automation-queue.ts \
  src/lib/crosslister/connector-interface.ts \
  src/lib/jobs/queue.ts \
  src/app/\(hub\)/my/selling/crosslist/automation/page.tsx

# 5. Route prefix check
grep -rn "\/listing\|\/store\/\|\/shop\/\|\/dashboard\|\/admin\|\/l\/" \
  src/app/\(hub\)/my/selling/crosslist/automation/page.tsx \
  || echo "No wrong routes found"

# 6. No console.log
grep -rn "console\.log" \
  src/lib/crosslister/automation/ \
  src/lib/crosslister/queue/automation-worker.ts \
  || echo "No console.log found"

# 7. Full lint script
./twicely-lint.sh
```

Paste the FULL raw output of all checks. Do not summarize.

---

## 8. IMPLEMENTATION ORDER

These fixes can be implemented in any order, but the recommended sequence minimizes conflicts:

1. **constants.ts** — Add all new constants first (other files depend on these)
2. **queue.ts** — Add optional `defaultJobOptions` parameter
3. **automation-circuit-breaker.ts** (NEW) — Create the per-seller circuit breaker
4. **connector-interface.ts** — Add `followUser?` method
5. **v32-platform-settings.ts** — Add all 13 new seed values
6. **automation-queue.ts** — Add retry config + update type
7. **auto-relist-engine.ts** — Feature flag + maxAttempts
8. **price-drop-engine.ts** — Feature flag + maxAttempts
9. **offer-to-likers-engine.ts** — Feature flag + maxAttempts
10. **posh-share-engine.ts** — Feature flag + maxAttempts + circuit breaker
11. **posh-follow-engine.ts** (NEW) — Create follow engine
12. **automation-scheduler.ts** — Wire posh-follow
13. **automation-worker.ts** — Handle POSH_FOLLOW + circuit breaker + markCompleted
14. **page.tsx** — Switch to authorize()
15. **Tests** — New test files + updates to existing tests

---

## 9. WHAT IS NOT IN THIS FIX (Explicitly Deferred)

| Feature | Reason for Deferral |
|---------|---------------------|
| Listing refresh (AI) | Requires AI credit metering system + LLM API integration — separate build step |
| Poshmark Mode 1 (recommendations) | UX analytics feature, not engine correctness — Phase G |
| Poshmark Mode 2 (batch confirm) | UX batch approval flow — Phase G |
| Centrifugo `automation.action` event | Requires Centrifugo integration — Phase G real-time wiring |
| Randomized delay between actions | Moot until connectors actually execute (V1 stubs) — Phase G |
| Valkey-backed circuit breaker | Current in-memory implementation is sufficient for single-process Railway deployment. Valkey-backed version is Phase G. |
