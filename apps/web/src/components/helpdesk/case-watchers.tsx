"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { addCaseWatcher, removeCaseWatcher } from "@/lib/actions/helpdesk-watchers";
import type { CaseWatcherItem } from "@/lib/queries/helpdesk-cases";
import { cn } from "@/lib/utils";

// =============================================================================
// SHARED — avatar bubble for a watcher
// =============================================================================

function WatcherAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const sizeCls = size === "sm" ? "w-5 h-5 text-[9px]" : "w-7 h-7 text-[10px]";
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold bg-brand-500/20 text-brand-400 flex-shrink-0", sizeCls)}>
      {initials}
    </div>
  );
}

// =============================================================================
// WATCH TOGGLE BUTTON — compact, for the case header next to the subject
// =============================================================================

interface WatchToggleButtonProps {
  caseId: string;
  watchers: CaseWatcherItem[];
  currentStaffUserId: string;
}

export function WatchToggleButton({ caseId, watchers, currentStaffUserId }: WatchToggleButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isWatching = watchers.some((w) => w.staffUserId === currentStaffUserId);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const result = isWatching
        ? await removeCaseWatcher(caseId, currentStaffUserId)
        : await addCaseWatcher(caseId, currentStaffUserId);
      if (!result.success) setError(result.error ?? "Failed to update watcher.");
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium hd-transition",
        isWatching
          ? "border-brand-500/50 text-brand-500 bg-brand-500/10 hover:bg-brand-500/20"
          : "border-[rgb(var(--hd-border))] text-[rgb(var(--hd-text-muted))] hover:opacity-80",
        isPending && "opacity-50 cursor-not-allowed"
      )}
      title={error ?? (isWatching ? "Stop watching this case" : "Watch this case for updates")}
    >
      {isWatching ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      <span>{isWatching ? "Watching" : "Watch"}</span>
      {watchers.length > 0 && (
        <span
          className="ml-0.5 rounded-full px-1 text-[9px]"
          style={{ background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-muted))" }}
        >
          {watchers.length}
        </span>
      )}
    </button>
  );
}

// =============================================================================
// CASE WATCHERS LIST — compact roster, for the left sidebar bottom
// =============================================================================

interface CaseWatchersListProps {
  watchers: CaseWatcherItem[];
  className?: string;
}

export function CaseWatchersList({ watchers, className }: CaseWatchersListProps) {
  if (watchers.length === 0) return null;

  return (
    <div
      className={cn("border-t px-3 py-2 space-y-1.5 flex-shrink-0", className)}
      style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--hd-text-dim))" }}>
          Watchers
        </span>
        <span className="text-[10px]" style={{ color: "rgb(var(--hd-text-muted))" }}>
          {watchers.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {watchers.slice(0, 6).map((w) => (
          <div key={w.id} className="flex items-center gap-1" title={w.displayName}>
            <WatcherAvatar name={w.displayName} size="sm" />
          </div>
        ))}
        {watchers.length > 6 && (
          <span className="text-[10px] self-center" style={{ color: "rgb(var(--hd-text-muted))" }}>
            +{watchers.length - 6}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LEGACY — full watchers card with button + list (no longer rendered in workspace,
// kept for any existing callers)
// =============================================================================

interface CaseWatchersProps {
  caseId: string;
  watchers: CaseWatcherItem[];
  currentStaffUserId: string;
}

export function CaseWatchers({ caseId, watchers, currentStaffUserId }: CaseWatchersProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isWatching = watchers.some((w) => w.staffUserId === currentStaffUserId);

  const handleWatch = () => {
    setError(null);
    startTransition(async () => {
      const result = await addCaseWatcher(caseId, currentStaffUserId);
      if (!result.success) setError(result.error ?? "Failed to add watcher.");
    });
  };

  const handleUnwatch = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeCaseWatcher(caseId, currentStaffUserId);
      if (!result.success) setError(result.error ?? "Failed to remove watcher.");
    });
  };

  return (
    <div
      className="p-3 rounded-lg border text-sm space-y-2"
      style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgb(var(--hd-text-dim))" }}>
          Watchers ({watchers.length})
        </span>
        <button
          onClick={isWatching ? handleUnwatch : handleWatch}
          disabled={isPending}
          className={cn(
            "text-xs px-2 py-0.5 rounded border transition-colors",
            isWatching
              ? "border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400"
              : "border-brand-500/50 text-brand-400 hover:bg-brand-500/10",
            isPending && "opacity-50 cursor-not-allowed"
          )}
        >
          {isWatching ? "Unwatch" : "Watch"}
        </button>
      </div>

      {watchers.length === 0 ? (
        <p className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>No watchers yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {watchers.map((w) => (
            <li key={w.id} className="flex items-center gap-2">
              <WatcherAvatar name={w.displayName} />
              <span className="text-xs truncate" style={{ color: "rgb(var(--hd-text-secondary))" }}>
                {w.displayName}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
