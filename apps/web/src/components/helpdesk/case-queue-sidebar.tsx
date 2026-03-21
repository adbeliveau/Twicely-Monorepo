"use client";

import { cn } from "@/lib/utils";
import { PriorityBadge, type Priority } from "./helpdesk-badges";
import { SlaIndicator } from "./sla-timer";

// =============================================================================
// TYPES
// =============================================================================

interface QueueCase {
  id: string;
  caseNumber: string;
  subject: string;
  priority: Priority;
  status: string;
  type: string;
  slaFirstResponseDue?: string | null;
  firstResponseAt?: string | null;
  updatedAt: string;
  requesterName?: string;
}

// =============================================================================
// CASE QUEUE SIDEBAR (for Agent Workspace)
// =============================================================================

interface CaseQueueSidebarProps {
  cases: QueueCase[];
  selectedCaseId?: string;
  onSelectCase: (caseId: string) => void;
  isOnline?: boolean;
  onToggleStatus?: (isOnline: boolean) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function CaseQueueSidebar({
  cases,
  selectedCaseId,
  onSelectCase,
  isOnline = true,
  onToggleStatus,
  searchQuery = "",
  onSearchChange,
  isLoading = false,
  className,
}: CaseQueueSidebarProps) {
  const filteredCases = cases.filter(
    (c) =>
      c.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.requesterName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <aside className={cn("flex flex-col h-full w-72 bg-white dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">My Cases</h2>
          <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-slate-400")} />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">{cases.length} cases</span>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Filter cases..."
            className={cn(
              "w-full pl-9 pr-3 py-2 text-sm rounded-md",
              "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
              "text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
              "outline-none focus:border-blue-500"
            )}
          />
        </div>
      </div>

      {/* Case List */}
      <div className="flex-1 overflow-y-auto hd-scrollbar">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery ? "No cases match your search" : "No cases assigned"}
            </div>
          </div>
        ) : (
          filteredCases.map((caseItem) => (
            <CaseQueueItem
              key={caseItem.id}
              caseItem={caseItem}
              isSelected={selectedCaseId === caseItem.id}
              onClick={() => onSelectCase(caseItem.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={() => onToggleStatus?.(!isOnline)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            isOnline
              ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500" : "bg-slate-400")} />
          <span>{isOnline ? "Online — Taking Cases" : "Offline — Paused"}</span>
        </button>
      </div>
    </aside>
  );
}

// =============================================================================
// CASE QUEUE ITEM
// =============================================================================

interface CaseQueueItemProps {
  caseItem: QueueCase;
  isSelected: boolean;
  onClick: () => void;
}

function CaseQueueItem({ caseItem, isSelected, onClick }: CaseQueueItemProps) {
  const typeIcons: Record<string, string> = {
    SUPPORT: "💬", DISPUTE: "⚖️", RETURN: "📦",
    CHARGEBACK: "💳", MODERATION: "🛡️", ACCOUNT: "👤",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800/50 border-l-[3px] transition-all",
        isSelected
          ? "bg-slate-100 dark:bg-slate-800 border-l-blue-500"
          : "bg-transparent border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{caseItem.caseNumber}</span>
        <PriorityBadge priority={caseItem.priority} size="sm" />
      </div>
      <div className={cn("text-sm font-medium mb-1.5 line-clamp-2", isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300")}>
        {caseItem.subject}
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>{typeIcons[caseItem.type] ?? "📋"}</span>
          <span className="capitalize">{caseItem.type.toLowerCase()}</span>
        </div>
        <SlaIndicator dueAt={caseItem.slaFirstResponseDue ?? null} isMet={!!caseItem.firstResponseAt} />
      </div>
    </button>
  );
}
