/**
 * Relist executor — automation RELIST job dispatch.
 * Delist then re-create a listing to refresh its search ranking.
 * Source: F6.1 install prompt §D.1 (automation engine dispatch).
 *
 * NOT a 'use server' file. Plain TypeScript module.
 */

import { executeDelistJob, executeCreateJob, type JobExecutionResult } from './job-executor';
import type { ExternalChannel } from '../types';

/**
 * Execute a RELIST job for the automation worker.
 * Delist the existing listing then re-create it to refresh search ranking.
 */
export async function executeRelistJob(
  crossJobId: string,
  listingId: string,
  channel: ExternalChannel,
  sellerId: string,
  accountId: string,
  projectionId: string,
  externalId: string,
): Promise<JobExecutionResult> {
  // Step 1: Delist the existing listing
  const delistResult = await executeDelistJob(crossJobId, channel, accountId, projectionId, externalId);
  if (!delistResult.success) {
    return delistResult;
  }

  // Step 2: Re-create the listing (refreshes search ranking)
  return executeCreateJob(
    crossJobId,
    listingId,
    channel,
    sellerId,
    accountId,
    projectionId,
    null,
  );
}
