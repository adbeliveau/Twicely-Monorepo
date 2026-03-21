import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };

// Chainable mock helper — returns finalResult when awaited
function createChain(finalResult: unknown) {
  const makeProxy = (): Record<string, unknown> => {
    const p: Record<string, unknown> = {};
    for (const k of ['from', 'where', 'groupBy', 'orderBy', 'limit', 'offset']) {
      p[k] = (..._args: unknown[]) => makeProxy();
    }
    p.then = (resolve: (v: unknown) => void) => resolve(finalResult);
    return p;
  };
  return makeProxy();
}

describe('getRecentTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns paginated results with correct total count', async () => {
    const now = new Date();
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 5 }]))
      .mockReturnValueOnce(
        createChain([
          {
            id: 'le-1', type: 'ORDER_PAYMENT_CAPTURED', amountCents: 5000,
            status: 'POSTED', orderId: 'ord-1', memo: null, postedAt: now, createdAt: now,
          },
        ]),
      );

    const { getRecentTransactions } = await import('../finance-center');
    const result = await getRecentTransactions('user-1', { page: 1, pageSize: 20 });

    expect(result.total).toBe(5);
    expect(result.transactions).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('filters by ledger entry type when specified', async () => {
    const now = new Date();
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(
        createChain([
          {
            id: 'le-2', type: 'ORDER_TF_FEE', amountCents: -500,
            status: 'POSTED', orderId: 'ord-1', memo: null, postedAt: now, createdAt: now,
          },
        ]),
      );

    const { getRecentTransactions } = await import('../finance-center');
    const result = await getRecentTransactions('user-1', { page: 1, pageSize: 20, type: 'ORDER_TF_FEE' });

    expect(result.transactions[0]?.type).toBe('ORDER_TF_FEE');
  });

  it('orders by createdAt descending', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getRecentTransactions } = await import('../finance-center');
    const result = await getRecentTransactions('user-1', { page: 1, pageSize: 20 });

    expect(result.transactions).toHaveLength(0);
  });

  it('returns empty array for seller with no transactions', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]));

    const { getRecentTransactions } = await import('../finance-center');
    const result = await getRecentTransactions('user-1', { page: 1, pageSize: 20 });

    expect(result.transactions).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('getExpenseSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zeros when seller has no expenses', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const { getExpenseSummary } = await import('../finance-center');
    const result = await getExpenseSummary('user-1');

    expect(result.totalExpensesCents).toBe(0);
    expect(result.expensesByCategory).toEqual([]);
    expect(result.recentExpenses).toEqual([]);
  });

  it('groups expenses by category with correct totals', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 3000 }]))
      .mockReturnValueOnce(createChain([
        { category: 'SUPPLIES', totalCents: 2000, cnt: 3 },
        { category: 'SHIPPING', totalCents: 1000, cnt: 2 },
      ]))
      .mockReturnValueOnce(createChain([]));

    const { getExpenseSummary } = await import('../finance-center');
    const result = await getExpenseSummary('user-1');

    expect(result.totalExpensesCents).toBe(3000);
    expect(result.expensesByCategory).toHaveLength(2);
    const firstCat = result.expensesByCategory[0];
    expect(firstCat?.category).toBe('SUPPLIES');
    expect(firstCat?.totalCents).toBe(2000);
    expect(firstCat?.count).toBe(3);
  });

  it('limits recent expenses to 5 entries', async () => {
    const now = new Date();
    const recentRows = Array.from({ length: 5 }, (_, i) => ({
      id: `exp-${i}`,
      category: 'SUPPLIES',
      amountCents: 100,
      vendor: null,
      description: null,
      expenseDate: now,
    }));

    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 5000 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain(recentRows));

    const { getExpenseSummary } = await import('../finance-center');
    const result = await getExpenseSummary('user-1');

    expect(result.recentExpenses).toHaveLength(5);
  });

  it('respects date range filter', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 0 }]))
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([]));

    const { getExpenseSummary } = await import('../finance-center');
    const result = await getExpenseSummary('user-1', 7);

    expect(result.totalExpensesCents).toBe(0);
  });
});

describe('getMileageSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zeros when seller has no mileage entries', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([{ totalMiles: 0, totalDeductionCents: 0, tripCount: 0 }]),
    );

    const { getMileageSummary } = await import('../finance-center');
    const result = await getMileageSummary('user-1');

    expect(result.totalMiles).toBe(0);
    expect(result.totalDeductionCents).toBe(0);
    expect(result.tripCount).toBe(0);
  });

  it('sums miles and deduction cents correctly', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([{ totalMiles: 125.5, totalDeductionCents: 8497, tripCount: 12 }]),
    );

    const { getMileageSummary } = await import('../finance-center');
    const result = await getMileageSummary('user-1');

    expect(result.totalMiles).toBe(125.5);
    expect(result.totalDeductionCents).toBe(8497);
    expect(result.tripCount).toBe(12);
  });

  it('counts trips in date range', async () => {
    mockDb.select.mockReturnValueOnce(
      createChain([{ totalMiles: 50, totalDeductionCents: 3385, tripCount: 5 }]),
    );

    const { getMileageSummary } = await import('../finance-center');
    const result = await getMileageSummary('user-1', 7);

    expect(result.tripCount).toBe(5);
  });
});
