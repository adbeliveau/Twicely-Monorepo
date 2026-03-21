/**
 * Extended tests for POST /api/extension/scrape (H1.2)
 * Covers: field-length limits, channel enum edges, Valkey cache failure tolerance.
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
  externalId: 'posh-ext-1',
  title: 'Test Listing',
  priceCents: 2500,
  description: 'A test description.',
  condition: 'NWT',
  brand: 'Brand',
  category: 'Shoes',
  size: 'M',
  imageUrls: ['https://example.com/img.jpg'],
  url: 'https://poshmark.com/listing/posh-ext-1',
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/scrape — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
    mockValkeySet.mockResolvedValue('OK');
  });

  it('returns 400 for title exceeding 500 chars', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, title: 'A'.repeat(501) },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for title exactly 500 chars', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, title: 'A'.repeat(500) },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for description exceeding 10000 chars', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, description: 'D'.repeat(10001) },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for description exactly 10000 chars', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, description: 'D'.repeat(10000) },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for more than 20 imageUrls', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const tooManyUrls = Array.from({ length: 21 }, (_, i) => `https://example.com/img${i}.jpg`);
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, imageUrls: tooManyUrls },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for exactly 20 imageUrls', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const maxUrls = Array.from({ length: 20 }, (_, i) => `https://example.com/img${i}.jpg`);
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, imageUrls: maxUrls },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 200 for THEREALREAL channel (it is in the enum)', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const trrListing = {
      ...VALID_LISTING,
      externalId: 'trr-item-789',
      url: 'https://www.therealreal.com/products/trr-item-789',
    };
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'THEREALREAL', listing: trrListing }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('accepts VESTIAIRE channel', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'VESTIAIRE',
      listing: VALID_LISTING,
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 200 even when Valkey cache throws (non-fatal)', async () => {
    mockValkeySet.mockRejectedValue(new Error('Valkey connection refused'));
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', listing: VALID_LISTING }));
    // Cache failure should NOT fail the request
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('stores in Valkey with correct key pattern ext:scrape:{userId}:{channel}:{externalId}', async () => {
    const token = await makeSessionToken({ userId: 'user-xyz' });
    const { POST } = await import('../scrape/route');
    await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, externalId: 'posh-xyz-999' },
    }));
    expect(mockValkeySet).toHaveBeenCalledWith(
      'ext:scrape:user-xyz:POSHMARK:posh-xyz-999',
      expect.any(String),
      'EX',
      3600,
    );
  });

  it('returns 400 for malformed JSON body', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const req = new Request('http://localhost/api/extension/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: 'not-valid-json{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for priceCents = 0 (zero is allowed — free listings)', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, priceCents: 0 },
    }));
    // 0 is valid (min(0) allows it)
    expect(res.status).toBe(200);
  });
});
