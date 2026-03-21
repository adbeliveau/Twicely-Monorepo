/**
 * Tests for report-csv.ts — pure CSV string generators.
 * No I/O, no side effects — all values are pure function calls.
 * Covers: generatePnlCsv, generateBalanceSheetCsv, generateCashFlowCsv
 */
import { describe, it, expect } from 'vitest';
import {
  generatePnlCsv,
  generateBalanceSheetCsv,
  generateCashFlowCsv,
} from '../report-csv';
import type { PnlReportData, BalanceSheetData, CashFlowData } from '../../queries/finance-center-reports';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function parseCsvRows(csv: string): string[][] {
  return csv.split('\n').map((line) =>
    line.split(',').map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"')),
  );
}

// Find all rows that start with a given section label
function rowsBySection(rows: string[][], section: string): string[][] {
  return rows.filter((r) => r[0] === section);
}

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
// generatePnlCsv
// ---------------------------------------------------------------------------

describe('generatePnlCsv', () => {
  it('returns a non-empty string', () => {
    const result = generatePnlCsv(BASE_PNL);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('first row header contains "Profit & Loss Statement"', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    expect(rows[0]?.[0]).toBe('Profit & Loss Statement');
  });

  it('includes period date range in row 2', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    // Row index 1: Period, "2026-01-01 to 2026-01-31"
    expect(rows[1]?.[0]).toBe('Period');
    expect(rows[1]?.[1]).toContain('2026-01-01');
    expect(rows[1]?.[1]).toContain('2026-01-31');
  });

  it('includes generatedAt in row 3', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    expect(rows[2]?.[0]).toBe('Generated');
    expect(rows[2]?.[1]).toBe(GENERATED_AT);
  });

  it('has column headers Section/Item/Amount', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const headerRow = rows.find((r) => r[0] === 'Section' && r[1] === 'Item');
    expect(headerRow).toBeTruthy();
  });

  it('always includes Revenue gross revenue row', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const revenueRows = rowsBySection(rows, 'Revenue');
    const grossRow = revenueRows.find((r) => r[1] === 'Gross revenue');
    expect(grossRow).toBeTruthy();
    expect(grossRow?.[2]).toBe('$0.00');
  });

  it('includes order count row in Revenue section', () => {
    const data = { ...BASE_PNL, totalOrderCount: 5 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const countRow = rowsBySection(rows, 'Revenue').find((r) => r[1] === 'Order count');
    expect(countRow?.[2]).toBe('5');
  });

  it('formats grossRevenueCents as dollar string', () => {
    const data = { ...BASE_PNL, grossRevenueCents: 50000 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const grossRow = rowsBySection(rows, 'Revenue').find((r) => r[1] === 'Gross revenue');
    expect(grossRow?.[2]).toBe('$500.00');
  });

  it('omits COGS section when cogsTotalCents is 0', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const cogsRows = rowsBySection(rows, 'COGS');
    expect(cogsRows).toHaveLength(0);
  });

  it('includes COGS section when cogsTotalCents > 0', () => {
    const data = { ...BASE_PNL, grossRevenueCents: 10000, cogsTotalCents: 3000, grossProfitCents: 7000 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const cogsRows = rowsBySection(rows, 'COGS');
    expect(cogsRows.length).toBeGreaterThan(0);
    const cogsRow = cogsRows.find((r) => r[1] === 'Cost of goods sold');
    expect(cogsRow?.[2]).toBe('-$30.00');
  });

  it('formats COGS value as negative (neg() helper)', () => {
    const data = { ...BASE_PNL, grossRevenueCents: 10000, cogsTotalCents: 2500, grossProfitCents: 7500 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const cogsRow = rowsBySection(rows, 'COGS').find((r) => r[1] === 'Cost of goods sold');
    expect(cogsRow?.[2]).toMatch(/^-\$/);
  });

  it('always includes Transaction Fee in Fees section', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const tfRow = rowsBySection(rows, 'Fees').find((r) => r[1] === 'Transaction Fee');
    expect(tfRow).toBeTruthy();
  });

  it('uses "Transaction Fee" label (not legacy fee abbreviations)', () => {
    const bannedFeeAbbr = 'F' + 'VF';
    const bannedFeeFull = 'Final Value' + ' Fee';
    const result = generatePnlCsv(BASE_PNL);
    expect(result).not.toContain(bannedFeeAbbr);
    expect(result).not.toContain(bannedFeeFull);
    expect(result).toContain('Transaction Fee');
  });

  it('omits boost fees row when boostFeesCents is 0', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const boostRow = rowsBySection(rows, 'Fees').find((r) => r[1] === 'Boost fees');
    expect(boostRow).toBeUndefined();
  });

  it('includes boost fees row when boostFeesCents > 0', () => {
    const data = { ...BASE_PNL, boostFeesCents: 200, totalPlatformFeesCents: 200 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const boostRow = rowsBySection(rows, 'Fees').find((r) => r[1] === 'Boost fees');
    expect(boostRow).toBeTruthy();
    expect(boostRow?.[2]).toBe('-$2.00');
  });

  it('omits insertion fees when insertionFeesCents is 0', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Fees').find((r) => r[1] === 'Insertion fees');
    expect(row).toBeUndefined();
  });

  it('includes insertion fees when insertionFeesCents > 0', () => {
    const data = { ...BASE_PNL, insertionFeesCents: 100, totalPlatformFeesCents: 100 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Fees').find((r) => r[1] === 'Insertion fees');
    expect(row).toBeTruthy();
  });

  it('omits local/auth/subscription fee rows when zero', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const feeRows = rowsBySection(rows, 'Fees');
    expect(feeRows.find((r) => r[1] === 'Local sale fees')).toBeUndefined();
    expect(feeRows.find((r) => r[1] === 'Authentication fees')).toBeUndefined();
    expect(feeRows.find((r) => r[1] === 'Subscription charges')).toBeUndefined();
  });

  it('includes local, auth, subscription fee rows when non-zero', () => {
    const data = {
      ...BASE_PNL,
      localFeesCents: 50, authFeesCents: 100, subscriptionChargesCents: 999,
      totalPlatformFeesCents: 1149,
    };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const feeRows = rowsBySection(rows, 'Fees');
    expect(feeRows.find((r) => r[1] === 'Local sale fees')).toBeTruthy();
    expect(feeRows.find((r) => r[1] === 'Authentication fees')).toBeTruthy();
    expect(feeRows.find((r) => r[1] === 'Subscription charges')).toBeTruthy();
  });

  it('always includes Total platform fees in Fees section', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const totalRow = rowsBySection(rows, 'Fees').find((r) => r[1] === 'Total platform fees');
    expect(totalRow).toBeTruthy();
  });

  it('omits Shipping section when shippingCostsCents is 0', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const shippingRows = rowsBySection(rows, 'Shipping');
    expect(shippingRows).toHaveLength(0);
  });

  it('includes Shipping section when shippingCostsCents > 0', () => {
    const data = { ...BASE_PNL, shippingCostsCents: 850 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const shippingRow = rowsBySection(rows, 'Shipping').find((r) => r[1] === 'Shipping costs');
    expect(shippingRow?.[2]).toBe('-$8.50');
  });

  it('always includes Net after fees in Summary section', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const summaryRows = rowsBySection(rows, 'Summary');
    expect(summaryRows.find((r) => r[1] === 'Net after fees')).toBeTruthy();
  });

  it('omits Expenses section when operatingExpensesCents is 0', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const expRows = rowsBySection(rows, 'Expenses');
    expect(expRows).toHaveLength(0);
  });

  it('includes category rows in Expenses section when operatingExpensesCents > 0', () => {
    const data = {
      ...BASE_PNL,
      operatingExpensesCents: 5000,
      expensesByCategory: [
        { category: 'Shipping Supplies', totalCents: 3000, count: 3 },
        { category: 'Equipment', totalCents: 2000, count: 1 },
      ],
    };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const expRows = rowsBySection(rows, 'Expenses');
    expect(expRows.find((r) => r[1] === 'Shipping Supplies')).toBeTruthy();
    expect(expRows.find((r) => r[1] === 'Equipment')).toBeTruthy();
    expect(expRows.find((r) => r[1] === 'Total operating expenses')).toBeTruthy();
  });

  it('omits Mileage section when mileageDeductionCents is 0', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const mileRows = rowsBySection(rows, 'Mileage');
    expect(mileRows).toHaveLength(0);
  });

  it('includes Mileage section with trip/miles detail when mileageDeductionCents > 0', () => {
    const data = { ...BASE_PNL, mileageDeductionCents: 5000, totalMiles: 74.6, tripCount: 10 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const mileRows = rowsBySection(rows, 'Mileage');
    expect(mileRows.length).toBeGreaterThan(0);
    const mileRow = mileRows[0];
    expect(mileRow?.[1]).toContain('10 trips');
    expect(mileRow?.[1]).toContain('74.6 miles');
    expect(mileRow?.[2]).toBe('-$50.00');
  });

  it('always includes Net earnings in Summary section', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const summaryRows = rowsBySection(rows, 'Summary');
    expect(summaryRows.find((r) => r[1] === 'Net earnings')).toBeTruthy();
  });

  it('includes KPI rows for avg sale price and effective fee rate', () => {
    const data = { ...BASE_PNL, avgSalePriceCents: 2500, effectiveFeeRatePercent: 10 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const kpiRows = rowsBySection(rows, 'KPIs');
    expect(kpiRows.find((r) => r[1] === 'Avg sale price')).toBeTruthy();
    expect(kpiRows.find((r) => r[1] === 'Effective fee rate')).toBeTruthy();
  });

  it('formats effective fee rate with % suffix', () => {
    const data = { ...BASE_PNL, effectiveFeeRatePercent: 10.5 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const rateRow = rowsBySection(rows, 'KPIs').find((r) => r[1] === 'Effective fee rate');
    expect(rateRow?.[2]).toBe('10.5%');
  });

  it('omits Gross margin KPI row when cogsTotalCents is 0', () => {
    const result = generatePnlCsv(BASE_PNL);
    const rows = parseCsvRows(result);
    const marginRow = rowsBySection(rows, 'KPIs').find((r) => r[1] === 'Gross margin');
    expect(marginRow).toBeUndefined();
  });

  it('includes Gross margin KPI row when cogsTotalCents > 0', () => {
    const data = { ...BASE_PNL, cogsTotalCents: 3000, cogsMarginPercent: 70 };
    const result = generatePnlCsv(data);
    const rows = parseCsvRows(result);
    const marginRow = rowsBySection(rows, 'KPIs').find((r) => r[1] === 'Gross margin');
    expect(marginRow?.[2]).toBe('70%');
  });

  it('cell values with special characters are quoted and escaped', () => {
    const data = {
      ...BASE_PNL,
      expensesByCategory: [{ category: 'Shipping, "Boxes"', totalCents: 100, count: 1 }],
      operatingExpensesCents: 100,
    };
    const result = generatePnlCsv(data);
    expect(result).toContain('"Shipping, ""Boxes"""');
  });
});

