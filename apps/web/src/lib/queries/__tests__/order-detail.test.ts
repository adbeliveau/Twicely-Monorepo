import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  order: {
    id: 'id', orderNumber: 'order_number', status: 'status',
    buyerId: 'buyer_id', sellerId: 'seller_id',
    itemSubtotalCents: 'item_subtotal_cents', shippingCents: 'shipping_cents',
    taxCents: 'tax_cents', discountCents: 'discount_cents', totalCents: 'total_cents',
    currency: 'currency', shippingAddressJson: 'shipping_address_json',
    paidAt: 'paid_at', expectedDeliveryAt: 'expected_delivery_at', createdAt: 'created_at',
    paymentIntentId: 'payment_intent_id',
  },
  orderItem: { id: 'id', orderId: 'order_id', listingId: 'listing_id', title: 'title', quantity: 'quantity', unitPriceCents: 'unit_price_cents' },
  listingImage: { listingId: 'listing_id', url: 'url', isPrimary: 'is_primary' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
}));

import { getOrderById, getOrdersByPaymentIntent } from '../order-detail';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

const BUYER_ID = 'buyer-test-001';

const baseOrderRow = {
  id: 'ord-1', orderNumber: 'TW-0001', status: 'PAID',
  buyerId: BUYER_ID, sellerId: 'seller-001',
  itemSubtotalCents: 4000, shippingCents: 599, taxCents: 350,
  discountCents: 0, totalCents: 4949, currency: 'USD',
  shippingAddressJson: { line1: '123 Main St', city: 'NYC' },
  paidAt: new Date('2025-01-02'), expectedDeliveryAt: null, createdAt: new Date('2025-01-01'),
};

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['leftJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  chain['orderBy'] = vi.fn().mockReturnValue(chain);
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

describe('getOrderById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when order not found for buyer', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getOrderById('ord-missing', BUYER_ID);
    expect(result).toBeNull();
  });

  it('returns order with items and images', async () => {
    // order query
    mockSelect.mockReturnValueOnce(makeChain([baseOrderRow]) as never);
    // items query
    mockSelect.mockReturnValueOnce(makeChain([
      { id: 'item-1', listingId: 'lst-1', title: 'Nike Air Jordan', quantity: 1, unitPriceCents: 4000 },
    ]) as never);
    // images query
    mockSelect.mockReturnValueOnce(makeChain([
      { listingId: 'lst-1', url: 'https://cdn.example.com/img.jpg' },
    ]) as never);

    const result = await getOrderById('ord-1', BUYER_ID);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('ord-1');
    expect(result!.orderNumber).toBe('TW-0001');
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0]!.title).toBe('Nike Air Jordan');
    expect(result!.items[0]!.primaryImageUrl).toBe('https://cdn.example.com/img.jpg');
  });

  it('returns null primaryImageUrl when no image found', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseOrderRow]) as never);
    mockSelect.mockReturnValueOnce(makeChain([
      { id: 'item-1', listingId: 'lst-1', title: 'Item', quantity: 1, unitPriceCents: 1000 },
    ]) as never);
    // no images
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getOrderById('ord-1', BUYER_ID);
    expect(result!.items[0]!.primaryImageUrl).toBeNull();
  });

  it('returns empty items array when order has no items', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseOrderRow]) as never);
    // items query returns empty
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getOrderById('ord-1', BUYER_ID);
    expect(result!.items).toHaveLength(0);
    // images query should NOT be called since no items
    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it('exposes shippingAddressJson as Record', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseOrderRow]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getOrderById('ord-1', BUYER_ID);
    expect(result!.shippingAddressJson).toMatchObject({ line1: '123 Main St' });
  });
});

describe('getOrdersByPaymentIntent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns orders matching a payment intent', async () => {
    mockSelect.mockReturnValueOnce(makeChain([
      { id: 'ord-1', buyerId: 'buyer-001', status: 'PAID' },
      { id: 'ord-2', buyerId: 'buyer-002', status: 'PAID' },
    ]) as never);

    const result = await getOrdersByPaymentIntent('pi_test_123');
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('ord-1');
    expect(result[1]!.status).toBe('PAID');
  });

  it('returns empty array when no orders match payment intent', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getOrdersByPaymentIntent('pi_unknown');
    expect(result).toHaveLength(0);
  });
});
