import { db } from '@twicely/db';
import { listingOffer, listing, address, sellerProfile } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import {
  countActiveOffersByBuyer,
  countActiveOffersByBuyerForSeller,
  countActiveOffersByBuyerForListing,
  hasRecentDeclinedOffer,
} from '@twicely/commerce/offer-queries';
import { isBuyerBlocked } from '@/lib/queries/buyer-block';
import { updateEngagement } from '@/lib/actions/browsing-history-helpers';
import { notifyOfferEvent } from '@twicely/commerce/offer-notifications';
import { createOrderFromOffer } from '@twicely/commerce/offer-to-order';
import { scheduleOfferExpiry } from '@twicely/jobs/offer-expiry';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

/** Load offer limits from platform_settings with fallbacks */
async function getOfferLimits() {
  const [expiryHours, minPercent, maxPerSeller, maxGlobal, maxPerListing] = await Promise.all([
    getPlatformSetting<number>('commerce.offer.expirationHours', 48),
    getPlatformSetting<number>('commerce.offer.minPercentOfAsking', 50),
    getPlatformSetting<number>('commerce.offer.maxOffersPerBuyer', 3),
    getPlatformSetting<number>('commerce.offer.maxOffersPerBuyerGlobal', 10),
    getPlatformSetting<number>('commerce.offer.maxOffersPerListing', 3),
  ]);
  return { expiryHours, minPercent, maxPerSeller, maxGlobal, maxPerListing };
}

export interface CreateOfferParams {
  listingId: string;
  buyerId: string;
  offerCents: number;
  message?: string;
  paymentMethodId: string;
  shippingAddressId: string;
}

