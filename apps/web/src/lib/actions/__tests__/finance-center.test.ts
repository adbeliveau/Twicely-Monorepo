import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockAuthorize = vi.fn();
const mockGetKPIs = vi.fn();
const mockGetTimeSeries = vi.fn();
const mockGetExpenses = vi.fn();
const mockGetMileage = vi.fn();
const mockGetTier = vi.fn();
const mockGetTransactions = vi.fn();
const mockGetTypeGroupFilter = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));

vi.mock('@/lib/queries/finance-center', () => ({
  getFinanceDashboardKPIs: (...args: unknown[]) => mockGetKPIs(...args),
  getRevenueTimeSeries: (...args: unknown[]) => mockGetTimeSeries(...args),
  getExpenseSummary: (...args: unknown[]) => mockGetExpenses(...args),
  getMileageSummary: (...args: unknown[]) => mockGetMileage(...args),
  getFinanceTier: (...args: unknown[]) => mockGetTier(...args),
  getRecentTransactions: (...args: unknown[]) => mockGetTransactions(...args),
  getTypeGroupFilter: (...args: unknown[]) => mockGetTypeGroupFilter(...args),
}));

const emptyKPIs = {
  grossRevenueCents: 0, totalOrderCount: 0, avgSalePriceCents: 0,
  tfFeesCents: 0, stripeFeesCents: 0, boostFeesCents: 0,
  totalFeesCents: 0, shippingCostsCents: 0, netEarningsCents: 0,
  effectiveFeeRatePercent: 0, availableForPayoutCents: 0, pendingCents: 0, reservedCents: 0,
};

const emptyExpenses = {
  totalExpensesCents: 0, expensesByCategory: [], recentExpenses: [],
};

const emptyMileage = { totalMiles: 0, totalDeductionCents: 0, tripCount: 0 };

const emptyTransactions = { transactions: [], total: 0, page: 1, pageSize: 20 };

describe('getFinanceDashboardAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { getFinanceDashboardAction } = await import('../finance-center');
    const result = await getFinanceDashboardAction();

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns error when CASL denies access', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { getFinanceDashboardAction } = await import('../finance-center');
    const result = await getFinanceDashboardAction();

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns dashboard data for authenticated seller', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetKPIs.mockResolvedValue(emptyKPIs);
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(emptyExpenses);
    mockGetMileage.mockResolvedValue(emptyMileage);
    mockGetTier.mockResolvedValue('FREE');

    const { getFinanceDashboardAction } = await import('../finance-center');
    const result = await getFinanceDashboardAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.kpis).toEqual(emptyKPIs);
      expect(result.timeSeries).toEqual([]);
      expect(result.financeTier).toBe('FREE');
    }
  });

  it('includes financeTier in response', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetKPIs.mockResolvedValue(emptyKPIs);
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(emptyExpenses);
    mockGetMileage.mockResolvedValue(emptyMileage);
    mockGetTier.mockResolvedValue('PRO');

    const { getFinanceDashboardAction } = await import('../finance-center');
    const result = await getFinanceDashboardAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.financeTier).toBe('PRO');
    }
  });

  it('handles delegation (uses onBehalfOfSellerId)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'staff-user', delegationId: 'del-1', onBehalfOfSellerId: 'seller-1' },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetKPIs.mockResolvedValue(emptyKPIs);
    mockGetTimeSeries.mockResolvedValue([]);
    mockGetExpenses.mockResolvedValue(emptyExpenses);
    mockGetMileage.mockResolvedValue(emptyMileage);
    mockGetTier.mockResolvedValue('FREE');

    const { getFinanceDashboardAction } = await import('../finance-center');
    await getFinanceDashboardAction();

    // Verify the query was called with seller's userId, not staff's
    expect(mockGetKPIs).toHaveBeenCalledWith('seller-1');
  });
});

describe('getTransactionHistoryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('validates input with Zod (rejects negative page)', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(-1, 20);

    expect(result.success).toBe(false);
  });

  it('returns paginated transaction list', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetTransactions.mockResolvedValue(emptyTransactions);

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transactions).toEqual([]);
      expect(result.data.total).toBe(0);
    }
  });

  it('filters by type group when specified', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetTransactions.mockResolvedValue({ ...emptyTransactions });

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20, undefined, 'FEES');

    expect(result.success).toBe(true);
    expect(mockGetTransactions).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ typeGroup: 'FEES' }),
    );
  });

  it('returns error when not authorized', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-1', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });
});
