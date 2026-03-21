-- Migration: G2.7 Dual-Token Ed25519 QR
-- Replaces single confirmationCode/offlineCode columns with dual seller/buyer token columns.
-- Adds confirmationModeEnum for tracking how confirmation was performed.

-- 1. Add the confirmation_mode enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'confirmation_mode') THEN
    CREATE TYPE confirmation_mode AS ENUM (
      'QR_ONLINE', 'QR_DUAL_OFFLINE', 'CODE_ONLINE', 'CODE_DUAL_OFFLINE'
    );
  END IF;
END$$;

-- 2. Add new columns alongside existing ones (nullable for migration)
ALTER TABLE local_transaction
  ADD COLUMN IF NOT EXISTS seller_confirmation_code text,
  ADD COLUMN IF NOT EXISTS seller_offline_code text,
  ADD COLUMN IF NOT EXISTS buyer_confirmation_code text,
  ADD COLUMN IF NOT EXISTS buyer_offline_code text,
  ADD COLUMN IF NOT EXISTS confirmation_mode confirmation_mode;

-- 3. Migrate existing data: copy confirmation_code -> seller_confirmation_code,
--    offline_code -> seller_offline_code, generate placeholder buyer codes for existing rows.
UPDATE local_transaction
SET
  seller_confirmation_code = confirmation_code,
  seller_offline_code = offline_code,
  buyer_confirmation_code = gen_random_uuid()::text,
  buyer_offline_code = lpad(floor(random() * 900000 + 100000)::text, 6, '0')
WHERE seller_confirmation_code IS NULL;

-- 4. Set NOT NULL constraints
ALTER TABLE local_transaction
  ALTER COLUMN seller_confirmation_code SET NOT NULL,
  ALTER COLUMN seller_offline_code SET NOT NULL,
  ALTER COLUMN buyer_confirmation_code SET NOT NULL,
  ALTER COLUMN buyer_offline_code SET NOT NULL;

-- 5. Add unique constraints on new token columns
ALTER TABLE local_transaction
  ADD CONSTRAINT lt_seller_confirmation_code_unique UNIQUE (seller_confirmation_code),
  ADD CONSTRAINT lt_buyer_confirmation_code_unique UNIQUE (buyer_confirmation_code);

-- 6. Create indexes on new columns
CREATE INDEX IF NOT EXISTS lt_seller_confirm ON local_transaction (seller_confirmation_code);
CREATE INDEX IF NOT EXISTS lt_buyer_confirm ON local_transaction (buyer_confirmation_code);

-- 7. Drop old columns and old index
DROP INDEX IF EXISTS lt_confirm;
ALTER TABLE local_transaction
  DROP COLUMN IF EXISTS confirmation_code,
  DROP COLUMN IF EXISTS offline_code,
  DROP COLUMN IF EXISTS confirmation_method;
