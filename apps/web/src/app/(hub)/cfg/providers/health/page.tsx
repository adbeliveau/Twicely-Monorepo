import type { Metadata } from 'next';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { getHealthLogs } from '@/lib/queries/admin-providers';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = { title: 'Health Logs | Twicely Hub' };

const STATUS_COLORS: Record<string, string> = {
  healthy: 'text-green-600',
  degraded: 'text-yellow-600',
  unhealthy: 'text-red-600',
};

export default async function HealthLogsPage() {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderHealthLog')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const logs = await getHealthLogs();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Health Logs"
        description="Provider health check history and response times"
      />

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">No health checks recorded yet.</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-5 gap-4 border-b border-gray-200 bg-primary/5 px-4 py-2 text-xs font-medium text-primary/70">
            <span>Instance</span>
            <span>Status</span>
            <span>Latency</span>
            <span>Error</span>
            <span>Time</span>
          </div>
          {logs.map((log) => (
            <div key={log.id} className="grid grid-cols-5 gap-4 border-b border-gray-100 px-4 py-2.5 last:border-b-0">
              <span className="text-sm text-gray-900">{log.instanceName}</span>
              <span className={`text-sm font-medium ${STATUS_COLORS[log.status] ?? 'text-gray-500'}`}>
                {log.status}
              </span>
              <span className="text-sm text-gray-600">
                {log.latencyMs !== null ? `${log.latencyMs}ms` : '-'}
              </span>
              <span className="truncate text-sm text-gray-500" title={log.errorMessage ?? ''}>
                {log.errorMessage ?? '-'}
              </span>
              <span className="text-sm text-gray-400">
                {new Date(log.checkedAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
