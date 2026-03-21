import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@twicely/ui/avatar';
import { formatDate } from '@twicely/utils/format';
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
  localMetrics?: SellerLocalMetrics | null;
  fulfillmentType?: string;
}

export function SellerCard({ seller, localMetrics, fulfillmentType }: SellerCardProps) {
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

          {/* Rating */}
          <div className="mt-1 text-sm text-muted-foreground">
            {seller.averageRating !== null ? (
              <span>
                {'★'.repeat(Math.round(seller.averageRating))}
                {'☆'.repeat(5 - Math.round(seller.averageRating))}
                <span className="ml-1">
                  ({seller.totalReviews} reviews)
                </span>
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
