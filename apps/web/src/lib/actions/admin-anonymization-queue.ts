'use server';

/**
 * Admin Anonymization Queue Actions (I13)
 * Force anonymize or cancel deletion requests for users.
 * NOTE: anonymizedAt column does not yet exist on user table (schema v2.0.7).
 * TODO: Once anonymizedAt is added to user table, update anonymize actions to set it.
 */

import { db } from '@twicely/db';
import { user, auditEvent } from '@twicely/db/schema';
import { eq, and, isNotNull, lt } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { ForbiddenError } from '@twicely/casl';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const userIdSchema = z.string().min(1);

type ActionResult = { success: true } | { error: string };

export async function forceAnonymizeUserAction(userId: string): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();

  if (!ability.can('manage', 'DataRetention')) {
    throw new ForbiddenError('ADMIN role required');
  }

  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return { error: 'Invalid user ID' };

  const [targetUser] = await db
    .select({ id: user.id, deletionRequestedAt: user.deletionRequestedAt })
    .from(user)
    .where(eq(user.id, parsed.data))
    .limit(1);

  if (!targetUser) return { error: 'User not found' };
  if (!targetUser.deletionRequestedAt) {
    return { error: 'User has not requested deletion' };
  }

  await db
    .update(user)
    .set({
      name: 'Deleted User',
      email: `anonymized-${parsed.data}@deleted.twicely.com`,
      // TODO: Set anonymizedAt: new Date() once column is added to user table (schema v2.0.7).
    })
    .where(eq(user.id, parsed.data));

  await db.insert(auditEvent).values({
    actorId: session.staffUserId,
    actorType: 'STAFF',
    action: 'admin.user.force_anonymized',
    subject: 'User',
    subjectId: parsed.data,
    severity: 'HIGH',
    detailsJson: { triggeredBy: 'admin_force_anonymize' },
  });

  revalidatePath('/cfg/data-retention/anonymize');

  return { success: true };
}

export async function cancelDeletionRequestAction(userId: string): Promise<ActionResult> {
  const { session, ability } = await staffAuthorize();

  if (!ability.can('manage', 'DataRetention')) {
    throw new ForbiddenError('ADMIN role required');
  }

  const parsed = userIdSchema.safeParse(userId);
  if (!parsed.success) return { error: 'Invalid user ID' };

  const [targetUser] = await db
    .select({ id: user.id, deletionRequestedAt: user.deletionRequestedAt })
    .from(user)
    .where(eq(user.id, parsed.data))
    .limit(1);

  if (!targetUser) return { error: 'User not found' };
  if (!targetUser.deletionRequestedAt) {
    return { error: 'User does not have a pending deletion request' };
  }

  await db
    .update(user)
    .set({ deletionRequestedAt: null })
    .where(eq(user.id, parsed.data));

  await db.insert(auditEvent).values({
    actorId: session.staffUserId,
    actorType: 'STAFF',
    action: 'admin.user.deletion_cancelled',
    subject: 'User',
    subjectId: parsed.data,
    severity: 'MEDIUM',
    detailsJson: { triggeredBy: 'admin_cancel_deletion' },
  });

  revalidatePath('/cfg/data-retention/anonymize');

  return { success: true };
}

export async function processOverdueDeletionsAction(): Promise<
  { processed: number } | { error: string }
> {
  const { session, ability } = await staffAuthorize();

  if (!ability.can('manage', 'DataRetention')) {
    throw new ForbiddenError('ADMIN role required');
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // Find users with deletionRequestedAt older than 30 days (past grace period), LIMIT 50.
  // TODO: Once anonymizedAt column exists, add isNull(user.anonymizedAt) to exclude already-processed.
  const overdueBatch = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        isNotNull(user.deletionRequestedAt),
        lt(user.deletionRequestedAt, thirtyDaysAgo)
      )
    )
    .limit(50);

  let processed = 0;

  for (const target of overdueBatch) {
    await db
      .update(user)
      .set({
        name: 'Deleted User',
        email: `anonymized-${target.id}@deleted.twicely.com`,
        // TODO: Set anonymizedAt: new Date() once column is added to user table.
      })
      .where(eq(user.id, target.id));
    processed++;
  }

  if (processed > 0) {
    await db.insert(auditEvent).values({
      actorId: session.staffUserId,
      actorType: 'STAFF',
      action: 'admin.bulk.anonymization_processed',
      subject: 'User',
      subjectId: null,
      severity: 'HIGH',
      detailsJson: { processedCount: processed, triggeredBy: 'admin_bulk_anonymize' },
    });
  }

  revalidatePath('/cfg/data-retention/anonymize');

  return { processed };
}
