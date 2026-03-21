/**
 * Doctor Runner — executes all checks and aggregates results.
 */

import { DOCTOR_CHECKS } from './doctor-checks';
import type { DoctorSummary, ServiceHealthStatus } from './types';

export async function runAllChecks(): Promise<DoctorSummary> {
  const results = await Promise.allSettled(
    DOCTOR_CHECKS.map((check) => check.fn())
  );

  const checks = results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      name: DOCTOR_CHECKS[i]!.name,
      module: DOCTOR_CHECKS[i]!.module,
      status: 'UNHEALTHY' as const,
      latencyMs: 0,
      message: result.reason instanceof Error ? result.reason.message : 'Check failed',
      checkedAt: new Date(),
    };
  });

  let overall: ServiceHealthStatus = 'HEALTHY';
  for (const check of checks) {
    if (check.status === 'UNHEALTHY') { overall = 'UNHEALTHY'; break; }
    if (check.status === 'DEGRADED') { overall = 'DEGRADED'; }
  }

  return { overall, checks, checkedAt: new Date() };
}
