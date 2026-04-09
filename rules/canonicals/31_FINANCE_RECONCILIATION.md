# V4 Canonical 31 — Finance Reconciliation

**Version:** 1.0 | **Date:** 2026-04-09 | **Status:** LOCKED
**Merges:** V2 Install Phase 18 (Finance Recon & Reporting) + V3 Finance Engine Canonical Section 10 + V3 monorepo architecture
**Read alongside:** Finance Engine Canonical v1.0, Pricing Canonical v3.2, Actors Security Canonical
**Prerequisite schemas:** `packages/db/src/schema/finance.ts` (ledgerEntry, reconciliationReport, sellerBalance, payout, stripeEventLog)

> **Law:** This file is the single source of truth for Stripe-ledger reconciliation, variance detection, daily reconciliation jobs, mismatch tracking, and the admin reconciliation dashboard. If V2 Phase 18 or V3 Finance Engine Section 10 conflict, this file wins.
> **Immutability rule:** Reconciliation NEVER mutates ledger entries. Corrections are separate reversal entries. Reports are immutable once generated.

---

## 1. PURPOSE

Finance Reconciliation is the automated system that ensures the Twicely internal ledger (system of record) and Stripe (payment processor) agree on every cent. When they disagree, the system detects it, classifies it, alerts admins, and tracks resolution.

**What this does:**
- Daily BullMQ cron job (`finance:reconcile`) runs at 4:00 AM UTC
- Pulls Stripe events from the last 48 hours (overlap ensures no gaps across day boundaries)
- Cross-references every Stripe event with its corresponding ledger entry via `stripeEventId`
- Detects five variance types: UNMATCHED_STRIPE_EVENT, ORPHANED_LEDGER_ENTRY, AMOUNT_MISMATCH, DUPLICATE_STRIPE_EVENT, TIMING_DIFFERENCE
- Generates an immutable reconciliation report per run
- Powers the admin reconciliation dashboard at `hub.twicely.co/fin/reconciliation`
- Tracks variance resolution lifecycle

**What this is NOT:**
- Not a ledger mutation tool (reconciliation is read-only against the ledger)
- Not a BI/reporting system (BI reads from reconciliation reports, never writes)
- Not an automatic correction engine (all corrections require admin approval)

---

## 2. NON-NEGOTIABLE PRINCIPLES

1. **Ledger is source of truth.** If ledger and Stripe disagree, ledger is presumed correct until proven otherwise by admin review.
2. **Reconciliation is read-only.** The reconciliation process reads ledger entries and Stripe events. It never inserts, updates, or deletes ledger entries.
3. **Reports are immutable.** Once a reconciliation report is written with status `CLEAN` or `DISCREPANCIES`, its `summaryJson` and `discrepanciesJson` are never modified.
4. **All money in integer cents.** Variance amounts, totals, and thresholds are integer cents. No floats.
5. **48-hour lookback overlap.** Each daily run checks the last 48 hours to catch events that arrived late due to Stripe webhook delays or timezone boundary effects.
6. **Admin resolution required for HIGH/CRITICAL variances.** The system auto-resolves LOW variances (rounding, timing); everything else needs a human.

---

## 3. ARCHITECTURE

### 3.1 Package Layout

Reconciliation logic lives in `packages/finance/src/` alongside existing finance code. The BullMQ worker lives in `packages/jobs/src/`.

```
packages/finance/src/
  reconciliation/
    types.ts                — VarianceType, ReconciliationStatus, Variance, ReconciliationResult
    variance-detector.ts    — detectVariances() — core comparison algorithm
    reconciliation-service.ts — runDailyReconciliation() — orchestrator
    stripe-event-fetcher.ts — fetchStripeEventsForPeriod() — Stripe API adapter
    resolution-service.ts   — resolveVariance(), bulkAutoResolve() — resolution lifecycle
    queries.ts              — getReconciliationHistory(), getReconciliationDetails(), getVariances()
    index.ts                — barrel exports

packages/jobs/src/
  finance-reconciliation.ts — BullMQ worker + cron registration
```

