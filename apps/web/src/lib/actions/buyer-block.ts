'use server';

/**
 * C1.6 — Buyer Block List
 *
 * Server actions for managing blocked buyers:
 * - blockBuyer: Block a buyer from purchasing/offers
 * - unblockBuyer: Remove a buyer from block list
 * - isBlocked: Check if a buyer is blocked by a seller
 *
 * Constraints:
 * - No notification sent to blocked buyer
 * - Blocked user cannot message, purchase from, or make offers (Feature Lock-in §19)
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { buyerBlockList } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { logger } from '@twicely/logger';
import { z } from 'zod';

const blockBuyerSchema = z.object({
  buyerId: z.string().min(1),
  reason: z.string().max(500).optional(),
}).strict();

const unblockBuyerSchema = z.object({
  buyerId: z.string().min(1),
}).strict();

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Block a buyer from making purchases/offers.
 */
export async function blockBuyerAction(
  buyerId: string,
  reason?: string
): Promise<ActionResult> {
  const parsed = blockBuyerSchema.safeParse({ buyerId, reason });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId: sellerId }))) return { success: false, error: 'Not authorized' };

  // Cannot block yourself
  if (buyerId === sellerId) {
    return { success: false, error: 'Cannot block yourself' };
  }

  try {
    // Check if already blocked
    const [existing] = await db
      .select({ id: buyerBlockList.id })
      .from(buyerBlockList)
      .where(
        and(
          eq(buyerBlockList.blockerId, sellerId),
          eq(buyerBlockList.blockedId, buyerId)
        )
      )
      .limit(1);

    if (existing) {
      return { success: false, error: 'Buyer is already blocked' };
    }

    // Insert block record
    await db.insert(buyerBlockList).values({
      blockerId: sellerId,
      blockedId: buyerId,
      reason: reason ?? null,
    });

    revalidatePath('/my/selling/blocked-buyers');
    return { success: true };
  } catch (error) {
    logger.error('Block buyer error', { error: String(error) });
    return { success: false, error: 'Failed to block buyer' };
  }
}

/**
 * Unblock a previously blocked buyer.
 */
export async function unblockBuyerAction(buyerId: string): Promise<ActionResult> {
  const parsed = unblockBuyerSchema.safeParse({ buyerId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('update', sub('SellerProfile', { userId: sellerId }))) return { success: false, error: 'Not authorized' };

  try {
    const result = await db
      .delete(buyerBlockList)
      .where(
        and(
          eq(buyerBlockList.blockerId, sellerId),
          eq(buyerBlockList.blockedId, buyerId)
        )
      )
      .returning({ id: buyerBlockList.id });

    if (result.length === 0) {
      return { success: false, error: 'Buyer is not blocked' };
    }

    revalidatePath('/my/selling/blocked-buyers');
    return { success: true };
  } catch (error) {
    logger.error('Unblock buyer error', { error: String(error) });
    return { success: false, error: 'Failed to unblock buyer' };
  }
}

/**
 * Get list of blocked buyers for a seller.
 */
export async function getBlockedBuyersAction(): Promise<{
  success: boolean;
  buyers?: Array<{
    blockedId: string;
    reason: string | null;
    blockedAt: Date;
  }>;
  error?: string;
}> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };
  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;
  if (!ability.can('read', sub('SellerProfile', { userId: sellerId }))) return { success: false, error: 'Not authorized' };

  try {
    const blocked = await db
      .select({
        blockedId: buyerBlockList.blockedId,
        reason: buyerBlockList.reason,
        blockedAt: buyerBlockList.createdAt,
      })
      .from(buyerBlockList)
      .where(eq(buyerBlockList.blockerId, sellerId))
      .orderBy(buyerBlockList.createdAt);

    return {
      success: true,
      buyers: blocked.map((b) => ({
        blockedId: b.blockedId,
        reason: b.reason,
        blockedAt: b.blockedAt,
      })),
    };
  } catch (error) {
    logger.error('Get blocked buyers error', { error: String(error) });
    return { success: false, error: 'Failed to get blocked buyers' };
  }
}

