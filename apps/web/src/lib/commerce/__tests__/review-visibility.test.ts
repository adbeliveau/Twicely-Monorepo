import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

import { updateReviewVisibility } from '../review-visibility';
import { db } from '@twicely/db';

const mockTransaction = vi.mocked(db.transaction);

describe('updateReviewVisibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets visibleAt to max(createdAt) + editWindowHours when both reviews exist', async () => {
    const b2sCreatedAt = new Date('2024-01-01T10:00:00Z');
    const s2bCreatedAt = new Date('2024-01-01T14:00:00Z'); // Later
    const deliveredAt = new Date('2024-01-01T00:00:00Z');

    const updateCalls: Array<{ visibleAt: Date }> = [];
    let selectCallIdx = 0;

    mockTransaction.mockImplementation(async (callback) => {
      const mockQueryChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallIdx++;
          if (selectCallIdx === 1) {
            // Order query
            return Promise.resolve([{ deliveredAt }]);
          } else if (selectCallIdx === 2) {
            // b2s query (review table)
            return Promise.resolve([{ id: 'b2s-review', createdAt: b2sCreatedAt }]);
          } else {
            // s2b query (buyerReview table)
            return Promise.resolve([{ id: 's2b-review', createdAt: s2bCreatedAt }]);
          }
        }),
      };

      const mockUpdateChain = {
        set: vi.fn().mockImplementation((data: { visibleAt: Date }) => {
          updateCalls.push({ visibleAt: data.visibleAt });
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      };

      const tx = {
        select: vi.fn().mockReturnValue(mockQueryChain),
        update: vi.fn().mockReturnValue(mockUpdateChain),
      };

      return callback(tx as never);
    });

    await updateReviewVisibility('order1');

    expect(updateCalls).toHaveLength(2);
    // Both should have visibleAt = s2bCreatedAt + 24h (the later one, default editWindowHours=24)
    const expectedVisibleAt = new Date(s2bCreatedAt);
    expectedVisibleAt.setHours(expectedVisibleAt.getHours() + 24);

    updateCalls.forEach((call) => {
      expect(call.visibleAt.getTime()).toBe(expectedVisibleAt.getTime());
    });
  });

  it('sets visibleAt to deliveredAt + windowDays when only b2s exists', async () => {
    const b2sCreatedAt = new Date('2024-01-01T10:00:00Z');
    const deliveredAt = new Date('2024-01-01T00:00:00Z');

    let updateVisibleAt: Date | null = null;
    let selectCallIdx = 0;

    mockTransaction.mockImplementation(async (callback) => {
      const mockQueryChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallIdx++;
          if (selectCallIdx === 1) {
            return Promise.resolve([{ deliveredAt }]);
          } else if (selectCallIdx === 2) {
            // b2s exists
            return Promise.resolve([{ id: 'b2s-review', createdAt: b2sCreatedAt }]);
          } else {
            // No s2b
            return Promise.resolve([]);
          }
        }),
      };

      const mockUpdateChain = {
        set: vi.fn().mockImplementation((data: { visibleAt: Date }) => {
          updateVisibleAt = data.visibleAt;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      };

      const tx = {
        select: vi.fn().mockReturnValue(mockQueryChain),
        update: vi.fn().mockReturnValue(mockUpdateChain),
      };

      return callback(tx as never);
    });

    await updateReviewVisibility('order1');

    const expectedVisibleAt = new Date(deliveredAt);
    expectedVisibleAt.setDate(expectedVisibleAt.getDate() + 60);

    expect(updateVisibleAt).not.toBeNull();
    expect(updateVisibleAt!.getTime()).toBe(expectedVisibleAt.getTime());
  });

  it('sets visibleAt to deliveredAt + windowDays when only s2b exists', async () => {
    const s2bCreatedAt = new Date('2024-01-01T14:00:00Z');
    const deliveredAt = new Date('2024-01-01T00:00:00Z');

    let updateVisibleAt: Date | null = null;
    let selectCallIdx = 0;

    mockTransaction.mockImplementation(async (callback) => {
      const mockQueryChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallIdx++;
          if (selectCallIdx === 1) {
            return Promise.resolve([{ deliveredAt }]);
          } else if (selectCallIdx === 2) {
            // No b2s
            return Promise.resolve([]);
          } else {
            // s2b exists
            return Promise.resolve([{ id: 's2b-review', createdAt: s2bCreatedAt }]);
          }
        }),
      };

      const mockUpdateChain = {
        set: vi.fn().mockImplementation((data: { visibleAt: Date }) => {
          updateVisibleAt = data.visibleAt;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      };

      const tx = {
        select: vi.fn().mockReturnValue(mockQueryChain),
        update: vi.fn().mockReturnValue(mockUpdateChain),
      };

      return callback(tx as never);
    });

    await updateReviewVisibility('order1');

    const expectedVisibleAt = new Date(deliveredAt);
    expectedVisibleAt.setDate(expectedVisibleAt.getDate() + 60);

    expect(updateVisibleAt).not.toBeNull();
    expect(updateVisibleAt!.getTime()).toBe(expectedVisibleAt.getTime());
  });

  it('makes no updates when neither review exists', async () => {
    const deliveredAt = new Date('2024-01-01T00:00:00Z');
    let updateCallCount = 0;
    let selectCallIdx = 0;

    mockTransaction.mockImplementation(async (callback) => {
      const mockQueryChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockImplementation(() => {
          selectCallIdx++;
          if (selectCallIdx === 1) {
            return Promise.resolve([{ deliveredAt }]);
          } else {
            // No reviews
            return Promise.resolve([]);
          }
        }),
      };

      const tx = {
        select: vi.fn().mockReturnValue(mockQueryChain),
        update: vi.fn().mockImplementation(() => {
          updateCallCount++;
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          };
        }),
      };

      return callback(tx as never);
    });

    await updateReviewVisibility('order1');

    expect(updateCallCount).toBe(0);
  });
});
