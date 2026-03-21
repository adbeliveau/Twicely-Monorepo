-- Migration: Add cookieConsentJson column to user table
-- G8.3 — Cookie Consent Management

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "cookie_consent_json" jsonb;
