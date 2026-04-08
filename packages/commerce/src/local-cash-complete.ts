/**
 * Cash local sale completion — marks a transaction COMPLETED and emits
 * a LOCAL_CASH_SALE_REVENUE ledger entry to the Financial Center.
 *
 * Separated from local-transaction.ts to keep that file under 300 lines.
 *
 * Per §A0 / §A16: cash sales are tracked for seller analytics and Financial
 * Center P&L but carry $0 platform fee. No Stripe escrow is involved.
 */

import { db } from '@twicely/db';
import { localTransaction, orderItem } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { canTransition } from './local-state-machine';
import { postLocalCashSale } from './local-cash-sale';

export interface CompleteCashLocalSaleInput {
  transactionId: string;
  /** Gross amount the seller received in cash (integer cents) */
  amountCents: number;
}

/**
 * Mark a local transaction as COMPLETED via cash payment and post an
 * informational LOCAL_CASH_SALE_REVENUE ledger entry to the Financial Center.
 *
 * The transition path for cash differs from SafeTrade:
 *   SCHEDULED → COMPLETED  (seller manually marks sale complete)
 *
 * State machine now allows SCHEDULED → COMPLETED for this flow (§A0).
 *
 * Idempotent: if the transaction is already COMPLETED the ledger entry is
 * still posted (idempotency handled inside postLocalCashSale).
 */
export async function completeCashLocalSale(
  input: CompleteCashLocalSaleInput,
): Promise<{ success: boolean; ledgerEntryId?: string; error?: string }> {
  const { transactionId, amountCents } = input;
  const now = new Date();

  try {
    const [tx] = await db
      .select({
        id: localTransaction.id,
        status: localTransaction.status,
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

    // Idempotency: already completed is fine — still post the ledger entry
    if (tx.status !== 'COMPLETED') {
      if (!canTransition(tx.status, 'COMPLETED')) {
        return {
          success: false,
          error: `Cannot transition from ${tx.status} to COMPLETED`,
        };
      }

      await db
        .update(localTransaction)
        .set({ status: 'COMPLETED', updatedAt: now })
        .where(eq(localTransaction.id, transactionId));
    }

    // Fetch listingId via orderItem for FC context (single-item for local pickups)
    const [item] = await db
      .select({ listingId: orderItem.listingId })
      .from(orderItem)
      .where(eq(orderItem.orderId, tx.orderId))
      .limit(1);

    const result = await postLocalCashSale({
      localTransactionId: transactionId,
      sellerId: tx.sellerId,
      buyerId: tx.buyerId,
      amountCents,
      listingId: item?.listingId ?? null,
    });

    return { success: true, ledgerEntryId: result.ledgerEntryId };
  } catch (error) {
    logger.error('[local-cash-complete] completeCashLocalSale failed', {
      transactionId,
      error: String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete cash sale',
    };
  }
}
