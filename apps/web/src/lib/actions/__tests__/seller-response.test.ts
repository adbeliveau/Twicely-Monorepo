import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitSellerResponse, updateSellerResponse } from '../seller-response';
import * as authorizeModule from '@twicely/casl/authorize';

// Mock dependencies
vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/casl/authorize');
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

import { getPlatformSetting } from '@/lib/queries/platform-settings';

const mockAuthorize = vi.mocked(authorizeModule.authorize);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);

describe('Seller Response Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
  });

  describe('submitSellerResponse', () => {
    it('successfully submits a valid response', async () => {
      // Mock authorize
      mockAuthorize.mockResolvedValue({
        session: { userId: 'seller1' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      // Mock DB queries
      const { db } = await import('@/lib/db');
      const mockSelect = vi.mocked(db.select);
      const mockInsert = vi.mocked(db.insert);

      // Mock review lookup
      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'review1',
              sellerId: 'seller1',
              createdAt: new Date(),
            }]),
          }),
        }),
      }) as never);

      // Mock existing response check (none exists)
      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }) as never);

      // Mock insert
      mockInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as never);

      const result = await submitSellerResponse('review1', 'Thank you for your purchase!');

      expect(result.success).toBe(true);
      expect(result.responseId).toBeDefined();
    });

    it('rejects response from non-seller user', async () => {
      mockAuthorize.mockResolvedValue({
        session: { userId: 'user2' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      const { db } = await import('@/lib/db');
      const mockSelect = vi.mocked(db.select);

      // Mock review owned by different seller
      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'review1',
              sellerId: 'seller1', // Different seller
              createdAt: new Date(),
            }]),
          }),
        }),
      }) as never);

      const result = await submitSellerResponse('review1', 'Test response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('only respond to reviews on your own sales');
    });

    it('rejects duplicate response', async () => {
      mockAuthorize.mockResolvedValue({
        session: { userId: 'seller1' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      const { db } = await import('@/lib/db');
      const mockSelect = vi.mocked(db.select);

      // Mock review lookup
      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'review1',
              sellerId: 'seller1',
              createdAt: new Date(),
            }]),
          }),
        }),
      }) as never);

      // Mock existing response (already exists)
      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'response1' }]),
          }),
        }),
      }) as never);

      const result = await submitSellerResponse('review1', 'Test response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('response already exists');
    });

    it('rejects response past 30-day window', async () => {
      mockAuthorize.mockResolvedValue({
        session: { userId: 'seller1' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      const { db } = await import('@/lib/db');
      const mockSelect = vi.mocked(db.select);

      // Review created 31 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'review1',
              sellerId: 'seller1',
              createdAt: oldDate,
            }]),
          }),
        }),
      }) as never);

      // Mock existing response check
      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }) as never);

      const result = await submitSellerResponse('review1', 'Test response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Response window closed');
    });

    it('rejects empty body', async () => {
      mockAuthorize.mockResolvedValue({
        session: { userId: 'seller1' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      const result = await submitSellerResponse('review1', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('rejects body exceeding 2000 characters', async () => {
      mockAuthorize.mockResolvedValue({
        session: { userId: 'seller1' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      const longBody = 'a'.repeat(2001);
      const result = await submitSellerResponse('review1', longBody);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot exceed 2000 characters');
    });
  });

  describe('updateSellerResponse', () => {
    it('successfully updates response within 48-hour window', async () => {
      mockAuthorize.mockResolvedValue({
        session: { userId: 'seller1' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      const { db } = await import('@/lib/db');
      const mockSelect = vi.mocked(db.select);
      const mockUpdate = vi.mocked(db.update);

      // Response created 1 hour ago
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 1);

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'response1',
              sellerId: 'seller1',
              createdAt: recentDate,
            }]),
          }),
        }),
      }) as never);

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const result = await updateSellerResponse('response1', 'Updated response');

      expect(result.success).toBe(true);
      expect(result.responseId).toBe('response1');
    });

    it('rejects update past 48-hour window', async () => {
      mockAuthorize.mockResolvedValue({
        session: { userId: 'seller1' } as never,
        ability: { can: vi.fn().mockReturnValue(true) } as never,
      });

      const { db } = await import('@/lib/db');
      const mockSelect = vi.mocked(db.select);

      // Response created 49 hours ago
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 49);

      mockSelect.mockImplementationOnce(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'response1',
              sellerId: 'seller1',
              createdAt: oldDate,
            }]),
          }),
        }),
      }) as never);

      const result = await updateSellerResponse('response1', 'Updated response');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Edit window closed');
    });
  });
});
