'use server';

/**
 * Admin Finance Actions (E3.4)
 * Manual adjustments — all audited at CRITICAL severity
 */

import { db } from '@twicely/db';
import { ledgerEntry, auditEvent } from '@twicely/db/schema';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';

const manualAdjustmentSchema = z.object({
  userId: z.string().min(1),
  amountCents: z.number().int().positive(),
  type: z.enum(['MANUAL_CREDIT', 'MANUAL_DEBIT']),
  reasonCode: z.enum(['GOODWILL_CREDIT', 'ERROR_CORRECTION', 'PROMOTIONAL', 'OTHER']),
  reasonText: z.string().min(1).max(500),
}).strict();

export async function createManualAdjustmentAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  // Only ADMIN can create manual adjustments
  if (!ability.can('manage', 'LedgerEntry')) {
    return { error: 'Forbidden' };
  }

  const parsed = manualAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { userId, amountCents, type, reasonCode, reasonText } = parsed.data;

  const adjustedAmount = type === 'MANUAL_DEBIT' ? -amountCents : amountCents;

  await db.insert(ledgerEntry).values({
    type: type as typeof ledgerEntry.type.enumValues[number],
    status: 'POSTED',
    amountCents: adjustedAmount,
    currency: 'USD',
    userId,
    createdByStaffId: session.staffUserId,
    reasonCode,
    memo: reasonText,
    postedAt: new Date(),
  });

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'MANUAL_ADJUSTMENT',
    subject: 'LedgerEntry',
    subjectId: userId,
    severity: 'CRITICAL',
    detailsJson: { amountCents: adjustedAmount, type, reasonCode, reasonText },
  });

  return { success: true };
}
