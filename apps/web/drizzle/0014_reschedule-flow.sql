-- G2.10: Reschedule Flow
-- Add RESCHEDULE_PENDING to local_transaction_status enum
ALTER TYPE "local_transaction_status" ADD VALUE 'RESCHEDULE_PENDING' AFTER 'ADJUSTMENT_PENDING';

-- Add reschedule tracking columns to local_transaction
ALTER TABLE "local_transaction"
  ADD COLUMN "reschedule_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "last_rescheduled_at" timestamptz,
  ADD COLUMN "last_rescheduled_by" text,
  ADD COLUMN "original_scheduled_at" timestamptz,
  ADD COLUMN "reschedule_proposed_at" timestamptz;
