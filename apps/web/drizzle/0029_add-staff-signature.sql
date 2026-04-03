-- G9.7 — Add per-agent signature column to staff_user
ALTER TABLE "staff_user" ADD COLUMN IF NOT EXISTS "signature_html" text;
