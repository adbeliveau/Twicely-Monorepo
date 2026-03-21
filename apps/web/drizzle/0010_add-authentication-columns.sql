-- D6: Authentication Program
-- Add authentication columns to listing and seller_profile tables.
-- The authentication_status enum and authentication_request table were created
-- in migration 0008_schema-addendum-v1-3.sql.

ALTER TABLE "listing" ADD COLUMN "authentication_status" "authentication_status" DEFAULT 'NONE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "listing" ADD COLUMN "authentication_request_id" text;
--> statement-breakpoint
ALTER TABLE "seller_profile" ADD COLUMN "is_authenticated_seller" boolean DEFAULT false NOT NULL;
