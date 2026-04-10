"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCaseStatus, assignCase } from "@/lib/actions/helpdesk-agent-cases";
import { MergeDialog } from "./merge-dialog";

// =============================================================================
// TYPES
// =============================================================================
interface QuickActionsProps {
  caseId: string;
  caseNumber: string;
  currentStatus: string;
  currentAgentId: string | null;
  currentStaffUserId: string;
  /** Optional override — let parent handle resolve (e.g., auto-advance to next case). */
  onResolve?: () => void;
  /** Optional override — let parent handle escalate. */
  onEscalate?: () => void;
  /** Optional override — let parent handle assign-to-me. */
  onAssignToMe?: () => void;
}

// =============================================================================
// SHARED LOGIC HOOK
// =============================================================================

function useQuickActions(props: QuickActionsProps) {
  const router = useRouter();
  const [resolvePending, startResolveTransition] = useTransition();
  const [escalatePending, startEscalateTransition] = useTransition();
  const [assignPending, startAssignTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);

  const isResolved = props.currentStatus === "RESOLVED";
  const isClosed = props.currentStatus === "CLOSED";
  const isEscalated = props.currentStatus === "ESCALATED";
  const isAssignedToMe = props.currentAgentId === props.currentStaffUserId;

  function handleResolve() {
    if (isResolved || isClosed) return;
    if (props.onResolve) {
      props.onResolve();
      return;
    }
    setError(null);
    startResolveTransition(async () => {
      const result = await updateCaseStatus({ caseId: props.caseId, status: "RESOLVED" });
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to resolve");
    });
  }

  function handleEscalate() {
    if (isEscalated || isClosed) return;
    if (props.onEscalate) {
      props.onEscalate();
      return;
    }
    setError(null);
    startEscalateTransition(async () => {
      const result = await updateCaseStatus({ caseId: props.caseId, status: "ESCALATED" });
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to escalate");
    });
  }

  function handleAssignToMe() {
    if (isAssignedToMe || isClosed) return;
    if (props.onAssignToMe) {
      props.onAssignToMe();
      return;
    }
    setError(null);
    startAssignTransition(async () => {
      const result = await assignCase({
        caseId: props.caseId,
        assignedAgentId: props.currentStaffUserId,
        assignedTeamId: null,
      });
      if (result.success) router.refresh();
      else setError(result.error ?? "Failed to assign");
    });
  }

  return {
    isResolved, isClosed, isEscalated, isAssignedToMe,
    resolvePending, escalatePending, assignPending,
    error, showMerge, setShowMerge,
    handleResolve, handleEscalate, handleAssignToMe,
  };
}

// =============================================================================
// FOOTER VARIANT — V2 pattern: full-width prominent Resolve + compact secondary actions
// Used at the bottom of ContextPanel.
// =============================================================================

export function QuickActionsFooter(props: QuickActionsProps) {
  const {
    isResolved, isClosed, isEscalated, isAssignedToMe,
    resolvePending, escalatePending, assignPending,
    error, showMerge, setShowMerge,
    handleResolve, handleEscalate, handleAssignToMe,
  } = useQuickActions(props);

  return (
    <>
      <div
        className="flex-shrink-0 border-t px-3 py-3 space-y-2"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-deep))" }}
      >
        {/* Prominent Resolve — full width, green, V2 pattern */}
        {isResolved || isClosed ? (
          <div
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium opacity-60"
            style={{ background: "rgb(var(--hd-bg-card))", color: "rgb(var(--hd-text-muted))" }}
          >
            <span>✅</span>
            <span>{isClosed ? "Closed" : "Resolved"}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleResolve}
            disabled={resolvePending}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold hd-transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
            title="Resolve case (⌘⇧R)"
          >
            {resolvePending ? <span className="animate-spin">⏳</span> : <span>✅</span>}
            <span>Resolve Case</span>
            <span className="text-[10px] opacity-70 font-normal ml-1">⌘⇧R</span>
          </button>
        )}

        {/* Secondary actions — 2-column grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleEscalate}
            disabled={isEscalated || isClosed || escalatePending}
            className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hd-transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "rgb(var(--hd-bg-card))",
              borderColor: "rgb(var(--hd-border))",
              color: "rgb(var(--hd-text-secondary))",
            }}
            title="Escalate case"
          >
            {escalatePending ? <span className="animate-spin">⏳</span> : <span>⬆️</span>}
            <span>Escalate</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMerge(true)}
            disabled={isClosed}
            className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hd-transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "rgb(var(--hd-bg-card))",
              borderColor: "rgb(var(--hd-border))",
              color: "rgb(var(--hd-text-secondary))",
            }}
            title="Merge into another case"
          >
            <span>🔀</span>
            <span>Merge</span>
          </button>

          {!isAssignedToMe && (
            <button
              type="button"
              onClick={handleAssignToMe}
              disabled={isClosed || assignPending}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hd-transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "rgb(var(--hd-bg-card))",
                borderColor: "rgb(var(--hd-border))",
                color: "rgb(var(--hd-text-secondary))",
              }}
              title="Assign to me"
            >
              {assignPending ? <span className="animate-spin">⏳</span> : <span>👤</span>}
              <span>Assign to me</span>
            </button>
          )}
        </div>

        {error && <div className="text-[11px] text-red-500">{error}</div>}
      </div>

      {showMerge && (
        <MergeDialog
          sourceCaseId={props.caseId}
          sourceCaseNumber={props.caseNumber}
          onClose={() => setShowMerge(false)}
        />
      )}
    </>
  );
}

// =============================================================================
// TOOLBAR VARIANT — horizontal strip (legacy, kept for backward compatibility)
// No longer rendered in CaseWorkspace; may still be used by other surfaces.
// =============================================================================

export function QuickActionsToolbar(props: QuickActionsProps) {
  const {
    isResolved, isClosed, isEscalated, isAssignedToMe,
    resolvePending, escalatePending, assignPending,
    error, showMerge, setShowMerge,
    handleResolve, handleEscalate, handleAssignToMe,
  } = useQuickActions(props);

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

        <button
          type="button"
          onClick={handleEscalate}
          disabled={isEscalated || isClosed || escalatePending}
          className={btnBase}
          style={isEscalated || isClosed ? { ...btnStyle, opacity: 0.4 } : btnStyle}
          title="Escalate case"
        >
          {escalatePending ? <span className="animate-spin">⏳</span> : <span>⬆️</span>}
          <span>Escalate</span>
        </button>

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

        {error && <span className="text-[11px] text-red-500">{error}</span>}
      </div>

      {showMerge && (
        <MergeDialog
          sourceCaseId={props.caseId}
          sourceCaseNumber={props.caseNumber}
          onClose={() => setShowMerge(false)}
        />
      )}
    </>
  );
}
