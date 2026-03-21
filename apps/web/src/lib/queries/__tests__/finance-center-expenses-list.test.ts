/**
 * Tests for finance-center-expenses.ts queries.
 * Covers: getExpenseList, getExpenseById
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock daysAgo from finance-center (imported by the module under test)
vi.mock('../finance-center', () => ({
  daysAgo: (days: number) => {
    const d = new Date('2026-03-04T00:00:00.000Z');
    d.setDate(d.getDate() - days);
    return d;
  },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };

function createChain(finalResult: unknown) {
  const makeProxy = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    for (const k of [
      'from', 'where', 'groupBy', 'orderBy', 'limit', 'offset', 'innerJoin',
    ]) {
      p[k] = (..._args: unknown[]) => makeProxy();
    }
    p.then = (resolve: (v: unknown) => void) => resolve(finalResult);
    return p;
  };
  return makeProxy();
}

// ─── getExpenseList ─────────────────────────────────────────────────────────

describe('getExpenseList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns paginated results with correct shape', async () => {
    const now = new Date();
    const expenseRow = {
      id: 'exp-test-001',
      category: 'Shipping Supplies',
      amountCents: 1500,
      currency: 'USD',
      vendor: 'USPS',
      description: null,
      receiptUrl: null,
      expenseDate: now,
      isRecurring: false,
      recurringFrequency: null,
      recurringEndDate: null,
      parentExpenseId: null,
      createdAt: now,
      updatedAt: now,
    };

    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(createChain([expenseRow]));

    const { getExpenseList } = await import('../finance-center-expenses');
    const result = await getExpenseList('user-test-001', {
      page: 1,
      pageSize: 20,
      sortBy: 'expenseDate',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(1);
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0]?.id).toBe('exp-test-001');
    expect(result.expenses[0]?.amountCents).toBe(1500);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('returns zero total when no expenses exist', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getExpenseList } = await import('../finance-center-expenses');
    const result = await getExpenseList('user-test-002', {
      page: 1,
      pageSize: 20,
      sortBy: 'expenseDate',
      sortOrder: 'desc',
    });

    expect(result.total).toBe(0);
    expect(result.expenses).toEqual([]);
  });

  it('handles missing totalRow gracefully (total defaults to 0)', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const { getExpenseList } = await import('../finance-center-expenses');
    const result = await getExpenseList('user-test-003', {
      page: 2,
      pageSize: 10,
      sortBy: 'amountCents',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(0);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('sorts by category asc', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getExpenseList } = await import('../finance-center-expenses');
    const result = await getExpenseList('user-test-004', {
      page: 1,
      pageSize: 20,
      sortBy: 'category',
      sortOrder: 'asc',
    });

    expect(result.expenses).toEqual([]);
  });

  it('sorts by createdAt desc', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getExpenseList } = await import('../finance-center-expenses');
    const result = await getExpenseList('user-test-005', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.expenses).toEqual([]);
  });
});

// ─── getExpenseById ─────────────────────────────────────────────────────────

describe('getExpenseById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns the expense row when found', async () => {
    const now = new Date();
    const expenseRow = {
      id: 'exp-test-abc',
      category: 'Equipment',
      amountCents: 25000,
      currency: 'USD',
      vendor: 'Best Buy',
      description: 'Label printer',
      receiptUrl: null,
      expenseDate: now,
      isRecurring: false,
      recurringFrequency: null,
      recurringEndDate: null,
      parentExpenseId: null,
      createdAt: now,
      updatedAt: now,
    };

    mockDb.select.mockReturnValueOnce(createChain([expenseRow]));

    const { getExpenseById } = await import('../finance-center-expenses');
    const result = await getExpenseById('user-test-001', 'exp-test-abc');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('exp-test-abc');
    expect(result?.amountCents).toBe(25000);
    expect(result?.vendor).toBe('Best Buy');
  });

  it('returns null when expense is not found', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getExpenseById } = await import('../finance-center-expenses');
    const result = await getExpenseById('user-test-001', 'nonexistent-expense');

    expect(result).toBeNull();
  });
});
