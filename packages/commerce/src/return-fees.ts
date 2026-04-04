/**
 * C4.2 — Return Fee Allocation
 *
 * Who pays what on returns. 4 fee buckets based on return reason:
 *
 * | Reason              | Return Shipping | Restocking Fee | TF Refund   | Platform    |
 * |---------------------|-----------------|----------------|-------------|-------------|
 * | INAD/DAMAGED/WRONG  | Seller pays     | None           | Full refund | Absorbs     |
 * | REMORSE             | Buyer pays      | 10% (max $50)  | 50% refund  | Keeps 50%   |
 * | INR                 | N/A             | None           | Full refund | Absorbs     |
 * | OTHER               | Case-by-case    | None           | Full refund | Absorbs     |
 *
 * Rules:
 * - Restocking fee: max $50, min $1 (only on REMORSE)
 * - TF (Transaction Fee) refund uses original TF amount from orderPayment
 */

import { db } from '@twicely/db';
import { returnRequest, orderPayment, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// Re-export applyReturnFees (extracted to return-fee-apply.ts)
export { applyReturnFees, type ApplyFeesResult } from './return-fee-apply';

// Default constants (fallback if platform_settings unavailable)
export const DEFAULT_RESTOCKING_FEE_PERCENT = 0.10; // 10%
export const DEFAULT_RESTOCKING_FEE_MAX_CENTS = 5000; // $50
export const DEFAULT_RESTOCKING_FEE_MIN_CENTS = 100; // $1
export const DEFAULT_TF_REFUND_REMORSE_PERCENT = 0.50; // 50% TF refund


/** Load return fee config from platform_settings. */
export async function getReturnFeeConfig(): Promise<{
  restockingFeePercent: number;
  restockingFeeMaxCents: number;
  restockingFeeMinCents: number;
  tfRefundRemorsePercent: number;
}> {
  const [pct, max, min, tfPct] = await Promise.all([
    getPlatformSetting('commerce.returns.restockingFeePercent', DEFAULT_RESTOCKING_FEE_PERCENT),
    getPlatformSetting('commerce.returns.restockingFeeMaxCents', DEFAULT_RESTOCKING_FEE_MAX_CENTS),
    getPlatformSetting('commerce.returns.restockingFeeMinCents', DEFAULT_RESTOCKING_FEE_MIN_CENTS),
    getPlatformSetting('commerce.returns.tfRefundRemorsePercent', DEFAULT_TF_REFUND_REMORSE_PERCENT),
  ]);
  return {
    restockingFeePercent: pct,
    restockingFeeMaxCents: max,
    restockingFeeMinCents: min,
    tfRefundRemorsePercent: tfPct,
  };
}

type ReturnReason = 'INAD' | 'DAMAGED' | 'INR' | 'COUNTERFEIT' | 'REMORSE' | 'WRONG_ITEM';
type ReturnReasonBucket = 'SELLER_FAULT' | 'BUYER_REMORSE' | 'PLATFORM_CARRIER_FAULT' | 'EDGE_CONDITIONAL';

export interface ReturnFeeBreakdown {
  // What buyer receives back
  refundToBuyerCents: number;

  // Fee breakdown
  itemRefundCents: number;
  shippingRefundCents: number;
  taxRefundCents: number;
  restockingFeeCents: number;

  // TF (Transaction Fee) handling
  originalTfCents: number;
  tfRefundToSellerCents: number;
  platformAbsorbsCents: number;

  // Shipping
  returnShippingPaidBy: 'SELLER' | 'BUYER' | 'PLATFORM' | null;
  estimatedReturnShippingCents: number;

  // Breakdown by party
  sellerNetImpactCents: number;
  platformNetImpactCents: number;
  buyerNetRefundCents: number;
}

/**
 * Calculate restocking fee for buyer's remorse returns.
 * 10% of item price, capped at $50, minimum $1.
 */
export function calculateRestockingFee(
  itemPriceCents: number,
  pct: number = DEFAULT_RESTOCKING_FEE_PERCENT,
  maxCents: number = DEFAULT_RESTOCKING_FEE_MAX_CENTS,
  minCents: number = DEFAULT_RESTOCKING_FEE_MIN_CENTS
): number {
  const fee = Math.round(itemPriceCents * pct);
  return Math.max(minCents, Math.min(maxCents, fee));
}

/**
 * Calculate TF (Transaction Fee) refund based on return reason.
 * - Seller fault (INAD, DAMAGED, WRONG, INR, COUNTERFEIT): Full TF refund
 * - Buyer fault (REMORSE): 50% TF refund
 */
export function calculateTfRefund(
  originalTfCents: number,
  bucket: ReturnReasonBucket,
  tfRefundRemorsePercent: number = DEFAULT_TF_REFUND_REMORSE_PERCENT
): number {
  if (bucket === 'BUYER_REMORSE') {
    return Math.round(originalTfCents * tfRefundRemorsePercent);
  }
  // All other buckets: full TF refund
  return originalTfCents;
}

/**
 * Map return reason to bucket.
 */
export function getReasonBucket(reason: ReturnReason): ReturnReasonBucket {
  switch (reason) {
    case 'INAD':
    case 'COUNTERFEIT':
    case 'WRONG_ITEM':
    case 'INR':
      return 'SELLER_FAULT';
    case 'DAMAGED':
      return 'PLATFORM_CARRIER_FAULT';
    case 'REMORSE':
      return 'BUYER_REMORSE';
    default:
      return 'EDGE_CONDITIONAL';
  }
}

/**
 * Get who pays return shipping based on reason.
 */
export function getReturnShippingPayer(reason: ReturnReason): 'SELLER' | 'BUYER' | 'PLATFORM' | null {
  switch (reason) {
    case 'INAD':
    case 'WRONG_ITEM':
    case 'COUNTERFEIT':
      return 'SELLER';
    case 'DAMAGED':
      return 'PLATFORM';
    case 'REMORSE':
      return 'BUYER';
    case 'INR':
      return null; // No return shipping needed
    default:
      return 'PLATFORM'; // Default to platform for edge cases
  }
}

/**
 * Calculate full return fee breakdown.
 */
export async function calculateReturnFees(returnId: string): Promise<ReturnFeeBreakdown | null> {
  // Load fee config from platform_settings
  const feeConfig = await getReturnFeeConfig();

  // Get return request
  const [req] = await db
    .select({
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      reason: returnRequest.reason,
      bucket: returnRequest.bucket,
    })
    .from(returnRequest)
    .where(eq(returnRequest.id, returnId))
    .limit(1);

  if (!req) {
    return null;
  }

  // Get order details
  const [ord] = await db
    .select({
      id: order.id,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
    })
    .from(order)
    .where(eq(order.id, req.orderId))
    .limit(1);

  if (!ord) {
    return null;
  }

  // Get payment details
  const [payment] = await db
    .select({
      tfAmountCents: orderPayment.tfAmountCents,
    })
    .from(orderPayment)
    .where(eq(orderPayment.orderId, req.orderId))
    .limit(1);

  const reason = req.reason as ReturnReason;
  const bucket = (req.bucket ?? getReasonBucket(reason)) as ReturnReasonBucket;
  const originalTfCents = payment?.tfAmountCents ?? 0;

  // Calculate item price (total minus shipping and tax)
  const itemPriceCents = ord.totalCents - (ord.shippingCents ?? 0) - (ord.taxCents ?? 0);

  // Calculate restocking fee (only for REMORSE)
  const restockingFeeCents = bucket === 'BUYER_REMORSE'
    ? calculateRestockingFee(itemPriceCents, feeConfig.restockingFeePercent, feeConfig.restockingFeeMaxCents, feeConfig.restockingFeeMinCents)
    : 0;

  // Calculate refunds
  const itemRefundCents = itemPriceCents - restockingFeeCents;
  const shippingRefundCents = bucket !== 'BUYER_REMORSE' ? (ord.shippingCents ?? 0) : 0;
  const taxRefundCents = bucket !== 'BUYER_REMORSE'
    ? (ord.taxCents ?? 0)
    : Math.round((ord.taxCents ?? 0) * (1 - feeConfig.restockingFeePercent));

  const refundToBuyerCents = itemRefundCents + shippingRefundCents + taxRefundCents;

  // TF (Transaction Fee) handling
  const tfRefundToSellerCents = calculateTfRefund(originalTfCents, bucket, feeConfig.tfRefundRemorsePercent);
  const platformAbsorbsCents = originalTfCents - tfRefundToSellerCents;

  // Return shipping
  const returnShippingPaidBy = getReturnShippingPayer(reason);
  const defaultReturnShippingCents = await getPlatformSetting<number>('commerce.returns.estimatedShippingCents', 800);
  const estimatedReturnShippingCents = reason === 'INR' ? 0 : defaultReturnShippingCents;

  // Net impacts
  let sellerNetImpactCents = 0;
  let platformNetImpactCents = 0;

  if (bucket === 'SELLER_FAULT') {
    sellerNetImpactCents = -(itemPriceCents + (returnShippingPaidBy === 'SELLER' ? estimatedReturnShippingCents : 0));
    platformNetImpactCents = -tfRefundToSellerCents;
  } else if (bucket === 'BUYER_REMORSE') {
    sellerNetImpactCents = restockingFeeCents - itemRefundCents;
    platformNetImpactCents = platformAbsorbsCents;
  } else if (bucket === 'PLATFORM_CARRIER_FAULT') {
    sellerNetImpactCents = -itemPriceCents;
    platformNetImpactCents = -(tfRefundToSellerCents + (returnShippingPaidBy === 'PLATFORM' ? estimatedReturnShippingCents : 0));
  }

  return {
    refundToBuyerCents,
    itemRefundCents,
    shippingRefundCents,
    taxRefundCents,
    restockingFeeCents,
    originalTfCents,
    tfRefundToSellerCents,
    platformAbsorbsCents,
    returnShippingPaidBy,
    estimatedReturnShippingCents,
    sellerNetImpactCents,
    platformNetImpactCents,
    buyerNetRefundCents: refundToBuyerCents,
  };
}
