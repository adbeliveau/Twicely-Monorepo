"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  KnowledgeBaseSection,
  PreviousCasesSection,
  AssignmentSection,
  KeyboardShortcutsSection,
} from "./context-panel-cards";
import { QuickActionsFooter } from "./quick-actions-toolbar";

// =============================================================================
// TYPES
// =============================================================================

export interface CaseContextData {
  requesterName?: string;
  requesterEmail?: string;
  requesterStats?: { orderCount: number; caseCount: number; disputeCount: number };
  order?: { id: string; orderNumber: string; status: string; totalCents: number };
  slaFirstResponseDueAt?: Date | null;
  slaResolutionDueAt?: Date | null;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  tags: string[];
  assignedAgentId?: string | null;
  assignedAgentName?: string;
  assignedTeamName?: string;
  previousCases?: { caseNumber: string; subject: string; status: string }[];
}

interface ContextPanelProps {
  data: CaseContextData | null;
  isLoading?: boolean;
  className?: string;
  // Quick Actions footer props — V2 pattern puts actions at bottom of context panel
  caseId?: string;
  caseNumber?: string;
  currentStatus?: string;
  currentAgentId?: string | null;
  currentStaffUserId?: string;
  onResolve?: () => void;
  onEscalate?: () => void;
  onAssignToMe?: () => void;
}

// =============================================================================
// CONTEXT PANEL — V2-style: cards + sticky action footer
// =============================================================================
// Sections (top to bottom):
//   Requester → Order → SLA → Knowledge Base → Previous Cases → Assignment → Shortcuts
//   + sticky Quick Actions footer (V2 pattern)
// Removed from panel (now owned by workspace header):
//   - Tags → workspace header `CaseTagEditor`
// =============================================================================

export function ContextPanel({
  data,
  isLoading = false,
  className,
  caseId,
  caseNumber,
  currentStatus,
  currentAgentId,
  currentStaffUserId,
  onResolve,
  onEscalate,
  onAssignToMe,
}: ContextPanelProps) {
  if (isLoading) {
    return (
      <div className={cn("hd-workspace-right", className)}>
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: "rgb(var(--hd-bg-card))" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("hd-workspace-right", className)}>
        <div className="text-center py-8">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-sm" style={{ color: "rgb(var(--hd-text-muted))" }}>No context</div>
        </div>
      </div>
    );
  }

  const showFooter = !!(caseId && caseNumber && currentStatus !== undefined && currentStaffUserId !== undefined);

  return (
    <div className={cn("hd-workspace-right", className)} style={{ display: "flex", flexDirection: "column" }}>
      {/* Scrollable cards area */}
      <div className="flex-1 overflow-y-auto hd-scrollbar">
        <RequesterSection name={data.requesterName} email={data.requesterEmail} stats={data.requesterStats} />
        {data.order && <LinkedOrderSection order={data.order} />}
        <SlaSection
          firstResponseDue={data.slaFirstResponseDueAt}
          resolutionDue={data.slaResolutionDueAt}
          firstResponseAt={data.firstResponseAt}
          resolvedAt={data.resolvedAt}
        />
        <KnowledgeBaseSection />
        {data.previousCases && data.previousCases.length > 0 && (
          <PreviousCasesSection cases={data.previousCases} />
        )}
        <AssignmentSection
          agentName={data.assignedAgentName}
          teamName={data.assignedTeamName}
          hasAgent={!!data.assignedAgentId}
        />
        <KeyboardShortcutsSection />
      </div>

      {/* Sticky Quick Actions footer — V2 pattern */}
      {showFooter && (
        <QuickActionsFooter
          caseId={caseId!}
          caseNumber={caseNumber!}
          currentStatus={currentStatus!}
          currentAgentId={currentAgentId ?? null}
          currentStaffUserId={currentStaffUserId!}
          onResolve={onResolve}
          onEscalate={onEscalate}
          onAssignToMe={onAssignToMe}
        />
      )}
    </div>
  );
}

