import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'neutral';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  /** e.g. "11.01%" — absolute string, direction determined by `trendDirection` */
  trendValue?: string;
  trendDirection?: TrendDirection;
  /** e.g. "vs last month" */
  trendLabel?: string;
  /** Optional secondary line below the value */
  subtitle?: string;
}

const trendColors: Record<TrendDirection, string> = {
  up: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
  down: 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * Dashboard metric card — TailAdmin-inspired design.
 * Icon in a rounded box, large value, and optional trend badge.
 *
 * Usage:
 * ```tsx
 * <MetricCard
 *   label="Total Revenue"
 *   value="$45,231"
 *   icon={<DollarSign className="size-6" />}
 *   trendValue="11.01%"
 *   trendDirection="up"
 * />
 * ```
 */
export function MetricCard({
  label,
  value,
  icon,
  trendValue,
  trendDirection = 'neutral',
  trendLabel,
  subtitle,
}: MetricCardProps): React.ReactElement {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 md:p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {icon}
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {label}
          </span>
          <h4 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </h4>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              {subtitle}
            </p>
          )}
        </div>

        {trendValue && (
          <div className="flex flex-col items-end gap-1">
            <span
              className={[
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                trendColors[trendDirection],
              ].join(' ')}
            >
              {trendDirection === 'up' && (
                <TrendingUp className="size-3" aria-hidden="true" />
              )}
              {trendDirection === 'down' && (
                <TrendingDown className="size-3" aria-hidden="true" />
              )}
              {trendValue}
            </span>
            {trendLabel && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {trendLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
