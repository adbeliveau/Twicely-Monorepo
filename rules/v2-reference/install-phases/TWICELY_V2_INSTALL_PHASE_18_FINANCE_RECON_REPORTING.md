# TWICELY V2 — Install Phase 18: Finance Reconciliation & Reporting
**Status:** LOCKED (v1.0)  
**Backend-first:** Ledger → Provider sync → Reconciliation → Reports → Health → Doctor  
**Canonicals:** TWICELY_Monetization_Pricing_Fees_Ledger_Payouts_CANONICAL_v1.md, TWICELY_WEBHOOKS_IDEMPOTENCY_LEDGER_RECON_LOCKED.md

> Place this file in: `/rules/TWICELY_V2_INSTALL_PHASE_18_FINANCE_RECON_REPORTING.md`  
> Prereq: Phase 17 complete.

---

## 0) What this phase installs

### Backend
- Daily provider → ledger reconciliation job
- Variance detection (missing, duplicate, mismatched)
- Immutable reconciliation reports
- Finance summary calculations
- Payout summary reports
- Revenue reports by period
- Seller payout history

### UI (Corp)
- Finance → Reconciliation dashboard
- Finance → Payout Summary
- Finance → Revenue Reports
- Finance → Variance Detail

### Ops
- Health provider: `finance_recon`
- Doctor checks: ledger totals, variance detection, report immutability

---

## 1) Canonical Money Invariant (Non-Negotiable)

- **All money flows into Twicely-controlled provider account**
- **Internal ledger is source of truth**
- Provider data is *referenced*, never trusted blindly
- Reconciliation NEVER mutates ledger entries
- Reports are immutable once generated

---

## 2) Prisma Schema

```prisma
// =============================================================================
// FINANCE RECONCILIATION
// =============================================================================

enum ReconciliationStatus {
  OK
  WARNING
  ERROR
  PENDING
}

enum VarianceType {
  MISSING_LEDGER      // Provider has it, ledger doesn't
  MISSING_PROVIDER    // Ledger has it, provider doesn't
  AMOUNT_MISMATCH     // Both have it, amounts differ
  DUPLICATE_LEDGER    // Duplicate in ledger
  DUPLICATE_PROVIDER  // Duplicate from provider
  TIMING_DIFFERENCE   // Cross-day timing issue
}

model FinanceReconciliation {
  id                  String              @id @default(cuid())
  
  // Period
  date                DateTime            @unique // Day being reconciled
  periodStart         DateTime
  periodEnd           DateTime
  
  // Provider
  provider            String              @default("STRIPE")
  
  // Totals
  ledgerTotalCents    Int
  providerTotalCents  Int
  varianceCents       Int
  
  // Counts
  ledgerEntryCount    Int
  providerEventCount  Int
  varianceCount       Int
  
  // Status
  status              ReconciliationStatus @default(PENDING)
  
  // Report data (immutable)
  reportJson          Json                @default("{}")
  summaryJson         Json                @default("{}")
  
  // Audit
  runByStaffId        String?
  runType             String              @default("scheduled") // scheduled|manual
  
  // Timestamps
  startedAt           DateTime            @default(now())
  completedAt         DateTime?
  
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt

  // Relations
  variances           FinanceVariance[]

  @@index([provider, date])
  @@index([status, date])
}

model FinanceVariance {
  id                  String            @id @default(cuid())
  reconciliationId    String
  reconciliation      FinanceReconciliation @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)
  
  // Type
  type                VarianceType
  
  // References
  ledgerEntryId       String?
  providerRef         String?           // Stripe charge/transfer ID
  providerObjectType  String?           // charge|transfer|refund|payout
  
  // Amounts
  ledgerAmountCents   Int?
  providerAmountCents Int?
  varianceAmountCents Int
  
  // Context
  orderId             String?
  sellerId            String?
  
  // Resolution
  isResolved          Boolean           @default(false)
  resolvedAt          DateTime?
  resolvedByStaffId   String?
  resolutionNotes     String?
  resolutionType      String?           // timing|manual_fix|provider_error|ledger_correction
  
  createdAt           DateTime          @default(now())

  @@index([reconciliationId])
  @@index([type, isResolved])
  @@index([ledgerEntryId])
  @@index([providerRef])
}

// =============================================================================
// FINANCE REPORTS
// =============================================================================

enum ReportType {
  DAILY_SUMMARY
  WEEKLY_SUMMARY
  MONTHLY_SUMMARY
  PAYOUT_SUMMARY
  REVENUE_BREAKDOWN
  SELLER_PAYOUTS
  FEE_SUMMARY
  REFUND_SUMMARY
}

enum ReportStatus {
  GENERATING
  COMPLETED
  FAILED
}

model FinanceReport {
  id                  String        @id @default(cuid())
  
  // Type and period
  type                ReportType
  periodStart         DateTime
  periodEnd           DateTime
  
  // Status
  status              ReportStatus  @default(GENERATING)
  
  // Data (immutable once completed)
  dataJson            Json          @default("{}")
  summaryJson         Json          @default("{}")
  
  // Totals (denormalized for quick access)
  grossRevenueCents   Int?
  netRevenueCents     Int?
  totalFeesCents      Int?
  totalRefundsCents   Int?
  totalPayoutsCents   Int?
  
  // Metadata
  generatedByStaffId  String?
  generatedAt         DateTime?
  
  // File export
  exportUrl           String?
  exportFormat        String?       // csv|xlsx|pdf
  
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt

  @@unique([type, periodStart, periodEnd])
  @@index([type, status])
  @@index([periodStart, periodEnd])
}

// =============================================================================
// SELLER PAYOUT SUMMARY
// =============================================================================

model SellerPayoutSummary {
  id                  String    @id @default(cuid())
  sellerId            String
  
  // Period
  periodStart         DateTime
  periodEnd           DateTime
  
  // Totals
  grossSalesCents     Int       @default(0)
  totalFeesCents      Int       @default(0)
  totalRefundsCents   Int       @default(0)
  netPayableCents     Int       @default(0)
  
  // Payout status
  paidOutCents        Int       @default(0)
  pendingCents        Int       @default(0)
  heldCents           Int       @default(0)
  
  // Counts
  orderCount          Int       @default(0)
  refundCount         Int       @default(0)
  payoutCount         Int       @default(0)
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([sellerId, periodStart, periodEnd])
  @@index([sellerId, periodStart])
}
```

