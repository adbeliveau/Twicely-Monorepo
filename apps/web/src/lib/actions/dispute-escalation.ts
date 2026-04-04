'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { zodId } from '@/lib/validations/shared';
import { authorize } from '@twicely/casl';
import {
  escalateToDispute,
  canEscalate,
} from '@twicely/commerce/disputes';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const escalateSchema = z.object({
  returnId: zodId,
  description: z.string().min(10, 'Please provide at least 10 characters').max(2000),
  evidencePhotos: z.array(z.string().url()).max(10).optional(),
}).strict();

const canEscalateSchema = z.object({
  returnId: zodId,
}).strict();

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  disputeId?: string;
  error?: string;
}

interface CanEscalateResult {
  canEscalate: boolean;
  reason?: string;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Check if a return can be escalated to a dispute.
 * Buyer-facing action used on the return detail page.
 */
export async function canEscalateAction(returnId: string): Promise<CanEscalateResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { canEscalate: false, reason: 'Not authenticated' };
  }
  if (!ability.can('read', 'Dispute')) {
    return { canEscalate: false, reason: 'Not authorized' };
  }

  const parsed = canEscalateSchema.safeParse({ returnId });
  if (!parsed.success) {
    return { canEscalate: false, reason: 'Invalid input' };
  }

  return canEscalate(parsed.data.returnId);
}

/**
 * Escalate a return to a platform dispute.
 * Called from the return detail page when the buyer is unhappy with the outcome.
 *
 * Rules:
 * - Buyer must own the return request
 * - Return must be DECLINED or seller didn't respond in time
 * - No existing dispute for this return
 */
export async function escalateToDisputeAction(
  data: z.infer<typeof escalateSchema>
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!ability.can('create', 'Dispute')) {
    return { success: false, error: 'Not authorized' };
  }

  const parsed = escalateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const result = await escalateToDispute({
    buyerId: session.userId,
    returnId: parsed.data.returnId,
    description: parsed.data.description,
    evidencePhotos: parsed.data.evidencePhotos,
  });

  if (result.success) {
    revalidatePath('/my/buying/orders');
    revalidatePath('/my/returns');
  }

  return result;
}
