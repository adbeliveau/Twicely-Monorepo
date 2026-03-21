import { db } from '@twicely/db';
import { cart, cartItem } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { authorize } from '@twicely/casl';

/**
 * Get authenticated user ID.
 * Returns null for guest users (guest cart support).
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const { session } = await authorize();
  return session?.userId ?? null;
}

/**
 * Get or create an active cart for the user.
 */
export async function getOrCreateCart(userId: string): Promise<string> {
  // Find existing active cart
  const [existingCart] = await db
    .select({ id: cart.id })
    .from(cart)
    .where(and(eq(cart.userId, userId), eq(cart.status, 'ACTIVE')))
    .limit(1);

  if (existingCart) {
    return existingCart.id;
  }

  // Create new cart
  const [newCart] = await db
    .insert(cart)
    .values({
      userId,
      status: 'ACTIVE',
      itemCount: 0,
      subtotalCents: 0,
    })
    .returning({ id: cart.id });

  return newCart!.id;
}

/**
 * Recalculate cart totals from items.
 */
export async function recalculateCartTotals(cartId: string): Promise<{ itemCount: number; subtotalCents: number }> {
  // Get all non-saved-for-later items
  const items = await db
    .select({
      quantity: cartItem.quantity,
      priceCents: cartItem.priceCents,
    })
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.isSavedForLater, false)));

  let itemCount = 0;
  let subtotalCents = 0;

  for (const item of items) {
    itemCount += item.quantity;
    subtotalCents += item.priceCents * item.quantity;
  }

  await db
    .update(cart)
    .set({
      itemCount,
      subtotalCents,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cart.id, cartId));

  return { itemCount, subtotalCents };
}
