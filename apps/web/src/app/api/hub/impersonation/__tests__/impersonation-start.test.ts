import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the route
// ---------------------------------------------------------------------------

const mockGetStaffSession = vi.fn();
const mockCookieGet = vi.fn();
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();

vi.mock('@twicely/auth/staff-auth', () => ({
  getStaffSession: (...args: unknown[]) => mockGetStaffSession(...args),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => mockCookieGet(name) }),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({
  STAFF_TOKEN_COOKIE: 'twicely.staff_token',
}));

// Mock db with chainable insert and select
// The select chain supports both:
//   select().from().innerJoin().where()  — for loadCustomRolePermissions (resolves directly)
//   select().from().where().limit()      — for user lookup
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockSelectFrom = vi.fn();
// mockSelectResult is what the terminal query method resolves to.
// Tests set this per-call using mockSelectResult.mockImplementation(...)
const mockSelectResult = vi.fn().mockResolvedValue([]);

function makeFromChain(): Record<string, unknown> {
  const whereResult = () => ({
    limit: (_n: unknown) => mockSelectResult(),
    then: (resolve: (v: unknown) => unknown) => mockSelectResult().then(resolve),
  });
  const chain: Record<string, unknown> = {
    innerJoin: vi.fn((..._a: unknown[]) => ({
      where: vi.fn(() => ({
        then: (resolve: (v: unknown) => unknown) =>
          mockSelectResult().then(resolve),
      })),
    })),
    where: vi.fn((..._w: unknown[]) => whereResult()),
    limit: (_n: unknown) => mockSelectResult(),
  };
  return chain;
}

vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return { values: mockInsertValues };
    },
    select: (...args: unknown[]) => {
      mockDbSelect(...args);
      return { from: (..._a: unknown[]) => { mockSelectFrom(..._a); return makeFromChain(); } };
    },
  },
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', name: 'name', email: 'email' },
  staffUser: { id: 'id', email: 'email' },
  auditEvent: {},
  staffUserCustomRole: {
    staffUserId: 'staff_user_id',
    customRoleId: 'custom_role_id',
    revokedAt: 'revoked_at',
  },
  customRole: {
    id: 'id',
    permissionsJson: 'permissions_json',
    isActive: 'is_active',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => ({})),
  and: vi.fn((..._args: unknown[]) => ({})),
  isNull: vi.fn((_a: unknown) => ({})),
  inArray: vi.fn((_a: unknown, _b: unknown) => ({})),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'test-secret-32-bytes-long-at-least';

function makeStaffSession(roles: string[] = ['SUPPORT']) {
  return {
    token: 'staff-tok-123',
    staffUserId: 'su-001',
    email: 'support@hub.twicely.co',
    displayName: 'Support Agent',
    roles,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  };
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/hub/impersonation/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

function makeInvalidJsonRequest() {
  return new NextRequest('http://localhost/api/hub/impersonation/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    body: 'not-valid-json{{{',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/hub/impersonation/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('IMPERSONATION_SECRET', VALID_SECRET);
    // Default: all select queries return empty array
    mockSelectResult.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns 401 when no staff token cookie present', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-001' }));
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when staff session exists but role lacks impersonate permission (HELPDESK_AGENT)', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-123' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession(['HELPDESK_AGENT']));
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-001' }));
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Forbidden');
  });

  it('returns 400 when targetUserId is missing from body', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-123' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBeTruthy();
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-123' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    const { POST } = await import('../start/route');
    const res = await POST(makeInvalidJsonRequest());
    expect(res.status).toBe(400);
  });

  it('returns 404 when targetUserId not found in user table', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-123' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    // Both custom roles and user lookup return empty
    mockSelectResult.mockResolvedValue([]);
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'nonexistent-user' }));
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('User not found');
  });

  it('returns 500 when IMPERSONATION_SECRET is not configured', async () => {
    vi.stubEnv('IMPERSONATION_SECRET', undefined as unknown as string);
    mockCookieGet.mockReturnValue({ value: 'tok-123' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    // Custom roles: empty; user lookup: valid user; staff check: not staff
    let selectCallCount = 0;
    mockSelectResult.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return Promise.resolve([]); // custom roles
      if (selectCallCount === 2) return Promise.resolve([{ id: 'user-001', name: 'Alice', email: 'alice@example.com' }]);
      return Promise.resolve([]); // staff check: not a staff user
    });
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-001' }));
    expect(res.status).toBe(500);
  });

  it('returns 302 redirect to hub /usr/[id] with impersonation cookie set on success (SUPPORT role)', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-123' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    let selectCallCount = 0;
    mockSelectResult.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return Promise.resolve([]); // custom roles
      if (selectCallCount === 2) return Promise.resolve([{ id: 'user-001', name: 'Alice', email: 'alice@example.com' }]);
      return Promise.resolve([]); // staff check: not a staff user
    });
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-001' }));
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('/usr/user-001');
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('twicely.impersonation_token');
    expect(setCookie).toContain('HttpOnly');
  });

  it('inserts IMPERSONATE_USER_START audit event with correct fields on success', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-123' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    let selectCallCount = 0;
    mockSelectResult.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) return Promise.resolve([]); // custom roles
      if (selectCallCount === 2) return Promise.resolve([{ id: 'user-001', name: 'Alice', email: 'alice@example.com' }]);
      return Promise.resolve([]); // staff check: not a staff user
    });
    const { POST } = await import('../start/route');
    await POST(makeRequest({ targetUserId: 'user-001' }));
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'STAFF',
        actorId: 'su-001',
        action: 'IMPERSONATE_USER_START',
        subject: 'User',
        subjectId: 'user-001',
        severity: 'HIGH',
      })
    );
  });
});
