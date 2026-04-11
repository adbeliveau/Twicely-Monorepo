'use server';

/**
 * Crosslister publish server actions.
 * F3.1: Async enqueue pattern — actions return after enqueueing, not after execution.
 * Source: F3.1 install prompt §3.7, §3.8
 *
 * Decision #31: No fees on off-platform sales.
 */

import { db } from '@twicely/db';
import {
  listing,
  channelProjection,
  crosslisterAccount,
  crossJob,
} from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { authorize, sub } from '@twicely/casl';
import {
  publishListingsSchema,
  updateProjectionOverridesSchema,
} from '@/lib/validations/crosslister';
import { canPublish, getPublishAllowance } from '@twicely/crosslister/services/publish-meter';
import { publishListingToChannel, enqueueSyncJob } from '@twicely/crosslister/services/publish-service';
import { listerPublishQueue } from '@twicely/crosslister/queue/lister-queue';
import {
  PRIORITY_DELIST,
  MAX_ATTEMPTS_PUBLISH,
  BACKOFF_PUBLISH,
  REMOVE_ON_COMPLETE,
  REMOVE_ON_FAIL,
} from '@twicely/crosslister/queue/constants';
import type { ExternalChannel } from '@twicely/crosslister/types';
import {
  cancelJob as cancelJobImpl,
  getJobQueueStatus as getJobQueueStatusImpl,
  getPublishAllowanceAction as getPublishAllowanceActionImpl,
} from './crosslister-publish-queue';

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

interface EnqueueSummary {
  queued: number;
  failed: number;
  errors: Array<{ listingId: string; channel: string; error: string }>;
}

const delistSchema = z.object({ projectionId: zodId }).strict();

export async function cancelJob(input: unknown) {
  return cancelJobImpl(input);
}

export async function getJobQueueStatus() {
  return getJobQueueStatusImpl();
}

export async function getPublishAllowanceAction() {
  return getPublishAllowanceActionImpl();
}

/**
 * Publish one or more listings to one or more channels (async enqueue).
 * Returns immediately after enqueueing — execution is handled by the worker.
 */
export async function publishListings(
  input: unknown,
): Promise<ActionResult<EnqueueSummary>> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('create', sub('ChannelProjection', { sellerId }))) return { success: false, error: 'Forbidden' };

  const parsed = publishListingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { listingIds, channels } = parsed.data;
  const totalNeeded = listingIds.length * channels.length;

  const allowed = await canPublish(sellerId, totalNeeded);
  if (!allowed) {
    const allowance = await getPublishAllowance(sellerId);
    return {
      success: false,
      error: `Insufficient publish credits. ${allowance.remaining} remaining, ${totalNeeded} needed. Upgrade your Crosslister plan.`,
    };
  }

  const listingRows = await db
    .select({ id: listing.id, ownerUserId: listing.ownerUserId, status: listing.status })
    .from(listing)
    .where(inArray(listing.id, listingIds));

  const listingMap = new Map(listingRows.map((r) => [r.id, r]));
  const errors: EnqueueSummary['errors'] = [];
  let queued = 0;
  let failed = 0;

  for (const listingId of listingIds) {
    const row = listingMap.get(listingId);
    if (!row || row.ownerUserId !== sellerId) {
      for (const ch of channels) {
        errors.push({ listingId, channel: ch, error: 'Listing not found or not owned by you.' });
        failed++;
      }
      continue;
    }
    if (row.status !== 'ACTIVE') {
      for (const ch of channels) {
        errors.push({ listingId, channel: ch, error: 'Listing is not active.' });
        failed++;
      }
      continue;
    }

    for (const ch of channels) {
      const channel = ch as ExternalChannel;
      const result = await publishListingToChannel(listingId, channel, sellerId);
      if (result.success) {
        queued++;
      } else {
        errors.push({ listingId, channel, error: result.error ?? 'Unknown error' });
        failed++;
      }
    }
  }

  return { success: true, data: { queued, failed, errors } };
}

/**
 * Delist a listing from one channel (async enqueue).
 * Creates a DELIST crossJob and enqueues to BullMQ. Returns immediately.
 */
