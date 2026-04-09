/**
 * Tax Withholding card — Finance Intelligence Layer.
 * No data gate (always shown for PRO sellers).
 *
 * DISCLAIMER: This is not tax advice. Consult a qualified tax professional
 * for your specific situation.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { AlertCircle } from 'lucide-react';
import { formatCentsToDollars } from '@twicely/finance/format';

interface TaxWithholdingCardProps {
  sellerProfileId: string;
  netProfitYtdCents: number;
  /** Effective tax rate in basis points from platform_settings. */
  estimatedTaxRateBps: number;
}

export function TaxWithholdingCard({
  netProfitYtdCents,
  estimatedTaxRateBps,
}: TaxWithholdingCardProps) {
  const estimatedTaxCents = Math.round((netProfitYtdCents * estimatedTaxRateBps) / 10000);
  const ratePercent = (estimatedTaxRateBps / 100).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tax Withholding Estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Net profit YTD</span>
          <span className="font-semibold">{formatCentsToDollars(netProfitYtdCents)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Estimated tax rate</span>
          <span className="font-semibold">{ratePercent}%</span>
        </div>
        <div className="flex justify-between items-center border-t pt-2">
          <span className="text-sm text-muted-foreground">Estimated tax owed</span>
          <span className="font-bold text-amber-600">
            {formatCentsToDollars(estimatedTaxCents)}
          </span>
        </div>
        <div className="flex items-start gap-2 bg-muted/50 rounded-md p-3 mt-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            This is not tax advice. Consult a qualified tax professional for your specific situation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
