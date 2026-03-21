/**
 * Admin Operations Summary Query (I11)
 * Aggregates provider counts, kill switch counts, critical events,
 * and feature flag counts for the Operations Dashboard.
 */

import { db } from '@twicely/db';
import { providerInstance, featureFlag, auditEvent } from '@twicely/db/schema';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';

export interface OperationsSummary {
  providerCounts: {
    total: number;
    active: number;
    inactive: number;
  };
  killSwitchActive: number;
  criticalEvents24h: number;
  totalFlags: number;
  enabledFlags: number;
}

/**
 * Return aggregated operations summary for the dashboard.
 * Single DB round-trip per entity (5 queries total, parallelised).
 */
export async function getOperationsSummary(): Promise<OperationsSummary> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    providerCountRows,
    activeProviderRows,
    killSwitchRows,
    criticalEventRows,
    flagCountRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(providerInstance),
    db
      .select({ count: sql<number>`count(*)` })
      .from(providerInstance)
      .where(eq(providerInstance.status, 'ACTIVE')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(featureFlag)
      .where(and(
        eq(featureFlag.enabled, true),
        sql`${featureFlag.key} LIKE ${'kill.%'}`,
      )),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditEvent)
      .where(and(
        inArray(auditEvent.severity, ['HIGH', 'CRITICAL']),
        gte(auditEvent.createdAt, since24h),
      )),
    db
      .select({
        total: sql<number>`count(*)`,
        enabled: sql<number>`count(*) filter (where ${featureFlag.enabled} = true)`,
      })
      .from(featureFlag),
  ]);

  const total = Number(providerCountRows[0]?.count ?? 0);
  const active = Number(activeProviderRows[0]?.count ?? 0);

  return {
    providerCounts: {
      total,
      active,
      inactive: total - active,
    },
    killSwitchActive: Number(killSwitchRows[0]?.count ?? 0),
    criticalEvents24h: Number(criticalEventRows[0]?.count ?? 0),
    totalFlags: Number(flagCountRows[0]?.total ?? 0),
    enabledFlags: Number(flagCountRows[0]?.enabled ?? 0),
  };
}
