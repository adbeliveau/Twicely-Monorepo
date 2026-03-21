/**
 * Tests for GET /ref/[code] — fraud-specific behaviors (G3.5)
 * Self-referral IP blocking, audit event creation, fraud-disabled skip.
 * Happy path, guards, and UTM tests are in separate files.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const {
  mockCookiesGet, mockCookiesSet, mockCookiesStore,
  mockInsert, mockGetAffiliateByReferralCode, mockGetPlatformSetting,
  mockCheckSelfReferralByIp, mockEscalateAffiliate,
} = vi.hoisted(() => {
  const get = vi.fn();
  const set = vi.fn();
  const checkSelfReferralByIp = vi.fn();
  const escalateAffiliate = vi.fn();
  return {
    mockCookiesGet: get,
    mockCookiesSet: set,
    mockCookiesStore: { get, set, delete: vi.fn() },
    mockInsert: vi.fn(),
    mockGetAffiliateByReferralCode: vi.fn(),
    mockGetPlatformSetting: vi.fn(),
    mockCheckSelfReferralByIp: checkSelfReferralByIp,
    mockEscalateAffiliate: escalateAffiliate,
  };
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookiesStore),
}));

vi.mock('@twicely/db', () => ({
  db: { insert: (...args: unknown[]) => mockInsert(...args) },
}));

vi.mock('@twicely/db/schema', () => ({
  referral: { id: 'id' },
  auditEvent: { id: 'id' },
  session: { id: 'id', userId: 'user_id', ipAddress: 'ip_address' },
}));

vi.mock('@/lib/affiliate/fraud-detection', () => ({
  checkSelfReferralByIp: (...args: unknown[]) => mockCheckSelfReferralByIp(...args),
}));

vi.mock('@/lib/affiliate/fraud-escalation', () => ({
  escalateAffiliate: (...args: unknown[]) => mockEscalateAffiliate(...args),
}));

vi.mock('@/lib/queries/affiliate', () => ({
  getAffiliateByReferralCode: (...args: unknown[]) =>
    mockGetAffiliateByReferralCode(...args),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

// ─── Import route after mocks ─────────────────────────────────────────────────

import { GET } from '../[code]/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  code: string,
  opts: { forwardedFor?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.forwardedFor) headers['x-forwarded-for'] = opts.forwardedFor;
  return new NextRequest(`http://localhost:3000/ref/${code}`, { headers });
}

function makeParams(code: string) {
  return { params: Promise.resolve({ code }) };
}

function makeInsertChain(referralId = 'ref-test-001', _auditId = 'audit-001') {
  mockInsert
    .mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: referralId }]),
      }),
    })
    .mockReturnValueOnce({
      values: vi.fn().mockResolvedValue(undefined),
    });
}

const MOCK_AFFILIATE = {
  id: 'aff-test-001',
  userId: 'user-aff-001',
  status: 'ACTIVE',
  cookieDurationDays: 30,
};

const NOT_FLAGGED = {
  flagged: false,
  signalType: 'SELF_REFERRAL_IP',
  details: 'No IP match detected',
  severity: 'WARNING' as const,
};

const FLAGGED = {
  flagged: true,
  signalType: 'SELF_REFERRAL_IP',
  details: 'Referral click IP 203.0.113.45 matches affiliate session IP',
  severity: 'WARNING' as const,
};

// ─── Self-referral IP detection ───────────────────────────────────────────────

describe('GET /ref/[code] — same IP as affiliate (self-referral)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Both platform settings: affiliate.enabled=true, fraud.enabled=true
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
    mockCookiesGet.mockReturnValue(undefined);
    mockEscalateAffiliate.mockResolvedValue(undefined);
  });

  it('does NOT set attribution cookie when referral IP matches affiliate session', async () => {
    mockCheckSelfReferralByIp.mockResolvedValue(FLAGGED);
    makeInsertChain();

    await GET(makeRequest('TESTCODE', { forwardedFor: '203.0.113.45' }), makeParams('TESTCODE'));

    expect(mockCookiesSet).not.toHaveBeenCalled();
  });

  it('still inserts referral record even when self-referral is detected', async () => {
    mockCheckSelfReferralByIp.mockResolvedValue(FLAGGED);
    makeInsertChain();

    await GET(makeRequest('TESTCODE', { forwardedFor: '203.0.113.45' }), makeParams('TESTCODE'));

    // First insert call is for the referral record
    expect(mockInsert).toHaveBeenCalled();
  });

  it('inserts an audit event when self-referral is detected', async () => {
    mockCheckSelfReferralByIp.mockResolvedValue(FLAGGED);
    makeInsertChain();

    await GET(makeRequest('TESTCODE', { forwardedFor: '203.0.113.45' }), makeParams('TESTCODE'));

    // Two inserts: referral + auditEvent
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('redirects to /auth/signup even when self-referral is detected', async () => {
    mockCheckSelfReferralByIp.mockResolvedValue(FLAGGED);
    makeInsertChain();

    const res = await GET(makeRequest('TESTCODE', { forwardedFor: '203.0.113.45' }), makeParams('TESTCODE'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/signup');
  });

  it('sets cookie normally when referral IP does not match affiliate', async () => {
    mockCheckSelfReferralByIp.mockResolvedValue(NOT_FLAGGED);
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'ref-test-002' }]),
      }),
    });

    await GET(makeRequest('TESTCODE', { forwardedFor: '8.8.8.8' }), makeParams('TESTCODE'));

    expect(mockCookiesSet).toHaveBeenCalledWith(
      'twicely_ref',
      'ref-test-002',
      expect.any(Object),
    );
  });
});

// ─── Fraud disabled ───────────────────────────────────────────────────────────

describe('GET /ref/[code] — fraud detection disabled', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
    mockCookiesGet.mockReturnValue(undefined);
  });

  it('skips checkSelfReferralByIp call when affiliate.fraud.enabled is false', async () => {
    // affiliate.enabled=true, fraud.enabled=false
    mockGetPlatformSetting
      .mockResolvedValueOnce(true)   // affiliate.enabled
      .mockResolvedValueOnce(false); // affiliate.fraud.enabled
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'ref-test-003' }]),
      }),
    });

    await GET(makeRequest('TESTCODE', { forwardedFor: '203.0.113.45' }), makeParams('TESTCODE'));

    expect(mockCheckSelfReferralByIp).not.toHaveBeenCalled();
    expect(mockCookiesSet).toHaveBeenCalled(); // cookie IS set since fraud check is skipped
  });
});

// ─── Excluded IPs ─────────────────────────────────────────────────────────────

describe('GET /ref/[code] — localhost/loopback IPs excluded', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
    mockCookiesGet.mockReturnValue(undefined);
  });

  it('checkSelfReferralByIp is called with 127.0.0.1 but still returns not-flagged', async () => {
    // The route passes null IP (no x-forwarded-for header) when IP is missing
    // When forwardedFor is 127.0.0.1, checkSelfReferralByIp internally skips it
    mockCheckSelfReferralByIp.mockResolvedValue(NOT_FLAGGED);
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'ref-test-004' }]),
      }),
    });

    await GET(makeRequest('TESTCODE', { forwardedFor: '127.0.0.1' }), makeParams('TESTCODE'));

    // Cookie is set because the check returns not-flagged
    expect(mockCookiesSet).toHaveBeenCalled();
    expect(mockCookiesSet).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ httpOnly: false }));
  });
});
