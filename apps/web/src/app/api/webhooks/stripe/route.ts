/**
 * Stripe Platform Webhook Handler
 *
 * Handles payment events (payment_intent, subscription, etc.).
 * Endpoint: POST /api/webhooks/stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@twicely/stripe/server';
import { handlePlatformWebhook } from '@twicely/stripe/webhooks';
import { logger } from '@twicely/logger';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET);
  } catch (error) {
    logger.error('Webhook signature verification failed', { error });
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Process the event
  const result = await handlePlatformWebhook(event);

  if (result.error) {
    logger.error('Webhook error', { eventType: event.type, error: result.error });
    // Return 200 anyway to acknowledge receipt — Stripe will retry on 4xx/5xx
    // We log errors but don't fail the webhook
  }

  return NextResponse.json({ received: true, handled: result.handled });
}