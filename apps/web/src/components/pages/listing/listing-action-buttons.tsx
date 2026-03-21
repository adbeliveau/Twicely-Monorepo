import { ListingAuthActions } from '@/components/listing/listing-auth-actions';
import { MakeOfferSection } from '@/app/(marketplace)/i/[slug]/make-offer-section';
import { WatchButton } from '@/components/listing/watch-button';
import { WatcherOfferBanner } from '@/components/listing/watcher-offer-banner';
import { PriceAlertButton } from '@/components/listings/price-alert-button';
import type { PriceAlertType } from '@/lib/queries/price-alerts';
import { MessageSellerButton } from '@/components/messaging/message-seller-button';

interface ListingActionButtonsProps {
  listing: {
    id: string;
    slug: string;
    priceCents: number;
    status: string;
    allowOffers: boolean;
    autoAcceptOfferCents: number | null;
    autoDeclineOfferCents: number | null;
    images: Array<{ url: string }>;
    title: string;
    seller: { userId: string };
    availableQuantity: number | null;
  };
  isOwnListing: boolean;
  isUnavailable: boolean;
  isLoggedIn: boolean;
  currentUserId: string | null;
  userIsWatching: boolean;
  userNotifyPriceDrop: boolean;
  watcherCount: number;
  pendingOfferCount: number;
  userAddresses: Array<{ id: string; label: string | null; name: string; isDefault: boolean }>;
  userPriceAlert: {
    id: string;
    alertType: PriceAlertType;
    targetPriceCents: number | null;
    percentDrop: number | null;
  } | null;
  watcherOffer: {
    offer: { id: string; discountedPriceCents: number; expiresAt: Date };
    listingPriceCents: number;
    isWatcher: boolean;
  } | null;
  existingConversationId: string | null;
  autoWatch?: boolean;
}

export function ListingActionButtons({
  listing,
  isOwnListing,
  isUnavailable,
  isLoggedIn,
  currentUserId: _currentUserId,
  userIsWatching,
  userNotifyPriceDrop,
  watcherCount,
  pendingOfferCount,
  userAddresses,
  userPriceAlert,
  watcherOffer,
  existingConversationId,
  autoWatch = false,
}: ListingActionButtonsProps) {
  return (
    <>
      {!isOwnListing && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <WatchButton
            listingId={listing.id}
            listingSlug={listing.slug}
            initialWatching={userIsWatching}
            initialNotifyPriceDrop={userNotifyPriceDrop}
            watcherCount={watcherCount}
            isLoggedIn={isLoggedIn}
            autoWatch={autoWatch}
          />
          <PriceAlertButton
            listingId={listing.id}
            listingSlug={listing.slug}
            currentPriceCents={listing.priceCents}
            listingStatus={listing.status}
            isLoggedIn={isLoggedIn}
            existingAlert={userPriceAlert ? {
              alertId: userPriceAlert.id,
              alertType: userPriceAlert.alertType,
              targetPriceCents: userPriceAlert.targetPriceCents ?? undefined,
              percentDrop: userPriceAlert.percentDrop ?? undefined,
            } : null}
          />
        </div>
      )}

      {!isUnavailable && (
        <div className="mt-6">
          <ListingAuthActions
            listingId={listing.id}
            availableQuantity={listing.availableQuantity ?? 0}
            sellerId={listing.seller.userId}
            slug={listing.slug}
          />
        </div>
      )}

      {!isUnavailable && listing.allowOffers && !isOwnListing && (
        <div className="mt-3">
          <MakeOfferSection
            listing={{
              id: listing.id,
              title: listing.title,
              priceCents: listing.priceCents,
              images: listing.images,
              allowOffers: listing.allowOffers,
              autoAcceptOfferCents: listing.autoAcceptOfferCents,
              autoDeclineOfferCents: listing.autoDeclineOfferCents,
            }}
            addresses={userAddresses.map((a) => ({ id: a.id, label: a.label, name: a.name, isDefault: a.isDefault }))}
            pendingOfferCount={pendingOfferCount}
          />
        </div>
      )}

      {!isUnavailable && !isOwnListing && watcherOffer && (
        <div className="mt-4">
          <WatcherOfferBanner
            watcherOfferId={watcherOffer.offer.id}
            listingId={listing.id}
            listingSlug={listing.slug}
            discountedPriceCents={watcherOffer.offer.discountedPriceCents}
            originalPriceCents={watcherOffer.listingPriceCents}
            expiresAt={watcherOffer.offer.expiresAt}
            isWatcher={watcherOffer.isWatcher}
            isLoggedIn={isLoggedIn}
            defaultAddressId={userAddresses.find((a) => a.isDefault)?.id ?? userAddresses[0]?.id ?? null}
          />
        </div>
      )}

      {!isUnavailable && !isOwnListing && (
        <div className="mt-4">
          <MessageSellerButton
            listingId={listing.id}
            sellerId={listing.seller.userId}
            isLoggedIn={isLoggedIn}
            existingConversationId={existingConversationId}
            listingSlug={listing.slug}
          />
        </div>
      )}

      {isUnavailable && (
        <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-yellow-800">
          This item is no longer available
        </div>
      )}
    </>
  );
}
