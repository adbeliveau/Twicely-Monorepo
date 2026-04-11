import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getListingPageData, buildBreadcrumbs, buildJsonLd } from '@/lib/queries/listing-page';
import { getSellerLocalMetrics } from '@/lib/queries/local-metrics';
import { generateListingMetadata } from './listing-page-metadata';
import { recordViewAction } from '@/lib/actions/browsing-history';
import { auth } from '@twicely/auth';
import { formatPrice } from '@twicely/utils/format';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { ListingCard } from '@/components/shared/listing-card';
import { ListingGrid } from '@/components/shared/listing-grid';
import { ImageGallery } from '@/components/pages/listing/image-gallery';
import { ListingVideoPlayer } from '@/components/pages/listing/listing-video-player';
import { ListingInfo } from '@/components/pages/listing/listing-info';
import { SellerCard } from '@/components/pages/listing/seller-card';
import { SellerRatingSummary } from '@/components/review/seller-rating-summary';
import { ReviewCard } from '@/components/review/review-card';
import { AuthenticationBadge } from '@/components/listing/authentication-badge';
import { getAuthenticationBadgeForListing } from '@/lib/queries/authentication';
import { RecentlyViewedCarousel } from '@/components/listing/recently-viewed-carousel';
import { ShareButton } from '@/components/shared/share-button';
import { PriceHistoryChart } from '@/components/listing/price-history-chart';
import { SoldComparables } from '@/components/listing/sold-comparables';
import { QaSection } from '@/components/qa/qa-section';
import { ListingActionButtons } from '@/components/pages/listing/listing-action-buttons';
import { getConversationForListing } from '@/lib/queries/messaging';
import { getListingAffiliateInfo } from '@/lib/queries/affiliate-listing';
import { AffiliateClickTracker } from '@/components/affiliate/affiliate-click-tracker';
import { AffiliateLinkButton } from '@/components/affiliate/affiliate-link-button';
import { getTrustBadge, type PerformanceBand } from '@twicely/commerce/performance-band';
import { ListingAreaMap } from '@/components/pages/listing/listing-area-map';

export const revalidate = 300; // 5 min ISR

interface ListingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ action?: string }>;
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  return generateListingMetadata({ params });
}

