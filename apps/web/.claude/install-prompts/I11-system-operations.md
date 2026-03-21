# [I11] System & Operations — 6 Hub Pages

**Phase:** I (Enrichment)
**Step:** I11
**Feature:** System & Operations Admin Pages
**One-line Summary:** Build 6 hub admin pages: health check detail, feature flag detail, error log viewer, platform operations dashboard, admin broadcast messages, and search engine admin.
**Depends On:** E4 (Feature Flags), E5 (Monitoring/Doctor) — both COMPLETE.

## File Approval List

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `src/app/(hub)/health/[id]/page.tsx` | CREATE | Provider instance detail page |
| 2 | `src/app/(hub)/flags/[id]/page.tsx` | CREATE | Feature flag detail page |
| 3 | `src/app/(hub)/errors/page.tsx` | CREATE | Error log viewer page |
| 4 | `src/app/(hub)/operations/page.tsx` | CREATE | Platform operations dashboard |
| 5 | `src/app/(hub)/admin-messages/page.tsx` | CREATE | Admin broadcast messages page |
| 6 | `src/app/(hub)/search-admin/page.tsx` | CREATE | Search engine admin page |
| 7 | `src/lib/queries/admin-audit-events.ts` | CREATE | Audit event queries |
| 8 | `src/lib/queries/admin-operations.ts` | CREATE | Operations summary query |
| 9 | `src/lib/queries/admin-broadcast.ts` | CREATE | Broadcast settings query |
| 10 | `src/lib/queries/admin-search.ts` | CREATE | Typesense collection query |
| 11 | `src/lib/actions/admin-broadcast.ts` | CREATE | Broadcast setting update action |
| 12 | `src/lib/actions/admin-search.ts` | CREATE | Search index rebuild action |
| 13 | `src/lib/queries/__tests__/admin-audit-events.test.ts` | CREATE | Query tests |
| 14 | `src/lib/queries/__tests__/admin-operations.test.ts` | CREATE | Query tests |
| 15 | `src/lib/queries/__tests__/admin-search.test.ts` | CREATE | Query tests |
| 16 | `src/lib/actions/__tests__/admin-broadcast.test.ts` | CREATE | Action tests |
| 17 | `src/lib/actions/__tests__/admin-search.test.ts` | CREATE | Action tests |
| 18 | `src/lib/hub/admin-nav.ts` | MODIFY | Add 4 nav entries (errors, operations, admin-messages, search-admin) |
| 19 | `src/lib/queries/health-checks.ts` | MODIFY | Add getProviderInstanceById + getProviderHealthLogs |
| 20 | `src/lib/queries/__tests__/health-checks.test.ts` | MODIFY/CREATE | Tests for new queries |

**Total: 17 new files, 3 modified files (~60-80 tests)**
