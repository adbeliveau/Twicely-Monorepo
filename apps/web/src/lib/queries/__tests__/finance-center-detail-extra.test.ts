/**
 * Additional tests for finance-center-detail.ts:
 * getTypeGroupFilter, pagination offset, empty typeGroup filter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

// format.ts is NOT mocked — getTypeGroupFilter calls getLedgerTypeGroup directly
// which is a pure function with no side effects.

import { db } from '@twicely/db';
import type { Mock } from 'vitest';

const mockDb = db as unknown as { select: Mock };

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

describe('getTypeGroupFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns undefined for undefined input (no filter)', async () => {
    const { getTypeGroupFilter } = await import('../finance-center-detail');
    const result = await getTypeGroupFilter(undefined);
    expect(result).toBeUndefined();
  });

  it('returns undefined for "ALL" (no filter)', async () => {
    const { getTypeGroupFilter } = await import('../finance-center-detail');
    const result = await getTypeGroupFilter('ALL');
    expect(result).toBeUndefined();
  });

  it('returns an array of types for FEES group', async () => {
    const { getTypeGroupFilter } = await import('../finance-center-detail');
    const result = await getTypeGroupFilter('FEES');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('ORDER_TF_FEE');
    expect(result).toContain('ORDER_BOOST_FEE');
    expect(result).toContain('ORDER_STRIPE_PROCESSING_FEE');
    expect(result).toContain('SUBSCRIPTION_CHARGE');
  });

  it('returns an array containing only SALES type for SALES group', async () => {
    const { getTypeGroupFilter } = await import('../finance-center-detail');
    const result = await getTypeGroupFilter('SALES');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('ORDER_PAYMENT_CAPTURED');
    // SALES group should NOT include fee types
    expect(result).not.toContain('ORDER_TF_FEE');
  });

  it('returns payout types for PAYOUTS group', async () => {
    const { getTypeGroupFilter } = await import('../finance-center-detail');
    const result = await getTypeGroupFilter('PAYOUTS');

    expect(result).toContain('PAYOUT_SENT');
    expect(result).toContain('PAYOUT_FAILED');
    expect(result).toContain('PAYOUT_REVERSED');
    expect(result).not.toContain('ORDER_TF_FEE');
  });

  it('returns refund types for REFUNDS group', async () => {
    const { getTypeGroupFilter } = await import('../finance-center-detail');
    const result = await getTypeGroupFilter('REFUNDS');

    expect(result).toContain('REFUND_FULL');
    expect(result).toContain('REFUND_PARTIAL');
    expect(result).toContain('REFUND_TF_REVERSAL');
    expect(result).not.toContain('PAYOUT_SENT');
  });

  it('does not include PAYOUT or FEE types in SALES group', async () => {
    const { getTypeGroupFilter } = await import('../finance-center-detail');
    const result = await getTypeGroupFilter('SALES');

    expect(result).not.toContain('PAYOUT_SENT');
    expect(result).not.toContain('SUBSCRIPTION_CHARGE');
  });
});

describe('getRecentTransactions — pagination and typeGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('calculates correct offset for page 2', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 50 }]))
      .mockReturnValueOnce(createChain([]));

    const { getRecentTransactions } = await import('../finance-center-detail');
    const result = await getRecentTransactions('user-test-001', { page: 2, pageSize: 20 });

    // page 2, pageSize 20 => offset 20
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(50);
  });

  it('applies typeGroup filter when type is not set', async () => {
    const now = new Date();
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 3 }]))
      .mockReturnValueOnce(createChain([
        {
          id: 'le-fee', type: 'ORDER_TF_FEE', amountCents: -1000,
          status: 'POSTED', orderId: 'ord-1', memo: null, postedAt: now, createdAt: now,
        },
      ]));

    const { getRecentTransactions } = await import('../finance-center-detail');
    const result = await getRecentTransactions('user-test-002', {
      page: 1,
      pageSize: 20,
      typeGroup: 'FEES',
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.type).toBe('ORDER_TF_FEE');
  });

  it('type filter takes precedence over typeGroup filter', async () => {
    const now = new Date();
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(createChain([
        {
          id: 'le-1', type: 'PAYOUT_SENT', amountCents: 5000,
          status: 'POSTED', orderId: null, memo: null, postedAt: now, createdAt: now,
        },
      ]));

    const { getRecentTransactions } = await import('../finance-center-detail');
    // type='PAYOUT_SENT' + typeGroup='FEES' — type wins
    const result = await getRecentTransactions('user-test-003', {
      page: 1,
      pageSize: 20,
      type: 'PAYOUT_SENT',
      typeGroup: 'FEES',
    });

    expect(result.transactions[0]?.type).toBe('PAYOUT_SENT');
  });

  it('returns all transactions when neither type nor typeGroup specified', async () => {
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 100 }]))
      .mockReturnValueOnce(createChain([]));

    const { getRecentTransactions } = await import('../finance-center-detail');
    const result = await getRecentTransactions('user-test-004', { page: 1, pageSize: 20 });

    expect(result.total).toBe(100);
    expect(result.transactions).toHaveLength(0);
  });

  it('maps all row fields to TransactionRow shape', async () => {
    const now = new Date();
    const posted = new Date(now.getTime() - 60000);
    mockDb.select
      .mockReturnValueOnce(createChain([{ total: 1 }]))
      .mockReturnValueOnce(createChain([
        {
          id: 'le-shape', type: 'MANUAL_CREDIT', amountCents: 2500,
          status: 'POSTED', orderId: null, memo: 'test memo', postedAt: posted, createdAt: now,
        },
      ]));

    const { getRecentTransactions } = await import('../finance-center-detail');
    const result = await getRecentTransactions('user-test-005', { page: 1, pageSize: 20 });

    const tx = result.transactions[0];
    expect(tx?.id).toBe('le-shape');
    expect(tx?.type).toBe('MANUAL_CREDIT');
    expect(tx?.amountCents).toBe(2500);
    expect(tx?.status).toBe('POSTED');
    expect(tx?.orderId).toBeNull();
    expect(tx?.memo).toBe('test memo');
    expect(tx?.postedAt).toBe(posted);
    expect(tx?.createdAt).toBe(now);
  });
});

describe('getMileageSummary — null row fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns zeros when DB returns empty array (no row)', async () => {
    mockDb.select.mockReturnValueOnce(createChain([]));

    const { getMileageSummary } = await import('../finance-center-detail');
    const result = await getMileageSummary('user-test-001');

    expect(result.totalMiles).toBe(0);
    expect(result.totalDeductionCents).toBe(0);
    expect(result.tripCount).toBe(0);
  });
});
