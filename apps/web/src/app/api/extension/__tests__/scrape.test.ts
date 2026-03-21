/**
 * Tests for POST /api/extension/scrape (H1.2)
 * Verifies that scraped listing data is accepted and cached.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockValkeySet = vi.fn().mockResolvedValue('OK');
vi.mock('@twicely/db/cache/valkey', () => ({
  getValkeyClient: vi.fn(() => ({ set: mockValkeySet })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key, defaultVal) => Promise.resolve(defaultVal)),
}));

vi.mock('@twicely/casl', () => ({
  defineAbilitiesFor: vi.fn(() => ({ can: vi.fn(() => true) })),
  sub: vi.fn((_type, conditions) => conditions),
  ForbiddenError: class ForbiddenError extends Error {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

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

async function makeSessionToken(overrides: Record<string, unknown> = {}): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT({ userId: 'user-abc', purpose: 'extension-session', ...overrides })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(s);
}

async function makeRegistrationToken(): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT({ userId: 'user-abc', purpose: 'extension-registration' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(s);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/scrape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
    mockValkeySet.mockResolvedValue('OK');
  });

  it('returns 401 for missing Authorization header', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(undefined, { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer bad-token', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for expired token', async () => {
    const s = new TextEncoder().encode(TEST_SECRET);
    const expiredToken = await new SignJWT({ userId: 'user-abc', purpose: 'extension-session' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('-1s')
      .sign(s);
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${expiredToken}`, { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for JWT with wrong purpose (extension-registration)', async () => {
    const regToken = await makeRegistrationToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${regToken}`, { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 400 for missing channel field', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { listing: VALID_LISTING }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing listing field', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid channel value', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'EBAY', listing: VALID_LISTING }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: externalId', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const { externalId: _dropped, ...listingWithout } = VALID_LISTING;
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: title', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const { title: _dropped, ...listingWithout } = VALID_LISTING;
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: priceCents', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const { priceCents: _dropped, ...listingWithout } = VALID_LISTING;
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required listing field: url', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const { url: _dropped, ...listingWithout } = VALID_LISTING;
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', listing: listingWithout }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for extra unknown fields in top-level body (Zod strict)', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: VALID_LISTING,
      extraField: 'not-allowed',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for extra unknown fields in listing object (Zod strict)', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, sneakyExtra: 'not-allowed' },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative priceCents', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, priceCents: -100 },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer priceCents (e.g. 19.99)', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, priceCents: 19.99 },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty externalId', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, externalId: '' },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid imageUrls (not valid URLs)', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, imageUrls: ['not-a-url', 'also-not'] },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for valid Poshmark scrape', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 200 for valid FB_MARKETPLACE scrape', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const fbListing = {
      ...VALID_LISTING,
      externalId: 'fb-item-456',
      url: 'https://www.facebook.com/marketplace/item/456/',
    };
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'FB_MARKETPLACE', listing: fbListing }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 200 with all optional fields null', async () => {
    const token = await makeSessionToken();
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
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', listing: minimalListing }));
    expect(res.status).toBe(200);
  });

  it('returns 503 when EXTENSION_JWT_SECRET is not configured', async () => {
    vi.stubEnv('EXTENSION_JWT_SECRET', '');
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer any', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(503);
  });
});
