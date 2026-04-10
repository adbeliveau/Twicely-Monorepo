/**
 * Finance Reconciliation Alerts
 * Checks variance thresholds and emits alerts when exceeded.
 * Canonical 31 Section 12.
 */

import { getPlatformSetting } from "@twicely/db/queries/platform-settings";

export interface VarianceAlertInput {
  reportId: string;
  varianceCount: number;
  varianceTotalCents: number;
  warningThreshold: number;
  errorThreshold: number;
}

export type AlertLevel = "info" | "warning" | "error";

export interface AlertResult {
  level: AlertLevel;
  message: string;
  reportId: string;
  varianceCount: number;
  varianceTotalCents: number;
}

export async function checkVarianceAlerts(
  input: VarianceAlertInput,
): Promise<AlertResult> {
  const alertEmail = await getPlatformSetting("finance.reconciliation.alertEmail", "");

  let level: AlertLevel = "info";
  if (input.varianceTotalCents >= input.errorThreshold) {
    level = "error";
  } else if (input.varianceTotalCents >= input.warningThreshold) {
    level = "warning";
  }

  const dollars = (input.varianceTotalCents / 100).toFixed(2);
  const message = level === "info"
    ? "Reconciliation completed with " + input.varianceCount + " variance(s). Total: $" + dollars
    : "Reconciliation " + level.toUpperCase() + ": " + input.varianceCount + " variance(s), total $" + dollars;

  const result: AlertResult = {
    level,
    message,
    reportId: input.reportId,
    varianceCount: input.varianceCount,
    varianceTotalCents: input.varianceTotalCents,
  };

  return result;
}
