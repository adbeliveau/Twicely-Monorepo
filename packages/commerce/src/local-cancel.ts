/**
 * Local Cancellation Service (G2.11)
 *
 * Orchestrates pre-meetup cancellation of a local transaction:
 *   1. Determines reliability mark based on time until meetup
 *   2. Updates localTransaction and order to CANCELED
 *   3. Posts reliability mark via postReliabilityMark()
 *   4. Issues full Stripe refund (if payment exists)
 *   5. Re-activates listing (if in SOLD or PAUSED status)
 *   6. Removes pending BullMQ jobs (best-effort)
 *   7. Notifies the other party
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A8 and §A5
 */

import { db } from '@twicely/db';
import { localTransaction, order, orderPayment } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { postReliabilityMark } from '@twicely/commerce/local-reliability';
import type { LocalReliabilityEventType } from '@twicely/commerce/local-reliability';
import { unreserveListingForLocalTransaction } from '@twicely/commerce/local-reserve';
import { createLocalCancelRefundLedgerEntry } from '@twicely/commerce/local-ledger';
import { localAutoCancelQueue } from '@twicely/jobs/local-auto-cancel';
import { localNoShowCheckQueue } from '@twicely/jobs/local-noshow-check';
import { localScheduleNudgeQueue } from '@twicely/jobs/local-schedule-nudge';
import { localMeetupReminderQueue } from '@twicely/jobs/local-meetup-reminder';
import { notify } from '@twicely/notifications/service';
import { stripe } from '@twicely/stripe/server';
import { logger } from '@twicely/logger';
import { canTransition } from './local-state-machine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocalTransactionRow = typeof localTransaction.$inferSelect;

export interface CancelLocalTransactionParams {
  transaction: LocalTransactionRow;
  cancelingParty: 'BUYER' | 'SELLER';
  cancelingUserId: string;
  reason?: string;
}

interface CancelEventResult {
  eventType: LocalReliabilityEventType;
  marks: number;
}

// ─── Cancel Window Determination ─────────────────────────────────────────────

async function determineCancelEventType(
  party: 'BUYER' | 'SELLER',
  scheduledAt: Date | null,
): Promise<CancelEventResult> {
  if (scheduledAt === null) {
    return {
      eventType: party === 'BUYER' ? 'BUYER_CANCEL_GRACEFUL' : 'SELLER_CANCEL_GRACEFUL',
      marks: 0,
    };
  }

  const now = new Date();
  const hoursUntil = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  const cancelLateHours = await getPlatformSetting<number>('commerce.local.cancelLateHours', 24);
  const cancelSamedayHours = await getPlatformSetting<number>('commerce.local.cancelSamedayHours', 2);

  if (hoursUntil >= cancelLateHours) {
    return {
      eventType: party === 'BUYER' ? 'BUYER_CANCEL_GRACEFUL' : 'SELLER_CANCEL_GRACEFUL',
      marks: 0,
    };
  }

  if (hoursUntil >= cancelSamedayHours) {
    const marks = await getPlatformSetting<number>('commerce.local.markCancelLate', -1);
    return {
      eventType: party === 'BUYER' ? 'BUYER_CANCEL_LATE' : 'SELLER_CANCEL_LATE',
      marks,
    };
  }

  const marks = await getPlatformSetting<number>('commerce.local.markCancelSameday', -2);
  return {
    eventType: party === 'BUYER' ? 'BUYER_CANCEL_SAMEDAY' : 'SELLER_CANCEL_SAMEDAY',
    marks,
  };
}

// ─── BullMQ Cleanup ───────────────────────────────────────────────────────────

