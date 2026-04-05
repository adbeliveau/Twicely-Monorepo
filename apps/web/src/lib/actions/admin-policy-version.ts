'use server';

/**
 * Admin Policy Version Actions (I14)
 * Update policy document version metadata stored as platform_settings.
 */

import { db } from '@twicely/db';
import { platformSetting, auditEvent } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { staffAuthorize } from '@twicely/casl/staff-authorize';

type PolicyType = 'terms' | 'privacy' | 'seller-agreement' | 'refund';

type ActionResult = { success: true } | { error: string };

/**
 * Update a policy document version and effective date.
 * Sets policy.{policyType}.version = newVersion
 * and policy.{policyType}.effectiveDate = today (ISO date string).
 */
export async function updatePolicyVersionAction(
  policyType: PolicyType,
  newVersion: string
): Promise<ActionResult> {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('manage', 'Setting')) {
    return { error: 'Forbidden' };
  }

  if (!newVersion || newVersion.trim().length === 0) {
    return { error: 'Invalid version' };
  }

  const today = new Date().toISOString().slice(0, 10);

  await db
    .update(platformSetting)
    .set({ value: newVersion, updatedAt: new Date() })
    .where(eq(platformSetting.key, `policy.${policyType}.version`));

  await db
    .update(platformSetting)
    .set({ value: today, updatedAt: new Date() })
    .where(eq(platformSetting.key, `policy.${policyType}.effectiveDate`));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'admin.policy.version_updated',
    subject: 'Setting',
    subjectId: `policy.${policyType}`,
    severity: 'HIGH',
    detailsJson: { policyType, newVersion, effectiveDate: today },
  });

  revalidatePath('/policies');
  return { success: true };
}
