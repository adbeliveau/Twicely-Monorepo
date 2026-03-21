/**
 * Tests for affiliate-payout-service.ts — executeAffiliatePayouts()
 * Part 2: Happy path — successful Stripe transfers, DB mutations, ledger entries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const {
  mockSelect, mockUpdate, mockInsert, mockTxSelect, mockTxUpdate, mockTxInsert,
  mockTransaction, mockTransfersCreate, mockCreateId, mockGetPlatformSetting,
} = vi.hoisted(() => {
  const txSelect = vi.fn();
  const txUpdate = vi.fn();
  const txInsert = vi.fn();
  const txn = vi.fn().mockImplementation(
    async (cb: (tx: { select: typeof txSelect; update: typeof txUpdate; insert: typeof txInsert }) => Promise<unknown>) => {
      return cb({ select: txSelect, update: txUpdate, insert: txInsert });
    }
  );
  return {
    mockSelect: vi.fn(), mockUpdate: vi.fn(), mockInsert: vi.fn(),
    mockTxSelect: txSelect, mockTxUpdate: txUpdate, mockTxInsert: txInsert,
    mockTransaction: txn,
    mockTransfersCreate: vi.fn(),
    mockCreateId: vi.fn().mockReturnValue('payout-test-cuid'),
    mockGetPlatformSetting: vi.fn().mockResolvedValue(2500),
  };
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: mockSelect, update: mockUpdate, insert: mockInsert, transaction: mockTransaction },
}));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn() }));
vi.mock('@twicely/db/schema', () => ({
  affiliate: {
    id: 'id', status: 'status', availableBalanceCents: 'available_balance_cents',
    payoutMethod: 'payout_method', taxInfoProvided: 'tax_info_provided',
    totalPaidCents: 'total_paid_cents', updatedAt: 'updated_at',
  },
  affiliateCommission: { id: 'id', affiliateId: 'affiliate_id', status: 'status', paidAt: 'paid_at' },
  affiliatePayout: {
    id: 'id', affiliateId: 'affiliate_id', amountCents: 'amount_cents', method: 'method',
    status: 'status', periodStart: 'period_start', periodEnd: 'period_end',
    externalPayoutId: 'external_payout_id', completedAt: 'completed_at', failedReason: 'failed_reason',
  },
  ledgerEntry: {
    type: 'type', status: 'status', amountCents: 'amount_cents', currency: 'currency',
    userId: 'user_id', stripeTransferId: 'stripe_transfer_id', postedAt: 'posted_at',
    memo: 'memo', reasonCode: 'reason_code',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ type: 'gte', a, b })),
  isNotNull: vi.fn((col: unknown) => ({ type: 'isNotNull', col })),
  sql: vi.fn((s: unknown) => ({ type: 'sql', s })),
}));
vi.mock('@/lib/queries/platform-settings', () => ({ getPlatformSetting: mockGetPlatformSetting }));
vi.mock('@twicely/stripe/server', () => ({ stripe: { transfers: { create: mockTransfersCreate } } }));
vi.mock('@paralleldrive/cuid2', () => ({ createId: mockCreateId }));
vi.mock('@twicely/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { executeAffiliatePayouts } from '../affiliate-payout-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a tx.select() chain that supports all three terminal patterns:
 *   await .from().where()               -> rows  (thenable where result)
 *   await .from().where().limit(n)      -> rows
 *   await .from().where().for(x).limit(n) -> rows
 */
function makeTxSelectChain(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const forFn = vi.fn().mockReturnValue({ limit: limitFn });
  // whereResult must be directly awaitable AND support .limit() and .for()
  const whereResult = Object.assign(Promise.resolve(rows), {
    limit: limitFn,
    for: forFn,
  });
  const whereFn = vi.fn().mockReturnValue(whereResult);
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  return { from: fromFn };
}

function restoreMocks() {
  mockTransaction.mockImplementation(
    async (cb: (tx: { select: typeof mockTxSelect; update: typeof mockTxUpdate; insert: typeof mockTxInsert }) => Promise<unknown>) => {
      return cb({ select: mockTxSelect, update: mockTxUpdate, insert: mockTxInsert });
    }
  );
  mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
  mockCreateId.mockReturnValue('payout-test-cuid');
  mockGetPlatformSetting.mockResolvedValue(2500);
}

function makeOuterSelectChain(rows: unknown[]) {
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }) };
}

function makeUpdateSetWhereChain() {
  const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  return { setMock, chain: { set: setMock } };
}

function makeAffiliate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'aff-test-001', userId: 'user-test-001', status: 'ACTIVE',
    availableBalanceCents: 5000, payoutMethod: 'stripe_connect', taxInfoProvided: true,
    stripeConnectAccountId: 'acct_test_001', totalPaidCents: 0, ...overrides,
  };
}

