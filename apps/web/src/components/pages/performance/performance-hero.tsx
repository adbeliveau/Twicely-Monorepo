'use client';

import type { PerformanceBand, TrendState } from '@twicely/scoring/score-types';

interface PerformanceHeroProps {
  score: number;
  isNew: boolean;
  band: PerformanceBand;
  trend: TrendState;
  completedOrders: number;
  newSellerThreshold: number;
  bandThresholds: { powerSeller: number; topRated: number; established: number };
}

const BAND_LABELS: Record<PerformanceBand, string> = {
  EMERGING: 'Emerging',
  ESTABLISHED: 'Established',
  TOP_RATED: 'Top Rated',
  POWER_SELLER: 'Power Seller',
};

const BAND_COLORS: Record<PerformanceBand, string> = {
  EMERGING: 'text-gray-600',
  ESTABLISHED: 'text-green-600',
  TOP_RATED: 'text-blue-600',
  POWER_SELLER: 'text-purple-700',
};

const TREND_ARROWS: Record<TrendState, string> = {
  SURGING: '↑↑',
  CLIMBING: '↑',
  STEADY: '→',
  SLIPPING: '↓',
  DECLINING: '↓↓',
};

const TREND_COLORS: Record<TrendState, string> = {
  SURGING: 'text-green-600',
  CLIMBING: 'text-green-500',
  STEADY: 'text-gray-500',
  SLIPPING: 'text-orange-500',
  DECLINING: 'text-red-500',
};

function getNextBand(band: PerformanceBand): PerformanceBand | null {
  const order: PerformanceBand[] = ['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER'];
  const idx = order.indexOf(band);
  return idx >= 0 && idx < order.length - 1 ? (order[idx + 1] ?? null) : null;
}

function getNextThreshold(band: PerformanceBand, thresholds: PerformanceHeroProps['bandThresholds']): number | null {
  if (band === 'EMERGING') return thresholds.established;
  if (band === 'ESTABLISHED') return thresholds.topRated;
  if (band === 'TOP_RATED') return thresholds.powerSeller;
  return null;
}

function getPrevThreshold(band: PerformanceBand, thresholds: PerformanceHeroProps['bandThresholds']): number {
  if (band === 'ESTABLISHED') return thresholds.established;
  if (band === 'TOP_RATED') return thresholds.topRated;
  if (band === 'POWER_SELLER') return thresholds.powerSeller;
  return 0;
}

export function PerformanceHero({
  score,
  isNew,
  band,
  trend,
  completedOrders,
  newSellerThreshold,
  bandThresholds,
}: PerformanceHeroProps) {
  if (isNew) {
    const remaining = Math.max(0, newSellerThreshold - completedOrders);
    const progress = Math.round((completedOrders / newSellerThreshold) * 100);
    return (
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold">Building your performance profile</h2>
          <p className="text-muted-foreground mt-1">
            Complete {remaining} more order{remaining !== 1 ? 's' : ''} to earn your first performance badge.
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{completedOrders} of {newSellerThreshold} orders</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const nextBand = getNextBand(band);
  const nextThreshold = getNextThreshold(band, bandThresholds);
  const prevThreshold = getPrevThreshold(band, bandThresholds);
  const progressPct = nextThreshold
    ? Math.round(((score - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100;
  const pointsToNext = nextThreshold ? Math.max(0, nextThreshold - score) : 0;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`text-2xl font-bold ${BAND_COLORS[band]}`}>
            {BAND_LABELS[band]}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-4xl font-bold tabular-nums">{score}</span>
            <span className={`text-lg font-medium ${TREND_COLORS[trend]}`}>
              {TREND_ARROWS[trend]} {trend}
            </span>
          </div>
        </div>
      </div>

      {nextBand && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Progress to {BAND_LABELS[nextBand]}</span>
            <span>{pointsToNext > 0 ? `${pointsToNext} points to go` : 'Threshold reached'}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, progressPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{prevThreshold}</span>
            <span>{nextThreshold}</span>
          </div>
        </div>
      )}

      {!nextBand && (
        <p className="text-sm text-muted-foreground">
          You have reached the highest performance band. Keep up the excellent work!
        </p>
      )}
    </div>
  );
}
