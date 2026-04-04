-- Reconcile schema objects present in the current Drizzle schema but missing from the checked-in migration history.
-- This migration is intentionally idempotent so it can repair drifted environments before baselining Drizzle history.

DO $$ BEGIN
  CREATE TYPE "public"."confirmation_mode" AS ENUM('QR_ONLINE', 'QR_DUAL_OFFLINE', 'CODE_ONLINE', 'CODE_DUAL_OFFLINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."credit_type" AS ENUM('MONTHLY', 'OVERAGE', 'BONUS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."local_reliability_event_type" AS ENUM('BUYER_CANCEL_GRACEFUL', 'BUYER_CANCEL_LATE', 'BUYER_CANCEL_SAMEDAY', 'BUYER_NOSHOW', 'SELLER_CANCEL_GRACEFUL', 'SELLER_CANCEL_LATE', 'SELLER_CANCEL_SAMEDAY', 'SELLER_NOSHOW', 'SELLER_DARK', 'RESCHEDULE_EXCESS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."module_state" AS ENUM('ENABLED', 'DISABLED', 'BETA', 'DEPRECATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."poll_tier" AS ENUM('HOT', 'WARM', 'COLD', 'LONGTAIL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ai_autofill_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month_key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_autofill_usage_user_id_month_key_unique" UNIQUE("user_id","month_key")
);

CREATE TABLE IF NOT EXISTS "local_reliability_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"event_type" "local_reliability_event_type" NOT NULL,
	"marks_applied" integer NOT NULL,
	"decays_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "module_registry" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"state" "module_state" DEFAULT 'DISABLED' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"config_path" text,
	"manifest_json" jsonb DEFAULT '{}' NOT NULL,
	"installed_by_staff_id" text,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_registry_module_id_unique" UNIQUE("module_id")
);

CREATE TABLE IF NOT EXISTS "publish_credit_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credit_type" "credit_type" NOT NULL,
	"total_credits" integer NOT NULL,
	"used_credits" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"lister_subscription_id" text,
	"stripe_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "trial_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_type" text NOT NULL,
	"trial_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ended_at" timestamp with time zone,
	"converted_to_subscription" boolean DEFAULT false NOT NULL,
	"stripe_subscription_id" text
);

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "anonymized_at" timestamp with time zone;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "completed_purchase_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "credit_balance_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "local_completion_rate" real;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "local_reliability_marks" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "local_suspended_until" timestamp with time zone;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "local_transaction_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "referred_by_affiliate_id" text;

ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "affiliate_commission_bps" integer;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "affiliate_opt_in" boolean DEFAULT true NOT NULL;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "band_override" "performance_band";
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "band_override_by" text;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "band_override_expires_at" timestamp with time zone;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "band_override_reason" text;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "boost_credit_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "enforcement_started_at" timestamp with time zone;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "is_new" boolean DEFAULT true NOT NULL;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "lister_free_expires_at" timestamp with time zone;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "max_meetup_distance_miles" integer;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "payout_frequency" text DEFAULT 'WEEKLY' NOT NULL;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "seller_score_updated_at" timestamp with time zone;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "vacation_mode_type" text;
ALTER TABLE "seller_profile" ADD COLUMN IF NOT EXISTS "warning_expires_at" timestamp with time zone;

ALTER TABLE "listing" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;

ALTER TABLE "listing_offer" ADD COLUMN IF NOT EXISTS "counter_by_role" text;
ALTER TABLE "listing_offer" ADD COLUMN IF NOT EXISTS "parent_offer_id" text;
ALTER TABLE "listing_offer" ADD COLUMN IF NOT EXISTS "shipping_address_id" text;
ALTER TABLE "listing_offer" ADD COLUMN IF NOT EXISTS "type" "offer_type" DEFAULT 'BEST_OFFER' NOT NULL;

