import type { Metadata } from 'next';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getTransactionOverviewKPIs } from '@/lib/queries/admin-orders';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatCard } from '@/components/admin/stat-card';
import { ShoppingCart, DollarSign, RotateCcw, TrendingUp } from 'lucide-react';

export const metadata: Metadata = { title: 'Transactions | Twicely Hub' };

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function TransactionsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'Order')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const kpis = await getTransactionOverviewKPIs();

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Transactions" description="Order and payment management" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Order Volume (30d)" value={kpis.orderVolume30d} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Payment Volume (30d)" value={formatCents(kpis.paymentVolume30d)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Refund Rate (30d)" value={`${kpis.refundRate30d}%`} icon={<RotateCcw className="h-4 w-4" />} />
        <StatCard label="Avg Order Value" value={formatCents(kpis.avgOrderValue)} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/tx/orders" className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">All Orders</h3>
          <p className="mt-1 text-sm text-gray-500">View and manage all marketplace orders</p>
        </Link>
        <Link href="/tx/payments" className="block rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-sm">
          <h3 className="text-sm font-semibold text-primary">Payments</h3>
          <p className="mt-1 text-sm text-gray-500">View payment intent status and history</p>
        </Link>
      </div>
    </div>
  );
}
