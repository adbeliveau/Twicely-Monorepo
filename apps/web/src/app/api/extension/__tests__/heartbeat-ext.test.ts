/**
 * Additional tests for POST /api/extension/heartbeat (H1.1)
 * Covers: userId-absent payload → 403, DB throws (caught by outer try/catch → 401),
 * userId is non-string → 403, multiple channels, response shape.
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
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq'),
  and: vi.fn((..._args: unknown[]) => 'and'),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) headers['Authorization'] = authHeader;
  return new Request('http://localhost/api/extension/heartbeat', {
    method: 'POST',
    headers,
  });
}

async function makeTokenWithPayload(payload: Record<string, unknown>, expiresIn = '30d'): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(s);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/heartbeat — extended', () => {
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

  it('returns 403 when JWT purpose is extension-session but userId is absent', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-session' });
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 403 when userId is a number (non-string type)', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-session', userId: 12345 });
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 403 when userId is an empty string', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-session', userId: '' });
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(403);
  });

  it('returns 401 when DB query throws (caught by outer try/catch)', async () => {
    // The heartbeat try/catch wraps everything including the DB call.
    // A DB error surfaces as 401 (implementation behavior).
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB timeout')),
      }),
    });

    const token = await makeTokenWithPayload({ purpose: 'extension-session', userId: 'user-abc' });
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(401);
  });

  it('maps multiple active channels correctly', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { channel: 'POSHMARK' },
          { channel: 'FB_MARKETPLACE' },
          { channel: 'THEREALREAL' },
        ]),
      }),
    });

    const token = await makeTokenWithPayload({ purpose: 'extension-session', userId: 'user-abc' });
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { connectedChannels: string[] };
    expect(body.connectedChannels).toEqual(['POSHMARK', 'FB_MARKETPLACE', 'THEREALREAL']);
  });

  it('response shape has success, serverTime, and connectedChannels keys', async () => {
    const token = await makeTokenWithPayload({ purpose: 'extension-session', userId: 'user-abc' });
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest(`Bearer ${token}`));
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(expect.arrayContaining(['connectedChannels', 'serverTime', 'success']));
  });
});
