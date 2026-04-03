import { db } from '@twicely/db';
import { order, orderItem, cart, cartItem, listing, category, sellerProfile, shippingProfile } from '@twicely/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { generateOrderNumber } from '@twicely/commerce/order-number';
import { calculateTf, getTfBrackets, getMinimumTfCents } from '@twicely/commerce/tf-calculator';
import { calculateCombinedShipping, type CombinedShippingItem, type CombinedShippingMode } from '@/lib/services/combined-shipping';
import { getAuthOfferConfig } from '@twicely/commerce/auth-offer';
import { getSellerMonthlyGmv } from '@twicely/commerce/order-gmv';
import type { CreateOrderInput, OrderCreationResult, CartItemWithDetails } from '@twicely/commerce/order-gmv';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { createCombinedShippingQuoteIfNeeded } from '@twicely/commerce/create-quote';

// Re-export single-order creator and shared types for external consumers
export { createOrder } from '@twicely/commerce/create-single-order';
export type { CreateOrderInput, OrderCreationResult } from '@twicely/commerce/order-gmv';

/**
 * Create orders from a cart. Since items may be from different sellers,
 * this creates one order per seller.
 */
export async function createOrdersFromCart(
  input: CreateOrderInput
): Promise<OrderCreationResult[]> {
  const { userId, cartId, shippingAddress, buyerNote, isLocalPickup = false, authenticationRequested } = input;

  // Verify cart belongs to user and is active
  const [activeCart] = await db
    .select({ id: cart.id, userId: cart.userId, status: cart.status })
    .from(cart)
    .where(eq(cart.id, cartId))
    .limit(1);

  if (!activeCart || activeCart.userId !== userId || activeCart.status !== 'ACTIVE') {
    return [{ success: false, error: 'Cart not found or not active' }];
  }

  // Get cart items (without listing join - we'll lock listings in transaction)
  const cartItems = await db
    .select({
      cartItemId: cartItem.id,
      listingId: cartItem.listingId,
      quantity: cartItem.quantity,
      priceCents: cartItem.priceCents,
      sellerId: cartItem.sellerId,
    })
    .from(cartItem)
    .where(and(eq(cartItem.cartId, cartId), eq(cartItem.isSavedForLater, false)));

  if (cartItems.length === 0) {
    return [{ success: false, error: 'Cart is empty' }];
  }

  const maxItems = await getPlatformSetting<number>('commerce.order.maxItemsPerOrder', 100);
  if (cartItems.length > maxItems) return [{ success: false, error: `Orders are limited to ${maxItems} items` }];

  // Get seller info (pre-fetch outside transaction)
  const sellerIds = [...new Set(cartItems.map((i) => i.sellerId))];
  const sellerProfiles = await db
    .select({
      userId: sellerProfile.userId,
      handlingTimeDays: sellerProfile.handlingTimeDays,
    })
    .from(sellerProfile)
    .where(inArray(sellerProfile.userId, sellerIds));

  const sellerInfoMap = new Map(
    sellerProfiles.map((s) => [s.userId, { handlingTimeDays: s.handlingTimeDays }])
  );

  // Get default shipping profile for each seller (for combined shipping)
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

  // Get seller monthly GMV for each seller (for progressive TF calculation)
  const sellerGmvMap = new Map<string, number>();
  for (const sellerId of sellerIds) {
    const gmv = await getSellerMonthlyGmv(sellerId);
    sellerGmvMap.set(sellerId, gmv);
  }

  // Group cart items by seller (listing details fetched in transaction with lock)
  const cartItemsBySeller = new Map<string, typeof cartItems>();
  for (const item of cartItems) {
    if (!cartItemsBySeller.has(item.sellerId)) {
      cartItemsBySeller.set(item.sellerId, []);
    }
    cartItemsBySeller.get(item.sellerId)!.push(item);
  }

  // Load TF settings from platform_settings (never use hardcoded defaults)
  const tfBrackets = await getTfBrackets();
  const minimumTfCents = await getMinimumTfCents();

  // Create one order per seller
  const results: OrderCreationResult[] = [];

  for (const [sellerId, sellerCartItems] of cartItemsBySeller) {
    const defaultHandlingDays = await getPlatformSetting<number>('fulfillment.shipping.defaultHandlingDays', 3);
    const sellerInfo = sellerInfoMap.get(sellerId) ?? { handlingTimeDays: defaultHandlingDays };
    const { handlingTimeDays } = sellerInfo;
    const sellerMonthlyGmv = sellerGmvMap.get(sellerId) ?? 0;

    try {
      const result = await db.transaction(async (tx) => {
        // Lock listings with SELECT FOR UPDATE to prevent oversell (fixes bug #39)
        const listingIds = sellerCartItems.map((i) => i.listingId);
        const lockedListings = await tx
          .select({
            id: listing.id,
            title: listing.title,
            status: listing.status,
            availableQuantity: listing.availableQuantity,
            quantity: listing.quantity,
            shippingCents: listing.shippingCents,
            categoryId: listing.categoryId,
          })
          .from(listing)
          .where(inArray(listing.id, listingIds))
          .for('update');

        const listingMap = new Map(lockedListings.map((l) => [l.id, l]));

        // Build items with listing details and check availability
        const sellerItems: CartItemWithDetails[] = [];
        for (const cartItm of sellerCartItems) {
          const lst = listingMap.get(cartItm.listingId);
          if (!lst) throw new Error('Listing not found');
          if (lst.status !== 'ACTIVE') throw new Error(`Item "${lst.title}" is no longer available`);
          const available = lst.availableQuantity ?? lst.quantity;
          if (available < cartItm.quantity) throw new Error(`Not enough stock for "${lst.title}"`);

          // Get fee bucket from category
          let feeBucket: CartItemWithDetails['feeBucket'] = 'HOME_GENERAL';
          if (lst.categoryId) {
            const [cat] = await tx
              .select({ feeBucket: category.feeBucket })
              .from(category)
              .where(eq(category.id, lst.categoryId))
              .limit(1);
            if (cat?.feeBucket) feeBucket = cat.feeBucket;
          }

          sellerItems.push({
            cartItemId: cartItm.cartItemId, listingId: cartItm.listingId,
            quantity: cartItm.quantity, priceCents: cartItm.priceCents,
            shippingCents: lst.shippingCents, sellerId: cartItm.sellerId,
            title: lst.title ?? 'Untitled', categoryId: lst.categoryId, feeBucket,
          });
        }

        // Calculate totals with combined shipping
        let itemSubtotalCents = 0;
        for (const item of sellerItems) {
          itemSubtotalCents += item.priceCents * item.quantity;
        }

        // For local pickup, shipping is $0
        let orderShippingCents = 0;
        let shippingSavingsCents = 0;

        if (!isLocalPickup) {
          const sellerShippingProfile = shippingProfileMap.get(sellerId);
          const combinedShippingItems: CombinedShippingItem[] = sellerItems.map((item) => ({
            listingId: item.listingId, shippingCents: item.shippingCents, quantity: item.quantity,
          }));
          const shippingResult = calculateCombinedShipping({
            mode: (sellerShippingProfile?.combinedShippingMode ?? 'NONE') as CombinedShippingMode,
            items: combinedShippingItems,
            flatCombinedCents: sellerShippingProfile?.flatCombinedCents,
            additionalItemCents: sellerShippingProfile?.additionalItemCents,
            autoDiscountPercent: sellerShippingProfile?.autoDiscountPercent,
            autoDiscountMinItems: sellerShippingProfile?.autoDiscountMinItems,
          });
          orderShippingCents = shippingResult.totalShippingCents;
          shippingSavingsCents = shippingResult.savingsCents;
        }

        // Add authentication fee if buyer opted in
        const authConfig = await getAuthOfferConfig();
        const authFeeCents = authenticationRequested ? authConfig.buyerFeeCents : 0;
        const totalCents = itemSubtotalCents + orderShippingCents + authFeeCents;

        // Calculate handling due date
        const now = new Date();
        const handlingDueAt = new Date(now);
        handlingDueAt.setDate(handlingDueAt.getDate() + handlingTimeDays);

        // Create order
        const orderNumber = generateOrderNumber();
        const [newOrder] = await tx.insert(order).values({
          orderNumber, buyerId: userId, sellerId, status: 'CREATED',
          sourceCartId: cartId, isLocalPickup,
          authenticationOffered: authenticationRequested !== undefined,
          authenticationDeclined: authenticationRequested === false,
          authenticationDeclinedAt: authenticationRequested === false ? new Date() : null,
          itemSubtotalCents, shippingCents: orderShippingCents, totalCents,
          shippingAddressJson: shippingAddress, buyerNote,
          handlingDueDays: isLocalPickup ? 0 : handlingTimeDays,
          handlingDueAt: isLocalPickup ? undefined : handlingDueAt,
          expectedShipByAt: isLocalPickup ? undefined : handlingDueAt,
        }).returning({ id: order.id, orderNumber: order.orderNumber });

        if (!newOrder) throw new Error('Failed to create order');

        // Create order items with TF (Transaction Fee)
        let cumulativeGmv = sellerMonthlyGmv;
        for (const item of sellerItems) {
          const shippingForItem = isLocalPickup ? 0 : item.shippingCents;
          const salePriceCents = (item.priceCents + shippingForItem) * item.quantity;
          let tfRateBps: number;
          let tfAmountCents: number;

          if (isLocalPickup) {
            const tfResult = calculateTf(cumulativeGmv, salePriceCents, tfBrackets, minimumTfCents);
            tfRateBps = tfResult.effectiveRateBps;
            tfAmountCents = tfResult.tfCents;
            // NOTE: Do NOT add to cumulativeGmv — local sales don't count toward monthly GMV per Decision #118
          } else {
            const tfResult = calculateTf(cumulativeGmv, salePriceCents, tfBrackets, minimumTfCents);
            tfRateBps = tfResult.effectiveRateBps;
            tfAmountCents = tfResult.tfCents;
            cumulativeGmv += salePriceCents;
          }

          await tx.insert(orderItem).values({
            orderId: newOrder.id, listingId: item.listingId, title: item.title,
            quantity: item.quantity, unitPriceCents: item.priceCents,
            tfRateBps, tfAmountCents, feeBucket: item.feeBucket,
            listingSnapshotJson: {
              listingId: item.listingId, title: item.title,
              priceCents: item.priceCents,
              shippingCents: isLocalPickup ? 0 : item.shippingCents,
            },
          });
        }

        // D2.2: Create combined shipping quote if seller uses QUOTED mode and 2+ items
        const quoteInfo = await createCombinedShippingQuoteIfNeeded({
          tx,
          orderId: newOrder.id,
          sellerId,
          buyerId: userId,
          orderShippingCents,
          itemCount: sellerItems.length,
          isLocalPickup,
          combinedShippingMode: shippingProfileMap.get(sellerId)?.combinedShippingMode,
        });

        return {
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          totalCents,
          shippingSavingsCents,
          quoteInfo,
          itemCount: sellerItems.length,
        };
      });

      // Notify seller about pending combined shipping quote (fire-and-forget)
      if (result.quoteInfo) {
        const maxShippingFormatted = `$${(result.quoteInfo.maxShippingCents / 100).toFixed(2)}`;
        const deadlineFormatted = result.quoteInfo.sellerDeadline.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        });
        void notify(sellerId, 'shipping_quote.requested', {
          buyerName: 'Buyer',
          orderNumber: result.orderNumber,
          itemCount: String(result.itemCount ?? sellerCartItems.length),
          maxShippingFormatted,
          deadlineFormatted,
        });
      }

      results.push({
        success: true, orderId: result.orderId, orderNumber: result.orderNumber,
        totalCents: result.totalCents, shippingSavingsCents: result.shippingSavingsCents,
      });
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order',
      });
    }
  }

  // NOTE: Cart is NOT converted here. It stays ACTIVE until payment is confirmed.
  // This is handled in finalizeOrder (fixes bugs #44-45).

  return results;
}
