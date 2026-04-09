# V4 Install Phase 07 — Finance Reconciliation

**Status:** DRAFT (V4)
**Prereq:** Phase V4-06 complete, `npx turbo typecheck` green, `npx turbo test` green
**Canonical:** `rules/canonicals/31_FINANCE_RECONCILIATION.md`
**Existing schema:** `packages/db/src/schema/finance.ts` (ledgerEntry, sellerBalance, payout, payoutBatch)
**Job queue:** BullMQ via `packages/jobs/`
**Estimated files:** ~14 new, ~6 modified

---

## 0) What this phase installs

### Backend
- `reconReport`, `reconLineItem`, `financeSnapshot` Drizzle tables + `reconStatusEnum`
- Variance detection algorithm (6 variance types)
- Daily reconciliation service (Stripe vs. ledger cross-reference)
- Stripe event fetcher for reconciliation periods
- Variance resolution service (manual + auto-resolve)
- P&L snapshot generation (daily/weekly/monthly)
- Export to CSV/PDF (extends existing finance report infrastructure)
- BullMQ nightly cron job with configurable schedule

### Hub UI
- `(hub)/fin/reconciliation` -- Reconciliation dashboard (history, drill-down, resolution)
- `(hub)/fin/reconciliation/[id]` -- Report detail with variance list

### Ops
- Health provider: `finance_recon`
- Platform settings seed (9 keys)
- CASL permissions for ReconReport, ReconLineItem, FinanceSnapshot

---

## 1) Schema (Drizzle)

### Step 1.1: Add reconStatusEnum

**Edit: `packages/db/src/schema/enums.ts`**

```typescript
export const reconStatusEnum = pgEnum('recon_status', [
  'PENDING', 'OK', 'WARNING', 'ERROR',
]);
```

### Step 1.2: Create schema file

**File: `packages/db/src/schema/finance-recon.ts`**

```typescript
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { reconStatusEnum } from './enums';

export const reconReport = pgTable('recon_report', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  periodStart:         timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:           timestamp('period_end', { withTimezone: true }).notNull(),
  periodDate:          timestamp('period_date', { withTimezone: true }).notNull(),
  provider:            text('provider').notNull().default('STRIPE'),

  totalOrdersCents:    integer('total_orders_cents').notNull().default(0),
  totalStripeCents:    integer('total_stripe_cents').notNull().default(0),
  totalLedgerCents:    integer('total_ledger_cents').notNull().default(0),
  varianceCents:       integer('variance_cents').notNull().default(0),

  orderCount:          integer('order_count').notNull().default(0),
  stripeEventCount:    integer('stripe_event_count').notNull().default(0),
  ledgerEntryCount:    integer('ledger_entry_count').notNull().default(0),
  varianceCount:       integer('variance_count').notNull().default(0),

  status:              reconStatusEnum('status').notNull().default('PENDING'),
  reportJson:          jsonb('report_json').notNull().default(sql`'{}'`),
  summaryJson:         jsonb('summary_json').notNull().default(sql`'{}'`),

  runType:             text('run_type').notNull().default('scheduled'),
  runByStaffId:        text('run_by_staff_id'),
  startedAt:           timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt:         timestamp('completed_at', { withTimezone: true }),
  errorMessage:        text('error_message'),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  periodDateIdx:  uniqueIndex('rr_period_date').on(table.periodDate, table.provider),
  statusIdx:      index('rr_status').on(table.status, table.periodDate),
}));

export const reconLineItem = pgTable('recon_line_item', {
  id:                  text('id').primaryKey().$defaultFn(() => createId()),
  reportId:            text('report_id').notNull().references(() => reconReport.id, { onDelete: 'cascade' }),

  varianceType:        text('variance_type').notNull(),
  ledgerEntryId:       text('ledger_entry_id'),
  stripeObjectId:      text('stripe_object_id'),
  stripeObjectType:    text('stripe_object_type'),
  orderId:             text('order_id'),
  sellerId:            text('seller_id'),

  ledgerAmountCents:   integer('ledger_amount_cents'),
  stripeAmountCents:   integer('stripe_amount_cents'),
  varianceAmountCents: integer('variance_amount_cents').notNull(),
  severity:            text('severity').notNull().default('LOW'),

  isResolved:          boolean('is_resolved').notNull().default(false),
  resolvedAt:          timestamp('resolved_at', { withTimezone: true }),
  resolvedByStaffId:   text('resolved_by_staff_id'),
  resolutionType:      text('resolution_type'),
  resolutionNotes:     text('resolution_notes'),

  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reportIdx:       index('rli_report').on(table.reportId),
  varianceTypeIdx: index('rli_variance_type').on(table.varianceType, table.isResolved),
  unresolvedIdx:   index('rli_unresolved').on(table.isResolved, table.severity),
}));

export const financeSnapshot = pgTable('finance_snapshot', {
  id:                    text('id').primaryKey().$defaultFn(() => createId()),
  periodType:            text('period_type').notNull(),
  periodStart:           timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd:             timestamp('period_end', { withTimezone: true }).notNull(),

  grossRevenueCents:     integer('gross_revenue_cents').notNull().default(0),
  netRevenueCents:       integer('net_revenue_cents').notNull().default(0),
  totalFeesCents:        integer('total_fees_cents').notNull().default(0),
  totalRefundsCents:     integer('total_refunds_cents').notNull().default(0),
  totalPayoutsCents:     integer('total_payouts_cents').notNull().default(0),
  totalChargebacksCents: integer('total_chargebacks_cents').notNull().default(0),

  orderCount:            integer('order_count').notNull().default(0),
  refundCount:           integer('refund_count').notNull().default(0),
  chargebackCount:       integer('chargeback_count').notNull().default(0),
  payoutCount:           integer('payout_count').notNull().default(0),

  dataJson:              jsonb('data_json').notNull().default(sql`'{}'`),
  generatedByStaffId:    text('generated_by_staff_id'),
  generatedAt:           timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  exportUrl:             text('export_url'),
  exportFormat:          text('export_format'),

  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  periodIdx:     uniqueIndex('fs_period').on(table.periodType, table.periodStart, table.periodEnd),
  periodTypeIdx: index('fs_period_type').on(table.periodType, table.periodStart),
}));
```

