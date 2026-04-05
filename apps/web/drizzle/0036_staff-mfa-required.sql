-- SEC-031: Enforce MFA for ADMIN/SUPER_ADMIN staff
-- Adds mfa_required column and backfills it for existing admin users.

ALTER TABLE "staff_user"
  ADD COLUMN "mfa_required" boolean NOT NULL DEFAULT false;

-- Backfill: all ADMIN and SUPER_ADMIN users get mfa_required=true
UPDATE "staff_user" SET "mfa_required" = true
WHERE "id" IN (
  SELECT DISTINCT "staff_user_id" FROM "staff_user_role"
  WHERE "role" IN ('ADMIN', 'SUPER_ADMIN') AND "revoked_at" IS NULL
);
