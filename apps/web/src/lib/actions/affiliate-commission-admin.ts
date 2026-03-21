'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@twicely/db';
import { affiliate, auditEvent } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { updateCommissionRateSchema } from '@/lib/validations/affiliate';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

interface UpdateCommissionRateResult {
  success: boolean;
  error?: string;
}

/**
 * Update a specific affiliate's commission rate.
 * Does NOT retroactively change existing commissions — only affects future commissions.
 * Requires staff authentication with Affiliate manage permission.
 */
export async function updateAffiliateCommissionRate(
  input: unknown
): Promise<UpdateCommissionRateResult> {
  const { ability, session } = await staffAuthorize();

  if (!ability.can('manage', 'Affiliate')) {
    return { success: false, error: 'Forbidden' };
  }

  const parsed = updateCommissionRateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const data = parsed.data;

  const [existing] = await db
    .select({ id: affiliate.id, tier: affiliate.tier, status: affiliate.status })
    .from(affiliate)
    .where(eq(affiliate.id, data.affiliateId))
    .limit(1);

  if (!existing) {
    return { success: false, error: 'Not found' };
  }

  // Build tier-specific audit details
  let auditDetails: Record<string, unknown> = {
    newRateBps: data.commissionRateBps,
    tier: existing.tier,
    note: 'Rate change does not affect existing commissions. Only future commissions use this rate.',
  };

  // Validate per-tier constraints
  if (existing.tier === 'INFLUENCER') {
    const minBps = await getPlatformSetting('affiliate.influencer.minCommissionRateBps', 2000);
    const maxBps = await getPlatformSetting('affiliate.influencer.maxCommissionRateBps', 3000);
    if (data.commissionRateBps < minBps || data.commissionRateBps > maxBps) {
      return {
        success: false,
        error: `Influencer commission rate must be between ${minBps} and ${maxBps} bps (${(minBps / 100).toFixed(0)}–${(maxBps / 100).toFixed(0)}%)`,
      };
    }
  } else {
    // COMMUNITY — fetch platform default for deviation tracking
    const defaultRateBps = await getPlatformSetting('affiliate.community.commissionRateBps', 1500);
    const isDeviation = data.commissionRateBps !== defaultRateBps;
    auditDetails = { ...auditDetails, isDeviation, defaultRateBps };
  }

  await db
    .update(affiliate)
    .set({
      commissionRateBps: data.commissionRateBps,
      updatedAt: new Date(),
    })
    .where(eq(affiliate.id, data.affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'AFFILIATE_COMMISSION_RATE_UPDATED',
    subject: 'Affiliate',
    subjectId: data.affiliateId,
    severity: 'MEDIUM',
    detailsJson: auditDetails,
  });

  revalidatePath(`/usr/affiliates/${data.affiliateId}`);
  return { success: true };
}
