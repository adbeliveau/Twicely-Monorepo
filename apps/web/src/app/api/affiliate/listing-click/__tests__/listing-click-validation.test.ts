/**
 * Tests for POST /api/affiliate/listing-click — input validation (G3.6)
 *
 * Covers: JSON parse errors, missing required fields, empty strings,
 * extra keys (strict mode), and max-length constraints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const {
  mockCookiesGet: _mockCookiesGet, mockCookiesSet: _mockCookiesSet, mockCookiesStore,
  mockDbSelect, mockDbInsert, mockGetPlatformSetting,
  mockGetAffiliateByReferralCode,
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
  checkSelfReferralByIp: vi.fn().mockResolvedValue({
    flagged: false, signalType: 'SELF_REFERRAL_IP', details: '', severity: 'WARNING',
  }),
}));

vi.mock('@/lib/affiliate/fraud-escalation', () => ({
  escalateAffiliate: vi.fn(),
}));

// ─── Import route after mocks ─────────────────────────────────────────────────

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, contentType = 'application/json'): NextRequest {
  return new NextRequest('http://localhost/api/affiliate/listing-click', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// ─── Tests: JSON parsing ──────────────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — JSON parsing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/affiliate/listing-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid JSON');
  });

  it('returns 400 when body is empty string', async () => {
    const req = new NextRequest('http://localhost/api/affiliate/listing-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── Tests: Zod schema validation ─────────────────────────────────────────────

describe('POST /api/affiliate/listing-click — schema validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when referralCode is missing', async () => {
    const res = await POST(makeRequest({ listingId: 'listing-001', listingSlug: 'test-item' }));
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid input');
  });

  it('returns 400 when listingId is missing', async () => {
    const res = await POST(makeRequest({ referralCode: 'ABC123', listingSlug: 'test-item' }));
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(false);
  });

  it('returns 400 when listingSlug is missing', async () => {
    const res = await POST(makeRequest({ referralCode: 'ABC123', listingId: 'listing-001' }));
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.success).toBe(false);
  });

  it('returns 400 when referralCode is empty string', async () => {
    const res = await POST(makeRequest({ referralCode: '', listingId: 'listing-001', listingSlug: 'test-item' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when referralCode exceeds 50 characters', async () => {
    const longCode = 'A'.repeat(51);
    const res = await POST(makeRequest({ referralCode: longCode, listingId: 'listing-001', listingSlug: 'test-item' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when listingId is empty string', async () => {
    const res = await POST(makeRequest({ referralCode: 'ABC123', listingId: '', listingSlug: 'test-item' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when listingSlug is empty string', async () => {
    const res = await POST(makeRequest({ referralCode: 'ABC123', listingId: 'listing-001', listingSlug: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when extra unknown keys are present (strict mode)', async () => {
    const res = await POST(makeRequest({
      referralCode: 'ABC123',
      listingId: 'listing-001',
      listingSlug: 'test-item',
      extra: 'hacking',
    }));
    expect(res.status).toBe(400);
  });

  it('accepts referralCode exactly at 50 characters', async () => {
    mockGetPlatformSetting.mockResolvedValue(false); // feature disabled — safe early exit
    const code50 = 'A'.repeat(50);
    const res = await POST(makeRequest({ referralCode: code50, listingId: 'listing-001', listingSlug: 'test-item' }));
    // Feature disabled → 200 with attributed:false, not 400
    expect(res.status).toBe(200);
  });
});
