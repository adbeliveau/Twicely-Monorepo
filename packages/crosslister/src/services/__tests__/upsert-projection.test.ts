import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    sellerId: 'seller_id',
    channel: 'channel',
    externalId: 'external_id',
    pollTier: 'poll_tier',
    nextPollAt: 'next_poll_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

const BASE_PROJECTION = {
  id: 'proj-1',
  listingId: 'lst-1',
  accountId: 'acct-1',
  channel: 'EBAY' as const,
  sellerId: 'user-1',
  externalId: 'ext-123',
  externalUrl: 'https://ebay.com/itm/ext-123',
  status: 'ACTIVE' as const,
  overridesJson: {},
  platformDataJson: {},
  syncEnabled: true,
  lastCanonicalHash: null,
  hasPendingSync: false,
  externalDiff: null,
  publishAttempts: 0,
  lastPublishError: null,
  pollTier: 'COLD' as const,
  nextPollAt: null,
  lastPolledAt: null,
  prePollTier: null,
  orphanedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('upsertProjection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('inserts a new projection and returns it', async () => {
    const { db } = await import('@/lib/db');
    const mockOnConflict = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([BASE_PROJECTION]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: mockOnConflict,
      }),
    });
    mockOnConflict.mockReturnValue({ returning: mockReturning });

    const { upsertProjection } = await import('../upsert-projection');
    const result = await upsertProjection(BASE_PROJECTION);

    expect(result).toEqual(BASE_PROJECTION);
    expect(db.insert).toHaveBeenCalled();
  });

  it('returns upserted row on conflict (same sellerId, channel, externalId)', async () => {
    const { db } = await import('@/lib/db');
    const updatedProjection = { ...BASE_PROJECTION, pollTier: 'HOT' as const };
    const mockOnConflict = vi.fn().mockReturnThis();
    const mockReturning = vi.fn().mockResolvedValue([updatedProjection]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: mockOnConflict,
      }),
    });
    mockOnConflict.mockReturnValue({ returning: mockReturning });

    const { upsertProjection } = await import('../upsert-projection');
    const result = await upsertProjection({ ...BASE_PROJECTION, pollTier: 'HOT' });

    expect(result.pollTier).toBe('HOT');
  });

  it('onConflictDoUpdate targets sellerId, channel, externalId columns', async () => {
    const { db } = await import('@/lib/db');
    const capturedConflictArgs: unknown[] = [];
    const mockOnConflict = vi.fn().mockImplementation((args: unknown) => {
      capturedConflictArgs.push(args);
      return { returning: vi.fn().mockResolvedValue([BASE_PROJECTION]) };
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: mockOnConflict,
      }),
    });

    const { upsertProjection } = await import('../upsert-projection');
    await upsertProjection(BASE_PROJECTION);

    expect(mockOnConflict).toHaveBeenCalled();
    const conflictArg = capturedConflictArgs[0] as { target: unknown[]; set: Record<string, unknown> };
    // target should include all three unique constraint columns
    expect(conflictArg.target).toHaveLength(3);
  });

  it('onConflictDoUpdate set includes pollTier and nextPollAt but not overridesJson', async () => {
    const { db } = await import('@/lib/db');
    const capturedConflictArgs: unknown[] = [];
    const mockOnConflict = vi.fn().mockImplementation((args: unknown) => {
      capturedConflictArgs.push(args);
      return { returning: vi.fn().mockResolvedValue([BASE_PROJECTION]) };
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: mockOnConflict,
      }),
    });

    const { upsertProjection } = await import('../upsert-projection');
    await upsertProjection(BASE_PROJECTION);

    const conflictArg = capturedConflictArgs[0] as { target: unknown[]; set: Record<string, unknown> };
    expect('pollTier' in conflictArg.set).toBe(true);
    expect('nextPollAt' in conflictArg.set).toBe(true);
    // overridesJson and platformDataJson must NOT be in the set (preserves user edits)
    expect('overridesJson' in conflictArg.set).toBe(false);
    expect('platformDataJson' in conflictArg.set).toBe(false);
  });

  it('creates a distinct row when externalId differs', async () => {
    const { db } = await import('@/lib/db');
    const proj1 = { ...BASE_PROJECTION, id: 'proj-1', externalId: 'ext-111' };
    const proj2 = { ...BASE_PROJECTION, id: 'proj-2', externalId: 'ext-222' };

    let callCount = 0;
    const mockOnConflict = vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockResolvedValue([callCount++ === 0 ? proj1 : proj2]),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: mockOnConflict,
      }),
    });

    const { upsertProjection } = await import('../upsert-projection');
    const r1 = await upsertProjection({ ...BASE_PROJECTION, externalId: 'ext-111' });
    const r2 = await upsertProjection({ ...BASE_PROJECTION, externalId: 'ext-222' });

    expect(r1.id).toBe('proj-1');
    expect(r2.id).toBe('proj-2');
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});
