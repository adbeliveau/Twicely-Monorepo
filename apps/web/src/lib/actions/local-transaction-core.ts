'use server';

/**
 * Core Local Transaction Server Actions
 *
 * Wires four commerce functions to server actions:
 *   - createLocalTransactionAction: create a local transaction for an order
 *   - confirmLocalTransactionAction: confirm buyer received item
 *   - checkLocalEligibilityAction: check if current user can do local transactions
 *   - canProposeMeetupTimeAction: check if a meetup time can be proposed
 */

import { revalidatePath } from 'next/cache';
import { db } from '@twicely/db';
import { localTransaction, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { authorize, sub } from '@twicely/casl';
import {
  createLocalTransaction,
  confirmLocalTransaction,
} from '@twicely/commerce/local-transaction';
import { checkLocalEligibility } from '@twicely/commerce/local-eligibility';
import { canProposeMeetupTime } from '@twicely/commerce/local-scheduling';
import { canTransition } from '@twicely/commerce/local-state-machine';
import { postConfirmationEffects } from '@twicely/commerce/local-ledger';
import { incrementCompletedPurchaseCount } from '@/lib/queries/trust-metrics';
import {
  createLocalTransactionSchema,
  confirmLocalTransactionSchema,
  checkLocalEligibilitySchema,
  canProposeMeetupTimeSchema,
} from '@/lib/validations/local';
import type { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error?: string };

interface CreateTransactionActionResult extends ActionResult {
  transactionId?: string;
  sellerToken?: string;
  buyerToken?: string;
  sellerOfflineCode?: string;
  buyerOfflineCode?: string;
}

interface EligibilityActionResult extends ActionResult {
  eligible?: boolean;
  reason?: string;
  resumesAt?: Date;
}

interface CanProposeActionResult extends ActionResult {
  canPropose?: boolean;
}

// ─── createLocalTransactionAction ─────────────────────────────────────────────

export async function createLocalTransactionAction(
  data: z.infer<typeof createLocalTransactionSchema>,
): Promise<CreateTransactionActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = createLocalTransactionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [ord] = await db
    .select({
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
    })
    .from(order)
    .where(eq(order.id, parsed.data.orderId))
    .limit(1);

  if (!ord) return { success: false, error: 'Not found' };

  const isBuyer = session.userId === ord.buyerId;
  const isSeller = session.userId === ord.sellerId;

  if (!isBuyer && !isSeller) return { success: false, error: 'Not found' };

  if (!ability.can('create', sub('LocalTransaction', { buyerId: ord.buyerId })) &&
      !ability.can('create', sub('LocalTransaction', { sellerId: ord.sellerId }))) {
    return { success: false, error: 'Not found' };
  }

  const result = await createLocalTransaction({
    orderId: parsed.data.orderId,
    buyerId: ord.buyerId,
    sellerId: ord.sellerId,
    meetupLocationId: parsed.data.meetupLocationId,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to create local transaction' };
  }

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  return {
    success: true,
    transactionId: result.transactionId,
    sellerToken: result.sellerToken,
    buyerToken: result.buyerToken,
    sellerOfflineCode: result.sellerOfflineCode,
    buyerOfflineCode: result.buyerOfflineCode,
  };
}

// ─── confirmLocalTransactionAction ────────────────────────────────────────────

export async function confirmLocalTransactionAction(
  data: z.infer<typeof confirmLocalTransactionSchema>,
): Promise<ActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = confirmLocalTransactionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!tx) return { success: false, error: 'Not found' };

  if (session.userId !== tx.buyerId) return { success: false, error: 'Not found' };

  if (!ability.can('update', sub('LocalTransaction', { buyerId: tx.buyerId }))) {
    return { success: false, error: 'Not found' };
  }

  if (!canTransition(tx.status, 'COMPLETED')) {
    return { success: false, error: 'Transaction not in valid state' };
  }

  const result = await confirmLocalTransaction(tx.id, parsed.data.mode);
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to confirm transaction' };
  }

  await postConfirmationEffects(tx.id, tx.orderId, tx.sellerId, new Date());

  // Fire-and-forget: increment buyer's completed purchase count (C1.3 trust signals)
  incrementCompletedPurchaseCount(tx.buyerId).catch(() => {});

  revalidatePath('/my/buying/orders');
  revalidatePath('/my/selling/orders');

  return { success: true };
}

// ─── checkLocalEligibilityAction ──────────────────────────────────────────────

export async function checkLocalEligibilityAction(
  data: z.infer<typeof checkLocalEligibilitySchema>,
): Promise<EligibilityActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = checkLocalEligibilitySchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  if (!ability.can('read', sub('LocalTransaction', { buyerId: session.userId }))) {
    return { success: false, error: 'Not found' };
  }

  const result = await checkLocalEligibility(session.userId);

  return {
    success: true,
    eligible: result.eligible,
    reason: result.reason,
    resumesAt: result.resumesAt,
  };
}

// ─── canProposeMeetupTimeAction ───────────────────────────────────────────────

export async function canProposeMeetupTimeAction(
  data: z.infer<typeof canProposeMeetupTimeSchema>,
): Promise<CanProposeActionResult> {
  const { session, ability } = await authorize();
  if (!session) return { success: false, error: 'Unauthorized' };

  const parsed = canProposeMeetupTimeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const [tx] = await db
    .select()
    .from(localTransaction)
    .where(eq(localTransaction.id, parsed.data.localTransactionId))
    .limit(1);

  if (!tx) return { success: false, error: 'Not found' };

  const isBuyer = session.userId === tx.buyerId;
  const isSeller = session.userId === tx.sellerId;

  if (!isBuyer && !isSeller) return { success: false, error: 'Not found' };

  if (isBuyer && !ability.can('read', sub('LocalTransaction', { buyerId: tx.buyerId }))) {
    return { success: false, error: 'Not found' };
  }
  if (isSeller && !ability.can('read', sub('LocalTransaction', { sellerId: tx.sellerId }))) {
    return { success: false, error: 'Not found' };
  }

  const canPropose = canProposeMeetupTime(tx);

  return { success: true, canPropose };
}