### 3.2 Existing V3 Schema (already deployed)

| Table | Location | Role |
|-------|----------|------|
| `ledgerEntry` | `packages/db/src/schema/finance.ts` | Immutable ledger entries with `stripeEventId`, `stripePaymentIntentId`, `stripeTransferId`, `stripeChargeId`, `stripeRefundId`, `stripeDisputeId` |
| `reconciliationReport` | `packages/db/src/schema/finance.ts` | Reconciliation run results (`status`, `discrepancyCount`, `discrepanciesJson`, `summaryJson`) |
| `stripeEventLog` | `packages/db/src/schema/finance.ts` | Webhook idempotency log with `stripeEventId`, `eventType`, `processingStatus` |
| `sellerBalance` | `packages/db/src/schema/finance.ts` | Cached seller balances (pending/available/reserved) |
| `payout` | `packages/db/src/schema/finance.ts` | Payout records with `stripeTransferId`, `stripePayoutId` |

### 3.3 Data Flow

```
BullMQ cron fires at 4:00 AM UTC (configurable via platform_settings)
  → finance-reconciliation worker invokes runDailyReconciliation()
  → fetchStripeEventsForPeriod() calls Stripe API: list events from (now - 48h) to now
  → Query ledgerEntry WHERE stripeEventId IS NOT NULL AND createdAt >= (now - 48h)
  → Query stripeEventLog for the same period
  → detectVariances() cross-references:
      - Every Stripe event → find matching ledger entry by stripeEventId
      - Every ledger entry with stripeEventId → verify Stripe event exists
      - Compare amounts where both exist
      - Check for duplicates on both sides
  → Classify each variance by type and severity
  → Determine overall status: CLEAN / DISCREPANCIES / FAILED
  → Insert reconciliation_report row (immutable)
  → Insert variance rows into reconciliation_variance table
  → If DISCREPANCIES: send admin notification via Centrifugo + email
  → Auto-resolve LOW severity variances (rounding < $1, timing < 24h)
```

---

## 4. SCHEMA ADDITIONS

### 4.1 reconciliation_variance table (new)

```typescript
// packages/db/src/schema/finance-reconciliation.ts
import { pgTable, text, integer, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { reconciliationReport, ledgerEntry } from './finance';

export const reconciliationVariance = pgTable('reconciliation_variance', {
  id:                     text('id').primaryKey().$defaultFn(() => createId()),
  reconciliationReportId: text('reconciliation_report_id').notNull()
                            .references(() => reconciliationReport.id, { onDelete: 'cascade' }),

  // Variance classification
  type:                   text('type').notNull(),
    // 'UNMATCHED_STRIPE_EVENT' | 'ORPHANED_LEDGER_ENTRY' | 'AMOUNT_MISMATCH' |
    // 'DUPLICATE_STRIPE_EVENT' | 'TIMING_DIFFERENCE'
  severity:               text('severity').notNull(),
    // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

  // References (at least one must be non-null)
  stripeEventId:          text('stripe_event_id'),
  stripeObjectType:       text('stripe_object_type'),   // 'charge' | 'transfer' | 'refund' | 'payout' | 'dispute'
  ledgerEntryId:          text('ledger_entry_id')
                            .references(() => ledgerEntry.id, { onDelete: 'restrict' }),

  // Amounts (integer cents)
  stripeAmountCents:      integer('stripe_amount_cents'),
  ledgerAmountCents:      integer('ledger_amount_cents'),
  varianceAmountCents:    integer('variance_amount_cents').notNull(),

  // Context
  orderId:                text('order_id'),
  userId:                 text('user_id'),              // Seller userId

  // Resolution lifecycle
  isResolved:             boolean('is_resolved').notNull().default(false),
  resolvedAt:             timestamp('resolved_at', { withTimezone: true }),
  resolvedByStaffId:      text('resolved_by_staff_id'),
  resolutionType:         text('resolution_type'),
    // 'auto_timing' | 'auto_rounding' | 'manual_ledger_correction' |
    // 'manual_stripe_confirmed' | 'manual_webhook_replay' | 'manual_write_off'
  resolutionNote:         text('resolution_note'),
  correctionLedgerEntryId: text('correction_ledger_entry_id'),  // If a corrective entry was posted

  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  reportIdx:     index('rv_report').on(table.reconciliationReportId),
  typeIdx:       index('rv_type_resolved').on(table.type, table.isResolved),
  stripeIdx:     index('rv_stripe_event').on(table.stripeEventId),
  ledgerIdx:     index('rv_ledger_entry').on(table.ledgerEntryId),
  severityIdx:   index('rv_severity').on(table.severity, table.isResolved),
}));
```

