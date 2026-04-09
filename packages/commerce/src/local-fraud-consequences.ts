/**
 * Local Fraud Consequence Application (G2.15)
 *
 * Staff-initiated consequence application for confirmed fraud flags.
 * Called from resolveLocalFraudFlagAction when staff confirms fraud.
 *
 * Per TWICELY_V3_LOCAL_CANONICAL_ADDENDUM_v1_1.md §A12
 */

import { db } from '@twicely/db';
import {
  localFraudFlag,
  localTransaction,
  ledgerEntry,
  user,
  listing,
  sellerProfile,
  order,
  orderPayment,
  auditEvent,
} from '@twicely/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplyConfirmedFraudConsequencesParams {
  flagId: string;
  staffId: string;
  resolutionNote: string;
}

export interface ApplyConsequencesResult {
  refundIssued: boolean;
  sellerBanned: boolean;
  accountSuspended: boolean;
  listingRemoved: boolean;
}

// ─── Create LOCAL_FRAUD_REVERSAL Ledger Entry ─────────────────────────────────

/**
 * Record a LOCAL_FRAUD_REVERSAL ledger entry for a confirmed fraud refund.
 * Called when staff confirms a fraud flag with applyConsequences = true.
 */
export async function createFraudReversalLedgerEntry(
  orderId: string,
  sellerId: string,
  stripeRefundId: string,
  fraudFlagId: string,
  localTransactionId?: string,
): Promise<void> {
  const [ord] = await db
    .select({ itemSubtotalCents: order.itemSubtotalCents })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  const amountCents = ord?.itemSubtotalCents ?? 0;
  const now = new Date();

  // Finance Engine §4.4 canonical idempotency key.
  // When called from applyConfirmedFraudConsequences we pass the localTransactionId
  // so the key matches the local_fraud:{localTransactionId}:refund canonical format;
  // as a fallback we use the fraudFlagId (still deterministic per staff resolution).
  const idempotencyKey = localTransactionId
    ? `local_fraud:${localTransactionId}:refund`
    : `local_fraud:flag:${fraudFlagId}:refund`;

  await db.insert(ledgerEntry).values({
    type: 'LOCAL_FRAUD_REVERSAL',
    status: 'POSTED',
    amountCents: -amountCents,
    userId: sellerId,
    orderId,
    stripeRefundId,
    reasonCode: `local:fraud:staff:${fraudFlagId}`,
    idempotencyKey,
    memo: `SafeTrade escrow reversed by staff — confirmed fraud (flag ${fraudFlagId})`,
    postedAt: now,
    createdAt: now,
  });

  logger.info('[local-fraud-consequences] Fraud reversal ledger entry created', {
    orderId,
    sellerId,
    fraudFlagId,
    amountCents,
  });
}

// ─── Apply Confirmed Fraud Consequences ───────────────────────────────────────

/**
 * Apply full consequences when staff confirms a fraud flag.
 * - Issues Stripe refund (if not already refunded)
 * - Creates LOCAL_FRAUD_REVERSAL ledger entry
 * - Sets user.localFraudBannedAt
 * - Checks for PATTERN offense (2nd confirmed fraud) → account suspension
 * - Sets listing.enforcementState = 'REMOVED'
 */
