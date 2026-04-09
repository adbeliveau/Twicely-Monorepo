/**
 * Health Score card — Finance Intelligence Layer.
 * Data gate: >= 60 days account + >= 10 orders (enforced by nightly compute, null if not met).
 * Returns null if health score not yet computed.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import type { HealthScoreBreakdown } from '@twicely/finance/projection-types';

interface HealthScoreCardProps {
  sellerProfileId: string;
  healthScore: number | null;
  healthScoreBreakdownJson: HealthScoreBreakdown | null;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

export function HealthScoreCard({
  healthScore,
  healthScoreBreakdownJson,
}: HealthScoreCardProps) {
  // Data gate enforced by nightly compute — null means gate not met
  if (healthScore === null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Health Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`text-4xl font-bold ${scoreColor(healthScore)}`}>
            {healthScore}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        {healthScoreBreakdownJson && (
          <div className="space-y-2">
            <ScoreBar
              label="Profit margin trend (25%)"
              score={healthScoreBreakdownJson.profitMarginTrend}
            />
            <ScoreBar
              label="Expense ratio (20%)"
              score={healthScoreBreakdownJson.expenseRatio}
            />
            <ScoreBar
              label="Sell-through velocity (20%)"
              score={healthScoreBreakdownJson.sellThroughVelocity}
            />
            <ScoreBar
              label="Inventory age (20%)"
              score={healthScoreBreakdownJson.inventoryAge}
            />
            <ScoreBar
              label="Revenue growth (15%)"
              score={healthScoreBreakdownJson.revenueGrowth}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
