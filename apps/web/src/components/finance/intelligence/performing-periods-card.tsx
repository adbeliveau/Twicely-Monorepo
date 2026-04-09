/**
 * Performing Periods card — Finance Intelligence Layer.
 * Data gate: >= 90 days + >= 20 orders (enforced by nightly compute, null if not met).
 * Returns null if gate not met.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@twicely/ui/card';
import { formatCentsToDollars } from '@twicely/finance/format';
import type { PerformingPeriods } from '@twicely/finance/projection-types';

interface PerformingPeriodsCardProps {
  sellerProfileId: string;
  performingPeriodsJson: PerformingPeriods | null;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PerformingPeriodsCard({ performingPeriodsJson }: PerformingPeriodsCardProps) {
  // Data gate enforced by nightly compute
  if (!performingPeriodsJson) return null;

  const { dayOfWeek, monthlyRevenue } = performingPeriodsJson;

  const maxDow = Math.max(...dayOfWeek, 1);
  const bestDowIdx = dayOfWeek.indexOf(Math.max(...dayOfWeek));

  const recentMonths = [...monthlyRevenue].slice(-6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Performing Periods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Best day: <span className="font-medium text-foreground">{DAY_LABELS[bestDowIdx]}</span>
          </p>
          <div className="flex gap-1 items-end h-12">
            {dayOfWeek.map((avg, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm ${i === bestDowIdx ? 'bg-primary' : 'bg-muted'}`}
                  style={{ height: `${Math.round((avg / maxDow) * 40)}px` }}
                />
                <span className="text-xs text-muted-foreground">{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>
        {recentMonths.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Monthly revenue</p>
            {recentMonths.map((m) => (
              <div key={m.month} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{m.month}</span>
                <span className="font-medium">{formatCentsToDollars(m.revenueCents)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
