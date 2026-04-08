---
name: BOOST_CREDIT_ISSUED enum + monthly boost credit job
description: Schema enum was missing; full job implemented 2026-04-08 per Seller Score Canonical §5.4
type: project
---

`BOOST_CREDIT_ISSUED` was missing from `ledgerEntryTypeEnum` in `packages/db/src/schema/enums.ts` (confirmed absent on 2026-04-08). Added it as an additive enum value alongside implementing the full monthly boost credit job.

**Why:** Seller Score Canonical §5.4 requires a monthly BullMQ cron job that issues boost credits ($15 POWER_SELLER, $10 TOP_RATED). The `sellerProfile.boostCreditCents` column existed but was never written. The ledger entry type didn't exist either.

**How to apply:** If reviewing schema for completeness, verify `BOOST_CREDIT_ISSUED` is in the enum. A PostgreSQL migration `ALTER TYPE ledger_entry_type ADD VALUE 'BOOST_CREDIT_ISSUED'` is required for the live DB (schema file updated but no migration file was created — migration is an engine-schema-fix responsibility).

Files created/modified:
- `packages/db/src/schema/enums.ts` — added `BOOST_CREDIT_ISSUED` to `ledgerEntryTypeEnum`
- `packages/jobs/src/monthly-boost-credit.ts` — new job (187 lines)
- `packages/jobs/src/__tests__/monthly-boost-credit.test.ts` — new tests (9 tests)
- `packages/jobs/src/cron-jobs.ts` — registered job
- `packages/jobs/src/__tests__/cron-jobs.test.ts` — bumped count 18→19
- `packages/db/src/seed/v32-platform-settings.ts` — 4 new keys
- `apps/web/src/lib/db/seed/v32-platform-settings.ts` — 4 new keys (byte-identical)
- `packages/notifications/src/templates-types.ts` — added `seller.boostCredit.issued`
- `packages/notifications/src/templates.ts` — added template entry
