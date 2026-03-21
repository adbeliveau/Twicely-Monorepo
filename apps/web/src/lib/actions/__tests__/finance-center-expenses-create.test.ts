/**
 * Tests for finance-center-expenses.ts server actions.
 * Covers: createExpenseAction
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetFinanceTier = vi.fn();
const mockGetExpenseById = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();
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
  getExpenseById: (...args: unknown[]) => mockGetExpenseById(...args),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  expense: { id: 'id', userId: 'userId', category: 'category' },
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

function makeInsertChain(returnedRow: unknown) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnedRow]),
    }),
  };
}

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

function mockAuth(overrides?: { delegationId?: string; onBehalfOfSellerId?: string }) {
  mockAuthorize.mockResolvedValue({
    session: {
      userId: 'user-test-001',
      delegationId: overrides?.delegationId ?? null,
      onBehalfOfSellerId: overrides?.onBehalfOfSellerId ?? null,
    },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

// ─── createExpenseAction ────────────────────────────────────────────────────

describe('createExpenseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies',
      amountCents: 1500,
      expenseDate: VALID_DATE,
      isRecurring: false,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });

  it('returns Invalid input for unknown fields (strict schema)', async () => {
    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies',
      amountCents: 1500,
      expenseDate: VALID_DATE,
      isRecurring: false,
      unknownField: 'boom',
    });

    expect(result.success).toBe(false);
  });

  it('returns validation error for invalid category', async () => {
    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'INVALID_CATEGORY',
      amountCents: 1500,
      expenseDate: VALID_DATE,
      isRecurring: false,
    });

    expect(result.success).toBe(false);
  });

  it('returns validation error for non-positive amountCents', async () => {
    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies',
      amountCents: 0,
      expenseDate: VALID_DATE,
      isRecurring: false,
    });

    expect(result.success).toBe(false);
  });

  it('returns validation error when recurring with no frequency', async () => {
    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies',
      amountCents: 1500,
      expenseDate: VALID_DATE,
      isRecurring: true,
      // no recurringFrequency
    });

    expect(result.success).toBe(false);
  });

  it('returns tier gate error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Equipment',
      amountCents: 5000,
      expenseDate: VALID_DATE,
      isRecurring: false,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      'Upgrade to Finance Pro',
    );
  });

  it('creates expense and returns it for PRO tier user', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue(makeInsertChain(EXPENSE_ROW));

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies',
      amountCents: 1500,
      expenseDate: VALID_DATE,
      isRecurring: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expense.id).toBe('exp-test-001');
      expect(result.expense.amountCents).toBe(1500);
    }
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/expenses');
  });

  it('uses onBehalfOfSellerId for delegated sessions', async () => {
    mockAuthorize.mockResolvedValue({
      session: {
        userId: 'staff-user-001',
        delegationId: 'del-abc',
        onBehalfOfSellerId: 'seller-target-001',
      },
      ability: { can: vi.fn().mockReturnValue(true) },
    });
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue(makeInsertChain(EXPENSE_ROW));

    const { createExpenseAction } = await import('../finance-center-expenses');
    await createExpenseAction({
      category: 'Shipping Supplies',
      amountCents: 1500,
      expenseDate: VALID_DATE,
      isRecurring: false,
    });

    expect(mockGetFinanceTier).toHaveBeenCalledWith('seller-target-001');
  });

  it('returns error when insert returns empty result', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Packaging',
      amountCents: 500,
      expenseDate: VALID_DATE,
      isRecurring: false,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      'Failed to create expense',
    );
  });
});
