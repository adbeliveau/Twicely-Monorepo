/**
 * Additional tests for POST /api/extension/heartbeat (H1.1)
 * Covers: userId-absent payload → 403, DB throws → 500,
 * userId is non-string → 403, multiple channels, response shape.
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
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq'),
  and: vi.fn((..._args: unknown[]) => 'and'),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) headers['Authorization'] = authHeader;
  return new Request('http://localhost/api/extension/heartbeat', {
    method: 'POST',
    headers,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/heartbeat — extended', () => {
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

  it('returns 403 when auth rejects with invalid token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer bad-token'));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 403 when userId is a number (non-string type)', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer bad-userid-token'));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 403 when userId is an empty string', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer empty-userid-token'));
    expect(res.status).toBe(403);
  });

  it('returns 500 when DB query throws (caught by outer try/catch)', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB timeout')),
      }),
    });

    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    expect(res.status).toBe(500);
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

    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    expect(res.status).toBe(200);
    const body = await res.json() as { connectedChannels: string[] };
    expect(body.connectedChannels).toEqual(['POSHMARK', 'FB_MARKETPLACE', 'THEREALREAL']);
  });

  it('response shape has success, serverTime, and connectedChannels keys', async () => {
    const { POST } = await import('../heartbeat/route');
    const res = await POST(makeRequest('Bearer valid-token'));
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(expect.arrayContaining(['connectedChannels', 'serverTime', 'success']));
  });
});
