/**
 * Health Dashboard Queries
 *
 * Query functions for the system health monitoring dashboard.
 * Reads from healthSnapshot, healthRun, and healthCheckProvider tables.
 */

import { db } from '@twicely/db';
import { healthSnapshot, healthRun, healthCheckProvider } from '@twicely/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// ── Types ───────────────────────────────────────────────────────────────

export interface LatestSnapshot {
  id: string;
  checkName: string;
  module: string;
  status: string;
  message: string | null;
  latencyMs: number | null;
  detailsJson: unknown;
  checkedAt: Date;
  isStale: boolean;
}

export interface HealthRunRow {
  id: string;
  runType: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  totalChecks: number;
  healthyCount: number | null;
  degradedCount: number | null;
  unhealthyCount: number | null;
  unknownCount: number | null;
  triggeredByStaffId: string | null;
  createdAt: Date;
}

export interface HealthRunDetail {
  run: HealthRunRow;
  snapshots: LatestSnapshot[];
}

export interface ModuleGroup {
  module: string;
  snapshots: LatestSnapshot[];
}

// ── Queries ─────────────────────────────────────────────────────────────

/**
 * Get the latest snapshot per checkName from the healthCheckProvider registry.
 * Snapshots older than `health.staleAfterMinutes` (default 10) are marked isStale=true
 * and their status is overridden to 'UNKNOWN'.
 */
export async function getLatestSnapshots(): Promise<LatestSnapshot[]> {
  const staleAfterMinutes = await getPlatformSetting<number>('health.staleAfterMinutes', 10);

  const providers = await db
    .select({
      id: healthCheckProvider.id,
      checkName: healthCheckProvider.checkName,
      module: healthCheckProvider.module,
      status: healthCheckProvider.lastStatus,
      lastCheckedAt: healthCheckProvider.lastCheckedAt,
      description: healthCheckProvider.description,
    })
    .from(healthCheckProvider);

  const now = Date.now();
  const staleThresholdMs = staleAfterMinutes * 60 * 1000;

  return providers.map((p) => {
    const checkedAt = p.lastCheckedAt ?? new Date(0);
    const isStale = now - checkedAt.getTime() > staleThresholdMs;

    return {
      id: p.id,
      checkName: p.checkName,
      module: p.module,
      status: isStale ? 'UNKNOWN' : (p.status ?? 'UNKNOWN'),
      message: isStale ? 'Check data is stale' : null,
      latencyMs: null,
      detailsJson: {},
      checkedAt,
      isStale,
    };
  });
}

/**
 * Get recent health runs ordered by startedAt descending.
 */
export async function getRecentHealthRuns(limit = 50): Promise<HealthRunRow[]> {
  const rows = await db
    .select()
    .from(healthRun)
    .orderBy(desc(healthRun.startedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    runType: r.runType,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    durationMs: r.durationMs ?? null,
    totalChecks: r.totalChecks,
    healthyCount: r.healthyCount ?? null,
    degradedCount: r.degradedCount ?? null,
    unhealthyCount: r.unhealthyCount ?? null,
    unknownCount: r.unknownCount ?? null,
    triggeredByStaffId: r.triggeredByStaffId ?? null,
    createdAt: r.createdAt,
  }));
}

/**
 * Group snapshots by module for dashboard display.
 */
export function groupByModule(snapshots: LatestSnapshot[]): ModuleGroup[] {
  const groups = new Map<string, LatestSnapshot[]>();

  for (const snap of snapshots) {
    const list = groups.get(snap.module);
    if (list) {
      list.push(snap);
    } else {
      groups.set(snap.module, [snap]);
    }
  }

  return Array.from(groups.entries()).map(([module, moduleSnapshots]) => ({
    module,
    snapshots: moduleSnapshots,
  }));
}

/**
 * Get a specific health run with all its snapshots.
 */
export async function getHealthRunDetail(runId: string): Promise<HealthRunDetail | null> {
  const [run] = await db
    .select()
    .from(healthRun)
    .where(eq(healthRun.id, runId))
    .limit(1);

  if (!run) return null;

  const snapshots = await db
    .select()
    .from(healthSnapshot)
    .where(eq(healthSnapshot.runId, runId))
    .orderBy(desc(healthSnapshot.checkedAt));

  return {
    run: {
      id: run.id,
      runType: run.runType,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt ?? null,
      durationMs: run.durationMs ?? null,
      totalChecks: run.totalChecks,
      healthyCount: run.healthyCount ?? null,
      degradedCount: run.degradedCount ?? null,
      unhealthyCount: run.unhealthyCount ?? null,
      unknownCount: run.unknownCount ?? null,
      triggeredByStaffId: run.triggeredByStaffId ?? null,
      createdAt: run.createdAt,
    },
    snapshots: snapshots.map((s) => ({
      id: s.id,
      checkName: s.checkName,
      module: s.module,
      status: s.status,
      message: s.message ?? null,
      latencyMs: s.latencyMs ?? null,
      detailsJson: s.detailsJson,
      checkedAt: s.checkedAt,
      isStale: false,
    })),
  };
}