### 4.2 Update reconciliationReport

The existing `reconciliationReport` table in `packages/db/src/schema/finance.ts` is sufficient. Fields used:

| Column | Type | Usage |
|--------|------|-------|
| `status` | text | `'running'` -> `'clean'` or `'discrepancies'` or `'failed'` |
| `totalEntriesChecked` | integer | Count of ledger entries + Stripe events examined |
| `discrepancyCount` | integer | Number of variance rows created |
| `discrepanciesJson` | jsonb | Summary breakdown by type: `{ UNMATCHED_STRIPE_EVENT: 3, AMOUNT_MISMATCH: 1 }` |
| `summaryJson` | jsonb | Totals: `{ stripeTotalCents, ledgerTotalCents, matchedCount, varianceTotalCents }` |

---

## 5. VARIANCE TYPES

### 5.1 Classification

| Type | Description | Auto-resolvable? |
|------|-------------|-------------------|
| `UNMATCHED_STRIPE_EVENT` | Stripe has an event with no corresponding ledger entry (stripeEventId not found in ledger) | No — may indicate webhook failure |
| `ORPHANED_LEDGER_ENTRY` | Ledger entry references a stripeEventId that doesn't exist in Stripe | No — may indicate manual tampering |
| `AMOUNT_MISMATCH` | Both sides have the event but amounts differ | Only if abs(diff) < $1 (rounding) |
| `DUPLICATE_STRIPE_EVENT` | Same stripeEventId appears multiple times in Stripe event log | No — should not happen; investigate |
| `TIMING_DIFFERENCE` | Event exists on one side but timestamped in a different 24h window | Yes — auto-resolved if matched within 48h |

### 5.2 Severity Classification

```typescript
function classifyVarianceSeverity(variance: Variance): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const absCents = Math.abs(variance.varianceAmountCents);

  if (variance.type === 'TIMING_DIFFERENCE') return 'LOW';
  if (variance.type === 'AMOUNT_MISMATCH' && absCents < 100) return 'LOW';   // < $1
  if (variance.type === 'AMOUNT_MISMATCH' && absCents < 10000) return 'MEDIUM'; // < $100
  if (variance.type === 'ORPHANED_LEDGER_ENTRY') return 'CRITICAL';
  if (variance.type === 'DUPLICATE_STRIPE_EVENT') return 'HIGH';
  if (absCents >= 10000) return 'HIGH'; // >= $100
  return 'MEDIUM';
}
```

### 5.3 Thresholds (platform_settings)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `finance.reconciliation.runTime` | string | `"04:00"` | UTC time for daily cron |
| `finance.reconciliation.lookbackHours` | integer | `48` | Hours to look back |
| `finance.reconciliation.autoResolveRoundingCents` | integer | `100` | Auto-resolve amount mismatches below this ($1) |
| `finance.reconciliation.autoResolveTimingHours` | integer | `48` | Auto-resolve timing diffs within this window |
| `finance.reconciliation.warningThresholdCents` | integer | `10000` | Variance total above this triggers WARNING ($100) |
| `finance.reconciliation.errorThresholdCents` | integer | `100000` | Variance total above this triggers ERROR ($1000) |
| `finance.reconciliation.alertEmail` | string | `""` | Email for reconciliation alerts (in addition to hub notification) |

---

## 6. RECONCILIATION SERVICE

### 6.1 Core Orchestrator

