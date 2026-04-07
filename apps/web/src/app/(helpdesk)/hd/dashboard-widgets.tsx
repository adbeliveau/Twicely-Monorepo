"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// =============================================================================
// STAT CARD
// =============================================================================

export function StatCard({
  label, value, delta, deltaLabel, deltaIsPercent, deltaIsMinutes, color, isPositiveGood, trend,
}: {
  label: string;
  value: number | string;
  delta: number | null;
  deltaLabel: string;
  deltaIsPercent?: boolean;
  deltaIsMinutes?: boolean;
  color: "blue" | "green" | "cyan" | "red" | "amber";
  isPositiveGood: boolean;
  trend?: number[];
}) {
  const borderColors = {
    blue: "border-t-blue-500", green: "border-t-green-500", cyan: "border-t-cyan-500",
    red: "border-t-red-500", amber: "border-t-amber-500",
  };

  const accentColors = {
    blue: "rgb(59,130,246)", green: "rgb(34,197,94)", cyan: "rgb(6,182,212)",
    red: "rgb(239,68,68)", amber: "rgb(245,158,11)",
  };

  const showDelta = delta !== null && delta !== 0;
  const isPositive = delta !== null && delta > 0;
  const isGood = isPositiveGood ? isPositive : !isPositive;

  const formatDelta = () => {
    if (delta === null) return "—";
    if (deltaIsMinutes) return `${delta > 0 ? "+" : ""}${delta}min`;
    if (deltaIsPercent) return `${delta > 0 ? "+" : ""}${delta}%`;
    return `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)}`;
  };

  return (
    <div
      className={`rounded-2xl border border-t-4 p-5 ${borderColors[color]}`}
      style={{ background: "rgb(var(--hd-bg-panel))", borderColor: "rgb(var(--hd-border))" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgb(var(--hd-text-muted))" }}>{label}</p>
      <h4 className="mt-2 text-2xl font-bold" style={{ color: "rgb(var(--hd-text-primary))" }}>{value}</h4>
      <div className="mt-2 flex items-center gap-1">
        {showDelta ? (
          <>
            <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold", isGood ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>
              {isPositive ? "▲" : "▼"} {formatDelta()}
            </span>
            <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{deltaLabel}</span>
          </>
        ) : (
          <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{deltaLabel}</span>
        )}
      </div>
      {/* Sparkline */}
      {trend && trend.length > 0 && (
        <SparkLine values={trend} color={accentColors[color]} />
      )}
    </div>
  );
}

// =============================================================================
// SPARKLINE
// =============================================================================

function SparkLine({ values, color }: { values: number[]; color: string }) {
  const width = 40;
  const height = 20;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1 || 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="mt-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// =============================================================================
// CASE VOLUME CHART (CSS bars — no ApexCharts)
// =============================================================================

export function CaseVolumeChart({ data }: { data: { date: string; email: number; web: number; system: number }[] }) {
  const maxTotal = Math.max(...data.map((d) => d.email + d.web + d.system));

  return (
    <div className="w-full">
      <div className="flex items-end gap-2 h-52">
        {data.map((d) => {
          const total = d.email + d.web + d.system;
          const heightPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          const emailPct = total > 0 ? (d.email / total) * 100 : 0;
          const webPct = total > 0 ? (d.web / total) * 100 : 0;
          const sysPct = total > 0 ? (d.system / total) * 100 : 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end rounded-md overflow-hidden" style={{ height: `${heightPct}%`, minHeight: total > 0 ? "4px" : 0 }}>
                <div className="bg-brand-500" style={{ height: `${emailPct}%` }} title={`Email: ${d.email}`} />
                <div className="bg-emerald-500" style={{ height: `${webPct}%` }} title={`Web: ${d.web}`} />
                <div className="bg-indigo-500" style={{ height: `${sysPct}%` }} title={`System: ${d.system}`} />
              </div>
              <span className="text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>{d.date}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3">
        <LegendDot color="bg-brand-500" label="Email" />
        <LegendDot color="bg-emerald-500" label="Web" />
        <LegendDot color="bg-indigo-500" label="System" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
      <span className="text-xs" style={{ color: "rgb(var(--hd-text-dim))" }}>{label}</span>
    </div>
  );
}

// =============================================================================
// TEAM WORKLOAD ROW
// =============================================================================

export function TeamWorkloadRow({ agent }: { agent: { name: string; initials: string; current: number; max: number } }) {
  const pct = Math.round((agent.current / agent.max) * 100);
  const isNearCap = pct >= 80;
  return (
    <div className="flex items-center gap-3">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold", isNearCap ? "bg-red-500/20 text-red-500" : "bg-brand-500/20 text-brand-500")}>
        {agent.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium truncate" style={{ color: "rgb(var(--hd-text-primary))" }}>{agent.name}</span>
          <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{agent.current} / {agent.max} cases</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgb(var(--hd-bg-card))" }}>
          <div className={cn("h-full rounded-full transition-all", isNearCap ? "bg-red-500" : "bg-brand-500")} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SLA RING (SVG)
// =============================================================================

export function SlaRing({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => v >= 90 ? "#10b981" : v >= 80 ? "#f59e0b" : "#ef4444";
  const color = getColor(value);
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const targetOffset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  const hasGlow = value >= 90;

  // Animate from empty to target on mount
  const [dashOffset, setDashOffset] = useState(circumference);
  useEffect(() => {
    const timer = setTimeout(() => setDashOffset(targetOffset), 50);
    return () => clearTimeout(timer);
  }, [targetOffset]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} stroke="rgb(var(--hd-border))" strokeWidth="6" fill="none" />
          <circle
            cx="40" cy="40" r={r} stroke={color} strokeWidth="6" fill="none"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 0.8s ease-out",
              filter: hasGlow ? `drop-shadow(0 0 4px ${color})` : undefined,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color: "rgb(var(--hd-text-primary))" }}>{value}%</span>
        </div>
      </div>
      <span className="mt-2 text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{label}</span>
    </div>
  );
}

// =============================================================================
// ACTIVITY ROW
// =============================================================================

export function ActivityRow({ activity }: { activity: { type: string; agent: string; caseNumber: string; description: string; timeAgo: string } }) {
  const icons: Record<string, string> = { resolved: "✅", assigned: "👤", created: "📥", escalated: "🔺", activity: "⚡" };

  const getDescription = () => {
    switch (activity.type) {
      case "resolved":
        return <><span className="font-medium" style={{ color: "rgb(var(--hd-text-primary))" }}>{activity.agent}</span>{" resolved "}<span className="font-medium text-brand-500">{activity.caseNumber}</span></>;
      case "assigned":
        return <><span className="font-medium text-brand-500">{activity.caseNumber}</span>{" assigned to "}<span className="font-medium" style={{ color: "rgb(var(--hd-text-primary))" }}>{activity.agent}</span></>;
      case "created":
        return <>{"New case "}<span className="font-medium text-brand-500">{activity.caseNumber}</span>{" from "}<span style={{ color: "rgb(var(--hd-text-secondary))" }}>{activity.agent}</span></>;
      case "escalated":
        return <><span className="font-medium" style={{ color: "rgb(var(--hd-text-primary))" }}>{activity.agent}</span>{" escalated "}<span className="font-medium text-brand-500">{activity.caseNumber}</span>{activity.description && <span style={{ color: "rgb(var(--hd-text-muted))" }}> to {activity.description}</span>}</>;
      default:
        return activity.description;
    }
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-lg">{icons[activity.type] ?? "⚡"}</span>
      <div className="flex-1 min-w-0 text-sm" style={{ color: "rgb(var(--hd-text-secondary))" }}>{getDescription()}</div>
      <span className="text-xs whitespace-nowrap" style={{ color: "rgb(var(--hd-text-dim))" }}>{activity.timeAgo}</span>
    </div>
  );
}
