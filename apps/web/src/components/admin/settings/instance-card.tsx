'use client';

import { useTransition } from 'react';
import { testInstance } from '@/lib/actions/admin-providers';

interface InstanceCardProps {
  id: string;
  name: string;
  displayName: string;
  adapterName: string;
  status: string;
  lastHealthStatus: string | null;
  lastHealthLatencyMs: number | null;
  lastHealthCheckAt: Date | null;
}

const HEALTH_ICONS: Record<string, { icon: string; color: string }> = {
  healthy: { icon: '\u2713', color: 'text-green-600' },
  degraded: { icon: '!', color: 'text-yellow-600' },
  unhealthy: { icon: '\u2717', color: 'text-red-600' },
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  DISABLED: 'bg-gray-100 text-gray-600',
  TESTING: 'bg-yellow-100 text-yellow-700',
};

export function InstanceCard({
  id,
  name,
  displayName,
  adapterName,
  status,
  lastHealthStatus,
  lastHealthLatencyMs,
  lastHealthCheckAt,
}: InstanceCardProps) {
  const [isPending, startTransition] = useTransition();
  const health = lastHealthStatus ? (HEALTH_ICONS[lastHealthStatus] ?? { icon: '?', color: 'text-gray-400' }) : null;
  const badge = STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600';

  function handleTest() {
    startTransition(async () => {
      await testInstance(id);
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {health && <span className={`text-lg font-bold ${health.color}`}>{health.icon}</span>}
            <h3 className="text-sm font-semibold text-gray-900">{displayName}</h3>
          </div>
          <p className="text-xs text-gray-500">{adapterName} &middot; {name}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
          {status}
        </span>
      </div>

      {lastHealthCheckAt && (
        <div className="mt-2 text-xs text-gray-400">
          Last check: {new Date(lastHealthCheckAt).toLocaleString()}
          {lastHealthLatencyMs !== null && ` (${lastHealthLatencyMs}ms)`}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isPending ? 'Testing...' : 'Test'}
        </button>
      </div>
    </div>
  );
}
