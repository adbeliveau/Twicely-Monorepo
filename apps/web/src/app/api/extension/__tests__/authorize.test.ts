/**
 * Tests for GET /api/extension/authorize (H1.1)
 * Verifies registration token generation and redirect behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtVerify } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = vi.fn();
vi.mock('@twicely/auth/server', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key, defaultVal) => Promise.resolve(defaultVal)),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

function makeRequest(url = 'https://twicely.co/api/extension/authorize'): Request {
  return new Request(url);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/extension/authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
    mockGetSession.mockResolvedValue(null);
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
    mockGetSession.mockResolvedValue({ user: { id: 'user-abc' } });
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/api/extension/callback');
    expect(location).toContain('token=');
  });

  it('registration token expires in 5 minutes', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-abc' } });
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    const location = res.headers.get('location') ?? '';
    const url = new URL(location);
    const token = url.searchParams.get('token') ?? '';

    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp as number;
    const iat = payload.iat as number;
    const durationSeconds = exp - iat;
    // Should be exactly 5 minutes (300 seconds), allow ±5s tolerance
    expect(durationSeconds).toBeGreaterThanOrEqual(295);
    expect(durationSeconds).toBeLessThanOrEqual(305);
    expect(exp).toBeGreaterThan(now);
  });

  it('registration token contains userId and purpose', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-xyz' } });
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
    vi.stubEnv('EXTENSION_JWT_SECRET', '');
    mockGetSession.mockResolvedValue({ user: { id: 'user-abc' } });
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });
});
