import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDb = {
  select: mockDbSelect,
  $with: vi.fn(),
  with: vi.fn(),
};

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@/lib/queries/shared', () => ({
  mapToListingCard: (row: Record<string, unknown>) => row,
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn(() => 'eq-condition'),
    and: vi.fn((...args: unknown[]) => args.filter(Boolean)),
    desc: vi.fn(() => 'desc'),
    sql: Object.assign(vi.fn(() => 'sql-expr'), { raw: vi.fn() }),
    count: vi.fn(() => 'count-agg'),
    ne: vi.fn(() => 'ne-condition'),
    notInArray: vi.fn(() => 'notInArray-condition'),
    isNotNull: vi.fn(() => 'isNotNull-condition'),
    gt: vi.fn(() => 'gt-condition'),
  };
});

// ─── getFollowedSellers tests ─────────────────────────────────────────────────

describe('getFollowedSellers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array for user following nobody', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    const { getFollowedSellers } = await import('../follow');
    const result = await getFollowedSellers('user-1');
    expect(result).toEqual([]);
  });

  it('returns seller data with correct fields', async () => {
    const mockRow = {
      userId: 'seller-1',
      storeName: 'Cool Store',
      storeSlug: 'cool-store',
      avatarUrl: 'https://example.com/avatar.jpg',
      performanceBand: 'EMERGING',
      memberSince: new Date('2024-01-01'),
      followedAt: new Date('2025-01-01'),
      listingCount: 5,
      followerCount: 12,
      lastListedAt: new Date('2025-03-01'),
    };
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([mockRow]),
        }),
      }),
    });
    const { getFollowedSellers } = await import('../follow');
    const result = await getFollowedSellers('user-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.userId).toBe('seller-1');
    expect(result[0]?.storeName).toBe('Cool Store');
    expect(result[0]?.listingCount).toBe(5);
    expect(result[0]?.followerCount).toBe(12);
  });

  it('includes follower count and listing count', async () => {
    const mockRow = {
      userId: 'seller-1',
      storeName: 'Store',
      storeSlug: 'store',
      avatarUrl: null,
      performanceBand: 'ESTABLISHED',
      memberSince: new Date(),
      followedAt: new Date(),
      listingCount: 42,
      followerCount: 100,
      lastListedAt: null,
    };
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([mockRow]),
        }),
      }),
    });
    const { getFollowedSellers } = await import('../follow');
    const result = await getFollowedSellers('user-1');
    expect(result[0]?.listingCount).toBe(42);
    expect(result[0]?.followerCount).toBe(100);
  });

  it('orders by follow createdAt DESC', async () => {
    const orderBySpy = vi.fn().mockResolvedValue([]);
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          orderBy: orderBySpy,
        }),
      }),
    });
    const { getFollowedSellers } = await import('../follow');
    await getFollowedSellers('user-1');
    expect(orderBySpy).toHaveBeenCalledTimes(1);
  });
});

// ─── getFollowingCount tests ──────────────────────────────────────────────────

describe('getFollowingCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 0 for user following nobody', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
    const { getFollowingCount } = await import('../follow');
    const result = await getFollowingCount('user-1');
    expect(result).toBe(0);
  });

  it('returns correct count', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 7 }]),
      }),
    });
    const { getFollowingCount } = await import('../follow');
    const result = await getFollowingCount('user-1');
    expect(result).toBe(7);
  });
});

// ─── getFollowedSellerNewListings tests ───────────────────────────────────────

describe('getFollowedSellerNewListings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns only ACTIVE listings (status filter via eq)', async () => {
    const { eq } = await import('drizzle-orm');
    const mockLimitFn = vi.fn().mockResolvedValue([]);
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ limit: mockLimitFn }),
        }),
      }),
    });
    const { getFollowedSellerNewListings } = await import('../follow');
    await getFollowedSellerNewListings('user-1');
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'ACTIVE');
  });

  it('respects limit parameter', async () => {
    const mockLimitFn = vi.fn().mockResolvedValue([]);
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ limit: mockLimitFn }),
        }),
      }),
    });
    const { getFollowedSellerNewListings } = await import('../follow');
    await getFollowedSellerNewListings('user-1', 5);
    expect(mockLimitFn).toHaveBeenCalledWith(5);
  });

  it('returns empty array when no followed sellers have listings', async () => {
    const mockLimitFn = vi.fn().mockResolvedValue([]);
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({ limit: mockLimitFn }),
        }),
      }),
    });
    const { getFollowedSellerNewListings } = await import('../follow');
    const result = await getFollowedSellerNewListings('user-1');
    expect(result).toEqual([]);
  });
});

// ─── getFollowerCount tests ───────────────────────────────────────────────────

describe('getFollowerCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 0 for user with no followers', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });
    const { getFollowerCount } = await import('../follow');
    const result = await getFollowerCount('seller-1');
    expect(result).toBe(0);
  });

  it('returns correct follower count', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 42 }]),
      }),
    });
    const { getFollowerCount } = await import('../follow');
    const result = await getFollowerCount('seller-1');
    expect(result).toBe(42);
  });

  it('returns 0 when DB returns empty array (no row)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    const { getFollowerCount } = await import('../follow');
    const result = await getFollowerCount('seller-1');
    expect(result).toBe(0);
  });
});

// ─── getFollowingCount edge case ──────────────────────────────────────────────

describe('getFollowingCount — DB empty row fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns 0 when DB returns empty array (no row)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    const { getFollowingCount } = await import('../follow');
    const result = await getFollowingCount('user-1');
    expect(result).toBe(0);
  });
});
