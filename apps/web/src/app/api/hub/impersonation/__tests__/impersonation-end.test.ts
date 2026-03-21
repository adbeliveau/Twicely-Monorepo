import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the route
// ---------------------------------------------------------------------------

const mockGetImpersonationSession = vi.fn();
const mockDbInsert = vi.fn();
const mockInsertValues = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/auth/impersonation', () => ({
  getImpersonationSession: (...args: unknown[]) =>
    mockGetImpersonationSession(...args),
}));

vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return { values: mockInsertValues };
    },
  },
}));

vi.mock('@twicely/db/schema', () => ({
  auditEvent: {},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SESSION = {
  targetUserId: 'user-abc',
  staffUserId: 'staff-xyz',
  staffDisplayName: 'Support Agent',
  expiresAt: Date.now() + 15 * 60 * 1000,
};

function makeRequest(origin = 'http://hub.twicely.local') {
  return new NextRequest('http://hub.twicely.local/api/hub/impersonation/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({}),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/hub/impersonation/end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns 403 when Origin header is absent or disallowed (CSRF guard)', async () => {
    mockGetImpersonationSession.mockResolvedValue(VALID_SESSION);
    const { POST } = await import('../end/route');
    const res = await POST(makeRequest('https://evil.example.com'));
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Forbidden');
  });

  it('returns 400 when no impersonation cookie present', async () => {
    mockGetImpersonationSession.mockResolvedValue(null);
    const { POST } = await import('../end/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBeTruthy();
  });

  it('returns 400 when impersonation token is expired', async () => {
    // verifyImpersonationToken returns null for expired tokens
    // getImpersonationSession wraps verifyImpersonationToken, so it returns null
    mockGetImpersonationSession.mockResolvedValue(null);
    const { POST } = await import('../end/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it('returns 400 when impersonation token signature is invalid', async () => {
    mockGetImpersonationSession.mockResolvedValue(null);
    const { POST } = await import('../end/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
  });

  it('returns 302 redirect to hub /usr/[id] on success', async () => {
    mockGetImpersonationSession.mockResolvedValue(VALID_SESSION);
    const { POST } = await import('../end/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('/usr/user-abc');
  });

  it('clears the impersonation cookie (max-age=0) on success', async () => {
    mockGetImpersonationSession.mockResolvedValue(VALID_SESSION);
    const { POST } = await import('../end/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(302);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('twicely.impersonation_token');
    expect(setCookie).toContain('Max-Age=0');
  });

  it('inserts IMPERSONATE_USER_END audit event with correct fields on success', async () => {
    mockGetImpersonationSession.mockResolvedValue(VALID_SESSION);
    const { POST } = await import('../end/route');
    await POST(makeRequest());
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'STAFF',
        actorId: 'staff-xyz',
        action: 'IMPERSONATE_USER_END',
        subject: 'User',
        subjectId: 'user-abc',
        severity: 'HIGH',
      })
    );
  });
});
