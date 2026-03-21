ALTER TABLE "listing" ADD COLUMN "local_handling_flags" text[] NOT NULL DEFAULT '{}'::text[];
