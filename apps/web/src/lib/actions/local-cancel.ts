'use server';

/**
 * Local Cancel Server Action (G2.11)
 *
 * Allows buyer or seller to cancel a local transaction before the meetup.
 * Delegates all business logic to cancelLocalTransaction() service.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A8
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { canTransition } from '@twicely/commerce/local-state-machine';
import { cancelLocalTransaction } from '@twicely/commerce/local-cancel';
import { cancelLocalTransactionSchema } from '@/lib/validations/local';
import { logger } from '@twicely/logger';
import type { z } from 'zod';

type ActionResult = { success: boolean; error?: string };

// Statuses from which user-initiated cancellation is allowed (A8).
// BOTH_CHECKED_IN is excluded — user-initiated cancel NOT available once both are present.
const CANCELLABLE_STATUSES = [
  'SCHEDULED',
  'SELLER_CHECKED_IN',
  'BUYER_CHECKED_IN',
  'RESCHEDULE_PENDING',
] as const;

function isCancellableStatus(status: string): boolean {
  return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

export async function cancelLocalTransactionAction(
  data: z.infer<typeof cancelLocalTransactionSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = cancelLocalTransactionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!tx) return { success: false, error: 'Not found' };

  const isBuyer = session.userId === tx.buyerId;
  const isSeller = session.userId === tx.sellerId;

  if (!isBuyer && !isSeller) return { success: false, error: 'Not found' };

  if (isBuyer && !ability.can('update', sub('LocalTransaction', { buyerId: tx.buyerId }))) {
    return { success: false, error: 'Not found' };
  }
  if (isSeller && !ability.can('update', sub('LocalTransaction', { sellerId: tx.sellerId }))) {
    return { success: false, error: 'Not found' };
  }

  if (!isCancellableStatus(tx.status)) {
    return { success: false, error: 'Transaction cannot be canceled at this stage' };
  }

  if (!canTransition(tx.status, 'CANCELED')) {
    return { success: false, error: 'Transaction cannot be canceled at this stage' };
  }

  const cancelingParty: 'BUYER' | 'SELLER' = isBuyer ? 'BUYER' : 'SELLER';

  await cancelLocalTransaction({
    transaction: tx,
    cancelingParty,
    cancelingUserId: session.userId,
    reason: parsed.data.reason,
  });

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  logger.info('[local-cancel-action] Cancellation action complete', {
    transactionId: tx.id,
    cancelingParty,
    canceledBy: session.userId,
  });

  return { success: true };
}
