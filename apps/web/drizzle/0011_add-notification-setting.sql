-- E1.1: Notification Preferences — Digest + Quiet Hours
-- Adds the notification_setting table for user-level digest frequency,
-- quiet hours configuration, and seller-specific notification controls.

CREATE TABLE "notification_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL UNIQUE,
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_setting" ADD CONSTRAINT "notification_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
