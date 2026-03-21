import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
};

const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockAbility = { can: vi.fn().mockReturnValue(true) };
const mockAuthorize = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/casl', () => ({ authorize: mockAuthorize }));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('togglePriceAlertAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns unauthorized when no session', async () => {
    mockAuthorize.mockResolvedValue({ session: null });

    const { togglePriceAlertAction } = await import('../watchlist');
    const result = await togglePriceAlertAction('listing-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when not watching listing', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { togglePriceAlertAction } = await import('../watchlist');
    const result = await togglePriceAlertAction('listing-1');

    expect(result).toEqual({ success: false, error: 'Not watching this listing' });
  });

  it('toggles notifyPriceDrop from true to false', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'watch-1', notifyPriceDrop: true }]),
        }),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { togglePriceAlertAction } = await import('../watchlist');
    const result = await togglePriceAlertAction('listing-1');

    expect(result).toEqual({ success: true, notifyPriceDrop: false });
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('toggles notifyPriceDrop from false to true', async () => {
    mockAuthorize.mockResolvedValue({ session: { userId: 'user-1' }, ability: mockAbility });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'watch-1', notifyPriceDrop: false }]),
        }),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { togglePriceAlertAction } = await import('../watchlist');
    const result = await togglePriceAlertAction('listing-1');

    expect(result).toEqual({ success: true, notifyPriceDrop: true });
  });
});

describe('notifyPriceDropWatchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not notify when price increases', async () => {
    const { notifyPriceDropWatchers } = await import('@/lib/notifications/price-drop-notifier');
    await notifyPriceDropWatchers('listing-1', 1000, 1500);

    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not notify when price stays the same', async () => {
    const { notifyPriceDropWatchers } = await import('@/lib/notifications/price-drop-notifier');
    await notifyPriceDropWatchers('listing-1', 1000, 1000);

    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('notifies watchers when price drops', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { userId: 'watcher-1', userName: 'Alice' },
              { userId: 'watcher-2', userName: 'Bob' },
            ]),
          }),
        }),
      });

    const { notifyPriceDropWatchers } = await import('@/lib/notifications/price-drop-notifier');
    await notifyPriceDropWatchers('listing-1', 2000, 1500);

    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(mockNotify).toHaveBeenCalledWith('watcher-1', 'watchlist.price_drop', expect.objectContaining({
      recipientName: 'Alice',
      itemTitle: 'Test Item',
    }));
    expect(mockNotify).toHaveBeenCalledWith('watcher-2', 'watchlist.price_drop', expect.objectContaining({
      recipientName: 'Bob',
      itemTitle: 'Test Item',
    }));
  });

  it('only notifies watchers with notifyPriceDrop=true', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { userId: 'watcher-1', userName: 'Alice' },
            ]),
          }),
        }),
      });

    const { notifyPriceDropWatchers } = await import('@/lib/notifications/price-drop-notifier');
    await notifyPriceDropWatchers('listing-1', 2000, 1500);

    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it('handles missing listing gracefully', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const { notifyPriceDropWatchers } = await import('@/lib/notifications/price-drop-notifier');
    await notifyPriceDropWatchers('nonexistent', 2000, 1500);

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('uses fire-and-forget pattern for notify calls', async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ userId: 'watcher-1', userName: 'Alice' }]),
          }),
        }),
      });

    mockNotify.mockRejectedValue(new Error('Email failed'));

    const { notifyPriceDropWatchers } = await import('@/lib/notifications/price-drop-notifier');

    // Should not throw even if notify fails
    await expect(notifyPriceDropWatchers('listing-1', 2000, 1500)).resolves.toBeUndefined();
  });
});
