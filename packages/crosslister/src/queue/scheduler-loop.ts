/**
 * Crosslister scheduler dispatch loop.
 * Runs every 5 seconds. Applies three gates before dispatching:
 *   1. Platform rate limit (per seller per hour)
 *   2. Seller fairness quota (per seller per minute, weighted by ListerTier)
 *   3. Circuit breaker (per platform)
 *
 * Spec: Lister Canonical §8.4
 */

import { db } from '@twicely/db';
import { crossJob, sellerProfile } from '@twicely/db/schema';
import { eq, and, lte, isNull, or, asc } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { checkRateLimit, recordRequest } from './rate-limiter';
import { hasQuota, recordDispatch, getMaxJobsPerSellerPerMinute } from './fairness-quota';
import { canDispatch as cbCanDispatch, getCBSettings } from './circuit-breaker';
import { effectiveQuota, loadTierWeights } from './tier-weight';
import { listerPublishQueue } from './lister-queue';
import { automationQueue } from './automation-queue';
import type { ExternalChannel } from '../types';
import type { ListerTier } from '@/types/enums';

const TICK_INTERVAL_MS = 5_000;
const BATCH_PULL_SIZE = 50;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastTickAt: Date | null = null;
let lastTickDurationMs: number | null = null;

/** Start the scheduler loop. Idempotent — no-op if already running. */
export function startSchedulerLoop(): void {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(() => { void runTick(); }, TICK_INTERVAL_MS);
  logger.info('[schedulerLoop] Started', { intervalMs: TICK_INTERVAL_MS });
}

/** Stop the scheduler loop (graceful shutdown). */
export function stopSchedulerLoop(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[schedulerLoop] Stopped');
  }
}

/** Whether the scheduler is currently running. */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

/** Health info for admin dashboard. */
export function getSchedulerHealth(): {
  running: boolean;
  lastTickAt: string | null;
  lastTickDurationMs: number | null;
} {
  return {
    running: schedulerInterval !== null,
    lastTickAt: lastTickAt?.toISOString() ?? null,
    lastTickDurationMs,
  };
}

/** Single scheduler tick — pull PENDING jobs, apply gates, dispatch. */
export async function runTick(): Promise<void> {
  const tickStart = Date.now();
  let dispatched = 0;
  let skippedRate = 0;
  let skippedFairness = 0;
  let skippedCircuit = 0;

  try {
    const now = new Date();

    // Load settings for this tick
    const [baseQuota, cbSettings] = await Promise.all([
      getMaxJobsPerSellerPerMinute(),
      getCBSettings(),
    ]);
    await loadTierWeights();

    // Pull next batch of PENDING jobs ready for dispatch
    const pendingJobs = await db
      .select({
        id: crossJob.id,
        sellerId: crossJob.sellerId,
        accountId: crossJob.accountId,
        priority: crossJob.priority,
        idempotencyKey: crossJob.idempotencyKey,
        payload: crossJob.payload,
        jobType: crossJob.jobType,
        listerTier: sellerProfile.listerTier,
      })
      .from(crossJob)
      .innerJoin(sellerProfile, eq(sellerProfile.userId, crossJob.sellerId))
      .where(
        and(
          eq(crossJob.status, 'PENDING'),
          or(isNull(crossJob.scheduledFor), lte(crossJob.scheduledFor, now)),
        ),
      )
      .orderBy(asc(crossJob.priority), asc(crossJob.scheduledFor))
      .limit(BATCH_PULL_SIZE);

    for (const job of pendingJobs) {
      const payload = job.payload as Record<string, unknown>;
      const channel = (payload['channel'] ?? '') as string;
      const exChannel = channel as ExternalChannel;

      // Gate 1: Circuit breaker
      if (!cbCanDispatch(exChannel, cbSettings.recoveryWindowMs)) {
        skippedCircuit++;
        continue;
      }

      // Gate 2: Rate limit
      if (!checkRateLimit(channel, job.sellerId)) {
        skippedRate++;
        continue;
      }

      // Gate 3: Fairness quota (weighted by ListerTier)
      const tier = (job.listerTier ?? 'NONE') as ListerTier;
      const sellerQuota = effectiveQuota(baseQuota, tier);
      if (!hasQuota(job.sellerId, sellerQuota)) {
        skippedFairness++;
        continue;
      }

      // All gates passed — dispatch
      await db.update(crossJob).set({
        status: 'QUEUED',
        updatedAt: now,
      }).where(eq(crossJob.id, job.id));

      const automationEngine = payload['automationEngine'] as string | undefined;

      if (automationEngine) {
        // Route automation jobs to the dedicated automation queue
        await automationQueue.add(
          `${automationEngine}:${job.id}`,
          {
            crossJobId: job.id,
            listingId: String(payload['listingId'] ?? ''),
            channel,
            sellerId: job.sellerId,
            accountId: job.accountId ?? '',
            projectionId: String(payload['projectionId'] ?? ''),
            jobType: job.jobType as 'RELIST' | 'UPDATE' | 'SYNC',
            automationEngine: automationEngine as 'AUTO_RELIST' | 'PRICE_DROP' | 'OFFER_TO_LIKERS' | 'POSH_SHARE' | 'POSH_FOLLOW',
            payload: payload,
          },
          {
            jobId: job.idempotencyKey,
            priority: job.priority,
          },
        );
      } else {
        // Route standard publish jobs to the publish queue
        await listerPublishQueue.add(
          `${job.jobType}:${job.id}`,
          {
            crossJobId: job.id,
            listingId: String(payload['listingId'] ?? ''),
            channel,
            sellerId: job.sellerId,
            accountId: job.accountId ?? '',
            projectionId: String(payload['projectionId'] ?? ''),
            overrides: (payload['overrides'] as Record<string, unknown>) ?? null,
            jobType: job.jobType as 'CREATE' | 'UPDATE' | 'DELIST' | 'SYNC',
          },
          {
            jobId: job.idempotencyKey,
            priority: job.priority,
          },
        );
      }

      recordRequest(channel, job.sellerId);
      recordDispatch(job.sellerId);
      dispatched++;
    }
  } catch (err) {
    logger.error('[schedulerLoop] Tick error', { error: String(err) });
  }

  lastTickAt = new Date();
  lastTickDurationMs = Date.now() - tickStart;

  if (dispatched > 0 || skippedRate > 0 || skippedFairness > 0 || skippedCircuit > 0) {
    logger.info('[schedulerLoop] Tick complete', {
      dispatched,
      skippedRate,
      skippedFairness,
      skippedCircuit,
      durationMs: lastTickDurationMs,
    });
  }
}
