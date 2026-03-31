'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { Star, ShieldCheck } from 'lucide-react';
import { toggleFollow } from '@/lib/actions/follow';
import { Button } from '@twicely/ui/button';
import { LocalMeetupStats } from '@/components/local/local-meetup-stats';
import type { StorefrontSeller, StorefrontStats } from '@/lib/queries/storefront';

interface StorefrontHeaderProps {
  seller: StorefrontSeller;
  stats: StorefrontStats;
  isFollowing: boolean;
  accentColor: string | null;
}

export function StorefrontHeader({
  seller,
  stats,
  isFollowing,
  accentColor,
}: StorefrontHeaderProps) {
  const [isPending, startTransition] = useTransition();
  const accent = accentColor ?? '#7C3AED';

  function handleFollowClick() {
    startTransition(async () => {
      await toggleFollow(seller.userId);
    });
  }

  const memberYear = seller.memberSince.getFullYear();

  // Render star rating
  function renderStars(rating: number | null) {
    if (rating === null) return null;
    const rounded = Math.round(rating * 2) / 2; // Round to nearest 0.5
    const fullStars = Math.floor(rounded);
    const hasHalf = rounded % 1 !== 0;

    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              i < fullStars
                ? 'fill-amber-400 text-amber-400'
                : i === fullStars && hasHalf
                  ? 'fill-amber-400/50 text-amber-400'
                  : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{ '--store-accent': accent } as React.CSSProperties}
    >
      {/* Banner */}
      <div className="relative h-32 sm:h-48 w-full overflow-hidden">
        {seller.branding.bannerUrl ? (
          <Image
            src={seller.branding.bannerUrl}
            alt={`${seller.storeName} banner`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${accent} 0%, ${accent}99 100%)`,
            }}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Logo + Info */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-10 sm:-mt-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          {/* Logo */}
          <div className="flex items-end gap-4">
            <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg">
              {seller.branding.logoUrl ? (
                <Image
                  src={seller.branding.logoUrl}
                  alt={`${seller.storeName} logo`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-2xl sm:text-3xl font-bold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {seller.storeName?.[0]?.toUpperCase() ?? 'S'}
                </div>
              )}
            </div>

            {/* Store name and stats (desktop) */}
            <div className="hidden sm:block pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {seller.storeName}
                </h1>
                {stats.trustBadge && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {stats.trustBadge}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                {stats.averageRating !== null ? (
                  <>
                    {renderStars(stats.averageRating)}
                    <span>
                      {stats.averageRating.toFixed(1)} ({stats.totalReviews}{' '}
                      {stats.totalReviews === 1 ? 'review' : 'reviews'})
                    </span>
                    <span>·</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-400">No reviews yet</span>
                    <span>·</span>
                  </>
                )}
                <span>{stats.listingCount} listings</span>
                <span>·</span>
                <span>{stats.followerCount} followers</span>
                <span>·</span>
                <span>Member since {memberYear}</span>
              </div>
            </div>
          </div>

          {/* Follow button (desktop) */}
          <div className="hidden sm:block pb-1">
            <Button
              onClick={handleFollowClick}
              disabled={isPending}
              variant={isFollowing ? 'outline' : 'default'}
              style={
                !isFollowing
                  ? { backgroundColor: accent, borderColor: accent }
                  : { borderColor: accent, color: accent }
              }
              className="min-w-[100px]"
            >
              {isPending ? '...' : isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        </div>

        {/* Mobile: Store name, stats, and follow button */}
        <div className="mt-3 sm:hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {seller.storeName}
              </h1>
              {stats.trustBadge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 mt-0.5">
                  <ShieldCheck className="h-3 w-3" />
                  {stats.trustBadge}
                </span>
              )}
            </div>
            <Button
              onClick={handleFollowClick}
              disabled={isPending}
              variant={isFollowing ? 'outline' : 'default'}
              size="sm"
              style={
                !isFollowing
                  ? { backgroundColor: accent, borderColor: accent }
                  : { borderColor: accent, color: accent }
              }
            >
              {isPending ? '...' : isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
            {stats.averageRating !== null ? (
              <>
                {renderStars(stats.averageRating)}
                <span>
                  {stats.averageRating.toFixed(1)} ({stats.totalReviews})
                </span>
                <span>·</span>
              </>
            ) : (
              <>
                <span className="text-gray-400">No reviews</span>
                <span>·</span>
              </>
            )}
            <span>{stats.listingCount} listings</span>
            <span>·</span>
            <span>{stats.followerCount} followers</span>
            <span>·</span>
            <span>Since {memberYear}</span>
          </div>
        </div>

        {/* Announcement bar */}
        {seller.branding.announcement && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
            <span className="mr-2">📢</span>
            {seller.branding.announcement}
          </div>
        )}

        {/* Local meetup stats — shown when seller has local activity */}
        {stats.localMetrics !== null && (
          <LocalMeetupStats
            completedCount={stats.localMetrics.localCompletedCount}
            completionRate={stats.localMetrics.localCompletionRate}
            responseLabel={stats.localMetrics.localAvgResponseLabel}
            variant="storefront"
          />
        )}
      </div>
    </div>
  );
}
