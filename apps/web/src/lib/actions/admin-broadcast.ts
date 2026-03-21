'use server';

/**
 * Admin Broadcast Setting Action (I11)
 * Upserts a platform_setting row with key prefix 'broadcast.'.
 * Gate: ability.can('update', 'Setting')
 */

import { db } from '@twicely/db';
import { platformSetting, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';

const updateBroadcastSchema = z
  .object({
    key: z.string().min(1).max(200),
    value: z.string().min(0).max(2000),
  })
  .strict();

export async function updateBroadcastSettingAction(
  key: string,
  value: string,
): Promise<{ success: true } | { error: string }> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Setting')) {
    return { error: 'Forbidden' };
  }

  const parsed = updateBroadcastSchema.safeParse({ key, value });
  if (!parsed.success) return { error: 'Invalid input' };

  if (!parsed.data.key.startsWith('broadcast.')) {
    return { error: 'Key must start with broadcast.' };
  }

  const existing = await db
    .select({ id: platformSetting.id, value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, parsed.data.key))
    .limit(1);

  const existingRow = existing[0];

  if (existingRow) {
    await db
      .update(platformSetting)
      .set({
        value: parsed.data.value,
        updatedByStaffId: session.staffUserId,
        updatedAt: new Date(),
      })
      .where(eq(platformSetting.id, existingRow.id));
  } else {
    await db.insert(platformSetting).values({
      key: parsed.data.key,
      value: parsed.data.value,
      type: 'string',
      category: 'broadcast',
      updatedByStaffId: session.staffUserId,
    });
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'UPDATE_BROADCAST_SETTING',
    subject: 'Setting',
    subjectId: parsed.data.key,
    severity: 'MEDIUM',
    detailsJson: {
      key: parsed.data.key,
      previous: existingRow?.value ?? null,
      next: parsed.data.value,
    },
  });

  revalidatePath('/admin-messages');
  return { success: true };
}
