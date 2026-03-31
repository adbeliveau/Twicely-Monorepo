'use server';

/**
 * Returns query server actions — read operations.
 * Wires commerce functions: getReturnRequest, getBuyerReturns, getSellerReturns.
 */

import { z } from 'zod';
import { authorize, sub } from '@twicely/casl';
import { zodId } from '@/lib/validations/shared';
import {
  getReturnRequest,
  getBuyerReturns,
  getSellerReturns,
} from '@twicely/commerce/returns-queries';

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const returnIdSchema = z.object({
  returnId: zodId,
}).strict();

/**
 * Get a single return request by ID.
 * Access: buyer (own return) or seller (return on their order).
 */
export async function getReturnRequestAction(returnId: string) {
  const { session, ability } = await authorize();
  if (!session) return null;

  const parsed = returnIdSchema.safeParse({ returnId });
  if (!parsed.success) return null;

  const ret = await getReturnRequest(parsed.data.returnId);
  if (!ret) return null;

  // Verify caller has read access (buyer or seller of this return)
  const isBuyer = ret.buyerId === session.userId;
  const sellerId = session.delegationId ? session.onBehalfOfSellerId : session.userId;
  const isSeller = ret.sellerId === sellerId;

  if (isBuyer && ability.can('read', sub('Return', { buyerId: session.userId }))) {
    return ret;
  }

  if (isSeller && ability.can('read', sub('Return', { sellerId }))) {
    return ret;
  }

  return null;
}

/**
 * Get all returns for the current user as a buyer.
 */
export async function getBuyerReturnsAction() {
  const { session, ability } = await authorize();
  if (!session) return [];

  if (!ability.can('read', sub('Return', { buyerId: session.userId }))) {
    return [];
  }

  return getBuyerReturns(session.userId);
}

/**
 * Get all returns for the current user as a seller.
 */
export async function getSellerReturnsAction() {
  const { session, ability } = await authorize();
  if (!session) return [];

  const sellerId = session.delegationId ? session.onBehalfOfSellerId! : session.userId;

  if (!ability.can('read', sub('Return', { sellerId }))) {
    return [];
  }

  return getSellerReturns(sellerId);
}
