-- Intelligence Layer Schema — Financial Center Canonical v3.0
-- Adds tables and columns required by the intelligence layer (§6).
-- D4 Financial Center and F5 crosslister sale detection are installed.
-- Schema additions only — no existing columns modified or removed.

-- ─── NEW TABLE: financial_projection ─────────────────────────────────────────
-- Nightly cache for all computed intelligence metrics per seller (§18.6)

CREATE TABLE "financial_projection" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_profile_id" text NOT NULL UNIQUE,
	"projected_revenue_30d" integer,
	"projected_expenses_30d" integer,
	"projected_profit_30d" integer,
	"sell_through_rate_90d" integer,
	"avg_sale_price_90d" integer,
	"effective_fee_rate_90d" integer,
	"avg_days_to_sell_90d" integer,
	"break_even_revenue" integer,
	"break_even_orders" integer,
	"health_score" integer,
	"health_score_breakdown_json" jsonb,
	"inventory_turns_per_month" integer,
	"performing_periods_json" jsonb,
	"data_quality_score" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_projection" ADD CONSTRAINT "financial_projection_seller_profile_id_seller_profile_id_fk" FOREIGN KEY ("seller_profile_id") REFERENCES "public"."seller_profile"("id") ON DELETE no action ON UPDATE no action;

-- ─── NEW TABLE: recurring_expense ────────────────────────────────────────────
-- Rules for auto-creating seller expense entries on a schedule (§18.7)

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
ALTER TABLE "recurring_expense" ADD CONSTRAINT "recurring_expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "re_user_active" ON "recurring_expense" USING btree ("user_id","is_active");

-- ─── ADD COLUMNS: finance_subscription ───────────────────────────────────────
-- Intelligence layer trial, receipt credits, tax features (§2, §3, §6.5, §6.6)

--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD COLUMN "store_tier_trial_used" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD COLUMN "store_tier_trial_started_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD COLUMN "store_tier_trial_ends_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD COLUMN "receipt_credits_used_this_month" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD COLUMN "receipt_credits_period_start" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD COLUMN "tax_saved_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "finance_subscription" ADD COLUMN "tax_quarterly_payments_json" jsonb DEFAULT '{}' NOT NULL;

-- ─── ADD COLUMNS: listing ────────────────────────────────────────────────────
-- Sourcing expense link (cogsCents already exists)

--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "sourcing_expense_id" text;
--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_sourcing_expense_id_expense_id_fk" FOREIGN KEY ("sourcing_expense_id") REFERENCES "public"."expense"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "lst_cogs" ON "listing" USING btree ("cogs_cents") WHERE cogs_cents IS NOT NULL;

-- ─── ADD COLUMNS: expense ────────────────────────────────────────────────────
-- Sourcing trips, auto-logging, recurring expense link

--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "sourcing_trip_group_id" text;
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "is_auto_logged" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "auto_log_event_type" text;
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "recurring_expense_id" text;
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_recurring_expense_id_recurring_expense_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expense"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "exp_sourcing_trip" ON "expense" USING btree ("sourcing_trip_group_id") WHERE sourcing_trip_group_id IS NOT NULL;

-- ─── ADD COLUMN: seller_profile ──────────────────────────────────────────────
-- Goal tracker storage (§6.1)

--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "finance_goals" jsonb;
