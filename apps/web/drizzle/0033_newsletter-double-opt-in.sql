ALTER TABLE "newsletter_subscriber" ALTER COLUMN "confirmed_at" DROP DEFAULT;
ALTER TABLE "newsletter_subscriber" ALTER COLUMN "confirmed_at" DROP NOT NULL;

UPDATE "platform_setting"
SET
  "value" = 'true'::jsonb,
  "description" = 'Require email confirmation before activating newsletter subscriptions',
  "updated_at" = now()
WHERE "key" = 'newsletter.doubleOptIn';