### Step 1.3: Export from schema barrel

**Edit: `packages/db/src/schema/index.ts`**

```typescript
export * from './finance-recon';
```

### Step 1.4: Generate migration

```bash
cd packages/db && npx drizzle-kit generate --name finance_reconciliation
```

### Step 1.5: Verify

```bash
npx turbo typecheck --filter=@twicely/db
```

---

## 2) Server actions + queries

### Step 2.1: Reconciliation types

**File: `packages/finance/src/reconciliation/types.ts`**

Define `VarianceType` (6 values), `Severity` (3 levels), `Variance`, `ReconciliationResult`, `StripeEventRow`, `LedgerEntryRow` as specified in Canonical 31 Section 4.

### Step 2.2: Variance detection

**File: `packages/finance/src/reconciliation/variance-detection.ts`**

`detectVariances({ ledgerEntries, stripeEvents })` per Canonical Section 4.1:
1. Build lookup maps
2. Detect DUPLICATE_LEDGER / DUPLICATE_STRIPE
3. Match ledger to Stripe; flag MISSING_STRIPE / AMOUNT_MISMATCH
4. Flag unmatched Stripe events as MISSING_LEDGER
5. Classify severity from platform_settings thresholds

### Step 2.3: Stripe event fetcher

**File: `packages/finance/src/reconciliation/stripe-fetcher.ts`**

`fetchStripeEventsForPeriod(start, end)`: uses Stripe API, fetches charges/refunds/transfers/payouts, normalizes to integer cents.

### Step 2.4: Reconciliation service

**File: `packages/finance/src/reconciliation/reconciliation-service.ts`**

`runDailyReconciliation(date, options)` per Canonical Section 5.1: upsert report, fetch data, detect variances, compute totals, determine status, persist, alert, audit.

### Step 2.5: Resolution service

**File: `packages/finance/src/reconciliation/resolve-variance.ts`**

- `resolveVariance()`: manual resolution with audit trail
- `bulkAutoResolve()`: auto-resolve LOW severity variances

### Step 2.6: Snapshot service

**File: `packages/finance/src/reconciliation/snapshot-service.ts`**

`generateFinanceSnapshot(periodType, start, end)`: aggregate from ledger entries per Canonical Section 8.1.

### Step 2.7: Export service

**File: `packages/finance/src/reconciliation/export-service.ts`**

Extends `report-csv.ts` and `report-pdf.ts` for recon reports + snapshots.

### Step 2.8: Query functions

**File: `packages/finance/src/reconciliation/queries.ts`**

