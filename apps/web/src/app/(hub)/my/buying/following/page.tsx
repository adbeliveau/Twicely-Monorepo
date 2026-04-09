import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getFollowedSellers, getFollowingCount } from '@/lib/queries/follow';
import { FollowingList } from '@/components/pages/following/following-list';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Following | Twicely' };
export const dynamic = 'force-dynamic';

export default async function FollowingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login');
  }

  const [sellers, followingCount] = await Promise.all([
    getFollowedSellers(session.user.id),
    getFollowingCount(session.user.id),
  ]);

  // Serialize dates for client component
  const serialized = sellers.map((s) => ({
    userId: s.userId,
    storeName: s.storeName,
    storeSlug: s.storeSlug,
    avatarUrl: s.avatarUrl,
    performanceBand: s.performanceBand,
    memberSince: s.memberSince.toISOString(),
    listingCount: s.listingCount,
    followerCount: s.followerCount,
    lastListedAt: s.lastListedAt ? s.lastListedAt.toISOString() : null,
    followedAt: s.followedAt.toISOString(),
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Following</h1>
        <p className="text-muted-foreground mt-1">
          {followingCount} {followingCount === 1 ? 'seller' : 'sellers'} you follow
        </p>
      </div>
      <FollowingList sellers={serialized} />
    </div>
  );
}
