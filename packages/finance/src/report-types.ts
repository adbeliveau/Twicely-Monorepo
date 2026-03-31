/**
 * Type-only file for financial report data structures.
 * Extracted from apps/web/src/lib/queries/finance-center-reports-pnl.ts
 * and apps/web/src/lib/queries/finance-center-reports-balance-cashflow.ts
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

export interface BalanceSheetData {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  assets: {
    availableForPayoutCents: number;
    pendingCents: number;
    inventoryValueCents: number;
    inventoryCount: number;
    totalCurrentAssetsCents: number;
  };

  liabilities: {
    reservedCents: number;
    pendingRefundsCents: number;
    totalLiabilitiesCents: number;
  };

  equity: {
    netEquityCents: number;
    periodNetProfitCents: number;
    totalEquityCents: number;
  };
}

export interface CashFlowData {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  operating: {
    salesReceivedCents: number;
    refundsIssuedCents: number;
    platformFeesPaidCents: number;
    shippingCostsCents: number;
    operatingExpensesCents: number;
    mileageDeductionCents: number;
    netOperatingCents: number;
  };

  financing: {
    payoutsSentCents: number;
    payoutsFailedReversedCents: number;
    netFinancingCents: number;
  };

  netCashChangeCents: number;
  beginningBalanceCents: number;
  endingBalanceCents: number;
}
