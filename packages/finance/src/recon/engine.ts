/**
 * Finance Reconciliation Engine
 * Canonical 31 Section 6.1.
 */

import { db } from "@twicely/db";
import {
  reconciliationReport,
  reconciliationVariance,
  ledgerEntry,
  stripeEventLog,
} from "@twicely/db/schema";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getPlatformSetting } from "@twicely/db/queries/platform-settings";

import type {
  ReconRunInput, ReconciliationResult, Variance,
  ReconStatus, ReconSummaryJson, ReconDiscrepanciesJson, Severity,
} from "./types";
import { checkStripeVsLedger } from "./checks/stripe-vs-ledger";
import { classifyVarianceSeverity, shouldAutoResolve } from "./rules";
import { checkVarianceAlerts } from "./alerts";

export async function runReconciliation(
  input: ReconRunInput = {},
): Promise<ReconciliationResult> {
  const enabled = await getPlatformSetting("finance.reconciliation.enabled", true);
  if (!enabled) {
    return {
      reportId: "", status: "failed", totalEntriesChecked: 0,
      matchedCount: 0, varianceCount: 0, varianceTotalCents: 0,
      stripeTotalCents: 0, ledgerTotalCents: 0, variances: [],
    };
  }

  const lookbackHours = input.lookbackHours
    ?? await getPlatformSetting("finance.reconciliation.lookbackHours", 48);
  const now = input.date ?? new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  const existingClean = await db
    .select({ id: reconciliationReport.id })
    .from(reconciliationReport)
    .where(and(
      eq(reconciliationReport.periodStart, periodStart),
      eq(reconciliationReport.periodEnd, periodEnd),
      eq(reconciliationReport.status, "clean"),
    ))
    .limit(1);

  if (existingClean.length > 0) {
    return {
      reportId: existingClean[0].id, status: "clean", totalEntriesChecked: 0,
      matchedCount: 0, varianceCount: 0, varianceTotalCents: 0,
      stripeTotalCents: 0, ledgerTotalCents: 0, variances: [],
    };
  }

  const reportId = createId();
  await db.insert(reconciliationReport).values({
    id: reportId, periodStart, periodEnd,
    status: "running", totalEntriesChecked: 0, discrepancyCount: 0,
  });

  try {
    return await executeReconChecks(reportId, periodStart, periodEnd);
  } catch (error) {
    await db.update(reconciliationReport)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(reconciliationReport.id, reportId));
    throw error;
  }
}

async function executeReconChecks(
  reportId: string, periodStart: Date, periodEnd: Date,
): Promise<ReconciliationResult> {
  const ledgerEntries = await db.select({
    id: ledgerEntry.id, type: ledgerEntry.type,
    amountCents: ledgerEntry.amountCents, stripeEventId: ledgerEntry.stripeEventId,
    orderId: ledgerEntry.orderId, userId: ledgerEntry.userId,
    createdAt: ledgerEntry.createdAt,
  }).from(ledgerEntry).where(and(
    isNotNull(ledgerEntry.stripeEventId),
    gte(ledgerEntry.createdAt, periodStart),
    lte(ledgerEntry.createdAt, periodEnd),
  ));

  const eventLogs = await db.select({
    id: stripeEventLog.id, stripeEventId: stripeEventLog.stripeEventId,
    eventType: stripeEventLog.eventType,
    processingStatus: stripeEventLog.processingStatus,
    createdAt: stripeEventLog.createdAt,
  }).from(stripeEventLog).where(and(
    gte(stripeEventLog.createdAt, periodStart),
    lte(stripeEventLog.createdAt, periodEnd),
  ));

  const stripeEvents = eventLogs.map((log) => ({
    id: log.stripeEventId, type: log.eventType, amountCents: 0,
    occurredAt: log.createdAt, objectId: log.stripeEventId,
  }));

  const checkResult = checkStripeVsLedger({
    stripeEvents, ledgerEntries, stripeEventLogs: eventLogs,
  });

  const classifiedVariances: Variance[] = [];
  for (const v of checkResult.variancesFound) {
    classifiedVariances.push({ ...v, severity: classifyVarianceSeverity(v) });
  }

  const warningThreshold = await getPlatformSetting(
    "finance.reconciliation.warningThresholdCents", 10000);
  const errorThreshold = await getPlatformSetting(
    "finance.reconciliation.errorThresholdCents", 100000);
  const varianceTotalCents = classifiedVariances.reduce(
    (sum, v) => sum + Math.abs(v.varianceAmountCents), 0);

  const status: ReconStatus = classifiedVariances.length > 0 ? "discrepancies" : "clean";

  const summaryJson: ReconSummaryJson = {
    stripeTotalCents: checkResult.stripeTotalCents,
    ledgerTotalCents: checkResult.ledgerTotalCents,
    matchedCount: checkResult.matchedCount,
    varianceTotalCents,
  };

  const discrepanciesJson: ReconDiscrepanciesJson = {};
  for (const v of classifiedVariances) {
    discrepanciesJson[v.type] = (discrepanciesJson[v.type] ?? 0) + 1;
  }

  await db.update(reconciliationReport).set({
    status, totalEntriesChecked: checkResult.checkedCount,
    discrepancyCount: classifiedVariances.length,
    discrepanciesJson, summaryJson, completedAt: new Date(),
  }).where(eq(reconciliationReport.id, reportId));

  if (classifiedVariances.length > 0) {
    await db.insert(reconciliationVariance).values(
      classifiedVariances.map((v) => ({
        id: createId(), reconciliationReportId: reportId,
        type: v.type, severity: v.severity ?? ("MEDIUM" as Severity),
        stripeEventId: v.stripeEventId ?? null,
        stripeObjectType: v.stripeObjectType ?? null,
        ledgerEntryId: v.ledgerEntryId ?? null,
        stripeAmountCents: v.stripeAmountCents ?? null,
        ledgerAmountCents: v.ledgerAmountCents ?? null,
        varianceAmountCents: v.varianceAmountCents,
        orderId: v.orderId ?? null, userId: v.userId ?? null,
      })),
    );
  }

  const autoResolveRoundingCents = await getPlatformSetting(
    "finance.reconciliation.autoResolveRoundingCents", 100);
  for (const v of classifiedVariances) {
    if (shouldAutoResolve(v, autoResolveRoundingCents)) {
      const rt = v.type === "TIMING_DIFFERENCE" ? "auto_timing" : "auto_rounding";
      await db.update(reconciliationVariance).set({
        isResolved: true, resolvedAt: new Date(),
        resolutionType: rt, resolutionNote: "Auto-resolved: " + rt,
      }).where(and(
        eq(reconciliationVariance.reconciliationReportId, reportId),
        eq(reconciliationVariance.type, v.type),
        eq(reconciliationVariance.varianceAmountCents, v.varianceAmountCents),
        eq(reconciliationVariance.isResolved, false),
      ));
    }
  }

  if (status === "discrepancies") {
    await checkVarianceAlerts({
      reportId, varianceCount: classifiedVariances.length,
      varianceTotalCents, warningThreshold, errorThreshold,
    });
  }

  return {
    reportId, status,
    totalEntriesChecked: checkResult.checkedCount,
    matchedCount: checkResult.matchedCount,
    varianceCount: classifiedVariances.length, varianceTotalCents,
    stripeTotalCents: checkResult.stripeTotalCents,
    ledgerTotalCents: checkResult.ledgerTotalCents,
    variances: classifiedVariances,
  };
}

export async function runNightlyRecon(): Promise<ReconciliationResult> {
  return runReconciliation();
}
