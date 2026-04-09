'use server';

/**
 * Local Cash Sale Completion — Phase 5 server action (hub-local / engine-local).
 *
 * Seller manually marks an in-person cash sale COMPLETED. The commerce engine
 * (packages/commerce/src/local-cash-complete.ts) transitions the local_transaction
 * state and posts a LOCAL_CASH_SALE_REVENUE ledger entry to the Financial Center.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1 §A0 + §A16:
 *   - No platform fee is charged on cash sales
 *   - No sellerBalance update (cash never touched Twicely's escrow)
 *   - Entry is informational — drives Financial Center P&L only
 *
 * Auth: only the seller (or their DELEGATE with crosslister/local manage) can
 * mark their own sale COMPLETED. Ownership check uses sub('LocalTransaction', { sellerId }).
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { completeCashLocalSale } from '@twicely/commerce/local-cash-complete';
import { logger } from '@twicely/logger';
import { z } from 'zod';

const completeCashLocalSaleSchema = z.object({
  transactionId: z.string().cuid2(),
  /** Gross amount the seller received in cash (integer cents). */
  amountCents: z.number().int().positive(),
}).strict();

type ActionResult = { success: boolean; ledgerEntryId?: string; error?: string };

export async function completeCashLocalSaleAction(
  data: z.infer<typeof completeCashLocalSaleSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = completeCashLocalSaleSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { transactionId, amountCents } = parsed.data;
  const actingUserId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // Fetch the transaction to verify ownership + current state before delegation.
  const [tx] = await db
    .select({
      id: localTransaction.id,
      status: localTransaction.status,
      sellerId: localTransaction.sellerId,
    })
    .from(localTransaction)
    .where(eq(localTransaction.id, transactionId))
    .limit(1);

  if (!tx) {
    return { success: false, error: 'Transaction not found' };
  }

  // CASL: only the seller on the transaction may complete it.
  if (!ability.can('update', sub('LocalTransaction', { sellerId: tx.sellerId }))) {
    return { success: false, error: 'Forbidden' };
  }

  if (tx.sellerId !== actingUserId) {
    return { success: false, error: 'Forbidden' };
  }

  try {
    const result = await completeCashLocalSale({ transactionId, amountCents });

    if (!result.success) {
      return { success: false, error: result.error ?? 'Failed to complete cash sale' };
    }

    revalidatePath('/my/selling/orders');
    revalidatePath(`/my/selling/orders/${transactionId}`);
    revalidatePath('/my/selling/finances');
    revalidatePath('/my/selling/finances/transactions');

    return { success: true, ledgerEntryId: result.ledgerEntryId };
  } catch (error) {
    logger.error('[completeCashLocalSaleAction] Failed', {
      transactionId,
      error: String(error),
    });
    return { success: false, error: 'Failed to complete cash sale' };
  }
}
