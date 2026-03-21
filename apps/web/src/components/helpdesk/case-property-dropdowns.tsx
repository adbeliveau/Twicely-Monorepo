"use client";

import { useState, useTransition } from "react";
import { updateCaseStatus, updateCasePriority, assignCase } from "@/lib/actions/helpdesk-agent-cases";
import type { HelpdeskAgent, HelpdeskTeamItem } from "@/lib/queries/helpdesk-agents";

// =============================================================================
// TYPES
// =============================================================================

interface CasePropertyDropdownsProps {
  caseId: string;
  currentStatus: string;
  currentPriority: string;
  currentAgentId: string | null;
  currentTeamId: string | null;
  agents: HelpdeskAgent[];
  teams: HelpdeskTeamItem[];
  isClosed?: boolean;
}

// =============================================================================
// STATUS OPTIONS
// =============================================================================

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "PENDING_USER", label: "Pending User" },
  { value: "PENDING_INTERNAL", label: "Pending Internal" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "RESOLVED", label: "Resolved" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "CRITICAL", label: "Critical" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
] as const;

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "rgb(239 68 68)",
  URGENT: "rgb(245 158 11)",
  HIGH: "rgb(249 115 22)",
  NORMAL: "rgb(var(--hd-text-secondary))",
  LOW: "rgb(59 130 246)",
};

// =============================================================================
// SELECT STYLES (helpdesk dark theme)
// =============================================================================

const selectStyle: React.CSSProperties = {
  background: "rgb(var(--hd-bg-card))",
  borderColor: "rgb(var(--hd-border))",
  color: "rgb(var(--hd-text-primary))",
};

// =============================================================================
// COMPONENT
// =============================================================================

export function CasePropertyDropdowns({
  caseId,
  currentStatus,
  currentPriority,
  currentAgentId,
  currentTeamId,
  agents,
  teams,
  isClosed = false,
}: CasePropertyDropdownsProps) {
  const [status, setStatus] = useState(currentStatus);
  const [priority, setPriority] = useState(currentPriority);
  const [agentId, setAgentId] = useState<string | null>(currentAgentId);
  const [teamId, setTeamId] = useState<string | null>(currentTeamId);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [statusPending, startStatusTransition] = useTransition();
  const [priorityPending, startPriorityTransition] = useTransition();
  const [assignPending, startAssignTransition] = useTransition();

  function handleStatusChange(newStatus: string) {
    if (newStatus === status || isClosed) return;
    setStatusError(null);
    const optimistic = newStatus;
    setStatus(optimistic);
    startStatusTransition(async () => {
      const result = await updateCaseStatus({ caseId, status: newStatus });
      if (!result.success) {
        setStatus(currentStatus);
        setStatusError(result.error ?? "Failed to update status");
      }
    });
  }

  function handlePriorityChange(newPriority: string) {
    if (newPriority === priority || isClosed) return;
    setPriorityError(null);
    setPriority(newPriority);
    startPriorityTransition(async () => {
      const result = await updateCasePriority({ caseId, priority: newPriority });
      if (!result.success) {
        setPriority(currentPriority);
        setPriorityError(result.error ?? "Failed to update priority");
      }
    });
  }

  function handleAssignChange(newAgentId: string | null, newTeamId: string | null) {
    if (isClosed) return;
    setAssignError(null);
    setAgentId(newAgentId);
    setTeamId(newTeamId);
    startAssignTransition(async () => {
      const result = await assignCase({ caseId, assignedAgentId: newAgentId, assignedTeamId: newTeamId });
      if (!result.success) {
        setAgentId(currentAgentId);
        setTeamId(currentTeamId);
        setAssignError(result.error ?? "Failed to assign");
      }
    });
  }

  const disabled = isClosed;
  const selectClass = "rounded border text-xs px-2 py-1 outline-none hd-transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px]" style={{ color: "rgb(var(--hd-text-dim))" }}>Status</span>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={disabled || statusPending}
          className={selectClass}
          style={selectStyle}
          aria-label="Case status"
        >
          {status === "NEW" && <option value="NEW">New</option>}
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {statusPending && <span className="text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>...</span>}
        {statusError && <span className="text-[10px] text-red-500">{statusError}</span>}
      </div>

      {/* Priority */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px]" style={{ color: "rgb(var(--hd-text-dim))" }}>Priority</span>
        <select
          value={priority}
          onChange={(e) => handlePriorityChange(e.target.value)}
          disabled={disabled || priorityPending}
          className={selectClass}
          style={{ ...selectStyle, color: PRIORITY_COLORS[priority] ?? "inherit" }}
          aria-label="Case priority"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} style={{ color: PRIORITY_COLORS[opt.value] }}>
              {opt.label}
            </option>
          ))}
        </select>
        {priorityPending && <span className="text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>...</span>}
        {priorityError && <span className="text-[10px] text-red-500">{priorityError}</span>}
      </div>

      {/* Agent */}
      {agents.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: "rgb(var(--hd-text-dim))" }}>Agent</span>
          <select
            value={agentId ?? ""}
            onChange={(e) => handleAssignChange(e.target.value || null, teamId)}
            disabled={disabled || assignPending}
            className={selectClass}
            style={selectStyle}
            aria-label="Assigned agent"
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Team */}
      {teams.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: "rgb(var(--hd-text-dim))" }}>Team</span>
          <select
            value={teamId ?? ""}
            onChange={(e) => handleAssignChange(agentId, e.target.value || null)}
            disabled={disabled || assignPending}
            className={selectClass}
            style={selectStyle}
            aria-label="Assigned team"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {assignPending && <span className="text-[10px]" style={{ color: "rgb(var(--hd-text-dim))" }}>...</span>}
      {assignError && <span className="text-[10px] text-red-500">{assignError}</span>}
    </div>
  );
}
