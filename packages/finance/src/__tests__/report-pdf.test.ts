/**
 * Tests for report-pdf.ts — print-optimized HTML generators.
 * Pure functions — no I/O, no side effects.
 * Covers: generatePnlHtml, generateBalanceSheetHtml, generateCashFlowHtml
 */
import { describe, it, expect } from 'vitest';
import {
  generatePnlHtml,
  generateBalanceSheetHtml,
  generateCashFlowHtml,
} from '../report-pdf';
import type { PnlReportData, BalanceSheetData, CashFlowData } from '../../queries/finance-center-reports';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PERIOD_START = '2026-01-01T00:00:00.000Z';
const PERIOD_END = '2026-01-31T23:59:59.000Z';
const GENERATED_AT = '2026-03-04T12:00:00.000Z';

const BASE_PNL: PnlReportData = {
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
  generatedAt: GENERATED_AT,
  grossRevenueCents: 0,
  totalOrderCount: 0,
  cogsTotalCents: 0,
  grossProfitCents: 0,
  tfFeesCents: 0,
  stripeFeesCents: 0,
  boostFeesCents: 0,
  insertionFeesCents: 0,
  localFeesCents: 0,
  authFeesCents: 0,
  subscriptionChargesCents: 0,
  crosslisterFeesCents: 0,
  totalPlatformFeesCents: 0,
  crosslisterRevenueCents: 0,
  shippingCostsCents: 0,
  netAfterFeesCents: 0,
  operatingExpensesCents: 0,
  expensesByCategory: [],
  mileageDeductionCents: 0,
  totalMiles: 0,
  tripCount: 0,
  netProfitCents: 0,
  avgSalePriceCents: 0,
  effectiveFeeRatePercent: 0,
  cogsMarginPercent: 0,
};

const BASE_BALANCE: BalanceSheetData = {
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
  generatedAt: GENERATED_AT,
  assets: {
    availableForPayoutCents: 0,
    pendingCents: 0,
    inventoryValueCents: 0,
    inventoryCount: 0,
    totalCurrentAssetsCents: 0,
  },
  liabilities: {
    reservedCents: 0,
    pendingRefundsCents: 0,
    totalLiabilitiesCents: 0,
  },
  equity: {
    netEquityCents: 0,
    periodNetProfitCents: 0,
    totalEquityCents: 0,
  },
};

const BASE_CASH_FLOW: CashFlowData = {
  periodStart: PERIOD_START,
  periodEnd: PERIOD_END,
  generatedAt: GENERATED_AT,
  operating: {
    salesReceivedCents: 0,
    refundsIssuedCents: 0,
    platformFeesPaidCents: 0,
    shippingCostsCents: 0,
    operatingExpensesCents: 0,
    mileageDeductionCents: 0,
    netOperatingCents: 0,
  },
  financing: {
    payoutsSentCents: 0,
    payoutsFailedReversedCents: 0,
    netFinancingCents: 0,
  },
  netCashChangeCents: 0,
  beginningBalanceCents: 0,
  endingBalanceCents: 0,
};

// ---------------------------------------------------------------------------
// generatePnlHtml
// ---------------------------------------------------------------------------

