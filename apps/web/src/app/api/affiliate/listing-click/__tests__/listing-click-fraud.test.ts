/**
 * Tests for POST /api/affiliate/listing-click — IP fraud detection (G3.6)
 *
 * Covers: flagged IP blocks attribution and cookie, audit event inserted,
 * escalateAffiliate called, IP passed to fraud check,
 * fraud disabled skips checkSelfReferralByIp entirely.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const {
  mockCookiesGet, mockCookiesSet, mockCookiesStore,
  mockDbSelect, mockDbInsert,
  mockGetPlatformSetting, mockGetAffiliateByReferralCode,
  mockCheckSelfReferralByIp, mockEscalateAffiliate,
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
    mockEscalateAffiliate: vi.fn(),
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
  auditEvent: {
    actorType: 'actorType', actorId: 'actorId', action: 'action',
    subject: 'subject', subjectId: 'subjectId', severity: 'severity',
    detailsJson: 'detailsJson', ipAddress: 'ipAddress',
  },
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
  escalateAffiliate: (...args: unknown[]) => mockEscalateAffiliate(...args),
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

function setupPreFraudState(fraudEnabled = true) {
  mockGetPlatformSetting
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(fraudEnabled);
  mockGetAffiliateByReferralCode.mockResolvedValue({
    id: 'aff-test-001', userId: 'user-aff-001', status: 'ACTIVE',
  });
  mockDbSelect
    .mockReturnValueOnce(makeSelectChain([{ id: 'listing-test-001', status: 'ACTIVE', ownerUserId: 'seller-001' }]))
    .mockReturnValueOnce(makeSelectChain([{ affiliateOptIn: true }]));
}

const FLAGGED_SIGNAL = {
  flagged: true, signalType: 'SELF_REFERRAL_IP' as const,
  details: 'Referral IP 1.2.3.4 matches affiliate session', severity: 'WARNING' as const,
};
const NOT_FLAGGED = {
  flagged: false, signalType: 'SELF_REFERRAL_IP' as const,
  details: '', severity: 'WARNING' as const,
};

// ─── Tests: fraud IP check blocks attribution ─────────────────────────────────

describe('POST /api/affiliate/listing-click — IP fraud detection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEscalateAffiliate.mockResolvedValue(undefined);
  });

  it('returns attributed=false and no cookie when IP fraud check is flagged', async () => {
    setupPreFraudState();
    mockCheckSelfReferralByIp.mockResolvedValue(FLAGGED_SIGNAL);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const res = await POST(makeRequest({ 'x-forwarded-for': '1.2.3.4' }));
    const data = await res.json() as Record<string, unknown>;
    expect(data.attributed).toBe(false);
    expect(data.success).toBe(true);
    expect(mockCookiesSet).not.toHaveBeenCalled();
  });

  it('inserts an audit event with action=AFFILIATE_FRAUD_SIGNAL when fraud is flagged', async () => {
    setupPreFraudState();
    mockCheckSelfReferralByIp.mockResolvedValue(FLAGGED_SIGNAL);
    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: mockValues });

    await POST(makeRequest());
    const inserted = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted.action).toBe('AFFILIATE_FRAUD_SIGNAL');
    expect(inserted.subject).toBe('Affiliate');
    expect(inserted.subjectId).toBe('aff-test-001');
  });

  it('calls escalateAffiliate(affiliateId, signal, SYSTEM) when fraud is flagged', async () => {
    setupPreFraudState();
    mockCheckSelfReferralByIp.mockResolvedValue(FLAGGED_SIGNAL);
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    await POST(makeRequest());
    expect(mockEscalateAffiliate).toHaveBeenCalledWith('aff-test-001', FLAGGED_SIGNAL, 'SYSTEM');
  });

  it('passes the extracted x-forwarded-for IP to checkSelfReferralByIp', async () => {
    setupPreFraudState();
    mockCheckSelfReferralByIp.mockResolvedValue(NOT_FLAGGED);
    mockCookiesGet.mockReturnValue(undefined);
    mockGetPlatformSetting.mockResolvedValueOnce(7);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r1' }]) }),
    });

    await POST(makeRequest({ 'x-forwarded-for': '203.0.113.5' }));
    expect(mockCheckSelfReferralByIp).toHaveBeenCalledWith('user-aff-001', '203.0.113.5');
  });

  it('passes null IP to checkSelfReferralByIp when no IP header is present', async () => {
    setupPreFraudState();
    mockCheckSelfReferralByIp.mockResolvedValue(NOT_FLAGGED);
    mockCookiesGet.mockReturnValue(undefined);
    mockGetPlatformSetting.mockResolvedValueOnce(7);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r2' }]) }),
    });

    await POST(makeRequest());
    expect(mockCheckSelfReferralByIp).toHaveBeenCalledWith('user-aff-001', null);
  });
});

// ─── Tests: fraud detection disabled ─────────────────────────────────────────

describe('POST /api/affiliate/listing-click — fraud detection disabled', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('skips checkSelfReferralByIp and still attributes the click', async () => {
    setupPreFraudState(false);
    mockCookiesGet.mockReturnValue(undefined);
    mockGetPlatformSetting.mockResolvedValueOnce(7);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r3' }]) }),
    });

    const res = await POST(makeRequest());
    const data = await res.json() as Record<string, unknown>;
    expect(mockCheckSelfReferralByIp).not.toHaveBeenCalled();
    expect(data.attributed).toBe(true);
  });

  it('sets the listing ref cookie when fraud is disabled', async () => {
    setupPreFraudState(false);
    mockCookiesGet.mockReturnValue(undefined);
    mockGetPlatformSetting.mockResolvedValueOnce(7);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'r4' }]) }),
    });

    await POST(makeRequest());
    expect(mockCookiesSet).toHaveBeenCalledWith('twicely_listing_ref', expect.any(String), expect.any(Object));
  });
});
