import { db } from '@twicely/db';
import { affiliate, affiliateCommission } from '@twicely/db/schema';
import { and, eq, lte, inArray, sql } from 'drizzle-orm';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

const BATCH_SIZE = 100;

export interface GraduateCommissionsResult {
  graduatedCount: number;
  totalCents: number;
}

/**
 * Graduates PENDING commissions whose holdExpiresAt <= now() to PAYABLE.
 *
 * Processes in batches of 100. For each batch:
 *   - Groups by affiliateId
 *   - Updates commissions status to PAYABLE
 *   - Moves cents from pendingBalanceCents to availableBalanceCents on affiliate
 *
 * SUSPENDED/BANNED affiliates' commissions still graduate (money is owed).
 * They just won't be paid out due to eligibility checks in the payout step.
 *
 * Idempotent: safe to run multiple times.
 */
export async function graduateCommissions(): Promise<GraduateCommissionsResult> {
  const enabled = await getPlatformSetting<boolean>('affiliate.enabled', true);
  if (!enabled) {
    logger.info('[graduateCommissions] Affiliate program disabled — skipping graduation');
    return { graduatedCount: 0, totalCents: 0 };
  }

  const now = new Date();
  let totalGraduated = 0;
  let totalCents = 0;

  while (true) {
    const pending = await db
      .select({
        id: affiliateCommission.id,
        affiliateId: affiliateCommission.affiliateId,
        commissionCents: affiliateCommission.commissionCents,
      })
      .from(affiliateCommission)
      .where(
        and(
          eq(affiliateCommission.status, 'PENDING'),
          lte(affiliateCommission.holdExpiresAt, now)
        )
      )
      .limit(BATCH_SIZE);

    if (pending.length === 0) {
      break;
    }

    // Group by affiliateId
    const byAffiliate = new Map<string, { ids: string[]; sumCents: number }>();
    for (const row of pending) {
      const existing = byAffiliate.get(row.affiliateId);
      if (existing) {
        existing.ids.push(row.id);
        existing.sumCents += row.commissionCents;
      } else {
        byAffiliate.set(row.affiliateId, { ids: [row.id], sumCents: row.commissionCents });
      }
    }

    for (const [affiliateId, { ids, sumCents }] of byAffiliate) {
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(affiliateCommission)
            .set({ status: 'PAYABLE' })
            .where(inArray(affiliateCommission.id, ids));

          await tx
            .update(affiliate)
            .set({
              pendingBalanceCents: sql`${affiliate.pendingBalanceCents} - ${sumCents}`,
              availableBalanceCents: sql`${affiliate.availableBalanceCents} + ${sumCents}`,
              updatedAt: now,
            })
            .where(eq(affiliate.id, affiliateId));
        });

        totalGraduated += ids.length;
        totalCents += sumCents;
      } catch (err) {
        logger.error('[graduateCommissions] Failed to graduate batch for affiliate', {
          affiliateId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (pending.length < BATCH_SIZE) {
      break;
    }
  }

  logger.info('[graduateCommissions] Graduation complete', {
    graduatedCount: totalGraduated,
    totalCents,
  });

  return { graduatedCount: totalGraduated, totalCents };
}