```typescript
// packages/finance/src/reconciliation/reconciliation-service.ts

export async function runDailyReconciliation(options?: {
  date?: Date;              // Override target date (default: yesterday)
  staffId?: string;         // If manually triggered
  lookbackHours?: number;   // Override lookback window
}): Promise<ReconciliationResult> {
  // 1. Determine period: (now - lookbackHours) to now
  // 2. Create or resume reconciliation_report row with status 'running'
  // 3. Fetch Stripe events for period via stripe.events.list()
  // 4. Fetch ledger entries for period WHERE stripeEventId IS NOT NULL
  // 5. Fetch stripeEventLog entries for period
  // 6. Call detectVariances()
  // 7. Calculate totals:
  //    - Sum of Stripe charges = Sum of ORDER_PAYMENT_CAPTURED ledger entries
  //    - Sum of Stripe transfers = Sum of PAYOUT_SENT ledger entries
  //    - Sum of Stripe refunds = Sum of REFUND_FULL + REFUND_PARTIAL ledger entries
  // 8. Classify overall status: CLEAN if 0 variances, DISCREPANCIES if any, FAILED if service error
  // 9. Write reconciliation_report (immutable)
  // 10. Write reconciliation_variance rows
  // 11. Auto-resolve LOW severity variances
  // 12. If DISCREPANCIES: send admin alert
  // 13. Audit log: 'finance.reconcile.run' or 'finance.reconcile.error'
}
```

### 6.2 Variance Detection Algorithm

```typescript
// packages/finance/src/reconciliation/variance-detector.ts

export function detectVariances(input: {
  stripeEvents: StripeEventRecord[];
  ledgerEntries: LedgerEntryRecord[];
  stripeEventLogs: StripeEventLogRecord[];
}): Variance[] {
  const variances: Variance[] = [];

  // Build lookup maps
  const ledgerByStripeEventId = new Map<string, LedgerEntryRecord[]>();
  for (const entry of input.ledgerEntries) {
    if (!entry.stripeEventId) continue;
    const existing = ledgerByStripeEventId.get(entry.stripeEventId) ?? [];
    existing.push(entry);
    ledgerByStripeEventId.set(entry.stripeEventId, existing);
  }

  const stripeEventUsed = new Set<string>();

  // Pass 1: Check every Stripe event has a ledger match
  for (const stripeEvent of input.stripeEvents) {
    const ledgerMatches = ledgerByStripeEventId.get(stripeEvent.id);

    if (!ledgerMatches || ledgerMatches.length === 0) {
      variances.push({
        type: 'UNMATCHED_STRIPE_EVENT',
        stripeEventId: stripeEvent.id,
        stripeObjectType: stripeEvent.type,
        stripeAmountCents: stripeEvent.amountCents,
        varianceAmountCents: stripeEvent.amountCents,
      });
    } else {
      stripeEventUsed.add(stripeEvent.id);

      // Verify amounts match (sum of all ledger entries for this event)
      const ledgerTotal = ledgerMatches.reduce((sum, e) => sum + e.amountCents, 0);
      const diff = Math.abs(stripeEvent.amountCents) - Math.abs(ledgerTotal);

      if (Math.abs(diff) > 0) {
        variances.push({
          type: 'AMOUNT_MISMATCH',
          stripeEventId: stripeEvent.id,
          stripeObjectType: stripeEvent.type,
          ledgerEntryId: ledgerMatches[0].id,
          stripeAmountCents: stripeEvent.amountCents,
          ledgerAmountCents: ledgerTotal,
          varianceAmountCents: diff,
          orderId: ledgerMatches[0].orderId,
          userId: ledgerMatches[0].userId,
        });
      }
    }
  }

  // Pass 2: Check for orphaned ledger entries
  for (const entry of input.ledgerEntries) {
    if (!entry.stripeEventId) continue;
    if (!stripeEventUsed.has(entry.stripeEventId)) {
      // This ledger entry references a stripeEventId not found in Stripe events
      variances.push({
        type: 'ORPHANED_LEDGER_ENTRY',
        ledgerEntryId: entry.id,
        stripeEventId: entry.stripeEventId,
        ledgerAmountCents: entry.amountCents,
        varianceAmountCents: Math.abs(entry.amountCents),
        orderId: entry.orderId,
        userId: entry.userId,
      });
    }
  }

  // Pass 3: Check for duplicate Stripe event IDs in event log
  const eventIdCounts = new Map<string, number>();
  for (const log of input.stripeEventLogs) {
    eventIdCounts.set(log.stripeEventId, (eventIdCounts.get(log.stripeEventId) ?? 0) + 1);
  }
  for (const [eventId, count] of eventIdCounts) {
    if (count > 1) {
      variances.push({
        type: 'DUPLICATE_STRIPE_EVENT',
        stripeEventId: eventId,
        varianceAmountCents: 0,
      });
    }
  }

  return variances;
}
```

