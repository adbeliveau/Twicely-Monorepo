'use server';

/**
 * Returns lifecycle server actions — mutation operations.
 * Wires commerce functions: approveReturn, declineReturn, markReturnShipped, markReturnReceived.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authorize, sub } from '@twicely/casl';
import { zodId } from '@/lib/validations/shared';
import {
  approveReturn,
  declineReturn,
  markReturnShipped,
  markReturnReceived,
} from '@twicely/commerce/returns-lifecycle';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const returnIdSchema = z.object({
  returnId: zodId,
}).strict();

const declineReturnSchema = z.object({
  returnId: zodId,
  responseNote: z.string().min(1).max(2000),
}).strict();

const markShippedSchema = z.object({
  returnId: zodId,
  trackingNumber: z.string().min(1).max(200),
  carrier: z.string().max(100).optional(),
}).strict();

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Seller approves a return request.
 */
export async function approveReturnAction(returnId: string): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('Return', { sellerId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = returnIdSchema.safeParse({ returnId });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const result = await approveReturn(sellerId, parsed.data.returnId);

  if (result.success) {
    revalidatePath('/my/selling/returns');
    revalidatePath(`/my/selling/returns/${parsed.data.returnId}`);
  }

  return result;
}

/**
 * Seller declines a return request.
 */
export async function declineReturnAction(
  returnId: string,
  responseNote: string
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('Return', { sellerId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = declineReturnSchema.safeParse({ returnId, responseNote });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const result = await declineReturn(sellerId, parsed.data.returnId, parsed.data.responseNote);

  if (result.success) {
    revalidatePath('/my/selling/returns');
    revalidatePath(`/my/selling/returns/${parsed.data.returnId}`);
  }

  return result;
}

/**
 * Buyer marks a return as shipped with tracking info.
 */
export async function markReturnShippedAction(
  returnId: string,
  trackingNumber: string,
  carrier?: string
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!ability.can('update', sub('Return', { buyerId: session.userId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = markShippedSchema.safeParse({ returnId, trackingNumber, carrier });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const result = await markReturnShipped(
    session.userId,
    parsed.data.returnId,
    parsed.data.trackingNumber,
    parsed.data.carrier
  );

  if (result.success) {
    revalidatePath(`/my/returns/${parsed.data.returnId}`);
  }

  return result;
}

/**
 * Seller marks a return as received (triggers refund).
 */
export async function markReturnReceivedAction(returnId: string): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('update', sub('Return', { sellerId }))) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = returnIdSchema.safeParse({ returnId });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const result = await markReturnReceived(sellerId, parsed.data.returnId);

  if (result.success) {
    revalidatePath('/my/selling/returns');
    revalidatePath(`/my/selling/returns/${parsed.data.returnId}`);
  }

  return result;
}
