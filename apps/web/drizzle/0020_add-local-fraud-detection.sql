-- G2.15: Local fraud detection schema (Addendum §A12)
-- Adds fraud flag enums, fraud flag table, user ban column, and ledger entry type.

-- 1. Fraud flag severity enum
CREATE TYPE "local_fraud_flag_severity" AS ENUM ('CONFIRMED', 'STRONG_SIGNAL', 'MANUAL_REVIEW');

-- 2. Fraud flag status enum
CREATE TYPE "local_fraud_flag_status" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

-- 3. Fraud flag table
CREATE TABLE IF NOT EXISTS "local_fraud_flag" (
  "id" text PRIMARY KEY NOT NULL,
  "seller_id" text NOT NULL REFERENCES "user"("id"),
  "local_transaction_id" text NOT NULL REFERENCES "local_transaction"("id"),
  "listing_id" text NOT NULL REFERENCES "listing"("id"),
  "trigger" text NOT NULL,
  "severity" "local_fraud_flag_severity" NOT NULL,
  "status" "local_fraud_flag_status" NOT NULL DEFAULT 'OPEN',
  "details_json" jsonb NOT NULL DEFAULT '{}',
  "resolved_by_staff_id" text,
  "resolved_at" timestamp with time zone,
  "resolution_note" text,
  "refund_issued_at" timestamp with time zone,
  "listing_removed_at" timestamp with time zone,
  "seller_banned_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "lff_seller" ON "local_fraud_flag" ("seller_id");
CREATE INDEX "lff_transaction" ON "local_fraud_flag" ("local_transaction_id");
CREATE INDEX "lff_status" ON "local_fraud_flag" ("status");
CREATE INDEX "lff_severity" ON "local_fraud_flag" ("severity");

-- 4. User ban column for local fraud
ALTER TABLE "user" ADD COLUMN "local_fraud_banned_at" timestamp with time zone;

-- 5. Ledger entry type for fraud reversals
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'LOCAL_FRAUD_REVERSAL';
