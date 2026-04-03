-- G6: Identity Verification + Data Export Request
-- Adds verificationLevelEnum, verificationStatusEnum, identity_verification, data_export_request

CREATE TYPE "verification_level" AS ENUM ('BASIC', 'TAX', 'ENHANCED', 'CATEGORY');
CREATE TYPE "verification_status" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

CREATE TABLE "identity_verification" (
  "id"                     text PRIMARY KEY NOT NULL,
  "user_id"                text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "level"                  "verification_level" NOT NULL,
  "status"                 "verification_status" NOT NULL DEFAULT 'PENDING',
  "stripe_session_id"      text,
  "stripe_report_id"       text,
  "verified_at"            timestamp with time zone,
  "failed_at"              timestamp with time zone,
  "failure_reason"         text,
  "expires_at"             timestamp with time zone,
  "triggered_by"           text NOT NULL,
  "triggered_by_staff_id"  text,
  "attempt_count"          integer NOT NULL DEFAULT 1,
  "last_attempt_at"        timestamp with time zone,
  "retry_after"            timestamp with time zone,
  "created_at"             timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX "iv_user"   ON "identity_verification" ("user_id");
CREATE INDEX "iv_status" ON "identity_verification" ("status");
CREATE INDEX "iv_level"  ON "identity_verification" ("level");

CREATE TABLE "data_export_request" (
  "id"                   text PRIMARY KEY NOT NULL,
  "user_id"              text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status"               text NOT NULL DEFAULT 'PENDING',
  "format"               text NOT NULL DEFAULT 'json',
  "download_url"         text,
  "download_expires_at"  timestamp with time zone,
  "completed_at"         timestamp with time zone,
  "error_message"        text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT NOW(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX "der_user"   ON "data_export_request" ("user_id");
CREATE INDEX "der_status" ON "data_export_request" ("status");
