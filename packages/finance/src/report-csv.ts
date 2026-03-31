/**
 * CSV export generators for financial reports.
 * Pure functions — no I/O, no side effects.
 * All monetary values formatted as dollars.
 */
import type { PnlReportData, BalanceSheetData, CashFlowData } from './report-types';
import { formatCentsToDollars } from './format';

function row(...cells: (string | number)[]): string {
  return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
}

function neg(cents: number): string {
  return cents === 0 ? formatCentsToDollars(0) : `-${formatCentsToDollars(Math.abs(cents))}`;
}

export function generatePnlCsv(data: PnlReportData): string {
  const lines: string[] = [];
  const periodStr = `${data.periodStart.slice(0, 10)} to ${data.periodEnd.slice(0, 10)}`;

  lines.push(row('Profit & Loss Statement'));
  lines.push(row('Period', periodStr));
  lines.push(row('Generated', data.generatedAt));
  lines.push('');
  lines.push(row('Section', 'Item', 'Amount'));

  // Revenue
  lines.push(row('Revenue', 'Gross revenue', formatCentsToDollars(data.grossRevenueCents)));
  lines.push(row('Revenue', 'Order count', data.totalOrderCount));

  // COGS
  if (data.cogsTotalCents > 0) {
    lines.push(row('COGS', 'Cost of goods sold', neg(data.cogsTotalCents)));
    lines.push(row('COGS', 'Gross profit', formatCentsToDollars(data.grossProfitCents)));
  }

  // Fees
  lines.push(row('Fees', 'Transaction Fee', neg(data.tfFeesCents)));
  lines.push(row('Fees', 'Payment processing fee', neg(data.stripeFeesCents)));
  if (data.boostFeesCents > 0) {
    lines.push(row('Fees', 'Boost fees', neg(data.boostFeesCents)));
  }
  if (data.insertionFeesCents > 0) {
    lines.push(row('Fees', 'Insertion fees', neg(data.insertionFeesCents)));
  }
  if (data.localFeesCents > 0) {
    lines.push(row('Fees', 'Local sale fees', neg(data.localFeesCents)));
  }
  if (data.authFeesCents > 0) {
    lines.push(row('Fees', 'Authentication fees', neg(data.authFeesCents)));
  }
  if (data.subscriptionChargesCents > 0) {
    lines.push(row('Fees', 'Subscription charges', neg(data.subscriptionChargesCents)));
  }
  lines.push(row('Fees', 'Total platform fees', neg(data.totalPlatformFeesCents)));

  // Shipping
  if (data.shippingCostsCents > 0) {
    lines.push(row('Shipping', 'Shipping costs', neg(data.shippingCostsCents)));
  }

  // After fees
  lines.push(row('Summary', 'Net after fees', formatCentsToDollars(data.netAfterFeesCents)));

  // Expenses
  if (data.operatingExpensesCents > 0) {
    for (const cat of data.expensesByCategory) {
      lines.push(row('Expenses', cat.category, neg(cat.totalCents)));
    }
    lines.push(row('Expenses', 'Total operating expenses', neg(data.operatingExpensesCents)));
  }

  // Mileage
  if (data.mileageDeductionCents > 0) {
    lines.push(row('Mileage', `${data.tripCount} trips / ${data.totalMiles.toFixed(1)} miles`, neg(data.mileageDeductionCents)));
  }

  // Net earnings
  lines.push(row('Summary', 'Net earnings', formatCentsToDollars(data.netProfitCents)));

  // KPIs
  lines.push('');
  lines.push(row('KPIs', 'Avg sale price', formatCentsToDollars(data.avgSalePriceCents)));
  lines.push(row('KPIs', 'Effective fee rate', `${data.effectiveFeeRatePercent}%`));
  if (data.cogsTotalCents > 0) {
    lines.push(row('KPIs', 'Gross margin', `${data.cogsMarginPercent}%`));
  }

  return lines.join('\n');
}

