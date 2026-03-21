-- Migration: Update performance_band enum to canonical values
-- From: ['TOP_RATED', 'ABOVE_STANDARD', 'STANDARD', 'BELOW_STANDARD', 'SUSPENDED']
-- To:   ['POWER_SELLER', 'TOP_RATED', 'ESTABLISHED', 'EMERGING']
--
-- Note: SUSPENDED state is now handled by seller_status enum, not performance_band

-- Step 1: Create new enum type
CREATE TYPE performance_band_new AS ENUM ('POWER_SELLER', 'TOP_RATED', 'ESTABLISHED', 'EMERGING');

-- Step 2: Update seller_profile table
-- Map old values to new values:
--   TOP_RATED -> POWER_SELLER (top performers)
--   ABOVE_STANDARD -> TOP_RATED
--   STANDARD -> ESTABLISHED
--   BELOW_STANDARD -> EMERGING
--   SUSPENDED -> EMERGING (suspension now via seller_status)

ALTER TABLE seller_profile
  ALTER COLUMN performance_band TYPE performance_band_new
  USING (
    CASE performance_band::text
      WHEN 'TOP_RATED' THEN 'POWER_SELLER'::performance_band_new
      WHEN 'ABOVE_STANDARD' THEN 'TOP_RATED'::performance_band_new
      WHEN 'STANDARD' THEN 'ESTABLISHED'::performance_band_new
      WHEN 'BELOW_STANDARD' THEN 'EMERGING'::performance_band_new
      WHEN 'SUSPENDED' THEN 'EMERGING'::performance_band_new
      ELSE 'ESTABLISHED'::performance_band_new
    END
  );

-- Step 3: Update seller_performance table
ALTER TABLE seller_performance
  ALTER COLUMN current_band TYPE performance_band_new
  USING (
    CASE current_band::text
      WHEN 'TOP_RATED' THEN 'POWER_SELLER'::performance_band_new
      WHEN 'ABOVE_STANDARD' THEN 'TOP_RATED'::performance_band_new
      WHEN 'STANDARD' THEN 'ESTABLISHED'::performance_band_new
      WHEN 'BELOW_STANDARD' THEN 'EMERGING'::performance_band_new
      WHEN 'SUSPENDED' THEN 'EMERGING'::performance_band_new
      ELSE 'ESTABLISHED'::performance_band_new
    END
  );

-- Step 4: Update default values (new sellers start as EMERGING)
ALTER TABLE seller_profile
  ALTER COLUMN performance_band SET DEFAULT 'EMERGING'::performance_band_new;

ALTER TABLE seller_performance
  ALTER COLUMN current_band SET DEFAULT 'EMERGING'::performance_band_new;

-- Step 5: Drop old enum and rename new one
DROP TYPE performance_band;
ALTER TYPE performance_band_new RENAME TO performance_band;
