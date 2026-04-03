/**
 * Stripe Connect Webhook Handler
 *
 * Handles Connect-specific events (account.updated, etc.).
 * Endpoint: POST /api/webhooks/stripe-connect
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@twicely/stripe/server';
import { handleConnectWebhook } from '@twicely/stripe/webhooks';
import { logger } from '@twicely/logger';

const WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    logger.error('STRIPE_CONNECT_WEBHOOK_SECRET is not configured');
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
  const result = await handleConnectWebhook(event);

  if (result.error) {
    logger.error('Connect webhook error', { eventType: event.type, error: result.error });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ received: true, handled: result.handled });
}