Run migration:
```bash
npx prisma migrate dev --name finance_recon_phase18
```

---

## 3) Reconciliation Types

Create `packages/core/finance/types.ts`:

```ts
export type ReconciliationStatus = "OK" | "WARNING" | "ERROR" | "PENDING";

export type VarianceType =
  | "MISSING_LEDGER"
  | "MISSING_PROVIDER"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE_LEDGER"
  | "DUPLICATE_PROVIDER"
  | "TIMING_DIFFERENCE";

export type LedgerEntry = {
  id: string;
  ledgerKey: string;
  providerObjectId?: string;
  providerObjectType?: string;
  amountCents: number;
  direction: string;
  type: string;
  orderId?: string;
  sellerId?: string;
  occurredAt: Date;
};

export type ProviderEvent = {
  id: string;
  providerRef: string;
  objectType: string;
  amountCents: number;
  occurredAt: Date;
  orderId?: string;
  sellerId?: string;
};

export type Variance = {
  type: VarianceType;
  ledgerEntryId?: string;
  providerRef?: string;
  providerObjectType?: string;
  ledgerAmountCents?: number;
  providerAmountCents?: number;
  varianceAmountCents: number;
  orderId?: string;
  sellerId?: string;
};

export type ReconciliationResult = {
  date: Date;
  status: ReconciliationStatus;
  ledgerTotalCents: number;
  providerTotalCents: number;
  varianceCents: number;
  ledgerEntryCount: number;
  providerEventCount: number;
  variances: Variance[];
};

// Thresholds
export const VARIANCE_WARNING_THRESHOLD_CENTS = 100;     // $1
export const VARIANCE_ERROR_THRESHOLD_CENTS = 10000;     // $100
export const VARIANCE_COUNT_WARNING_THRESHOLD = 5;
export const VARIANCE_COUNT_ERROR_THRESHOLD = 20;
```

---

## 4) Variance Detection Service

Create `packages/core/finance/variance.ts`:

