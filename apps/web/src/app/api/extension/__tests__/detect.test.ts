/**
 * Tests for POST /api/extension/detect (H1.1)
 * Verifies platform detection event endpoint.
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

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new Request('http://localhost/api/extension/detect', {
    method: 'POST',
    headers,
    body: JSON.stringify({ channel: 'POSHMARK', url: 'https://poshmark.com/feed' }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/detect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });
  });

  it('returns 401 for missing Authorization header', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Unauthorized'));
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer invalid-token'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for registration token (wrong purpose)', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer some-reg-token'));
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 200 for valid session token', async () => {
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer valid-session-token'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});
