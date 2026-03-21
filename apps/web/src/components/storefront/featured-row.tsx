'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { formatPrice } from '@twicely/utils/format';
import type { ListingCardData } from '@/types/listings';

interface FeaturedRowProps {
  listings: ListingCardData[];
  accentColor?: string;
}

export function FeaturedRow({ listings, accentColor = '#7C3AED' }: FeaturedRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (listings.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 280; // card width + gap
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative">
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-lg font-semibold"
          style={{ color: accentColor }}
        >
          Featured Items
        </h2>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/i/${listing.slug}`}
            className="group flex-shrink-0 w-[260px] snap-start"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
              {listing.primaryImageUrl ? (
                <Image
                  src={listing.primaryImageUrl}
                  alt={listing.primaryImageAlt ?? listing.title}
                  fill
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                  sizes="260px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  No image
                </div>
              )}
              {listing.freeShipping && (
                <span className="absolute bottom-2 left-2 rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white">
                  Free shipping
                </span>
              )}
            </div>
            <div className="mt-2">
              <h3 className="truncate text-sm font-medium text-gray-900 group-hover:text-violet-600">
                {listing.title}
              </h3>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">
                {formatPrice(listing.priceCents)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
