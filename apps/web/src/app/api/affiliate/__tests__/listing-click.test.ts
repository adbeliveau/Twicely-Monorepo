/**
 * Tests for POST /api/affiliate/listing-click (G3.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockGetPlatformSetting = vi.fn();
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

const mockGetAffiliateByReferralCode = vi.fn();
vi.mock('@/lib/queries/affiliate', () => ({
  getAffiliateByReferralCode: (...args: unknown[]) => mockGetAffiliateByReferralCode(...args),
}));

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

const mockCookiesGet = vi.fn();
const mockCookiesSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    get: mockCookiesGet,
    set: mockCookiesSet,
  }),
}));

const mockCheckSelfReferralByIp = vi.fn();
vi.mock('@/lib/affiliate/fraud-detection', () => ({
  checkSelfReferralByIp: (...args: unknown[]) => mockCheckSelfReferralByIp(...args),
}));

const mockEscalateAffiliate = vi.fn();
vi.mock('@/lib/affiliate/fraud-escalation', () => ({
  escalateAffiliate: (...args: unknown[]) => mockEscalateAffiliate(...args),
}));

vi.mock('@twicely/db/schema', () => ({
  referral: { id: 'id', affiliateId: 'affiliateId', status: 'status', expiresAt: 'expiresAt', ipAddress: 'ipAddress', userAgent: 'userAgent', listingId: 'listingId' },
  listing: { id: 'id', status: 'status', ownerUserId: 'ownerUserId' },
  sellerProfile: { affiliateOptIn: 'affiliateOptIn', userId: 'userId' },
  auditEvent: { id: 'id' },
}));

import { POST } from '../listing-click/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/affiliate/listing-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_AFFILIATE = {
  id: 'aff-001',
  userId: 'user-seller-001',
  status: 'ACTIVE',
  referralCode: 'TESTCODE',
  cookieDurationDays: 30,
};

const VALID_LISTING = {
  id: 'listing-001',
  status: 'ACTIVE',
  ownerUserId: 'user-other-001',
};

function setupInsertChain(returning: unknown[]) {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  };
  mockDbInsert.mockReturnValue(chain);
  return chain;
}

// ─── Tests: invalid input ─────────────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — input validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest('http://localhost/api/affiliate/listing-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 when referralCode is missing', async () => {
    const res = await POST(makeRequest({ listingId: 'l1', listingSlug: 'slug' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when listingId is missing', async () => {
    const res = await POST(makeRequest({ referralCode: 'CODE', listingSlug: 'slug' }));
    expect(res.status).toBe(400);
  });
});

// ─── Tests: feature flag off ──────────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — feature flag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns attributed=false when listingLinkEnabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'affiliate.listingLinkEnabled') return Promise.resolve(false);
      return Promise.resolve(true);
    });

    const res = await POST(makeRequest({ referralCode: 'CODE', listingId: 'l1', listingSlug: 'slug' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.attributed).toBe(false);
  });
});

// ─── Tests: affiliate not found / inactive ────────────────────────────────────

describe('POST /api/affiliate/listing-click — affiliate lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
  });

  it('returns attributed=false when affiliate not found', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue(null);
    const res = await POST(makeRequest({ referralCode: 'NOCODE', listingId: 'l1', listingSlug: 'slug' }));
    const body = await res.json();
    expect(body.attributed).toBe(false);
  });

  it('returns attributed=false when affiliate is SUSPENDED', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...VALID_AFFILIATE, status: 'SUSPENDED' });
    const res = await POST(makeRequest({ referralCode: 'CODE', listingId: 'l1', listingSlug: 'slug' }));
    const body = await res.json();
    expect(body.attributed).toBe(false);
  });
});

// ─── Tests: self-referral ─────────────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — self-referral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(VALID_AFFILIATE);
    mockCheckSelfReferralByIp.mockResolvedValue({ flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING' });
    mockCookiesGet.mockReturnValue(undefined);
  });

  it('returns attributed=false when affiliate owns the listing', async () => {
    // listingRow.ownerUserId === aff.userId — self-referral detected before seller opt-in check
    let callCount = 0;
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ id: 'listing-001', status: 'ACTIVE', ownerUserId: VALID_AFFILIATE.userId }]);
        }
        return Promise.resolve([{ affiliateOptIn: true }]);
      }),
    };
    mockDbSelect.mockReturnValue(chain);

    const res = await POST(makeRequest({ referralCode: 'TESTCODE', listingId: 'listing-001', listingSlug: 'slug' }));
    const body = await res.json();
    expect(body.attributed).toBe(false);
  });
});

// ─── Tests: successful attribution ───────────────────────────────────────────

describe('POST /api/affiliate/listing-click — successful attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'affiliate.listingLinkEnabled') return Promise.resolve(true);
      if (key === 'affiliate.fraud.enabled') return Promise.resolve(false);
      if (key === 'affiliate.listingAttributionWindowDays') return Promise.resolve(7);
      return Promise.resolve(fallback);
    });
    mockGetAffiliateByReferralCode.mockResolvedValue(VALID_AFFILIATE);
    mockCheckSelfReferralByIp.mockResolvedValue({ flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING' });
    mockCookiesGet.mockReturnValue(undefined);
  });

  it('sets cookie and returns attributed=true on valid click', async () => {
    let callCount = 0;
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([VALID_LISTING]);
        return Promise.resolve([{ affiliateOptIn: true }]);
      }),
    };
    mockDbSelect.mockReturnValue(chain);
    setupInsertChain([{ id: 'ref-new-001' }]);

    const res = await POST(makeRequest({ referralCode: 'TESTCODE', listingId: 'listing-001', listingSlug: 'test-listing' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.attributed).toBe(true);
    expect(mockCookiesSet).toHaveBeenCalledOnce();
  });

  it('returns attributed=false when existing cookie present (first-touch wins)', async () => {
    let callCount = 0;
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([VALID_LISTING]);
        return Promise.resolve([{ affiliateOptIn: true }]);
      }),
    };
    mockDbSelect.mockReturnValue(chain);
    // Existing cookie present
    mockCookiesGet.mockReturnValue({ value: '{"referralId":"old"}' });

    const res = await POST(makeRequest({ referralCode: 'TESTCODE', listingId: 'listing-001', listingSlug: 'test-listing' }));
    const body = await res.json();
    expect(body.attributed).toBe(false);
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});
