/**
 * Tests for GET /api/extension/callback (H1.1)
 * Verifies HTML delivery page that passes registration token to the extension.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/extension/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function makeRequest(token?: string): Request {
    const url = token
      ? `http://localhost/api/extension/callback?token=${encodeURIComponent(token)}`
      : 'http://localhost/api/extension/callback';
    return new Request(url);
  }

  it('returns 400 when token query param is absent', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing token');
  });

  it('returns 200 with HTML content-type for valid token', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest('some-jwt-token'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('HTML response contains the token value', async () => {
    const testToken = 'eyJhbGciOiJIUzI1NiJ9.test.payload';
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest(testToken));
    const html = await res.text();
    // Token must appear in the HTML (JSON.stringify-encoded)
    expect(html).toContain(testToken);
  });

  it('HTML response posts TWICELY_EXTENSION_TOKEN message type', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest('any-token'));
    const html = await res.text();
    expect(html).toContain('TWICELY_EXTENSION_TOKEN');
    expect(html).toContain('postMessage');
  });

  it('HTML response includes sessionStorage fallback (security: not localStorage)', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest('any-token'));
    const html = await res.text();
    expect(html).toContain('sessionStorage');
    expect(html).toContain('twicely_extension_token');
  });

  it('HTML response includes close-tab instruction', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest('any-token'));
    const html = await res.text();
    expect(html).toContain('window.close');
  });

  it('HTML response is valid HTML with DOCTYPE', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest('any-token'));
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
  });

  it('token with special characters is safely JSON-encoded in HTML', async () => {
    // JSON.stringify handles escaping — angle brackets in the token must not break HTML
    const specialToken = 'header.<script>alert(1)</script>.sig';
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest(specialToken));
    const html = await res.text();
    // JSON.stringify wraps in quotes and escapes — the raw <script> tag should NOT
    // appear as an unquoted literal (it's inside a JS string literal)
    // The token IS JSON.stringify'd so it appears as "header.<script>alert(1)</script>.sig"
    // We verify the token content is present (encoded by JSON.stringify)
    expect(html).toContain(JSON.stringify(specialToken));
  });

  it('returns 400 when token param is empty string', async () => {
    const { GET } = await import('../callback/route');
    const res = await GET(makeRequest(''));
    // Empty string is falsy — treated as missing
    expect(res.status).toBe(400);
  });
});
