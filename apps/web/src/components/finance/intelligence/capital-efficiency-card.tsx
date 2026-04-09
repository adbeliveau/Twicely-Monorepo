/**
 * Capital Efficiency card — Finance Intelligence Layer.
 * Data gate: >= 10 sold with COGS + >= 30 days.
 * Returns null if nightly projection not yet computed (dataQualityScore < threshold).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';

interface CapitalEfficiencyCardProps {
  sellerProfileId: string;
  inventoryTurnsPerMonth: number | null;  // basis points from nightly cache
  breakEvenRevenueCents: number | null;
  breakEvenOrders: number | null;
  avgSalePrice90dCents: number | null;
}

export function CapitalEfficiencyCard({
  inventoryTurnsPerMonth,
  breakEvenRevenueCents,
  breakEvenOrders,
  avgSalePrice90dCents,
}: CapitalEfficiencyCardProps) {
  // Data gate: nightly compute must have produced these values
  if (inventoryTurnsPerMonth === null && breakEvenRevenueCents === null) return null;

  const turnsFormatted =
    inventoryTurnsPerMonth !== null
      ? (inventoryTurnsPerMonth / 100).toFixed(1) + 'x'
      : 'Insufficient COGS data';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Capital Efficiency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Inventory turns / month</span>
          <span className="font-semibold">{turnsFormatted}</span>
        </div>
        {breakEvenRevenueCents !== null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Monthly break-even</span>
            <span className="font-semibold">
              {formatCentsToDollars(breakEvenRevenueCents)}
            </span>
          </div>
        )}
        {breakEvenOrders !== null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Break-even orders needed</span>
            <span className="font-semibold">{breakEvenOrders}</span>
          </div>
        )}
        {avgSalePrice90dCents !== null && (
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm text-muted-foreground">Avg sale price (90d)</span>
            <span className="font-semibold">
              {formatCentsToDollars(avgSalePrice90dCents)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
