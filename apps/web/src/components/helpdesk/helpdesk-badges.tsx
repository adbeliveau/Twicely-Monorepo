"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// PRIORITY BADGE
// =============================================================================

export type Priority = "CRITICAL" | "URGENT" | "HIGH" | "NORMAL" | "LOW";

const priorityConfig: Record<Priority, { label: string; className: string; icon?: string }> = {
  CRITICAL: {
    label: "Critical",
    icon: "🔴",
    className: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
  },
  URGENT: {
    label: "Urgent",
    icon: "🟠",
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  HIGH: {
    label: "High",
    icon: "🟡",
    className: "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
  NORMAL: {
    label: "Normal",
    className: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
  LOW: {
    label: "Low",
    className: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
};

interface PriorityBadgeProps {
  priority: Priority;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function PriorityBadge({ priority, showIcon = false, size = "sm", className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold uppercase tracking-wide rounded border",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        config.className,
        className
      )}
    >
      {showIcon && config.icon && <span>{config.icon}</span>}
      {config.label}
    </span>
  );
}

// =============================================================================
// STATUS BADGE
// =============================================================================

export type CaseStatus =
  | "NEW"
  | "OPEN"
  | "PENDING_USER"
  | "PENDING_INTERNAL"
  | "ON_HOLD"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED";

const statusConfig: Record<CaseStatus, { label: string; className: string; icon?: string }> = {
  NEW: {
    label: "New",
    icon: "✨",
    className: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  OPEN: {
    label: "Open",
    icon: "📂",
    className: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
  },
  PENDING_USER: {
    label: "Pending User",
    icon: "⏳",
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  PENDING_INTERNAL: {
    label: "Pending Internal",
    icon: "⏳",
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  ON_HOLD: {
    label: "On Hold",
    icon: "⏸",
    className: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
  ESCALATED: {
    label: "Escalated",
    icon: "⬆️",
    className: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
  },
  RESOLVED: {
    label: "Resolved",
    icon: "✅",
    className: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
  CLOSED: {
    label: "Closed",
    icon: "📁",
    className: "bg-slate-600/20 text-slate-500 dark:text-slate-500 border-slate-600/30",
  },
};

interface StatusBadgeProps {
  status: CaseStatus;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({ status, showIcon = false, size = "sm", className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold uppercase tracking-wide rounded border",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        config.className,
        className
      )}
    >
      {showIcon && config.icon && <span>{config.icon}</span>}
      {config.label}
    </span>
  );
}

// =============================================================================
// CASE TYPE BADGE
// =============================================================================

export type CaseType =
  | "SUPPORT"
  | "DISPUTE"
  | "RETURN"
  | "CHARGEBACK"
  | "MODERATION"
  | "ACCOUNT";

const typeConfig: Record<CaseType, { label: string; className: string; icon: string }> = {
  SUPPORT: {
    label: "Support",
    icon: "💬",
    className: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  DISPUTE: {
    label: "Dispute",
    icon: "⚖️",
    className: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
  },
  RETURN: {
    label: "Return",
    icon: "📦",
    className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  CHARGEBACK: {
    label: "Chargeback",
    icon: "💳",
    className: "bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30",
  },
  MODERATION: {
    label: "Moderation",
    icon: "🛡️",
    className: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
  ACCOUNT: {
    label: "Account",
    icon: "👤",
    className: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
};

interface TypeBadgeProps {
  type: CaseType;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function TypeBadge({ type, showIcon = true, size = "sm", className }: TypeBadgeProps) {
  const config = typeConfig[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold uppercase tracking-wide rounded border",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        config.className,
        className
      )}
    >
      {showIcon && <span>{config.icon}</span>}
      {config.label}
    </span>
  );
}

// =============================================================================
// CHANNEL BADGE
// =============================================================================

export type Channel = "EMAIL" | "WEB" | "SYSTEM" | "INTERNAL";

const channelConfig: Record<Channel, { label: string; icon: string }> = {
  EMAIL: { label: "Email", icon: "📧" },
  WEB: { label: "Web", icon: "🌐" },
  SYSTEM: { label: "System", icon: "⚡" },
  INTERNAL: { label: "Internal", icon: "🔒" },
};

interface ChannelBadgeProps {
  channel: Channel;
  className?: string;
}

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const config = channelConfig[channel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400",
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

// =============================================================================
// TAG
// =============================================================================

interface TagProps {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}

export function Tag({ children, onRemove, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded",
        "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
        "border border-slate-300 dark:border-slate-600",
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          ×
        </button>
      )}
    </span>
  );
}
