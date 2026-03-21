'use client';

import type { MetricBreakdownItem } from '@/lib/queries/seller-score';

interface MetricCardProps {
  metric: MetricBreakdownItem;
}

function formatValue(key: string, value: number): string {
  if (key === 'reviewAverage') return value.toFixed(2);
  if (key === 'responseTime') return `${value.toFixed(1)}h`;
  return `${(value * 100).toFixed(1)}%`;
}

function formatIdeal(key: string, ideal: number): string {
  if (key === 'reviewAverage') return `${ideal.toFixed(1)} stars`;
  if (key === 'responseTime') return `≤ ${ideal}h`;
  if (key === 'onTimeShipping') return `≥ ${(ideal * 100).toFixed(0)}%`;
  return `≤ ${(ideal * 100).toFixed(1)}%`;
}

function scoreColor(score: number): string {
  if (score >= 800) return 'text-green-600';
  if (score >= 600) return 'text-blue-600';
  if (score >= 400) return 'text-orange-500';
  return 'text-red-500';
}

function scoreBgBar(score: number): string {
  if (score >= 800) return 'bg-green-500';
  if (score >= 600) return 'bg-blue-500';
  if (score >= 400) return 'bg-orange-400';
  return 'bg-red-400';
}

function isBelowAverage(key: string, value: number, ideal: number): boolean {
  if (key === 'reviewAverage' || key === 'onTimeShipping') return value < ideal * 0.9;
  return value > ideal * 1.5;
}

export function MetricCard({ metric }: MetricCardProps) {
  const { key, label, value, score, ideal, weight, tips } = metric;
  const showTip = isBelowAverage(key, value, ideal) && tips.length > 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{label}</div>
          <div className="text-2xl font-bold mt-0.5">{formatValue(key, value)}</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold tabular-nums ${scoreColor(score)}`}>{score}</div>
          <div className="text-xs text-muted-foreground">/ 1000</div>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-1.5 rounded-full transition-all ${scoreBgBar(score)}`}
          style={{ width: `${(score / 1000) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Ideal: {formatIdeal(key, ideal)}</span>
        <span>Weight: {(weight * 100).toFixed(0)}%</span>
      </div>

      {showTip && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
          <span className="font-medium">Tip: </span>{tips[0]}
        </div>
      )}
    </div>
  );
}
