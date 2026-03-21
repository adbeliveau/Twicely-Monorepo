import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { DollarSign, Package, Eye, ShoppingCart } from 'lucide-react';
import type { SellerDashboardStats } from '@/lib/queries/seller-dashboard';

interface DashboardStatsProps {
  stats: SellerDashboardStats;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  // Calculate percentage changes
  const revenueChange = calculatePercentChange(stats.revenue30d, stats.revenuePrev30d);
  const ordersChange = calculatePercentChange(stats.orders30d, stats.ordersPrev30d);
  const viewsChange = calculatePercentChange(stats.views30d, stats.viewsPrev30d);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Revenue (30 days)"
        value={formatCurrency(stats.revenue30d)}
        change={revenueChange}
        icon={DollarSign}
      />
      <StatCard
        title="Orders (30 days)"
        value={stats.orders30d.toString()}
        subtitle={
          stats.awaitingShipmentCount > 0
            ? `${stats.awaitingShipmentCount} awaiting shipment`
            : undefined
        }
        change={ordersChange}
        icon={ShoppingCart}
      />
      <StatCard
        title="Active Listings"
        value={stats.activeListings.toString()}
        subtitle={stats.draftListings > 0 ? `${stats.draftListings} draft` : undefined}
        icon={Package}
      />
      <StatCard
        title="Views (30 days)"
        value={stats.views30d.toString()}
        change={viewsChange}
        icon={Eye}
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number | null;
  icon: React.ComponentType<{ className?: string }>;
}

function StatCard({ title, value, subtitle, change, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <CardDescription className="mt-1">{subtitle}</CardDescription>
        )}
        {change !== undefined && change !== null && (
          <p className={`text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}% vs prior 30 days
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return ((current - previous) / previous) * 100;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
