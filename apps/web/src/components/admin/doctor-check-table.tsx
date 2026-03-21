import { Badge } from '@twicely/ui/badge';
import type { HealthCheckResult, ServiceHealthStatus } from '@/lib/monitoring/types';

const STATUS_VARIANT: Record<ServiceHealthStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  HEALTHY:   'default',
  DEGRADED:  'outline',
  UNHEALTHY: 'destructive',
  UNKNOWN:   'secondary',
};

interface DoctorCheckTableProps {
  checks: HealthCheckResult[];
}

export function DoctorCheckTable({ checks }: DoctorCheckTableProps) {
  if (checks.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-8 text-center">
        No checks have been run yet. Click &quot;Run All Checks&quot; to start.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <th className="py-2 px-3 text-left">Module</th>
            <th className="py-2 px-3 text-left">Check</th>
            <th className="py-2 px-3 text-left">Status</th>
            <th className="py-2 px-3 text-right">Latency</th>
            <th className="py-2 px-3 text-left">Message</th>
            <th className="py-2 px-3 text-left">Last Run</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.name} className="border-b last:border-0">
              <td className="py-3 px-3 text-muted-foreground">{check.module}</td>
              <td className="py-3 px-3 font-mono text-xs">{check.name}</td>
              <td className="py-3 px-3">
                <Badge variant={STATUS_VARIANT[check.status]}>{check.status}</Badge>
              </td>
              <td className="py-3 px-3 text-right text-muted-foreground">
                {check.latencyMs}ms
              </td>
              <td className="py-3 px-3 text-xs text-muted-foreground max-w-48 truncate">
                {check.message ?? '—'}
              </td>
              <td className="py-3 px-3 text-xs text-muted-foreground whitespace-nowrap">
                {new Date(check.checkedAt).toLocaleString('en-US')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
