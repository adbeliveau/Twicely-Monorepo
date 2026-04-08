import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  cart: { id: 'id', userId: 'user_id', status: 'status' },
  cartItem: { id: 'id', cartId: 'cart_id', listingId: 'listing_id', quantity: 'quantity', priceCents: 'price_cents', isSavedForLater: 'is_saved_for_later' },
  listing: { id: 'id', title: 'title', freeShipping: 'free_shipping', status: 'status' },
  listingImage: { listingId: 'listing_id', url: 'url', isPrimary: 'is_primary' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
}));

import { getCartForCheckout } from '../cart-checkout';
import { db } from '@twicely/db';

const mockSelect = vi.mocked(db.select);

const CART_ID = 'cart-test-001';
const USER_ID = 'user-test-001';
const LISTING_ID = 'listing-test-001';
const CART_ITEM_ID = 'item-test-001';

function makeSelectChain(data: unknown) {
  const chain: Record<string, unknown> = {};
  chain['from'] = vi.fn().mockReturnValue(chain);
  chain['innerJoin'] = vi.fn().mockReturnValue(chain);
  // where must be both chainable (for .limit) and thenable (for direct await)
  chain['where'] = vi.fn().mockReturnValue(chain);
  chain['limit'] = vi.fn().mockResolvedValue(data);
  // thenable: when chain itself is awaited (query ends at .where())
  chain['then'] = (resolve: (val: unknown) => void) => Promise.resolve(data).then(resolve);
  return chain;
}

describe('getCartForCheckout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no active cart exists', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]) as never);
    const result = await getCartForCheckout(USER_ID);
    expect(result).toBeNull();
  });

  it('returns null when cart has no active items', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartForCheckout(USER_ID);
    expect(result).toBeNull();
  });

  it('returns checkout data with only ACTIVE items', async () => {
    const activeItem = {
      cartItemId: CART_ITEM_ID,
      listingId: LISTING_ID,
      quantity: 1,
      priceCents: 2500,
      title: 'Cool Jacket',
      freeShipping: false,
      status: 'ACTIVE',
    };
    const unavailableItem = {
      cartItemId: 'item-2',
      listingId: 'listing-2',
      quantity: 1,
      priceCents: 1000,
      title: 'Sold Item',
      freeShipping: true,
      status: 'SOLD',
    };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([activeItem, unavailableItem]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartForCheckout(USER_ID);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0]!.title).toBe('Cool Jacket');
    expect(result!.hasUnavailableItems).toBe(true);
  });

  it('calculates subtotal in integer cents from active items only', async () => {
    const item1 = {
      cartItemId: 'ci-1', listingId: 'l-1', quantity: 2,
      priceCents: 1500, title: 'Item A', freeShipping: false, status: 'ACTIVE',
    };
    const item2 = {
      cartItemId: 'ci-2', listingId: 'l-2', quantity: 1,
      priceCents: 3000, title: 'Item B', freeShipping: true, status: 'ACTIVE',
    };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([item1, item2]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartForCheckout(USER_ID);
    // subtotal = (1500 * 2) + (3000 * 1) = 3000 + 3000 = 6000
    expect(result!.subtotalCents).toBe(6000);
    expect(result!.cartId).toBe(CART_ID);
  });

  it('sets allItemsFreeShipping true only when ALL active items have freeShipping', async () => {
    const freeItem1 = {
      cartItemId: 'ci-1', listingId: 'l-1', quantity: 1,
      priceCents: 2000, title: 'Free Ship 1', freeShipping: true, status: 'ACTIVE',
    };
    const freeItem2 = {
      cartItemId: 'ci-2', listingId: 'l-2', quantity: 1,
      priceCents: 3000, title: 'Free Ship 2', freeShipping: true, status: 'ACTIVE',
    };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([freeItem1, freeItem2]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartForCheckout(USER_ID);
    expect(result!.allItemsFreeShipping).toBe(true);
  });

  it('sets allItemsFreeShipping false when any item has paid shipping', async () => {
    const freeItem = {
      cartItemId: 'ci-1', listingId: 'l-1', quantity: 1,
      priceCents: 2000, title: 'Free Ship', freeShipping: true, status: 'ACTIVE',
    };
    const paidItem = {
      cartItemId: 'ci-2', listingId: 'l-2', quantity: 1,
      priceCents: 3000, title: 'Paid Ship', freeShipping: false, status: 'ACTIVE',
    };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([freeItem, paidItem]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartForCheckout(USER_ID);
    expect(result!.allItemsFreeShipping).toBe(false);
  });

  it('includes image URLs when found', async () => {
    const item = {
      cartItemId: CART_ITEM_ID, listingId: LISTING_ID, quantity: 1,
      priceCents: 2000, title: 'With Image', freeShipping: false, status: 'ACTIVE',
    };
    const image = { listingId: LISTING_ID, url: 'https://cdn.example.com/image.jpg' };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([item]) as never)
      .mockReturnValueOnce(makeSelectChain([image]) as never);

    const result = await getCartForCheckout(USER_ID);
    expect(result!.items[0]!.imageUrl).toBe('https://cdn.example.com/image.jpg');
  });

  it('sets imageUrl to null when no primary image found', async () => {
    const item = {
      cartItemId: CART_ITEM_ID, listingId: LISTING_ID, quantity: 1,
      priceCents: 2000, title: 'No Image', freeShipping: false, status: 'ACTIVE',
    };

    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ id: CART_ID }]) as never)
      .mockReturnValueOnce(makeSelectChain([item]) as never)
      .mockReturnValueOnce(makeSelectChain([]) as never);

    const result = await getCartForCheckout(USER_ID);
    expect(result!.items[0]!.imageUrl).toBeNull();
  });
});
