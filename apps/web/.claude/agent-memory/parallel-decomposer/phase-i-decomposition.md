# Phase I Decomposition — Detailed Notes (2026-03-19)

## Shared File Analysis

### admin-nav.ts (src/lib/hub/admin-nav.ts)
Current state: 291 lines. Already contains entries for:
- analytics, users, affiliates, transactions, finance, moderation, helpdesk, kb, listings-admin,
  categories, subscriptions, notifications, feature-flags, roles, staff, audit-log, system-health,
  settings (cfg group), crosslister (cfg connector group), providers
Missing (Phase I needs to add):
- /trust, /risk, /security (I7)
- /promotions (I9)
- /operations, /errors, /admin-messages, /search-admin (I11)
- /bulk, /exports, /imports (I12)
- /delegated-access, /translations, /policies, /currency, /shipping-admin, /taxes (I14)
Owned exclusively by I17.

### v32-platform-settings-extended.ts
Phase I steps are predominantly UI enrichment — they display existing settings data.
Only I7 (trust.* keys) and I15 (cfg enrichment) might add new platform_settings keys.
Both are in separate streams; only one touches this file.
Strategy: assign seed file ownership to one stream (I7 or I15) if needed.

### casl/subjects.ts + casl/platform-abilities.ts
Phase I is mostly read-only admin UI. ADMIN already has `manage 'all'`.
No new CASL subjects expected for Phase I (Trust, Notification, Promotion, Analytics
all already exist as subjects or are read-only admin operations covered by existing rules).
No stream needs to modify these files.

## Per-Step File Touch Analysis

### I1 — Categories & Catalog
NEW files only:
- src/app/(hub)/categories/[id]/page.tsx (new)
- src/app/(hub)/categories/new/page.tsx (new)
- src/app/(hub)/categories/catalog/page.tsx (new)
- src/app/(hub)/categories/page.tsx (ENRICH existing 47-line stub)
- src/lib/queries/admin-categories.ts (new or extend)
Shared file touches: NONE (admin-nav already has /categories entry)
Conflict risk: LOW

### I2 — User Management Enrichment
- src/app/(hub)/usr/[id]/page.tsx (ENRICH 111→300 lines)
- src/app/(hub)/usr/new/page.tsx (new)
- src/app/(hub)/usr/sellers/page.tsx (new)
- src/app/(hub)/usr/sellers/verification/page.tsx (new)
- src/lib/queries/admin-users.ts (extend)
Shared file touches: NONE
Conflict risk: LOW

### I3 — Finance Gaps
NEW files only:
- src/app/(hub)/fin/payouts/[id]/page.tsx (new)
- src/app/(hub)/fin/chargebacks/page.tsx (new)
- src/app/(hub)/fin/chargebacks/[id]/page.tsx (new)
- src/app/(hub)/fin/holds/page.tsx (new)
- src/app/(hub)/fin/subscriptions/page.tsx (new)
- src/lib/queries/admin-finance-gaps.ts (new, or extend admin-finance.ts)
Shared file touches: NONE
Conflict risk: LOW

### I4 — Finance & Transaction Enrichment
ENRICHES existing files:
- src/app/(hub)/fin/page.tsx (52→fuller)
- src/app/(hub)/fin/ledger/page.tsx (65→fuller)
- src/app/(hub)/fin/payouts/page.tsx (69→fuller)
- src/app/(hub)/tx/payments/page.tsx (53→fuller)
- src/app/(hub)/tx/orders/page.tsx (106→fuller)
- src/app/(hub)/tx/orders/[id]/page.tsx (114→fuller)
DEPENDS ON I3: enriching /fin/payouts requires the [id] detail page pattern established by I3
Shared file touches: NONE
Conflict risk: MEDIUM (depends on I3 — /fin/payouts/[id] must exist before enriching /fin/payouts)

### I5 — Moderation Suite
NEW + ENRICH:
- src/app/(hub)/mod/queue/page.tsx (new)
- src/app/(hub)/mod/listings/[id]/page.tsx (new)
- src/app/(hub)/mod/listings/pending/page.tsx (new)
- src/app/(hub)/mod/listings/suppressed/page.tsx (new)
- src/app/(hub)/mod/disputes/rules/page.tsx (new)
- src/app/(hub)/mod/page.tsx (ENRICH 71→fuller)
- src/app/(hub)/mod/listings/page.tsx (ENRICH 62→fuller)
- src/app/(hub)/mod/messages/page.tsx (ENRICH 26→fuller)
Shared file touches: NONE
Conflict risk: LOW

### I6 — Reviews Admin
- src/app/(hub)/mod/reviews/[id]/page.tsx (new)
- src/app/(hub)/mod/reviews/page.tsx (ENRICH 58→fuller)
Shared file touches: NONE
Does NOT conflict with I5 (I5 touches mod/listings, mod/messages, mod/page; I6 touches mod/reviews)
Conflict risk: LOW

### I7 — Trust & Safety Suite
NEW files — all new top-level directory:
- src/app/(hub)/trust/page.tsx (new directory + file)
- src/app/(hub)/trust/sellers/[id]/page.tsx (new)
- src/app/(hub)/trust/settings/page.tsx (new)
- src/app/(hub)/risk/page.tsx (new directory + file)
- src/app/(hub)/security/page.tsx (new directory + file)
- src/lib/queries/admin-trust.ts (new)
- src/lib/actions/admin-trust.ts (new, if needed)
Possible seed file touch: v32-platform-settings-extended.ts (trust.* keys if not yet added)
Nav entry: deferred to I17
Conflict risk: LOW

