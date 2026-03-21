import { Badge } from '@twicely/ui/badge';
import type { ServiceHealthStatus } from '@/lib/monitoring/types';

const STATUS_VARIANT: Record<ServiceHealthStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  HEALTHY:   'default',
  DEGRADED:  'outline',
  UNHEALTHY: 'destructive',
  UNKNOWN:   'secondary',
};

interface HealthStatusCardProps {
  name: string;
  status: ServiceHealthStatus;
  latencyMs: number | null;
  lastCheckAt: Date | null;
  error: string | null;
}

export function HealthStatusCard({
  name, status, latencyMs, lastCheckAt, error,
}: HealthStatusCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{name}</span>
        <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        {latencyMs !== null && <p>Latency: {latencyMs}ms</p>}
        {lastCheckAt && (
          <p>Last check: {new Date(lastCheckAt).toLocaleString('en-US')}</p>
        )}
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
}
