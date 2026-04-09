'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { caseWatcher } from '@twicely/db/schema';
import { eq, and } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';

interface ActionResult<T = undefined> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

export async function addCaseWatcher(
  caseId: string,
  staffUserId: string
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  await db.insert(caseWatcher).values({ caseId, staffUserId });
  revalidatePath(`/hd/cases/${caseId}`);
  return { success: true };
}

export async function removeCaseWatcher(
  caseId: string,
  staffUserId: string
): Promise<ActionResult> {
  const { ability } = await staffAuthorize();
  if (!ability.can('manage', 'HelpdeskCase')) {
    return { success: false, error: 'Access denied' };
  }

  await db
    .delete(caseWatcher)
    .where(
      and(
        eq(caseWatcher.caseId, caseId),
        eq(caseWatcher.staffUserId, staffUserId)
      )
    );
  revalidatePath(`/hd/cases/${caseId}`);
  return { success: true };
}
