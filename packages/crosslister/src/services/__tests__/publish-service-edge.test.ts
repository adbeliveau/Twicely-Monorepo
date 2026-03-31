/**
 * Supplementary edge-case tests for publish-service.ts (F3.1 enqueue pattern).
 * Covers: REQUIRE_FIELDS policy, re-publishing a previously ERROR/DELISTED projection,
 *         REQUIRE_CHANGES (proceeds with auto-fix), BullMQ enqueue failure.
 *
 * F3.1 Note: connector is NOT called during publishListingToChannel — only during
 * worker execution. All "retryable failure" and "exception in connector" tests
 * now belong to job-executor.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: {},
  listingImage: {},
  channelProjection: {},
  crossJob: {},
  crosslisterAccount: {},
  platformSetting: {},
  channelCategoryMapping: {},
  featureFlag: {},
}));

vi.mock('drizzle-orm', () => ({
  sql: vi.fn(),
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@twicely/config/feature-flags', () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

// F3.1: connector is never called during publishListingToChannel
vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn().mockReturnValue({
    createListing: vi.fn().mockResolvedValue({ success: true, externalId: 'ext-123', externalUrl: null }),
  }),
}));

vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockReturnValue({
    channel: 'EBAY',
    displayName: 'eBay',
    tier: 'A',
    defaultCapabilities: {
      maxTitleLength: 80, maxDescriptionLength: 4000, maxImagesPerListing: 24, canPublish: true,
    },
  }),
}));

vi.mock('../listing-transform', () => ({
  transformListingForChannel: vi.fn().mockReturnValue({
    title: 'Test', description: 'Desc', priceCents: 5000,
    images: [], condition: 'LIKE_NEW',
    category: { externalCategoryId: '', externalCategoryName: '', path: [] },
    shipping: { type: 'FLAT', flatRateCents: 500, weightOz: 16, dimensions: null, handlingTimeDays: 3 },
    brand: 'Nike', attributes: {}, descriptionHtml: '<p>Desc</p>', quantity: 1, itemSpecifics: {},
  }),
}));

vi.mock('../policy-validator', () => ({
  validateForChannel: vi.fn().mockResolvedValue({ status: 'ALLOW' }),
}));

vi.mock('@twicely/crosslister/queue/lister-queue', () => ({
  listerPublishQueue: {
    add: vi.fn().mockResolvedValue({ id: 'bq-job-1' }),
    remove: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@twicely/crosslister/queue/constants', () => ({
  PRIORITY_CREATE: 300,
  PRIORITY_SYNC: 500,
  PRIORITY_DELIST: 100,
  MAX_ATTEMPTS_PUBLISH: 3,
  MAX_ATTEMPTS_SYNC: 3,
  BACKOFF_PUBLISH: { type: 'exponential', delay: 30_000 },
  BACKOFF_SYNC: { type: 'exponential', delay: 60_000 },
  REMOVE_ON_COMPLETE: { count: 1000 },
  REMOVE_ON_FAIL: { count: 5000 },
}));

const LISTING_ROW = {
  id: 'lst-1', ownerUserId: 'user-1', status: 'ACTIVE',
  title: 'Test', description: 'Desc', priceCents: 5000,
  condition: 'LIKE_NEW', brand: 'Nike', quantity: 1,
  weightOz: 16, lengthIn: 12, widthIn: 8, heightIn: 4,
  freeShipping: false, shippingCents: 500, attributesJson: {}, categoryId: 'cat-1',
};

const ACCOUNT_ROW = {
  id: 'acct-1', sellerId: 'user-1', channel: 'EBAY', status: 'ACTIVE',
  externalAccountId: 'ebay-user-123',
};

function buildSelectMock(overrides: Record<number, unknown> = {}) {
  let call = 0;
  return () => ({
    from: vi.fn().mockImplementation(() => {
      call++;
      const thisCall = call;
      const defaultResults: Record<number, unknown> = {
        1: [LISTING_ROW],
        2: [{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }],
        3: [{ value: 'true' }],
        4: [],
        5: [ACCOUNT_ROW],
        6: [],
        7: [],
        ...overrides,
      };
      const result = defaultResults[thisCall] ?? [];
      return {
        where: vi.fn().mockImplementation(() => {
          if (thisCall === 2) return Promise.resolve(result);
          return { limit: vi.fn().mockResolvedValue(result) };
        }),
        limit: vi.fn().mockResolvedValue(result),
      };
    }),
  });
}

describe('publishListingToChannel — REQUIRE_FIELDS policy', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('returns error for listing missing required fields', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'REQUIRE_FIELDS',
      fields: ['brand', 'condition'],
    });
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(buildSelectMock());

    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('brand');
    expect(result.error).toContain('condition');
  });
});

describe('publishListingToChannel — REQUIRE_CHANGES proceeds', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('proceeds with enqueue despite REQUIRE_CHANGES', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'REQUIRE_CHANGES',
      changes: [{ field: 'title', guidance: 'Will be truncated' }],
    });
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(buildSelectMock());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]) }),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    // Should succeed (enqueued) despite REQUIRE_CHANGES
    expect(result.success).toBe(true);
    expect(result.crossJobId).toBe('job-1');
  });
});

describe('publishListingToChannel — re-publish after ERROR', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('resets existing ERROR projection to PUBLISHING and re-enqueues', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    // Override call #7: existing projection with ERROR status
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(
      buildSelectMock({
        7: [{ id: 'proj-err', status: 'ERROR', publishAttempts: 2 }],
      }),
    );
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'job-re' }]) }),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    // F3.1: returns success after enqueue, not after connector execution
    expect(result.success).toBe(true);
    expect(result.crossJobId).toBe('job-re');
    // First update should reset the projection to PUBLISHING
    const resetUpdate = setCalls[0] as Record<string, unknown>;
    expect(resetUpdate?.status).toBe('PUBLISHING');
    expect(resetUpdate?.publishAttempts).toBe(0);
  });
});

describe('publishListingToChannel — BullMQ enqueue failure', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('reverts projection to ERROR when BullMQ add fails', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { listerPublishQueue } = await import('@twicely/crosslister/queue/lister-queue');
    (listerPublishQueue.add as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Valkey connection refused'));

    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(buildSelectMock());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'job-fail' }]) }),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Valkey connection refused');
    const errorUpdate = setCalls.find((c) => (c as Record<string, unknown>)?.status === 'ERROR') as Record<string, unknown> | undefined;
    expect(errorUpdate).toBeDefined();
  });
});
