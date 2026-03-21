'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  validateAdjustment,
  initiatePriceAdjustment,
  acceptPriceAdjustment,
  declinePriceAdjustment,
} from '@twicely/commerce/local-price-adjustment';
import { createPriceAdjustmentLedgerEntry } from '@twicely/commerce/local-ledger';
import { canTransition } from '@twicely/commerce/local-state-machine';
import {
  initiatePriceAdjustmentSchema,
  respondToAdjustmentSchema,
} from '@/lib/validations/local';
import { stripe } from '@twicely/stripe/server';
import { logger } from '@twicely/logger';
import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InitiateResult {
  success: boolean;
  error?: string;
}

interface RespondResult {
  success: boolean;
  error?: string;
  sellerToken?: string;
  buyerToken?: string;
  sellerOfflineCode?: string;
  buyerOfflineCode?: string;
}

// ─── initiatePriceAdjustmentAction ───────────────────────────────────────────

export async function initiatePriceAdjustmentAction(
  data: z.infer<typeof initiatePriceAdjustmentSchema>,
): Promise<InitiateResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not found' };

  const parsed = initiatePriceAdjustmentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!transaction) return { success: false, error: 'Not found' };

  if (session.userId !== transaction.sellerId) return { success: false, error: 'Not found' };

  if (!ability.can('update', sub('LocalTransaction', { sellerId: transaction.sellerId }))) {
    return { success: false, error: 'Not found' };
  }

  if (transaction.status !== 'BOTH_CHECKED_IN') {
    return { success: false, error: 'Transaction not in valid state' };
  }

  if (transaction.adjustmentInitiatedAt !== null) {
    return { success: false, error: 'A price adjustment has already been initiated' };
  }

  if (!canTransition(transaction.status, 'ADJUSTMENT_PENDING')) {
    return { success: false, error: 'Transaction not in valid state' };
  }

  // Fetch orderId to validate adjustment bounds
  const [ord] = await db
    .select({ id: order.id })
    .from(order)
    .where(eq(order.id, transaction.orderId))
    .limit(1);

  if (!ord) return { success: false, error: 'Not found' };

  const validation = await validateAdjustment(
    transaction.orderId,
    parsed.data.localTransactionId,
    parsed.data.adjustedPriceCents,
  );

  if (!validation.valid) {
    return { success: false, error: validation.error ?? 'Invalid price adjustment' };
  }

  const result = await initiatePriceAdjustment(
    parsed.data.localTransactionId,
    parsed.data.adjustedPriceCents,
    parsed.data.adjustmentReason,
  );

  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to initiate adjustment' };
  }

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');
  return { success: true };
}

// ─── respondToAdjustmentAction ────────────────────────────────────────────────

export async function respondToAdjustmentAction(
  data: z.infer<typeof respondToAdjustmentSchema>,
): Promise<RespondResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Not found' };

  const parsed = respondToAdjustmentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [transaction] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!transaction) return { success: false, error: 'Not found' };

  if (session.userId !== transaction.buyerId) return { success: false, error: 'Not found' };

  if (!ability.can('update', sub('LocalTransaction', { buyerId: transaction.buyerId }))) {
    return { success: false, error: 'Not found' };
  }

  if (transaction.status !== 'ADJUSTMENT_PENDING') {
    return { success: false, error: 'Transaction not in valid state' };
  }

  if (parsed.data.accept) {
    // Validate we have adjustedPriceCents on the transaction
    if (transaction.adjustedPriceCents === null || transaction.adjustedPriceCents === undefined) {
      return { success: false, error: 'No pending adjustment found' };
    }

    const acceptResult = await acceptPriceAdjustment(parsed.data.localTransactionId);
    if (!acceptResult.success) {
      return { success: false, error: acceptResult.error ?? 'Failed to accept adjustment' };
    }

    // Fetch original price + paymentIntentId for ledger + Stripe refund
    const [ord] = await db
      .select({
        itemSubtotalCents: order.itemSubtotalCents,
        paymentIntentId: order.paymentIntentId,
      })
      .from(order)
      .where(eq(order.id, transaction.orderId))
      .limit(1);

    if (ord) {
      const deltaCents = ord.itemSubtotalCents - transaction.adjustedPriceCents;

      await createPriceAdjustmentLedgerEntry({
        orderId: transaction.orderId,
        sellerId: transaction.sellerId,
        originalPriceCents: ord.itemSubtotalCents,
        adjustedPriceCents: transaction.adjustedPriceCents,
      });

      // Issue Stripe partial refund for the price delta.
      // refund_application_fee is intentionally omitted (defaults false):
      // Per Addendum A3 and Finance Engine §5.3 (LOCKED decision),
      // TF is always calculated on the original price — no fee reversal on adjustments.
      if (ord.paymentIntentId && deltaCents > 0) {
        try {
          await stripe.refunds.create({
            payment_intent: ord.paymentIntentId,
            amount: deltaCents,
            reason: 'requested_by_customer',
            reverse_transfer: true,
            metadata: {
              orderId: transaction.orderId,
              localTransactionId: parsed.data.localTransactionId,
              adjustmentReason: 'meetup_price_adjustment',
            },
          });
        } catch (refundErr) {
          logger.error('[local-price-adjustment] Stripe refund failed', {
            orderId: transaction.orderId,
            deltaCents,
            error: String(refundErr),
          });
          return { success: false, error: 'Price adjustment accepted but refund failed. Contact support.' };
        }
      }
    }

    revalidatePath('/my/buying/orders');
    revalidatePath('/my/selling/orders');
    return {
      success: true,
      sellerToken: acceptResult.sellerToken,
      buyerToken: acceptResult.buyerToken,
      sellerOfflineCode: acceptResult.sellerOfflineCode,
      buyerOfflineCode: acceptResult.buyerOfflineCode,
    };
  } else {
    const declineResult = await declinePriceAdjustment(parsed.data.localTransactionId);
    if (!declineResult.success) {
      return { success: false, error: declineResult.error ?? 'Failed to decline adjustment' };
    }

    revalidatePath('/my/buying/orders');
    revalidatePath('/my/selling/orders');
    return { success: true };
  }
}