/**
 * Sets up tx.select() to return the three in-transaction selects in order:
 *   1. locked affiliate (for-update)
 *   2. idempotency check — existing PROCESSING payout (empty = none)
 *   3. payable commissions
 */
function setupTxSelects(lockedAff: unknown, existingPayout: unknown[], commissions: unknown[]) {
  mockTxSelect
    .mockReturnValueOnce(makeTxSelectChain([lockedAff]) as never)
    .mockReturnValueOnce(makeTxSelectChain(existingPayout) as never)
    .mockReturnValueOnce(makeTxSelectChain(commissions) as never);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('executeAffiliatePayouts — happy path', () => {
  beforeEach(() => { vi.resetAllMocks(); restoreMocks(); });

  it('creates a Stripe transfer for an eligible affiliate', async () => {
    const aff = makeAffiliate({ availableBalanceCents: 5000 });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    setupTxSelects(aff, [], [{ id: 'comm-test-001' }]);
    mockTxUpdate.mockReturnValue(makeUpdateSetWhereChain().chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_test_001' });

    const result = await executeAffiliatePayouts();

    expect(mockTransfersCreate).toHaveBeenCalledOnce();
    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000, currency: 'usd', destination: 'acct_test_001' })
    );
    expect(result.payoutCount).toBe(1);
    expect(result.totalPaidCents).toBe(5000);
  });

  it('marks payout COMPLETED after successful Stripe transfer (via tx.update)', async () => {
    const aff = makeAffiliate({ availableBalanceCents: 5000 });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    setupTxSelects(aff, [], []);
    const { setMock, chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_test_003' });

    await executeAffiliatePayouts();

    // tx.update call[0]: affiliatePayout → COMPLETED
    const completedArg = setMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(completedArg['status']).toBe('COMPLETED');
    expect(completedArg['externalPayoutId']).toBe('tr_test_003');
  });

  it('zeroes availableBalanceCents and increments totalPaidCents (via tx.update)', async () => {
    const aff = makeAffiliate({ availableBalanceCents: 5000 });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    // No commissions — so tx.update order is: [0] payout COMPLETED, [1] affiliate balance
    setupTxSelects(aff, [], []);
    const { setMock, chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_test_004' });

    await executeAffiliatePayouts();

    // tx.update call[1]: affiliate balance zero (no commissions, so index 1)
    const balanceArg = setMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(balanceArg['availableBalanceCents']).toBe(0);
    expect(balanceArg['totalPaidCents']).toBeDefined();
  });

  it('inserts ledger entry with AFFILIATE_COMMISSION_PAYOUT type via tx.insert', async () => {
    const aff = makeAffiliate({ availableBalanceCents: 5000 });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    setupTxSelects(aff, [], []);
    const txInsertValuesMock = vi.fn().mockResolvedValue(undefined);
    // tx.insert is called twice: [0] affiliatePayout PROCESSING, [1] ledgerEntry
    mockTxInsert.mockReturnValue({ values: txInsertValuesMock } as never);
    mockTxUpdate.mockReturnValue(makeUpdateSetWhereChain().chain as never);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_test_005' });

    await executeAffiliatePayouts();

    // tx.insert call[1] is the ledger entry
    const ledgerArg = txInsertValuesMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(ledgerArg['type']).toBe('AFFILIATE_COMMISSION_PAYOUT');
    expect(ledgerArg['userId']).toBeNull();
    expect(ledgerArg['amountCents']).toBe(-5000);
    expect(ledgerArg['status']).toBe('POSTED');
  });

  it('marks commissions PAID (via tx.update) when commissionIds is non-empty', async () => {
    const aff = makeAffiliate({ availableBalanceCents: 5000 });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    // Two commissions — tx.update order: [0] payout COMPLETED, [1] commissions PAID, [2] affiliate balance
    setupTxSelects(aff, [], [{ id: 'comm-001' }, { id: 'comm-002' }]);
    const { setMock, chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_test_006' });

    await executeAffiliatePayouts();

    // tx.update call[1]: affiliateCommission → PAID
    const commissionArg = setMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(commissionArg['status']).toBe('PAID');
    expect(commissionArg['paidAt']).toBeDefined();
  });

  it('includes affiliateId and payoutId in Stripe transfer metadata', async () => {
    const aff = makeAffiliate();
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    setupTxSelects(aff, [], []);
    mockTxUpdate.mockReturnValue(makeUpdateSetWhereChain().chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate.mockResolvedValue({ id: 'tr_test_007' });

    await executeAffiliatePayouts();

    const transferArgs = mockTransfersCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    const meta = transferArgs['metadata'] as Record<string, string>;
    expect(meta['affiliateId']).toBe('aff-test-001');
    expect(meta['payoutId']).toBe('payout-test-cuid');
  });
});
