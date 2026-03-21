import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import {
  getAffiliatePromoCodes,
  getPromoCodeById,
  getPromoCodeByCode,
  getPlatformPromoCodes,
  getAllPromoCodes,
  hasUserRedeemedPromoCode,
  getPromoCodeRedemptionCount,
} from '../promo-codes';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

// Chain ending at .orderBy() (thenable — no .limit())
function makeOrderByChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

// Chain ending at .limit(1)
function makeLimitChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never;
}

// Chain for paginated select: .where().orderBy().limit().offset()
function makePaginatedChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  } as never;
}

// Chain for unfiltered paginated: .orderBy().limit().offset()
function makeUnfilteredPaginatedChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as never;
}

// Chain for count: select({total}).from().where()
function makeCountChain(total: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ total }]),
    }),
  } as never;
}

// Unfiltered count chain: select({total}).from()
function makeUnfilteredCountChain(total: number) {
  return {
    from: vi.fn().mockResolvedValue([{ total }]),
  } as never;
}

// ─── getAffiliatePromoCodes ──────────────────────────────────────────────────

describe('getAffiliatePromoCodes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns promo codes ordered by createdAt desc', async () => {
    const rows = [
      { id: 'pc-1', code: 'SAVE10', affiliateId: 'aff-1' },
      { id: 'pc-2', code: 'SAVE20', affiliateId: 'aff-1' },
    ];
    mockSelect.mockReturnValueOnce(makeOrderByChain(rows));

    const result = await getAffiliatePromoCodes('aff-1');
    expect(result).toHaveLength(2);
    expect(result[0]!.code).toBe('SAVE10');
  });

  it('returns empty array when affiliate has no codes', async () => {
    mockSelect.mockReturnValueOnce(makeOrderByChain([]));
    const result = await getAffiliatePromoCodes('aff-1');
    expect(result).toEqual([]);
  });
});

// ─── getPromoCodeById ────────────────────────────────────────────────────────

describe('getPromoCodeById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the promo code row when found', async () => {
    const row = { id: 'pc-1', code: 'SAVE10' };
    mockSelect.mockReturnValueOnce(makeLimitChain([row]));

    const result = await getPromoCodeById('pc-1');
    expect(result).toEqual(row);
  });

  it('returns null when not found', async () => {
    mockSelect.mockReturnValueOnce(makeLimitChain([]));
    const result = await getPromoCodeById('missing');
    expect(result).toBeNull();
  });
});

// ─── getPromoCodeByCode ──────────────────────────────────────────────────────

describe('getPromoCodeByCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the promo code when code matches', async () => {
    const row = { id: 'pc-1', code: 'SAVE10' };
    mockSelect.mockReturnValueOnce(makeLimitChain([row]));

    const result = await getPromoCodeByCode('SAVE10');
    expect(result).toEqual(row);
  });

  it('returns null when no code matches', async () => {
    mockSelect.mockReturnValueOnce(makeLimitChain([]));
    const result = await getPromoCodeByCode('NOCODE');
    expect(result).toBeNull();
  });
});

// ─── getPlatformPromoCodes ───────────────────────────────────────────────────

describe('getPlatformPromoCodes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns paginated rows and total for PLATFORM codes', async () => {
    const rows = [{ id: 'pc-2', code: 'PLATFORM10', type: 'PLATFORM' }];
    mockSelect
      .mockReturnValueOnce(makePaginatedChain(rows))
      .mockReturnValueOnce(makeCountChain(15));

    const result = await getPlatformPromoCodes({ limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(15);
  });

  it('returns total 0 when no platform codes exist', async () => {
    mockSelect
      .mockReturnValueOnce(makePaginatedChain([]))
      .mockReturnValueOnce(makeCountChain(0));

    const result = await getPlatformPromoCodes({ limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── getAllPromoCodes ────────────────────────────────────────────────────────

describe('getAllPromoCodes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all codes when no type filter is provided', async () => {
    const rows = [
      { id: 'pc-1', type: 'AFFILIATE' },
      { id: 'pc-2', type: 'PLATFORM' },
    ];
    mockSelect
      .mockReturnValueOnce(makeUnfilteredPaginatedChain(rows))
      .mockReturnValueOnce(makeUnfilteredCountChain(2));

    const result = await getAllPromoCodes({ limit: 10, offset: 0 });
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('filters by AFFILIATE type when specified', async () => {
    const rows = [{ id: 'pc-1', type: 'AFFILIATE' }];
    mockSelect
      .mockReturnValueOnce(makePaginatedChain(rows))
      .mockReturnValueOnce(makeCountChain(1));

    const result = await getAllPromoCodes({ limit: 10, offset: 0, type: 'AFFILIATE' });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('filters by PLATFORM type when specified', async () => {
    const rows = [{ id: 'pc-2', type: 'PLATFORM' }];
    mockSelect
      .mockReturnValueOnce(makePaginatedChain(rows))
      .mockReturnValueOnce(makeCountChain(7));

    const result = await getAllPromoCodes({ limit: 10, offset: 0, type: 'PLATFORM' });
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(7);
  });
});

// ─── hasUserRedeemedPromoCode ────────────────────────────────────────────────

describe('hasUserRedeemedPromoCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when redemption row exists', async () => {
    mockSelect.mockReturnValueOnce(makeLimitChain([{ id: 'red-1' }]));
    const result = await hasUserRedeemedPromoCode('pc-1', 'user-1', 'store');
    expect(result).toBe(true);
  });

  it('returns false when no redemption row exists', async () => {
    mockSelect.mockReturnValueOnce(makeLimitChain([]));
    const result = await hasUserRedeemedPromoCode('pc-1', 'user-1', 'store');
    expect(result).toBe(false);
  });
});

// ─── getPromoCodeRedemptionCount ─────────────────────────────────────────────

describe('getPromoCodeRedemptionCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the redemption count', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: 42 }]),
      }),
    } as never);

    const result = await getPromoCodeRedemptionCount('pc-1');
    expect(result).toBe(42);
  });

  it('returns 0 when no redemptions exist', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: 0 }]),
      }),
    } as never);

    const result = await getPromoCodeRedemptionCount('pc-1');
    expect(result).toBe(0);
  });

  it('returns 0 when query returns empty array (no row)', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as never);

    const result = await getPromoCodeRedemptionCount('pc-1');
    expect(result).toBe(0);
  });
});
