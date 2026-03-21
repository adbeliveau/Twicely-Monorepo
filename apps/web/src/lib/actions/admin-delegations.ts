'use server';

/**
 * Admin Delegation Actions (I14)
 * Platform-wide delegation revocation — distinct from seller-scoped staff management.
 */

import { db } from '@twicely/db';
import { delegatedAccess, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';

type ActionResult = { success: true } | { error: string };

/**
 * Revoke a delegation platform-wide.
 * Requires manage DelegatedAccess CASL ability.
 * Inserts an audit event and revalidates the /delegated-access page.
 */
export async function adminRevokeDelegationAction(
  delegationId: string
): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'DelegatedAccess')) {
    return { error: 'Forbidden' };
  }

  await db
    .update(delegatedAccess)
    .set({ status: 'REVOKED', revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(delegatedAccess.id, delegationId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'admin.delegation.revoked',
    subject: 'DelegatedAccess',
    subjectId: delegationId,
    severity: 'HIGH',
    detailsJson: { delegationId },
  });

  revalidatePath('/delegated-access');
  return { success: true };
}
