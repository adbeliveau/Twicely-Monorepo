'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@twicely/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@twicely/ui/card';
import { CheckCircle2, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import {
  startOnboardingAction,
  getOnboardingStatusAction,
  getStripeDashboardLinkAction,
} from '@/lib/actions/stripe-onboarding';

interface PayoutSetupStepProps {
  stripeOnboarded: boolean;
  payoutsEnabled: boolean;
  onComplete: () => void;
}

export function PayoutSetupStep({
  stripeOnboarded,
  payoutsEnabled,
  onComplete,
}: PayoutSetupStepProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartOnboarding = async () => {
    setIsLoading(true);
    setError(null);

    const result = await startOnboardingAction();

    if (result.success && result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error ?? 'Failed to start payout setup');
      setIsLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setIsLoading(true);
    setError(null);

    const result = await getOnboardingStatusAction();
    setIsLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? 'Failed to refresh status');
    }
  };

  const handleOpenDashboard = async () => {
    setIsLoading(true);
    setError(null);

    const result = await getStripeDashboardLinkAction();

    if (result.success && result.url) {
      window.open(result.url, '_blank');
      setIsLoading(false);
    } else {
      setError(result.error ?? 'Failed to open dashboard');
      setIsLoading(false);
    }
  };

  // Fully onboarded
  if (stripeOnboarded && payoutsEnabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <CardTitle>Payout Setup Complete</CardTitle>
          </div>
          <CardDescription>
            Your account is ready to receive earnings from sales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
            <p>
              <strong>Payouts enabled.</strong> Funds will be transferred to your connected bank
              account after the escrow hold period.
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleOpenDashboard} variant="outline" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Open Stripe Dashboard
            </Button>
            <Button onClick={onComplete}>Continue</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Partially onboarded
  if (stripeOnboarded && !payoutsEnabled) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <CardTitle>Additional Information Required</CardTitle>
          </div>
          <CardDescription>
            Your Stripe account was created but requires additional information before payouts can
            be enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
            <p>
              Stripe needs additional information to verify your identity and enable payouts. This
              usually takes just a few minutes.
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleStartOnboarding} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Setup
            </Button>
            <Button onClick={handleRefreshStatus} variant="outline" disabled={isLoading}>
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not started
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Your Bank Account</CardTitle>
        <CardDescription>
          Set up Stripe to receive earnings when you make sales on Twicely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-3 text-sm text-muted-foreground">
          <p>By connecting with Stripe, you&apos;ll be able to:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>Request payouts directly to your bank account</li>
            <li>View detailed transaction history</li>
            <li>Manage your payout schedule</li>
          </ul>
        </div>

        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="font-medium">What you&apos;ll need:</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>A valid government ID</li>
            <li>Your bank account details (routing and account number)</li>
            <li>Your SSN or EIN (for tax reporting)</li>
          </ul>
        </div>

        <Button onClick={handleStartOnboarding} disabled={isLoading} size="lg">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Set Up Payouts
        </Button>
      </CardContent>
    </Card>
  );
}