Standard Drizzle queries: `getReconciliationHistory`, `getReconciliationDetails`, `getUnresolvedVariances`, `getVarianceById`.

### Step 2.9: Barrel export + package.json

**File: `packages/finance/src/reconciliation/index.ts`** -- re-export all public APIs.

**Edit: `packages/finance/package.json`** -- add `"./reconciliation": "./src/reconciliation/index.ts"`.

### Step 2.10: BullMQ cron job

**File: `packages/jobs/src/finance-recon-cron.ts`** per Canonical Section 9.1.

**Edit: `packages/jobs/src/cron-jobs.ts`** -- register `finance-recon` cron with UTC timezone.

### Step 2.11: Admin API routes

6 routes per Canonical Section 11: list, detail, run, variances, resolve, bulk-resolve. Plus snapshot list + export. All require FINANCE or ADMIN role.

### Step 2.12: CASL permissions + platform settings seed

CASL: ReconReport, ReconLineItem, FinanceSnapshot subjects.
Seed: 9 platform_settings keys from Canonical Section 13.

---

## 3) UI pages

### Step 3.1: Reconciliation dashboard

**File: `apps/web/src/app/(hub)/fin/reconciliation/page.tsx`**

- Status banner with last recon result, "Run Now" button
- History table: date, status badge, entries checked, variances, totals
- Click-through to detail

### Step 3.2: Report detail page

**File: `apps/web/src/app/(hub)/fin/reconciliation/[id]/page.tsx`**

- Summary card with period/status/totals
- Variance table with type/severity/amounts/order link/resolution status
- Resolution form for individual variances
- "Bulk Auto-Resolve LOW" button
- "Export CSV" / "Export PDF" buttons

---

## 4) Tests

### Step 4.1: Variance detection tests

**File: `packages/finance/src/reconciliation/__tests__/variance-detection.test.ts`**

- 0 variances for matching data
- All 6 variance types detected correctly
- Severity classification from thresholds
- TIMING_DIFFERENCE always LOW

### Step 4.2: Reconciliation service tests

**File: `packages/finance/src/reconciliation/__tests__/reconciliation-service.test.ts`**

- OK status for clean run
- WARNING/ERROR status based on thresholds
- Kill switch prevents execution
- Report immutability
- Audit event on completion

### Step 4.3: Resolution tests

**File: `packages/finance/src/reconciliation/__tests__/resolve-variance.test.ts`**

- Manual resolution updates correctly
- Bulk auto-resolve targets only LOW
- Audit trail created

### Step 4.4: Snapshot tests

**File: `packages/finance/src/reconciliation/__tests__/snapshot-service.test.ts`**

- Correct aggregation from ledger entries
- Upsert behavior on re-generation

### Step 4.5: BullMQ job tests

**File: `packages/jobs/src/__tests__/finance-recon-cron.test.ts`**

- Handler runs recon + generates snapshots
- Weekly/monthly triggers on correct days
- ERROR notification sent

---

## 5) Doctor checks

### Step 5.1: Health provider

**File: `packages/finance/src/reconciliation/health.ts`**

Provider ID: `finance_recon`. 5 checks per Canonical Section 14:
- Recent recon (48h), no errors (7d), unresolved count, ledger sanity, monthly snapshot exists.

### Step 5.2: Register health provider

**Edit: Health provider registry** -- register `finance_recon`.

---

## Completion Criteria

- [ ] `reconReport`, `reconLineItem`, `financeSnapshot` tables with migration
- [ ] `reconStatusEnum` added to enums
- [ ] `detectVariances()` catches all 6 variance types
- [ ] `classifySeverity()` uses platform_settings thresholds
- [ ] `runDailyReconciliation()` orchestrates full flow
- [ ] Reports immutable after completion
- [ ] `resolveVariance()` + `bulkAutoResolve()` work with audit trail
- [ ] `generateFinanceSnapshot()` produces correct P&L aggregates
- [ ] Export to CSV/PDF for reports and snapshots
- [ ] BullMQ cron registered with UTC timezone
- [ ] Kill switch (`finance.recon.enabled`) prevents run
- [ ] ERROR triggers FINANCE staff notification
- [ ] Admin UI at `(hub)/fin/reconciliation`
- [ ] CASL permissions for all 3 recon subjects
- [ ] Platform settings seeded (9 keys)
- [ ] Health provider registered with 5 checks
- [ ] `npx turbo typecheck` green
- [ ] `npx turbo test` green (baseline + new tests)
