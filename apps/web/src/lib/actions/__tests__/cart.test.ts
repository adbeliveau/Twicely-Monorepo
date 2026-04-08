import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((type: string, obj: Record<string, unknown>) => ({ __caslSubjectType__: type, ...obj })),
}));
vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@twicely/db/schema', () => ({
  cart: { id: 'id', userId: 'user_id', status: 'status', itemCount: 'item_count', subtotalCents: 'subtotal_cents' },
  cartItem: { id: 'id', cartId: 'cart_id', listingId: 'listing_id', quantity: 'quantity', priceCents: 'price_cents', sellerId: 'seller_id', isSavedForLater: 'is_saved_for_later', isAvailable: 'is_available', unavailableReason: 'unavailable_reason', updatedAt: 'updated_at' },
  listing: { id: 'id', ownerUserId: 'owner_user_id', priceCents: 'price_cents' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  inArray: vi.fn((col, vals) => ({ type: 'inArray', col, vals })),
}));
vi.mock('@twicely/commerce/availability', () => ({
  checkListingAvailability: vi.fn(),
}));
vi.mock('@/lib/queries/buyer-block', () => ({
  isBuyerBlocked: vi.fn(),
}));
vi.mock('@/lib/actions/browsing-history-helpers', () => ({
  updateEngagement: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/actions/cart-helpers', () => ({
  getOrCreateCart: vi.fn(),
  recalculateCartTotals: vi.fn(),
}));

import { addToCart, removeFromCart, updateCartItemQuantity } from '../cart';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { checkListingAvailability } from '@twicely/commerce/availability';
import { isBuyerBlocked } from '@/lib/queries/buyer-block';
import { getOrCreateCart, recalculateCartTotals } from '@/lib/actions/cart-helpers';

const mockAuthorize = vi.mocked(authorize);
const mockCheckAvailability = vi.mocked(checkListingAvailability);
const mockIsBuyerBlocked = vi.mocked(isBuyerBlocked);
const mockGetOrCreateCart = vi.mocked(getOrCreateCart);
const mockRecalculate = vi.mocked(recalculateCartTotals);
const mockSelect = vi.mocked(db.select);
const mockInsert = vi.mocked(db.insert);
const mockUpdate = vi.mocked(db.update);
const mockDelete = vi.mocked(db.delete);

// Valid CUID2 IDs
const LISTING_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k';
const CART_ITEM_ID = 'cm2a2b3c4d5e6f7g8h9i0j1k';
const CART_ID = 'cm3a2b3c4d5e6f7g8h9i0j1k';
const USER_ID = 'user-test-001';
const SELLER_ID = 'seller-test-001';

function makeSelectChain(data: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(data),
    offset: vi.fn().mockReturnThis(),
  };
}

function makeAuthSession(userId = USER_ID, canUpdate = true) {
  return {
    ability: { can: vi.fn().mockReturnValue(canUpdate) } as never,
    session: { userId } as never,
  };
}

describe('addToCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue(makeAuthSession());
    mockCheckAvailability.mockResolvedValue({ available: true, availableQuantity: 5 });
    mockIsBuyerBlocked.mockResolvedValue(false);
    mockGetOrCreateCart.mockResolvedValue(CART_ID);
    mockRecalculate.mockResolvedValue({ itemCount: 1, subtotalCents: 2000 });
  });

  it('returns error when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: null });
    const result = await addToCart(LISTING_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sign in/i);
  });

  it('returns error when CASL forbids Cart update', async () => {
    mockAuthorize.mockResolvedValue(makeAuthSession(USER_ID, false));
    const result = await addToCart(LISTING_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authorized/i);
  });

  it('returns error for invalid listingId (not CUID2)', async () => {
    const result = await addToCart('not-a-valid-cuid2');
    expect(result.success).toBe(false);
  });

  it('returns SOLD error when listing is sold', async () => {
    mockCheckAvailability.mockResolvedValue({ available: false, reason: 'SOLD' });
    mockSelect.mockReturnValue(makeSelectChain([{ id: LISTING_ID, ownerUserId: SELLER_ID, priceCents: 2000 }]) as never);
    const result = await addToCart(LISTING_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sold/i);
  });

  it('returns INSUFFICIENT_QUANTITY error when quantity exceeds stock', async () => {
    mockCheckAvailability.mockResolvedValue({ available: false, reason: 'INSUFFICIENT_QUANTITY', availableQuantity: 2 });
    const result = await addToCart(LISTING_ID, 5);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/2/);
  });

  it('returns error when listing not found after availability check', async () => {
    mockCheckAvailability.mockResolvedValue({ available: true, availableQuantity: 5 });
    mockSelect.mockReturnValue(makeSelectChain([]) as never);
    const result = await addToCart(LISTING_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error when buyer tries to add own listing', async () => {
    mockCheckAvailability.mockResolvedValue({ available: true, availableQuantity: 5 });
    mockSelect.mockReturnValue(makeSelectChain([{ id: LISTING_ID, ownerUserId: USER_ID, priceCents: 2000 }]) as never);
    const result = await addToCart(LISTING_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot buy your own/i);
  });

  it('returns error when buyer is blocked by seller', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ id: LISTING_ID, ownerUserId: SELLER_ID, priceCents: 2000 }]) as never);
    mockIsBuyerBlocked.mockResolvedValue(true);
    const result = await addToCart(LISTING_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unable to add/i);
  });

  it('inserts new cart item and returns itemCount on happy path', async () => {
    // First select: listing details; second select: existing item check (empty)
    const listingChain = makeSelectChain([{ id: LISTING_ID, ownerUserId: SELLER_ID, priceCents: 2000 }]);
    const existingItemChain = makeSelectChain([]);
    mockSelect
      .mockReturnValueOnce(listingChain as never)
      .mockReturnValueOnce(existingItemChain as never);
    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) } as never);

    const result = await addToCart(LISTING_ID, 1);
    expect(result.success).toBe(true);
    expect(result.cartItemCount).toBe(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('increments quantity instead of inserting duplicate when item already in cart', async () => {
    const listingChain = makeSelectChain([{ id: LISTING_ID, ownerUserId: SELLER_ID, priceCents: 2000 }]);
    const existingItemChain = makeSelectChain([{ id: CART_ITEM_ID, quantity: 2 }]);
    mockCheckAvailability.mockResolvedValue({ available: true, availableQuantity: 10 });
    mockSelect
      .mockReturnValueOnce(listingChain as never)
      .mockReturnValueOnce(existingItemChain as never);
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);

    const result = await addToCart(LISTING_ID, 1);
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns error when combined quantity would exceed availableQuantity', async () => {
    const listingChain = makeSelectChain([{ id: LISTING_ID, ownerUserId: SELLER_ID, priceCents: 2000 }]);
    const existingItemChain = makeSelectChain([{ id: CART_ITEM_ID, quantity: 4 }]);
    mockCheckAvailability.mockResolvedValue({ available: true, availableQuantity: 5 });
    mockSelect
      .mockReturnValueOnce(listingChain as never)
      .mockReturnValueOnce(existingItemChain as never);

    const result = await addToCart(LISTING_ID, 3); // 4 + 3 = 7 > 5
    expect(result.success).toBe(false);
    expect(result.error).toContain('1'); // can only add 1 more
  });
});

