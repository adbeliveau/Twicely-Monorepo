import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {
    id: 'id',
    status: 'status',
    soldAt: 'sold_at',
    endedAt: 'ended_at',
  },
  listingImage: {
    id: 'id',
    listingId: 'listing_id',
    url: 'url',
    isPrimary: 'is_primary',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ op: 'and', args })),
  eq: vi.fn((col, val) => ({ op: 'eq', col, val })),
  inArray: vi.fn((col, arr) => ({ op: 'inArray', col, arr })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings,
      values,
    })),
    {
      identifier: vi.fn((s: string) => ({ type: 'identifier', s })),
    },
  ),
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));

const mockDeleteFromR2 = vi.fn().mockResolvedValue(undefined);
vi.mock('@twicely/storage/r2-client', () => ({
  deleteFromR2: (...args: unknown[]) => mockDeleteFromR2(...args),
  extractKeyFromUrl: vi.fn((url: string) => (url ? `images/${url.split('/').pop()}` : null)),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockUpsertPlatformSetting = vi.fn().mockResolvedValue(undefined);
vi.mock('@twicely/jobs/cleanup-helpers', () => ({
  upsertPlatformSetting: (...args: unknown[]) => mockUpsertPlatformSetting(...args),
}));

/**
 * Build a select chain that resolves to `rows` regardless of whether the
 * caller awaits at .where() (no limit) or .limit() (with limit).
 *
 * Drizzle thenable: each chain method returns the chain, and the chain
 * itself is thenable so `await chain` resolves to the row array.
 */
function makeSelectChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

function makeDeleteChain(rowCount = 0) {
  return { where: vi.fn().mockResolvedValue({ rowCount }) };
}

describe('runListingImageRetention — Decision #111', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('reads retention thresholds from platform_settings', async () => {
    const { db } = await import('@twicely/db');
    const { getPlatformSetting } = await import('@twicely/db/queries/platform-settings');

    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(0) as unknown as ReturnType<typeof db.delete>);

    const { runListingImageRetention } = await import('../listing-image-retention');
    await runListingImageRetention();

    expect(getPlatformSetting).toHaveBeenCalledWith('crosslister.images.variantPurgeAfterDays', 120);
    expect(getPlatformSetting).toHaveBeenCalledWith('crosslister.images.fullPurgeAfterDays', 730);
    expect(getPlatformSetting).toHaveBeenCalledWith('crosslister.images.batchSize', 200);
  });

  it('returns zeros when no candidate listings exist', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(0) as unknown as ReturnType<typeof db.delete>);

    const { runListingImageRetention } = await import('../listing-image-retention');
    const result = await runListingImageRetention();

    expect(result.variantsPurgedListings).toBe(0);
    expect(result.variantsPurgedImages).toBe(0);
    expect(result.fullPurgedListings).toBe(0);
    expect(result.fullPurgedImages).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('records lastRunAt to platform_settings on every pass', async () => {
    const { db } = await import('@twicely/db');
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as unknown as ReturnType<typeof db.select>);
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(0) as unknown as ReturnType<typeof db.delete>);

    const { runListingImageRetention } = await import('../listing-image-retention');
    await runListingImageRetention();

    expect(mockUpsertPlatformSetting).toHaveBeenCalledWith(
      'crosslister.images.lastRunAt',
      expect.stringContaining('"at":'),
    );
  });

  it('counts R2 errors but does not throw', async () => {
    const { db } = await import('@twicely/db');

    // First select (full purge candidates) returns empty
    // Second select (variant purge candidates) returns one listing
    // Third select (variant images for that listing) returns one image
    let callIdx = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callIdx++;
      if (callIdx === 2) {
        return makeSelectChain([{ id: 'lst-1' }]) as unknown as ReturnType<typeof db.select>;
      }
      if (callIdx === 3) {
        return makeSelectChain([{ id: 'img-1', url: 'https://r2/x.jpg', listingId: 'lst-1' }]) as unknown as ReturnType<typeof db.select>;
      }
      return makeSelectChain([]) as unknown as ReturnType<typeof db.select>;
    });
    vi.mocked(db.delete).mockReturnValue(makeDeleteChain(1) as unknown as ReturnType<typeof db.delete>);
    mockDeleteFromR2.mockRejectedValueOnce(new Error('R2 unavailable'));

    const { runListingImageRetention } = await import('../listing-image-retention');
    const result = await runListingImageRetention();

    expect(result.errors).toBeGreaterThanOrEqual(1);
  });
});
