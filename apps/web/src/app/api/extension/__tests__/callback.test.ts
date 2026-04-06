/**
 * Tests for GET /api/extension/callback (H1.1)
 * Verifies HTML delivery page that passes registration token to the extension.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Valkey mock ─────────────────────────────────────────────────────────────
const mockValkeyGet = vi.fn();
const mockValkeyDel = vi.fn();
vi.mock('@twicely/db/cache', () => ({
  getValkeyClient: () => ({ get: mockValkeyGet, del: mockValkeyDel }),
}));
vi.mock('@twicely/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/extension/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockValkeyGet.mockResolvedValue(null);
    mockValkeyDel.mockResolvedValue(1);
  });

  function makeRequest(params?: Record<string, string>): Request {
    const url = new URL('http://localhost/api/extension/callback');
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    return new Request(url.toString());
  }

  it('returns 400 when no code or token provided', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing authorization');
  });

  it('exchanges one-time code for token via Valkey', async () => {
    mockValkeyGet.mockResolvedValue('some-jwt-token');
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'abc123' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(mockValkeyGet).toHaveBeenCalledWith('ext-auth-code:abc123');
    expect(mockValkeyDel).toHaveBeenCalledWith('ext-auth-code:abc123');
  });

  it('returns 400 when code is expired or invalid', async () => {
    mockValkeyGet.mockResolvedValue(null);
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'expired-code' }));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('expired or invalid');
  });

  it('rejects direct token param (legacy fallback removed for security)', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ token: 'some-jwt-token' }));
    expect(res.status).toBe(400);
  });

  it('HTML response contains the token value', async () => {
    const testToken = 'eyJhbGciOiJIUzI1NiJ9.test.payload';
    mockValkeyGet.mockResolvedValue(testToken);
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'c1' }));
    const html = await res.text();
    expect(html).toContain(testToken);
  });

  it('HTML response posts TWICELY_EXTENSION_TOKEN message type', async () => {
    mockValkeyGet.mockResolvedValue('any-token');
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'c2' }));
    const html = await res.text();
    expect(html).toContain('TWICELY_EXTENSION_TOKEN');
    expect(html).toContain('postMessage');
  });

  it('HTML response includes sessionStorage fallback (security: not localStorage)', async () => {
    mockValkeyGet.mockResolvedValue('any-token');
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'c3' }));
    const html = await res.text();
    expect(html).toContain('sessionStorage');
    expect(html).toContain('twicely_extension_token');
  });

  it('HTML response includes close-tab instruction', async () => {
    mockValkeyGet.mockResolvedValue('any-token');
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'c4' }));
    const html = await res.text();
    expect(html).toContain('window.close');
  });

  it('HTML response is valid HTML with DOCTYPE', async () => {
    mockValkeyGet.mockResolvedValue('any-token');
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'c5' }));
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
  });

  it('token with special characters is safely JSON-encoded in HTML', async () => {
    const specialToken = 'header.<script>alert(1)</script>.sig';
    mockValkeyGet.mockResolvedValue(specialToken);
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest({ code: 'c6' }));
    const html = await res.text();
    expect(html).toContain(JSON.stringify(specialToken));
  });

  it('returns 400 when neither code nor token provided', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });
});
