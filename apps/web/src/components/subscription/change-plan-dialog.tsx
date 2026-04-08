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
import { Badge } from '@twicely/ui/badge';
import { cn } from '@twicely/utils';
// Pull pure sync helpers from -core (no db imports) — importing from
// subscription-engine.ts itself would drag price-map (postgres) into this client bundle.
import { classifySubscriptionChange } from '@twicely/subscriptions/subscription-engine-core';
import type { ChangePreview } from '@twicely/subscriptions/subscription-engine-core';
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateShort(d: Date | null): string {
  if (!d) return 'end of period';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function priceDiffLabel(currentCents: number, targetCents: number): string {
  const diff = targetCents - currentCents;
  const sign = diff >= 0 ? '+' : '-';
  return `${sign}$${(Math.abs(diff) / 100).toFixed(2)}/mo`;
}

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
        <div className="space-y-2">
          {tiers.filter((t) => t.tier !== 'NONE').map((t) => {
            const isCurrent = t.tier === currentTier && selectedInterval === currentInterval;
            const isSelected = t.tier === selectedTier;
            const tierPriceData = tierPrices[t.tier];
            const price = tierPriceData?.price ?? '$—/mo';
            const savings = tierPriceData?.savings ?? 0;

            // Quick classify to show direction badge
            const cls = classifySubscriptionChange({
              product, currentTier, currentInterval,
              targetTier: t.tier, targetInterval: selectedInterval,
            });

            return (
              <button
                key={t.tier}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedTier(t.tier as TierValue)}
                className={cn(
                  'w-full text-left border rounded p-3 transition-colors',
                  isSelected ? 'border-[#7C3AED] bg-purple-50' : 'border-gray-200 hover:border-gray-300',
                  isCurrent && 'opacity-60',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{price}</span>
                    {isCurrent && <Badge variant="outline">Current</Badge>}
                    {cls === 'UPGRADE' && <Badge className="bg-green-100 text-green-700">Upgrade</Badge>}
                    {cls === 'DOWNGRADE' && <Badge className="bg-amber-100 text-amber-700">Downgrade</Badge>}
                    {savings > 0 && selectedInterval === 'annual' && (
                      <span className="text-xs text-green-600">Save {savings}%</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview section */}
        {preview && selectedTier && !isNoChange && !isBlocked && (
          <div className="border rounded p-3 space-y-2 mt-2">
            <div className="flex items-center gap-2">
              {isUpgrade && (
                <Badge className="bg-green-600">Upgrade — effective immediately</Badge>
              )}
              {isDowngrade && (
                <Badge className="bg-amber-600">
                  Downgrade — effective {formatDateShort(
                    preview.effectiveDate === 'immediate' ? null : preview.effectiveDate
                  )}
                </Badge>
              )}
              <span className="text-sm font-medium">
                {priceDiffLabel(preview.currentPriceCents, preview.targetPriceCents)}
              </span>
            </div>
            {preview.warnings.length > 0 && (
              <div className="space-y-1">
                {preview.warnings.map((w) => (
                  <div
                    key={w.feature}
                    className={cn(
                      'text-sm rounded p-2',
                      w.severity === 'critical' ? 'bg-red-50 text-red-700'
                        : w.severity === 'warning' ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700',
                    )}
                  >
                    <span className="font-medium">{w.feature}:</span> {w.message}
                  </div>
                ))}
              </div>
            )}
          </div>
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
