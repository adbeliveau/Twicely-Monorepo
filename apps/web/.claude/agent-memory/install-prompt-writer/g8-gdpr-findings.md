---
name: G8 GDPR & Data Retention Findings
description: Schema gaps, spec inconsistencies, and existing code state for G8 GDPR & Data Retention
type: project
---

## G8 GDPR & Data Retention - Research Findings (2026-03-15)

### What G6 Already Built (DO NOT RECREATE)
- `/my/settings/privacy` page with 3 sections (DataExport, AccountDeletion, Marketing)
- `/data-retention` hub page with RetentionDashboard
- `data-export.ts` BullMQ job (collects 7 data categories, uploads to R2)
- `account-deletion.ts` actions (begin/cancel deletion, get blockers)
- `data-export.ts` actions (request/download/list exports)
- `admin-data-retention.ts` actions (dashboard, deletion queue, force delete, export requests)
- `privacy-settings.ts` action (marketing opt-in toggle)
- `templates-privacy.ts` (3 templates)
- `identity-verification.ts` schema (identityVerification + dataExportRequest tables)
- CASL subjects: DataExportRequest, DataRetention, IdentityVerification
- 11 privacy/retention platform settings in v32-platform-settings-extended.ts

### What G8 Adds
1. Account deletion EXECUTION pipeline (pseudonymize + purge after cooling-off)
2. Cleanup BullMQ queue with 3 cron jobs (session, audit archive, data purge)
3. Cookie consent banner + `/p/cookies` page
4. Enhanced data export (all GDPR Article 20 categories)
5. Enhanced admin GDPR compliance dashboard

### Key Spec Inconsistencies (5 Found)
1. Platform setting key prefixes: Canonical says `privacy.retention.*`, seeded as `retention.*`
2. Cooling-off: Feature Lock-in says 30 days, Actors/Security says 24hrs -> 30 days wins
3. Audit retention: Seeded as 2555 days (7yr) but Feature Lock-in says 24 months (2yr)
4. `/p/cookies` route: In Feature Lock-in but NOT in Page Registry
5. Feature Lock-in admin setting keys overlap with different-named seeded keys

### Tables/Columns NOT Yet Created
- `cookieConsentJson` column on `user` table (needed for G8.3)
- No `consent_log` or `cookie_consent` table (not in schema doc -- using jsonb column instead)

### Existing Infrastructure Details
- `cleanup` queue defined in Feature Lock-in section 40 but NOT created in code yet
- `platform-cron` queue exists in `cron-jobs.ts` with 6 registered tasks
- `createQueue`/`createWorker` helpers in `src/lib/jobs/queue.ts`
- Audit events: INSERT-only by application convention, `audit_event` table in platform.ts
- Ledger entries: INSERT-only enforced by DB trigger
- No search_log, webhook_log, analytics_event, notification_log tables exist yet

### NOT SPECIFIED in Specs
- GeoIP detection mechanism for EU cookie consent
- Cookie consent version tracking
- Whether ledger pseudonymization needs a special Postgres function to bypass immutability trigger
