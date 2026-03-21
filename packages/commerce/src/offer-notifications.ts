import { getOfferWithParties } from './offer-queries';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';

/** Format cents as USD string e.g. "$125.00" */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const BASE_URL = process.env.NEXT_PUBLIC_URL ?? '';

/**
 * Fire-and-forget notification for offer events.
 * Fetches offer data and dispatches appropriate notification.
 */
export function notifyOfferEvent(
  event: 'created' | 'accepted' | 'declined' | 'countered' | 'expired',
  offerId: string,
  extra?: { recipientOverride?: string; isBuyerAccepting?: boolean; orderNumber?: string }
): void {
  getOfferWithParties(offerId)
    .then((offerData) => {
      if (!offerData) return;

      const { buyerId, sellerId, offerCents, listing, buyer, seller } = offerData;
      const itemTitle = listing.title ?? 'Item';
      const listingUrl = `${BASE_URL}/i/${listing.slug ?? offerData.listingId}`;
      const offersUrl = `${BASE_URL}/my/selling/offers`;

      switch (event) {
        case 'created':
          // Notify seller of new offer
          notify(sellerId, 'offer.received', {
            itemTitle,
            offerAmountFormatted: formatCents(offerCents),
            offersUrl,
            sellerName: seller?.name ?? 'Seller',
          }).catch((err) => logger.error('[notify] offer.received failed', { error: String(err) }));
          break;

        case 'accepted':
          // Notify buyer their offer was accepted
          notify(buyerId, 'offer.accepted', {
            itemTitle,
            offerAmountFormatted: formatCents(offerCents),
            orderUrl: `${BASE_URL}/my/buying/orders/${offerData.listingId}`,
            buyerName: buyer?.name ?? 'Buyer',
          }).catch((err) => logger.error('[notify] offer.accepted failed', { error: String(err) }));

          // Also notify seller when buyer accepts their counter-offer
          if (extra?.isBuyerAccepting) {
            notify(sellerId, 'order.confirmed', {
              itemTitle,
              orderNumber: extra.orderNumber ?? '',
              totalFormatted: formatCents(offerCents),
              sellerName: seller?.name ?? 'Seller',
            }).catch((err) => logger.error('[notify] order.confirmed (seller) failed', { error: String(err) }));
          }
          break;

        case 'declined':
          // Notify buyer their offer was declined
          notify(buyerId, 'offer.declined', {
            itemTitle,
            offerAmountFormatted: formatCents(offerCents),
            listingUrl,
            buyerName: buyer?.name ?? 'Buyer',
          }).catch((err) => logger.error('[notify] offer.declined failed', { error: String(err) }));
          break;

        case 'countered':
          // Notify the other party of the counter
          const recipientId = extra?.recipientOverride ?? buyerId;
          const recipientName = recipientId === buyerId
            ? (buyer?.name ?? 'Buyer')
            : (seller?.name ?? 'Seller');
          notify(recipientId, 'offer.countered', {
            itemTitle,
            counterAmountFormatted: formatCents(offerCents),
            offersUrl,
            recipientName,
          }).catch((err) => logger.error('[notify] offer.countered failed', { error: String(err) }));
          break;

        case 'expired':
          // Notify buyer their offer expired
          notify(buyerId, 'offer.expired', {
            itemTitle,
            offerAmountFormatted: formatCents(offerCents),
            listingUrl,
            buyerName: buyer?.name ?? 'Buyer',
          }).catch((err) => logger.error('[notify] offer.expired failed', { error: String(err) }));
          break;
      }
    })
    .catch((err) => logger.error('[notify] getOfferWithParties failed', { error: String(err) }));
}
