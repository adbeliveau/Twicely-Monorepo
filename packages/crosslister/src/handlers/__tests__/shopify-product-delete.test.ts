/**
 * Unit tests for Shopify product delete webhook handler.
 * Source: H3.4 install prompt §5 (Unit Tests — Product Delete Handler)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    id: 'id',
    status: 'status',
    channel: 'channel',
    externalId: 'external_id',
    orphanedAt: 'orphaned_at',
    updatedAt: 'updated_at',
    accountId: 'account_id',
    sellerId: 'seller_id',
    syncEnabled: 'sync_enabled',
  },
  crosslisterAccount: {},
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => ({ type: 'eq', a: _a, b: _b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('@/lib/realtime/centrifugo-publisher', () => ({
  publishToChannel: vi.fn().mockResolvedValue(undefined),
  sellerChannel: vi.fn((id: string) => `private-user.${id}`),
}));

import { db } from '@twicely/db';
import { handleShopifyProductDelete } from '../shopify-webhook-handlers';

/** Mock a found projection */
function mockFoundProjection(proj = { id: 'proj-001', status: 'ACTIVE' }) {
  const mockSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  vi.mocked(db.update).mockImplementation(mockUpdate);

  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([proj]),
      }),
    }),
  } as never);
}

/** Mock no matching projection */
function mockNotFoundProjection() {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as never);
}

describe('handleShopifyProductDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks projection as DELISTED and sets orphanedAt', async () => {
    mockFoundProjection();

    await handleShopifyProductDelete('mystore.myshopify.com', { id: 12345 });

    const setCall = vi.mocked(db.update).mock.results[0]?.value?.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DELISTED',
        orphanedAt: expect.any(Date),
      }),
    );
  });

  it('does nothing when product not found (no matching projection)', async () => {
    mockNotFoundProjection();

    await handleShopifyProductDelete('mystore.myshopify.com', { id: 12345 });

    expect(db.update).not.toHaveBeenCalled();
  });

  it('does NOT delete the canonical listing — only marks projection', async () => {
    mockFoundProjection();

    await handleShopifyProductDelete('mystore.myshopify.com', { id: 12345 });

    // Only update should be called, not delete
    expect(db.update).toHaveBeenCalledOnce();
  });

  it('handles body with only { id: number } shape', async () => {
    mockFoundProjection();

    await expect(
      handleShopifyProductDelete('mystore.myshopify.com', { id: 99999 })
    ).resolves.not.toThrow();

    expect(db.update).toHaveBeenCalled();
  });

  it('handles missing/invalid id gracefully', async () => {
    await expect(
      handleShopifyProductDelete('mystore.myshopify.com', { no_id: true })
    ).resolves.not.toThrow();

    expect(db.update).not.toHaveBeenCalled();
  });
});
