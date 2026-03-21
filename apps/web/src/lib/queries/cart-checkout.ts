import { db } from '@twicely/db';
import { cart, cartItem, listing, listingImage } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Get cart data for checkout page with availability checks.
 */
export async function getCartForCheckout(userId: string) {
  // Get active cart
  const [activeCart] = await db
    .select({ id: cart.id })
    .from(cart)
    .where(and(eq(cart.userId, userId), eq(cart.status, 'ACTIVE')))
    .limit(1);

  if (!activeCart) {
    return null;
  }

  // Get cart items with listing info
  const items = await db
    .select({
      cartItemId: cartItem.id,
      listingId: cartItem.listingId,
      quantity: cartItem.quantity,
      priceCents: cartItem.priceCents,
      title: listing.title,
      freeShipping: listing.freeShipping,
      status: listing.status,
    })
    .from(cartItem)
    .innerJoin(listing, eq(cartItem.listingId, listing.id))
    .where(eq(cartItem.cartId, activeCart.id));

  if (items.length === 0) {
    return null;
  }

  // Get listing IDs for image query
  const listingIds = items.map((item) => item.listingId);

  // Get primary images for items (filtered by listingIds)
  const images = await db
    .select({
      listingId: listingImage.listingId,
      url: listingImage.url,
    })
    .from(listingImage)
    .where(and(eq(listingImage.isPrimary, true), inArray(listingImage.listingId, listingIds)));

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  // Check availability and calculate totals
  let subtotalCents = 0;
  let allItemsFreeShipping = true;
  const hasUnavailableItems = items.some((item) => item.status !== 'ACTIVE');

  const orderItems = items
    .filter((item) => item.status === 'ACTIVE')
    .map((item) => {
      subtotalCents += item.priceCents * item.quantity;
      if (!item.freeShipping) {
        allItemsFreeShipping = false;
      }
      return {
        id: item.cartItemId,
        title: item.title ?? 'Untitled',
        quantity: item.quantity,
        priceCents: item.priceCents,
        imageUrl: imageMap.get(item.listingId) ?? null,
      };
    });

  return {
    cartId: activeCart.id,
    items: orderItems,
    subtotalCents,
    allItemsFreeShipping,
    hasUnavailableItems,
  };
}
