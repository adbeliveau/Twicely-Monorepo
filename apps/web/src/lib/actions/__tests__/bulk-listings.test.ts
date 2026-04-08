import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id', ownerUserId: 'owner_user_id', status: 'status',
    priceCents: 'price_cents', activatedAt: 'activated_at', pausedAt: 'paused_at',
    endedAt: 'ended_at', updatedAt: 'updated_at',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
}));
vi.mock('@/lib/services/price-history-service', () => ({
  recordPriceChange: vi.fn().mockResolvedValue(undefined),
}));

import { bulkUpdateListingsAction } from '../bulk-listings';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);

// Valid CUID2 listing IDs
const L1 = 'cm1a2b3c4d5e6f7g8h9i0j1k';
const L2 = 'cm2a2b3c4d5e6f7g8h9i0j1k';
const L3 = 'cm3a2b3c4d5e6f7g8h9i0j1k';
const USER_ID = 'user-test-001';

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function makeSelectChain(data: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(data),
  };
}

function makeAuthSession(userId = USER_ID, canUpdate = true) {
  return {
    ability: { can: vi.fn().mockReturnValue(canUpdate) } as never,
    session: { userId, delegationId: null } as never,
  };
}

describe('bulkUpdateListingsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue(makeAuthSession());
  });

  describe('Auth + CASL gates', () => {
    it('returns error when unauthenticated', async () => {
      mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => false) } as never, session: null });
      const result = await bulkUpdateListingsAction([L1], 'ACTIVATE');
      expect(result.success).toBe(false);
      expect(result.errors[0]?.error).toMatch(/unauthorized/i);
    });

    it('returns error when CASL forbids Listing update', async () => {
      mockAuthorize.mockResolvedValue(makeAuthSession(USER_ID, false));
      const result = await bulkUpdateListingsAction([L1], 'ACTIVATE');
      expect(result.success).toBe(false);
      expect(result.errors[0]?.error).toMatch(/forbidden/i);
    });
  });

  describe('Input validation', () => {
    it('returns error for invalid CUID2 listing IDs', async () => {
      const result = await bulkUpdateListingsAction(['not-a-cuid2'], 'ACTIVATE');
      expect(result.success).toBe(false);
    });

    it('returns error for empty listingIds array', async () => {
      const result = await bulkUpdateListingsAction([], 'ACTIVATE');
      expect(result.success).toBe(false);
    });

    it('requires priceAdjustment parameter for PRICE_ADJUST action', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
      ]) as never);
      const result = await bulkUpdateListingsAction([L1], 'PRICE_ADJUST');
      expect(result.success).toBe(false);
      expect(result.errors[0]?.error).toMatch(/price adjustment parameters required/i);
    });
  });

  describe('ACTIVATE action', () => {
    it('activates DRAFT and PAUSED listings', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'DRAFT', priceCents: 1000 },
        { id: L2, ownerUserId: USER_ID, status: 'PAUSED', priceCents: 2000 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      const result = await bulkUpdateListingsAction([L1, L2], 'ACTIVATE');
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('skips and reports error for ACTIVE listings (cannot re-activate)', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
      ]) as never);

      const result = await bulkUpdateListingsAction([L1], 'ACTIVATE');
      expect(result.failed).toBe(1);
      expect(result.errors[0]?.error).toMatch(/cannot activate/i);
    });
  });

  describe('DEACTIVATE action', () => {
    it('pauses ACTIVE listings', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      const result = await bulkUpdateListingsAction([L1], 'DEACTIVATE');
      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
    });

    it('skips and reports error for non-ACTIVE listings', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'DRAFT', priceCents: 1000 },
      ]) as never);

      const result = await bulkUpdateListingsAction([L1], 'DEACTIVATE');
      expect(result.failed).toBe(1);
      expect(result.errors[0]?.error).toMatch(/cannot deactivate/i);
    });
  });

  describe('DELETE action', () => {
    it('ends ACTIVE, DRAFT, and PAUSED listings', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
        { id: L2, ownerUserId: USER_ID, status: 'DRAFT', priceCents: 2000 },
        { id: L3, ownerUserId: USER_ID, status: 'PAUSED', priceCents: 3000 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      const result = await bulkUpdateListingsAction([L1, L2, L3], 'DELETE');
      expect(result.processed).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('filters out SOLD listings — cannot delete sold listing archive', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
        { id: L2, ownerUserId: USER_ID, status: 'SOLD', priceCents: 2000 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      const result = await bulkUpdateListingsAction([L1, L2], 'DELETE');
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]?.error).toMatch(/cannot delete sold/i);
    });
  });

  describe('PRICE_ADJUST action', () => {
    it('applies PERCENTAGE DECREASE and enforces minimum 1 cent floor', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 100 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      const result = await bulkUpdateListingsAction([L1], 'PRICE_ADJUST', {
        type: 'PERCENTAGE', value: 99, direction: 'DECREASE',
      });
      // 100 * (1 - 0.99) = 1 cent — exactly the floor
      expect(result.processed).toBe(1);
    });

    it('uses Math.round for PERCENTAGE adjustments (integer math preserved)', async () => {
      // 333 * 1.10 = 366.3 → rounds to 366
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 333 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      await bulkUpdateListingsAction([L1], 'PRICE_ADJUST', {
        type: 'PERCENTAGE', value: 10, direction: 'INCREASE',
      });
      const setCall = (mockUpdate.mock.results[0]?.value as { set: ReturnType<typeof vi.fn> }).set;
      expect(setCall).toHaveBeenCalledWith(expect.objectContaining({ priceCents: 366 }));
    });

    it('applies FIXED INCREASE in cents', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      await bulkUpdateListingsAction([L1], 'PRICE_ADJUST', {
        type: 'FIXED', value: 500, direction: 'INCREASE',
      });
      const setCall = (mockUpdate.mock.results[0]?.value as { set: ReturnType<typeof vi.fn> }).set;
      expect(setCall).toHaveBeenCalledWith(expect.objectContaining({ priceCents: 1500 }));
    });

    it('skips listings where price would not change', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
      ]) as never);

      const result = await bulkUpdateListingsAction([L1], 'PRICE_ADJUST', {
        type: 'FIXED', value: 0, direction: 'INCREASE',
      });
      // newPrice === oldPrice, so nothing to process
      expect(result.processed).toBe(0);
    });

    it('skips DRAFT and ENDED listings for price adjustment', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'DRAFT', priceCents: 1000 },
        { id: L2, ownerUserId: USER_ID, status: 'ENDED', priceCents: 2000 },
      ]) as never);

      const result = await bulkUpdateListingsAction([L1, L2], 'PRICE_ADJUST', {
        type: 'FIXED', value: 100, direction: 'INCREASE',
      });
      expect(result.failed).toBe(2);
    });
  });

  describe('Ownership enforcement', () => {
    it('only processes listings owned by the authenticated user', async () => {
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'ACTIVE', priceCents: 1000 },
        { id: L2, ownerUserId: 'other-user', status: 'ACTIVE', priceCents: 2000 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      const result = await bulkUpdateListingsAction([L1, L2], 'DEACTIVATE');
      // L2 is owned by other-user so it should not be processed
      // But the filter happens on ownedListings.filter(ownerUserId === userId)
      // L2 would be in ownedListings if the DB returns it - it's filtered by the implementation
      expect(result.processed).toBe(1); // only L1 owned by USER_ID
    });

    it('reports not-owned IDs as errors', async () => {
      // listingIds has L2, but DB only returns L1 as owned (L2 is not found)
      mockSelect.mockReturnValue(makeSelectChain([
        { id: L1, ownerUserId: USER_ID, status: 'DRAFT', priceCents: 1000 },
      ]) as never);
      mockUpdate.mockReturnValue(makeUpdateChain() as never);

      const result = await bulkUpdateListingsAction([L1, L2], 'ACTIVATE');
      expect(result.errors.some(e => e.listingId === L2)).toBe(true);
    });
  });
});
