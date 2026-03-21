/**
 * Tests for finance-center-expenses.ts — createExpenseAction receipt OCR integration.
 * Verifies: extractReceiptData called, receiptDataJson stored, no-receipt path clean.
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

function makeInsertChain(returnedRow: unknown) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnedRow]),
    }),
  };
}

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
const RECEIPT_URL = 'https://cdn.test/receipts/receipt-001.jpg';

const OCR_RESULT = {
  vendor: 'USPS', amountCents: 1599, date: '2026-03-04',
  suggestedCategory: 'Shipping Supplies', confidence: 0.97, rawText: 'USPS $15.99',
};

const EXPENSE_ROW = {
  id: 'exp-test-001', category: 'Shipping Supplies', amountCents: 1500,
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

// ─── createExpenseAction — receipt OCR integration ───────────────────────────

describe('createExpenseAction — receipt OCR integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does NOT call extractReceiptData when no receiptUrl provided', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue(makeInsertChain(EXPENSE_ROW));

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies', amountCents: 1500, expenseDate: VALID_DATE, isRecurring: false,
    });

    expect(result.success).toBe(true);
    expect(mockExtractReceiptData).not.toHaveBeenCalled();
  });

  it('calls extractReceiptData with the receipt URL when provided', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue(makeInsertChain(EXPENSE_ROW_WITH_RECEIPT));
    mockExtractReceiptData.mockResolvedValue(OCR_RESULT);
    mockDbUpdate.mockReturnValue(makeUpdateChain(EXPENSE_ROW_WITH_RECEIPT));

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies', amountCents: 1500,
      expenseDate: VALID_DATE, isRecurring: false, receiptUrl: RECEIPT_URL,
    });

    expect(result.success).toBe(true);
    expect(mockExtractReceiptData).toHaveBeenCalledWith(RECEIPT_URL);
  });

  it('merges OCR result into returned expense as receiptDataJson', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue(makeInsertChain(EXPENSE_ROW_WITH_RECEIPT));
    mockExtractReceiptData.mockResolvedValue(OCR_RESULT);
    mockDbUpdate.mockReturnValue(makeUpdateChain(EXPENSE_ROW_WITH_RECEIPT));

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies', amountCents: 1500,
      expenseDate: VALID_DATE, isRecurring: false, receiptUrl: RECEIPT_URL,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expense.receiptDataJson).toEqual(OCR_RESULT);
    }
  });

  it('still succeeds when OCR returns null-result (dev fallback)', async () => {
    const nullOcr = { vendor: null, amountCents: null, date: null, suggestedCategory: null, confidence: 0, rawText: null };
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue(makeInsertChain(EXPENSE_ROW_WITH_RECEIPT));
    mockExtractReceiptData.mockResolvedValue(nullOcr);
    mockDbUpdate.mockReturnValue(makeUpdateChain(EXPENSE_ROW_WITH_RECEIPT));

    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies', amountCents: 1500,
      expenseDate: VALID_DATE, isRecurring: false, receiptUrl: RECEIPT_URL,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expense.receiptDataJson).toEqual(nullOcr);
    }
  });

  it('writes OCR result to DB via update after insert', async () => {
    mockAuth();
    mockGetFinanceTier.mockResolvedValue('PRO');
    mockDbInsert.mockReturnValue(makeInsertChain(EXPENSE_ROW_WITH_RECEIPT));
    mockExtractReceiptData.mockResolvedValue(OCR_RESULT);
    const updateChain = makeUpdateChain(EXPENSE_ROW_WITH_RECEIPT);
    mockDbUpdate.mockReturnValue(updateChain);

    const { createExpenseAction } = await import('../finance-center-expenses');
    await createExpenseAction({
      category: 'Shipping Supplies', amountCents: 1500,
      expenseDate: VALID_DATE, isRecurring: false, receiptUrl: RECEIPT_URL,
    });

    expect(mockDbUpdate).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith({ receiptDataJson: OCR_RESULT });
  });

  it('validates receiptUrl as a URL — invalid URL fails before OCR', async () => {
    const { createExpenseAction } = await import('../finance-center-expenses');
    const result = await createExpenseAction({
      category: 'Shipping Supplies', amountCents: 1500,
      expenseDate: VALID_DATE, isRecurring: false, receiptUrl: 'not-a-url',
    });

    expect(result.success).toBe(false);
    expect(mockExtractReceiptData).not.toHaveBeenCalled();
  });
});
