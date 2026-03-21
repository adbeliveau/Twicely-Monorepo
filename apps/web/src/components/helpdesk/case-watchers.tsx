"use client";

import { useState, useTransition } from "react";
import { addCaseWatcher, removeCaseWatcher } from "@/lib/actions/helpdesk-agent";
import type { CaseWatcherItem } from "@/lib/queries/helpdesk-cases";
import { cn } from "@/lib/utils";

interface CaseWatchersProps {
  caseId: string;
  watchers: CaseWatcherItem[];
  currentStaffUserId: string;
}

function WatcherAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-blue-500/20 text-blue-400 flex-shrink-0">
      {initials}
    </div>
  );
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
              : "border-blue-500/50 text-blue-400 hover:bg-blue-500/10",
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
