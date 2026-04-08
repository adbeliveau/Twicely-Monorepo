/**
 * BullMQ worker for the lister:publish queue.
 * Processes publish jobs by calling the appropriate executor function.
 * Source: F3.1 install prompt §3.3; Lister Canonical Section 4.3
 *
 * Concurrency: 10 (per Lister Canonical Section 4.3)
 * Rate limiting: per-channel per-seller sliding window (in-memory V1)
 */

import type { Job } from 'bullmq';
import { createWorker } from '@twicely/jobs/queue';
import { db } from '@twicely/db';
import { crossJob } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { checkRateLimit, recordRequest, getDelayMs } from '@twicely/crosslister/queue/rate-limiter';
import { executeCreateJob, executeUpdateJob, executeDelistJob } from '../services/job-executor';
import {
  LISTER_PUBLISH_QUEUE,
  WORKER_CONCURRENCY,
} from '@twicely/crosslister/queue/constants';
import type { ListerPublishJobData } from '@twicely/crosslister/queue/lister-queue';
import type { ExternalChannel } from '../types';

/** Mark the crossJob as IN_PROGRESS. */
async function markInProgress(crossJobId: string): Promise<void> {
  await db.update(crossJob).set({
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(crossJob.id, crossJobId));
}

/** Mark the crossJob as FAILED and record the error. */
async function markFailed(crossJobId: string, error: string, attempts: number): Promise<void> {
  await db.update(crossJob).set({
    status: 'FAILED',
    lastError: error,
    attempts,
    updatedAt: new Date(),
  }).where(eq(crossJob.id, crossJobId));
}

/** The processor function called by BullMQ for each job. */
async function processPublishJob(job: Job<ListerPublishJobData>): Promise<void> {
  const { crossJobId, listingId, channel, sellerId, accountId, projectionId, jobType, overrides } = job.data;

  logger.info('[listerWorker] Processing job', { jobId: job.id, crossJobId, channel, jobType });

  // Rate limit check (in-memory V1)
  if (!checkRateLimit(channel, sellerId)) {
    const delayMs = getDelayMs(channel, sellerId);
    logger.warn('[listerWorker] Rate limit exceeded — delaying', { channel, sellerId, delayMs });
    // Throwing causes BullMQ to retry with backoff
    throw new Error(`Rate limit exceeded for ${channel}. Retry in ${delayMs}ms.`);
  }

  // Mark IN_PROGRESS
  await markInProgress(crossJobId);

  // Record request for rate limiting
  recordRequest(channel, sellerId);

  const externalChannel = channel as ExternalChannel;

  if (jobType === 'CREATE') {
    const result = await executeCreateJob(
      crossJobId,
      listingId,
      externalChannel,
      sellerId,
      accountId,
      projectionId,
      overrides as Parameters<typeof executeCreateJob>[6],
    );

    if (!result.success) {
      await markFailed(crossJobId, result.error ?? 'Unknown error', (job.attemptsMade ?? 0) + 1);
      if (result.retryable) {
        throw new Error(result.error ?? 'Retryable failure');
      }
    }
    return;
  }

  if (jobType === 'UPDATE' || jobType === 'SYNC') {
    // Load externalId from projection
    const { channelProjection } = await import('@twicely/db/schema');
    const [proj] = await db
      .select({ externalId: channelProjection.externalId })
      .from(channelProjection)
      .where(eq(channelProjection.id, projectionId))
      .limit(1);

    const externalId = proj?.externalId;
    if (!externalId) {
      await markFailed(crossJobId, 'No externalId on projection — cannot sync.', (job.attemptsMade ?? 0) + 1);
      return;
    }

    const result = await executeUpdateJob(
      crossJobId,
      listingId,
      externalChannel,
      sellerId,
      accountId,
      projectionId,
      externalId,
    );

    if (!result.success) {
      await markFailed(crossJobId, result.error ?? 'Unknown error', (job.attemptsMade ?? 0) + 1);
      if (result.retryable) {
        throw new Error(result.error ?? 'Retryable failure');
      }
    }
    return;
  }

  if (jobType === 'DELIST') {
    const { channelProjection } = await import('@twicely/db/schema');
    const [proj] = await db
      .select({ externalId: channelProjection.externalId })
      .from(channelProjection)
      .where(eq(channelProjection.id, projectionId))
      .limit(1);

    const externalId = proj?.externalId;
    if (!externalId) {
      await markFailed(crossJobId, 'No externalId on projection — cannot delist.', (job.attemptsMade ?? 0) + 1);
      return;
    }

    const result = await executeDelistJob(
      crossJobId,
      externalChannel,
      accountId,
      projectionId,
      externalId,
    );

    if (!result.success) {
      await markFailed(crossJobId, result.error ?? 'Unknown error', (job.attemptsMade ?? 0) + 1);
      if (result.retryable) {
        throw new Error(result.error ?? 'Retryable failure');
      }
    }
    return;
  }

  logger.warn('[listerWorker] Unknown jobType — skipping', { crossJobId, jobType });
}

export const listerWorker = createWorker<ListerPublishJobData>(
  LISTER_PUBLISH_QUEUE,
  processPublishJob,
  WORKER_CONCURRENCY,
);
