import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id',
    status: 'status',
    soldAt: 'sold_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ op: 'and', args })),
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  lt: vi.fn((col, val) => ({ op: 'lt', col, val })),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockDeleteListingDocument = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/search/typesense-index', () => ({
  deleteListingDocument: (...args: unknown[]) => mockDeleteListingDocument(...args),
}));

/**
 * Build a Drizzle select chain that resolves to `rows`.
 * Supports .from().where().limit() — all return the chain; the chain is thenable.
 */
function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

describe('runListingSoldPurge — Decision #71', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reads config from platform_settings with correct keys and defaults', async () => {
    const { db } = await import('@twicely/db');
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');

    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runListingSoldPurge } = await import('../listing-sold-purge');
    await runListingSoldPurge();

    expect(getPlatformSetting).toHaveBeenCalledWith('search.soldPurge.retentionDays', 90);
    expect(getPlatformSetting).toHaveBeenCalledWith('search.soldPurge.batchSize', 500);
  });

  it('returns zeros and skips Typesense when no candidates found', async () => {
    const { db } = await import('@twicely/db');

    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runListingSoldPurge } = await import('../listing-sold-purge');
    const result = await runListingSoldPurge();

    expect(result.purgedCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(mockDeleteListingDocument).not.toHaveBeenCalled();
  });

  it('calls deleteListingDocument for each candidate', async () => {
    const { db } = await import('@twicely/db');

    const candidates = [
      { id: 'lst-1' },
      { id: 'lst-2' },
      { id: 'lst-3' },
    ];
    vi.mocked(db.select).mockReturnValue(makeSelectChain(candidates) as unknown as ReturnType<typeof db.select>);

    const { runListingSoldPurge } = await import('../listing-sold-purge');
    const result = await runListingSoldPurge();

    expect(mockDeleteListingDocument).toHaveBeenCalledTimes(3);
    expect(mockDeleteListingDocument).toHaveBeenCalledWith('lst-1');
    expect(mockDeleteListingDocument).toHaveBeenCalledWith('lst-2');
    expect(mockDeleteListingDocument).toHaveBeenCalledWith('lst-3');
    expect(result.purgedCount).toBe(3);
    expect(result.errorCount).toBe(0);
  });

  it('logs and continues when Typesense delete throws for one document', async () => {
    const { db } = await import('@twicely/db');
    const { logger } = await import('@twicely/logger');

    const candidates = [{ id: 'lst-ok' }, { id: 'lst-bad' }, { id: 'lst-ok-2' }];
    vi.mocked(db.select).mockReturnValue(makeSelectChain(candidates) as unknown as ReturnType<typeof db.select>);

    mockDeleteListingDocument
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Typesense connection refused'))
      .mockResolvedValueOnce(undefined);

    const { runListingSoldPurge } = await import('../listing-sold-purge');
    const result = await runListingSoldPurge();

    // Job does not throw — it completes
    expect(result.purgedCount).toBe(2);
    expect(result.errorCount).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      '[listingSoldPurge] Failed to delete Typesense document',
      expect.objectContaining({ listingId: 'lst-bad' }),
    );
  });

  it('returns all as errors and purgedCount=0 when Typesense module fails to load', async () => {
    // Override the dynamic import to simulate module load failure.
    // We use vi.doMock inside the test to simulate the failure after resetModules.
    vi.doMock('@twicely/search/typesense-index', () => {
      throw new Error('Cannot find module');
    });

    const { db } = await import('@twicely/db');
    const candidates = [{ id: 'lst-a' }, { id: 'lst-b' }];
    vi.mocked(db.select).mockReturnValue(makeSelectChain(candidates) as unknown as ReturnType<typeof db.select>);

    const { runListingSoldPurge } = await import('../listing-sold-purge');
    const result = await runListingSoldPurge();

    expect(result.purgedCount).toBe(0);
    expect(result.errorCount).toBe(2);
  });

  it('result includes a cutoffDate ISO string', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);

    const { runListingSoldPurge } = await import('../listing-sold-purge');
    const result = await runListingSoldPurge();

    expect(result.cutoffDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
