/**
 * Unit tests for Shopify product update webhook handler.
 * Source: H3.4 install prompt §5 (Unit Tests — Product Update Handler)
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
    sellerId: 'seller_id',
    status: 'status',
    channel: 'channel',
    externalId: 'external_id',
    syncEnabled: 'sync_enabled',
    externalDiff: 'external_diff',
    hasPendingSync: 'has_pending_sync',
    pollTier: 'poll_tier',
    updatedAt: 'updated_at',
    accountId: 'account_id',
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

vi.mock('@twicely/realtime/centrifugo-publisher', () => ({
  publishToChannel: vi.fn().mockResolvedValue(undefined),
  sellerChannel: vi.fn((id: string) => `private-user.${id}`),
}));

import { db } from '@twicely/db';
import { publishToChannel } from '@twicely/realtime/centrifugo-publisher';
import { handleShopifyProductUpdate } from '../shopify-webhook-handlers';

/** Build a valid Shopify product webhook payload */
function makeProduct(overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    id: 12345,
    title: 'Test Product',
    body_html: '<p>Description</p>',
    vendor: 'Test Brand',
    product_type: 'Electronics',
    status: 'active',
    tags: 'tag1,tag2',
    variants: [{ id: 99001, product_id: 12345, title: 'Default', price: '49.99', sku: null, inventory_quantity: 5, weight: null, weight_unit: null, barcode: null }],
    images: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    handle: 'test-product',
    ...overrides,
  };
}

/** Mock a found projection */
function mockFoundProjection(proj = {
  id: 'proj-001',
  sellerId: 'seller-123',
  status: 'ACTIVE',
  syncEnabled: true,
}) {
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

describe('handleShopifyProductUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores externalDiff on projection when product data received', async () => {
    mockFoundProjection();

    await handleShopifyProductUpdate('mystore.myshopify.com', makeProduct());

    expect(db.update).toHaveBeenCalled();
  });

  it('stores externalDiff with field-level values', async () => {
    mockFoundProjection();

    await handleShopifyProductUpdate('mystore.myshopify.com', makeProduct({ title: 'Updated Title' }));

    const setCall = vi.mocked(db.update).mock.results[0]?.value?.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        externalDiff: expect.objectContaining({
          shopDomain: 'mystore.myshopify.com',
          fields: expect.objectContaining({
            title: expect.objectContaining({ new: 'Updated Title' }),
          }),
        }),
        hasPendingSync: true,
      }),
    );
  });

  it('sets hasPendingSync = true on the projection', async () => {
    mockFoundProjection();

    await handleShopifyProductUpdate('mystore.myshopify.com', makeProduct());

    const setCall = vi.mocked(db.update).mock.results[0]?.value?.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({ hasPendingSync: true }),
    );
  });

  it('marks projection DELISTED when Shopify status is archived', async () => {
    mockFoundProjection({ id: 'proj-001', sellerId: 'seller-123', status: 'ACTIVE', syncEnabled: true });

    await handleShopifyProductUpdate('mystore.myshopify.com', makeProduct({ status: 'archived' }));

    // First call should be the status update to DELISTED
    expect(db.update).toHaveBeenCalled();
    const firstSetCall = vi.mocked(db.update).mock.results[0]?.value?.set;
    expect(firstSetCall).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DELISTED' }),
    );
  });

  it('does nothing when product not managed by Twicely (no matching projection)', async () => {
    mockNotFoundProjection();

    await handleShopifyProductUpdate('mystore.myshopify.com', makeProduct());

    expect(db.update).not.toHaveBeenCalled();
    expect(publishToChannel).not.toHaveBeenCalled();
  });

  it('sends Centrifugo sync.external_change event with correct payload', async () => {
    mockFoundProjection();

    await handleShopifyProductUpdate('mystore.myshopify.com', makeProduct());

    expect(publishToChannel).toHaveBeenCalledWith(
      'private-user.seller-123',
      expect.objectContaining({
        event: 'sync.external_change',
        projectionId: 'proj-001',
        channel: 'SHOPIFY',
      }),
    );
  });

  it('handles Zod parse failure gracefully (returns without throwing)', async () => {
    await expect(
      handleShopifyProductUpdate('mystore.myshopify.com', { invalid: 'payload' })
    ).resolves.not.toThrow();

    expect(db.update).not.toHaveBeenCalled();
  });

  it('elevates pollTier to WARM on update', async () => {
    mockFoundProjection();

    await handleShopifyProductUpdate('mystore.myshopify.com', makeProduct());

    const setCall = vi.mocked(db.update).mock.results[0]?.value?.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({ pollTier: 'WARM' }),
    );
  });
});
