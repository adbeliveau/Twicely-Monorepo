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
import { declineAllPendingOffersForListing } from '@twicely/commerce/offer-transitions';
import {
  reserveListingForLocalTransaction,
  unreserveListingForLocalTransaction,
} from '../local-reserve';

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

// ─── reserveListingForLocalTransaction ────────────────────────────────────────

describe('reserveListingForLocalTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
  });

  it('returns success and updates listing to RESERVED when listing is ACTIVE', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    const result = await reserveListingForLocalTransaction(ORDER_ID);

    expect(result.success).toBe(true);
    expect(result.listingId).toBe(LISTING_ID);
    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'RESERVED' });
  });

  it('declines all pending offers for the listing', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE' }]) as never);

    await reserveListingForLocalTransaction(ORDER_ID);

    expect(vi.mocked(declineAllPendingOffersForListing)).toHaveBeenCalledWith(LISTING_ID);
  });

  it('returns error when listing is not in ACTIVE status', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'PAUSED' }]) as never);

    const result = await reserveListingForLocalTransaction(ORDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Listing not in ACTIVE status');
  });

  it('returns error when listing is already RESERVED', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'RESERVED' }]) as never);

    const result = await reserveListingForLocalTransaction(ORDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Listing not in ACTIVE status');
  });

  it('returns error when orderItem is not found for orderId', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await reserveListingForLocalTransaction(ORDER_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No orderItem found for orderId');
  });

  it('sets updatedAt when reserving', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await reserveListingForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toHaveProperty('updatedAt');
    expect(sets[0]?.[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it('logs reservation with orderId and listingId', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE' }]) as never);

    await reserveListingForLocalTransaction(ORDER_ID);

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      '[local-reserve] Listing reserved for local transaction',
      expect.objectContaining({ listingId: LISTING_ID, orderId: ORDER_ID }),
    );
  });
});

// ─── unreserveListingForLocalTransaction ─────────────────────────────────────

describe('unreserveListingForLocalTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);
  });

  it('transitions RESERVED listing to ACTIVE', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'RESERVED' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'ACTIVE' });
  });

  it('transitions SOLD listing to ACTIVE', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'SOLD' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'ACTIVE' });
  });

  it('transitions PAUSED listing to ACTIVE', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'PAUSED' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toMatchObject({ status: 'ACTIVE' });
  });

  it('does NOT change listing in DRAFT status', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'DRAFT' }]) as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('does NOT change listing in ENDED status', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ENDED' }]) as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('does NOT change listing in REMOVED status', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'REMOVED' }]) as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('does NOT change listing already in ACTIVE status (no-op)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'ACTIVE' }]) as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('handles missing orderItem gracefully (no throw)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    await expect(unreserveListingForLocalTransaction(ORDER_ID)).resolves.toBeUndefined();
    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });

  it('sets updatedAt when unreserving', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'RESERVED' }]) as never);
    const chain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(chain as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    const sets = chain.set.mock.calls as Array<[Record<string, unknown>]>;
    expect(sets[0]?.[0]).toHaveProperty('updatedAt');
    expect(sets[0]?.[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it('logs unreservation with listingId and previous status', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectChain([{ listingId: LISTING_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ status: 'RESERVED' }]) as never);

    await unreserveListingForLocalTransaction(ORDER_ID);

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      '[local-reserve] Listing unreserved — restored to ACTIVE',
      expect.objectContaining({ listingId: LISTING_ID, previousStatus: 'RESERVED' }),
    );
  });
});

