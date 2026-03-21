/**
 * BullMQ worker for the lister:emergency-delist queue.
 * Processes emergency delist jobs triggered by off-platform sale detection.
 * Source: F5-S1 install prompt §1.2; Lister Canonical §4.3, §8.2, §12.4
 *
 * Priority: 0 (highest — always preempts regular publish jobs).
 * Attempts: 3 with exponential backoff (2s, 4s, 8s).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import type { Job, Worker } from 'bullmq';
import { createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { channelProjection, listing } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getConnector } from '../connector-registry';
import { notify } from '@twicely/notifications/service';
import { publishToChannel, sellerChannel } from '@twicely/realtime/centrifugo-publisher';
import { EMERGENCY_DELIST_QUEUE } from '../queue/emergency-delist-queue';
import { crosslisterAccount } from '@twicely/db/schema';
import type { EmergencyDelistJobData } from '../queue/emergency-delist-queue';
import type { ExternalChannel } from '../types';

/** Concurrency for emergency delist workers — keep low to avoid rate-limit spikes. */
const EMERGENCY_DELIST_CONCURRENCY = 5;

/**
 * Check if all projections for a listing are now non-ACTIVE (delist complete).
 * Returns true if no ACTIVE projections remain.
 */
async function areAllProjectionsDelisted(listingId: string): Promise<boolean> {
  const activeRemaining = await db
    .select({ id: channelProjection.id })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.listingId, listingId),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  return activeRemaining.length === 0;
}

/**
 * Process one emergency delist job.
 * Called by BullMQ for each job in lister:emergency-delist.
 */
async function processEmergencyDelistJob(job: Job<EmergencyDelistJobData>): Promise<void> {
  const { projectionId, listingId, channel, reason, sourceChannel, sourceSaleId } = job.data;

  logger.info('[emergencyDelistWorker] Processing delist job', {
    jobId: job.id,
    projectionId,
    channel,
    reason,
    sourceChannel,
  });

  // Load projection
  const [proj] = await db
    .select({
      id: channelProjection.id,
      status: channelProjection.status,
      externalId: channelProjection.externalId,
      accountId: channelProjection.accountId,
      sellerId: channelProjection.sellerId,
    })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);

  if (!proj) {
    logger.warn('[emergencyDelistWorker] Projection not found — skipping', { projectionId });
    return;
  }

  // Idempotency: if already DELISTED or ENDED, skip
  if (proj.status === 'DELISTED' || proj.status === 'ENDED') {
    logger.info('[emergencyDelistWorker] Projection already delisted — idempotent skip', {
      projectionId,
      status: proj.status,
    });
    return;
  }

  if (!proj.externalId) {
    logger.warn('[emergencyDelistWorker] No externalId on projection — marking DELISTED', { projectionId });
    await db.update(channelProjection).set({
      status: 'DELISTED',
      updatedAt: new Date(),
    }).where(eq(channelProjection.id, projectionId));
    return;
  }

  // Load full account record (connector needs it for auth tokens)
  const [accountRow] = await db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.id, proj.accountId))
    .limit(1);

  if (!accountRow) {
    logger.error('[emergencyDelistWorker] Account not found — cannot delist', {
      projectionId,
      accountId: proj.accountId,
    });
    await db.update(channelProjection).set({
      status: 'ERROR',
      lastPublishError: 'Account not found for emergency delist',
      updatedAt: new Date(),
    }).where(eq(channelProjection.id, projectionId));
    return;
  }

  // Load connector and execute delist
  const externalChannel = channel as ExternalChannel;

  try {
    const connector = getConnector(externalChannel);
    const result = await connector.delistListing(accountRow, proj.externalId);

    if (result.success) {
      // Mark projection DELISTED
      await db.update(channelProjection).set({
        status: 'DELISTED',
        updatedAt: new Date(),
      }).where(eq(channelProjection.id, projectionId));

      logger.info('[emergencyDelistWorker] Delist successful', {
        projectionId,
        channel,
        externalId: proj.externalId,
      });

      // Check if all projections are now delisted
      const allDone = await areAllProjectionsDelisted(listingId);
      if (allDone) {
        logger.info('[emergencyDelistWorker] All projections delisted — emitting delist.completed', { listingId });

        await publishToChannel(sellerChannel(proj.sellerId), {
          event: 'delist.completed',
          listingId,
          channels: [channel],
          sourceChannel,
          sourceSaleId,
        });
      }

      return;
    }

    // Connector returned failure
    logger.error('[emergencyDelistWorker] Delist connector failure', {
      projectionId,
      channel,
      error: result.error,
      retryable: result.retryable,
    });

    // Throw to let BullMQ retry
    throw new Error(result.error ?? 'Delist failed');

  } catch (err) {
    const isLastAttempt = (job.attemptsMade ?? 0) >= 2; // 0-indexed, max 3 attempts

    if (isLastAttempt) {
      // Final failure: mark projection ERROR, notify seller
      await db.update(channelProjection).set({
        status: 'ERROR',
        lastPublishError: `Emergency delist failed after 3 attempts: ${String(err)}`,
        updatedAt: new Date(),
      }).where(eq(channelProjection.id, projectionId));

      logger.error('[emergencyDelistWorker] Final delist failure — notifying seller', {
        projectionId,
        channel,
        error: String(err),
      });

      // Load listing title for notification
      const [listingRow] = await db
        .select({ title: listing.title })
        .from(listing)
        .where(eq(listing.id, listingId))
        .limit(1);

      await notify(proj.sellerId, 'crosslister.delist_failed', {
        itemTitle: listingRow?.title ?? 'your item',
        channel,
      });
    }

    throw err; // let BullMQ handle retry
  }

}

/**
 * Create and return the emergency delist BullMQ worker.
 * Called once at worker startup.
 */
export function createEmergencyDelistWorker(): Worker<EmergencyDelistJobData> {
  return createWorker<EmergencyDelistJobData>(
    EMERGENCY_DELIST_QUEUE,
    processEmergencyDelistJob,
    EMERGENCY_DELIST_CONCURRENCY,
  );
}
