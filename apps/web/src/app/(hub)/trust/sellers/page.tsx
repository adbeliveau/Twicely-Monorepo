// NAV_ENTRY (sub-page, reachable from /trust overview)

import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getSellerTrustList } from '@/lib/queries/admin-trust';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Sellers | Trust & Safety | Twicely Hub' };

const BAND_COLORS: Record<string, string> = {
  POWER_SELLER: '#7C3AED',
  TOP_RATED: '#F59E0B',
  ESTABLISHED: '#10B981',
  EMERGING: '#6B7280',
  SUSPENDED: '#EF4444',
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function SellersListPage({ searchParams }: PageProps) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'TrustSafety')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const { rows, total } = await getSellerTrustList(page, 50);
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="All Sellers"
        description={`${total} seller${total !== 1 ? 's' : ''} ranked by performance score`}
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Seller</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Score</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Band</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Enforcement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No sellers found</td></tr>
            ) : (
              rows.map((s) => {
                const bandColor = BAND_COLORS[s.performanceBand] ?? '#6B7280';
                return (
                  <tr key={s.userId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/trust/sellers/${s.userId}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{s.sellerScore}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${bandColor}20`, color: bandColor }}
                      >
                        {s.performanceBand.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.enforcementLevel ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/trust/sellers?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Previous</Link>
            )}
            {page < totalPages && (
              <Link href={`/trust/sellers?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">Next</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
