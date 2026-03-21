'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { ScoreHistoryPoint } from '@/lib/queries/seller-score';

interface ScoreChartProps {
  history: ScoreHistoryPoint[];
  bandThresholds: { powerSeller: number; topRated: number; established: number };
}

const RANGE_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
];

export function ScoreChart({ history, bandThresholds }: ScoreChartProps) {
  const [range, setRange] = useState(90);

  const filtered = history.slice(-range);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const chartData = filtered.map((p) => ({
    date: formatDate(p.date),
    score: p.score,
    rawDate: p.date,
  }));

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Score History</h3>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                range === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          No score history yet. Check back after your daily recalculation.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis domain={[0, 1000]} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) => [`${value}`, 'Score']}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {/* Band threshold reference lines */}
            <ReferenceLine y={bandThresholds.powerSeller} stroke="#7c3aed" strokeDasharray="4 2" label={{ value: 'Power Seller', position: 'right', fontSize: 10, fill: '#7c3aed' }} />
            <ReferenceLine y={bandThresholds.topRated} stroke="#2563eb" strokeDasharray="4 2" label={{ value: 'Top Rated', position: 'right', fontSize: 10, fill: '#2563eb' }} />
            <ReferenceLine y={bandThresholds.established} stroke="#16a34a" strokeDasharray="4 2" label={{ value: 'Established', position: 'right', fontSize: 10, fill: '#16a34a' }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
