import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ReconDashboard } from '@/components/admin/recon-dashboard';
import {
  getReconciliationSummary,
  getDiscrepancies,
  getReconciliationHistory,
  getBalanceComparison,
} from '@/lib/queries/reconciliation';

export const metadata: Metadata = { title: 'Reconciliation | Twicely Hub' };

export default async function ReconPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Payout')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [summary, balance, discrepancyResult, history] = await Promise.all([
    getReconciliationSummary(),
    getBalanceComparison(),
    getDiscrepancies({ page: 1, pageSize: 50 }),
    getReconciliationHistory(20),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reconciliation"
        description="Stripe vs platform ledger reconciliation"
      />

      <ReconDashboard
        summary={summary}
        balance={balance}
        discrepancies={discrepancyResult.discrepancies}
        discrepancyTotal={discrepancyResult.total}
        history={history}
      />
    </div>
  );
}
