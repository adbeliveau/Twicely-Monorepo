-- D3-S5: Add bundle subscription schema

CREATE TYPE "bundle_tier" AS ENUM ('NONE', 'STARTER', 'PRO', 'POWER');

CREATE TABLE "bundle_subscription" (
  "id" text PRIMARY KEY NOT NULL,
  "seller_profile_id" text NOT NULL UNIQUE REFERENCES "seller_profile"("id"),
  "tier" "bundle_tier" NOT NULL,
  "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
  "stripe_subscription_id" text UNIQUE,
  "stripe_price_id" text,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "canceled_at" timestamp with time zone,
  "trial_ends_at" timestamp with time zone,
  "pending_tier" "bundle_tier",
  "pending_billing_interval" text,
  "pending_change_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "seller_profile" ADD COLUMN "bundle_tier" "bundle_tier" NOT NULL DEFAULT 'NONE';
