import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({ db: { select: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  order: {
    id: 'id', orderNumber: 'order_number', status: 'status',
    buyerId: 'buyer_id', sellerId: 'seller_id',
    totalCents: 'total_cents', itemSubtotalCents: 'item_subtotal_cents',
    shippingCents: 'shipping_cents', taxCents: 'tax_cents', discountCents: 'discount_cents',
    shippingAddressJson: 'shipping_address_json', buyerNote: 'buyer_note',
    isGift: 'is_gift', giftMessage: 'gift_message', paidAt: 'paid_at',
    shippedAt: 'shipped_at', deliveredAt: 'delivered_at', trackingNumber: 'tracking_number',
    carrierCode: 'carrier_code', isLateShipment: 'is_late_shipment',
    expectedShipByAt: 'expected_ship_by_at', cancelReason: 'cancel_reason',
    cancelInitiator: 'cancel_initiator', isLocalPickup: 'is_local_pickup',
    localTransactionId: 'local_transaction_id', authenticationOffered: 'authentication_offered',
    authenticationDeclined: 'authentication_declined', authenticationDeclinedAt: 'authentication_declined_at',
    authenticationRequestId: 'authentication_request_id', createdAt: 'created_at',
  },
  orderItem: { id: 'id', orderId: 'order_id', listingId: 'listing_id', title: 'title', quantity: 'quantity', unitPriceCents: 'unit_price_cents' },
  orderPayment: { orderId: 'order_id', tfAmountCents: 'tf_amount_cents', stripeFeesCents: 'stripe_fees_cents' },
  listingImage: { listingId: 'listing_id', url: 'url', isPrimary: 'is_primary' },
  user: { id: 'id', name: 'name' },
  sellerProfile: { userId: 'user_id', id: 'id', storeName: 'store_name' },
  shipment: { id: 'id', orderId: 'order_id', tracking: 'tracking', carrier: 'carrier', status: 'status', shippedAt: 'shipped_at', deliveredAt: 'delivered_at' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ op: 'eq', a, b })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  or: vi.fn((...args) => ({ op: 'or', args })),
  inArray: vi.fn((col, vals) => ({ op: 'inArray', col, vals })),
  asc: vi.fn((col) => ({ op: 'asc', col })),
}));

import { getOrderDetail, getOrderItems } from '../orders-detail';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

const USER_ID = 'user-test-001';
const ORDER_ID = 'ord-test-001';

const baseOrderData = {
  id: ORDER_ID, orderNumber: 'TW-1001', status: 'PAID',
  buyerId: USER_ID, sellerId: 'seller-001',
  totalCents: 5999, itemSubtotalCents: 5000, shippingCents: 699, taxCents: 300, discountCents: 0,
  shippingAddressJson: { line1: '1 Test Ave' }, buyerNote: null, isGift: false, giftMessage: null,
  paidAt: new Date('2025-01-02'), shippedAt: null, deliveredAt: null,
  trackingNumber: null, carrierCode: null, isLateShipment: false, expectedShipByAt: null,
  cancelReason: null, cancelInitiator: null, isLocalPickup: false, localTransactionId: null,
  authenticationOffered: false, authenticationDeclined: false, authenticationDeclinedAt: null,
  authenticationRequestId: null, createdAt: new Date('2025-01-01'),
};

function makeChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['leftJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  chain['orderBy'] = vi.fn().mockResolvedValue(data);
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

describe('getOrderDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when order not found or user not party to order', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);
    const result = await getOrderDetail('ord-missing', USER_ID);
    expect(result).toBeNull();
  });

  it('returns full order detail for buyer', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseOrderData]) as never); // order
    mockSelect.mockReturnValueOnce(makeChain([
      { id: 'item-1', listingId: 'lst-1', title: 'Sneakers', quantity: 1, unitPriceCents: 5000 },
    ]) as never); // items
    mockSelect.mockReturnValueOnce(makeChain([]) as never); // images for items
    mockSelect.mockReturnValueOnce(makeChain([]) as never); // shipment
    mockSelect.mockReturnValueOnce(makeChain([{ name: 'Jane Buyer' }]) as never); // buyer
    mockSelect.mockReturnValueOnce(makeChain([{ name: 'Bob Seller', storeName: 'BobShop' }]) as never); // seller
    mockSelect.mockReturnValueOnce(makeChain([{ tfAmountCents: 500, stripeFeesCents: 175 }]) as never); // payment

    const result = await getOrderDetail(ORDER_ID, USER_ID);
    expect(result).not.toBeNull();
    expect(result!.order.id).toBe(ORDER_ID);
    expect(result!.order.orderNumber).toBe('TW-1001');
    expect(result!.buyer.name).toBe('Jane Buyer');
    expect(result!.seller.storeName).toBe('BobShop');
    expect(result!.order.tfAmountCents).toBe(500);
    expect(result!.order.stripeFeesCents).toBe(175);
    expect(result!.items).toHaveLength(1);
  });

  it('returns null tfAmountCents when payment record missing', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseOrderData]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never); // items
    mockSelect.mockReturnValueOnce(makeChain([]) as never); // shipment
    mockSelect.mockReturnValueOnce(makeChain([{ name: 'Buyer' }]) as never);
    mockSelect.mockReturnValueOnce(makeChain([{ name: 'Seller', storeName: null }]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never); // no payment record

    const result = await getOrderDetail(ORDER_ID, USER_ID);
    expect(result!.order.tfAmountCents).toBeNull();
    expect(result!.order.stripeFeesCents).toBeNull();
  });

  it('includes shipment data when present', async () => {
    mockSelect.mockReturnValueOnce(makeChain([baseOrderData]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never); // items
    mockSelect.mockReturnValueOnce(makeChain([{
      id: 'ship-1', tracking: '1Z999AA1', carrier: 'UPS', status: 'SHIPPED',
      shippedAt: new Date('2025-01-03'), deliveredAt: null,
    }]) as never); // shipment
    mockSelect.mockReturnValueOnce(makeChain([{ name: 'Buyer' }]) as never);
    mockSelect.mockReturnValueOnce(makeChain([{ name: 'Seller', storeName: null }]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getOrderDetail(ORDER_ID, USER_ID);
    expect(result!.shipment).not.toBeNull();
    expect(result!.shipment!.tracking).toBe('1Z999AA1');
    expect(result!.shipment!.carrier).toBe('UPS');
  });
});

describe('getOrderItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array for order with no items', async () => {
    mockSelect.mockReturnValueOnce(makeChain([]) as never);
    const result = await getOrderItems(ORDER_ID);
    expect(result).toHaveLength(0);
    expect(mockSelect).toHaveBeenCalledTimes(1);
  });

  it('returns items with image URLs', async () => {
    mockSelect.mockReturnValueOnce(makeChain([
      { id: 'item-1', listingId: 'lst-1', title: 'Jacket', quantity: 1, unitPriceCents: 7500 },
    ]) as never);
    mockSelect.mockReturnValueOnce(makeChain([
      { listingId: 'lst-1', url: 'https://cdn.example.com/jacket.jpg' },
    ]) as never);

    const result = await getOrderItems(ORDER_ID);
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe('Jacket');
    expect(result[0]!.imageUrl).toBe('https://cdn.example.com/jacket.jpg');
  });

  it('sets imageUrl to null when no primary image exists', async () => {
    mockSelect.mockReturnValueOnce(makeChain([
      { id: 'item-1', listingId: 'lst-no-img', title: 'Rare Find', quantity: 1, unitPriceCents: 2000 },
    ]) as never);
    mockSelect.mockReturnValueOnce(makeChain([]) as never);

    const result = await getOrderItems(ORDER_ID);
    expect(result[0]!.imageUrl).toBeNull();
  });
});
