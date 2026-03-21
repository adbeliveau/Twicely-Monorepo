'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { cn } from '@twicely/utils';
import { ConditionBadge } from '@/components/shared/condition-badge';
import { formatPrice } from '@twicely/utils/format';
import type { ListingCardData } from '@/types/listings';

interface SelectableListingCardProps {
  listing: ListingCardData;
  selected: boolean;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function SelectableListingCard({
  listing,
  selected,
  onSelect,
  disabled,
}: SelectableListingCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(listing.id)}
      disabled={disabled}
      className={cn(
        'group relative block w-full overflow-hidden rounded-lg border bg-card text-left transition-all',
        selected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:shadow-md',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          'absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/50 bg-background'
        )}
      >
        {selected && <Check className="h-4 w-4" />}
      </div>

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
          <span className="absolute right-2 top-2 rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white">
            Free Shipping
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">
          {listing.title}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-base font-semibold">
            {formatPrice(listing.priceCents)}
          </span>
        </div>
        <div className="mt-1.5">
          <ConditionBadge condition={listing.condition} />
        </div>
      </div>
    </button>
  );
}
