import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getModeratedListings } from '@/lib/queries/admin-moderation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ListingActions } from '@/components/admin/actions/moderation-actions';

export const metadata: Metadata = { title: 'Moderated Listings | Twicely Hub' };

type TabValue = 'FLAGGED' | 'SUPPRESSED' | 'REMOVED' | 'ALL';

const TABS: { label: string; value: TabValue }[] = [
  { label: 'Flagged', value: 'FLAGGED' },
  { label: 'Suppressed', value: 'SUPPRESSED' },
  { label: 'Removed', value: 'REMOVED' },
  { label: 'All', value: 'ALL' },
];

function formatCents(cents: number | null): string {
  return cents ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
}

export default async function ModerationListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const activeTab = ((params.tab ?? 'FLAGGED') as TabValue);
  const enforcementFilter = activeTab === 'ALL'
    ? null
    : activeTab as 'FLAGGED' | 'SUPPRESSED' | 'REMOVED';

  const { listings, total } = await getModeratedListings(enforcementFilter, page, 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Moderated Listings"
        description={`${total} listing${total === 1 ? '' : 's'}`}
      />

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/mod/listings?tab=${tab.value}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Title</th>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-4 py-3 font-medium text-primary/70">Price</th>
              <th className="px-4 py-3 font-medium text-primary/70">State</th>
              <th className="px-4 py-3 font-medium text-primary/70">Flagged</th>
              <th className="px-4 py-3 font-medium text-primary/70">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                  <Link href={`/mod/listings/${l.id}`} className="hover:text-primary hover:underline">
                    {l.title ?? '(untitled)'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{l.sellerName}</td>
                <td className="px-4 py-3">{formatCents(l.priceCents)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                    {l.enforcementState}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{l.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <ListingActions listingId={l.id} />
                </td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No listings in this category
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
