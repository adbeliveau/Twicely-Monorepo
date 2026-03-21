'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, X, ShoppingCart, Heart, MessageSquare, CheckCircle } from 'lucide-react';
import { Button } from '@twicely/ui/button';
import { clearBrowsingHistoryAction, removeFromHistoryAction } from '@/lib/actions/browsing-history';
import { formatPrice } from '@twicely/utils/format';
import type { BrowsingHistoryItem } from '@/lib/queries/browsing-history';

interface HistoryListProps {
  items: BrowsingHistoryItem[];
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

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function HistoryList({ items: initialItems }: HistoryListProps) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleClearAll = () => {
    setItems([]);

    startTransition(async () => {
      const result = await clearBrowsingHistoryAction();
      if (!result.success) {
        setItems(initialItems);
      }
    });
  };

  const handleRemoveItem = (listingId: string) => {
    setRemovingId(listingId);
    const prevItems = items;
    setItems(items.filter((item) => item.listingId !== listingId));

    startTransition(async () => {
      const result = await removeFromHistoryAction(listingId);
      if (!result.success) {
        setItems(prevItems);
      }
      setRemovingId(null);
    });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Clear History
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.listingId}
            className="group relative rounded-lg border bg-white overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Remove button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRemoveItem(item.listingId);
              }}
              disabled={removingId === item.listingId}
              className="absolute top-2 right-2 z-10 p-1 rounded-full bg-white/90 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove from history"
            >
              <X className="h-4 w-4 text-gray-500 hover:text-gray-700" />
            </button>

            <Link href={`/i/${item.slug}`}>
              <div className="aspect-square relative bg-gray-100">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    No image
                  </div>
                )}

                {/* Engagement indicators overlay */}
                <div className="absolute bottom-2 left-2 flex gap-1">
                  {item.didPurchase && (
                    <span className="p-1 rounded-full bg-green-500 text-white" title="Purchased">
                      <CheckCircle className="h-3 w-3" />
                    </span>
                  )}
                  {item.didAddToCart && !item.didPurchase && (
                    <span className="p-1 rounded-full bg-blue-500 text-white" title="Added to cart">
                      <ShoppingCart className="h-3 w-3" />
                    </span>
                  )}
                  {item.didAddToWatchlist && (
                    <span className="p-1 rounded-full bg-pink-500 text-white" title="Watching">
                      <Heart className="h-3 w-3" />
                    </span>
                  )}
                  {item.didMakeOffer && !item.didPurchase && (
                    <span className="p-1 rounded-full bg-purple-500 text-white" title="Made offer">
                      <MessageSquare className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
                <p className="mt-1 text-lg font-bold">{formatPrice(item.priceCents)}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground truncate max-w-[60%]">
                    {item.sellerName ?? CONDITION_LABELS[item.condition] ?? item.condition}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(item.lastViewedAt)}
                  </p>
                </div>
                {item.viewCount > 1 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Viewed {item.viewCount} times
                  </p>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
