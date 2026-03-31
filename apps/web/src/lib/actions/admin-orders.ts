'use server';

/**
 * Admin Order Actions (E3.3)
 * Refund, cancel, override, escalate — all audited
 */

import { db } from '@twicely/db';
import { order, auditEvent, ledgerEntry } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { staffAuthorize } from '@twicely/casl/staff-authorize';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';

const refundOrderSchema = z.object({
  orderId: zodId,
  amountCents: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  isPartial: z.boolean(),
}).strict();

export async function refundOrderAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Order')) {
    return { error: 'Forbidden' };
  }

  const parsed = refundOrderSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { orderId, amountCents, reason, isPartial } = parsed.data;

  const [existing] = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
  if (!existing) return { error: 'Not found' };

  // C1 Security: Validate refund amount does not exceed order total
  if (amountCents > existing.totalCents) {
    return { error: 'Refund amount cannot exceed order total' };
  }

  // Create refund ledger entry
  await db.insert(ledgerEntry).values({
    type: isPartial ? 'REFUND_PARTIAL' : 'REFUND_FULL',
    status: 'PENDING',
    amountCents: -amountCents,
    currency: 'USD',
    userId: existing.buyerId,
    orderId,
    createdByStaffId: session.staffUserId,
    reasonCode: 'ADMIN_REFUND',
    memo: reason,
  });

  if (!isPartial) {
    await db.update(order).set({ status: 'REFUNDED' }).where(eq(order.id, orderId));
  }

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: isPartial ? 'PARTIAL_REFUND' : 'FULL_REFUND',
    subject: 'Order',
    subjectId: orderId,
    severity: 'HIGH',
    detailsJson: { amountCents, reason },
  });

  return { success: true };
}

const cancelOrderSchema = z.object({
  orderId: zodId,
  reason: z.string().min(1).max(500),
}).strict();

export async function cancelOrderAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  if (!ability.can('update', 'Order')) {
    return { error: 'Forbidden' };
  }

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { orderId, reason } = parsed.data;

  await db.update(order).set({ status: 'CANCELED' }).where(eq(order.id, orderId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'CANCEL_ORDER',
    subject: 'Order',
    subjectId: orderId,
    severity: 'HIGH',
    detailsJson: { reason },
  });

  return { success: true };
}

const ORDER_STATUSES = [
  'CREATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT',
  'DELIVERED', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED',
] as const;

const overrideStatusSchema = z.object({
  orderId: zodId,
  newStatus: z.enum(ORDER_STATUSES),
  reason: z.string().min(1).max(500),
}).strict();

export async function overrideOrderStatusAction(input: unknown) {
  const { ability, session } = await staffAuthorize();
  // Only ADMIN can override order status
  if (!ability.can('manage', 'Order')) {
    return { error: 'Forbidden' };
  }

  const parsed = overrideStatusSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const { orderId, newStatus, reason } = parsed.data;

  const [existing] = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
  if (!existing) return { error: 'Not found' };

  await db
    .update(order)
    .set({ status: newStatus })
    .where(eq(order.id, orderId));

  await db.insert(auditEvent).values({
    actorType: 'STAFF',
    actorId: session.staffUserId,
    action: 'OVERRIDE_ORDER_STATUS',
    subject: 'Order',
    subjectId: orderId,
    severity: 'CRITICAL',
    detailsJson: { previousStatus: existing.status, newStatus, reason },
  });

  return { success: true };
}
