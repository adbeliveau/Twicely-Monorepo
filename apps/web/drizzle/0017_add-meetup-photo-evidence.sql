-- G2.16: Add meetup photo evidence columns to local_transaction (Addendum A13)
-- Buyer can optionally capture condition photos before confirming receipt at a SafeTrade meetup.

ALTER TABLE "local_transaction" ADD COLUMN "meetup_photo_urls" text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE "local_transaction" ADD COLUMN "meetup_photos_at" timestamp with time zone;
