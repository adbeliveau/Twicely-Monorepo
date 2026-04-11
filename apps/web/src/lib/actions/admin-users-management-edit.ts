'use server';

import { db } from '@twicely/db';
import { user, auditEvent } from '@twicely/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

// ─── Schema ──────────────────────────────────────────────────────────────────

const adminEditUserSchema = z.object({
  userId: zodId,
  name: z.string().min(1).max(100),
  displayName: z.string().max(100).optional().nullable(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  marketingOptIn: z.boolean().optional(),
}).strict();

// ─── Action ──────────────────────────────────────────────────────────────────

export async function adminEditUserAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'User')) return { error: 'Forbidden' };

  const parsed = adminEditUserSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, name, displayName, username, phone, marketingOptIn } = parsed.data;

  if (username) {
    const [conflict] = await db.select({ id: user.id }).from(user)
      .where(and(eq(user.username, username), sql`${user.id} != ${userId}`))
      .limit(1);
    if (conflict) return { error: 'Username already in use' };
  }

  await db.update(user).set({
    name,
    displayName: displayName ?? null,
    username: username ?? null,
    phone: phone ?? null,
    ...(marketingOptIn !== undefined ? { marketingOptIn } : {}),
    updatedAt: new Date(),
  }).where(eq(user.id, userId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'ADMIN_EDIT_USER',
    subject: 'User',
    subjectId: userId,
    severity: 'MEDIUM',
    detailsJson: { name, displayName, username, phone, marketingOptIn },
  });

  revalidatePath(`/usr/${userId}`);
  return { success: true };
}
