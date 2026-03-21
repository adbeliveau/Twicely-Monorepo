'use client';

/**
 * D3-S5: BundleSection
 *
 * When not bundled: shows 3 bundle cards with pricing + "Get Bundle" buttons.
 * When bundled: shows current bundle with "Change Bundle" + "Cancel Bundle".
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { Badge } from '@twicely/ui/badge';
import { Button } from '@twicely/ui/button';
import { CancelSubscriptionDialog } from './cancel-subscription-dialog';
import { ChangePlanDialog } from './change-plan-dialog';
import { createBundleCheckout } from '@/lib/actions/create-bundle-checkout';
import { cancelPendingChangeAction } from '@/lib/actions/change-subscription';
import { BUNDLE_TIERS } from './tier-config';
import { formatDate, statusLabel, isActive, isPastDue } from './subscription-card';
import type { SubscriptionSnapshot } from '@/lib/queries/subscriptions';

// ─── Types ──────────────────────────────────────────────────────────────────

const BUNDLE_NAMES: Record<string, string> = {
  STARTER: 'Seller Starter', PRO: 'Seller Pro', POWER: 'Seller Power',
};

interface BundleSectionProps {
  snapshot: SubscriptionSnapshot;
  sellerType: 'PERSONAL' | 'BUSINESS';
  hasStripeConnect: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BundleSection({ snapshot, sellerType, hasStripeConnect }: BundleSectionProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');
  const router = useRouter();

  const isBusinessSeller = sellerType === 'BUSINESS';
  const canGetBundle = isBusinessSeller && hasStripeConnect;
  const bundleTier = snapshot.bundleTier;
  const bundleSub = snapshot.bundleSubscription;

  async function handleGetBundle(tier: string) {
    if (!canGetBundle) return;
    setLoading(tier);
    try {
      const result = await createBundleCheckout({
        bundleTier: tier as 'STARTER' | 'PRO' | 'POWER',
        billingInterval,
      });
      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error(result.error ?? 'Something went wrong');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  async function handleCancelPending() {
    const result = await cancelPendingChangeAction({ product: 'bundle' });
    if (result.success) {
      toast.success('Pending change canceled');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Something went wrong');
    }
  }

  // ─── Active Bundle State ────────────────────────────────────────────────

  if (bundleTier !== 'NONE') {
    const bundleName = BUNDLE_NAMES[bundleTier] ?? bundleTier;
    const status = bundleSub?.status ?? null;
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Your Bundle</h2>
        <Card className="border-l-4 border-l-[#7C3AED]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{bundleName}</CardTitle>
              <Badge className="bg-[#7C3AED] hover:bg-[#7C3AED]">{bundleTier}</Badge>
            </div>
            {bundleSub && (
              <div className="flex items-center gap-2 text-sm">
                <span className={`inline-block h-2 w-2 rounded-full ${isActive(status) ? 'bg-green-500' : isPastDue(status) ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                <span>{statusLabel(status)}</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {bundleSub?.cancelAtPeriodEnd && bundleSub.currentPeriodEnd && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded p-2">
                Cancels on {formatDate(bundleSub.currentPeriodEnd)}
              </p>
            )}
            {(snapshot.bundlePendingTier || snapshot.bundlePendingBillingInterval) && !bundleSub?.cancelAtPeriodEnd && (
              <div className="flex items-center justify-between text-sm bg-amber-50 border border-amber-200 rounded p-2">
                <span className="text-amber-700">
                  Changing to {snapshot.bundlePendingTier ?? bundleTier}
                  {snapshot.bundlePendingBillingInterval ? ` (${snapshot.bundlePendingBillingInterval})` : ''}
                  {snapshot.bundlePendingChangeAt ? ` on ${formatDate(snapshot.bundlePendingChangeAt)}` : ''}
                </span>
                <Button size="sm" variant="ghost" className="text-amber-700 h-auto py-0.5 px-2"
                  onClick={handleCancelPending}>Cancel Change</Button>
              </div>
            )}
            {!bundleSub?.cancelAtPeriodEnd && bundleSub?.currentPeriodEnd && isActive(status) && (
              <p className="text-sm text-muted-foreground">Renews {formatDate(bundleSub.currentPeriodEnd)}</p>
            )}
            {snapshot.bundleBillingInterval && (
              <p className="text-sm text-muted-foreground">Billed {snapshot.bundleBillingInterval}</p>
            )}
            <div className="flex gap-2 pt-1">
              {isActive(status) && !bundleSub?.cancelAtPeriodEnd && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setShowChangePlan(true)}>
                    Change Bundle
                  </Button>
                  <CancelSubscriptionDialog product="bundle" productLabel="Bundle"
                    currentStoreTier={snapshot.storeTier}
                    periodEndDate={bundleSub?.currentPeriodEnd ?? null} revertTier="NONE" />
                </>
              )}
            </div>
          </CardContent>
        </Card>
        {showChangePlan && (
          <ChangePlanDialog product="bundle" currentTier={bundleTier}
            currentInterval={snapshot.bundleBillingInterval ?? 'monthly'}
            currentPeriodEnd={bundleSub?.currentPeriodEnd ?? null}
            open={showChangePlan}
            onOpenChange={(open) => { if (!open) setShowChangePlan(false); }} />
        )}
      </div>
    );
  }

  // ─── No Bundle — Show Available Bundles ─────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Save with Bundles</h2>
        <div className="flex gap-1">
          <Button size="sm" variant={billingInterval === 'monthly' ? 'default' : 'outline'}
            onClick={() => setBillingInterval('monthly')}>Monthly</Button>
          <Button size="sm" variant={billingInterval === 'annual' ? 'default' : 'outline'}
            onClick={() => setBillingInterval('annual')}>Annual</Button>
        </div>
      </div>
      {!canGetBundle && (
        <p className="text-sm text-amber-600 bg-amber-50 rounded p-2">
          {!isBusinessSeller
            ? 'Upgrade to Business to unlock bundles (includes Store)'
            : 'Complete Stripe Connect onboarding first'}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {BUNDLE_TIERS.map((b) => (
          <Card key={b.tier} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{b.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{b.components}</p>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div>
                <span className="text-lg font-semibold">
                  {billingInterval === 'annual' ? b.annualPrice : b.monthlyPrice}
                </span>
                {billingInterval === 'annual' && b.annualSavings > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs border-green-300 text-green-700">
                    Save {b.annualSavings}%
                  </Badge>
                )}
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {b.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Button size="sm" className="w-full bg-[#7C3AED] hover:bg-[#6D28D9]"
                disabled={!canGetBundle || loading === b.tier}
                onClick={() => handleGetBundle(b.tier)}>
                {loading === b.tier ? 'Loading...' : 'Get Bundle'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
