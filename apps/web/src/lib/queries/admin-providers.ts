/**
 * Admin Provider Queries (F1.4)
 * Provider overview, adapters, instances, mappings, health logs
 */

import { db } from '@twicely/db';
import {
  providerAdapter,
  providerInstance,
  providerSecret,
  providerUsageMapping,
  providerHealthLog,
} from '@twicely/db/schema';
import { eq, desc, asc, count, sql } from 'drizzle-orm';

export interface AdapterRow {
  id: string;
  serviceType: string;
  code: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  docsUrl: string | null;
  isBuiltIn: boolean;
  enabled: boolean;
  sortOrder: number;
}

export interface InstanceRow {
  id: string;
  adapterId: string;
  adapterName: string;
  name: string;
  displayName: string;
  configJson?: unknown;
  status: string;
  priority: number;
  lastHealthStatus: string | null;
  lastHealthCheckAt: Date | null;
  lastHealthLatencyMs: number | null;
  lastHealthError: string | null;
}

export interface MappingRow {
  id: string;
  usageKey: string;
  description: string | null;
  serviceType: string;
  primaryInstanceId: string;
  primaryInstanceName: string;
  fallbackInstanceId: string | null;
  fallbackInstanceName: string | null;
  autoFailover: boolean;
  enabled: boolean;
}

