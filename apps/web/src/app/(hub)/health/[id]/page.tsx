import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import {
  getProviderInstanceById,
  getProviderHealthLogs,
} from '@/lib/queries/health-checks';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@twicely/ui/badge';
import { RunChecksButton } from '@/components/admin/run-checks-button';

export const metadata: Metadata = {
  title: 'Provider Instance Detail | Twicely Hub',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProviderInstanceDetailPage({ params }: Props) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'HealthCheck')) {
    return <p className="text-red-600">Access denied</p>;
  }

  const { id } = await params;
  const [instance, logs] = await Promise.all([
    getProviderInstanceById(id),
    getProviderHealthLogs(id, 50),
  ]);

  if (!instance) notFound();

  const canManage = ability.can('manage', 'HealthCheck');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Link href="/health" className="hover:text-gray-700">
          System Health
        </Link>
        <span>/</span>
        <span className="text-gray-900">{instance.displayName}</span>
      </div>

      <AdminPageHeader
        title={instance.displayName}
        description={`${instance.adapterName} — ${instance.adapterServiceType}`}
        actions={canManage ? <RunChecksButton /> : undefined}
      />

      {/* ── Instance metadata card ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Instance Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="font-medium text-gray-900">{instance.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd>
              <Badge variant={instance.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {instance.status}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Priority</dt>
            <dd className="font-medium text-gray-900">{instance.priority}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Health Status</dt>
            <dd className="font-medium text-gray-900">
              {instance.lastHealthStatus ?? 'Never checked'}
            </dd>
          </div>
          {instance.lastHealthLatencyMs !== null && (
            <div>
              <dt className="text-gray-500">Last Latency</dt>
              <dd className="font-medium text-gray-900">{instance.lastHealthLatencyMs}ms</dd>
            </div>
          )}
          {instance.lastHealthCheckAt && (
            <div>
              <dt className="text-gray-500">Last Check</dt>
              <dd className="font-medium text-gray-900">
                {new Date(instance.lastHealthCheckAt).toLocaleString('en-US')}
              </dd>
            </div>
          )}
          {instance.lastHealthError && (
            <div className="col-span-2">
              <dt className="text-gray-500">Last Error</dt>
              <dd className="font-medium text-red-600">{instance.lastHealthError}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Adapter</dt>
            <dd className="font-medium text-gray-900">{instance.adapterName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Service Type</dt>
            <dd className="font-medium text-gray-900">{instance.adapterServiceType}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="font-medium text-gray-900">
              {new Date(instance.createdAt).toLocaleString('en-US')}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Health log history ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">
          Health Check History (last {logs.length})
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No health checks recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Checked At</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Latency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-gray-700">
                      {new Date(log.checkedAt).toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          log.status === 'HEALTHY'
                            ? 'default'
                            : log.status === 'DEGRADED'
                            ? 'outline'
                            : 'destructive'
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {log.latencyMs !== null ? `${log.latencyMs}ms` : '—'}
                    </td>
                    <td className="px-4 py-2 text-red-600 text-xs">
                      {log.errorMessage ?? '—'}
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
