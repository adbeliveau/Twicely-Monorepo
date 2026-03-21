/**
 * Additional tests for finance-center actions:
 * validation edge cases, delegation, unauthenticated transaction history,
 * dashboard error fallback, query error handling.
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

describe('getTransactionHistoryAction — auth + validation edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('rejects pageSize exceeding 100', async () => {
    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 101);

    expect(result.success).toBe(false);
  });

  it('rejects pageSize of 0', async () => {
    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 0);

    expect(result.success).toBe(false);
  });

  it('rejects negative pageSize', async () => {
    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, -5);

    expect(result.success).toBe(false);
  });

  it('rejects invalid typeGroup string', async () => {
    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20, undefined, 'INVALID_GROUP');

    expect(result.success).toBe(false);
  });

  it('rejects invalid type string', async () => {
    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20, 'NOT_A_REAL_TYPE');

    expect(result.success).toBe(false);
  });

  it('accepts valid typeGroup ALL', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-001', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetTransactions.mockResolvedValue({ transactions: [], total: 0, page: 1, pageSize: 20 });

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20, undefined, 'ALL');

    expect(result.success).toBe(true);
  });

  it('uses onBehalfOfSellerId when delegating', async () => {
    mockAuthorize.mockResolvedValue({
      session: {
        userId: 'staff-user-001',
        delegationId: 'del-abc',
        onBehalfOfSellerId: 'seller-target-001',
      },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetTransactions.mockResolvedValue({ transactions: [], total: 0, page: 1, pageSize: 20 });

    const { getTransactionHistoryAction } = await import('../finance-center');
    await getTransactionHistoryAction(1, 20);

    expect(mockGetTransactions).toHaveBeenCalledWith(
      'seller-target-001',
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });

  it('returns Forbidden when CASL denies LedgerEntry read', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns error when query throws', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-003', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetTransactions.mockRejectedValue(new Error('DB connection failed'));

    const { getTransactionHistoryAction } = await import('../finance-center');
    const result = await getTransactionHistoryAction(1, 20);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Failed to load transactions');
  });

  it('passes type filter through to query correctly', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-004', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetTransactions.mockResolvedValue({ transactions: [], total: 0, page: 1, pageSize: 20 });

    const { getTransactionHistoryAction } = await import('../finance-center');
    await getTransactionHistoryAction(1, 20, 'PAYOUT_SENT');

    expect(mockGetTransactions).toHaveBeenCalledWith(
      'user-test-004',
      expect.objectContaining({ type: 'PAYOUT_SENT' }),
    );
  });
});