// =============================================================================
// REQUESTER SECTION
// =============================================================================

function RequesterSection({ name, email, stats }: {
  name?: string; email?: string;
  stats?: { orderCount: number; caseCount: number; disputeCount: number };
}) {
  const initial = (name?.[0] ?? email?.[0] ?? "?").toUpperCase();
  return (
    <div className="hd-context-card">
      <div className="hd-context-header"><span>👤</span><span>Requester</span></div>
      <div className="hd-context-body">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium bg-brand-500 text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>{name ?? "Unknown"}</p>
            {email && <p className="truncate text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{email}</p>}
          </div>
        </div>
        {stats && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatCell value={stats.orderCount} label="Orders" />
            <StatCell value={stats.caseCount} label="Cases" />
            <StatCell value={stats.disputeCount} label="Disputes" color={stats.disputeCount > 0 ? "#ef4444" : undefined} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="font-semibold text-xl" style={{ color: color ?? "rgb(var(--hd-text-primary))" }}>{value}</p>
      <p className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>{label}</p>
    </div>
  );
}

// =============================================================================
// LINKED ORDER SECTION
// =============================================================================

function LinkedOrderSection({ order }: { order: { id: string; orderNumber: string; status: string; totalCents: number } }) {
  const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <div className="hd-context-card">
      <div className="hd-context-header"><span>📦</span><span>Linked Order</span></div>
      <div className="hd-context-body">
        <span className="font-medium block font-mono text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>{order.orderNumber}</span>
        <span className="hd-status-new mt-1 inline-block" style={{ textTransform: "none", fontWeight: 500 }}>{statusLabel}</span>
        <p className="mt-2 font-semibold text-xl" style={{ color: "rgb(var(--hd-text-primary))" }}>${(order.totalCents / 100).toFixed(2)}</p>
        <a href={`/tx/orders/${order.id}`} className="mt-3 flex items-center gap-1 font-medium text-xs text-brand-500 hover:opacity-70 hd-transition">
          View Order <span>↗</span>
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// SLA SECTION — live-updating countdown for both First Response and Resolution
// =============================================================================

function SlaSection({ firstResponseDue, resolutionDue, firstResponseAt, resolvedAt }: {
  firstResponseDue?: Date | null; resolutionDue?: Date | null;
  firstResponseAt?: Date | null; resolvedAt?: Date | null;
}) {
  return (
    <div className="hd-context-card">
      <div className="hd-context-header"><span>⏱️</span><span>SLA</span></div>
      <div className="hd-context-body space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>First Response</span>
          {firstResponseAt ? (
            <span className="flex items-center gap-1 text-xs text-green-500 font-medium">✅ Met</span>
          ) : firstResponseDue ? (
            <SlaCountdown due={firstResponseDue} />
          ) : (
            <span className="text-xs" style={{ color: "rgb(var(--hd-text-dim))" }}>—</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>Resolution</span>
          {resolvedAt ? (
            <span className="flex items-center gap-1 text-xs text-green-500 font-medium">✅ Resolved</span>
          ) : resolutionDue ? (
            <SlaCountdown due={resolutionDue} />
          ) : (
            <span className="text-xs" style={{ color: "rgb(var(--hd-text-dim))" }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Live-updating SLA countdown — ticks every second (V2 parity).
function SlaCountdown({ due }: { due: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const dueMs = new Date(due).getTime();
  const diffMs = dueMs - now;
  const isBreached = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const hrs = Math.floor(absDiff / 3600000);
  const mins = Math.floor((absDiff % 3600000) / 60000);
  const label = isBreached ? `${hrs}h ${mins}m overdue` : `${hrs}h ${mins}m left`;
  const cls = isBreached ? "hd-sla-breach" : diffMs < 3600000 ? "hd-sla-warning" : "hd-sla";
  return <span className={cls}>{label}</span>;
}
