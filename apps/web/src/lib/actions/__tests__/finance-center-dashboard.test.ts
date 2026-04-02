/**
 * Tests for getFinanceDashboardAction — error fallback, delegation, CASL checks.
 * Split from finance-center-extra.test.ts to stay under 250-line limit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetKPIs = vi.fn();
const mockGetTimeSeries = vi.fn();
const mockGetExpenses = vi.fn();
const mockGetMileage = vi.fn();
const mockGetTier = vi.fn();
const mockGetTransactions = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions,
    __caslSubjectType__: type,
  }),
}));

vi.mock('@/lib/queries/finance-center', () => ({
  getFinanceDashboardKPIs: (...args: unknown[]) => mockGetKPIs(...args),
  getRevenueTimeSeries: (...args: unknown[]) => mockGetTimeSeries(...args),
  getExpenseSummary: (...args: unknown[]) => mockGetExpenses(...args),
  getMileageSummary: (...args: unknown[]) => mockGetMileage(...args),
  getFinanceTier: (...args: unknown[]) => mockGetTier(...args),
  getRecentTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  getTypeGroupFilter: vi.fn(),
}));

const emptyKPIs = {
  grossRevenueCents: 0, totalOrderCount: 0, avgSalePriceCents: 0,
  tfFeesCents: 0, stripeFeesCents: 0, boostFeesCents: 0,
  totalFeesCents: 0, shippingCostsCents: 0, netEarningsCents: 0,
  effectiveFeeRatePercent: 0, availableForPayoutCents: 0, pendingCents: 0, reservedCents: 0,
};
const emptyExpenses = { totalExpensesCents: 0, expensesByCategory: [], recentExpenses: [] };
const emptyMileage = { totalMiles: 0, totalDeductionCents: 0, tripCount: 0 };

describe('getFinanceDashboardAction — error fallback and delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error message when queries throw', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-010', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetKPIs.mockRejectedValue(new Error('DB error'));
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(emptyExpenses);
    mockGetMileage.mockResolvedValue(emptyMileage);
    mockGetTier.mockResolvedValue('FREE');

    const { getFinanceDashboardAction } = await import('../finance-center');
    const result = await getFinanceDashboardAction();

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      'Failed to load financial data',
    );
  });

  it('uses own userId when no delegation', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-011', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetKPIs.mockResolvedValue(emptyKPIs);
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(emptyExpenses);
    mockGetMileage.mockResolvedValue(emptyMileage);
    mockGetTier.mockResolvedValue('FREE');

    const { getFinanceDashboardAction } = await import('../finance-center');
    await getFinanceDashboardAction();

    expect(mockGetKPIs).toHaveBeenCalledWith('user-test-011');
    expect(mockGetTier).toHaveBeenCalledWith('user-test-011');
  });

  it('passes expenses and mileage in the response', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-012', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    const expenses = {
      totalExpensesCents: 5000,
      expensesByCategory: [{ category: 'SUPPLIES', totalCents: 5000, count: 2 }],
      recentExpenses: [],
    };
    const mileage = { totalMiles: 100, totalDeductionCents: 6700, tripCount: 5 };

    mockGetKPIs.mockResolvedValue(emptyKPIs);
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(expenses);
    mockGetMileage.mockResolvedValue(mileage);
    mockGetTier.mockResolvedValue('PRO');

    const { getFinanceDashboardAction } = await import('../finance-center');
    const result = await getFinanceDashboardAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expenses.totalExpensesCents).toBe(5000);
      expect(result.mileage.totalMiles).toBe(100);
      expect(result.mileage.tripCount).toBe(5);
    }
  });

  it('checks CASL against Analytics subject with correct userId', async () => {
    const mockCan = vi.fn().mockReturnValue(true);
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-013', delegationId: null },
      ability: { can: mockCan },
    });
    mockGetKPIs.mockResolvedValue(emptyKPIs);
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(emptyExpenses);
    mockGetMileage.mockResolvedValue(emptyMileage);
    mockGetTier.mockResolvedValue('FREE');

    const { getFinanceDashboardAction } = await import('../finance-center');
    await getFinanceDashboardAction();

    expect(mockCan).toHaveBeenCalledWith(
      'read',
      expect.objectContaining({ __caslSubjectType__: 'Analytics', sellerId: 'user-test-013' }),
    );
  });

  it('uses onBehalfOfSellerId in delegation session for KPIs query', async () => {
    mockAuthorize.mockResolvedValue({
      session: {
        userId: 'staff-user-020',
        delegationId: 'del-020',
        onBehalfOfSellerId: 'seller-target-020',
      },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetKPIs.mockResolvedValue(emptyKPIs);
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(emptyExpenses);
    mockGetMileage.mockResolvedValue(emptyMileage);
    mockGetTier.mockResolvedValue('FREE');

    const { getFinanceDashboardAction } = await import('../finance-center');
    await getFinanceDashboardAction();

    // Delegated session: KPIs fetched for the target seller, not the staff user
    expect(mockGetKPIs).toHaveBeenCalledWith('seller-target-020');
    expect(mockGetKPIs).not.toHaveBeenCalledWith('staff-user-020');
  });

  it('runs all 5 data queries in parallel (Promise.all)', async () => {
    const callOrder: string[] = [];
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-014', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetKPIs.mockImplementation(() => {
      callOrder.push('kpis');
      return Promise.resolve(emptyKPIs);
    });
    mockGetTimeSeries.mockImplementation(() => {
      callOrder.push('timeSeries');
      return Promise.resolve([]);
    });
    mockGetExpenses.mockImplementation(() => {
      callOrder.push('expenses');
      return Promise.resolve(emptyExpenses);
    });
    mockGetMileage.mockImplementation(() => {
      callOrder.push('mileage');
      return Promise.resolve(emptyMileage);
    });
    mockGetTier.mockImplementation(() => {
      callOrder.push('tier');
      return Promise.resolve('FREE');
    });

    const { getFinanceDashboardAction } = await import('../finance-center');
    const result = await getFinanceDashboardAction();

    expect(result.success).toBe(true);
    // All 5 query functions must be called
    expect(callOrder).toHaveLength(5);
    expect(callOrder).toContain('kpis');
    expect(callOrder).toContain('timeSeries');
    expect(callOrder).toContain('expenses');
    expect(callOrder).toContain('mileage');
    expect(callOrder).toContain('tier');
  });
});
