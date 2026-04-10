'use server';

import { db } from '@twicely/db';
import { auditEvent } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { graduateCommissions } from '@/lib/affiliate/commission-graduation';
import { executeAffiliatePayouts } from '@/lib/affiliate/affiliate-payout-service';

interface TriggerAffiliatePayoutResult {
  success: boolean;
  error?: string;
  graduatedCount?: number;
  payoutCount?: number;
  totalPaidCents?: number;
}

/**
 * Manual trigger for the affiliate payout job.
 * Requires staff authentication with AffiliatePayout manage permission.
 * Runs commission graduation then payout execution in sequence.
 */
export async function triggerAffiliatePayoutManually(): Promise<TriggerAffiliatePayoutResult> {
  let session: Awaited<ReturnType<typeof staffAuthorize>>['session'];

  try {
    const authorized = await staffAuthorize();

    if (!authorized.ability.can('manage', 'AffiliatePayout')) {
      return { success: false, error: 'Forbidden' };
    }

    session = authorized.session;
  } catch {
    return { success: false, error: 'Staff authentication required' };
  }

  try {
    const graduation = await graduateCommissions();
    const payouts = await executeAffiliatePayouts();

    await db.insert(auditEvent).values({
      actorType: 'STAFF',
      actorId: session.staffUserId,
      action: 'AFFILIATE_PAYOUT_TRIGGERED',
      subject: 'AffiliatePayout',
      severity: 'HIGH',
      detailsJson: {
        graduatedCount: graduation.graduatedCount,
        graduatedCents: graduation.totalCents,
        payoutCount: payouts.payoutCount,
        totalPaidCents: payouts.totalPaidCents,
        failedCount: payouts.failedCount,
      },
    });

    return {
      success: true,
      graduatedCount: graduation.graduatedCount,
      payoutCount: payouts.payoutCount,
      totalPaidCents: payouts.totalPaidCents,
    };
  } catch (_err) {
    return {
      success: false,
      error: 'Payout job failed',
    };
  }
}
