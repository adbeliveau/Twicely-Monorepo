/**
 * Finance Center P&L report types.
 * Extracted from finance-center-reports-pnl.ts to stay under the 300-line limit.
 */

export interface PnlReportData {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  grossRevenueCents: number;
  totalOrderCount: number;

  cogsTotalCents: number;
  grossProfitCents: number;

  tfFeesCents: number;
  stripeFeesCents: number;
  boostFeesCents: number;
  insertionFeesCents: number;
  localFeesCents: number;
  authFeesCents: number;
  subscriptionChargesCents: number;
  crosslisterFeesCents: number;
  totalPlatformFeesCents: number;

  crosslisterRevenueCents: number;
  /** Cash local sale revenue — INFORMATIONAL, no platform fee (§A16) */
  cashLocalRevenueCents: number;
  shippingCostsCents: number;

  netAfterFeesCents: number;

  operatingExpensesCents: number;
  expensesByCategory: Array<{ category: string; totalCents: number; count: number }>;

  mileageDeductionCents: number;
  totalMiles: number;
  tripCount: number;

  netProfitCents: number;

  avgSalePriceCents: number;
  effectiveFeeRatePercent: number;
  cogsMarginPercent: number;
}
