import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getManualAdjustments } from '@/lib/queries/admin-finance';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdjustmentForm } from '@/components/admin/actions/adjustment-form';

export const metadata: Metadata = { title: 'Adjustments | Twicely Hub' };

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function AdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'LedgerEntry')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const { adjustments, total } = await getManualAdjustments(page, 50);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Manual Adjustments"
        description={`${total} adjustments`}
        actions={
          ability.can('manage', 'LedgerEntry') ? (
            <AdjustmentForm />
          ) : undefined
        }
      />

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-primary/70">Date</th>
              <th className="px-4 py-3 font-medium text-primary/70">Type</th>
              <th className="px-4 py-3 font-medium text-primary/70">Amount</th>
              <th className="px-4 py-3 font-medium text-primary/70">Reason</th>
              <th className="px-4 py-3 font-medium text-primary/70">Memo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {adjustments.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{a.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    a.type === 'MANUAL_CREDIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{a.type === 'MANUAL_CREDIT' ? 'Credit' : 'Debit'}</span>
                </td>
                <td className={`px-4 py-3 font-medium ${a.amountCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCents(a.amountCents)}
                </td>
                <td className="px-4 py-3 text-gray-500">{a.reasonCode ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{a.memo ?? '—'}</td>
              </tr>
            ))}
            {adjustments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No adjustments</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