```ts
import type { LedgerEntry, ProviderEvent, Variance, VarianceType } from "./types";

/**
 * Detect variances between ledger and provider data
 */
export function detectVariances(args: {
  ledger: LedgerEntry[];
  provider: ProviderEvent[];
}): Variance[] {
  const variances: Variance[] = [];

  // Build maps for lookup
  const providerByRef = new Map<string, ProviderEvent>();
  const providerUsed = new Set<string>();

  for (const p of args.provider) {
    if (providerByRef.has(p.providerRef)) {
      // Duplicate provider event
      variances.push({
        type: "DUPLICATE_PROVIDER",
        providerRef: p.providerRef,
        providerObjectType: p.objectType,
        providerAmountCents: p.amountCents,
        varianceAmountCents: p.amountCents,
        orderId: p.orderId,
        sellerId: p.sellerId,
      });
    } else {
      providerByRef.set(p.providerRef, p);
    }
  }

  // Check ledger entries against provider
  const ledgerByKey = new Map<string, LedgerEntry>();
  for (const l of args.ledger) {
    if (ledgerByKey.has(l.ledgerKey)) {
      // Duplicate ledger entry
      variances.push({
        type: "DUPLICATE_LEDGER",
        ledgerEntryId: l.id,
        ledgerAmountCents: l.amountCents,
        varianceAmountCents: l.amountCents,
        orderId: l.orderId,
        sellerId: l.sellerId,
      });
      continue;
    }
    ledgerByKey.set(l.ledgerKey, l);

    // Find matching provider event
    const providerRef = l.providerObjectId;
    if (!providerRef) {
      // Internal ledger entry (no provider match expected)
      continue;
    }

    const p = providerByRef.get(providerRef);
    if (!p) {
      // Missing from provider
      variances.push({
        type: "MISSING_PROVIDER",
        ledgerEntryId: l.id,
        providerRef,
        providerObjectType: l.providerObjectType,
        ledgerAmountCents: l.amountCents,
        varianceAmountCents: l.amountCents,
        orderId: l.orderId,
        sellerId: l.sellerId,
      });
    } else {
      providerUsed.add(providerRef);

      // Check amount match
      if (Math.abs(l.amountCents) !== Math.abs(p.amountCents)) {
        variances.push({
          type: "AMOUNT_MISMATCH",
          ledgerEntryId: l.id,
          providerRef,
          providerObjectType: p.objectType,
          ledgerAmountCents: l.amountCents,
          providerAmountCents: p.amountCents,
          varianceAmountCents: Math.abs(p.amountCents) - Math.abs(l.amountCents),
          orderId: l.orderId ?? p.orderId,
          sellerId: l.sellerId ?? p.sellerId,
        });
      }
    }
  }

  // Find provider events not in ledger
  for (const p of args.provider) {
    if (!providerUsed.has(p.providerRef)) {
      variances.push({
        type: "MISSING_LEDGER",
        providerRef: p.providerRef,
        providerObjectType: p.objectType,
        providerAmountCents: p.amountCents,
        varianceAmountCents: p.amountCents,
        orderId: p.orderId,
        sellerId: p.sellerId,
      });
    }
  }

  return variances;
}

/**
 * Calculate total variance amount
 */
export function calculateTotalVariance(variances: Variance[]): number {
  return variances.reduce((sum, v) => sum + Math.abs(v.varianceAmountCents), 0);
}

/**
 * Classify variance severity
 */
export function classifyVariance(variance: Variance): "low" | "medium" | "high" {
  const amount = Math.abs(variance.varianceAmountCents);
  if (amount < 100) return "low";        // < $1
  if (amount < 10000) return "medium";   // < $100
  return "high";
}
```

---

## 5) Reconciliation Service

