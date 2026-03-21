import type { ServiceHealthStatus } from '@/lib/monitoring/types';

const STATUS_CONFIG: Record<ServiceHealthStatus, { bg: string; text: string; label: string }> = {
  HEALTHY:   { bg: 'bg-green-50', text: 'text-green-700', label: 'All Systems Operational' },
  DEGRADED:  { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Some Services Degraded' },
  UNHEALTHY: { bg: 'bg-red-50', text: 'text-red-700', label: 'System Issues Detected' },
  UNKNOWN:   { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Status Unknown' },
};

interface HealthStatusBannerProps {
  status: ServiceHealthStatus;
}

export function HealthStatusBanner({ status }: HealthStatusBannerProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div className={`rounded-lg p-4 ${config.bg} ${config.text} font-medium`}>
      {config.label}
    </div>
  );
}
