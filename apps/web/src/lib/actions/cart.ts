'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { cart, cartItem, listing } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkListingAvailability } from '@twicely/commerce/availability';
import { isBuyerBlocked } from '@/lib/queries/buyer-block';
import { updateEngagement } from '@/lib/actions/browsing-history-helpers';
import { addToCartSchema, removeFromCartSchema, updateCartQuantitySchema } from '@/lib/validations/cart';
import { authorize } from '@twicely/casl';
import { getOrCreateCart, recalculateCartTotals } from './cart-helpers';

interface AddToCartResult {
  success: boolean;
  cartItemCount?: number;
  error?: string;
}

interface CartActionResult {
  success: boolean;
  error?: string;
}

/**
 * Add an item to the cart.
 */
export async function addToCart(
  listingId: string,
  quantity: number = 1
): Promise<AddToCartResult> {
  const { session, ability } = await authorize();
  const userId = session?.userId ?? null;
  if (!userId) {
    return { success: false, error: 'Please sign in to add items to your cart' };
  }

  if (!ability.can('update', 'Cart')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = addToCartSchema.safeParse({ listingId, quantity });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Check availability
  const availability = await checkListingAvailability(listingId, quantity);
  if (!availability.available) {
    const messages: Record<string, string> = {
      NOT_FOUND: 'This item is no longer available',
      SOLD: 'This item has been sold',
      PAUSED: 'This item is currently unavailable',
      ENDED: 'This listing has ended',
      REMOVED: 'This item is no longer available',
      INSUFFICIENT_QUANTITY: `Only ${availability.availableQuantity ?? 0} available`,
      SELLER_ON_VACATION: 'The seller is currently on vacation',
    };
    return { success: false, error: messages[availability.reason!] ?? 'Item unavailable' };
  }

  // Get listing details
  const [listingRow] = await db
    .select({
      id: listing.id,
      ownerUserId: listing.ownerUserId,
      priceCents: listing.priceCents,
    })
    .from(listing)
    .where(eq(listing.id, listingId))
    .limit(1);

  if (!listingRow || !listingRow.priceCents) {
    return { success: false, error: 'Item not found' };
  }

  // Cannot buy your own listing
  if (listingRow.ownerUserId === userId) {
    return { success: false, error: 'You cannot buy your own listing' };
  }

  // Check if buyer is blocked by seller (C1.6)
  if (await isBuyerBlocked(listingRow.ownerUserId, userId)) {
    return { success: false, error: 'Unable to add this item to your cart' };
  }

  // Get or create cart
  const cartId = await getOrCreateCart(userId);

  // Check if item already in cart
  const [existingItem] = await db
    .select({
      id: cartItem.id,
      quantity: cartItem.quantity,
    })
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.listingId, listingId)))
    .limit(1);

  if (existingItem) {
    // Update quantity
    const newQuantity = existingItem.quantity + quantity;
    const maxQuantity = availability.availableQuantity ?? 1;

    if (newQuantity > maxQuantity) {
      return {
        success: false,
        error: `You can only add ${maxQuantity - existingItem.quantity} more of this item`,
      };
    }

    await db
      .update(cartItem)
      .set({
        quantity: newQuantity,
        updatedAt: new Date(),
      })
      .where(eq(cartItem.id, existingItem.id));
  } else {
    // Insert new cart item
    await db.insert(cartItem).values({
      cartId,
      listingId,
      quantity,
      priceCents: listingRow.priceCents,
      sellerId: listingRow.ownerUserId,
      isAvailable: true,
    });
  }

  // Recalculate cart totals
  const totals = await recalculateCartTotals(cartId);

  // Track engagement (fire-and-forget)
  updateEngagement(userId, listingId, 'cart').catch(() => {});

  revalidatePath('/cart');

  return {
    success: true,
    cartItemCount: totals.itemCount,
  };
}

/**
 * Remove an item from the cart.
 */
export async function removeFromCart(cartItemId: string): Promise<CartActionResult> {
  const { session, ability } = await authorize();
  const userId = session?.userId ?? null;
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'Cart')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = removeFromCartSchema.safeParse({ cartItemId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // Verify ownership: cartItem -> cart -> userId must match
  const [item] = await db
    .select({
      id: cartItem.id,
      cartId: cartItem.cartId,
      cartUserId: cart.userId,
    })
    .from(cartItem)
    .innerJoin(cart, eq(cart.id, cartItem.cartId))
    .where(eq(cartItem.id, cartItemId))
    .limit(1);

  if (!item || item.cartUserId !== userId) {
    return { success: false, error: 'Item not found' };
  }

  // Delete the item
  await db.delete(cartItem).where(eq(cartItem.id, cartItemId));

  // Recalculate totals
  await recalculateCartTotals(item.cartId);

  revalidatePath('/cart');

  return { success: true };
}

/**
 * Update cart item quantity.
 */
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<CartActionResult> {
  const { session, ability } = await authorize();
  const userId = session?.userId ?? null;
  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!ability.can('update', 'Cart')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = updateCartQuantitySchema.safeParse({ cartItemId, quantity });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // If quantity is 0 or less, remove the item
  if (quantity <= 0) {
    return removeFromCart(cartItemId);
  }

  // Verify ownership
  const [item] = await db
    .select({
      id: cartItem.id,
      cartId: cartItem.cartId,
      listingId: cartItem.listingId,
      cartUserId: cart.userId,
    })
    .from(cartItem)
    .innerJoin(cart, eq(cart.id, cartItem.cartId))
    .where(eq(cartItem.id, cartItemId))
    .limit(1);

  if (!item || item.cartUserId !== userId) {
    return { success: false, error: 'Item not found' };
  }

  // Check availability for new quantity
  const availability = await checkListingAvailability(item.listingId, quantity);
  if (!availability.available) {
    if (availability.reason === 'INSUFFICIENT_QUANTITY') {
      return {
        success: false,
        error: `Only ${availability.availableQuantity ?? 0} available`,
      };
    }
    return { success: false, error: 'This item is no longer available' };
  }

  // Update quantity
  await db
    .update(cartItem)
    .set({
      quantity,
      isAvailable: true,
      unavailableReason: null,
      updatedAt: new Date(),
    })
    .where(eq(cartItem.id, cartItemId));

  // Recalculate totals
  await recalculateCartTotals(item.cartId);

  revalidatePath('/cart');

  return { success: true };
}
