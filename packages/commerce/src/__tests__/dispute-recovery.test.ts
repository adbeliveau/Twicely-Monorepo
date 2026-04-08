/**
 * Tests for the Decision #92 Post-Release Claim Recovery Waterfall.
 *
 * Three steps:
 *   1. Deduct from sellerBalance.availableCents
 *   2. Deduct from sellerBalance.reservedCents
 *   3. Platform absorbs remainder
 *
 * Audit reference: 2026-04-07 — `mk-buyer-protection` audit found Decision #92
 *                  was unimplemented. These tests guard the implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSelectChain = vi.fn();
const mockUpdateChain = vi.fn();
const mockInsertChain = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  sellerBalance: {
    userId: 'user_id',
    availableCents: 'available_cents',
    reservedCents: 'reserved_cents',
    pendingCents: 'pending_cents',
    updatedAt: 'updated_at',
  },
  ledgerEntry: {
    id: 'id',
    type: 'type',
    status: 'status',
    amountCents: 'amount_cents',
    userId: 'user_id',
    orderId: 'order_id',
    memo: 'memo',
    postedAt: 'posted_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ type: 'eq', col, val })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values })),
}));

import { db } from '@twicely/db';
import { recoverFromSellerWaterfall } from '../dispute-recovery';

const mockTransaction = vi.mocked(db.transaction);

/**
 * Build a tx mock that returns a balance row, captures the update + insert calls,
 * and runs the recovery callback.
 */
function makeTxMock(balanceRow: { availableCents: number; reservedCents: number } | null) {
  const insertedEntries: Array<{ type: string; amountCents: number; memo: string }> = [];
  const updates: Array<{ availableCents?: unknown; reservedCents?: unknown }> = [];

  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          for: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(balanceRow ? [{
              userId: 'seller-1',
              availableCents: balanceRow.availableCents,
              reservedCents: balanceRow.reservedCents,
            }] : []),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updates.push(data);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((data: { type: string; amountCents: number; memo: string }) => {
        insertedEntries.push({ type: data.type, amountCents: data.amountCents, memo: data.memo });
        return Promise.resolve(undefined);
      }),
    }),
  };

  return { tx, insertedEntries, updates };
}

