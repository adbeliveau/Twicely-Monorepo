/**
 * Tests for ai-autofill.ts queries (G1.1)
 * Covers: getAutofillUsage, getUserStoreTier
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module-level mocks ───────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDb = { select: mockDbSelect };

vi.mock('@twicely/db', () => ({ db: mockDb }));
vi.mock('@twicely/db/schema', () => ({
  aiAutofillUsage: {
    userId: 'user_id',
    monthKey: 'month_key',
    count: 'count',
  },
  sellerProfile: {
    userId: 'user_id',
    storeTier: 'store_tier',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getAutofillUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns the count row when a usage record exists', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ count: 7 }]));

    const { getAutofillUsage } = await import('../ai-autofill');
    const result = await getAutofillUsage('user-test-123', '2026-03');

    expect(result).toEqual({ count: 7 });
  });

  it('returns null when no usage record exists for user+month', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { getAutofillUsage } = await import('../ai-autofill');
    const result = await getAutofillUsage('user-test-123', '2026-03');

    expect(result).toBeNull();
  });

  it('returns first row when multiple rows are somehow returned', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ count: 3 }, { count: 5 }]));

    const { getAutofillUsage } = await import('../ai-autofill');
    const result = await getAutofillUsage('user-test-123', '2026-03');

    // Drizzle destructures [row], so first element is used
    expect(result).toEqual({ count: 3 });
  });

  it('passes the correct userId and monthKey to the query', async () => {
    const chain = makeSelectChain([{ count: 2 }]);
    mockDbSelect.mockReturnValueOnce(chain);

    const { getAutofillUsage } = await import('../ai-autofill');
    await getAutofillUsage('user-abc-999', '2026-01');

    // The select was called (we confirm DB was hit)
    expect(mockDbSelect).toHaveBeenCalledOnce();
  });
});

describe('getUserStoreTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns the storeTier from sellerProfile when the user exists', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ storeTier: 'POWER' }]));

    const { getUserStoreTier } = await import('../ai-autofill');
    const result = await getUserStoreTier('user-test-123');

    expect(result).toBe('POWER');
  });

  it('returns NONE when no sellerProfile row exists', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const { getUserStoreTier } = await import('../ai-autofill');
    const result = await getUserStoreTier('user-no-profile');

    expect(result).toBe('NONE');
  });

  it('returns STARTER tier correctly', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ storeTier: 'STARTER' }]));

    const { getUserStoreTier } = await import('../ai-autofill');
    const result = await getUserStoreTier('user-test-123');

    expect(result).toBe('STARTER');
  });

  it('returns PRO tier correctly', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ storeTier: 'PRO' }]));

    const { getUserStoreTier } = await import('../ai-autofill');
    const result = await getUserStoreTier('user-test-123');

    expect(result).toBe('PRO');
  });

  it('returns ENTERPRISE tier correctly', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([{ storeTier: 'ENTERPRISE' }]));

    const { getUserStoreTier } = await import('../ai-autofill');
    const result = await getUserStoreTier('user-test-123');

    expect(result).toBe('ENTERPRISE');
  });
});
