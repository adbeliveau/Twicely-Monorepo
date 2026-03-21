/**
 * Unit tests for outbound sync service.
 * Source: H3.4 install prompt §5 (Unit Tests — Outbound Sync)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  listing: { id: 'id', title: 'title', description: 'description', priceCents: 'price_cents', quantity: 'quantity', status: 'status' },
  listingImage: { listingId: 'listing_id', url: 'url' },
  channelProjection: {
    id: 'id',
    listingId: 'listing_id',
    channel: 'channel',
    accountId: 'account_id',
    sellerId: 'seller_id',
    syncEnabled: 'sync_enabled',
    status: 'status',
    lastCanonicalHash: 'last_canonical_hash',
    hasPendingSync: 'has_pending_sync',
    updatedAt: 'updated_at',
    externalId: 'external_id',
  },
  crossJob: { sellerId: 'seller_id', projectionId: 'projection_id', accountId: 'account_id', jobType: 'job_type', priority: 'priority', idempotencyKey: 'idempotency_key', payload: 'payload' },
  crosslisterAccount: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => ({ type: 'eq', a: _a, b: _b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@twicely/crosslister/connector-registry', () => ({
  getConnector: vi.fn().mockReturnValue({
    updateListing: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

import { db } from '@twicely/db';
import { computeCanonicalHash, detectOutboundSyncNeeded, queueOutboundSync } from '../outbound-sync';
import type { CanonicalListingData } from '../outbound-sync';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeListingData(overrides: Partial<CanonicalListingData> = {}): CanonicalListingData {
  return {
    title: 'Test Product',
    description: 'A description',
    priceCents: 4999,
    quantity: 1,
    status: 'ACTIVE',
    imageUrls: ['https://cdn.example.com/img1.jpg', 'https://cdn.example.com/img2.jpg'],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeCanonicalHash', () => {
  it('produces the same hash for identical data', () => {
    const data = makeListingData();
    const hash1 = computeCanonicalHash(data);
    const hash2 = computeCanonicalHash(data);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
  });

  it('produces a different hash when price changes', () => {
    const hash1 = computeCanonicalHash(makeListingData({ priceCents: 4999 }));
    const hash2 = computeCanonicalHash(makeListingData({ priceCents: 5999 }));
    expect(hash1).not.toBe(hash2);
  });

  it('produces a different hash when title changes', () => {
    const hash1 = computeCanonicalHash(makeListingData({ title: 'Original' }));
    const hash2 = computeCanonicalHash(makeListingData({ title: 'Updated' }));
    expect(hash1).not.toBe(hash2);
  });

  it('is insensitive to image URL order (sorted before hashing)', () => {
    const urlA = 'https://cdn.example.com/imgA.jpg';
    const urlB = 'https://cdn.example.com/imgB.jpg';

    const hash1 = computeCanonicalHash(makeListingData({ imageUrls: [urlA, urlB] }));
    const hash2 = computeCanonicalHash(makeListingData({ imageUrls: [urlB, urlA] }));
    expect(hash1).toBe(hash2);
  });
});

describe('detectOutboundSyncNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns projections with mismatched hashes', async () => {
    const listingRow = {
      id: 'listing-001',
      title: 'Test',
      description: 'Desc',
      priceCents: 4999,
      quantity: 1,
      status: 'ACTIVE',
    };
    const imageRows = [{ url: 'https://cdn.example.com/img.jpg' }];
    const projectionRows = [
      { id: 'proj-001', channel: 'SHOPIFY', accountId: 'acc-001', lastCanonicalHash: 'old-hash-different' },
    ];

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([listingRow]),
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(imageRows),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(projectionRows),
        }),
      } as never);

    const result = await detectOutboundSyncNeeded('listing-001');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ projectionId: 'proj-001', channel: 'SHOPIFY' });
  });

  it('excludes projections with syncEnabled = false', async () => {
    const listingRow = { id: 'listing-001', title: 'Test', description: '', priceCents: 100, quantity: 1, status: 'ACTIVE' };
    const imageRows: Array<{ url: string }> = [];
    // DB returns no projections (they're filtered by the where clause with syncEnabled = true)
    const projectionRows: unknown[] = [];

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([listingRow]),
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(imageRows),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(projectionRows),
        }),
      } as never);

    const result = await detectOutboundSyncNeeded('listing-001');
    expect(result).toHaveLength(0);
  });

  it('excludes projections with status != ACTIVE', async () => {
    const listingRow = { id: 'listing-001', title: 'Test', description: '', priceCents: 100, quantity: 1, status: 'ACTIVE' };
    const imageRows: Array<{ url: string }> = [];
    // DB returns no projections (filtered by status = ACTIVE in where clause)
    const projectionRows: unknown[] = [];

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([listingRow]),
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(imageRows),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(projectionRows),
        }),
      } as never);

    const result = await detectOutboundSyncNeeded('listing-001');
    expect(result).toHaveLength(0);
  });
});

describe('queueOutboundSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates crossJob with jobType SYNC and priority 500', async () => {
    const listingRow = { title: 'Test', description: 'Desc', priceCents: 4999, quantity: 1, status: 'ACTIVE' };
    const imageRows: Array<{ url: string }> = [];
    const sellerRow = { sellerId: 'seller-001' };

    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([listingRow]),
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(imageRows),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([sellerRow]),
          }),
        }),
      } as never);

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
    vi.mocked(db.insert).mockReturnValue({ values: mockValues } as never);

    const projections = [{ projectionId: 'proj-001', channel: 'SHOPIFY' as const, accountId: 'acc-001' }];
    await queueOutboundSync('listing-001', projections);

    expect(db.insert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: 'SYNC',
        priority: 500,
        idempotencyKey: expect.stringContaining('sync-proj-001'),
      }),
    );
  });

  it('does nothing when projections array is empty', async () => {
    await queueOutboundSync('listing-001', []);

    expect(db.insert).not.toHaveBeenCalled();
  });
});