Create `packages/core/finance/reconciliation.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { ReconciliationResult, ReconciliationStatus } from "./types";
import {
  VARIANCE_WARNING_THRESHOLD_CENTS,
  VARIANCE_ERROR_THRESHOLD_CENTS,
  VARIANCE_COUNT_WARNING_THRESHOLD,
  VARIANCE_COUNT_ERROR_THRESHOLD,
} from "./types";
import { detectVariances, calculateTotalVariance } from "./variance";

const prisma = new PrismaClient();

/**
 * Run daily reconciliation for a specific date
 */
export async function runDailyReconciliation(
  date: Date,
  options?: { staffId?: string; runType?: string }
): Promise<ReconciliationResult> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Check if already reconciled
  const existing = await prisma.financeReconciliation.findUnique({
    where: { date: dayStart },
  });

  if (existing && existing.status !== "PENDING") {
    throw new Error("ALREADY_RECONCILED");
  }

  // Create or update reconciliation record
  const recon = await prisma.financeReconciliation.upsert({
    where: { date: dayStart },
    update: { status: "PENDING", startedAt: new Date() },
    create: {
      date: dayStart,
      periodStart: dayStart,
      periodEnd: dayEnd,
      provider: "STRIPE",
      ledgerTotalCents: 0,
      providerTotalCents: 0,
      varianceCents: 0,
      ledgerEntryCount: 0,
      providerEventCount: 0,
      varianceCount: 0,
      status: "PENDING",
      runByStaffId: options?.staffId,
      runType: options?.runType ?? "scheduled",
    },
  });

  try {
    // Fetch ledger entries for the day
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        occurredAt: { gte: dayStart, lte: dayEnd },
      },
    });

    // Fetch provider events for the day
    const providerEvents = await prisma.providerEvent.findMany({
      where: {
        occurredAt: { gte: dayStart, lte: dayEnd },
      },
    });

    // Convert to common format
    const ledger = ledgerEntries.map((e) => ({
      id: e.id,
      ledgerKey: e.ledgerKey,
      providerObjectId: e.providerObjectId ?? undefined,
      providerObjectType: e.providerObjectType ?? undefined,
      amountCents: e.amountCents,
      direction: e.direction,
      type: e.type,
      orderId: e.orderId ?? undefined,
      sellerId: e.sellerId ?? undefined,
      occurredAt: e.occurredAt,
    }));

    const provider = providerEvents.map((e) => ({
      id: e.id,
      providerRef: e.providerRef,
      objectType: e.objectType,
      amountCents: e.amountCents,
      occurredAt: e.occurredAt,
      orderId: e.orderId ?? undefined,
      sellerId: e.sellerId ?? undefined,
    }));

    // Calculate totals (credits positive, debits negative)
    const ledgerTotal = ledger.reduce((sum, e) => {
      return sum + (e.direction === "CREDIT" ? e.amountCents : -e.amountCents);
    }, 0);

    const providerTotal = provider.reduce((sum, e) => sum + e.amountCents, 0);

    // Detect variances
    const variances = detectVariances({ ledger, provider });
    const totalVariance = Math.abs(providerTotal - ledgerTotal);

    // Determine status
    let status: ReconciliationStatus = "OK";
    if (variances.length > VARIANCE_COUNT_ERROR_THRESHOLD || totalVariance > VARIANCE_ERROR_THRESHOLD_CENTS) {
      status = "ERROR";
    } else if (variances.length > VARIANCE_COUNT_WARNING_THRESHOLD || totalVariance > VARIANCE_WARNING_THRESHOLD_CENTS) {
      status = "WARNING";
    }

    // Build report
    const reportJson = {
      ledgerBreakdown: summarizeLedgerByType(ledger),
      providerBreakdown: summarizeProviderByType(provider),
      varianceSummary: summarizeVariances(variances),
    };

    const summaryJson = {
      ledgerCredits: ledger.filter((e) => e.direction === "CREDIT").reduce((s, e) => s + e.amountCents, 0),
      ledgerDebits: ledger.filter((e) => e.direction === "DEBIT").reduce((s, e) => s + e.amountCents, 0),
      netLedger: ledgerTotal,
      providerTotal,
      variance: totalVariance,
    };

    // Update reconciliation
    await prisma.financeReconciliation.update({
      where: { id: recon.id },
      data: {
        ledgerTotalCents: ledgerTotal,
        providerTotalCents: providerTotal,
        varianceCents: totalVariance,
        ledgerEntryCount: ledger.length,
        providerEventCount: provider.length,
        varianceCount: variances.length,
        status,
        reportJson,
        summaryJson,
        completedAt: new Date(),
      },
    });

    // Create variance records
    if (variances.length > 0) {
      await prisma.financeVariance.createMany({
        data: variances.map((v) => ({
          reconciliationId: recon.id,
          type: v.type,
          ledgerEntryId: v.ledgerEntryId,
          providerRef: v.providerRef,
          providerObjectType: v.providerObjectType,
          ledgerAmountCents: v.ledgerAmountCents,
          providerAmountCents: v.providerAmountCents,
          varianceAmountCents: v.varianceAmountCents,
          orderId: v.orderId,
          sellerId: v.sellerId,
        })),
      });
    }

    // Audit
    await prisma.auditEvent.create({
      data: {
        actorUserId: options?.staffId ?? "system",
        action: status === "ERROR" ? "finance.reconcile.error" : "finance.reconcile.run",
        entityType: "FinanceReconciliation",
        entityId: recon.id,
        metaJson: { date: dayStart, status, varianceCents: totalVariance, varianceCount: variances.length },
      },
    });

    return {
      date: dayStart,
      status,
      ledgerTotalCents: ledgerTotal,
      providerTotalCents: providerTotal,
      varianceCents: totalVariance,
      ledgerEntryCount: ledger.length,
      providerEventCount: provider.length,
      variances,
    };
  } catch (error) {
    // Mark as failed
    await prisma.financeReconciliation.update({
      where: { id: recon.id },
      data: {
        status: "ERROR",
        completedAt: new Date(),
        reportJson: { error: String(error) },
      },
    });
    throw error;
  }
}

function summarizeLedgerByType(ledger: any[]): Record<string, { count: number; totalCents: number }> {
  const summary: Record<string, { count: number; totalCents: number }> = {};
  for (const e of ledger) {
    if (!summary[e.type]) summary[e.type] = { count: 0, totalCents: 0 };
    summary[e.type].count++;
    summary[e.type].totalCents += e.direction === "CREDIT" ? e.amountCents : -e.amountCents;
  }
  return summary;
}

function summarizeProviderByType(provider: any[]): Record<string, { count: number; totalCents: number }> {
  const summary: Record<string, { count: number; totalCents: number }> = {};
  for (const e of provider) {
    if (!summary[e.objectType]) summary[e.objectType] = { count: 0, totalCents: 0 };
    summary[e.objectType].count++;
    summary[e.objectType].totalCents += e.amountCents;
  }
  return summary;
}

function summarizeVariances(variances: any[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const v of variances) {
    summary[v.type] = (summary[v.type] ?? 0) + 1;
  }
  return summary;
}

/**
 * Get reconciliation history
 */
export async function getReconciliationHistory(limit = 30) {
  return prisma.financeReconciliation.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: { _count: { select: { variances: true } } },
  });
}

/**
 * Get reconciliation details with variances
 */
export async function getReconciliationDetails(date: Date) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);

  return prisma.financeReconciliation.findUnique({
    where: { date: dayStart },
    include: { variances: true },
  });
}
```

