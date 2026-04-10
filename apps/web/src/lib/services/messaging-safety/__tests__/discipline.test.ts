/**
 * Tests for messaging-safety/discipline.ts
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
  messageSafetyAction: {
    id: 'id',
    userId: 'user_id',
    actionType: 'action_type',
    violationCount: 'violation_count',
    triggerMessageId: 'trigger_message_id',
    reason: 'reason',
    expiresAt: 'expires_at',
    revokedAt: 'revoked_at',
    revokedByStaffId: 'revoked_by_staff_id',
    createdAt: 'created_at',
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
  isNull: vi.fn(),
  gte: vi.fn(),
  desc: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('recordViolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, def: unknown) => def);
    // Default: no existing violations
    mockChain.orderBy.mockResolvedValue([]);
    mockChain.values.mockResolvedValue([]);
  });

  it('issues a warning for the first violation', async () => {
    mockChain.orderBy.mockResolvedValue([]);

    const { recordViolation } = await import('../discipline');
    const result = await recordViolation('user-1', 'msg-1', 'Contact info detected');

    expect(result.actionTaken).toBe('warning');
    expect(result.violationCount).toBe(1);
  });

  it('issues a rate_restrict for the second violation', async () => {
    mockChain.orderBy.mockResolvedValue([
      { id: 'a1', userId: 'user-1', actionType: 'warning', violationCount: 1, createdAt: new Date() },
    ]);

    const { recordViolation } = await import('../discipline');
    const result = await recordViolation('user-1', 'msg-2', 'Repeated contact info');

    expect(result.actionTaken).toBe('rate_restrict');
    expect(result.violationCount).toBe(2);
  });

  it('issues a messaging_suspend for the third violation', async () => {
    mockChain.orderBy.mockResolvedValue([
      { id: 'a1' }, { id: 'a2' },
    ]);

    const { recordViolation } = await import('../discipline');
    const result = await recordViolation('user-1', 'msg-3', 'Third violation');

    expect(result.actionTaken).toBe('messaging_suspend');
    expect(result.violationCount).toBe(3);
  });

  it('issues an account_ban for the fifth violation', async () => {
    mockChain.orderBy.mockResolvedValue([
      { id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' },
    ]);

    const { recordViolation } = await import('../discipline');
    const result = await recordViolation('user-1', 'msg-5', 'Fifth violation');

    expect(result.actionTaken).toBe('account_ban');
    expect(result.violationCount).toBe(5);
  });

  it('respects custom thresholds from platform settings', async () => {
    mockGetPlatformSetting.mockImplementation((key: string, def: unknown) => {
      if (key === 'messaging.discipline.restrictThreshold') return 5;
      return def;
    });
    // 1 existing violation → count becomes 2
    mockChain.orderBy.mockResolvedValue([{ id: 'a1' }]);

    const { recordViolation } = await import('../discipline');
    const result = await recordViolation('user-1', 'msg-2', 'Violation');

    // With restrictThreshold=5, violation #2 should still be a warning
    expect(result.actionTaken).toBe('warning');
  });
});

describe('isMessagingSuspended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.orderBy.mockResolvedValue([]);
  });

  it('returns false when user has no active safety actions', async () => {
    mockChain.orderBy.mockResolvedValue([]);

    const { isMessagingSuspended } = await import('../discipline');
    const result = await isMessagingSuspended('user-1');

    expect(result).toBe(false);
  });

  it('returns true when user has an active messaging_suspend action', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockChain.orderBy.mockResolvedValue([
      {
        id: 'a1',
        userId: 'user-1',
        actionType: 'messaging_suspend',
        violationCount: 3,
        reason: 'test',
        expiresAt: futureDate,
        revokedAt: null,
        revokedByStaffId: null,
        createdAt: new Date(),
        triggerMessageId: null,
      },
    ]);

    const { isMessagingSuspended } = await import('../discipline');
    const result = await isMessagingSuspended('user-1');

    expect(result).toBe(true);
  });

  it('returns true when user has an account_ban action', async () => {
    mockChain.orderBy.mockResolvedValue([
      {
        id: 'a1',
        userId: 'user-1',
        actionType: 'account_ban',
        violationCount: 5,
        reason: 'test',
        expiresAt: null,
        revokedAt: null,
        revokedByStaffId: null,
        createdAt: new Date(),
        triggerMessageId: null,
      },
    ]);

    const { isMessagingSuspended } = await import('../discipline');
    const result = await isMessagingSuspended('user-1');

    expect(result).toBe(true);
  });
});