// ---------------------------------------------------------------------------
// generateBalanceSheetCsv
// ---------------------------------------------------------------------------

describe('generateBalanceSheetCsv', () => {
  it('returns a non-empty string', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('first row header contains "Balance Sheet"', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    expect(rows[0]?.[0]).toBe('Balance Sheet');
  });

  it('includes "As of" with periodEnd date in row 2', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    expect(rows[1]?.[0]).toBe('As of');
    expect(rows[1]?.[1]).toBe('2026-01-31');
  });

  it('includes generatedAt in row 3', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    expect(rows[2]?.[0]).toBe('Generated');
    expect(rows[2]?.[1]).toBe(GENERATED_AT);
  });

  it('includes Available for payout in Assets section', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    const assetRows = rowsBySection(rows, 'Assets');
    expect(assetRows.find((r) => r[1] === 'Available for payout')).toBeTruthy();
  });

  it('does NOT use banned balance language (UX compliance)', () => {
    const bannedBalance = 'Twicely' + ' Balance';
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    expect(result).not.toContain(bannedBalance);
    expect(result).not.toContain('wallet');
  });

  it('formats asset values correctly', () => {
    const data = {
      ...BASE_BALANCE,
      assets: { ...BASE_BALANCE.assets, availableForPayoutCents: 10000, pendingCents: 5000 },
    };
    const result = generateBalanceSheetCsv(data);
    const rows = parseCsvRows(result);
    const payoutRow = rowsBySection(rows, 'Assets').find((r) => r[1] === 'Available for payout');
    expect(payoutRow?.[2]).toBe('$100.00');
    const pendingRow = rowsBySection(rows, 'Assets').find((r) => r[1] === 'Pending (in escrow)');
    expect(pendingRow?.[2]).toBe('$50.00');
  });

  it('includes inventory item count in label', () => {
    const data = {
      ...BASE_BALANCE,
      assets: { ...BASE_BALANCE.assets, inventoryCount: 42, inventoryValueCents: 84000 },
    };
    const result = generateBalanceSheetCsv(data);
    const rows = parseCsvRows(result);
    const invRow = rowsBySection(rows, 'Assets').find((r) => r[1]?.includes('42 items'));
    expect(invRow).toBeTruthy();
  });

  it('always includes Total assets in Assets section', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Assets').find((r) => r[1] === 'Total assets');
    expect(row).toBeTruthy();
  });

  it('includes Reserved (holds) in Liabilities section', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Liabilities').find((r) => r[1] === 'Reserved (holds)');
    expect(row).toBeTruthy();
  });

  it('always includes Total liabilities in Liabilities section', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Liabilities').find((r) => r[1] === 'Total liabilities');
    expect(row).toBeTruthy();
  });

  it('includes Net equity and Period net earnings in Equity section', () => {
    const result = generateBalanceSheetCsv(BASE_BALANCE);
    const rows = parseCsvRows(result);
    const equityRows = rowsBySection(rows, 'Equity');
    expect(equityRows.find((r) => r[1]?.includes('Net equity'))).toBeTruthy();
    expect(equityRows.find((r) => r[1] === 'Period net earnings')).toBeTruthy();
    expect(equityRows.find((r) => r[1] === 'Total equity')).toBeTruthy();
  });

  it('formats equity amounts correctly', () => {
    const data = {
      ...BASE_BALANCE,
      equity: { netEquityCents: 8000, periodNetProfitCents: 2000, totalEquityCents: 8000 },
    };
    const result = generateBalanceSheetCsv(data);
    const rows = parseCsvRows(result);
    const netEquityRow = rowsBySection(rows, 'Equity').find((r) => r[1]?.includes('Net equity'));
    expect(netEquityRow?.[2]).toBe('$80.00');
    const totalEquityRow = rowsBySection(rows, 'Equity').find((r) => r[1] === 'Total equity');
    expect(totalEquityRow?.[2]).toBe('$80.00');
  });
});

