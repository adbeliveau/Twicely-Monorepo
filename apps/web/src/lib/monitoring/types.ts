/**
 * Shared types for monitoring, health checks, and doctor checks.
 * E5 — Monitoring
 */

export type ServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface HealthCheckResult {
  name: string;        // e.g., "db.connection"
  module: string;      // e.g., "Database"
  status: ServiceHealthStatus;
  latencyMs: number;
  message: string | null;
  checkedAt: Date;
}

export interface DoctorSummary {
  overall: ServiceHealthStatus;
  checks: HealthCheckResult[];
  checkedAt: Date;
}

export interface ProviderHealthRow {
  instanceId: string;
  instanceName: string;
  displayName: string;
  adapterName: string;
  serviceType: string;
  status: string | null;       // lastHealthStatus
  lastCheckAt: Date | null;
  latencyMs: number | null;
  error: string | null;
}
