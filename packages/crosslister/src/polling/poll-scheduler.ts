/**
 * Poll Scheduler
 * Finds projections due for polling and enqueues POLL jobs to BullMQ.
 * Spec: Lister Canonical §13.4
 */

import { db } from '@twicely/db';
import { channelProjection, sellerProfile } from '@twicely/db/schema';
import { and, eq, lte, isNotNull } from 'drizzle-orm';
import { canPoll, recordPoll } from './poll-budget';
import { canDispatch } from '../queue/circuit-breaker';
import { listerPollingQueue, type ListerPollingJobData } from '../queue/polling-queue';
import { loadCrosslisterQueueSettings } from '../services/queue-settings-loader';
import { logger } from '@twicely/logger';
import type { ExternalChannel } from '../types';

// HOT/WARM tiers — pure derived data, not configurable
const HOT_WARM_TIERS = ['HOT', 'WARM'];

interface SchedulerHealth {
  lastTickAt: string | null;
  lastTickDurationMs: number | null;
  jobsEnqueuedLastTick: number;
}

let health: SchedulerHealth = {
  lastTickAt: null,
  lastTickDurationMs: null,
  jobsEnqueuedLastTick: 0,
};

/**
 * Main scheduler tick — called by setInterval in worker-init.
 * Finds up to 100 projections with nextPollAt <= now, enqueues POLL jobs.
 */
export async function runPollSchedulerTick(): Promise<void> {
  const tickStart = Date.now();

  try {
    const now = new Date();

    // Load all queue/scheduler/polling settings (cached 5 min)
    const settings = await loadCrosslisterQueueSettings();

    // Query projections due for polling
    const dueProjections = await db
      .select({
        id: channelProjection.id,
        channel: channelProjection.channel,
        sellerId: channelProjection.sellerId,
        pollTier: channelProjection.pollTier,
        listingId: channelProjection.listingId,
      })
      .from(channelProjection)
      .where(
        and(
          eq(channelProjection.status, 'ACTIVE'),
          isNotNull(channelProjection.nextPollAt),
          lte(channelProjection.nextPollAt, now),
        )
      )
      .orderBy(channelProjection.nextPollAt)
      .limit(settings.pollingBatchSize);

    let enqueued = 0;

    for (const proj of dueProjections) {
      const channel = proj.channel as ExternalChannel;
      const pollTier = proj.pollTier as string;

      // Skip webhook-primary channels for HOT/WARM tiers (§13.5)
      if (settings.webhookPrimaryChannels.includes(channel) && HOT_WARM_TIERS.includes(pollTier)) {
        continue;
      }

      // Check circuit breaker
      if (!canDispatch(channel)) {
        continue;
      }

      // Get seller's lister tier for budget check
      const [sp] = await db
        .select({ listerTier: sellerProfile.listerTier })
        .from(sellerProfile)
        .where(eq(sellerProfile.userId, proj.sellerId))
        .limit(1);

      const listerTier = sp?.listerTier ?? 'NONE';

      // Check poll budget
      if (!(await canPoll(proj.sellerId, listerTier))) {
        continue;
      }

      // Enqueue POLL job to BullMQ lister-polling queue.
      // The polling worker (FUTURE — see polling-queue.ts header) will
      // dequeue these and call the connector for the relevant channel.
      // Until the worker ships, jobs accumulate harmlessly in the queue.
      const jobData: ListerPollingJobData = {
        projectionId: proj.id,
        channel,
        sellerId: proj.sellerId,
        listingId: proj.listingId,
        pollTier,
        scheduledAt: now.toISOString(),
      };

      // Idempotent jobId so duplicate scheduler ticks don't double-enqueue
      const jobId = `poll-${proj.id}-${now.getTime()}`;

      await listerPollingQueue.add('poll', jobData, {
        jobId,
        priority: settings.priorityPoll,
        attempts: settings.maxAttemptsPoll,
        backoff: { type: 'exponential', delay: settings.backoffPollMs },
        removeOnComplete: { count: settings.removeOnCompleteCount },
        removeOnFail: { count: settings.removeOnFailCount },
      });

      logger.info('[pollScheduler] Enqueued POLL', {
        jobId,
        projectionId: proj.id,
        channel,
        sellerId: proj.sellerId,
        pollTier,
      });

      await recordPoll(proj.sellerId);
      enqueued++;
    }

    health = {
      lastTickAt: new Date().toISOString(),
      lastTickDurationMs: Date.now() - tickStart,
      jobsEnqueuedLastTick: enqueued,
    };
  } catch (error) {
    logger.error('[pollScheduler] Tick failed', { error: String(error) });
    health = {
      lastTickAt: new Date().toISOString(),
      lastTickDurationMs: Date.now() - tickStart,
      jobsEnqueuedLastTick: 0,
    };
  }
}

/**
 * Get scheduler health info for admin dashboard.
 */
export function getPollSchedulerHealth(): SchedulerHealth {
  return { ...health };
}

/** Reset health state (testing only). */
export function resetPollSchedulerHealth(): void {
  health = { lastTickAt: null, lastTickDurationMs: null, jobsEnqueuedLastTick: 0 };
}
