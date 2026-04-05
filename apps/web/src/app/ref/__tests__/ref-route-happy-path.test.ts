/**
 * Tests for GET /ref/[code] — happy path, fraud signals, UTM params,
 * and first-touch attribution (G1.6)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const {
  mockCookiesGet, mockCookiesSet, mockCookiesStore,
  mockInsert, mockGetAffiliateByReferralCode, mockGetPlatformSetting,
} = vi.hoisted(() => {
  const get = vi.fn();
  const set = vi.fn();
  return {
    mockCookiesGet: get,
    mockCookiesSet: set,
    mockCookiesStore: { get, set, delete: vi.fn() },
    mockInsert: vi.fn(),
    mockGetAffiliateByReferralCode: vi.fn(),
    mockGetPlatformSetting: vi.fn(),
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
  checkSelfReferralByIp: vi.fn().mockResolvedValue({
    flagged: false,
    signalType: 'SELF_REFERRAL_IP',
    details: 'No IP match detected',
    severity: 'WARNING',
  }),
}));

vi.mock('@/lib/affiliate/fraud-escalation', () => ({
  escalateAffiliate: vi.fn(),
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
  opts: { forwardedFor?: string; userAgent?: string; query?: string } = {},
): NextRequest {
  const url = `http://localhost:3000/ref/${code}${opts.query ? `?${opts.query}` : ''}`;
  const headers: Record<string, string> = {};
  if (opts.forwardedFor) headers['x-forwarded-for'] = opts.forwardedFor;
  if (opts.userAgent) headers['user-agent'] = opts.userAgent;
  return new NextRequest(url, { headers });
}

function makeParams(code: string) {
  return { params: Promise.resolve({ code }) };
}

function makeValuesChain(id = 'ref-test-001') {
  const mockValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id }]),
  });
  mockInsert.mockReturnValue({ values: mockValues });
  return mockValues;
}

const MOCK_AFFILIATE = {
  id: 'aff-test-001',
  status: 'ACTIVE',
  cookieDurationDays: 30,
};

// ─── Tests: valid affiliate — happy path ──────────────────────────────────────

describe('GET /ref/[code] — valid affiliate happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
    mockCookiesGet.mockReturnValue(undefined);
    makeValuesChain('ref-test-001');
  });

  it('redirects to /auth/signup with 307 status', async () => {
    const res = await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/signup');
  });

  it('inserts a referral record with status CLICKED', async () => {
    const mockValues = makeValuesChain('ref-test-001');

    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    const insertedData = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(insertedData.status).toBe('CLICKED');
  });

  it('inserts the correct affiliateId', async () => {
    const mockValues = makeValuesChain('ref-test-001');

    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    const insertedData = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(insertedData.affiliateId).toBe('aff-test-001');
  });

  it('computes expiresAt as now + cookieDurationDays', async () => {
    const before = Date.now();
    const mockValues = makeValuesChain('ref-test-001');

    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));
    const after = Date.now();

    const insertedData = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    const expiresAt = insertedData.expiresAt as Date;
    const expectedMs = 30 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs);
  });

  it('sets cookie with correct name, id, maxAge, httpOnly, and sameSite attributes', async () => {
    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockCookiesSet).toHaveBeenCalledWith(
      'twicely_ref',
      'ref-test-001',
      expect.objectContaining({
        maxAge: 30 * 24 * 60 * 60,
        httpOnly: true,
        sameSite: 'lax',
      }),
    );
  });
});

// ─── Tests: fraud signals and UTM ────────────────────────────────────────────

describe('GET /ref/[code] — fraud signals and UTM parameters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
    mockCookiesGet.mockReturnValue(undefined);
  });

  it('stores IP from x-forwarded-for header (rightmost for spoof-resistance)', async () => {
    const mockValues = makeValuesChain('ref-test-001');

    await GET(
      makeRequest('TESTCODE', { forwardedFor: '1.2.3.4, 5.6.7.8' }),
      makeParams('TESTCODE'),
    );

    const insertedData = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    // SEC-013: Use rightmost IP (closest to our proxy, not spoofable)
    expect(insertedData.ipAddress).toBe('5.6.7.8');
  });

  it('stores user agent from user-agent header', async () => {
    const mockValues = makeValuesChain('ref-test-001');

    await GET(
      makeRequest('TESTCODE', { userAgent: 'Mozilla/5.0 Test Browser' }),
      makeParams('TESTCODE'),
    );

    const insertedData = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(insertedData.userAgent).toBe('Mozilla/5.0 Test Browser');
  });

  it('sets ipAddress and userAgent to null when headers are missing', async () => {
    const mockValues = makeValuesChain('ref-test-001');

    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    const insertedData = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(insertedData.ipAddress).toBeNull();
    expect(insertedData.userAgent).toBeNull();
  });

  it('stores UTM parameters from query string', async () => {
    const mockValues = makeValuesChain('ref-test-001');

    await GET(
      makeRequest('TESTCODE', {
        query: 'utm_source=instagram&utm_medium=story&utm_campaign=spring2026',
      }),
      makeParams('TESTCODE'),
    );

    const insertedData = mockValues.mock.calls[0]![0] as Record<string, unknown>;
    expect(insertedData.utmSource).toBe('instagram');
    expect(insertedData.utmMedium).toBe('story');
    expect(insertedData.utmCampaign).toBe('spring2026');
  });
});

// ─── Tests: first-touch attribution ──────────────────────────────────────────

describe('GET /ref/[code] — first-touch attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
    makeValuesChain('ref-test-002');
  });

  it('does not overwrite existing twicely_ref cookie', async () => {
    mockCookiesGet.mockReturnValue({ value: 'ref-existing-001' });

    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockCookiesSet).not.toHaveBeenCalled();
  });

  it('still inserts a referral record and redirects to /auth/signup when cookie exists', async () => {
    mockCookiesGet.mockReturnValue({ value: 'ref-existing-001' });

    const res = await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockInsert).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/signup');
  });

  it('sets cookie when no existing referral cookie is present', async () => {
    mockCookiesGet.mockReturnValue(undefined);

    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockCookiesSet).toHaveBeenCalledWith(
      'twicely_ref',
      'ref-test-002',
      expect.any(Object),
    );
  });
});
