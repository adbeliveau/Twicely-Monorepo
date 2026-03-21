'use client';

import { formatCentsToDollars } from '@twicely/finance/format';
import type { ExpenseCategoryBreakdown } from '@/lib/queries/finance-center';

interface ExpenseCategoryChartProps {
  data: ExpenseCategoryBreakdown[];
  totalCents: number;
}

export function ExpenseCategoryChart({ data, totalCents }: ExpenseCategoryChartProps) {
  if (data.length === 0 || totalCents === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No expense data to display.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.category} className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">{item.category}</span>
            <span className="text-muted-foreground">
              {formatCentsToDollars(item.totalCents)}
              <span className="ml-2 text-xs">({item.percentOfTotal.toFixed(1)}%)</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, item.percentOfTotal)}%` }}
            />
          </div>
        </div>
      ))}
      <div className="pt-2 border-t flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span>{formatCentsToDollars(totalCents)}</span>
      </div>
    </div>
  );
}