### I8 — Notification Admin
- src/app/(hub)/notifications/[id]/page.tsx (new)
- src/app/(hub)/notifications/new/page.tsx (new)
- src/app/(hub)/notifications/page.tsx (ENRICH existing stub)
- src/lib/queries/admin-notifications.ts (new or extend)
Nav entry: already exists in admin-nav.ts (no change needed)
Shared file touches: NONE
Conflict risk: LOW

### I9 — Promotions Admin
NEW files — new top-level directory:
- src/app/(hub)/promotions/page.tsx (new directory + file)
- src/app/(hub)/promotions/[id]/page.tsx (new)
- src/app/(hub)/promotions/new/page.tsx (new)
- src/lib/queries/admin-promotions.ts (new)
Nav entry: deferred to I17
Shared file touches: NONE
Conflict risk: LOW

### I10 — Analytics
- src/app/(hub)/analytics/page.tsx (ENRICH existing stub)
- src/app/(hub)/analytics/sellers/page.tsx (new)
- src/lib/queries/admin-analytics.ts (extend)
Nav entry: already exists in admin-nav.ts (no change needed)
Shared file touches: NONE
Conflict risk: LOW

### I11 — System & Operations
- src/app/(hub)/health/[id]/page.tsx (new)
- src/app/(hub)/flags/[id]/page.tsx (new)
- src/app/(hub)/errors/page.tsx (new directory + file)
- src/app/(hub)/operations/page.tsx (new directory + file)
- src/app/(hub)/admin-messages/page.tsx (new directory + file)
- src/app/(hub)/search-admin/page.tsx (new directory + file)
Nav entries: deferred to I17 (errors, operations, admin-messages, search-admin are new)
Shared file touches: NONE
Conflict risk: LOW

### I12 — Data Management
- src/app/(hub)/bulk/page.tsx (new directory + file)
- src/app/(hub)/exports/page.tsx (new directory + file)
- src/app/(hub)/imports/page.tsx (new directory + file)
Nav entries: deferred to I17
Shared file touches: NONE
Conflict risk: LOW

### I13 — Privacy Expansion
- src/app/(hub)/cfg/data-retention/exports/page.tsx (new)
- src/app/(hub)/cfg/data-retention/anonymize/page.tsx (new)
(cfg/data-retention/page.tsx already exists)
Shared file touches: NONE
Conflict risk: LOW

### I14 — Localization & Compliance
NEW directories + files:
- src/app/(hub)/delegated-access/page.tsx (new)
- src/app/(hub)/translations/page.tsx (new)
- src/app/(hub)/policies/page.tsx (new)
- src/app/(hub)/currency/page.tsx (new)
- src/app/(hub)/shipping-admin/page.tsx (new)
- src/app/(hub)/taxes/page.tsx (new)
Nav entries: deferred to I17
Shared file touches: NONE
Conflict risk: LOW

### I15 — Settings & Config Enrichment
ENRICHES existing files + one new file:
- src/app/(hub)/cfg/page.tsx (ENRICH 64→fuller)
- src/app/(hub)/cfg/platform/page.tsx (ENRICH — this is cfg/platform which exists)
- src/app/(hub)/cfg/stripe/page.tsx (ENRICH 85→fuller)
- src/app/(hub)/cfg/shippo/page.tsx (ENRICH 110→fuller)
- src/app/(hub)/cfg/messaging/keywords/page.tsx (ENRICH 33→fuller)
- src/app/(hub)/cfg/providers/mappings/new/page.tsx (NEW)
Possible seed file touch: may add new cfg.* platform_settings keys
Shared file touches: NONE (all cfg files owned solely by I15)
Conflict risk: LOW

### I16 — Remaining Page Enrichment
ENRICHES files spread across domains:
- src/app/(hub)/d/page.tsx (ENRICH 92→fuller)
- src/app/(hub)/roles/staff/new/page.tsx (currently doesn't exist — new file!)
- src/app/(hub)/roles/custom/new/page.tsx (currently doesn't exist — new file!)
- src/app/(hub)/kb/page.tsx (ENRICH 105→fuller)
- src/app/(hub)/kb/[id]/edit/page.tsx (ENRICH 68→fuller)
- src/app/(hub)/audit/page.tsx (ENRICH 46→fuller)
- src/app/(hub)/flags/page.tsx (ENRICH 77→fuller)
- src/app/(hub)/mod/reports/[id]/page.tsx (ENRICH 125→fuller)
DEPENDS ON: all batches 1-4 complete (enriches pages that should reflect new linked routes)
Touches /flags/page.tsx — must NOT conflict with I11 which creates /flags/[id]/page.tsx (different files, safe)
Shared file touches: NONE
Conflict risk: MEDIUM (must run after batches 1-4 to know full context)

### I17 — Admin Sidebar Final Update
MODIFIES:
- src/lib/hub/admin-nav.ts (the only step that touches this file)
Adds nav entries for: /trust, /risk, /security, /promotions, /operations, /errors,
/admin-messages, /search-admin, /bulk, /exports, /imports, /delegated-access,
/translations, /policies, /currency, /shipping-admin, /taxes
DEPENDS ON: all I1–I16 complete
