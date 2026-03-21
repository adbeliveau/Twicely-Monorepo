import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getWatchlistItems } from '@/lib/queries/watchlist';
import { WatchlistList } from '@/components/pages/buying/watchlist-list';
import { Heart } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Watchlist | Twicely',
};

export default async function WatchlistPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/buying/watchlist');
  }

  const items = await getWatchlistItems(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <p className="text-muted-foreground">Items you&apos;re keeping an eye on</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 rounded-lg border bg-white">
          <Heart className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            You&apos;re not watching any items yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Browse listings and click the heart to add items to your watchlist
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90"
            >
              Browse Items
            </Link>
          </div>
        </div>
      ) : (
        <WatchlistList items={items} />
      )}
    </div>
  );
}
