import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {},
  crossJob: {},
  crosslisterAccount: {},
  channelCategoryMapping: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn().mockReturnValue({
    createListing: vi.fn().mockResolvedValue({ success: true, externalId: 'ext-1', externalUrl: 'https://ebay.com/1', retryable: false }),
    updateListing: vi.fn().mockResolvedValue({ success: true, retryable: false }),
    delistListing: vi.fn().mockResolvedValue({ success: true, retryable: false }),
  }),
}));

vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockReturnValue({
    channel: 'EBAY',
    displayName: 'eBay',
    tier: 'A',
    defaultCapabilities: { maxTitleLength: 80, maxDescriptionLength: 4000, maxImagesPerListing: 24 },
    rateLimit: { callsPerHourPerSeller: 200, burstAllowance: 20 },
  }),
}));

vi.mock('../listing-transform', () => ({
  transformListingForChannel: vi.fn().mockReturnValue({
    title: 'Test', description: 'Desc', priceCents: 5000,
    images: [], condition: 'LIKE_NEW',
    category: { externalCategoryId: '', externalCategoryName: '', path: [] },
    shipping: { type: 'FLAT', flatRateCents: 500, weightOz: 16, dimensions: null, handlingTimeDays: 3 },
    brand: null, itemSpecifics: {}, quantity: 1, descriptionHtml: null,
  }),
}));

vi.mock('@/lib/queries/crosslister', () => ({
  getListingForPublish: vi.fn().mockResolvedValue({
    listing: {
      id: 'lst-1', ownerUserId: 'user-1', status: 'ACTIVE', title: 'Test', description: 'Desc',
      priceCents: 5000, condition: 'LIKE_NEW', brand: null, quantity: 1,
      weightOz: null, lengthIn: null, widthIn: null, heightIn: null,
      freeShipping: false, shippingCents: 500, attributesJson: {}, categoryId: 'cat-1',
    },
    images: [{ url: 'https://example.com/img.jpg', position: 0, isPrimary: true }],
  }),
}));

const ACCOUNT_ROW = {
  id: 'acct-1', sellerId: 'user-1', channel: 'EBAY', status: 'ACTIVE',
  accessToken: 'tok', capabilities: {},
};

describe('executeCreateJob', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('calls connector.createListing with transformed data', async () => {
    const { getConnector } = await import('@/lib/crosslister/connector-registry');
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { executeCreateJob } = await import('../job-executor');
    await executeCreateJob('cj-1', 'lst-1', 'EBAY', 'user-1', 'acct-1', 'proj-1', null);

    const connector = (getConnector as ReturnType<typeof vi.fn>).mock.results[0]?.value as { createListing: ReturnType<typeof vi.fn> };
    expect(connector.createListing).toHaveBeenCalled();
  });

  it('updates projection to ACTIVE on success', async () => {
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { executeCreateJob } = await import('../job-executor');
    const result = await executeCreateJob('cj-1', 'lst-1', 'EBAY', 'user-1', 'acct-1', 'proj-1', null);

    expect(result.success).toBe(true);
    const projUpdate = setCalls.find((c) => (c as Record<string, unknown>)?.status === 'ACTIVE') as Record<string, unknown> | undefined;
    expect(projUpdate?.externalId).toBe('ext-1');
  });

  it('updates projection to ERROR on non-retryable failure', async () => {
    const { getConnector } = await import('@/lib/crosslister/connector-registry');
    (getConnector as ReturnType<typeof vi.fn>).mockReturnValue({
      createListing: vi.fn().mockResolvedValue({ success: false, externalId: null, externalUrl: null, error: 'Bad creds', retryable: false }),
    });
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { executeCreateJob } = await import('../job-executor');
    const result = await executeCreateJob('cj-1', 'lst-1', 'EBAY', 'user-1', 'acct-1', 'proj-1', null);

    expect(result.success).toBe(false);
    const errUpdate = setCalls.find((c) => (c as Record<string, unknown>)?.status === 'ERROR') as Record<string, unknown> | undefined;
    expect(errUpdate).toBeDefined();
  });

  it('returns retryable=true for transient errors (thrown)', async () => {
    const { getConnector } = await import('@/lib/crosslister/connector-registry');
    (getConnector as ReturnType<typeof vi.fn>).mockReturnValue({
      createListing: vi.fn().mockRejectedValue(new Error('Network timeout')),
    });
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { executeCreateJob } = await import('../job-executor');
    const result = await executeCreateJob('cj-1', 'lst-1', 'EBAY', 'user-1', 'acct-1', 'proj-1', null);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.error).toContain('Network timeout');
  });

  it('returns error when listing not found', async () => {
    const { getListingForPublish } = await import('@/lib/queries/crosslister');
    (getListingForPublish as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { executeCreateJob } = await import('../job-executor');
    const result = await executeCreateJob('cj-1', 'lst-missing', 'EBAY', 'user-1', 'acct-1', 'proj-1', null);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('executeUpdateJob', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('calls connector.updateListing', async () => {
    const { getConnector } = await import('@/lib/crosslister/connector-registry');
    const mockConnector = {
      updateListing: vi.fn().mockResolvedValue({ success: true, retryable: false }),
    };
    (getConnector as ReturnType<typeof vi.fn>).mockReturnValue(mockConnector);
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { executeUpdateJob } = await import('../job-executor');
    const result = await executeUpdateJob('cj-1', 'lst-1', 'EBAY', 'user-1', 'acct-1', 'proj-1', 'ext-1');

    expect(result.success).toBe(true);
    expect(mockConnector.updateListing).toHaveBeenCalledWith(ACCOUNT_ROW, 'ext-1', expect.any(Object));
  });
});

describe('executeDelistJob', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

  it('calls connector.delistListing', async () => {
    const { getConnector } = await import('@/lib/crosslister/connector-registry');
    const mockConnector = {
      delistListing: vi.fn().mockResolvedValue({ success: true, retryable: false }),
    };
    (getConnector as ReturnType<typeof vi.fn>).mockReturnValue(mockConnector);
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { executeDelistJob } = await import('../job-executor');
    const result = await executeDelistJob('cj-1', 'EBAY', 'acct-1', 'proj-1', 'ext-1');

    expect(result.success).toBe(true);
    expect(mockConnector.delistListing).toHaveBeenCalledWith(ACCOUNT_ROW, 'ext-1');
  });

  it('updates projection to DELISTED on success', async () => {
    const { db } = await import('@/lib/db');
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { executeDelistJob } = await import('../job-executor');
    await executeDelistJob('cj-1', 'EBAY', 'acct-1', 'proj-1', 'ext-1');

    const delistedUpdate = setCalls.find((c) => (c as Record<string, unknown>)?.status === 'DELISTED') as Record<string, unknown> | undefined;
    expect(delistedUpdate).toBeDefined();
  });
});
