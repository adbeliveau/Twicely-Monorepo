-- D1.1 Migration: Add storefront_category_id to listing table
-- Run this against your database to add storefront custom category support

-- Add the column
ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS storefront_category_id TEXT
  REFERENCES storefront_custom_category(id) ON DELETE SET NULL;

-- Create the index
CREATE INDEX IF NOT EXISTS lst_storefront_cat ON listing(storefront_category_id);
