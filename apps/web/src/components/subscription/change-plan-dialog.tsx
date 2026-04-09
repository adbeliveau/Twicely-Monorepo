'use client';

/**
 * D3-S4: Change Plan Dialog
 *
 * Allows sellers to upgrade or schedule a downgrade.
 * UPGRADE: immediate Stripe update with proration.
 * DOWNGRADE: pending in DB, applied at renewal via webhook.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@twicely/ui/dialog';
import { Button } from '@twicely/ui/button';
import type { ChangePreview } from '@twicely/subscriptions/subscription-engine-core';
import { TierGrid, ChangePreviewPanel } from './change-plan-tiers';
import { changeSubscriptionAction } from '@/lib/actions/change-subscription';
import {
  getTierPriceDisplayAction,
  getChangePreviewAction,
} from '@/lib/actions/subscription-pricing-display';
import type { BillingInterval } from '@twicely/subscriptions/price-constants';

// ─── Types ──────────────────────────────────────────────────────────────────

type TierValue = 'NONE' | 'STARTER' | 'PRO' | 'POWER' | 'ENTERPRISE' | 'FREE' | 'LITE';

interface ChangePlanDialogProps {
  product: 'store' | 'lister' | 'finance' | 'bundle';
  currentTier: string;
  currentInterval: 'monthly' | 'annual';
  currentPeriodEnd: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Tier configs per product ───────────────────────────────────────────────

const PRODUCT_TIERS: Record<string, { tier: string; label: string }[]> = {
  store: [
    { tier: 'STARTER', label: 'Starter' },
    { tier: 'PRO', label: 'Pro' },
    { tier: 'POWER', label: 'Power' },
  ],
  lister: [
    { tier: 'FREE', label: 'Free' },
    { tier: 'LITE', label: 'Lite' },
    { tier: 'PRO', label: 'Pro' },
  ],
  finance: [
    { tier: 'FREE', label: 'Free' },
    { tier: 'PRO', label: 'Pro' },
  ],
  bundle: [
    { tier: 'STARTER', label: 'Starter' },
    { tier: 'PRO', label: 'Pro' },
    { tier: 'POWER', label: 'Power' },
  ],
};

const PRODUCT_LABELS: Record<string, string> = {
  store: 'Store', lister: 'Crosslister', finance: 'Finance Pro', bundle: 'Bundle',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ChangePlanDialog(props: ChangePlanDialogProps) {
  const { product, currentTier, currentInterval, currentPeriodEnd, open, onOpenChange } = props;
  const [selectedTier, setSelectedTier] = useState<TierValue | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>(currentInterval);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const tiers = PRODUCT_TIERS[product] ?? [];
  const productLabel = PRODUCT_LABELS[product] ?? product;

  // Compute preview asynchronously when a tier is selected.
  // getChangePreview is async (reads platform_settings) so we use useEffect.
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  useEffect(() => {
    if (!selectedTier) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void getChangePreviewAction({
      product,
      currentTier,
      currentInterval,
      targetTier: selectedTier,
      targetInterval: selectedInterval,
      currentPeriodEnd: currentPeriodEnd ?? new Date(),
    }).then((p) => {
      if (!cancelled) setPreview(p);
    }).catch(() => {
      if (!cancelled) setPreview(null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTier, product, currentTier, currentInterval, selectedInterval, currentPeriodEnd]);

  // Pre-compute display prices for every tier in the list. formatTierPrice and
  // getAnnualSavingsPercent are now async (they read platform_settings), so we
  // load them once per (product, interval) combo into a state map.
  const [tierPrices, setTierPrices] = useState<Record<string, { price: string; savings: number }>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: Record<string, { price: string; savings: number }> = {};
      await Promise.all(
        tiers.map(async (t) => {
          const { price, savings } = await getTierPriceDisplayAction(product, t.tier, selectedInterval);
          entries[t.tier] = { price, savings };
        }),
      );
      if (!cancelled) setTierPrices(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [product, selectedInterval, tiers]);

  const isUpgrade = preview?.classification === 'UPGRADE' || preview?.classification === 'INTERVAL_UPGRADE';
  const isDowngrade = preview?.classification === 'DOWNGRADE' || preview?.classification === 'INTERVAL_DOWNGRADE';
  const isBlocked = preview?.classification === 'BLOCKED';
  const isNoChange = preview?.classification === 'NO_CHANGE';

  async function handleConfirm() {
    if (!selectedTier || !preview || isBlocked || isNoChange) return;
    setLoading(true);
    try {
      const result = await changeSubscriptionAction({
        product,
        targetTier: selectedTier,
        targetInterval: selectedInterval,
      });
      if (result.success) {
        toast.success(
          isUpgrade
            ? `Upgraded to ${selectedTier}`
            : `Downgrade to ${selectedTier} scheduled`
        );
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Something went wrong');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change {productLabel} Plan</DialogTitle>
          <DialogDescription>
            Currently on {currentTier} ({currentInterval})
          </DialogDescription>
        </DialogHeader>

        {/* Interval toggle */}
        <div className="flex gap-2 mb-2">
          <Button
            size="sm"
            variant={selectedInterval === 'monthly' ? 'default' : 'outline'}
            aria-pressed={selectedInterval === 'monthly'}
            onClick={() => setSelectedInterval('monthly')}
          >
            Monthly
          </Button>
          <Button
            size="sm"
            variant={selectedInterval === 'annual' ? 'default' : 'outline'}
            aria-pressed={selectedInterval === 'annual'}
            onClick={() => setSelectedInterval('annual')}
          >
            Annual
          </Button>
        </div>

        {/* Tier grid */}
        <TierGrid
          tiers={tiers}
          product={product}
          currentTier={currentTier}
          currentInterval={currentInterval}
          selectedTier={selectedTier}
          selectedInterval={selectedInterval}
          tierPrices={tierPrices}
          onSelectTier={(tier) => setSelectedTier(tier)}
        />

        {/* Preview section */}
        {preview && selectedTier && !isNoChange && !isBlocked && (
          <ChangePreviewPanel
            preview={preview}
            selectedTier={selectedTier}
            isUpgrade={isUpgrade}
            isDowngrade={isDowngrade}
          />
        )}

        {isBlocked && selectedTier && (
          <p className="text-sm text-red-600 mt-2">Contact sales for Enterprise changes.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          {isUpgrade && (
            <Button
              className="bg-[#7C3AED] hover:bg-[#6D28D9]"
              onClick={handleConfirm}
              disabled={loading || !selectedTier}
            >
              {loading ? 'Upgrading...' : `Upgrade to ${selectedTier}`}
            </Button>
          )}
          {isDowngrade && (
            <Button
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
              onClick={handleConfirm}
              disabled={loading || !selectedTier}
            >
              {loading ? 'Scheduling...' : 'Schedule Downgrade'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
