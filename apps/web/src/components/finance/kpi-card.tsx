import { Card, CardContent } from '@twicely/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCentsToDollars, calculateTrend } from '@twicely/finance/format';

interface KpiCardProps {
  title: string;
  valueCents: number;
  previousValueCents?: number;
  subtitle?: string;
  format?: 'currency' | 'percent' | 'number';
}

export function KpiCard({
  title,
  valueCents,
  previousValueCents,
  subtitle,
  format = 'currency',
}: KpiCardProps) {
  const trend =
    previousValueCents !== undefined
      ? calculateTrend(valueCents, previousValueCents)
      : null;

  const displayValue =
    format === 'currency'
      ? formatCentsToDollars(valueCents)
      : format === 'percent'
        ? `${(valueCents / 100).toFixed(2)}%`
        : valueCents.toLocaleString();

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold mt-1">{displayValue}</p>
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            {trend.direction === 'up' && (
              <TrendingUp className="h-3 w-3 text-green-500" />
            )}
            {trend.direction === 'down' && (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )}
            {trend.direction === 'flat' && (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
            <span
              className={`text-xs ${
                trend.direction === 'up'
                  ? 'text-green-500'
                  : trend.direction === 'down'
                    ? 'text-red-500'
                    : 'text-muted-foreground'
              }`}
            >
              {trend.direction !== 'flat' ? `${trend.percent}%` : 'No change'}
            </span>
          </div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
