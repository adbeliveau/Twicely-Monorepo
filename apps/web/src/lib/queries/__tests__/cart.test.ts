import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  cart: { id: 'id', userId: 'user_id', status: 'status', itemCount: 'item_count', subtotalCents: 'subtotal_cents' },
  cartItem: { id: 'id', cartId: 'cart_id', listingId: 'listing_id', quantity: 'quantity', priceCents: 'price_cents', sellerId: 'seller_id', isSavedForLater: 'is_saved_for_later', isAvailable: 'is_available', unavailableReason: 'unavailable_reason' },
  listing: { id: 'id', title: 'title', slug: 'slug', status: 'status', availableQuantity: 'available_quantity', freeShipping: 'free_shipping', shippingCents: 'shipping_cents', fulfillmentType: 'fulfillment_type', categoryId: 'category_id' },
  listingImage: { listingId: 'listing_id', url: 'url', isPrimary: 'is_primary' },
  sellerProfile: { userId: 'user_id', storeName: 'store_name', storeSlug: 'store_slug' },
  user: { id: 'id', name: 'name', username: 'username' },
  shippingProfile: { userId: 'user_id', combinedShippingMode: 'combined_shipping_mode', flatCombinedCents: 'flat_combined_cents', additionalItemCents: 'additional_item_cents', autoDiscountPercent: 'auto_discount_percent', autoDiscountMinItems: 'auto_discount_min_items', isDefault: 'is_default' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
}));
vi.mock('@/lib/services/combined-shipping', () => ({
  calculateCombinedShipping: vi.fn(() => ({
    totalShippingCents: 500,
    savingsCents: 0,
    mode: 'NONE',
  })),
}));

import { getCartWithItems, getCartItemCount } from '../cart';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

const CART_ID = 'cart-test-001';
const USER_ID = 'user-test-001';
const SELLER_ID = 'seller-test-001';
const LISTING_ID = 'listing-test-001';
const CART_ITEM_ID = 'item-test-001';

function makeSelectChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['innerJoin'] = vi.fn().mockReturnValue(chain);
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  chain['orderBy'] = vi.fn().mockResolvedValue(data);
  // Direct resolution for queries that await the chain without .limit()
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

