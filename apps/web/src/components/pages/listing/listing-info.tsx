import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@twicely/ui/badge';
import { ConditionBadge } from '@/components/shared/condition-badge';
import { formatPrice, formatDate } from '@twicely/utils/format';
import { HANDLING_FLAG_LABELS } from '@/lib/local/handling-flags';
import type { LocalHandlingFlag } from '@/lib/local/handling-flags';
import type { ListingDetailData } from '@/types/listings';

interface ListingInfoProps {
  listing: ListingDetailData;
}

export function ListingInfo({ listing }: ListingInfoProps) {
  const hasDiscount =
    listing.originalPriceCents !== null &&
    listing.originalPriceCents > listing.priceCents;

  return (
    <div className="flex flex-col gap-6">
      {/* Price */}
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">
            {formatPrice(listing.priceCents)}
          </span>
          {hasDiscount && (
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(listing.originalPriceCents!)}
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <ConditionBadge condition={listing.condition} />
        {listing.freeShipping ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Free Shipping
          </Badge>
        ) : listing.shippingCents > 0 ? (
          <Badge variant="secondary">
            +{formatPrice(listing.shippingCents)} shipping
          </Badge>
        ) : null}
        {listing.allowOffers && (
          <Badge variant="outline">Accepts Offers</Badge>
        )}
      </div>

      {/* Local Pickup Requirements */}
      {listing.fulfillmentType !== 'SHIP_ONLY' && listing.localHandlingFlags.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900 mb-2">Local Pickup Requirements</p>
          <ul className="space-y-1">
            {listing.localHandlingFlags.map((flag) => (
              <li key={flag} className="text-sm text-amber-800 flex items-start gap-2">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
                {HANDLING_FLAG_LABELS[flag as LocalHandlingFlag] ?? flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Description */}
      <div>
        <h2 className="mb-2 font-semibold">Description</h2>
        <p className="whitespace-pre-wrap text-muted-foreground">
          {listing.description || 'No description provided.'}
        </p>
      </div>

      {/* Tags */}
      {listing.tags.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold">Tags</h2>
          <div className="flex flex-wrap gap-1">
            {listing.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Item Details */}
      <div>
        <h2 className="mb-2 font-semibold">Item Details</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {listing.brand && (
            <>
              <dt className="text-muted-foreground">Brand</dt>
              <dd>{listing.brand}</dd>
            </>
          )}
          {listing.category && (
            <>
              <dt className="text-muted-foreground">Category</dt>
              <dd>
                <Link
                  href={
                    listing.category.parent
                      ? `/c/${listing.category.parent.slug}/${listing.category.slug}`
                      : `/c/${listing.category.slug}`
                  }
                  className="hover:underline"
                >
                  {listing.category.parent
                    ? `${listing.category.parent.name} › ${listing.category.name}`
                    : listing.category.name}
                </Link>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Listed</dt>
          <dd>{formatDate(listing.activatedAt ?? listing.createdAt)}</dd>
        </dl>
      </div>
    </div>
  );
}
