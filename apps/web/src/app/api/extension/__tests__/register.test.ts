/**
 * Tests for POST /api/extension/register (H1.1)
 * Verifies registration token exchange for long-lived extension session token.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', displayName: 'display_name', name: 'name', image: 'image', avatarUrl: 'avatar_url' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq(${String(_col)},${String(_val)})`),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key, defaultVal) => Promise.resolve(defaultVal)),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';
const WRONG_SECRET = 'wrong-extension-jwt-secret-32chars!';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/extension/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function makeRegistrationToken(
  overrides: Record<string, unknown> = {},
  expiresIn = '5m',
  secret = TEST_SECRET,
): Promise<string> {
  const s = new TextEncoder().encode(secret);
  return new SignJWT({
    userId: 'user-abc',
    purpose: 'extension-registration',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(s);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            displayName: 'Jane Seller',
            name: 'Jane',
            image: null,
            avatarUrl: null,
          }]),
        }),
      }),
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

  it('returns 403 for expired registration token', async () => {
    const expiredToken = await makeRegistrationToken({}, '-1s');
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: expiredToken, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid or expired token');
  });

  it('returns 403 for token with wrong purpose', async () => {
    const wrongPurposeToken = await makeRegistrationToken({ purpose: 'extension-session' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: wrongPurposeToken, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token purpose');
  });

  it('returns 403 for token signed with wrong secret', async () => {
    const wrongToken = await makeRegistrationToken({}, '5m', WRONG_SECRET);
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: wrongToken, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const token = await makeRegistrationToken();
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('User not found');
  });

  it('returns valid 30-day extension token for valid registration', async () => {
    const token = await makeRegistrationToken();
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; token: string };
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(10);
  });

  it('response includes userId, displayName, avatarUrl, expiresAt', async () => {
    const token = await makeRegistrationToken();
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
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
    const regToken = await makeRegistrationToken();
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: regToken, extensionVersion: '0.1.0' }));
    const body = await res.json() as { token: string };

    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(body.token, secret);
    expect(payload['purpose']).toBe('extension-session');
    expect(payload['userId']).toBe('user-abc');
  });

  it('falls back to user name when displayName is null', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ displayName: null, name: 'John', image: null, avatarUrl: null }]),
        }),
      }),
    });

    const token = await makeRegistrationToken();
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    const body = await res.json() as { displayName: string };
    expect(body.displayName).toBe('John');
  });

  it('falls back to "Seller" when both displayName and name are null', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ displayName: null, name: null, image: null, avatarUrl: null }]),
        }),
      }),
    });

    const token = await makeRegistrationToken();
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    const body = await res.json() as { displayName: string };
    expect(body.displayName).toBe('Seller');
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    vi.stubEnv('EXTENSION_JWT_SECRET', '');
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: 'any', extensionVersion: '0.1.0' }));
    expect(res.status).toBe(503);
  });
});
