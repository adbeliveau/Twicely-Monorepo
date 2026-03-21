import { db } from '@twicely/db';
import { buyerBlockList } from '@twicely/db/schema';
import { eq, and, count } from 'drizzle-orm';

/**
 * Check if a buyer is blocked by a seller.
 * Used in offer-engine and cart to prevent transactions.
 */
export async function isBuyerBlocked(
  sellerId: string,
  buyerId: string
): Promise<boolean> {
  const [result] = await db
    .select({ id: buyerBlockList.id })
    .from(buyerBlockList)
    .where(
      and(
        eq(buyerBlockList.blockerId, sellerId),
        eq(buyerBlockList.blockedId, buyerId)
      )
    )
    .limit(1);

  return !!result;
}

/**
 * Get count of blocked buyers for a seller.
 */
export async function getBlockedBuyerCount(sellerId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(buyerBlockList)
    .where(eq(buyerBlockList.blockerId, sellerId));

  return result?.count ?? 0;
}