export function generateBalanceSheetCsv(data: BalanceSheetData): string {
  const lines: string[] = [];
  const asOf = data.periodEnd.slice(0, 10);

  lines.push(row('Balance Sheet'));
  lines.push(row('As of', asOf));
  lines.push(row('Generated', data.generatedAt));
  lines.push('');
  lines.push(row('Section', 'Item', 'Amount'));

  // Assets
  lines.push(row('Assets', 'Available for payout', formatCentsToDollars(data.assets.availableForPayoutCents)));
  lines.push(row('Assets', 'Pending (in escrow)', formatCentsToDollars(data.assets.pendingCents)));
  lines.push(row('Assets', `Inventory value (${data.assets.inventoryCount} items)`, formatCentsToDollars(data.assets.inventoryValueCents)));
  lines.push(row('Assets', 'Total assets', formatCentsToDollars(data.assets.totalCurrentAssetsCents)));

  // Liabilities
  lines.push(row('Liabilities', 'Reserved (holds)', formatCentsToDollars(data.liabilities.reservedCents)));
  lines.push(row('Liabilities', 'Total liabilities', formatCentsToDollars(data.liabilities.totalLiabilitiesCents)));

  // Equity
  lines.push(row('Equity', 'Net equity (assets - liabilities)', formatCentsToDollars(data.equity.netEquityCents)));
  lines.push(row('Equity', 'Period net earnings', formatCentsToDollars(data.equity.periodNetProfitCents)));
  lines.push(row('Equity', 'Total equity', formatCentsToDollars(data.equity.totalEquityCents)));

  return lines.join('\n');
}

export function generateCashFlowCsv(data: CashFlowData): string {
  const lines: string[] = [];
  const periodStr = `${data.periodStart.slice(0, 10)} to ${data.periodEnd.slice(0, 10)}`;

  lines.push(row('Cash Flow Statement'));
  lines.push(row('Period', periodStr));
  lines.push(row('Generated', data.generatedAt));
  lines.push('');
  lines.push(row('Section', 'Item', 'Amount'));

  // Operating
  lines.push(row('Operating', 'Sales received', formatCentsToDollars(data.operating.salesReceivedCents)));
  if (data.operating.refundsIssuedCents > 0) {
    lines.push(row('Operating', 'Refunds issued', neg(data.operating.refundsIssuedCents)));
  }
  lines.push(row('Operating', 'Platform fees paid', neg(data.operating.platformFeesPaidCents)));
  if (data.operating.shippingCostsCents > 0) {
    lines.push(row('Operating', 'Shipping costs', neg(data.operating.shippingCostsCents)));
  }
  if (data.operating.operatingExpensesCents > 0) {
    lines.push(row('Operating', 'Operating expenses', neg(data.operating.operatingExpensesCents)));
  }
  if (data.operating.mileageDeductionCents > 0) {
    lines.push(row('Operating', 'Mileage deductions', neg(data.operating.mileageDeductionCents)));
  }
  lines.push(row('Operating', 'Net operating', formatCentsToDollars(data.operating.netOperatingCents)));

  // Financing
  lines.push(row('Financing', 'Payouts sent', neg(data.financing.payoutsSentCents)));
  if (data.financing.payoutsFailedReversedCents > 0) {
    lines.push(row('Financing', 'Payout reversals', formatCentsToDollars(data.financing.payoutsFailedReversedCents)));
  }
  lines.push(row('Financing', 'Net financing', formatCentsToDollars(data.financing.netFinancingCents)));

  // Summary
  lines.push('');
  lines.push(row('Summary', 'Net cash change', formatCentsToDollars(data.netCashChangeCents)));
  lines.push(row('Summary', 'Beginning balance', formatCentsToDollars(data.beginningBalanceCents)));
  lines.push(row('Summary', 'Ending balance', formatCentsToDollars(data.endingBalanceCents)));

  return lines.join('\n');
}
