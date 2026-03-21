CREATE TYPE "public"."combined_shipping_mode" AS ENUM('NONE', 'FLAT', 'PER_ADDITIONAL', 'AUTO_DISCOUNT', 'QUOTED');--> statement-breakpoint
CREATE TYPE "public"."return_reason_bucket" AS ENUM('SELLER_FAULT', 'BUYER_REMORSE', 'PLATFORM_CARRIER_FAULT', 'EDGE_CONDITIONAL');--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "shipping_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD COLUMN "combined_shipping_mode" "combined_shipping_mode" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD COLUMN "flat_combined_cents" integer;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD COLUMN "additional_item_cents" integer;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD COLUMN "auto_discount_percent" real;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD COLUMN "auto_discount_min_items" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "bucket" "return_reason_bucket";--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "refund_item_cents" integer;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "refund_shipping_cents" integer;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "refund_tax_cents" integer;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "restocking_fee_cents" integer;--> statement-breakpoint
ALTER TABLE "return_request" ADD COLUMN "fee_allocation_json" jsonb;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "order_value_cents" integer;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "had_dispute" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "dispute_outcome" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "trust_weight" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "trust_weight_factors" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD COLUMN "on_time_shipping_pct" real DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD COLUMN "avg_response_time_hours" real;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD COLUMN "trust_badge" text;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD COLUMN "trust_badge_secondary" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD COLUMN "display_stars" real;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD COLUMN "show_stars" boolean DEFAULT false NOT NULL;