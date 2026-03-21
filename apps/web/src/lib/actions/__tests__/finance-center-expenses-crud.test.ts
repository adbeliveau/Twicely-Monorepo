/**
 * Tests for finance-center-expenses.ts server actions.
 * Covers: updateExpenseAction, deleteExpenseAction
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

function makeUpdateChain(returnedRow: unknown) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([returnedRow]),
      }),
    }),
  };
}

function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

const VALID_DATE = '2026-03-04T00:00:00.000Z';
const EXPENSE_ID = 'kdf46ew5ajics3trk133o80y';

const EXPENSE_ROW = {
  id: EXPENSE_ID,
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

// ─── updateExpenseAction ────────────────────────────────────────────────────

describe('updateExpenseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns validation error for missing id', async () => {
    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({
      category: 'Equipment',
    });

    expect(result.success).toBe(false);
  });

  it('returns tier gate error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({
      id: EXPENSE_ID,
      amountCents: 2000,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      'Upgrade to Finance Pro',
    );
  });

  it('returns not found when expense does not belong to user', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(null);

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({
      id: 'nonexistent',
      amountCents: 2000,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      'Expense not found',
    );
  });

  it('updates expense and returns updated row', async () => {
    const updated = { ...EXPENSE_ROW, amountCents: 2500 };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(EXPENSE_ROW);
    mockDbUpdate.mockReturnValue(makeUpdateChain(updated));

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({
      id: EXPENSE_ID,
      amountCents: 2500,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expense.amountCents).toBe(2500);
    }
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/expenses');
  });
});

// ─── deleteExpenseAction ────────────────────────────────────────────────────

describe('deleteExpenseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns validation error for missing id', async () => {
    const { deleteExpenseAction } = await import('../finance-center-expenses');
    const result = await deleteExpenseAction({});

    expect(result.success).toBe(false);
  });

  it('returns tier gate error when financeTier is FREE', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('FREE');

    const { deleteExpenseAction } = await import('../finance-center-expenses');
    const result = await deleteExpenseAction({ id: EXPENSE_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toContain(
      'Upgrade to Finance Pro',
    );
  });

  it('returns not found when expense does not exist', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(null);

    const { deleteExpenseAction } = await import('../finance-center-expenses');
    const result = await deleteExpenseAction({ id: 'nonexistent' });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      'Expense not found',
    );
  });

  it('deletes expense and returns success', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(EXPENSE_ROW);
    mockDbDelete.mockReturnValue(makeDeleteChain());

    const { deleteExpenseAction } = await import('../finance-center-expenses');
    const result = await deleteExpenseAction({ id: EXPENSE_ID });

    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/expenses');
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { deleteExpenseAction } = await import('../finance-center-expenses');
    const result = await deleteExpenseAction({ id: EXPENSE_ID });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
  });
});
