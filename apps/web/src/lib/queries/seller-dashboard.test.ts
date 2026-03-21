import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSellerDashboardStats, getSellerRecentActivity } from './seller-dashboard';
import { db } from '@twicely/db';

// Mock the database
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('getSellerDashboardStats', () => {
  const mockSellerId = 'test-seller-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return dashboard stats with revenue, orders, listings, and views', async () => {
    // Mock the database responses
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 50000 }]),
        }),
        where: vi.fn().mockResolvedValue([{ count: 10 }]),
      }),
    });

    (db.select as unknown) = mockSelect;

    const stats = await getSellerDashboardStats(mockSellerId);

    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('revenue30d');
    expect(stats).toHaveProperty('revenuePrev30d');
    expect(stats).toHaveProperty('orders30d');
    expect(stats).toHaveProperty('ordersPrev30d');
    expect(stats).toHaveProperty('activeListings');
    expect(stats).toHaveProperty('draftListings');
    expect(stats).toHaveProperty('views30d');
    expect(stats).toHaveProperty('viewsPrev30d');
    expect(stats).toHaveProperty('awaitingShipmentCount');
  });

  it('should handle zero values correctly', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: null }]),
        }),
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    });

    (db.select as unknown) = mockSelect;

    const stats = await getSellerDashboardStats(mockSellerId);

    expect(stats.revenue30d).toBe(0);
    expect(stats.activeListings).toBe(0);
    expect(stats.awaitingShipmentCount).toBe(0);
  });
});

describe('getSellerRecentActivity', () => {
  const mockSellerId = 'test-seller-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return recent activity sorted by timestamp', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'order-1',
                orderNumber: 'ORD-001',
                status: 'PAID',
                createdAt: new Date('2024-02-15'),
              },
            ]),
          }),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  listingId: 'listing-1',
                  listingTitle: 'Test Item',
                  createdAt: new Date('2024-02-14'),
                },
              ]),
            }),
          }),
        }),
      }),
    });

    (db.select as unknown) = mockSelect;

    const activities = await getSellerRecentActivity(mockSellerId, 10);

    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBeLessThanOrEqual(10);

    if (activities.length > 0) {
      expect(activities[0]).toHaveProperty('type');
      expect(activities[0]).toHaveProperty('description');
      expect(activities[0]).toHaveProperty('timestamp');
      expect(activities[0]).toHaveProperty('linkUrl');
    }
  });

  it('should respect the limit parameter', async () => {
    const limit = 5;
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    });

    (db.select as unknown) = mockSelect;

    const activities = await getSellerRecentActivity(mockSellerId, limit);

    expect(activities.length).toBeLessThanOrEqual(limit);
  });
});
