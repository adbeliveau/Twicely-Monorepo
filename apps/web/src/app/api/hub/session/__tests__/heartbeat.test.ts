import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the route
// ---------------------------------------------------------------------------

const mockGetStaffSession = vi.fn();
const mockGetPlatformSetting = vi.fn();
const mockCookieGet = vi.fn();

vi.mock('@twicely/auth/staff-auth', () => ({
  getStaffSession: (...args: unknown[]) => mockGetStaffSession(...args),
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@twicely/casl/staff-authorize', () => ({
  STAFF_TOKEN_COOKIE: 'twicely.staff_token',
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => mockCookieGet(name),
  }),
}));

// Import AFTER mocks are set up
const { POST } = await import('../heartbeat/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok_abc',
    staffUserId: 'su_001',
    email: 'agent@twicely.co',
    displayName: 'Test Agent',
    roles: ['SUPPORT_AGENT'],
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    ...overrides,
  };
}

async function parseResponse(res: NextResponse): Promise<unknown> {
  return res.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/hub/session/heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation(
      (key: string, fallback: unknown) => {
        if (key === 'general.staffInactivityTimeoutMinutes') return Promise.resolve(5);
        if (key === 'general.staffSessionWarningSeconds') return Promise.resolve(60);
        return Promise.resolve(fallback);
      }
    );
  });

  it('should return 401 when no staff token cookie exists', async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await POST();

    expect(res.status).toBe(401);
    const body = await parseResponse(res);
    expect(body).toMatchObject({
      success: false,
      sessionValid: false,
      reason: 'not_found',
    });
  });

  it('should return 401 when session is expired (absolute)', async () => {
    mockCookieGet.mockReturnValue({ value: 'expired_token' });
    mockGetStaffSession.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    const body = await parseResponse(res);
    expect(body).toMatchObject({
      success: false,
      sessionValid: false,
      reason: 'expired',
    });
  });

  it('should return 401 when session is expired (inactivity)', async () => {
    mockCookieGet.mockReturnValue({ value: 'inactive_token' });
    // getStaffSession handles inactivity check internally and returns null
    mockGetStaffSession.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    const body = await parseResponse(res);
    expect(body).toMatchObject({
      success: false,
      sessionValid: false,
    });
  });

  it('should return session timing data when session is valid', async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    mockCookieGet.mockReturnValue({ value: 'valid_token' });
    mockGetStaffSession.mockResolvedValue(makeSession({ expiresAt }));

    const res = await POST();

    expect(res.status).toBe(200);
    const body = await parseResponse(res) as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.sessionValid).toBe(true);
    expect(body.absoluteExpiresAt).toBe(expiresAt.toISOString());
    expect(body.inactivityTimeoutMs).toBe(300_000);
    expect(body.warningSeconds).toBe(60);
  });

  it('should return correct inactivityTimeoutMs from platform settings', async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    mockCookieGet.mockReturnValue({ value: 'valid_token' });
    mockGetStaffSession.mockResolvedValue(makeSession({ expiresAt }));
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'general.staffInactivityTimeoutMinutes') return Promise.resolve(15);
      if (key === 'general.staffSessionWarningSeconds') return Promise.resolve(60);
      return Promise.resolve(fallback);
    });

    const res = await POST();
    const body = await parseResponse(res) as Record<string, unknown>;

    expect(body.inactivityTimeoutMs).toBe(15 * 60 * 1000);
  });

  it('should return correct warningSeconds from platform settings', async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    mockCookieGet.mockReturnValue({ value: 'valid_token' });
    mockGetStaffSession.mockResolvedValue(makeSession({ expiresAt }));
    mockGetPlatformSetting.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'general.staffInactivityTimeoutMinutes') return Promise.resolve(5);
      if (key === 'general.staffSessionWarningSeconds') return Promise.resolve(120);
      return Promise.resolve(fallback);
    });

    const res = await POST();
    const body = await parseResponse(res) as Record<string, unknown>;

    expect(body.warningSeconds).toBe(120);
  });

  it('should return fallback values when platform settings are missing', async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    mockCookieGet.mockReturnValue({ value: 'valid_token' });
    mockGetStaffSession.mockResolvedValue(makeSession({ expiresAt }));
    mockGetPlatformSetting.mockImplementation(
      (_key: string, fallback: unknown) => Promise.resolve(fallback)
    );

    const res = await POST();
    const body = await parseResponse(res) as Record<string, unknown>;

    // Fallback: 5 minutes = 300,000ms; warning: 60s
    expect(body.inactivityTimeoutMs).toBe(300_000);
    expect(body.warningSeconds).toBe(60);
  });

  it('should call getStaffSession with the token from the cookie', async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    mockCookieGet.mockReturnValue({ value: 'my_specific_token' });
    mockGetStaffSession.mockResolvedValue(makeSession({ expiresAt }));

    await POST();

    expect(mockGetStaffSession).toHaveBeenCalledWith('my_specific_token');
  });

  it('should not expose any user data beyond session validity and timing', async () => {
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
    mockCookieGet.mockReturnValue({ value: 'valid_token' });
    mockGetStaffSession.mockResolvedValue(makeSession({ expiresAt }));

    const res = await POST();
    const body = await parseResponse(res) as Record<string, unknown>;

    expect(body).not.toHaveProperty('staffUserId');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('displayName');
    expect(body).not.toHaveProperty('roles');
    expect(body).not.toHaveProperty('token');
  });
});
