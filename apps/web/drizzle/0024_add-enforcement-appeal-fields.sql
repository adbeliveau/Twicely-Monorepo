-- Migration: Add appeal fields to enforcement_action table (G4.2)
ALTER TABLE "enforcement_action"
  ADD COLUMN "appeal_note" text,
  ADD COLUMN "appeal_evidence_urls" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN "appealed_at" timestamptz,
  ADD COLUMN "appealed_by_user_id" text,
  ADD COLUMN "appeal_reviewed_by_staff_id" text,
  ADD COLUMN "appeal_review_note" text,
  ADD COLUMN "appeal_resolved_at" timestamptz;
