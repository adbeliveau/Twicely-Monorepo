import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all DB deps
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

// F3.1: connector is NOT called during publishListingToChannel (enqueue only)
vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn().mockReturnValue({
    createListing: vi.fn().mockResolvedValue({
      success: true,
      externalId: 'ext-123',
      externalUrl: 'https://ebay.com/itm/ext-123',
    }),
    updateListing: vi.fn().mockResolvedValue({ success: true }),
    delistListing: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock('@twicely/crosslister/channel-registry', () => ({
  getChannelMetadata: vi.fn().mockReturnValue({
    channel: 'EBAY',
    displayName: 'eBay',
    tier: 'A',
    defaultCapabilities: {
      maxTitleLength: 80,
      maxDescriptionLength: 4000,
      maxImagesPerListing: 24,
      canPublish: true,
    },
  }),
}));

vi.mock('../listing-transform', () => ({
  transformListingForChannel: vi.fn().mockReturnValue({
    title: 'Nike Air Jordan',
    description: 'Great shoes',
    priceCents: 10000,
    images: [{ url: 'https://example.com/img0.jpg', position: 0, isPrimary: true }],
    condition: 'LIKE_NEW',
    category: { externalCategoryId: '', externalCategoryName: '', path: [] },
    shipping: { type: 'FLAT', flatRateCents: 500, weightOz: 16 },
    brand: 'Nike',
    attributes: {},
    descriptionHtml: '<p>Great shoes</p>',
    quantity: 1,
    itemSpecifics: {},
  }),
}));

vi.mock('../policy-validator', () => ({
  validateForChannel: vi.fn().mockResolvedValue({ status: 'ALLOW' }),
}));

// F3.1: Mock the BullMQ queue used by publish-service
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

// Shared listing fixture
const LISTING_ROW = {
  id: 'lst-1',
  ownerUserId: 'user-1',
  status: 'ACTIVE',
  title: 'Nike Air Jordan',
  description: 'Great shoes',
  priceCents: 10000,
  condition: 'LIKE_NEW',
  brand: 'Nike',
  quantity: 1,
  weightOz: 16,
  lengthIn: 12,
  widthIn: 8,
  heightIn: 4,
  freeShipping: false,
  shippingCents: 500,
  attributesJson: {},
  categoryId: 'cat-1',
};

const ACCOUNT_ROW = {
  id: 'acct-1',
  sellerId: 'user-1',
  channel: 'EBAY',
  status: 'ACTIVE',
  externalAccountId: 'ebay-user-123',
};


describe('publishListingToChannel', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns success=false when listing not found', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // no listing
      })),
    }));
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-missing', 'EBAY', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns success=false when listing owner mismatch', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ ...LISTING_ROW, ownerUserId: 'other-user' }]),
      })),
    }));
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');
    expect(result.success).toBe(false);
  });

  it('returns success=false when listing is not ACTIVE', async () => {
    const { db } = await import('@twicely/db');
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ ...LISTING_ROW, status: 'SOLD' }]),
      })),
    }));
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not active');
  });

  it('returns success=false when policy validator denies', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'DENY',
      reason: 'Title required',
    });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) {
          return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        }
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    }));
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Title required');
  });

  it('returns success=false when crosslist is disabled via platformSetting', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) {
          return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        }
        if (fromCall === 2) {
          // images
          return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        }
        if (fromCall === 3) {
          // platformSetting disabled
          return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'false' }]) };
        }
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('returns success=false when no connected account found', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        if (fromCall === 2) return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        if (fromCall === 3) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'true' }]) };
        if (fromCall === 4) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }; // no featureFlag row
        if (fromCall === 5) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }; // no account
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No active');
  });

  it('creates crossJob with priority=300 and status=QUEUED (not IN_PROGRESS)', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        if (fromCall === 2) return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        if (fromCall === 3) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'true' }]) };
        if (fromCall === 4) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 5) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]) };
        if (fromCall === 6) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }; // category
        if (fromCall === 7) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }; // no existing projection
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    const insertedValues: unknown[] = [];
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        insertedValues.push(vals);
        return { returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]) };
      }),
    }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { publishListingToChannel } = await import('../publish-service');
    await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    // insertedValues[0] = projection, insertedValues[1] = crossJob
    const jobValues = insertedValues[1] as Record<string, unknown>;
    expect(jobValues?.priority).toBe(300);
    expect(jobValues?.jobType).toBe('CREATE');
    // F3.1: crossJob status must be QUEUED, not IN_PROGRESS
    expect(jobValues?.status).toBe('QUEUED');
  });

  it('adds job to BullMQ queue and populates bullmqJobId', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        if (fromCall === 2) return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        if (fromCall === 3) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'true' }]) };
        if (fromCall === 4) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 5) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]) };
        if (fromCall === 6) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 7) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]),
      }),
    });
    const setCalls: unknown[] = [];
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockImplementation((vals: unknown) => {
        setCalls.push(vals);
        return { where: vi.fn().mockResolvedValue([]) };
      }),
    });

    const { listerPublishQueue } = await import('@twicely/crosslister/queue/lister-queue');
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    expect(result.success).toBe(true);
    expect(listerPublishQueue.add).toHaveBeenCalled();
    // bullmqJobId should be stored
    const bullmqUpdate = setCalls.find((c) => (c as Record<string, unknown>)?.bullmqJobId !== undefined) as Record<string, unknown> | undefined;
    expect(bullmqUpdate?.bullmqJobId).toBe('bq-job-1');
  });

  it('does NOT call connector during enqueue (connector execution is worker-side)', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { getConnector } = await import('@twicely/crosslister/connector-registry');
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        if (fromCall === 2) return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        if (fromCall === 3) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'true' }]) };
        if (fromCall === 4) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 5) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]) };
        if (fromCall === 6) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 7) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]) }),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { publishListingToChannel } = await import('../publish-service');
    await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    // getConnector should NOT be called during enqueue phase
    expect(getConnector).not.toHaveBeenCalled();
  });

  it('projection status is PUBLISHING after enqueue (not ACTIVE)', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        if (fromCall === 2) return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        if (fromCall === 3) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'true' }]) };
        if (fromCall === 4) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 5) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]) };
        if (fromCall === 6) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 7) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    const insertedValues: unknown[] = [];
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        insertedValues.push(vals);
        return { returning: vi.fn().mockResolvedValue([{ id: 'proj-new' }]) };
      }),
    }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { publishListingToChannel } = await import('../publish-service');
    await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    // insertedValues[0] = projection insert
    const projValues = insertedValues[0] as Record<string, unknown>;
    expect(projValues?.status).toBe('PUBLISHING');
  });

  it('returns error if already published (ACTIVE projection exists)', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        if (fromCall === 2) return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        if (fromCall === 3) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'true' }]) };
        if (fromCall === 4) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 5) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]) };
        if (fromCall === 6) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 7) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ id: 'proj-existing', status: 'ACTIVE', publishAttempts: 1 }]) };
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    const { publishListingToChannel } = await import('../publish-service');
    const result = await publishListingToChannel('lst-1', 'EBAY', 'user-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already published');
  });

  it('idempotencyKey includes listingId and channel', async () => {
    const { validateForChannel } = await import('../policy-validator');
    (validateForChannel as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ALLOW' });
    const { db } = await import('@twicely/db');
    let fromCall = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        fromCall++;
        if (fromCall === 1) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([LISTING_ROW]) };
        if (fromCall === 2) return { where: vi.fn().mockResolvedValue([{ url: 'https://x.com/img.jpg', position: 0, isPrimary: true }]) };
        if (fromCall === 3) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ value: 'true' }]) };
        if (fromCall === 4) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 5) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([ACCOUNT_ROW]) };
        if (fromCall === 6) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        if (fromCall === 7) return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
        return { where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
      }),
    }));
    const capturedJobValues: unknown[] = [];
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockImplementation((vals: unknown) => {
        capturedJobValues.push(vals);
        return { returning: vi.fn().mockResolvedValue([{ id: 'job-1' }]) };
      }),
    });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const { publishListingToChannel } = await import('../publish-service');
    await publishListingToChannel('lst-1', 'EBAY', 'user-1');

    const jobVals = capturedJobValues[1] as Record<string, unknown>;
    expect(typeof jobVals?.idempotencyKey).toBe('string');
    expect(String(jobVals?.idempotencyKey)).toContain('lst-1');
    expect(String(jobVals?.idempotencyKey)).toContain('EBAY');
  });
});
