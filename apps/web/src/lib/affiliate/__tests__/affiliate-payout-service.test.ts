/**
 * Tests for affiliate-payout-service.ts — executeAffiliatePayouts()
 * Part 1: No eligible affiliates, eligibility skips, and Stripe failure handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const {
  mockSelect,
  mockUpdate,
  mockInsert,
  mockTxSelect,
  mockTxUpdate,
  mockTxInsert,
  mockTransaction,
  mockTransfersCreate,
  mockCreateId,
  mockGetPlatformSetting,
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
    mockSelect: vi.fn(),
    mockUpdate: vi.fn(),
    mockInsert: vi.fn(),
    mockTxSelect: txSelect,
    mockTxUpdate: txUpdate,
    mockTxInsert: txInsert,
    mockTransaction: txn,
    mockTransfersCreate: vi.fn(),
    mockCreateId: vi.fn().mockReturnValue('payout-test-cuid'),
    mockGetPlatformSetting: vi.fn().mockResolvedValue(2500),
  };
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
  },
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

describe('executeAffiliatePayouts — no eligible affiliates', () => {
  beforeEach(() => { vi.resetAllMocks(); restoreMocks(); });

  it('returns zero counts when no eligible affiliates exist', async () => {
    mockSelect.mockReturnValue(makeOuterSelectChain([]) as never);
    const result = await executeAffiliatePayouts();
    expect(result).toEqual({ payoutCount: 0, totalPaidCents: 0, failedCount: 0 });
  });

  it('does not call Stripe when no eligible affiliates exist', async () => {
    mockSelect.mockReturnValue(makeOuterSelectChain([]) as never);
    await executeAffiliatePayouts();
    expect(mockTransfersCreate).not.toHaveBeenCalled();
  });
});

describe('executeAffiliatePayouts — eligibility skips', () => {
  beforeEach(() => { vi.resetAllMocks(); restoreMocks(); });

  it('skips PayPal affiliates (deferred to G5)', async () => {
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([makeAffiliate({ payoutMethod: 'paypal' })]) as never);
    const result = await executeAffiliatePayouts();
    expect(mockTransfersCreate).not.toHaveBeenCalled();
    expect(result.payoutCount).toBe(0);
  });

  it('skips affiliates with unknown payout method', async () => {
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([makeAffiliate({ payoutMethod: 'venmo' })]) as never);
    const result = await executeAffiliatePayouts();
    expect(mockTransfersCreate).not.toHaveBeenCalled();
    expect(result.payoutCount).toBe(0);
  });

  it('skips stripe_connect affiliates with no stripeConnectAccountId', async () => {
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([makeAffiliate({ stripeConnectAccountId: null })]) as never);
    const result = await executeAffiliatePayouts();
    expect(mockTransfersCreate).not.toHaveBeenCalled();
    expect(result.payoutCount).toBe(0);
  });
});

describe('executeAffiliatePayouts — Stripe failure handling', () => {
  beforeEach(() => { vi.resetAllMocks(); restoreMocks(); });

  it('increments failedCount when Stripe transfer throws', async () => {
    const aff = makeAffiliate({ availableBalanceCents: 5000 });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    setupTxSelects(aff, [], []);
    mockTxUpdate.mockReturnValue(makeUpdateSetWhereChain().chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate.mockRejectedValue(new Error('Stripe error: insufficient funds'));

    const result = await executeAffiliatePayouts();

    expect(result.failedCount).toBe(1);
    expect(result.payoutCount).toBe(0);
  });

  it('does not count a failed payout as successful', async () => {
    const aff = makeAffiliate({ availableBalanceCents: 5000 });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff]) as never);
    setupTxSelects(aff, [], []);
    mockTxUpdate.mockReturnValue(makeUpdateSetWhereChain().chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate.mockRejectedValue(new Error('Stripe error: insufficient funds'));

    const result = await executeAffiliatePayouts();

    expect(result.totalPaidCents).toBe(0);
  });

  it('continues to next affiliate after one Stripe failure', async () => {
    const aff1 = makeAffiliate({ id: 'aff-test-001', stripeConnectAccountId: 'acct_001' });
    const aff2 = makeAffiliate({ id: 'aff-test-002', stripeConnectAccountId: 'acct_002' });
    mockSelect.mockReturnValueOnce(makeOuterSelectChain([aff1, aff2]) as never);
    // tx.select calls for aff1 (3 selects): locked, idempotency, commissions
    // tx.select calls for aff2 (3 selects): locked, idempotency, commissions
    mockTxSelect
      .mockReturnValueOnce(makeTxSelectChain([aff1]) as never)
      .mockReturnValueOnce(makeTxSelectChain([]) as never)
      .mockReturnValueOnce(makeTxSelectChain([]) as never)
      .mockReturnValueOnce(makeTxSelectChain([aff2]) as never)
      .mockReturnValueOnce(makeTxSelectChain([]) as never)
      .mockReturnValueOnce(makeTxSelectChain([]) as never);
    mockTxUpdate.mockReturnValue(makeUpdateSetWhereChain().chain as never);
    mockTxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
    mockTransfersCreate
      .mockRejectedValueOnce(new Error('Stripe error for aff1'))
      .mockResolvedValueOnce({ id: 'tr_test_008' });

    const result = await executeAffiliatePayouts();

    expect(result.failedCount).toBe(1);
    expect(result.payoutCount).toBe(1);
  });
});