### 6.3 Stripe Event Fetcher

```typescript
// packages/finance/src/reconciliation/stripe-event-fetcher.ts

import Stripe from 'stripe';

export interface StripeEventRecord {
  id: string;
  type: string;           // 'charge.succeeded', 'transfer.created', 'charge.refunded', etc.
  amountCents: number;
  occurredAt: Date;
  objectId: string;       // Stripe object ID (charge ID, transfer ID, etc.)
  metadata?: Record<string, string>;
}

export async function fetchStripeEventsForPeriod(
  stripe: Stripe,
  periodStart: Date,
  periodEnd: Date
): Promise<StripeEventRecord[]> {
  // Paginate through Stripe events using auto-pagination
  // Filter to money-moving event types only:
  //   charge.succeeded, charge.refunded, transfer.created, transfer.reversed,
  //   payout.created, payout.paid, payout.failed,
  //   charge.dispute.created, charge.dispute.closed
  // Map each event to StripeEventRecord with normalized amountCents
}
```

---

## 7. BULLMQ CRON JOB

### 7.1 Worker

```typescript
// packages/jobs/src/finance-reconciliation.ts

import { createQueue, createWorker } from './queue';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const QUEUE_NAME = 'finance-reconciliation';

interface ReconJobData {
  triggeredAt: string;
  runType: 'scheduled' | 'manual';
  staffId?: string;
  targetDate?: string;   // ISO date string override
}

export const financeReconciliationQueue = createQueue<ReconJobData>(QUEUE_NAME);

export async function registerFinanceReconciliationJob(): Promise<void> {
  const cronPattern = await getPlatformSetting('finance.reconciliation.cronPattern', '0 4 * * *');

  await financeReconciliationQueue.add(
    'daily-reconciliation',
    { triggeredAt: new Date().toISOString(), runType: 'scheduled' },
    {
      jobId: 'finance-recon-daily',
      repeat: { pattern: cronPattern, tz: 'UTC' },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  );
}

export const financeReconciliationWorker = createWorker<ReconJobData>(
  QUEUE_NAME,
  async (job) => {
    const { runDailyReconciliation } = await import('@twicely/finance/reconciliation');

    const targetDate = job.data.targetDate ? new Date(job.data.targetDate) : undefined;

    const result = await runDailyReconciliation({
      date: targetDate,
      staffId: job.data.staffId,
    });

    logger.info('[financeRecon] Reconciliation complete', {
      status: result.status,
      varianceCount: result.varianceCount,
      varianceTotalCents: result.varianceTotalCents,
      matchedCount: result.matchedCount,
    });

    // Alert on discrepancies
    if (result.status === 'discrepancies') {
      const { sendSlackAlert } = await import('./slack-alert');
      await sendSlackAlert({
        channel: 'finance-alerts',
        text: `Finance reconciliation found ${result.varianceCount} variance(s). Total: $${(result.varianceTotalCents / 100).toFixed(2)}. Review at hub.twicely.co/fin/reconciliation`,
      });
    }
  },
  1  // Single concurrency — only one reconciliation at a time
);
```

### 7.2 Registration

Add to `packages/jobs/src/cron-jobs.ts` in the `registerCronJobs()` function:

```typescript
// Finance reconciliation — daily at 4:00 AM UTC (Finance Engine Canonical §10)
const { registerFinanceReconciliationJob } = await import('./finance-reconciliation');
await registerFinanceReconciliationJob();
logger.info('[cronJobs] Registered finance reconciliation cron job');
```

---

## 8. RESOLUTION LIFECYCLE

### 8.1 Auto-Resolution

LOW severity variances are auto-resolved during the reconciliation run:

- **TIMING_DIFFERENCE**: If the event exists on both sides but in different 24h windows within the 48h lookback, mark as resolved with `resolutionType: 'auto_timing'`.
- **AMOUNT_MISMATCH < $1**: Rounding differences from Stripe's float-to-int conversion. Mark as resolved with `resolutionType: 'auto_rounding'`.

### 8.2 Manual Resolution

Admin resolves variances via `hub.twicely.co/fin/reconciliation`:

| Resolution Type | Description | Requires |
|-----------------|-------------|----------|
| `manual_ledger_correction` | Admin posts a corrective ledger entry (MANUAL_CREDIT or MANUAL_DEBIT) | 2FA, reason code, memo |
| `manual_stripe_confirmed` | Admin verified the Stripe event is correct; no ledger correction needed | Note explaining discrepancy |
| `manual_webhook_replay` | Admin triggers a Stripe webhook replay to regenerate the missing ledger entry | Stripe event ID |
| `manual_write_off` | Amount is written off (below materiality threshold) | Finance Admin approval |

### 8.3 Resolution API

```typescript
// packages/finance/src/reconciliation/resolution-service.ts

export async function resolveVariance(input: {
  varianceId: string;
  staffId: string;
  resolutionType: string;
  resolutionNote: string;
  correctionLedgerEntryId?: string;
}): Promise<{ success: boolean; error?: string }>
```

---

## 9. ADMIN DASHBOARD

### 9.1 Route: `hub.twicely.co/fin/reconciliation`

**Top bar:**
- Last reconciliation status badge (green CLEAN / yellow DISCREPANCIES / red FAILED)
- Last run timestamp
- "Run Now" button (manual trigger, requires FINANCE or ADMIN role)
- Unresolved variance count badge

**Reconciliation history table:**
| Column | Data |
|--------|------|
| Date | Run date |
| Status | CLEAN / DISCREPANCIES / FAILED |
| Entries Checked | Total ledger + Stripe events |
| Matched | Count of matched entries |
| Variances | Count of variances found |
| Stripe Total | Sum of Stripe events (formatted as dollars) |
| Ledger Total | Sum of ledger entries (formatted as dollars) |
| Net Variance | Absolute difference (red if > $100) |

**Drill-down (click a row):**
- Variance list table with type, severity, amounts, linked order, resolution status
- Click a variance to see full details: Stripe event JSON, ledger entry details, resolution form
- Bulk auto-resolve button for all LOW severity variances

### 9.2 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/platform/finance/reconciliation` | List reconciliation history (paginated) |
| GET | `/api/platform/finance/reconciliation/[id]` | Get report details with variances |
| POST | `/api/platform/finance/reconciliation/run` | Trigger manual reconciliation |
| GET | `/api/platform/finance/reconciliation/variances` | List unresolved variances (filtered) |
| POST | `/api/platform/finance/reconciliation/variances/[id]/resolve` | Resolve a variance |
| POST | `/api/platform/finance/reconciliation/variances/bulk-resolve` | Auto-resolve LOW variances |

---

## 10. CASL PERMISSIONS

| Subject | Actor | Actions |
|---------|-------|---------|
| ReconciliationReport | Platform Agent (FINANCE) | `read` all |
| ReconciliationReport | Platform Admin | `read` all, `create` (trigger manual run) |
| ReconciliationVariance | Platform Agent (FINANCE) | `read` all |
| ReconciliationVariance | Platform Admin | `read` all, `update` (resolve) |
| ManualAdjustment (corrective) | Platform Admin | `create` (requires 2FA per Actors Security Section 6.1) |

**Hard rules:**
- No actor below FINANCE role can access reconciliation data
- Resolving a variance with `manual_ledger_correction` requires ADMIN + 2FA
- Triggering manual reconciliation requires FINANCE or ADMIN role

