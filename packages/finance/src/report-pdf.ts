/**
 * Print-optimized HTML generators for financial reports.
 * Returns self-contained <!DOCTYPE html> documents.
 * Users download the HTML file and print to PDF via their browser.
 */
import type { PnlReportData, BalanceSheetData, CashFlowData } from './report-types';
import { formatCentsToDollars } from './format';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BASE_STYLES = `
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { font-size: 13px; color: #555; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f4f4f4; text-align: left; padding: 8px 12px; font-size: 13px; border-bottom: 2px solid #ddd; }
  td { padding: 6px 12px; font-size: 13px; border-bottom: 1px solid #eee; }
  td.amt { text-align: right; font-variant-numeric: tabular-nums; }
  td.neg { text-align: right; color: #c0392b; }
  tr.section-header td { font-weight: bold; background: #f9f9f9; padding-top: 12px; }
  tr.total td { font-weight: bold; border-top: 2px solid #ddd; }
  .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 8px; }
  @media print {
    body { padding: 0; }
    @page { margin: 20mm; }
    .no-print { display: none; }
  }
`;

function html(title: string, subtitle: string, body: string, footer: string): string {
  const escaped = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escaped} | Twicely Financial Report</title>
<style>${BASE_STYLES}</style>
</head>
<body>
<h1>Twicely Financial Report</h1>
<p class="subtitle">${subtitle}</p>
${body}
<div class="footer">${footer}</div>
</body>
</html>`;
}

function negCell(cents: number): string {
  return cents === 0
    ? `<td class="amt">${formatCentsToDollars(0)}</td>`
    : `<td class="neg">-${formatCentsToDollars(Math.abs(cents))}</td>`;
}

function posCell(cents: number): string {
  return `<td class="amt">${formatCentsToDollars(cents)}</td>`;
}

function sectionRow(label: string): string {
  return `<tr class="section-header"><td colspan="2">${label}</td></tr>`;
}

function dataRow(label: string, valueCell: string, indent = false): string {
  const labelCell = indent ? `<td style="padding-left:24px">${label}</td>` : `<td>${label}</td>`;
  return `<tr>${labelCell}${valueCell}</tr>`;
}

function totalRow(label: string, valueCell: string): string {
  return `<tr class="total"><td>${label}</td>${valueCell}</tr>`;
}

export function generatePnlHtml(data: PnlReportData): string {
  const periodStr = `${data.periodStart.slice(0, 10)} to ${data.periodEnd.slice(0, 10)}`;
  const subtitle = `P&amp;L Statement &bull; ${periodStr}`;

  let rows = '';
  rows += sectionRow('Revenue');
  rows += dataRow('Gross revenue', posCell(data.grossRevenueCents));
  rows += dataRow('Order count', `<td class="amt">${data.totalOrderCount}</td>`);

  if (data.cogsTotalCents > 0) {
    rows += sectionRow('Cost of Goods Sold');
    rows += dataRow('Cost of goods sold', negCell(data.cogsTotalCents), true);
    rows += totalRow('Gross profit', posCell(data.grossProfitCents));
  }

  rows += sectionRow('Platform Fees');
  rows += dataRow('Transaction Fee', negCell(data.tfFeesCents), true);
  rows += dataRow('Payment processing fee', negCell(data.stripeFeesCents), true);
  if (data.boostFeesCents > 0) rows += dataRow('Boost fees', negCell(data.boostFeesCents), true);
  if (data.insertionFeesCents > 0) rows += dataRow('Insertion fees', negCell(data.insertionFeesCents), true);
  if (data.localFeesCents > 0) rows += dataRow('Local sale fees', negCell(data.localFeesCents), true);
  if (data.authFeesCents > 0) rows += dataRow('Authentication fees', negCell(data.authFeesCents), true);
  if (data.subscriptionChargesCents > 0) rows += dataRow('Subscription charges', negCell(data.subscriptionChargesCents), true);
  rows += totalRow('Total platform fees', negCell(data.totalPlatformFeesCents));

  if (data.shippingCostsCents > 0) {
    rows += sectionRow('Shipping');
    rows += dataRow('Shipping costs', negCell(data.shippingCostsCents), true);
  }

  rows += totalRow('Net after fees', posCell(data.netAfterFeesCents));

  if (data.operatingExpensesCents > 0) {
    rows += sectionRow('Operating Expenses');
    for (const cat of data.expensesByCategory) {
      rows += dataRow(escapeHtml(cat.category), negCell(cat.totalCents), true);
    }
    rows += totalRow('Total operating expenses', negCell(data.operatingExpensesCents));
  }

  if (data.mileageDeductionCents > 0) {
    rows += sectionRow('Mileage Deductions');
    rows += dataRow(
      `${data.tripCount} trips &bull; ${data.totalMiles.toFixed(1)} miles`,
      negCell(data.mileageDeductionCents),
      true,
    );
  }

  rows += totalRow('Net earnings', posCell(data.netProfitCents));

  const kpis = `
    <table>
      <tr><th colspan="2">Key Performance Indicators</th></tr>
      <tr><td>Average sale price</td>${posCell(data.avgSalePriceCents)}</tr>
      <tr><td>Effective fee rate</td><td class="amt">${data.effectiveFeeRatePercent}%</td></tr>
      ${data.cogsTotalCents > 0 ? `<tr><td>Gross margin</td><td class="amt">${data.cogsMarginPercent}%</td></tr>` : ''}
    </table>`;

  const body = `<table><tr><th>Item</th><th style="text-align:right">Amount</th></tr>${rows}</table>${kpis}`;
  const footer = `Generated by Twicely Financial Center on ${data.generatedAt}`;

  return html('P&L Statement', subtitle, body, footer);
}

export function generateBalanceSheetHtml(data: BalanceSheetData): string {
  const subtitle = `Balance Sheet &bull; As of ${data.periodEnd.slice(0, 10)}`;

  let rows = '';
  rows += sectionRow('Assets');
  rows += dataRow('Available for payout', posCell(data.assets.availableForPayoutCents), true);
  rows += dataRow('Pending (in escrow)', posCell(data.assets.pendingCents), true);
  rows += dataRow(`Inventory value (${data.assets.inventoryCount} items)`, posCell(data.assets.inventoryValueCents), true);
  rows += totalRow('Total assets', posCell(data.assets.totalCurrentAssetsCents));

  rows += sectionRow('Liabilities');
  rows += dataRow('Reserved (holds)', posCell(data.liabilities.reservedCents), true);
  rows += totalRow('Total liabilities', posCell(data.liabilities.totalLiabilitiesCents));

  rows += sectionRow('Equity');
  rows += dataRow('Net equity (assets \u2212 liabilities)', posCell(data.equity.netEquityCents), true);
  rows += dataRow('Period net earnings', posCell(data.equity.periodNetProfitCents), true);
  rows += totalRow('Total equity', posCell(data.equity.totalEquityCents));

  const body = `<table><tr><th>Item</th><th style="text-align:right">Amount</th></tr>${rows}</table>`;
  const footer = `Generated by Twicely Financial Center on ${data.generatedAt}`;

  return html('Balance Sheet', subtitle, body, footer);
}

export function generateCashFlowHtml(data: CashFlowData): string {
  const periodStr = `${data.periodStart.slice(0, 10)} to ${data.periodEnd.slice(0, 10)}`;
  const subtitle = `Cash Flow Statement &bull; ${periodStr}`;

  let rows = '';
  rows += sectionRow('Operating Activities');
  rows += dataRow('Sales received', posCell(data.operating.salesReceivedCents), true);
  if (data.operating.refundsIssuedCents > 0) {
    rows += dataRow('Refunds issued', negCell(data.operating.refundsIssuedCents), true);
  }
  rows += dataRow('Platform fees paid', negCell(data.operating.platformFeesPaidCents), true);
  if (data.operating.shippingCostsCents > 0) {
    rows += dataRow('Shipping costs', negCell(data.operating.shippingCostsCents), true);
  }
  if (data.operating.operatingExpensesCents > 0) {
    rows += dataRow('Operating expenses', negCell(data.operating.operatingExpensesCents), true);
  }
  if (data.operating.mileageDeductionCents > 0) {
    rows += dataRow('Mileage deductions', negCell(data.operating.mileageDeductionCents), true);
  }
  rows += totalRow('Net operating activities', posCell(data.operating.netOperatingCents));

  rows += sectionRow('Financing Activities');
  rows += dataRow('Payouts sent', negCell(data.financing.payoutsSentCents), true);
  if (data.financing.payoutsFailedReversedCents > 0) {
    rows += dataRow('Payout reversals', posCell(data.financing.payoutsFailedReversedCents), true);
  }
  rows += totalRow('Net financing activities', posCell(data.financing.netFinancingCents));

  rows += sectionRow('Summary');
  rows += dataRow('Net cash change', posCell(data.netCashChangeCents));
  rows += dataRow('Beginning balance', posCell(data.beginningBalanceCents));
  rows += totalRow('Ending balance', posCell(data.endingBalanceCents));

  const body = `<table><tr><th>Item</th><th style="text-align:right">Amount</th></tr>${rows}</table>`;
  const footer = `Generated by Twicely Financial Center on ${data.generatedAt}`;

  return html('Cash Flow Statement', subtitle, body, footer);
}
