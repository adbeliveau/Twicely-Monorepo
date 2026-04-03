/**
 * Webhook handler for charge.refunded events.
 * Catches refunds initiated OUTSIDE our processReturnRefund() flow —
 * e.g., Stripe Dashboard refunds, dispute auto-refunds.
 */

import type Stripe from 'stripe';
import { db } from '@twicely/db';
import { order, ledgerEntry } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import type { WebhookResult } from './webhooks';

export async function handleChargeRefunded(charge: Stripe.Charge, eventId?: string): Promise<WebhookResult> {
  try {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id ?? null;

    if (!paymentIntentId) {
      return { handled: true };
    }

    const [ord] = await db
      .select({
        id: order.id,
        status: order.status,
        orderNumber: order.orderNumber,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
      })
      .from(order)
      .where(eq(order.paymentIntentId, paymentIntentId))
      .limit(1);

    if (!ord) {
      return { handled: true };
    }

    // Skip if our code already processed the refund
    if (ord.status === 'REFUNDED' || ord.status === 'CANCELED') {
      return { handled: true };
    }

    const isFullRefund = charge.amount_refunded === charge.amount;
    // Use the most recent individual refund amount (data[0] = newest first).
    // charge.amount_refunded is cumulative — using it for partial refunds would
    // double-count amounts on multi-batch partial refunds.
    const latestRefund = (charge.refunds as Stripe.ApiList<Stripe.Refund> | undefined)?.data[0];
    const incrementalAmountCents = latestRefund?.amount ?? charge.amount_refunded;
    const now = new Date();

    if (isFullRefund) {
      // Guard: skip if ledger entry already exists for this refund
      if (latestRefund?.id) {
        const [existing] = await db
          .select({ id: ledgerEntry.id })
          .from(ledgerEntry)
          .where(and(eq(ledgerEntry.stripeRefundId, latestRefund.id), eq(ledgerEntry.type, 'REFUND_FULL')))
          .limit(1);
        if (existing) {
          logger.info('[webhook] charge.refunded — skipping duplicate REFUND_FULL ledger entry', { refundId: latestRefund.id });
          return { handled: true };
        }
      }

      await db
        .update(order)
        .set({ status: 'REFUNDED', updatedAt: now })
        .where(eq(order.id, ord.id));

      await db.insert(ledgerEntry).values({
        type: 'REFUND_FULL',
        status: 'POSTED',
        amountCents: -charge.amount_refunded,
        userId: ord.sellerId,
        orderId: ord.id,
        stripeChargeId: charge.id,
        stripePaymentIntentId: paymentIntentId,
        stripeRefundId: latestRefund?.id ?? null,
        stripeEventId: eventId ?? null,
        postedAt: now,
        memo: 'External full refund via Stripe',
      });

      const refundAmountFormatted = `$${(charge.amount_refunded / 100).toFixed(2)}`;
      void notify(ord.buyerId, 'order.refunded', {
        orderNumber: ord.orderNumber,
        refundAmountFormatted,
      }).catch(() => {});
      void notify(ord.sellerId, 'order.refunded', {
        orderNumber: ord.orderNumber,
        refundAmountFormatted,
      }).catch(() => {});

      logger.info('[webhook] charge.refunded — full refund processed', {
        orderId: ord.id,
        chargeId: charge.id,
        amountCents: charge.amount_refunded,
      });
    } else {
      // Guard: skip if ledger entry already exists for this refund
      if (latestRefund?.id) {
        const [existing] = await db
          .select({ id: ledgerEntry.id })
          .from(ledgerEntry)
          .where(and(eq(ledgerEntry.stripeRefundId, latestRefund.id), eq(ledgerEntry.type, 'REFUND_PARTIAL')))
          .limit(1);
        if (existing) {
          logger.info('[webhook] charge.refunded — skipping duplicate REFUND_PARTIAL ledger entry', { refundId: latestRefund.id });
          return { handled: true };
        }
      }

      await db.insert(ledgerEntry).values({
        type: 'REFUND_PARTIAL',
        status: 'POSTED',
        amountCents: -incrementalAmountCents,
        userId: ord.sellerId,
        orderId: ord.id,
        stripeChargeId: charge.id,
        stripePaymentIntentId: paymentIntentId,
        stripeRefundId: latestRefund?.id ?? null,
        stripeEventId: eventId ?? null,
        postedAt: now,
        memo: 'External partial refund via Stripe',
      });

      const refundAmountFormatted = `$${(incrementalAmountCents / 100).toFixed(2)}`;
      void notify(ord.buyerId, 'order.refunded', {
        orderNumber: ord.orderNumber,
        refundAmountFormatted,
      }).catch(() => {});
      void notify(ord.sellerId, 'order.refunded', {
        orderNumber: ord.orderNumber,
        refundAmountFormatted,
      }).catch(() => {});

      logger.info('[webhook] charge.refunded — partial refund logged', {
        orderId: ord.id,
        chargeId: charge.id,
        amountCents: incrementalAmountCents,
      });
    }

    return { handled: true };
  } catch (error) {
    logger.error('Error handling charge.refunded', { error });
    return {
      handled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
