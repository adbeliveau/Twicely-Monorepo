-- G2.14: Add RESERVED to listing_status enum
-- When a SafeTrade local transaction is created, the listing transitions from
-- ACTIVE to RESERVED so other buyers cannot purchase it.

ALTER TYPE "listing_status" ADD VALUE IF NOT EXISTS 'RESERVED';
