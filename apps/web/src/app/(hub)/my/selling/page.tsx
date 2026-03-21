import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerDashboardStats, getSellerRecentActivity } from '@/lib/queries/seller-dashboard';
import { getActiveTrialInfo } from '@/lib/queries/trial-eligibility';
import { getConnectedAccounts } from '@/lib/queries/crosslister';
import { DashboardStats } from '@/components/seller/dashboard-stats';
import { RecentActivity } from '@/components/seller/recent-activity';
import { AwaitingShipmentAlert } from '@/components/seller/awaiting-shipment-alert';
import { TrialBanner, TrialStatus } from '@/components/subscriptions';
import { Button } from '@twicely/ui/button';
import { Card, CardContent } from '@twicely/ui/card';
import { Plus, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Selling Overview | Twicely',
  robots: 'noindex',
};

export default async function SellingOverviewPage() {
  // Layout guarantees authenticated seller - just need userId for queries
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect('/auth/login');
  }

  // Fetch dashboard data
  const [stats, recentActivity, activeTrial, connectedAccounts] = await Promise.all([
    getSellerDashboardStats(session.user.id),
    getSellerRecentActivity(session.user.id, 10),
    getActiveTrialInfo(session.user.id),
    getConnectedAccounts(session.user.id),
  ]);

  const hasConnectedAccounts = connectedAccounts.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Selling Overview</h1>
      </div>

      {/* Trial Status (if in trial) */}
      {activeTrial && (
        <TrialStatus
          trialEnd={activeTrial.trialEnd}
          productName={activeTrial.productName}
          subscribeUrl="/my/selling/subscription"
        />
      )}

      {/* Trial Eligibility Banner (if not in trial and eligible) */}
      {!activeTrial && (
        <TrialBanner
          userId={session.user.id}
          productType="STORE"
          subscribeUrl="/pricing"
        />
      )}

      {/* Awaiting Shipment Alert (conditional) */}
      {stats.awaitingShipmentCount > 0 && (
        <AwaitingShipmentAlert count={stats.awaitingShipmentCount} />
      )}

      {/* Dashboard Stats Cards */}
      <DashboardStats stats={stats} />

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/my/selling/listings/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Listing
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/my/selling/orders">View Orders</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/my/selling/shipping">Shipping Profiles</Link>
        </Button>
      </div>

      {/* Get started with Crosslister (shown when seller has no connected accounts) */}
      {!hasConnectedAccounts && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-semibold">Import your listings from other platforms</p>
                <p className="text-sm text-muted-foreground">
                  Already selling on eBay, Poshmark, or Mercari? Import your inventory for
                  free — no subscription required.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link href="/my/selling/crosslist">Get started</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Feed */}
      <RecentActivity activities={recentActivity} />
    </div>
  );
}