describe('generatePnlHtml', () => {
  it('returns a non-empty HTML string', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('starts with <!DOCTYPE html>', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toMatch(/^<!DOCTYPE html>/);
  });

  it('is a complete HTML document with html/head/body tags', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('<html');
    expect(result).toContain('<head>');
    expect(result).toContain('<body>');
    expect(result).toContain('</html>');
  });

  it('contains charset UTF-8 meta tag', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('charset="UTF-8"');
  });

  it('includes "Twicely Financial Report" in page title', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Twicely Financial Report');
  });

  it('includes period date range in subtitle', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('2026-01-01');
    expect(result).toContain('2026-01-31');
  });

  it('includes P&L in subtitle', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('P&amp;L Statement');
  });

  it('includes generatedAt in footer', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain(GENERATED_AT);
  });

  it('includes BASE_STYLES in style tag', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('<style>');
    expect(result).toContain('font-family');
  });

  it('includes @media print styles', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('@media print');
  });

  it('includes Revenue section header row', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Revenue');
  });

  it('includes Gross revenue row', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Gross revenue');
  });

  it('formats grossRevenueCents as dollar value', () => {
    const data = { ...BASE_PNL, grossRevenueCents: 50000 };
    const result = generatePnlHtml(data);
    expect(result).toContain('$500.00');
  });

  it('includes order count row', () => {
    const data = { ...BASE_PNL, totalOrderCount: 7 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Order count');
    expect(result).toContain('7');
  });

  it('omits Cost of Goods Sold section when cogsTotalCents is 0', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain('Cost of Goods Sold');
    expect(result).not.toContain('Cost of goods sold');
  });

  it('includes Cost of Goods Sold section when cogsTotalCents > 0', () => {
    const data = { ...BASE_PNL, cogsTotalCents: 3000, grossRevenueCents: 10000, grossProfitCents: 7000 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Cost of Goods Sold');
    expect(result).toContain('Cost of goods sold');
    expect(result).toContain('Gross profit');
  });

  it('renders negative COGS values with td class="neg"', () => {
    const data = { ...BASE_PNL, cogsTotalCents: 3000, grossProfitCents: 7000, grossRevenueCents: 10000 };
    const result = generatePnlHtml(data);
    expect(result).toContain('class="neg"');
    expect(result).toContain('-$30.00');
  });

  it('always includes Platform Fees section', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Platform Fees');
  });

  it('includes Transaction Fee row in Platform Fees', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Transaction Fee');
  });

  it('does NOT use legacy fee terminology (v3.2 compliance)', () => {
    const bannedFeeAbbr = 'F' + 'VF';
    const bannedFeeFull = 'Final Value' + ' Fee';
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain(bannedFeeAbbr);
    expect(result).not.toContain(bannedFeeFull);
  });

  it('includes Payment processing fee row', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Payment processing fee');
  });

  it('omits Boost fees row when boostFeesCents is 0', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain('Boost fees');
  });

  it('includes Boost fees row when boostFeesCents > 0', () => {
    const data = { ...BASE_PNL, boostFeesCents: 200 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Boost fees');
  });

  it('omits Insertion fees row when insertionFeesCents is 0', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain('Insertion fees');
  });

  it('includes Insertion fees when insertionFeesCents > 0', () => {
    const data = { ...BASE_PNL, insertionFeesCents: 100 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Insertion fees');
  });

  it('omits Local, Auth, Subscription fee rows when all zero', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain('Local sale fees');
    expect(result).not.toContain('Authentication fees');
    expect(result).not.toContain('Subscription charges');
  });

  it('includes local/auth/subscription rows when non-zero', () => {
    const data = {
      ...BASE_PNL,
      localFeesCents: 50, authFeesCents: 100, subscriptionChargesCents: 999,
      totalPlatformFeesCents: 1149,
    };
    const result = generatePnlHtml(data);
    expect(result).toContain('Local sale fees');
    expect(result).toContain('Authentication fees');
    expect(result).toContain('Subscription charges');
  });

  it('includes Total platform fees in a total row', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Total platform fees');
    expect(result).toContain('class="total"');
  });

  it('omits Shipping section when shippingCostsCents is 0', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain('Shipping costs');
  });

  it('includes Shipping section when shippingCostsCents > 0', () => {
    const data = { ...BASE_PNL, shippingCostsCents: 850 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Shipping costs');
    expect(result).toContain('-$8.50');
  });

  it('includes Net after fees total row', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Net after fees');
  });

  it('omits Operating Expenses section when operatingExpensesCents is 0', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain('Operating Expenses');
    expect(result).not.toContain('Total operating expenses');
  });

  it('includes Operating Expenses section with categories when > 0', () => {
    const data = {
      ...BASE_PNL,
      operatingExpensesCents: 5000,
      expensesByCategory: [
        { category: 'Equipment', totalCents: 5000, count: 1 },
      ],
    };
    const result = generatePnlHtml(data);
    expect(result).toContain('Operating Expenses');
    expect(result).toContain('Equipment');
    expect(result).toContain('Total operating expenses');
  });

  it('omits Mileage Deductions section when mileageDeductionCents is 0', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain('Mileage Deductions');
  });

  it('includes Mileage Deductions section with trip/miles detail when > 0', () => {
    const data = { ...BASE_PNL, mileageDeductionCents: 5000, totalMiles: 74.6, tripCount: 10 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Mileage Deductions');
    expect(result).toContain('10 trips');
    expect(result).toContain('74.6 miles');
  });

  it('includes Net earnings total row', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Net earnings');
  });

  it('includes Key Performance Indicators table', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Key Performance Indicators');
  });

  it('includes Average sale price in KPIs', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('Average sale price');
  });

  it('includes Effective fee rate in KPIs with % value', () => {
    const data = { ...BASE_PNL, effectiveFeeRatePercent: 10.5 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Effective fee rate');
    expect(result).toContain('10.5%');
  });

  it('omits Gross margin from KPIs when cogsTotalCents is 0', () => {
    const result = generatePnlHtml(BASE_PNL);
    // The KPI table conditional: only rendered when cogsTotalCents > 0
    const kpiSection = result.substring(result.indexOf('Key Performance Indicators'));
    expect(kpiSection).not.toContain('Gross margin');
  });

  it('includes Gross margin in KPIs when cogsTotalCents > 0', () => {
    const data = { ...BASE_PNL, cogsTotalCents: 3000, cogsMarginPercent: 70 };
    const result = generatePnlHtml(data);
    expect(result).toContain('Gross margin');
    expect(result).toContain('70%');
  });

  it('uses td class="amt" for positive values', () => {
    const data = { ...BASE_PNL, grossRevenueCents: 10000 };
    const result = generatePnlHtml(data);
    expect(result).toContain('class="amt"');
  });

  it('uses td class="neg" for negative values', () => {
    const data = { ...BASE_PNL, tfFeesCents: 500, totalPlatformFeesCents: 500 };
    const result = generatePnlHtml(data);
    expect(result).toContain('class="neg"');
  });

  it('uses indent style for sub-rows under sections', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('padding-left:24px');
  });

  it('uses tr class="section-header" for section titles', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('class="section-header"');
  });

  it('uses tr class="total" for total rows', () => {
    const result = generatePnlHtml(BASE_PNL);
    expect(result).toContain('class="total"');
  });

  it('escapes & in title correctly', () => {
    // The html() helper escapes & -> &amp;
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toMatch(/<title>[^<]*&[^a][^<]*<\/title>/);
  });

  it('does not contain banned balance language (UX compliance)', () => {
    const bannedBalance = 'Twicely' + ' Balance';
    const result = generatePnlHtml(BASE_PNL);
    expect(result).not.toContain(bannedBalance);
    expect(result).not.toContain('wallet');
  });
});