/** Create a new offer with Stripe authorization hold */
export async function createOffer(params: CreateOfferParams) {
  const { listingId, buyerId, offerCents, message, paymentMethodId, shippingAddressId } = params;

  const offerEnabled = await getPlatformSetting<boolean>('commerce.offer.enabled', true);
  if (!offerEnabled) return { success: false, error: 'Offers are currently disabled' };

  // 1. Validate listing exists, is ACTIVE, allowOffers = true
  const [lst] = await db.select({
    id: listing.id,
    sellerId: listing.ownerUserId,
    status: listing.status,
    allowOffers: listing.allowOffers,
    priceCents: listing.priceCents,
    autoAcceptOfferCents: listing.autoAcceptOfferCents,
    autoDeclineOfferCents: listing.autoDeclineOfferCents,
    offerExpiryHours: listing.offerExpiryHours,
  }).from(listing).where(eq(listing.id, listingId)).limit(1);

  if (!lst) return { success: false, error: 'Listing not found' };
  if (lst.status !== 'ACTIVE') return { success: false, error: 'Listing is not available' };
  if (!lst.allowOffers) return { success: false, error: 'This listing does not accept offers' };

  // 2. Validate buyer !== seller
  if (buyerId === lst.sellerId) return { success: false, error: 'You cannot make an offer on your own listing' };

  // 2b. Check if buyer is blocked by seller (C1.6)
  if (await isBuyerBlocked(lst.sellerId, buyerId)) {
    return { success: false, error: 'Unable to make offer on this listing' };
  }

  // 2c. Check seller vacation mode (all modes block offers)
  const [sellerVacation] = await db
    .select({ vacationMode: sellerProfile.vacationMode })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, lst.sellerId))
    .limit(1);
  if (sellerVacation?.vacationMode) {
    return { success: false, error: 'Seller is currently on vacation and not accepting offers' };
  }

  // 3. Load offer limits from platform_settings
  const limits = await getOfferLimits();

  // 4. Check spam limits
  const [perSeller, perListing, global] = await Promise.all([
    countActiveOffersByBuyerForSeller(buyerId, lst.sellerId),
    countActiveOffersByBuyerForListing(buyerId, listingId),
    countActiveOffersByBuyer(buyerId),
  ]);
  if (perSeller >= limits.maxPerSeller) {
    return { success: false, error: 'You have too many active offers with this seller' };
  }
  if (perListing >= limits.maxPerListing) {
    return { success: false, error: 'You already have an active offer on this listing' };
  }
  if (global >= limits.maxGlobal) {
    return { success: false, error: 'You have too many active offers. Please wait for responses.' };
  }

  // 5. Check no identical offer within 24h of decline
  if (await hasRecentDeclinedOffer(buyerId, listingId, offerCents)) {
    return { success: false, error: 'This offer was recently declined. Try a different amount.' };
  }

  // 6. Check offerCents >= minimum percent of listing price
  const minOfferCents = Math.ceil((lst.priceCents! * limits.minPercent) / 100);
  if (offerCents < minOfferCents) {
    return { success: false, error: `Offer must be at least ${limits.minPercent}% of asking price` };
  }

  // 6. Validate shipping address belongs to buyer
  const [addr] = await db.select({ id: address.id, userId: address.userId })
    .from(address).where(eq(address.id, shippingAddressId)).limit(1);
  if (!addr || addr.userId !== buyerId) {
    return { success: false, error: 'Invalid shipping address' };
  }

  // 7. Check auto-decline threshold
  if (lst.autoDeclineOfferCents && offerCents < lst.autoDeclineOfferCents) {
    const expiresAt = new Date(Date.now() + (lst.offerExpiryHours ?? limits.expiryHours) * 60 * 60 * 1000);
    const [offer] = await db.insert(listingOffer).values({
      listingId, buyerId, sellerId: lst.sellerId, offerCents, message,
      status: 'DECLINED', type: 'BEST_OFFER', expiresAt, respondedAt: new Date(),
      shippingAddressId,
    }).returning();
    return { success: true, offer };
  }

  // 8. Create Stripe PaymentIntent with capture_method: 'manual' (authorization hold)
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: offerCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      capture_method: 'manual',
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: { listingId, buyerId, type: 'offer_hold' },
    });
  } catch {
    return { success: false, error: 'Failed to authorize payment. Please check your payment method.' };
  }

  // 9. Calculate expiresAt
  const expiresAt = new Date(Date.now() + (lst.offerExpiryHours ?? limits.expiryHours) * 60 * 60 * 1000);

  // 10. Insert listingOffer row
  const [newOffer] = await db.insert(listingOffer).values({
    listingId, buyerId, sellerId: lst.sellerId, offerCents, message,
    status: 'PENDING', type: 'BEST_OFFER', expiresAt, stripeHoldId: paymentIntent.id,
    counterCount: 0, shippingAddressId,
  }).returning();

  if (!newOffer) return { success: false, error: 'Failed to create offer' };

  // 11. Check auto-accept threshold — fully process as accepted offer
  if (lst.autoAcceptOfferCents && offerCents >= lst.autoAcceptOfferCents) {
    // Capture hold, mark accepted, decline others, create order — all in transaction
    try {
      await stripe.paymentIntents.capture(paymentIntent.id);
    } catch {
      return { success: false, error: 'Failed to capture auto-accepted offer payment' };
    }

    // Mark accepted + decline other pending offers + create order
    const orderResult = await db.transaction(async (tx) => {
      await tx.update(listingOffer)
        .set({ status: 'ACCEPTED', respondedAt: new Date(), updatedAt: new Date() })
        .where(eq(listingOffer.id, newOffer.id));

      // Decline all other pending offers and release their holds
      const pendingOffers = await tx.select({ id: listingOffer.id, stripeHoldId: listingOffer.stripeHoldId })
        .from(listingOffer)
        .where(and(eq(listingOffer.listingId, listingId), eq(listingOffer.status, 'PENDING')));

      for (const pending of pendingOffers) {
        if (pending.stripeHoldId) {
          try { await stripe.paymentIntents.cancel(pending.stripeHoldId); } catch { /* ignore */ }
        }
      }

      await tx.update(listingOffer)
        .set({ status: 'DECLINED', respondedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(listingOffer.listingId, listingId), eq(listingOffer.status, 'PENDING')));

      return { success: true };
    });

    if (!orderResult.success) {
      return { success: false, error: 'Failed to process auto-accept' };
    }

    // Create order from the accepted offer
    const order = await createOrderFromOffer({
      offerId: newOffer.id,
      shippingAddressId,
      stripePaymentIntentId: paymentIntent.id,
    });

    if (!order.success) {
      return { success: false, error: order.error ?? 'Failed to create order' };
    }

    return {
      success: true,
      offer: { ...newOffer, status: 'ACCEPTED' },
      autoAccepted: true,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
    };
  }

  // Schedule expiry job via BullMQ
  await scheduleOfferExpiry(newOffer.id, expiresAt);

  // Track engagement (fire-and-forget)
  updateEngagement(buyerId, listingId, 'offer').catch(() => {});

  // Notify seller of new offer (fire-and-forget)
  notifyOfferEvent('created', newOffer.id);

  return { success: true, offer: newOffer };
}
