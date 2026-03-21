'use server';

/**
 * Admin User Management Actions — Extended (I2.1)
 * createUser, holdPayouts, releasePayouts, overrideBand, addNote, resetPassword
 */

import { db } from '@twicely/db';
import { user, sellerProfile, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
}).strict();

const holdPayoutsSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1).max(500),
}).strict();

const releasePayoutsSchema = z.object({
  userId: z.string().min(1),
}).strict();

const overrideBandSchema = z.object({
  userId: z.string().min(1),
  newBand: z.enum(['EMERGING', 'ESTABLISHED', 'TOP_RATED', 'POWER_SELLER']),
  reason: z.string().min(1).max(500),
  expiresInDays: z.number().int().min(1).max(90).optional().default(90),
}).strict();

const addNoteSchema = z.object({
  userId: z.string().min(1),
  content: z.string().min(1).max(2000),
}).strict();

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
}).strict();

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createUserAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('create', 'User')) return { error: 'Forbidden' };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { name, email, username } = parsed.data;

  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (existing) return { error: 'Email already in use' };

  if (username) {
    const [usernameConflict] = await db.select({ id: user.id }).from(user).where(eq(user.username, username)).limit(1);
    if (usernameConflict) return { error: 'Username already in use' };
  }

  const id = createId();
  const now = new Date();

  await db.insert(user).values({
    id,
    name,
    email,
    emailVerified: false,
    isSeller: false,
    isBanned: false,
    createdAt: now,
    updatedAt: now,
    ...(username ? { username } : {}),
  });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CREATE_USER',
    subject: 'User',
    subjectId: id,
    severity: 'HIGH',
    detailsJson: { email, name },
  });

  revalidatePath('/usr');
  return { success: true, userId: id };
}

export async function holdPayoutsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'SellerProfile')) return { error: 'Forbidden' };

  const parsed = holdPayoutsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, reason } = parsed.data;

  await db.update(sellerProfile).set({ payoutsEnabled: false }).where(eq(sellerProfile.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'HOLD_PAYOUTS',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'HIGH',
    detailsJson: { reason },
  });

  revalidatePath(`/usr/${userId}`);
  return { success: true };
}

export async function releasePayoutsAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'SellerProfile')) return { error: 'Forbidden' };

  const parsed = releasePayoutsSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId } = parsed.data;

  await db.update(sellerProfile).set({ payoutsEnabled: true }).where(eq(sellerProfile.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'RELEASE_PAYOUTS',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'HIGH',
    detailsJson: {},
  });

  revalidatePath(`/usr/${userId}`);
  return { success: true };
}

export async function overridePerformanceBandAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'SellerProfile')) return { error: 'Forbidden' };

  const parsed = overrideBandSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, newBand, reason, expiresInDays } = parsed.data;

  const [sp] = await db
    .select({ performanceBand: sellerProfile.performanceBand })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, userId))
    .limit(1);

  const previousBand = sp?.performanceBand ?? null;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await db.update(sellerProfile).set({
    bandOverride: newBand,
    performanceBand: newBand,
    bandOverrideReason: reason,
    bandOverrideBy: session.staffUserId,
    bandOverrideExpiresAt: expiresAt,
  }).where(eq(sellerProfile.userId, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'OVERRIDE_PERFORMANCE_BAND',
    subject: 'SellerProfile',
    subjectId: userId,
    severity: 'HIGH',
    detailsJson: { previousBand, newBand, reason, expiresAt: expiresAt.toISOString() },
  });

  revalidatePath(`/usr/${userId}`);
  return { success: true };
}

export async function addInternalNoteAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) return { error: 'Forbidden' };

  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, content } = parsed.data;

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ADMIN_NOTE',
    subject: 'User',
    subjectId: userId,
    severity: 'LOW',
    detailsJson: { content },
  });

  revalidatePath(`/usr/${userId}`);
  return { success: true };
}

export async function resetPasswordAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) return { error: 'Forbidden' };

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId } = parsed.data;

  const [targetUser] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!targetUser) return { error: 'User not found' };

  const maskedEmail = targetUser.email.replace(/(.{2}).+(@.+)/, '$1***$2');

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ADMIN_RESET_PASSWORD',
    subject: 'User',
    subjectId: userId,
    severity: 'HIGH',
    detailsJson: { targetEmail: maskedEmail },
  });

  revalidatePath(`/usr/${userId}`);
  return { success: true };
}
