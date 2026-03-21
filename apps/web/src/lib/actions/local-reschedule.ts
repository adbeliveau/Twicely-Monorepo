'use server';

/**
 * Local Reschedule Server Actions (G2.10)
 *
 * Two actions:
 *   - proposeRescheduleAction:   either party proposes a new meetup time after confirmation
 *   - respondToRescheduleAction: other party accepts or declines the pending reschedule
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A7
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { isUserSuspendedFromLocal, postReliabilityMark } from '@twicely/commerce/local-reliability';
import { validateProposedTime, canRequestReschedule } from '@twicely/commerce/local-scheduling';
import { regenerateTokensOnConfirmation, enqueueAutoCancelAtScheduledTime } from './local-scheduling-helpers';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { localAutoCancelQueue } from '@twicely/jobs/local-auto-cancel';
import { proposeRescheduleSchema, respondToRescheduleSchema } from '@/lib/validations/local';
import { enqueueLocalMeetupReminders, removeLocalMeetupReminders } from '@twicely/jobs/local-meetup-reminder';
import type { z } from 'zod';

type ActionResult = { success: boolean; error?: string };
type TxRow = typeof localTransaction.$inferSelect;

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── proposeRescheduleAction ──────────────────────────────────────────────────

export async function proposeRescheduleAction(
  data: z.infer<typeof proposeRescheduleSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = proposeRescheduleSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const [tx] = await db.select().from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId)).limit(1);

  if (!tx) return { success: false, error: 'Not found' };

  const isBuyer = session.userId === tx.buyerId;
  const isSeller = session.userId === tx.sellerId;
  if (!isBuyer && !isSeller) return { success: false, error: 'Not found' };

  if (isBuyer && !ability.can('update', sub('LocalTransaction', { buyerId: tx.buyerId })))
    return { success: false, error: 'Not found' };
  if (isSeller && !ability.can('update', sub('LocalTransaction', { sellerId: tx.sellerId })))
    return { success: false, error: 'Not found' };

  const suspension = await isUserSuspendedFromLocal(session.userId);
  if (suspension.suspended) return { success: false, error: 'Your local transaction access is temporarily suspended' };

  if (tx.scheduledAtConfirmedAt === null)
    return { success: false, error: 'Scheduling not yet confirmed. Use the scheduling flow instead.' };
  if (tx.status === 'RESCHEDULE_PENDING') return { success: false, error: 'A reschedule is already pending' };
  if (!canRequestReschedule(tx)) return { success: false, error: 'Reschedule is not available at this stage' };

  const proposedAt = new Date(parsed.data.proposedAt);
  const timeValidation = await validateProposedTime(proposedAt);
  if (!timeValidation.valid) return { success: false, error: timeValidation.error };

  const otherPartyId = isBuyer ? tx.sellerId : tx.buyerId;
  const originalScheduledAt = tx.originalScheduledAt === null ? tx.scheduledAt : tx.originalScheduledAt;

  await db.update(localTransaction).set({
    rescheduleProposedAt: proposedAt,
    schedulingProposedBy: session.userId,
    status: 'RESCHEDULE_PENDING',
    sellerCheckedIn: false,
    sellerCheckedInAt: null,
    buyerCheckedIn: false,
    buyerCheckedInAt: null,
    originalScheduledAt,
    updatedAt: new Date(),
  }).where(eq(localTransaction.id, parsed.data.localTransactionId));

  void notify(otherPartyId, 'local.reschedule.proposal', {
    name: isBuyer ? 'The buyer' : 'The seller',
    date: formatDate(proposedAt),
    time: formatTime(proposedAt),
  });

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  logger.info('[local-reschedule] Reschedule proposed', { transactionId: parsed.data.localTransactionId, proposedBy: session.userId, proposedAt });
  return { success: true };
}

// ─── respondToRescheduleAction ────────────────────────────────────────────────

export async function respondToRescheduleAction(
  data: z.infer<typeof respondToRescheduleSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = respondToRescheduleSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const [tx] = await db.select().from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId)).limit(1);

  if (!tx) return { success: false, error: 'Not found' };

  const isBuyer = session.userId === tx.buyerId;
  const isSeller = session.userId === tx.sellerId;
  if (!isBuyer && !isSeller) return { success: false, error: 'Not found' };

  if (isBuyer && !ability.can('update', sub('LocalTransaction', { buyerId: tx.buyerId })))
    return { success: false, error: 'Not found' };
  if (isSeller && !ability.can('update', sub('LocalTransaction', { sellerId: tx.sellerId })))
    return { success: false, error: 'Not found' };

  if (tx.status !== 'RESCHEDULE_PENDING') return { success: false, error: 'No pending reschedule to respond to' };
  if (tx.schedulingProposedBy === session.userId)
    return { success: false, error: 'You cannot accept or decline your own reschedule proposal' };
  if (tx.rescheduleProposedAt === null) return { success: false, error: 'No proposed reschedule time found' };

  return parsed.data.accept ? handleAccept(tx, session.userId) : handleDecline(tx);
}

// ─── Accept branch ────────────────────────────────────────────────────────────

async function handleAccept(tx: TxRow, responderId: string): Promise<ActionResult> {
  const proposedAt = tx.rescheduleProposedAt!;
  const timeValidation = await validateProposedTime(proposedAt);
  if (!timeValidation.valid) return { success: false, error: `Proposed time is no longer valid: ${timeValidation.error ?? ''}` };

  const newRescheduleCount = tx.rescheduleCount + 1;
  const lastRescheduledBy = tx.schedulingProposedBy === tx.buyerId ? 'BUYER' : 'SELLER';
  const now = new Date();

  await db.update(localTransaction).set({
    scheduledAt: proposedAt,
    scheduledAtConfirmedAt: now,
    rescheduleProposedAt: null,
    status: 'SCHEDULED',
    rescheduleCount: newRescheduleCount,
    lastRescheduledAt: now,
    lastRescheduledBy,
    updatedAt: now,
  }).where(eq(localTransaction.id, tx.id));

  const rescheduleMaxCount = await getPlatformSetting<number>('commerce.local.rescheduleMaxCount', 2);

  if (newRescheduleCount > rescheduleMaxCount && tx.schedulingProposedBy !== null) {
    const markRescheduleExcess = await getPlatformSetting<number>('commerce.local.markRescheduleExcess', -1);
    await postReliabilityMark({ userId: tx.schedulingProposedBy, transactionId: tx.id, eventType: 'RESCHEDULE_EXCESS', marksApplied: markRescheduleExcess });
  }

  await regenerateTokensOnConfirmation(tx.id, tx.orderId, tx.buyerId, tx.sellerId, proposedAt);

  try {
    const existingJob = await localAutoCancelQueue.getJob(`local-auto-cancel-${tx.id}`);
    if (existingJob) await existingJob.remove();
  } catch (err) {
    logger.warn('[local-reschedule] Could not remove old auto-cancel job', { transactionId: tx.id, error: String(err) });
  }

  try {
    await enqueueAutoCancelAtScheduledTime(tx.id, tx.orderId, tx.buyerId, tx.sellerId, proposedAt);
  } catch (err) {
    logger.error('[local-reschedule] Failed to re-enqueue auto-cancel', { transactionId: tx.id, error: String(err) });
  }

  try {
    await removeLocalMeetupReminders(tx.id);
  } catch (err) {
    logger.warn('[local-reschedule] Could not remove old reminder jobs', {
      transactionId: tx.id,
      error: String(err),
    });
  }
  void enqueueLocalMeetupReminders({
    localTransactionId: tx.id,
    orderId: tx.orderId,
    buyerId: tx.buyerId,
    sellerId: tx.sellerId,
    itemTitle: '',
    location: '',
    scheduledAtIso: proposedAt.toISOString(),
  }).catch((err) => {
    logger.error('[local-reschedule] Failed to enqueue meetup reminders', {
      transactionId: tx.id,
      error: String(err),
    });
  });

  if (tx.schedulingProposedBy !== null) {
    void notify(tx.schedulingProposedBy, 'local.reschedule.accepted', { date: formatDate(proposedAt), time: formatTime(proposedAt) });
  }

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  logger.info('[local-reschedule] Reschedule accepted', { transactionId: tx.id, acceptedBy: responderId, newScheduledAt: proposedAt, rescheduleCount: newRescheduleCount });
  return { success: true };
}

// ─── Decline branch ───────────────────────────────────────────────────────────

async function handleDecline(tx: TxRow): Promise<ActionResult> {
  const now = new Date();

  await db.update(localTransaction).set({
    rescheduleProposedAt: null,
    status: 'SCHEDULED',
    sellerCheckedIn: false,
    sellerCheckedInAt: null,
    buyerCheckedIn: false,
    buyerCheckedInAt: null,
    updatedAt: now,
  }).where(eq(localTransaction.id, tx.id));

  if (tx.schedulingProposedBy !== null && tx.scheduledAt !== null) {
    void notify(tx.schedulingProposedBy, 'local.reschedule.declined', { date: formatDate(tx.scheduledAt), time: formatTime(tx.scheduledAt) });
  }

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  logger.info('[local-reschedule] Reschedule declined', { transactionId: tx.id });
  return { success: true };
}
