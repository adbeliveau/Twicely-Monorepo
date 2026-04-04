/**
 * Tests for POST /api/extension/scrape with VESTIAIRE channel (H4.1)
 * Verifies that VESTIAIRE scraped listing data is accepted and cached.
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
  externalId: '12345678',
  title: 'Chanel Classic Flap Bag',
  priceCents: 350000,
  description: 'Authentic Chanel classic flap bag in good condition.',
  condition: 'Good condition',
  brand: 'Chanel',
  category: 'Bags',
  size: null,
  imageUrls: ['https://cdn.vestiairecollective.com/img/12345678.jpg'],
  url: 'https://www.vestiairecollective.com/women-bags/chanel/p-12345678.html',
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

describe('POST /api/extension/scrape — VESTIAIRE channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });
    mockValkeySet.mockResolvedValue('OK');
  });

  it('accepts VESTIAIRE channel with valid listing data (returns 200)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: VALID_LISTING,
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('accepts listing with optional currency field (3-letter ISO code)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: { ...VALID_LISTING, currency: 'EUR' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('caches scraped data in Valkey with correct key pattern', async () => {
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-vc-test', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-vc-test', displayName: null, name: null, image: null, avatarUrl: null },
    });
    const { POST } = await import('../scrape/route');
    await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: { ...VALID_LISTING, externalId: 'vc-99887766' },
    }));
    expect(mockValkeySet).toHaveBeenCalledWith(
      'ext:scrape:user-vc-test:VESTIAIRE:vc-99887766',
      expect.any(String),
      'EX',
      3600,
    );
  });

  it('rejects missing required fields (returns 400)', async () => {
    const { title: _dropped, ...listingWithout } = VALID_LISTING;
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: listingWithout,
    }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid currency code (non-3-letter, returns 400)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: { ...VALID_LISTING, currency: 'EU' },
    }));
    expect(res.status).toBe(400);
  });

  it('accepts GBP currency code', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: { ...VALID_LISTING, currency: 'GBP' },
    }));
    expect(res.status).toBe(200);
  });

  it('accepts listing without currency field (optional)', async () => {
    const { POST } = await import('../scrape/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'VESTIAIRE',
      listing: VALID_LISTING,
    }));
    expect(res.status).toBe(200);
  });
});
