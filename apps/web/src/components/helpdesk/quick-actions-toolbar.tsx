"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCaseStatus, assignCase } from "@/lib/actions/helpdesk-agent-cases";
import { MergeDialog } from "./merge-dialog";

// =============================================================================
// TYPES
// =============================================================================

interface QuickActionsToolbarProps {
  caseId: string;
  caseNumber: string;
  currentStatus: string;
  currentAgentId: string | null;
  currentStaffUserId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function QuickActionsToolbar({
  caseId,
  caseNumber,
  currentStatus,
  currentAgentId,
  currentStaffUserId,
}: QuickActionsToolbarProps) {
  const router = useRouter();
  const [resolvePending, startResolveTransition] = useTransition();
  const [escalatePending, startEscalateTransition] = useTransition();
  const [assignPending, startAssignTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);

  const isResolved = currentStatus === "RESOLVED";
  const isClosed = currentStatus === "CLOSED";
  const isEscalated = currentStatus === "ESCALATED";
  const isAssignedToMe = currentAgentId === currentStaffUserId;

  function handleResolve() {
    if (isResolved || isClosed) return;
    setError(null);
    startResolveTransition(async () => {
      const result = await updateCaseStatus({ caseId, status: "RESOLVED" });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to resolve");
      }
    });
  }

  function handleEscalate() {
    if (isEscalated || isClosed) return;
    setError(null);
    startEscalateTransition(async () => {
      const result = await updateCaseStatus({ caseId, status: "ESCALATED" });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to escalate");
      }
    });
  }

  function handleAssignToMe() {
    if (isAssignedToMe || isClosed) return;
    setError(null);
    startAssignTransition(async () => {
      const result = await assignCase({
        caseId,
        assignedAgentId: currentStaffUserId,
        assignedTeamId: null,
      });
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Failed to assign");
      }
    });
  }

  const btnBase =
    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border hd-transition disabled:opacity-40 disabled:cursor-not-allowed";
  const btnStyle = {
    background: "rgb(var(--hd-bg-card))",
    borderColor: "rgb(var(--hd-border))",
    color: "rgb(var(--hd-text-secondary))",
  };

  return (
    <>
      <div
        className="flex items-center gap-2 px-6 py-2 border-b flex-shrink-0 flex-wrap"
        style={{ background: "rgb(var(--hd-bg-deep))", borderColor: "rgb(var(--hd-border))" }}
      >
        {/* Resolve */}
        {isResolved || isClosed ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg opacity-50" style={{ color: "rgb(var(--hd-text-muted))" }}>
            <span>✅</span><span>Resolved</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResolve}
            disabled={resolvePending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hd-transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 text-white"
            title="Resolve case (⌘⇧R)"
          >
            {resolvePending ? <span className="animate-spin">⏳</span> : <span>✅</span>}
            <span>Resolve</span>
            <span className="text-[10px] opacity-70 font-normal">⌘⇧R</span>
          </button>
        )}

        {/* Escalate */}
        <button
          type="button"
          onClick={handleEscalate}
          disabled={isEscalated || isClosed || escalatePending}
          className={btnBase}
          style={isEscalated || isClosed ? { ...btnStyle, opacity: 0.4 } : { ...btnStyle, color: "rgb(var(--hd-text-secondary))" }}
          title="Escalate case"
        >
          {escalatePending ? <span className="animate-spin">⏳</span> : <span>⬆️</span>}
          <span>Escalate</span>
        </button>

        {/* Merge */}
        <button
          type="button"
          onClick={() => setShowMerge(true)}
          disabled={isClosed}
          className={btnBase}
          style={isClosed ? { ...btnStyle, opacity: 0.4 } : btnStyle}
          title="Merge into another case"
        >
          <span>🔀</span>
          <span>Merge</span>
        </button>

        {/* Assign to me */}
        {!isAssignedToMe && (
          <button
            type="button"
            onClick={handleAssignToMe}
            disabled={isClosed || assignPending}
            className={btnBase}
            style={isClosed ? { ...btnStyle, opacity: 0.4 } : btnStyle}
            title="Assign to me"
          >
            {assignPending ? <span className="animate-spin">⏳</span> : <span>👤</span>}
            <span>Assign to me</span>
          </button>
        )}

        {error && (
          <span className="text-[11px] text-red-500">{error}</span>
        )}
      </div>

      {showMerge && (
        <MergeDialog
          sourceCaseId={caseId}
          sourceCaseNumber={caseNumber}
          onClose={() => setShowMerge(false)}
        />
      )}
    </>
  );
}
