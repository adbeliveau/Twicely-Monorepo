'use server';

/**
 * Admin User Management Actions (E3.2)
 * Suspend, restrict, warn users — all audited
 */

import { db } from '@twicely/db';
import { user, sellerProfile, auditEvent, session as sessionTable } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

const suspendUserSchema = z.object({
  userId: zodId,
  reason: z.string().min(1).max(500),
}).strict();

export async function suspendUserAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) {
    return { error: 'Forbidden' };
  }

  const parsed = suspendUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, reason } = parsed.data;

  await db.update(user).set({ isBanned: true }).where(eq(user.id, userId));

  // A3: Revoke all active sessions so banned user is logged out immediately
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'SUSPEND_USER',
    subject: 'User',
    subjectId: userId,
    severity: 'HIGH',
    detailsJson: { reason },
  });

  return { success: true };
}

export async function unsuspendUserAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) {
    return { error: 'Forbidden' };
  }

  const parsed = z.object({ userId: zodId }).strict().safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  await db.update(user).set({ isBanned: false }).where(eq(user.id, parsed.data.userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UNSUSPEND_USER',
    subject: 'User',
    subjectId: parsed.data.userId,
    severity: 'HIGH',
    detailsJson: {},
  });

  return { success: true };
}

const restrictSellingSchema = z.object({
  userId: zodId,
  reason: z.string().min(1).max(500),
}).strict();

export async function restrictSellingAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'SellerProfile')) {
    return { error: 'Forbidden' };
  }

  const parsed = restrictSellingSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, reason } = parsed.data;

  await db
    .update(sellerProfile)
    .set({ status: 'RESTRICTED' })
    .where(eq(sellerProfile.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'RESTRICT_SELLING',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'HIGH',
    detailsJson: { reason },
  });

  return { success: true };
}

const warnUserSchema = z.object({
  userId: zodId,
  message: z.string().min(1).max(1000),
}).strict();

export async function warnUserAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) {
    return { error: 'Forbidden' };
  }

  const parsed = warnUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, message } = parsed.data;

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'WARN_USER',
    subject: 'User',
    subjectId: userId,
    severity: 'MEDIUM',
    detailsJson: { message },
  });

  return { success: true };
}
