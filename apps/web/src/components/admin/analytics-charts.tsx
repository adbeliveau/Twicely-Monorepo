'use client';

import { useState, useTransition } from 'react';
import { ChartCard } from '@/components/admin/chart-card';
import { fetchAnalyticsTimeSeries } from '@/lib/actions/admin-analytics';
import type { TimeSeriesPoint } from '@/lib/queries/admin-analytics';

interface ChartDataSet {
  gmv: TimeSeriesPoint[];
  orders: TimeSeriesPoint[];
  users: TimeSeriesPoint[];
  fees: TimeSeriesPoint[];
}

interface AnalyticsChartsProps {
  initialData: ChartDataSet;
}

function BarChart({ data, formatValue }: { data: TimeSeriesPoint[]; formatValue: (v: number) => string }) {
  if (data.length === 0) {
    return <p className="text-xs text-gray-400">No data for this period</p>;
  }
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-1">
      {data.map((point) => (
        <div key={point.date} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-right text-xs text-gray-500">{point.date.slice(5)}</span>
          <div className="relative flex-1 h-4 bg-gray-100 rounded">
            <div
              className="h-4 rounded bg-info-400"
              style={{ width: `${(point.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-xs text-gray-600">{formatValue(point.value)}</span>
        </div>
      ))}
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

export function AnalyticsCharts({ initialData }: AnalyticsChartsProps) {
  const [data, setData] = useState<ChartDataSet>(initialData);
  const [activePeriod, setActivePeriod] = useState<string>('30d');
  const [, startTransition] = useTransition();

  function handlePeriodChange(key: string) {
    setActivePeriod(key);
    const days = key === '7d' ? 7 : key === '90d' ? 90 : 30;
    startTransition(async () => {
      const [gmv, orders, users, fees] = await Promise.all([
        fetchAnalyticsTimeSeries('gmv', days),
        fetchAnalyticsTimeSeries('orders', days),
        fetchAnalyticsTimeSeries('users', days),
        fetchAnalyticsTimeSeries('fees', days),
      ]);
      setData({ gmv, orders, users, fees });
    });
  }

  const periods = [
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
    { key: '90d', label: '90 days' },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title="GMV Trend"
        periods={periods}
        activePeriod={activePeriod}
        onPeriodChange={handlePeriodChange}
        chartHeight="min-h-[200px]"
      >
        <BarChart data={data.gmv} formatValue={formatCents} />
      </ChartCard>

      <ChartCard
        title="Orders Trend"
        periods={periods}
        activePeriod={activePeriod}
        onPeriodChange={handlePeriodChange}
        chartHeight="min-h-[200px]"
      >
        <BarChart data={data.orders} formatValue={formatCount} />
      </ChartCard>

      <ChartCard
        title="User Signups"
        periods={periods}
        activePeriod={activePeriod}
        onPeriodChange={handlePeriodChange}
        chartHeight="min-h-[200px]"
      >
        <BarChart data={data.users} formatValue={formatCount} />
      </ChartCard>

      <ChartCard
        title="Fee Revenue"
        periods={periods}
        activePeriod={activePeriod}
        onPeriodChange={handlePeriodChange}
        chartHeight="min-h-[200px]"
      >
        <BarChart data={data.fees} formatValue={formatCents} />
      </ChartCard>
    </div>
  );
}
