/**
 * Additional tests for GET /api/extension/authorize (H1.1)
 * Covers: session-read throws -> redirect to login, redirect param value,
 * callback URL is relative to request URL, null user id -> redirect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Extension-auth mock ---

const { MockExtAuthError, mockGetCtx, mockIssueToken } = vi.hoisted(() => ({
  MockExtAuthError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ExtensionAuthError';
      this.status = status;
    }
  },
  mockGetCtx: vi.fn(),
  mockIssueToken: vi.fn(),
}));

vi.mock('@/lib/auth/extension-auth', () => ({
  getCurrentExtensionRegistrationContext: mockGetCtx,
  issueExtensionToken: mockIssueToken,
  ExtensionAuthError: MockExtAuthError,
}));

// --- Other mocks ---

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key, defaultVal) => Promise.resolve(defaultVal)),
}));

let storedTokenInValkey = '';
vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: () => ({
    set: vi.fn().mockImplementation((_key: string, token: string) => {
      storedTokenInValkey = token;
      return Promise.resolve('OK');
    }),
    get: vi.fn().mockImplementation(() => Promise.resolve(storedTokenInValkey)),
    del: vi.fn().mockResolvedValue(1),
  }),
}));
vi.mock('@twicely/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

// --- Helpers ---

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

function makeRequest(url = 'https://twicely.co/api/extension/authorize'): Request {
  return new Request(url);
}

async function signJwt(claims: Record<string, unknown>, purpose: string, expiresIn: string): Promise<string> {
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT({ ...claims, purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

const OK_CONTEXT = {
  kind: 'ok' as const,
  context: {
    claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
    principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
  },
};

// --- Tests ---

describe('GET /api/extension/authorize - extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
    mockGetCtx.mockResolvedValue({ kind: 'anonymous' });
    mockIssueToken.mockImplementation(async (claims: Record<string, unknown>, purpose: string, expiresIn: string) => {
      return signJwt(claims, purpose, expiresIn);
    });
    storedTokenInValkey = '';
  });

  it('redirects to login when context is anonymous (e.g. getSession throws)', async () => {
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/auth/login');
  });

  it('redirect param is exactly /api/extension/authorize', async () => {
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    const location = res.headers.get('location') ?? '';
    const loginUrl = new URL(location);
    const redirectParam = loginUrl.searchParams.get('redirect');
    expect(redirectParam).toBe('/api/extension/authorize');
  });

  it('redirects to login when context is anonymous (session.user.id is null)', async () => {
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/auth/login');
  });

  it('callback URL is relative to the request URL origin', async () => {
    mockGetCtx.mockResolvedValue(OK_CONTEXT);
    const requestUrl = 'https://twicely.co/api/extension/authorize';
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest(requestUrl));
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('twicely.co');
    expect(location).toContain('/api/extension/callback');
  });

  it('redirects to login when session returns user with empty string id', async () => {
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/auth/login');
  });

  it('different user id is embedded in the token stored in Valkey', async () => {
    mockGetCtx.mockResolvedValue({
      kind: 'ok',
      context: {
        claims: { userId: 'user-different-123', sessionId: 'sess-1', credentialUpdatedAtMs: null },
        principal: { userId: 'user-different-123', displayName: null, name: null, image: null, avatarUrl: null },
      },
    });
    const { GET } = await import('../authorize/route');
    await GET(makeRequest());
    // SEC-018: Token is now stored in Valkey, not in URL
    const token = storedTokenInValkey;
    expect(token).toBeTruthy();
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);
    expect(payload['userId']).toBe('user-different-123');
  });
});