export async function applyConfirmedFraudConsequences(
  params: ApplyConfirmedFraudConsequencesParams,
): Promise<ApplyConsequencesResult> {
  const { flagId, staffId, resolutionNote } = params;
  const now = new Date();
  const result: ApplyConsequencesResult = {
    refundIssued: false,
    sellerBanned: false,
    accountSuspended: false,
    listingRemoved: false,
  };

  // Load the flag with context
  const [flag] = await db
    .select({
      id: localFraudFlag.id,
      sellerId: localFraudFlag.sellerId,
      localTransactionId: localFraudFlag.localTransactionId,
      listingId: localFraudFlag.listingId,
      refundIssuedAt: localFraudFlag.refundIssuedAt,
      sellerBannedAt: localFraudFlag.sellerBannedAt,
    })
    .from(localFraudFlag)
    .where(eq(localFraudFlag.id, flagId))
    .limit(1);

  if (!flag) return result;

  const { sellerId, listingId } = flag;

  // Get orderId from localTransaction
  const [tx] = await db
    .select({ orderId: localTransaction.orderId })
    .from(localTransaction)
    .where(eq(localTransaction.id, flag.localTransactionId))
    .limit(1);

  const orderId = tx?.orderId;

  // 1. Issue Stripe refund (if not already refunded)
  if (!flag.refundIssuedAt && orderId) {
    const [payment] = await db
      .select({ stripePaymentIntentId: orderPayment.stripePaymentIntentId })
      .from(orderPayment)
      .where(eq(orderPayment.orderId, orderId))
      .limit(1);

    if (payment?.stripePaymentIntentId) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          reverse_transfer: true,
          refund_application_fee: true,
        });

        await createFraudReversalLedgerEntry(orderId, sellerId, refund.id, flagId, flag.localTransactionId);
        result.refundIssued = true;

        await db
          .update(localFraudFlag)
          .set({ refundIssuedAt: now, updatedAt: now })
          .where(eq(localFraudFlag.id, flagId));
      } catch (err) {
        logger.error('[local-fraud-consequences] Stripe refund failed', {
          flagId,
          error: String(err),
        });
      }
    }
  } else if (flag.refundIssuedAt) {
    result.refundIssued = true;
  }

  // 2. Permanent local ban (if not already banned)
  if (!flag.sellerBannedAt) {
    await db
      .update(user)
      .set({ localFraudBannedAt: now, updatedAt: now })
      .where(eq(user.id, sellerId));

    await db
      .update(localFraudFlag)
      .set({ sellerBannedAt: now, updatedAt: now })
      .where(eq(localFraudFlag.id, flagId));

    result.sellerBanned = true;
  }

  // 3. Check for PATTERN offense (Decision B: 2nd confirmed fraud)
  const patternThreshold = await getPlatformSetting<number>('commerce.local.fraudPatternOffenseCount', 2);

  const [confirmedCountRow] = await db
    .select({ total: count() })
    .from(localFraudFlag)
    .where(
      and(
        eq(localFraudFlag.sellerId, sellerId),
        eq(localFraudFlag.status, 'CONFIRMED'),
      ),
    );

  // +1 for the current flag being confirmed
  const confirmedCount = Number(confirmedCountRow?.total ?? 0) + 1;

  if (confirmedCount >= patternThreshold) {
    await db
      .update(sellerProfile)
      .set({ status: 'SUSPENDED', updatedAt: now })
      .where(eq(sellerProfile.userId, sellerId));

    result.accountSuspended = true;

    void notify(sellerId, 'local.fraud.seller_suspended', {
      listingId,
    }).catch(() => {});
  } else {
    void notify(sellerId, 'local.fraud.seller_banned', {
      listingId,
    }).catch(() => {});
  }

  // 4. Remove listing
  await db
    .update(listing)
    .set({ enforcementState: 'REMOVED', updatedAt: now })
    .where(eq(listing.id, listingId));

  await db
    .update(localFraudFlag)
    .set({ listingRemovedAt: now, updatedAt: now })
    .where(eq(localFraudFlag.id, flagId));

  result.listingRemoved = true;

  // 5. Audit event
  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: staffId,
    action: 'FRAUD_FLAG_CONFIRMED',
    subject: 'LocalFraudFlag',
    subjectId: flagId,
    severity: 'CRITICAL',
    detailsJson: {
      sellerId,
      listingId,
      result,
      resolutionNote,
    },
  });

  logger.info('[local-fraud-consequences] Confirmed fraud consequences applied', {
    flagId,
    sellerId,
    result,
  });

  return result;
}
