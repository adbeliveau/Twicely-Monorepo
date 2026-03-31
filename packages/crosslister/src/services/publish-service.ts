/**
 * Publish service — orchestrates the publish pipeline for one listing to one channel.
 * F3.1: Enqueue pattern — validates, creates crossJob(QUEUED), enqueues BullMQ job.
 * Connector execution moved to lister-worker.ts via job-executor.ts.
 * Source: Lister Canonical Section 7.2; F3.1 install prompt §3.4
 *
 * NOT a 'use server' file. Plain TypeScript module.
 *
 * Decision #31: No fees on off-platform sales.
 */

import { db } from '@twicely/db';
import {
  listing,
  listingImage,
  channelProjection,
  crossJob,
  crosslisterAccount,
  channelCategoryMapping,
} from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getChannelMetadata } from '../channel-registry';
import { transformListingForChannel } from './listing-transform';
import { validateForChannel } from './policy-validator';
import { listerPublishQueue } from '../queue/lister-queue';
import {
  PRIORITY_CREATE,
  MAX_ATTEMPTS_PUBLISH,
  BACKOFF_PUBLISH,
  REMOVE_ON_COMPLETE,
  REMOVE_ON_FAIL,
} from '../queue/constants';
import { isCrosslistEnabled } from './publish-service-helpers';
import type { ExternalChannel, ExternalCategoryMapping } from '../types';
import type { ChannelOverrides, CanonicalListingData, CanonicalImageData } from './listing-transform';

export { channelSettingKey, isCrosslistEnabled, enqueueSyncJob } from './publish-service-helpers';

export interface PublishEnqueueResult {
  success: boolean;
  crossJobId: string | null;
  projectionId: string | null;
  error?: string;
}

/**
 * Run the publish pipeline for one listing to one channel.
 * F3.1: validates + creates crossJob(QUEUED) + enqueues BullMQ job. Returns immediately.
 */
