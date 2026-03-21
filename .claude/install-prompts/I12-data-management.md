# [I12] Data Management — 3 Hub Pages

**Phase:** I (Enrichment)
**Step:** I12
**Feature:** Data Management — Bulk Operations, Data Exports, Data Imports Admin
**One-line Summary:** Create three new hub pages (/bulk, /exports, /imports) for platform-wide staff management of bulk operations, data export requests (GDPR), and crosslister import batches.
**Depends On:** E3 COMPLETE.

## File Approval List

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `src/app/(hub)/bulk/page.tsx` | CREATE | Bulk operations hub page |
| 2 | `src/app/(hub)/exports/page.tsx` | CREATE | Data exports management page |
| 3 | `src/app/(hub)/imports/page.tsx` | CREATE | Import batches management page |
| 4 | `src/components/admin/bulk-listing-panel.tsx` | CREATE | Client component: listing table with checkboxes + bulk action buttons |
| 5 | `src/components/admin/bulk-user-panel.tsx` | CREATE | Client component: user table with checkboxes + ban/unban buttons |
| 6 | `src/components/admin/export-request-table.tsx` | CREATE | Client component: data export request table |
| 7 | `src/components/admin/import-batch-table.tsx` | CREATE | Client component: import batch table with expandable error rows |
| 8 | `src/lib/queries/admin-data-management.ts` | CREATE | All query functions for bulk/exports/imports pages |
| 9 | `src/lib/actions/admin-data-management.ts` | CREATE | bulkUpdateListingStatusAction, bulkBanUsersAction, bulkUnbanUsersAction |
| 10 | `src/lib/validations/data-management.ts` | CREATE | Zod schemas (max 100 items, no SOLD status for bulk) |
| 11 | `src/lib/queries/__tests__/admin-data-management.test.ts` | CREATE | Query tests (~23 tests) |
| 12 | `src/lib/actions/__tests__/admin-data-management.test.ts` | CREATE | Action tests (~17 tests) |
| 13 | `src/lib/hub/admin-nav.ts` | MODIFY | Add "Data Management" collapsible group with bulk/exports/imports |

**Total: 12 new files, 1 modified file (~40 tests)**
