/**
 * Tests for GET /api/extension/authorize (H1.1)
 * Verifies registration token generation and redirect behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtVerify } from 'jose';

// ─── Extension-auth mock ──────────────────��────────────────────────��─────────

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

// ─── Other mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key, defaultVal) => Promise.resolve(defaultVal)),
}));

// ─── Helpers ���─────────────────────��──────────────────────��────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

function makeRequest(url = 'https://twicely.co/api/extension/authorize'): Request {
  return new Request(url);
}

// Real JWT generation for token content tests
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

// ─── Tests ───────────────────────────────���────────────────────────────────────

describe('GET /api/extension/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
    mockGetCtx.mockResolvedValue({ kind: 'anonymous' });
    // Default: issue real JWT tokens
    mockIssueToken.mockImplementation(async (claims: Record<string, unknown>, purpose: string, expiresIn: string) => {
      return signJwt(claims, purpose, expiresIn);
    });
  });

  it('redirects to login if not authenticated', async () => {
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/auth/login');
    expect(location).toContain('redirect');
  });

  it('generates registration token and redirects to callback', async () => {
    mockGetCtx.mockResolvedValue(OK_CONTEXT);
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/api/extension/callback');
    expect(location).toContain('token=');
  });

  it('registration token expires in 5 minutes', async () => {
    mockGetCtx.mockResolvedValue(OK_CONTEXT);
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    const location = res.headers.get('location') ?? '';
    const url = new URL(location);
    const token = url.searchParams.get('token') ?? '';

    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const exp = payload.exp as number;
    const iat = payload.iat as number;
    const durationSeconds = exp - iat;
    // Should be exactly 5 minutes (300 seconds), allow ±5s tolerance
    expect(durationSeconds).toBeGreaterThanOrEqual(295);
    expect(durationSeconds).toBeLessThanOrEqual(305);
    expect(exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('registration token contains userId and purpose', async () => {
    mockGetCtx.mockResolvedValue({
      kind: 'ok',
      context: {
        claims: { userId: 'user-xyz', sessionId: 'sess-1', credentialUpdatedAtMs: null },
        principal: { userId: 'user-xyz', displayName: null, name: null, image: null, avatarUrl: null },
      },
    });
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    const location = res.headers.get('location') ?? '';
    const url = new URL(location);
    const token = url.searchParams.get('token') ?? '';

    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);
    expect(payload['userId']).toBe('user-xyz');
    expect(payload['purpose']).toBe('extension-registration');
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    mockGetCtx.mockResolvedValue(OK_CONTEXT);
    mockIssueToken.mockRejectedValue(new MockExtAuthError(503, 'Extension authentication unavailable'));
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });
});
