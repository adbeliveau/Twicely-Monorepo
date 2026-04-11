import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { ConditionBadge } from './condition-badge';
import { formatPrice, buildListingUrl } from '@twicely/utils/format';
import { cn } from '@twicely/utils';
import type { ListingCardData } from '@/types/listings';
import { SellerRatingBadge } from '@/components/review/seller-rating-badge';

type CardEmphasis = 'social' | 'specs' | 'collectible' | 'default';

interface ListingCardProps {
  listing: ListingCardData;
  cardEmphasis?: CardEmphasis | null;
}

export function ListingCard({ listing, cardEmphasis }: ListingCardProps) {
  const emphasis: CardEmphasis = cardEmphasis ?? listing.cardEmphasis ?? 'default';

  const hasDiscount =
    listing.originalPriceCents !== null &&
    listing.originalPriceCents > listing.priceCents;

  const isCollectible = emphasis === 'collectible';
  const isSocial = emphasis === 'social';
  const isSpecs = emphasis === 'specs';

  return (
    <Link
      href={buildListingUrl(listing.slug)}
      aria-label={`${listing.title}, ${formatPrice(listing.priceCents)}, ${listing.condition}`}
      className={cn(
        'group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md',
        isCollectible && 'border-amber-300 bg-amber-50/30',
      )}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {listing.primaryImageUrl ? (
          <Image
            src={listing.primaryImageUrl}
            alt={listing.primaryImageAlt ?? listing.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        {listing.freeShipping && (
          <span className="absolute left-2 top-2 rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white">
            Free Shipping
          </span>
        )}
        {(listing.fulfillmentType === 'LOCAL_ONLY' || listing.fulfillmentType === 'SHIP_AND_LOCAL') && (
          <span className="absolute left-2 bottom-2 flex items-center gap-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-xs font-medium text-white">
            <MapPin className="h-3 w-3" />
            {listing.distanceMiles != null
              ? `${listing.distanceMiles < 1 ? '<1' : Math.round(listing.distanceMiles)} mi`
              : 'Local'}
          </span>
        )}
        {/* specs: condition badge overlay top-right */}
        {isSpecs && (
          <span className="absolute right-2 top-2">
            <ConditionBadge condition={listing.condition} />
          </span>
        )}
        {/* collectible: verified authentic badge top-right */}
        {isCollectible && (
          <span className="absolute right-2 top-2 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            Verified Authentic
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* social: seller identity above price */}
        {isSocial && (
          <div className="mb-2 flex items-center gap-2">
            {listing.sellerAvatarUrl ? (
              <Image
                src={listing.sellerAvatarUrl}
                alt={listing.sellerName}
                width={28}
                height={28}
                className="rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {listing.sellerName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-sm font-medium">
              {listing.sellerName}
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">
          {listing.title}
        </h3>

        {/* specs: brand subtitle */}
        {isSpecs && listing.brand && (
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            {listing.brand}
          </p>
        )}

        {/* Price */}
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-base font-semibold">
            {formatPrice(listing.priceCents)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(listing.originalPriceCents!)}
            </span>
          )}
        </div>

        {/* Condition — hidden for specs (shown as image overlay); visible for all other variants */}
        {!isSpecs && (
          <div className="mt-1.5">
            <ConditionBadge condition={listing.condition} />
          </div>
        )}

        {/* Seller — hidden for social (shown above) */}
        {!isSocial && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">
              {listing.sellerName}
            </p>
            <SellerRatingBadge
              averageRating={listing.sellerAverageRating}
              totalReviews={listing.sellerTotalReviews}
              showStars={listing.sellerShowStars}
            />
          </div>
        )}

        {/* social: rating shown below seller identity */}
        {isSocial && (
          <div className="mt-1.5">
            <SellerRatingBadge
              averageRating={listing.sellerAverageRating}
              totalReviews={listing.sellerTotalReviews}
              showStars={listing.sellerShowStars}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