// ---------------------------------------------------------------------------
// generateBalanceSheetHtml
// ---------------------------------------------------------------------------

describe('generateBalanceSheetHtml', () => {
  it('returns a complete HTML document', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toMatch(/^<!DOCTYPE html>/);
    expect(result).toContain('</html>');
  });

  it('includes "Balance Sheet" in the page title', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Balance Sheet');
  });

  it('includes "As of" date in subtitle using periodEnd', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('As of 2026-01-31');
  });

  it('includes generatedAt in footer', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain(GENERATED_AT);
  });

  it('includes Assets section header', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Assets');
  });

  it('uses "Available for payout" language (not banned balance term)', () => {
    const bannedBalance = 'Twicely' + ' Balance';
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Available for payout');
    expect(result).not.toContain(bannedBalance);
  });

  it('includes Pending (in escrow) row in Assets', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Pending (in escrow)');
  });

  it('includes inventory item count in Assets label', () => {
    const data = {
      ...BASE_BALANCE,
      assets: { ...BASE_BALANCE.assets, inventoryCount: 15, inventoryValueCents: 30000 },
    };
    const result = generateBalanceSheetHtml(data);
    expect(result).toContain('15 items');
  });

  it('includes Total assets total row', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Total assets');
  });

  it('includes Liabilities section header', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Liabilities');
  });

  it('includes Reserved (holds) row', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Reserved (holds)');
  });

  it('includes Total liabilities total row', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Total liabilities');
  });

  it('includes Equity section header', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Equity');
  });

  it('includes Net equity row', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Net equity');
  });

  it('includes Period net earnings row', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Period net earnings');
  });

  it('includes Total equity total row', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('Total equity');
  });

  it('formats dollar values correctly in asset rows', () => {
    const data = {
      ...BASE_BALANCE,
      assets: { ...BASE_BALANCE.assets, availableForPayoutCents: 10000, totalCurrentAssetsCents: 10000 },
    };
    const result = generateBalanceSheetHtml(data);
    expect(result).toContain('$100.00');
  });

  it('uses td class="amt" for positive values', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('class="amt"');
  });

  it('uses tr class="section-header" for section labels', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('class="section-header"');
  });

  it('uses tr class="total" for total rows', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('class="total"');
  });

  it('contains @media print styles', () => {
    const result = generateBalanceSheetHtml(BASE_BALANCE);
    expect(result).toContain('@media print');
  });
});

