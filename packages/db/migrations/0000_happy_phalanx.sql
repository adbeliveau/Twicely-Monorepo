CREATE TYPE "public"."account_status" AS ENUM('ACTIVE', 'PAUSED', 'REVOKED', 'ERROR', 'REAUTHENTICATION_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."affiliate_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');--> statement-breakpoint
CREATE TYPE "public"."affiliate_tier" AS ENUM('COMMUNITY', 'INFLUENCER');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."auth_method" AS ENUM('OAUTH', 'API_KEY', 'SESSION');--> statement-breakpoint
CREATE TYPE "public"."authentication_status" AS ENUM('NONE', 'SELLER_VERIFIED', 'AI_PENDING', 'AI_AUTHENTICATED', 'AI_INCONCLUSIVE', 'AI_COUNTERFEIT', 'EXPERT_PENDING', 'EXPERT_AUTHENTICATED', 'EXPERT_COUNTERFEIT', 'CERTIFICATE_EXPIRED', 'CERTIFICATE_REVOKED');--> statement-breakpoint
CREATE TYPE "public"."bundle_tier" AS ENUM('NONE', 'STARTER', 'PRO', 'POWER');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('SOLE_PROPRIETOR', 'LLC', 'CORPORATION', 'PARTNERSHIP');--> statement-breakpoint
CREATE TYPE "public"."buyer_referral_status" AS ENUM('PENDING', 'SIGNED_UP', 'REDEEMED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."cancel_initiator" AS ENUM('BUYER', 'SELLER', 'SYSTEM', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('ACTIVE', 'CONVERTED', 'EXPIRED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."case_channel" AS ENUM('WEB', 'EMAIL', 'SYSTEM', 'INTERNAL');--> statement-breakpoint
CREATE TYPE "public"."case_message_delivery_status" AS ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');--> statement-breakpoint
CREATE TYPE "public"."case_message_direction" AS ENUM('INBOUND', 'OUTBOUND', 'INTERNAL', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."case_priority" AS ENUM('CRITICAL', 'URGENT', 'HIGH', 'NORMAL', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('NEW', 'OPEN', 'PENDING_USER', 'PENDING_INTERNAL', 'ON_HOLD', 'ESCALATED', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."case_type" AS ENUM('SUPPORT', 'ORDER', 'RETURN', 'DISPUTE', 'CHARGEBACK', 'BILLING', 'ACCOUNT', 'MODERATION', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('TWICELY', 'EBAY', 'POSHMARK', 'MERCARI', 'DEPOP', 'FB_MARKETPLACE', 'ETSY', 'GRAILED', 'THEREALREAL', 'WHATNOT', 'SHOPIFY', 'VESTIAIRE');--> statement-breakpoint
CREATE TYPE "public"."channel_listing_status" AS ENUM('DRAFT', 'PUBLISHING', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'DELISTING', 'DELISTED', 'ERROR', 'ORPHANED', 'UNMANAGED');--> statement-breakpoint
CREATE TYPE "public"."claim_type" AS ENUM('INR', 'INAD', 'DAMAGED', 'COUNTERFEIT', 'REMORSE');--> statement-breakpoint
CREATE TYPE "public"."combined_shipping_mode" AS ENUM('NONE', 'FLAT', 'PER_ADDITIONAL', 'AUTO_DISCOUNT', 'QUOTED');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('PENDING', 'PAYABLE', 'PAID', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."confirmation_mode" AS ENUM('QR_ONLINE', 'QR_DUAL_OFFLINE', 'CODE_ONLINE', 'CODE_DUAL_OFFLINE');--> statement-breakpoint
CREATE TYPE "public"."content_report_reason" AS ENUM('COUNTERFEIT', 'PROHIBITED_ITEM', 'MISLEADING', 'STOLEN_PROPERTY', 'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FEE_AVOIDANCE', 'SHILL_REVIEWS', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."content_report_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."content_report_target" AS ENUM('LISTING', 'REVIEW', 'MESSAGE', 'USER');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('OPEN', 'READ_ONLY', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."credit_type" AS ENUM('MONTHLY', 'OVERAGE', 'BONUS');--> statement-breakpoint
CREATE TYPE "public"."delegation_status" AS ENUM('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_PARTIAL', 'APPEALED', 'APPEAL_RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."enforcement_action_status" AS ENUM('ACTIVE', 'EXPIRED', 'LIFTED', 'APPEALED', 'APPEAL_APPROVED');--> statement-breakpoint
CREATE TYPE "public"."enforcement_action_type" AS ENUM('COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION', 'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL', 'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION', 'ACCOUNT_BAN');--> statement-breakpoint
CREATE TYPE "public"."enforcement_state" AS ENUM('CLEAR', 'FLAGGED', 'SUPPRESSED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."enforcement_trigger" AS ENUM('SCORE_BASED', 'POLICY_VIOLATION', 'CONTENT_REPORT', 'ADMIN_MANUAL', 'SYSTEM_AUTO');--> statement-breakpoint
CREATE TYPE "public"."feature_flag_type" AS ENUM('BOOLEAN', 'PERCENTAGE', 'TARGETED');--> statement-breakpoint
CREATE TYPE "public"."fee_bucket" AS ENUM('ELECTRONICS', 'APPAREL_ACCESSORIES', 'HOME_GENERAL', 'COLLECTIBLES_LUXURY');--> statement-breakpoint
CREATE TYPE "public"."finance_tier" AS ENUM('FREE', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."fulfillment_type" AS ENUM('SHIP_ONLY', 'LOCAL_ONLY', 'SHIP_AND_LOCAL');--> statement-breakpoint
CREATE TYPE "public"."import_batch_status" AS ENUM('CREATED', 'FETCHING', 'DEDUPLICATING', 'TRANSFORMING', 'IMPORTING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."interest_source" AS ENUM('EXPLICIT', 'PURCHASE', 'WATCHLIST', 'CLICK', 'SEARCH');--> statement-breakpoint
CREATE TYPE "public"."kb_article_status" AS ENUM('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."kb_audience" AS ENUM('ALL', 'BUYER', 'SELLER', 'AGENT_ONLY');--> statement-breakpoint
CREATE TYPE "public"."kb_body_format" AS ENUM('MARKDOWN', 'HTML', 'RICHTEXT');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_status" AS ENUM('PENDING', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('ORDER_PAYMENT_CAPTURED', 'ORDER_TF_FEE', 'ORDER_BOOST_FEE', 'ORDER_STRIPE_PROCESSING_FEE', 'REFUND_FULL', 'REFUND_PARTIAL', 'SELLER_ADJUSTMENT', 'REFUND_TF_REVERSAL', 'REFUND_BOOST_REVERSAL', 'REFUND_STRIPE_REVERSAL', 'CHARGEBACK_DEBIT', 'CHARGEBACK_REVERSAL', 'CHARGEBACK_FEE', 'SHIPPING_LABEL_PURCHASE', 'SHIPPING_LABEL_REFUND', 'INSERTION_FEE', 'INSERTION_FEE_WAIVER', 'SUBSCRIPTION_CHARGE', 'SUBSCRIPTION_CREDIT', 'OVERAGE_CHARGE', 'PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED', 'RESERVE_HOLD', 'RESERVE_RELEASE', 'MANUAL_CREDIT', 'MANUAL_DEBIT', 'PLATFORM_ABSORBED_COST', 'AUTH_FEE_BUYER', 'AUTH_FEE_SELLER', 'AUTH_FEE_REFUND', 'LOCAL_TRANSACTION_FEE', 'FINANCE_SUBSCRIPTION_CHARGE', 'BUYER_REFERRAL_CREDIT_ISSUED', 'BUYER_REFERRAL_CREDIT_REDEEMED', 'AFFILIATE_COMMISSION_PAYOUT', 'CROSSLISTER_SALE_REVENUE', 'CROSSLISTER_PLATFORM_FEE', 'LOCAL_FRAUD_REVERSAL', 'LOCAL_PRICE_ADJUSTMENT', 'LOCAL_CASH_SALE_REVENUE', 'BOOST_CREDIT_ISSUED');--> statement-breakpoint
CREATE TYPE "public"."lister_tier" AS ENUM('NONE', 'FREE', 'LITE', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."listing_condition" AS ENUM('NEW_WITH_TAGS', 'NEW_WITHOUT_TAGS', 'NEW_WITH_DEFECTS', 'LIKE_NEW', 'VERY_GOOD', 'GOOD', 'ACCEPTABLE');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD', 'ENDED', 'REMOVED', 'RESERVED');--> statement-breakpoint
CREATE TYPE "public"."live_session_status" AS ENUM('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."local_fraud_flag_severity" AS ENUM('CONFIRMED', 'STRONG_SIGNAL', 'MANUAL_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."local_fraud_flag_status" AS ENUM('OPEN', 'CONFIRMED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."local_reliability_event_type" AS ENUM('BUYER_CANCEL_GRACEFUL', 'BUYER_CANCEL_LATE', 'BUYER_CANCEL_SAMEDAY', 'BUYER_NOSHOW', 'SELLER_CANCEL_GRACEFUL', 'SELLER_CANCEL_LATE', 'SELLER_CANCEL_SAMEDAY', 'SELLER_NOSHOW', 'SELLER_DARK', 'RESCHEDULE_EXCESS');--> statement-breakpoint
CREATE TYPE "public"."local_transaction_status" AS ENUM('SCHEDULED', 'SELLER_CHECKED_IN', 'BUYER_CHECKED_IN', 'BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW', 'DISPUTED', 'ADJUSTMENT_PENDING', 'RESCHEDULE_PENDING');--> statement-breakpoint
CREATE TYPE "public"."module_state" AS ENUM('ENABLED', 'DISABLED', 'BETA', 'DEPRECATED');--> statement-breakpoint
CREATE TYPE "public"."newsletter_source" AS ENUM('HOMEPAGE_SECTION', 'HOMEPAGE_FOOTER');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'PUSH', 'IN_APP', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('CRITICAL', 'HIGH', 'NORMAL', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."offer_type" AS ENUM('BEST_OFFER', 'WATCHER_OFFER', 'BUNDLE');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('CREATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."payout_batch_status" AS ENUM('CREATED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."performance_band" AS ENUM('EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('HELPDESK_AGENT', 'HELPDESK_LEAD', 'HELPDESK_MANAGER', 'SUPPORT', 'MODERATION', 'FINANCE', 'DEVELOPER', 'SRE', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."poll_tier" AS ENUM('HOT', 'WARM', 'COLD', 'LONGTAIL');--> statement-breakpoint
CREATE TYPE "public"."promo_code_type" AS ENUM('AFFILIATE', 'PLATFORM');--> statement-breakpoint
CREATE TYPE "public"."promo_discount_type" AS ENUM('PERCENTAGE', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."promotion_scope" AS ENUM('STORE_WIDE', 'CATEGORY', 'SPECIFIC_LISTINGS');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('PERCENT_OFF', 'AMOUNT_OFF', 'FREE_SHIPPING', 'BUNDLE_DISCOUNT');--> statement-breakpoint
CREATE TYPE "public"."provider_adapter_source" AS ENUM('BUILT_IN', 'HTTP_CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."provider_instance_status" AS ENUM('ACTIVE', 'DISABLED', 'TESTING');--> statement-breakpoint
CREATE TYPE "public"."provider_service_type" AS ENUM('STORAGE', 'EMAIL', 'SEARCH', 'SMS', 'PUSH', 'PAYMENTS', 'SHIPPING', 'REALTIME', 'CACHE', 'CROSSLISTER');--> statement-breakpoint
CREATE TYPE "public"."publish_job_status" AS ENUM('PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELED');--> statement-breakpoint
CREATE TYPE "public"."publish_job_type" AS ENUM('CREATE', 'UPDATE', 'DELIST', 'RELIST', 'SYNC', 'VERIFY');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('CLICKED', 'SIGNED_UP', 'TRIALING', 'CONVERTED', 'CHURNED');--> statement-breakpoint
CREATE TYPE "public"."return_fault" AS ENUM('SELLER', 'BUYER', 'CARRIER', 'PLATFORM');--> statement-breakpoint
CREATE TYPE "public"."return_reason_bucket" AS ENUM('SELLER_FAULT', 'BUYER_REMORSE', 'PLATFORM_CARRIER_FAULT', 'EDGE_CONDITIONAL');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('INAD', 'DAMAGED', 'INR', 'COUNTERFEIT', 'REMORSE', 'WRONG_ITEM');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('PENDING_SELLER', 'APPROVED', 'DECLINED', 'PARTIAL_OFFERED', 'BUYER_ACCEPTS_PARTIAL', 'BUYER_DECLINES_PARTIAL', 'LABEL_GENERATED', 'SHIPPED', 'DELIVERED', 'REFUND_ISSUED', 'CONDITION_DISPUTE', 'BUYER_ACCEPTS', 'ESCALATED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'APPROVED', 'FLAGGED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."seller_status" AS ENUM('ACTIVE', 'RESTRICTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."seller_type" AS ENUM('PERSONAL', 'BUSINESS');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('PENDING', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'LOST', 'DAMAGED_IN_TRANSIT', 'RETURN_TO_SENDER');--> statement-breakpoint
CREATE TYPE "public"."store_tier" AS ENUM('NONE', 'STARTER', 'PRO', 'POWER', 'ENTERPRISE');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('BASIC', 'TAX', 'ENHANCED', 'CATEGORY');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');--> statement-breakpoint
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
	"completed_purchase_count" integer DEFAULT 0 NOT NULL,
	"dashboard_layout_json" jsonb,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"anonymized_at" timestamp with time zone,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"banned_reason" text,
	"credit_balance_cents" integer DEFAULT 0 NOT NULL,
	"referred_by_affiliate_id" text,
	"local_reliability_marks" integer DEFAULT 0 NOT NULL,
	"local_transaction_count" integer DEFAULT 0 NOT NULL,
	"local_completion_rate" real,
	"local_suspended_until" timestamp with time zone,
	"local_fraud_banned_at" timestamp with time zone,
	"stripe_customer_id" text,
	"cookie_consent_json" jsonb,
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
	"lister_free_expires_at" timestamp with time zone,
	"has_automation" boolean DEFAULT false NOT NULL,
	"finance_tier" "finance_tier" DEFAULT 'FREE' NOT NULL,
	"bundle_tier" "bundle_tier" DEFAULT 'NONE' NOT NULL,
	"performance_band" "performance_band" DEFAULT 'EMERGING' NOT NULL,
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
	"vacation_mode_type" text,
	"vacation_auto_reply_message" text,
	"stripe_account_id" text,
	"stripe_customer_id" text,
	"stripe_onboarded" boolean DEFAULT false NOT NULL,
	"trust_score" real DEFAULT 80 NOT NULL,
	"trial_lister_used" boolean DEFAULT false NOT NULL,
	"trial_store_used" boolean DEFAULT false NOT NULL,
	"trial_automation_used" boolean DEFAULT false NOT NULL,
	"trial_finance_used" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_authenticated_seller" boolean DEFAULT false NOT NULL,
	"max_meetup_distance_miles" integer,
	"payout_frequency" text DEFAULT 'WEEKLY' NOT NULL,
	"finance_goals" jsonb,
	"affiliate_opt_in" boolean DEFAULT true NOT NULL,
	"affiliate_commission_bps" integer,
	"enforcement_level" text,
	"enforcement_started_at" timestamp with time zone,
	"warning_expires_at" timestamp with time zone,
	"band_override" "performance_band",
	"band_override_expires_at" timestamp with time zone,
	"band_override_reason" text,
	"band_override_by" text,
	"seller_score" integer DEFAULT 0 NOT NULL,
	"seller_score_updated_at" timestamp with time zone,
	"is_new" boolean DEFAULT true NOT NULL,
	"boost_credit_cents" integer DEFAULT 0 NOT NULL,
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
	"mfa_required" boolean DEFAULT false NOT NULL,
	"mfa_secret" text,
	"recovery_codes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"signature_html" text,
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
CREATE TABLE "module_registry" (
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
CREATE TABLE "bundle_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"tier" "bundle_tier" NOT NULL,
	"status" "subscription_status" DEFAULT 'ACTIVE' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"pending_tier" "bundle_tier",
	"pending_billing_interval" text,
	"pending_change_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bundle_subscription_seller_profile_id_unique" UNIQUE("seller_profile_id"),
	CONSTRAINT "bundle_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
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
	"pending_tier" text,
	"pending_billing_interval" text,
	"pending_change_at" timestamp with time zone,
	"store_tier_trial_used" boolean DEFAULT false NOT NULL,
	"store_tier_trial_started_at" timestamp with time zone,
	"store_tier_trial_ends_at" timestamp with time zone,
	"receipt_credits_used_this_month" integer DEFAULT 0 NOT NULL,
	"receipt_credits_period_start" timestamp with time zone,
	"tax_saved_cents" integer DEFAULT 0 NOT NULL,
	"tax_quarterly_payments_json" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_subscription_seller_profile_id_unique" UNIQUE("seller_profile_id"),
	CONSTRAINT "finance_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
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
	"pending_tier" "lister_tier",
	"pending_billing_interval" text,
	"pending_change_at" timestamp with time zone,
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
	"pending_tier" "store_tier",
	"pending_billing_interval" text,
	"pending_change_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_subscription_seller_profile_id_unique" UNIQUE("seller_profile_id"),
	CONSTRAINT "store_subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "trial_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_type" text NOT NULL,
	"trial_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ended_at" timestamp with time zone,
	"converted_to_subscription" boolean DEFAULT false NOT NULL,
	"stripe_subscription_id" text
);
--> statement-breakpoint
CREATE TABLE "listing" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"status" "listing_status" DEFAULT 'DRAFT' NOT NULL,
	"title" text,
	"description" text,
	"category_id" text,
	"storefront_category_id" text,
	"condition" "listing_condition",
	"brand" text,
	"price_cents" integer,
	"original_price_cents" integer,
	"cogs_cents" integer,
	"sourcing_expense_id" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"available_quantity" integer,
	"sold_quantity" integer DEFAULT 0 NOT NULL,
	"sold_price_cents" integer,
	"slug" text,
	"allow_offers" boolean DEFAULT false NOT NULL,
	"auto_accept_offer_cents" integer,
	"auto_decline_offer_cents" integer,
	"offer_expiry_hours" integer,
	"fulfillment_type" "fulfillment_type" DEFAULT 'SHIP_ONLY' NOT NULL,
	"local_pickup_radius_miles" integer,
	"local_handling_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"shipping_profile_id" text,
	"weight_oz" integer,
	"length_in" real,
	"width_in" real,
	"height_in" real,
	"free_shipping" boolean DEFAULT false NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"attributes_json" jsonb DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"authentication_status" "authentication_status" DEFAULT 'NONE' NOT NULL,
	"authentication_request_id" text,
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
	"archived_at" timestamp with time zone,
	"imported_from_channel" "channel",
	"imported_external_id" text,
	"video_url" text,
	"video_thumb_url" text,
	"video_duration_seconds" integer,
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
	"type" "offer_type" DEFAULT 'BEST_OFFER' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"parent_offer_id" text,
	"counter_by_role" text,
	"counter_count" integer DEFAULT 0 NOT NULL,
	"responded_at" timestamp with time zone,
	"stripe_hold_id" text,
	"shipping_address_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_price_history" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"price_cents" integer NOT NULL,
	"previous_cents" integer,
	"change_reason" text NOT NULL,
	"changed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "offer_bundle_item" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"combined_shipping_mode" "combined_shipping_mode" DEFAULT 'NONE' NOT NULL,
	"flat_combined_cents" integer,
	"additional_item_cents" integer,
	"auto_discount_percent" real,
	"auto_discount_min_items" integer DEFAULT 2,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"is_local_pickup" boolean DEFAULT false NOT NULL,
	"local_transaction_id" text,
	"combined_shipping_quote_id" text,
	"authentication_offered" boolean DEFAULT false NOT NULL,
	"authentication_declined" boolean DEFAULT false NOT NULL,
	"authentication_declined_at" timestamp with time zone,
	"authentication_request_id" text,
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
	"tf_rate_bps" integer,
	"tf_amount_cents" integer,
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
	"tf_amount_cents" integer,
	"tf_rate_bps" integer,
	"boost_fee_amount_cents" integer,
	"boost_rate_bps" integer,
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
	"bucket" "return_reason_bucket",
	"refund_item_cents" integer,
	"refund_shipping_cents" integer,
	"refund_tax_cents" integer,
	"restocking_fee_cents" integer,
	"fee_allocation_json" jsonb DEFAULT '{}' NOT NULL,
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
	"dsr_item_as_described" integer,
	"dsr_shipping_speed" integer,
	"dsr_communication" integer,
	"dsr_packaging" integer,
	"order_value_cents" integer,
	"had_dispute" boolean DEFAULT false NOT NULL,
	"dispute_outcome" text,
	"trust_weight" real DEFAULT 1 NOT NULL,
	"trust_weight_factors" jsonb DEFAULT '{}' NOT NULL,
	"visible_at" timestamp with time zone,
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
	"on_time_shipping_pct" real,
	"avg_response_time_hours" real,
	"trust_badge" text,
	"trust_badge_secondary" text,
	"display_stars" real,
	"show_stars" boolean DEFAULT true NOT NULL,
	"current_band" "performance_band" DEFAULT 'EMERGING' NOT NULL,
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
CREATE TABLE "notification_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"digest_frequency" text DEFAULT 'daily' NOT NULL,
	"digest_time_utc" text DEFAULT '14:00' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"daily_sales_summary" boolean DEFAULT false NOT NULL,
	"stale_listing_days" integer,
	"trust_score_alerts" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_setting_user_id_unique" UNIQUE("user_id")
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
CREATE TABLE "fee_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"fee_bucket" "fee_bucket" NOT NULL,
	"tf_rate_bps" integer NOT NULL,
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
	"idempotency_key" varchar(255),
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
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"is_instant" boolean DEFAULT false NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"snapshot_date" date,
	"search_multiplier" real,
	"on_time_shipping_pct" real,
	"inad_claim_rate_pct" real,
	"review_average" real,
	"response_time_hours" real,
	"return_rate_pct" real,
	"cancellation_rate_pct" real,
	"shipping_score" integer,
	"inad_score" integer,
	"review_score" integer,
	"response_score" integer,
	"return_score" integer,
	"cancellation_score" integer,
	"primary_fee_bucket" text,
	"trend_modifier" real,
	"bayesian_smoothing" real,
	"previous_band" "performance_band",
	"band_changed_at" timestamp with time zone
);
--> statement-breakpoint
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
CREATE TABLE "accounting_entity_map" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"twicely_entity_type" text NOT NULL,
	"twicely_entity_id" text NOT NULL,
	"external_entity_type" text NOT NULL,
	"external_entity_id" text NOT NULL,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_entity_map_integration_id_twicely_entity_type_twicely_entity_id_unique" UNIQUE("integration_id","twicely_entity_type","twicely_entity_id")
);
--> statement-breakpoint
CREATE TABLE "accounting_integration" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"external_account_id" text,
	"last_sync_at" timestamp with time zone,
	"status" text NOT NULL,
	"sync_frequency" text DEFAULT 'DAILY',
	"last_sync_status" text,
	"sync_error_count" integer DEFAULT 0 NOT NULL,
	"company_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_integration_user_id_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "accounting_sync_log" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"records_synced" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
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
	"sourcing_trip_group_id" text,
	"is_auto_logged" boolean DEFAULT false NOT NULL,
	"auto_log_event_type" text,
	"recurring_expense_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_projection" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL,
	"projected_revenue_30d_cents" integer,
	"projected_expenses_30d_cents" integer,
	"projected_profit_30d_cents" integer,
	"sell_through_rate_90d" integer,
	"avg_sale_price_90d_cents" integer,
	"effective_fee_rate_90d" integer,
	"avg_days_to_sell_90d" integer,
	"break_even_revenue_cents" integer,
	"break_even_orders" integer,
	"health_score" integer,
	"health_score_breakdown_json" jsonb,
	"inventory_turns_per_month" integer,
	"performing_periods_json" jsonb,
	"data_quality_score" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_projection_seller_profile_id_unique" UNIQUE("seller_profile_id")
);
--> statement-breakpoint
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
CREATE TABLE "recurring_expense" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"vendor" text,
	"description" text,
	"frequency" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_created_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
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
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"overrides_json" jsonb DEFAULT '{}' NOT NULL,
	"platform_data_json" jsonb DEFAULT '{}' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"last_canonical_hash" text,
	"has_pending_sync" boolean DEFAULT false NOT NULL,
	"external_diff" jsonb,
	"publish_attempts" integer DEFAULT 0 NOT NULL,
	"last_publish_error" text,
	"poll_tier" "poll_tier" DEFAULT 'COLD' NOT NULL,
	"next_poll_at" timestamp with time zone,
	"last_polled_at" timestamp with time zone,
	"pre_poll_tier" "poll_tier",
	"orphaned_at" timestamp with time zone,
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
CREATE TABLE "publish_credit_ledger" (
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
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
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
	"business_hours_only" boolean DEFAULT true NOT NULL,
	"escalate_on_breach" boolean DEFAULT false NOT NULL,
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
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "browsing_history_user_id_listing_id_unique" UNIQUE("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "buyer_block_list" (
	"id" text PRIMARY KEY NOT NULL,
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_block_list_blocker_id_blocked_id_unique" UNIQUE("blocker_id","blocked_id")
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_interest" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tag_slug" varchar(50) NOT NULL,
	"weight" numeric(6, 3) DEFAULT '1.0' NOT NULL,
	"source" "interest_source" NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interest_user_id_tag_slug_source_unique" UNIQUE("user_id","tag_slug","source")
);
--> statement-breakpoint
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
CREATE TABLE "local_fraud_flag" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"local_transaction_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"trigger" text NOT NULL,
	"severity" "local_fraud_flag_severity" NOT NULL,
	"status" "local_fraud_flag_status" DEFAULT 'OPEN' NOT NULL,
	"details_json" jsonb DEFAULT '{}' NOT NULL,
	"resolved_by_staff_id" text,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"refund_issued_at" timestamp with time zone,
	"listing_removed_at" timestamp with time zone,
	"seller_banned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_reliability_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"event_type" "local_reliability_event_type" NOT NULL,
	"marks_applied" integer NOT NULL,
	"decays_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"meetup_location_id" text,
	"status" "local_transaction_status" DEFAULT 'SCHEDULED' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"scheduled_at_confirmed_at" timestamp with time zone,
	"scheduling_proposed_by" text,
	"seller_confirmation_code" text NOT NULL,
	"seller_offline_code" text NOT NULL,
	"buyer_confirmation_code" text NOT NULL,
	"buyer_offline_code" text NOT NULL,
	"confirmation_mode" "confirmation_mode",
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
	"adjusted_price_cents" integer,
	"adjustment_reason" text,
	"adjustment_initiated_at" timestamp with time zone,
	"adjustment_accepted_at" timestamp with time zone,
	"adjustment_declined_at" timestamp with time zone,
	"reschedule_count" integer DEFAULT 0 NOT NULL,
	"last_rescheduled_at" timestamp with time zone,
	"last_rescheduled_by" text,
	"original_scheduled_at" timestamp with time zone,
	"reschedule_proposed_at" timestamp with time zone,
	"canceled_by_party" text,
	"day_of_confirmation_sent_at" timestamp with time zone,
	"day_of_confirmation_responded_at" timestamp with time zone,
	"day_of_confirmation_expired" boolean DEFAULT false NOT NULL,
	"meetup_photo_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"meetup_photos_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_transaction_seller_confirmation_code_unique" UNIQUE("seller_confirmation_code"),
	CONSTRAINT "local_transaction_buyer_confirmation_code_unique" UNIQUE("buyer_confirmation_code")
);
--> statement-breakpoint
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
	"suspended_until" timestamp with time zone,
	"suspended_reason" text,
	"application_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "affiliate_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
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
CREATE TABLE "affiliate_payout" (
	"id" text PRIMARY KEY NOT NULL,
	"affiliate_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text NOT NULL,
	"external_payout_id" text,
	"status" "payout_status" DEFAULT 'PENDING' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
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
	"listing_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "curated_collection_item" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curated_collection_item_collection_id_listing_id_unique" UNIQUE("collection_id","listing_id")
);
--> statement-breakpoint
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
CREATE TABLE "live_session_product" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"featured_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_session_product_session_id_listing_id_unique" UNIQUE("session_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "ai_autofill_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month_key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_autofill_usage_user_id_month_key_unique" UNIQUE("user_id","month_key")
);
--> statement-breakpoint
CREATE TABLE "content_report" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_user_id" text NOT NULL,
	"target_type" "content_report_target" NOT NULL,
	"target_id" text NOT NULL,
	"reason" "content_report_reason" NOT NULL,
	"description" text,
	"status" "content_report_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by_staff_id" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"enforcement_action_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enforcement_action" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action_type" "enforcement_action_type" NOT NULL,
	"trigger" "enforcement_trigger" NOT NULL,
	"status" "enforcement_action_status" DEFAULT 'ACTIVE' NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"content_report_id" text,
	"issued_by_staff_id" text,
	"expires_at" timestamp with time zone,
	"lifted_at" timestamp with time zone,
	"lifted_by_staff_id" text,
	"lifted_reason" text,
	"appeal_note" text,
	"appeal_evidence_urls" text[] DEFAULT '{}'::text[] NOT NULL,
	"appealed_at" timestamp with time zone,
	"appealed_by_user_id" text,
	"appeal_reviewed_by_staff_id" text,
	"appeal_review_note" text,
	"appeal_resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_export_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"format" text DEFAULT 'json' NOT NULL,
	"download_url" text,
	"download_expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"level" "verification_level" NOT NULL,
	"status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"stripe_session_id" text,
	"stripe_report_id" text,
	"verified_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"expires_at" timestamp with time zone,
	"triggered_by" text NOT NULL,
	"triggered_by_staff_id" text,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"retry_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriber" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" "newsletter_source" DEFAULT 'HOMEPAGE_SECTION' NOT NULL,
	"unsubscribe_token" text NOT NULL,
	"unsubscribe_token_expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"welcome_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscriber_email_unique" UNIQUE("email"),
	CONSTRAINT "newsletter_subscriber_token_unique" UNIQUE("unsubscribe_token")
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
ALTER TABLE "platform_setting_history" ADD CONSTRAINT "platform_setting_history_setting_id_platform_setting_id_fk" FOREIGN KEY ("setting_id") REFERENCES "public"."platform_setting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_custom_role" ADD CONSTRAINT "staff_user_custom_role_staff_user_id_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_custom_role" ADD CONSTRAINT "staff_user_custom_role_custom_role_id_custom_role_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_health_log" ADD CONSTRAINT "provider_health_log_instance_id_provider_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_instance" ADD CONSTRAINT "provider_instance_adapter_id_provider_adapter_id_fk" FOREIGN KEY ("adapter_id") REFERENCES "public"."provider_adapter"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_secret" ADD CONSTRAINT "provider_secret_instance_id_provider_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_mapping" ADD CONSTRAINT "pum_primary_instance_fk" FOREIGN KEY ("primary_instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_mapping" ADD CONSTRAINT "pum_fallback_instance_fk" FOREIGN KEY ("fallback_instance_id") REFERENCES "public"."provider_instance"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_subscription" ADD CONSTRAINT "automation_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_subscription" ADD CONSTRAINT "bundle_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_access" ADD CONSTRAINT "delegated_access_seller_id_seller_profile_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_access" ADD CONSTRAINT "delegated_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD CONSTRAINT "finance_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lister_subscription" ADD CONSTRAINT "lister_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_subscription" ADD CONSTRAINT "store_subscription_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_usage" ADD CONSTRAINT "trial_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_storefront_category_id_storefront_custom_category_id_fk" FOREIGN KEY ("storefront_category_id") REFERENCES "public"."storefront_custom_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_fee" ADD CONSTRAINT "listing_fee_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_image" ADD CONSTRAINT "listing_image_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_offer" ADD CONSTRAINT "listing_offer_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_offer" ADD CONSTRAINT "listing_offer_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_version" ADD CONSTRAINT "listing_version_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_bundle_item" ADD CONSTRAINT "offer_bundle_item_offer_id_listing_offer_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."listing_offer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_bundle_item" ADD CONSTRAINT "offer_bundle_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD CONSTRAINT "shipping_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watcher_offer" ADD CONSTRAINT "watcher_offer_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_return_request_id_return_request_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_review" ADD CONSTRAINT "buyer_review_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_review" ADD CONSTRAINT "buyer_review_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_review" ADD CONSTRAINT "buyer_review_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_response" ADD CONSTRAINT "review_response_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_performance" ADD CONSTRAINT "seller_performance_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_setting" ADD CONSTRAINT "notification_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_protection_claim" ADD CONSTRAINT "buyer_protection_claim_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_protection_claim" ADD CONSTRAINT "buyer_protection_claim_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_adjustment" ADD CONSTRAINT "manual_adjustment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_adjustment" ADD CONSTRAINT "manual_adjustment_ledger_entry_id_ledger_entry_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout" ADD CONSTRAINT "payout_batch_id_payout_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."payout_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_balance" ADD CONSTRAINT "seller_balance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_score_snapshot" ADD CONSTRAINT "seller_score_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_entity_map" ADD CONSTRAINT "accounting_entity_map_integration_id_accounting_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."accounting_integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_integration" ADD CONSTRAINT "accounting_integration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_sync_log" ADD CONSTRAINT "accounting_sync_log_integration_id_accounting_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."accounting_integration"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_projection" ADD CONSTRAINT "financial_projection_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_report" ADD CONSTRAINT "financial_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mileage_entry" ADD CONSTRAINT "mileage_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_setting" ADD CONSTRAINT "automation_setting_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_category_mapping" ADD CONSTRAINT "channel_category_mapping_twicely_category_id_category_id_fk" FOREIGN KEY ("twicely_category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_projection" ADD CONSTRAINT "channel_projection_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_projection" ADD CONSTRAINT "channel_projection_account_id_crosslister_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crosslister_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_job" ADD CONSTRAINT "cross_job_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_job" ADD CONSTRAINT "cross_job_projection_id_channel_projection_id_fk" FOREIGN KEY ("projection_id") REFERENCES "public"."channel_projection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_job" ADD CONSTRAINT "cross_job_account_id_crosslister_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crosslister_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crosslister_account" ADD CONSTRAINT "crosslister_account_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dedupe_fingerprint" ADD CONSTRAINT "dedupe_fingerprint_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_account_id_crosslister_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."crosslister_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_record" ADD CONSTRAINT "import_record_batch_id_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_record" ADD CONSTRAINT "import_record_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_credit_ledger" ADD CONSTRAINT "publish_credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_credit_ledger" ADD CONSTRAINT "publish_credit_ledger_lister_subscription_id_lister_subscription_id_fk" FOREIGN KEY ("lister_subscription_id") REFERENCES "public"."lister_subscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_csat" ADD CONSTRAINT "case_csat_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_message" ADD CONSTRAINT "case_message_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_watcher" ADD CONSTRAINT "case_watcher_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_team_member" ADD CONSTRAINT "helpdesk_team_member_team_id_helpdesk_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."helpdesk_team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article" ADD CONSTRAINT "kb_article_category_id_kb_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."kb_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_attachment" ADD CONSTRAINT "kb_article_attachment_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_feedback" ADD CONSTRAINT "kb_article_feedback_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_relation" ADD CONSTRAINT "kb_article_relation_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_article_relation" ADD CONSTRAINT "kb_article_relation_related_article_id_kb_article_id_fk" FOREIGN KEY ("related_article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_case_article_link" ADD CONSTRAINT "kb_case_article_link_case_id_helpdesk_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."helpdesk_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_case_article_link" ADD CONSTRAINT "kb_case_article_link_article_id_kb_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."kb_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoted_listing" ADD CONSTRAINT "promoted_listing_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoted_listing_event" ADD CONSTRAINT "promoted_listing_event_promoted_listing_id_promoted_listing_id_fk" FOREIGN KEY ("promoted_listing_id") REFERENCES "public"."promoted_listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_promotion_id_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotion"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_block_list" ADD CONSTRAINT "buyer_block_list_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_block_list" ADD CONSTRAINT "buyer_block_list_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_followed_id_user_id_fk" FOREIGN KEY ("followed_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_info" ADD CONSTRAINT "tax_info_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_quote" ADD CONSTRAINT "tax_quote_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interest" ADD CONSTRAINT "user_interest_tag_slug_interest_tag_slug_fk" FOREIGN KEY ("tag_slug") REFERENCES "public"."interest_tag"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront" ADD CONSTRAINT "storefront_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_custom_category" ADD CONSTRAINT "storefront_custom_category_storefront_id_storefront_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefront"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_page" ADD CONSTRAINT "storefront_page_storefront_id_storefront_id_fk" FOREIGN KEY ("storefront_id") REFERENCES "public"."storefront"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_alert" ADD CONSTRAINT "category_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_alert" ADD CONSTRAINT "category_alert_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combined_shipping_quote" ADD CONSTRAINT "combined_shipping_quote_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combined_shipping_quote" ADD CONSTRAINT "combined_shipping_quote_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combined_shipping_quote" ADD CONSTRAINT "combined_shipping_quote_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_fraud_flag" ADD CONSTRAINT "local_fraud_flag_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_fraud_flag" ADD CONSTRAINT "local_fraud_flag_local_transaction_id_local_transaction_id_fk" FOREIGN KEY ("local_transaction_id") REFERENCES "public"."local_transaction"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_fraud_flag" ADD CONSTRAINT "local_fraud_flag_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_reliability_event" ADD CONSTRAINT "local_reliability_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_reliability_event" ADD CONSTRAINT "local_reliability_event_transaction_id_local_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."local_transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_transaction" ADD CONSTRAINT "local_transaction_meetup_location_id_safe_meetup_location_id_fk" FOREIGN KEY ("meetup_location_id") REFERENCES "public"."safe_meetup_location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authentication_request" ADD CONSTRAINT "authentication_request_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authentication_request" ADD CONSTRAINT "authentication_request_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authentication_request" ADD CONSTRAINT "authentication_request_authenticator_id_authenticator_partner_id_fk" FOREIGN KEY ("authenticator_id") REFERENCES "public"."authenticator_partner"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_category_summary" ADD CONSTRAINT "market_category_summary_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_listing_intelligence" ADD CONSTRAINT "market_listing_intelligence_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_offer_intelligence" ADD CONSTRAINT "market_offer_intelligence_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_price_point" ADD CONSTRAINT "market_price_point_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate" ADD CONSTRAINT "affiliate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commission" ADD CONSTRAINT "affiliate_commission_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_redemption" ADD CONSTRAINT "promo_code_redemption_promo_code_id_promo_code_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_code"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_redemption" ADD CONSTRAINT "promo_code_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_affiliate_id_affiliate_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_promo_code_id_promo_code_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_code"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_referral" ADD CONSTRAINT "buyer_referral_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_referral" ADD CONSTRAINT "buyer_referral_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_category_mapping" ADD CONSTRAINT "google_category_mapping_twicely_category_id_category_id_fk" FOREIGN KEY ("twicely_category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_collection" ADD CONSTRAINT "curated_collection_curated_by_user_id_fk" FOREIGN KEY ("curated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_collection_item" ADD CONSTRAINT "curated_collection_item_collection_id_curated_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."curated_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_collection_item" ADD CONSTRAINT "curated_collection_item_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curated_collection_item" ADD CONSTRAINT "curated_collection_item_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_question" ADD CONSTRAINT "listing_question_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_question" ADD CONSTRAINT "listing_question_asker_id_user_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_question" ADD CONSTRAINT "listing_question_answered_by_user_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_session" ADD CONSTRAINT "live_session_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_session_product" ADD CONSTRAINT "live_session_product_session_id_live_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_session_product" ADD CONSTRAINT "live_session_product_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_autofill_usage" ADD CONSTRAINT "ai_autofill_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enforcement_action" ADD CONSTRAINT "enforcement_action_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verification" ADD CONSTRAINT "identity_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "mr_state" ON "module_registry" USING btree ("state");--> statement-breakpoint
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
CREATE INDEX "lst_storefront_cat" ON "listing" USING btree ("storefront_category_id");--> statement-breakpoint
CREATE INDEX "lst_status_created" ON "listing" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "lst_price" ON "listing" USING btree ("price_cents");--> statement-breakpoint
CREATE INDEX "lst_slug" ON "listing" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lst_enforcement" ON "listing" USING btree ("enforcement_state");--> statement-breakpoint
CREATE INDEX "lst_expires" ON "listing" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "lst_fulfillment" ON "listing" USING btree ("fulfillment_type");--> statement-breakpoint
CREATE INDEX "lst_auth_status" ON "listing" USING btree ("authentication_status");--> statement-breakpoint
CREATE INDEX "lst_cogs" ON "listing" USING btree ("cogs_cents") WHERE cogs_cents IS NOT NULL;--> statement-breakpoint
CREATE INDEX "lf_seller" ON "listing_fee" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "lf_listing" ON "listing_fee" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "li_listing" ON "listing_image" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "lo_listing_status" ON "listing_offer" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "lo_buyer_status" ON "listing_offer" USING btree ("buyer_id","status");--> statement-breakpoint
CREATE INDEX "lo_seller_status" ON "listing_offer" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "lo_expires" ON "listing_offer" USING btree ("expires_at","status");--> statement-breakpoint
CREATE INDEX "lo_parent_offer" ON "listing_offer" USING btree ("parent_offer_id");--> statement-breakpoint
CREATE INDEX "lph_listing" ON "listing_price_history" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "obi_offer" ON "offer_bundle_item" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "obi_listing" ON "offer_bundle_item" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "shp_user" ON "shipping_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wo_listing" ON "watcher_offer" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "wo_seller" ON "watcher_offer" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "wo_expires" ON "watcher_offer" USING btree ("expires_at");--> statement-breakpoint
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
CREATE INDEX "br_buyer" ON "buyer_review" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "br_seller" ON "buyer_review" USING btree ("seller_user_id");--> statement-breakpoint
CREATE INDEX "br_order" ON "buyer_review" USING btree ("order_id");--> statement-breakpoint
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
CREATE INDEX "bpc_order" ON "buyer_protection_claim" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "bpc_buyer" ON "buyer_protection_claim" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "bpc_status" ON "buyer_protection_claim" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fs_bucket_effective" ON "fee_schedule" USING btree ("fee_bucket","effective_at");--> statement-breakpoint
CREATE INDEX "le_user_type" ON "ledger_entry" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "le_user_created" ON "ledger_entry" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "le_order" ON "ledger_entry" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "le_stripe_event" ON "ledger_entry" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "le_status" ON "ledger_entry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "le_reversal" ON "ledger_entry" USING btree ("reversal_of_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "le_uniq_refund" ON "ledger_entry" USING btree ("stripe_refund_id","type") WHERE stripe_refund_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "le_uniq_dispute" ON "ledger_entry" USING btree ("stripe_dispute_id","type") WHERE stripe_dispute_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "le_uniq_idempotency" ON "ledger_entry" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "po_user" ON "payout" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "po_batch" ON "payout" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "po_status" ON "payout" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sss_seller_period" ON "seller_score_snapshot" USING btree ("seller_profile_id","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "sss_user_date_idx" ON "seller_score_snapshot" USING btree ("user_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "sss_date_idx" ON "seller_score_snapshot" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "sel_stripe_event" ON "stripe_event_log" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "sel_status" ON "stripe_event_log" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "sel_event_type" ON "stripe_event_log" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "aem_external" ON "accounting_entity_map" USING btree ("integration_id","external_entity_id");--> statement-breakpoint
CREATE INDEX "asl_integration" ON "accounting_sync_log" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "asl_status" ON "accounting_sync_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exp_user_date" ON "expense" USING btree ("user_id","expense_date");--> statement-breakpoint
CREATE INDEX "exp_user_cat" ON "expense" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "exp_sourcing_trip" ON "expense" USING btree ("sourcing_trip_group_id") WHERE sourcing_trip_group_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "fr_user_type" ON "financial_report" USING btree ("user_id","report_type");--> statement-breakpoint
CREATE INDEX "mi_user_date" ON "mileage_entry" USING btree ("user_id","trip_date");--> statement-breakpoint
CREATE INDEX "re_user_active" ON "recurring_expense" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "cpr_channel_field" ON "channel_policy_rule" USING btree ("channel","field");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projection_external" ON "channel_projection" USING btree ("seller_id","channel","external_id");--> statement-breakpoint
CREATE INDEX "cp_seller_channel" ON "channel_projection" USING btree ("seller_id","channel");--> statement-breakpoint
CREATE INDEX "cp_status" ON "channel_projection" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cp_pending_sync" ON "channel_projection" USING btree ("has_pending_sync");--> statement-breakpoint
CREATE INDEX "cp_next_poll" ON "channel_projection" USING btree ("next_poll_at");--> statement-breakpoint
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
CREATE INDEX "pcl_user_expires" ON "publish_credit_ledger" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "pcl_sub" ON "publish_credit_ledger" USING btree ("lister_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pcl_stripe_session" ON "publish_credit_ledger" USING btree ("stripe_session_id");--> statement-breakpoint
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
CREATE INDEX "ple_promoted" ON "promoted_listing_event" USING btree ("promoted_listing_id","event_type");--> statement-breakpoint
CREATE INDEX "ple_event_type" ON "promoted_listing_event" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "promo_seller" ON "promotion" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "promo_coupon" ON "promotion" USING btree ("coupon_code");--> statement-breakpoint
CREATE INDEX "promo_active" ON "promotion" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "pu_promotion" ON "promotion_usage" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "pu_buyer_promo" ON "promotion_usage" USING btree ("buyer_id","promotion_id");--> statement-breakpoint
CREATE INDEX "bh_user_viewed" ON "browsing_history" USING btree ("user_id","last_viewed_at");--> statement-breakpoint
CREATE INDEX "bbl_blocker" ON "buyer_block_list" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "bbl_blocked" ON "buyer_block_list" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "fol_follower" ON "follow" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "fol_followed" ON "follow" USING btree ("followed_id");--> statement-breakpoint
CREATE INDEX "ss_user" ON "saved_search" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wl_listing" ON "watchlist_item" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "tq_order" ON "tax_quote" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_interest_tag_group" ON "interest_tag" USING btree ("group");--> statement-breakpoint
CREATE INDEX "idx_user_interest_user_id" ON "user_interest" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_interest_expires_at" ON "user_interest" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sf_owner" ON "storefront" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "sf_slug" ON "storefront" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sf_published" ON "storefront" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "scc_storefront" ON "storefront_custom_category" USING btree ("storefront_id");--> statement-breakpoint
CREATE INDEX "scc_sort" ON "storefront_custom_category" USING btree ("storefront_id","sort_order");--> statement-breakpoint
CREATE INDEX "sfp_storefront" ON "storefront_page" USING btree ("storefront_id");--> statement-breakpoint
CREATE INDEX "sfp_sort" ON "storefront_page" USING btree ("storefront_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "sfp_unique_slug" ON "storefront_page" USING btree ("storefront_id","slug");--> statement-breakpoint
CREATE INDEX "ca_user" ON "category_alert" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ca_category" ON "category_alert" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "pa_user" ON "price_alert" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pa_listing" ON "price_alert" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "pa_active" ON "price_alert" USING btree ("is_active","listing_id");--> statement-breakpoint
CREATE INDEX "csq_order" ON "combined_shipping_quote" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "csq_deadline" ON "combined_shipping_quote" USING btree ("seller_deadline","status");--> statement-breakpoint
CREATE INDEX "lff_seller" ON "local_fraud_flag" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "lff_transaction" ON "local_fraud_flag" USING btree ("local_transaction_id");--> statement-breakpoint
CREATE INDEX "lff_status" ON "local_fraud_flag" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lff_severity" ON "local_fraud_flag" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "lre_user" ON "local_reliability_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lre_transaction" ON "local_reliability_event" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "lre_decays_at" ON "local_reliability_event" USING btree ("decays_at");--> statement-breakpoint
CREATE INDEX "lt_order" ON "local_transaction" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "lt_buyer" ON "local_transaction" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "lt_seller" ON "local_transaction" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "lt_status" ON "local_transaction" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lt_seller_confirm" ON "local_transaction" USING btree ("seller_confirmation_code");--> statement-breakpoint
CREATE INDEX "lt_buyer_confirm" ON "local_transaction" USING btree ("buyer_confirmation_code");--> statement-breakpoint
CREATE INDEX "sml_city" ON "safe_meetup_location" USING btree ("city","state");--> statement-breakpoint
CREATE INDEX "sml_geo" ON "safe_meetup_location" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "ar_listing" ON "authentication_request" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "ar_seller" ON "authentication_request" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "ar_cert" ON "authentication_request" USING btree ("certificate_number");--> statement-breakpoint
CREATE INDEX "ar_status" ON "authentication_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mcs_cat_period" ON "market_category_summary" USING btree ("category_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "mcs_brand" ON "market_category_summary" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "mli_listing" ON "market_listing_intelligence" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "mli_expires" ON "market_listing_intelligence" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "moi_cat_cond" ON "market_offer_intelligence" USING btree ("category_id","condition_bucket");--> statement-breakpoint
CREATE INDEX "moi_price_bucket" ON "market_offer_intelligence" USING btree ("price_bucket_cents");--> statement-breakpoint
CREATE INDEX "mpp_cat_cond_brand_sold" ON "market_price_point" USING btree ("category_id","condition_bucket","brand","sold_at");--> statement-breakpoint
CREATE INDEX "mpp_sold_at" ON "market_price_point" USING btree ("sold_at");--> statement-breakpoint
CREATE INDEX "mpp_source" ON "market_price_point" USING btree ("source");--> statement-breakpoint
CREATE INDEX "aff_user" ON "affiliate" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "aff_status" ON "affiliate" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ac_affiliate" ON "affiliate_commission" USING btree ("affiliate_id","status");--> statement-breakpoint
CREATE INDEX "ac_referral" ON "affiliate_commission" USING btree ("referral_id");--> statement-breakpoint
CREATE INDEX "ac_hold" ON "affiliate_commission" USING btree ("hold_expires_at");--> statement-breakpoint
CREATE INDEX "ac_invoice" ON "affiliate_commission" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "ap_affiliate" ON "affiliate_payout" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "ap_status" ON "affiliate_payout" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pc_affiliate" ON "promo_code" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "pc_type" ON "promo_code" USING btree ("type");--> statement-breakpoint
CREATE INDEX "pcr_promo" ON "promo_code_redemption" USING btree ("promo_code_id");--> statement-breakpoint
CREATE INDEX "pcr_user" ON "promo_code_redemption" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ref_affiliate" ON "referral" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "ref_referred" ON "referral" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "ref_status" ON "referral" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ref_expires" ON "referral" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ref_listing" ON "referral" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "br_referrer" ON "buyer_referral" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "br_referred" ON "buyer_referral" USING btree ("referred_user_id");--> statement-breakpoint
CREATE INDEX "br_status" ON "buyer_referral" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cc_slug" ON "curated_collection" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cc_published" ON "curated_collection" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE INDEX "cci_collection" ON "curated_collection_item" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX "lq_listing" ON "listing_question" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "lq_asker" ON "listing_question" USING btree ("asker_id");--> statement-breakpoint
CREATE INDEX "lq_pinned" ON "listing_question" USING btree ("listing_id","is_pinned");--> statement-breakpoint
CREATE INDEX "ls_seller" ON "live_session" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "ls_status" ON "live_session" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ls_scheduled" ON "live_session" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "lsp_session" ON "live_session_product" USING btree ("session_id","sort_order");--> statement-breakpoint
CREATE INDEX "aau_user" ON "ai_autofill_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cr_reporter" ON "content_report" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "cr_target" ON "content_report" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "cr_status" ON "content_report" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cr_created" ON "content_report" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ea_user" ON "enforcement_action" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ea_type" ON "enforcement_action" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "ea_status" ON "enforcement_action" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ea_trigger" ON "enforcement_action" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "ea_created" ON "enforcement_action" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "der_user" ON "data_export_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "der_status" ON "data_export_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "iv_user" ON "identity_verification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "iv_status" ON "identity_verification" USING btree ("status");--> statement-breakpoint
CREATE INDEX "iv_level" ON "identity_verification" USING btree ("level");--> statement-breakpoint
CREATE INDEX "newsletter_subscriber_email_idx" ON "newsletter_subscriber" USING btree ("email");--> statement-breakpoint
CREATE INDEX "newsletter_subscriber_created_at_idx" ON "newsletter_subscriber" USING btree ("created_at");