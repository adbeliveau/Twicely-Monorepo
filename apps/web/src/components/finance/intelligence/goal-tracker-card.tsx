/**
 * Goal Tracker card — Finance Intelligence Layer.
 * Shows progress toward seller-configured revenue and profit goals.
 * No data gate (manual goal setting).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';

interface FinanceGoals {
  revenueGoalCents?: number | null;
  profitGoalCents?: number | null;
}

interface GoalTrackerCardProps {
  sellerProfileId: string;
  financeGoals: FinanceGoals | null;
  currentMonthRevenueCents: number;
  currentMonthProfitCents: number;
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="w-full bg-muted rounded-full h-2 mt-2">
      <div
        className="bg-primary h-2 rounded-full transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function GoalRow({
  label,
  currentCents,
  goalCents,
}: {
  label: string;
  currentCents: number;
  goalCents: number;
}) {
  const percent = goalCents > 0 ? Math.round((currentCents / goalCents) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {formatCentsToDollars(currentCents)} / {formatCentsToDollars(goalCents)}
        </span>
      </div>
      <ProgressBar percent={percent} />
      <p className="text-xs text-muted-foreground text-right">{percent}% of goal</p>
    </div>
  );
}

export function GoalTrackerCard({
  financeGoals,
  currentMonthRevenueCents,
  currentMonthProfitCents,
}: GoalTrackerCardProps) {
  const hasRevenueGoal = financeGoals?.revenueGoalCents != null && financeGoals.revenueGoalCents > 0;
  const hasProfitGoal = financeGoals?.profitGoalCents != null && financeGoals.profitGoalCents > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Goal Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasRevenueGoal && !hasProfitGoal ? (
          <p className="text-sm text-muted-foreground">
            No goals set yet. Set a monthly revenue or profit goal to track progress.
          </p>
        ) : (
          <>
            {hasRevenueGoal && (
              <GoalRow
                label="Revenue this month"
                currentCents={currentMonthRevenueCents}
                goalCents={financeGoals!.revenueGoalCents!}
              />
            )}
            {hasProfitGoal && (
              <GoalRow
                label="Profit this month"
                currentCents={currentMonthProfitCents}
                goalCents={financeGoals!.profitGoalCents!}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
