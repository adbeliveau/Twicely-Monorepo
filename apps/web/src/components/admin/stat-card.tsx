import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardChange {
  value: number;
  period: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  change?: StatCardChange;
  icon?: ReactNode;
  /** Optional color accent for the icon box */
  color?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

const iconColorMap: Record<NonNullable<StatCardProps['color']>, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400',
  error: 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400',
  info: 'bg-info-50 text-info-600 dark:bg-info-500/10 dark:text-info-400',
};

function ChangeIndicator({ change }: { change: StatCardChange }) {
  const isPositive = change.value > 0;
  const isNeutral = change.value === 0;

  if (isNeutral) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
        <Minus className="h-3 w-3" aria-hidden="true" />
        <span>No change {change.period}</span>
      </div>
    );
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isPositive
          ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400'
          : 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400',
      ].join(' ')}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
      )}
      {isPositive ? '+' : ''}
      {change.value}% {change.period}
    </span>
  );
}

export function StatCard({
  label,
  value,
  change,
  icon,
  color = 'default',
}: StatCardProps): React.ReactElement {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {change && <ChangeIndicator change={change} />}
        </div>
        {icon && (
          <div
            className={[
              'flex h-10 w-10 items-center justify-center rounded-xl',
              iconColorMap[color],
            ].join(' ')}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
