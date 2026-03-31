'use server';

/**
 * Crosslister publish queue management actions.
 * Split from crosslister-publish.ts to stay under 300 lines.
 *
 * cancelJob, getJobQueueStatus, getPublishAllowanceAction
 */

import { db } from '@twicely/db';
import { channelProjection, crossJob } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { authorize, sub } from '@twicely/casl';
import { cancelJobSchema } from '@/lib/validations/crosslister';
import { getPublishAllowance } from '@twicely/crosslister/services/publish-meter';
import { listerPublishQueue } from '@twicely/crosslister/queue/lister-queue';
import { getSellerQueueStatus } from '@/lib/queries/crosslister';
import type { PublishAllowance } from '@twicely/crosslister/services/publish-meter';
import type { QueueStatusSummary } from '@/lib/queries/crosslister';

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get current publish allowance for the authenticated seller.
 */
export async function getPublishAllowanceAction(): Promise<ActionResult<PublishAllowance>> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('ChannelProjection', { sellerId }))) return { success: false, error: 'Forbidden' };

  const allowance = await getPublishAllowance(sellerId);
  return { success: true, data: allowance };
}

/**
 * Cancel a pending or queued cross job.
 * Cannot cancel IN_PROGRESS jobs.
 * For CREATE jobs: reverts projection status from QUEUED to DRAFT.
 */
export async function cancelJob(input: unknown): Promise<ActionResult> {
  const parsed = cancelJobSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('delete', sub('CrossJob', { sellerId }))) return { success: false, error: 'Forbidden' };

  const [job] = await db
    .select()
    .from(crossJob)
    .where(
      and(
        eq(crossJob.id, parsed.data.jobId),
        eq(crossJob.sellerId, sellerId),
      ),
    )
    .limit(1);

  if (!job) return { success: false, error: 'Not found' };

  if (job.status === 'IN_PROGRESS') {
    return { success: false, error: 'Cannot cancel a job that is already in progress.' };
  }

  if (job.status !== 'PENDING' && job.status !== 'QUEUED') {
    return { success: false, error: `Job cannot be canceled (current status: ${job.status}).` };
  }

  // Remove from BullMQ queue if bullmqJobId exists
  if (job.bullmqJobId) {
    try {
      await listerPublishQueue.remove(job.bullmqJobId);
    } catch {
      // Job may have already been picked up — proceed with DB update
    }
  }

  // Cancel the crossJob
  await db.update(crossJob).set({
    status: 'CANCELED',
    updatedAt: new Date(),
  }).where(eq(crossJob.id, job.id));

  // For CREATE jobs: revert projection status from PUBLISHING to DRAFT
  if (job.jobType === 'CREATE' && job.projectionId) {
    await db.update(channelProjection).set({
      status: 'DRAFT',
      updatedAt: new Date(),
    }).where(
      and(
        eq(channelProjection.id, job.projectionId),
        eq(channelProjection.status, 'PUBLISHING'),
      ),
    );
  }

  revalidatePath('/my/selling/crosslist');
  return { success: true };
}

/**
 * Get queue status summary for the authenticated seller.
 */
export async function getJobQueueStatus(): Promise<ActionResult<QueueStatusSummary>> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('CrossJob', { sellerId }))) return { success: false, error: 'Forbidden' };

  const status = await getSellerQueueStatus(sellerId);
  return { success: true, data: status };
}
