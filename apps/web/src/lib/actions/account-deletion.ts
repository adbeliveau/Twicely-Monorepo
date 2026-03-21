'use server';

import { db } from '@twicely/db';
import { order, user as userTable } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { cascadeProjectionsToOrphaned, revertOrphanedProjections } from '@twicely/crosslister/services/projection-cascade';
import { logger } from '@twicely/logger';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

interface DeletionBlocker {
  type: 'OPEN_ORDERS' | 'OPEN_DISPUTES' | 'OPEN_RETURNS';
  count: number;
  message: string;
}

/**
 * Internal helper — check blockers for a given userId.
 * Called by authenticated callers that have already verified session.
 */
async function getBlockersForUser(userId: string): Promise<DeletionBlocker[]> {
  const blockers: DeletionBlocker[] = [];

  // Check for open orders as seller
  const openSellerOrders = await db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.sellerId, userId),
        inArray(order.status, ['CREATED', 'PAID', 'SHIPPED']),
      ),
    );

  // Check for open orders as buyer
  const openBuyerOrders = await db
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.buyerId, userId),
        inArray(order.status, ['CREATED', 'PAID', 'SHIPPED']),
      ),
    );

  const totalOpen = openSellerOrders.length + openBuyerOrders.length;
  if (totalOpen > 0) {
    blockers.push({
      type: 'OPEN_ORDERS',
      count: totalOpen,
      message: `You have ${totalOpen} order(s) that must be completed before closing your account.`,
    });
  }

  return blockers;
}

/**
 * Check if the authenticated user's account has blockers preventing deletion.
 */
export async function getAccountDeletionBlockers(): Promise<DeletionBlocker[]> {
  const { session } = await authorize();
  if (!session) return [];
  return getBlockersForUser(session.userId);
}

/**
 * Begin account deletion cooling-off period.
 * Cascades all projections to ORPHANED immediately.
 */
export async function beginAccountDeletion(): Promise<{
  success: boolean;
  error?: string;
  blockers?: DeletionBlocker[];
}> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const userId = session.userId;
  if (!ability.can('delete', sub('User', { id: userId }))) {
    return { success: false, error: 'Forbidden' };
  }

  const blockers = await getBlockersForUser(userId);
  if (blockers.length > 0) {
    return { success: false, error: 'Account has blockers', blockers };
  }

  // Read grace period from platform settings — NOT hardcoded
  const gracePeriodDays = await getPlatformSetting<number>(
    'gdpr.deletionGracePeriodDays',
    30
  );

  const now = new Date();
  const deletionDate = new Date(now);
  deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);

  // Set deletionRequestedAt on the user record
  await db
    .update(userTable)
    .set({ deletionRequestedAt: now })
    .where(eq(userTable.id, userId));

  const orphanedCount = await cascadeProjectionsToOrphaned(userId);

  // Send deletion_started notification
  await notify(userId, 'privacy.deletion_started', {
    deletionDate: deletionDate.toLocaleDateString(),
  });

  logger.info('Account deletion cooling-off started', {
    userId,
    orphanedProjections: orphanedCount,
    deletionDate,
  });

  return { success: true };
}

/**
 * Cancel account deletion during cooling-off.
 * Reverts ORPHANED → UNMANAGED (not ACTIVE, subscription may have lapsed).
 */
export async function cancelAccountDeletion(): Promise<{
  success: boolean;
  revertedCount: number;
  error?: string;
}> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, revertedCount: 0, error: 'Unauthorized' };
  }

  const userId = session.userId;
  if (!ability.can('delete', sub('User', { id: userId }))) {
    return { success: false, revertedCount: 0, error: 'Forbidden' };
  }

  // Clear deletionRequestedAt
  await db
    .update(userTable)
    .set({ deletionRequestedAt: null })
    .where(eq(userTable.id, userId));

  const revertedCount = await revertOrphanedProjections(userId);

  logger.info('Account deletion cancelled', {
    userId,
    revertedProjections: revertedCount,
  });

  return { success: true, revertedCount };
}
