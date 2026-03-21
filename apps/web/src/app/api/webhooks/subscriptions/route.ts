/**
 * D3-S2: Stripe Subscription Webhook Handler
 *
 * Handles subscription lifecycle events (created, updated, deleted).
 * Endpoint: POST /api/webhooks/subscriptions
 *
 * This is SEPARATE from the marketplace webhook (/api/webhooks/stripe).
 * Uses a different webhook secret: STRIPE_SUBSCRIPTION_WEBHOOK_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@twicely/stripe/server';
import { handleSubscriptionWebhook } from '@twicely/stripe/subscription-webhooks';
import { logger } from '@twicely/logger';

const WEBHOOK_SECRET = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!WEBHOOK_SECRET) {
    logger.error('STRIPE_SUBSCRIPTION_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    await handleSubscriptionWebhook(event);
  } catch (err) {
    logger.error('Subscription webhook handler error', { error: err });
    // Return 200 even on handler errors — Stripe retries on non-2xx, causing retry storms
    return NextResponse.json({ error: 'Handler failed' }, { status: 200 });
  }

  return NextResponse.json({ received: true });
}
