/**
 * Unit tests for Shopify sale webhook handler.
 * Source: H3.4 install prompt §5 (Unit Tests — Sale Webhook Handler)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    id: 'id',
    listingId: 'listing_id',
    status: 'status',
    channel: 'channel',
    externalId: 'external_id',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => ({ type: 'eq', a: _a, b: _b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('../../services/sale-detection', () => ({
  handleDetectedSale: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/platform-fees', () => ({
  getPlatformFeeRate: vi.fn().mockResolvedValue(290),  // 2.9% = 290 bps
  calculatePlatformFee: vi.fn().mockReturnValue(145),  // $1.45 on a $49.99 sale
}));

import { db } from '@twicely/db';
import { handleDetectedSale } from '../../services/sale-detection';
import { getPlatformFeeRate } from '../../services/platform-fees';
import { handleShopifySaleWebhook } from '../sale-webhook-handler';

/** Build a valid Shopify order webhook payload */
function makeOrder(overrides: Partial<Record<string, unknown>> = {}): unknown {
  return {
    id: 5001001001,
    name: '#1001',
    financial_status: 'paid',
    fulfillment_status: null,
    total_price: '49.99',
    currency: 'USD',
    line_items: [
      {
        id: 9001,
        product_id: 12345,
        variant_id: 99001,
        title: 'Test Product',
        quantity: 1,
        price: '49.99',
      },
    ],
    customer: {
      id: 7001,
      email: 'buyer@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
    },
    created_at: '2025-01-15T12:00:00Z',
    updated_at: '2025-01-15T12:00:00Z',
    ...overrides,
  };
}

/** Set up DB mock to return a found projection */
function mockFoundProjection(proj = {
  id: 'proj-shopify-001',
  listingId: 'listing-twicely-abc',
  status: 'ACTIVE',
}) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([proj]),
      }),
    }),
  } as never);
}

/** Set up DB mock to return no projection */
function mockNotFoundProjection() {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as never);
}

describe('handleShopifySaleWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handleDetectedSale when projection found for line item product_id', async () => {
    mockFoundProjection();

    await handleShopifySaleWebhook('mystore.myshopify.com', makeOrder());

    expect(handleDetectedSale).toHaveBeenCalledOnce();
    expect(handleDetectedSale).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'SHOPIFY',
        externalOrderId: '5001001001',
        salePriceCents: 4999,
        listingId: 'listing-twicely-abc',
        projectionId: 'proj-shopify-001',
      }),
    );
  });

  it('skips silently when projection not found (product not managed by Twicely)', async () => {
    mockNotFoundProjection();

    await handleShopifySaleWebhook('mystore.myshopify.com', makeOrder());

    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('handles multi-line-item orders — processes each independently', async () => {
    const multiItemOrder = makeOrder({
      line_items: [
        { id: 9001, product_id: 12345, variant_id: 99001, title: 'Product A', quantity: 1, price: '29.99' },
        { id: 9002, product_id: 67890, variant_id: 99002, title: 'Product B', quantity: 1, price: '19.99' },
      ],
    });

    // Return different projections for each call
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'proj-001', listingId: 'listing-001', status: 'ACTIVE' }]),
          }),
        }),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'proj-002', listingId: 'listing-002', status: 'ACTIVE' }]),
          }),
        }),
      } as never);

    await handleShopifySaleWebhook('mystore.myshopify.com', multiItemOrder);

    expect(handleDetectedSale).toHaveBeenCalledTimes(2);
  });

  it('skips line items with null product_id (custom line items)', async () => {
    const orderWithCustomItem = makeOrder({
      line_items: [
        { id: 9001, product_id: null, variant_id: null, title: 'Custom Discount', quantity: 1, price: '-5.00' },
        { id: 9002, product_id: 12345, variant_id: 99001, title: 'Real Product', quantity: 1, price: '49.99' },
      ],
    });

    mockFoundProjection();

    await handleShopifySaleWebhook('mystore.myshopify.com', orderWithCustomItem);

    // Only 1 call — the custom line item was skipped
    expect(handleDetectedSale).toHaveBeenCalledOnce();
  });

  it('converts decimal price string to integer cents correctly', async () => {
    mockFoundProjection();

    const order = makeOrder({
      line_items: [
        { id: 9001, product_id: 12345, variant_id: 99001, title: 'Item', quantity: 1, price: '149.99' },
      ],
    });

    await handleShopifySaleWebhook('mystore.myshopify.com', order);

    expect(handleDetectedSale).toHaveBeenCalledWith(
      expect.objectContaining({ salePriceCents: 14999 }),
    );
  });

  it('calls getPlatformFeeRate with SHOPIFY channel', async () => {
    mockFoundProjection();

    await handleShopifySaleWebhook('mystore.myshopify.com', makeOrder());

    expect(getPlatformFeeRate).toHaveBeenCalledWith('SHOPIFY');
  });

  it('handles invalid order payload gracefully (Zod parse failure)', async () => {
    await handleShopifySaleWebhook('mystore.myshopify.com', { not_an_order: true });

    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('skips line items with zero price gracefully', async () => {
    mockFoundProjection();

    const order = makeOrder({
      line_items: [
        { id: 9001, product_id: 12345, variant_id: 99001, title: 'Free Item', quantity: 1, price: '0.00' },
      ],
    });

    await handleShopifySaleWebhook('mystore.myshopify.com', order);

    // Price of 0 cents — no sale processed
    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('uses String(order.id) as externalOrderId', async () => {
    mockFoundProjection();

    await handleShopifySaleWebhook('mystore.myshopify.com', makeOrder({ id: 9876543210 }));

    expect(handleDetectedSale).toHaveBeenCalledWith(
      expect.objectContaining({ externalOrderId: '9876543210' }),
    );
  });

  it('sets buyerUsername from customer email', async () => {
    mockFoundProjection();

    await handleShopifySaleWebhook('mystore.myshopify.com', makeOrder());

    expect(handleDetectedSale).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUsername: 'buyer@example.com' }),
    );
  });

  it('uses customer first_name as buyerUsername when email is null', async () => {
    mockFoundProjection();

    const order = makeOrder({
      customer: { id: 7001, email: null, first_name: 'Jane', last_name: 'Doe' },
    });

    await handleShopifySaleWebhook('mystore.myshopify.com', order);

    expect(handleDetectedSale).toHaveBeenCalledWith(
      expect.objectContaining({ buyerUsername: 'Jane' }),
    );
  });
});
