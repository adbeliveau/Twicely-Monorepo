'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { toggleWatchlistAction } from '@/lib/actions/watchlist';
import { formatPrice } from '@twicely/utils/format';
import type { WatchlistItemSummary } from '@/lib/queries/watchlist';

interface WatchlistListProps {
  items: WatchlistItemSummary[];
}

const CONDITION_LABELS: Record<string, string> = {
  NEW_WITH_TAGS: 'New with tags',
  NEW_WITHOUT_TAGS: 'New without tags',
  NEW_WITH_DEFECTS: 'New with defects',
  LIKE_NEW: 'Like new',
  VERY_GOOD: 'Very good',
  GOOD: 'Good',
  ACCEPTABLE: 'Acceptable',
};

export function WatchlistList({ items: initialItems }: WatchlistListProps) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = (listingId: string) => {
    setRemovingId(listingId);
    // Optimistic removal
    setItems((prev) => prev.filter((item) => item.listingId !== listingId));

    startTransition(async () => {
      const result = await toggleWatchlistAction(listingId);
      if (!result.success) {
        // Revert on error - find the item and add it back
        const removedItem = initialItems.find((i) => i.listingId === listingId);
        if (removedItem) {
          setItems((prev) => [...prev, removedItem].sort(
            (a, b) => b.watchedAt.getTime() - a.watchedAt.getTime()
          ));
        }
      }
      setRemovingId(null);
    });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.listingId}
          className="group relative rounded-lg border bg-white overflow-hidden"
        >
          <Link href={`/i/${item.slug}`} className="block">
            <div className="aspect-square relative bg-gray-100">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  No image
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
              <p className="mt-1 text-lg font-bold">{formatPrice(item.priceCents)}</p>
              <p className="text-xs text-muted-foreground">
                {CONDITION_LABELS[item.condition] ?? item.condition}
              </p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 bg-white/80 hover:bg-white"
            onClick={() => handleRemove(item.listingId)}
            disabled={isPending && removingId === item.listingId}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove from watchlist</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
