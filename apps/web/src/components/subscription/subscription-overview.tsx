'use client';

/**
 * D3-S3: SubscriptionOverview
 *
 * Renders 4 subscription product cards + billing portal button + bundle upsell.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@twicely/ui/button';
import { SubscriptionCard } from './subscription-card';
import { CancelSubscriptionDialog } from './cancel-subscription-dialog';
import { ChangePlanDialog } from './change-plan-dialog';
import { BundleSection } from './bundle-section';
import { createSubscriptionCheckout } from '@/lib/actions/create-subscription-checkout';
import { createBillingPortalSession } from '@/lib/actions/manage-subscription';
import { cancelPendingChangeAction } from '@/lib/actions/change-subscription';
import { BUNDLE_COMPONENTS } from '@twicely/subscriptions/bundle-components';
import type { SubscriptionSnapshot } from '@/lib/queries/subscriptions';
import type { BundleTier } from '@/types/enums';
import {
  STORE_TIERS, LISTER_TIERS, FINANCE_TIERS, AUTOMATION_TIERS,
} from './tier-config';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubscriptionOverviewProps {
  snapshot: SubscriptionSnapshot;
  sellerType: 'PERSONAL' | 'BUSINESS';
  hasStripeConnect: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SubscriptionOverview({ snapshot, sellerType, hasStripeConnect }: SubscriptionOverviewProps) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [changePlanProduct, setChangePlanProduct] = useState<'store' | 'lister' | 'finance' | null>(null);
  const router = useRouter();

  const isBusinessSeller = sellerType === 'BUSINESS';
  const canSubscribeToStore = isBusinessSeller && hasStripeConnect;

  async function handleCancelPending(product: 'store' | 'lister' | 'finance') {
    const result = await cancelPendingChangeAction({ product });
    if (result.success) {
      toast.success('Pending change canceled');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Something went wrong');
    }
  }

  async function handleSubscribe(product: 'store' | 'lister' | 'automation' | 'finance', tier: string, interval: 'monthly' | 'annual') {
    const result = await createSubscriptionCheckout({
      product,
      tier,
      interval,
    });
    if (result.success && result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    } else if (result?.error) {
      toast.error(result.error);
    }
  }

  async function handleBillingPortal() {
    setPortalLoading(true);
    try {
      const result = await createBillingPortalSession();
      if (result.success && result.portalUrl) {
        window.location.href = result.portalUrl;
      } else {
        toast.error(result.error ?? 'Failed to open billing portal');
      }
    } catch {
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const storeSub = snapshot.storeSubscription;
  const listerSub = snapshot.listerSubscription;
  const financeSub = snapshot.financeSubscription;
  const autoSub = snapshot.automationSubscription;

  // D3-S5: Determine which products are included in current bundle
  const BUNDLE_NAMES: Record<string, string> = {
    STARTER: 'Seller Starter', PRO: 'Seller Pro', POWER: 'Seller Power',
  };
  const bc = snapshot.bundleTier !== 'NONE'
    ? BUNDLE_COMPONENTS[snapshot.bundleTier as BundleTier] : null;
  const bundleName = bc ? BUNDLE_NAMES[snapshot.bundleTier] ?? null : null;
  const storeBundleLabel = bc && bc.storeTier !== 'NONE' ? bundleName : undefined;
  const listerBundleLabel = bc && bc.listerTier !== 'NONE' ? bundleName : undefined;
  const financeBundleLabel = bc && bc.financeTier !== 'FREE' ? bundleName : undefined;
  const autoBundleLabel = bc?.hasAutomation ? bundleName : undefined;

  return (
    <div className="space-y-6">
      {/* Product Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Store */}
        <SubscriptionCard
          title="Store"
          product="store"
          currentTier={snapshot.storeTier}
          status={storeSub?.status ?? null}
          currentPeriodEnd={storeSub?.currentPeriodEnd ?? null}
          cancelAtPeriodEnd={storeSub?.cancelAtPeriodEnd ?? false}
          availableTiers={STORE_TIERS}
          onSubscribe={(tier, interval) => handleSubscribe('store', tier, interval)}
          cancelAction={
            <CancelSubscriptionDialog product="store" productLabel="Store"
              currentStoreTier={snapshot.storeTier} periodEndDate={storeSub?.currentPeriodEnd ?? null}
              revertTier="NONE" />
          }
          canSubscribe={canSubscribeToStore}
          disabledReason={
            !isBusinessSeller ? 'Upgrade to Business to unlock Store subscriptions'
            : !hasStripeConnect ? 'Complete Stripe Connect onboarding first'
            : undefined
          }
          isUpgradeAvailable={snapshot.storeTier !== 'NONE' && snapshot.storeTier !== 'POWER' && snapshot.storeTier !== 'ENTERPRISE'}
          pendingTier={snapshot.storePendingTier}
          pendingBillingInterval={snapshot.storePendingBillingInterval}
          pendingChangeAt={snapshot.storePendingChangeAt}
          billingInterval={snapshot.storeBillingInterval}
          onChangePlan={() => setChangePlanProduct('store')}
          onCancelPendingChange={() => handleCancelPending('store')}
          bundleLabel={storeBundleLabel}
        />

        {/* Crosslister */}
        <SubscriptionCard
          title="Crosslister"
          product="lister"
          currentTier={snapshot.listerTier}
          status={listerSub?.status ?? null}
          currentPeriodEnd={listerSub?.currentPeriodEnd ?? null}
          cancelAtPeriodEnd={listerSub?.cancelAtPeriodEnd ?? false}
          availableTiers={LISTER_TIERS}
          onSubscribe={(tier, interval) => handleSubscribe('lister', tier, interval)}
          cancelAction={
            <CancelSubscriptionDialog product="lister" productLabel="Crosslister"
              currentStoreTier={snapshot.storeTier} periodEndDate={listerSub?.currentPeriodEnd ?? null}
              revertTier="FREE" />
          }
          canSubscribe
          isUpgradeAvailable={snapshot.listerTier === 'FREE' || snapshot.listerTier === 'LITE'}
          pendingTier={snapshot.listerPendingTier}
          pendingBillingInterval={snapshot.listerPendingBillingInterval}
          pendingChangeAt={snapshot.listerPendingChangeAt}
          billingInterval={snapshot.listerBillingInterval}
          onChangePlan={() => setChangePlanProduct('lister')}
          onCancelPendingChange={() => handleCancelPending('lister')}
          bundleLabel={listerBundleLabel}
        />

        {/* Finance */}
        <SubscriptionCard
          title="Finance Pro"
          product="finance"
          currentTier={snapshot.financeTier}
          status={financeSub?.status ?? null}
          currentPeriodEnd={financeSub?.currentPeriodEnd ?? null}
          cancelAtPeriodEnd={financeSub?.cancelAtPeriodEnd ?? false}
          availableTiers={FINANCE_TIERS}
          onSubscribe={(tier, interval) => handleSubscribe('finance', tier, interval)}
          cancelAction={
            <CancelSubscriptionDialog product="finance" productLabel="Finance Pro"
              currentStoreTier={snapshot.storeTier} periodEndDate={financeSub?.currentPeriodEnd ?? null}
              revertTier="FREE" />
          }
          canSubscribe
          isUpgradeAvailable={false}
          pendingTier={snapshot.financePendingTier}
          pendingBillingInterval={snapshot.financePendingBillingInterval}
          pendingChangeAt={snapshot.financePendingChangeAt}
          billingInterval={snapshot.financeBillingInterval}
          onCancelPendingChange={() => handleCancelPending('finance')}
          bundleLabel={financeBundleLabel}
        />

        {/* Automation */}
        <SubscriptionCard
          title="Automation"
          product="automation"
          currentTier={snapshot.hasAutomation ? 'ACTIVE' : 'NONE'}
          status={autoSub?.status ?? null}
          currentPeriodEnd={autoSub?.currentPeriodEnd ?? null}
          cancelAtPeriodEnd={autoSub?.cancelAtPeriodEnd ?? false}
          availableTiers={AUTOMATION_TIERS}
          onSubscribe={(tier, interval) => handleSubscribe('automation', tier, interval)}
          cancelAction={
            <CancelSubscriptionDialog product="automation" productLabel="Automation"
              currentStoreTier={snapshot.storeTier} periodEndDate={autoSub?.currentPeriodEnd ?? null}
              revertTier="NONE" />
          }
          canSubscribe
          isUpgradeAvailable={false}
          bundleLabel={autoBundleLabel}
        />
      </div>

      {/* Billing Portal */}
      <Button variant="outline" onClick={handleBillingPortal} disabled={portalLoading}>
        {portalLoading ? 'Loading...' : 'Manage Payment Methods'}
      </Button>

      {/* D3-S5: Bundle Section */}
      <BundleSection snapshot={snapshot} sellerType={sellerType} hasStripeConnect={hasStripeConnect} />

      {/* D3-S4: Change Plan Dialog */}
      {changePlanProduct && (
        <ChangePlanDialog
          product={changePlanProduct}
          currentTier={
            changePlanProduct === 'store' ? snapshot.storeTier
            : changePlanProduct === 'lister' ? snapshot.listerTier
            : snapshot.financeTier
          }
          currentInterval={
            changePlanProduct === 'store' ? (snapshot.storeBillingInterval ?? 'monthly')
            : changePlanProduct === 'lister' ? (snapshot.listerBillingInterval ?? 'monthly')
            : (snapshot.financeBillingInterval ?? 'monthly')
          }
          currentPeriodEnd={
            changePlanProduct === 'store' ? (storeSub?.currentPeriodEnd ?? null)
            : changePlanProduct === 'lister' ? (listerSub?.currentPeriodEnd ?? null)
            : (financeSub?.currentPeriodEnd ?? null)
          }
          open={!!changePlanProduct}
          onOpenChange={(open) => { if (!open) setChangePlanProduct(null); }}
        />
      )}
    </div>
  );
}
