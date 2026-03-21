import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAffiliateApplications } from '@/lib/queries/affiliate-admin';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Affiliates | Twicely Hub' };

const TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Banned', value: 'BANNED' },
] as const;

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export default async function AffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const activeStatus = params.status ?? 'PENDING';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const pageSize = 50;

  const { rows, total } = await getAffiliateApplications({
    status: activeStatus || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Affiliates" description={`${total} affiliates`} />

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => {
          const isActive = (!params.status && tab.value === 'PENDING') || params.status === tab.value;
          return (
            <Link
              key={tab.value}
              href={`/usr/affiliates${tab.value ? `?status=${tab.value}` : ''}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Username</th>
              <th className="px-4 py-3 font-medium text-primary/70">Email</th>
              <th className="px-4 py-3 font-medium text-primary/70">Tier</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Commission</th>
              <th className="px-4 py-3 font-medium text-primary/70">Total Earned</th>
              <th className="px-4 py-3 font-medium text-primary/70">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/usr/affiliates/${row.id}`}
                    className="font-medium text-primary hover:text-primary/80"
                  >
                    {row.username ?? row.displayName ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{row.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    row.tier === 'INFLUENCER'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {row.tier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    row.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : row.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-700'
                      : row.status === 'SUSPENDED'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3">{formatBps(row.commissionRateBps)}</td>
                <td className="px-4 py-3">{formatCents(row.totalEarnedCents)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {row.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No affiliates found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/usr/affiliates?status=${activeStatus}&page=${page - 1}`}
              className="rounded border px-3 py-1 hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="px-3 py-1 text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/usr/affiliates?status=${activeStatus}&page=${page + 1}`}
              className="rounded border px-3 py-1 hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
