/**
 * Tests for POST /api/extension/heartbeat (H1.1)
 * Verifies extension health check and connected channel list.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: {
    channel: 'channel',
    sellerId: 'seller_id',
    status: 'account_status',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq`),
  and: vi.fn((..._args: unknown[]) => `and`),
}));

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
  return new Request('http://localhost/api/extension/heartbeat', {
    method: 'POST',
    headers,
  });
}

async function makeSessionToken(
  overrides: Record<string, unknown> = {},
  expiresIn = '30d',
): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT({
    userId: 'user-abc',
    purpose: 'extension-session',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
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

describe('POST /api/extension/heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);

    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('returns 401 for missing Authorization header', async () => {
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 for Authorization header without Bearer prefix', async () => {
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Token some-token'));
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer invalid-jwt-token'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for token with wrong purpose (registration token)', async () => {
    const regToken = await makeRegistrationToken();
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${regToken}`));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns connected channels for authenticated seller', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { channel: 'POSHMARK' },
          { channel: 'THEREALREAL' },
        ]),
      }),
    });

    const token = await makeSessionToken();
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; connectedChannels: string[] };
    expect(body.success).toBe(true);
    expect(body.connectedChannels).toEqual(['POSHMARK', 'THEREALREAL']);
  });

  it('returns empty channels array for seller with no connections', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { connectedChannels: string[] };
    expect(body.connectedChannels).toEqual([]);
  });

  it('returns serverTime as number', async () => {
    const before = Date.now();
    const token = await makeSessionToken();
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    const after = Date.now();
    const body = await res.json() as { serverTime: number };
    expect(typeof body.serverTime).toBe('number');
    expect(body.serverTime).toBeGreaterThanOrEqual(before);
    expect(body.serverTime).toBeLessThanOrEqual(after + 100);
  });

  it('returns 200 with success: true for valid session token', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 401 for expired session token', async () => {
    const expiredToken = await makeSessionToken({}, '-1s');
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${expiredToken}`));
    expect(res.status).toBe(401);
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    vi.stubEnv('EXTENSION_JWT_SECRET', '');
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer some-token'));
    expect(res.status).toBe(503);
  });
});
