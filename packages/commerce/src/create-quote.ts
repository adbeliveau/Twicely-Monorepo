import { combinedShippingQuote, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

type AnyTx = PgTransaction<
  PostgresJsQueryResultHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

interface CreateQuoteParams {
  tx: AnyTx;
  orderId: string;
  sellerId: string;
  buyerId: string;
  orderShippingCents: number;
  itemCount: number;
  isLocalPickup: boolean;
  combinedShippingMode: string | null | undefined;
}

export interface CreatedQuoteInfo {
  id: string;
  maxShippingCents: number;
  sellerDeadline: Date;
}

/**
 * Create a combinedShippingQuote record if the seller uses QUOTED mode
 * and the order has 2+ items. Call inside the order creation transaction.
 * Returns the new quote info, or undefined if no quote was created.
 */
export async function createCombinedShippingQuoteIfNeeded(
  params: CreateQuoteParams
): Promise<CreatedQuoteInfo | undefined> {
  const {
    tx,
    orderId,
    sellerId,
    buyerId,
    orderShippingCents,
    itemCount,
    isLocalPickup,
    combinedShippingMode,
  } = params;

  if (isLocalPickup || combinedShippingMode !== 'QUOTED' || itemCount <= 1) {
    return undefined;
  }

  const deadlineHours = await getPlatformSetting<number>(
    'commerce.shipping.combinedQuoteDeadlineHours',
    48
  );
  const penaltyPercent = await getPlatformSetting<number>(
    'commerce.shipping.combinedPenaltyDiscountPercent',
    25
  );

  const sellerDeadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

  const [newQuote] = await tx
    .insert(combinedShippingQuote)
    .values({
      orderId,
      sellerId,
      buyerId,
      status: 'PENDING_SELLER',
      maxShippingCents: orderShippingCents,
      penaltyDiscountPercent: penaltyPercent,
      sellerDeadline,
    })
    .returning({ id: combinedShippingQuote.id });

  if (!newQuote) return undefined;

  await tx
    .update(order)
    .set({ combinedShippingQuoteId: newQuote.id })
    .where(eq(order.id, orderId));

  return { id: newQuote.id, maxShippingCents: orderShippingCents, sellerDeadline };
}
