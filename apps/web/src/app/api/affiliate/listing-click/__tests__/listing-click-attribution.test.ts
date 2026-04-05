/**
 * Tests for POST /api/affiliate/listing-click — IP extraction, first-touch,
 * and DB insert failure (G3.6)
 *
 * Split from listing-click-happy-path.test.ts to stay within 250-line limit.
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

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/affiliate/listing-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
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

/** Sets up all pre-insert state for tests that need to reach the insert step. */
function setupPreInsert() {
  mockGetPlatformSetting
    .mockResolvedValueOnce(true)   // listingLinkEnabled
    .mockResolvedValueOnce(true)   // fraud.enabled
    .mockResolvedValueOnce(7);     // attributionWindowDays
  mockGetAffiliateByReferralCode.mockResolvedValue({
    id: 'aff-test-001', userId: 'user-aff-001', status: 'ACTIVE',
  });
  mockDbSelect
    .mockReturnValueOnce(makeSelectChain([{ id: 'listing-test-001', status: 'ACTIVE', ownerUserId: 'seller-001' }]))
    .mockReturnValueOnce(makeSelectChain([{ affiliateOptIn: true }]));
  mockCheckSelfReferralByIp.mockResolvedValue({
    flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING',
  });
}

// ─── Tests: IP and userAgent extraction ──────────────────────────────────────

describe('POST /api/affiliate/listing-click — IP and userAgent extraction', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses rightmost segment of x-forwarded-for header as IP (SEC-013)', async () => {
    setupPreInsert();
    mockCookiesGet.mockReturnValue(undefined);
    const mv = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r1' }]) });
    mockDbInsert.mockReturnValue({ values: mv });
    await POST(makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }));
    // SEC-013: Rightmost IP is closest to our proxy and not spoofable
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).ipAddress).toBe('5.6.7.8');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    setupPreInsert();
    mockCookiesGet.mockReturnValue(undefined);
    const mv = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r2' }]) });
    mockDbInsert.mockReturnValue({ values: mv });
    await POST(makeRequest({ 'x-real-ip': '9.10.11.12' }));
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).ipAddress).toBe('9.10.11.12');
  });

  it('stores null for ipAddress when no IP headers are present', async () => {
    setupPreInsert();
    mockCookiesGet.mockReturnValue(undefined);
    const mv = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r3' }]) });
    mockDbInsert.mockReturnValue({ values: mv });
    await POST(makeRequest());
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).ipAddress).toBeNull();
  });

  it('stores the user-agent header value', async () => {
    setupPreInsert();
    mockCookiesGet.mockReturnValue(undefined);
    const mv = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r4' }]) });
    mockDbInsert.mockReturnValue({ values: mv });
    await POST(makeRequest({ 'user-agent': 'Mozilla/5.0 TestAgent' }));
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).userAgent).toBe('Mozilla/5.0 TestAgent');
  });

  it('stores null for userAgent when header is absent', async () => {
    setupPreInsert();
    mockCookiesGet.mockReturnValue(undefined);
    const mv = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r5' }]) });
    mockDbInsert.mockReturnValue({ values: mv });
    await POST(makeRequest());
    expect((mv.mock.calls[0]![0] as Record<string, unknown>).userAgent).toBeNull();
  });
});

// ─── Tests: first-touch attribution cookie guard ──────────────────────────────

describe('POST /api/affiliate/listing-click — first-touch attribution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns attributed=false when twicely_listing_ref cookie already exists', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    mockGetAffiliateByReferralCode.mockResolvedValue({ id: 'aff-001', userId: 'u-aff', status: 'ACTIVE' });
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'lid', status: 'ACTIVE', ownerUserId: 's-001' }]))
      .mockReturnValueOnce(makeSelectChain([{ affiliateOptIn: true }]));
    mockCheckSelfReferralByIp.mockResolvedValue({ flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING' });
    mockCookiesGet.mockReturnValue({ value: '{"referralId":"existing"}' });

    const res = await POST(makeRequest());
    const data = await res.json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
    expect(data.success).toBe(true);
  });

  it('does not insert a new referral record when first-touch cookie exists', async () => {
    mockGetPlatformSetting.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    mockGetAffiliateByReferralCode.mockResolvedValue({ id: 'aff-001', userId: 'u-aff', status: 'ACTIVE' });
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ id: 'lid', status: 'ACTIVE', ownerUserId: 's-001' }]))
      .mockReturnValueOnce(makeSelectChain([{ affiliateOptIn: true }]));
    mockCheckSelfReferralByIp.mockResolvedValue({ flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING' });
    mockCookiesGet.mockReturnValue({ value: '{"referralId":"existing"}' });

    await POST(makeRequest());
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});

// ─── Tests: DB insert failure ─────────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — DB insert failure', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 500 when referral insert returns empty array', async () => {
    setupPreInsert();
    mockCookiesGet.mockReturnValue(undefined);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to record click');
  });
});
