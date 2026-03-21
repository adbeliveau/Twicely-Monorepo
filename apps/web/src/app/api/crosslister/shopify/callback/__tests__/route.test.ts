/**
 * Unit tests for GET /api/crosslister/shopify/callback
 * Source: H3.1 install prompt §Test Requirements (callback route)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@twicely/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: {
    id: 'id', sellerId: 'sellerId', channel: 'channel',
    authMethod: 'authMethod', status: 'status',
    externalAccountId: 'externalAccountId', externalUsername: 'externalUsername',
    accessToken: 'accessToken', refreshToken: 'refreshToken',
    tokenExpiresAt: 'tokenExpiresAt', capabilities: 'capabilities',
    lastAuthAt: 'lastAuthAt', firstImportCompletedAt: 'firstImportCompletedAt',
    updatedAt: 'updatedAt',
  },
  platformSetting: { key: 'key', value: 'value' },
}));

const mockGetSession = vi.fn();
vi.mock('@twicely/auth/server', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const mockCan = vi.fn();
vi.mock('@twicely/casl', () => ({
  defineAbilitiesFor: vi.fn().mockReturnValue({ can: mockCan }),
  sub: vi.fn().mockImplementation((_type: string, val: unknown) => val),
}));

// Mock the ShopifyConnector module — the shared mockAuthFn is accessed via
// the module-level variable after module initialization.
const mockAuthFn = vi.fn();
vi.mock('@twicely/crosslister/connectors/shopify-connector', () => ({
  ShopifyConnector: class ShopifyConnectorMock {
    authenticate = mockAuthFn;
  },
}));

vi.mock('@twicely/crosslister/connectors', () => ({}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockReturnValue('eq-clause'),
  and: vi.fn().mockReturnValue('and-clause'),
  like: vi.fn().mockReturnValue('like-clause'),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-shopify-secret';

function computeHmac(params: URLSearchParams): string {
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hmac') pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  return createHmac('sha256', TEST_SECRET).update(pairs.join('&')).digest('hex');
}

function makeRequest(searchParamsObj: Record<string, string>, includeHmac = true): Request {
  const params = new URLSearchParams(searchParamsObj);
  if (includeHmac) {
    params.set('hmac', computeHmac(params));
  }
  return new Request(`http://localhost/api/crosslister/shopify/callback?${params.toString()}`);
}

function setupSecretMock(secret = TEST_SECRET) {
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ value: secret }]),
      }),
    }),
  });
}

function setupNoExistingAccount() {
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
}

function setupExistingAccount(id = 'existing-account-id') {
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id }]),
      }),
    }),
  });
}

const successAuthResult = {
  success: true,
  accessToken: 'shpat_new-token',
  externalAccountId: 'my-store.myshopify.com',
  externalUsername: 'My Store',
  refreshToken: null,
  tokenExpiresAt: null,
  capabilities: {},
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/crosslister/shopify/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { id: 'seller-1', email: 'seller@example.com', isSeller: true },
    });
    mockCan.mockReturnValue(true);
    mockAuthFn.mockResolvedValue(successAuthResult);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('redirects to error URL when code param is missing', async () => {
    // No setupSecretMock — the route returns before reading the client secret
    // when code is absent. Adding a mockReturnValueOnce here would leave an
    // unconsumed queue entry that cascades into the next test's db.select calls.
    const { GET } = await import('../route');
    const params = new URLSearchParams({ shop: 'my-store.myshopify.com' });
    params.set('hmac', computeHmac(params));
    const request = new Request(`http://localhost/api/crosslister/shopify/callback?${params.toString()}`);
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('redirects to error URL when HMAC is invalid', async () => {
    setupSecretMock();
    const { GET } = await import('../route');
    const params = new URLSearchParams({
      code: 'auth-code',
      shop: 'my-store.myshopify.com',
      state: 'test-state',
      hmac: 'invalid-hmac-value',
    });
    const request = new Request(`http://localhost/api/crosslister/shopify/callback?${params.toString()}`);
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('redirects to /auth/login when no session exists', async () => {
    setupSecretMock();
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import('../route');
    const request = makeRequest({ code: 'auth-code', shop: 'my-store.myshopify.com', state: 'state' });
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('/auth/login');
  });

  it('redirects to error URL when CASL denies access', async () => {
    setupSecretMock();
    mockCan.mockReturnValue(false);
    const { GET } = await import('../route');
    const request = makeRequest({ code: 'auth-code', shop: 'my-store.myshopify.com', state: 'state' });
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('creates new crosslisterAccount row and redirects to success URL on new connection', async () => {
    setupSecretMock();
    setupNoExistingAccount();
    const { GET } = await import('../route');
    const request = makeRequest({ code: 'auth-code', shop: 'my-store.myshopify.com', state: 'state' });
    const response = await GET(request as never);
    expect(mockDbInsert).toHaveBeenCalled();
    expect(response.headers.get('Location')).toContain('connected=shopify');
  });

  it('updates existing crosslisterAccount row on re-connection', async () => {
    setupSecretMock();
    setupExistingAccount('existing-account-id');
    const { GET } = await import('../route');
    const request = makeRequest({ code: 'auth-code', shop: 'my-store.myshopify.com', state: 'state' });
    const response = await GET(request as never);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(response.headers.get('Location')).toContain('connected=shopify');
  });

  it('redirects to error URL when Shopify auth fails', async () => {
    setupSecretMock();
    mockAuthFn.mockResolvedValue({ success: false, error: 'invalid_grant', accessToken: null });
    const { GET } = await import('../route');
    const request = makeRequest({ code: 'bad-code', shop: 'my-store.myshopify.com', state: 'state' });
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('redirects to error URL when shop param is missing', async () => {
    // No setupSecretMock — route returns before reading the secret when shop is absent
    const { GET } = await import('../route');
    const params = new URLSearchParams({ code: 'auth-code' });
    params.set('hmac', computeHmac(params));
    const request = new Request(`http://localhost/api/crosslister/shopify/callback?${params.toString()}`);
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('redirects to error URL when both code and shop params are missing', async () => {
    const { GET } = await import('../route');
    const request = new Request('http://localhost/api/crosslister/shopify/callback');
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('redirects to error URL when HMAC param is absent from the request', async () => {
    setupSecretMock();
    const { GET } = await import('../route');
    // Build a request without the hmac param at all
    const params = new URLSearchParams({
      code: 'auth-code',
      shop: 'my-store.myshopify.com',
      state: 'state',
    });
    const request = new Request(`http://localhost/api/crosslister/shopify/callback?${params.toString()}`);
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('redirects to error URL when DB throws loading client secret', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('DB connection lost')),
        }),
      }),
    });
    const { GET } = await import('../route');
    const request = makeRequest({ code: 'auth-code', shop: 'my-store.myshopify.com', state: 'state' });
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });

  it('redirects to error URL when auth succeeds but accessToken is null', async () => {
    setupSecretMock();
    // success: true but no token (defensive edge case)
    mockAuthFn.mockResolvedValue({ success: true, accessToken: null, externalAccountId: null });
    const { GET } = await import('../route');
    const request = makeRequest({ code: 'auth-code', shop: 'my-store.myshopify.com', state: 'state' });
    const response = await GET(request as never);
    expect(response.headers.get('Location')).toContain('error=auth_failed');
  });
});
