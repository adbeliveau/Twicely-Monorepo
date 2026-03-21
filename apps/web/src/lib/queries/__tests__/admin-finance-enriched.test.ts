/**
 * Admin Finance Enriched Queries Tests (I3/I4)
 * Covers getPayoutDetail, getFinanceOverviewEnriched, enhanced getLedgerEntries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPayoutDetail,
  getFinanceOverviewEnriched,
  getLedgerEntries,
} from '../admin-finance';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  order: { totalCents: 'total_cents', createdAt: 'created_at' },
  ledgerEntry: {
    id: 'id',
    type: 'type',
    amountCents: 'amount_cents',
    status: 'status',
    userId: 'user_id',
    orderId: 'order_id',
    stripeEventId: 'stripe_event_id',
    memo: 'memo',
    createdAt: 'created_at',
  },
  payout: {
    id: 'id',
    userId: 'user_id',
    batchId: 'batch_id',
    status: 'status',
    amountCents: 'amount_cents',
    stripeTransferId: 'stripe_transfer_id',
    stripePayoutId: 'stripe_payout_id',
    failureReason: 'failure_reason',
    isOnDemand: 'is_on_demand',
    createdAt: 'created_at',
    completedAt: 'completed_at',
  },
  payoutBatch: { id: 'id', status: 'status', totalSellers: 'total_sellers', successCount: 'success_count', failureCount: 'failure_count' },
  user: { id: 'id', name: 'name', email: 'email' },
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
  ilike: (_col: unknown, _pat: unknown) => ({ type: 'ilike' }),
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

function makePayout(overrides: Partial<{ id: string; batchId: string | null }> = {}) {
  return {
    id: 'payout-1',
    userId: 'user-1',
    batchId: null,
    status: 'COMPLETED',
    amountCents: 10000,
    stripeTransferId: 'tr_abc123',
    stripePayoutId: 'po_abc123',
    failureReason: null,
    isOnDemand: false,
    createdAt: NOW,
    completedAt: NOW,
    ...overrides,
  };
}

// ─── getPayoutDetail ──────────────────────────────────────────────────────────

describe('getPayoutDetail', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns full payout with user info and related ledger entries', async () => {
    const payoutRow = makePayout();

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([payoutRow]))                            // payout
      .mockReturnValueOnce(makeSelectChain([{ id: 'user-1', name: 'Alice', email: 'alice@test.com' }])) // user
      .mockReturnValueOnce(makeSelectChain([]))                                     // batch (null batchId)
      .mockReturnValueOnce(makeSelectChain([{ id: 'le-1', type: 'PAYOUT_SENT', amountCents: -10000 }])); // ledger

    const result = await getPayoutDetail('payout-1');

    expect(result).not.toBeNull();
    expect(result?.payout.id).toBe('payout-1');
    expect(result?.seller.name).toBe('Alice');
    expect(result?.batch).toBeNull();
  });

  it('returns null for non-existent payout id', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const result = await getPayoutDetail('nonexistent');

    expect(result).toBeNull();
  });

  it('includes batch info when batchId exists', async () => {
    const payoutRow = makePayout({ batchId: 'batch-1' });
    const batchRow = { id: 'batch-1', status: 'COMPLETED', totalSellers: 10, successCount: 9, failureCount: 1 };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([payoutRow]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'user-1', name: 'Bob', email: 'bob@test.com' }]))
      .mockReturnValueOnce(makeSelectChain([batchRow]))
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await getPayoutDetail('payout-1');

    expect(result?.batch).not.toBeNull();
    expect(result?.batch?.id).toBe('batch-1');
  });
});

// ─── getFinanceOverviewEnriched ───────────────────────────────────────────────

describe('getFinanceOverviewEnriched', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns revenue breakdown by entry type', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([
        { type: 'ORDER_TF_FEE', total: 5000 },
        { type: 'SUBSCRIPTION_CHARGE', total: 2000 },
      ]))
      .mockReturnValueOnce(makeSelectChain([{ total: 500 }]))    // stripe fees
      .mockReturnValueOnce(makeSelectChain([{ total: 1000 }]))   // pending
      .mockReturnValueOnce(makeSelectChain([{ total: 3 }]));     // chargeback count

    const result = await getFinanceOverviewEnriched(30);

    const tfRow = result.revenueBreakdown.find((r) => r.type === 'ORDER_TF_FEE');
    expect(tfRow?.amountCents).toBe(5000);
    expect(tfRow?.label).toBe('Transaction Fees');
    expect(result.stripeProcessingFeesCents).toBe(500);
    expect(result.chargebackCount30d).toBe(3);
  });

  it('returns zeros when no revenue exists', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]));

    const result = await getFinanceOverviewEnriched(30);

    expect(result.revenueBreakdown.every((r) => r.amountCents === 0)).toBe(true);
    expect(result.stripeProcessingFeesCents).toBe(0);
    expect(result.chargebackCount30d).toBe(0);
  });
});

// ─── getLedgerEntries (enhanced) ─────────────────────────────────────────────

describe('getLedgerEntries (enhanced)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('filters by status correctly', async () => {
    const entry = { id: 'le-1', type: 'ORDER_TF_FEE', amountCents: 500, status: 'POSTED', userId: null, createdAt: NOW };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([entry]))
      .mockReturnValueOnce(makeSelectChain([])); // users

    const result = await getLedgerEntries({ page: 1, pageSize: 50, status: 'POSTED' });

    expect(result.total).toBe(1);
    expect(result.entries[0]?.status).toBe('POSTED');
  });

  it('filters by date range correctly', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await getLedgerEntries({
      page: 1,
      pageSize: 50,
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-01-31'),
    });

    expect(result.total).toBe(0);
    expect(result.entries).toHaveLength(0);
  });

  it('filters by orderId', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await getLedgerEntries({ page: 1, pageSize: 50, orderId: 'order-1' });

    expect(result.entries).toHaveLength(0);
  });

  it('resolves user names for entries with userId', async () => {
    const entry = { id: 'le-1', type: 'ORDER_TF_FEE', amountCents: 500, status: 'POSTED', userId: 'user-1', createdAt: NOW };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([entry]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'user-1', name: 'Alice', email: 'alice@test.com' }]));

    const result = await getLedgerEntries({ page: 1, pageSize: 50 });

    expect(result.entries[0]?.userName).toBe('Alice');
    expect(result.entries[0]?.userEmail).toBe('alice@test.com');
  });
});