export async function delistFromChannel(input: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('delete', sub('ChannelProjection', { sellerId }))) return { success: false, error: 'Forbidden' };

  const parsed = delistSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [projection] = await db
    .select()
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.id, parsed.data.projectionId),
        eq(channelProjection.sellerId, sellerId),
      ),
    )
    .limit(1);

  if (!projection) return { success: false, error: 'Not found' };
  if (projection.status !== 'ACTIVE') return { success: false, error: 'Listing is not active on this platform' };
  if (!projection.externalId) return { success: false, error: 'No external ID on projection.' };

  const [account] = await db
    .select()
    .from(crosslisterAccount)
    .where(eq(crosslisterAccount.id, projection.accountId))
    .limit(1);

  if (!account) return { success: false, error: 'Account not found.' };

  // Create DELIST crossJob (QUEUED)
  const idempotencyKey = `delist:${projection.id}:${Date.now()}`;
  const [jobRow] = await db.insert(crossJob).values({
    sellerId,
    projectionId: projection.id,
    accountId: projection.accountId,
    jobType: 'DELIST',
    priority: PRIORITY_DELIST,
    idempotencyKey,
    status: 'QUEUED',
    maxAttempts: MAX_ATTEMPTS_PUBLISH,
    payload: { externalId: projection.externalId, channel: projection.channel },
  }).returning({ id: crossJob.id });

  if (!jobRow?.id) return { success: false, error: 'Failed to create delist job.' };

  // Set projection to DELISTING while queued
  await db.update(channelProjection).set({
    status: 'DELISTING',
    updatedAt: new Date(),
  }).where(eq(channelProjection.id, projection.id));

  // Enqueue to BullMQ
  const bullJob = await listerPublishQueue.add(
    `delist:${projection.id}`,
    {
      crossJobId: jobRow.id,
      listingId: projection.listingId,
      channel: projection.channel,
      sellerId,
      accountId: projection.accountId,
      projectionId: projection.id,
      overrides: null,
      jobType: 'DELIST',
    },
    {
      jobId: idempotencyKey,
      priority: PRIORITY_DELIST,
      attempts: MAX_ATTEMPTS_PUBLISH,
      backoff: BACKOFF_PUBLISH,
      removeOnComplete: REMOVE_ON_COMPLETE,
      removeOnFail: REMOVE_ON_FAIL,
    },
  );

  await db.update(crossJob).set({
    bullmqJobId: bullJob.id ?? null,
    updatedAt: new Date(),
  }).where(eq(crossJob.id, jobRow.id));

  revalidatePath('/my/selling/crosslist');
  return { success: true };
}

/**
 * Update per-channel overrides (title, description, price) on an existing projection.
 * If the projection is ACTIVE and sync is enabled, enqueues an UPDATE job.
 */
export async function updateProjectionOverrides(input: unknown): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('ChannelProjection', { sellerId }))) return { success: false, error: 'Forbidden' };

  const parsed = updateProjectionOverridesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [projection] = await db
    .select({ id: channelProjection.id, status: channelProjection.status, syncEnabled: channelProjection.syncEnabled, overridesJson: channelProjection.overridesJson, externalId: channelProjection.externalId })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.id, parsed.data.projectionId),
        eq(channelProjection.sellerId, sellerId),
      ),
    )
    .limit(1);

  if (!projection) return { success: false, error: 'Not found' };

  const currentOverrides = (projection.overridesJson ?? {}) as Record<string, unknown>;
  const newOverrides: Record<string, unknown> = {
    ...currentOverrides,
    ...(parsed.data.titleOverride !== undefined ? { titleOverride: parsed.data.titleOverride } : {}),
    ...(parsed.data.descriptionOverride !== undefined ? { descriptionOverride: parsed.data.descriptionOverride } : {}),
    ...(parsed.data.priceCentsOverride !== undefined ? { priceCentsOverride: parsed.data.priceCentsOverride } : {}),
  };

  const hasPendingSync =
    projection.status === 'ACTIVE' && projection.syncEnabled ? true : false;

  await db.update(channelProjection).set({
    overridesJson: newOverrides,
    hasPendingSync,
    updatedAt: new Date(),
  }).where(eq(channelProjection.id, projection.id));

  // Enqueue sync job if projection is ACTIVE with externalId
  if (hasPendingSync && projection.externalId) {
    await enqueueSyncJob(projection.id, sellerId);
  }

  revalidatePath('/my/selling/crosslist');
  return { success: true };
}
