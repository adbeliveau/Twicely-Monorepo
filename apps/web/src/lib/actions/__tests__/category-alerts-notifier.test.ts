import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDb = {
  select: mockDbSelect,
};

const mockNotify = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));

describe('notifyCategoryAlertMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not notify when listing has no category', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Item', slug: 'item', priceCents: 1000, categoryId: null, ownerUserId: 'seller-1' }]),
        }),
      }),
    });

    const { notifyCategoryAlertMatches } = await import('@twicely/notifications/category-alert-notifier');
    await notifyCategoryAlertMatches('listing-1');

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('notifies matching alerts', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ title: 'Item', slug: 'item', priceCents: 1000, categoryId: 'cat-1', ownerUserId: 'seller-1' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ name: 'Electronics' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'alert-1', userId: 'buyer-1' },
          ]),
        }),
      });

    const { notifyCategoryAlertMatches } = await import('@twicely/notifications/category-alert-notifier');
    await notifyCategoryAlertMatches('listing-1');

    expect(mockNotify).toHaveBeenCalledWith('buyer-1', 'search.new_match', expect.objectContaining({
      categoryName: 'Electronics',
      itemTitle: 'Item',
    }));
  });

  it('does not notify listing owner', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ title: 'Item', slug: 'item', priceCents: 1000, categoryId: 'cat-1', ownerUserId: 'seller-1' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ name: 'Electronics' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'alert-1', userId: 'seller-1' },
          ]),
        }),
      });

    const { notifyCategoryAlertMatches } = await import('@twicely/notifications/category-alert-notifier');
    await notifyCategoryAlertMatches('listing-1');

    // Should not notify the listing owner
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('uses fire-and-forget pattern', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ title: 'Item', slug: 'item', priceCents: 1000, categoryId: 'cat-1', ownerUserId: 'seller-1' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ name: 'Electronics' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: 'alert-1', userId: 'buyer-1' },
          ]),
        }),
      });

    mockNotify.mockRejectedValue(new Error('Email failed'));

    const { notifyCategoryAlertMatches } = await import('@twicely/notifications/category-alert-notifier');

    // Should not throw
    await expect(notifyCategoryAlertMatches('listing-1')).resolves.toBeUndefined();
  });
});
