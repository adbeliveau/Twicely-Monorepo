-- G9.1: Add lastActivityAt column to helpdesk_case for queue sorting
ALTER TABLE "helpdesk_case" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone NOT NULL DEFAULT now();

-- Also add businessHoursOnly and escalateOnBreach to sla_policy for proper SLA tracking
ALTER TABLE "helpdesk_sla_policy" ADD COLUMN IF NOT EXISTS "business_hours_only" boolean NOT NULL DEFAULT true;
ALTER TABLE "helpdesk_sla_policy" ADD COLUMN IF NOT EXISTS "escalate_on_breach" boolean NOT NULL DEFAULT false;
