-- Migration: Add stripeCustomerId column to user table
-- G10.10 — Saved Payment Methods (buyer-side Stripe Customer)
-- Separate from seller_profile.stripe_customer_id which is used for billing subscriptions

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
