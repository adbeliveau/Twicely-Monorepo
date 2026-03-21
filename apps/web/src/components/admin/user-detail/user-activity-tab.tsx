interface ActivityRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  subject: string;
  subjectId: string | null;
  severity: string;
  detailsJson: unknown;
  createdAt: Date;
}

interface UserActivityTabProps {
  events: ActivityRow[];
}

function severityColor(s: string): string {
  if (s === 'CRITICAL') return 'bg-red-200 text-red-800';
  if (s === 'HIGH') return 'bg-orange-100 text-orange-700';
  if (s === 'MEDIUM') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
}

export function UserActivityTab({ events }: UserActivityTabProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">{events.length} event(s)</p>

      {events.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          No activity recorded
        </div>
      )}

      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${severityColor(e.severity)}`}>
                  {e.severity}
                </span>
                <span className="font-mono text-xs text-gray-800">{e.action}</span>
                <span className="text-xs text-gray-500">on {e.subject}</span>
              </div>
              <time className="shrink-0 text-xs text-gray-400">
                {e.createdAt.toLocaleString()}
              </time>
            </div>
            {e.detailsJson != null &&
              typeof e.detailsJson === 'object' &&
              Object.keys(e.detailsJson as Record<string, unknown>).length > 0 && (
              <p className="mt-1 truncate text-xs text-gray-500">
                {JSON.stringify(e.detailsJson)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
