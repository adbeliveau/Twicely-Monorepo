'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toggleFollow } from '@/lib/actions/follow';
import type { SerializedFollowedSeller } from './following-list';

interface Props {
  seller: SerializedFollowedSeller;
  onUnfollow: (userId: string) => void;
}

export function FollowedSellerCard({ seller, onUnfollow }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);

  function handleUnfollow() {
    startTransition(async () => {
      const result = await toggleFollow(seller.userId);
      if (result.success && !result.isFollowing) {
        onUnfollow(seller.userId);
      }
    });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hasNewListings =
    seller.lastListedAt !== null && new Date(seller.lastListedAt) > sevenDaysAgo;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <Link
        href={seller.storeSlug ? `/st/${seller.storeSlug}` : '#'}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        {seller.avatarUrl ? (
          <img
            src={seller.avatarUrl}
            alt={seller.storeName ?? 'Seller'}
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-lg font-medium text-muted-foreground">
              {(seller.storeName ?? 'S').charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {seller.storeName ?? 'Unnamed Seller'}
            </span>
            {hasNewListings && (
              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                New
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
            <span>{seller.listingCount} listings</span>
            <span>·</span>
            <span>{seller.followerCount} followers</span>
          </div>
        </div>
      </Link>

      <button
        onClick={handleUnfollow}
        disabled={isPending}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={
          isPending
            ? 'text-sm px-3 py-1.5 rounded-md border text-muted-foreground opacity-50'
            : isHovering
              ? 'text-sm px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors'
              : 'text-sm px-3 py-1.5 rounded-md border text-foreground hover:bg-accent/10 transition-colors'
        }
      >
        {isPending ? 'Unfollowing…' : isHovering ? 'Unfollow' : 'Following'}
      </button>
    </div>
  );
}
