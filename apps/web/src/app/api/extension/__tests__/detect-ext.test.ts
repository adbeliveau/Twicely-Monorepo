/**
 * Additional tests for POST /api/extension/detect (H1.1)
 * Covers: 503 missing-secret, expired token, no-secret ordering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

function makeRequest(authHeader?: string, body?: unknown): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) headers['Authorization'] = authHeader;
  return new Request('http://localhost/api/extension/detect', {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? { channel: 'POSHMARK', url: 'https://poshmark.com/feed' }),
  });
}

async function makeSessionToken(overrides: Record<string, unknown> = {}, expiresIn = '30d'): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT({ userId: 'user-abc', purpose: 'extension-session', ...overrides })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(s);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/detect — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    vi.stubEnv('EXTENSION_JWT_SECRET', '');
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer any-token'));
    expect(res.status).toBe(503);
  });

  it('returns 401 for expired session token', async () => {
    const expiredToken = await makeSessionToken({}, '-1s');
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest(`Bearer ${expiredToken}`));
    expect(res.status).toBe(401);
  });

  it('returns 401 for missing Authorization header (no Bearer prefix variant)', async () => {
    const { POST } = await import('../detect/route');
    // Completely absent header — distinct from empty string Bearer
    const req = new Request('http://localhost/api/extension/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'POSHMARK' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('detect does not check userId — token with valid purpose but no userId still returns 200', async () => {
    // detect/route.ts only checks purpose, not userId — this is intentional (telemetry-only endpoint)
    const token = await makeSessionToken({ userId: undefined });
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    // Purpose is valid — detect does not enforce userId presence
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns success:false body on 401 for invalid token', async () => {
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest('Bearer bad.token.here'));
    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });

  it('returns success:false body on 403 for wrong purpose', async () => {
    const s = new TextEncoder().encode(TEST_SECRET);
    const regToken = await new SignJWT({ userId: 'user-abc', purpose: 'extension-registration' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(s);
    const { POST } = await import('../detect/route');
    const res = await POST(makeRequest(`Bearer ${regToken}`));
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(false);
  });
});
