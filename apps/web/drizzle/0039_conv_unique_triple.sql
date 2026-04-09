-- hub-messaging audit V1 (R1): add unique index on (buyer_id, seller_id, listing_id)
-- for conversation dedup at the DB level. Application-level SELECT-then-INSERT
-- dedup in messaging-actions.ts:90-100 is not race-safe under concurrent load.
--
-- Partial on listing_id IS NOT NULL — conversations without a listing context
-- (e.g. pure support threads, if ever created) are not deduped by this index
-- and use application-level logic only.

CREATE UNIQUE INDEX IF NOT EXISTS "conv_unique_triple"
  ON "conversation" ("buyer_id", "seller_id", "listing_id")
  WHERE listing_id IS NOT NULL;
