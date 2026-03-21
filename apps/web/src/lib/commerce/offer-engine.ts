import { db } from '@twicely/db';
import { listingOffer, listing } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { stripe } from '@twicely/stripe/server';
import { getOfferById } from './offer-queries';
import { notifyOfferEvent } from './offer-notifications';
import { createOrderFromOffer } from './offer-to-order';
import { scheduleOfferExpiry, cancelOfferExpiry } from '@twicely/jobs/offer-expiry';

// Import base transitions (without job scheduling)
import {
  declineOffer as declineOfferBase,
  counterOffer as counterOfferBase,
  cancelOffer as cancelOfferBase,
  expireOffer as expireOfferBase,
  type OfferResult,
} from './offer-transitions';

// Re-export types and extracted functions
export type { OfferResult };
export { createOrderFromOffer } from './offer-to-order';
export { scheduleOfferExpiry, cancelOfferExpiry } from '@twicely/jobs/offer-expiry';
export { createOffer } from './offer-create';
export type { CreateOfferParams } from './offer-create';

/**
 * Accept an offer -- capture hold, create order, decline other offers.
 * Shipping address is already on the offer (shippingAddressId).
 */
export async function acceptOffer(offerId: string, actorId: string, paymentMethodId?: string) {
  const offerData = await getOfferById(offerId);
  if (!offerData) return { success: false, error: 'Offer not found' };
  if (offerData.status !== 'PENDING') return { success: false, error: 'Offer is no longer pending' };

  // Determine who can accept: seller accepts buyer offer, buyer accepts seller counter
  const isSellerAccepting = actorId === offerData.sellerId && offerData.counterByRole !== 'SELLER';
  const isBuyerAccepting = actorId === offerData.buyerId && offerData.counterByRole === 'SELLER';
  if (!isSellerAccepting && !isBuyerAccepting) {
    return { success: false, error: 'You cannot accept this offer' };
  }

  // Shipping address must exist on the offer
  if (!offerData.shippingAddressId) {
    return { success: false, error: 'Offer is missing shipping address' };
  }

  let stripePaymentIntentId: string;

  // Lock listing and verify availability, capture payment
  try {
    stripePaymentIntentId = await db.transaction(async (tx) => {
      const [lst] = await tx.select({
        id: listing.id, status: listing.status, availableQuantity: listing.availableQuantity, quantity: listing.quantity,
      }).from(listing).where(eq(listing.id, offerData.listingId)).for('update');

      if (!lst || lst.status !== 'ACTIVE') throw new Error('Listing is no longer available');
      if ((lst.availableQuantity ?? lst.quantity) < 1) throw new Error('Item is out of stock');

      let piId: string;

      // Capture or create+capture payment
      if (offerData.stripeHoldId) {
        // Seller accepting buyer's offer -- capture existing hold
        await stripe.paymentIntents.capture(offerData.stripeHoldId);
        piId = offerData.stripeHoldId;
      } else if (isBuyerAccepting && paymentMethodId) {
        // Buyer accepting seller counter -- create + capture in one step
        const pi = await stripe.paymentIntents.create({
          amount: offerData.offerCents,
          currency: offerData.currency,
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          metadata: { offerId, listingId: offerData.listingId, buyerId: offerData.buyerId, type: 'offer_accept' },
        });
        // Update offer with the new PI id for audit trail
        await tx.update(listingOffer).set({ stripeHoldId: pi.id }).where(eq(listingOffer.id, offerId));
        piId = pi.id;
      } else {
        throw new Error('Payment method required to accept this offer');
      }

      await tx.update(listingOffer).set({ status: 'ACCEPTED', respondedAt: new Date(), updatedAt: new Date() })
        .where(eq(listingOffer.id, offerId));

      // Decline all other pending offers and release their holds
      const pendingOffers = await tx.select({ id: listingOffer.id, stripeHoldId: listingOffer.stripeHoldId })
        .from(listingOffer)
        .where(and(eq(listingOffer.listingId, offerData.listingId), eq(listingOffer.status, 'PENDING')));

      for (const pending of pendingOffers) {
        if (pending.stripeHoldId) {
          try { await stripe.paymentIntents.cancel(pending.stripeHoldId); } catch { /* ignore */ }
        }
      }

      await tx.update(listingOffer).set({ status: 'DECLINED', respondedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(listingOffer.listingId, offerData.listingId), eq(listingOffer.status, 'PENDING')));

      return piId;
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to accept offer' };
  }

  // Cancel expiry job for accepted offer
  await cancelOfferExpiry(offerId);

  // Create order from the accepted offer (address is on the offer)
  const orderResult = await createOrderFromOffer({
    offerId,
    shippingAddressId: offerData.shippingAddressId,
    stripePaymentIntentId,
  });

  if (!orderResult.success) {
    return { success: false, error: orderResult.error ?? 'Failed to create order' };
  }

  // Notify buyer their offer was accepted + seller if buyer accepted counter (fire-and-forget)
  notifyOfferEvent('accepted', offerId, {
    isBuyerAccepting,
    orderNumber: orderResult.orderNumber,
  });

  return {
    success: true,
    offer: { id: offerData.id, listingId: offerData.listingId, buyerId: offerData.buyerId, sellerId: offerData.sellerId, offerCents: offerData.offerCents, status: 'ACCEPTED', stripeHoldId: stripePaymentIntentId },
    orderId: orderResult.orderId,
    orderNumber: orderResult.orderNumber,
  };
}

/**
 * Decline an offer -- wraps base transition with job cancellation.
 */
export async function declineOffer(offerId: string, sellerId: string): Promise<OfferResult> {
  const result = await declineOfferBase(offerId, sellerId);
  if (result.success) {
    await cancelOfferExpiry(offerId);
    notifyOfferEvent('declined', offerId);
  }
  return result;
}

/**
 * Cancel an offer -- wraps base transition with job cancellation.
 */
export async function cancelOffer(offerId: string, buyerId: string): Promise<OfferResult> {
  const result = await cancelOfferBase(offerId, buyerId);
  if (result.success) {
    await cancelOfferExpiry(offerId);
  }
  return result;
}

/**
 * Counter an offer -- wraps base transition with job scheduling.
 * Cancels old offer's expiry job, schedules new one for the counter.
 */
export async function counterOffer(
  offerId: string,
  actorId: string,
  counterCents: number,
  message?: string,
  paymentMethodId?: string
): Promise<OfferResult> {
  const result = await counterOfferBase(offerId, actorId, counterCents, message, paymentMethodId);
  if (result.success && result.offer) {
    // Cancel old offer's expiry job
    await cancelOfferExpiry(offerId);
    // Schedule new offer's expiry job (need to get expiresAt from DB)
    const newOffer = await getOfferById(result.offer.id);
    if (newOffer) {
      await scheduleOfferExpiry(newOffer.id, newOffer.expiresAt);
      // Notify the other party of the counter (fire-and-forget)
      const recipientId = actorId === newOffer.sellerId ? newOffer.buyerId : newOffer.sellerId;
      notifyOfferEvent('countered', newOffer.id, { recipientOverride: recipientId });
    }
  }
  return result;
}

/**
 * Expire an offer -- wraps base transition with notification.
 */
export async function expireOffer(offerId: string): Promise<OfferResult> {
  const result = await expireOfferBase(offerId);
  if (result.success) {
    notifyOfferEvent('expired', offerId);
  }
  return result;
}
