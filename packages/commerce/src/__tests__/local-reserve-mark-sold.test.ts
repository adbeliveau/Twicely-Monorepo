import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  orderItem: { orderId: 'order_id', listingId: 'listing_id' },
  listing: { id: 'id', status: 'status', updatedAt: 'updated_at', soldAt: 'sold_at' },
}));

vi.mock('@twicely/commerce/offer-transitions', () => ({
  declineAllPendingOffersForListing: vi.fn().mockResolvedValue({ declined: 0 }),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from '@twicely/db';
import { logger } from '@twicely/logger';
import { markListingSoldForLocalTransaction } from '../local-reserve';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_ID = 'ord-001';
const LISTING_ID = 'lst-001';

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

function makeUpdateChain() {
  const chain = {
    set: vi.fn(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  chain.set.mockReturnValue(chain);
  return chain;
}

// ─── markListingSoldForLocalTransaction ───────────────────────────────────────

describe('markListingSoldForLocalTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
  });

  it('transitions RESERVED listing to SOLD', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'RESERVED' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await markListingSoldForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'SOLD' });
  });

  it('transitions ACTIVE listing to SOLD', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await markListingSoldForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'SOLD' });
  });

  it('sets soldAt timestamp when marking as SOLD', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'RESERVED' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await markListingSoldForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toHaveProperty('soldAt');
    expect(sets[0]?.[0]?.soldAt).toBeInstanceOf(Date);
  });

  it('handles missing orderItem gracefully (no throw)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    await expect(markListingSoldForLocalTransaction(ORDER_ID)).resolves.toBeUndefined();
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });

  it('does NOT change listing already in SOLD status (no-op)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'SOLD' }]) as never);

    await markListingSoldForLocalTransaction(ORDER_ID);

    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('logs the SOLD transition', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'RESERVED' }]) as never);

    await markListingSoldForLocalTransaction(ORDER_ID);

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      '[local-reserve] Listing marked SOLD for completed local transaction',
      expect.objectContaining({ listingId: LISTING_ID, orderId: ORDER_ID }),
    );
  });
});
