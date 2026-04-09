'use server';

/**
 * Local Cash Sale — Phase 5 server action (hub-local / engine-local).
 *
 * Thin wrapper over postLocalCashSale() from @twicely/commerce/local-cash-sale.
 * This exists as a server action for cases where a ledger entry must be posted
 * WITHOUT transitioning the local transaction state (e.g. adjusting an existing
 * cash sale record). For the standard "seller marks sale complete" flow, use
 * completeCashLocalSaleAction in local-cash-complete.ts which handles the state
 * transition AND the ledger post in one call.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1 §A16: cash sales are tracked in
 * the Financial Center for P&L but carry zero platform fee and do not touch
 * sellerBalance.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction, orderItem } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { postLocalCashSale } from '@twicely/commerce/local-cash-sale';
import { logger } from '@twicely/logger';
import { z } from 'zod';

const postLocalCashSaleSchema = z.object({
  transactionId: z.string().cuid2(),
  amountCents: z.number().int().positive(),
}).strict();

type ActionResult = { success: boolean; ledgerEntryId?: string; error?: string };

export async function postLocalCashSaleAction(
  data: z.infer<typeof postLocalCashSaleSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = postLocalCashSaleSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { transactionId, amountCents } = parsed.data;
  const actingUserId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // Fetch the transaction to verify ownership and source the orderItem.
  const [tx] = await db
    .select({
      id: localTransaction.id,
      sellerId: localTransaction.sellerId,
      buyerId: localTransaction.buyerId,
      orderId: localTransaction.orderId,
    })
    .from(localTransaction)
    .where(eq(localTransaction.id, transactionId))
    .limit(1);

  if (!tx) {
    return { success: false, error: 'Transaction not found' };
  }

  if (!ability.can('update', sub('LocalTransaction', { sellerId: tx.sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  if (tx.sellerId !== actingUserId) {
    return { success: false, error: 'Forbidden' };
  }

  // Look up the listing via orderItem (local meetups are single-item).
  const [item] = await db
    .select({ listingId: orderItem.listingId })
    .from(orderItem)
    .where(eq(orderItem.orderId, tx.orderId))
    .limit(1);

  try {
    const result = await postLocalCashSale({
      localTransactionId: transactionId,
      sellerId: tx.sellerId,
      buyerId: tx.buyerId,
      amountCents,
      listingId: item?.listingId ?? null,
    });

    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/transactions');

    return { success: true, ledgerEntryId: result.ledgerEntryId };
  } catch (error) {
    logger.error('[postLocalCashSaleAction] Failed', {
      transactionId,
      error: String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post cash sale',
    };
  }
}
