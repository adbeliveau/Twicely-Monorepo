/**
 * Profit by Category card — Finance Intelligence Layer.
 * Data gate: >= 5 sold orders with COGS data.
 * Returns null if gate not met.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';

export interface CategoryProfitRow {
  categoryId: string | null;
  categoryName: string;
  soldCount: number;
  revenueCents: number;
  cogsCents: number;
  profitCents: number;
  marginPercent: number;
}

interface ProfitByCategoryCardProps {
  sellerProfileId: string;
  rows: CategoryProfitRow[];
  totalWithCogs: number;
}

export function ProfitByCategoryCard({
  rows,
  totalWithCogs,
}: ProfitByCategoryCardProps) {
  // Data gate: >= 5 sold with COGS
  if (totalWithCogs < 5) return null;

  const sorted = [...rows].sort((a, b) => b.profitCents - a.profitCents).slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Profit by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map((row) => (
            <div
              key={row.categoryName}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{row.categoryName}</p>
                <p className="text-xs text-muted-foreground">
                  {row.soldCount} sold · {row.marginPercent.toFixed(1)}% margin
                </p>
              </div>
              <span
                className={`font-semibold ml-4 ${
                  row.profitCents >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCentsToDollars(row.profitCents)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
