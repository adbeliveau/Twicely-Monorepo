/**
 * Chargeback Evidence & Resolution
 *
 * Handles evidence submission to Stripe and chargeback resolution (won/lost).
 */

import { stripe } from './server';
import { db } from '@twicely/db';
import { dispute, order, shipment, ledgerEntry } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { logger } from '@twicely/logger';

export interface EvidenceSubmitResult {
  success: boolean;
  error?: string;
}

/**
 * Gather and submit evidence to Stripe for a chargeback.
 */
export async function submitChargebackEvidence(
  internalDisputeId: string,
  stripeDisputeId: string
): Promise<EvidenceSubmitResult> {
  // Get dispute and order details
  const [disp] = await db
    .select({
      id: dispute.id,
      orderId: dispute.orderId,
      description: dispute.description,
    })
    .from(dispute)
    .where(eq(dispute.id, internalDisputeId))
    .limit(1);

  if (!disp) {
    return { success: false, error: 'Internal dispute not found' };
  }

  // Get order details
  const [ord] = await db
    .select({
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      paidAt: order.paidAt,
      shippingAddressJson: order.shippingAddressJson,
    })
    .from(order)
    .where(eq(order.id, disp.orderId))
    .limit(1);

  if (!ord) {
    return { success: false, error: 'Order not found' };
  }

  // Get shipment/tracking info
  const [ship] = await db
    .select({
      tracking: shipment.tracking,
      carrier: shipment.carrier,
      deliveredAt: shipment.deliveredAt,
      trackingEventsJson: shipment.trackingEventsJson,
    })
    .from(shipment)
    .where(eq(shipment.orderId, disp.orderId))
    .limit(1);

  try {
    // Build evidence object
    const evidence: Stripe.DisputeUpdateParams.Evidence = {
      product_description: `Item purchased on Twicely marketplace. Order #${ord.orderNumber}`,
      shipping_address: typeof ord.shippingAddressJson === 'string'
        ? ord.shippingAddressJson
        : JSON.stringify(ord.shippingAddressJson),
      shipping_carrier: ship?.carrier ?? undefined,
      shipping_tracking_number: ship?.tracking ?? undefined,
      shipping_date: ship?.deliveredAt?.toISOString().split('T')[0],
      service_date: ord.paidAt?.toISOString().split('T')[0],
    };

    await stripe.disputes.update(stripeDisputeId, {
      evidence,
      submit: true,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to submit chargeback evidence', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit evidence',
    };
  }
}

/**
 * Handle chargeback resolution (won or lost).
 * Called from webhook handler.
 */
export async function handleChargebackResolution(
  stripeDispute: Stripe.Dispute
): Promise<void> {
  const paymentIntentId = stripeDispute.payment_intent as string | null;
  if (!paymentIntentId) return;

  const [ord] = await db
    .select({ id: order.id, sellerId: order.sellerId })
    .from(order)
    .where(eq(order.paymentIntentId, paymentIntentId))
    .limit(1);

  if (!ord) return;

  const now = new Date();

  if (stripeDispute.status === 'won') {
    await db.insert(ledgerEntry).values({
      type: 'CHARGEBACK_REVERSAL',
      status: 'POSTED',
      amountCents: stripeDispute.amount,
      userId: ord.sellerId,
      orderId: ord.id,
      postedAt: now,
    });

    await db
      .update(dispute)
      .set({
        status: 'RESOLVED_SELLER',
        resolutionNote: 'Chargeback won - funds returned',
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(dispute.orderId, ord.id));

  } else if (stripeDispute.status === 'lost') {
    await db.insert(ledgerEntry).values({
      type: 'CHARGEBACK_FEE',
      status: 'POSTED',
      amountCents: -(await getPlatformSetting<number>('commerce.chargeback.feeCents', 1500)),
      userId: ord.sellerId,
      orderId: ord.id,
      postedAt: now,
    });

    await db.insert(ledgerEntry).values({
      type: 'PLATFORM_ABSORBED_COST',
      status: 'POSTED',
      amountCents: -stripeDispute.amount,
      userId: ord.sellerId,
      orderId: ord.id,
      postedAt: now,
    });

    await db
      .update(dispute)
      .set({
        status: 'RESOLVED_BUYER',
        resolutionNote: 'Chargeback lost - platform absorbed cost',
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(dispute.orderId, ord.id));
  }
}

/**
 * Get chargeback status from Stripe.
 */
export async function getChargebackStatus(stripeDisputeId: string) {
  try {
    const stripeDispute = await stripe.disputes.retrieve(stripeDisputeId);
    return {
      success: true,
      status: stripeDispute.status,
      reason: stripeDispute.reason,
      amount: stripeDispute.amount,
      evidenceDueBy: stripeDispute.evidence_details?.due_by
        ? new Date(stripeDispute.evidence_details.due_by * 1000)
        : null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get chargeback status',
    };
  }
}
