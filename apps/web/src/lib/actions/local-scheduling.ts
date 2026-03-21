'use server';

/**
 * Local Scheduling Server Actions (G2.9)
 *
 * Two actions:
 *   - proposeMeetupTimeAction: either party proposes a meetup date/time
 *   - acceptMeetupTimeAction:  other party accepts, confirming the time
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A6
 *
 * // TODO(SafeTrade): Gate behind SafeTrade when A0 is implemented.
 * // Currently applies to all local transactions.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { isUserSuspendedFromLocal } from '@twicely/commerce/local-reliability';
import { isTerminalStatus } from '@twicely/commerce/local-state-machine';
import { validateProposedTime } from '@twicely/commerce/local-scheduling';
import {
  regenerateTokensOnConfirmation,
  enqueueAutoCancelAtScheduledTime,
} from './local-scheduling-helpers';
import { enqueueLocalMeetupReminders } from '@twicely/jobs/local-meetup-reminder';
import {
  proposeMeetupTimeSchema,
  acceptMeetupTimeSchema,
} from '@/lib/validations/local';
import type { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error?: string };

// ─── proposeMeetupTimeAction ──────────────────────────────────────────────────

export async function proposeMeetupTimeAction(
  data: z.infer<typeof proposeMeetupTimeSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = proposeMeetupTimeSchema.safeParse(data);
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

  const suspension = await isUserSuspendedFromLocal(session.userId);
  if (suspension.suspended) {
    return { success: false, error: 'Your local transaction access is temporarily suspended' };
  }

  if (tx.scheduledAtConfirmedAt !== null) {
    return { success: false, error: 'Meetup time is already confirmed. Use the reschedule flow to change it.' };
  }

  if (isTerminalStatus(tx.status)) {
    return { success: false, error: 'Transaction is in a terminal state' };
  }

  const proposedAt = new Date(parsed.data.proposedAt);
  const timeValidation = await validateProposedTime(proposedAt);
  if (!timeValidation.valid) {
    return { success: false, error: timeValidation.error };
  }

  const otherPartyId = isBuyer ? tx.sellerId : tx.buyerId;

  await db
    .update(localTransaction)
    .set({
      scheduledAt: proposedAt,
      schedulingProposedBy: session.userId,
      scheduledAtConfirmedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(localTransaction.id, parsed.data.localTransactionId));

  void notify(otherPartyId, 'local.schedule.proposal', {
    proposerName: isBuyer ? 'The buyer' : 'The seller',
    date: proposedAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: proposedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  });

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  logger.info('[local-scheduling] Meetup time proposed', {
    transactionId: parsed.data.localTransactionId,
    proposedBy: session.userId,
    proposedAt,
  });

  return { success: true };
}

// ─── acceptMeetupTimeAction ───────────────────────────────────────────────────

export async function acceptMeetupTimeAction(
  data: z.infer<typeof acceptMeetupTimeSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = acceptMeetupTimeSchema.safeParse(data);
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

  if (isTerminalStatus(tx.status)) {
    return { success: false, error: 'Transaction is in a terminal state' };
  }

  if (tx.scheduledAt === null) {
    return { success: false, error: 'No meetup time has been proposed yet' };
  }

  if (tx.scheduledAtConfirmedAt !== null) {
    return { success: false, error: 'Meetup time is already confirmed' };
  }

  if (tx.schedulingProposedBy === session.userId) {
    return { success: false, error: 'You cannot accept your own proposal' };
  }

  // Check the proposed time is still valid (>= 1hr from now)
  const timeValidation = await validateProposedTime(tx.scheduledAt);
  if (!timeValidation.valid) {
    return {
      success: false,
      error: `Proposed time is no longer valid: ${timeValidation.error ?? ''}`,
    };
  }

  const now = new Date();

  await db
    .update(localTransaction)
    .set({
      scheduledAtConfirmedAt: now,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, parsed.data.localTransactionId));

  // Regenerate tokens with the confirmed scheduledAt as the expiry base
  await regenerateTokensOnConfirmation(
    tx.id,
    tx.orderId,
    tx.buyerId,
    tx.sellerId,
    tx.scheduledAt,
  );

  // Enqueue auto-cancel at scheduledAt + autoCancelHours
  try {
    await enqueueAutoCancelAtScheduledTime(
      tx.id,
      tx.orderId,
      tx.buyerId,
      tx.sellerId,
      tx.scheduledAt,
    );
  } catch (err) {
    logger.error('[local-scheduling] Failed to enqueue auto-cancel', {
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
    scheduledAtIso: tx.scheduledAt.toISOString(),
  }).catch((err) => {
    logger.error('[local-scheduling] Failed to enqueue meetup reminders', {
      transactionId: tx.id,
      error: String(err),
    });
  });

  const otherPartyId = isBuyer ? tx.sellerId : tx.buyerId;

  void notify(otherPartyId, 'local.schedule.accepted', {
    date: tx.scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: tx.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  });

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  logger.info('[local-scheduling] Meetup time accepted', {
    transactionId: parsed.data.localTransactionId,
    acceptedBy: session.userId,
    scheduledAt: tx.scheduledAt,
  });

  return { success: true };
}

