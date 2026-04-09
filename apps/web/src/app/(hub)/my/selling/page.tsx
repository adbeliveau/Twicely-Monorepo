import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerDashboardStats, getSellerRecentActivity } from '@/lib/queries/seller-dashboard';
import { getReturnCountsBySeller } from '@/lib/queries/returns';
import { getActiveTrialInfo } from '@/lib/queries/trial-eligibility';
import { getConnectedAccounts } from '@/lib/queries/crosslister';
import { DashboardStats } from '@/components/seller/dashboard-stats';
import { RecentActivity } from '@/components/seller/recent-activity';
import { AwaitingShipmentAlert } from '@/components/seller/awaiting-shipment-alert';
import { TrialBanner, TrialStatus } from '@/components/subscriptions';
import { Button } from '@twicely/ui/button';
import { Card, CardContent } from '@twicely/ui/card';
import { Plus, RefreshCw, Store, RotateCcw } from 'lucide-react';

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
  const [stats, recentActivity, activeTrial, connectedAccounts, returnCounts] = await Promise.all([
    getSellerDashboardStats(session.user.id),
    getSellerRecentActivity(session.user.id, 10),
    getActiveTrialInfo(session.user.id),
    getConnectedAccounts(session.user.id),
    getReturnCountsBySeller(session.user.id),
  ]);

  const pendingReturnCount = returnCounts.PENDING_SELLER ?? 0;

  const hasConnectedAccounts = connectedAccounts.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Selling Overview</h1>
      </div>

      {/* New Seller Onboarding CTAs (no listings yet) */}
      {stats.activeListings === 0 && stats.draftListings === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-lg">List your first item</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a listing and start reaching buyers. Free to list — you only pay when you sell.
                  </p>
                </div>
                <Button asChild size="lg">
                  <Link href="/my/selling/listings/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Listing
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Store className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Set up your storefront</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a branded store page, add your logo, and customize your seller profile.
                  </p>
                </div>
                <Button asChild variant="outline" size="lg">
                  <Link href="/my/selling/onboarding?flow=business">
                    Set up storefront
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          subscribeUrl="/my/selling/subscription"
        />
      )}

      {/* Awaiting Shipment Alert (conditional) */}
      {stats.awaitingShipmentCount > 0 && (
        <AwaitingShipmentAlert count={stats.awaitingShipmentCount} />
      )}

      {/* Pending Returns Alert (conditional) */}
      {pendingReturnCount > 0 && (
        <Link
          href="/my/selling/returns"
          className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 hover:bg-yellow-100 transition-colors"
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">{pendingReturnCount} return {pendingReturnCount === 1 ? 'request' : 'requests'}</span>
            {' '}awaiting your response
          </span>
        </Link>
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
