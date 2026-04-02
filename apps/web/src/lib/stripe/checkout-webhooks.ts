/**
 * F4-S3: Checkout Session Webhook Handler
 *
 * Handles checkout.session.completed events for one-time payments.
 * NOT a 'use server' file — called from the API route after signature verification.
 *
 * Only one-time payment sessions (mode === 'payment') should reach this handler.
 */

import type Stripe from 'stripe';
import { db } from '@twicely/db';
import {
  sellerProfile,
  listerSubscription,
  publishCreditLedger,
} from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { addOverageCredits } from '@twicely/crosslister/services/rollover-manager';
import { logger } from '@twicely/logger';

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Dispatch a completed checkout session by metadata.type.
 * Only called for mode === 'payment' sessions.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const type = session.metadata?.type;

  switch (type) {
    case 'overage_pack':
      await handleOveragePackPurchase(session);
      break;
    default:
      logger.info('[checkout-webhook] Unhandled session type', { type });
  }
}

// ─── Overage Pack Handler ────────────────────────────────────────────────────

async function handleOveragePackPurchase(
  session: Stripe.Checkout.Session
): Promise<void> {
  // 1. Extract and validate all required metadata fields
  const userId = session.metadata?.userId;
  const packType = session.metadata?.packType;
  const quantityStr = session.metadata?.quantity;

  if (!userId || !packType || !quantityStr) {
    logger.error('[checkout-webhook] Overage pack: missing metadata fields', {
      sessionId: session.id,
      userId,
      packType,
      quantityStr,
    });
    return;
  }

  const quantity = parseInt(quantityStr, 10);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    logger.error('[checkout-webhook] Overage pack: invalid quantity', {
      sessionId: session.id,
      quantityStr,
    });
    return;
  }

  // 2. Get active lister subscription for this user to find currentPeriodEnd
  const [listerSub] = await db
    .select({
      currentPeriodEnd: listerSubscription.currentPeriodEnd,
      tier: listerSubscription.tier,
      status: listerSubscription.status,
    })
    .from(listerSubscription)
    .innerJoin(sellerProfile, eq(sellerProfile.id, listerSubscription.sellerProfileId))
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  if (!listerSub || !listerSub.currentPeriodEnd) {
    logger.error('[checkout-webhook] Overage pack: no active lister subscription found', {
      sessionId: session.id,
      userId,
    });
    return;
  }

  // 3. Guard: subscription must be active
  if (listerSub.status !== 'ACTIVE' && listerSub.status !== 'TRIALING') {
    logger.error('[checkout-webhook] Overage pack: lister subscription not active', {
      sessionId: session.id,
      userId,
      status: listerSub.status,
    });
    return;
  }

  // 4. Idempotency check: skip if credits were already delivered for this Stripe session.
  const [existing] = await db
    .select({ id: publishCreditLedger.id })
    .from(publishCreditLedger)
    .where(eq(publishCreditLedger.stripeSessionId, session.id))
    .limit(1);

  if (existing) {
    logger.info('[checkout-webhook] Overage pack: duplicate webhook detected, skipping', {
      sessionId: session.id,
      userId,
      existingLedgerId: existing.id,
    });
    return;
  }

  // 5. Deliver credits — expire at current lister period end
  await addOverageCredits(userId, quantity, listerSub.currentPeriodEnd, session.id);

  logger.info('[checkout-webhook] Overage pack credits delivered', {
    sessionId: session.id,
    userId,
    quantity,
    expiresAt: listerSub.currentPeriodEnd,
  });
}
