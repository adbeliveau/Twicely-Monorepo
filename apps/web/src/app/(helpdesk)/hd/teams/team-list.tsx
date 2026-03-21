"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, UserPlus, UserMinus } from "lucide-react";
import {
  addTeamMember,
  removeTeamMember,
  toggleTeamMemberAvailability,
} from "@/lib/actions/helpdesk-agent";
import { createTeam, updateTeam } from "@/lib/actions/helpdesk-manage";
import type { TeamWithMembers, TeamMemberRow } from "@/lib/queries/helpdesk-teams";

interface TeamListProps {
  teams: TeamWithMembers[];
}

function TeamForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: { name: string; description: string; maxConcurrentCases: number; roundRobinEnabled: boolean };
  onSave: (name: string, description: string, maxConcurrentCases: number, roundRobinEnabled: boolean) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [maxCases, setMaxCases] = useState(initial?.maxConcurrentCases ?? 25);
  const [roundRobin, setRoundRobin] = useState(initial?.roundRobinEnabled ?? true);

  return (
    <div className="rounded-lg border p-4 space-y-3"
      style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name"
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
      <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)"
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--hd-text-secondary))" }}>
          Max concurrent cases:
          <input type="number" value={maxCases} onChange={(e) => setMaxCases(Number(e.target.value))} min={1} max={100}
            className="w-16 rounded border px-2 py-1 text-sm"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--hd-text-secondary))" }}>
          <input type="checkbox" checked={roundRobin} onChange={(e) => setRoundRobin(e.target.checked)} />
          Round-robin assignment
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(name, description, maxCases, roundRobin)}
          disabled={isPending || !name.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {isPending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded border px-3 py-1.5 text-sm hd-transition"
          style={{ borderColor: "rgb(var(--hd-border))", color: "rgb(var(--hd-text-secondary))" }}>Cancel</button>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  teamId,
  isPending,
  onRemove,
  onToggleAvailability,
}: {
  member: TeamMemberRow;
  teamId: string;
  isPending: boolean;
  onRemove: (teamId: string, staffUserId: string) => void;
  onToggleAvailability: (teamId: string, staffUserId: string, current: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm"
      style={{ borderTop: "1px solid rgb(var(--hd-border))" }}>
      <span className="flex-1 font-mono text-xs" style={{ color: "rgb(var(--hd-text-secondary))" }}>{member.staffUserId}</span>
      <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
        {member.activeCaseCount} active
      </span>
      <button type="button" disabled={isPending}
        onClick={() => onToggleAvailability(teamId, member.staffUserId, member.isAvailable)}
        className={`text-xs px-2 py-0.5 rounded-full ${member.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {member.isAvailable ? "Available" : "Unavailable"}
      </button>
      <button type="button" disabled={isPending} onClick={() => onRemove(teamId, member.staffUserId)}
        className="p-1 rounded text-red-500 hover:bg-red-500/10" aria-label="Remove member">
        <UserMinus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function TeamList({ teams: initial }: TeamListProps) {
  const [teams, setTeams] = useState(initial);
  const [members, setMembers] = useState<Record<string, TeamMemberRow[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addMemberInput, setAddMemberInput] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleExpand(teamId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) { next.delete(teamId); } else { next.add(teamId); }
      return next;
    });
  }

  function handleCreate(name: string, description: string, maxConcurrentCases: number, roundRobinEnabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await createTeam({ name, description: description || undefined, maxConcurrentCases, roundRobinEnabled });
      if (result.success && result.data) {
        setTeams((prev) => [...prev, { id: result.data!.id, name, description: description || null, isDefault: false, maxConcurrentCases, roundRobinEnabled, memberCount: 0 }]);
        setShowCreate(false);
      } else {
        setError(result.error ?? "Failed to create team");
      }
    });
  }

  function handleUpdate(teamId: string, name: string, description: string, maxConcurrentCases: number, roundRobinEnabled: boolean) {
    startTransition(async () => {
      const result = await updateTeam({ teamId, name, description: description || null, maxConcurrentCases, roundRobinEnabled });
      if (result.success) {
        setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, name, description: description || null, maxConcurrentCases, roundRobinEnabled } : t));
        setEditingId(null);
      }
    });
  }

  function handleAddMember(teamId: string) {
    const staffUserId = addMemberInput[teamId]?.trim();
    if (!staffUserId) return;
    startTransition(async () => {
      const result = await addTeamMember(teamId, staffUserId);
      if (result.success) {
        setMembers((prev) => ({
          ...prev,
          [teamId]: [...(prev[teamId] ?? []), { id: `${teamId}-${staffUserId}`, staffUserId, isAvailable: true, activeCaseCount: 0 }],
        }));
        setAddMemberInput((prev) => ({ ...prev, [teamId]: "" }));
        setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, memberCount: t.memberCount + 1 } : t));
      }
    });
  }

  function handleRemoveMember(teamId: string, staffUserId: string) {
    startTransition(async () => {
      const result = await removeTeamMember(teamId, staffUserId);
      if (result.success) {
        setMembers((prev) => ({ ...prev, [teamId]: (prev[teamId] ?? []).filter((m) => m.staffUserId !== staffUserId) }));
        setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, memberCount: Math.max(0, t.memberCount - 1) } : t));
      }
    });
  }

  function handleToggleAvailability(teamId: string, staffUserId: string, current: boolean) {
    startTransition(async () => {
      const result = await toggleTeamMemberAvailability(teamId, staffUserId, !current);
      if (result.success) {
        setMembers((prev) => ({
          ...prev,
          [teamId]: (prev[teamId] ?? []).map((m) => m.staffUserId === staffUserId ? { ...m, isAvailable: !current } : m),
        }));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> New Team
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {showCreate && (
        <TeamForm onSave={handleCreate} onCancel={() => setShowCreate(false)} isPending={isPending} />
      )}
      <div className="space-y-2">
        {teams.map((team) => (
          <div key={team.id} className="rounded-lg border overflow-hidden"
            style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-card))" }}>
            {editingId === team.id ? (
              <div className="p-3">
                <TeamForm
                  initial={{ name: team.name, description: team.description ?? "", maxConcurrentCases: team.maxConcurrentCases, roundRobinEnabled: team.roundRobinEnabled }}
                  onSave={(n, d, m, r) => handleUpdate(team.id, n, d, m, r)}
                  onCancel={() => setEditingId(null)}
                  isPending={isPending}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => toggleExpand(team.id)}
                    className="text-gray-400 hover:text-gray-600">
                    {expanded.has(team.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <span className="flex-1 font-medium text-sm" style={{ color: "rgb(var(--hd-text-primary))" }}>{team.name}</span>
                  {team.isDefault && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">Default</span>
                  )}
                  <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
                    {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
                  </span>
                  <button type="button" onClick={() => setEditingId(team.id)} disabled={isPending}
                    className="p-1 rounded text-blue-500 hover:bg-blue-500/10" aria-label="Edit team">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {!team.isDefault && (
                    <button type="button" disabled title="Only non-default teams can be deleted via routing cleanup"
                      className="p-1 rounded text-gray-300 cursor-not-allowed" aria-label="Delete team">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {expanded.has(team.id) && (
                  <div>
                    {(members[team.id] ?? []).map((m) => (
                      <MemberRow key={m.staffUserId} member={m} teamId={team.id} isPending={isPending}
                        onRemove={handleRemoveMember} onToggleAvailability={handleToggleAvailability} />
                    ))}
                    <div className="flex items-center gap-2 px-4 py-2"
                      style={{ borderTop: "1px solid rgb(var(--hd-border))" }}>
                      <UserPlus className="h-4 w-4 shrink-0" style={{ color: "rgb(var(--hd-text-muted))" }} />
                      <input type="text" value={addMemberInput[team.id] ?? ""}
                        onChange={(e) => setAddMemberInput((p) => ({ ...p, [team.id]: e.target.value }))}
                        placeholder="Staff user ID"
                        className="flex-1 rounded border px-2 py-1 text-xs"
                        style={{ borderColor: "rgb(var(--hd-border))", background: "rgb(var(--hd-bg-panel))", color: "rgb(var(--hd-text-primary))" }} />
                      <button type="button" onClick={() => handleAddMember(team.id)} disabled={isPending || !addMemberInput[team.id]?.trim()}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50">Add</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
