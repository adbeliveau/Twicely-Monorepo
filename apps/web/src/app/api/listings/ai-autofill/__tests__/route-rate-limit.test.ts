/**
 * Tests for POST /api/listings/ai-autofill — rate limiting, happy path, errors (G1.1)
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

function makeAbility() {
  return { can: vi.fn().mockReturnValue(true) };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/listings/ai-autofill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_URLS = ['https://cdn.example.com/img1.jpg', 'https://cdn.example.com/img2.jpg'];

const MOCK_SUGGESTIONS = {
  title: 'Levi Denim Jacket',
  description: 'Classic denim jacket in good condition.',
  category: "Men's Jackets",
  brand: 'Levi',
  condition: 'GOOD',
  color: 'Blue',
  tags: ['levi', 'denim', 'jacket'],
  suggestedPriceMinCents: 3500,
  suggestedPriceMaxCents: 5000,
  confidence: 'HIGH' as const,
};

function setupAuth() {
  mockAuthorize.mockResolvedValue({ session: makeSession(), ability: makeAbility() });
  mockGetPlatformSetting.mockResolvedValue(true);
  mockIncrementUsage.mockResolvedValue(undefined);
}

// ─── Tests: rate limiting ─────────────────────────────────────────────────────

describe('POST /api/listings/ai-autofill — rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
  });

  it('returns 429 when NONE tier user (limit=10) has used all 10 requests', async () => {
    mockGetUserMonthlyLimit.mockResolvedValue(10);
    mockGetMonthlyUsage.mockResolvedValue({ count: 10, limit: 10, remaining: 0 });

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.remainingUses).toBe(0);
  });

  it('returns 429 when STARTER tier user (limit=50) has used all 50 requests', async () => {
    mockGetUserMonthlyLimit.mockResolvedValue(50);
    mockGetMonthlyUsage.mockResolvedValue({ count: 50, limit: 50, remaining: 0 });

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(429);
  });

  it('does NOT rate limit POWER tier (limit=-1, unlimited)', async () => {
    mockGetUserMonthlyLimit.mockResolvedValue(-1);
    mockGetMonthlyUsage.mockResolvedValue({ count: 9999, limit: -1, remaining: -1 });
    mockAnalyzeListingImages.mockResolvedValue(MOCK_SUGGESTIONS);

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.remainingUses).toBe(-1);
  });

  it('proceeds when count is exactly one below the limit', async () => {
    mockGetUserMonthlyLimit.mockResolvedValue(10);
    mockGetMonthlyUsage.mockResolvedValue({ count: 9, limit: 10, remaining: 1 });
    mockAnalyzeListingImages.mockResolvedValue(MOCK_SUGGESTIONS);

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(200);
  });
});

// ─── Tests: happy path ────────────────────────────────────────────────────────

describe('POST /api/listings/ai-autofill — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
    mockGetUserMonthlyLimit.mockResolvedValue(50);
    mockGetMonthlyUsage.mockResolvedValue({ count: 3, limit: 50, remaining: 47 });
    mockAnalyzeListingImages.mockResolvedValue(MOCK_SUGGESTIONS);
  });

  it('returns 200 with suggestions and correct remainingUses', async () => {
    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.suggestions).toEqual(MOCK_SUGGESTIONS);
    // count was 3, incremented to 4 → remaining = 50 - 4 = 46
    expect(body.remainingUses).toBe(46);
  });

  it('increments usage BEFORE calling Claude (prevents double-billing on retry)', async () => {
    const callOrder: string[] = [];
    mockIncrementUsage.mockImplementation(async () => { callOrder.push('increment'); });
    mockAnalyzeListingImages.mockImplementation(async () => {
      callOrder.push('claude');
      return MOCK_SUGGESTIONS;
    });

    await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(callOrder[0]).toBe('increment');
    expect(callOrder[1]).toBe('claude');
  });

  it('passes the correct userId to incrementUsage', async () => {
    await POST(makeRequest({ imageUrls: VALID_URLS }));
    expect(mockIncrementUsage).toHaveBeenCalledWith('user-test-001');
  });
});

// ─── Tests: Claude errors ─────────────────────────────────────────────────────

describe('POST /api/listings/ai-autofill — Claude errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
    mockGetUserMonthlyLimit.mockResolvedValue(50);
    mockGetMonthlyUsage.mockResolvedValue({ count: 3, limit: 50, remaining: 47 });
  });

  it('returns 502 on generic Claude API error', async () => {
    mockAnalyzeListingImages.mockRejectedValue(new Error('anthropic_rate_limit'));

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 with "Could not load images" when NO_IMAGES is thrown', async () => {
    mockAnalyzeListingImages.mockRejectedValue(new Error('NO_IMAGES'));

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Could not load images');
  });

  it('returns 502 when PARSE_FAILED is thrown (unparseable Claude response)', async () => {
    mockAnalyzeListingImages.mockRejectedValue(new Error('PARSE_FAILED'));

    const res = await POST(makeRequest({ imageUrls: VALID_URLS }));

    expect(res.status).toBe(502);
  });
});