ALTER TABLE "listing_price_history" ADD COLUMN IF NOT EXISTS "change_reason" text NOT NULL;
ALTER TABLE "listing_price_history" ADD COLUMN IF NOT EXISTS "changed_by_user_id" text;
ALTER TABLE "listing_price_history" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "listing_price_history" ADD COLUMN IF NOT EXISTS "previous_cents" integer;

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "authentication_declined" boolean DEFAULT false NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "authentication_declined_at" timestamp with time zone;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "authentication_offered" boolean DEFAULT false NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "authentication_request_id" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "combined_shipping_quote_id" text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "is_local_pickup" boolean DEFAULT false NOT NULL;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "local_transaction_id" text;

ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "tf_amount_cents" integer;
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "tf_rate_bps" integer;

ALTER TABLE "order_payment" ADD COLUMN IF NOT EXISTS "boost_rate_bps" integer;
ALTER TABLE "order_payment" ADD COLUMN IF NOT EXISTS "tf_amount_cents" integer;
ALTER TABLE "order_payment" ADD COLUMN IF NOT EXISTS "tf_rate_bps" integer;

ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "dsr_communication" integer;
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "dsr_item_as_described" integer;
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "dsr_packaging" integer;
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "dsr_shipping_speed" integer;
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "visible_at" timestamp with time zone;

ALTER TABLE "fee_schedule" ADD COLUMN IF NOT EXISTS "tf_rate_bps" integer NOT NULL;

ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "fee_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "is_instant" boolean DEFAULT false NOT NULL;

ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "snapshot_date" date;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "search_multiplier" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "on_time_shipping_pct" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "inad_claim_rate_pct" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "review_average" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "response_time_hours" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "return_rate_pct" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "cancellation_rate_pct" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "shipping_score" integer;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "inad_score" integer;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "review_score" integer;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "response_score" integer;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "return_score" integer;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "cancellation_score" integer;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "primary_fee_bucket" text;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "trend_modifier" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "bayesian_smoothing" real;
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "previous_band" "performance_band";
ALTER TABLE "seller_score_snapshot" ADD COLUMN IF NOT EXISTS "band_changed_at" timestamp with time zone;

ALTER TABLE "channel_projection" ADD COLUMN IF NOT EXISTS "last_polled_at" timestamp with time zone;
ALTER TABLE "channel_projection" ADD COLUMN IF NOT EXISTS "next_poll_at" timestamp with time zone;
ALTER TABLE "channel_projection" ADD COLUMN IF NOT EXISTS "orphaned_at" timestamp with time zone;
ALTER TABLE "channel_projection" ADD COLUMN IF NOT EXISTS "poll_tier" "poll_tier" DEFAULT 'COLD' NOT NULL;
ALTER TABLE "channel_projection" ADD COLUMN IF NOT EXISTS "pre_poll_tier" "poll_tier";
ALTER TABLE "channel_projection" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'MANUAL' NOT NULL;

ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "adjusted_price_cents" integer;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "adjustment_accepted_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "adjustment_declined_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "adjustment_initiated_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "adjustment_reason" text;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "buyer_confirmation_code" text NOT NULL;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "buyer_offline_code" text NOT NULL;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "confirmation_mode" "confirmation_mode";
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "day_of_confirmation_expired" boolean DEFAULT false NOT NULL;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "day_of_confirmation_responded_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "day_of_confirmation_sent_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "last_rescheduled_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "last_rescheduled_by" text;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "original_scheduled_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "reschedule_proposed_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "scheduled_at_confirmed_at" timestamp with time zone;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "scheduling_proposed_by" text;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "seller_confirmation_code" text NOT NULL;
ALTER TABLE "local_transaction" ADD COLUMN IF NOT EXISTS "seller_offline_code" text NOT NULL;

ALTER TABLE "referral" ADD COLUMN IF NOT EXISTS "listing_id" text;

