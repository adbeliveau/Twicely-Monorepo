/**
 * Tests for POST /api/extension/heartbeat (H1.1)
 * Verifies extension health check and connected channel list.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Extension-auth mock ─────────────────────────────────────────────────────

const { MockExtAuthError, mockAuth } = vi.hoisted(() => ({
  MockExtAuthError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ExtensionAuthError';
      this.status = status;
    }
  },
  mockAuth: vi.fn(),
}));

vi.mock('@/lib/auth/extension-auth', () => ({
  authenticateExtensionRequest: mockAuth,
  ExtensionAuthError: MockExtAuthError,
}));

// ─── Other mocks ─────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('returns 401 for missing Authorization header', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Unauthorized'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 for Authorization header without Bearer prefix', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Unauthorized'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Token some-token'));
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer invalid-jwt-token'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for token with wrong purpose (registration token)', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer some-reg-token'));
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

    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; connectedChannels: string[] };
    expect(body.success).toBe(true);
    expect(body.connectedChannels).toEqual(['POSHMARK', 'THEREALREAL']);
  });

  it('returns empty channels array for seller with no connections', async () => {
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    expect(res.status).toBe(200);
    const body = await res.json() as { connectedChannels: string[] };
    expect(body.connectedChannels).toEqual([]);
  });

  it('returns serverTime as number', async () => {
    const before = Date.now();
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    const after = Date.now();
    const body = await res.json() as { serverTime: number };
    expect(typeof body.serverTime).toBe('number');
    expect(body.serverTime).toBeGreaterThanOrEqual(before);
    expect(body.serverTime).toBeLessThanOrEqual(after + 100);
  });

  it('returns 200 with success: true for valid session token', async () => {
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 401 for expired session token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer expired-token'));
    expect(res.status).toBe(401);
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(503, 'Extension authentication unavailable'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer some-token'));
    expect(res.status).toBe(503);
  });
});
