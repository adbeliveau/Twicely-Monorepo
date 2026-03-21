/**
 * Tests for commission-reversal.ts — reverseAffiliateCommission()
 * Reverses PENDING or PAYABLE commissions; no clawback on PAID commissions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock fns ──────────────────────────────────────────────────────────

const { mockSelect, mockUpdate, mockTransaction } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}));

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@twicely/db', () => {
  mockTransaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<void>) => {
    await cb({ select: mockSelect, update: mockUpdate } as Record<string, unknown>);
  });
  return { db: { select: mockSelect, update: mockUpdate, transaction: mockTransaction } };
});

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
    status: 'status',
    commissionCents: 'commission_cents',
    invoiceId: 'invoice_id',
    reversedAt: 'reversed_at',
    reversalReason: 'reversal_reason',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
  sql: vi.fn((s: unknown) => ({ type: 'sql', s })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { reverseAffiliateCommission } from '../commission-reversal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INVOICE_ID = 'inv-test-001';
const AFF_ID = 'aff-test-001';
const COMM_ID = 'comm-test-001';

function makeCommission(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: COMM_ID,
    affiliateId: AFF_ID,
    status,
    commissionCents: 800,
    ...overrides,
  };
}

function setupTransactionMock() {
  mockTransaction.mockImplementation(async (cb: (tx: Record<string, unknown>) => Promise<void>) => {
    await cb({ select: mockSelect, update: mockUpdate } as Record<string, unknown>);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('reverseAffiliateCommission — no reversible commissions', () => {
  beforeEach(() => { vi.resetAllMocks(); setupTransactionMock(); });

  it('returns without calling db.update when no commission found for invoiceId', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Buyer refund');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not throw when no commission found', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    await expect(reverseAffiliateCommission(INVOICE_ID, 'Buyer refund')).resolves.toBeUndefined();
  });
});

describe('reverseAffiliateCommission — PENDING commission', () => {
  beforeEach(() => { vi.resetAllMocks(); setupTransactionMock(); });

  it('sets commission status to REVERSED', async () => {
    const commission = makeCommission('PENDING');
    mockSelect.mockReturnValue(makeSelectChain([commission]) as never);
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Buyer refund requested');

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('REVERSED');
  });

  it('sets reversedAt and reversalReason on the commission', async () => {
    const commission = makeCommission('PENDING');
    mockSelect.mockReturnValue(makeSelectChain([commission]) as never);
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Buyer refund requested');

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['reversedAt']).toBeDefined();
    expect(setArg['reversalReason']).toBe('Buyer refund requested');
  });

  it('decrements pendingBalanceCents (not availableBalanceCents) for PENDING commission', async () => {
    const commission = makeCommission('PENDING', { commissionCents: 800 });
    mockSelect.mockReturnValue(makeSelectChain([commission]) as never);
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Chargeback');

    // 2 updates: commission status + affiliate balance
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const affiliateSetArg = updateChain.set.mock.calls[1]?.[0] as Record<string, unknown>;
    // pendingBalanceCents is decremented via SQL expression
    expect(affiliateSetArg['pendingBalanceCents']).toBeDefined();
    // availableBalanceCents should NOT be in this update
    expect(affiliateSetArg['availableBalanceCents']).toBeUndefined();
  });
});

describe('reverseAffiliateCommission — PAYABLE commission', () => {
  beforeEach(() => { vi.resetAllMocks(); setupTransactionMock(); });

  it('sets commission status to REVERSED', async () => {
    const commission = makeCommission('PAYABLE');
    mockSelect.mockReturnValue(makeSelectChain([commission]) as never);
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Chargeback received');

    const setArg = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg['status']).toBe('REVERSED');
  });

  it('decrements availableBalanceCents (not pendingBalanceCents) for PAYABLE commission', async () => {
    const commission = makeCommission('PAYABLE', { commissionCents: 1200 });
    mockSelect.mockReturnValue(makeSelectChain([commission]) as never);
    const updateChain = makeUpdateChain();
    mockUpdate.mockReturnValue(updateChain as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Chargeback received');

    const affiliateSetArg = updateChain.set.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(affiliateSetArg['availableBalanceCents']).toBeDefined();
    expect(affiliateSetArg['pendingBalanceCents']).toBeUndefined();
  });
});

describe('reverseAffiliateCommission — PAID commission (no clawback)', () => {
  beforeEach(() => { vi.resetAllMocks(); setupTransactionMock(); });

  it('does not reverse PAID commission — query filters it out', async () => {
    // The WHERE clause uses inArray(['PENDING', 'PAYABLE']) — PAID is excluded
    // Simulated by returning empty rows (as the DB would)
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Late refund attempt');

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('reverseAffiliateCommission — REVERSED commission (idempotent)', () => {
  beforeEach(() => { vi.resetAllMocks(); setupTransactionMock(); });

  it('does not re-reverse an already REVERSED commission', async () => {
    // REVERSED is excluded by WHERE inArray(['PENDING', 'PAYABLE'])
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Duplicate reversal attempt');

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('reverseAffiliateCommission — multiple commissions per invoice', () => {
  beforeEach(() => { vi.resetAllMocks(); setupTransactionMock(); });

  it('reverses each reversible commission individually', async () => {
    const commissions = [
      makeCommission('PENDING', { id: 'comm-001', commissionCents: 300 }),
      makeCommission('PAYABLE', { id: 'comm-002', commissionCents: 500 }),
    ];
    mockSelect.mockReturnValue(makeSelectChain(commissions) as never);
    mockUpdate.mockReturnValue(makeUpdateChain() as never);

    await reverseAffiliateCommission(INVOICE_ID, 'Order refunded');

    // 4 updates total: 2 commission status updates + 2 affiliate balance updates
    expect(mockUpdate).toHaveBeenCalledTimes(4);
  });
});
