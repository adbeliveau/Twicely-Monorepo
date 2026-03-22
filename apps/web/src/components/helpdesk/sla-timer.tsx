"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// SHARED TYPES
// =============================================================================

type SlaState = "ok" | "warning" | "critical" | "breached" | "met" | "none";

// =============================================================================
// SLA TIMER COMPONENT
// Real-time countdown with warning and breach states
// =============================================================================

interface SlaTimerProps {
  dueAt: string | Date | null;
  isMet?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function formatTime(ms: number): string {
  if (ms <= 0) return "BREACHED";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function SlaTimer({ dueAt, isMet = false, label, size = "md", className }: SlaTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [state, setState] = useState<SlaState>("none");

  useEffect(() => {
    if (!dueAt) { setState("none"); return; }
    if (isMet) { setState("met"); return; }

    const update = () => {
      const remaining = new Date(dueAt).getTime() - Date.now();
      setTimeRemaining(remaining);
      if (remaining <= 0) setState("breached");
      else if (remaining <= 30 * 60 * 1000) setState("critical");
      else if (remaining <= 60 * 60 * 1000) setState("warning");
      else setState("ok");
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dueAt, isMet]);

  const stateStyles: Record<SlaState, string> = {
    ok: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
    warning: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400",
    critical: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400",
    breached: "bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-400 hd-sla-breach",
    met: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-600 dark:text-green-400",
    none: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500",
  };

  const sizeStyles = {
    sm: "px-2 py-1 text-xs gap-1.5",
    md: "px-3 py-1.5 text-sm gap-2",
    lg: "px-4 py-2 text-base gap-2",
  };

  return (
    <div className={cn("inline-flex items-center rounded-md border font-medium", sizeStyles[size], stateStyles[state], className)}>
      <span>{state === "met" ? "✅" : state === "breached" ? "🚨" : "⏱"}</span>
      {label && <span className="text-slate-500 dark:text-slate-400 font-normal">{label}:</span>}
      <span className="font-mono font-semibold">
        {state === "none" && "—"}
        {state === "met" && "Met"}
        {state !== "none" && state !== "met" && timeRemaining !== null && formatTime(timeRemaining)}
      </span>
    </div>
  );
}

// =============================================================================
// SLA INDICATOR (compact for tables)
// =============================================================================

interface SlaIndicatorProps {
  dueAt: string | Date | null;
  isMet?: boolean;
  className?: string;
}

export function SlaIndicator({ dueAt, isMet = false, className }: SlaIndicatorProps) {
  const [state, setState] = useState<SlaState>("none");
  const [display, setDisplay] = useState<string>("—");

  useEffect(() => {
    if (!dueAt) { setState("none"); setDisplay("—"); return; }
    if (isMet) { setState("met"); setDisplay("✓"); return; }

    const update = () => {
      const remaining = new Date(dueAt).getTime() - Date.now();
      if (remaining <= 0) { setState("breached"); setDisplay("BREACH"); }
      else if (remaining <= 30 * 60 * 1000) {
        setState("critical");
        setDisplay(`${Math.floor(remaining / 60000)}m`);
      } else if (remaining <= 60 * 60 * 1000) {
        setState("warning");
        setDisplay(`${Math.floor(remaining / 60000)}m`);
      } else {
        setState("ok");
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        setDisplay(`${h}h ${m}m`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dueAt, isMet]);

  const stateColors: Record<SlaState, string> = {
    ok: "text-slate-500 dark:text-slate-400",
    warning: "text-amber-600 dark:text-amber-400",
    critical: "text-red-600 dark:text-red-400 font-semibold",
    breached: "text-red-600 dark:text-red-400 font-bold hd-sla-breach",
    met: "text-green-600 dark:text-green-400",
    none: "text-slate-400 dark:text-slate-500",
  };

  return <span className={cn("font-mono text-xs", stateColors[state], className)}>{display}</span>;
}

// =============================================================================
// SLA PROGRESS BAR
// =============================================================================

interface SlaProgressProps {
  dueAt: string | Date | null;
  startedAt: string | Date;
  isMet?: boolean;
  className?: string;
}

export function SlaProgress({ dueAt, startedAt, isMet = false, className }: SlaProgressProps) {
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState<SlaState>("none");

  useEffect(() => {
    if (!dueAt || isMet) {
      setProgress(isMet ? 100 : 0);
      setState(isMet ? "met" : "none");
      return;
    }

    const update = () => {
      const start = new Date(startedAt).getTime();
      const due = new Date(dueAt).getTime();
      const total = due - start;
      const elapsed = Date.now() - start;
      const pct = total <= 0 ? 100 : Math.min(100, Math.max(0, (elapsed / total) * 100));
      setProgress(pct);
      if (pct >= 100) setState("breached");
      else if (pct >= 90) setState("critical");
      else if (pct >= 75) setState("warning");
      else setState("ok");
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [dueAt, startedAt, isMet]);

  const barColors: Record<SlaState, string> = {
    ok: "bg-green-500",
    warning: "bg-amber-500",
    critical: "bg-red-500",
    breached: "bg-red-600 hd-sla-breach",
    met: "bg-green-500",
    none: "bg-slate-400",
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full transition-all duration-500", barColors[state])} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