async function cleanupBullMQJobs(transactionId: string): Promise<void> {
  const jobsToRemove = [
    { queue: localAutoCancelQueue, id: `local-auto-cancel-${transactionId}` },
    { queue: localNoShowCheckQueue, id: `noshow-${transactionId}-BUYER` },
    { queue: localNoShowCheckQueue, id: `noshow-${transactionId}-SELLER` },
    { queue: localScheduleNudgeQueue, id: `local-schedule-nudge-${transactionId}` },
    { queue: localMeetupReminderQueue, id: `local-reminder-24hr-${transactionId}` },
    { queue: localMeetupReminderQueue, id: `local-reminder-1hr-${transactionId}` },
  ];

  for (const { queue, id } of jobsToRemove) {
    try {
      const job = await queue.getJob(id);
      if (job) await job.remove();
    } catch (err) {
      logger.warn('[local-cancel] Could not remove BullMQ job', {
        jobId: id,
        error: String(err),
      });
    }
  }
}

// ─── Main Orchestration ───────────────────────────────────────────────────────

export async function cancelLocalTransaction(
  params: CancelLocalTransactionParams,
): Promise<{ error?: string }> {
  const { transaction: tx, cancelingParty, cancelingUserId, reason } = params;
  const now = new Date();

  // 0. State machine guard — validate the transition before any DB writes
  if (!canTransition(tx.status, 'CANCELED')) {
    return { error: `Cannot transition from ${tx.status} to CANCELED` };
  }

  // 1. Determine reliability mark based on time until meetup
  const { eventType, marks } = await determineCancelEventType(
    cancelingParty,
    tx.scheduledAt,
  );

  // 2. Update localTransaction status to CANCELED
  await db
    .update(localTransaction)
    .set({
      status: 'CANCELED',
      canceledByParty: cancelingParty,
      updatedAt: now,
    })
    .where(eq(localTransaction.id, tx.id));

  // 3. Update order status to CANCELED
  const cancelInitiator = cancelingParty === 'BUYER' ? 'BUYER' : 'SELLER';
  await db
    .update(order)
    .set({
      status: 'CANCELED',
      canceledByUserId: cancelingUserId,
      cancelInitiator,
      cancelReason: reason ?? `Local meetup canceled by ${cancelingParty.toLowerCase()}`,
      canceledAt: now,
      updatedAt: now,
    })
    .where(eq(order.id, tx.orderId));

  // 4. Post reliability mark (0 marks = graceful = no-op inside postReliabilityMark)
  await postReliabilityMark({
    userId: cancelingUserId,
    transactionId: tx.id,
    eventType,
    marksApplied: marks,
  });

  // 5. Issue Stripe refund (full refund, best-effort — do not block on failure)
  const [payment] = await db
    .select({ stripePaymentIntentId: orderPayment.stripePaymentIntentId })
    .from(orderPayment)
    .where(eq(orderPayment.orderId, tx.orderId))
    .limit(1);

  const stripePaymentIntentId = payment?.stripePaymentIntentId ?? null;

  if (stripePaymentIntentId !== null) {
    try {
      await stripe.refunds.create({
        payment_intent: stripePaymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
        reason: 'requested_by_customer',
        metadata: { orderId: tx.orderId, canceledByParty: cancelingParty },
      });
      await createLocalCancelRefundLedgerEntry(tx.orderId, tx.sellerId);
      logger.info('[local-cancel] Stripe refund issued', {
        orderId: tx.orderId,
        stripePaymentIntentId,
      });
    } catch (err) {
      logger.error('[local-cancel] Stripe refund failed — manual reconciliation required', {
        orderId: tx.orderId,
        stripePaymentIntentId,
        error: String(err),
      });
    }
  }

  // 6. Re-activate listing if it was reserved or taken off the market
  await unreserveListingForLocalTransaction(tx.orderId);

  // 7. Remove pending BullMQ jobs (best-effort)
  await cleanupBullMQJobs(tx.id);

  // 8. Notify the other party
  const otherPartyId = cancelingParty === 'BUYER' ? tx.sellerId : tx.buyerId;
  void notify(otherPartyId, 'local.cancel', {
    canceledByParty: cancelingParty === 'BUYER' ? 'buyer' : 'seller',
    orderId: tx.orderId,
  });

  logger.info('[local-cancel] Cancellation complete', {
    transactionId: tx.id,
    orderId: tx.orderId,
    cancelingParty,
    eventType,
    marks,
  });

  return {};
}
