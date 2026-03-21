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
import { logger } from '@twicely/logger';
import type { ExternalChannel } from '../types';

// Webhook-primary channels: eBay and Etsy per §13.5
const WEBHOOK_PRIMARY_CHANNELS: ExternalChannel[] = ['EBAY', 'ETSY'];
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
      .limit(100);

    let enqueued = 0;

    for (const proj of dueProjections) {
      const channel = proj.channel as ExternalChannel;
      const pollTier = proj.pollTier as string;

      // Skip webhook-primary channels for HOT/WARM tiers (§13.5)
      if (WEBHOOK_PRIMARY_CHANNELS.includes(channel) && HOT_WARM_TIERS.includes(pollTier)) {
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

      // Enqueue POLL job via BullMQ
      // NOTE: In a real system this would enqueue to the lister:polling queue.
      // For now, we log the dispatch. The actual BullMQ enqueue will be wired
      // when the polling worker is implemented.
      logger.info('[pollScheduler] Enqueue POLL', {
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
