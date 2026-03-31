'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  recordCheckIn,
  validateSellerToken,
  validateSellerOfflineCode,
} from '@twicely/commerce/local-transaction';
import { canTransition } from '@twicely/commerce/local-state-machine';
import { postConfirmationEffects } from '@twicely/commerce/local-ledger';
import { enqueueSafetyNudge } from '@twicely/jobs/local-safety-timer';
import { enqueueNoShowCheck } from '@twicely/jobs/local-noshow-check';
import { sendLocalAutoMessage } from '@/lib/messaging/local-auto-messages';
import {
  checkInSchema,
  confirmReceiptOnlineSchema,
  confirmReceiptManualSchema,
} from '@/lib/validations/local';
import { z } from 'zod';


// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  error?: string;
  bothCheckedIn?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CHECK_IN_ALLOWED_STATUSES = [
  'SCHEDULED',
  'SELLER_CHECKED_IN',
  'BUYER_CHECKED_IN',
] as const;

function isCheckInAllowed(status: string): boolean {
  return (CHECK_IN_ALLOWED_STATUSES as readonly string[]).includes(status);
}

// ─── checkInToMeetupAction ────────────────────────────────────────────────────

export async function checkInToMeetupAction(
  data: z.infer<typeof checkInSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = checkInSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!transaction) return { success: false, error: 'Not found' };

  const isBuyer = session.userId === transaction.buyerId;
  const isSeller = session.userId === transaction.sellerId;

  if (!isBuyer && !isSeller) return { success: false, error: 'Not found' };

  if (isBuyer && !ability.can('update', sub('LocalTransaction', { buyerId: transaction.buyerId }))) {
    return { success: false, error: 'Not found' };
  }
  if (isSeller && !ability.can('update', sub('LocalTransaction', { sellerId: transaction.sellerId }))) {
    return { success: false, error: 'Not found' };
  }
  // G2.9: Check-in is locked until meetup time is confirmed by both parties
  if (transaction.scheduledAtConfirmedAt === null) {
    return { success: false, error: 'Meetup time must be confirmed before checking in' };
  }
  if (!isCheckInAllowed(transaction.status)) {
    return { success: false, error: 'Transaction not in valid state' };
  }

  const party: 'BUYER' | 'SELLER' = isBuyer ? 'BUYER' : 'SELLER';
  const targetStatus = party === 'BUYER'
    ? (transaction.sellerCheckedIn ? 'BOTH_CHECKED_IN' : 'BUYER_CHECKED_IN')
    : (transaction.buyerCheckedIn ? 'BOTH_CHECKED_IN' : 'SELLER_CHECKED_IN');

  if (!canTransition(transaction.status, targetStatus)) {
    return { success: false, error: 'Transaction not in valid state' };
  }
  if (isBuyer && transaction.buyerCheckedIn) return { success: false, error: 'Already checked in' };
  if (isSeller && transaction.sellerCheckedIn) return { success: false, error: 'Already checked in' };

  const result = await recordCheckIn(parsed.data.localTransactionId, party);
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to record check-in' };
  }

  await enqueueNoShowCheck(
    parsed.data.localTransactionId,
    party,
    new Date(),
  );

  if (result.bothCheckedIn) {
    await enqueueSafetyNudge({
      localTransactionId: parsed.data.localTransactionId,
      orderId: transaction.orderId,
      buyerId: transaction.buyerId,
      sellerId: transaction.sellerId,
    });

    void sendLocalAutoMessage(transaction.orderId, 'BOTH_CHECKED_IN', {});
  }

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true, bothCheckedIn: result.bothCheckedIn };
}

// ─── confirmReceiptAction (online QR scan) ────────────────────────────────────

export async function confirmReceiptAction(
  data: z.infer<typeof confirmReceiptOnlineSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = confirmReceiptOnlineSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const validation = await validateSellerToken(parsed.data.sellerToken);
  if (!validation.valid || !validation.transaction) {
    return { success: false, error: validation.error ?? 'Invalid seller token' };
  }

  const transaction = validation.transaction;

  if (session.userId !== transaction.buyerId) return { success: false, error: 'Not found' };

  if (!ability.can('update', sub('LocalTransaction', { buyerId: transaction.buyerId }))) {
    return { success: false, error: 'Not found' };
  }
  if (!canTransition(transaction.status, 'RECEIPT_CONFIRMED')) {
    return { success: false, error: 'Transaction not in valid state' };
  }

  const now = new Date();

  await db
    .update(localTransaction)
    .set({
      status: 'RECEIPT_CONFIRMED',
      confirmationMode: 'QR_ONLINE',
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, transaction.id));

  await postConfirmationEffects(transaction.id, transaction.orderId, transaction.sellerId, now);

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true };
}

// ─── confirmReceiptManualAction (online code entry) ───────────────────────────

export async function confirmReceiptManualAction(
  data: z.infer<typeof confirmReceiptManualSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = confirmReceiptManualSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const validation = await validateSellerOfflineCode(
    parsed.data.sellerOfflineCode,
    parsed.data.localTransactionId,
  );
  if (!validation.valid || !validation.transaction) {
    return { success: false, error: validation.error ?? 'Invalid seller code' };
  }

  const transaction = validation.transaction;

  if (session.userId !== transaction.buyerId) return { success: false, error: 'Not found' };

  if (!ability.can('update', sub('LocalTransaction', { buyerId: transaction.buyerId }))) {
    return { success: false, error: 'Not found' };
  }
  if (!canTransition(transaction.status, 'RECEIPT_CONFIRMED')) {
    return { success: false, error: 'Transaction not in valid state' };
  }

  const now = new Date();

  await db
    .update(localTransaction)
    .set({
      status: 'RECEIPT_CONFIRMED',
      confirmationMode: 'CODE_ONLINE',
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, transaction.id));

  await postConfirmationEffects(transaction.id, transaction.orderId, transaction.sellerId, now);

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true };
}
