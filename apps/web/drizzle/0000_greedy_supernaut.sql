CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'PAUSED', 'REVOKED', 'ERROR', 'REAUTHENTICATION_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('OAUTH', 'API_KEY', 'SESSION');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP');--> statement-breakpoint
CREATE TYPE "public"."buyer_quality_tier" AS ENUM('GREEN', 'YELLOW', 'RED');--> statement-breakpoint
CREATE TYPE "public"."cancel_initiator" AS ENUM('BUYER', 'SELLER', 'SYSTEM', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('ACTIVE', 'CONVERTED', 'EXPIRED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."case_channel" AS ENUM('WEB', 'EMAIL', 'SYSTEM', 'INTERNAL');--> statement-breakpoint
CREATE TYPE "public"."case_message_delivery_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');--> statement-breakpoint
CREATE TYPE "public"."case_message_direction" AS ENUM('INBOUND', 'OUTBOUND', 'INTERNAL', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."case_priority" AS ENUM('CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."case_type" AS ENUM('SUPPORT', 'ORDER', 'RETURN', 'DISPUTE', 'CHARGEBACK', 'BILLING', 'ACCOUNT', 'MODERATION', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('TWICELY', 'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL');--> statement-breakpoint
CREATE TYPE "public"."channel_listing_status" AS ENUM('DRAFT', 'PUBLISHING', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'DELISTING', 'DELISTED', 'ERROR', 'ORPHANED');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('INR', 'INAD', 'DAMAGED', 'COUNTERFEIT', 'REMORSE');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('OPEN', 'READ_ONLY', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."delegation_status" AS ENUM('ACTIVE', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'APPEALED', 'APPEAL_RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."enforcement_state" AS ENUM('CLEAR', 'FLAGGED', 'SUPPRESSED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."feature_flag_type" AS ENUM('BOOLEAN', 'PERCENTAGE', 'TARGETED');--> statement-breakpoint
CREATE TYPE "public"."fee_bucket" AS ENUM('ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY');--> statement-breakpoint
CREATE TYPE "public"."import_batch_status" AS ENUM('CREATED', 'FETCHING', 'DEDUPLICATING', 'TRANSFORMING', 'IMPORTING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."kb_article_status" AS ENUM('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."kb_audience" AS ENUM('ALL', 'BUYER', 'SELLER', 'AGENT_ONLY');--> statement-breakpoint
CREATE TYPE "public"."kb_body_format" AS ENUM('MARKDOWN', 'HTML', 'RICHTEXT');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_status" AS ENUM('PENDING', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('ORDER_PAYMENT_CAPTURED', 'ORDER_FVF_FEE', 'ORDER_BOOST_FEE', 'ORDER_STRIPE_PROCESSING_FEE', 'REFUND_FULL', 'REFUND_PARTIAL', 'SELLER_ADJUSTMENT', 'REFUND_FVF_REVERSAL', 'REFUND_BOOST_REVERSAL', 'REFUND_STRIPE_REVERSAL', 'CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE', 'SHIPPING_LABEL_PURCHASE', 'SHIPPING_LABEL_REFUND', 'INSERTION_FEE', 'INSERTION_FEE_WAIVER', 'SUBSCRIPTION_CHARGE', 'SUBSCRIPTION_CREDIT', 'OVERAGE_CHARGE', 'PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED', 'RESERVE_HOLD', 'RESERVE_RELEASE', 'MANUAL_CREDIT', 'MANUAL_DEBIT', 'PLATFORM_ABSORBED_COST');--> statement-breakpoint
CREATE TYPE "public"."lister_tier" AS ENUM('NONE', 'FREE', 'LITE', 'PLUS', 'POWER', 'MAX', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."listing_condition" AS ENUM('NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'PUSH', 'IN_APP', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('CRITICAL', 'HIGH', 'NORMAL', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('CREATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."payout_batch_status" AS ENUM('CREATED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."performance_band" AS ENUM('TOP_RATED', 'ABOVE_STANDARD', 'STANDARD', 'BELOW_STANDARD', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER', 'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."promotion_scope" AS ENUM('STORE_WIDE', 'CATEGORY', 'SPECIFIC_LISTINGS');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('PERCENT_OFF', 'AMOUNT_OFF', 'FREE_SHIPPING', 'BUNDLE_DISCOUNT');--> statement-breakpoint
CREATE TYPE "public"."provider_adapter_source" AS ENUM('BUILT_IN', 'HTTP_CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."provider_instance_status" AS ENUM('ACTIVE', 'DISABLED', 'TESTING');--> statement-breakpoint
CREATE TYPE "public"."provider_service_type" AS ENUM('STORAGE', 'EMAIL', 'SEARCH', 'SMS', 'PUSH', 'PAYMENTS', 'SHIPPING', 'REALTIME', 'CACHE');--> statement-breakpoint
CREATE TYPE "public"."publish_job_status" AS ENUM('PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."publish_job_type" AS ENUM('CREATE', 'UPDATE', 'DELIST', 'RELIST', 'SYNC', 'VERIFY');--> statement-breakpoint
CREATE TYPE "public"."return_fault" AS ENUM('SELLER', 'BUYER', 'CARRIER', 'PLATFORM');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('INAD', 'DAMAGED', 'INR', 'COUNTERFEIT', 'REMORSE', 'WRONG_ITEM');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('PENDING_SELLER', 'APPROVED', 'DECLINED', 'PARTIAL_OFFERED', 'BUYER_ACCEPTS_PARTIAL', 'BUYER_DECLINES_PARTIAL', 'LABEL_GENERATED', 'SHIPPED', 'DELIVERED', 'REFUND_ISSUED', 'CONDITION_DISPUTE', 'BUYER_ACCEPTS', 'ESCALATED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'APPROVED', 'FLAGGED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."seller_status" AS ENUM('ACTIVE', 'RESTRICTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('PERSONAL', 'BUSINESS');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('PENDING', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'EXCEPTION');--> statement-breakpoint
CREATE TYPE "public"."store_tier" AS ENUM('NONE', 'STARTER', 'BASIC', 'PRO', 'ELITE', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING', 'PENDING');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"display_name" text,
	"username" text,
	"bio" text,
	"phone" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"default_address_id" text,
	"is_seller" boolean DEFAULT false NOT NULL,
	"buyer_quality_tier" "buyer_quality_tier" DEFAULT 'GREEN' NOT NULL,
	"dashboard_layout_json" jsonb,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"banned_reason" text,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "address" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text,
	"name" text NOT NULL,
	"address1" text NOT NULL,
	"address2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_info" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"business_name" text NOT NULL,
	"business_type" "business_type" NOT NULL,
	"ein" text,
	"address1" text NOT NULL,
	"address2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"country" text DEFAULT 'US' NOT NULL,
	"phone" text,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_info_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "seller_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"seller_type" "seller_type" DEFAULT 'PERSONAL' NOT NULL,
	"store_tier" "store_tier" DEFAULT 'NONE' NOT NULL,
	"lister_tier" "lister_tier" DEFAULT 'NONE' NOT NULL,
	"has_automation" boolean DEFAULT false NOT NULL,
	"performance_band" "performance_band" DEFAULT 'STANDARD' NOT NULL,
	"status" "seller_status" DEFAULT 'ACTIVE' NOT NULL,
	"payouts_enabled" boolean DEFAULT false NOT NULL,
	"store_name" text,
	"store_slug" text,
	"store_description" text,
	"return_policy" text,
	"handling_time_days" integer DEFAULT 3 NOT NULL,
	"vacation_mode" boolean DEFAULT false NOT NULL,
	"vacation_message" text,
	"vacation_start_at" timestamp with time zone,
	"vacation_end_at" timestamp with time zone,
	"stripe_account_id" text,
	"stripe_onboarded" boolean DEFAULT false NOT NULL,
	"trust_score" real DEFAULT 80 NOT NULL,
	"activated_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_profile_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "seller_profile_store_slug_unique" UNIQUE("store_slug")
);
--> statement-breakpoint
CREATE TABLE "staff_session" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_user_id" text NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"mfa_verified" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "staff_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"recovery_codes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "staff_user_role" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_user_id" text NOT NULL,
	"role" "platform_role" NOT NULL,
	"granted_by_staff_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"fee_bucket" "fee_bucket" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_leaf" boolean DEFAULT false NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_attribute_schema" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"show_in_filters" boolean DEFAULT false NOT NULL,
	"show_in_listing" boolean DEFAULT true NOT NULL,
	"options_json" jsonb DEFAULT '[]' NOT NULL,
	"validation_json" jsonb DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"subject" text NOT NULL,
	"subject_id" text,
	"severity" "audit_severity" DEFAULT 'LOW' NOT NULL,
	"details_json" jsonb DEFAULT '{}' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"permissions_json" jsonb DEFAULT '[]' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_staff_id" text NOT NULL,
	"updated_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_role_name_unique" UNIQUE("name"),
	CONSTRAINT "custom_role_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "feature_flag" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "feature_flag_type" DEFAULT 'BOOLEAN' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"percentage" integer,
	"targeting_json" jsonb DEFAULT '{}' NOT NULL,
	"created_by_staff_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flag_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platform_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"type" text DEFAULT 'string' NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_setting_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platform_setting_history" (
	"id" text PRIMARY KEY NOT NULL,
	"setting_id" text NOT NULL,
	"previous_value" jsonb NOT NULL,
	"new_value" jsonb NOT NULL,
	"changed_by_staff_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_counter" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"padded_width" integer DEFAULT 6 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sequence_counter_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "staff_user_custom_role" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_user_id" text NOT NULL,
	"custom_role_id" text NOT NULL,
	"granted_by_staff_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "staff_user_custom_role_staff_user_id_custom_role_id_unique" UNIQUE("staff_user_id","custom_role_id")
);
--> statement-breakpoint
CREATE TABLE "provider_adapter" (
	"id" text PRIMARY KEY NOT NULL,
	"service_type" "provider_service_type" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"docs_url" text,
	"config_schema_json" jsonb DEFAULT '[]' NOT NULL,
	"adapter_source" "provider_adapter_source" DEFAULT 'BUILT_IN' NOT NULL,
	"http_config_json" jsonb,
	"is_built_in" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_adapter_service_type_code_unique" UNIQUE("service_type","code")
);
--> statement-breakpoint
CREATE TABLE "provider_health_log" (
	"id" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer,
	"error_message" text,
	"details_json" jsonb DEFAULT '{}' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_instance" (
	"id" text PRIMARY KEY NOT NULL,
	"adapter_id" text NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"config_json" jsonb DEFAULT '{}' NOT NULL,
	"status" "provider_instance_status" DEFAULT 'ACTIVE' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"last_health_status" text,
	"last_health_check_at" timestamp with time zone,
	"last_health_latency_ms" integer,
	"last_health_error" text,
	"created_by_staff_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_instance_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "provider_secret" (
	"id" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"key" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_secret_instance_id_key_unique" UNIQUE("instance_id","key")
);
--> statement-breakpoint
CREATE TABLE "provider_usage_mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"usage_key" text NOT NULL,
	"description" text,
	"service_type" "provider_service_type" NOT NULL,
	"primary_instance_id" text NOT NULL,
	"fallback_instance_id" text,
	"auto_failover" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_usage_mapping_usage_key_unique" UNIQUE("usage_key")
);
--> statement-breakpoint
CREATE TABLE "automation_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"stripe_subscription_id" text,
	"credits_included" integer DEFAULT 2000 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_subscription_seller_profile_id_unique" UNIQUE("seller_profile_id"),
	CONSTRAINT "automation_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "delegated_access" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "delegation_status" DEFAULT 'ACTIVE' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lister_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"tier" "lister_tier" NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lister_subscription_seller_profile_id_unique" UNIQUE("seller_profile_id"),
	CONSTRAINT "lister_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "store_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"tier" "store_tier" NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_subscription_seller_profile_id_unique" UNIQUE("seller_profile_id"),
	CONSTRAINT "store_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "listing" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"status" "listing_status" DEFAULT 'DRAFT' NOT NULL,
	"title" text,
	"description" text,
	"category_id" text,
	"condition" "listing_condition",
	"brand" text,
	"price_cents" integer,
	"original_price_cents" integer,
	"cogs_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"available_quantity" integer,
	"sold_quantity" integer DEFAULT 0 NOT NULL,
	"slug" text,
	"allow_offers" boolean DEFAULT false NOT NULL,
	"auto_accept_offer_cents" integer,
	"auto_decline_offer_cents" integer,
	"shipping_profile_id" text,
	"weight_oz" integer,
	"length_in" real,
	"width_in" real,
	"height_in" real,
	"free_shipping" boolean DEFAULT false NOT NULL,
	"attributes_json" jsonb DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"enforcement_state" "enforcement_state" DEFAULT 'CLEAR' NOT NULL,
	"deal_badge_type" text,
	"deal_badge_computed_at" timestamp with time zone,
	"boost_percent" real,
	"boost_started_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"imported_from_channel" "channel",
	"imported_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "listing_fee" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"billing_period" text,
	"waived" boolean DEFAULT false NOT NULL,
	"waived_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_image" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"alt_text" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"blur_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_image_listing_id_position_unique" UNIQUE("listing_id","position")
);
--> statement-breakpoint
CREATE TABLE "listing_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"offer_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"message" text,
	"status" "offer_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"counter_offer_cents" integer,
	"counter_message" text,
	"counter_count" integer DEFAULT 0 NOT NULL,
	"responded_at" timestamp with time zone,
	"stripe_hold_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_version" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"version" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"change_reason" text,
	"changed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_version_listing_id_version_unique" UNIQUE("listing_id","version")
);
--> statement-breakpoint
CREATE TABLE "shipping_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"carrier" text DEFAULT 'USPS' NOT NULL,
	"service" text,
	"handling_time_days" integer DEFAULT 3 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"weight_oz" integer,
	"length_in" real,
	"width_in" real,
	"height_in" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"session_id" text,
	"status" "cart_status" DEFAULT 'ACTIVE' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_item" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"seller_id" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"unavailable_reason" text,
	"is_saved_for_later" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_item_cart_id_listing_id_unique" UNIQUE("cart_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"status" "order_status" DEFAULT 'CREATED' NOT NULL,
	"source_cart_id" text,
	"item_subtotal_cents" integer NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"shipping_address_json" jsonb DEFAULT '{}' NOT NULL,
	"shipping_method" text,
	"tracking_number" text,
	"tracking_url" text,
	"carrier_code" text,
	"handling_due_days" integer DEFAULT 3 NOT NULL,
	"handling_due_at" timestamp with time zone,
	"is_late_shipment" boolean DEFAULT false NOT NULL,
	"buyer_note" text,
	"is_gift" boolean DEFAULT false NOT NULL,
	"gift_message" text,
	"payment_intent_id" text,
	"checkout_session_id" text,
	"canceled_by_user_id" text,
	"cancel_initiator" "cancel_initiator",
	"cancel_reason" text,
	"cancel_counts_as_defect" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"expected_ship_by_at" timestamp with time zone,
	"expected_delivery_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"listing_snapshot_json" jsonb DEFAULT '{}' NOT NULL,
	"title" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"fvf_rate_bps" integer,
	"fvf_amount_cents" integer,
	"fee_bucket" "fee_bucket",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_fees_cents" integer,
	"fvf_amount_cents" integer,
	"fvf_rate_percent" real,
	"boost_fee_amount_cents" integer,
	"boost_rate_percent" real,
	"net_to_seller_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"captured_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refund_amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_payment_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "dispute" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"return_request_id" text,
	"claim_type" "claim_type" NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"description" text NOT NULL,
	"evidence_photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"seller_response_note" text,
	"seller_evidence_photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"resolution_note" text,
	"resolution_amount_cents" integer,
	"resolved_by_staff_id" text,
	"appeal_note" text,
	"appeal_evidence_photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"appeal_resolved_note" text,
	"deadline_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"appealed_at" timestamp with time zone,
	"appeal_resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_request" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"status" "return_status" DEFAULT 'PENDING_SELLER' NOT NULL,
	"reason" "return_reason" NOT NULL,
	"fault" "return_fault",
	"description" text,
	"evidence_photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"seller_response_note" text,
	"seller_evidence_photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"partial_refund_cents" integer,
	"refund_amount_cents" integer,
	"return_tracking_number" text,
	"return_carrier" text,
	"return_label_url" text,
	"return_shipping_paid_by" text,
	"seller_response_due_at" timestamp with time zone,
	"seller_responded_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"carrier" text,
	"service" text,
	"tracking" text,
	"label_url" text,
	"status" "shipment_status" DEFAULT 'PENDING' NOT NULL,
	"shipping_cost_cents" integer,
	"insurance_cost_cents" integer,
	"weight_oz" real,
	"length_in" real,
	"width_in" real,
	"height_in" real,
	"late_shipment" boolean DEFAULT false NOT NULL,
	"from_address_json" jsonb DEFAULT '{}' NOT NULL,
	"to_address_json" jsonb DEFAULT '{}' NOT NULL,
	"tracking_events_json" jsonb DEFAULT '[]' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"expected_delivery_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "review_status" DEFAULT 'APPROVED' NOT NULL,
	"is_verified_purchase" boolean DEFAULT true NOT NULL,
	"flag_reason" text,
	"flagged_by_user_id" text,
	"removed_by_staff_id" text,
	"removed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "review_response" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_response_review_id_unique" UNIQUE("review_id")
);
--> statement-breakpoint
CREATE TABLE "seller_performance" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"completed_orders" integer DEFAULT 0 NOT NULL,
	"canceled_orders" integer DEFAULT 0 NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"average_rating" real,
	"late_shipment_rate" real DEFAULT 0 NOT NULL,
	"cancel_rate" real DEFAULT 0 NOT NULL,
	"return_rate" real DEFAULT 0 NOT NULL,
	"defect_rate" real DEFAULT 0 NOT NULL,
	"inad_rate" real DEFAULT 0 NOT NULL,
	"chargeback_rate" real DEFAULT 0 NOT NULL,
	"response_time_minutes" real,
	"current_band" "performance_band" DEFAULT 'STANDARD' NOT NULL,
	"band_last_evaluated_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_performance_seller_profile_id_unique" UNIQUE("seller_profile_id")
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text,
	"order_id" text,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"subject" text,
	"status" "conversation_status" DEFAULT 'OPEN' NOT NULL,
	"last_message_at" timestamp with time zone,
	"buyer_unread_count" integer DEFAULT 0 NOT NULL,
	"seller_unread_count" integer DEFAULT 0 NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"attachments" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"is_auto_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"priority" "notification_priority" DEFAULT 'NORMAL' NOT NULL,
	"template_key" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"data_json" jsonb DEFAULT '{}' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"template_key" text NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"push" boolean DEFAULT true NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preference_user_id_template_key_unique" UNIQUE("user_id","template_key")
);
--> statement-breakpoint
CREATE TABLE "notification_template" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"html_template" text,
	"channels" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_system_only" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_template_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "fee_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"fee_bucket" "fee_bucket" NOT NULL,
	"fvf_rate_percent" real NOT NULL,
	"insertion_fee_cents" integer NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by_staff_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "ledger_entry_type" NOT NULL,
	"status" "ledger_entry_status" DEFAULT 'PENDING' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"user_id" text,
	"order_id" text,
	"listing_id" text,
	"channel" "channel",
	"stripe_event_id" text,
	"stripe_payment_intent_id" text,
	"stripe_transfer_id" text,
	"stripe_charge_id" text,
	"stripe_refund_id" text,
	"stripe_dispute_id" text,
	"reversal_of_entry_id" text,
	"created_by_staff_id" text,
	"reason_code" text,
	"memo" text,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_adjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ledger_entry_id" text NOT NULL,
	"type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason_code" text NOT NULL,
	"memo" text NOT NULL,
	"approved_by_staff_id" text NOT NULL,
	"mfa_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"batch_id" text,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stripe_transfer_id" text,
	"stripe_payout_id" text,
	"failure_reason" text,
	"is_on_demand" boolean DEFAULT false NOT NULL,
	"initiated_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "payout_batch_status" DEFAULT 'CREATED' NOT NULL,
	"total_sellers" integer DEFAULT 0 NOT NULL,
	"processed_sellers" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"total_amount_cents" integer DEFAULT 0 NOT NULL,
	"triggered_by_staff_id" text,
	"is_automatic" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_report" (
	"id" text PRIMARY KEY NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"total_entries_checked" integer DEFAULT 0 NOT NULL,
	"discrepancy_count" integer DEFAULT 0 NOT NULL,
	"discrepancies_json" jsonb DEFAULT '[]' NOT NULL,
	"summary_json" jsonb DEFAULT '{}' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_balance" (
	"user_id" text PRIMARY KEY NOT NULL,
	"pending_cents" integer DEFAULT 0 NOT NULL,
	"available_cents" integer DEFAULT 0 NOT NULL,
	"reserved_cents" integer DEFAULT 0 NOT NULL,
	"last_ledger_entry_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"auto_relist_enabled" boolean DEFAULT false NOT NULL,
	"auto_relist_days" integer DEFAULT 30 NOT NULL,
	"auto_relist_channels" text[] DEFAULT '{}'::text[] NOT NULL,
	"offer_to_likers_enabled" boolean DEFAULT false NOT NULL,
	"offer_discount_percent" integer DEFAULT 10 NOT NULL,
	"offer_min_days_listed" integer DEFAULT 7 NOT NULL,
	"price_drop_enabled" boolean DEFAULT false NOT NULL,
	"price_drop_percent" integer DEFAULT 5 NOT NULL,
	"price_drop_interval_days" integer DEFAULT 14 NOT NULL,
	"price_drop_floor_percent" integer DEFAULT 50 NOT NULL,
	"posh_share_enabled" boolean DEFAULT false NOT NULL,
	"posh_share_times_per_day" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_setting_seller_id_unique" UNIQUE("seller_id")
);
--> statement-breakpoint
CREATE TABLE "channel_category_mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" "channel" NOT NULL,
	"twicely_category_id" text NOT NULL,
	"external_category_id" text NOT NULL,
	"external_category_name" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_category_mapping_channel_twicely_category_id_unique" UNIQUE("channel","twicely_category_id")
);
--> statement-breakpoint
CREATE TABLE "channel_policy_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" "channel" NOT NULL,
	"field" text NOT NULL,
	"constraint_json" jsonb NOT NULL,
	"guidance" text,
	"severity" text DEFAULT 'WARN' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_projection" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"account_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"seller_id" text NOT NULL,
	"external_id" text,
	"external_url" text,
	"status" "channel_listing_status" DEFAULT 'DRAFT' NOT NULL,
	"overrides_json" jsonb DEFAULT '{}' NOT NULL,
	"platform_data_json" jsonb DEFAULT '{}' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_canonical_hash" text,
	"has_pending_sync" boolean DEFAULT false NOT NULL,
	"external_diff" jsonb,
	"publish_attempts" integer DEFAULT 0 NOT NULL,
	"last_publish_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_projection_listing_id_account_id_channel_unique" UNIQUE("listing_id","account_id","channel")
);
--> statement-breakpoint
CREATE TABLE "cross_job" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"projection_id" text,
	"account_id" text,
	"job_type" "publish_job_type" NOT NULL,
	"priority" integer DEFAULT 500 NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "publish_job_status" DEFAULT 'PENDING' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_error" text,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"bullmq_job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_job_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "crosslister_account" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"external_account_id" text,
	"external_username" text,
	"auth_method" "auth_method" NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"session_data" jsonb,
	"token_expires_at" timestamp with time zone,
	"last_auth_at" timestamp with time zone,
	"account_status" "account_status" DEFAULT 'ACTIVE' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"capabilities" jsonb DEFAULT '{}' NOT NULL,
	"first_import_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crosslister_account_seller_id_channel_unique" UNIQUE("seller_id","channel")
);
--> statement-breakpoint
CREATE TABLE "dedupe_fingerprint" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"title_hash" text NOT NULL,
	"image_hash" text,
	"price_range" text,
	"composite_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"account_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"status" "import_batch_status" DEFAULT 'CREATED' NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"processed_items" integer DEFAULT 0 NOT NULL,
	"created_items" integer DEFAULT 0 NOT NULL,
	"deduplicated_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"skipped_items" integer DEFAULT 0 NOT NULL,
	"is_first_import" boolean NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_summary_json" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_record" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"external_id" text NOT NULL,
	"channel" "channel" NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"listing_id" text,
	"raw_data_json" jsonb DEFAULT '{}' NOT NULL,
	"normalized_data_json" jsonb,
	"error_message" text,
	"dedupe_match_listing_id" text,
	"dedupe_confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_csat" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"survey_requested_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_csat_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
CREATE TABLE "case_event" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"data_json" jsonb DEFAULT '{}' NOT NULL,
	"from_merged_case_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_message" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"sender_type" text NOT NULL,
	"sender_id" text,
	"sender_name" text,
	"direction" "case_message_direction" NOT NULL,
	"body" text NOT NULL,
	"body_html" text,
	"attachments" jsonb DEFAULT '[]' NOT NULL,
	"delivery_status" "case_message_delivery_status" DEFAULT 'SENT' NOT NULL,
	"email_message_id" text,
	"from_merged_case_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_watcher" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"staff_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_watcher_case_id_staff_user_id_unique" UNIQUE("case_id","staff_user_id")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_automation_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger_event" text NOT NULL,
	"conditions_json" jsonb DEFAULT '[]' NOT NULL,
	"actions_json" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_case" (
	"id" text PRIMARY KEY NOT NULL,
	"case_number" text NOT NULL,
	"type" "case_type" NOT NULL,
	"channel" "case_channel" DEFAULT 'WEB' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"status" "case_status" DEFAULT 'NEW' NOT NULL,
	"priority" "case_priority" DEFAULT 'NORMAL' NOT NULL,
	"requester_id" text NOT NULL,
	"requester_email" text,
	"requester_type" text DEFAULT 'buyer' NOT NULL,
	"assigned_team_id" text,
	"assigned_agent_id" text,
	"order_id" text,
	"listing_id" text,
	"seller_id" text,
	"payout_id" text,
	"dispute_case_id" text,
	"return_request_id" text,
	"conversation_id" text,
	"category" text,
	"subcategory" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"sla_first_response_due_at" timestamp with time zone,
	"sla_resolution_due_at" timestamp with time zone,
	"sla_first_response_breached" boolean DEFAULT false NOT NULL,
	"sla_resolution_breached" boolean DEFAULT false NOT NULL,
	"first_response_at" timestamp with time zone,
	"merged_into_case_id" text,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"reopened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "helpdesk_case_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_email_config" (
	"id" text PRIMARY KEY NOT NULL,
	"from_name" text DEFAULT 'Twicely Support' NOT NULL,
	"from_email" text DEFAULT 'support@twicely.co' NOT NULL,
	"reply_to_pattern" text DEFAULT 'case+{caseId}@support.twicely.co' NOT NULL,
	"signature_html" text,
	"auto_reply_enabled" boolean DEFAULT true NOT NULL,
	"auto_reply_template_key" text DEFAULT 'helpdesk.case.auto_reply' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_macro" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"body_template" text NOT NULL,
	"actions_json" jsonb DEFAULT '[]' NOT NULL,
	"is_shared" boolean DEFAULT true NOT NULL,
	"created_by_staff_id" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_routing_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"conditions_json" jsonb NOT NULL,
	"actions_json" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_saved_view" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"staff_user_id" text,
	"filters_json" jsonb NOT NULL,
	"sort_json" jsonb DEFAULT '{}' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "helpdesk_sla_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"priority" "case_priority" NOT NULL,
	"first_response_minutes" integer NOT NULL,
	"resolution_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "helpdesk_sla_policy_priority_unique" UNIQUE("priority")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"max_concurrent_cases" integer DEFAULT 25 NOT NULL,
	"round_robin_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "helpdesk_team_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "helpdesk_team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"staff_user_id" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"active_case_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "helpdesk_team_member_team_id_staff_user_id_unique" UNIQUE("team_id","staff_user_id")
);
--> statement-breakpoint
CREATE TABLE "kb_article" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"body" text NOT NULL,
	"body_format" "kb_body_format" DEFAULT 'MARKDOWN' NOT NULL,
	"status" "kb_article_status" DEFAULT 'DRAFT' NOT NULL,
	"audience" "kb_audience" DEFAULT 'ALL' NOT NULL,
	"author_staff_id" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"search_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"helpful_yes" integer DEFAULT 0 NOT NULL,
	"helpful_no" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_article_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kb_article_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_article_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"user_id" text,
	"session_fingerprint" text,
	"helpful" boolean NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_article_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"related_article_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_article_relation_article_id_related_article_id_unique" UNIQUE("article_id","related_article_id")
);
--> statement-breakpoint
CREATE TABLE "kb_case_article_link" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"article_id" text NOT NULL,
	"linked_by_staff_id" text NOT NULL,
	"sent_to_customer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_category" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "promoted_listing" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"boost_percent" real NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"sales" integer DEFAULT 0 NOT NULL,
	"total_fee_cents" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "promotion_type" NOT NULL,
	"scope" "promotion_scope" NOT NULL,
	"discount_percent" real,
	"discount_amount_cents" integer,
	"minimum_order_cents" integer,
	"max_uses_total" integer,
	"max_uses_per_buyer" integer DEFAULT 1 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"coupon_code" text,
	"applicable_category_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"applicable_listing_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_coupon_code_unique" UNIQUE("coupon_code")
);
--> statement-breakpoint
CREATE TABLE "promotion_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"promotion_id" text NOT NULL,
	"order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"discount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow" (
	"id" text PRIMARY KEY NOT NULL,
	"follower_id" text NOT NULL,
	"followed_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_follower_id_followed_id_unique" UNIQUE("follower_id","followed_id")
);
--> statement-breakpoint
CREATE TABLE "saved_search" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"query_json" jsonb NOT NULL,
	"notify_new_matches" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"notify_price_drop" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_item_user_id_listing_id_unique" UNIQUE("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "tax_info" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tax_id_type" text,
	"tax_id_encrypted" text,
	"tax_id_last_four" text,
	"legal_name" text,
	"business_name" text,
	"address1" text,
	"city" text,
	"state" text,
	"zip" text,
	"country" text DEFAULT 'US' NOT NULL,
	"w9_received_at" timestamp with time zone,
	"form_1099_threshold" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_info_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "tax_quote" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"buyer_state" text NOT NULL,
	"seller_state" text,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer NOT NULL,
	"tax_rate_percent" real NOT NULL,
	"jurisdiction_json" jsonb DEFAULT '{}' NOT NULL,
	"is_marketplace_facilitator" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_info" ADD CONSTRAINT "business_info_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_profile" ADD CONSTRAINT "seller_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_session" ADD CONSTRAINT "staff_session_staff_user_id_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_role" ADD CONSTRAINT "staff_user_role_staff_user_id_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_attribute_schema" ADD CONSTRAINT "category_attribute_schema_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_setting_history" ADD CONSTRAINT "platform_setting_history_setting_id_platform_setting_id_fk" FOREIGN KEY ("setting_id") REFERENCES "public"."platform_setting"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_custom_role" ADD CONSTRAINT "staff_user_custom_role_staff_user_id_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_custom_role" ADD CONSTRAINT "staff_user_custom_role_custom_role_id_custom_role_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_health_log" ADD CONSTRAINT "provider_health_log_instance_id_provider_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_instance" ADD CONSTRAINT "provider_instance_adapter_id_provider_adapter_id_fk" FOREIGN KEY ("adapter_id") REFERENCES "public"."provider_adapter"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_secret" ADD CONSTRAINT "provider_secret_instance_id_provider_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_mapping" ADD CONSTRAINT "pum_primary_instance_fk" FOREIGN KEY ("primary_instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_mapping" ADD CONSTRAINT "pum_fallback_instance_fk" FOREIGN KEY ("fallback_instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_subscription" ADD CONSTRAINT "automation_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_access" ADD CONSTRAINT "delegated_access_seller_id_seller_profile_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_access" ADD CONSTRAINT "delegated_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lister_subscription" ADD CONSTRAINT "lister_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_subscription" ADD CONSTRAINT "store_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_fee" ADD CONSTRAINT "listing_fee_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_image" ADD CONSTRAINT "listing_image_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_offer" ADD CONSTRAINT "listing_offer_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_offer" ADD CONSTRAINT "listing_offer_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_version" ADD CONSTRAINT "listing_version_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD CONSTRAINT "shipping_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_return_request_id_return_request_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_response" ADD CONSTRAINT "review_response_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD CONSTRAINT "seller_performance_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_adjustment" ADD CONSTRAINT "manual_adjustment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_adjustment" ADD CONSTRAINT "manual_adjustment_ledger_entry_id_ledger_entry_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_batch_id_payout_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payout_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balance" ADD CONSTRAINT "seller_balance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_setting" ADD CONSTRAINT "automation_setting_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_category_mapping" ADD CONSTRAINT "channel_category_mapping_twicely_category_id_category_id_fk" FOREIGN KEY ("twicely_category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_projection" ADD CONSTRAINT "channel_projection_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_projection" ADD CONSTRAINT "channel_projection_account_id_crosslister_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crosslister_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_job" ADD CONSTRAINT "cross_job_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_job" ADD CONSTRAINT "cross_job_projection_id_channel_projection_id_fk" FOREIGN KEY ("projection_id") REFERENCES "public"."channel_projection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_job" ADD CONSTRAINT "cross_job_account_id_crosslister_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crosslister_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crosslister_account" ADD CONSTRAINT "crosslister_account_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dedupe_fingerprint" ADD CONSTRAINT "dedupe_fingerprint_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_account_id_crosslister_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crosslister_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_record" ADD CONSTRAINT "import_record_batch_id_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_record" ADD CONSTRAINT "import_record_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_csat" ADD CONSTRAINT "case_csat_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_message" ADD CONSTRAINT "case_message_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_watcher" ADD CONSTRAINT "case_watcher_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_team_member" ADD CONSTRAINT "helpdesk_team_member_team_id_helpdesk_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."helpdesk_team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article" ADD CONSTRAINT "kb_article_category_id_kb_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kb_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_attachment" ADD CONSTRAINT "kb_article_attachment_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_feedback" ADD CONSTRAINT "kb_article_feedback_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_relation" ADD CONSTRAINT "kb_article_relation_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_relation" ADD CONSTRAINT "kb_article_relation_related_article_id_kb_article_id_fk" FOREIGN KEY ("related_article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_case_article_link" ADD CONSTRAINT "kb_case_article_link_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_case_article_link" ADD CONSTRAINT "kb_case_article_link_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoted_listing" ADD CONSTRAINT "promoted_listing_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_promotion_id_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_followed_id_user_id_fk" FOREIGN KEY ("followed_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_info" ADD CONSTRAINT "tax_info_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_quote" ADD CONSTRAINT "tax_quote_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usr_email" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "usr_username" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "usr_is_seller" ON "user" USING btree ("is_seller");--> statement-breakpoint
CREATE INDEX "addr_user" ON "address" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sp_user" ON "seller_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sp_store_slug" ON "seller_profile" USING btree ("store_slug");--> statement-breakpoint
CREATE INDEX "sp_status" ON "seller_profile" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sp_band" ON "seller_profile" USING btree ("performance_band");--> statement-breakpoint
CREATE INDEX "ss_token" ON "staff_session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "ss_staff" ON "staff_session" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "su_email" ON "staff_user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sur_staff_role" ON "staff_user_role" USING btree ("staff_user_id","role");--> statement-breakpoint
CREATE INDEX "cat_parent" ON "category" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "cat_path" ON "category" USING btree ("path");--> statement-breakpoint
CREATE INDEX "cat_active" ON "category" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "cas_category" ON "category_attribute_schema" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "ae_actor" ON "audit_event" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "ae_subject" ON "audit_event" USING btree ("subject","subject_id");--> statement-breakpoint
CREATE INDEX "ae_action" ON "audit_event" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "ae_severity" ON "audit_event" USING btree ("severity","created_at");--> statement-breakpoint
CREATE INDEX "ps_category" ON "platform_setting" USING btree ("category");--> statement-breakpoint
CREATE INDEX "psh_setting" ON "platform_setting_history" USING btree ("setting_id","created_at");--> statement-breakpoint
CREATE INDEX "pa_service_type" ON "provider_adapter" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "phl_instance" ON "provider_health_log" USING btree ("instance_id","checked_at");--> statement-breakpoint
CREATE INDEX "pi_adapter" ON "provider_instance" USING btree ("adapter_id");--> statement-breakpoint
CREATE INDEX "pi_status" ON "provider_instance" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pum_service_type" ON "provider_usage_mapping" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "da_seller" ON "delegated_access" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "da_user" ON "delegated_access" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "da_status" ON "delegated_access" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lst_owner_status" ON "listing" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "lst_owner_created" ON "listing" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "lst_category" ON "listing" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "lst_status_created" ON "listing" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "lst_price" ON "listing" USING btree ("price_cents");--> statement-breakpoint
CREATE INDEX "lst_slug" ON "listing" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lst_enforcement" ON "listing" USING btree ("enforcement_state");--> statement-breakpoint
CREATE INDEX "lst_expires" ON "listing" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "lf_seller" ON "listing_fee" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "lf_listing" ON "listing_fee" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "li_listing" ON "listing_image" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "lo_listing_status" ON "listing_offer" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "lo_buyer_status" ON "listing_offer" USING btree ("buyer_id","status");--> statement-breakpoint
CREATE INDEX "lo_seller_status" ON "listing_offer" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "lo_expires" ON "listing_offer" USING btree ("expires_at","status");--> statement-breakpoint
CREATE INDEX "shp_user" ON "shipping_profile" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_user_active" ON "cart" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "cart_session" ON "cart" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "cart_expires" ON "cart" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "ci_listing" ON "cart_item" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "ci_seller" ON "cart_item" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "ord_buyer" ON "order" USING btree ("buyer_id","created_at");--> statement-breakpoint
CREATE INDEX "ord_seller" ON "order" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "ord_status" ON "order" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ord_number" ON "order" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "ord_pi" ON "order" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "oi_order" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "oi_listing" ON "order_item" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "dsp_order" ON "dispute" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "dsp_buyer" ON "dispute" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "dsp_seller" ON "dispute" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "dsp_status" ON "dispute" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rr_order" ON "return_request" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "rr_buyer" ON "return_request" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "rr_seller" ON "return_request" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "rr_status" ON "return_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shp_tracking" ON "shipment" USING btree ("tracking");--> statement-breakpoint
CREATE INDEX "shp_status" ON "shipment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rev_seller" ON "review" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "rev_reviewer" ON "review" USING btree ("reviewer_user_id");--> statement-breakpoint
CREATE INDEX "rev_rating" ON "review" USING btree ("seller_id","rating");--> statement-breakpoint
CREATE INDEX "rev_status" ON "review" USING btree ("status");--> statement-breakpoint
CREATE INDEX "conv_buyer" ON "conversation" USING btree ("buyer_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conv_seller" ON "conversation" USING btree ("seller_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conv_listing" ON "conversation" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "conv_order" ON "conversation" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "msg_conversation" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "notif_user_channel" ON "notification" USING btree ("user_id","channel","is_read");--> statement-breakpoint
CREATE INDEX "notif_user_created" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notif_template" ON "notification" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "fs_bucket_effective" ON "fee_schedule" USING btree ("fee_bucket","effective_at");--> statement-breakpoint
CREATE INDEX "le_user_type" ON "ledger_entry" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "le_user_created" ON "ledger_entry" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "le_order" ON "ledger_entry" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "le_stripe_event" ON "ledger_entry" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "le_status" ON "ledger_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "le_reversal" ON "ledger_entry" USING btree ("reversal_of_entry_id");--> statement-breakpoint
CREATE INDEX "po_user" ON "payout" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "po_batch" ON "payout" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "po_status" ON "payout" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cpr_channel_field" ON "channel_policy_rule" USING btree ("channel","field");--> statement-breakpoint
CREATE INDEX "cp_seller_channel" ON "channel_projection" USING btree ("seller_id","channel");--> statement-breakpoint
CREATE INDEX "cp_status" ON "channel_projection" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cp_pending_sync" ON "channel_projection" USING btree ("has_pending_sync");--> statement-breakpoint
CREATE INDEX "cj_seller_type" ON "cross_job" USING btree ("seller_id","job_type");--> statement-breakpoint
CREATE INDEX "cj_status_priority" ON "cross_job" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "cj_scheduled" ON "cross_job" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "cj_idempotency" ON "cross_job" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ca_status" ON "crosslister_account" USING btree ("account_status");--> statement-breakpoint
CREATE INDEX "df_seller_composite" ON "dedupe_fingerprint" USING btree ("seller_id","composite_hash");--> statement-breakpoint
CREATE INDEX "df_listing" ON "dedupe_fingerprint" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "ib_seller_channel" ON "import_batch" USING btree ("seller_id","channel");--> statement-breakpoint
CREATE INDEX "ib_status" ON "import_batch" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ir_batch" ON "import_record" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "ir_external" ON "import_record" USING btree ("channel","external_id");--> statement-breakpoint
CREATE INDEX "ce_case" ON "case_event" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "cm_case" ON "case_message" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "hdc_requester" ON "helpdesk_case" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "hdc_status" ON "helpdesk_case" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hdc_agent" ON "helpdesk_case" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "hdc_team" ON "helpdesk_case" USING btree ("assigned_team_id");--> statement-breakpoint
CREATE INDEX "hdc_order" ON "helpdesk_case" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "hdc_sla_response" ON "helpdesk_case" USING btree ("sla_first_response_due_at");--> statement-breakpoint
CREATE INDEX "hdc_merged_into" ON "helpdesk_case" USING btree ("merged_into_case_id");--> statement-breakpoint
CREATE INDEX "kba_category" ON "kb_article" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "kba_status" ON "kb_article" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kba_audience" ON "kb_article" USING btree ("audience");--> statement-breakpoint
CREATE INDEX "kbaa_article" ON "kb_article_attachment" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "kbaf_article" ON "kb_article_feedback" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "kbaf_dedupe" ON "kb_article_feedback" USING btree ("article_id","user_id");--> statement-breakpoint
CREATE INDEX "kcal_case" ON "kb_case_article_link" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "kcal_article" ON "kb_case_article_link" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "kbc_parent" ON "kb_category" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "pl_listing" ON "promoted_listing" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "pl_seller_active" ON "promoted_listing" USING btree ("seller_id","is_active");--> statement-breakpoint
CREATE INDEX "promo_seller" ON "promotion" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "promo_coupon" ON "promotion" USING btree ("coupon_code");--> statement-breakpoint
CREATE INDEX "promo_active" ON "promotion" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "pu_promotion" ON "promotion_usage" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "pu_buyer_promo" ON "promotion_usage" USING btree ("buyer_id","promotion_id");--> statement-breakpoint
CREATE INDEX "fol_follower" ON "follow" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "fol_followed" ON "follow" USING btree ("followed_id");--> statement-breakpoint
CREATE INDEX "ss_user" ON "saved_search" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wl_listing" ON "watchlist_item" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "tq_order" ON "tax_quote" USING btree ("order_id");