"use client";

import Link from "next/link";
import { Timer, Mail, Globe, MessageSquare, ArrowRight, Hourglass, ChevronDown } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

export type CaseRowData = {
  id: string;
  caseNumber: string;
  subject: string;
  status: string;
  priority: string;
  type: string;
  channel: string;
  requesterId: string;
  requesterEmail: string | null;
  assignedAgentId: string | null;
  assignedTeam: { id: string; displayName: string } | null;
  slaFirstResponseDue: string | null;
  firstResponseAt: string | null;
  createdAt: string;
  lastActivityAt: string;
  waitingOnCustomer?: boolean;
  hasUnread?: boolean;
};

// =============================================================================
// BADGE CLASS MAPS (V2 theme classes)
// =============================================================================

const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: "hd-badge-critical",
  URGENT: "hd-badge-urgent",
  HIGH: "hd-badge-high",
  NORMAL: "hd-badge-normal",
  LOW: "hd-badge-low",
};

const PRIORITY_BAR_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  URGENT:   "#f97316",
  HIGH:     "#f59e0b",
  NORMAL:   "#3b82f6",
  LOW:      "#6b7280",
};

const STATUS_BADGE: Record<string, string> = {
  NEW: "hd-status-new",
  OPEN: "hd-status-open",
  PENDING_USER: "hd-status-pending",
  PENDING_INTERNAL: "hd-status-pending",
  ON_HOLD: "hd-status-resolved",
  ESCALATED: "hd-status-escalated",
  RESOLVED: "hd-status-resolved",
  CLOSED: "hd-status-closed",
};

type ChannelEntry = { icon: React.ComponentType<{ className?: string }>; label: string; color: string };
const CHANNEL_CONFIG: Record<string, ChannelEntry> = {
  EMAIL: { icon: Mail, label: "Email", color: "text-blue-400" },
  WEB: { icon: Globe, label: "Web", color: "text-green-400" },
  CHAT: { icon: MessageSquare, label: "Chat", color: "text-purple-400" },
  INTERNAL: { icon: MessageSquare, label: "Internal", color: "text-slate-400" },
  SYSTEM: { icon: MessageSquare, label: "System", color: "text-slate-400" },
};

// =============================================================================
// FILTER SELECT
// =============================================================================

export function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
        style={{
          background: "rgb(var(--hd-bg-panel))",
          borderColor: "rgb(var(--hd-border))",
          color: "rgb(var(--hd-text-secondary))",
        }}
      >
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDown
        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
        style={{ color: "rgb(var(--hd-text-muted))" }}
      />
    </div>
  );
}

// =============================================================================
// CASE ROW (V2-style themed)
// =============================================================================

export function CaseRow({ caseData: c, isSelected, onSelect, formatTimeAgo, getSlaStatus }: {
  caseData: CaseRowData;
  isSelected: boolean;
  onSelect: () => void;
  formatTimeAgo: (date: string) => string;
  getSlaStatus: (c: CaseRowData) => { label: string; className: string } | null;
}) {
  const sla = getSlaStatus(c);
  const channelConfig = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG["WEB"]!;
  const ChannelIcon = channelConfig.icon;
  const isWaitingOnCustomer = c.waitingOnCustomer === true || c.status === "PENDING_USER";
  const barColor = PRIORITY_BAR_COLOR[c.priority] ?? "#6b7280";

  return (
    <Link
      href={`/hd/cases/${c.id}`}
      onClick={onSelect}
      className={`hd-case-card relative overflow-hidden ${isSelected ? "hd-case-card-active" : ""}`}
    >
      {/* Priority color bar */}
      <div
        className="absolute left-0 top-0 w-1 h-full rounded-l-lg"
        style={{ background: barColor }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0 pl-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-medium"
            style={{ fontSize: "var(--hd-font-sm)", color: "rgb(var(--hd-text-muted))", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
          >
            {c.caseNumber}
          </span>
          {c.hasUnread && (
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" aria-label="Unread messages" />
          )}
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${channelConfig.color}`} style={{ background: "rgb(var(--hd-bg-card))" }}>
            <ChannelIcon className="h-3 w-3" />
            {channelConfig.label}
          </span>
          <span className={PRIORITY_BADGE[c.priority] ?? "hd-badge-normal"}>{c.priority}</span>
          <span className={STATUS_BADGE[c.status] ?? "hd-status-resolved"}>{c.status.replace(/_/g, " ")}</span>
          {sla && (
            <div className={sla.className}>
              <Timer className="h-4 w-4" />
              <span className="font-medium">{sla.label}</span>
            </div>
          )}
          {isWaitingOnCustomer && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
              <Hourglass className="h-3 w-3" />
              <span>Waiting</span>
            </div>
          )}
        </div>
        <h3
          className="mt-1 truncate font-medium"
          style={{ fontSize: "var(--hd-font-md)", color: "rgb(var(--hd-text-primary))" }}
        >
          {c.subject}
        </h3>
        <p
          className="mt-1 truncate"
          style={{ fontSize: "var(--hd-font-sm)", color: "rgb(var(--hd-text-muted))" }}
        >
          {c.requesterEmail ?? c.requesterId} &bull; {formatTimeAgo(c.createdAt)}
        </p>
      </div>
      <div
        className="hidden sm:block text-right"
        style={{ fontSize: "var(--hd-font-sm)", color: "rgb(var(--hd-text-muted))" }}
      >
        {c.assignedTeam?.displayName ?? <span className="text-amber-400">Unassigned</span>}
      </div>
      <span style={{ color: "rgb(var(--hd-text-muted))" }}>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </span>
    </Link>
  );
}
