/**
 * Additional tests for POST /api/extension/session (H1.1)
 * Covers: JSON parse error, DB throw → 500, expired token, missing userId in payload,
 * strict schema rejection, THEREALREAL channel acceptance, new-account insert field shape.
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
  eq: vi.fn((_col: unknown, _val: unknown) => 'eq'),
  and: vi.fn((..._args: unknown[]) => 'and'),
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

function makeRequest(authHeader: string | undefined, body: unknown, malformed = false): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader !== undefined) headers['Authorization'] = authHeader;
  return new Request('http://localhost/api/extension/session', {
    method: 'POST',
    headers,
    body: malformed ? 'not-json{{' : JSON.stringify(body),
  });
}

function setupSelectNoExisting(): void {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
}

function setupUpdateChain(): { mockSet: ReturnType<typeof vi.fn> } {
  const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mockDbUpdate.mockReturnValue({ set: mockSet });
  return { mockSet };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/session — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockAuth.mockResolvedValue({
      claims: { userId: 'user-abc', sessionId: 'sess-1', credentialUpdatedAtMs: null },
      principal: { userId: 'user-abc', displayName: null, name: null, image: null, avatarUrl: null },
    });

    setupSelectNoExisting();
    setupUpdateChain();
    mockDbInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  it('returns 400 for malformed JSON body (parse error)', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', null, true));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 401 for expired session token', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(401, 'Invalid token'));
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer expired', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when JWT payload has wrong purpose or missing userId', async () => {
    mockAuth.mockRejectedValue(new MockExtAuthError(403, 'Invalid token'));
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer bad-purpose', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid token');
  });

  it('returns 500 when DB insert throws', async () => {
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    });

    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Internal error');
  });

  it('returns 500 when DB update throws', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'acct-fail' }]),
        }),
      }),
    });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Constraint violation')),
      }),
    });

    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(500);
  });

  it('rejects extra fields in request body (strict schema)', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'POSHMARK',
      sessionData: {},
      extraField: 'not-allowed',
    }));
    expect(res.status).toBe(400);
  });

  it('accepts THEREALREAL channel with valid session', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer valid', {
      channel: 'THEREALREAL',
      sessionData: { accessToken: 'trr-123' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('new account insert includes authMethod SESSION and capabilities', async () => {
    let insertedValues: Record<string, unknown> | undefined;
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        insertedValues = vals;
        return Promise.resolve(undefined);
      }),
    });

    const { POST } = await import('../session/route');
    await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', sessionData: { key: 'val' } }));

    expect(insertedValues).toBeDefined();
    expect(insertedValues!['authMethod']).toBe('SESSION');
    expect(insertedValues!['status']).toBe('ACTIVE');
    expect(insertedValues!['capabilities']).toEqual({});
  });

  it('update clears lastError and lastErrorAt fields', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'acct-xyz' }]),
        }),
      }),
    });

    const { mockSet } = setupUpdateChain();
    const { POST } = await import('../session/route');
    await POST(makeRequest('Bearer valid', { channel: 'POSHMARK', sessionData: {} }));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ lastError: null, lastErrorAt: null }),
    );
  });
});
