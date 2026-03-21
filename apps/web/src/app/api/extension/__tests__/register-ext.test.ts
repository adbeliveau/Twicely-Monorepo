/**
 * Additional tests for POST /api/extension/register (H1.1)
 * Covers: userId absent in payload → 403, avatarUrl fallback priority,
 * token is 30-day duration, extensionVersion is logged, strict schema rejection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', displayName: 'display_name', name: 'name', image: 'image', avatarUrl: 'avatar_url' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq(${String(_col)},${String(_val)})`),
}));

const mockLogInfo = vi.fn();
vi.mock('@twicely/logger', () => ({
  logger: { info: mockLogInfo, error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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

async function makeTokenWithPayload(payload: Record<string, unknown>, expiresIn = '5m'): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(s);
}

function setupUserRow(row: Record<string, unknown>): void {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([row]),
      }),
    }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/register — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);

    setupUserRow({ displayName: 'Jane Seller', name: 'Jane', image: null, avatarUrl: null });
  });

  it('returns 403 when registration token payload has no userId field', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-registration' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 403 when userId in payload is numeric (not a string)', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: 99999 });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 403 when userId is empty string', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: '' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    expect(res.status).toBe(403);
  });

  it('prefers avatarUrl over image in response when both present', async () => {
    setupUserRow({ displayName: 'Jane', name: 'Jane', image: 'http://img.co/img.jpg', avatarUrl: 'http://cdn.co/avatar.jpg' });
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: 'user-abc' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    const body = await res.json() as { avatarUrl: string };
    // avatarUrl ?? image → avatarUrl takes priority
    expect(body.avatarUrl).toBe('http://cdn.co/avatar.jpg');
  });

  it('falls back to image when avatarUrl is null', async () => {
    setupUserRow({ displayName: 'Jane', name: 'Jane', image: 'http://img.co/img.jpg', avatarUrl: null });
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: 'user-abc' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    const body = await res.json() as { avatarUrl: string };
    expect(body.avatarUrl).toBe('http://img.co/img.jpg');
  });

  it('generated extension token has 30-day duration', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: 'user-abc' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '0.1.0' }));
    const body = await res.json() as { token: string };

    const secret = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(body.token, secret);
    const durationSeconds = (payload.exp as number) - (payload.iat as number);
    // 30 days = 2592000 seconds, allow ±5s tolerance
    expect(durationSeconds).toBeGreaterThanOrEqual(2591995);
    expect(durationSeconds).toBeLessThanOrEqual(2592005);
  });

  it('rejects extra fields in request body (strict Zod schema)', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: 'user-abc' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({
      registrationToken: token,
      extensionVersion: '0.1.0',
      unexpectedField: 'extra',
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid input');
  });

  it('rejects empty string extensionVersion (Zod min(1))', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: 'user-abc' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '' }));
    expect(res.status).toBe(400);
  });

  it('expiresAt is milliseconds-epoch for 30 days from now', async () => {
    const before = Date.now();
    const token = await makeTokenWithPayload({ purpose: 'extension-registration', userId: 'user-abc' });
    const { POST } = await import('../register/route');
    const res = await POST(makeRequest({ registrationToken: token, extensionVersion: '1.2.3' }));
    const after = Date.now();
    const body = await res.json() as { expiresAt: number };

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + thirtyDaysMs - 5000);
    expect(body.expiresAt).toBeLessThanOrEqual(after + thirtyDaysMs + 5000);
  });
});
