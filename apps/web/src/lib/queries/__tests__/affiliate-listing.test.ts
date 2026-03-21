/**
 * Tests for getListingAffiliateInfo query (G3.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockGetPlatformSetting = vi.fn();
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  affiliate: { id: 'id', status: 'status', referralCode: 'referralCode', userId: 'userId' },
  sellerProfile: { affiliateOptIn: 'affiliateOptIn', affiliateCommissionBps: 'affiliateCommissionBps', userId: 'userId' },
}));

import { getListingAffiliateInfo } from '../affiliate-listing';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupParallelSelects(affiliateRows: unknown[], sellerProfileRows: unknown[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(affiliateRows);
      return Promise.resolve(sellerProfileRows);
    }),
  };
  mockDbSelect.mockReturnValue(chain);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getListingAffiliateInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(300);
  });

  describe('viewer is null (guest)', () => {
    it('returns isAffiliate=false with platform default commission', async () => {
      mockGetPlatformSetting.mockResolvedValue(300);
      const result = await getListingAffiliateInfo(null, 'seller-001');
      expect(result.isAffiliate).toBe(false);
      expect(result.affiliateCode).toBeNull();
      expect(result.affiliateStatus).toBeNull();
      expect(result.commissionBps).toBe(300);
    });
  });

  describe('viewer has no affiliate record', () => {
    it('returns isAffiliate=false with seller opt-in state', async () => {
      setupParallelSelects(
        [],  // no affiliate row
        [{ affiliateOptIn: true, affiliateCommissionBps: null }],
      );
      const result = await getListingAffiliateInfo('viewer-001', 'seller-001');
      expect(result.isAffiliate).toBe(false);
      expect(result.affiliateCode).toBeNull();
      expect(result.sellerOptedIn).toBe(true);
      expect(result.commissionBps).toBe(300);
    });

    it('returns sellerOptedIn=false when seller opted out', async () => {
      setupParallelSelects(
        [],
        [{ affiliateOptIn: false, affiliateCommissionBps: null }],
      );
      const result = await getListingAffiliateInfo('viewer-001', 'seller-001');
      expect(result.sellerOptedIn).toBe(false);
    });
  });

  describe('viewer is an active affiliate', () => {
    it('returns isAffiliate=true with code and status', async () => {
      setupParallelSelects(
        [{ id: 'aff-001', status: 'ACTIVE', referralCode: 'MYCODE' }],
        [{ affiliateOptIn: true, affiliateCommissionBps: null }],
      );
      const result = await getListingAffiliateInfo('viewer-001', 'seller-001');
      expect(result.isAffiliate).toBe(true);
      expect(result.affiliateCode).toBe('MYCODE');
      expect(result.affiliateStatus).toBe('ACTIVE');
      expect(result.sellerOptedIn).toBe(true);
      expect(result.commissionBps).toBe(300);  // platform default
    });

    it('uses seller custom commission rate when set', async () => {
      setupParallelSelects(
        [{ id: 'aff-001', status: 'ACTIVE', referralCode: 'MYCODE' }],
        [{ affiliateOptIn: true, affiliateCommissionBps: 500 }],
      );
      const result = await getListingAffiliateInfo('viewer-001', 'seller-001');
      expect(result.commissionBps).toBe(500);
    });

    it('falls back to platform default when seller commissionBps is null', async () => {
      mockGetPlatformSetting.mockResolvedValue(300);
      setupParallelSelects(
        [{ id: 'aff-001', status: 'ACTIVE', referralCode: 'MYCODE' }],
        [{ affiliateOptIn: true, affiliateCommissionBps: null }],
      );
      const result = await getListingAffiliateInfo('viewer-001', 'seller-001');
      expect(result.commissionBps).toBe(300);
    });

    it('returns sellerOptedIn=false when seller opted out (even if affiliate is active)', async () => {
      setupParallelSelects(
        [{ id: 'aff-001', status: 'ACTIVE', referralCode: 'MYCODE' }],
        [{ affiliateOptIn: false, affiliateCommissionBps: null }],
      );
      const result = await getListingAffiliateInfo('viewer-001', 'seller-001');
      expect(result.sellerOptedIn).toBe(false);
    });
  });

  describe('viewer is a suspended affiliate', () => {
    it('returns isAffiliate=true but affiliateStatus=SUSPENDED', async () => {
      setupParallelSelects(
        [{ id: 'aff-001', status: 'SUSPENDED', referralCode: 'MYCODE' }],
        [{ affiliateOptIn: true, affiliateCommissionBps: null }],
      );
      const result = await getListingAffiliateInfo('viewer-001', 'seller-001');
      expect(result.isAffiliate).toBe(true);
      expect(result.affiliateStatus).toBe('SUSPENDED');
    });
  });
});
