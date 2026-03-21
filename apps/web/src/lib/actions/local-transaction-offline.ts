'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  validateSellerToken,
  validateBuyerToken,
  validateSellerOfflineCode,
  validateBuyerOfflineCode,
} from '@twicely/commerce/local-transaction';
import { canTransition } from '@twicely/commerce/local-state-machine';
import { postConfirmationEffects } from '@twicely/commerce/local-ledger';
import {
  confirmOfflineDualSchema,
  confirmOfflineDualCodeSchema,
} from '@/lib/validations/local';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── confirmReceiptOfflineAction (offline dual-token) ─────────────────────────

export async function confirmReceiptOfflineAction(
  data: z.infer<typeof confirmOfflineDualSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = confirmOfflineDualSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const sellerValidation = await validateSellerToken(parsed.data.sellerToken);
  if (!sellerValidation.valid || !sellerValidation.transaction) {
    return { success: false, error: sellerValidation.error ?? 'Invalid seller token' };
  }

  const transaction = sellerValidation.transaction;

  // Idempotent: if already confirmed, return success
  if (transaction.confirmedAt) {
    return { success: true };
  }

  if (session.userId !== transaction.buyerId && session.userId !== transaction.sellerId) {
    return { success: false, error: 'Not found' };
  }

  if (!ability.can('update', sub('LocalTransaction', { buyerId: transaction.buyerId })) &&
      !ability.can('update', sub('LocalTransaction', { sellerId: transaction.sellerId }))) {
    return { success: false, error: 'Not found' };
  }

  const buyerValidation = await validateBuyerToken(parsed.data.buyerToken);
  if (!buyerValidation.valid) {
    return { success: false, error: buyerValidation.error ?? 'Invalid buyer token' };
  }

  if (buyerValidation.transaction?.id !== transaction.id) {
    return { success: false, error: 'Token mismatch' };
  }

  if (!canTransition(transaction.status, 'RECEIPT_CONFIRMED')) {
    return { success: false, error: 'Transaction not in valid state' };
  }

  const now = new Date();
  const offlineConfirmedAt = new Date(parsed.data.offlineTimestamp);

  await db
    .update(localTransaction)
    .set({
      status: 'RECEIPT_CONFIRMED',
      confirmationMode: 'QR_DUAL_OFFLINE',
      confirmedAt: now,
      offlineConfirmedAt,
      syncedAt: now,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, transaction.id));

  await postConfirmationEffects(transaction.id, transaction.orderId, transaction.sellerId, now);

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true };
}

// ─── confirmReceiptOfflineDualCodeAction (offline dual-code) ──────────────────

export async function confirmReceiptOfflineDualCodeAction(
  data: z.infer<typeof confirmOfflineDualCodeSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = confirmOfflineDualCodeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const sellerValidation = await validateSellerOfflineCode(
    parsed.data.sellerOfflineCode,
    parsed.data.localTransactionId,
  );
  if (!sellerValidation.valid || !sellerValidation.transaction) {
    return { success: false, error: sellerValidation.error ?? 'Invalid seller code' };
  }

  const transaction = sellerValidation.transaction;

  // Idempotent: if already confirmed, return success
  if (transaction.confirmedAt) {
    return { success: true };
  }

  if (session.userId !== transaction.buyerId && session.userId !== transaction.sellerId) {
    return { success: false, error: 'Not found' };
  }

  if (!ability.can('update', sub('LocalTransaction', { buyerId: transaction.buyerId })) &&
      !ability.can('update', sub('LocalTransaction', { sellerId: transaction.sellerId }))) {
    return { success: false, error: 'Not found' };
  }

  const buyerValidation = await validateBuyerOfflineCode(
    parsed.data.buyerOfflineCode,
    parsed.data.localTransactionId,
  );
  if (!buyerValidation.valid) {
    return { success: false, error: buyerValidation.error ?? 'Invalid buyer code' };
  }

  if (!canTransition(transaction.status, 'RECEIPT_CONFIRMED')) {
    return { success: false, error: 'Transaction not in valid state' };
  }

  const now = new Date();
  const offlineConfirmedAt = new Date(parsed.data.offlineTimestamp);

  await db
    .update(localTransaction)
    .set({
      status: 'RECEIPT_CONFIRMED',
      confirmationMode: 'CODE_DUAL_OFFLINE',
      confirmedAt: now,
      offlineConfirmedAt,
      syncedAt: now,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, transaction.id));

  await postConfirmationEffects(transaction.id, transaction.orderId, transaction.sellerId, now);

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true };
}
