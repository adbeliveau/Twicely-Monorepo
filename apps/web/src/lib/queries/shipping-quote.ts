import { db } from '@twicely/db';
import { combinedShippingQuote, order } from '@twicely/db/schema';
import { eq, and, inArray, lt } from 'drizzle-orm';

export type ShippingQuoteData = typeof combinedShippingQuote.$inferSelect;

/**
 * Fetch a combined shipping quote by order ID.
 * Returns null if no quote exists or if the requesting user is not the buyer/seller.
 */
export async function getShippingQuoteByOrderId(
  orderId: string,
  userId: string
): Promise<ShippingQuoteData | null> {
  const [row] = await db
    .select()
    .from(combinedShippingQuote)
    .where(eq(combinedShippingQuote.orderId, orderId))
    .limit(1);

  if (!row) return null;

  // Ownership check: user must be the buyer or seller
  if (row.sellerId !== userId && row.buyerId !== userId) {
    return null;
  }

  return row;
}

/**
 * Fetch a combined shipping quote by its ID.
 * Returns null if not found or if the requesting user is not the buyer/seller.
 */
export async function getShippingQuoteById(
  quoteId: string,
  userId: string
): Promise<ShippingQuoteData | null> {
  const [row] = await db
    .select()
    .from(combinedShippingQuote)
    .where(eq(combinedShippingQuote.id, quoteId))
    .limit(1);

  if (!row) return null;

  // Ownership check: user must be the buyer or seller
  if (row.sellerId !== userId && row.buyerId !== userId) {
    return null;
  }

  return row;
}

export interface PendingQuoteWithOrder extends ShippingQuoteData {
  orderNumber: string;
}

/**
 * Fetch all pending quotes for a seller, ordered by deadline (most urgent first).
 * Includes PENDING_SELLER and PENALTY_APPLIED statuses.
 */
export async function getPendingQuotesForSeller(
  userId: string
): Promise<PendingQuoteWithOrder[]> {
  const rows = await db
    .select({
      id: combinedShippingQuote.id,
      orderId: combinedShippingQuote.orderId,
      sellerId: combinedShippingQuote.sellerId,
      buyerId: combinedShippingQuote.buyerId,
      status: combinedShippingQuote.status,
      maxShippingCents: combinedShippingQuote.maxShippingCents,
      quotedShippingCents: combinedShippingQuote.quotedShippingCents,
      penaltyApplied: combinedShippingQuote.penaltyApplied,
      penaltyDiscountPercent: combinedShippingQuote.penaltyDiscountPercent,
      finalShippingCents: combinedShippingQuote.finalShippingCents,
      savingsCents: combinedShippingQuote.savingsCents,
      sellerDeadline: combinedShippingQuote.sellerDeadline,
      sellerQuotedAt: combinedShippingQuote.sellerQuotedAt,
      buyerRespondedAt: combinedShippingQuote.buyerRespondedAt,
      createdAt: combinedShippingQuote.createdAt,
      updatedAt: combinedShippingQuote.updatedAt,
      orderNumber: order.orderNumber,
    })
    .from(combinedShippingQuote)
    .innerJoin(order, eq(order.id, combinedShippingQuote.orderId))
    .where(
      and(
        eq(combinedShippingQuote.sellerId, userId),
        inArray(combinedShippingQuote.status, ['PENDING_SELLER', 'PENALTY_APPLIED'])
      )
    )
    .orderBy(combinedShippingQuote.sellerDeadline);

  return rows;
}

/**
 * Fetch all expired quotes (PENDING_SELLER with deadline passed).
 * Used by the penalty deadline job.
 */
export async function getExpiredQuotes(): Promise<ShippingQuoteData[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(combinedShippingQuote)
    .where(
      and(
        eq(combinedShippingQuote.status, 'PENDING_SELLER'),
        lt(combinedShippingQuote.sellerDeadline, now)
      )
    );

  return rows;
}
