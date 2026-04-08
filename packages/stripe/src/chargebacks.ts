/**
 * C4.4 — Chargeback Handling
 *
 * Stripe sends chargeback via charge.dispute.created webhook.
 * Platform responds with evidence via stripe.disputes.update().
 *
 * Rules:
 * - Auto-create internal dispute if none exists
 * - Gather evidence: order details, tracking, delivery confirmation, messages
 * - Respond within Stripe's deadline (7-21 days)
 * - If lost: platform absorbs cost via buyer protection fund
 * - Update seller score: chargebacks count toward defect rate
 */

import { db } from '@twicely/db';
import { dispute, order, ledgerEntry } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import type Stripe from 'stripe';
import { logger } from '@twicely/logger';
import { submitChargebackEvidence } from './chargeback-evidence';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// Re-export from split file for existing consumers
export { submitChargebackEvidence, handleChargebackResolution, getChargebackStatus } from './chargeback-evidence';
export type { EvidenceSubmitResult } from './chargeback-evidence';

export interface ChargebackWebhookResult {
  success: boolean;
  disputeId?: string;
  error?: string;
}

/**
 * Handle charge.dispute.created webhook from Stripe.
 * Creates internal dispute record if one doesn't exist.
 */
export async function handleChargebackWebhook(
  stripeDispute: Stripe.Dispute,
  eventId?: string
): Promise<ChargebackWebhookResult> {
  const paymentIntentId = stripeDispute.payment_intent as string | null;

  if (!paymentIntentId) {
    return { success: false, error: 'Dispute has no payment intent' };
  }

  // Find order by paymentIntentId
  const [ord] = await db
    .select({
      id: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      totalCents: order.totalCents,
    })
    .from(order)
    .where(eq(order.paymentIntentId, paymentIntentId))
    .limit(1);

  if (!ord) {
    logger.warn('No order found for chargeback payment intent', { paymentIntentId });
    return { success: true }; // Not an error, might be non-marketplace transaction
  }

  // Check if internal dispute already exists
  const [existing] = await db
    .select({ id: dispute.id })
    .from(dispute)
    .where(eq(dispute.orderId, ord.id))
    .limit(1);

  let disputeId: string;

  if (existing) {
    disputeId = existing.id;
    // Update status to indicate chargeback
    await db
      .update(dispute)
      .set({
        status: 'UNDER_REVIEW',
        updatedAt: new Date(),
      })
      .where(eq(dispute.id, existing.id));
  } else {
    // Create internal dispute for the chargeback
    const [created] = await db
      .insert(dispute)
      .values({
        orderId: ord.id,
        buyerId: ord.buyerId,
        sellerId: ord.sellerId,
        claimType: 'INAD', // Default to INAD for chargebacks
        status: 'UNDER_REVIEW',
        description: `Chargeback received from payment processor. Reason: ${stripeDispute.reason}`,
        // Deadline from Stripe dispute
        deadlineAt: stripeDispute.evidence_details?.due_by
          ? new Date(stripeDispute.evidence_details.due_by * 1000)
          : new Date(Date.now() + (await getPlatformSetting<number>('commerce.dispute.chargebackDeadlineDays', 7)) * 24 * 60 * 60 * 1000),
      })
      .returning({ id: dispute.id });

    disputeId = created?.id ?? '';
  }

  // Update order status
  await db
    .update(order)
    .set({
      status: 'DISPUTED',
      updatedAt: new Date(),
    })
    .where(eq(order.id, ord.id));

  // Guard: skip if ledger entry already exists for this dispute
  const [existingDebit] = await db
    .select({ id: ledgerEntry.id })
    .from(ledgerEntry)
    .where(and(eq(ledgerEntry.stripeDisputeId, stripeDispute.id), eq(ledgerEntry.type, 'CHARGEBACK_DEBIT')))
    .limit(1);

  if (!existingDebit) {
    await db.insert(ledgerEntry).values({
      type: 'CHARGEBACK_DEBIT',
      status: 'POSTED',
      amountCents: -stripeDispute.amount, // Negative: seller loses this
      userId: ord.sellerId,
      orderId: ord.id,
      stripeDisputeId: stripeDispute.id,
      stripeEventId: eventId ?? null,
      postedAt: new Date(),
    });
  } else {
    logger.info('[webhook] charge.dispute.created — skipping duplicate CHARGEBACK_DEBIT', { disputeId: stripeDispute.id });
  }

  // Auto-submit evidence if we have it
  await submitChargebackEvidence(disputeId, stripeDispute.id);

  return { success: true, disputeId };
}
