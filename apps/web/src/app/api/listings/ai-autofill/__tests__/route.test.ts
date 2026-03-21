/**
 * Tests for POST /api/listings/ai-autofill — auth, toggle, validation (G1.1)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockAuthorize = vi.fn();
vi.mock('@twicely/casl/authorize', () => ({
  authorize: (...args: unknown[]) => mockAuthorize(...args),
}));

const mockGetPlatformSetting = vi.fn();
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

const mockAnalyzeListingImages = vi.fn();
const mockGetMonthlyUsage = vi.fn();
const mockGetUserMonthlyLimit = vi.fn();
const mockIncrementUsage = vi.fn();

vi.mock('@/lib/services/ai-autofill-service', () => ({
  analyzeListingImages: (...args: unknown[]) => mockAnalyzeListingImages(...args),
  getMonthlyUsage: (...args: unknown[]) => mockGetMonthlyUsage(...args),
  getUserMonthlyLimit: (...args: unknown[]) => mockGetUserMonthlyLimit(...args),
  incrementUsage: (...args: unknown[]) => mockIncrementUsage(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Import route once ────────────────────────────────────────────────────────

import { POST } from '../route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(userId = 'user-test-001') {
  return { userId, onBehalfOfSellerId: null };
}

function makeAbility(canCreate = true) {
  return {
    can: vi.fn((action: string, subject: string) => {
      if (action === 'create' && subject === 'Listing') return canCreate;
      return false;
    }),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/listings/ai-autofill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_URLS = ['https://cdn.example.com/img1.jpg', 'https://cdn.example.com/img2.jpg'];

// ─── Tests: authentication ────────────────────────────────────────────────────

describe('POST /api/listings/ai-autofill — authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(true);
    mockIncrementUsage.mockResolvedValue(undefined);
  });

  it('returns 401 when session is null (unauthenticated)', async () => {
    mockAuthorize.mockResolvedValue({ session: null, ability: makeAbility(false) });

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user lacks Listing create ability', async () => {
    mockAuthorize.mockResolvedValue({ session: makeSession(), ability: makeAbility(false) });

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });
});

// ─── Tests: feature toggle ────────────────────────────────────────────────────

describe('POST /api/listings/ai-autofill — feature toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue({ session: makeSession(), ability: makeAbility(true) });
    mockIncrementUsage.mockResolvedValue(undefined);
  });

  it('returns 503 when ai.autofill.enabled is false', async () => {
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'ai.autofill.enabled') return Promise.resolve(false);
      return Promise.resolve(undefined);
    });

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ─── Tests: input validation ──────────────────────────────────────────────────

describe('POST /api/listings/ai-autofill — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue({ session: makeSession(), ability: makeAbility(true) });
    mockGetPlatformSetting.mockResolvedValue(true);
    mockGetUserMonthlyLimit.mockResolvedValue(10);
    mockGetMonthlyUsage.mockResolvedValue({ count: 0, limit: 10, remaining: 10 });
    mockIncrementUsage.mockResolvedValue(undefined);
  });

  it('returns 400 when imageUrls is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 when imageUrls is empty array (min:1)', async () => {
    const res = await POST(makeRequest({ imageUrls: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when extra fields are provided (Zod strict mode)', async () => {
    const res = await POST(makeRequest({ imageUrls: VALID_URLS, extraField: 'injected' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 when imageUrls contains non-URL strings', async () => {
    const res = await POST(makeRequest({ imageUrls: ['not-a-url'] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/listings/ai-autofill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
