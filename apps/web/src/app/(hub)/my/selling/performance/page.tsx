import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@twicely/auth';
import { getSellerScoreData, getScoreHistory, getMetricBreakdown, getSellerTrend } from '@/lib/queries/seller-score';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { getAppealableActionsForUser } from '@/lib/queries/enforcement-actions';
import { getActiveEnforcementForUser } from '@/lib/queries/enforcement-actions';
import { PerformanceHero } from '@/components/pages/performance/performance-hero';
import { ScoreChart } from '@/components/pages/performance/score-chart';
import { MetricCard } from '@/components/pages/performance/metric-card';
import { RewardsSummary } from '@/components/pages/performance/rewards-summary';
import { EnforcementAppealForm } from '@/components/pages/performance/enforcement-appeal-form';
import type { PerformanceBand, TrendState } from '@/lib/scoring/score-types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Performance | Twicely',
  robots: 'noindex',
};

export default async function PerformancePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/auth/login');

  const userId = session.user.id;
  const scoreData = await getSellerScoreData(userId);

  if (!scoreData) {
    redirect('/my/selling');
  }

  const [scoreHistory, metricBreakdown, trend, bandPowerSeller, bandTopRated, bandEstablished, newSellerThreshold, appealWindowDays, appealableActions, activeEnforcements] =
    await Promise.all([
      getScoreHistory(userId, 90),
      getMetricBreakdown(userId),
      getSellerTrend(userId),
      getPlatformSetting('performance.band.powerSeller', 900),
      getPlatformSetting('performance.band.topRated', 750),
      getPlatformSetting('performance.band.established', 550),
      getPlatformSetting('score.newSellerOrderThreshold', 10),
      getPlatformSetting<number>('score.enforcement.appealWindowDays', 30),
      getAppealableActionsForUser(userId),
      getActiveEnforcementForUser(userId),
    ]);

  const bandThresholds = {
    powerSeller: Number(bandPowerSeller),
    topRated: Number(bandTopRated),
    established: Number(bandEstablished),
  };

  // Score projection: shown when CLIMBING or SURGING
  const showProjection = trend === 'CLIMBING' || trend === 'SURGING';
  let projectionDays: number | null = null;
  if (showProjection && scoreHistory.length >= 7 && !scoreData.isNew) {
    const recent = scoreHistory.slice(-7);
    const lastScore = recent[recent.length - 1]?.score ?? 0;
    const firstScore = recent[0]?.score ?? 0;
    const deltaPerDay = (lastScore - firstScore) / Math.max(recent.length - 1, 1);
    const nextThresholds: Partial<Record<PerformanceBand, number>> = {
      EMERGING: bandThresholds.established,
      ESTABLISHED: bandThresholds.topRated,
      TOP_RATED: bandThresholds.powerSeller,
    };
    const nextThreshold = nextThresholds[scoreData.performanceBand as PerformanceBand];
    if (nextThreshold && deltaPerDay > 0) {
      projectionDays = Math.ceil((nextThreshold - scoreData.sellerScore) / deltaPerDay);
    }
  }

  const nextBandLabels: Partial<Record<PerformanceBand, string>> = {
    EMERGING: 'Established',
    ESTABLISHED: 'Top Rated',
    TOP_RATED: 'Power Seller',
  };
  const nextBandLabel = nextBandLabels[scoreData.performanceBand as PerformanceBand];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your seller score and performance metrics over the last 90 days.
        </p>
      </div>

      {/* Enforcement banner */}
      {scoreData.enforcementLevel && (
        <div className={`rounded-lg border p-4 ${
          scoreData.enforcementLevel === 'PRE_SUSPENSION' || scoreData.enforcementLevel === 'RESTRICTION'
            ? 'bg-red-50 border-red-300 text-red-800'
            : 'bg-amber-50 border-amber-300 text-amber-800'
        }`}>
          <div className="font-medium">
            {scoreData.enforcementLevel === 'COACHING' && 'Performance coaching active'}
            {scoreData.enforcementLevel === 'WARNING' && 'Action required: Performance warning'}
            {scoreData.enforcementLevel === 'RESTRICTION' && 'Account restricted due to performance'}
            {scoreData.enforcementLevel === 'PRE_SUSPENSION' && 'Account under review — immediate improvement required'}
          </div>
          <div className="text-sm mt-1">
            Visit your performance metrics below and{' '}
            <a href="/p/policies" className="underline font-medium">review our seller standards</a>{' '}
            to understand what to improve.
          </div>
        </div>
      )}

      {/* Appeal section */}
      {appealableActions.length > 0 && (
        <div className="space-y-3">
          {appealableActions.map((action) => (
            <EnforcementAppealForm
              key={action.id}
              enforcementAction={{ ...action, appealedAt: action.appealedAt ?? null }}
              appealWindowDays={Number(appealWindowDays)}
            />
          ))}
        </div>
      )}

      {activeEnforcements.some((a) => a.status === 'APPEALED') && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <div className="font-medium">Appeal under review</div>
          <p className="mt-1">Your appeal is being reviewed by our team. We will respond within 48 hours.</p>
        </div>
      )}

      {activeEnforcements.some((a) => a.status === 'APPEAL_APPROVED') && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="font-medium">Appeal approved</div>
          <p className="mt-1">Your appeal was approved and the enforcement action has been lifted. Your account is back in good standing.</p>
        </div>
      )}

      {/* Hero section */}
      <PerformanceHero
        score={scoreData.sellerScore}
        isNew={scoreData.isNew}
        band={scoreData.performanceBand as PerformanceBand}
        trend={trend as TrendState}
        completedOrders={scoreData.completedOrders}
        newSellerThreshold={Number(newSellerThreshold)}
        bandThresholds={bandThresholds}
      />

      {/* Score chart */}
      {!scoreData.isNew && (
        <ScoreChart history={scoreHistory} bandThresholds={bandThresholds} />
      )}

      {/* Score projection */}
      {showProjection && projectionDays !== null && nextBandLabel && projectionDays > 0 && projectionDays < 365 && (
        <div className="rounded-lg border bg-green-50 border-green-200 p-4 text-green-800">
          <div className="font-medium">You're on track!</div>
          <p className="text-sm mt-1">
            At your current trajectory, you'll reach <strong>{nextBandLabel}</strong> status in approximately{' '}
            <strong>{projectionDays} day{projectionDays !== 1 ? 's' : ''}</strong>.
          </p>
        </div>
      )}

      {/* Metric breakdown */}
      {!scoreData.isNew && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Metric Breakdown</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metricBreakdown.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>
        </div>
      )}

      {/* Rewards summary */}
      <RewardsSummary currentBand={scoreData.performanceBand as PerformanceBand} />
    </div>
  );
}
