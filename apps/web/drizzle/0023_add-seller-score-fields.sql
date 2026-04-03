-- G4.1 — Seller Score Engine schema changes
-- 1. Add SUSPENDED to performance_band enum
-- 2. Add 4 columns to seller_profile
-- 3. Add ~20 columns to seller_score_snapshot
-- 4. Add indexes on seller_score_snapshot

-- 1. Extend performance_band enum
ALTER TYPE "performance_band" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- 2. Add seller score columns to seller_profile
ALTER TABLE "seller_profile"
  ADD COLUMN IF NOT EXISTS "seller_score" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "seller_score_updated_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "is_new" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "boost_credit_cents" integer NOT NULL DEFAULT 0;

-- 3. Add daily snapshot columns to seller_score_snapshot
ALTER TABLE "seller_score_snapshot"
  ADD COLUMN IF NOT EXISTS "user_id" text REFERENCES "user"("id"),
  ADD COLUMN IF NOT EXISTS "snapshot_date" date,
  ADD COLUMN IF NOT EXISTS "search_multiplier" real,
  ADD COLUMN IF NOT EXISTS "on_time_shipping_pct" real,
  ADD COLUMN IF NOT EXISTS "inad_claim_rate_pct" real,
  ADD COLUMN IF NOT EXISTS "review_average" real,
  ADD COLUMN IF NOT EXISTS "response_time_hours" real,
  ADD COLUMN IF NOT EXISTS "return_rate_pct" real,
  ADD COLUMN IF NOT EXISTS "cancellation_rate_pct" real,
  ADD COLUMN IF NOT EXISTS "shipping_score" integer,
  ADD COLUMN IF NOT EXISTS "inad_score" integer,
  ADD COLUMN IF NOT EXISTS "review_score" integer,
  ADD COLUMN IF NOT EXISTS "response_score" integer,
  ADD COLUMN IF NOT EXISTS "return_score" integer,
  ADD COLUMN IF NOT EXISTS "cancellation_score" integer,
  ADD COLUMN IF NOT EXISTS "primary_fee_bucket" text,
  ADD COLUMN IF NOT EXISTS "trend_modifier" real,
  ADD COLUMN IF NOT EXISTS "bayesian_smoothing" real,
  ADD COLUMN IF NOT EXISTS "previous_band" "performance_band",
  ADD COLUMN IF NOT EXISTS "band_changed_at" timestamp with time zone;

-- 4. Add indexes for daily snapshot queries
CREATE UNIQUE INDEX IF NOT EXISTS "sss_user_date_idx" ON "seller_score_snapshot" ("user_id", "snapshot_date");
CREATE INDEX IF NOT EXISTS "sss_date_idx" ON "seller_score_snapshot" ("snapshot_date");
