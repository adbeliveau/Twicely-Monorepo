-- A2.1: Schema Addendum v1.3 — Comprehensive sync of TypeScript schema to database
-- Creates 14 new enum types, 43 new tables, adds columns to listing and seller_profile

-- ============================================================
-- SECTION 1: New Enum Types
-- ============================================================

CREATE TYPE "public"."finance_tier" AS ENUM('FREE', 'PRO');
--> statement-breakpoint
CREATE TYPE "public"."fulfillment_type" AS ENUM('SHIP_ONLY', 'LOCAL_ONLY', 'SHIP_AND_LOCAL');
--> statement-breakpoint
CREATE TYPE "public"."offer_type" AS ENUM('BEST_OFFER', 'WATCHER_OFFER', 'BUNDLE');
--> statement-breakpoint
CREATE TYPE "public"."local_transaction_status" AS ENUM('SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN', 'BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED');
--> statement-breakpoint
CREATE TYPE "public"."authentication_status" AS ENUM('NONE', 'SELLER_VERIFIED', 'AI_PENDING', 'AI_AUTHENTICATED', 'AI_INCONCLUSIVE', 'AI_COUNTERFEIT', 'EXPERT_PENDING', 'EXPERT_AUTHENTICATED', 'EXPERT_COUNTERFEIT', 'CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED');
--> statement-breakpoint
CREATE TYPE "public"."affiliate_tier" AS ENUM('COMMUNITY', 'INFLUENCER');
--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');
--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('CLICKED', 'SIGNED_UP', 'TRIALING', 'CONVERTED', 'CHURNED');
--> statement-breakpoint
CREATE TYPE "public"."promo_code_type" AS ENUM('AFFILIATE', 'PLATFORM');
--> statement-breakpoint
CREATE TYPE "public"."promo_discount_type" AS ENUM('PERCENTAGE', 'FIXED');
--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('PENDING', 'PAYABLE', 'PAID', 'REVERSED');
--> statement-breakpoint
CREATE TYPE "public"."buyer_referral_status" AS ENUM('PENDING', 'SIGNED_UP', 'REDEEMED', 'EXPIRED');
--> statement-breakpoint
CREATE TYPE "public"."live_session_status" AS ENUM('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
--> statement-breakpoint
CREATE TYPE "public"."interest_source" AS ENUM('EXPLICIT', 'PURCHASE', 'WATCHLIST', 'CLICK', 'SEARCH');
--> statement-breakpoint

-- ============================================================
-- SECTION 2: New Tables
-- ============================================================

-- §2.5b storefront
CREATE TABLE "storefront" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"slug" text,
	"name" text,
	"banner_url" text,
	"logo_url" text,
	"accent_color" text,
	"announcement" text,
	"about_html" text,
	"social_links_json" jsonb DEFAULT '{}' NOT NULL,
	"featured_listing_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"default_view" text DEFAULT 'GRID' NOT NULL,
	"return_policy" text,
	"shipping_policy" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"vacation_mode" boolean DEFAULT false NOT NULL,
	"vacation_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_owner_user_id_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "storefront_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- §2.5c storefront_custom_category
CREATE TABLE "storefront_custom_category" (
	"id" text PRIMARY KEY NOT NULL,
	"storefront_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §2.5d storefront_page
CREATE TABLE "storefront_page" (
	"id" text PRIMARY KEY NOT NULL,
	"storefront_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"puck_data" jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §18.1 finance_subscription
CREATE TABLE "finance_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"tier" "finance_tier" NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"pending_tier" "finance_tier",
	"pending_billing_interval" text,
	"pending_change_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_subscription_seller_profile_id_unique" UNIQUE("seller_profile_id"),
	CONSTRAINT "finance_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint

-- §18.2 expense
CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"vendor" text,
	"description" text,
	"receipt_url" text,
	"receipt_data_json" jsonb,
	"expense_date" timestamp with time zone NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_frequency" text,
	"recurring_end_date" timestamp with time zone,
	"parent_expense_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §18.3 mileage_entry
CREATE TABLE "mileage_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"description" text NOT NULL,
	"miles" real NOT NULL,
	"rate_per_mile" real NOT NULL,
	"deduction_cents" integer NOT NULL,
	"trip_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §18.4 financial_report
CREATE TABLE "financial_report" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"report_type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"format" text NOT NULL,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §18.5 accounting_integration
CREATE TABLE "accounting_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"external_account_id" text,
	"last_sync_at" timestamp with time zone,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_integration_user_id_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint

-- §13.3 stripe_event_log
CREATE TABLE "stripe_event_log" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_event_log_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint

-- §13.4 buyer_protection_claim
CREATE TABLE "buyer_protection_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"claim_type" "claim_type" NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"claim_amount_cents" integer NOT NULL,
	"approved_amount_cents" integer,
	"evidence_json" jsonb DEFAULT '[]' NOT NULL,
	"resolution_note" text,
	"resolved_by_staff_id" text,
	"resolved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §13.5 seller_score_snapshot
CREATE TABLE "seller_score_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"overall_score" real NOT NULL,
	"component_scores_json" jsonb NOT NULL,
	"performance_band" "performance_band" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"order_count" integer NOT NULL,
	"defect_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §8.4 buyer_review
CREATE TABLE "buyer_review" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"seller_user_id" text NOT NULL,
	"buyer_user_id" text NOT NULL,
	"rating_payment" integer NOT NULL,
	"rating_communication" integer NOT NULL,
	"rating_return_behavior" integer,
	"overall_rating" integer NOT NULL,
	"note" text,
	"status" "review_status" DEFAULT 'APPROVED' NOT NULL,
	"visible_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_review_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint

-- §5.3b watcher_offer
CREATE TABLE "watcher_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"discounted_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"watchers_notified_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §5.3c offer_bundle_item
CREATE TABLE "offer_bundle_item" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §15.4 promoted_listing_event
CREATE TABLE "promoted_listing_event" (
	"id" text PRIMARY KEY NOT NULL,
	"promoted_listing_id" text NOT NULL,
	"event_type" text NOT NULL,
	"order_id" text,
	"fee_cents" integer,
	"attribution_window" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §16.3 browsing_history
CREATE TABLE "browsing_history" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"category_id" text,
	"seller_id" text,
	"view_count" integer DEFAULT 1 NOT NULL,
	"total_duration_sec" integer DEFAULT 0 NOT NULL,
	"last_view_duration_sec" integer DEFAULT 0 NOT NULL,
	"did_add_to_cart" boolean DEFAULT false NOT NULL,
	"did_add_to_watchlist" boolean DEFAULT false NOT NULL,
	"did_make_offer" boolean DEFAULT false NOT NULL,
	"did_purchase" boolean DEFAULT false NOT NULL,
	"did_set_price_alert" boolean DEFAULT false NOT NULL,
	"source_type" text,
	"search_query" text,
	"first_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §20.5 buyer_block_list
CREATE TABLE "buyer_block_list" (
	"id" text PRIMARY KEY NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- safe_meetup_location
CREATE TABLE "safe_meetup_location" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"type" text NOT NULL,
	"verified_safe" boolean DEFAULT false NOT NULL,
	"operating_hours_json" jsonb,
	"meetup_count" integer DEFAULT 0 NOT NULL,
	"rating" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"added_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- local_transaction
CREATE TABLE "local_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"meetup_location_id" text,
	"status" "local_transaction_status" DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"confirmation_code" text NOT NULL,
	"offline_code" text NOT NULL,
	"confirmation_method" text,
	"seller_checked_in" boolean DEFAULT false NOT NULL,
	"seller_checked_in_at" timestamp with time zone,
	"buyer_checked_in" boolean DEFAULT false NOT NULL,
	"buyer_checked_in_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"offline_confirmed_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"safety_alert_sent" boolean DEFAULT false NOT NULL,
	"safety_alert_at" timestamp with time zone,
	"no_show_party" text,
	"no_show_fee_cents" integer,
	"no_show_fee_charged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_transaction_confirmation_code_unique" UNIQUE("confirmation_code")
);
--> statement-breakpoint

-- combined_shipping_quote
CREATE TABLE "combined_shipping_quote" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"status" text NOT NULL,
	"max_shipping_cents" integer NOT NULL,
	"quoted_shipping_cents" integer,
	"penalty_applied" boolean DEFAULT false NOT NULL,
	"penalty_discount_percent" real,
	"final_shipping_cents" integer,
	"savings_cents" integer,
	"seller_deadline" timestamp with time zone NOT NULL,
	"seller_quoted_at" timestamp with time zone,
	"buyer_responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- authenticator_partner
CREATE TABLE "authenticator_partner" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"specialties" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"accuracy_rate" real,
	"avg_turnaround_hours" real,
	"payout_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- authentication_request
CREATE TABLE "authentication_request" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"order_id" text,
	"seller_id" text NOT NULL,
	"buyer_id" text,
	"initiator" text NOT NULL,
	"tier" text NOT NULL,
	"status" "authentication_status" NOT NULL,
	"total_fee_cents" integer NOT NULL,
	"buyer_fee_cents" integer,
	"seller_fee_cents" integer,
	"refunded_buyer_cents" integer DEFAULT 0 NOT NULL,
	"provider_ref" text,
	"authenticator_id" text,
	"certificate_number" text,
	"certificate_url" text,
	"verify_url" text,
	"photos_hash" text,
	"photo_urls" text[],
	"result_json" jsonb,
	"result_notes" text,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authentication_request_certificate_number_unique" UNIQUE("certificate_number")
);
--> statement-breakpoint

-- price_alert
CREATE TABLE "price_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text,
	"alert_type" text NOT NULL,
	"target_price_cents" integer,
	"percent_drop" real,
	"price_cents_at_creation" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- category_alert
CREATE TABLE "category_alert" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category_id" text NOT NULL,
	"filters_json" jsonb DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §20.6 market_price_point
CREATE TABLE "market_price_point" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"category_id" text NOT NULL,
	"brand" text,
	"condition_bucket" text,
	"price_cents" integer NOT NULL,
	"shipping_cents" integer,
	"sold_at" timestamp with time zone NOT NULL,
	"days_to_sell" integer,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §20.7 market_category_summary
CREATE TABLE "market_category_summary" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"brand" text,
	"condition_bucket" text,
	"period_type" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"sample_size" integer NOT NULL,
	"median_price_cents" integer NOT NULL,
	"avg_price_cents" integer NOT NULL,
	"p25_price_cents" integer NOT NULL,
	"p75_price_cents" integer NOT NULL,
	"min_price_cents" integer NOT NULL,
	"max_price_cents" integer NOT NULL,
	"avg_days_to_sell" integer,
	"median_days_to_sell" integer,
	"sell_through_rate" real,
	"total_sold_count" integer NOT NULL,
	"total_gmv_cents" bigint NOT NULL,
	"price_change_pct" real,
	"volume_change_pct" real,
	"data_sources_json" jsonb DEFAULT '{}' NOT NULL,
	"confidence" text NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcs_unique_dim_period" UNIQUE("category_id","condition_bucket","brand","period_type","period_start")
);
--> statement-breakpoint

-- §20.8 market_listing_intelligence
CREATE TABLE "market_listing_intelligence" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"category_id" text NOT NULL,
	"market_median_cents" integer,
	"market_low_cents" integer,
	"market_high_cents" integer,
	"sweet_spot_low_cents" integer,
	"sweet_spot_high_cents" integer,
	"sample_size" integer NOT NULL,
	"estimated_days_to_sell" integer,
	"category_avg_days" integer,
	"health_signal" text,
	"health_nudge_text" text,
	"best_platform" text,
	"best_platform_reason" text,
	"platform_prices_json" jsonb,
	"data_sources_json" jsonb,
	"computed_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §20.9 market_offer_intelligence
CREATE TABLE "market_offer_intelligence" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"condition_bucket" text,
	"price_bucket_cents" integer,
	"avg_accepted_pct_of_ask" real,
	"median_accepted_pct_of_ask" real,
	"acceptance_rate" real,
	"counter_rate" real,
	"avg_counter_pct_of_ask" real,
	"sample_size" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §21.1 affiliate
CREATE TABLE "affiliate" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tier" "affiliate_tier" DEFAULT 'COMMUNITY' NOT NULL,
	"status" "affiliate_status" DEFAULT 'ACTIVE' NOT NULL,
	"referral_code" text NOT NULL,
	"commission_rate_bps" integer NOT NULL,
	"cookie_duration_days" integer DEFAULT 30 NOT NULL,
	"commission_duration_months" integer DEFAULT 12 NOT NULL,
	"payout_method" text,
	"payout_email" text,
	"stripe_connect_account_id" text,
	"tax_info_provided" boolean DEFAULT false NOT NULL,
	"pending_balance_cents" integer DEFAULT 0 NOT NULL,
	"available_balance_cents" integer DEFAULT 0 NOT NULL,
	"total_earned_cents" integer DEFAULT 0 NOT NULL,
	"total_paid_cents" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"application_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "affiliate_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint

-- §21.3 promo_code (defined before referral since referral references it)
CREATE TABLE "promo_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" "promo_code_type" NOT NULL,
	"affiliate_id" text,
	"discount_type" "promo_discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"duration_months" integer DEFAULT 1 NOT NULL,
	"scope_product_types" jsonb,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint

-- §21.2 referral
CREATE TABLE "referral" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"referred_user_id" text,
	"status" "referral_status" DEFAULT 'CLICKED' NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signed_up_at" timestamp with time zone,
	"trial_started_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"churned_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"promo_code_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §21.4 promo_code_redemption
CREATE TABLE "promo_code_redemption" (
	"id" text PRIMARY KEY NOT NULL,
	"promo_code_id" text NOT NULL,
	"user_id" text NOT NULL,
	"subscription_product" text NOT NULL,
	"discount_applied_cents" integer NOT NULL,
	"months_remaining" integer NOT NULL,
	"stripe_promotion_code_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_code_redemption_promo_code_id_user_id_subscription_product_unique" UNIQUE("promo_code_id","user_id","subscription_product")
);
--> statement-breakpoint

-- §21.5 affiliate_commission
CREATE TABLE "affiliate_commission" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"referral_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"subscription_product" text NOT NULL,
	"gross_revenue_cents" integer NOT NULL,
	"net_revenue_cents" integer NOT NULL,
	"commission_rate_bps" integer NOT NULL,
	"commission_cents" integer NOT NULL,
	"status" "commission_status" DEFAULT 'PENDING' NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §21.6 affiliate_payout
CREATE TABLE "affiliate_payout" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text NOT NULL,
	"external_payout_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint

-- interest_tag
CREATE TABLE "interest_tag" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"group" varchar(50) NOT NULL,
	"image_url" varchar(500),
	"description" varchar(200),
	"category_ids" text[],
	"attributes" jsonb,
	"card_emphasis" varchar(50) DEFAULT 'default' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "interest_tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- user_interest
CREATE TABLE "user_interest" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tag_slug" varchar(50) NOT NULL,
	"weight" decimal(6, 3) DEFAULT '1.0' NOT NULL,
	"source" "interest_source" NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §23.1 google_category_mapping
CREATE TABLE "google_category_mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"twicely_category_id" text NOT NULL,
	"google_category_id" integer NOT NULL,
	"google_category_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_category_mapping_twicely_category_id_unique" UNIQUE("twicely_category_id")
);
--> statement-breakpoint

-- §23.2 buyer_referral
CREATE TABLE "buyer_referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referred_user_id" text,
	"referral_code" text NOT NULL,
	"status" "buyer_referral_status" DEFAULT 'PENDING' NOT NULL,
	"referrer_credit_cents" integer,
	"referred_credit_cents" integer,
	"qualifying_order_id" text,
	"referred_ip" text,
	"referred_device_hash" text,
	"clicked_at" timestamp with time zone,
	"signed_up_at" timestamp with time zone,
	"redeemed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_referral_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint

-- §24.1 listing_question
CREATE TABLE "listing_question" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"asker_id" text NOT NULL,
	"question_text" text NOT NULL,
	"answer_text" text,
	"answered_at" timestamp with time zone,
	"answered_by" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §24.2 curated_collection
CREATE TABLE "curated_collection" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"cover_image_url" text,
	"curated_by" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curated_collection_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

-- §24.3 curated_collection_item
CREATE TABLE "curated_collection_item" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §24.5 live_session
CREATE TABLE "live_session" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "live_session_status" DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"viewer_count" integer DEFAULT 0 NOT NULL,
	"peak_viewer_count" integer DEFAULT 0 NOT NULL,
	"stream_url" text,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- §24.6 live_session_product
CREATE TABLE "live_session_product" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"featured_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ============================================================
-- SECTION 3: ALTER TABLE — Add columns to existing tables
-- ============================================================

-- listing table: 8 new columns
ALTER TABLE "listing" ADD COLUMN "storefront_category_id" text;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "sold_price_cents" integer;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "offer_expiry_hours" integer;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "fulfillment_type" "fulfillment_type" DEFAULT 'SHIP_ONLY' NOT NULL;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "local_pickup_radius_miles" integer;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "video_url" text;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "video_thumb_url" text;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "video_duration_seconds" integer;
--> statement-breakpoint

-- seller_profile table: 14 new columns
ALTER TABLE "seller_profile" ADD COLUMN "finance_tier" "finance_tier" DEFAULT 'FREE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "trial_lister_used" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "trial_store_used" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "trial_automation_used" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "trial_finance_used" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "banner_url" text;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "logo_url" text;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "accent_color" text;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "announcement" text;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "about_html" text;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "social_links" jsonb DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "featured_listing_ids" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "is_store_published" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "default_store_view" text DEFAULT 'grid' NOT NULL;
--> statement-breakpoint

-- ============================================================
-- SECTION 4: Foreign Key Constraints
-- ============================================================

-- storefront FKs
ALTER TABLE "storefront" ADD CONSTRAINT "storefront_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- storefront_custom_category FKs
ALTER TABLE "storefront_custom_category" ADD CONSTRAINT "storefront_custom_category_storefront_id_storefront_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefront"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- storefront_page FKs
ALTER TABLE "storefront_page" ADD CONSTRAINT "storefront_page_storefront_id_storefront_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefront"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- finance_subscription FKs
ALTER TABLE "finance_subscription" ADD CONSTRAINT "finance_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON UPDATE no action;
--> statement-breakpoint

-- expense FKs
ALTER TABLE "expense" ADD CONSTRAINT "expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- mileage_entry FKs
ALTER TABLE "mileage_entry" ADD CONSTRAINT "mileage_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- financial_report FKs
ALTER TABLE "financial_report" ADD CONSTRAINT "financial_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- accounting_integration FKs
ALTER TABLE "accounting_integration" ADD CONSTRAINT "accounting_integration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- stripe_event_log: no FKs

-- buyer_protection_claim FKs
ALTER TABLE "buyer_protection_claim" ADD CONSTRAINT "buyer_protection_claim_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "buyer_protection_claim" ADD CONSTRAINT "buyer_protection_claim_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- seller_score_snapshot: no FKs (seller_profile_id stored as text reference)

-- buyer_review FKs
ALTER TABLE "buyer_review" ADD CONSTRAINT "buyer_review_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "buyer_review" ADD CONSTRAINT "buyer_review_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "buyer_review" ADD CONSTRAINT "buyer_review_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- watcher_offer FKs
ALTER TABLE "watcher_offer" ADD CONSTRAINT "watcher_offer_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- offer_bundle_item FKs
ALTER TABLE "offer_bundle_item" ADD CONSTRAINT "offer_bundle_item_offer_id_listing_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."listing_offer"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "offer_bundle_item" ADD CONSTRAINT "offer_bundle_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON UPDATE no action;
--> statement-breakpoint

-- promoted_listing_event FKs
ALTER TABLE "promoted_listing_event" ADD CONSTRAINT "promoted_listing_event_promoted_listing_id_promoted_listing_id_fk" FOREIGN KEY ("promoted_listing_id") REFERENCES "public"."promoted_listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- browsing_history FKs
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON UPDATE no action;
--> statement-breakpoint

-- buyer_block_list FKs
ALTER TABLE "buyer_block_list" ADD CONSTRAINT "buyer_block_list_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "buyer_block_list" ADD CONSTRAINT "buyer_block_list_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- local_transaction FKs
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_meetup_location_id_safe_meetup_location_id_fk" FOREIGN KEY ("meetup_location_id") REFERENCES "public"."safe_meetup_location"("id") ON UPDATE no action;
--> statement-breakpoint

-- combined_shipping_quote FKs
ALTER TABLE "combined_shipping_quote" ADD CONSTRAINT "combined_shipping_quote_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combined_shipping_quote" ADD CONSTRAINT "combined_shipping_quote_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combined_shipping_quote" ADD CONSTRAINT "combined_shipping_quote_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- authentication_request FKs
ALTER TABLE "authentication_request" ADD CONSTRAINT "authentication_request_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "authentication_request" ADD CONSTRAINT "authentication_request_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "authentication_request" ADD CONSTRAINT "authentication_request_authenticator_id_authenticator_partner_id_fk" FOREIGN KEY ("authenticator_id") REFERENCES "public"."authenticator_partner"("id") ON UPDATE no action;
--> statement-breakpoint

-- price_alert FKs
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- category_alert FKs
ALTER TABLE "category_alert" ADD CONSTRAINT "category_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "category_alert" ADD CONSTRAINT "category_alert_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON UPDATE no action;
--> statement-breakpoint

-- market_price_point FKs
ALTER TABLE "market_price_point" ADD CONSTRAINT "market_price_point_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON UPDATE no action;
--> statement-breakpoint

-- market_category_summary FKs
ALTER TABLE "market_category_summary" ADD CONSTRAINT "market_category_summary_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON UPDATE no action;
--> statement-breakpoint

-- market_listing_intelligence FKs
ALTER TABLE "market_listing_intelligence" ADD CONSTRAINT "market_listing_intelligence_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- market_offer_intelligence FKs
ALTER TABLE "market_offer_intelligence" ADD CONSTRAINT "market_offer_intelligence_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON UPDATE no action;
--> statement-breakpoint

-- affiliate FKs
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- promo_code FKs
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON UPDATE no action;
--> statement-breakpoint

-- referral FKs
ALTER TABLE "referral" ADD CONSTRAINT "referral_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_promo_code_id_promo_code_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_code"("id") ON UPDATE no action;
--> statement-breakpoint

-- promo_code_redemption FKs
ALTER TABLE "promo_code_redemption" ADD CONSTRAINT "promo_code_redemption_promo_code_id_promo_code_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_code"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "promo_code_redemption" ADD CONSTRAINT "promo_code_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- affiliate_commission FKs
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON UPDATE no action;
--> statement-breakpoint

-- affiliate_payout FKs
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON UPDATE no action;
--> statement-breakpoint

-- user_interest FKs
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_tag_slug_interest_tag_slug_fk" FOREIGN KEY ("tag_slug") REFERENCES "public"."interest_tag"("slug") ON UPDATE no action;
--> statement-breakpoint

-- google_category_mapping FKs
ALTER TABLE "google_category_mapping" ADD CONSTRAINT "google_category_mapping_twicely_category_id_category_id_fk" FOREIGN KEY ("twicely_category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- buyer_referral FKs
ALTER TABLE "buyer_referral" ADD CONSTRAINT "buyer_referral_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "buyer_referral" ADD CONSTRAINT "buyer_referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- listing_question FKs
ALTER TABLE "listing_question" ADD CONSTRAINT "listing_question_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_question" ADD CONSTRAINT "listing_question_asker_id_user_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "listing_question" ADD CONSTRAINT "listing_question_answered_by_user_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- curated_collection FKs
ALTER TABLE "curated_collection" ADD CONSTRAINT "curated_collection_curated_by_user_id_fk" FOREIGN KEY ("curated_by") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- curated_collection_item FKs
ALTER TABLE "curated_collection_item" ADD CONSTRAINT "curated_collection_item_collection_id_curated_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."curated_collection"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curated_collection_item" ADD CONSTRAINT "curated_collection_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "curated_collection_item" ADD CONSTRAINT "curated_collection_item_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON UPDATE no action;
--> statement-breakpoint

-- live_session FKs
ALTER TABLE "live_session" ADD CONSTRAINT "live_session_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- live_session_product FKs
ALTER TABLE "live_session_product" ADD CONSTRAINT "live_session_product_session_id_live_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_session"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "live_session_product" ADD CONSTRAINT "live_session_product_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- listing.storefront_category_id FK (added after storefront_custom_category table exists)
ALTER TABLE "listing" ADD CONSTRAINT "listing_storefront_category_id_storefront_custom_category_id_fk" FOREIGN KEY ("storefront_category_id") REFERENCES "public"."storefront_custom_category"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- ============================================================
-- SECTION 5: Indexes
-- ============================================================

-- storefront indexes
CREATE INDEX "sf_owner" ON "storefront" USING btree ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "sf_slug" ON "storefront" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "sf_published" ON "storefront" USING btree ("is_published");
--> statement-breakpoint

-- storefront_custom_category indexes
CREATE INDEX "scc_storefront" ON "storefront_custom_category" USING btree ("storefront_id");
--> statement-breakpoint
CREATE INDEX "scc_sort" ON "storefront_custom_category" USING btree ("storefront_id","sort_order");
--> statement-breakpoint

-- storefront_page indexes
CREATE INDEX "sfp_storefront" ON "storefront_page" USING btree ("storefront_id");
--> statement-breakpoint
CREATE INDEX "sfp_sort" ON "storefront_page" USING btree ("storefront_id","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "sfp_unique_slug" ON "storefront_page" USING btree ("storefront_id","slug");
--> statement-breakpoint

-- expense indexes
CREATE INDEX "exp_user_date" ON "expense" USING btree ("user_id","expense_date");
--> statement-breakpoint
CREATE INDEX "exp_user_cat" ON "expense" USING btree ("user_id","category");
--> statement-breakpoint

-- mileage_entry indexes
CREATE INDEX "mi_user_date" ON "mileage_entry" USING btree ("user_id","trip_date");
--> statement-breakpoint

-- financial_report indexes
CREATE INDEX "fr_user_type" ON "financial_report" USING btree ("user_id","report_type");
--> statement-breakpoint

-- stripe_event_log indexes
CREATE INDEX "sel_stripe_event" ON "stripe_event_log" USING btree ("stripe_event_id");
--> statement-breakpoint
CREATE INDEX "sel_status" ON "stripe_event_log" USING btree ("processing_status");
--> statement-breakpoint
CREATE INDEX "sel_event_type" ON "stripe_event_log" USING btree ("event_type","created_at");
--> statement-breakpoint

-- buyer_protection_claim indexes
CREATE INDEX "bpc_order" ON "buyer_protection_claim" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "bpc_buyer" ON "buyer_protection_claim" USING btree ("buyer_id");
--> statement-breakpoint
CREATE INDEX "bpc_status" ON "buyer_protection_claim" USING btree ("status");
--> statement-breakpoint

-- seller_score_snapshot indexes
CREATE INDEX "sss_seller_period" ON "seller_score_snapshot" USING btree ("seller_profile_id","period_start");
--> statement-breakpoint

-- buyer_review indexes
CREATE INDEX "br_buyer" ON "buyer_review" USING btree ("buyer_user_id");
--> statement-breakpoint
CREATE INDEX "br_seller" ON "buyer_review" USING btree ("seller_user_id");
--> statement-breakpoint
CREATE INDEX "br_order" ON "buyer_review" USING btree ("order_id");
--> statement-breakpoint

-- watcher_offer indexes
CREATE INDEX "wo_listing" ON "watcher_offer" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "wo_seller" ON "watcher_offer" USING btree ("seller_id");
--> statement-breakpoint
CREATE INDEX "wo_expires" ON "watcher_offer" USING btree ("expires_at");
--> statement-breakpoint

-- offer_bundle_item indexes
CREATE INDEX "obi_offer" ON "offer_bundle_item" USING btree ("offer_id");
--> statement-breakpoint
CREATE INDEX "obi_listing" ON "offer_bundle_item" USING btree ("listing_id");
--> statement-breakpoint

-- promoted_listing_event indexes
CREATE INDEX "ple_promoted" ON "promoted_listing_event" USING btree ("promoted_listing_id","event_type");
--> statement-breakpoint
CREATE INDEX "ple_event_type" ON "promoted_listing_event" USING btree ("event_type","created_at");
--> statement-breakpoint

-- browsing_history indexes
CREATE UNIQUE INDEX "bh_user_listing" ON "browsing_history" USING btree ("user_id","listing_id");
--> statement-breakpoint
CREATE INDEX "bh_user_viewed" ON "browsing_history" USING btree ("user_id","last_viewed_at");
--> statement-breakpoint

-- buyer_block_list indexes
CREATE INDEX "bbl_blocker" ON "buyer_block_list" USING btree ("blocker_id");
--> statement-breakpoint
CREATE INDEX "bbl_blocked" ON "buyer_block_list" USING btree ("blocked_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "bbl_unique_pair" ON "buyer_block_list" USING btree ("blocker_id","blocked_id");
--> statement-breakpoint

-- safe_meetup_location indexes
CREATE INDEX "sml_city" ON "safe_meetup_location" USING btree ("city","state");
--> statement-breakpoint
CREATE INDEX "sml_geo" ON "safe_meetup_location" USING btree ("latitude","longitude");
--> statement-breakpoint

-- local_transaction indexes
CREATE INDEX "lt_order" ON "local_transaction" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "lt_buyer" ON "local_transaction" USING btree ("buyer_id");
--> statement-breakpoint
CREATE INDEX "lt_seller" ON "local_transaction" USING btree ("seller_id");
--> statement-breakpoint
CREATE INDEX "lt_status" ON "local_transaction" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "lt_confirm" ON "local_transaction" USING btree ("confirmation_code");
--> statement-breakpoint

-- combined_shipping_quote indexes
CREATE INDEX "csq_order" ON "combined_shipping_quote" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "csq_deadline" ON "combined_shipping_quote" USING btree ("seller_deadline","status");
--> statement-breakpoint

-- authentication_request indexes
CREATE INDEX "ar_listing" ON "authentication_request" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "ar_seller" ON "authentication_request" USING btree ("seller_id");
--> statement-breakpoint
CREATE INDEX "ar_cert" ON "authentication_request" USING btree ("certificate_number");
--> statement-breakpoint
CREATE INDEX "ar_status" ON "authentication_request" USING btree ("status");
--> statement-breakpoint

-- price_alert indexes
CREATE INDEX "pa_user" ON "price_alert" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "pa_listing" ON "price_alert" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "pa_active" ON "price_alert" USING btree ("is_active","listing_id");
--> statement-breakpoint

-- category_alert indexes
CREATE INDEX "ca_user" ON "category_alert" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "ca_category" ON "category_alert" USING btree ("category_id");
--> statement-breakpoint

-- market_price_point indexes
CREATE INDEX "mpp_cat_cond_brand_sold" ON "market_price_point" USING btree ("category_id","condition_bucket","brand","sold_at");
--> statement-breakpoint
CREATE INDEX "mpp_sold_at" ON "market_price_point" USING btree ("sold_at");
--> statement-breakpoint
CREATE INDEX "mpp_source" ON "market_price_point" USING btree ("source");
--> statement-breakpoint

-- market_category_summary indexes
CREATE INDEX "mcs_cat_period" ON "market_category_summary" USING btree ("category_id","period_type","period_start");
--> statement-breakpoint
CREATE INDEX "mcs_brand" ON "market_category_summary" USING btree ("brand");
--> statement-breakpoint

-- market_listing_intelligence indexes
CREATE INDEX "mli_listing" ON "market_listing_intelligence" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "mli_expires" ON "market_listing_intelligence" USING btree ("expires_at");
--> statement-breakpoint

-- market_offer_intelligence indexes
CREATE INDEX "moi_cat_cond" ON "market_offer_intelligence" USING btree ("category_id","condition_bucket");
--> statement-breakpoint
CREATE INDEX "moi_price_bucket" ON "market_offer_intelligence" USING btree ("price_bucket_cents");
--> statement-breakpoint

-- affiliate indexes
CREATE INDEX "aff_user" ON "affiliate" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "aff_status" ON "affiliate" USING btree ("status");
--> statement-breakpoint

-- promo_code indexes
CREATE INDEX "pc_affiliate" ON "promo_code" USING btree ("affiliate_id");
--> statement-breakpoint
CREATE INDEX "pc_type" ON "promo_code" USING btree ("type");
--> statement-breakpoint

-- referral indexes
CREATE INDEX "ref_affiliate" ON "referral" USING btree ("affiliate_id");
--> statement-breakpoint
CREATE INDEX "ref_referred" ON "referral" USING btree ("referred_user_id");
--> statement-breakpoint
CREATE INDEX "ref_status" ON "referral" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "ref_expires" ON "referral" USING btree ("expires_at");
--> statement-breakpoint

-- promo_code_redemption indexes
CREATE INDEX "pcr_promo" ON "promo_code_redemption" USING btree ("promo_code_id");
--> statement-breakpoint
CREATE INDEX "pcr_user" ON "promo_code_redemption" USING btree ("user_id");
--> statement-breakpoint

-- affiliate_commission indexes
CREATE INDEX "ac_affiliate" ON "affiliate_commission" USING btree ("affiliate_id","status");
--> statement-breakpoint
CREATE INDEX "ac_referral" ON "affiliate_commission" USING btree ("referral_id");
--> statement-breakpoint
CREATE INDEX "ac_hold" ON "affiliate_commission" USING btree ("hold_expires_at");
--> statement-breakpoint
CREATE INDEX "ac_invoice" ON "affiliate_commission" USING btree ("invoice_id");
--> statement-breakpoint

-- affiliate_payout indexes
CREATE INDEX "ap_affiliate" ON "affiliate_payout" USING btree ("affiliate_id");
--> statement-breakpoint
CREATE INDEX "ap_status" ON "affiliate_payout" USING btree ("status");
--> statement-breakpoint

-- interest_tag indexes
CREATE INDEX "idx_interest_tag_group" ON "interest_tag" USING btree ("group");
--> statement-breakpoint

-- user_interest indexes
CREATE UNIQUE INDEX "idx_user_interest_unique" ON "user_interest" USING btree ("user_id","tag_slug","source");
--> statement-breakpoint
CREATE INDEX "idx_user_interest_user_id" ON "user_interest" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_user_interest_expires_at" ON "user_interest" USING btree ("expires_at");
--> statement-breakpoint

-- buyer_referral indexes
CREATE INDEX "br_referrer" ON "buyer_referral" USING btree ("referrer_user_id");
--> statement-breakpoint
CREATE INDEX "br_referred" ON "buyer_referral" USING btree ("referred_user_id");
--> statement-breakpoint
CREATE INDEX "br_status" ON "buyer_referral" USING btree ("status");
--> statement-breakpoint

-- listing_question indexes
CREATE INDEX "lq_listing" ON "listing_question" USING btree ("listing_id");
--> statement-breakpoint
CREATE INDEX "lq_asker" ON "listing_question" USING btree ("asker_id");
--> statement-breakpoint
CREATE INDEX "lq_pinned" ON "listing_question" USING btree ("listing_id","is_pinned");
--> statement-breakpoint

-- curated_collection indexes
CREATE INDEX "cc_slug" ON "curated_collection" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "cc_published" ON "curated_collection" USING btree ("is_published","sort_order");
--> statement-breakpoint

-- curated_collection_item indexes
CREATE INDEX "cci_collection" ON "curated_collection_item" USING btree ("collection_id","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "cci_unique_item" ON "curated_collection_item" USING btree ("collection_id","listing_id");
--> statement-breakpoint

-- live_session indexes
CREATE INDEX "ls_seller" ON "live_session" USING btree ("seller_id");
--> statement-breakpoint
CREATE INDEX "ls_status" ON "live_session" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "ls_scheduled" ON "live_session" USING btree ("scheduled_at");
--> statement-breakpoint

-- live_session_product indexes
CREATE INDEX "lsp_session" ON "live_session_product" USING btree ("session_id","sort_order");
--> statement-breakpoint
CREATE UNIQUE INDEX "lsp_unique_item" ON "live_session_product" USING btree ("session_id","listing_id");
--> statement-breakpoint

-- listing new column indexes
CREATE INDEX "lst_storefront_cat" ON "listing" USING btree ("storefront_category_id");
