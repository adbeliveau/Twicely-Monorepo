-- D3-S4: Add pending upgrade/downgrade columns to subscription tables

ALTER TABLE "store_subscription" ADD COLUMN "pending_tier" "store_tier";
ALTER TABLE "store_subscription" ADD COLUMN "pending_billing_interval" text;
ALTER TABLE "store_subscription" ADD COLUMN "pending_change_at" timestamp with time zone;

ALTER TABLE "lister_subscription" ADD COLUMN "pending_tier" "lister_tier";
ALTER TABLE "lister_subscription" ADD COLUMN "pending_billing_interval" text;
ALTER TABLE "lister_subscription" ADD COLUMN "pending_change_at" timestamp with time zone;

ALTER TABLE "finance_subscription" ADD COLUMN "pending_tier" "finance_tier";
ALTER TABLE "finance_subscription" ADD COLUMN "pending_billing_interval" text;
ALTER TABLE "finance_subscription" ADD COLUMN "pending_change_at" timestamp with time zone;