export async function publishListingToChannel(
  listingId: string,
  channel: ExternalChannel,
  sellerId: string,
  overrides?: ChannelOverrides | null,
): Promise<PublishEnqueueResult> {
  const channelMeta = getChannelMetadata(channel);

  // Step 1: LOAD LISTING
  const [listingRow] = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      status: listing.status,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      condition: listing.condition,
      brand: listing.brand,
      quantity: listing.quantity,
      weightOz: listing.weightOz,
      lengthIn: listing.lengthIn,
      widthIn: listing.widthIn,
      heightIn: listing.heightIn,
      freeShipping: listing.freeShipping,
      shippingCents: listing.shippingCents,
      attributesJson: listing.attributesJson,
      categoryId: listing.categoryId,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow) {
    return { success: false, crossJobId: null, projectionId: null, error: 'Listing not found.' };
  }
  if (listingRow.ownerUserId !== sellerId) {
    return { success: false, crossJobId: null, projectionId: null, error: 'Listing not found.' };
  }
  if (listingRow.status !== 'ACTIVE') {
    return { success: false, crossJobId: null, projectionId: null, error: 'Listing is not active.' };
  }

  const images = await db
    .select({ url: listingImage.url, position: listingImage.position, isPrimary: listingImage.isPrimary })
    .from(listingImage)
    .where(eq(listingImage.listingId, listingId));

  const canonicalListing: CanonicalListingData = {
    ...listingRow,
    attributesJson: listingRow.attributesJson as Record<string, unknown>,
  };
  const canonicalImages: CanonicalImageData[] = images.map((img) => ({
    url: img.url,
    position: img.position,
    isPrimary: img.isPrimary ?? false,
  }));

  // Step 2: VALIDATE (policy check before any external call)
  const policyResult = await validateForChannel(canonicalListing, canonicalImages, channel);
  if (policyResult.status === 'DENY') {
    return { success: false, crossJobId: null, projectionId: null, error: policyResult.reason };
  }
  if (policyResult.status === 'REQUIRE_FIELDS') {
    return { success: false, crossJobId: null, projectionId: null, error: `Missing required fields: ${policyResult.fields.join(', ')}` };
  }
  if (policyResult.status === 'REQUIRE_CHANGES') {
    logger.info('[publishService] REQUIRE_CHANGES (proceeding with auto-fix)', { listingId, channel });
  }

  // Step 3: CHECK CROSSLIST FEATURE FLAG
  const enabled = await isCrosslistEnabled(channel);
  if (!enabled) {
    return { success: false, crossJobId: null, projectionId: null, error: `Publishing to ${channelMeta.displayName} is currently disabled.` };
  }

  // Step 4: LOOKUP ACCOUNT
  const [account] = await db
    .select()
    .from(crosslisterAccount)
    .where(
      and(
        eq(crosslisterAccount.sellerId, sellerId),
        eq(crosslisterAccount.channel, channel),
        eq(crosslisterAccount.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  if (!account) {
    return { success: false, crossJobId: null, projectionId: null, error: `No active ${channelMeta.displayName} account connected. Connect your account first.` };
  }

  // Step 5: TRANSFORM
  const [mappingRow] = await db
    .select({ externalCategoryId: channelCategoryMapping.externalCategoryId, externalCategoryName: channelCategoryMapping.externalCategoryName })
    .from(channelCategoryMapping)
    .where(
      and(
        eq(channelCategoryMapping.channel, channel),
        eq(channelCategoryMapping.twicelyCategoryId, canonicalListing.categoryId ?? ''),
      ),
    )
    .limit(1);

  const categoryMapping: ExternalCategoryMapping | null = mappingRow
    ? { externalCategoryId: mappingRow.externalCategoryId, externalCategoryName: mappingRow.externalCategoryName, path: [] }
    : null;

  const transformedListing = transformListingForChannel({
    listing: canonicalListing,
    images: canonicalImages,
    channel,
    overrides: overrides ?? null,
    categoryMapping,
    handlingTimeDays: 3,
  });

  // Step 6: UPSERT PROJECTION (status: QUEUED)
  const [existingProjection] = await db
    .select({ id: channelProjection.id, status: channelProjection.status, publishAttempts: channelProjection.publishAttempts })
    .from(channelProjection)
    .where(
      and(
        eq(channelProjection.listingId, listingId),
        eq(channelProjection.accountId, account.id),
        eq(channelProjection.channel, channel),
      ),
    )
    .limit(1);

  let projectionId: string;

  if (existingProjection) {
    if (existingProjection.status === 'ACTIVE' || existingProjection.status === 'PUBLISHING') {
      return { success: false, crossJobId: null, projectionId: existingProjection.id, error: `This listing is already published to ${channelMeta.displayName}.` };
    }
    await db.update(channelProjection).set({
      status: 'PUBLISHING',
      publishAttempts: 0,
      overridesJson: (overrides ?? {}) as Record<string, unknown>,
      updatedAt: new Date(),
    }).where(eq(channelProjection.id, existingProjection.id));
    projectionId = existingProjection.id;
  } else {
    const [inserted] = await db.insert(channelProjection).values({
      listingId,
      accountId: account.id,
      channel,
      sellerId,
      status: 'PUBLISHING',
      overridesJson: (overrides ?? {}) as Record<string, unknown>,
      syncEnabled: true,
    }).returning({ id: channelProjection.id });

    if (!inserted) {
      return { success: false, crossJobId: null, projectionId: null, error: 'Failed to create projection.' };
    }
    projectionId = inserted.id;
  }

  // Step 7: CREATE CROSS JOB (status: QUEUED)
  const idempotencyKey = `publish:${listingId}:${channel}:${Date.now()}`;
  const [jobRow] = await db.insert(crossJob).values({
    sellerId,
    projectionId,
    accountId: account.id,
    jobType: 'CREATE',
    priority: PRIORITY_CREATE,
    idempotencyKey,
    status: 'QUEUED',
    maxAttempts: MAX_ATTEMPTS_PUBLISH,
    payload: { listingId, channel, transformedListing },
  }).returning({ id: crossJob.id });

  const crossJobId = jobRow?.id ?? null;

  if (!crossJobId) {
    return { success: false, crossJobId: null, projectionId, error: 'Failed to create job record.' };
  }

  // Step 8: ENQUEUE TO BULLMQ
  try {
    const bullJob = await listerPublishQueue.add(
      `create:${listingId}:${channel}`,
      {
        crossJobId,
        listingId,
        channel,
        sellerId,
        accountId: account.id,
        projectionId,
        overrides: (overrides ?? null) as Record<string, unknown> | null,
        jobType: 'CREATE',
      },
      {
        jobId: idempotencyKey,
        priority: PRIORITY_CREATE,
        attempts: MAX_ATTEMPTS_PUBLISH,
        backoff: BACKOFF_PUBLISH,
        removeOnComplete: REMOVE_ON_COMPLETE,
        removeOnFail: REMOVE_ON_FAIL,
      },
    );

    // Store BullMQ job ID on the cross_job row
    await db.update(crossJob).set({
      bullmqJobId: bullJob.id ?? null,
      updatedAt: new Date(),
    }).where(eq(crossJob.id, crossJobId));

    logger.info('[publishService] Enqueued CREATE job', { crossJobId, listingId, channel, bullmqJobId: bullJob.id });
    return { success: true, crossJobId, projectionId };
  } catch (err) {
    logger.error('[publishService] Failed to enqueue job', { crossJobId, listingId, channel, error: String(err) });
    // Revert projection and job to FAILED state
    await db.update(channelProjection).set({ status: 'ERROR', updatedAt: new Date() }).where(eq(channelProjection.id, projectionId));
    await db.update(crossJob).set({ status: 'FAILED', lastError: String(err), updatedAt: new Date() }).where(eq(crossJob.id, crossJobId));
    return { success: false, crossJobId, projectionId, error: String(err) };
  }
}

