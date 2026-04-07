"use client";

import { useState, useTransition } from "react";
import { updateSlaPolicyFields } from "@/lib/actions/helpdesk-manage";

interface SlaPolicy {
  id: string;
  priority: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursOnly: boolean;
  escalateOnBreach: boolean;
  isActive: boolean;
}

interface SlaPolicyTableProps {
  policies: SlaPolicy[];
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-600",
  URGENT: "text-orange-600",
  HIGH: "text-amber-600",
  NORMAL: "text-brand-500",
  LOW: "text-gray-600",
};

function EditableMinutes({
  value,
  onSave,
  isPending,
}: {
  value: number;
  onSave: (v: number) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 1) {
      onSave(n);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="number"
        value={draft}
        min={1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 rounded border px-2 py-0.5 text-sm"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }}
        autoFocus
      />
    );
  }

  return (
    <button type="button" onClick={() => { setDraft(String(value)); setEditing(true); }} disabled={isPending}
      className="text-sm hover:underline cursor-pointer"
      style={{ color: "rgb(var(--hd-text-primary))" }}
      title="Click to edit">
      {formatMinutes(value)}
    </button>
  );
}

export function SlaPolicyTable({ policies: initial }: SlaPolicyTableProps) {
  const [policies, setPolicies] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(policyId: string, fields: Partial<{
    firstResponseMinutes: number;
    resolutionMinutes: number;
    businessHoursOnly: boolean;
    escalateOnBreach: boolean;
  }>) {
    startTransition(async () => {
      const result = await updateSlaPolicyFields({ policyId, ...fields });
      if (result.success) {
        setPolicies((prev) => prev.map((p) => p.id === policyId ? { ...p, ...fields } : p));
      }
    });
  }

  const PRIORITY_ORDER = ["CRITICAL", "URGENT", "HIGH", "NORMAL", "LOW"];
  const sorted = [...policies].sort(
    (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "rgb(var(--hd-border))" }}>
      <table className="min-w-full divide-y text-sm" style={{ background: "rgb(var(--hd-bg-card))" }}>
        <thead style={{ background: "rgb(var(--hd-bg-panel))" }}>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
              style={{ color: "rgb(var(--hd-text-muted))" }}>Priority</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
              style={{ color: "rgb(var(--hd-text-muted))" }}>First Response</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
              style={{ color: "rgb(var(--hd-text-muted))" }}>Resolution</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
              style={{ color: "rgb(var(--hd-text-muted))" }}>Business Hours</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
              style={{ color: "rgb(var(--hd-text-muted))" }}>Escalate on Breach</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "rgb(var(--hd-border))" }}>
          {sorted.map((policy) => (
            <tr key={policy.id}>
              <td className={`px-4 py-3 font-semibold ${PRIORITY_COLORS[policy.priority] ?? "text-gray-700"}`}>
                {policy.priority}
              </td>
              <td className="px-4 py-3">
                <EditableMinutes
                  value={policy.firstResponseMinutes}
                  onSave={(v) => handleUpdate(policy.id, { firstResponseMinutes: v })}
                  isPending={isPending}
                />
              </td>
              <td className="px-4 py-3">
                <EditableMinutes
                  value={policy.resolutionMinutes}
                  onSave={(v) => handleUpdate(policy.id, { resolutionMinutes: v })}
                  isPending={isPending}
                />
              </td>
              <td className="px-4 py-3">
                <button type="button" disabled={isPending}
                  onClick={() => handleUpdate(policy.id, { businessHoursOnly: !policy.businessHoursOnly })}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    policy.businessHoursOnly ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                  {policy.businessHoursOnly ? "Business hours" : "24/7"}
                </button>
              </td>
              <td className="px-4 py-3">
                <button type="button" disabled={isPending}
                  onClick={() => handleUpdate(policy.id, { escalateOnBreach: !policy.escalateOnBreach })}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    policy.escalateOnBreach ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                  }`}>
                  {policy.escalateOnBreach ? "Yes" : "No"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
