import { db } from '@twicely/db';
import { cart, cartItem, listing, listingImage, sellerProfile, user, shippingProfile } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { calculateCombinedShipping, type CombinedShippingMode } from '@/lib/services/combined-shipping';

// Re-export checkout query for external consumers
export { getCartForCheckout } from './cart-checkout';

export type FulfillmentType = 'SHIP_ONLY' | 'LOCAL_ONLY' | 'SHIP_AND_LOCAL';

export interface CartItemDetail {
  cartItemId: string;
  listingId: string;
  title: string;
  slug: string;
  quantity: number;
  unitPriceCents: number;
  shippingCents: number;
  freeShipping: boolean;
  primaryImageUrl: string | null;
  isAvailable: boolean;
  unavailableReason: string | null;
  maxQuantity: number;
  /** B3.4: Fulfillment type for local pickup support */
  fulfillmentType: FulfillmentType;
  /** D2.3: Category ID for coupon scope checking */
  categoryId: string | null;
}

export interface SellerGroup {
  sellerId: string;
  sellerName: string;
  /** Store URL slug (username) for linking to /st/[slug] */
  sellerSlug: string;
  items: CartItemDetail[];
  groupSubtotalCents: number;
  groupShippingCents: number;
  /** Combined shipping total (may differ from sum of individual shipping) */
  combinedShippingCents: number;
  /** Savings from combined shipping */
  shippingSavingsCents: number;
  /** Which combined shipping mode is applied */
  combinedShippingMode: CombinedShippingMode;
  /** B3.4: True if ALL items in group support local pickup */
  supportsLocalPickup: boolean;
}

export interface CartWithItems {
  cartId: string;
  itemCount: number;
  subtotalCents: number;
  shippingCents: number;
  /** Total shipping savings from combined shipping */
  totalShippingSavingsCents: number;
  groups: SellerGroup[];
  /** B3.4: True if ALL items from ALL sellers support local pickup */
  supportsLocalPickup: boolean;
}

/**
 * Get cart with all items grouped by seller, including availability re-check.
 */
