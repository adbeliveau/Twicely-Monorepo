-- Pricing Restructure v3.2 Migration
-- Renames FVF (Final Value Fee) columns to TF (Transaction Fee)
-- Updates ledger_entry_type enum values
-- Removes stripe_processing_fee_cents from order (moved to orderPayment.stripeFeesCents)
--
-- IDEMPOTENT: Safe to run multiple times
-- Run with: psql -f scripts/migrations/v3_2_pricing_restructure.sql

BEGIN;

-- ============================================================================
-- STEP 1: Rename columns in order_item table
-- ============================================================================

-- fvf_rate_bps -> tf_rate_bps
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_item' AND column_name = 'fvf_rate_bps'
  ) THEN
    ALTER TABLE order_item RENAME COLUMN fvf_rate_bps TO tf_rate_bps;
    RAISE NOTICE 'Renamed order_item.fvf_rate_bps -> tf_rate_bps';
  ELSE
    RAISE NOTICE 'Column order_item.fvf_rate_bps does not exist (already renamed or never existed)';
  END IF;
END $$;

-- fvf_amount_cents -> tf_amount_cents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_item' AND column_name = 'fvf_amount_cents'
  ) THEN
    ALTER TABLE order_item RENAME COLUMN fvf_amount_cents TO tf_amount_cents;
    RAISE NOTICE 'Renamed order_item.fvf_amount_cents -> tf_amount_cents';
  ELSE
    RAISE NOTICE 'Column order_item.fvf_amount_cents does not exist (already renamed or never existed)';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Rename columns in order_payment table
-- ============================================================================

-- fvf_amount_cents -> tf_amount_cents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_payment' AND column_name = 'fvf_amount_cents'
  ) THEN
    ALTER TABLE order_payment RENAME COLUMN fvf_amount_cents TO tf_amount_cents;
    RAISE NOTICE 'Renamed order_payment.fvf_amount_cents -> tf_amount_cents';
  ELSE
    RAISE NOTICE 'Column order_payment.fvf_amount_cents does not exist (already renamed or never existed)';
  END IF;
END $$;

-- fvf_rate_percent -> tf_rate_percent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_payment' AND column_name = 'fvf_rate_percent'
  ) THEN
    ALTER TABLE order_payment RENAME COLUMN fvf_rate_percent TO tf_rate_percent;
    RAISE NOTICE 'Renamed order_payment.fvf_rate_percent -> tf_rate_percent';
  ELSE
    RAISE NOTICE 'Column order_payment.fvf_rate_percent does not exist (already renamed or never existed)';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Rename columns in fee_schedule table
-- ============================================================================

-- fvf_rate_percent -> tf_rate_percent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fee_schedule' AND column_name = 'fvf_rate_percent'
  ) THEN
    ALTER TABLE fee_schedule RENAME COLUMN fvf_rate_percent TO tf_rate_percent;
    RAISE NOTICE 'Renamed fee_schedule.fvf_rate_percent -> tf_rate_percent';
  ELSE
    RAISE NOTICE 'Column fee_schedule.fvf_rate_percent does not exist (already renamed or never existed)';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Update ledger_entry_type enum values
-- Note: PostgreSQL enum modification requires recreating the type or using
-- ALTER TYPE ... RENAME VALUE (PG 10+)
-- ============================================================================

-- Rename ORDER_FVF_FEE -> ORDER_TF_FEE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ORDER_FVF_FEE'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ledger_entry_type')
  ) THEN
    ALTER TYPE ledger_entry_type RENAME VALUE 'ORDER_FVF_FEE' TO 'ORDER_TF_FEE';
    RAISE NOTICE 'Renamed enum value ORDER_FVF_FEE -> ORDER_TF_FEE';
  ELSE
    RAISE NOTICE 'Enum value ORDER_FVF_FEE does not exist (already renamed or never existed)';
  END IF;
END $$;

-- Rename REFUND_FVF_REVERSAL -> REFUND_TF_REVERSAL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'REFUND_FVF_REVERSAL'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ledger_entry_type')
  ) THEN
    ALTER TYPE ledger_entry_type RENAME VALUE 'REFUND_FVF_REVERSAL' TO 'REFUND_TF_REVERSAL';
    RAISE NOTICE 'Renamed enum value REFUND_FVF_REVERSAL -> REFUND_TF_REVERSAL';
  ELSE
    RAISE NOTICE 'Enum value REFUND_FVF_REVERSAL does not exist (already renamed or never existed)';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Remove stripe_processing_fee_cents from order table
-- (Stripe fee data belongs on orderPayment.stripeFeesCents per spec)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order' AND column_name = 'stripe_processing_fee_cents'
  ) THEN
    ALTER TABLE "order" DROP COLUMN stripe_processing_fee_cents;
    RAISE NOTICE 'Dropped column order.stripe_processing_fee_cents';
  ELSE
    RAISE NOTICE 'Column order.stripe_processing_fee_cents does not exist (already dropped or never added)';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Add comment for documentation
-- ============================================================================

COMMENT ON COLUMN order_item.tf_rate_bps IS 'Transaction Fee rate in basis points (v3.2: renamed from fvf_rate_bps)';
COMMENT ON COLUMN order_item.tf_amount_cents IS 'Transaction Fee amount in cents (v3.2: renamed from fvf_amount_cents)';
COMMENT ON COLUMN order_payment.tf_amount_cents IS 'Transaction Fee amount in cents (v3.2: renamed from fvf_amount_cents)';
COMMENT ON COLUMN order_payment.tf_rate_percent IS 'Transaction Fee rate as percentage (v3.2: renamed from fvf_rate_percent)';
COMMENT ON COLUMN fee_schedule.tf_rate_percent IS 'Transaction Fee rate as percentage (v3.2: renamed from fvf_rate_percent)';
COMMENT ON COLUMN order_payment.stripe_fees_cents IS 'Stripe payment processing fee in cents (canonical location per spec)';

COMMIT;

-- Verification queries (run manually after migration)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'order_item' AND column_name LIKE 'tf_%';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'order_payment' AND column_name LIKE 'tf_%';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'fee_schedule' AND column_name LIKE 'tf_%';
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ledger_entry_type') AND enumlabel LIKE '%TF%';