---

## 6) Finance Report Service

Create `packages/core/finance/reports.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type ReportPeriod = {
  start: Date;
  end: Date;
};

/**
 * Generate daily summary report
 */
export async function generateDailySummary(date: Date, staffId?: string) {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Check if already exists
  const existing = await prisma.financeReport.findUnique({
    where: {
      type_periodStart_periodEnd: {
        type: "DAILY_SUMMARY",
        periodStart: dayStart,
        periodEnd: dayEnd,
      },
    },
  });

  if (existing && existing.status === "COMPLETED") {
    return existing;
  }

  // Create report record
  const report = await prisma.financeReport.upsert({
    where: {
      type_periodStart_periodEnd: {
        type: "DAILY_SUMMARY",
        periodStart: dayStart,
        periodEnd: dayEnd,
      },
    },
    update: { status: "GENERATING" },
    create: {
      type: "DAILY_SUMMARY",
      periodStart: dayStart,
      periodEnd: dayEnd,
      status: "GENERATING",
      generatedByStaffId: staffId,
    },
  });

  try {
    // Calculate metrics
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { occurredAt: { gte: dayStart, lte: dayEnd } },
    });

    // Group by type
    const byType: Record<string, { count: number; totalCents: number }> = {};
    for (const e of ledgerEntries) {
      if (!byType[e.type]) byType[e.type] = { count: 0, totalCents: 0 };
      byType[e.type].count++;
      byType[e.type].totalCents += e.direction === "CREDIT" ? e.amountCents : -e.amountCents;
    }

    // Calculate totals
    const grossRevenue = byType["PAYMENT"]?.totalCents ?? 0;
    const fees = Math.abs(byType["MARKETPLACE_FEE"]?.totalCents ?? 0);
    const refunds = Math.abs(byType["REFUND"]?.totalCents ?? 0);
    const payouts = Math.abs(byType["PAYOUT"]?.totalCents ?? 0);
    const netRevenue = grossRevenue - fees - refunds;

    // Order stats
    const orders = await prisma.order.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    });
    const completedOrders = await prisma.order.count({
      where: { completedAt: { gte: dayStart, lte: dayEnd } },
    });

    const dataJson = {
      ledgerBreakdown: byType,
      orderStats: { created: orders, completed: completedOrders },
      topSellers: await getTopSellers(dayStart, dayEnd, 10),
    };

    const summaryJson = {
      grossRevenueCents: grossRevenue,
      netRevenueCents: netRevenue,
      totalFeesCents: fees,
      totalRefundsCents: refunds,
      totalPayoutsCents: payouts,
      orderCount: orders,
      completedOrderCount: completedOrders,
    };

    // Update report
    const updated = await prisma.financeReport.update({
      where: { id: report.id },
      data: {
        status: "COMPLETED",
        dataJson,
        summaryJson,
        grossRevenueCents: grossRevenue,
        netRevenueCents: netRevenue,
        totalFeesCents: fees,
        totalRefundsCents: refunds,
        totalPayoutsCents: payouts,
        generatedAt: new Date(),
      },
    });

    return updated;
  } catch (error) {
    await prisma.financeReport.update({
      where: { id: report.id },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

async function getTopSellers(start: Date, end: Date, limit: number) {
  const results = await prisma.ledgerEntry.groupBy({
    by: ["sellerId"],
    where: {
      occurredAt: { gte: start, lte: end },
      type: "PAYMENT",
      sellerId: { not: null },
    },
    _sum: { amountCents: true },
    orderBy: { _sum: { amountCents: "desc" } },
    take: limit,
  });

  return results.map((r) => ({
    sellerId: r.sellerId,
    totalCents: r._sum.amountCents ?? 0,
  }));
}

/**
 * Generate payout summary for a seller
 */
export async function generateSellerPayoutSummary(
  sellerId: string,
  period: ReportPeriod
) {
  const existing = await prisma.sellerPayoutSummary.findUnique({
    where: {
      sellerId_periodStart_periodEnd: {
        sellerId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
  });

  if (existing) return existing;

  // Calculate from ledger
  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      sellerId,
      occurredAt: { gte: period.start, lte: period.end },
    },
  });

  let grossSales = 0;
  let totalFees = 0;
  let totalRefunds = 0;
  let paidOut = 0;

  for (const e of ledgerEntries) {
    switch (e.type) {
      case "PAYMENT":
        grossSales += e.amountCents;
        break;
      case "MARKETPLACE_FEE":
        totalFees += Math.abs(e.amountCents);
        break;
      case "REFUND":
        totalRefunds += Math.abs(e.amountCents);
        break;
      case "PAYOUT":
        paidOut += Math.abs(e.amountCents);
        break;
    }
  }

  const netPayable = grossSales - totalFees - totalRefunds;
  const pending = Math.max(0, netPayable - paidOut);

  // Get counts
  const orderCount = await prisma.order.count({
    where: {
      sellerId,
      createdAt: { gte: period.start, lte: period.end },
    },
  });

  const refundCount = await prisma.refundRecord.count({
    where: {
      sellerId,
      createdAt: { gte: period.start, lte: period.end },
    },
  });

  const payoutCount = await prisma.payout.count({
    where: {
      sellerId,
      createdAt: { gte: period.start, lte: period.end },
    },
  });

  return prisma.sellerPayoutSummary.create({
    data: {
      sellerId,
      periodStart: period.start,
      periodEnd: period.end,
      grossSalesCents: grossSales,
      totalFeesCents: totalFees,
      totalRefundsCents: totalRefunds,
      netPayableCents: netPayable,
      paidOutCents: paidOut,
      pendingCents: pending,
      orderCount,
      refundCount,
      payoutCount,
    },
  });
}
```

