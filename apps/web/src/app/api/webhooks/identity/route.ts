/**
 * Stripe Identity Webhook Handler — G6
 *
 * Handles identity.verification_session.* events from Stripe.
 * Endpoint: POST /api/webhooks/identity
 * Uses: STRIPE_IDENTITY_WEBHOOK_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@twicely/stripe/server';
import { handleVerificationWebhook } from '@twicely/stripe/identity-service';
import { logger } from '@twicely/logger';

const WEBHOOK_SECRET = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

const HANDLED_EVENTS = new Set([
  'identity.verification_session.verified',
  'identity.verification_session.requires_input',
  'identity.verification_session.canceled',
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!WEBHOOK_SECRET) {
    logger.error('STRIPE_IDENTITY_WEBHOOK_SECRET is not configured');
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
    logger.error('Identity webhook signature verification failed', { error: err });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  try {
    await handleVerificationWebhook(event);
  } catch (err) {
    logger.error('Identity webhook handler error', { error: err, eventType: event.type });
    // Return 500 so Stripe retries — dedupe key is only set after success
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
