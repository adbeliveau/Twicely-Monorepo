import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerLocalDashboardData, getSellerReliabilityEvents } from '@/lib/queries/local-seller-dashboard';
import { Badge } from '@twicely/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { ChevronLeft, Shield } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Local Reliability | Twicely',
  robots: 'noindex',
};

const TIER_STYLES: Record<string, { label: string; bg: string }> = {
  RELIABLE: { label: 'Reliable', bg: 'bg-green-100 text-green-800' },
  INCONSISTENT: { label: 'Inconsistent', bg: 'bg-yellow-100 text-yellow-800' },
  UNRELIABLE: { label: 'Unreliable', bg: 'bg-red-100 text-red-800' },
};

const EVENT_LABELS: Record<string, string> = {
  NO_SHOW: 'No Show',
  CANCEL_24HR_PLUS: 'Cancellation (24hr+)',
  CANCEL_UNDER_24HR: 'Late Cancellation (<24hr)',
  CANCEL_SAME_DAY: 'Same-Day Cancellation (<2hr)',
  SELLER_DARK: 'No Response to Day-of Check',
  EXCESSIVE_RESCHEDULE: 'Excessive Reschedules',
  COMPLETED: 'Successful Meetup',
  FRAUD_REPORT: 'Fraud Report',
};

export default async function LocalReliabilityPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/local/reliability');
  }

  if (!session.isSeller && !session.delegationId) {
    redirect('/my');
  }

  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  const [dashboard, events] = await Promise.all([
    getSellerLocalDashboardData(userId),
    getSellerReliabilityEvents(userId),
  ]);

  const tierStyle = TIER_STYLES[dashboard.reliabilityTier];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/my/selling/local"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Local Pickup
        </Link>
        <h1 className="text-2xl font-bold">Reliability Score</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your local meetup reliability affects how buyers perceive you
        </p>
      </div>

      {dashboard.suspendedUntil && dashboard.suspendedUntil > new Date() && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Your local transactions are suspended until {dashboard.suspendedUntil.toLocaleDateString()}.
            This does not affect your shipped transactions.
          </p>
        </div>
      )}

      {/* Score Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-full bg-muted">
              <Shield className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <Badge className={`text-sm ${tierStyle?.bg ?? ''}`}>
                {tierStyle?.label ?? dashboard.reliabilityTier}
              </Badge>
              <div className="grid grid-cols-3 gap-6 mt-3">
                <div>
                  <p className="text-2xl font-bold">{dashboard.reliabilityMarks}</p>
                  <p className="text-xs text-muted-foreground">Active Marks</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboard.allTimeCount}</p>
                  <p className="text-xs text-muted-foreground">Total Meetups</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(dashboard.completionRate * 100)}%</p>
                  <p className="text-xs text-muted-foreground">Completion Rate</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Reliability Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Your reliability score is based on your local meetup behavior. Marks decay after 180 days.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>0-2 marks:</strong> Reliable (green badge)</li>
            <li><strong>3-8 marks:</strong> Inconsistent (yellow badge)</li>
            <li><strong>9+ marks:</strong> Unreliable (red badge) — local transactions may be suspended</li>
          </ul>
          <p>Graceful cancellations (24hr+ notice) carry zero marks. Only late cancels and no-shows add marks.</p>
        </CardContent>
      </Card>

      {/* Event History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event History</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reliability events yet. Complete your first meetup!</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{EVENT_LABELS[event.eventType] ?? event.eventType}</p>
                    <p className="text-xs text-muted-foreground">{event.createdAt.toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${event.marksApplied > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {event.marksApplied > 0 ? `+${event.marksApplied}` : event.marksApplied} marks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Decays: {event.decaysAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
