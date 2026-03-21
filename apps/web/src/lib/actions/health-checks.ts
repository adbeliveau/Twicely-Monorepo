'use server';

import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { ForbiddenError } from '@twicely/casl/authorize';
import { runAllChecks } from '@/lib/monitoring/doctor-runner';
import type { DoctorSummary } from '@/lib/monitoring/types';

/**
 * Run all doctor checks. Requires manage HealthCheck ability (SRE/ADMIN).
 */
export async function runDoctorChecksAction(): Promise<DoctorSummary> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HealthCheck')) {
    throw new ForbiddenError('Not authorized to run health checks');
  }
  return runAllChecks();
}
