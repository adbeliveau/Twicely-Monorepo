'use client';

import { useState, type ReactNode } from 'react';

type Period = { key: string; label: string };

const DEFAULT_PERIODS: Period[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Chart content (Recharts component) */
  children: ReactNode;
  /** Optional action element in the top-right (e.g. export button) */
  action?: ReactNode;
  /** Period tab options — defaults to 7d/30d/90d */
  periods?: Period[];
  /** Active period key */
  activePeriod?: string;
  /** Callback when period changes */
  onPeriodChange?: (key: string) => void;
  /** Optional class for the chart container height */
  chartHeight?: string;
}

/**
 * Card wrapper for charts.
 * Provides title bar with optional period tabs and a chart area.
 *
 * Usage:
 * ```tsx
 * <ChartCard title="Monthly Revenue" onPeriodChange={setPeriod}>
 *   <ResponsiveContainer width="100%" height={300}>
 *     <AreaChart data={data}>...</AreaChart>
 *   </ResponsiveContainer>
 * </ChartCard>
 * ```
 */
export function ChartCard({
  title,
  subtitle,
  children,
  action,
  periods = DEFAULT_PERIODS,
  activePeriod: controlledPeriod,
  onPeriodChange,
  chartHeight = 'min-h-[300px]',
}: ChartCardProps): React.ReactElement {
  const [internalPeriod, setInternalPeriod] = useState(periods[0]?.key ?? '');
  const activePeriod = controlledPeriod ?? internalPeriod;

  function handlePeriodChange(key: string) {
    setInternalPeriod(key);
    onPeriodChange?.(key);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Period Tabs */}
          {periods.length > 0 && (
            <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePeriodChange(p.key)}
                  className={[
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    activePeriod === p.key
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {action}
        </div>
      </div>

      {/* Chart Area */}
      <div className={['p-5', chartHeight].join(' ')}>{children}</div>
    </div>
  );
}