describe('removeFromCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue(makeAuthSession());
    mockRecalculate.mockResolvedValue({ itemCount: 0, subtotalCents: 0 });
  });

  it('returns error when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: null });
    const result = await removeFromCart(CART_ITEM_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it('returns error when CASL forbids Cart update', async () => {
    mockAuthorize.mockResolvedValue(makeAuthSession(USER_ID, false));
    const result = await removeFromCart(CART_ITEM_ID);
    expect(result.success).toBe(false);
  });

  it('returns error when cartItemId is not CUID2', async () => {
    const result = await removeFromCart('bad-id');
    expect(result.success).toBe(false);
  });

  it('returns error when item not found or not owned', async () => {
    // Cart belongs to other user
    mockSelect.mockReturnValue(makeSelectChain([{ id: CART_ITEM_ID, cartId: CART_ID, cartUserId: 'other-user' }]) as never);
    const result = await removeFromCart(CART_ITEM_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error when item does not exist', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]) as never);
    const result = await removeFromCart(CART_ITEM_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('deletes item and recalculates totals on happy path', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ id: CART_ITEM_ID, cartId: CART_ID, cartUserId: USER_ID }]) as never);
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    const result = await removeFromCart(CART_ITEM_ID);
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockRecalculate).toHaveBeenCalledWith(CART_ID);
  });
});

describe('updateCartItemQuantity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorize.mockResolvedValue(makeAuthSession());
    mockCheckAvailability.mockResolvedValue({ available: true, availableQuantity: 10 });
    mockRecalculate.mockResolvedValue({ itemCount: 2, subtotalCents: 4000 });
  });

  it('returns error when unauthenticated', async () => {
    mockAuthorize.mockResolvedValue({ ability: { can: vi.fn(() => true) } as never, session: null });
    const result = await updateCartItemQuantity(CART_ITEM_ID, 2);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it('delegates to removeFromCart when quantity is 0', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ id: CART_ITEM_ID, cartId: CART_ID, cartUserId: USER_ID }]) as never);
    mockDelete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) } as never);

    const result = await updateCartItemQuantity(CART_ITEM_ID, 0);
    // removeFromCart path is taken when quantity <= 0
    expect(result.success).toBe(true);
  });

  it('returns INSUFFICIENT_QUANTITY error when new quantity exceeds stock', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ id: CART_ITEM_ID, cartId: CART_ID, listingId: LISTING_ID, cartUserId: USER_ID }]) as never);
    mockCheckAvailability.mockResolvedValue({ available: false, reason: 'INSUFFICIENT_QUANTITY', availableQuantity: 3 });

    const result = await updateCartItemQuantity(CART_ITEM_ID, 5);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/3/);
  });

  it('returns error when listing is no longer available', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ id: CART_ITEM_ID, cartId: CART_ID, listingId: LISTING_ID, cartUserId: USER_ID }]) as never);
    mockCheckAvailability.mockResolvedValue({ available: false, reason: 'SOLD' });

    const result = await updateCartItemQuantity(CART_ITEM_ID, 2);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer available/i);
  });

  it('updates quantity and recalculates totals on happy path', async () => {
    mockSelect.mockReturnValue(makeSelectChain([{ id: CART_ITEM_ID, cartId: CART_ID, listingId: LISTING_ID, cartUserId: USER_ID }]) as never);
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) } as never);

    const result = await updateCartItemQuantity(CART_ITEM_ID, 3);
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockRecalculate).toHaveBeenCalledTimes(1);
  });
});
