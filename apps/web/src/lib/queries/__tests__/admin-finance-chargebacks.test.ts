/**
 * Admin Chargeback Queries Tests (I3)
 * Covers getChargebackList, getChargebackStats, getChargebackDetail
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getChargebackList,
  getChargebackStats,
  getChargebackDetail,
} from '../admin-finance-chargebacks';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: {
    id: 'id',
    type: 'type',
    amountCents: 'amount_cents',
    status: 'status',
    userId: 'user_id',
    orderId: 'order_id',
    stripeDisputeId: 'stripe_dispute_id',
    reversalOfEntryId: 'reversal_of_entry_id',
    createdAt: 'created_at',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  gte: (_col: unknown, _val: unknown) => ({ type: 'gte' }),
  lte: (_col: unknown, _val: unknown) => ({ type: 'lte' }),
  desc: (_col: unknown) => ({ type: 'desc' }),
  count: () => ({ type: 'count' }),
  inArray: (_col: unknown, _arr: unknown) => ({ type: 'inArray' }),
  sql: Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: 'sql' }),
    { append: vi.fn() }
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'innerJoin', 'leftJoin'].forEach((key) => {
    chain[key] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

function makeEntry(overrides: Partial<{
  id: string;
  type: string;
  amountCents: number;
  userId: string | null;
  orderId: string | null;
  stripeDisputeId: string | null;
  createdAt: Date;
}> = {}) {
  return {
    id: 'entry-1',
    type: 'CHARGEBACK_DEBIT',
    amountCents: -5000,
    userId: 'user-1',
    orderId: 'order-1',
    stripeDisputeId: 'disp-1',
    createdAt: NOW,
    status: 'POSTED',
    memo: null,
    ...overrides,
  };
}

// ─── getChargebackStats ───────────────────────────────────────────────────────

describe('getChargebackStats', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns correct counts and amounts for recent chargebacks', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ total: 3 }]))   // debit count
      .mockReturnValueOnce(makeSelectChain([{ total: 15000 }])) // debit amount
      .mockReturnValueOnce(makeSelectChain([{ total: 1 }]));  // reversal count

    const result = await getChargebackStats(30);

    expect(result.totalCount).toBe(3);
    expect(result.totalAmountCents).toBe(15000);
    expect(result.reversalRate).toBe(33.33);
    expect(result.avgAmountCents).toBe(5000);
  });

  it('returns zero values when no chargebacks exist', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]));

    const result = await getChargebackStats(30);

    expect(result.totalCount).toBe(0);
    expect(result.totalAmountCents).toBe(0);
    expect(result.reversalRate).toBe(0);
    expect(result.avgAmountCents).toBe(0);
  });
});

// ─── getChargebackList ────────────────────────────────────────────────────────

describe('getChargebackList', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns grouped chargebacks by stripeDisputeId', async () => {
    const entries = [
      makeEntry({ type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-1' }),
      makeEntry({ id: 'entry-2', type: 'CHARGEBACK_FEE', stripeDisputeId: 'disp-1' }),
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const { chargebacks } = await getChargebackList({ page: 1, pageSize: 50 });

    expect(chargebacks).toHaveLength(1);
    expect(chargebacks[0]?.stripeDisputeId).toBe('disp-1');
  });

  it('returns empty array when no chargebacks exist', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { chargebacks, total } = await getChargebackList({ page: 1, pageSize: 50 });

    expect(chargebacks).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('applies status filter won correctly', async () => {
    const entries = [
      makeEntry({ type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-1' }),
      makeEntry({ id: 'entry-r', type: 'CHARGEBACK_REVERSAL', stripeDisputeId: 'disp-1' }),
      makeEntry({ id: 'entry-3', type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-2' }),
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const { chargebacks } = await getChargebackList({ page: 1, pageSize: 50, status: 'won' });

    expect(chargebacks).toHaveLength(1);
    expect(chargebacks[0]?.status).toBe('Won');
    expect(chargebacks[0]?.stripeDisputeId).toBe('disp-1');
  });

  it('applies status filter open correctly', async () => {
    const entries = [
      makeEntry({ type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-1' }),
      makeEntry({ id: 'entry-r', type: 'CHARGEBACK_REVERSAL', stripeDisputeId: 'disp-1' }),
      makeEntry({ id: 'entry-3', type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-2' }),
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const { chargebacks } = await getChargebackList({ page: 1, pageSize: 50, status: 'open' });

    expect(chargebacks).toHaveLength(1);
    expect(chargebacks[0]?.status).toBe('Open');
    expect(chargebacks[0]?.stripeDisputeId).toBe('disp-2');
  });

  it('applies date range filter via query conditions', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const dateFrom = new Date('2026-01-01');
    const dateTo = new Date('2026-01-31');
    const { chargebacks } = await getChargebackList({ page: 1, pageSize: 50, dateFrom, dateTo });

    expect(chargebacks).toHaveLength(0);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('correctly identifies dispute as Won when CHARGEBACK_REVERSAL exists', async () => {
    const entries = [
      makeEntry({ type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-won' }),
      makeEntry({ id: 'r1', type: 'CHARGEBACK_REVERSAL', stripeDisputeId: 'disp-won' }),
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const { chargebacks } = await getChargebackList({ page: 1, pageSize: 50 });

    expect(chargebacks[0]?.status).toBe('Won');
  });

  it('correctly identifies dispute as Open when no CHARGEBACK_REVERSAL', async () => {
    const entries = [makeEntry({ type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-open' })];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const { chargebacks } = await getChargebackList({ page: 1, pageSize: 50 });

    expect(chargebacks[0]?.status).toBe('Open');
  });
});

// ─── getChargebackDetail ──────────────────────────────────────────────────────

describe('getChargebackDetail', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns all entries for a given stripeDisputeId', async () => {
    const entries = [
      makeEntry({ type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-1' }),
      makeEntry({ id: 'entry-2', type: 'CHARGEBACK_FEE', stripeDisputeId: 'disp-1' }),
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const result = await getChargebackDetail('disp-1');

    expect(result).not.toBeNull();
    expect(result?.entries).toHaveLength(2);
    expect(result?.stripeDisputeId).toBe('disp-1');
  });

  it('returns null for non-existent disputeId', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const result = await getChargebackDetail('nonexistent');

    expect(result).toBeNull();
  });

  it('marks status as Won when CHARGEBACK_REVERSAL entry exists', async () => {
    const entries = [
      makeEntry({ type: 'CHARGEBACK_DEBIT', stripeDisputeId: 'disp-1' }),
      makeEntry({ id: 'r1', type: 'CHARGEBACK_REVERSAL', stripeDisputeId: 'disp-1' }),
    ];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const result = await getChargebackDetail('disp-1');

    expect(result?.status).toBe('Won');
  });

  it('includes correct totalDebitCents from CHARGEBACK_DEBIT entry', async () => {
    const entries = [makeEntry({ type: 'CHARGEBACK_DEBIT', amountCents: -7500 })];
    mockDbSelect.mockReturnValueOnce(makeSelectChain(entries));

    const result = await getChargebackDetail('disp-1');

    expect(result?.totalDebitCents).toBe(7500);
  });
});
