'use client';

import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@twicely/utils/format';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

interface SoldComparable {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  condition: string;
  imageUrl: string | null;
  soldAt: Date;
}

interface SoldComparablesProps {
  comparables: SoldComparable[];
  currentPriceCents: number;
}

const CONDITION_LABELS: Record<string, string> = {
  NEW_WITH_TAGS: 'New',
  NEW_WITHOUT_TAGS: 'New',
  NEW_WITH_DEFECTS: 'New',
  LIKE_NEW: 'Like new',
  VERY_GOOD: 'Very good',
  GOOD: 'Good',
  ACCEPTABLE: 'Acceptable',
};

export function SoldComparables({ comparables, currentPriceCents }: SoldComparablesProps) {
  // Per spec: only show section if there are 2+ comparable sales
  if (comparables.length < 2) {
    return null;
  }

  // Calculate average sold price
  const avgPriceCents = Math.round(
    comparables.reduce((sum, c) => sum + c.priceCents, 0) / comparables.length
  );

  const priceDiff = currentPriceCents - avgPriceCents;
  const priceDiffPercent = avgPriceCents > 0 ? Math.round((priceDiff / avgPriceCents) * 100) : 0;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Similar Items Sold</h3>
        <div className="text-right">
          <p className="text-sm font-medium">Avg: {formatPrice(avgPriceCents)}</p>
          {priceDiff !== 0 && (
            <p className={`text-xs ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {priceDiff > 0 ? '+' : ''}{priceDiffPercent}% vs this listing
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {comparables.map((item) => (
          <Link
            key={item.id}
            href={`/i/${item.slug}`}
            className="group flex w-24 shrink-0 flex-col"
          >
            <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-md bg-gray-100">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  sizes="96px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">
                  No image
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                <span className="text-xs font-medium text-white">SOLD</span>
              </div>
            </div>
            <p className="text-xs font-medium">{formatPrice(item.priceCents)}</p>
            <p className="text-xs text-muted-foreground">
              {CONDITION_LABELS[item.condition] ?? item.condition}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTimeAgo(new Date(item.soldAt))}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
