'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatPrice } from '@twicely/utils/format';

interface PriceHistoryPoint {
  priceCents: number;
  recordedAt: Date;
}

interface PriceHistoryChartProps {
  history: PriceHistoryPoint[];
  currentPriceCents: number;
}

export function PriceHistoryChart({
  history,
  currentPriceCents,
}: PriceHistoryChartProps) {
  const chartData = useMemo(() => {
    // Add current price as final point if different from last recorded
    const points = [...history];
    const lastPoint = points[points.length - 1];
    if (!lastPoint || lastPoint.priceCents !== currentPriceCents) {
      points.push({
        priceCents: currentPriceCents,
        recordedAt: new Date(),
      });
    }

    return points.map((point) => ({
      date: point.recordedAt instanceof Date
        ? point.recordedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : new Date(point.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: point.priceCents / 100,
      priceCents: point.priceCents,
    }));
  }, [history, currentPriceCents]);

  // Don't show chart if only 1 data point (no history yet)
  if (chartData.length <= 1) {
    return null;
  }

  const prices = chartData.map((d) => d.price);
  const minPrice = Math.floor(Math.min(...prices) * 0.9);
  const maxPrice = Math.ceil(Math.max(...prices) * 1.1);

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Price History</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
              width={45}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  return (
                    <div className="rounded border bg-white px-3 py-2 shadow-sm">
                      <p className="text-sm font-medium">{formatPrice(data.priceCents)}</p>
                      <p className="text-xs text-muted-foreground">{data.date}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
