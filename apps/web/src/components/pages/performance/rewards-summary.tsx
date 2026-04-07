'use client';

import { Check } from 'lucide-react';
import type { PerformanceBand } from '@/lib/scoring/score-types';

interface RewardsSummaryProps {
  currentBand: PerformanceBand;
}

interface Reward {
  label: string;
  description: string;
}

const BAND_REWARDS: Record<PerformanceBand, Reward[]> = {
  EMERGING: [],
  ESTABLISHED: [
    { label: 'Established Badge', description: 'Displayed on your storefront and listings' },
    { label: 'Buyer Protection Boost', description: '+5 points on buyer protection score' },
  ],
  TOP_RATED: [
    { label: 'Top Rated Badge', description: 'Displayed on your storefront and listings' },
    { label: 'Buyer Protection Boost', description: '+10 points on buyer protection score' },
    { label: 'Priority Support', description: 'Faster response from our support team' },
  ],
  POWER_SELLER: [
    { label: 'Power Seller Badge', description: 'Displayed on your storefront and listings' },
    { label: 'Buyer Protection Boost', description: '+15 points on buyer protection score' },
    { label: 'Priority Support', description: 'Fastest response from our support team' },
    { label: 'Early Feature Access', description: 'First access to new platform features' },
  ],
};

const BAND_ORDER: PerformanceBand[] = ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER'];
const BAND_LABELS: Record<PerformanceBand, string> = {
  EMERGING: 'Emerging',
  ESTABLISHED: 'Established',
  TOP_RATED: 'Top Rated',
  POWER_SELLER: 'Power Seller',
};

export function RewardsSummary({ currentBand }: RewardsSummaryProps) {
  const currentIdx = BAND_ORDER.indexOf(currentBand);
  const nextBand = currentIdx < BAND_ORDER.length - 1 ? BAND_ORDER[currentIdx + 1] : null;
  const currentRewards = BAND_REWARDS[currentBand];
  const nextRewards = nextBand ? BAND_REWARDS[nextBand] : [];
  const newNextRewards = nextRewards.filter(
    (r) => !currentRewards.some((cr) => cr.label === r.label),
  );

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Your Rewards</h3>

      {currentRewards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Reach Established status to unlock performance rewards.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Current — {BAND_LABELS[currentBand]}
          </div>
          {currentRewards.map((r) => (
            <div key={r.label} className="flex items-start gap-2">
              <Check className="size-4 mt-0.5 text-green-600 shrink-0" strokeWidth={2.5} />
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {nextBand && newNextRewards.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Unlock at {BAND_LABELS[nextBand]}
          </div>
          {newNextRewards.map((r) => (
            <div key={r.label} className="flex items-start gap-2 opacity-60">
              <span className="mt-0.5 text-gray-400">○</span>
              <div>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
