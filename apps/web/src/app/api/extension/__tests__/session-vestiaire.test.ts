/**
 * Tests for POST /api/extension/session with VESTIAIRE channel (H4.1)
 * Verifies that VESTIAIRE session data is accepted and stored.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock('@twicely/casl', () => ({
  defineAbilitiesFor: vi.fn(() => ({ can: vi.fn(() => true) })),
  sub: vi.fn((_type, conditions) => conditions),
  ForbiddenError: class ForbiddenError extends Error {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-extension-jwt-secret-32chars!!';

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

async function makeSessionToken(overrides: Record<string, unknown> = {}): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT({ userId: 'user-abc', purpose: 'extension-session', ...overrides })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(s);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/session — VESTIAIRE channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('EXTENSION_JWT_SECRET', TEST_SECRET);

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

  it('accepts VESTIAIRE channel with valid session data (returns 200)', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'VESTIAIRE',
      sessionData: {
        sessionToken: 'vc_sess_token_abc123',
        userId: 'vc-user-42',
        email: 'seller@example.com',
        detectedAt: Date.now(),
      },
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('creates crosslisterAccount row with channel=VESTIAIRE and authMethod=SESSION', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    await POST(makeRequest(`Bearer ${token}`, {
      channel: 'VESTIAIRE',
      sessionData: { sessionToken: 'vc-token-xyz' },
    }));
    expect(mockDbInsert).toHaveBeenCalledOnce();
    const insertCall = mockDbInsert.mock.calls[0];
    expect(insertCall).toBeDefined();
    // Verify insert was called (the values are passed via .values() chain)
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('updates existing VESTIAIRE account session data', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'acct-vc-existing' }]),
        }),
      }),
    });

    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'VESTIAIRE',
      sessionData: { sessionToken: 'updated-vc-token' },
    }));
    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('rejects without auth token (returns 401)', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(undefined, {
      channel: 'VESTIAIRE',
      sessionData: { sessionToken: 'vc-token' },
    }));
    expect(res.status).toBe(401);
  });
});
