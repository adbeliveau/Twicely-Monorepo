/**
 * BullMQ worker for the lister:automation queue.
 * Processes RELIST, UPDATE (price drop), and SYNC (offer/share/follow) automation jobs.
 * Source: F6.1 install prompt §E.4; Lister Canonical Section 4.3.
 *
 * Concurrency: 5 (conservative start — automation gets up to 10 slots in future).
 * V1: automation methods on connectors return { success: false, error: 'Not implemented' }.
 */

import type { Job } from 'bullmq';
import { createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { crossJob, channelProjection, crosslisterAccount } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getConnector } from '../connector-registry';
import { executeDelistJob, executeCreateJob, executeUpdateJob } from '../services/job-executor';
import { LISTER_AUTOMATION_QUEUE } from '@twicely/crosslister/queue/constants';
import { AUTOMATION_WORKER_CONCURRENCY } from '../automation/constants';
import type { AutomationJobData } from '@twicely/crosslister/queue/automation-queue';
import type { ExternalChannel } from '../types';
import {
  recordAutomationSuccess,
  recordAutomationFailure,
} from '../automation/automation-circuit-breaker';

/** Mark the crossJob as IN_PROGRESS. */
async function markInProgress(crossJobId: string): Promise<void> {
  await db.update(crossJob).set({
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(crossJob.id, crossJobId));
}

/** Mark the crossJob as FAILED. */
async function markFailed(crossJobId: string, error: string, attempts: number): Promise<void> {
  await db.update(crossJob).set({
    status: 'FAILED',
    lastError: error,
    attempts,
    updatedAt: new Date(),
  }).where(eq(crossJob.id, crossJobId));
}

/** Mark the crossJob as COMPLETED. */
async function markCompleted(crossJobId: string, result: Record<string, unknown>): Promise<void> {
  await db.update(crossJob).set({
    status: 'COMPLETED',
    completedAt: new Date(),
    result,
    updatedAt: new Date(),
  }).where(eq(crossJob.id, crossJobId));
}

/** Process an automation job dispatched from the lister:automation queue. */
async function processAutomationJob(job: Job<AutomationJobData>): Promise<void> {
  const { crossJobId, sellerId, accountId, projectionId, listingId, channel, jobType, automationEngine } = job.data;

  logger.info('[automationWorker] Processing job', { jobId: job.id, crossJobId, automationEngine, jobType });

  await markInProgress(crossJobId);

  const externalChannel = channel as ExternalChannel;

  // Load externalId from projection (needed for UPDATE/SYNC/RELIST)
  const [proj] = await db
    .select({ externalId: channelProjection.externalId })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);

  if (automationEngine === 'AUTO_RELIST') {
    // RELIST = delist + create (end-and-relist)
    if (!proj?.externalId) {
      await markFailed(crossJobId, 'No externalId — cannot relist.', (job.attemptsMade ?? 0) + 1);
      return;
    }

    const [accountRow] = await db
      .select()
      .from(crosslisterAccount)
      .where(eq(crosslisterAccount.id, accountId))
      .limit(1);

    if (!accountRow) {
      await markFailed(crossJobId, 'Account not found.', (job.attemptsMade ?? 0) + 1);
      return;
    }

    const connector = getConnector(externalChannel);

    // Check for optional relistListing method first
    if (connector.relistListing) {
      const result = await connector.relistListing(accountRow, proj.externalId);
      if (!result.success) {
        logger.info('[automationWorker] relistListing not implemented — V1', { channel });
        await markFailed(crossJobId, result.error ?? 'Not implemented', (job.attemptsMade ?? 0) + 1);
      }
      return;
    }

    // Fallback: delist then create (standard relist flow)
    const delistResult = await executeDelistJob(crossJobId, externalChannel, accountId, projectionId, proj.externalId);
    if (delistResult.success) {
      await executeCreateJob(crossJobId, listingId, externalChannel, sellerId, accountId, projectionId, null);
    }
    return;
  }

  if (automationEngine === 'PRICE_DROP') {
    if (!proj?.externalId) {
      await markFailed(crossJobId, 'No externalId — cannot update price.', (job.attemptsMade ?? 0) + 1);
      return;
    }
    await executeUpdateJob(crossJobId, listingId, externalChannel, sellerId, accountId, projectionId, proj.externalId);
    return;
  }

  if (automationEngine === 'OFFER_TO_LIKERS') {
    const [accountRow] = await db.select().from(crosslisterAccount).where(eq(crosslisterAccount.id, accountId)).limit(1);
    if (!accountRow) {
      await markFailed(crossJobId, 'Account not found.', (job.attemptsMade ?? 0) + 1);
      return;
    }
    const connector = getConnector(externalChannel);
    if (!connector.sendOfferToLikers || !proj?.externalId) {
      logger.info('[automationWorker] sendOfferToLikers not implemented — V1', { channel });
      await markFailed(crossJobId, 'Not implemented', (job.attemptsMade ?? 0) + 1);
      return;
    }
    const offerPrice = (job.data.payload?.offerPriceCents as number | undefined) ?? 0;
    await connector.sendOfferToLikers(accountRow, proj.externalId, offerPrice);
    return;
  }

  if (automationEngine === 'POSH_SHARE') {
    const [accountRow] = await db.select().from(crosslisterAccount).where(eq(crosslisterAccount.id, accountId)).limit(1);
    if (!accountRow) {
      await markFailed(crossJobId, 'Account not found.', (job.attemptsMade ?? 0) + 1);
      await recordAutomationFailure(sellerId);
      return;
    }
    const connector = getConnector(externalChannel);
    if (!connector.shareListing || !proj?.externalId) {
      logger.info('[automationWorker] shareListing not yet implemented — V1', { channel });
      await markFailed(crossJobId, 'Not implemented', (job.attemptsMade ?? 0) + 1);
      return;
    }
    const result = await connector.shareListing(accountRow, proj.externalId);
    if (result.success) {
      await markCompleted(crossJobId, { shared: true });
      await recordAutomationSuccess(sellerId);
    } else {
      await markFailed(crossJobId, result.error ?? 'Share failed', (job.attemptsMade ?? 0) + 1);
      await recordAutomationFailure(sellerId);
    }
    return;
  }

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

  logger.warn('[automationWorker] Unknown automationEngine — skipping', { crossJobId, automationEngine });
}

export const automationWorker = createWorker<AutomationJobData>(
  LISTER_AUTOMATION_QUEUE,
  processAutomationJob,
  AUTOMATION_WORKER_CONCURRENCY,
);
