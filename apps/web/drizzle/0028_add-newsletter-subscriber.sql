-- G10.12: Newsletter subscriber table
DO $$ BEGIN
  CREATE TYPE "newsletter_source" AS ENUM('HOMEPAGE_SECTION', 'HOMEPAGE_FOOTER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "newsletter_subscriber" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "source" "newsletter_source" NOT NULL DEFAULT 'HOMEPAGE_SECTION',
  "unsubscribe_token" text NOT NULL,
  "confirmed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "unsubscribed_at" timestamp with time zone,
  "welcome_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "newsletter_subscriber" ADD CONSTRAINT "newsletter_subscriber_email_unique" UNIQUE("email");
ALTER TABLE "newsletter_subscriber" ADD CONSTRAINT "newsletter_subscriber_token_unique" UNIQUE("unsubscribe_token");
CREATE INDEX IF NOT EXISTS "newsletter_subscriber_email_idx" ON "newsletter_subscriber" ("email");
CREATE INDEX IF NOT EXISTS "newsletter_subscriber_created_at_idx" ON "newsletter_subscriber" ("created_at");
