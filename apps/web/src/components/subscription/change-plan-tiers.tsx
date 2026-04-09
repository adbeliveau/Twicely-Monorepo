'use client';

/**
 * Tier selection grid and change preview panel for ChangePlanDialog.
 * Split from change-plan-dialog.tsx to stay under 300 lines.
 */

import { Badge } from '@twicely/ui/badge';
import { cn } from '@twicely/utils';
import { classifySubscriptionChange } from '@twicely/subscriptions/subscription-engine-core';
import type { ChangePreview } from '@twicely/subscriptions/subscription-engine-core';
import type { BillingInterval } from '@twicely/subscriptions/price-constants';

type TierValue = 'NONE' | 'STARTER' | 'PRO' | 'POWER' | 'ENTERPRISE' | 'FREE' | 'LITE';

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

type ProductKey = 'store' | 'finance' | 'bundle' | 'lister';

interface TierGridProps {
  tiers: { tier: string; label: string }[];
  product: ProductKey;
  currentTier: string;
  currentInterval: BillingInterval;
  selectedTier: TierValue | null;
  selectedInterval: BillingInterval;
  tierPrices: Record<string, { price: string; savings: number }>;
  onSelectTier: (tier: TierValue) => void;
}

export function TierGrid({
  tiers, product, currentTier, currentInterval,
  selectedTier, selectedInterval, tierPrices, onSelectTier,
}: TierGridProps) {
  return (
    <div className="space-y-2">
      {tiers.filter((t) => t.tier !== 'NONE').map((t) => {
        const isCurrent = t.tier === currentTier && selectedInterval === currentInterval;
        const isSelected = t.tier === selectedTier;
        const tierPriceData = tierPrices[t.tier];
        const price = tierPriceData?.price ?? '$—/mo';
        const savings = tierPriceData?.savings ?? 0;

        const cls = classifySubscriptionChange({
          product, currentTier, currentInterval,
          targetTier: t.tier, targetInterval: selectedInterval,
        });

        return (
          <button
            key={t.tier}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelectTier(t.tier as TierValue)}
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
  );
}

interface ChangePreviewPanelProps {
  preview: ChangePreview;
  selectedTier: TierValue;
  isUpgrade: boolean;
  isDowngrade: boolean;
}

export function ChangePreviewPanel({ preview, selectedTier, isUpgrade, isDowngrade }: ChangePreviewPanelProps) {
  void selectedTier; // used by parent for conditional rendering
  return (
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
  );
}
