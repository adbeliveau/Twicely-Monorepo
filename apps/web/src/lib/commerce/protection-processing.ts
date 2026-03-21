/**
 * Buyer protection claim processing — extracted from buyer-protection.ts
 *
 * Admin-side claim resolution and protection status queries.
 */

import { db } from '@twicely/db';
import { dispute, order, ledgerEntry } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { stripe } from '@twicely/stripe/server';
import { logger } from '@twicely/logger';
import { isEligibleForProtection, isWithinClaimWindow } from './buyer-protection';

export interface ProcessClaimInput {
  adminId: string;
  claimId: string;
  approved: boolean;
  resolutionNote: string;
  refundAmountCents?: number;
}

export interface ProcessClaimResult {
  success: boolean;
  error?: string;
}

/**
 * Admin processes a protection claim (approve or deny).
 */
export async function processProtectionClaim(
  input: ProcessClaimInput
): Promise<ProcessClaimResult> {
  const { adminId, claimId, approved, resolutionNote, refundAmountCents } = input;

  const [claim] = await db
    .select({
      id: dispute.id,
      orderId: dispute.orderId,
      buyerId: dispute.buyerId,
      sellerId: dispute.sellerId,
      status: dispute.status,
    })
    .from(dispute)
    .where(eq(dispute.id, claimId))
    .limit(1);

  if (!claim) {
    return { success: false, error: 'Claim not found' };
  }

  if (!['OPEN', 'UNDER_REVIEW'].includes(claim.status)) {
    return { success: false, error: 'Claim has already been processed' };
  }

  const now = new Date();

  if (approved) {
    // 1. Get order info including paymentIntentId and total
    const [ord] = await db
      .select({
        totalCents: order.totalCents,
        paymentIntentId: order.paymentIntentId,
      })
      .from(order)
      .where(eq(order.id, claim.orderId))
      .limit(1);

    if (!ord?.paymentIntentId) {
      return { success: false, error: 'No payment found for this order' };
    }

    const refundAmount = refundAmountCents ?? ord.totalCents;
    if (!refundAmount || refundAmount <= 0) {
      return { success: false, error: 'Invalid refund amount' };
    }

    // 2. Issue Stripe refund FIRST (before any DB changes)
    let stripeRefundId: string;
    try {
      const refund = await stripe.refunds.create({
        payment_intent: ord.paymentIntentId,
        amount: refundAmount,
        reason: 'fraudulent',
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { claimId, orderId: claim.orderId, adminId, source: 'buyer_protection' },
      });
      stripeRefundId = refund.id;
    } catch (error) {
      logger.error('Failed to process Stripe refund for protection claim', {
        claimId,
        orderId: claim.orderId,
        error,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process refund',
      };
    }

    // 3. Only after Stripe succeeds — update dispute status
    await db
      .update(dispute)
      .set({
        status: 'RESOLVED_BUYER',
        resolutionNote,
        resolutionAmountCents: refundAmount,
        resolvedByStaffId: adminId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(dispute.id, claimId));

    // 4. Create ledger entries
    await db.insert(ledgerEntry).values([
      {
        type: 'REFUND_FULL',
        status: 'POSTED',
        amountCents: -refundAmount,
        userId: claim.sellerId,
        orderId: claim.orderId,
        stripeRefundId,
        postedAt: now,
        reasonCode: `protection_claim:${claimId}`,
        memo: 'Buyer protection claim refund',
      },
      {
        type: 'PLATFORM_ABSORBED_COST',
        status: 'POSTED',
        amountCents: -refundAmount,
        userId: claim.sellerId,
        orderId: claim.orderId,
        postedAt: now,
        reasonCode: `protection_claim:${claimId}:absorbed`,
        memo: 'Platform protection fund absorption',
      },
    ]);

    // 5. Update order status
    await db
      .update(order)
      .set({ status: 'REFUNDED', updatedAt: now })
      .where(eq(order.id, claim.orderId));

  } else {
    // Deny claim
    await db
      .update(dispute)
      .set({
        status: 'RESOLVED_SELLER',
        resolutionNote,
        resolvedByStaffId: adminId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(dispute.id, claimId));
  }

  // Get order number for notification
  const [orderInfo] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, claim.orderId))
    .limit(1);

  const resolutionText = approved
    ? 'Your claim has been approved. A full refund will be issued.'
    : 'Your claim was not approved. ' + resolutionNote;

  // Notify buyer and seller
  await Promise.all([
    notify(claim.buyerId, 'dispute.resolved', {
      orderNumber: orderInfo?.orderNumber ?? '',
      resolution: resolutionText,
    }),
    notify(claim.sellerId, 'dispute.resolved', {
      orderNumber: orderInfo?.orderNumber ?? '',
      resolution: approved
        ? `A buyer protection claim on order ${orderInfo?.orderNumber ?? ''} was approved. A refund has been issued.`
        : `A buyer protection claim on order ${orderInfo?.orderNumber ?? ''} was denied.`,
    }),
  ]);

  return { success: true };
}

/**
 * Get protection status for an order (for UI display).
 */
export interface ProtectionStatus {
  eligible: boolean;
  hasActiveClaim: boolean;
  claimId?: string;
  claimStatus?: string;
  windowOpen: boolean;
  daysRemaining: number;
}

export async function getProtectionStatus(orderId: string): Promise<ProtectionStatus> {
  const [ord] = await db
    .select({
      status: order.status,
      deliveredAt: order.deliveredAt,
      paymentIntentId: order.paymentIntentId,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord) {
    return {
      eligible: false,
      hasActiveClaim: false,
      windowOpen: false,
      daysRemaining: 0,
    };
  }

  const eligible = await isEligibleForProtection(orderId);

  // Check for existing claim
  const [existingClaim] = await db
    .select({ id: dispute.id, status: dispute.status })
    .from(dispute)
    .where(eq(dispute.orderId, orderId))
    .limit(1);

  const hasActiveClaim = !!existingClaim
    && !['RESOLVED_BUYER', 'RESOLVED_SELLER', 'CLOSED'].includes(existingClaim.status);

  // Check window (using standard window for general status)
  const windowCheck = await isWithinClaimWindow(ord.deliveredAt, 'INAD');

  return {
    eligible,
    hasActiveClaim,
    claimId: existingClaim?.id,
    claimStatus: existingClaim?.status,
    windowOpen: windowCheck.withinWindow,
    daysRemaining: windowCheck.daysRemaining,
  };
}
