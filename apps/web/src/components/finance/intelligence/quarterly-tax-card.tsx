/**
 * Quarterly Tax card — Finance Intelligence Layer.
 * No data gate (always shown for PRO sellers).
 *
 * DISCLAIMER: This is not tax advice. Consult a qualified tax professional
 * for your specific situation.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { AlertCircle } from 'lucide-react';
import { formatCentsToDollars } from '@twicely/finance/format';

interface QuarterlyTaxRow {
  quarter: string;   // e.g. "Q1 2026"
  profitCents: number;
  estimatedTaxCents: number;
  dueDate: string;   // e.g. "April 15, 2026"
}

interface QuarterlyTaxCardProps {
  sellerProfileId: string;
  quarters: QuarterlyTaxRow[];
}

export function QuarterlyTaxCard({ quarters }: QuarterlyTaxCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quarterly Tax Estimates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {quarters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quarterly data available yet. Quarterly estimates appear after your first completed quarter.
          </p>
        ) : (
          <div className="space-y-3">
            {quarters.map((q) => (
              <div key={q.quarter} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{q.quarter}</span>
                  <span className="text-sm text-muted-foreground">Due {q.dueDate}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Profit</span>
                  <span>{formatCentsToDollars(q.profitCents)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Est. tax</span>
                  <span className="font-semibold text-amber-600">
                    {formatCentsToDollars(q.estimatedTaxCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
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
