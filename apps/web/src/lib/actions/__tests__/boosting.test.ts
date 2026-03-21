import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: (type: string, conditions: Record<string, unknown>) => ({ ...conditions, __caslSubjectType__: type }),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', ownerUserId: 'owner_user_id', status: 'status', boostPercent: 'boost_percent', boostStartedAt: 'boost_started_at', updatedAt: 'updated_at' },
  promotedListing: { id: 'id', listingId: 'listing_id', sellerId: 'seller_id', boostPercent: 'boost_percent', isActive: 'is_active', endedAt: 'ended_at', updatedAt: 'updated_at' },
  sellerProfile: { id: 'id', userId: 'user_id', storeTier: 'store_tier' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));
vi.mock('@/lib/queries/boosting', () => ({
  getPromotedListingByListingId: vi.fn(),
}));
vi.mock('@twicely/utils/tier-gates', () => ({
  canUseFeature: vi.fn((tier: string) => tier === 'PRO' || tier === 'POWER' || tier === 'ENTERPRISE'),
}));
vi.mock('@twicely/commerce/boosting', () => ({
  validateBoostRate: vi.fn((rate: number) => rate <= 8 ? { valid: true } : { valid: false, error: `Boost rate cannot exceed 8%` }),
}));

import { activateBoost, deactivateBoost, updateBoostRate } from '../boosting';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPromotedListingByListingId } from '@/lib/queries/boosting';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockGetPromotedListing = vi.mocked(getPromotedListingByListingId);

// Test CUID2 IDs (valid format for Zod cuid2 validation)
const L1 = 'cm1a2b3c4d5e6f7g8h9i0j1k';
const SP1 = 'cm2a2b3c4d5e6f7g8h9i0j1k';
const PL1 = 'cm3a2b3c4d5e6f7g8h9i0j1k';

describe('D2.4: Boosting Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('activateBoost', () => {
    it('returns error if not authenticated', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: null });
      const result = await activateBoost({ listingId: L1, boostPercent: 5 });
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error if seller below PRO tier', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: SP1, storeTier: 'STARTER' }]) }),
        }),
      } as never);
      const result = await activateBoost({ listingId: L1, boostPercent: 5 });
      expect(result).toEqual({ success: false, error: 'Boosting requires Pro plan or higher' });
    });

    it('returns error if listing not owned by user', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: SP1, storeTier: 'PRO' }]);
      selectMock.mockResolvedValueOnce([{ id: L1, ownerUserId: 'other-user', status: 'ACTIVE' }]);

      const result = await activateBoost({ listingId: L1, boostPercent: 5 });
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error if listing already boosted', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: SP1, storeTier: 'PRO' }]);
      selectMock.mockResolvedValueOnce([{ id: L1, ownerUserId: 'u1', status: 'ACTIVE' }]);
      mockGetPromotedListing.mockResolvedValue({ id: PL1, isActive: true } as never);

      const result = await activateBoost({ listingId: L1, boostPercent: 5 });
      expect(result).toEqual({ success: false, error: 'Listing already boosted' });
    });

    it('succeeds and inserts promoted_listing + updates listing', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: SP1, storeTier: 'PRO' }]);
      selectMock.mockResolvedValueOnce([{ id: L1, ownerUserId: 'u1', status: 'ACTIVE' }]);
      mockGetPromotedListing.mockResolvedValue(null);
      mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);
      mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);

      const result = await activateBoost({ listingId: L1, boostPercent: 5 });
      expect(result).toEqual({ success: true });
      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('returns error for invalid boost rate (above 8%)', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: SP1, storeTier: 'PRO' }]);

      const result = await activateBoost({ listingId: L1, boostPercent: 15 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot exceed');
    });
  });

  describe('deactivateBoost', () => {
    it('returns error if not authenticated', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: null });
      const result = await deactivateBoost({ listingId: L1 });
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('returns error if no active boost exists', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: L1, ownerUserId: 'u1' }]);
      mockGetPromotedListing.mockResolvedValue(null);

      const result = await deactivateBoost({ listingId: L1 });
      expect(result).toEqual({ success: false, error: 'No active boost found for this listing' });
    });

    it('succeeds and deactivates boost + clears listing fields', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: L1, ownerUserId: 'u1' }]);
      mockGetPromotedListing.mockResolvedValue({ id: PL1, isActive: true } as never);
      mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);

      const result = await deactivateBoost({ listingId: L1 });
      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateBoostRate', () => {
    it('succeeds and updates rate on both records', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: SP1, storeTier: 'PRO' }]);
      selectMock.mockResolvedValueOnce([{ id: L1, ownerUserId: 'u1' }]);
      mockGetPromotedListing.mockResolvedValue({ id: PL1, isActive: true } as never);
      mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);

      const result = await updateBoostRate({ listingId: L1, boostPercent: 6 });
      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('returns error for invalid rate (above max)', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: { userId: 'u1' } as never });
      const selectMock = vi.fn();
      mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectMock }) }) } as never);
      selectMock.mockResolvedValueOnce([{ id: SP1, storeTier: 'PRO' }]);

      const result = await updateBoostRate({ listingId: L1, boostPercent: 12 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot exceed');
    });
  });
});