describe('recoverFromSellerWaterfall (Decision #92)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero result for zero amount', async () => {
    const result = await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 0,
      disputeId: 'd1',
    });
    expect(result).toEqual({
      recoveredFromAvailableCents: 0,
      recoveredFromReservedCents: 0,
      platformAbsorbedCents: 0,
      totalCents: 0,
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('Step 1 only: full recovery from availableCents when seller has enough', async () => {
    const { tx, insertedEntries } = makeTxMock({ availableCents: 10000, reservedCents: 5000 });
    mockTransaction.mockImplementation(async (cb) => cb(tx as never));

    const result = await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 5000,
      disputeId: 'd1',
    });

    expect(result.recoveredFromAvailableCents).toBe(5000);
    expect(result.recoveredFromReservedCents).toBe(0);
    expect(result.platformAbsorbedCents).toBe(0);
    expect(result.totalCents).toBe(5000);

    expect(insertedEntries).toHaveLength(1);
    expect(insertedEntries[0]?.type).toBe('RESERVE_HOLD');
    expect(insertedEntries[0]?.amountCents).toBe(-5000); // negative = debit
    expect(insertedEntries[0]?.memo).toContain('step 1');
  });

  it('Step 1 + Step 2: partial available + partial reserved when available is insufficient', async () => {
    const { tx, insertedEntries } = makeTxMock({ availableCents: 3000, reservedCents: 5000 });
    mockTransaction.mockImplementation(async (cb) => cb(tx as never));

    const result = await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 6000,
      disputeId: 'd1',
    });

    expect(result.recoveredFromAvailableCents).toBe(3000);
    expect(result.recoveredFromReservedCents).toBe(3000);
    expect(result.platformAbsorbedCents).toBe(0);
    expect(result.totalCents).toBe(6000);

    expect(insertedEntries).toHaveLength(2);
    expect(insertedEntries[0]?.amountCents).toBe(-3000);
    expect(insertedEntries[0]?.memo).toContain('step 1');
    expect(insertedEntries[1]?.amountCents).toBe(-3000);
    expect(insertedEntries[1]?.memo).toContain('step 2');
  });

  it('Step 1 + Step 2 + Step 3: partial recovery + platform absorption', async () => {
    const { tx, insertedEntries } = makeTxMock({ availableCents: 2000, reservedCents: 1000 });
    mockTransaction.mockImplementation(async (cb) => cb(tx as never));

    const result = await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 5000,
      disputeId: 'd1',
    });

    expect(result.recoveredFromAvailableCents).toBe(2000);
    expect(result.recoveredFromReservedCents).toBe(1000);
    expect(result.platformAbsorbedCents).toBe(2000);
    expect(result.totalCents).toBe(5000);

    expect(insertedEntries).toHaveLength(3);
    expect(insertedEntries[0]?.type).toBe('RESERVE_HOLD');
    expect(insertedEntries[1]?.type).toBe('RESERVE_HOLD');
    expect(insertedEntries[2]?.type).toBe('PLATFORM_ABSORBED_COST');
    expect(insertedEntries[2]?.amountCents).toBe(2000); // positive (it's a cost to platform)
  });

  it('Step 3 only: full platform absorption when seller has no balance row', async () => {
    const { tx, insertedEntries, updates } = makeTxMock(null);
    mockTransaction.mockImplementation(async (cb) => cb(tx as never));

    const result = await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 5000,
      disputeId: 'd1',
    });

    expect(result.recoveredFromAvailableCents).toBe(0);
    expect(result.recoveredFromReservedCents).toBe(0);
    expect(result.platformAbsorbedCents).toBe(5000);
    expect(result.totalCents).toBe(5000);

    // No balance row → no balance update
    expect(updates).toHaveLength(0);

    // Only the platform absorption ledger entry
    expect(insertedEntries).toHaveLength(1);
    expect(insertedEntries[0]?.type).toBe('PLATFORM_ABSORBED_COST');
  });

  it('Step 3 only: full platform absorption when seller has zero balance', async () => {
    const { tx, insertedEntries, updates } = makeTxMock({ availableCents: 0, reservedCents: 0 });
    mockTransaction.mockImplementation(async (cb) => cb(tx as never));

    const result = await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 5000,
      disputeId: 'd1',
    });

    expect(result.recoveredFromAvailableCents).toBe(0);
    expect(result.recoveredFromReservedCents).toBe(0);
    expect(result.platformAbsorbedCents).toBe(5000);

    // No deductions to apply → no balance update
    expect(updates).toHaveLength(0);

    expect(insertedEntries).toHaveLength(1);
    expect(insertedEntries[0]?.type).toBe('PLATFORM_ABSORBED_COST');
  });

  it('uses SELECT FOR UPDATE to lock the seller_balance row (race prevention)', async () => {
    const { tx } = makeTxMock({ availableCents: 5000, reservedCents: 0 });
    mockTransaction.mockImplementation(async (cb) => cb(tx as never));

    await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 1000,
      disputeId: 'd1',
    });

    // The select chain ends with .for('update') — verify the for() was called
    const selectChain = (tx.select as ReturnType<typeof vi.fn>).mock.results[0]?.value;
    const fromChain = selectChain.from.mock.results[0].value;
    const whereChain = fromChain.where.mock.results[0].value;
    expect(whereChain.for).toHaveBeenCalledWith('update');
  });

  it('passes orderId through to ledger entries when provided', async () => {
    const { tx } = makeTxMock({ availableCents: 5000, reservedCents: 0 });
    let capturedInsertData: Record<string, unknown> | null = null;
    tx.insert = vi.fn().mockReturnValue({
      values: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        capturedInsertData = data;
        return Promise.resolve(undefined);
      }),
    });
    mockTransaction.mockImplementation(async (cb) => cb(tx as never));

    await recoverFromSellerWaterfall({
      sellerId: 'seller-1',
      amountCents: 1000,
      disputeId: 'd1',
      orderId: 'order-99',
    });

    expect(capturedInsertData).not.toBeNull();
    expect((capturedInsertData as { orderId?: string }).orderId).toBe('order-99');
  });
});
