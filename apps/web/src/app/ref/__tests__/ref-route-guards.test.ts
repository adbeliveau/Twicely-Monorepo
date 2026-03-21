/**
 * Tests for GET /ref/[code] — guards: disabled, invalid affiliate, case insensitivity (G1.6)
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

function makeRequest(code: string): NextRequest {
  return new NextRequest(`http://localhost:3000/ref/${code}`);
}

function makeParams(code: string) {
  return { params: Promise.resolve({ code }) };
}

function setupInsert(id = 'ref-test-001') {
  mockInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id }]),
    }),
  });
}

const MOCK_AFFILIATE = {
  id: 'aff-test-001',
  status: 'ACTIVE',
  cookieDurationDays: 30,
};

// ─── Tests: platform setting disabled ────────────────────────────────────────

describe('GET /ref/[code] — platform setting disabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(false);
  });

  it('redirects to / when affiliate.enabled is false', async () => {
    const res = await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('does not call getAffiliateByReferralCode when disabled', async () => {
    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockGetAffiliateByReferralCode).not.toHaveBeenCalled();
  });

  it('does not insert a referral record when disabled', async () => {
    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does not set a cookie when disabled', async () => {
    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});

// ─── Tests: invalid or inactive affiliate ─────────────────────────────────────

describe('GET /ref/[code] — invalid or inactive affiliate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
  });

  it('redirects to / when no affiliate matches the code', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue(null);

    const res = await GET(makeRequest('NOEXIST'), makeParams('NOEXIST'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to / when affiliate status is SUSPENDED', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, status: 'SUSPENDED' });

    const res = await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to / when affiliate status is BANNED', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, status: 'BANNED' });

    const res = await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('redirects to / when affiliate status is PENDING', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, status: 'PENDING' });

    const res = await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('does not create a referral record for an invalid code', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue(null);

    await GET(makeRequest('NOEXIST'), makeParams('NOEXIST'));

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does not set cookie for an inactive affiliate', async () => {
    mockGetAffiliateByReferralCode.mockResolvedValue({ ...MOCK_AFFILIATE, status: 'BANNED' });

    await GET(makeRequest('TESTCODE'), makeParams('TESTCODE'));

    expect(mockCookiesSet).not.toHaveBeenCalled();
  });
});

// ─── Tests: case insensitivity ────────────────────────────────────────────────

describe('GET /ref/[code] — case insensitivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetAffiliateByReferralCode.mockResolvedValue(MOCK_AFFILIATE);
    mockCookiesGet.mockReturnValue(undefined);
    setupInsert();
  });

  it('uppercases the code before lookup', async () => {
    await GET(makeRequest('testcode'), makeParams('testcode'));

    expect(mockGetAffiliateByReferralCode).toHaveBeenCalledWith('TESTCODE');
  });

  it('still redirects to /auth/signup when lowercase code matches an active affiliate', async () => {
    const res = await GET(makeRequest('testcode'), makeParams('testcode'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/signup');
  });

  it('uppercases mixed-case codes before lookup', async () => {
    await GET(makeRequest('TestCode123'), makeParams('TestCode123'));

    expect(mockGetAffiliateByReferralCode).toHaveBeenCalledWith('TESTCODE123');
  });
});