// ---------------------------------------------------------------------------
// generateCashFlowHtml
// ---------------------------------------------------------------------------

describe('generateCashFlowHtml', () => {
  it('returns a complete HTML document', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toMatch(/^<!DOCTYPE html>/);
    expect(result).toContain('</html>');
  });

  it('includes "Cash Flow Statement" in page title', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Cash Flow Statement');
  });

  it('includes period date range in subtitle', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('2026-01-01');
    expect(result).toContain('2026-01-31');
  });

  it('includes generatedAt in footer', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain(GENERATED_AT);
  });

  it('includes Operating Activities section header', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Operating Activities');
  });

  it('includes Sales received row in Operating section', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Sales received');
  });

  it('formats salesReceivedCents as positive amount', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, salesReceivedCents: 50000 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('$500.00');
  });

  it('omits Refunds issued row when refundsIssuedCents is 0', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).not.toContain('Refunds issued');
  });

  it('includes Refunds issued row (negative) when > 0', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, refundsIssuedCents: 2000 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('Refunds issued');
    expect(result).toContain('-$20.00');
  });

  it('always includes Platform fees paid row (negative)', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Platform fees paid');
  });

  it('omits Shipping costs row when shippingCostsCents is 0', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).not.toContain('Shipping costs');
  });

  it('includes Shipping costs row when > 0', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, shippingCostsCents: 850 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('Shipping costs');
    expect(result).toContain('-$8.50');
  });

  it('omits Operating expenses and Mileage rows when zero', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).not.toContain('Operating expenses');
    expect(result).not.toContain('Mileage deductions');
  });

  it('includes Operating expenses row when > 0', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, operatingExpensesCents: 3000 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('Operating expenses');
    expect(result).toContain('-$30.00');
  });

  it('includes Mileage deductions row when > 0', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, mileageDeductionCents: 500 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('Mileage deductions');
    expect(result).toContain('-$5.00');
  });

  it('includes Net operating activities total row', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Net operating activities');
  });

  it('includes Financing Activities section header', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Financing Activities');
  });

  it('includes Payouts sent row (negative) in Financing section', () => {
    const data = { ...BASE_CASH_FLOW, financing: { ...BASE_CASH_FLOW.financing, payoutsSentCents: 40000 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('Payouts sent');
    expect(result).toContain('-$400.00');
  });

  it('omits Payout reversals row when payoutsFailedReversedCents is 0', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).not.toContain('Payout reversals');
  });

  it('includes Payout reversals row (positive) when > 0', () => {
    const data = { ...BASE_CASH_FLOW, financing: { ...BASE_CASH_FLOW.financing, payoutsFailedReversedCents: 5000 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('Payout reversals');
    expect(result).toContain('$50.00');
  });

  it('includes Net financing activities total row', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Net financing activities');
  });

  it('includes Summary section with Net cash change', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Summary');
    expect(result).toContain('Net cash change');
  });

  it('includes Beginning balance and Ending balance rows', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('Beginning balance');
    expect(result).toContain('Ending balance');
  });

  it('formats ending balance correctly', () => {
    const data = { ...BASE_CASH_FLOW, endingBalanceCents: 15000, beginningBalanceCents: 10000, netCashChangeCents: 5000 };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('$150.00');
    expect(result).toContain('$100.00');
    expect(result).toContain('$50.00');
  });

  it('uses td class="amt" for positive amounts', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('class="amt"');
  });

  it('uses td class="neg" for negative amounts', () => {
    const data = { ...BASE_CASH_FLOW, financing: { ...BASE_CASH_FLOW.financing, payoutsSentCents: 1000 } };
    const result = generateCashFlowHtml(data);
    expect(result).toContain('class="neg"');
  });

  it('uses tr class="total" for total rows', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('class="total"');
  });

  it('uses tr class="section-header" for section labels', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('class="section-header"');
  });

  it('contains @media print CSS', () => {
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).toContain('@media print');
  });

  it('does NOT contain banned balance language', () => {
    const bannedBalance = 'Twicely' + ' Balance';
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    expect(result).not.toContain(bannedBalance);
    expect(result).not.toContain('Withdraw');
  });

  it('negCell outputs $0.00 (not -$0.00) when cents is 0', () => {
    // negCell: cents === 0 -> posCell output
    const result = generateCashFlowHtml(BASE_CASH_FLOW);
    // payoutsSentCents = 0 rendered via negCell — should be $0.00
    expect(result).not.toContain('-$0.00');
  });
});