ALTER TABLE "enforcement_action" ADD COLUMN IF NOT EXISTS "appeal_evidence_urls" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "enforcement_action" ADD COLUMN IF NOT EXISTS "appeal_resolved_at" timestamp with time zone;
ALTER TABLE "enforcement_action" ADD COLUMN IF NOT EXISTS "appeal_review_note" text;
ALTER TABLE "enforcement_action" ADD COLUMN IF NOT EXISTS "appeal_reviewed_by_staff_id" text;
ALTER TABLE "enforcement_action" ADD COLUMN IF NOT EXISTS "appealed_at" timestamp with time zone;
ALTER TABLE "enforcement_action" ADD COLUMN IF NOT EXISTS "appealed_by_user_id" text;

ALTER TABLE "publish_credit_ledger" ADD COLUMN IF NOT EXISTS "stripe_session_id" text;

CREATE INDEX IF NOT EXISTS "aau_user" ON "ai_autofill_usage" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "cp_next_poll" ON "channel_projection" USING btree ("next_poll_at");
CREATE INDEX IF NOT EXISTS "lo_parent_offer" ON "listing_offer" USING btree ("parent_offer_id");
CREATE INDEX IF NOT EXISTS "lre_decays_at" ON "local_reliability_event" USING btree ("decays_at");
CREATE INDEX IF NOT EXISTS "lre_transaction" ON "local_reliability_event" USING btree ("transaction_id");
CREATE INDEX IF NOT EXISTS "lre_user" ON "local_reliability_event" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "lst_auth_status" ON "listing" USING btree ("authentication_status");
CREATE INDEX IF NOT EXISTS "lst_fulfillment" ON "listing" USING btree ("fulfillment_type");
CREATE INDEX IF NOT EXISTS "lt_buyer_confirm" ON "local_transaction" USING btree ("buyer_confirmation_code");
CREATE INDEX IF NOT EXISTS "lt_seller_confirm" ON "local_transaction" USING btree ("seller_confirmation_code");
CREATE INDEX IF NOT EXISTS "mr_state" ON "module_registry" USING btree ("state");
CREATE UNIQUE INDEX IF NOT EXISTS "pcl_stripe_session" ON "publish_credit_ledger" USING btree ("stripe_session_id");
CREATE INDEX IF NOT EXISTS "pcl_sub" ON "publish_credit_ledger" USING btree ("lister_subscription_id");
CREATE INDEX IF NOT EXISTS "pcl_user_expires" ON "publish_credit_ledger" USING btree ("user_id","expires_at");
CREATE INDEX IF NOT EXISTS "ref_listing" ON "referral" USING btree ("listing_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_projection_external" ON "channel_projection" USING btree ("seller_id","channel","external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "le_uniq_refund" ON "ledger_entry" USING btree ("stripe_refund_id","type") WHERE stripe_refund_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "le_uniq_dispute" ON "ledger_entry" USING btree ("stripe_dispute_id","type") WHERE stripe_dispute_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_autofill_usage_user_id_month_key_unique') THEN
    ALTER TABLE "ai_autofill_usage" ADD CONSTRAINT "ai_autofill_usage_user_id_month_key_unique" UNIQUE("user_id","month_key");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'browsing_history_user_id_listing_id_unique') THEN
    ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_user_id_listing_id_unique" UNIQUE("user_id","listing_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'buyer_block_list_blocker_id_blocked_id_unique') THEN
    ALTER TABLE "buyer_block_list" ADD CONSTRAINT "buyer_block_list_blocker_id_blocked_id_unique" UNIQUE("blocker_id","blocked_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'curated_collection_item_collection_id_listing_id_unique') THEN
    ALTER TABLE "curated_collection_item" ADD CONSTRAINT "curated_collection_item_collection_id_listing_id_unique" UNIQUE("collection_id","listing_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_session_product_session_id_listing_id_unique') THEN
    ALTER TABLE "live_session_product" ADD CONSTRAINT "live_session_product_session_id_listing_id_unique" UNIQUE("session_id","listing_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_interest_user_id_tag_slug_source_unique') THEN
    ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_tag_slug_source_unique" UNIQUE("user_id","tag_slug","source");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promo_code_redemption_promo_code_id_user_id_subscription_product_unique') THEN
    ALTER TABLE "promo_code_redemption" ADD CONSTRAINT "promo_code_redemption_promo_code_id_user_id_subscription_product_unique" UNIQUE("promo_code_id","user_id","subscription_product");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_autofill_usage_user_id_user_id_fk') THEN
    ALTER TABLE "ai_autofill_usage" ADD CONSTRAINT "ai_autofill_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'authentication_request_authenticator_id_authenticator_partner_id_fk') THEN
    ALTER TABLE "authentication_request" ADD CONSTRAINT "authentication_request_authenticator_id_authenticator_partner_id_fk" FOREIGN KEY ("authenticator_id") REFERENCES "public"."authenticator_partner"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bundle_subscription_seller_profile_id_seller_profile_id_fk') THEN
    ALTER TABLE "bundle_subscription" ADD CONSTRAINT "bundle_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_report_reporter_user_id_user_id_fk') THEN
    ALTER TABLE "content_report" ADD CONSTRAINT "content_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_export_request_user_id_user_id_fk') THEN
    ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enforcement_action_user_id_user_id_fk') THEN
    ALTER TABLE "enforcement_action" ADD CONSTRAINT "enforcement_action_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'identity_verification_user_id_user_id_fk') THEN
    ALTER TABLE "identity_verification" ADD CONSTRAINT "identity_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'local_fraud_flag_listing_id_listing_id_fk') THEN
    ALTER TABLE "local_fraud_flag" ADD CONSTRAINT "local_fraud_flag_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'local_fraud_flag_local_transaction_id_local_transaction_id_fk') THEN
    ALTER TABLE "local_fraud_flag" ADD CONSTRAINT "local_fraud_flag_local_transaction_id_local_transaction_id_fk" FOREIGN KEY ("local_transaction_id") REFERENCES "public"."local_transaction"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'local_fraud_flag_seller_id_user_id_fk') THEN
    ALTER TABLE "local_fraud_flag" ADD CONSTRAINT "local_fraud_flag_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'local_reliability_event_transaction_id_local_transaction_id_fk') THEN
    ALTER TABLE "local_reliability_event" ADD CONSTRAINT "local_reliability_event_transaction_id_local_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."local_transaction"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'local_reliability_event_user_id_user_id_fk') THEN
    ALTER TABLE "local_reliability_event" ADD CONSTRAINT "local_reliability_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promoted_listing_event_promoted_listing_id_promoted_listing_id_fk') THEN
    ALTER TABLE "promoted_listing_event" ADD CONSTRAINT "promoted_listing_event_promoted_listing_id_promoted_listing_id_fk" FOREIGN KEY ("promoted_listing_id") REFERENCES "public"."promoted_listing"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publish_credit_ledger_lister_subscription_id_lister_subscription_id_fk') THEN
    ALTER TABLE "publish_credit_ledger" ADD CONSTRAINT "publish_credit_ledger_lister_subscription_id_lister_subscription_id_fk" FOREIGN KEY ("lister_subscription_id") REFERENCES "public"."lister_subscription"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publish_credit_ledger_user_id_user_id_fk') THEN
    ALTER TABLE "publish_credit_ledger" ADD CONSTRAINT "publish_credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_listing_id_listing_id_fk') THEN
    ALTER TABLE "referral" ADD CONSTRAINT "referral_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_score_snapshot_user_id_user_id_fk') THEN
    ALTER TABLE "seller_score_snapshot" ADD CONSTRAINT "seller_score_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trial_usage_user_id_user_id_fk') THEN
    ALTER TABLE "trial_usage" ADD CONSTRAINT "trial_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'watcher_offer_seller_id_user_id_fk') THEN
    ALTER TABLE "watcher_offer" ADD CONSTRAINT "watcher_offer_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
