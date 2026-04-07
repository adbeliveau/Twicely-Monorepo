import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@twicely/ui/avatar';
import { formatDate } from '@twicely/utils/format';
import { ShieldCheck, Star } from 'lucide-react';
import { LocalMeetupStats } from '@/components/local/local-meetup-stats';
import type { SellerLocalMetrics } from '@/lib/queries/local-metrics';

interface SellerCardProps {
  seller: {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
    storeName: string | null;
    storeSlug: string | null;
    averageRating: number | null;
    totalReviews: number;
    memberSince: Date;
  };
  trustBadge?: string | null;
  localMetrics?: SellerLocalMetrics | null;
  fulfillmentType?: string;
}

export function SellerCard({ seller, trustBadge, localMetrics, fulfillmentType }: SellerCardProps) {
  const initials = seller.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          {seller.avatarUrl && (
            <AvatarImage src={seller.avatarUrl} alt={seller.displayName} />
          )}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">
            {seller.storeName ?? seller.displayName}
          </h3>

          {/* Trust Badge */}
          {trustBadge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 mt-0.5">
              <ShieldCheck className="h-3 w-3" />
              {trustBadge}
            </span>
          )}

          {/* Rating */}
          <div className="mt-1 text-sm text-muted-foreground">
            {seller.averageRating !== null ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-flex" aria-label={`${seller.averageRating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${i < Math.round(seller.averageRating!) ? 'fill-amber-500 text-amber-500' : 'fill-none text-amber-300'}`}
                      strokeWidth={1.5}
                    />
                  ))}
                </span>
                <span className="ml-1">({seller.totalReviews} reviews)</span>
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>

          {/* Member since */}
          <p className="mt-1 text-sm text-muted-foreground">
            Member since {formatDate(seller.memberSince)}
          </p>

          {/* Local meetup stats — shown when listing supports local pickup */}
          {localMetrics !== null &&
            localMetrics !== undefined &&
            (fulfillmentType === 'LOCAL_ONLY' ||
              fulfillmentType === 'SHIP_AND_LOCAL') && (
              <div className="mt-2">
                <LocalMeetupStats
                  completedCount={localMetrics.localCompletedCount}
                  completionRate={localMetrics.localCompletionRate}
                  responseLabel={localMetrics.localAvgResponseLabel}
                  variant="listing-detail"
                />
              </div>
            )}
        </div>
      </div>

      {/* View Store Link — only for sellers with a storefront */}
      {seller.storeSlug && (
        <Link
          href={`/st/${seller.storeSlug}`}
          className="mt-4 block text-center text-sm font-medium text-primary hover:underline"
        >
          View Store →
        </Link>
      )}
    </div>
  );
}
