'use server';

/**
 * Day-of Confirmation Server Actions (G2.12)
 *
 * Two actions:
 *   - sendDayOfConfirmationAction:    buyer sends "Are we still on?" request
 *   - respondToDayOfConfirmationAction: seller confirms they are coming
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A9
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  enqueueDayOfConfirmationTimeout,
  dayOfConfirmationTimeoutQueue,
} from '@twicely/jobs/local-day-of-confirmation-timeout';
import {
  sendDayOfConfirmationSchema,
  respondToDayOfConfirmationSchema,
} from '@/lib/validations/local';
import type { z } from 'zod';

type ActionResult = { success: boolean; error?: string };

// Statuses eligible for a buyer day-of confirmation request (per A9)
const ELIGIBLE_STATUSES = [
  'SCHEDULED',
  'SELLER_CHECKED_IN',
  'BUYER_CHECKED_IN',
] as const;

function isEligibleStatus(status: string): boolean {
  return (ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

// Terminal statuses — no confirmation actions allowed
const TERMINAL_STATUSES = ['COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED'] as const;

function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── sendDayOfConfirmationAction ──────────────────────────────────────────────

export async function sendDayOfConfirmationAction(
  data: z.infer<typeof sendDayOfConfirmationSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = sendDayOfConfirmationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!tx) return { success: false, error: 'Not found' };

  // Only the buyer can send a day-of confirmation request
  if (session.userId !== tx.buyerId) return { success: false, error: 'Not found' };

  if (!ability.can('update', sub('LocalTransaction', { buyerId: tx.buyerId }))) {
    return { success: false, error: 'Not found' };
  }

  // Status must be eligible (not RESCHEDULE_PENDING, not BOTH_CHECKED_IN, not terminal)
  if (!isEligibleStatus(tx.status)) {
    return { success: false, error: 'Cannot send confirmation request at this stage' };
  }

  // Scheduling must be confirmed
  if (tx.scheduledAtConfirmedAt === null) {
    return { success: false, error: 'Meetup time must be confirmed before sending a confirmation request' };
  }

  // Only one confirmation request per transaction
  if (tx.dayOfConfirmationSentAt !== null) {
    return { success: false, error: 'A day-of confirmation request has already been sent' };
  }

  // Validate we are within the confirmation window
  const windowHours = await getPlatformSetting<number>(
    'commerce.local.dayOfConfirmationWindowHours',
    12,
  );
  const scheduledAt = new Date(tx.scheduledAt!);
  const now = new Date();
  const windowStart = new Date(scheduledAt);
  windowStart.setHours(windowStart.getHours() - windowHours);

  if (now < windowStart) {
    return { success: false, error: 'Too early to send a confirmation request' };
  }
  if (now >= scheduledAt) {
    return { success: false, error: 'The meetup time has already passed' };
  }

  // Set dayOfConfirmationSentAt
  await db
    .update(localTransaction)
    .set({ dayOfConfirmationSentAt: now, updatedAt: now })
    .where(eq(localTransaction.id, parsed.data.localTransactionId));

  // Enqueue BullMQ timeout job
  await enqueueDayOfConfirmationTimeout({
    localTransactionId: tx.id,
    orderId: tx.orderId,
    sellerId: tx.sellerId,
    buyerId: tx.buyerId,
  });

  // Notify seller
  void notify(tx.sellerId, 'local.dayof.request', { time: formatTime(scheduledAt) });

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  logger.info('[local-day-of] Confirmation request sent', {
    transactionId: tx.id,
    buyerId: session.userId,
  });

  return { success: true };
}

// ─── respondToDayOfConfirmationAction ─────────────────────────────────────────

export async function respondToDayOfConfirmationAction(
  data: z.infer<typeof respondToDayOfConfirmationSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = respondToDayOfConfirmationSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!tx) return { success: false, error: 'Not found' };

  // Only the seller can respond
  if (session.userId !== tx.sellerId) return { success: false, error: 'Not found' };

  if (!ability.can('update', sub('LocalTransaction', { sellerId: tx.sellerId }))) {
    return { success: false, error: 'Not found' };
  }

  // A request must have been sent first
  if (tx.dayOfConfirmationSentAt === null) {
    return { success: false, error: 'No day-of confirmation request has been sent' };
  }

  // Must not have already responded
  if (tx.dayOfConfirmationRespondedAt !== null) {
    return { success: false, error: 'Already responded to the day-of confirmation request' };
  }

  // Window must not have expired
  if (tx.dayOfConfirmationExpired === true) {
    return { success: false, error: 'The confirmation response window has expired' };
  }

  // Must not be in a terminal status
  if (isTerminalStatus(tx.status)) {
    return { success: false, error: 'Transaction is no longer active' };
  }

  const now = new Date();

  // Set dayOfConfirmationRespondedAt
  await db
    .update(localTransaction)
    .set({ dayOfConfirmationRespondedAt: now, updatedAt: now })
    .where(eq(localTransaction.id, parsed.data.localTransactionId));

  // Remove pending timeout job
  try {
    const job = await dayOfConfirmationTimeoutQueue.getJob(
      `day-of-confirm-timeout-${tx.id}`,
    );
    if (job) await job.remove();
  } catch (err) {
    logger.warn('[local-day-of] Could not remove timeout job', {
      transactionId: tx.id,
      error: String(err),
    });
  }

  // Notify buyer
  const scheduledAt = tx.scheduledAt !== null ? new Date(tx.scheduledAt) : null;
  const timeStr = scheduledAt !== null ? formatTime(scheduledAt) : '';
  void notify(tx.buyerId, 'local.dayof.confirmed', { time: timeStr });

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  logger.info('[local-day-of] Seller responded to confirmation request', {
    transactionId: tx.id,
    sellerId: session.userId,
  });

  return { success: true };
}
