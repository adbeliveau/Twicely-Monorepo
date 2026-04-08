---
name: Audit baseline 2026-04-08
description: First full audit of hub-helpdesk domain; PASS verdict; key findings documented
type: project
---

First audit run on 2026-04-08. Verdict: PASS.

All 8 business rules green. Schema tables all present. 4 BullMQ jobs exist and wired in cron-jobs.ts with UTC tz anchoring and platform_settings reads. No banned third-party terms found anywhere in scope. Routing reads from DB (helpdeskRoutingRule table). SLA reads from DB (helpdeskSlaPolicy table). kbCaseArticleLink wired in kb-feedback.ts:linkArticleToCase.

One suppressed finding: `sla.ts` lines 99-103 hardcoded fallback (8h/48h) fires only when no policy row found — same FP-010 pattern (fallback-if-DB-unreachable). Seed provides all 5 priority policies.

Notable: Two parallel seed hierarchies exist for helpdesk settings — `apps/web/src/lib/db/seed/v32-platform-settings-extended.ts` (web side) and `packages/db/src/seed/v32-platform-settings-extended.ts` (package side). Both contain helpdesk keys but the package version is the canonical one used by jobs. This is the FP-205 maintenance-hazard pattern — tracked separately, not a domain audit failure.

**Why:** Domain was built-in (no Zendesk/Chatwoot) per canonical spec §1. All lifecycle jobs have batchSize, cron pattern, and UTC tz reads from platform_settings.
**How to apply:** Future audits can trust the 2026-04-08 baseline. Watch for drift in sla.ts fallback values vs. seed values, and for the dual-seed-file sync hazard.
