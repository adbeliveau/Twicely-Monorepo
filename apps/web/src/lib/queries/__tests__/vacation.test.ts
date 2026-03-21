import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  order: { sellerId: 'seller_id', status: 'status' },
  listingOffer: { sellerId: 'seller_id', status: 'status' },
}));

import { db } from '@twicely/db';
import { getUnfulfilledOrderCount, getSellerPendingOffersCount } from '../vacation';

const USER_ID = 'user-001';
const mockDbSelect = vi.mocked(db.select);

function makeCountChain(total: number) {
  const chain = {
    from: vi.fn(),
    where: vi.fn().mockResolvedValue([{ total }]),
  };
  chain.from.mockReturnValue(chain);
  return chain;
}

// ─── getUnfulfilledOrderCount ─────────────────────────────────────────────────

describe('getUnfulfilledOrderCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns count of PAID orders for the seller', async () => {
    mockDbSelect.mockReturnValueOnce(makeCountChain(3) as never);

    const result = await getUnfulfilledOrderCount(USER_ID);

    expect(result).toBe(3);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no unfulfilled orders', async () => {
    mockDbSelect.mockReturnValueOnce(makeCountChain(0) as never);

    const result = await getUnfulfilledOrderCount(USER_ID);

    expect(result).toBe(0);
  });

  it('returns 0 when db returns empty row', async () => {
    const chain = {
      from: vi.fn(),
      where: vi.fn().mockResolvedValue([]),
    };
    chain.from.mockReturnValue(chain);
    mockDbSelect.mockReturnValueOnce(chain as never);

    const result = await getUnfulfilledOrderCount(USER_ID);

    expect(result).toBe(0);
  });
});

// ─── getSellerPendingOffersCount ──────────────────────────────────────────────

describe('getSellerPendingOffersCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns count of PENDING offers for the seller', async () => {
    mockDbSelect.mockReturnValueOnce(makeCountChain(5) as never);

    const result = await getSellerPendingOffersCount(USER_ID);

    expect(result).toBe(5);
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no pending offers', async () => {
    mockDbSelect.mockReturnValueOnce(makeCountChain(0) as never);

    const result = await getSellerPendingOffersCount(USER_ID);

    expect(result).toBe(0);
  });

  it('returns 0 when db returns empty row', async () => {
    const chain = {
      from: vi.fn(),
      where: vi.fn().mockResolvedValue([]),
    };
    chain.from.mockReturnValue(chain);
    mockDbSelect.mockReturnValueOnce(chain as never);

    const result = await getSellerPendingOffersCount(USER_ID);

    expect(result).toBe(0);
  });
});
