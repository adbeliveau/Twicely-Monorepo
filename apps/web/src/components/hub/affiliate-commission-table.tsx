'use client';

import { useState, useTransition } from 'react';
import { fetchCommissionsForAdmin } from '@/lib/actions/affiliate-admin-queries';
import type { CommissionAdminRow } from '@/lib/queries/affiliate-payout-admin';

const STATUS_TABS = ['All', 'PENDING', 'PAYABLE', 'PAID', 'REVERSED'] as const;

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

function statusBadge(status: string): React.ReactElement {
  const colorMap: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PAYABLE: 'bg-blue-100 text-blue-700',
    PAID: 'bg-green-100 text-green-700',
    REVERSED: 'bg-red-100 text-red-700',
  };
  const cls = colorMap[status] ?? 'bg-gray-100 text-gray-700';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

interface Props {
  affiliateId: string;
  initialRows: CommissionAdminRow[];
  initialTotal: number;
}

const PAGE_SIZE = 10;

export function AffiliateCommissionTable({ affiliateId, initialRows, initialTotal }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<CommissionAdminRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string>('All');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fetchPage(newPage: number, status: string) {
    startTransition(async () => {
      const result = await fetchCommissionsForAdmin({
        affiliateId,
        status: status === 'All' ? undefined : status,
        page: newPage,
        pageSize: PAGE_SIZE,
      });
      if (result.success && result.rows) {
        setRows(result.rows);
        setTotal(result.total ?? 0);
        setPage(newPage);
      }
    });
  }

  function handleStatusChange(status: string) {
    setActiveStatus(status);
    fetchPage(1, status);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleStatusChange(tab)}
            disabled={isPending}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeStatus === tab
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Product</th>
              <th className="px-4 py-3 font-medium text-gray-600">Gross</th>
              <th className="px-4 py-3 font-medium text-gray-600">Net</th>
              <th className="px-4 py-3 font-medium text-gray-600">Rate</th>
              <th className="px-4 py-3 font-medium text-gray-600">Commission</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Hold Expires</th>
              <th className="px-4 py-3 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.commissionId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{row.subscriptionProduct}</td>
                <td className="px-4 py-3">{formatCents(row.grossRevenueCents)}</td>
                <td className="px-4 py-3">{formatCents(row.netRevenueCents)}</td>
                <td className="px-4 py-3">{formatBps(row.commissionRateBps)}</td>
                <td className="px-4 py-3 font-medium">{formatCents(row.commissionCents)}</td>
                <td className="px-4 py-3">{statusBadge(row.status)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {row.holdExpiresAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.createdAt.toLocaleDateString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No commissions yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button
            onClick={() => fetchPage(page - 1, activeStatus)}
            disabled={page <= 1 || isPending}
            className="rounded px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => fetchPage(page + 1, activeStatus)}
            disabled={page >= totalPages || isPending}
            className="rounded px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
