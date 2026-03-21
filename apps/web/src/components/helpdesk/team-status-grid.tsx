// Server component — no "use client" needed

export interface TeamStatusItem {
  teamId: string;
  teamName: string;
  online: number;
  away: number;
  offline: number;
  total: number;
}

interface TeamStatusGridProps {
  teams: TeamStatusItem[];
}

export function TeamStatusGrid({ teams }: TeamStatusGridProps) {
  if (teams.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: "rgb(var(--hd-text-muted))" }}>
        No teams configured
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {teams.map((team) => (
        <div
          key={team.teamId}
          className="rounded-xl border p-4"
          style={{ background: "rgb(var(--hd-bg-card))", borderColor: "rgb(var(--hd-border))" }}
        >
          <p className="text-sm font-semibold mb-3 truncate" style={{ color: "rgb(var(--hd-text-primary))" }}>
            {team.teamName}
          </p>
          <div className="flex items-center gap-4">
            <AgentStatusDot color="#22c55e" label="Online" count={team.online} />
            <AgentStatusDot color="#f59e0b" label="Away" count={team.away} />
            <AgentStatusDot color="#6b7280" label="Offline" count={team.offline} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentStatusDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs" style={{ color: "rgb(var(--hd-text-muted))" }}>
        {label}
      </span>
      <span className="text-xs font-semibold" style={{ color: "rgb(var(--hd-text-secondary))" }}>
        {count}
      </span>
    </div>
  );
}
