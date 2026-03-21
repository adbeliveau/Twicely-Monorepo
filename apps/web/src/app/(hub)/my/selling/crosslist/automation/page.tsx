/**
 * Automation settings page — /my/selling/crosslist/automation
 * Page Registry Row 60: SELLER or DELEGATE(crosslister.manage)
 * Source: F6 install prompt §B.1; Lister Canonical Section 17.
 */

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { authorize } from '@twicely/casl/authorize';
import { getAutomationSubscriptionStatus, getAutomationSettings } from '@/lib/queries/automation';
import { AutomationMeterCard } from '@/components/crosslister/automation-meter-card';
import { AutomationSettingsForm } from '@/components/crosslister/automation-settings-form';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Automation | Twicely',
  robots: 'noindex',
};

export default async function AutomationPage() {
  const { session } = await authorize();

  if (!session) {
    redirect('/auth/login?callbackUrl=/my/selling/crosslist/automation');
  }

  // Delegation: if delegate, operate on behalf of the seller they're delegated to
  const userId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  // CASL gate: seller (isSeller) or delegate with crosslister.manage scope
  if (!session.isSeller && !session.delegationId) {
    redirect('/my/selling/onboarding');
  }

  const [status, settingsData] = await Promise.all([
    getAutomationSubscriptionStatus(userId),
    getAutomationSettings(userId),
  ]);

  // FORBIDDEN — no automation subscription
  if (!status.hasAutomation) {
    const listerEligible = status.listerTier === 'LITE' || status.listerTier === 'PRO';

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Automation</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automate relisting, price drops, offers, and sharing.
          </p>
        </div>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Automation Add-On</CardTitle>
            <CardDescription>
              Auto-relist stale listings, send smart price drops, make offers to interested buyers,
              and share your Poshmark closet — all on autopilot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!listerEligible && (
              <p className="text-sm text-destructive">
                Automation requires Crosslister Lite or above.{' '}
                <Link href="/my/selling/subscription" className="underline">
                  Upgrade your Crosslister plan.
                </Link>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              2,000 automation actions per month included.
            </p>
            <Button asChild disabled={!listerEligible}>
              <Link href="/my/selling/subscription?product=automation">Get Started — $9.99/mo</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // POPULATED — has automation subscription
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Automation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure automated actions for your crosslisted items.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Subscription Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Automation Add-On
              <Badge variant="secondary">
                {status.automationSub?.status === 'TRIALING' ? 'Trial' : 'Active'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {status.automationSub?.currentPeriodEnd && (
              <p className="text-muted-foreground">
                Renews{' '}
                {new Date(status.automationSub.currentPeriodEnd).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
            {status.automationSub?.cancelAtPeriodEnd && (
              <p className="text-destructive text-xs">Cancels at period end</p>
            )}
            <Link
              href="/my/selling/subscription"
              className="text-xs text-muted-foreground underline"
            >
              Manage subscription
            </Link>
          </CardContent>
        </Card>

        {/* Action Meter Card */}
        <AutomationMeterCard
          used={status.actionsUsed}
          limit={status.actionsLimit}
          remaining={status.actionsRemaining}
        />
      </div>

      {/* Settings Form */}
      <AutomationSettingsForm
        settings={settingsData.settings}
        hasPoshmarkAccount={settingsData.hasPoshmarkAccount}
        connectedChannels={settingsData.connectedChannels}
      />
    </div>
  );
}
