import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

/**
 * Create a basic Stripe PaymentIntent (no Connect).
 * Used for platform subscriptions or non-marketplace payments.
 */
export async function createPaymentIntent(
  amountCents: number,
  metadata: Record<string, string>
): Promise<CreatePaymentIntentResult> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true,
    },
    metadata,
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Failed to create payment intent: no client secret returned');
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

export interface CreateConnectPaymentIntentInput {
  amountCents: number;
  applicationFeeCents: number;
  destinationAccountId: string;
  metadata: Record<string, string>;
}

/**
 * Create a Stripe PaymentIntent with destination charges (Connect).
 *
 * Uses the destination charges pattern:
 * - Buyer pays total amount
 * - Twicely collects application_fee_amount (TF - Transaction Fee)
 * - Remainder goes to seller's connected account
 *
 * @see https://stripe.com/docs/connect/destination-charges
 */
export async function createConnectPaymentIntent(
  input: CreateConnectPaymentIntentInput
): Promise<CreatePaymentIntentResult> {
  const { amountCents, applicationFeeCents, destinationAccountId, metadata } = input;

  // Validate inputs
  if (!destinationAccountId) {
    throw new Error('destinationAccountId is required');
  }
  if (amountCents < 50) {
    throw new Error('Amount must be at least 50 cents (Stripe minimum)');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    automatic_payment_methods: {
      enabled: true,
    },
    application_fee_amount: applicationFeeCents,
    transfer_data: {
      destination: destinationAccountId,
    },
    metadata,
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Failed to create payment intent: no client secret returned');
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}
