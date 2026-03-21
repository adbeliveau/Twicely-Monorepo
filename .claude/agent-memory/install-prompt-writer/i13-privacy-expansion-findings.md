# I13 Privacy Expansion Findings

## Overview
- 2 new sub-pages under existing `/cfg/data-retention`: `/cfg/data-retention/exports` + `/cfg/data-retention/anonymize`
- NO schema changes. All tables exist (dataExportRequest, user.deletionRequestedAt, auditEvent)
- NO new CASL subjects. DataRetention and DataExportRequest already registered
- NO new platform settings. All privacy/gdpr/retention keys already seeded

## Existing Code Inventory
- `admin-data-retention.ts` — 300 lines (AT LIMIT), 6 actions
- `retention-dashboard.tsx` — 152 lines, parent dashboard component
- `gdpr-compliance-card.tsx` — 156 lines, summary + job status cards
- `pseudonymize.ts` — 149 lines, generatePseudonym + 6 pseudonymize* functions
- `account-deletion-executor.ts` — 231 lines, hasBlockers + executeAccountDeletion + runBatch
- `data-export.ts` — 157 lines, BullMQ worker + queue
- `data-export-full.ts` — 185 lines, 18+ category export collector
- `cleanup-data-purge.ts` — 172 lines, cron purge job
- 3 existing test files: 21 tests total

## New Files Needed
- 11 new files, 1 modified
- 2 pages, 3 components, 2 action files, 4 test files
- ~42 new tests

## Key Decisions
- Tab navigation (not sidebar entries) for sub-pages
- Split actions into 2 new files (admin-data-retention.ts is at 300-line limit)
- canManage boolean passed from server to client (not client-side CASL)
- Same PII masking pattern as getDeletionQueue

## Spec Inconsistencies
- Page Registry only defines parent /cfg/data-retention, not sub-routes (expected for I-phase enrichment)
- Platform Settings Canonical uses `privacy.retention.*` prefix, code uses shorter `retention.*`
- Feature Lock-in says `privacy.deletionCoolOffDays`, code uses `gdpr.deletionGracePeriodDays`
