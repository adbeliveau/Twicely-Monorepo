/**
 * Tests for POST /api/extension/scrape (H1.2)
 * Verifies that scraped listing data is accepted and cached.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Extension-auth mock ─────────────────────────────────────────────────────

const { MockExtAuthError, mockAuth } = vi.hoisted(() => ({
  MockExtAuthError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ExtensionAuthError';
      this.status = status;
    }
  },
  mockAuth: vi.fn(),
}));

vi.mock('@/lib/auth/extension-auth', () => ({
  authenticateExtensionRequest: mockAuth,
  ExtensionAuthError: MockExtAuthError,
}));

// ─── Other mocks ─────────────────────────────────────────────────────────────

const mockValkeySet = vi.fn().mockResolvedValue('OK');
vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: vi.fn(() => ({ set: mockValkeySet })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key, defaultVal) => Promise.resolve(defaultVal)),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_LISTING = {
  externalId: 'posh-abc123',
  title: 'Nike Air Jordan 1',
  priceCents: 15000,
  description: 'Great condition sneakers.',
  condition: 'NWT',
  brand: 'Nike',
  category: 'Shoes',
  size: '10',
  imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
  url: 'https://poshmark.com/listing/posh-abc123',
};

function makeRequest(authHeader: string | undefined, body: unknown): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new Request('http://localhost/api/extension/scrape', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/scrape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });
    mockValkeySet.mockResolvedValue('OK');
  });

  it('returns 401 for missing Authorization header', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Unauthorized'));
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(undefined, { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer bad-token', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for expired token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer expired-token', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for JWT with wrong purpose (extension-registration)', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer reg-token', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 400 for missing channel field', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { listing: VALID_LISTING }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing listing field', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid channel value', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'EBAY', listing: VALID_LISTING }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: externalId', async () => {
    const { externalId: _dropped, ...listingWithout } = VALID_LISTING;
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: title', async () => {
    const { title: _dropped, ...listingWithout } = VALID_LISTING;
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: priceCents', async () => {
    const { priceCents: _dropped, ...listingWithout } = VALID_LISTING;
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: url', async () => {
    const { url: _dropped, ...listingWithout } = VALID_LISTING;
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for extra unknown fields in top-level body (Zod strict)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: VALID_LISTING,
      extraField: 'not-allowed',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for extra unknown fields in listing object (Zod strict)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, sneakyExtra: 'not-allowed' },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative priceCents', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, priceCents: -100 },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer priceCents (e.g. 19.99)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, priceCents: 19.99 },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty externalId', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, externalId: '' },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid imageUrls (not valid URLs)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, imageUrls: ['not-a-url', 'also-not'] },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid Poshmark scrape', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 200 for valid FB_MARKETPLACE scrape', async () => {
    const { POST } = await import('../scrape/route');
    const fbListing = {
      ...VALID_LISTING,
      externalId: 'fb-item-456',
      url: 'https://www.facebook.com/marketplace/item/456/',
    };
    const res = await POST(makeRequest('Bearer valid', { channel: 'FB_MARKETPLACE', listing: fbListing }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 200 with all optional fields null', async () => {
    const { POST } = await import('../scrape/route');
    const minimalListing = {
      externalId: 'posh-min-1',
      title: 'Minimal listing',
      priceCents: 500,
      description: '',
      condition: null,
      brand: null,
      category: null,
      size: null,
      imageUrls: [],
      url: 'https://poshmark.com/listing/posh-min-1',
    };
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', listing: minimalListing }));
    expect(res.status).toBe(200);
  });

  it('returns 503 when EXTENSION_JWT_SECRET is not configured', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(503, 'Extension authentication unavailable'));
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer any', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(503);
  });
});
