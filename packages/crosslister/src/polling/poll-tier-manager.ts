/**
 * Poll Tier Manager
 * Handles promotion/demotion of pollTier on channelProjection.
 * Spec: Lister Canonical §13.3
 */

import { db } from '@twicely/db';
import { channelProjection } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

export type PollTier = 'HOT' | 'WARM' | 'COLD' | 'LONGTAIL';

export type PollSignal =
  | 'WATCHER_ADDED'
  | 'OFFER_RECEIVED'
  | 'PRICE_CHANGED'
  | 'SALE_DETECTED';

// Cache intervals for 5 minutes
let intervalCache: Record<string, number> = {};
let intervalCacheExpiresAt = 0;

export async function getTierInterval(tier: PollTier): Promise<number> {
  const now = Date.now();
  if (now < intervalCacheExpiresAt && tier in intervalCache) {
    return intervalCache[tier] as number;
  }

  const defaults: Record<PollTier, number> = {
    HOT: 90_000,
    WARM: 600_000,
    COLD: 2_700_000,
    LONGTAIL: 14_400_000,
  };

  const key = `crosslister.polling.${tier.toLowerCase()}.intervalMs`;
  const val = await getPlatformSetting<number>(key, defaults[tier]);
  intervalCache[tier] = val;
  intervalCacheExpiresAt = now + 300_000;
  return intervalCache[tier] as number;
}

/**
 * Promote a projection's poll tier based on an activity signal.
 */
export async function promoteTier(projectionId: string, signal: PollSignal): Promise<void> {
  const [projection] = await db
    .select({ pollTier: channelProjection.pollTier, prePollTier: channelProjection.prePollTier })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);

  if (!projection) return;

  const currentTier = projection.pollTier as PollTier;
  const now = new Date();

  switch (signal) {
    case 'WATCHER_ADDED':
    case 'OFFER_RECEIVED': {
      // Promote to HOT, store pre-poll tier
      const prePollTier = currentTier === 'HOT' ? projection.prePollTier : currentTier;
      await db
        .update(channelProjection)
        .set({ pollTier: 'HOT', prePollTier: prePollTier ?? 'COLD', updatedAt: now })
        .where(eq(channelProjection.id, projectionId));
      await scheduleNextPoll(projectionId, 'HOT');
      break;
    }
    case 'PRICE_CHANGED': {
      // Promote to WARM for 30 min
      if (currentTier !== 'HOT') {
        await db
          .update(channelProjection)
          .set({ pollTier: 'WARM', updatedAt: now })
          .where(eq(channelProjection.id, projectionId));
      }
      await scheduleNextPoll(projectionId, currentTier === 'HOT' ? 'HOT' : 'WARM');
      break;
    }
    case 'SALE_DETECTED': {
      // HOT with no next poll (until delist confirmed)
      const prePollTier = currentTier === 'HOT' ? projection.prePollTier : currentTier;
      await db
        .update(channelProjection)
        .set({ pollTier: 'HOT', prePollTier: prePollTier ?? 'COLD', nextPollAt: null, updatedAt: now })
        .where(eq(channelProjection.id, projectionId));
      break;
    }
  }
}

/**
 * Demote a projection based on inactivity.
 * Called by the scheduler when no recent activity detected.
 */
export async function demoteTier(projectionId: string): Promise<void> {
  const [projection] = await db
    .select({
      pollTier: channelProjection.pollTier,
      lastPolledAt: channelProjection.lastPolledAt,
      prePollTier: channelProjection.prePollTier,
    })
    .from(channelProjection)
    .where(eq(channelProjection.id, projectionId))
    .limit(1);

  if (!projection || !projection.lastPolledAt) return;

  const daysSinceLastPoll = (Date.now() - projection.lastPolledAt.getTime()) / 86_400_000;
  const currentTier = projection.pollTier as PollTier;
  let newTier: PollTier = currentTier;

  if (currentTier === 'HOT') {
    // HOT → WARM dwell, then back to prePollTier
    const hotDecayMs = await getPlatformSetting<number>('crosslister.polling.hotDecayDwellMs', 1_800_000);
    const msSinceLastPoll = Date.now() - projection.lastPolledAt.getTime();
    if (msSinceLastPoll > hotDecayMs) {
      newTier = (projection.prePollTier as PollTier) ?? 'COLD';
    } else {
      newTier = 'WARM';
    }
  } else {
    const longtailDays = await getPlatformSetting<number>('crosslister.polling.longtailDemotionDays', 30);
    const coldDays = await getPlatformSetting<number>('crosslister.polling.coldDemotionDays', 7);
    if (daysSinceLastPoll > longtailDays) {
      newTier = 'LONGTAIL';
    } else if (daysSinceLastPoll > coldDays) {
      newTier = 'COLD';
    }
  }

  if (newTier !== currentTier) {
    await db
      .update(channelProjection)
      .set({ pollTier: newTier, updatedAt: new Date() })
      .where(eq(channelProjection.id, projectionId));
    await scheduleNextPoll(projectionId, newTier);
  }
}

/**
 * Set nextPollAt based on the tier's interval from platform_settings.
 */
export async function scheduleNextPoll(projectionId: string, tier: PollTier): Promise<void> {
  const intervalMs = await getTierInterval(tier);
  const nextPollAt = new Date(Date.now() + intervalMs);

  await db
    .update(channelProjection)
    .set({ nextPollAt })
    .where(eq(channelProjection.id, projectionId));
}

/**
 * Elevate ALL of a seller's active projections to HOT.
 * Called when double-sell rate exceeds threshold.
 */
export async function applyDoubleSellElevation(sellerId: string): Promise<void> {
  const now = new Date();
  const interval = await getTierInterval('HOT');
  const nextPollAt = new Date(Date.now() + interval);

  await db
    .update(channelProjection)
    .set({ pollTier: 'HOT', prePollTier: 'COLD', nextPollAt, updatedAt: now })
    .where(eq(channelProjection.sellerId, sellerId));
}

/** Reset interval cache (testing only). */
export function resetIntervalCache(): void {
  intervalCache = {};
  intervalCacheExpiresAt = 0;
}
