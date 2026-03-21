import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
const mockDb = {
  select: mockDbSelect,
  update: mockDbUpdate,
};

const mockNotify = vi.fn().mockResolvedValue(undefined);
const mockGetActiveAlertsForListing = vi.fn();
const mockGetBackInStockAlerts = vi.fn();

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));
vi.mock('@/lib/queries/price-alerts', () => ({
  getActiveAlertsForListing: mockGetActiveAlertsForListing,
  getBackInStockAlerts: mockGetBackInStockAlerts,
}));
describe('processPriceAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not process when price increased', async () => {
    const { processPriceAlerts } = await import('../price-alert-processor');
    const result = await processPriceAlerts('listing-1', 12000, 10000);

    expect(result).toEqual({ triggered: 0, total: 0 });
    expect(mockGetActiveAlertsForListing).not.toHaveBeenCalled();
  });

  it('triggers ANY_DROP alert when price decreases', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    mockGetActiveAlertsForListing.mockResolvedValue([
      { id: 'alert-1', userId: 'buyer-1', alertType: 'ANY_DROP', targetPriceCents: null, percentDrop: null },
    ]);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ name: 'Buyer One' }]),
        }),
      }),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { processPriceAlerts } = await import('../price-alert-processor');
    const result = await processPriceAlerts('listing-1', 8000, 10000);

    expect(result).toEqual({ triggered: 1, total: 1 });
    expect(mockNotify).toHaveBeenCalledWith('buyer-1', 'price_alert.triggered', expect.any(Object));
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it('triggers TARGET_PRICE alert when price reaches target', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    mockGetActiveAlertsForListing.mockResolvedValue([
      { id: 'alert-1', userId: 'buyer-1', alertType: 'TARGET_PRICE', targetPriceCents: 7500, percentDrop: null },
    ]);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ name: 'Buyer One' }]),
        }),
      }),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { processPriceAlerts } = await import('../price-alert-processor');
    const result = await processPriceAlerts('listing-1', 7000, 10000);

    expect(result).toEqual({ triggered: 1, total: 1 });
    expect(mockNotify).toHaveBeenCalled();
  });

  it('does not trigger TARGET_PRICE alert when price above target', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    mockGetActiveAlertsForListing.mockResolvedValue([
      { id: 'alert-1', userId: 'buyer-1', alertType: 'TARGET_PRICE', targetPriceCents: 7500, percentDrop: null },
    ]);

    const { processPriceAlerts } = await import('../price-alert-processor');
    const result = await processPriceAlerts('listing-1', 9000, 10000);

    expect(result).toEqual({ triggered: 0, total: 1 });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('triggers PERCENT_DROP alert when drop meets threshold', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    mockGetActiveAlertsForListing.mockResolvedValue([
      {
        id: 'alert-1',
        userId: 'buyer-1',
        alertType: 'PERCENT_DROP',
        targetPriceCents: null,
        percentDrop: 20,
        priceCentsAtCreation: 10000, // Price when alert was created
      },
    ]);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ name: 'Buyer One' }]),
        }),
      }),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { processPriceAlerts } = await import('../price-alert-processor');
    // 25% drop from creation price: 10000 -> 7500
    const result = await processPriceAlerts('listing-1', 7500, 10000);

    expect(result).toEqual({ triggered: 1, total: 1 });
    expect(mockNotify).toHaveBeenCalled();
  });

  it('does not re-trigger already triggered alert (deactivated)', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    // Active alerts query returns empty (all already triggered)
    mockGetActiveAlertsForListing.mockResolvedValue([]);

    const { processPriceAlerts } = await import('../price-alert-processor');
    const result = await processPriceAlerts('listing-1', 8000, 10000);

    expect(result).toEqual({ triggered: 0, total: 0 });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('uses price_alert.triggered notification template, not watchlist.price_drop', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    mockGetActiveAlertsForListing.mockResolvedValue([
      { id: 'alert-1', userId: 'buyer-1', alertType: 'ANY_DROP', targetPriceCents: null, percentDrop: null },
    ]);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ name: 'Buyer One' }]),
        }),
      }),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { processPriceAlerts } = await import('../price-alert-processor');
    await processPriceAlerts('listing-1', 8000, 10000);

    // Must use price_alert.triggered, NOT watchlist.price_drop
    expect(mockNotify).toHaveBeenCalledWith('buyer-1', 'price_alert.triggered', expect.any(Object));
    expect(mockNotify).not.toHaveBeenCalledWith('buyer-1', 'watchlist.price_drop', expect.any(Object));
  });

  it('PERCENT_DROP triggers based on price at alert creation, not previous price', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    // Alert was created when price was $100 (10000 cents)
    // User wants 20% drop notification
    // Price dropped: $100 -> $90 -> $82 (gradual drops)
    // Cumulative drop from $100 to $82 = 18% (should NOT trigger)
    mockGetActiveAlertsForListing.mockResolvedValue([
      {
        id: 'alert-1',
        userId: 'buyer-1',
        alertType: 'PERCENT_DROP',
        targetPriceCents: null,
        percentDrop: 20,
        priceCentsAtCreation: 10000, // $100 when alert was set
      },
    ]);

    const { processPriceAlerts } = await import('../price-alert-processor');

    // Price dropped from $90 to $82 (previousPrice=$90, newPrice=$82)
    // Using previousPrice only: (9000-8200)/9000 = 8.9% drop - would NOT trigger
    // Using priceCentsAtCreation: (10000-8200)/10000 = 18% drop - should NOT trigger
    const result = await processPriceAlerts('listing-1', 8200, 9000);

    expect(result).toEqual({ triggered: 0, total: 1 });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('PERCENT_DROP triggers when cumulative drop from creation price meets threshold', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item' }]),
        }),
      }),
    });

    // Alert was created when price was $100 (10000 cents)
    // User wants 20% drop notification
    mockGetActiveAlertsForListing.mockResolvedValue([
      {
        id: 'alert-1',
        userId: 'buyer-1',
        alertType: 'PERCENT_DROP',
        targetPriceCents: null,
        percentDrop: 20,
        priceCentsAtCreation: 10000, // $100 when alert was set
      },
    ]);

    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ name: 'Buyer One' }]),
        }),
      }),
    });

    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const { processPriceAlerts } = await import('../price-alert-processor');

    // Price dropped from $85 to $79 (previousPrice=$85, newPrice=$79)
    // Using priceCentsAtCreation: (10000-7900)/10000 = 21% drop - SHOULD trigger
    const result = await processPriceAlerts('listing-1', 7900, 8500);

    expect(result).toEqual({ triggered: 1, total: 1 });
    expect(mockNotify).toHaveBeenCalled();
  });
});
