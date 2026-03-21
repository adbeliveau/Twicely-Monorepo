'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { ConditionBadge } from '@/components/shared/condition-badge';
import { formatPrice } from '@twicely/utils/format';
import type { BrowsingHistoryItem } from '@/lib/queries/browsing-history';

interface RecentlyViewedCarouselProps {
  items: BrowsingHistoryItem[];
  title?: string;
}

export function RecentlyViewedCarousel({
  items,
  title = 'Recently Viewed',
}: RecentlyViewedCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 200;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>

      {/* Desktop scroll buttons */}
      <div className="hidden md:block">
        <Button
          variant="outline"
          size="icon"
          className="absolute -left-4 top-1/2 z-10 h-8 w-8 rounded-full bg-white shadow-md"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-4 top-1/2 z-10 h-8 w-8 rounded-full bg-white shadow-md"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <Link
            key={item.listingId}
            href={`/i/${item.slug}`}
            className="w-36 shrink-0 snap-start rounded-lg border bg-white overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square relative bg-gray-100">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="144px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400 text-xs">
                  No image
                </div>
              )}
            </div>
            <div className="p-2">
              <h3 className="text-xs font-medium line-clamp-2 leading-tight">
                {item.title}
              </h3>
              <p className="mt-1 text-sm font-bold">{formatPrice(item.priceCents)}</p>
              <div className="mt-1">
                <ConditionBadge condition={item.condition} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
