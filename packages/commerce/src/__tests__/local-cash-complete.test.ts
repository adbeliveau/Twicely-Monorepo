/**
 * Tests for local-cash-complete.ts
 *
 * Covers completeCashLocalSale cash routing (§A0/§A16):
 * - Routes to postLocalCashSale with correct args
 * - Transitions status to COMPLETED before posting
 * - Returns error when transaction not found
 * - Returns error when status is terminal (invalid transition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {
    id: 'id',
    status: 'status',
    sellerId: 'seller_id',
    buyerId: 'buyer_id',
    orderId: 'order_id',
    updatedAt: 'updated_at',
  },
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../local-cash-sale', () => ({
  postLocalCashSale: vi.fn().mockResolvedValue({ ledgerEntryId: 'le-cash-test' }),
}));

// Use real local-state-machine (pure logic, no deps)
vi.unmock('../local-state-machine');

import { db } from '@twicely/db';
import { postLocalCashSale } from '../local-cash-sale';
import { completeCashLocalSale } from '../local-cash-complete';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain(returning: unknown[] = [{ id: 'tx-1' }]) {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(returning),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

const TX_ID = 'lt-cash-complete-001';

function makeSelectSequence(txRow: unknown, orderItemRow: unknown) {
  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return makeSelectChain([txRow]) as never;
    }
    return makeSelectChain([orderItemRow]) as never;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('completeCashLocalSale — cash FC emission routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes to postLocalCashSale with correct args when transaction is SCHEDULED', async () => {
    makeSelectSequence(
      { id: TX_ID, status: 'SCHEDULED', sellerId: 'seller-1', buyerId: 'buyer-1', orderId: 'ord-1' },
      { listingId: 'listing-1' },
    );
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await completeCashLocalSale({ transactionId: TX_ID, amountCents: 5000 });

    expect(result.success).toBe(true);
    expect(result.ledgerEntryId).toBe('le-cash-test');

    expect(vi.mocked(postLocalCashSale)).toHaveBeenCalledWith({
      localTransactionId: TX_ID,
      sellerId: 'seller-1',
      buyerId: 'buyer-1',
      amountCents: 5000,
      listingId: 'listing-1',
    });
  });

  it('transitions status to COMPLETED before posting the ledger entry', async () => {
    makeSelectSequence(
      { id: TX_ID, status: 'SCHEDULED', sellerId: 'seller-1', buyerId: 'buyer-1', orderId: 'ord-1' },
      { listingId: 'listing-1' },
    );
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await completeCashLocalSale({ transactionId: TX_ID, amountCents: 5000 });

    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('COMPLETED');
  });

  it('returns error when transaction not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    const result = await completeCashLocalSale({ transactionId: TX_ID, amountCents: 5000 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
    expect(vi.mocked(postLocalCashSale)).not.toHaveBeenCalled();
  });

  it('returns error when status cannot transition to COMPLETED (CANCELED is terminal)', async () => {
    makeSelectSequence(
      { id: TX_ID, status: 'CANCELED', sellerId: 'seller-1', buyerId: 'buyer-1', orderId: 'ord-1' },
      { listingId: 'listing-1' },
    );

    const result = await completeCashLocalSale({ transactionId: TX_ID, amountCents: 5000 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from CANCELED/);
    expect(vi.mocked(postLocalCashSale)).not.toHaveBeenCalled();
  });
});
