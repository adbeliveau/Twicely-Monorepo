/**
 * C4.2 — Stripe Refunds
 *
 * Process refunds for returns using the original PaymentIntent.
 * With destination charges, refunds are issued from the connected account.
 */

import { stripe } from '@twicely/stripe/server';
import { db } from '@twicely/db';
import { returnRequest, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@twicely/logger';

// ─── Callback Type (DI to avoid circular dep on @twicely/commerce) ───────────

export type ReturnFeesApplier = (
  returnId: string,
  stripeRefundId: string
) => Promise<{ success: boolean; error?: string }>;

export interface ProcessRefundInput {
  returnId: string;
  amountCents?: number; // Optional: defaults to full refund amount
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  /** SEC-024: Caller must pass the authenticated user/staff ID for auth verification */
  callerUserId: string;
}

export interface ProcessRefundResult {
  success: boolean;
  refundId?: string;
  amountCents?: number;
  error?: string;
}

/**
 * Process a refund for a return request.
 * Uses the original PaymentIntent to issue the refund.
 *
 * Order of operations (W10 fix):
 * 1. Validate return request
 * 2. Determine refund amount
 * 3. Issue Stripe refund FIRST
 * 4. Create ledger entries AFTER Stripe succeeds
 * 5. Update statuses
 */
export async function processReturnRefund(
  input: ProcessRefundInput,
  applyFees: ReturnFeesApplier
): Promise<ProcessRefundResult> {
  const { returnId, reason = 'requested_by_customer' } = input;

  // 1. Get return request
  const [req] = await db
    .select({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      refundAmountCents: returnRequest.refundAmountCents,
      status: returnRequest.status,
      reason: returnRequest.reason,
      sellerId: returnRequest.sellerId,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { success: false, error: 'Return request not found' };
  }

  // SEC-024: Verify the caller is authorized (seller or platform staff)
  if (input.callerUserId !== req.sellerId && input.callerUserId !== 'SYSTEM') {
    return { success: false, error: 'Not authorized to issue refunds for this return' };
  }

  if (!['DELIVERED', 'APPROVED', 'ESCALATED'].includes(req.status)) {
    return { success: false, error: 'Return must be delivered or escalated before issuing refund' };
  }

  // 2. Get order payment info
  const [ord] = await db
    .select({ paymentIntentId: order.paymentIntentId, totalCents: order.totalCents })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  if (!ord?.paymentIntentId) {
    return { success: false, error: 'No payment found for this order' };
  }

  // 3. Determine refund amount BEFORE Stripe call
  const amountCents = input.amountCents ?? req.refundAmountCents;
  if (!amountCents || amountCents <= 0) {
    return { success: false, error: 'Invalid refund amount' };
  }

  // H1 Security: Cap refund amount against order total
  if (amountCents > ord.totalCents) {
    return { success: false, error: 'Refund amount cannot exceed order total' };
  }

  // 4. Issue Stripe refund FIRST (before creating any ledger entries)
  let stripeRefundId: string;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: ord.paymentIntentId,
      amount: amountCents,
      reason,
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: {
        returnId,
        orderId: req.orderId,
        returnReason: req.reason,
      },
    });
    stripeRefundId = refund.id;
  } catch (error) {
    logger.error('Failed to process Stripe refund', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process refund',
    };
  }

  // 5. Apply return fees + create ledger entries (AFTER Stripe succeeds)
  const feesResult = await applyFees(returnId, stripeRefundId);
  if (!feesResult.success) {
    logger.warn('[refunds] Failed to apply return fees', { error: feesResult.error });
  }

  const now = new Date();

  // 6. Update return request status
  await db
    .update(returnRequest)
    .set({
      status: 'REFUND_ISSUED',
      refundedAt: now,
      updatedAt: now,
    })
    .where(eq(returnRequest.id, returnId));

  // 7. Update order status
  await db
    .update(order)
    .set({
      status: 'REFUNDED',
      updatedAt: now,
    })
    .where(eq(order.id, req.orderId));

  return {
    success: true,
    refundId: stripeRefundId,
    amountCents,
  };
}

/**
 * Get refund status from Stripe.
 */
export async function getRefundStatus(refundId: string) {
  try {
    const refund = await stripe.refunds.retrieve(refundId);
    return {
      success: true,
      status: refund.status,
      amountCents: refund.amount,
      reason: refund.reason,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get refund status',
    };
  }
}

/**
 * Check if a PaymentIntent can be refunded.
 */
export async function canRefund(paymentIntentId: string): Promise<boolean> {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Can refund if payment succeeded and not fully refunded
    if (pi.status !== 'succeeded') {
      return false;
    }

    // Check if already fully refunded
    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });

    if (charges.data.length === 0) {
      return false;
    }

    const charge = charges.data[0]!;
    return !charge.refunded;
  } catch {
    return false;
  }
}