export interface HealthLogRow {
  id: string;
  instanceId: string;
  instanceName: string;
  status: string;
  latencyMs: number | null;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface ProviderOverview {
  totalAdapters: number;
  totalInstances: number;
  healthyInstances: number;
  unhealthyInstances: number;
  recentIssues: HealthLogRow[];
}

export async function getProviderOverview(): Promise<ProviderOverview> {
  const [adapterCount] = await db.select({ c: count() }).from(providerAdapter);
  const [instanceCount] = await db.select({ c: count() }).from(providerInstance);

  const [healthy] = await db
    .select({ c: count() })
    .from(providerInstance)
    .where(eq(providerInstance.lastHealthStatus, 'healthy'));

  const [unhealthy] = await db
    .select({ c: count() })
    .from(providerInstance)
    .where(eq(providerInstance.lastHealthStatus, 'unhealthy'));

  const recentIssues = await db
    .select({
      id: providerHealthLog.id,
      instanceId: providerHealthLog.instanceId,
      instanceName: providerInstance.displayName,
      status: providerHealthLog.status,
      latencyMs: providerHealthLog.latencyMs,
      errorMessage: providerHealthLog.errorMessage,
      checkedAt: providerHealthLog.checkedAt,
    })
    .from(providerHealthLog)
    .innerJoin(providerInstance, eq(providerHealthLog.instanceId, providerInstance.id))
    .where(sql`${providerHealthLog.status} != 'healthy'`)
    .orderBy(desc(providerHealthLog.checkedAt))
    .limit(5);

  return {
    totalAdapters: adapterCount?.c ?? 0,
    totalInstances: instanceCount?.c ?? 0,
    healthyInstances: healthy?.c ?? 0,
    unhealthyInstances: unhealthy?.c ?? 0,
    recentIssues,
  };
}

export async function getAdapters(): Promise<AdapterRow[]> {
  return db
    .select()
    .from(providerAdapter)
    .orderBy(asc(providerAdapter.sortOrder));
}

export async function getInstances(): Promise<InstanceRow[]> {
  return db
    .select({
      id: providerInstance.id,
      adapterId: providerInstance.adapterId,
      adapterName: providerAdapter.name,
      name: providerInstance.name,
      displayName: providerInstance.displayName,
      status: providerInstance.status,
      priority: providerInstance.priority,
      lastHealthStatus: providerInstance.lastHealthStatus,
      lastHealthCheckAt: providerInstance.lastHealthCheckAt,
      lastHealthLatencyMs: providerInstance.lastHealthLatencyMs,
      lastHealthError: providerInstance.lastHealthError,
    })
    .from(providerInstance)
    .innerJoin(providerAdapter, eq(providerInstance.adapterId, providerAdapter.id))
    .orderBy(asc(providerInstance.priority));
}

export async function getUsageMappings(): Promise<MappingRow[]> {
  // Fetch mappings then enrich with instance display names
  const rows = await db.select().from(providerUsageMapping).orderBy(asc(providerUsageMapping.usageKey));

  const instanceIds = new Set<string>();
  for (const r of rows) {
    instanceIds.add(r.primaryInstanceId);
    if (r.fallbackInstanceId) instanceIds.add(r.fallbackInstanceId);
  }

  const instances = instanceIds.size > 0
    ? await db.select({ id: providerInstance.id, displayName: providerInstance.displayName }).from(providerInstance)
    : [];

  const nameMap = new Map(instances.map((i) => [i.id, i.displayName]));

  return rows.map((r) => ({
    id: r.id,
    usageKey: r.usageKey,
    description: r.description,
    serviceType: r.serviceType,
    primaryInstanceId: r.primaryInstanceId,
    primaryInstanceName: nameMap.get(r.primaryInstanceId) ?? 'Unknown',
    fallbackInstanceId: r.fallbackInstanceId,
    fallbackInstanceName: r.fallbackInstanceId ? nameMap.get(r.fallbackInstanceId) ?? null : null,
    autoFailover: r.autoFailover,
    enabled: r.enabled,
  }));
}

export async function getAdapterById(id: string) {
  const [row] = await db.select().from(providerAdapter).where(eq(providerAdapter.id, id)).limit(1);
  return row ?? null;
}

export async function getAdapterByCode(code: string) {
  const [row] = await db.select().from(providerAdapter).where(eq(providerAdapter.code, code)).limit(1);
  return row ?? null;
}

export async function getInstancesByAdapter(adapterId: string): Promise<InstanceRow[]> {
  return db
    .select({
      id: providerInstance.id,
      adapterId: providerInstance.adapterId,
      adapterName: providerAdapter.name,
      name: providerInstance.name,
      displayName: providerInstance.displayName,
      configJson: providerInstance.configJson,
      status: providerInstance.status,
      priority: providerInstance.priority,
      lastHealthStatus: providerInstance.lastHealthStatus,
      lastHealthCheckAt: providerInstance.lastHealthCheckAt,
      lastHealthLatencyMs: providerInstance.lastHealthLatencyMs,
      lastHealthError: providerInstance.lastHealthError,
    })
    .from(providerInstance)
    .innerJoin(providerAdapter, eq(providerInstance.adapterId, providerAdapter.id))
    .where(eq(providerInstance.adapterId, adapterId))
    .orderBy(asc(providerInstance.priority));
}

export interface SecretRow {
  id: string;
  key: string;
  encryptedValue: string;
}

export async function getInstanceSecrets(instanceId: string): Promise<SecretRow[]> {
  return db
    .select({ id: providerSecret.id, key: providerSecret.key, encryptedValue: providerSecret.encryptedValue })
    .from(providerSecret)
    .where(eq(providerSecret.instanceId, instanceId));
}

export async function getInstanceById(instanceId: string) {
  const [row] = await db
    .select({
      id: providerInstance.id,
      adapterId: providerInstance.adapterId,
      name: providerInstance.name,
      displayName: providerInstance.displayName,
      configJson: providerInstance.configJson,
      status: providerInstance.status,
      priority: providerInstance.priority,
      lastHealthStatus: providerInstance.lastHealthStatus,
      lastHealthCheckAt: providerInstance.lastHealthCheckAt,
      lastHealthLatencyMs: providerInstance.lastHealthLatencyMs,
      createdByStaffId: providerInstance.createdByStaffId,
    })
    .from(providerInstance)
    .where(eq(providerInstance.id, instanceId))
    .limit(1);
  return row ?? null;
}

export async function getHealthLogs(limit: number = 50): Promise<HealthLogRow[]> {
  return db
    .select({
      id: providerHealthLog.id,
      instanceId: providerHealthLog.instanceId,
      instanceName: providerInstance.displayName,
      status: providerHealthLog.status,
      latencyMs: providerHealthLog.latencyMs,
      errorMessage: providerHealthLog.errorMessage,
      checkedAt: providerHealthLog.checkedAt,
    })
    .from(providerHealthLog)
    .innerJoin(providerInstance, eq(providerHealthLog.instanceId, providerInstance.id))
    .orderBy(desc(providerHealthLog.checkedAt))
    .limit(limit);
}
