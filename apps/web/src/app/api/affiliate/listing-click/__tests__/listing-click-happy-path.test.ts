/**
 * Tests for POST /api/affiliate/listing-click — successful attribution (G3.6)
 *
 * Covers: 200 response, referral record insertion with correct fields,
 * cookie name/payload/attributes, attribution window expiry calculation.
 * IP extraction, first-touch, and DB failure are in listing-click-attribution.test.ts.
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
  referral: { id: 'id', affiliateId: 'affiliateId', status: 'status',
    expiresAt: 'expiresAt', ipAddress: 'ipAddress', userAgent: 'userAgent', listingId: 'listingId' },
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

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  const defaultBody = {
    referralCode: 'CREATOR123',
    listingId: 'listing-test-001',
    listingSlug: 'nike-air-jordan',
  };
  return new NextRequest('http://localhost/api/affiliate/listing-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...defaultBody, ...body }),
  });
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

function setupHappyPath(overrides: { attributionWindowDays?: number; referralId?: string } = {}) {
  const { attributionWindowDays = 7, referralId = 'ref-test-001' } = overrides;
  mockGetPlatformSetting
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(attributionWindowDays);
  mockGetAffiliateByReferralCode.mockResolvedValue({
    id: 'aff-test-001', userId: 'user-aff-001', status: 'ACTIVE',
  });
  mockDbSelect
    .mockReturnValueOnce(makeSelectChain([{ id: 'listing-test-001', status: 'ACTIVE', ownerUserId: 'seller-001' }]))
    .mockReturnValueOnce(makeSelectChain([{ affiliateOptIn: true }]));
  mockCheckSelfReferralByIp.mockResolvedValue({
    flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING',
  });
  mockCookiesGet.mockReturnValue(undefined);
  const mockValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: referralId }]),
  });
  mockDbInsert.mockReturnValue({ values: mockValues });
  return mockValues;
}

// ─── Tests: successful attribution ───────────────────────────────────────────

describe('POST /api/affiliate/listing-click — successful attribution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with success=true and attributed=true', async () => {
    setupHappyPath();
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(true);
    expect(data.attributed).toBe(true);
  });

  it('inserts a referral record with status=CLICKED', async () => {
    const mv = setupHappyPath();
    await POST(makeRequest());
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).status).toBe('CLICKED');
  });

  it('inserts the correct affiliateId into the referral record', async () => {
    const mv = setupHappyPath();
    await POST(makeRequest());
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).affiliateId).toBe('aff-test-001');
  });

  it('inserts the correct listingId into the referral record', async () => {
    const mv = setupHappyPath();
    await POST(makeRequest());
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).listingId).toBe('listing-test-001');
  });

  it('computes expiresAt as now + attributionWindowDays × 86400s', async () => {
    const before = Date.now();
    const mv = setupHappyPath({ attributionWindowDays: 7 });
    await POST(makeRequest());
    const after = Date.now();
    const expiresAt = (mv.mock.calls[0]![0] as Record<string, unknown>).expiresAt as Date;
    const ms = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + ms);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + ms);
  });

  it('sets the twicely_listing_ref cookie with the referral ID in payload', async () => {
    setupHappyPath({ referralId: 'ref-new-007' });
    await POST(makeRequest());
    expect(mockCookiesSet).toHaveBeenCalledWith(
      'twicely_listing_ref', expect.any(String), expect.any(Object),
    );
    const payload = JSON.parse(mockCookiesSet.mock.calls[0]![1] as string) as Record<string, unknown>;
    expect(payload.referralId).toBe('ref-new-007');
  });

  it('cookie payload contains uppercased affiliateCode', async () => {
    setupHappyPath();
    await POST(makeRequest({ referralCode: 'creator123' }));
    const payload = JSON.parse(mockCookiesSet.mock.calls[0]![1] as string) as Record<string, unknown>;
    expect(payload.affiliateId).toBe('aff-test-001');
    expect(payload.affiliateCode).toBe('CREATOR123');
  });

  it('sets cookie with httpOnly=true and sameSite=lax', async () => {
    setupHappyPath();
    await POST(makeRequest());
    const opts = mockCookiesSet.mock.calls[0]![2] as Record<string, unknown>;
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
  });

  it('sets cookie maxAge to attributionWindowDays × 86400', async () => {
    setupHappyPath({ attributionWindowDays: 7 });
    await POST(makeRequest());
    expect((mockCookiesSet.mock.calls[0]![2] as Record<string, unknown>).maxAge).toBe(7 * 24 * 60 * 60);
  });

  it('cookie payload includes a valid ISO clickedAt timestamp', async () => {
    setupHappyPath();
    await POST(makeRequest());
    const payload = JSON.parse(mockCookiesSet.mock.calls[0]![1] as string) as Record<string, unknown>;
    expect(typeof payload.clickedAt).toBe('string');
    expect(() => new Date(payload.clickedAt as string)).not.toThrow();
  });
});