// ---------------------------------------------------------------------------
// generateCashFlowCsv
// ---------------------------------------------------------------------------

describe('generateCashFlowCsv', () => {
  it('returns a non-empty string', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('first row header contains "Cash Flow Statement"', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    expect(rows[0]?.[0]).toBe('Cash Flow Statement');
  });

  it('includes period date range in row 2', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    expect(rows[1]?.[0]).toBe('Period');
    expect(rows[1]?.[1]).toContain('2026-01-01');
    expect(rows[1]?.[1]).toContain('2026-01-31');
  });

  it('always includes Sales received in Operating section', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Sales received');
    expect(row).toBeTruthy();
    expect(row?.[2]).toBe('$0.00');
  });

  it('formats salesReceivedCents as positive dollar value', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, salesReceivedCents: 50000 } };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Sales received');
    expect(row?.[2]).toBe('$500.00');
  });

  it('omits Refunds issued row when refundsIssuedCents is 0', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Refunds issued');
    expect(row).toBeUndefined();
  });

  it('includes Refunds issued row (negative) when refundsIssuedCents > 0', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, refundsIssuedCents: 2000 } };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Refunds issued');
    expect(row?.[2]).toBe('-$20.00');
  });

  it('always includes Platform fees paid in Operating section (negative)', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, platformFeesPaidCents: 1000 } };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Platform fees paid');
    expect(row?.[2]).toBe('-$10.00');
  });

  it('omits Shipping costs in Operating when shippingCostsCents is 0', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Shipping costs');
    expect(row).toBeUndefined();
  });

  it('includes Shipping costs when > 0', () => {
    const data = { ...BASE_CASH_FLOW, operating: { ...BASE_CASH_FLOW.operating, shippingCostsCents: 850 } };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Shipping costs');
    expect(row?.[2]).toBe('-$8.50');
  });

  it('omits Operating expenses and Mileage rows when zero', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    const opRows = rowsBySection(rows, 'Operating');
    expect(opRows.find((r) => r[1] === 'Operating expenses')).toBeUndefined();
    expect(opRows.find((r) => r[1] === 'Mileage deductions')).toBeUndefined();
  });

  it('includes Operating expenses and Mileage rows when > 0', () => {
    const data = {
      ...BASE_CASH_FLOW,
      operating: { ...BASE_CASH_FLOW.operating, operatingExpensesCents: 3000, mileageDeductionCents: 500 },
    };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const opRows = rowsBySection(rows, 'Operating');
    expect(opRows.find((r) => r[1] === 'Operating expenses')).toBeTruthy();
    expect(opRows.find((r) => r[1] === 'Mileage deductions')).toBeTruthy();
  });

  it('always includes Net operating in Operating section', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Net operating');
    expect(row).toBeTruthy();
  });

  it('always includes Payouts sent in Financing section (negative)', () => {
    const data = { ...BASE_CASH_FLOW, financing: { ...BASE_CASH_FLOW.financing, payoutsSentCents: 40000 } };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Financing').find((r) => r[1] === 'Payouts sent');
    expect(row?.[2]).toBe('-$400.00');
  });

  it('omits Payout reversals row when payoutsFailedReversedCents is 0', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Financing').find((r) => r[1] === 'Payout reversals');
    expect(row).toBeUndefined();
  });

  it('includes Payout reversals row (positive) when > 0', () => {
    const data = { ...BASE_CASH_FLOW, financing: { ...BASE_CASH_FLOW.financing, payoutsFailedReversedCents: 5000 } };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Financing').find((r) => r[1] === 'Payout reversals');
    expect(row?.[2]).toBe('$50.00');
  });

  it('always includes Net financing in Financing section', () => {
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    const row = rowsBySection(rows, 'Financing').find((r) => r[1] === 'Net financing');
    expect(row).toBeTruthy();
  });

  it('Summary section includes Net cash change, Beginning balance, Ending balance', () => {
    const data = {
      ...BASE_CASH_FLOW,
      netCashChangeCents: 5000,
      beginningBalanceCents: 10000,
      endingBalanceCents: 15000,
    };
    const result = generateCashFlowCsv(data);
    const rows = parseCsvRows(result);
    const summaryRows = rowsBySection(rows, 'Summary');
    const netChangeRow = summaryRows.find((r) => r[1] === 'Net cash change');
    const beginRow = summaryRows.find((r) => r[1] === 'Beginning balance');
    const endRow = summaryRows.find((r) => r[1] === 'Ending balance');
    expect(netChangeRow?.[2]).toBe('$50.00');
    expect(beginRow?.[2]).toBe('$100.00');
    expect(endRow?.[2]).toBe('$150.00');
  });

  it('neg() helper outputs $0.00 (not -$0.00) for zero values', () => {
    // The neg() helper: cents === 0 ? formatCentsToDollars(0) : -$X
    const result = generateCashFlowCsv(BASE_CASH_FLOW);
    const rows = parseCsvRows(result);
    // Platform fees paid is always rendered through neg(), should be $0.00 when 0
    const feeRow = rowsBySection(rows, 'Operating').find((r) => r[1] === 'Platform fees paid');
    expect(feeRow?.[2]).toBe('$0.00');
  });
});