export default async function ListingPage({ params, searchParams }: ListingPageProps) {
  const { slug } = await params;
  const { action } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user?.id ?? null;
  const isLoggedIn = !!currentUserId;
  const autoWatch = action === 'watch';

  const data = await getListingPageData(slug, currentUserId);
  if (!data) notFound();

  const [localMetrics, affiliateInfo] = await Promise.all([
    getSellerLocalMetrics(data.listing.seller.userId),
    getListingAffiliateInfo(currentUserId, data.listing.seller.userId),
  ]);

  const { listing, similarListings, sellerListings, reviewSummary, recentReviews, dsrAverages,
    userAddresses, pendingOfferCount, userIsWatching, userNotifyPriceDrop, watcherCount, recentlyViewed, priceHistory, soldComparables, watcherOffer, userPriceAlert, isOwnListing } = data;

  const authBadge = await getAuthenticationBadgeForListing(listing.id);

  const isUnavailable = listing.status === 'SOLD' || listing.status === 'ENDED' || listing.status === 'RESERVED';
  const isReserved = listing.status === 'RESERVED';
  const existingConvId = currentUserId && !isOwnListing
    ? await getConversationForListing(listing.id, currentUserId) : null;

  // Fire-and-forget: record view in browsing history
  if (currentUserId && !isOwnListing) recordViewAction(listing.id).catch(() => {});

  // Build breadcrumbs
  const breadcrumbItems = buildBreadcrumbs(listing);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(listing, isUnavailable)).replace(/<\//g, '<\\/') }}
      />

      <div className="flex flex-col gap-8">
        <Breadcrumbs items={breadcrumbItems} />
        <AffiliateClickTracker listingId={listing.id} listingSlug={listing.slug ?? slug} />

        {isReserved && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center text-blue-800">
            This item is currently reserved for a local pickup
          </div>
        )}

        {isUnavailable && !isReserved && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center text-yellow-800">
            This item is no longer available
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {listing.videoUrl && (
              <ListingVideoPlayer
                videoUrl={listing.videoUrl}
                thumbnailUrl={listing.videoThumbUrl}
                title={listing.title}
                durationSeconds={listing.videoDurationSeconds}
              />
            )}
            <ImageGallery images={listing.images} title={listing.title} />
          </div>

          <div className="lg:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h1 className="text-2xl font-bold">{listing.title}</h1>
              <div className="flex shrink-0 gap-2">
                <ShareButton
                  url={`https://twicely.co/i/${listing.slug}`}
                  title={listing.title}
                  description={`${formatPrice(listing.priceCents)} on Twicely`}
                />
                {isLoggedIn && !isOwnListing && (
                  <Link
                    href={`/h/contact?type=MODERATION&listingId=${listing.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Report
                  </Link>
                )}
                {affiliateInfo.isAffiliate &&
                  affiliateInfo.affiliateStatus === 'ACTIVE' &&
                  affiliateInfo.sellerOptedIn &&
                  !isOwnListing &&
                  listing.slug && (
                    <AffiliateLinkButton
                      listingSlug={listing.slug}
                      affiliateCode={affiliateInfo.affiliateCode!}
                      commissionBps={affiliateInfo.commissionBps}
                    />
                  )}
              </div>
            </div>
            {authBadge && (
              <div className="mb-3">
                <AuthenticationBadge
                  authenticationStatus={authBadge.status}
                  certificateNumber={authBadge.certificateNumber}
                />
              </div>
            )}
            <ListingInfo listing={listing} />

            {priceHistory.length > 1 && (
              <div className="mt-4">
                <PriceHistoryChart history={priceHistory} currentPriceCents={listing.priceCents} />
              </div>
            )}

            {soldComparables.length >= 2 && (
              <div className="mt-4">
                <SoldComparables comparables={soldComparables} currentPriceCents={listing.priceCents} />
              </div>
            )}

            <ListingActionButtons
              listing={listing}
              isOwnListing={isOwnListing}
              isUnavailable={isUnavailable}
              isLoggedIn={isLoggedIn}
              currentUserId={currentUserId}
              userIsWatching={userIsWatching}
              userNotifyPriceDrop={userNotifyPriceDrop}
              watcherCount={watcherCount}
              pendingOfferCount={pendingOfferCount}
              userAddresses={userAddresses}
              userPriceAlert={userPriceAlert}
              watcherOffer={watcherOffer}
              existingConversationId={existingConvId}
              autoWatch={autoWatch}
            />

            <div className="mt-6">
              <SellerCard
                seller={listing.seller}
                trustBadge={getTrustBadge(listing.seller.performanceBand as PerformanceBand)}
                localMetrics={localMetrics.hasLocalActivity ? localMetrics : null}
                fulfillmentType={listing.fulfillmentType}
              />
            </div>

            {(listing.fulfillmentType === 'LOCAL_ONLY' || listing.fulfillmentType === 'SHIP_AND_LOCAL') &&
              listing.sellerLat != null && listing.sellerLng != null && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Seller Area</h3>
                <ListingAreaMap lat={listing.sellerLat} lng={listing.sellerLng} />
              </div>
            )}

            {reviewSummary && (
              <div className="mt-6">
                <SellerRatingSummary
                  averageRating={reviewSummary.averageRating}
                  displayStars={reviewSummary.displayStars}
                  totalReviews={reviewSummary.totalReviews}
                  currentBand={reviewSummary.currentBand}
                  trustBadge={reviewSummary.trustBadge}
                  trustBadgeSecondary={reviewSummary.trustBadgeSecondary}
                  showStars={reviewSummary.showStars}
                  dsrAverages={dsrAverages}
                />
              </div>
            )}
          </div>
        </div>

        {recentReviews.reviews.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Reviews</h2>
              {recentReviews.totalCount > 3 && listing.seller.storeSlug && (
                <Link href={`/st/${listing.seller.storeSlug}/reviews`} className="text-sm text-primary hover:underline">
                  See all {recentReviews.totalCount} reviews
                </Link>
              )}
            </div>
            <div className="space-y-4">
              {recentReviews.reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
            </div>
          </section>
        )}

        <QaSection
          listingId={listing.id}
          currentUserId={currentUserId}
          isOwnListing={isOwnListing}
          isListingActive={listing.status === 'ACTIVE'}
        />

        {sellerListings.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">More from {listing.seller.storeName ?? listing.seller.displayName}</h2>
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4">
                {sellerListings.map((item) => (
                  <div key={item.id} className="w-48 shrink-0"><ListingCard listing={item} /></div>
                ))}
              </div>
            </div>
          </section>
        )}

        {similarListings.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Similar Items</h2>
            <ListingGrid listings={similarListings} />
          </section>
        )}

        {recentlyViewed.length > 0 && <RecentlyViewedCarousel items={recentlyViewed} />}
      </div>
    </>
  );
}
