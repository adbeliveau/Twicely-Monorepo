/**
 * Health Persistence — persists health-check runs and snapshots to the database.
 *
 * Each run produces:
 *  - 1 healthRun row (overall status + counts)
 *  - N healthSnapshot rows (one per check)
 *  - N healthCheckProvider upserts (latest status cache)
 */

import { db } from '@twicely/db';
import { healthSnapshot, healthRun, healthCheckProvider } from '@twicely/db/schema';
import { createId } from '@paralleldrive/cuid2';
import { logger } from '@twicely/logger';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
export type RunType = 'scheduled' | 'interactive' | 'manual';

export interface CheckResult {
  checkName: string;
  module: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface HealthRunSummary {
  checks: CheckResult[];
  startedAt: Date;
  finishedAt: Date;
}

/**
 * Derive the overall run status from individual check results.
 *
 * - UNHEALTHY if any check is UNHEALTHY
 * - DEGRADED if any check is DEGRADED (and none UNHEALTHY)
 * - UNKNOWN if all checks are UNKNOWN
 * - HEALTHY otherwise
 */
function deriveOverallStatus(checks: CheckResult[]): HealthStatus {
  if (checks.length === 0) return 'UNKNOWN';

  let hasUnhealthy = false;
  let hasDegraded = false;
  let allUnknown = true;

  for (const check of checks) {
    if (check.status !== 'UNKNOWN') allUnknown = false;
    if (check.status === 'UNHEALTHY') hasUnhealthy = true;
    if (check.status === 'DEGRADED') hasDegraded = true;
  }

  if (hasUnhealthy) return 'UNHEALTHY';
  if (hasDegraded) return 'DEGRADED';
  if (allUnknown) return 'UNKNOWN';
  return 'HEALTHY';
}

/**
 * Persist a completed health run to the database.
 *
 * 1. Counts status buckets from the check results
 * 2. Inserts the healthRun row
 * 3. Bulk-inserts healthSnapshot rows for each check
 * 4. Upserts healthCheckProvider rows with latest status
 */
export async function persistHealthRun(
  summary: HealthRunSummary,
  runType: RunType,
  triggeredByStaffId?: string,
): Promise<{ id: string; status: HealthStatus }> {
  const { checks, startedAt, finishedAt } = summary;

  // Count status buckets
  let healthyCount = 0;
  let degradedCount = 0;
  let unhealthyCount = 0;
  let unknownCount = 0;

  for (const check of checks) {
    switch (check.status) {
      case 'HEALTHY':   healthyCount++;   break;
      case 'DEGRADED':  degradedCount++;  break;
      case 'UNHEALTHY': unhealthyCount++; break;
      case 'UNKNOWN':   unknownCount++;   break;
    }
  }

  const overallStatus = deriveOverallStatus(checks);
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const runId = createId();

  // Insert the health run
  await db.insert(healthRun).values({
    id: runId,
    runType,
    status: overallStatus,
    startedAt,
    finishedAt,
    durationMs,
    totalChecks: checks.length,
    healthyCount,
    degradedCount,
    unhealthyCount,
    unknownCount,
    triggeredByStaffId: triggeredByStaffId ?? null,
  });

  // Bulk-insert snapshots
  if (checks.length > 0) {
    const snapshotRows = checks.map((check) => ({
      id: createId(),
      runId,
      checkName: check.checkName,
      module: check.module,
      status: check.status,
      message: check.message ?? null,
      latencyMs: check.latencyMs ?? null,
      detailsJson: check.details ?? {},
      checkedAt: finishedAt,
    }));

    await db.insert(healthSnapshot).values(snapshotRows);
  }

  // Upsert provider registry entries (cache latest status per check)
  const now = new Date();
  for (const check of checks) {
    await db
      .insert(healthCheckProvider)
      .values({
        id: createId(),
        checkName: check.checkName,
        module: check.module,
        lastStatus: check.status,
        lastCheckedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: healthCheckProvider.checkName,
        set: {
          lastStatus: check.status,
          lastCheckedAt: now,
          module: check.module,
          updatedAt: now,
        },
      });
  }

  logger.info('[healthPersistence] Run persisted', {
    runId,
    runType,
    status: overallStatus,
    totalChecks: checks.length,
    durationMs,
  });

  return { id: runId, status: overallStatus };
}