describe('getCartWithItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no active cart exists', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]) as never);
    const result = await getCartWithItems(USER_ID);
    expect(result).toBeNull();
  });

  it('returns empty cart when cart has no items', async () => {
    // First select: active cart; second select: items
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID, itemCount: 0, subtotalCents: 0 }]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartWithItems(USER_ID);
    expect(result).not.toBeNull();
    expect(result!.itemCount).toBe(0);
    expect(result!.groups).toHaveLength(0);
    expect(result!.subtotalCents).toBe(0);
  });

  it('marks item unavailable when listing status is not ACTIVE', async () => {
    const baseCart = { id: CART_ID, itemCount: 1, subtotalCents: 2000 };
    const cartItemRow = {
      cartItemId: CART_ITEM_ID, listingId: LISTING_ID, quantity: 1,
      unitPriceCents: 2000, sellerId: SELLER_ID,
      title: 'Test Item', slug: 'test-item',
      status: 'SOLD', // not ACTIVE
      availableQuantity: 0, freeShipping: false,
      listingShippingCents: 500, fulfillmentType: 'SHIP_ONLY', categoryId: null,
    };
    const sellerRow = { odUserId: SELLER_ID, storeName: 'Test Store', storeSlug: 'teststore', userName: 'Test', username: 'testuser' };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([baseCart]) as never)  // cart
      .mockReturnValueOnce(makeSelectChain([cartItemRow]) as never)  // items
      .mockReturnValueOnce(makeSelectChain([]) as never)  // images
      .mockReturnValueOnce(makeSelectChain([sellerRow]) as never)  // sellers
      .mockReturnValueOnce(makeSelectChain([]) as never);  // shipping profiles

    const result = await getCartWithItems(USER_ID);
    expect(result).not.toBeNull();
    expect(result!.groups[0]!.items[0]!.isAvailable).toBe(false);
    expect(result!.groups[0]!.items[0]!.unavailableReason).toBe('SOLD');
  });

  it('marks item unavailable when available quantity is insufficient', async () => {
    const baseCart = { id: CART_ID, itemCount: 1, subtotalCents: 2000 };
    const cartItemRow = {
      cartItemId: CART_ITEM_ID, listingId: LISTING_ID, quantity: 5,
      unitPriceCents: 2000, sellerId: SELLER_ID,
      title: 'Test Item', slug: 'test-item',
      status: 'ACTIVE', availableQuantity: 2, // only 2 available but cart has 5
      freeShipping: false, listingShippingCents: 500,
      fulfillmentType: 'SHIP_ONLY', categoryId: null,
    };
    const sellerRow = { odUserId: SELLER_ID, storeName: 'Test Store', storeSlug: 'teststore', userName: 'Test', username: 'testuser' };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([baseCart]) as never)
      .mockReturnValueOnce(makeSelectChain([cartItemRow]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never)
      .mockReturnValueOnce(makeSelectChain([sellerRow]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartWithItems(USER_ID);
    expect(result!.groups[0]!.items[0]!.isAvailable).toBe(false);
    expect(result!.groups[0]!.items[0]!.unavailableReason).toBe('INSUFFICIENT_QUANTITY');
  });

  it('groups items by seller and calculates subtotal for available items only', async () => {
    const baseCart = { id: CART_ID, itemCount: 2, subtotalCents: 4000 };
    const item1 = {
      cartItemId: 'ci-1', listingId: 'l-1', quantity: 1,
      unitPriceCents: 2000, sellerId: SELLER_ID,
      title: 'Item 1', slug: 'item-1',
      status: 'ACTIVE', availableQuantity: 5,
      freeShipping: false, listingShippingCents: 500,
      fulfillmentType: 'SHIP_ONLY', categoryId: null,
    };
    const item2 = {
      cartItemId: 'ci-2', listingId: 'l-2', quantity: 1,
      unitPriceCents: 3000, sellerId: 'seller-2',
      title: 'Item 2', slug: 'item-2',
      status: 'ACTIVE', availableQuantity: 10,
      freeShipping: false, listingShippingCents: 800,
      fulfillmentType: 'SHIP_ONLY', categoryId: null,
    };
    const sellerRows = [
      { odUserId: SELLER_ID, storeName: 'Store A', storeSlug: 'store-a', userName: 'UserA', username: 'usera' },
      { odUserId: 'seller-2', storeName: 'Store B', storeSlug: 'store-b', userName: 'UserB', username: 'userb' },
    ];

    mockSelect
      .mockReturnValueOnce(makeSelectChain([baseCart]) as never)
      .mockReturnValueOnce(makeSelectChain([item1, item2]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never)
      .mockReturnValueOnce(makeSelectChain(sellerRows) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartWithItems(USER_ID);
    expect(result).not.toBeNull();
    expect(result!.groups).toHaveLength(2);
    expect(result!.itemCount).toBe(2);
    expect(result!.subtotalCents).toBe(5000); // 2000 + 3000
  });

  it('supportsLocalPickup is false when any item does not support local pickup', async () => {
    const baseCart = { id: CART_ID, itemCount: 1, subtotalCents: 2000 };
    const cartItemRow = {
      cartItemId: CART_ITEM_ID, listingId: LISTING_ID, quantity: 1,
      unitPriceCents: 2000, sellerId: SELLER_ID,
      title: 'Ship Only', slug: 'ship-only',
      status: 'ACTIVE', availableQuantity: 5,
      freeShipping: false, listingShippingCents: 500,
      fulfillmentType: 'SHIP_ONLY', categoryId: null,
    };
    const sellerRow = { odUserId: SELLER_ID, storeName: 'Test Store', storeSlug: 'teststore', userName: 'Test', username: 'testuser' };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([baseCart]) as never)
      .mockReturnValueOnce(makeSelectChain([cartItemRow]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never)
      .mockReturnValueOnce(makeSelectChain([sellerRow]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartWithItems(USER_ID);
    expect(result!.supportsLocalPickup).toBe(false);
  });
});

describe('getCartItemCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 when no active cart', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]) as never);
    const result = await getCartItemCount(USER_ID);
    expect(result).toBe(0);
  });

  it('returns item count from active cart', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([{ itemCount: 3 }]) as never);
    const result = await getCartItemCount(USER_ID);
    expect(result).toBe(3);
  });
});
