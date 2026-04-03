-- G4: Enforcement & Moderation Infrastructure
-- Adds content report system, enforcement action tracking, and sellerProfile enforcement fields.

-- 1. New enums

CREATE TYPE "content_report_reason" AS ENUM (
  'COUNTERFEIT', 'PROHIBITED_ITEM', 'MISLEADING', 'STOLEN_PROPERTY',
  'HARASSMENT', 'SPAM', 'INAPPROPRIATE_CONTENT', 'FEE_AVOIDANCE',
  'SHILL_REVIEWS', 'OTHER'
);

CREATE TYPE "content_report_status" AS ENUM (
  'PENDING', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED'
);

CREATE TYPE "content_report_target" AS ENUM (
  'LISTING', 'REVIEW', 'MESSAGE', 'USER'
);

CREATE TYPE "enforcement_action_type" AS ENUM (
  'COACHING', 'WARNING', 'RESTRICTION', 'PRE_SUSPENSION', 'SUSPENSION',
  'LISTING_REMOVAL', 'LISTING_SUPPRESSION', 'REVIEW_REMOVAL',
  'BOOST_DISABLED', 'LISTING_CAP', 'SEARCH_DEMOTION', 'ACCOUNT_BAN'
);

CREATE TYPE "enforcement_action_status" AS ENUM (
  'ACTIVE', 'EXPIRED', 'LIFTED', 'APPEALED', 'APPEAL_APPROVED'
);

CREATE TYPE "enforcement_trigger" AS ENUM (
  'SCORE_BASED', 'POLICY_VIOLATION', 'CONTENT_REPORT', 'ADMIN_MANUAL', 'SYSTEM_AUTO'
);

-- 2. content_report table

CREATE TABLE IF NOT EXISTS "content_report" (
  "id" text PRIMARY KEY NOT NULL,
  "reporter_user_id" text NOT NULL REFERENCES "user"("id"),
  "target_type" "content_report_target" NOT NULL,
  "target_id" text NOT NULL,
  "reason" "content_report_reason" NOT NULL,
  "description" text,
  "status" "content_report_status" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_staff_id" text,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "enforcement_action_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "cr_reporter" ON "content_report" ("reporter_user_id");
CREATE INDEX "cr_target" ON "content_report" ("target_type", "target_id");
CREATE INDEX "cr_status" ON "content_report" ("status");
CREATE INDEX "cr_created" ON "content_report" ("created_at");

-- 3. enforcement_action table

CREATE TABLE IF NOT EXISTS "enforcement_action" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id"),
  "action_type" "enforcement_action_type" NOT NULL,
  "trigger" "enforcement_trigger" NOT NULL,
  "status" "enforcement_action_status" NOT NULL DEFAULT 'ACTIVE',
  "reason" text NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}',
  "content_report_id" text,
  "issued_by_staff_id" text,
  "expires_at" timestamp with time zone,
  "lifted_at" timestamp with time zone,
  "lifted_by_staff_id" text,
  "lifted_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "ea_user" ON "enforcement_action" ("user_id");
CREATE INDEX "ea_type" ON "enforcement_action" ("action_type");
CREATE INDEX "ea_status" ON "enforcement_action" ("status");
CREATE INDEX "ea_trigger" ON "enforcement_action" ("trigger");
CREATE INDEX "ea_created" ON "enforcement_action" ("created_at");

-- 4. Add enforcement fields to seller_profile

ALTER TABLE "seller_profile"
  ADD COLUMN IF NOT EXISTS "enforcement_level" text,
  ADD COLUMN IF NOT EXISTS "enforcement_started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "warning_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "band_override" "performance_band",
  ADD COLUMN IF NOT EXISTS "band_override_expires_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "band_override_reason" text,
  ADD COLUMN IF NOT EXISTS "band_override_by" text;
