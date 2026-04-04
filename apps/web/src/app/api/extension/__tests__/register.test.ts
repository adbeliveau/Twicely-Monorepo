/**
 * Tests for POST /api/extension/register (H1.1)
 * Verifies registration token exchange for long-lived extension session token.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Extension-auth mock ─────────────────────────────────────────────────────

const { MockExtAuthError, mockVerify, mockIssueToken } = vi.hoisted(() => ({
  MockExtAuthError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ExtensionAuthError';
      this.status = status;
    }
  },
  mockVerify: vi.fn(),
  mockIssueToken: vi.fn(),
}));

vi.mock('@/lib/auth/extension-auth', () => ({
  verifyExtensionToken: mockVerify,
  issueExtensionToken: mockIssueToken,
  ExtensionAuthError: MockExtAuthError,
}));

// ─── Other mocks ─────────────────────────────────────────────────────────────

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key, defaultVal) => Promise.resolve(defaultVal)),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/extension/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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

const DEFAULT_CONTEXT = {
  claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
  principal: { userId: 'user-abc', displayName: 'Jane Seller', name: 'Jane', image: null, avatarUrl: null },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
    mockVerify.mockResolvedValue(DEFAULT_CONTEXT);
    mockIssueToken.mockImplementation(async (claims: Record<string, unknown>, purpose: string, expiresIn: string) => {
      return signJwt(claims, purpose, expiresIn);
    });
  });

  it('returns 400 for missing registration token', async () => {
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ extensionVersion: '0.1.0' }));
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../register/route');
    const req = new Request('http://localhost/api/extension/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 for expired registration token', async () => {
    mockVerify.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'expired-token', extensionVersion: '0.1.0' }));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid or expired token');
  });

  it('returns 403 for token with wrong purpose', async () => {
    mockVerify.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'wrong-purpose-token', extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 401 for token signed with wrong secret', async () => {
    mockVerify.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'wrong-secret-token', extensionVersion: '0.1.0' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-existent or invalid user', async () => {
    mockVerify.mockRejectedValue(new MockExtAuthError(403, 'Invalid or revoked token'));
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'valid-token', extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid or revoked token');
  });

  it('returns valid 30-day extension token for valid registration', async () => {
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'valid-reg-token', extensionVersion: '0.1.0' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; token: string };
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(10);
  });

  it('response includes userId, displayName, avatarUrl, expiresAt', async () => {
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'valid-reg-token', extensionVersion: '0.1.0' }));
    const body = await res.json() as {
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      expiresAt: number;
    };
    expect(body.userId).toBe('user-abc');
    expect(body.displayName).toBe('Jane Seller');
    expect(body.avatarUrl).toBeNull();
    expect(typeof body.expiresAt).toBe('number');
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('extensionToken has purpose extension-session', async () => {
    const { jwtVerify } = await import('jose');
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'valid-reg-token', extensionVersion: '0.1.0' }));
    const body = await res.json() as { token: string };

    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(body.token, secret);
    expect(payload['purpose']).toBe('extension-session');
    expect(payload['userId']).toBe('user-abc');
  });

  it('falls back to user name when displayName is null', async () => {
    mockVerify.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: 'John', image: null, avatarUrl: null },
    });

    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'valid-reg-token', extensionVersion: '0.1.0' }));
    const body = await res.json() as { displayName: string };
    expect(body.displayName).toBe('John');
  });

  it('falls back to "Seller" when both displayName and name are null', async () => {
    mockVerify.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });

    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'valid-reg-token', extensionVersion: '0.1.0' }));
    const body = await res.json() as { displayName: string };
    expect(body.displayName).toBe('Seller');
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    mockIssueToken.mockRejectedValue(new MockExtAuthError(503, 'Extension authentication unavailable'));
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'valid-reg-token', extensionVersion: '0.1.0' }));
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Extension authentication unavailable');
  });
});
