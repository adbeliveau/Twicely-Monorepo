"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/components/helpdesk/helpdesk-badges";
import type { Priority } from "@/components/helpdesk/helpdesk-badges";
import { CaseWatchersList } from "@/components/helpdesk/case-watchers";
import type { CaseWatcherItem } from "@/lib/queries/helpdesk-cases";

interface QueueCase {
  id: string;
  caseNumber: string;
  subject: string;
  priority: string;
  status: string;
  type: string;
  lastActivityAt: Date;
  slaFirstResponseDueAt?: Date | null;
  firstResponseAt?: Date | null;
  slaFirstResponseBreached?: boolean;
}

interface CaseQueuePanelProps {
  cases: QueueCase[];
  selectedCaseId: string;
  watchers?: CaseWatcherItem[];
  className?: string;
}

const TYPE_ICONS: Record<string, string> = {
  SUPPORT: "💬", DISPUTE: "⚖️", RETURN: "📦",
  CHARGEBACK: "💳", MODERATION: "🛡️", ACCOUNT: "👤",
};

const AVAILABILITY_KEY = "hd-agent-availability";

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/**
 * Compact SLA label for queue rows.
 * Returns { label, className } based on remaining time.
 */
function slaLabel(dueAt: Date | null | undefined, firstResponseAt: Date | null | undefined): { label: string; cls: string } | null {
  if (firstResponseAt) return { label: "Met", cls: "text-[11px] text-green-500 font-medium" };
  if (!dueAt) return null;
  const diffMs = new Date(dueAt).getTime() - Date.now();
  const absMins = Math.max(0, Math.floor(Math.abs(diffMs) / 60000));
  const hrs = Math.floor(absMins / 60);
  const mins = absMins % 60;
  const text = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  if (diffMs < 0) return { label: "BREACH", cls: "hd-sla-breach" };
  if (diffMs < 30 * 60000) return { label: text, cls: "hd-sla-breach" };
  if (diffMs < 60 * 60000) return { label: text, cls: "hd-sla-warning" };
  return { label: text, cls: "hd-sla" };
}

export function CaseQueuePanel({ cases, selectedCaseId, watchers = [], className }: CaseQueuePanelProps) {
  const [search, setSearch] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  // Load persisted availability state on mount (client-only)
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(AVAILABILITY_KEY);
        if (stored === "offline") setIsOnline(false);
      } catch {
        // localStorage unavailable; keep default
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleAvailability() {
    const next = !isOnline;
    setIsOnline(next);
    try {
      localStorage.setItem(AVAILABILITY_KEY, next ? "online" : "offline");
    } catch {
      // ignore persistence failure
    }
  }

  const filtered = cases.filter(
    (c) =>
      c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("hd-workspace-left", className)}>
      {/* Header — with online status dot */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "rgb(var(--hd-border))" }}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              isOnline ? "bg-emerald-500" : "bg-slate-400"
            )}
            style={isOnline ? { boxShadow: "0 0 6px rgba(34,197,94,0.6)" } : undefined}
            title={isOnline ? "Online — receiving routed cases" : "Offline — not receiving new cases"}
            aria-label={isOnline ? "Agent online" : "Agent offline"}
          />
          <span className="font-bold text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>
            My Cases
          </span>
        </div>
        <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
          {cases.length}
        </span>
      </div>

      {/* Search */}
      <div className="p-2 border-b" style={{ borderColor: "rgb(var(--hd-border))" }}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter cases..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border outline-none hd-transition"
            style={{
              background: "rgb(var(--hd-bg-card))",
              borderColor: "rgb(var(--hd-border))",
              color: "rgb(var(--hd-text-primary))",
            }}
          />
        </div>
      </div>

      {/* Case List */}
      <div className="flex-1 overflow-y-auto hd-scrollbar">
        {filtered.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>
              {search ? "No cases match" : "No cases assigned"}
            </div>
          </div>
        ) : (
          filtered.map((c) => {
            const isSelected = c.id === selectedCaseId;
            const sla = slaLabel(c.slaFirstResponseDueAt, c.firstResponseAt);
            return (
              <a
                key={c.id}
                href={`/hd/cases/${c.id}`}
                className={cn(
                  "hd-case-card",
                  isSelected && "hd-case-card-active"
                )}
                style={{ display: "block", padding: "12px 16px" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "rgb(var(--hd-text-dim))" }}
                  >
                    {c.caseNumber}
                  </span>
                  <PriorityBadge priority={c.priority as Priority} size="sm" />
                </div>
                <div
                  className="text-sm font-medium mb-1.5 line-clamp-2"
                  style={{ color: isSelected ? "rgb(var(--hd-text-primary))" : "rgb(var(--hd-text-secondary))" }}
                >
                  {c.subject}
                </div>
                <div className="flex items-center justify-between text-[11px]" style={{ color: "rgb(var(--hd-text-muted))" }}>
                  <div className="flex items-center gap-1.5">
                    <span>{TYPE_ICONS[c.type] ?? "📋"}</span>
                    <span className="capitalize">{c.type.toLowerCase()}</span>
                  </div>
                  {sla ? (
                    <span className={sla.cls}>{sla.label}</span>
                  ) : (
                    <span>{timeAgo(c.lastActivityAt)}</span>
                  )}
                </div>
              </a>
            );
          })
        )}
      </div>

      {/* Watchers list — moved here from header to save vertical space in the center panel */}
      <CaseWatchersList watchers={watchers} />

      {/* Footer — availability toggle */}
      <div
        className="border-t px-3 py-2 flex-shrink-0"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-deep))" }}
      >
        <button
          type="button"
          onClick={toggleAvailability}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium hd-transition",
            isOnline
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20"
              : "bg-slate-500/10 text-slate-500 border border-slate-500/30 hover:bg-slate-500/20"
          )}
          title={isOnline ? "Go offline (stop receiving new cases)" : "Go online (resume receiving new cases)"}
        >
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-slate-400")} />
          <span>{isOnline ? "Online" : "Offline"}</span>
        </button>
      </div>
    </div>
  );
}
