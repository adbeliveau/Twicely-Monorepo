'use server';

/**
 * Admin Provider Actions (F1.4)
 * Instance CRUD, usage mapping, health checks
 */

import { db } from '@twicely/db';
import {
  providerInstance,
  providerSecret,
  providerUsageMapping,
  providerHealthLog,
  auditEvent,
} from '@twicely/db/schema';
import { encryptSecret } from '@/lib/crypto/provider-secrets';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

const createInstanceSchema = z.object({
  adapterId: zodId,
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  priority: z.number().int().min(0).max(1000).default(100),
  configJson: z.record(z.string(), z.unknown()).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
}).strict();

export async function createInstance(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'ProviderInstance')) {
    return { error: 'Forbidden' };
  }

  const parsed = createInstanceSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { adapterId, name, displayName, priority, configJson, secrets } = parsed.data;

  const [row] = await db.insert(providerInstance).values({
    adapterId,
    name,
    displayName,
    priority,
    configJson: configJson ?? {},
    createdByStaffId: session.staffUserId,
  }).returning({ id: providerInstance.id });

  if (row?.id && secrets) {
    for (const [key, value] of Object.entries(secrets)) {
      if (!value) continue;
      await db.insert(providerSecret).values({
        instanceId: row.id,
        key,
        encryptedValue: encryptSecret(value),
      });
    }
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_PROVIDER_INSTANCE',
    subject: 'ProviderInstance',
    subjectId: row?.id,
    severity: 'HIGH',
    detailsJson: { name, adapterId },
  });

  revalidatePath('/cfg/providers');
  return { success: true, id: row?.id };
}

const updateInstanceSchema = z.object({
  instanceId: zodId,
  displayName: z.string().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'TESTING']).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
}).strict();

export async function updateInstance(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'ProviderInstance')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateInstanceSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { instanceId, ...updates } = parsed.data;
  const setClause: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.displayName) setClause.displayName = updates.displayName;
  if (updates.status) setClause.status = updates.status;
  if (updates.priority !== undefined) setClause.priority = updates.priority;

  await db
    .update(providerInstance)
    .set(setClause)
    .where(eq(providerInstance.id, instanceId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_PROVIDER_INSTANCE',
    subject: 'ProviderInstance',
    subjectId: instanceId,
    severity: 'MEDIUM',
    detailsJson: updates,
  });

  return { success: true };
}

export async function testInstance(instanceId: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'ProviderInstance')) {
    return { error: 'Forbidden' };
  }

  const [instance] = await db
    .select()
    .from(providerInstance)
    .where(eq(providerInstance.id, instanceId))
    .limit(1);

  if (!instance) return { error: 'Instance not found' };

  // Record a health check (simulated — real check would call provider API)
  const startMs = Date.now();
  const status = instance.status === 'ACTIVE' ? 'healthy' : 'degraded';
  const latencyMs = Date.now() - startMs;

  await db.insert(providerHealthLog).values({
    instanceId,
    status,
    latencyMs,
    detailsJson: { testType: 'manual' },
  });

  await db
    .update(providerInstance)
    .set({
      lastHealthStatus: status,
      lastHealthCheckAt: new Date(),
      lastHealthLatencyMs: latencyMs,
      updatedAt: new Date(),
    })
    .where(eq(providerInstance.id, instanceId));

  return { success: true, status, latencyMs };
}

const createMappingSchema = z.object({
  usageKey: z.string().min(1),
  description: z.string().optional(),
  serviceType: z.enum(['STORAGE', 'EMAIL', 'SEARCH', 'SMS', 'PUSH', 'PAYMENTS', 'SHIPPING', 'REALTIME', 'CACHE']),
  primaryInstanceId: zodId,
  fallbackInstanceId: zodId.nullable().optional(),
  autoFailover: z.boolean().default(false),
}).strict();

export async function createUsageMapping(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'ProviderUsageMapping')) {
    return { error: 'Forbidden' };
  }

  const parsed = createMappingSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const [row] = await db.insert(providerUsageMapping).values(parsed.data).returning({ id: providerUsageMapping.id });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_USAGE_MAPPING',
    subject: 'ProviderUsageMapping',
    subjectId: row?.id,
    severity: 'HIGH',
    detailsJson: { usageKey: parsed.data.usageKey },
  });

  return { success: true };
}

const saveConfigSchema = z.object({
  instanceId: zodId,
  configJson: z.record(z.string(), z.unknown()),
  secrets: z.record(z.string(), z.string()),
}).strict();

export async function saveInstanceConfig(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'ProviderInstance')) {
    return { error: 'Forbidden' };
  }

  const parsed = saveConfigSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { instanceId, configJson, secrets } = parsed.data;

  await db
    .update(providerInstance)
    .set({ configJson, updatedAt: new Date() })
    .where(eq(providerInstance.id, instanceId));

  for (const [key, value] of Object.entries(secrets)) {
    if (!value) continue;
    const encrypted = encryptSecret(value);
    await db.insert(providerSecret).values({
      instanceId, key, encryptedValue: encrypted,
    }).onConflictDoUpdate({
      target: [providerSecret.instanceId, providerSecret.key],
      set: { encryptedValue: encrypted, updatedAt: new Date() },
    });
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_PROVIDER_CONFIG',
    subject: 'ProviderInstance',
    subjectId: instanceId,
    severity: 'HIGH',
    detailsJson: { configKeys: Object.keys(configJson), secretKeys: Object.keys(secrets) },
  });

  revalidatePath('/cfg/providers');
  return { success: true };
}

const updateMappingSchema = z.object({
  mappingId: zodId,
  primaryInstanceId: zodId.optional(),
  fallbackInstanceId: zodId.nullable().optional(),
  autoFailover: z.boolean().optional(),
  enabled: z.boolean().optional(),
}).strict();

export async function updateUsageMapping(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'ProviderUsageMapping')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateMappingSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { mappingId, ...updates } = parsed.data;
  await db
    .update(providerUsageMapping)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(providerUsageMapping.id, mappingId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_USAGE_MAPPING',
    subject: 'ProviderUsageMapping',
    subjectId: mappingId,
    severity: 'MEDIUM',
    detailsJson: updates,
  });

  return { success: true };
}
