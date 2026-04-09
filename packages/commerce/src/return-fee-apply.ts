/**
 * Return fee application — extracted from return-fees.ts
 *
 * Applies the calculated fee breakdown to a return request
 * and creates corresponding ledger entries.
 */

import { db } from '@twicely/db';
import { returnRequest, ledgerEntry } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { calculateReturnFees } from './return-fees';

export interface ApplyFeesResult {
  success: boolean;
  error?: string;
}

/**
 * Apply return fees: update return request with fee breakdown and create ledger entries.
 * @param stripeRefundId - Stripe refund ID, passed after successful Stripe refund (W10 fix)
 */
export async function applyReturnFees(
  returnId: string,
  stripeRefundId?: string
): Promise<ApplyFeesResult> {
  const fees = await calculateReturnFees(returnId);
  if (!fees) {
    return { success: false, error: 'Return request not found' };
  }

  // Get return request for seller ID
  const [req] = await db
    .select({
      orderId: returnRequest.orderId,
      sellerId: returnRequest.sellerId,
      status: returnRequest.status,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return { success: false, error: 'Return request not found' };
  }

  // Only apply fees if return is delivered (item returned)
  if (!['DELIVERED', 'REFUND_ISSUED'].includes(req.status)) {
    return { success: false, error: 'Return must be delivered before applying fees' };
  }

  const now = new Date();

  // Update return request with fee breakdown
  await db
    .update(returnRequest)
    .set({
      refundItemCents: fees.itemRefundCents,
      refundShippingCents: fees.shippingRefundCents,
      refundTaxCents: fees.taxRefundCents,
      restockingFeeCents: fees.restockingFeeCents,
      refundAmountCents: fees.refundToBuyerCents,
      feeAllocationJson: fees,
      updatedAt: now,
    })
    .where(eq(returnRequest.id, returnId));

  // Create ledger entries
  // 1. Return refund (negative seller balance)
  const refundType = fees.restockingFeeCents > 0 ? 'REFUND_PARTIAL' : 'REFUND_FULL';
  const refundKeyType = refundType === 'REFUND_FULL' ? 'full' : 'partial';
  await db.insert(ledgerEntry).values({
    type: refundType,
    status: 'POSTED',
    amountCents: -fees.itemRefundCents, // Negative: seller owes this
    userId: req.sellerId,
    orderId: req.orderId,
    reasonCode: stripeRefundId ? `stripe:${stripeRefundId}` : undefined,
    idempotencyKey: `refund:${returnId}:${refundKeyType}`,
    postedAt: now,
  });

  // 2. TF (Transaction Fee) reversal (credit to seller)
  if (fees.tfRefundToSellerCents > 0) {
    await db.insert(ledgerEntry).values({
      type: 'REFUND_TF_REVERSAL',
      status: 'POSTED',
      amountCents: fees.tfRefundToSellerCents, // Positive: platform credits seller
      userId: req.sellerId,
      orderId: req.orderId,
      reasonCode: stripeRefundId ? `stripe:${stripeRefundId}` : undefined,
      idempotencyKey: `refund:${returnId}:tf_reversal`,
      postedAt: now,
    });
  }

  // 3. Platform absorbed cost (if any)
  if (fees.platformAbsorbsCents > 0) {
    await db.insert(ledgerEntry).values({
      type: 'PLATFORM_ABSORBED_COST',
      status: 'POSTED',
      amountCents: -fees.platformAbsorbsCents, // Platform expense
      userId: req.sellerId, // Reference seller for tracking
      orderId: req.orderId,
      reasonCode: stripeRefundId ? `stripe:${stripeRefundId}` : undefined,
      idempotencyKey: `refund:${returnId}:platform_absorb`,
      postedAt: now,
    });
  }

  // 4. Stripe reversal tracking entry (Finance Engine §5.2)
  if (stripeRefundId) {
    await db.insert(ledgerEntry).values({
      type: 'REFUND_STRIPE_REVERSAL',
      status: 'POSTED',
      amountCents: -fees.refundToBuyerCents,
      userId: req.sellerId,
      orderId: req.orderId,
      stripeRefundId,
      reasonCode: `stripe:${stripeRefundId}`,
      idempotencyKey: `refund:${returnId}:stripe_reversal`,
      memo: `Stripe refund ${stripeRefundId}`,
      postedAt: now,
    });
  }

  return { success: true };
}
