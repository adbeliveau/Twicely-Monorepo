/**
 * Tests for getMonthlyUsage, getUserMonthlyLimit, incrementUsage
 * in ai-autofill-service.ts (G1.1)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

const mockGetPlatformSetting = vi.fn();
vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: (...args: unknown[]) => mockGetPlatformSetting(...args),
}));

const mockGetAutofillUsage = vi.fn();
const mockGetUserStoreTier = vi.fn();
vi.mock('@/lib/queries/ai-autofill', () => ({
  getAutofillUsage: (...args: unknown[]) => mockGetAutofillUsage(...args),
  getUserStoreTier: (...args: unknown[]) => mockGetUserStoreTier(...args),
}));

const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
const mockInsertValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
const mockDbInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

vi.mock('@twicely/db', () => ({
  db: { insert: mockDbInsert },
}));
vi.mock('@twicely/db/schema', () => ({
  aiAutofillUsage: { userId: 'user_id', monthKey: 'month_key', count: 'count' },
}));
vi.mock('drizzle-orm', () => ({
  sql: vi.fn((parts: TemplateStringsArray) => ({ raw: parts[0] })),
  eq: vi.fn((a, b) => ({ a, b })),
}));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ─── Tests: getUserMonthlyLimit ───────────────────────────────────────────────

describe('getUserMonthlyLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback)
    );
  });

  it('returns default limit (10) for NONE tier', async () => {
    mockGetUserStoreTier.mockResolvedValue('NONE');

    const { getUserMonthlyLimit } = await import('../ai-autofill-service');
    const limit = await getUserMonthlyLimit('user-test-123');

    expect(limit).toBe(10);
  });

  it('returns 50 for STARTER tier', async () => {
    mockGetUserStoreTier.mockResolvedValue('STARTER');

    const { getUserMonthlyLimit } = await import('../ai-autofill-service');
    const limit = await getUserMonthlyLimit('user-test-123');

    expect(limit).toBe(50);
  });

  it('returns 200 for PRO tier', async () => {
    mockGetUserStoreTier.mockResolvedValue('PRO');

    const { getUserMonthlyLimit } = await import('../ai-autofill-service');
    const limit = await getUserMonthlyLimit('user-test-123');

    expect(limit).toBe(200);
  });

  it('returns -1 (unlimited) for POWER tier', async () => {
    mockGetUserStoreTier.mockResolvedValue('POWER');

    const { getUserMonthlyLimit } = await import('../ai-autofill-service');
    const limit = await getUserMonthlyLimit('user-test-123');

    expect(limit).toBe(-1);
  });

  it('returns -1 (unlimited) for ENTERPRISE tier', async () => {
    mockGetUserStoreTier.mockResolvedValue('ENTERPRISE');

    const { getUserMonthlyLimit } = await import('../ai-autofill-service');
    const limit = await getUserMonthlyLimit('user-test-123');

    expect(limit).toBe(-1);
  });

  it('reads limit from platform_settings when present', async () => {
    mockGetUserStoreTier.mockResolvedValue('STARTER');
    mockGetPlatformSetting.mockImplementation((key: string) => {
      if (key === 'ai.autofill.limitStarter') return Promise.resolve(75);
      return Promise.resolve(undefined);
    });

    const { getUserMonthlyLimit } = await import('../ai-autofill-service');
    const limit = await getUserMonthlyLimit('user-test-123');

    expect(limit).toBe(75);
  });
});

// ─── Tests: getMonthlyUsage ───────────────────────────────────────────────────

describe('getMonthlyUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback)
    );
  });

  it('returns count, limit, and remaining for a user with usage', async () => {
    mockGetAutofillUsage.mockResolvedValue({ count: 6 });
    mockGetUserStoreTier.mockResolvedValue('STARTER'); // limit = 50

    const { getMonthlyUsage } = await import('../ai-autofill-service');
    const result = await getMonthlyUsage('user-test-123');

    expect(result.count).toBe(6);
    expect(result.limit).toBe(50);
    expect(result.remaining).toBe(44);
  });

  it('returns count=0 and remaining=limit when no usage record exists', async () => {
    mockGetAutofillUsage.mockResolvedValue(null);
    mockGetUserStoreTier.mockResolvedValue('NONE'); // limit = 10

    const { getMonthlyUsage } = await import('../ai-autofill-service');
    const result = await getMonthlyUsage('user-test-123');

    expect(result.count).toBe(0);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(10);
  });

  it('returns remaining=-1 for POWER tier (unlimited)', async () => {
    mockGetAutofillUsage.mockResolvedValue({ count: 500 });
    mockGetUserStoreTier.mockResolvedValue('POWER'); // limit = -1

    const { getMonthlyUsage } = await import('../ai-autofill-service');
    const result = await getMonthlyUsage('user-test-123');

    expect(result.limit).toBe(-1);
    expect(result.remaining).toBe(-1);
  });

  it('clamps remaining to 0 when count exceeds limit', async () => {
    mockGetAutofillUsage.mockResolvedValue({ count: 55 });
    mockGetUserStoreTier.mockResolvedValue('STARTER'); // limit = 50

    const { getMonthlyUsage } = await import('../ai-autofill-service');
    const result = await getMonthlyUsage('user-test-123');

    expect(result.remaining).toBe(0);
  });
});

// ─── Tests: incrementUsage ────────────────────────────────────────────────────

describe('incrementUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) =>
      Promise.resolve(fallback)
    );
  });

  it('calls db.insert with the correct userId and current monthKey', async () => {
    const { incrementUsage } = await import('../ai-autofill-service');
    await incrementUsage('user-test-999');

    expect(mockDbInsert).toHaveBeenCalledOnce();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-test-999',
        count: 1,
      })
    );
    // monthKey should be current year-month in UTC
    const callArg = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof callArg['monthKey']).toBe('string');
    expect((callArg['monthKey'] as string)).toMatch(/^\d{4}-\d{2}$/);
  });

  it('calls onConflictDoUpdate to atomically increment', async () => {
    const { incrementUsage } = await import('../ai-autofill-service');
    await incrementUsage('user-test-999');

    expect(mockOnConflictDoUpdate).toHaveBeenCalledOnce();
    const conflictArg = mockOnConflictDoUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    // Verify updatedAt is set in the conflict update
    expect(conflictArg['set']).toHaveProperty('updatedAt');
  });
});
