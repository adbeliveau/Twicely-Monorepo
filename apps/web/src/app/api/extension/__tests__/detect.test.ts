/**
 * Tests for POST /api/extension/detect (H1.1)
 * Verifies platform detection event endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

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

describe('POST /api/extension/detect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
  });

  it('returns 401 for missing Authorization header', async () => {
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer invalid-token'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for registration token (wrong purpose)', async () => {
    const regToken = await makeRegistrationToken();
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest(`Bearer ${regToken}`));
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns 200 for valid session token', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});
