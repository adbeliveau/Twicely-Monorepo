'use server';

/**
 * Admin Feature Flag Actions (E4 + G10.4)
 * Create, update, toggle, and delete feature flags — all audited.
 * Kill switch toggles (kill.* keys) use CRITICAL severity.
 * Launch gate toggles (gate.* keys) use HIGH severity.
 * Cache invalidation happens after every DB write.
 */

import { db } from '@twicely/db';
import { featureFlag, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { invalidateFlagCache } from '@/lib/services/feature-flags';
import { getFeatureFlagByKey, getFeatureFlags } from '@/lib/queries/admin-feature-flags';
import {
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
  toggleFeatureFlagSchema,
  deleteFeatureFlagSchema,
} from './admin-feature-flag-schemas';

type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

function toggleSeverity(flagKey: string): AuditSeverity {
  if (flagKey.startsWith('kill.')) return 'CRITICAL';
  return 'HIGH';
}

export async function createFeatureFlagAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'FeatureFlag')) {
    return { error: 'Forbidden' };
  }

  const parsed = createFeatureFlagSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { key, name, description, type, enabled, percentage, targetingJson } = parsed.data;

  const existing = await getFeatureFlagByKey(key);
  if (existing) return { error: 'A flag with this key already exists' };

  const [created] = await db.insert(featureFlag).values({
    key,
    name,
    description: description ?? null,
    type,
    enabled,
    percentage: percentage ?? null,
    targetingJson: targetingJson ?? {},
    createdByStaffId: session.staffUserId,
  }).returning({ id: featureFlag.id });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_FLAG',
    subject: 'FeatureFlag',
    subjectId: created!.id,
    severity: 'MEDIUM',
    detailsJson: { key, name, type, enabled },
  });

  revalidatePath('/flags');
  return { success: true as const, id: created!.id };
}

export async function updateFeatureFlagAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'FeatureFlag')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateFeatureFlagSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { flagId, name, description, enabled, percentage, targetingJson } = parsed.data;

  const [existing] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.id, flagId))
    .limit(1);

  if (!existing) return { error: 'Flag not found' };

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updateValues['name'] = name;
  if (description !== undefined) updateValues['description'] = description;
  if (enabled !== undefined) updateValues['enabled'] = enabled;
  if (percentage !== undefined) updateValues['percentage'] = percentage;
  if (targetingJson !== undefined) updateValues['targetingJson'] = targetingJson;

  await db
    .update(featureFlag)
    .set(updateValues)
    .where(eq(featureFlag.id, flagId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_FLAG',
    subject: 'FeatureFlag',
    subjectId: flagId,
    severity: 'MEDIUM',
    detailsJson: {
      key: existing.key,
      previous: { name: existing.name, description: existing.description, enabled: existing.enabled, percentage: existing.percentage },
      next: { name, description, enabled, percentage, targetingJson },
    },
  });

  await invalidateFlagCache(existing.key);

  revalidatePath('/flags');
  return { success: true as const };
}

export async function toggleFeatureFlagAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'FeatureFlag')) {
    return { error: 'Forbidden' };
  }

  const parsed = toggleFeatureFlagSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { flagId } = parsed.data;

  const [existing] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.id, flagId))
    .limit(1);

  if (!existing) return { error: 'Flag not found' };

  const newEnabled = !existing.enabled;

  await db
    .update(featureFlag)
    .set({ enabled: newEnabled, updatedAt: new Date() })
    .where(eq(featureFlag.id, flagId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'TOGGLE_FLAG',
    subject: 'FeatureFlag',
    subjectId: flagId,
    severity: toggleSeverity(existing.key),
    detailsJson: { key: existing.key, previousEnabled: existing.enabled, newEnabled },
  });

  await invalidateFlagCache(existing.key);

  revalidatePath('/flags');
  return { success: true as const, enabled: newEnabled };
}

export async function deleteFeatureFlagAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('delete', 'FeatureFlag')) {
    return { error: 'Forbidden' };
  }

  const parsed = deleteFeatureFlagSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { flagId } = parsed.data;

  const [existing] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.id, flagId))
    .limit(1);

  if (!existing) return { error: 'Flag not found' };

  await db.delete(featureFlag).where(eq(featureFlag.id, flagId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'DELETE_FLAG',
    subject: 'FeatureFlag',
    subjectId: flagId,
    severity: 'HIGH',
    detailsJson: { key: existing.key, name: existing.name },
  });

  await invalidateFlagCache(existing.key);

  revalidatePath('/flags');
  return { success: true as const };
}

export async function listFlagsAction(searchTerm?: string) {
  const { ability } = await staffAuthorize();
  if (!ability.can('read', 'FeatureFlag')) return [];
  return getFeatureFlags(searchTerm);
}
