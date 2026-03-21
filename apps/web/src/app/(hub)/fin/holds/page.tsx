// NAV_ENTRY: /fin/holds — Reserve Holds
import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getHoldList, getHoldStats } from '@/lib/queries/admin-finance-holds';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { formatCentsToDollars } from '@twicely/finance/format';
import { Lock, Unlock, DollarSign } from 'lucide-react';

export const metadata: Metadata = { title: 'Reserve Holds | Twicely Hub' };

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'LedgerEntry')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const filter = (params.filter as 'active' | 'released' | 'all') ?? 'active';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));

  const [stats, holdData] = await Promise.all([
    getHoldStats(),
    getHoldList({ status: filter, page, pageSize: 50 }),
  ]);

  const totalPages = Math.ceil(holdData.total / 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Reserve Holds" description="Active escrow holds and recent releases (read-only)" />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Active Holds" value={String(stats.activeCount)} icon={<Lock className="h-4 w-4" />} />
        <StatCard label="Total Held" value={formatCentsToDollars(stats.totalHeldCents)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Released (30d)" value={String(stats.released30dCount)} icon={<Unlock className="h-4 w-4" />} />
      </div>

      <div className="flex gap-2">
        <Link
          href="/fin/holds?filter=active"
          className={`rounded-md px-4 py-2 text-sm font-medium ${filter === 'active' ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Active Only
        </Link>
        <Link
          href="/fin/holds?filter=released"
          className={`rounded-md px-4 py-2 text-sm font-medium ${filter === 'released' ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Released (30d)
        </Link>
        <Link
          href="/fin/holds?filter=all"
          className={`rounded-md px-4 py-2 text-sm font-medium ${filter === 'all' ? 'bg-primary text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          All
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Seller</th>
              <th className="px-4 py-3 font-medium text-primary/70">Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Reason</th>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
              <th className="px-4 py-3 font-medium text-primary/70">Memo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {holdData.holds.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {h.userId ? (
                    <Link href={`/usr/${h.userId}`} className="text-primary hover:text-primary/80">
                      {h.userId}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${h.type === 'RESERVE_HOLD' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {h.type}
                  </span>
                </td>
                <td className={`px-4 py-3 font-medium ${h.amountCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCentsToDollars(h.amountCents)}
                </td>
                <td className="px-4 py-3 text-gray-500">{h.reasonCode ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{h.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-[160px]">{h.memo ?? '—'}</td>
              </tr>
            ))}
            {holdData.holds.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No holds found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/fin/holds?filter=${filter}&page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Previous
            </Link>
          )}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/fin/holds?filter=${filter}&page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
