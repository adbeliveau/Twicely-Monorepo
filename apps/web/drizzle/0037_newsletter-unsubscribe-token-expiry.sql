-- SEC-041: Add expiration for newsletter unsubscribe tokens.
-- Existing rows get NULL (no expiration) for backward compatibility.
-- New tokens will be set to 90 days from creation.

ALTER TABLE "newsletter_subscriber"
  ADD COLUMN "unsubscribe_token_expires_at" timestamp with time zone;
