/**
 * Tests for POST /api/extension/session (H1.1)
 * Verifies Tier C session data upsert from extension.
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
const mockDbUpdate = vi.fn();
const mockDbInsert = vi.fn();

vi.mock('@twicely/db', () => ({
  db: { select: mockDbSelect, update: mockDbUpdate, insert: mockDbInsert },
}));

vi.mock('@twicely/db/schema', () => ({
  crosslisterAccount: {
    id: 'id',
    sellerId: 'seller_id',
    channel: 'channel',
    status: 'account_status',
    sessionData: 'session_data',
    lastAuthAt: 'last_auth_at',
    consecutiveErrors: 'consecutive_errors',
    lastError: 'last_error',
    lastErrorAt: 'last_error_at',
    updatedAt: 'updated_at',
    authMethod: 'auth_method',
    capabilities: 'capabilities',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => `eq`),
  and: vi.fn((..._args: unknown[]) => `and`),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@twicely/crosslister/token-crypto', () => ({
  encryptSessionData: vi.fn((data: unknown) => (data ? JSON.stringify(data) : null)),
  decryptSessionData: vi.fn((data: unknown) => data),
  encryptToken: vi.fn((v: string) => v),
  decryptToken: vi.fn((v: string) => v),
  withDecryptedTokens: vi.fn((a: unknown) => a),
}));

vi.mock('@twicely/casl', () => ({
  defineAbilitiesFor: vi.fn(() => ({ can: vi.fn(() => true) })),
  sub: vi.fn((_type, conditions) => conditions),
  ForbiddenError: class ForbiddenError extends Error {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader: string | undefined, body: unknown): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new Request('http://localhost/api/extension/session', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });

    // Default: no existing account
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const mockSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    mockDbInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('returns 401 for missing Authorization header', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Unauthorized'));
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(undefined, { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer bad-token', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for token with wrong purpose', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer reg-token', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid channel', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'EBAY', sessionData: {} }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid input');
  });

  it('accepts VESTIAIRE channel', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'VESTIAIRE', sessionData: {} }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for missing sessionData', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK' }));
    expect(res.status).toBe(400);
  });

  it('creates new crosslister account when none exists', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      sessionData: { cookie: 'pm_sess=abc123' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    expect(mockDbInsert).toHaveBeenCalledOnce();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('updates existing crosslister account with fresh session data', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'acct-xyz' }]),
        }),
      }),
    });

    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'THEREALREAL',
      sessionData: { token: 'trr-token-abc' },
    }));
    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('sets status to ACTIVE on session update', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'acct-xyz' }]),
        }),
      }),
    });

    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    const { POST } = await import('../session/route');
    await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', sessionData: {} }));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
    );
  });

  it('resets consecutiveErrors to 0 on session update', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'acct-xyz' }]),
        }),
      }),
    });

    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    const { POST } = await import('../session/route');
    await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', sessionData: {} }));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ consecutiveErrors: 0 }),
    );
  });

  it('accepts FB_MARKETPLACE channel', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'FB_MARKETPLACE',
      sessionData: { fbToken: 'fb-access-token' },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(503, 'Extension authentication unavailable'));
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer any', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(503);
  });
});
