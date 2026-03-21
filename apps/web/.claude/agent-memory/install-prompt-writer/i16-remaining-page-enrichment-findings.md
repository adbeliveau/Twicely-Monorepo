---
name: I16 Remaining Page Enrichment Findings
description: Gap analysis for 8 hub pages needing enrichment — dashboard KPIs, staff/role create, KB list/editor, audit log, flags, mod reports
type: project
---

## I16 Scope: 8 Pages to Enrich

### 1. `/d` (Dashboard) — 93 lines, functional but basic
- Has: 7 KPI stat cards, GMV/Orders 7d text charts, recent activity table
- Missing per FL 15/22: Quick actions bar, period toggle (7d/30d), users chart, real-time GMV indicator, proper chart viz (text-only today)
- Missing per PR 85: Charts are text-based (div rows), no actual chart components
- Query: `admin-dashboard.ts` has getDashboardKPIs (6 sequential queries), getDashboardCharts (3 queries)
- Enrichment: Add period selector, users chart, dashboard quick action links, chart format improvement

### 2. `/roles/staff/new` — 24 lines, thin wrapper
- Has: AdminPageHeader + CreateStaffForm component
- CreateStaffForm (160 lines): email, displayName, password, role checkbox grid
- Action: `admin-staff.ts` createStaffUserAction — fully functional
- Enrichment: Form already complete; page just needs minor polish (breadcrumb back link like custom/new)

### 3. `/roles/custom/new` — 40 lines, has breadcrumb
- Has: AdminPageHeader + CustomRoleForm with PermissionToggleGrid
- CustomRoleForm (168 lines): name, auto-code, description, permission matrix
- Action: `admin-custom-roles.ts` — create + update
- Enrichment: Form already complete; page is feature-complete

### 4. `/kb` — 106 lines, basic table
- Has: Title, status badge, audience, views, updated columns
- Query: `kb-admin-queries.ts` getAdminKbArticles (supports status/category filters)
- Missing per Helpdesk Canonical 21.2: Author column, Helpful % column, search by title/content, status/category/audience filter dropdowns
- Enrichment: Add filter bar, author column, helpful % column, search input

### 5. `/kb/[id]/edit` — 69 lines, loads editor
- Has: Back link, version + status display, KbArticleEditor component
- KbArticleEditor (299 lines): full form with title, slug, excerpt, body textarea, keywords, sidebar (category, audience, featured, pinned)
- Has: KbArticleToolbar for publish/review/archive workflow
- Missing per Helpdesk Canonical 21.3: Related articles, tags input (freeform), SEO fields (metaTitle, metaDescription), version history view, preview button
- Schema: kbArticle has tags, metaTitle, metaDescription fields but editor doesn't expose metaTitle/metaDescription
- Enrichment: Add meta title/description fields, tags as freeform input, version badge

### 6. `/audit` — 47 lines, has filters + table
- Has: AuditLogFilters (actor type, subject, severity, action text), AuditLogTable with expand
- Query: `admin-audit-log.ts` full paginated with all filters
- Filters already include: actorType, subject, severity, action, date range support in schema
- Missing per FL 39: Export functionality, date range picker UI (schema supports it, UI doesn't expose)
- Enrichment: Add date range picker, CSV export button, actor search by ID

### 7. `/flags` — 78 lines, 3 sections (kill/launch/regular)
- Has: KillSwitchPanel, LaunchGatePanel, FeatureFlagTable (3-tier partition display)
- I11 already built `/flags/[id]` detail page with audit history
- Missing per FL 38: Create new flag form inline or page, flag search/filter, percentage slider
- Enrichment: Add search/filter input, link to flag detail per row, create button

### 8. `/mod/reports/[id]` — 126 lines, functional detail
- Has: Report details (status, target, reason, reporter), review section with staff notes
- Has: ReportReviewActions (confirm/dismiss), enforcement action link
- Query: `content-reports.ts` getContentReportById
- Missing: Reporter name resolution (shows raw ID), target content preview (just shows ID), link to related enforcement actions, related reports for same target
- Enrichment: Resolve reporter name, add target content preview, link to enforcement

## Key Architecture Patterns (from existing pages)
- All hub pages use `staffAuthorize()` from `@/lib/casl/staff-authorize`
- CASL subjects: AuditEvent (read), FeatureFlag (read/create/update/delete), ContentReport (read/update), KbArticle (manage), StaffUser (create/manage), CustomRole (manage)
- Admin components in `src/components/admin/`
- Queries in `src/lib/queries/`
- Actions in `src/lib/actions/`
- Tests in `src/lib/queries/__tests__/` and `src/lib/actions/__tests__/`
- Page Registry 85 (/d): `STAFF(any)` gate
- Page Registry 112-114 (/kb, /kb/new, /kb/[id]/edit): `STAFF(HELPDESK_LEAD+, ADMIN)` gate
- Page Registry 117 (/roles): ADMIN gate
- Page Registry 119 (/audit): `STAFF(any)` gate
- Page Registry 122 (/flags): `STAFF(ADMIN, DEVELOPER)` gate
- Page Registry 101e (/mod/reports/[id]): `STAFF(ADMIN, MODERATION)` gate

## What Already Has Tests
- admin-dashboard: 2 test files
- admin-feature-flags: 5 test files (queries + actions)
- content-reports: 3 test files
- kb-admin-queries: 0 test files (but kb-articles query tests exist)
- admin-audit-log: 0 test files (but admin-audit-events tests exist)

## Estimated Scope
- ~40 tests needed
- ~20 files modified/created
- No new schema tables (all enrichment of existing)
