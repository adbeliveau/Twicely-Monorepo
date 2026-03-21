-- D3-S2: Add stripeCustomerId to seller_profile for Stripe Checkout Sessions
ALTER TABLE "seller_profile" ADD COLUMN "stripe_customer_id" text;