---

## 7) API Endpoints

### 7.1 Reconciliation List

Create `apps/web/app/api/platform/finance/reconciliations/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getReconciliationHistory } from "@/packages/core/finance/reconciliation";

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "finance.view");

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "30");

  const reconciliations = await getReconciliationHistory(limit);

  return NextResponse.json({ reconciliations });
}
```

### 7.2 Reconciliation Detail

Create `apps/web/app/api/platform/finance/reconciliations/[date]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { getReconciliationDetails } from "@/packages/core/finance/reconciliation";

export async function GET(req: Request, { params }: { params: { date: string } }) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "finance.view");

  const date = new Date(params.date);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  }

  const details = await getReconciliationDetails(date);
  if (!details) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ reconciliation: details });
}
```

### 7.3 Run Reconciliation (Manual)

Create `apps/web/app/api/platform/finance/reconciliations/run/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";
import { runDailyReconciliation } from "@/packages/core/finance/reconciliation";

export async function POST(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "finance.reconcile");

  const { date } = await req.json();
  const targetDate = date ? new Date(date) : new Date(Date.now() - 86400000); // Default: yesterday

  try {
    const result = await runDailyReconciliation(targetDate, {
      staffId: ctx.actorUserId,
      runType: "manual",
    });
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

### 7.4 Payout Summary

Create `apps/web/app/api/platform/finance/payout-summary/route.ts`:

```ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requirePlatformAuth } from "@/apps/web/lib/platformAuth";
import { assertPermission } from "@/packages/core/rbac/authorize";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const ctx = await requirePlatformAuth();
  assertPermission(ctx, "finance.view");

  // Get pending payouts
  const pendingPayouts = await prisma.payout.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totalPending = pendingPayouts.reduce((s, p) => s + p.amountCents, 0);

  // Get recent completed payouts
  const recentPayouts = await prisma.payout.findMany({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  // Get active holds
  const activeHolds = await prisma.payoutHold.findMany({
    where: { status: "ACTIVE" },
  });

  const totalHeld = activeHolds.reduce((s, h) => s + (h.amountCents ?? 0), 0);

  return NextResponse.json({
    summary: {
      pendingCount: pendingPayouts.length,
      pendingTotalCents: totalPending,
      holdCount: activeHolds.length,
      holdTotalCents: totalHeld,
    },
    pendingPayouts,
    recentPayouts,
    activeHolds,
  });
}
```

---

## 8) Cron Job

Create `packages/core/finance/cron.ts`:

```ts
import { runDailyReconciliation } from "./reconciliation";
import { generateDailySummary } from "./reports";

/**
 * Daily finance cron job
 * Run at 2:00 AM UTC for previous day
 */
export async function runDailyFinanceCron() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  console.log(`Running daily finance cron for ${yesterday.toISOString()}`);

  try {
    // Run reconciliation
    const recon = await runDailyReconciliation(yesterday, { runType: "scheduled" });
    console.log(`Reconciliation: ${recon.status}, variance: ${recon.varianceCents} cents`);

    // Generate daily summary
    const summary = await generateDailySummary(yesterday);
    console.log(`Daily summary generated: ${summary.id}`);

    return { recon, summary };
  } catch (error) {
    console.error("Daily finance cron failed:", error);
    throw error;
  }
}
```

---

## 9) Health Provider

Create `packages/core/health/providers/financeReconHealthProvider.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import type { HealthProvider, HealthResult, HealthRunContext } from "../types";
import { HEALTH_STATUS } from "../types";

