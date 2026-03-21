import { db } from '@twicely/db';
import { channelProjection, crossJob } from '@twicely/db/schema';
import { eq, and, inArray, not } from 'drizzle-orm';
import { getTierInterval } from '@twicely/crosslister/polling/poll-tier-manager';

type CrossJobType = typeof crossJob.jobType._.data;
type CrossJobStatus = typeof crossJob.status._.data;
type ChannelType = typeof channelProjection.channel._.data;

/**
 * Transition all ACTIVE projections to UNMANAGED when lister subscription ends.
 * Cancels pending crosslister jobs in the crossJob table.
 * Note: EMERGENCY_DELIST jobs run in a separate BullMQ queue (lister:emergency-delist)
 * and are never in crossJob — they are unaffected by this call.
 */
export async function cascadeProjectionsToUnmanaged(sellerId: string): Promise<number> {
  // Transition ACTIVE → UNMANAGED
  const result = await db
    .update(channelProjection)
    .set({ status: 'UNMANAGED', updatedAt: new Date() })
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    )
    .returning({ id: channelProjection.id });

  // Cancel pending/queued crosslister jobs
  // EMERGENCY_DELIST is in its own queue and is unaffected
  await cancelCrosslisterJobsForSeller(sellerId);

  return result.length;
}

/**
 * Cancel pending/queued crosslister jobs for a seller.
 * Optionally exclude specific job types from cancellation.
 */
export async function cancelCrosslisterJobsForSeller(
  sellerId: string,
  excludeTypes: CrossJobType[] = [],
): Promise<void> {
  const cancelStatuses: CrossJobStatus[] = ['PENDING', 'QUEUED'];

  if (excludeTypes.length > 0) {
    await db
      .update(crossJob)
      .set({ status: 'CANCELED', updatedAt: new Date() })
      .where(
        and(
          eq(crossJob.sellerId, sellerId),
          inArray(crossJob.status, cancelStatuses),
          not(inArray(crossJob.jobType, excludeTypes)),
        ),
      );
  } else {
    await db
      .update(crossJob)
      .set({ status: 'CANCELED', updatedAt: new Date() })
      .where(
        and(
          eq(crossJob.sellerId, sellerId),
          inArray(crossJob.status, cancelStatuses),
        ),
      );
  }
}

/**
 * Reactivate UNMANAGED projections when seller resubscribes.
 * Sets to ACTIVE with COLD poll tier (interval from platform_settings).
 */
export async function reactivateUnmanagedProjections(sellerId: string): Promise<number> {
  const coldIntervalMs = await getTierInterval('COLD');
  const result = await db
    .update(channelProjection)
    .set({
      status: 'ACTIVE',
      pollTier: 'COLD',
      nextPollAt: new Date(Date.now() + coldIntervalMs),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        eq(channelProjection.status, 'UNMANAGED'),
      ),
    )
    .returning({ id: channelProjection.id });

  return result.length;
}

/**
 * Cascade all projections to ORPHANED when account deletion begins.
 * Unlike UNMANAGED, this cancels ALL crossJob entries.
 * (EMERGENCY_DELIST jobs run in a separate queue and are unaffected.)
 */
export async function cascadeProjectionsToOrphaned(sellerId: string): Promise<number> {
  const now = new Date();
  const result = await db
    .update(channelProjection)
    .set({
      status: 'ORPHANED',
      orphanedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        inArray(channelProjection.status, ['ACTIVE', 'UNMANAGED', 'PUBLISHING', 'PAUSED']),
      ),
    )
    .returning({ id: channelProjection.id });

  // Cancel ALL crossJob entries — account is closing
  await cancelCrosslisterJobsForSeller(sellerId, []);

  return result.length;
}

/**
 * Revert ORPHANED → UNMANAGED when seller cancels account deletion during cooling-off.
 * Goes to UNMANAGED (not ACTIVE) because subscription may have lapsed.
 */
export async function revertOrphanedProjections(sellerId: string): Promise<number> {
  const result = await db
    .update(channelProjection)
    .set({
      status: 'UNMANAGED',
      orphanedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        eq(channelProjection.status, 'ORPHANED'),
      ),
    )
    .returning({ id: channelProjection.id });

  return result.length;
}

/**
 * Disconnect a specific platform — ACTIVE → UNMANAGED for that channel only.
 */
export async function disconnectPlatformProjections(
  sellerId: string,
  channel: ChannelType,
): Promise<number> {
  const result = await db
    .update(channelProjection)
    .set({ status: 'UNMANAGED', updatedAt: new Date() })
    .where(
      and(
        eq(channelProjection.sellerId, sellerId),
        eq(channelProjection.channel, channel),
        eq(channelProjection.status, 'ACTIVE'),
      ),
    )
    .returning({ id: channelProjection.id });

  return result.length;
}
