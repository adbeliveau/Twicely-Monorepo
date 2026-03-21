import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getFinanceKPIs, getFinanceOverviewEnriched } from '@/lib/queries/admin-finance';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { formatCentsToDollars } from '@twicely/finance/format';
import { DollarSign, TrendingUp, CreditCard, Percent, AlertTriangle, Clock } from 'lucide-react';

export const metadata: Metadata = { title: 'Finance | Twicely Hub' };

export default async function FinancePage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Payout')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const [kpis, enriched] = await Promise.all([
    getFinanceKPIs(30),
    getFinanceOverviewEnriched(30),
  ]);

  const links = [
    { href: '/fin/ledger', label: 'Ledger Explorer', desc: 'Browse all ledger entries' },
    { href: '/fin/payouts', label: 'Payouts', desc: 'View payout history and status' },
    { href: '/fin/adjustments', label: 'Adjustments', desc: 'Manual credits and debits' },
    { href: '/fin/costs', label: 'Platform Costs', desc: 'Absorbed cost summary' },
    { href: '/fin/recon', label: 'Reconciliation', desc: 'Stripe vs platform reconciliation' },
    { href: '/fin/chargebacks', label: 'Chargebacks', desc: 'Stripe dispute ledger entries' },
    { href: '/fin/holds', label: 'Reserve Holds', desc: 'Active escrow holds' },
    { href: '/fin/subscriptions', label: 'Subscriptions', desc: 'Platform subscription metrics' },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Finance" description="Revenue, fees, and payouts" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="GMV (30d)" value={formatCentsToDollars(kpis.gmvCents)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Transaction Fees" value={formatCentsToDollars(kpis.feesCollectedCents)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Payouts Sent" value={formatCentsToDollars(kpis.payoutsSentCents)} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Take Rate" value={`${kpis.takeRatePercent}%`} icon={<Percent className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Payment Processing (30d)" value={formatCentsToDollars(enriched.stripeProcessingFeesCents)} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Pending Release" value={formatCentsToDollars(enriched.pendingReleaseCents)} icon={<Clock className="h-4 w-4" />} />
        <StatCard label="Chargebacks (30d)" value={String(enriched.chargebackCount30d)} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {/* Revenue breakdown by type */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-primary">Revenue by Type (30d)</h3>
        <table className="w-full text-sm">
          <thead className="bg-primary/5 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-primary/70">Type</th>
              <th className="px-3 py-2 font-medium text-primary/70">Amount</th>
              <th className="px-3 py-2 font-medium text-primary/70">% of Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enriched.revenueBreakdown.map((row) => (
              <tr key={row.type}>
                <td className="px-3 py-2 text-gray-700">{row.label}</td>
                <td className="px-3 py-2 font-medium">{formatCentsToDollars(row.amountCents)}</td>
                <td className="px-3 py-2 text-gray-500">{row.percentOfTotal}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm">
            <h3 className="text-sm font-semibold text-primary">{link.label}</h3>
            <p className="mt-1 text-xs text-gray-500">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
