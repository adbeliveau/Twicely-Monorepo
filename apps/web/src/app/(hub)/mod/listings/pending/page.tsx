// NAV_ENTRY: Listings Pending First Review | /mod/listings/pending | requires MODERATION or ADMIN
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPendingFirstReviewListings } from '@/lib/queries/admin-moderation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Listings Pending Review | Twicely Hub' };

function formatCents(cents: number | null): string {
  if (!cents) return '—';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function ListingsPendingFirstReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const { listings, total } = await getPendingFirstReviewListings(page, 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Listings Pending First Review"
        description={`${total} flagged listing${total === 1 ? '' : 's'} with no content report`}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Title</th>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-4 py-3 font-medium text-primary/70">Price</th>
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
                <td className="px-4 py-3 text-gray-500">{l.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/mod/listings/${l.id}`}
                    className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No listings awaiting first review
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
