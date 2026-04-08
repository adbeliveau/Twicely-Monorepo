/**
 * create-order security and correctness tests:
 * - SEC-001: Live price lock (SELECT FOR UPDATE)
 * - Auth offer fee gating (G10.5)
 * Companion to create-order.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
vi.mock('../order-number', () => ({ generateOrderNumber: vi.fn().mockReturnValue('TW-000001') }));
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
vi.mock('../order-gmv', () => ({ getSellerMonthlyGmv: vi.fn().mockResolvedValue(0) }));
vi.mock('../create-quote', () => ({ createCombinedShippingQuoteIfNeeded: vi.fn().mockResolvedValue(null) }));
vi.mock('@twicely/notifications/service', () => ({ notify: vi.fn().mockResolvedValue(undefined) }));

import { createOrdersFromCart } from '../create-order';
import { db } from '@twicely/db';
import { calculateTf } from '../tf-calculator';
import { getAuthOfferConfig } from '@twicely/commerce/auth-offer';

const mockDb = db as { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
const mockCalculateTf = vi.mocked(calculateTf);
const mockGetAuthOfferConfig = vi.mocked(getAuthOfferConfig);

const CART_ID = 'cart-test-001';
const BUYER_ID = 'buyer-test-001';
const SELLER_1 = 'seller-test-001';
const LISTING_1 = 'listing-test-001';

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
    where: vi.fn().mockReturnThis(),
    for: vi.fn().mockResolvedValue(data),
    limit: vi.fn().mockResolvedValue(data),
    then: (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve),
  };
}

const baseCartRow = { id: CART_ID, userId: BUYER_ID, status: 'ACTIVE' };

const mkItem = (price = 2000) => ({
  cartItemId: 'ci-l1', listingId: LISTING_1, quantity: 1, priceCents: price, sellerId: SELLER_1,
});

const mkListing = (price = 2000) => ({
  id: LISTING_1, title: 'Test Listing', status: 'ACTIVE',
  availableQuantity: 10, quantity: 10, shippingCents: 500, priceCents: price, categoryId: null,
});

function makeCapturingTransaction(listings: unknown[]) {
  const captures: unknown[] = [];
  const txMock = vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    let insertCallCount = 0;
    const tx = {
      select: vi.fn()
        .mockReturnValueOnce(makeTxSelectChain(listings))
        .mockReturnValue(makeTxSelectChain([])),
      insert: vi.fn().mockImplementation(() => {
        const idx = insertCallCount++;
        return {
          values: vi.fn().mockImplementation((vals: unknown) => {
            if (idx === 0) captures.push(vals);
            return { returning: vi.fn().mockResolvedValue([{ id: 'o-1', orderNumber: 'TW-000001' }]) };
          }),
        };
      }),
    };
    return callback(tx);
  });
  return { txMock, captures };
}

function setupOuterSelects(items: unknown[]) {
  mockDb.select = vi.fn()
    .mockReturnValueOnce(makeSelectChain([baseCartRow]))
    .mockReturnValueOnce(makeSelectChain(items))
    .mockReturnValueOnce(makeSelectChain([]))  // sellerProfiles
    .mockReturnValueOnce(makeSelectChain([]))  // shippingProfiles
    .mockReturnValue(makeSelectChain([]));     // GMV
}

describe('createOrdersFromCart — security and price correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculateTf.mockReturnValue({ effectiveRateBps: 1000, tfCents: 100, bracketBreakdown: [] });
    mockGetAuthOfferConfig.mockResolvedValue({ thresholdCents: 50000, buyerFeeCents: 1999 });
  });

  it('SEC-001: uses live priceCents from locked listing, ignoring stale cart price', async () => {
    // Cart has stale price 2000, listing's live price is 2500
    setupOuterSelects([mkItem(2000)]);
    const { txMock, captures } = makeCapturingTransaction([mkListing(2500)]);
    mockDb.transaction = txMock;

    await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });

    // totalCents = live price (2500) + shipping (500) = 3000 (not stale 2000+500=2500)
    const orderInsert = captures[0] as { totalCents: number; itemSubtotalCents: number };
    expect(orderInsert?.totalCents).toBe(3000);
    expect(orderInsert?.itemSubtotalCents).toBe(2500);
  });

  it('SELECT FOR UPDATE lock is held on listings during transaction', async () => {
    setupOuterSelects([mkItem()]);

    let forUpdateCalled = false;
    mockDb.transaction = vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const whereChain = {
        for: vi.fn().mockImplementation(() => {
          forUpdateCalled = true;
          return Promise.resolve([mkListing()]);
        }),
        limit: vi.fn().mockResolvedValue([]),
      };
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue(whereChain) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'o-1', orderNumber: 'TW-000001' }]),
          }),
        }),
      };
      return callback(tx);
    });

    await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
    });

    expect(forUpdateCalled).toBe(true);
  });

  it('G10.5: auth fee added when authenticationRequested=true and item >= $500', async () => {
    // $500.01 item qualifies (threshold: $500.00)
    setupOuterSelects([mkItem(50001)]);
    const { txMock, captures } = makeCapturingTransaction([mkListing(50001)]);
    mockDb.transaction = txMock;

    await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
      authenticationRequested: true,
    });

    // totalCents = price (50001) + shipping (500) + authFee (1999) = 52500
    const orderInsert = captures[0] as { totalCents: number };
    expect(orderInsert?.totalCents).toBe(52500);
  });

  it('G10.5: no auth fee when item price is below $500 threshold', async () => {
    // $100 item does not qualify
    setupOuterSelects([mkItem(10000)]);
    const { txMock, captures } = makeCapturingTransaction([mkListing(10000)]);
    mockDb.transaction = txMock;

    await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
      authenticationRequested: true,
    });

    // totalCents = price (10000) + shipping (500), NO auth fee
    const orderInsert = captures[0] as { totalCents: number };
    expect(orderInsert?.totalCents).toBe(10500);
  });

  it('G10.5: no auth fee when authenticationRequested=false even for qualifying item', async () => {
    setupOuterSelects([mkItem(50001)]);
    const { txMock, captures } = makeCapturingTransaction([mkListing(50001)]);
    mockDb.transaction = txMock;

    await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
      authenticationRequested: false,
    });

    // totalCents = price (50001) + shipping (500), auth declined = no fee
    const orderInsert = captures[0] as { totalCents: number };
    expect(orderInsert?.totalCents).toBe(50501);
  });

  it('authenticationOffered=true when authenticationRequested is defined', async () => {
    setupOuterSelects([mkItem(50001)]);
    const { txMock, captures } = makeCapturingTransaction([mkListing(50001)]);
    mockDb.transaction = txMock;

    await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
      authenticationRequested: true,
    });

    const orderInsert = captures[0] as { authenticationOffered: boolean; authenticationDeclined: boolean };
    expect(orderInsert?.authenticationOffered).toBe(true);
    expect(orderInsert?.authenticationDeclined).toBe(false);
  });

  it('authenticationDeclined=true when authenticationRequested=false', async () => {
    setupOuterSelects([mkItem(50001)]);
    const { txMock, captures } = makeCapturingTransaction([mkListing(50001)]);
    mockDb.transaction = txMock;

    await createOrdersFromCart({
      userId: BUYER_ID, cartId: CART_ID,
      shippingAddress: { line1: '1 St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
      authenticationRequested: false,
    });

    const orderInsert = captures[0] as { authenticationOffered: boolean; authenticationDeclined: boolean };
    expect(orderInsert?.authenticationOffered).toBe(true);
    expect(orderInsert?.authenticationDeclined).toBe(true);
  });
});
