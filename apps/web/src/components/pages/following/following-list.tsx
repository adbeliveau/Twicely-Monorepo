'use client';

import { useState } from 'react';
import { FollowedSellerCard } from './followed-seller-card';

export interface SerializedFollowedSeller {
  userId: string;
  storeName: string | null;
  storeSlug: string | null;
  avatarUrl: string | null;
  performanceBand: string;
  memberSince: string;
  listingCount: number;
  followerCount: number;
  lastListedAt: string | null;
  followedAt: string;
}

interface Props {
  sellers: SerializedFollowedSeller[];
}

export function FollowingList({ sellers: initialSellers }: Props) {
  const [sellers, setSellers] = useState(initialSellers);

  function handleUnfollow(userId: string) {
    setSellers((prev) => prev.filter((s) => s.userId !== userId));
  }

  if (sellers.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">
          You&apos;re not following anyone yet. Discover sellers by browsing listings or stores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sellers.map((seller) => (
        <FollowedSellerCard
          key={seller.userId}
          seller={seller}
          onUnfollow={handleUnfollow}
        />
      ))}
    </div>
  );
}