---

## 11. HEALTH PROVIDER

Provider ID: `finance_reconciliation`

| Check | Pass | Warn | Fail |
|-------|------|------|------|
| Last reconciliation ran within 36h | Yes | Within 48h | Older than 48h |
| Last reconciliation status | CLEAN | DISCREPANCIES (< 5 variances) | DISCREPANCIES (>= 5) or FAILED |
| Unresolved HIGH/CRITICAL variances | 0 | 1-3 | > 3 |
| Total unresolved variances | < 10 | 10-50 | > 50 |
| Ledger-Stripe balance delta | < $10 | < $100 | >= $100 |

---

## 12. NOTIFICATIONS

| Channel | Event | Recipient |
|---------|-------|-----------|
| `private-admin.finance` | `finance.reconciliation_complete` | All FINANCE/ADMIN staff |
| `private-admin.finance` | `finance.reconciliation_discrepancies` | All FINANCE/ADMIN staff |
| Email | Reconciliation alert | `finance.reconciliation.alertEmail` platform setting |
| Slack | `#finance-alerts` | Via `sendSlackAlert()` in jobs package |

---

## 13. REBUILD MODE

Per Finance Engine Canonical Section 17, the reconciliation system supports full rebuild:

1. Delete all `reconciliationVariance` rows
2. Delete all `reconciliationReport` rows
3. Re-run reconciliation for each day since platform launch
4. All reports and variances regenerate identically (deterministic)

This is a DR-only operation. Requires SUPER_ADMIN.

---

## 14. PLATFORM SETTINGS

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `finance.reconciliation.cronPattern` | cron | `"0 4 * * *"` | Daily run time (4 AM UTC) |
| `finance.reconciliation.lookbackHours` | integer | `48` | Hours to look back per run |
| `finance.reconciliation.autoResolveRoundingCents` | integer | `100` | Auto-resolve mismatches below $1 |
| `finance.reconciliation.autoResolveTimingHours` | integer | `48` | Auto-resolve timing diffs within 48h |
| `finance.reconciliation.warningThresholdCents` | integer | `10000` | WARNING if total variance > $100 |
| `finance.reconciliation.errorThresholdCents` | integer | `100000` | ERROR if total variance > $1000 |
| `finance.reconciliation.alertEmail` | string | `""` | Alert recipient email |
| `finance.reconciliation.enabled` | boolean | `true` | Kill switch |

---

## 15. ACCEPTANCE TESTS

| # | Test | Validates |
|---|------|-----------|
| 1 | Matching Stripe event + ledger entry produces 0 variances | Happy path |
| 2 | Stripe event without ledger entry produces UNMATCHED_STRIPE_EVENT | Detection works |
| 3 | Ledger entry without Stripe event produces ORPHANED_LEDGER_ENTRY | Detection works |
| 4 | Amount difference produces AMOUNT_MISMATCH with correct varianceAmountCents | Amount comparison correct |
| 5 | AMOUNT_MISMATCH < $1 auto-resolved | Auto-resolution works |
| 6 | TIMING_DIFFERENCE auto-resolved | Timing overlap handled |
| 7 | Duplicate stripeEventId produces DUPLICATE_STRIPE_EVENT | Duplicate detection works |
| 8 | Reconciliation report is immutable after completion | Immutability enforced |
| 9 | Manual resolution updates variance and creates audit event | Resolution lifecycle works |
| 10 | Corrective ledger entry links to variance | Correction traceability |
| 11 | BullMQ cron fires daily at configured time | Cron registration works |
| 12 | Manual trigger via API works | Admin manual trigger |
| 13 | Kill switch prevents reconciliation | Feature toggle works |
| 14 | DISCREPANCIES status triggers admin notification | Alerting works |
| 15 | Totals: sum of Stripe charges = sum of ORDER_PAYMENT_CAPTURED entries | Balance comparison correct |
| 16 | 48-hour lookback catches cross-day events | Overlap works |
| 17 | Second run for same period is idempotent (skips if already CLEAN) | No double-processing |
