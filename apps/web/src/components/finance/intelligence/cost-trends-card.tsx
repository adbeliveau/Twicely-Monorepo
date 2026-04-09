/**
 * Cost Trends card — Finance Intelligence Layer.
 * Data gate: >= 3 months of expense history.
 * Returns null if gate not met.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';

export interface MonthlyExpenseSummary {
  month: string;       // "YYYY-MM"
  totalCents: number;
  topCategory: string;
}

interface CostTrendsCardProps {
  sellerProfileId: string;
  monthlyExpenses: MonthlyExpenseSummary[];
}

export function CostTrendsCard({ monthlyExpenses }: CostTrendsCardProps) {
  // Data gate: >= 3 months
  if (monthlyExpenses.length < 3) return null;

  const sorted = [...monthlyExpenses].sort((a, b) => a.month.localeCompare(b.month));
  const recent = sorted.slice(-6); // Show up to 6 months

  const firstMonth = sorted[0]!;
  const lastMonth = sorted[sorted.length - 1]!;
  const trend =
    firstMonth.totalCents > 0
      ? Math.round(((lastMonth.totalCents - firstMonth.totalCents) / firstMonth.totalCents) * 100)
      : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cost Trends</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Trend vs. first tracked month</span>
          <span
            className={`text-sm font-semibold ${trend > 0 ? 'text-red-600' : trend < 0 ? 'text-green-600' : 'text-muted-foreground'}`}
          >
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        </div>
        <div className="space-y-2">
          {recent.map((m) => (
            <div key={m.month} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">{m.month}</span>
                <span className="text-xs text-muted-foreground ml-2">· {m.topCategory}</span>
              </div>
              <span className="font-medium">{formatCentsToDollars(m.totalCents)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
