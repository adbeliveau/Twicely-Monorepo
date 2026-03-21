import type { Metadata } from 'next';
import Link from 'next/link';
import { DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getAffiliatePayoutList, getAffiliatePayoutStats } from '@/lib/queries/affiliate-payout-admin';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { AffiliatePayoutTrigger } from '@/components/hub/affiliate-payout-trigger';

export const metadata: Metadata = { title: 'Affiliate Payouts | Twicely Hub' };

const STATUS_TABS = ['All', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
const PAGE_SIZE = 25;

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function statusBadge(status: string): React.ReactElement {
  const colorMap: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };
  const cls = colorMap[status] ?? 'bg-gray-100 text-gray-700';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default async function AffiliatePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const { ability } = await staffAuthorize();

  if (!ability.can('manage', 'AffiliatePayout')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const status = params.status && params.status !== 'All' ? params.status : undefined;

  const [stats, { rows, total }] = await Promise.all([
    getAffiliatePayoutStats(),
    getAffiliatePayoutList({ status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeTab = params.status ?? 'All';

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Affiliate Payouts"
        description={`${total} payout${total !== 1 ? 's' : ''} total`}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total Paid Out"
          value={formatCents(stats.totalPayoutsCents)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Completed Payouts"
          value={stats.totalPayoutsCount}
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatCard
          label="Pending Commissions"
          value={formatCents(stats.pendingPayoutsCents)}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Failed Payouts"
          value={stats.failedPayoutsCount}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <AffiliatePayoutTrigger />

      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const href =
            tab === 'All'
              ? '/fin/affiliate-payouts'
              : `/fin/affiliate-payouts?status=${tab}`;
          return (
            <Link
              key={tab}
              href={href}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Affiliate</th>
              <th className="px-4 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Method</th>
              <th className="px-4 py-3 font-medium text-primary/70">Status</th>
              <th className="px-4 py-3 font-medium text-primary/70">Period</th>
              <th className="px-4 py-3 font-medium text-primary/70">Created</th>
              <th className="px-4 py-3 font-medium text-primary/70">Completed</th>
              <th className="px-4 py-3 font-medium text-primary/70">Failed Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.payoutId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/usr/affiliates/${row.affiliateId}`}
                    className="font-medium text-primary hover:text-primary/80"
                  >
                    {row.affiliateUsername ?? row.affiliateEmail ?? row.affiliateId}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium">{formatCents(row.amountCents)}</td>
                <td className="px-4 py-3 text-gray-600">{row.method}</td>
                <td className="px-4 py-3">{statusBadge(row.status)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {row.periodStart.toLocaleDateString()} – {row.periodEnd.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.createdAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.completedAt ? row.completedAt.toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {row.failedReason ?? '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No affiliate payouts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <Link
            href={`/fin/affiliate-payouts?page=${page - 1}${status ? `&status=${status}` : ''}`}
            className={`rounded px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 ${
              page <= 1 ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            Previous
          </Link>
          <span>Page {page} of {totalPages}</span>
          <Link
            href={`/fin/affiliate-payouts?page=${page + 1}${status ? `&status=${status}` : ''}`}
            className={`rounded px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 ${
              page >= totalPages ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
