/**
 * Additional tests for POST /api/extension/detect (H1.1)
 * Covers: 503 missing-secret, expired token, no-secret ordering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Extension-auth mock ──────────────────────────────��──────────────────────

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

// ─── Other mocks ─────��───────────────────────────────���───────────────────────

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────���───────────────

function makeRequest(authHeader?: string, body?: unknown): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) headers['Authorization'] = authHeader;
  return new Request('http://localhost/api/extension/detect', {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? { channel: 'POSHMARK', url: 'https://poshmark.com/feed' }),
  });
}

// ─── Tests ──────────────────────────────���─────────────────────────────────────

describe('POST /api/extension/detect — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(503, 'Extension authentication unavailable'));
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer any-token'));
    expect(res.status).toBe(503);
  });

  it('returns 401 for expired session token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer expired-token'));
    expect(res.status).toBe(401);
  });

  it('returns 401 for missing Authorization header (no Bearer prefix variant)', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Unauthorized'));
    const { POST } = await import('../detect/route');
    const req = new Request('http://localhost/api/extension/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'POSHMARK' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('detect returns 200 for valid session token', async () => {
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns success:false body on 401 for invalid token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer bad.token.here'));
    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns success:false body on 403 for wrong purpose', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer reg-purpose-token'));
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });
});
