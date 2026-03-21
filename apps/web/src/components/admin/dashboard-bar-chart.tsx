'use client';

/**
 * DashboardBarChart — simple CSS-based horizontal bar chart.
 * No charting library. Proportional widths computed from max value in series.
 */

interface DataPoint {
  date: string;
  value: number;
}

interface DashboardBarChartProps {
  data: DataPoint[];
  formatValue: (value: number) => string;
  barColor?: string;
  emptyMessage?: string;
}

export function DashboardBarChart({
  data,
  formatValue,
  barColor = 'bg-blue-500',
  emptyMessage = 'No data yet',
}: DashboardBarChartProps) {
  if (data.length === 0) {
    return <p className="text-xs text-gray-400">{emptyMessage}</p>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-1.5">
      {data.map((point) => {
        const pct = Math.round((point.value / maxValue) * 100);
        return (
          <div key={point.date} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-right text-xs text-gray-500">
              {point.date}
            </span>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-4 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div
                  className={`h-full ${barColor} rounded-sm transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-xs font-medium text-gray-700">
                {formatValue(point.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
