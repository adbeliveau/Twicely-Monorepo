'use client';

import { useState, useTransition } from 'react';
import { fetchPayoutsForAdmin } from '@/lib/actions/affiliate-admin-queries';
import type { PayoutAdminRow } from '@/lib/queries/affiliate-payout-admin';

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

interface Props {
  affiliateId: string;
  initialRows: PayoutAdminRow[];
  initialTotal: number;
}

const PAGE_SIZE = 10;

export function AffiliatePayoutTable({ affiliateId, initialRows, initialTotal }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<PayoutAdminRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fetchPage(newPage: number) {
    startTransition(async () => {
      const result = await fetchPayoutsForAdmin({
        affiliateId,
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

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 font-medium text-gray-600">Method</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 font-medium text-gray-600">Period</th>
              <th className="px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="px-4 py-3 font-medium text-gray-600">Completed</th>
              <th className="px-4 py-3 font-medium text-gray-600">Failed Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
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
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No payouts yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button
            onClick={() => fetchPage(page - 1)}
            disabled={page <= 1 || isPending}
            className="rounded px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => fetchPage(page + 1)}
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
