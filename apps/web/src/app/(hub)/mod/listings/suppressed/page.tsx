// NAV_ENTRY: Suppressed Listings | /mod/listings/suppressed | requires MODERATION or ADMIN
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSuppressedListings } from '@/lib/queries/admin-moderation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { SuppressedListingActions } from './suppressed-listing-actions';

export const metadata: Metadata = { title: 'Suppressed Listings | Twicely Hub' };

function formatCents(cents: number | null): string {
  if (!cents) return '—';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function SuppressedListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('update', 'Listing')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const { listings, total } = await getSuppressedListings(page, 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Suppressed Listings"
        description={`${total} listing${total === 1 ? '' : 's'} hidden from search but not deleted`}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Title</th>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-4 py-3 font-medium text-primary/70">Price</th>
              <th className="px-4 py-3 font-medium text-primary/70">Suppressed</th>
              <th className="px-4 py-3 font-medium text-primary/70">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">
                  <Link href={`/mod/listings/${l.id}`} className="hover:text-primary hover:underline">
                    {l.title ?? '(untitled)'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{l.sellerName}</td>
                <td className="px-4 py-3">{formatCents(l.priceCents)}</td>
                <td className="px-4 py-3 text-gray-500">{l.updatedAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <SuppressedListingActions listingId={l.id} />
                </td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  No suppressed listings
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
