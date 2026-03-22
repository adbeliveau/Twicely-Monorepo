import { getAdminUserNotes } from '@/lib/queries/admin-user-tabs';

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function ActionBadge({ action, severity }: { action: string; severity: string }) {
  const cls = severity === 'CRITICAL'
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : severity === 'HIGH'
      ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
      : severity === 'MEDIUM'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400';
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

interface Props {
  userId: string;
}

export async function OverviewAuditLog({ userId }: Props) {
  // Use subjectId query (getAdminUserNotes) for admin actions ON this user
  const events = await getAdminUserNotes(userId);
  const recentEvents = events.slice(0, 20);

  return (
    <div className="rounded-2xl bg-white shadow-sm dark:bg-gray-800">
      <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white">Admin Audit Log</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Actions taken by Twicely staff on this account
        </p>
      </div>
      <div className="p-6">
        {recentEvents.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No admin actions recorded
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Staff Member
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date &amp; Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {event.actorId ? event.actorId.slice(0, 8) : 'System'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <ActionBadge action={event.action} severity={event.severity} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {event.subject ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDateTime(event.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
