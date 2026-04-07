"use client";

import { useRouter } from "next/navigation";

// =============================================================================
// REPORT METRIC CARD (no delta — simpler than StatCard)
// =============================================================================

export function ReportMetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

// =============================================================================
// VOLUME TIMESERIES CHART (CSS bars — created vs resolved per day)
// =============================================================================

export function VolumeTimeseries({
  data,
}: {
  data: { date: string; created: number; resolved: number }[];
}) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.created, d.resolved)), 1);

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-40">
        {data.map((d) => {
          const createdPct = (d.created / maxVal) * 100;
          const resolvedPct = (d.resolved / maxVal) * 100;
          const label = d.date.slice(5); // MM-DD
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex gap-px items-end" style={{ height: "120px" }}>
                <div
                  className="flex-1 bg-brand-500 rounded-t"
                  style={{ height: `${createdPct}%`, minHeight: d.created > 0 ? "2px" : "0" }}
                  title={`Created: ${d.created}`}
                />
                <div
                  className="flex-1 bg-emerald-500 rounded-t"
                  style={{ height: `${resolvedPct}%`, minHeight: d.resolved > 0 ? "2px" : "0" }}
                  title={`Resolved: ${d.resolved}`}
                />
              </div>
              <span className="text-[9px] text-gray-400 truncate w-full text-center">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-2">
        <LegendDot color="bg-brand-500" label="Created" />
        <LegendDot color="bg-emerald-500" label="Resolved" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// =============================================================================
// HORIZONTAL BAR LIST (type/channel breakdown)
// =============================================================================

export function HorizontalBarList({
  items,
  colorClass,
}: {
  items: { label: string; value: number }[];
  colorClass?: string;
}) {
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const barColor = colorClass ?? "bg-brand-500";

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-2">No data</p>
      ) : (
        items.map((item) => {
          const pct = Math.round((item.value / maxVal) * 100);
          return (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium">{item.label}</span>
                <span className="text-gray-500">{item.value}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// =============================================================================
// AGENT PERFORMANCE TABLE
// =============================================================================

export function AgentPerformanceTable({
  agents,
}: {
  agents: {
    agentId: string;
    agentName: string;
    casesHandled: number;
    avgResponseMinutes: number;
    avgResolutionMinutes: number;
    csatScore: number | null;
  }[];
}) {
  const fmtTime = (minutes: number) => {
    if (minutes === 0) return "—";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-2 font-semibold text-gray-600">Agent</th>
            <th className="pb-2 font-semibold text-gray-600 text-right">Cases</th>
            <th className="pb-2 font-semibold text-gray-600 text-right">Avg Response</th>
            <th className="pb-2 font-semibold text-gray-600 text-right">Avg Resolution</th>
            <th className="pb-2 font-semibold text-gray-600 text-right">CSAT</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {agents.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-gray-400">No agent data for this period</td>
            </tr>
          ) : (
            agents.map((a) => (
              <tr key={a.agentId}>
                <td className="py-2 font-medium text-gray-800">{a.agentName}</td>
                <td className="py-2 text-right text-gray-700">{a.casesHandled}</td>
                <td className="py-2 text-right text-gray-700">{fmtTime(a.avgResponseMinutes)}</td>
                <td className="py-2 text-right text-gray-700">{fmtTime(a.avgResolutionMinutes)}</td>
                <td className="py-2 text-right font-semibold">
                  {a.csatScore !== null ? (
                    <span className={a.csatScore >= 4.0 ? "text-green-600" : a.csatScore >= 3.0 ? "text-amber-600" : "text-red-600"}>
                      {a.csatScore.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// DATE RANGE SELECTOR (client component — navigates via router)
// =============================================================================

export function DateRangeSelector({ currentPreset }: { currentPreset: string }) {
  const router = useRouter();

  const presets = [
    { value: "today", label: "Today" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
    { value: "last_30_days", label: "Last 30 Days" },
  ];

  return (
    <select
      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      value={currentPreset}
      onChange={(e) => router.push(`/hd/reports?preset=${e.target.value}`)}
    >
      {presets.map((p) => (
        <option key={p.value} value={p.value}>{p.label}</option>
      ))}
    </select>
  );
}
