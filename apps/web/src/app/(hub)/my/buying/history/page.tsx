import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@twicely/auth';
import { getBrowsingHistory, type HistorySortBy } from '@/lib/queries/browsing-history';
import { HistoryList } from '@/components/pages/buying/history-list';
import { Clock } from 'lucide-react';
import Link from 'next/link';
import { SortToggle } from './sort-toggle';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Browsing History | Twicely',
};

interface PageProps {
  searchParams: Promise<{ sort?: string }>;
}

export default async function BrowsingHistoryPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=/my/buying/history');
  }

  const params = await searchParams;
  const sortBy: HistorySortBy = params.sort === 'most_viewed' ? 'most_viewed' : 'recent';

  const items = await getBrowsingHistory(session.user.id, { sortBy });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Browsing History</h1>
          <p className="text-muted-foreground">Items you&apos;ve recently viewed</p>
        </div>
        {items.length > 0 && <SortToggle currentSort={sortBy} />}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 rounded-lg border bg-white">
          <Clock className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No browsing history yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Start exploring to see items here
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
        <HistoryList items={items} />
      )}
    </div>
  );
}
