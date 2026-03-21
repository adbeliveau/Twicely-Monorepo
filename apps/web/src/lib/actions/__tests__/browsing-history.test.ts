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

// Valid cuid2 IDs for use in tests
const LISTING_ID = 'wnrw7r9n3j5h2wzb1fuz3knt';

describe('Browsing History Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('recordViewAction', () => {
    it('returns success silently when no session', async () => {
      mockAuthorize.mockResolvedValue({ session: null });

      const { recordViewAction } = await import('../browsing-history');
      const result = await recordViewAction(LISTING_ID);

      expect(result).toEqual({ success: true });
      expect(mockDbInsert).not.toHaveBeenCalled();
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

      const { recordViewAction } = await import('../browsing-history');
      const result = await recordViewAction(LISTING_ID);

      expect(result).toEqual({ success: false, error: 'Listing not found' });
    });

    it('returns success silently when viewing own listing', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ownerUserId: 'user-1' }]),
          }),
        }),
      });

      const { recordViewAction } = await import('../browsing-history');
      const result = await recordViewAction(LISTING_ID);

      expect(result).toEqual({ success: true });
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('records view for another user listing', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      // First call: get listing owner
      // Second call: count history items
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
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        });

      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: mockOnConflictDoUpdate,
        }),
      });

      const { recordViewAction } = await import('../browsing-history');
      const result = await recordViewAction(LISTING_ID);

      expect(result).toEqual({ success: true });
      expect(mockDbInsert).toHaveBeenCalled();
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it('uses onConflictDoUpdate to update viewedAt on repeat view', async () => {
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
            where: vi.fn().mockResolvedValue([{ count: 5 }]),
          }),
        });

      const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: mockOnConflictDoUpdate,
        }),
      });

      const { recordViewAction } = await import('../browsing-history');
      await recordViewAction(LISTING_ID);

      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it('deletes oldest items when over 50 limit', async () => {
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
            where: vi.fn().mockResolvedValue([{ count: 52 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: 'old-1' },
                  { id: 'old-2' },
                ]),
              }),
            }),
          }),
        });

      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const { recordViewAction } = await import('../browsing-history');
      await recordViewAction(LISTING_ID);

      // Batch delete with inArray - single call for all items
      expect(mockDbDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearBrowsingHistoryAction', () => {
    it('returns unauthorized when no session', async () => {
      mockAuthorize.mockResolvedValue({ session: null });

      const { clearBrowsingHistoryAction } = await import('../browsing-history');
      const result = await clearBrowsingHistoryAction();

      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('clears all history for logged in user', async () => {
      mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const { clearBrowsingHistoryAction } = await import('../browsing-history');
      const result = await clearBrowsingHistoryAction();

      expect(result).toEqual({ success: true });
      expect(mockDbDelete).toHaveBeenCalled();
    });
  });
});
