'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@twicely/utils';
import { ConditionBadge } from '@/components/shared/condition-badge';
import { formatPrice } from '@twicely/utils/format';
import type { ListingCardData } from '@/types/listings';

interface ListingListCardProps {
  listing: ListingCardData;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function ListingListCard({
  listing,
  selectable = false,
  selected = false,
  onSelect,
}: ListingListCardProps) {
  const content = (
    <>
      {/* Selection checkbox */}
      {selectable && (
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors flex-shrink-0',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/50 bg-background'
          )}
        >
          {selected && <Check className="h-4 w-4" />}
        </div>
      )}

      {/* Image */}
      <div className="relative h-[120px] w-[120px] flex-shrink-0 overflow-hidden rounded-md bg-muted">
        {listing.primaryImageUrl ? (
          <Image
            src={listing.primaryImageUrl}
            alt={listing.primaryImageAlt ?? listing.title}
            fill
            className="object-cover"
            sizes="120px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <h3 className="text-sm font-medium line-clamp-2">{listing.title}</h3>
        <p className="mt-1 text-base font-semibold">{formatPrice(listing.priceCents)}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <ConditionBadge condition={listing.condition} />
          {listing.freeShipping ? (
            <span className="text-xs text-green-600 font-medium">Free Shipping</span>
          ) : listing.shippingCents > 0 ? (
            <span className="text-xs text-muted-foreground">
              +{formatPrice(listing.shippingCents)} shipping
            </span>
          ) : null}
        </div>
      </div>
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(listing.id)}
        className={cn(
          'flex gap-4 items-center rounded-lg border bg-card p-3 text-left transition-all w-full',
          selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:shadow-md'
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={`/i/${listing.slug}`}
      className="flex gap-4 rounded-lg border border-border bg-card p-3 hover:shadow-md transition-all"
    >
      {content}
    </Link>
  );
}
