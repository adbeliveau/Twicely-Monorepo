/**
 * Tests for commission-graduation.ts — graduateCommissions()
 * Moves PENDING commissions past their holdExpiresAt to PAYABLE status
 * and updates affiliate balance columns.
 *
 * Implementation wraps each affiliate batch in db.transaction() —
 * mockTransaction must execute the callback with a tx object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const { mockSelect, mockTxUpdate, mockTransaction, mockGetPlatformSetting } = vi.hoisted(() => {
  const txUpdate = vi.fn();
  const txn = vi.fn().mockImplementation(
    async (cb: (tx: { update: typeof txUpdate }) => Promise<void>) => {
      await cb({ update: txUpdate });
    }
  );
  return {
    mockSelect: vi.fn(),
    mockTxUpdate: txUpdate,
    mockTransaction: txn,
    mockGetPlatformSetting: vi.fn(),
  };
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: mockSelect, transaction: mockTransaction },
}));

vi.mock('@twicely/db/schema', () => ({
  affiliate: {
    id: 'id',
    pendingBalanceCents: 'pending_balance_cents',
    availableBalanceCents: 'available_balance_cents',
    updatedAt: 'updated_at',
  },
  affiliateCommission: {
    id: 'id',
    affiliateId: 'affiliate_id',
    commissionCents: 'commission_cents',
    status: 'status',
    holdExpiresAt: 'hold_expires_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  lte: vi.fn((a: unknown, b: unknown) => ({ type: 'lte', a, b })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
  sql: vi.fn((s: unknown) => ({ type: 'sql', s })),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { graduateCommissions } from '../commission-graduation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectLimitChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeUpdateSetWhereChain() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  return { setMock, chain: { set: setMock } };
}

/** Restores the default transaction implementation after vi.clearAllMocks(). */
function restoreTransaction() {
  mockTransaction.mockImplementation(
    async (cb: (tx: { update: typeof mockTxUpdate }) => Promise<void>) => {
      await cb({ update: mockTxUpdate });
    }
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const AFF_ID = 'aff-test-001';

function makeCommission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comm-test-001',
    affiliateId: AFF_ID,
    commissionCents: 500,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('graduateCommissions — affiliate program disabled', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreTransaction();
  });

  it('returns zero counts when affiliate program is disabled', async () => {
    mockGetPlatformSetting.mockResolvedValue(false);

    const result = await graduateCommissions();

    expect(result).toEqual({ graduatedCount: 0, totalCents: 0 });
    expect(mockSelect).not.toHaveBeenCalled();
  });
});

describe('graduateCommissions — no eligible commissions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreTransaction();
    mockGetPlatformSetting.mockResolvedValue(true);
  });

  it('returns zero counts when no PENDING commissions are past hold period', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([]) as never);

    const result = await graduateCommissions();

    expect(result).toEqual({ graduatedCount: 0, totalCents: 0 });
  });

  it('does not call db.transaction when no commissions are eligible', async () => {
    mockSelect.mockReturnValue(makeSelectLimitChain([]) as never);

    await graduateCommissions();

    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe('graduateCommissions — happy path', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreTransaction();
    mockGetPlatformSetting.mockResolvedValue(true);
  });

  it('graduates a single PENDING commission — returns correct counts', async () => {
    const { chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([makeCommission({ commissionCents: 500 })]) as never)
      .mockReturnValueOnce(makeSelectLimitChain([]) as never);

    const result = await graduateCommissions();

    expect(result.graduatedCount).toBe(1);
    expect(result.totalCents).toBe(500);
  });

  it('calls tx.update twice per affiliate inside transaction: status + balance', async () => {
    const { chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([makeCommission()]) as never)
      .mockReturnValueOnce(makeSelectLimitChain([]) as never);

    await graduateCommissions();

    expect(mockTxUpdate).toHaveBeenCalledTimes(2);
  });

  it('sets commission status to PAYABLE in first tx.update', async () => {
    const { setMock, chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([makeCommission()]) as never)
      .mockReturnValueOnce(makeSelectLimitChain([]) as never);

    await graduateCommissions();

    const firstSetArg = setMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstSetArg['status']).toBe('PAYABLE');
  });

  it('second tx.update includes pendingBalanceCents and availableBalanceCents', async () => {
    const { setMock, chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain([makeCommission({ commissionCents: 1200 })]) as never)
      .mockReturnValueOnce(makeSelectLimitChain([]) as never);

    await graduateCommissions();

    const affiliateSetArg = setMock.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(affiliateSetArg['pendingBalanceCents']).toBeDefined();
    expect(affiliateSetArg['availableBalanceCents']).toBeDefined();
  });

  it('groups two commissions for same affiliate into one balance update', async () => {
    const { chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    const commissions = [
      makeCommission({ id: 'comm-001', commissionCents: 300 }),
      makeCommission({ id: 'comm-002', commissionCents: 200 }),
    ];
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain(commissions) as never)
      .mockReturnValueOnce(makeSelectLimitChain([]) as never);

    const result = await graduateCommissions();

    expect(result.graduatedCount).toBe(2);
    expect(result.totalCents).toBe(500);
    // 1 commission status update + 1 balance update = 2 tx.update calls
    expect(mockTxUpdate).toHaveBeenCalledTimes(2);
  });

  it('processes commissions from two different affiliates — 4 tx.update calls total', async () => {
    const { chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    const commissions = [
      { id: 'comm-aff1', affiliateId: 'aff-test-001', commissionCents: 400 },
      { id: 'comm-aff2', affiliateId: 'aff-test-002', commissionCents: 600 },
    ];
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain(commissions) as never)
      .mockReturnValueOnce(makeSelectLimitChain([]) as never);

    const result = await graduateCommissions();

    expect(result.graduatedCount).toBe(2);
    expect(result.totalCents).toBe(1000);
    // 2 affiliates × (1 commission update + 1 balance update) = 4
    expect(mockTxUpdate).toHaveBeenCalledTimes(4);
  });
});

describe('graduateCommissions — error resilience', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    restoreTransaction();
    mockGetPlatformSetting.mockResolvedValue(true);
  });

  it('continues when transaction throws for one affiliate', async () => {
    // First affiliate's transaction throws; second succeeds
    const { chain } = makeUpdateSetWhereChain();
    mockTxUpdate.mockReturnValue(chain as never);
    mockTransaction
      .mockRejectedValueOnce(new Error('Transaction failed'))
      .mockImplementation(
        async (cb: (tx: { update: typeof mockTxUpdate }) => Promise<void>) => {
          await cb({ update: mockTxUpdate });
        }
      );

    const commissions = [
      { id: 'comm-aff1', affiliateId: 'aff-test-001', commissionCents: 400 },
      { id: 'comm-aff2', affiliateId: 'aff-test-002', commissionCents: 600 },
    ];
    mockSelect
      .mockReturnValueOnce(makeSelectLimitChain(commissions) as never)
      .mockReturnValueOnce(makeSelectLimitChain([]) as never);

    // Should not throw — error is caught and logged per affiliate
    await expect(graduateCommissions()).resolves.toBeDefined();
  });
});
