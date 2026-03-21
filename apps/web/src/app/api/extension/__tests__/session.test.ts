/**
 * Tests for POST /api/extension/session (H1.1)
 * Verifies Tier C session data upsert from extension.
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

function makeRequest(
  authHeader: string | undefined,
  body: unknown,
): Request {
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

async function makeRegistrationToken(): Promise<string> {
  const s = new TextEncoder().encode(TEST_SECRET);
  return new SignJWT({ userId: 'user-abc', purpose: 'extension-registration' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(s);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extension/session', () => {
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

  it('returns 401 for missing Authorization header', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(undefined, { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer bad-token', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for token with wrong purpose', async () => {
    const regToken = await makeRegistrationToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${regToken}`, { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid channel', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'EBAY', sessionData: {} }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid input');
  });

  it('accepts VESTIAIRE channel', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'VESTIAIRE', sessionData: {} }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for missing sessionData', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK' }));
    expect(res.status).toBe(400);
  });

  it('creates new crosslister account when none exists', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
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

    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
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

    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', sessionData: {} }));

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

    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    await POST(makeRequest(`Bearer ${token}`, { channel: 'POSHMARK', sessionData: {} }));

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ consecutiveErrors: 0 }),
    );
  });

  it('accepts FB_MARKETPLACE channel', async () => {
    const token = await makeSessionToken();
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest(`Bearer ${token}`, {
      channel: 'FB_MARKETPLACE',
      sessionData: { fbToken: 'fb-access-token' },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 503 when EXTENSION_JWT_SECRET is missing', async () => {
    vi.stubEnv('EXTENSION_JWT_SECRET', '');
    const { POST } = await import('../session/route');
    const res = await POST(makeRequest('Bearer any', { channel: 'POSHMARK', sessionData: {} }));
    expect(res.status).toBe(503);
  });
});
