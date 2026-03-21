/**
 * Affiliate Fraud Escalation Engine (G3.5)
 *
 * Three-strikes policy per TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL §2.9.
 * NOT a server action — pure service module, callable from route and cron.
 */

import { db } from '@twicely/db';
import { affiliate, affiliateCommission, promoCode, auditEvent } from '@twicely/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { logger } from '@twicely/logger';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import type { FraudCheckResult } from './fraud-detection';

// ─── Escalation ───────────────────────────────────────────────────────────────

/**
 * Applies the three-strikes policy based on the affiliate's current warningCount
 * and the severity of the detected fraud signal.
 *
 * Strike 1 (warningCount 0 → 1): Warning notification, status stays ACTIVE.
 * Strike 2 (warningCount 1 → 2): Suspend for 30 days.
 * Strike 3 (warningCount >= 2 → 3+): Permanent ban, forfeit pending balance.
 *
 * Severity BAN bypasses three-strikes and immediately bans regardless of count.
 * Does NOT escalate an already-BANNED affiliate.
 */
export async function escalateAffiliate(
  affiliateId: string,
  signal: FraudCheckResult,
  actorId: string,
): Promise<void> {
  const [record] = await db
    .select({
      id: affiliate.id,
      userId: affiliate.userId,
      status: affiliate.status,
      warningCount: affiliate.warningCount,
    })
    .from(affiliate)
    .where(eq(affiliate.id, affiliateId))
    .limit(1);

  if (!record) {
    logger.error('[fraud-escalation] Affiliate not found', { affiliateId });
    return;
  }

  // Never re-escalate a BANNED affiliate
  if (record.status === 'BANNED') {
    logger.info('[fraud-escalation] Affiliate already banned, skipping', { affiliateId });
    return;
  }

  // Severity BAN: immediate permanent ban regardless of warning count
  if (signal.severity === 'BAN') {
    await applyBan(record.id, record.userId, record.warningCount, signal, actorId);
    return;
  }

  // For SUSPEND severity on an already-SUSPENDED affiliate: do not double-suspend
  if (record.status === 'SUSPENDED' && signal.severity === 'SUSPEND') {
    logger.info('[fraud-escalation] Affiliate already suspended, skipping SUSPEND signal', { affiliateId });
    return;
  }

  const newWarningCount = record.warningCount + 1;

  if (newWarningCount === 1) {
    await applyWarning(record.id, record.userId, signal, actorId, newWarningCount);
  } else if (newWarningCount === 2) {
    await applySuspension(record.id, record.userId, signal, actorId, newWarningCount);
  } else {
    // warningCount >= 2: third strike → permanent ban
    await applyBan(record.id, record.userId, record.warningCount, signal, actorId);
  }
}

// ─── Warning (Strike 1) ───────────────────────────────────────────────────────

async function applyWarning(
  affiliateId: string,
  userId: string,
  signal: FraudCheckResult,
  actorId: string,
  newWarningCount: number,
): Promise<void> {
  const now = new Date();

  await db
    .update(affiliate)
    .set({ warningCount: newWarningCount, updatedAt: now })
    .where(eq(affiliate.id, affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'SYSTEM',
    actorId,
    action: 'AFFILIATE_FRAUD_WARNING',
    subject: 'Affiliate',
    subjectId: affiliateId,
    severity: 'HIGH',
    detailsJson: {
      signalType: signal.signalType,
      details: signal.details,
      warningCount: newWarningCount,
    },
  });

  void notify(userId, 'affiliate.fraud_warning', {
    reason: signal.details,
    warningNumber: String(newWarningCount),
  });

  logger.info('[fraud-escalation] Warning issued', { affiliateId, warningCount: newWarningCount });
}

// ─── Suspension (Strike 2) ────────────────────────────────────────────────────

async function applySuspension(
  affiliateId: string,
  userId: string,
  signal: FraudCheckResult,
  actorId: string,
  newWarningCount: number,
): Promise<void> {
  const now = new Date();
  const suspensionDays = await getPlatformSetting<number>('affiliate.fraud.suspensionDays', 30);
  const suspendedUntil = new Date(now.getTime() + suspensionDays * 24 * 60 * 60 * 1000);

  await db
    .update(affiliate)
    .set({
      status: 'SUSPENDED',
      warningCount: newWarningCount,
      suspendedAt: now,
      suspendedUntil,
      suspendedReason: signal.details,
      updatedAt: now,
    })
    .where(eq(affiliate.id, affiliateId));

  await db.insert(auditEvent).values({
    actorType: 'SYSTEM',
    actorId,
    action: 'AFFILIATE_FRAUD_SUSPENDED',
    subject: 'Affiliate',
    subjectId: affiliateId,
    severity: 'HIGH',
    detailsJson: {
      signalType: signal.signalType,
      details: signal.details,
      warningCount: newWarningCount,
    },
  });

  void notify(userId, 'affiliate.fraud_suspended', {
    reason: signal.details,
  });

  logger.info('[fraud-escalation] Affiliate suspended', { affiliateId, warningCount: newWarningCount });
}

// ─── Ban (Strike 3 or severity BAN) ──────────────────────────────────────────

async function applyBan(
  affiliateId: string,
  userId: string,
  currentWarningCount: number,
  signal: FraudCheckResult,
  actorId: string,
): Promise<void> {
  const now = new Date();
  const newWarningCount = currentWarningCount + 1;

  await db
    .update(affiliate)
    .set({
      status: 'BANNED',
      warningCount: newWarningCount,
      suspendedAt: now,
      suspendedReason: signal.details,
      pendingBalanceCents: 0,
      availableBalanceCents: 0,
      updatedAt: now,
    })
    .where(eq(affiliate.id, affiliateId));

  // 2. Deactivate all promo codes
  await db
    .update(promoCode)
    .set({ isActive: false, updatedAt: now })
    .where(eq(promoCode.affiliateId, affiliateId));

  // 3. Reverse all PENDING and PAYABLE commissions (no clawback on PAID per §2.3)
  const reversibleRows = await db
    .select({ id: affiliateCommission.id })
    .from(affiliateCommission)
    .where(
      and(
        eq(affiliateCommission.affiliateId, affiliateId),
        inArray(affiliateCommission.status, ['PENDING', 'PAYABLE']),
      ),
    );

  const pendingPayableIds = reversibleRows.map((r) => r.id);

  if (pendingPayableIds.length > 0) {
    await db
      .update(affiliateCommission)
      .set({
        status: 'REVERSED',
        reversedAt: now,
        reversalReason: `Affiliate banned for fraud: ${signal.signalType}`,
      })
      .where(inArray(affiliateCommission.id, pendingPayableIds));
  }

  // 4. Audit event
  await db.insert(auditEvent).values({
    actorType: 'SYSTEM',
    actorId,
    action: 'AFFILIATE_FRAUD_BANNED',
    subject: 'Affiliate',
    subjectId: affiliateId,
    severity: 'CRITICAL',
    detailsJson: {
      signalType: signal.signalType,
      details: signal.details,
      warningCount: newWarningCount,
      reversedCommissions: pendingPayableIds.length,
    },
  });

  void notify(userId, 'affiliate.fraud_banned', {
    reason: signal.details,
  });

  logger.info('[fraud-escalation] Affiliate banned', {
    affiliateId,
    warningCount: newWarningCount,
    reversedCommissions: pendingPayableIds.length,
  });
}
