import Link from 'next/link';
import Image from 'next/image';
import { ConditionBadge } from './condition-badge';
import { formatPrice, buildListingUrl } from '@twicely/utils/format';
import type { ListingCardData } from '@/types/listings';
import { SellerRatingBadge } from '@/components/review/seller-rating-badge';

interface ListingCardProps {
  listing: ListingCardData;
}

export function ListingCard({ listing }: ListingCardProps) {
  const hasDiscount =
    listing.originalPriceCents !== null &&
    listing.originalPriceCents > listing.priceCents;

  return (
    <Link
      href={buildListingUrl(listing.slug)}
      aria-label={`${listing.title}, ${formatPrice(listing.priceCents)}, ${listing.condition}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
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
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">
          {listing.title}
        </h3>

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

        {/* Condition */}
        <div className="mt-1.5">
          <ConditionBadge condition={listing.condition} />
        </div>

        {/* Seller */}
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
      </div>
    </Link>
  );
}
