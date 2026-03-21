/**
 * Tests for POST /api/affiliate/listing-click — guard conditions (G3.6)
 *
 * Covers: feature flag disabled, inactive/suspended/null affiliate,
 * inactive listing. Seller opt-out and self-referral are in
 * listing-click-seller-referral.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const {
  mockCookiesGet: _mockCookiesGet, mockCookiesSet, mockCookiesStore,
  mockDbSelect, mockDbInsert,
  mockGetPlatformSetting, mockGetAffiliateByReferralCode,
  mockCheckSelfReferralByIp,
} = vi.hoisted(() => {
  const get = vi.fn();
  const set = vi.fn();
  return {
    mockCookiesGet: get,
    mockCookiesSet: set,
    mockCookiesStore: { get, set, delete: vi.fn() },
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockGetPlatformSetting: vi.fn(),
    mockGetAffiliateByReferralCode: vi.fn(),
    mockCheckSelfReferralByIp: vi.fn(),
  };
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookiesStore),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  referral: { id: 'id' },
  listing: { id: 'id', status: 'status', ownerUserId: 'ownerUserId' },
  sellerProfile: { affiliateOptIn: 'affiliateOptIn', userId: 'userId' },
  auditEvent: { id: 'id' },
}));

vi.mock('@/lib/queries/affiliate', () => ({
  getAffiliateByReferralCode: (...args: unknown[]) => mockGetAffiliateByReferralCode(...args),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@/lib/affiliate/fraud-detection', () => ({
  checkSelfReferralByIp: (...args: unknown[]) => mockCheckSelfReferralByIp(...args),
}));

vi.mock('@/lib/affiliate/fraud-escalation', () => ({
  escalateAffiliate: vi.fn(),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_BODY = {
  referralCode: 'CREATOR123',
  listingId: 'listing-test-001',
  listingSlug: 'nike-air-jordan',
};

function makeRequest(body = VALID_BODY): NextRequest {
  return new NextRequest('http://localhost/api/affiliate/listing-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

const MOCK_AFFILIATE = { id: 'aff-test-001', userId: 'user-aff-001', status: 'ACTIVE' };
const ACTIVE_LISTING = { id: 'listing-test-001', status: 'ACTIVE', ownerUserId: 'seller-001' };

// ─── Tests: feature flag disabled ────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — feature flag disabled', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPlatformSetting.mockResolvedValue(false);
  });

  it('returns 200 with attributed=false when feature is disabled', async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.attributed).toBe(false);
  });

  it('does not look up affiliate when feature is disabled', async () => {
    await POST(makeRequest());
    expect(mockGetAffiliateByReferralCode).not.toHaveBeenCalled();
  });

  it('does not set any cookie when feature is disabled', async () => {
    await POST(makeRequest());
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});

// ─── Tests: invalid / suspended affiliate ─────────────────────────────────────

describe('POST /api/affiliate/listing-click — invalid or inactive affiliate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
  });

  it('returns attributed=false when affiliate code not found', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue(null);
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
    expect(data.success).toBe(true);
  });

  it('returns attributed=false when affiliate is SUSPENDED', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, status: 'SUSPENDED' });
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('returns attributed=false when affiliate is BANNED', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, status: 'BANNED' });
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('returns attributed=false when affiliate is PENDING', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, status: 'PENDING' });
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('normalizes referral code to uppercase before lookup', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue(null);
    await POST(makeRequest({ ...VALID_BODY, referralCode: 'creator123' }));
    expect(mockGetAffiliateByReferralCode).toHaveBeenCalledWith('CREATOR123');
  });

  it('does not query the listing when affiliate is not found', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue(null);
    await POST(makeRequest());
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});

// ─── Tests: inactive listing ──────────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — inactive listing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
  });

  it('returns attributed=false when listing not found', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([]));
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('returns attributed=false when listing status is SOLD', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ ...ACTIVE_LISTING, status: 'SOLD' }]));
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('returns attributed=false when listing status is ARCHIVED', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ ...ACTIVE_LISTING, status: 'ARCHIVED' }]));
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('does not set cookie when listing is inactive', async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ ...ACTIVE_LISTING, status: 'SOLD' }]));
    await POST(makeRequest());
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});