const prisma = new PrismaClient();

export const financeReconHealthProvider: HealthProvider = {
  id: "finance_recon",
  label: "Finance Reconciliation",
  description: "Validates ledger-provider reconciliation and variance detection",
  version: "1.0.0",

  async run(ctx: HealthRunContext): Promise<HealthResult> {
    const checks = [];
    let status = HEALTH_STATUS.PASS;

    // Check 1: Recent reconciliation exists
    const recent = await prisma.financeReconciliation.findFirst({
      where: { date: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      orderBy: { date: "desc" },
    });
    checks.push({
      id: "recon.recent_exists",
      label: "Recent reconciliation exists",
      status: recent ? HEALTH_STATUS.PASS : HEALTH_STATUS.WARN,
      message: recent ? `Last: ${recent.date.toISOString().split("T")[0]}` : "No recent reconciliation",
    });
    if (!recent && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;

    // Check 2: No ERROR status reconciliations in last 7 days
    const errors = await prisma.financeReconciliation.count({
      where: {
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        status: "ERROR",
      },
    });
    checks.push({
      id: "recon.no_errors",
      label: "No reconciliation errors (7d)",
      status: errors === 0 ? HEALTH_STATUS.PASS : HEALTH_STATUS.FAIL,
      message: errors === 0 ? "No errors" : `${errors} errors`,
    });
    if (errors > 0) status = HEALTH_STATUS.FAIL;

    // Check 3: Unresolved variances count
    const unresolvedVariances = await prisma.financeVariance.count({
      where: { isResolved: false },
    });
    checks.push({
      id: "recon.unresolved_variances",
      label: "Unresolved variances",
      status: unresolvedVariances < 10 ? HEALTH_STATUS.PASS : unresolvedVariances < 50 ? HEALTH_STATUS.WARN : HEALTH_STATUS.FAIL,
      message: `${unresolvedVariances} unresolved`,
    });
    if (unresolvedVariances >= 50) status = HEALTH_STATUS.FAIL;
    else if (unresolvedVariances >= 10 && status === HEALTH_STATUS.PASS) status = HEALTH_STATUS.WARN;

    // Check 4: Ledger entry count sanity
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const ledgerToday = await prisma.ledgerEntry.count({
      where: { createdAt: { gte: todayStart } },
    });
    checks.push({
      id: "ledger.today_count",
      label: "Ledger entries today",
      status: HEALTH_STATUS.PASS,
      message: `${ledgerToday} entries`,
    });

    return {
      providerId: "finance_recon",
      status,
      summary: status === HEALTH_STATUS.PASS ? "Finance reconciliation healthy" : "Issues detected",
      providerVersion: "1.0.0",
      ranAt: new Date().toISOString(),
      runType: ctx.runType,
      checks,
    };
  },

  settings: { schema: {}, defaults: {} },
  ui: { SettingsPanel: () => null, DetailPage: () => null },
};
```

---

## 10) Doctor Checks

```ts
async function checkFinanceRecon() {
  const checks = [];

  // 1. Create test ledger entries and provider events
  const testDate = new Date();
  testDate.setDate(testDate.getDate() - 2); // 2 days ago
  testDate.setUTCHours(12, 0, 0, 0);

  const testLedgerKey = `test:recon:${Date.now()}`;
  const testProviderRef = `test_pi_${Date.now()}`;

  // Create matching entries
  const ledgerEntry = await prisma.ledgerEntry.create({
    data: {
      ledgerKey: testLedgerKey,
      provider: "test",
      providerObjectType: "payment",
      providerObjectId: testProviderRef,
      type: "PAYMENT",
      direction: "CREDIT",
      amountCents: 10000,
      currency: "USD",
      occurredAt: testDate,
    },
  });

  const providerEvent = await prisma.providerEvent.create({
    data: {
      provider: "test",
      providerRef: testProviderRef,
      objectType: "payment",
      amountCents: 10000,
      occurredAt: testDate,
    },
  });

  checks.push({ key: "recon.setup", ok: true, details: "Test data created" });

  // 2. Run reconciliation - should be OK
  // (Simplified - in real test would call runDailyReconciliation)
  const variances = detectVariances({
    ledger: [{ id: ledgerEntry.id, ledgerKey: testLedgerKey, providerObjectId: testProviderRef, amountCents: 10000, direction: "CREDIT", type: "PAYMENT", occurredAt: testDate }],
    provider: [{ id: providerEvent.id, providerRef: testProviderRef, objectType: "payment", amountCents: 10000, occurredAt: testDate }],
  });

  checks.push({
    key: "recon.matching_ok",
    ok: variances.length === 0,
    details: variances.length === 0 ? "No variances" : `${variances.length} variances`,
  });

  // 3. Test amount mismatch detection
  const mismatchVariances = detectVariances({
    ledger: [{ id: "l1", ledgerKey: "k1", providerObjectId: "p1", amountCents: 10000, direction: "CREDIT", type: "PAYMENT", occurredAt: testDate }],
    provider: [{ id: "e1", providerRef: "p1", objectType: "payment", amountCents: 10500, occurredAt: testDate }],
  });

  checks.push({
    key: "recon.mismatch_detected",
    ok: mismatchVariances.some((v) => v.type === "AMOUNT_MISMATCH"),
    details: mismatchVariances.some((v) => v.type === "AMOUNT_MISMATCH") ? "Mismatch detected" : "Mismatch NOT detected",
  });

  // 4. Test missing provider detection
  const missingVariances = detectVariances({
    ledger: [{ id: "l2", ledgerKey: "k2", providerObjectId: "p_missing", amountCents: 5000, direction: "CREDIT", type: "PAYMENT", occurredAt: testDate }],
    provider: [],
  });

  checks.push({
    key: "recon.missing_detected",
    ok: missingVariances.some((v) => v.type === "MISSING_PROVIDER"),
    details: missingVariances.some((v) => v.type === "MISSING_PROVIDER") ? "Missing detected" : "Missing NOT detected",
  });

  // Cleanup
  await prisma.providerEvent.deleteMany({ where: { provider: "test" } });
  await prisma.ledgerEntry.deleteMany({ where: { provider: "test" } });

  return checks;
}
```

---

## 11) Phase 18 Completion Criteria

- Daily reconciliation job runs and records results
- Ledger remains immutable (reconciliation only reads)
- Variances detected: MISSING_LEDGER, MISSING_PROVIDER, AMOUNT_MISMATCH
- Variance records persisted with reconciliation
- Finance reports are read-only after generation
- Seller payout summaries calculated correctly
- Health provider tracks reconciliation status
- Doctor verifies variance detection
