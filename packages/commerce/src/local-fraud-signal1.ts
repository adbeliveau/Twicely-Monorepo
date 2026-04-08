/**
 * Local Fraud Signal 1 — Same Listing Sold While Scheduled (G2.15)
 *
 * Automatic detection: shipped order completes for a listing that has an
 * active SafeTrade local transaction. Applies all consequences automatically.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A12
 */

import { db } from '@twicely/db';
import {
  localTransaction,
  localFraudFlag,
  orderItem,
  orderPayment,
  order,
  ledgerEntry,
  user,
  sellerProfile,
  auditEvent,
} from '@twicely/db/schema';
import { eq, and, inArray, not, count } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';
import { canTransition } from './local-state-machine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectSameListingSoldResult {
  fraudDetected: boolean;
  conflictingTransactionId?: string;
}

// Non-terminal statuses that indicate an active local transaction
export const ACTIVE_LOCAL_STATUSES = [
  'SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN',
  'BOTH_CHECKED_IN', 'ADJUSTMENT_PENDING', 'RESCHEDULE_PENDING',
  'RECEIPT_CONFIRMED',
] as const;

// ─── Signal 1 ─────────────────────────────────────────────────────────────────

/**
 * Check whether the completing order triggers Signal 1 fraud detection.
 *
 * Called from order-completion.ts before marking an order COMPLETED.
 * If fraud is detected, all consequences are applied internally.
 * The shipped order still completes — it is a legitimate sale.
 *
 * Per Decision C: only SafeTrade transactions have fraud detection.
 * Presence of orderPayment.stripePaymentIntentId indicates SafeTrade.
 */
export async function detectSameListingSold(
  completingOrderId: string,
  listingId: string,
  sellerId: string,
): Promise<DetectSameListingSoldResult> {
  // 1. Find active local transactions for this listing (not the completing order)
  const conflictingTx = await db
    .select({
      id: localTransaction.id,
      orderId: localTransaction.orderId,
      buyerId: localTransaction.buyerId,
      status: localTransaction.status,
    })
    .from(localTransaction)
    .innerJoin(orderItem, eq(orderItem.orderId, localTransaction.orderId))
    .where(
      and(
        eq(orderItem.listingId, listingId),
        inArray(localTransaction.status, [...ACTIVE_LOCAL_STATUSES]),
        not(eq(localTransaction.orderId, completingOrderId)),
      ),
    )
    .limit(1);

  if (conflictingTx.length === 0) {
    return { fraudDetected: false };
  }

  const conflict = conflictingTx[0]!;

  // 2. SafeTrade gate: check if the CONFLICTING local transaction has Stripe payment
  // Per Decision C: fraud detection is SafeTrade-only (not cash)
  const [localPayment] = await db
    .select({ stripePaymentIntentId: orderPayment.stripePaymentIntentId })
    .from(orderPayment)
    .where(eq(orderPayment.orderId, conflict.orderId))
    .limit(1);

  if (!localPayment?.stripePaymentIntentId) {
    return { fraudDetected: false };
  }

  logger.warn('[local-fraud] Signal 1 detected — same listing sold while local tx active', {
    completingOrderId,
    listingId,
    sellerId,
    conflictingTransactionId: conflict.id,
  });

  await applySignalOneConsequences({
    sellerId,
    listingId,
    conflictingTransactionId: conflict.id,
    conflictingOrderId: conflict.orderId,
    conflictingBuyerId: conflict.buyerId,
    conflictingStatus: conflict.status,
    completingOrderId,
    stripePaymentIntentId: localPayment.stripePaymentIntentId,
  });

  return { fraudDetected: true, conflictingTransactionId: conflict.id };
}

// ─── Signal 1 Consequences ────────────────────────────────────────────────────

interface SignalOneConsequenceParams {
  sellerId: string;
  listingId: string;
  conflictingTransactionId: string;
  conflictingOrderId: string;
  conflictingBuyerId: string;
  conflictingStatus: string;
  completingOrderId: string;
  stripePaymentIntentId: string;
}

