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

describe('processBackInStockAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('triggers BACK_IN_STOCK alerts on status change to ACTIVE', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ title: 'Test Item', slug: 'test-item', priceCents: 10000 }]),
        }),
      }),
    });

    mockGetBackInStockAlerts.mockResolvedValue([
      { id: 'alert-1', userId: 'buyer-1' },
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

    const { processBackInStockAlerts } = await import('../price-alert-processor');
    const result = await processBackInStockAlerts('listing-1');

    expect(result).toEqual({ triggered: 1, total: 1 });
    expect(mockNotify).toHaveBeenCalledWith('buyer-1', 'price_alert.back_in_stock', expect.any(Object));
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});
