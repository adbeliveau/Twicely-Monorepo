import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getPlatformCosts } from '@/lib/queries/admin-finance';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { DollarSign } from 'lucide-react';

export const metadata: Metadata = { title: 'Platform Costs | Twicely Hub' };

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'LedgerEntry')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const { costs, total, totalCostsCents } = await getPlatformCosts(page, 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Platform Costs" description="Absorbed costs summary (read-only)" />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Absorbed Costs" value={formatCents(totalCostsCents)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Cost Entries" value={total} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
              <th className="px-4 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Memo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {costs.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{c.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3 font-medium text-red-600">{formatCents(c.amountCents)}</td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-[300px]">{c.memo ?? '—'}</td>
              </tr>
            ))}
            {costs.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No absorbed costs</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
