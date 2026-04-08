import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mocks declared before imports (hoisted)
vi.mock('@twicely/db', () => ({ db: { select: vi.fn(), insert: vi.fn(), transaction: vi.fn() } }));
vi.mock('@twicely/db/schema', () => ({
  order: { id: 'id', orderNumber: 'order_number', buyerId: 'buyer_id', sellerId: 'seller_id' },
  orderItem: { id: 'id', orderId: 'order_id' },
  cart: { id: 'id', userId: 'user_id', status: 'status' },
  cartItem: { id: 'id', cartId: 'cart_id', isSavedForLater: 'is_saved_for_later', listingId: 'listing_id', quantity: 'quantity', priceCents: 'price_cents', sellerId: 'seller_id' },
  listing: { id: 'id', title: 'title', status: 'status', availableQuantity: 'available_quantity', quantity: 'quantity', shippingCents: 'shipping_cents', priceCents: 'price_cents', categoryId: 'category_id' },
  category: { id: 'id', feeBucket: 'fee_bucket' },
  sellerProfile: { userId: 'user_id', handlingTimeDays: 'handling_time_days' },
  shippingProfile: { userId: 'user_id', combinedShippingMode: 'combined_shipping_mode', flatCombinedCents: 'flat_combined_cents', additionalItemCents: 'additional_item_cents', autoDiscountPercent: 'auto_discount_percent', autoDiscountMinItems: 'auto_discount_min_items', isDefault: 'is_default' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
}));
vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback)),
}));
vi.mock('../order-number', () => ({
  generateOrderNumber: vi.fn().mockReturnValue('TW-000001'),
}));
vi.mock('../tf-calculator', () => ({
  calculateTf: vi.fn().mockReturnValue({ effectiveRateBps: 1000, tfCents: 100, bracketBreakdown: [] }),
  getTfBrackets: vi.fn().mockResolvedValue([{ maxCents: 49900, rateBps: 1000 }, { maxCents: null, rateBps: 1000 }]),
  getMinimumTfCents: vi.fn().mockResolvedValue(50),
}));
vi.mock('../combined-shipping', () => ({
  calculateCombinedShipping: vi.fn().mockReturnValue({ totalShippingCents: 500, savingsCents: 0, mode: 'NONE' }),
}));
vi.mock('@twicely/commerce/auth-offer', () => ({
  getAuthOfferConfig: vi.fn().mockResolvedValue({ thresholdCents: 50000, buyerFeeCents: 1999 }),
}));
vi.mock('../order-gmv', () => ({
  getSellerMonthlyGmv: vi.fn().mockResolvedValue(0),
}));
vi.mock('../create-quote', () => ({
  createCombinedShippingQuoteIfNeeded: vi.fn().mockResolvedValue(null),
}));
vi.mock('@twicely/notifications/service', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

import { createOrdersFromCart } from '../create-order';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';
import { calculateTf } from '../tf-calculator';

const mockDb = db as { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockCalculateTf = vi.mocked(calculateTf);

const CART_ID = 'cart-test-001';
const BUYER_ID = 'buyer-test-001';
const SELLER_1 = 'seller-test-001';
const SELLER_2 = 'seller-test-002';
const LISTING_1 = 'listing-test-001';
const LISTING_2 = 'listing-test-002';
const LISTING_3 = 'listing-test-003';

function makeSelectChain(data: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
    then: (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve),
  };
}

function makeTxSelectChain(data: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    for: vi.fn().mockResolvedValue(data),
    limit: vi.fn().mockResolvedValue(data),
    then: (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve),
  };
}

const baseCartRow = { id: CART_ID, userId: BUYER_ID, status: 'ACTIVE' };

const baseCartItem = (sellerId: string, listingId: string, price = 2000) => ({
  cartItemId: 'ci-' + listingId, listingId, quantity: 1, priceCents: price, sellerId,
});

const baseListing = (id: string, price = 2000) => ({
  id, title: 'Test Listing', status: 'ACTIVE',
  availableQuantity: 10, quantity: 10, shippingCents: 500,
  priceCents: price, categoryId: null,
});

