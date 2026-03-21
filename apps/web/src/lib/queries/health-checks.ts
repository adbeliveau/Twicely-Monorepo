import { db } from '@twicely/db';
import { providerInstance, providerAdapter, providerHealthLog } from '@twicely/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { ProviderHealthRow } from '@/lib/monitoring/types';

export interface ProviderInstanceDetail {
  id: string;
  name: string;
  displayName: string;
  status: string;
  priority: number;
  configJson: unknown;
  lastHealthStatus: string | null;
  lastHealthCheckAt: Date | null;
  lastHealthLatencyMs: number | null;
  lastHealthError: string | null;
  createdAt: Date;
  updatedAt: Date;
  adapterId: string;
  adapterName: string;
  adapterServiceType: string;
}

export interface ProviderHealthLogRow {
  id: string;
  instanceId: string;
  status: string;
  latencyMs: number | null;
  errorMessage: string | null;
  detailsJson: unknown;
  checkedAt: Date;
}

/**
 * Read all provider instances with their health status for the dashboard.
 */
export async function getProviderHealthStatus(): Promise<ProviderHealthRow[]> {
  const rows = await db
    .select({
      instanceId: providerInstance.id,
      instanceName: providerInstance.name,
      displayName: providerInstance.displayName,
      adapterName: providerAdapter.name,
      serviceType: providerAdapter.serviceType,
      status: providerInstance.lastHealthStatus,
      lastCheckAt: providerInstance.lastHealthCheckAt,
      latencyMs: providerInstance.lastHealthLatencyMs,
      error: providerInstance.lastHealthError,
    })
    .from(providerInstance)
    .innerJoin(providerAdapter, eq(providerInstance.adapterId, providerAdapter.id));

  return rows.map((r) => ({
    instanceId: r.instanceId,
    instanceName: r.instanceName,
    displayName: r.displayName,
    adapterName: r.adapterName,
    serviceType: r.serviceType,
    status: r.status,
    lastCheckAt: r.lastCheckAt,
    latencyMs: r.latencyMs,
    error: r.error,
  }));
}

/**
 * Return a single provider instance by ID with adapter details, or null if not found.
 */
export async function getProviderInstanceById(id: string): Promise<ProviderInstanceDetail | null> {
  const rows = await db
    .select({
      id: providerInstance.id,
      name: providerInstance.name,
      displayName: providerInstance.displayName,
      status: providerInstance.status,
      priority: providerInstance.priority,
      configJson: providerInstance.configJson,
      lastHealthStatus: providerInstance.lastHealthStatus,
      lastHealthCheckAt: providerInstance.lastHealthCheckAt,
      lastHealthLatencyMs: providerInstance.lastHealthLatencyMs,
      lastHealthError: providerInstance.lastHealthError,
      createdAt: providerInstance.createdAt,
      updatedAt: providerInstance.updatedAt,
      adapterId: providerAdapter.id,
      adapterName: providerAdapter.name,
      adapterServiceType: providerAdapter.serviceType,
    })
    .from(providerInstance)
    .innerJoin(providerAdapter, eq(providerInstance.adapterId, providerAdapter.id))
    .where(eq(providerInstance.id, id));

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    status: row.status,
    priority: row.priority,
    configJson: row.configJson,
    lastHealthStatus: row.lastHealthStatus ?? null,
    lastHealthCheckAt: row.lastHealthCheckAt ?? null,
    lastHealthLatencyMs: row.lastHealthLatencyMs ?? null,
    lastHealthError: row.lastHealthError ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    adapterId: row.adapterId,
    adapterName: row.adapterName,
    adapterServiceType: row.adapterServiceType,
  };
}

/**
 * Return health log entries for a provider instance, ordered by checkedAt descending.
 */
export async function getProviderHealthLogs(
  instanceId: string,
  limit: number = 50,
): Promise<ProviderHealthLogRow[]> {
  const rows = await db
    .select()
    .from(providerHealthLog)
    .where(eq(providerHealthLog.instanceId, instanceId))
    .orderBy(desc(providerHealthLog.checkedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    instanceId: r.instanceId,
    status: r.status,
    latencyMs: r.latencyMs ?? null,
    errorMessage: r.errorMessage ?? null,
    detailsJson: r.detailsJson,
    checkedAt: r.checkedAt,
  }));
}

/**
 * Write a provider health check result — updates the instance and inserts a log entry.
 */
export async function writeProviderHealthResult(
  instanceId: string,
  status: string,
  latencyMs: number,
  error: string | null,
): Promise<void> {
  const now = new Date();

  await db
    .update(providerInstance)
    .set({
      lastHealthStatus: status,
      lastHealthCheckAt: now,
      lastHealthLatencyMs: latencyMs,
      lastHealthError: error,
      updatedAt: now,
    })
    .where(eq(providerInstance.id, instanceId));

  await db.insert(providerHealthLog).values({
    instanceId,
    status,
    latencyMs,
    errorMessage: error,
  });
}
