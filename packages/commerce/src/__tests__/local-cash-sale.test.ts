/**
 * Tests for local-cash-sale.ts
 *
 * Verifies that postLocalCashSale:
 *   1. Posts LOCAL_CASH_SALE_REVENUE with correct fields (happy path)
 *   2. Is idempotent (duplicate calls return the existing entry, no double-post)
 *   3. Does NOT update sellerBalance (informational-only per §A16)
 *   4. Throws on amountCents <= 0 (defense-in-depth)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  ledgerEntry: {
    id: 'id',
    type: 'type',
    status: 'status',
    amountCents: 'amount_cents',
    userId: 'user_id',
    listingId: 'listing_id',
    reasonCode: 'reason_code',
    memo: 'memo',
    postedAt: 'posted_at',
    createdAt: 'created_at',
  },
  sellerBalance: { userId: 'user_id' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { db } from '@twicely/db';
import { postLocalCashSale } from '../local-cash-sale';

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

function makeInsertChain(returning: unknown[]) {
  const chain = {
    values: vi.fn(),
    returning: vi.fn().mockResolvedValue(returning),
  };
  chain.values.mockReturnValue(chain);
  return chain;
}

const BASE_PARAMS = {
  localTransactionId: 'lt-cash-001',
  sellerId: 'seller-001',
  buyerId: 'buyer-001',
  amountCents: 4999,
  listingId: 'listing-001',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('postLocalCashSale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: posts LOCAL_CASH_SALE_REVENUE and returns ledgerEntryId', async () => {
    // Idempotency check: no existing entry
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    // Insert succeeds
    const insertChain = makeInsertChain([{ id: 'le-cash-001' }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const result = await postLocalCashSale(BASE_PARAMS);

    expect(result.ledgerEntryId).toBe('le-cash-001');

    // Verify type passed to insert
    const insertedRow = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow?.type).toBe('LOCAL_CASH_SALE_REVENUE');
    expect(insertedRow?.status).toBe('POSTED');
    expect(insertedRow?.amountCents).toBe(4999);
    expect(insertedRow?.userId).toBe('seller-001');
    expect(insertedRow?.reasonCode).toBe('local-cash:lt-cash-001:revenue');
  });

  it('idempotency: second call returns existing entry without inserting again', async () => {
    // Idempotency check returns an existing entry
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: 'le-cash-existing' }]) as never,
    );

    const result = await postLocalCashSale(BASE_PARAMS);

    expect(result.ledgerEntryId).toBe('le-cash-existing');
    // db.insert must NOT have been called
    expect(vi.mocked(db.insert)).not.toHaveBeenCalled();
  });

  it('does NOT call db.insert on sellerBalance — entry is informational only', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    const insertChain = makeInsertChain([{ id: 'le-cash-002' }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await postLocalCashSale(BASE_PARAMS);

    // Only one insert call (ledgerEntry), no sellerBalance update
    // db.insert is the only write path — verify it was called exactly once
    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
    // The single insert target must be ledgerEntry, not sellerBalance
    // (We verify the shape via the type field rather than the schema reference
    //  since schema is mocked as plain objects.)
    const insertedRow = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow?.type).toBe('LOCAL_CASH_SALE_REVENUE');
  });

  it('zero-amount guard: throws when amountCents is 0', async () => {
    await expect(
      postLocalCashSale({ ...BASE_PARAMS, amountCents: 0 }),
    ).rejects.toThrow('amountCents must be > 0');
  });

  it('zero-amount guard: throws when amountCents is negative', async () => {
    await expect(
      postLocalCashSale({ ...BASE_PARAMS, amountCents: -100 }),
    ).rejects.toThrow('amountCents must be > 0');
  });

  it('handles null buyerId gracefully (Cash Only listing with no Twicely buyer)', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    const insertChain = makeInsertChain([{ id: 'le-cash-003' }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const result = await postLocalCashSale({ ...BASE_PARAMS, buyerId: null });

    expect(result.ledgerEntryId).toBe('le-cash-003');
    const insertedRow = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow?.memo).toContain('external');
  });

  it('handles null listingId gracefully (bare cash sale not tied to a listing)', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);
    const insertChain = makeInsertChain([{ id: 'le-cash-004' }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    const result = await postLocalCashSale({ ...BASE_PARAMS, listingId: null });

    expect(result.ledgerEntryId).toBe('le-cash-004');
    // listingId must not be present in insert payload when null
    const insertedRow = insertChain.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedRow).not.toHaveProperty('listingId');
  });
});
