/**
 * G10.8 POST /api/hub/impersonation/start — paths NOT covered by the primary test file.
 *
 * Covers:
 *  C1. staff cookie present but getStaffSession returns null → 401
 *  C2. body with extra keys (strict schema rejects unknown keys) → 400
 *  C3. ADMIN role succeeds (distinct code-path from SUPPORT in platform-abilities)
 *  C4. SUPER_ADMIN role succeeds
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the route
// ---------------------------------------------------------------------------

const mockGetStaffSession = vi.fn();
const mockCookieGet = vi.fn();
const mockDbInsert = vi.fn();
const mockDbSelect = vi.fn();
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockSelectResult = vi.fn().mockResolvedValue([]);

vi.mock('@twicely/auth/staff-auth', () => ({
  getStaffSession: (...args: unknown[]) => mockGetStaffSession(...args),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => mockCookieGet(name) }),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({
  STAFF_TOKEN_COOKIE: 'twicely.staff_token',
}));

function makeFromChain(): Record<string, unknown> {
  const whereResult = () => ({
    limit: (_n: unknown) => mockSelectResult(),
    then: (resolve: (v: unknown) => unknown) => mockSelectResult().then(resolve),
  });
  return {
    innerJoin: vi.fn((..._a: unknown[]) => ({
      where: vi.fn(() => ({
        then: (resolve: (v: unknown) => unknown) => mockSelectResult().then(resolve),
      })),
    })),
    where: vi.fn((..._w: unknown[]) => whereResult()),
    limit: (_n: unknown) => mockSelectResult(),
  };
}

vi.mock('@twicely/db', () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return { values: mockInsertValues };
    },
    select: (...args: unknown[]) => {
      mockDbSelect(...args);
      return { from: (..._a: unknown[]) => { return makeFromChain(); } };
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
    token: 'staff-tok-gaps',
    staffUserId: 'su-gaps-001',
    email: 'support@hub.twicely.co',
    displayName: 'Gaps Agent',
    roles,
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/hub/impersonation/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:3000' },
    body: JSON.stringify(body),
  });
}

/** Return DB results: empty for custom roles, then user row, then empty for staff check. */
function twoCallSequence(userId: string, userName: string, userEmail: string) {
  let callCount = 0;
  mockSelectResult.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve([]); // custom roles
    if (callCount === 2) return Promise.resolve([{ id: userId, name: userName, email: userEmail }]); // user lookup
    return Promise.resolve([]); // staff check: not a staff user
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/hub/impersonation/start — gap coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('IMPERSONATION_SECRET', VALID_SECRET);
    mockSelectResult.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('C1: returns 401 when cookie is present but getStaffSession returns null (invalid/expired staff token)', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-present-but-invalid' });
    mockGetStaffSession.mockResolvedValue(null);
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-001' }));
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe('Unauthorized');
  });

  it('C2: returns 400 when body has extra keys (strict Zod schema)', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-valid' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    // Custom roles returns empty; user lookup returns valid user (but schema rejects before user lookup)
    twoCallSequence('user-001', 'Alice', 'alice@test.com');
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-001', extraField: 'evil' }));
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBeTruthy();
  });

  it('C2b: returns 400 when targetUserId is a number (wrong type)', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-valid' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    twoCallSequence('user-001', 'Alice', 'alice@test.com');
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 12345 }));
    expect(res.status).toBe(400);
  });

  it('C2c: returns 400 when targetUserId is an empty string (min(1) rule)', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-valid' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession());
    twoCallSequence('user-001', 'Alice', 'alice@test.com');
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: '' }));
    expect(res.status).toBe(400);
  });

  it('C3: returns 302 on success when staff role is ADMIN (distinct ability path)', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-valid' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession(['ADMIN']));
    twoCallSequence('user-admin-target', 'Bob', 'bob@test.com');
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-admin-target' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/usr/user-admin-target');
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('twicely.impersonation_token');
  });

  it('C4: returns 302 on success when staff role is SUPER_ADMIN', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-valid' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession(['SUPER_ADMIN']));
    twoCallSequence('user-sa-target', 'Carol', 'carol@test.com');
    const { POST } = await import('../start/route');
    const res = await POST(makeRequest({ targetUserId: 'user-sa-target' }));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/usr/user-sa-target');
  });

  it('C4b: inserts correct audit event when SUPER_ADMIN initiates impersonation', async () => {
    mockCookieGet.mockReturnValue({ value: 'tok-valid' });
    mockGetStaffSession.mockResolvedValue(makeStaffSession(['SUPER_ADMIN']));
    twoCallSequence('user-sa-target-2', 'Dave', 'dave@test.com');
    const { POST } = await import('../start/route');
    await POST(makeRequest({ targetUserId: 'user-sa-target-2' }));
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'STAFF',
        actorId: 'su-gaps-001',
        action: 'IMPERSONATE_USER_START',
        subject: 'User',
        subjectId: 'user-sa-target-2',
        severity: 'HIGH',
      })
    );
  });
});
