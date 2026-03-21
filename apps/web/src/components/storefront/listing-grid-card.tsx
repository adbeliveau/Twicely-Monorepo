'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@twicely/utils';
import { formatPrice } from '@twicely/utils/format';
import type { ListingCardData } from '@/types/listings';

interface ListingGridCardProps {
  listing: ListingCardData;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function ListingGridCard({
  listing,
  selectable = false,
  selected = false,
  onSelect,
}: ListingGridCardProps) {
  const content = (
    <>
      {/* Selection checkbox */}
      {selectable && (
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
      )}

      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {listing.primaryImageUrl ? (
          <Image
            src={listing.primaryImageUrl}
            alt={listing.primaryImageAlt ?? listing.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}

        {/* Price overlay */}
        <div className="absolute bottom-0 left-0 bg-black/70 text-white px-2 py-1 rounded-tr-md font-semibold text-sm">
          {formatPrice(listing.priceCents)}
        </div>
      </div>

      {/* Title */}
      <p className="mt-1.5 text-sm line-clamp-1 px-1">{listing.title}</p>
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(listing.id)}
        className={cn(
          'group relative block w-full overflow-hidden rounded-lg border bg-card text-left transition-all',
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
      className="group relative block w-full overflow-hidden rounded-lg border border-border bg-card hover:shadow-md transition-all"
    >
      {content}
    </Link>
  );
}
