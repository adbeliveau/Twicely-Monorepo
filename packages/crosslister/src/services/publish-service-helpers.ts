/**
 * Publish service helpers — channel setting key mapping, crosslist feature checks,
 * and sync job enqueueing.
 * Extracted from publish-service.ts to keep files under 300 lines.
 */

import { db } from '@twicely/db';
import { platformSetting, featureFlag, channelProjection, crossJob } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { isFeatureEnabled } from '@twicely/config/feature-flags';
import { listerPublishQueue } from '../queue/lister-queue';
import {
  PRIORITY_SYNC,
  MAX_ATTEMPTS_SYNC,
  BACKOFF_SYNC,
  REMOVE_ON_COMPLETE,
  REMOVE_ON_FAIL,
} from '../queue/constants';
import type { ExternalChannel } from '../types';

/** Map ExternalChannel to its platformSetting crosslistEnabled key segment. */
export function channelSettingKey(channel: ExternalChannel): string {
  const map: Record<ExternalChannel, string> = {
    EBAY: 'ebay',
    POSHMARK: 'poshmark',
    MERCARI: 'mercari',
    DEPOP: 'depop',
    FB_MARKETPLACE: 'fbMarketplace',
    ETSY: 'etsy',
    GRAILED: 'grailed',
    THEREALREAL: 'therealreal',
    WHATNOT: 'whatnot',
    SHOPIFY: 'shopify',
    VESTIAIRE: 'vestiaire',
  };
  return map[channel];
}

/**
 * Dual-check: platformSetting (primary) + featureFlag table (secondary kill-switch).
 */
export async function isCrosslistEnabled(channel: ExternalChannel): Promise<boolean> {
  const settingKey = `crosslister.${channelSettingKey(channel)}.crosslistEnabled`;

  const [setting] = await db
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, settingKey))
    .limit(1);

  if (setting?.value === false || setting?.value === 'false') {
    return false;
  }

  const connectorFlagKey = `connector:${channel.toLowerCase()}`;
  const [flagRow] = await db
    .select({ enabled: featureFlag.enabled })
    .from(featureFlag)
    .where(eq(featureFlag.key, connectorFlagKey))
    .limit(1);

  if (flagRow !== undefined) {
    const featureFlagEnabled = await isFeatureEnabled(connectorFlagKey);
    if (!featureFlagEnabled) return false;
  }

  return true;
}

/**
 * Enqueue an UPDATE/SYNC job for an existing active projection.
 * Sync jobs do NOT consume publish credits (Lister Canonical section 7.1).
 */
export async function enqueueSyncJob(
  projectionId: string,
  sellerId: string,
): Promise<void> {
  const [proj] = await db
    .select({
      id: channelProjection.id,
      listingId: channelProjection.listingId,
      accountId: channelProjection.accountId,
      channel: channelProjection.channel,
      externalId: channelProjection.externalId,
    })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);

  if (!proj?.externalId) return;

  const idempotencyKey = `sync:${projectionId}:${Date.now()}`;

  const [jobRow] = await db.insert(crossJob).values({
    sellerId,
    projectionId,
    accountId: proj.accountId,
    jobType: 'UPDATE',
    priority: PRIORITY_SYNC,
    idempotencyKey,
    status: 'QUEUED',
    maxAttempts: MAX_ATTEMPTS_SYNC,
    payload: { projectionId, channel: proj.channel },
  }).returning({ id: crossJob.id });

  if (!jobRow?.id) return;

  const bullJob = await listerPublishQueue.add(
    `sync:${projectionId}`,
    {
      crossJobId: jobRow.id,
      listingId: proj.listingId,
      channel: proj.channel,
      sellerId,
      accountId: proj.accountId,
      projectionId: proj.id,
      overrides: null,
      jobType: 'UPDATE',
    },
    {
      jobId: idempotencyKey,
      priority: PRIORITY_SYNC,
      attempts: MAX_ATTEMPTS_SYNC,
      backoff: BACKOFF_SYNC,
      removeOnComplete: REMOVE_ON_COMPLETE,
      removeOnFail: REMOVE_ON_FAIL,
    },
  );

  await db.update(crossJob).set({
    bullmqJobId: bullJob.id ?? null,
    updatedAt: new Date(),
  }).where(eq(crossJob.id, jobRow.id));

  logger.info('[publishService] Enqueued SYNC job', { projectionId, bullmqJobId: bullJob.id });
}
