import { db } from '@twicely/db';
import { order, orderItem, orderPayment, listing, listingOffer, category, sellerProfile, address } from '@twicely/db/schema';
import { eq, and, inArray, sql, gte } from 'drizzle-orm';
import { generateOrderNumber } from '@twicely/commerce/order-number';
import { calculateTf, getTfBrackets, getMinimumTfCents } from '@twicely/commerce/tf-calculator';
import { getOfferById } from '@twicely/commerce/offer-queries';
import type { FeeBucket } from '@/types/enums';
import { logger } from '@twicely/logger';

interface CreateOrderFromOfferInput {
  offerId: string;
  shippingAddressId: string;
  stripePaymentIntentId: string;
  buyerNote?: string;
}

interface OfferOrderResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

/**
 * Get start of current calendar month (for GMV calculation).
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Get seller's GMV for current calendar month.
 * Sum of (unitPriceCents * quantity) from order_item for completed orders.
 */
async function getSellerMonthlyGmv(sellerId: string): Promise<number> {
  const monthStart = getMonthStart();

  const result = await db
    .select({
      totalGmv: sql<number>`COALESCE(SUM(${orderItem.unitPriceCents} * ${orderItem.quantity}), 0)::int`,
    })
    .from(orderItem)
    .innerJoin(order, eq(orderItem.orderId, order.id))
    .where(
      and(
        eq(order.sellerId, sellerId),
        gte(order.createdAt, monthStart),
        // Count GMV from orders that are at least PAID (not cancelled)
        inArray(order.status, ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED'])
      )
    );

  return result[0]?.totalGmv ?? 0;
}

/**
 * Create an order from an accepted offer.
 * Called after payment is captured/confirmed.
 *
 * Key differences from cart-based orders:
 * - Single listing, single seller
 * - Price comes from offer (may differ from listing price)
 * - Payment already captured via offer flow
 * - Shipping address is snapshotted from buyer's saved address
 */
export async function createOrderFromOffer(
  input: CreateOrderFromOfferInput
): Promise<OfferOrderResult> {
  const { offerId, shippingAddressId, stripePaymentIntentId, buyerNote } = input;

  // 1. Fetch the accepted offer
  const offerData = await getOfferById(offerId);
  if (!offerData) {
    return { success: false, error: 'Offer not found' };
  }
  if (offerData.status !== 'ACCEPTED') {
    return { success: false, error: 'Offer must be accepted before creating order' };
  }

  // 2. Fetch and snapshot the shipping address
  const [addr] = await db
    .select({
      name: address.name,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
    })
    .from(address)
    .where(eq(address.id, shippingAddressId))
    .limit(1);

  if (!addr) {
    return { success: false, error: 'Shipping address not found' };
  }

  const shippingAddressJson = {
    name: addr.name,
    address1: addr.address1,
    address2: addr.address2,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: addr.country,
    phone: addr.phone,
  };

  // 3. Get seller handling time (pre-fetch outside transaction)
  const [sellerData] = await db
    .select({ handlingTimeDays: sellerProfile.handlingTimeDays })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, offerData.sellerId))
    .limit(1);

  const handlingTimeDays = sellerData?.handlingTimeDays ?? 3;

  // 4. Get seller's monthly GMV for progressive TF calculation
  const sellerMonthlyGmv = await getSellerMonthlyGmv(offerData.sellerId);

  // Load TF settings from platform_settings (never use hardcoded defaults)
  const tfBrackets = await getTfBrackets();
  const minimumTfCents = await getMinimumTfCents();

  // 5. Create order in transaction
  try {
    const result = await db.transaction(async (tx) => {
      // Lock listing with SELECT FOR UPDATE
      const [lst] = await tx
        .select({
          id: listing.id,
          title: listing.title,
          status: listing.status,
          priceCents: listing.priceCents,
          shippingCents: listing.shippingCents,
          availableQuantity: listing.availableQuantity,
          quantity: listing.quantity,
          categoryId: listing.categoryId,
        })
        .from(listing)
        .where(eq(listing.id, offerData.listingId))
        .for('update');

      if (!lst) {
        throw new Error('Listing not found');
      }

      // Verify listing is still available (edge case: listing ended between accept and order creation)
      if (lst.status !== 'ACTIVE') {
        throw new Error('Listing is no longer available');
      }

      const available = lst.availableQuantity ?? lst.quantity;
      if (available < 1) {
        throw new Error('Item is out of stock');
      }

      // Get fee bucket from category (still stored for analytics, but not used for TF calculation)
      let feeBucket: FeeBucket = 'HOME_GENERAL';
      if (lst.categoryId) {
        const [cat] = await tx
          .select({ feeBucket: category.feeBucket })
          .from(category)
          .where(eq(category.id, lst.categoryId))
          .limit(1);
        if (cat?.feeBucket) {
          feeBucket = cat.feeBucket;
        }
      }

      // Calculate totals (offer price, not listing price)
      const itemSubtotalCents = offerData.offerCents;
      const shippingCents = lst.shippingCents;
      const totalCents = itemSubtotalCents + shippingCents;

      // Calculate handling due date
      const now = new Date();
      const handlingDueAt = new Date(now);
      handlingDueAt.setDate(handlingDueAt.getDate() + handlingTimeDays);

      // Create order
      const orderNumber = generateOrderNumber();
      const [newOrder] = await tx
        .insert(order)
        .values({
          orderNumber,
          buyerId: offerData.buyerId,
          sellerId: offerData.sellerId,
          status: 'PAID', // Offer orders are already paid when created
          sourceCartId: null, // No cart for offer orders
          itemSubtotalCents,
          shippingCents,
          totalCents,
          shippingAddressJson,
          buyerNote,
          handlingDueDays: handlingTimeDays,
          handlingDueAt,
          expectedShipByAt: handlingDueAt,
          paymentIntentId: stripePaymentIntentId,
          paidAt: now,
        })
        .returning({ id: order.id, orderNumber: order.orderNumber });

      if (!newOrder) {
        throw new Error('Failed to create order');
      }

      // Create order item with TF (Transaction Fee) using progressive brackets
      const salePriceCents = itemSubtotalCents + shippingCents;
      const tfResult = calculateTf(sellerMonthlyGmv, salePriceCents, tfBrackets, minimumTfCents);

      await tx.insert(orderItem).values({
        orderId: newOrder.id,
        listingId: lst.id,
        title: lst.title ?? 'Untitled',
        quantity: 1, // Offers are always for qty 1
        unitPriceCents: offerData.offerCents,
        tfRateBps: tfResult.effectiveRateBps,
        tfAmountCents: tfResult.tfCents,
        feeBucket,
        listingSnapshotJson: {
          listingId: lst.id,
          title: lst.title,
          priceCents: lst.priceCents, // Original listing price for reference
          offerPriceCents: offerData.offerCents, // Actual price paid
          shippingCents: lst.shippingCents,
          offerId: offerData.id,
        },
      });

      // Create order payment record
      await tx.insert(orderPayment).values({
        orderId: newOrder.id,
        stripePaymentIntentId,
        status: 'captured',
        amountCents: totalCents,
        tfAmountCents: tfResult.tfCents,
        tfRateBps: tfResult.effectiveRateBps,
        capturedAt: now,
      });

      // Decrement available quantity
      await tx
        .update(listing)
        .set({
          availableQuantity: (lst.availableQuantity ?? lst.quantity) - 1,
          soldQuantity: (lst.quantity - (lst.availableQuantity ?? lst.quantity)) + 1,
          updatedAt: now,
        })
        .where(eq(listing.id, lst.id));

      // If last item, mark listing as SOLD
      if ((lst.availableQuantity ?? lst.quantity) <= 1) {
        await tx
          .update(listing)
          .set({ status: 'SOLD', soldAt: now, updatedAt: now })
          .where(eq(listing.id, lst.id));
      }

      // Update offer with orderId for audit trail
      await tx
        .update(listingOffer)
        .set({ updatedAt: now })
        .where(eq(listingOffer.id, offerId));

      return { orderId: newOrder.id, orderNumber: newOrder.orderNumber };
    });

    return {
      success: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
    };
  } catch (error) {
    logger.error('Failed to create order from offer', { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create order',
    };
  }
}
