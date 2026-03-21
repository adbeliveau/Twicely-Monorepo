import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl';
import { getSellerProfile } from '@/lib/queries/seller';
import { getSellerStripeStatus } from '@/lib/queries/stripe-seller';
import { getPayoutOptionsAction } from '@/lib/actions/payout-settings';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { PayoutScheduleForm } from './payout-schedule-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Payouts | Twicely',
  robots: 'noindex',
};

export default async function PayoutSettingsPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/finances/payouts');
  }

  const [sellerProfile, stripeStatus] = await Promise.all([
    getSellerProfile(session.userId),
    getSellerStripeStatus(session.userId),
  ]);

  // Not onboarded
  if (!stripeStatus?.payoutsEnabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/my/selling/finances">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Payout Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <CardTitle>Complete Payment Setup First</CardTitle>
            </div>
            <CardDescription>
              You need to complete payment setup before configuring payout settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/my/selling/onboarding">Set Up Payouts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch current schedule and available options
  const optionsResult = await getPayoutOptionsAction();

  const currentSchedule = optionsResult.success && optionsResult.currentSchedule
    ? optionsResult.currentSchedule
    : null;
  const availableOptions = optionsResult.success && optionsResult.options
    ? optionsResult.options
    : ['weekly' as const];
  const storeTier = sellerProfile?.storeTier ?? 'NONE';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/my/selling/finances">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Payout Settings</h1>
          <p className="text-muted-foreground">Configure when and how you receive payouts</p>
        </div>
      </div>

      {/* Payout Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Schedule</CardTitle>
          <CardDescription>
            Choose how often you want to receive payouts to your bank account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PayoutScheduleForm
            currentSchedule={currentSchedule}
            availableOptions={availableOptions}
            storeTier={storeTier}
          />
        </CardContent>
      </Card>

      {/* Tier Info */}
      {storeTier !== 'ENTERPRISE' && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade for More Options</CardTitle>
            <CardDescription>
              Higher store tiers unlock additional payout frequency options.
            </CardDescription>
          </CardHeader>
          {/* v3.2: Updated tier payout options */}
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>STARTER:</strong> Manual + Weekly auto ($10 min)</p>
            <p><strong>PRO:</strong> Manual + Weekly auto ($1 min)</p>
            <p><strong>POWER:</strong> Daily auto ($1/payout fee)</p>
            <p><strong>ENTERPRISE:</strong> All options + free daily</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/pricing">View Plans</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* v3.2 Payout UX Language: Stripe disclosure per Canonical §3.3 */}
      <p className="text-xs text-muted-foreground">
        Funds are processed and paid out through Stripe. Twicely displays payout status and transaction activity.
      </p>
    </div>
  );
}
