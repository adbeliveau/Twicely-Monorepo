/**
 * D3-S2: Shared Stripe Test Mock Helpers
 *
 * Used by subscription-webhooks.test.ts and create-subscription-checkout.test.ts
 */

import type Stripe from 'stripe';
import type { auth } from '@twicely/auth';
import type { stripe } from '@twicely/stripe/server';

// ─── Mock Subscription ──────────────────────────────────────────────────────

export interface MockSubscriptionOptions {
  product?: string;
  tier?: string;
  status?: string;
  sellerProfileId?: string;
  customerId?: string;
  subscriptionId?: string;
}

export function createMockSubscription(
  options: MockSubscriptionOptions = {}
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: options.subscriptionId || 'sub_test123',
    customer: options.customerId || 'cus_test123',
    status: options.status || 'active',
    metadata: {
      sellerProfileId: options.sellerProfileId || 'sp_123',
      product: options.product || 'store',
      tier: options.tier || 'PRO',
    },
    items: {
      data: [
        {
          price: {
            id: 'price_store_pro_monthly',
          },
          // Stripe API 2026-01-28.clover: current_period on item, not subscription
          current_period_start: now,
          current_period_end: now + 30 * 24 * 60 * 60,
        },
      ],
    },
    cancel_at_period_end: false,
    trial_end: null,
  } as unknown as Stripe.Subscription;
}

// ─── Mock Stripe Event ──────────────────────────────────────────────────────

export function createMockSubscriptionEvent(
  type: string,
  subscription: Stripe.Subscription
): Stripe.Event {
  return {
    type,
    data: {
      object: subscription,
    },
  } as unknown as Stripe.Event;
}

// ─── Mock Session ───────────────────────────────────────────────────────────

export function createMockSession(
  userId = 'user_123',
  email = 'test@example.com'
): Awaited<ReturnType<typeof auth.api.getSession>> {
  return {
    user: { id: userId, email },
    session: { id: 'session_123' },
  } as unknown as Awaited<ReturnType<typeof auth.api.getSession>>;
}

// ─── Mock Checkout Session ──────────────────────────────────────────────────

export function createMockCheckoutSession(
  url: string
): Awaited<ReturnType<typeof stripe.checkout.sessions.create>> {
  return { url } as unknown as Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
}
