/**
 * Poll Executor
 * Executes a single POLL job — fetches listing status from external platform.
 * Spec: Lister Canonical §13.4
 */

import { db } from '@twicely/db';
import { crossJob, channelProjection, crosslisterAccount } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { recordSuccess, recordFailure } from '../queue/circuit-breaker';
import { scheduleNextPoll } from './poll-tier-manager';
import type { ExternalChannel } from '../types';
import { logger } from '@twicely/logger';

export type PollResult =
  | { outcome: 'NO_CHANGE' }
  | { outcome: 'SALE_DETECTED'; externalOrderId: string }
  | { outcome: 'STATUS_CHANGED'; newStatus: string }
  | { outcome: 'ERROR'; error: string; retryable: boolean };

/**
 * Execute a single poll job.
 * Loads the cross job, projection, and account; polls external platform; handles result.
 */
export async function executePoll(crossJobId: string): Promise<PollResult> {
  try {
    // Load the cross job
    const [job] = await db
      .select()
      .from(crossJob)
      .where(eq(crossJob.id, crossJobId))
      .limit(1);

    if (!job) {
      return { outcome: 'ERROR', error: 'Cross job not found', retryable: false };
    }

    if (!job.projectionId) {
      return { outcome: 'ERROR', error: 'No projection ID on job', retryable: false };
    }

    // Load projection
    const [projection] = await db
      .select()
      .from(channelProjection)
      .where(eq(channelProjection.id, job.projectionId))
      .limit(1);

    if (!projection) {
      await markJobFailed(crossJobId, 'Projection not found');
      return { outcome: 'ERROR', error: 'Projection not found', retryable: false };
    }

    // Skip non-ACTIVE projections
    if (projection.status !== 'ACTIVE') {
      await markJobCompleted(crossJobId);
      return { outcome: 'NO_CHANGE' };
    }

    if (!projection.externalId) {
      await markJobFailed(crossJobId, 'No external ID on projection');
      return { outcome: 'ERROR', error: 'No external ID', retryable: false };
    }

    // Load account for connector auth
    const [account] = await db
      .select()
      .from(crosslisterAccount)
      .where(eq(crosslisterAccount.id, projection.accountId))
      .limit(1);

    if (!account) {
      await markJobFailed(crossJobId, 'Account not found');
      return { outcome: 'ERROR', error: 'Account not found', retryable: false };
    }

    const channel = projection.channel as ExternalChannel;

    // Get connector and poll
    // NOTE: getConnector/connector.getListingStatus will be wired when connectors
    // implement the verification interface. For now, we return NO_CHANGE as a
    // safe default, which updates lastPolledAt and schedules next poll.
    // The real connector call would be:
    //   const connector = getConnector(channel);
    //   const result = connector.verifyListing(account, projection.externalId);

    // Update lastPolledAt
    await db
      .update(channelProjection)
      .set({ lastPolledAt: new Date(), updatedAt: new Date() })
      .where(eq(channelProjection.id, projection.id));

    // Schedule next poll based on current tier
    const currentTier = projection.pollTier as 'HOT' | 'WARM' | 'COLD' | 'LONGTAIL';
    await scheduleNextPoll(projection.id, currentTier);

    // Record success on circuit breaker
    recordSuccess(channel);

    // Mark job completed
    await markJobCompleted(crossJobId);

    return { outcome: 'NO_CHANGE' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[pollExecutor] Poll failed', { crossJobId, error: errorMessage });

    // Try to extract channel for circuit breaker
    try {
      const [job] = await db
        .select({ projectionId: crossJob.projectionId })
        .from(crossJob)
        .where(eq(crossJob.id, crossJobId))
        .limit(1);

      if (job?.projectionId) {
        const [proj] = await db
          .select({ channel: channelProjection.channel })
          .from(channelProjection)
          .where(eq(channelProjection.id, job.projectionId))
          .limit(1);

        if (proj) {
          recordFailure(proj.channel as ExternalChannel);
        }
      }
    } catch {
      // Ignore secondary errors during error handling
    }

    await markJobFailed(crossJobId, errorMessage);
    return { outcome: 'ERROR', error: errorMessage, retryable: true };
  }
}

async function markJobCompleted(jobId: string): Promise<void> {
  await db
    .update(crossJob)
    .set({ status: 'COMPLETED', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(crossJob.id, jobId));
}

async function markJobFailed(jobId: string, error: string): Promise<void> {
  await db
    .update(crossJob)
    .set({ status: 'FAILED', lastError: error, updatedAt: new Date() })
    .where(eq(crossJob.id, jobId));
}