function makeTransactionMock(listings: unknown[]) {
  return vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(makeTxSelectChain(listings))
        .mockReturnValue(makeTxSelectChain([])),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'order-1', orderNumber: 'TW-000001' }]),
        }),
      }),
    };
    return callback(tx);
  });
}

describe('createOrdersFromCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockImplementation((_key: string, fallback: unknown) => Promise.resolve(fallback));
    mockCalculateTf.mockReturnValue({ effectiveRateBps: 1000, tfCents: 100, bracketBreakdown: [] });
  });

  it('returns error when cart not found', async () => {
    mockDb.select = vi.fn().mockReturnValue(makeSelectChain([]));
    const result = await createOrdersFromCart({
      userId: BUYER_ID, cartId: 'missing-cart',
      shippingAddress: { line1: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.success).toBe(false);
    expect(result[0]!.error).toMatch(/cart not found/i);
  });

  it('returns error when cart belongs to a different user', async () => {
    mockDb.select = vi.fn().mockReturnValue(
      makeSelectChain([{ id: CART_ID, userId: 'other-buyer', status: 'ACTIVE' }])
    );
    const result = await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });
    expect(result[0]!.success).toBe(false);
    expect(result[0]!.error).toMatch(/cart not found/i);
  });

  it('returns error when cart is empty', async () => {
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([baseCartRow]))
      .mockReturnValueOnce(makeSelectChain([]));
    const result = await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });
    expect(result[0]!.success).toBe(false);
    expect(result[0]!.error).toMatch(/empty/i);
  });

  it('enforces maxItemsPerOrder cap from platform_settings', async () => {
    mockGetPlatformSetting.mockImplementation(async (key: string, fallback: unknown) => {
      if (key === 'commerce.order.maxItemsPerOrder') return 2;
      return fallback;
    });
    const threeItems = [
      baseCartItem(SELLER_1, LISTING_1),
      baseCartItem(SELLER_1, LISTING_2),
      baseCartItem(SELLER_1, LISTING_3),
    ];
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([baseCartRow]))
      .mockReturnValueOnce(makeSelectChain(threeItems))
      .mockReturnValue(makeSelectChain([]));
    const result = await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });
    expect(result[0]!.success).toBe(false);
    expect(result[0]!.error).toContain('2');
  });

  it('creates one order for a single-seller cart', async () => {
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([baseCartRow]))
      .mockReturnValueOnce(makeSelectChain([baseCartItem(SELLER_1, LISTING_1)]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]));
    mockDb.transaction = makeTransactionMock([baseListing(LISTING_1)]);
    const result = await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.success).toBe(true);
    expect(result[0]!.orderNumber).toBe('TW-000001');
  });

  it('creates one order per seller for a multi-seller cart', async () => {
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([baseCartRow]))
      .mockReturnValueOnce(makeSelectChain([
        baseCartItem(SELLER_1, LISTING_1),
        baseCartItem(SELLER_2, LISTING_2, 3000),
      ]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]));
    let txCallCount = 0;
    mockDb.transaction = vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      txCallCount++;
      const listings = txCallCount === 1 ? [baseListing(LISTING_1)] : [baseListing(LISTING_2, 3000)];
      const tx = {
        select: vi.fn()
          .mockReturnValueOnce(makeTxSelectChain(listings))
          .mockReturnValue(makeTxSelectChain([])),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: `o-${txCallCount}`, orderNumber: `TW-00000${txCallCount}` }]),
          }),
        }),
      };
      return callback(tx);
    });
    const result = await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });
    expect(result).toHaveLength(2);
    expect(result.every(r => r.success)).toBe(true);
  });

  it('returns error in results when a listing is SOLD (not ACTIVE)', async () => {
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([baseCartRow]))
      .mockReturnValueOnce(makeSelectChain([baseCartItem(SELLER_1, LISTING_1)]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]));
    mockDb.transaction = makeTransactionMock([{ ...baseListing(LISTING_1), status: 'SOLD' }]);
    const result = await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });
    expect(result[0]!.success).toBe(false);
    expect(result[0]!.error).toMatch(/no longer available/i);
  });
});
