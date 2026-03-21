'use server';

/**
 * Admin Module Actions (F1.3)
 * Toggle and uninstall modules
 */

import { db } from '@twicely/db';
import { moduleRegistry, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';

const toggleSchema = z.object({
  moduleId: z.string().min(1),
  enabled: z.boolean(),
}).strict();

export async function toggleModule(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Module')) {
    return { error: 'Forbidden' };
  }

  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { moduleId, enabled } = parsed.data;
  const newState = enabled ? 'ENABLED' : 'DISABLED';

  const [existing] = await db
    .select({ id: moduleRegistry.id, state: moduleRegistry.state })
    .from(moduleRegistry)
    .where(eq(moduleRegistry.moduleId, moduleId))
    .limit(1);

  if (!existing) return { error: 'Module not found' };

  await db
    .update(moduleRegistry)
    .set({ state: newState, updatedAt: new Date() })
    .where(eq(moduleRegistry.id, existing.id));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: enabled ? 'ENABLE_MODULE' : 'DISABLE_MODULE',
    subject: 'Module',
    subjectId: existing.id,
    severity: 'HIGH',
    detailsJson: { moduleId, previousState: existing.state, newState },
  });

  return { success: true };
}

const uninstallSchema = z.object({
  moduleId: z.string().min(1),
  confirmText: z.literal('DELETE'),
}).strict();

export async function uninstallModule(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('delete', 'Module')) {
    return { error: 'Forbidden' };
  }

  const parsed = uninstallSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input — type DELETE to confirm' };

  const { moduleId } = parsed.data;

  const [existing] = await db
    .select({ id: moduleRegistry.id })
    .from(moduleRegistry)
    .where(eq(moduleRegistry.moduleId, moduleId))
    .limit(1);

  if (!existing) return { error: 'Module not found' };

  await db.delete(moduleRegistry).where(eq(moduleRegistry.id, existing.id));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UNINSTALL_MODULE',
    subject: 'Module',
    subjectId: existing.id,
    severity: 'CRITICAL',
    detailsJson: { moduleId },
  });

  return { success: true };
}
