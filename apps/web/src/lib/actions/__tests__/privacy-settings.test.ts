import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue({ rowCount: 1 }) };
  return chain;
}

function makeSession(userId = 'user-1') {
  return { session: { userId }, ability: { can: vi.fn().mockReturnValue(true) } };
}

// ─── updateMarketingOptIn ─────────────────────────────────────────────────────

describe('updateMarketingOptIn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    mockAuthorize.mockResolvedValue({ session: null });
    const { updateMarketingOptIn } = await import('../privacy-settings');
    const result = await updateMarketingOptIn({ optIn: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('sets marketingOptIn to true', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(chain);

    const { updateMarketingOptIn } = await import('../privacy-settings');
    const result = await updateMarketingOptIn({ optIn: true });
    expect(result.success).toBe(true);
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ marketingOptIn: true })
    );
  });

  it('sets marketingOptIn to false (opt-out)', async () => {
    mockAuthorize.mockResolvedValue(makeSession());
    const chain = makeUpdateChain();
    mockDbUpdate.mockReturnValue(chain);

    const { updateMarketingOptIn } = await import('../privacy-settings');
    const result = await updateMarketingOptIn({ optIn: false });
    expect(result.success).toBe(true);
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ marketingOptIn: false })
    );
  });
});