export async function getCartWithItems(userId: string): Promise<CartWithItems | null> {
  // Find active cart
  const [activeCart] = await db
    .select({
      id: cart.id,
      itemCount: cart.itemCount,
      subtotalCents: cart.subtotalCents,
    })
    .from(cart)
    .where(and(eq(cart.userId, userId), eq(cart.status, 'ACTIVE')))
    .limit(1);

  if (!activeCart) {
    return null;
  }

  // Get all cart items with listing info
  const items = await db
    .select({
      cartItemId: cartItem.id,
      listingId: cartItem.listingId,
      quantity: cartItem.quantity,
      unitPriceCents: cartItem.priceCents,
      sellerId: cartItem.sellerId,
      // Listing fields
      title: listing.title,
      slug: listing.slug,
      status: listing.status,
      availableQuantity: listing.availableQuantity,
      freeShipping: listing.freeShipping,
      listingShippingCents: listing.shippingCents,
      fulfillmentType: listing.fulfillmentType,
      categoryId: listing.categoryId,
    })
    .from(cartItem)
    .innerJoin(listing, eq(listing.id, cartItem.listingId))
    .where(and(eq(cartItem.cartId, activeCart.id), eq(cartItem.isSavedForLater, false)));

  if (items.length === 0) {
    return {
      cartId: activeCart.id,
      itemCount: 0,
      subtotalCents: 0,
      shippingCents: 0,
      totalShippingSavingsCents: 0,
      groups: [],
      supportsLocalPickup: false,
    };
  }

  // Get primary images for all listings - FILTERED by listingIds
  const listingIds = items.map((item) => item.listingId);
  const images = await db
    .select({
      listingId: listingImage.listingId,
      url: listingImage.url,
    })
    .from(listingImage)
    .where(and(eq(listingImage.isPrimary, true), inArray(listingImage.listingId, listingIds)));

  const imageMap = new Map(images.map((img) => [img.listingId, img.url]));

  // Get seller info for all sellers
  const sellerIds = [...new Set(items.map((item) => item.sellerId))];
  const sellerInfoList = await db
    .select({
      odUserId: sellerProfile.userId,
      storeName: sellerProfile.storeName,
      storeSlug: sellerProfile.storeSlug,
      userName: user.name,
      username: user.username,
    })
    .from(sellerProfile)
    .innerJoin(user, eq(user.id, sellerProfile.userId))
    .where(inArray(sellerProfile.userId, sellerIds));

  const sellerNameMap = new Map(
    sellerInfoList.map((s) => [s.odUserId, s.storeName ?? s.userName ?? 'Unknown Seller'])
  );
  const sellerSlugMap = new Map(
    sellerInfoList.map((s) => [s.odUserId, s.storeSlug ?? null])
  );

  // Get default shipping profiles for combined shipping calculation
  const defaultShippingProfiles = await db
    .select({
      userId: shippingProfile.userId,
      combinedShippingMode: shippingProfile.combinedShippingMode,
      flatCombinedCents: shippingProfile.flatCombinedCents,
      additionalItemCents: shippingProfile.additionalItemCents,
      autoDiscountPercent: shippingProfile.autoDiscountPercent,
      autoDiscountMinItems: shippingProfile.autoDiscountMinItems,
    })
    .from(shippingProfile)
    .where(and(inArray(shippingProfile.userId, sellerIds), eq(shippingProfile.isDefault, true)));

  const shippingProfileMap = new Map(
    defaultShippingProfiles.map((sp) => [sp.userId, sp])
  );

  // Group items by seller and check availability
  const groupsMap = new Map<string, SellerGroup>();

  for (const item of items) {
    // Check availability inline
    let isAvailable = true;
    let unavailableReason: string | null = null;

    if (item.status !== 'ACTIVE') {
      isAvailable = false;
      unavailableReason = item.status;
    } else if ((item.availableQuantity ?? 0) < item.quantity) {
      isAvailable = false;
      unavailableReason = 'INSUFFICIENT_QUANTITY';
    }

    // Use the listing's shippingCents (seller-set flat rate)
    // freeShipping=true means shippingCents=0
    const itemShippingCents = item.listingShippingCents;

    const cartItemDetail: CartItemDetail = {
      cartItemId: item.cartItemId,
      listingId: item.listingId,
      title: item.title ?? 'Untitled',
      slug: item.slug ?? '',
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      shippingCents: itemShippingCents,
      freeShipping: item.freeShipping,
      primaryImageUrl: imageMap.get(item.listingId) ?? null,
      isAvailable,
      unavailableReason,
      maxQuantity: item.availableQuantity ?? 0,
      fulfillmentType: item.fulfillmentType,
      categoryId: item.categoryId,
    };

    if (!groupsMap.has(item.sellerId)) {
      groupsMap.set(item.sellerId, {
        sellerId: item.sellerId,
        sellerName: sellerNameMap.get(item.sellerId) ?? 'Unknown Seller',
        sellerSlug: sellerSlugMap.get(item.sellerId) ?? item.sellerId,
        items: [],
        groupSubtotalCents: 0,
        groupShippingCents: 0,
        combinedShippingCents: 0,
        shippingSavingsCents: 0,
        combinedShippingMode: 'NONE',
        supportsLocalPickup: true, // Will be AND-ed with each item
      });
    }

    const group = groupsMap.get(item.sellerId)!;
    group.items.push(cartItemDetail);
    if (isAvailable) {
      group.groupSubtotalCents += item.unitPriceCents * item.quantity;
      group.groupShippingCents += itemShippingCents * item.quantity;
      // B3.4: Group supports local pickup only if ALL items support it
      const itemSupportsLocal = item.fulfillmentType === 'LOCAL_ONLY' || item.fulfillmentType === 'SHIP_AND_LOCAL';
      group.supportsLocalPickup = group.supportsLocalPickup && itemSupportsLocal;
    }
  }

  // Calculate combined shipping for each seller group
  for (const group of groupsMap.values()) {
    const availableItems = group.items.filter((item) => item.isAvailable);
    if (availableItems.length === 0) continue;

    const sellerShippingProfile = shippingProfileMap.get(group.sellerId);
    const combinedItems = availableItems.map((item) => ({
      listingId: item.listingId,
      shippingCents: item.shippingCents,
      quantity: item.quantity,
    }));

    const shippingResult = calculateCombinedShipping({
      mode: (sellerShippingProfile?.combinedShippingMode ?? 'NONE') as CombinedShippingMode,
      items: combinedItems,
      flatCombinedCents: sellerShippingProfile?.flatCombinedCents,
      additionalItemCents: sellerShippingProfile?.additionalItemCents,
      autoDiscountPercent: sellerShippingProfile?.autoDiscountPercent,
      autoDiscountMinItems: sellerShippingProfile?.autoDiscountMinItems,
    });

    group.combinedShippingCents = shippingResult.totalShippingCents;
    group.shippingSavingsCents = shippingResult.savingsCents;
    group.combinedShippingMode = shippingResult.mode;
  }

  // Calculate totals from available items only (using combined shipping)
  let totalItemCount = 0;
  let totalSubtotalCents = 0;
  let totalShippingCents = 0;
  let totalShippingSavingsCents = 0;
  const groups = Array.from(groupsMap.values());

  for (const group of groups) {
    for (const item of group.items) {
      if (item.isAvailable) {
        totalItemCount += item.quantity;
        totalSubtotalCents += item.unitPriceCents * item.quantity;
      }
    }
    // Use combined shipping totals (already calculated per group)
    totalShippingCents += group.combinedShippingCents;
    totalShippingSavingsCents += group.shippingSavingsCents;
  }

  // B3.4: Cart supports local pickup if ALL groups support it
  const cartSupportsLocalPickup = groups.length > 0 && groups.every((g) => g.supportsLocalPickup);

  return {
    cartId: activeCart.id,
    itemCount: totalItemCount,
    subtotalCents: totalSubtotalCents,
    shippingCents: totalShippingCents,
    totalShippingSavingsCents,
    groups,
    supportsLocalPickup: cartSupportsLocalPickup,
  };
}

/**
 * Get cart item count for header badge.
 */
export async function getCartItemCount(userId: string): Promise<number> {
  const [activeCart] = await db
    .select({ itemCount: cart.itemCount })
    .from(cart)
    .where(and(eq(cart.userId, userId), eq(cart.status, 'ACTIVE')))
    .limit(1);

  return activeCart?.itemCount ?? 0;
}
