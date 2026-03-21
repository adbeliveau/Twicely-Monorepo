/**
 * Tests for POST /api/affiliate/listing-click — seller opt-out and
 * self-referral block (userId match) (G3.6)
 *
 * Split from listing-click-guards.test.ts to stay within 250-line limit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const {
  mockCookiesGet, mockCookiesSet, mockCookiesStore,
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

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/affiliate/listing-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referralCode: 'CREATOR123',
      listingId: 'listing-test-001',
      listingSlug: 'nike-air-jordan',
    }),
  });
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

function setupListingAndSellerSelects(listingRows: unknown[], sellerRows: unknown[]) {
  mockDbSelect
    .mockReturnValueOnce(makeSelectChain(listingRows))
    .mockReturnValueOnce(makeSelectChain(sellerRows));
}

const ACTIVE_LISTING = { id: 'listing-test-001', status: 'ACTIVE', ownerUserId: 'seller-001' };
const MOCK_AFFILIATE = { id: 'aff-test-001', userId: 'user-aff-001', status: 'ACTIVE' };

// ─── Tests: seller opt-out ────────────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — seller opt-out', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
  });

  it('returns attributed=false when seller has opted out', async () => {
    setupListingAndSellerSelects([ACTIVE_LISTING], [{ affiliateOptIn: false }]);
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('returns attributed=false when seller profile affiliateOptIn is null (falsy)', async () => {
    setupListingAndSellerSelects([ACTIVE_LISTING], [{ affiliateOptIn: null }]);
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('returns attributed=false when seller profile row is missing entirely', async () => {
    setupListingAndSellerSelects([ACTIVE_LISTING], []);
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
  });

  it('does not set cookie when seller has opted out', async () => {
    setupListingAndSellerSelects([ACTIVE_LISTING], [{ affiliateOptIn: false }]);
    await POST(makeRequest());
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});

// ─── Tests: self-referral block (userId match) ────────────────────────────────

describe('POST /api/affiliate/listing-click — self-referral blocked', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
  });

  it('returns attributed=false when affiliate userId equals listing ownerUserId', async () => {
    const sharedUserId = 'user-self-promote';
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, userId: sharedUserId });
    setupListingAndSellerSelects(
      [{ ...ACTIVE_LISTING, ownerUserId: sharedUserId }],
      [{ affiliateOptIn: true }],
    );
    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
    expect(data.success).toBe(true);
  });

  it('does not insert a referral record when self-referral is detected', async () => {
    const sharedUserId = 'user-self-promote';
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, userId: sharedUserId });
    setupListingAndSellerSelects(
      [{ ...ACTIVE_LISTING, ownerUserId: sharedUserId }],
      [{ affiliateOptIn: true }],
    );
    await POST(makeRequest());
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('does not set cookie when self-referral is detected', async () => {
    const sharedUserId = 'user-self-promote';
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, userId: sharedUserId });
    setupListingAndSellerSelects(
      [{ ...ACTIVE_LISTING, ownerUserId: sharedUserId }],
      [{ affiliateOptIn: true }],
    );
    await POST(makeRequest());
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });

  it('proceeds with attribution when affiliate and listing owner are different users', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, userId: 'user-aff-001' });
    setupListingAndSellerSelects(
      [{ ...ACTIVE_LISTING, ownerUserId: 'seller-001' }],
      [{ affiliateOptIn: true }],
    );
    mockCheckSelfReferralByIp.mockResolvedValue({
      flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING',
    });
    mockCookiesGet.mockReturnValue(undefined);
    mockGetPlatformSetting
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(7);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'ref-new-001' }]) }),
    });

    const data = await (await POST(makeRequest())).json() as Record<string, unknown>;
    expect(data.attributed).toBe(true);
  });
});
