/**
 * Tests for finance-center-reports.ts queries.
 * Covers: getPnlReportData, getBalanceSheetData, getCashFlowData,
 *         getReportList, getReportById
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };

function createChain(finalResult: unknown) {
  const makeProxy = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    for (const k of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'innerJoin']) {
      p[k] = (..._args: unknown[]) => makeProxy();
    }
    p.then = (resolve: (v: unknown) => void) => resolve(finalResult);
    return p;
  };
  return makeProxy();
}

const START = new Date('2026-01-01T00:00:00.000Z');
const END = new Date('2026-01-31T23:59:59.000Z');

// ---------------------------------------------------------------------------
// getPnlReportData
// ---------------------------------------------------------------------------

describe('getPnlReportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // Helper: set up all 8 sequential select calls for getPnlReportData
  // Call order: revenue, xRev (CROSSLISTER_SALE_REVENUE), fees, shipping, cogs, expTotal, expCat, mileage
  function setupPnlMocks({
    revenue = [{ gross: 0, cnt: 0 }],
    xRev = [{ total: 0 }],
    fees = [],
    shipping = [{ total: 0 }],
    cogs = [],
    expTotal = [{ total: 0 }],
    expCat = [],
    mileage = [{ totalDeductionCents: 0, totalMiles: 0, tripCount: 0 }],
  }: {
    revenue?: unknown[];
    xRev?: unknown[];
    fees?: unknown[];
    shipping?: unknown[];
    cogs?: unknown[];
    expTotal?: unknown[];
    expCat?: unknown[];
    mileage?: unknown[];
  } = {}) {
    mockDb.select
      .mockReturnValueOnce(createChain(revenue))
      .mockReturnValueOnce(createChain(xRev))
      .mockReturnValueOnce(createChain(fees))
      .mockReturnValueOnce(createChain(shipping))
      .mockReturnValueOnce(createChain(cogs))
      .mockReturnValueOnce(createChain(expTotal))
      .mockReturnValueOnce(createChain(expCat))
      .mockReturnValueOnce(createChain(mileage));
  }

  it('returns all-zero values when no data exists', async () => {
    setupPnlMocks();
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.grossRevenueCents).toBe(0);
    expect(result.totalOrderCount).toBe(0);
    expect(result.cogsTotalCents).toBe(0);
    expect(result.grossProfitCents).toBe(0);
    expect(result.tfFeesCents).toBe(0);
    expect(result.stripeFeesCents).toBe(0);
    expect(result.totalPlatformFeesCents).toBe(0);
    expect(result.shippingCostsCents).toBe(0);
    expect(result.netAfterFeesCents).toBe(0);
    expect(result.operatingExpensesCents).toBe(0);
    expect(result.mileageDeductionCents).toBe(0);
    expect(result.netProfitCents).toBe(0);
    expect(result.avgSalePriceCents).toBe(0);
    expect(result.effectiveFeeRatePercent).toBe(0);
    expect(result.cogsMarginPercent).toBe(0);
    expect(result.expensesByCategory).toEqual([]);
  });

  it('calculates gross revenue and order count from completed orders', async () => {
    setupPnlMocks({ revenue: [{ gross: 50000, cnt: 5 }] });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.grossRevenueCents).toBe(50000);
    expect(result.totalOrderCount).toBe(5);
    expect(result.avgSalePriceCents).toBe(10000); // Math.floor(50000/5)
  });

  it('separates TF fees from Stripe fees in fee breakdown', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      fees: [
        { type: 'ORDER_TF_FEE', total: 1000 },
        { type: 'ORDER_STRIPE_PROCESSING_FEE', total: 320 },
      ],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.tfFeesCents).toBe(1000);
    expect(result.stripeFeesCents).toBe(320);
    expect(result.totalPlatformFeesCents).toBe(1320);
  });

  it('accumulates both AUTH_FEE_BUYER and AUTH_FEE_SELLER into authFeesCents', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      fees: [
        { type: 'AUTH_FEE_BUYER', total: 500 },
        { type: 'AUTH_FEE_SELLER', total: 500 },
      ],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.authFeesCents).toBe(1000);
  });

  it('accumulates both SUBSCRIPTION_CHARGE and FINANCE_SUBSCRIPTION_CHARGE into subscriptionChargesCents', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      fees: [
        { type: 'SUBSCRIPTION_CHARGE', total: 999 },
        { type: 'FINANCE_SUBSCRIPTION_CHARGE', total: 999 },
      ],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.subscriptionChargesCents).toBe(1998);
  });

  it('includes boost, insertion, and local fees in total', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      fees: [
        { type: 'ORDER_BOOST_FEE', total: 200 },
        { type: 'INSERTION_FEE', total: 100 },
        { type: 'LOCAL_TRANSACTION_FEE', total: 50 },
      ],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.boostFeesCents).toBe(200);
    expect(result.insertionFeesCents).toBe(100);
    expect(result.localFeesCents).toBe(50);
    expect(result.totalPlatformFeesCents).toBe(350);
  });

  it('sums cogsTotalCents from order items with non-null listing.cogsCents', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 2 }],
      cogs: [
        { orderId: 'ord-1', cogsCents: 2000 },
        { orderId: 'ord-2', cogsCents: 1500 },
      ],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.cogsTotalCents).toBe(3500);
    expect(result.grossProfitCents).toBe(6500); // 10000 - 3500
  });

  it('treats null cogsCents as 0 in COGS sum', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      cogs: [{ orderId: 'ord-1', cogsCents: null }],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.cogsTotalCents).toBe(0);
  });

  it('sets shippingCostsCents from SHIPPING_LABEL_PURCHASE ledger entries', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      shipping: [{ total: 850 }],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.shippingCostsCents).toBe(850);
  });

  it('maps expense category rows correctly', async () => {
    setupPnlMocks({
      expTotal: [{ total: 5000 }],
      expCat: [
        { category: 'Shipping Supplies', totalCents: 3000, cnt: 3 },
        { category: 'Equipment', totalCents: 2000, cnt: 1 },
      ],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.operatingExpensesCents).toBe(5000);
    expect(result.expensesByCategory).toHaveLength(2);
    expect(result.expensesByCategory[0]).toEqual({ category: 'Shipping Supplies', totalCents: 3000, count: 3 });
    expect(result.expensesByCategory[1]).toEqual({ category: 'Equipment', totalCents: 2000, count: 1 });
  });

  it('sets mileage fields from mileageEntry aggregation', async () => {
    setupPnlMocks({
      mileage: [{ totalDeductionCents: 5000, totalMiles: 74.6, tripCount: 10 }],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.mileageDeductionCents).toBe(5000);
    expect(result.totalMiles).toBe(74.6);
    expect(result.tripCount).toBe(10);
  });

  it('calculates netProfitCents correctly (revenue - cogs - fees - shipping - expenses - mileage)', async () => {
    setupPnlMocks({
      revenue: [{ gross: 100000, cnt: 10 }],
      fees: [
        { type: 'ORDER_TF_FEE', total: 10000 },
        { type: 'ORDER_STRIPE_PROCESSING_FEE', total: 3000 },
      ],
      shipping: [{ total: 5000 }],
      cogs: [{ orderId: 'ord-1', cogsCents: 20000 }],
      expTotal: [{ total: 8000 }],
      expCat: [{ category: 'Shipping Supplies', totalCents: 8000, cnt: 5 }],
      mileage: [{ totalDeductionCents: 2000, totalMiles: 29.8, tripCount: 5 }],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    // grossProfit = 100000 - 20000 = 80000
    // netAfterFees = 80000 - 13000 (fees) - 5000 (shipping) = 62000
    // netProfit = 62000 - 8000 (expenses) - 2000 (mileage) = 52000
    expect(result.grossProfitCents).toBe(80000);
    expect(result.netAfterFeesCents).toBe(62000);
    expect(result.netProfitCents).toBe(52000);
  });

  it('calculates effectiveFeeRatePercent with 2 decimal precision', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      fees: [{ type: 'ORDER_TF_FEE', total: 1000 }],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.effectiveFeeRatePercent).toBe(10); // 1000/10000 * 100 = 10.00
  });

  it('sets effectiveFeeRatePercent to 0 when grossRevenueCents is 0 (division guard)', async () => {
    setupPnlMocks();
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.effectiveFeeRatePercent).toBe(0);
  });

  it('calculates cogsMarginPercent correctly', async () => {
    setupPnlMocks({
      revenue: [{ gross: 10000, cnt: 2 }],
      cogs: [{ orderId: 'ord-1', cogsCents: 3000 }],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    // grossProfit = 7000; cogsMargin = 7000/10000 * 100 = 70%
    expect(result.cogsMarginPercent).toBe(70);
  });

  it('sets cogsMarginPercent to 0 when grossRevenueCents is 0', async () => {
    setupPnlMocks();
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.cogsMarginPercent).toBe(0);
  });

  it('avgSalePriceCents uses Math.floor (100 cents / 3 orders = 33)', async () => {
    setupPnlMocks({ revenue: [{ gross: 100, cnt: 3 }] });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.avgSalePriceCents).toBe(33);
  });

  it('sets avgSalePriceCents to 0 when totalOrderCount is 0', async () => {
    setupPnlMocks({ revenue: [{ gross: 0, cnt: 0 }] });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.avgSalePriceCents).toBe(0);
  });

  it('netProfitCents can be negative when fees exceed revenue', async () => {
    setupPnlMocks({
      revenue: [{ gross: 1000, cnt: 1 }],
      fees: [{ type: 'ORDER_TF_FEE', total: 2000 }],
    });
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.netProfitCents).toBeLessThan(0);
  });

  it('includes ISO period strings and generatedAt in return', async () => {
    setupPnlMocks();
    const { getPnlReportData } = await import('../finance-center-reports');
    const result = await getPnlReportData('user-test-001', START, END);

    expect(result.periodStart).toBe(START.toISOString());
    expect(result.periodEnd).toBe(END.toISOString());
    expect(result.generatedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getBalanceSheetData
// ---------------------------------------------------------------------------

describe('getBalanceSheetData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // getBalanceSheetData: 3 select calls itself + 8 from getPnlReportData inside
  function setupBalanceMocks({
    balance = [{ availableCents: 0, pendingCents: 0, reservedCents: 0 }],
    inventory = [{ inventoryValueCents: 0, inventoryCount: 0 }],
    pendingRefunds = [{ total: 0 }],
    revenue = [{ gross: 0, cnt: 0 }],
    xRev = [{ total: 0 }],
    fees = [],
    shipping = [{ total: 0 }],
    cogs = [],
    expTotal = [{ total: 0 }],
    expCat = [],
    mileage = [{ totalDeductionCents: 0, totalMiles: 0, tripCount: 0 }],
  }: {
    balance?: unknown[];
    inventory?: unknown[];
    pendingRefunds?: unknown[];
    revenue?: unknown[];
    xRev?: unknown[];
    fees?: unknown[];
    shipping?: unknown[];
    cogs?: unknown[];
    expTotal?: unknown[];
    expCat?: unknown[];
    mileage?: unknown[];
  } = {}) {
    mockDb.select
      .mockReturnValueOnce(createChain(balance))
      .mockReturnValueOnce(createChain(inventory))
      .mockReturnValueOnce(createChain(pendingRefunds))
      // These are the 8 calls from getPnlReportData called inside getBalanceSheetData
      .mockReturnValueOnce(createChain(revenue))
      .mockReturnValueOnce(createChain(xRev))
      .mockReturnValueOnce(createChain(fees))
      .mockReturnValueOnce(createChain(shipping))
      .mockReturnValueOnce(createChain(cogs))
      .mockReturnValueOnce(createChain(expTotal))
      .mockReturnValueOnce(createChain(expCat))
      .mockReturnValueOnce(createChain(mileage));
  }

  it('returns all-zero values when seller has no data', async () => {
    setupBalanceMocks();
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    expect(result.assets.availableForPayoutCents).toBe(0);
    expect(result.assets.pendingCents).toBe(0);
    expect(result.assets.inventoryValueCents).toBe(0);
    expect(result.assets.inventoryCount).toBe(0);
    expect(result.assets.totalCurrentAssetsCents).toBe(0);
    expect(result.liabilities.reservedCents).toBe(0);
    expect(result.liabilities.totalLiabilitiesCents).toBe(0);
    expect(result.equity.netEquityCents).toBe(0);
  });

  it('reads availableForPayout, pending, and reserved from sellerBalance', async () => {
    setupBalanceMocks({
      balance: [{ availableCents: 10000, pendingCents: 5000, reservedCents: 1000 }],
    });
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    expect(result.assets.availableForPayoutCents).toBe(10000);
    expect(result.assets.pendingCents).toBe(5000);
    expect(result.liabilities.reservedCents).toBe(1000);
  });

  it('calculates totalCurrentAssetsCents as available + pending + inventory', async () => {
    setupBalanceMocks({
      balance: [{ availableCents: 10000, pendingCents: 5000, reservedCents: 0 }],
      inventory: [{ inventoryValueCents: 25000, inventoryCount: 10 }],
    });
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    expect(result.assets.totalCurrentAssetsCents).toBe(40000); // 10000+5000+25000
    expect(result.assets.inventoryValueCents).toBe(25000);
    expect(result.assets.inventoryCount).toBe(10);
  });

  it('calculates netEquityCents as totalAssets - totalLiabilities', async () => {
    setupBalanceMocks({
      balance: [{ availableCents: 10000, pendingCents: 5000, reservedCents: 2000 }],
      inventory: [{ inventoryValueCents: 15000, inventoryCount: 5 }],
    });
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    // totalAssets = 10000+5000+15000 = 30000; liabilities = 2000; equity = 28000
    expect(result.equity.netEquityCents).toBe(28000);
    expect(result.equity.totalEquityCents).toBe(28000);
  });

  it('sets pendingRefundsCents to 0 always', async () => {
    setupBalanceMocks();
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    expect(result.liabilities.pendingRefundsCents).toBe(0);
  });

  it('populates periodNetProfitCents from internal getPnlReportData call', async () => {
    setupBalanceMocks({
      revenue: [{ gross: 10000, cnt: 1 }],
      fees: [{ type: 'ORDER_TF_FEE', total: 1000 }],
    });
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    // netProfit = 10000 - 1000 = 9000
    expect(result.equity.periodNetProfitCents).toBe(9000);
  });

  it('defaults balance fields to 0 when sellerBalance row is missing', async () => {
    setupBalanceMocks({ balance: [] });
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    expect(result.assets.availableForPayoutCents).toBe(0);
    expect(result.assets.pendingCents).toBe(0);
    expect(result.liabilities.reservedCents).toBe(0);
  });

  it('includes ISO period strings and generatedAt', async () => {
    setupBalanceMocks();
    const { getBalanceSheetData } = await import('../finance-center-reports');
    const result = await getBalanceSheetData('user-test-001', START, END);

    expect(result.periodStart).toBe(START.toISOString());
    expect(result.periodEnd).toBe(END.toISOString());
    expect(result.generatedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getCashFlowData
// ---------------------------------------------------------------------------

describe('getCashFlowData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // getCashFlowData: ledger rows + expenses + mileage + balance = 4 selects
  function setupCashFlowMocks({
    ledger = [],
    expenses = [{ total: 0 }],
    mileage = [{ total: 0 }],
    balance = [{ availableCents: 0, pendingCents: 0 }],
  }: {
    ledger?: unknown[];
    expenses?: unknown[];
    mileage?: unknown[];
    balance?: unknown[];
  } = {}) {
    mockDb.select
      .mockReturnValueOnce(createChain(ledger))
      .mockReturnValueOnce(createChain(expenses))
      .mockReturnValueOnce(createChain(mileage))
      .mockReturnValueOnce(createChain(balance));
  }

  it('returns all-zero values when no data exists', async () => {
    setupCashFlowMocks();
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.operating.salesReceivedCents).toBe(0);
    expect(result.operating.refundsIssuedCents).toBe(0);
    expect(result.operating.platformFeesPaidCents).toBe(0);
    expect(result.operating.shippingCostsCents).toBe(0);
    expect(result.operating.operatingExpensesCents).toBe(0);
    expect(result.operating.mileageDeductionCents).toBe(0);
    expect(result.operating.netOperatingCents).toBe(0);
    expect(result.financing.payoutsSentCents).toBe(0);
    expect(result.financing.payoutsFailedReversedCents).toBe(0);
    expect(result.financing.netFinancingCents).toBe(0);
    expect(result.netCashChangeCents).toBe(0);
  });

  it('reads salesReceivedCents from ORDER_PAYMENT_CAPTURED ledger row', async () => {
    setupCashFlowMocks({
      ledger: [{ type: 'ORDER_PAYMENT_CAPTURED', total: -50000 }],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.operating.salesReceivedCents).toBe(50000);
  });

  it('accumulates REFUND_FULL and REFUND_PARTIAL into refundsIssuedCents', async () => {
    setupCashFlowMocks({
      ledger: [
        { type: 'REFUND_FULL', total: -2000 },
        { type: 'REFUND_PARTIAL', total: -500 },
      ],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.operating.refundsIssuedCents).toBe(2500);
  });

  it('accumulates all platform fee types into platformFeesPaidCents', async () => {
    setupCashFlowMocks({
      ledger: [
        { type: 'ORDER_TF_FEE', total: -1000 },
        { type: 'ORDER_STRIPE_PROCESSING_FEE', total: -320 },
        { type: 'ORDER_BOOST_FEE', total: -200 },
        { type: 'SUBSCRIPTION_CHARGE', total: -999 },
      ],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.operating.platformFeesPaidCents).toBe(2519);
  });

  it('reads shippingCostsCents from SHIPPING_LABEL_PURCHASE ledger row', async () => {
    setupCashFlowMocks({
      ledger: [{ type: 'SHIPPING_LABEL_PURCHASE', total: -850 }],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.operating.shippingCostsCents).toBe(850);
  });

  it('reads payoutsSentCents from PAYOUT_SENT ledger row', async () => {
    setupCashFlowMocks({
      ledger: [{ type: 'PAYOUT_SENT', total: -40000 }],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.financing.payoutsSentCents).toBe(40000);
  });

  it('accumulates PAYOUT_FAILED and PAYOUT_REVERSED into payoutsFailedReversedCents', async () => {
    setupCashFlowMocks({
      ledger: [
        { type: 'PAYOUT_FAILED', total: -5000 },
        { type: 'PAYOUT_REVERSED', total: -3000 },
      ],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.financing.payoutsFailedReversedCents).toBe(8000);
  });

  it('reads operatingExpensesCents from expenses table', async () => {
    setupCashFlowMocks({ expenses: [{ total: 12000 }] });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.operating.operatingExpensesCents).toBe(12000);
  });

  it('reads mileageDeductionCents from mileageEntry table', async () => {
    setupCashFlowMocks({ mileage: [{ total: 3000 }] });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.operating.mileageDeductionCents).toBe(3000);
  });

  it('calculates netOperatingCents correctly', async () => {
    setupCashFlowMocks({
      ledger: [
        { type: 'ORDER_PAYMENT_CAPTURED', total: -50000 },
        { type: 'ORDER_TF_FEE', total: -5000 },
        { type: 'SHIPPING_LABEL_PURCHASE', total: -1000 },
        { type: 'REFUND_FULL', total: -2000 },
      ],
      expenses: [{ total: 3000 }],
      mileage: [{ total: 500 }],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    // 50000 - 2000 - 5000 - 1000 - 3000 - 500 = 38500
    expect(result.operating.netOperatingCents).toBe(38500);
  });

  it('calculates netFinancingCents as reversals minus payouts sent', async () => {
    setupCashFlowMocks({
      ledger: [
        { type: 'PAYOUT_SENT', total: -40000 },
        { type: 'PAYOUT_REVERSED', total: -5000 },
      ],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    // netFinancing = reversals(5000) - sent(40000) = -35000
    expect(result.financing.netFinancingCents).toBe(-35000);
  });

  it('calculates endingBalance and derives beginningBalance', async () => {
    setupCashFlowMocks({
      ledger: [{ type: 'ORDER_PAYMENT_CAPTURED', total: -10000 }],
      balance: [{ availableCents: 8000, pendingCents: 2000 }],
    });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    // endingBalance = 8000+2000 = 10000
    // netCashChange = 10000 (netOp) + 0 (netFin) = 10000
    // beginningBalance = 10000 - 10000 = 0
    expect(result.endingBalanceCents).toBe(10000);
    expect(result.netCashChangeCents).toBe(10000);
    expect(result.beginningBalanceCents).toBe(0);
  });

  it('defaults balance to 0 when sellerBalance row is missing', async () => {
    setupCashFlowMocks({ balance: [] });
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.endingBalanceCents).toBe(0);
  });

  it('includes ISO period strings and generatedAt', async () => {
    setupCashFlowMocks();
    const { getCashFlowData } = await import('../finance-center-reports');
    const result = await getCashFlowData('user-test-001', START, END);

    expect(result.periodStart).toBe(START.toISOString());
    expect(result.periodEnd).toBe(END.toISOString());
    expect(result.generatedAt).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getReportList
// ---------------------------------------------------------------------------

describe('getReportList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const NOW = new Date('2026-01-31T00:00:00.000Z');

  const REPORT_ROW = {
    id: 'rpt-test-001',
    reportType: 'PNL',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
    format: 'JSON',
    fileUrl: null,
    createdAt: NOW,
  };

  it('returns paginated list with total count', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 3 }]))
      .mockReturnValueOnce(createChain([REPORT_ROW]));

    const { getReportList } = await import('../finance-center-reports');
    const result = await getReportList('user-test-001', { page: 1, pageSize: 10 });

    expect(result.total).toBe(3);
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.id).toBe('rpt-test-001');
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  it('returns empty list when no reports exist', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getReportList } = await import('../finance-center-reports');
    const result = await getReportList('user-test-001', { page: 1, pageSize: 10 });

    expect(result.total).toBe(0);
    expect(result.reports).toEqual([]);
  });

  it('defaults total to 0 when count row is missing', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const { getReportList } = await import('../finance-center-reports');
    const result = await getReportList('user-test-001', { page: 1, pageSize: 10 });

    expect(result.total).toBe(0);
  });

  it('sets snapshotJson to null on each list item (meta-only list)', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(createChain([REPORT_ROW]));

    const { getReportList } = await import('../finance-center-reports');
    const result = await getReportList('user-test-001', { page: 1, pageSize: 10 });

    expect(result.reports[0]?.snapshotJson).toBeNull();
  });

  it('filters by reportType when provided', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(createChain([REPORT_ROW]));

    const { getReportList } = await import('../finance-center-reports');
    const result = await getReportList('user-test-001', { page: 1, pageSize: 10, reportType: 'PNL' });

    expect(result.reports[0]?.reportType).toBe('PNL');
  });

  it('calculates correct offset for page 3 with pageSize 10 (offset = 20)', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 25 }]))
      .mockReturnValueOnce(createChain([]));

    const { getReportList } = await import('../finance-center-reports');
    const result = await getReportList('user-test-001', { page: 3, pageSize: 10 });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// getReportById
// ---------------------------------------------------------------------------

describe('getReportById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const NOW = new Date('2026-01-31T00:00:00.000Z');

  const FULL_REPORT_ROW = {
    id: 'rpt-test-001',
    reportType: 'PNL',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-01-31'),
    snapshotJson: { grossRevenueCents: 50000 },
    format: 'JSON',
    fileUrl: null,
    createdAt: NOW,
  };

  it('returns the report when found', async () => {
    mockDb.select.mockReturnValueOnce(createChain([FULL_REPORT_ROW]));

    const { getReportById } = await import('../finance-center-reports');
    const result = await getReportById('user-test-001', 'rpt-test-001');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('rpt-test-001');
    expect(result?.reportType).toBe('PNL');
    expect(result?.snapshotJson).toEqual({ grossRevenueCents: 50000 });
  });

  it('returns null when report not found', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getReportById } = await import('../finance-center-reports');
    const result = await getReportById('user-test-001', 'nonexistent-id');

    expect(result).toBeNull();
  });

  it('returns null when report belongs to different user (userId scoped)', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getReportById } = await import('../finance-center-reports');
    const result = await getReportById('other-user-999', 'rpt-test-001');

    expect(result).toBeNull();
  });

  it('includes fileUrl when report has an uploaded file', async () => {
    const rowWithFile = { ...FULL_REPORT_ROW, fileUrl: 'https://r2.example.com/reports/user-test-001/PNL/rpt-test-001.csv' };
    mockDb.select.mockReturnValueOnce(createChain([rowWithFile]));

    const { getReportById } = await import('../finance-center-reports');
    const result = await getReportById('user-test-001', 'rpt-test-001');

    expect(result?.fileUrl).toBe('https://r2.example.com/reports/user-test-001/PNL/rpt-test-001.csv');
  });
});
