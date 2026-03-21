"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/components/helpdesk/helpdesk-badges";
import type { Priority } from "@/components/helpdesk/helpdesk-badges";

interface QueueCase {
  id: string;
  caseNumber: string;
  subject: string;
  priority: string;
  status: string;
  type: string;
  lastActivityAt: Date;
}

interface CaseQueuePanelProps {
  cases: QueueCase[];
  selectedCaseId: string;
  className?: string;
}

const TYPE_ICONS: Record<string, string> = {
  SUPPORT: "💬", DISPUTE: "⚖️", RETURN: "📦",
  CHARGEBACK: "💳", MODERATION: "🛡️", ACCOUNT: "👤",
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function CaseQueuePanel({ cases, selectedCaseId, className }: CaseQueuePanelProps) {
  const [search, setSearch] = useState("");

  const filtered = cases.filter(
    (c) =>
      c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("hd-workspace-left", className)}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "rgb(var(--hd-border))" }}
      >
        <span className="font-bold text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>
          My Cases
        </span>
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
                  <span>{timeAgo(c.lastActivityAt)}</span>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
