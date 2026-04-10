/**
 * Tests for messaging-safety/rate-limit.ts
 * V4-15: Messaging Safety & Abuse Prevention
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
};
Object.values(mockChain).forEach((fn) => fn.mockReturnValue(mockChain));

const mockDb = {
  insert: vi.fn().mockReturnValue(mockChain),
  select: vi.fn().mockReturnValue(mockChain),
  update: vi.fn().mockReturnValue(mockChain),
};

vi.mock('@twicely/db', () => ({ db: mockDb }));

vi.mock('@twicely/db/schema', () => ({
  messageRateLimit: {
    id: 'id',
    userId: 'user_id',
    windowStart: 'window_start',
    messageCount: 'message_count',
  },
  messageSafetyAction: {
    id: 'id',
    userId: 'user_id',
    actionType: 'action_type',
    revokedAt: 'revoked_at',
    expiresAt: 'expires_at',
  },
}));

const mockGetPlatformSetting = vi.fn();
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  isNull: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, def: unknown) => def);
    mockChain.limit.mockResolvedValue([]);
  });

  it('returns allowed=true when rate limiting is disabled', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, def: unknown) => {
      if (key === 'messaging.rateLimit.enabled') return false;
      return def;
    });

    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('user-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(20);
  });

  it('returns allowed=true when user has no messages in current window', async () => {
    mockChain.limit.mockResolvedValue([]);

    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('user-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(20);
  });

  it('returns allowed=true when user is under the limit', async () => {
    mockChain.limit.mockResolvedValue([{ messageCount: 5 }]);

    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('user-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(15);
  });

  it('returns allowed=false when user has reached the limit', async () => {
    mockChain.limit.mockResolvedValue([{ messageCount: 20 }]);

    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('user-1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns allowed=false when user exceeds the limit', async () => {
    mockChain.limit.mockResolvedValue([{ messageCount: 25 }]);

    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('user-1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('respects custom messagesPerHour from platform settings', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, def: unknown) => {
      if (key === 'messaging.rateLimit.messagesPerHour') return 5;
      return def;
    });
    mockChain.limit.mockResolvedValue([{ messageCount: 4 }]);

    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('user-1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('provides a resetAt timestamp in the future', async () => {
    mockChain.limit.mockResolvedValue([]);

    const { checkRateLimit } = await import('../rate-limit');
    const result = await checkRateLimit('user-1');

    expect(result.resetAt).toBeInstanceOf(Date);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now() - 60 * 60 * 1000);
  });
});

describe('isUserRateRestricted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.limit.mockResolvedValue([]);
  });

  it('returns false when no active rate_restrict actions exist', async () => {
    mockChain.limit.mockResolvedValue([]);

    const { isUserRateRestricted } = await import('../rate-limit');
    const result = await isUserRateRestricted('user-1');

    expect(result).toBe(false);
  });
});
