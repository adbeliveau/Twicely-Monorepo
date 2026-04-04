/**
 * Extended tests for POST /api/extension/scrape (H1.2)
 * Covers: field-length limits, channel enum edges, Valkey cache failure tolerance.
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

vi.mock('@twicely/casl', () => ({
  defineAbilitiesFor: vi.fn(() => ({ can: vi.fn(() => true) })),
  sub: vi.fn((_type, conditions) => conditions),
  ForbiddenError: class ForbiddenError extends Error {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/scrape — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });
    mockValkeySet.mockResolvedValue('OK');
  });

  it('returns 400 for title exceeding 500 chars', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, title: 'A'.repeat(501) },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for title exactly 500 chars', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, title: 'A'.repeat(500) },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for description exceeding 10000 chars', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, description: 'D'.repeat(10001) },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for description exactly 10000 chars', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, description: 'D'.repeat(10000) },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for more than 20 imageUrls', async () => {
    const { POST } = await import('../scrape/route');
    const tooManyUrls = Array.from({ length: 21 }, (_, i) => `https://example.com/img${i}.jpg`);
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, imageUrls: tooManyUrls },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 200 for exactly 20 imageUrls', async () => {
    const { POST } = await import('../scrape/route');
    const maxUrls = Array.from({ length: 20 }, (_, i) => `https://example.com/img${i}.jpg`);
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, imageUrls: maxUrls },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 200 for THEREALREAL channel (it is in the enum)', async () => {
    const { POST } = await import('../scrape/route');
    const trrListing = {
      ...VALID_LISTING,
      externalId: 'trr-item-789',
      url: 'https://www.therealreal.com/products/trr-item-789',
    };
    const res = await POST(makeRequest('Bearer valid', { channel: 'THEREALREAL', listing: trrListing }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('accepts VESTIAIRE channel', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: VALID_LISTING,
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 200 even when Valkey cache throws (non-fatal)', async () => {
    mockValkeySet.mockRejectedValue(new Error('Valkey connection refused'));
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', listing: VALID_LISTING }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('stores in Valkey with correct key pattern ext:scrape:{userId}:{channel}:{externalId}', async () => {
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-xyz', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-xyz', displayName: null, name: null, image: null, avatarUrl: null },
    });
    const { POST } = await import('../scrape/route');
    await POST(makeRequest('Bearer valid', {
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
    const { POST } = await import('../scrape/route');
    const req = new Request('http://localhost/api/extension/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid',
      },
      body: 'not-valid-json{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 for priceCents = 0 (zero is allowed — free listings)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      listing: { ...VALID_LISTING, priceCents: 0 },
    }));
    expect(res.status).toBe(200);
  });
});
