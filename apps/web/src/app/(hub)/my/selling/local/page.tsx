import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerLocalDashboardData } from '@/lib/queries/local-seller-dashboard';
import { getActiveLocalTransactionsForUser, getCompletedLocalTransactionsForUser } from '@/lib/queries/local-transaction';
import { STATUS_LABELS, STATUS_VARIANT } from '@/components/local/local-meetup-status';
import { Badge } from '@twicely/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Button } from '@twicely/ui/button';
import { MapPin, Calendar, CheckCircle, Shield, FileText, Map, Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Local Pickup | Twicely',
  robots: 'noindex',
};

const TIER_STYLES: Record<string, string> = {
  RELIABLE: 'bg-green-100 text-green-800',
  INCONSISTENT: 'bg-yellow-100 text-yellow-800',
  UNRELIABLE: 'bg-red-100 text-red-800',
};

export default async function LocalDashboardPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/local');
  }

  if (!session.isSeller && !session.delegationId) {
    redirect('/my');
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  const [dashboard, activeTx, recentCompleted] = await Promise.all([
    getSellerLocalDashboardData(userId),
    getActiveLocalTransactionsForUser(userId),
    getCompletedLocalTransactionsForUser(userId, 5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Local Pickup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your in-person meetups and local transactions
        </p>
      </div>

      {dashboard.suspendedUntil && dashboard.suspendedUntil > new Date() && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Local transactions suspended until {dashboard.suspendedUntil.toLocaleDateString()}.
            Your shipped transactions are unaffected.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4" />
              Active Meetups
            </div>
            <p className="text-2xl font-bold mt-1">{dashboard.activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle className="h-4 w-4" />
              Completed (30d)
            </div>
            <p className="text-2xl font-bold mt-1">{dashboard.completed30dCount}</p>
            <p className="text-xs text-muted-foreground">{dashboard.allTimeCount} all time</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <MapPin className="h-4 w-4" />
              Completion Rate
            </div>
            <p className="text-2xl font-bold mt-1">{Math.round(dashboard.completionRate * 100)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Shield className="h-4 w-4" />
              Reliability
            </div>
            <div className="mt-1">
              <Badge className={TIER_STYLES[dashboard.reliabilityTier] ?? ''}>
                {dashboard.reliabilityTier}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{dashboard.reliabilityMarks} marks</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Meetups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Active Meetups</CardTitle>
          {activeTx.length > 0 && (
            <Link href="/my/selling/local/transactions?filter=active" className="text-sm text-primary hover:underline">
              View all
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {activeTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active meetups right now.</p>
          ) : (
            <div className="space-y-3">
              {activeTx.slice(0, 5).map((tx) => (
                <Link
                  key={tx.id}
                  href={`/my/selling/orders/${tx.orderId}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">Order #{tx.orderId.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.scheduledAt
                        ? `Scheduled: ${tx.scheduledAt.toLocaleDateString()} at ${tx.scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Not yet scheduled'}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[tx.status] ?? 'secondary'}>
                    {STATUS_LABELS[tx.status] ?? tx.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Completed */}
      {recentCompleted.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recently Completed</CardTitle>
            <Link href="/my/selling/local/transactions?filter=completed" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCompleted.map((tx) => (
                <Link
                  key={tx.id}
                  href={`/my/selling/orders/${tx.orderId}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">Order #{tx.orderId.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {tx.confirmedAt ? `Completed: ${tx.confirmedAt.toLocaleDateString()}` : 'Completed'}
                    </p>
                  </div>
                  <Badge variant="default">Completed</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/local/transactions"><FileText className="mr-1.5 h-4 w-4" />Transactions</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/local/reliability"><Shield className="mr-1.5 h-4 w-4" />Reliability</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/local/locations"><Map className="mr-1.5 h-4 w-4" />Locations</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/my/selling/local/settings"><Settings className="mr-1.5 h-4 w-4" />Settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
