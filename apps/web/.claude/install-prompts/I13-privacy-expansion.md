# [I13] Privacy Expansion — 2 Hub Pages

**Phase:** I (Enrichment)
**Step:** I13
**Feature:** Privacy Expansion — Data Retention Exports + Anonymization Queue
**One-line Summary:** Build 2 new sub-pages under /cfg/data-retention for managing GDPR data export requests and the anonymization/deletion queue.
**Depends On:** G8 COMPLETE.

## File Approval List

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `src/app/(hub)/cfg/data-retention/exports/page.tsx` | CREATE | Data export request management (~200 lines) |
| 2 | `src/app/(hub)/cfg/data-retention/anonymize/page.tsx` | CREATE | Anonymization queue management (~200 lines) |
| 3 | `src/components/admin/export-management-table.tsx` | CREATE | Client component for export requests table with filters |
| 4 | `src/components/admin/anonymization-queue.tsx` | CREATE | Client component for deletion queue with review actions |
| 5 | `src/lib/queries/admin-data-retention-exports.ts` | CREATE | Export request queries (list, counts, SLA breach) |
| 6 | `src/lib/queries/admin-anonymization-queue.ts` | CREATE | Anonymization queue queries (pending deletions, history) |
| 7 | `src/lib/actions/admin-data-retention-exports.ts` | CREATE | Export request actions (retry, cancel) |
| 8 | `src/lib/actions/admin-anonymization-queue.ts` | CREATE | Queue actions (force-delete, cancel-deletion) |
| 9 | `src/lib/queries/__tests__/admin-data-retention-exports.test.ts` | CREATE | Tests (~12 tests) |
| 10 | `src/lib/queries/__tests__/admin-anonymization-queue.test.ts` | CREATE | Tests (~10 tests) |
| 11 | `src/lib/actions/__tests__/admin-data-retention-exports.test.ts` | CREATE | Tests (~10 tests) |

**Total: 11 new files, 0 modified files (~42 tests)**

## Key Notes
- Parent `admin-data-retention.ts` is at exactly 300 lines — all new actions MUST go into new files
- Tab navigation for parent /cfg/data-retention page: Overview | Exports | Anonymize
- Update /cfg/data-retention/page.tsx to add tab links to the two new sub-pages
- New CASL subjects NOT needed: DataRetention and DataExportRequest already exist
- No new platform settings needed: all retention.* and gdpr.* keys already seeded
