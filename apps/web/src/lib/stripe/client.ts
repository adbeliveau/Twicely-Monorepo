import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { clientLogger } from '@/lib/client-logger';

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get the Stripe.js instance (singleton).
 * Uses NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY from environment.
 */
export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      clientLogger.error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}