async function applySignalOneConsequences(
  params: SignalOneConsequenceParams,
): Promise<void> {
  const {
    sellerId,
    listingId,
    conflictingTransactionId,
    conflictingOrderId,
    conflictingBuyerId,
    conflictingStatus,
    completingOrderId,
    stripePaymentIntentId,
  } = params;

  const now = new Date();

  // 1. Create fraud flag
  const [fraudFlagRow] = await db
    .insert(localFraudFlag)
    .values({
      sellerId,
      localTransactionId: conflictingTransactionId,
      listingId,
      trigger: 'SAME_LISTING_SOLD',
      severity: 'CONFIRMED',
      status: 'OPEN',
      detailsJson: {
        completingOrderId,
        conflictingOrderId,
        detectedAt: now.toISOString(),
      },
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: localFraudFlag.id });

  const fraudFlagId = fraudFlagRow?.id;

  // 2. Cancel the local transaction (Decision D: listing stays SOLD — skip unreserve)
  // Guard: validate the state machine allows this transition. If it doesn't
  // (e.g. transaction was already terminal), skip the update and log — the
  // flag and refund still proceed so the buyer is made whole.
  if (!canTransition(conflictingStatus, 'CANCELED')) {
    logger.warn('[local-fraud] Signal 1: cannot cancel transaction in current status', {
      conflictingTransactionId,
      conflictingStatus,
    });
  } else {
    await db
      .update(localTransaction)
      .set({ status: 'CANCELED', canceledByParty: 'SELLER', updatedAt: now })
      .where(eq(localTransaction.id, conflictingTransactionId));
  }

  // 3. Issue Stripe refund for the local buyer's SafeTrade payment
  try {
    const refund = await stripe.refunds.create({
      payment_intent: stripePaymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
    });

    // 4. Create LOCAL_FRAUD_REVERSAL ledger entry (fetch actual amount)
    const [orderData] = await db
      .select({ itemSubtotalCents: order.itemSubtotalCents })
      .from(order)
      .where(eq(order.id, conflictingOrderId))
      .limit(1);

    const refundAmountCents = orderData?.itemSubtotalCents ?? 0;

    await db.insert(ledgerEntry).values({
      type: 'LOCAL_FRAUD_REVERSAL',
      status: 'POSTED',
      amountCents: -refundAmountCents,
      userId: sellerId,
      orderId: conflictingOrderId,
      stripeRefundId: refund.id,
      reasonCode: `local:fraud:${conflictingTransactionId}`,
      memo: `SafeTrade escrow reversed — confirmed fraud (flag ${fraudFlagId ?? 'unknown'})`,
      postedAt: now,
      createdAt: now,
    });

    if (fraudFlagId) {
      await db
        .update(localFraudFlag)
        .set({ refundIssuedAt: now, updatedAt: now })
        .where(eq(localFraudFlag.id, fraudFlagId));
    }
  } catch (err) {
    logger.error('[local-fraud] Stripe refund failed for Signal 1', {
      conflictingTransactionId,
      stripePaymentIntentId,
      error: String(err),
    });
  }

  // 5. Permanent local transaction ban
  await db
    .update(user)
    .set({ localFraudBannedAt: now, updatedAt: now })
    .where(eq(user.id, sellerId));

  if (fraudFlagId) {
    await db
      .update(localFraudFlag)
      .set({ sellerBannedAt: now, updatedAt: now })
      .where(eq(localFraudFlag.id, fraudFlagId));
  }

  // 5b. Check for PATTERN offense (2nd confirmed fraud → full account suspension)
  const patternThreshold = await getPlatformSetting<number>(
    'commerce.local.fraudPatternOffenseCount', 2,
  );

  const [confirmedCountRow] = await db
    .select({ total: count() })
    .from(localFraudFlag)
    .where(
      and(
        eq(localFraudFlag.sellerId, sellerId),
        eq(localFraudFlag.severity, 'CONFIRMED'),
      ),
    );

  const confirmedCount = Number(confirmedCountRow?.total ?? 0);

  if (confirmedCount >= patternThreshold) {
    await db
      .update(sellerProfile)
      .set({ status: 'SUSPENDED', updatedAt: now })
      .where(eq(sellerProfile.userId, sellerId));

    void notify(sellerId, 'local.fraud.seller_suspended', {
      listingId,
      transactionId: conflictingTransactionId,
    }).catch(() => {});
  }

  // 6. Audit event (CRITICAL)
  await db.insert(auditEvent).values({
    actorType: 'SYSTEM',
    actorId: 'fraud-detection',
    action: 'FRAUD_DETECTED_SIGNAL_1',
    subject: 'LocalTransaction',
    subjectId: conflictingTransactionId,
    severity: 'CRITICAL',
    detailsJson: { sellerId, listingId, completingOrderId, fraudFlagId },
  });

  // 7. Notify local buyer
  void notify(conflictingBuyerId, 'local.fraud.buyer_refund', {
    listingId,
    transactionId: conflictingTransactionId,
  }).catch(() => {});

  // 8. Notify seller (flagged + banned)
  void notify(sellerId, 'local.fraud.seller_flagged', {
    listingId,
    transactionId: conflictingTransactionId,
  }).catch(() => {});

  void notify(sellerId, 'local.fraud.seller_banned', {
    listingId,
    transactionId: conflictingTransactionId,
  }).catch(() => {});

  logger.info('[local-fraud] Signal 1 consequences applied', {
    sellerId,
    conflictingTransactionId,
    fraudFlagId,
  });
}
