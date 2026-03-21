import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();
const mockDb = {
  select: mockDbSelect,
  insert: mockDbInsert,
  delete: mockDbDelete,
};

const mockAbility = { can: vi.fn().mockReturnValue(true) };
const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('Watchlist Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('toggleWatchlistAction', () => {
    it('returns unauthorized when no session', async () => {
      mockAuthorize.mockResolvedValue({ session: null });

      const { toggleWatchlistAction } = await import('../watchlist');
      const result = await toggleWatchlistAction('listing-1');

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error when listing not found', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const { toggleWatchlistAction } = await import('../watchlist');
      const result = await toggleWatchlistAction('listing-1');

      expect(result).toEqual({ success: false, error: 'Listing not found' });
    });

    it('prevents watching own listing', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ownerUserId: 'user-1' }]),
          }),
        }),
      });

      const { toggleWatchlistAction } = await import('../watchlist');
      const result = await toggleWatchlistAction('listing-1');

      expect(result).toEqual({ success: false, error: 'Cannot watch your own listing' });
    });

    it('adds to watchlist when not watching', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      // First call: get listing owner
      // Second call: check if watching
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ ownerUserId: 'seller-1' }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // Not watching
            }),
          }),
        });
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const { toggleWatchlistAction } = await import('../watchlist');
      const result = await toggleWatchlistAction('listing-1');

      expect(result).toEqual({ success: true, watching: true });
      expect(mockDbInsert).toHaveBeenCalled();
    });

    it('removes from watchlist when already watching', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ ownerUserId: 'seller-1' }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'watch-1' }]), // Already watching
            }),
          }),
        });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const { toggleWatchlistAction } = await import('../watchlist');
      const result = await toggleWatchlistAction('listing-1');

      expect(result).toEqual({ success: true, watching: false });
      expect(mockDbDelete).toHaveBeenCalled();
    });

    it('uses onConflictDoNothing for race safety on insert', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ ownerUserId: 'seller-1' }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: mockOnConflictDoNothing,
        }),
      });

      const { toggleWatchlistAction } = await import('../watchlist');
      await toggleWatchlistAction('listing-1');

      expect(mockOnConflictDoNothing).toHaveBeenCalled();
    });
  });
});

describe('Watchlist Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('getWatchlistItems', () => {
    it('returns watched items with listing data', async () => {
      const mockRows = [
        {
          listingId: 'listing-1',
          title: 'Test Item',
          slug: 'test-item',
          priceCents: 1000,
          condition: 'GOOD',
          imageUrl: 'https://example.com/img.jpg',
          watchedAt: new Date('2024-01-01'),
        },
      ];
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockRows),
              }),
            }),
          }),
        }),
      });

      const { getWatchlistItems } = await import('@/lib/queries/watchlist');
      const result = await getWatchlistItems('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Test Item');
      expect(result[0]?.priceCents).toBe(1000);
    });
  });

  describe('isWatching', () => {
    it('returns true when watching', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'watch-1' }]),
          }),
        }),
      });

      const { isWatching } = await import('@/lib/queries/watchlist');
      const result = await isWatching('user-1', 'listing-1');

      expect(result).toBe(true);
    });

    it('returns false when not watching', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const { isWatching } = await import('@/lib/queries/watchlist');
      const result = await isWatching('user-1', 'listing-1');

      expect(result).toBe(false);
    });
  });

  describe('getWatcherCount', () => {
    it('returns correct count', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]),
        }),
      });

      const { getWatcherCount } = await import('@/lib/queries/watchlist');
      const result = await getWatcherCount('listing-1');

      expect(result).toBe(5);
    });

    it('returns 0 when no watchers', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      const { getWatcherCount } = await import('@/lib/queries/watchlist');
      const result = await getWatcherCount('listing-1');

      expect(result).toBe(0);
    });
  });
});
