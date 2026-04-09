/**
 * Revenue Velocity card — Finance Intelligence Layer.
 * Data gate: >= 3 orders this month.
 * Hidden (returns null) if gate not met.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';

interface RevenueVelocityCardProps {
  sellerProfileId: string;
  currentMonthRevenueCents: number;
  currentMonthOrderCount: number;
  currentDayOfMonth: number;
}

export function RevenueVelocityCard({
  currentMonthRevenueCents,
  currentMonthOrderCount,
  currentDayOfMonth,
}: RevenueVelocityCardProps) {
  // Data gate: >= 3 orders this month
  if (currentMonthOrderCount < 3) return null;

  const daysInMonth = 31; // conservative estimate
  const dailyRateCents =
    currentDayOfMonth > 0
      ? Math.round(currentMonthRevenueCents / currentDayOfMonth)
      : 0;
  const projectedMonthCents = dailyRateCents * daysInMonth;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Revenue Velocity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">This month so far</span>
          <span className="font-semibold">{formatCentsToDollars(currentMonthRevenueCents)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Orders this month</span>
          <span className="font-semibold">{currentMonthOrderCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Daily pace</span>
          <span className="font-semibold">{formatCentsToDollars(dailyRateCents)}/day</span>
        </div>
        <div className="flex justify-between items-center border-t pt-2">
          <span className="text-sm text-muted-foreground">Projected month-end</span>
          <span className="font-semibold text-primary">
            {formatCentsToDollars(projectedMonthCents)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
