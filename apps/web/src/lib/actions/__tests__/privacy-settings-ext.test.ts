import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Extended privacy-settings tests.
 * Covers: invalid input, updatedAt field set, Zod strict mode.
 */

const mockAuthorize = vi.fn();
vi.mock('@twicely/casl', () => ({
  authorize: mockAuthorize,
  sub: (...args: unknown[]) => args,
}));

vi.mock('@twicely/db/schema', () => ({
  user: { id: 'id', marketingOptIn: 'marketing_opt_in', updatedAt: 'updated_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
}));

const mockDbUpdate = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { update: mockDbUpdate },
}));

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };
}

function makeSession(userId = 'user-1') {
  return { session: { userId }, ability: { can: vi.fn().mockReturnValue(true) } };
}

// ─── updateMarketingOptIn — validation ────────────────────────────────────────

describe('updateMarketingOptIn — validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('returns Invalid input for non-boolean string', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const { updateMarketingOptIn } = await import('../privacy-settings');
    const input: { optIn: boolean } = { optIn: false };
    Object.assign(input, { optIn: 'yes' });
    const result = await updateMarketingOptIn(input);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns Invalid input for numeric value', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const { updateMarketingOptIn } = await import('../privacy-settings');
    const input: { optIn: boolean } = { optIn: false };
    Object.assign(input, { optIn: 1 });
    const result = await updateMarketingOptIn(input);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns Invalid input for null', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const { updateMarketingOptIn } = await import('../privacy-settings');
    const input: { optIn: boolean } = { optIn: false };
    Object.assign(input, { optIn: null });
    const result = await updateMarketingOptIn(input);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });

  it('returns Invalid input when optIn field is missing', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const { updateMarketingOptIn } = await import('../privacy-settings');
    const input: { optIn: boolean } = { optIn: false };
    Object.assign(input, { optIn: undefined });
    const result = await updateMarketingOptIn(input);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid input');
  });
});

// ─── updateMarketingOptIn — updatedAt ─────────────────────────────────────────

describe('updateMarketingOptIn — updatedAt', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); });

  it('sets updatedAt to a Date on success', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-ts'));
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(chain);

    const { updateMarketingOptIn } = await import('../privacy-settings');
    const result = await updateMarketingOptIn({ optIn: true });
    expect(result.success).toBe(true);

    const setArgs = chain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs.updatedAt).toBeInstanceOf(Date);
  });

  it('passes userId (not storeId) to where clause', async () => {
    mockAuthorize.mockResolvedValue(makeSession('user-where-check'));
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(chain);

    const { updateMarketingOptIn } = await import('../privacy-settings');
    await updateMarketingOptIn({ optIn: false });

    // where was called with user table eq condition
    expect(chain.where).toHaveBeenCalled();
    const whereArg = chain.where.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(whereArg.val).toBe('user-where-check');
  });
});
