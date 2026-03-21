/**
 * Tests for finance-center-expenses.ts — updateExpenseAction receipt OCR integration.
 * Verifies: OCR triggered on new URL, skipped on null URL, receiptDataJson stored.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthorize = vi.fn();
const mockGetFinanceTier = vi.fn();
const mockGetExpenseById = vi.fn();
const mockExtractReceiptData = vi.fn();
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

vi.mock('@twicely/finance/receipt-ocr', () => ({
  extractReceiptData: (...args: unknown[]) => mockExtractReceiptData(...args),
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

const VALID_DATE = '2026-03-04T00:00:00.000Z';
const EXPENSE_ID = 'kdf46ew5ajics3trk133o80y';
const RECEIPT_URL = 'https://cdn.test/receipts/receipt-001.jpg';

const OCR_RESULT = {
  vendor: 'USPS', amountCents: 1599, date: '2026-03-04',
  suggestedCategory: 'Shipping Supplies', confidence: 0.97, rawText: 'USPS $15.99',
};

const EXPENSE_ROW = {
  id: EXPENSE_ID, category: 'Shipping Supplies', amountCents: 1500,
  currency: 'USD', vendor: 'USPS', description: null, receiptUrl: null,
  receiptDataJson: null, expenseDate: new Date(VALID_DATE), isRecurring: false,
  recurringFrequency: null, recurringEndDate: null, parentExpenseId: null,
  createdAt: new Date(VALID_DATE), updatedAt: new Date(VALID_DATE),
};

const EXPENSE_ROW_WITH_RECEIPT = { ...EXPENSE_ROW, receiptUrl: RECEIPT_URL };

function mockAuth() {
  mockAuthorize.mockResolvedValue({
    session: { userId: 'user-test-001', delegationId: null, onBehalfOfSellerId: null },
    ability: { can: vi.fn().mockReturnValue(true) },
  });
}

// ─── updateExpenseAction — receipt OCR integration ───────────────────────────

describe('updateExpenseAction — receipt OCR integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does NOT call extractReceiptData when receiptUrl not in payload', async () => {
    const updated = { ...EXPENSE_ROW, amountCents: 2000 };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(EXPENSE_ROW);
    mockDbUpdate.mockReturnValue(makeUpdateChain(updated));

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({ id: EXPENSE_ID, amountCents: 2000 });

    expect(result.success).toBe(true);
    expect(mockExtractReceiptData).not.toHaveBeenCalled();
  });

  it('calls extractReceiptData when receiptUrl is in update payload', async () => {
    const updated = { ...EXPENSE_ROW, receiptUrl: RECEIPT_URL };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(EXPENSE_ROW);
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChain(updated))
      .mockReturnValueOnce(makeUpdateChain(updated));
    mockExtractReceiptData.mockResolvedValue(OCR_RESULT);

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({ id: EXPENSE_ID, receiptUrl: RECEIPT_URL });

    expect(result.success).toBe(true);
    expect(mockExtractReceiptData).toHaveBeenCalledWith(RECEIPT_URL);
  });

  it('merges OCR result into returned expense on update', async () => {
    const updated = { ...EXPENSE_ROW, receiptUrl: RECEIPT_URL };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(EXPENSE_ROW);
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChain(updated))
      .mockReturnValueOnce(makeUpdateChain(updated));
    mockExtractReceiptData.mockResolvedValue(OCR_RESULT);

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({ id: EXPENSE_ID, receiptUrl: RECEIPT_URL });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expense.receiptDataJson).toEqual(OCR_RESULT);
    }
  });

  it('does NOT call extractReceiptData when receiptUrl is set to null', async () => {
    const updated = { ...EXPENSE_ROW_WITH_RECEIPT, receiptUrl: null };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(EXPENSE_ROW_WITH_RECEIPT);
    mockDbUpdate.mockReturnValue(makeUpdateChain(updated));

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({ id: EXPENSE_ID, receiptUrl: null });

    expect(result.success).toBe(true);
    expect(mockExtractReceiptData).not.toHaveBeenCalled();
  });

  it('revalidates finance paths after successful receipt update', async () => {
    const updated = { ...EXPENSE_ROW, receiptUrl: RECEIPT_URL };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(EXPENSE_ROW);
    mockDbUpdate
      .mockReturnValueOnce(makeUpdateChain(updated))
      .mockReturnValueOnce(makeUpdateChain(updated));
    mockExtractReceiptData.mockResolvedValue(OCR_RESULT);

    const { updateExpenseAction } = await import('../finance-center-expenses');
    await updateExpenseAction({ id: EXPENSE_ID, receiptUrl: RECEIPT_URL });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/my/selling/finances/expenses');
  });

  it('returns not found when expense does not belong to user during receipt update', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockGetExpenseById.mockResolvedValue(null);

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({ id: 'nonexistent', receiptUrl: RECEIPT_URL });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Expense not found');
    expect(mockExtractReceiptData).not.toHaveBeenCalled();
  });

  it('returns Unauthorized when session is null', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: { can: vi.fn() } });

    const { updateExpenseAction } = await import('../finance-center-expenses');
    const result = await updateExpenseAction({ id: EXPENSE_ID, receiptUrl: RECEIPT_URL });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Unauthorized');
    expect(mockExtractReceiptData).not.toHaveBeenCalled();
  });
});
