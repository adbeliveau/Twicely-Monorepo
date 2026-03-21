/**
 * Tests for finance-center-expenses.ts and finance-center.ts server actions.
 * Covers: listExpensesAction, getCogsSummaryAction
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetExpenseList = vi.fn();
const mockGetCogsSummary = vi.fn();
const mockGetFinanceTier = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@twicely/casl', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
  sub: (type: string, conditions: Record<string, unknown>) => ({
    ...conditions,
    __caslSubjectType__: type,
  }),
}));

vi.mock('@/lib/queries/finance-center', () => ({
  getFinanceTier: (...args: unknown[]) => mockGetFinanceTier(...args),
  getExpenseList: (...args: unknown[]) => mockGetExpenseList(...args),
  getCogsSummary: (...args: unknown[]) => mockGetCogsSummary(...args),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  expense: { id: 'id', userId: 'userId', category: 'category' },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const VALID_DATE = '2026-03-04T00:00:00.000Z';

const EXPENSE_ROW = {
  id: 'exp-test-001',
  category: 'Shipping Supplies',
  amountCents: 1500,
  currency: 'USD',
  vendor: 'USPS',
  description: null,
  receiptUrl: null,
  expenseDate: new Date(VALID_DATE),
  isRecurring: false,
  recurringFrequency: null,
  recurringEndDate: null,
  parentExpenseId: null,
  createdAt: new Date(VALID_DATE),
  updatedAt: new Date(VALID_DATE),
};

function mockAuth() {
  mockAuthorize.mockResolvedValue({
    session: {
      userId: 'user-test-001',
      delegationId: null,
      onBehalfOfSellerId: null,
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

// ─── listExpensesAction ─────────────────────────────────────────────────────

describe('listExpensesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { listExpensesAction } = await import('../finance-center-expenses');
    const result = await listExpensesAction({ page: 1, pageSize: 20 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns validation error for invalid pageSize', async () => {
    const { listExpensesAction } = await import('../finance-center-expenses');
    const result = await listExpensesAction({ page: 1, pageSize: 101 });

    expect(result.success).toBe(false);
  });

  it('returns Forbidden when CASL denies read on Expense', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { listExpensesAction } = await import('../finance-center-expenses');
    const result = await listExpensesAction({ page: 1, pageSize: 20 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns paginated list for authorized user', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseList.mockResolvedValue({
      expenses: [EXPENSE_ROW],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const { listExpensesAction } = await import('../finance-center-expenses');
    const result = await listExpensesAction({ page: 1, pageSize: 20 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(1);
      expect(result.data.expenses).toHaveLength(1);
    }
  });

  it('listExpensesAction returns error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');

    const { listExpensesAction } = await import('../finance-center-expenses');
    const result = await listExpensesAction({ page: 1, pageSize: 20 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Upgrade to Finance Pro to view expenses');
  });
});

// ─── getCogsSummaryAction ───────────────────────────────────────────────────

describe('getCogsSummaryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { getCogsSummaryAction } = await import('../finance-center');
    const result = await getCogsSummaryAction({ days: 30 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Forbidden when CASL denies Analytics read', async () => {
    mockAuthorize.mockResolvedValue({
      session: { userId: 'user-test-002', delegationId: null },
      ability: { can: vi.fn().mockReturnValue(false) },
    });

    const { getCogsSummaryAction } = await import('../finance-center');
    const result = await getCogsSummaryAction({ days: 30 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Forbidden');
  });

  it('returns COGS summary for authorized user', async () => {
    mockAuth();
    mockGetCogsSummary.mockResolvedValue({
      totalCogsCents: 3000,
      totalSoldRevenueCents: 8000,
      grossProfitCents: 5000,
      cogsMarginPercent: 62.5,
      itemCount: 2,
    });

    const { getCogsSummaryAction } = await import('../finance-center');
    const result = await getCogsSummaryAction({ days: 30 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.cogs.totalCogsCents).toBe(3000);
      expect(result.cogs.cogsMarginPercent).toBe(62.5);
    }
  });

  it('defaults days to 30 when called with no argument', async () => {
    mockAuth();
    mockGetCogsSummary.mockResolvedValue({
      totalCogsCents: 0,
      totalSoldRevenueCents: 0,
      grossProfitCents: 0,
      cogsMarginPercent: 0,
      itemCount: 0,
    });

    const { getCogsSummaryAction } = await import('../finance-center');
    const result = await getCogsSummaryAction();

    expect(result.success).toBe(true);
    expect(mockGetCogsSummary).toHaveBeenCalledWith('user-test-001', 30);
  });

  it('returns error when query throws', async () => {
    mockAuth();
    mockGetCogsSummary.mockRejectedValue(new Error('DB error'));

    const { getCogsSummaryAction } = await import('../finance-center');
    const result = await getCogsSummaryAction({ days: 30 });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      'Failed to load COGS data',
    );
  });
});
