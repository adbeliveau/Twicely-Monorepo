/**
 * Additional tests for GET /api/extension/authorize (H1.1)
 * Covers: session-read throws → redirect to login, redirect param value,
 * callback URL is relative to request URL, null user id → redirect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('GET /api/extension/authorize — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);
    mockGetSession.mockResolvedValue(null);
  });

  it('redirects to login when auth.api.getSession throws', async () => {
    mockGetSession.mockRejectedValue(new Error('Session service unavailable'));
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    // Session read error is treated as unauthenticated → redirect to login
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

  it('redirects to login when session.user.id is null/undefined', async () => {
    mockGetSession.mockResolvedValue({ user: { id: null } });
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/auth/login');
  });

  it('callback URL is relative to the request URL origin', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-abc' } });
    const requestUrl = 'https://twicely.co/api/extension/authorize';
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest(requestUrl));
    const location = res.headers.get('location') ?? '';
    // The callback must be on the same origin as the request
    expect(location).toContain('twicely.co');
    expect(location).toContain('/api/extension/callback');
  });

  it('redirects to login when session returns user with empty string id', async () => {
    mockGetSession.mockResolvedValue({ user: { id: '' } });
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/auth/login');
  });

  it('different user id is embedded in the token', async () => {
    const { jwtVerify } = await import('jose');
    mockGetSession.mockResolvedValue({ user: { id: 'user-different-123' } });
    const { GET } = await import('../authorize/route');
    const res = await GET(makeRequest());
    const location = res.headers.get('location') ?? '';
    const url = new URL(location);
    const token = url.searchParams.get('token') ?? '';
    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(token, secret);
    expect(payload['userId']).toBe('user-different-123');
  });
});
