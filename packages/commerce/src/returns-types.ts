/**
 * C4 + C4.1 — Returns & Disputes: Types and Constants
 */

import { getPlatformSetting } from '@twicely/db/queries/platform-settings';

// Infer types from enum values
export type ReturnReason = 'INAD' | 'DAMAGED' | 'INR' | 'COUNTERFEIT' | 'REMORSE' | 'WRONG_ITEM';
export type ReturnFault = 'SELLER' | 'BUYER' | 'CARRIER' | 'PLATFORM';
export type ReturnReasonBucket = 'SELLER_FAULT' | 'BUYER_REMORSE' | 'PLATFORM_CARRIER_FAULT' | 'EDGE_CONDITIONAL';

// Fallback defaults (only used if platform_settings DB is unreachable)
const DEFAULT_RETURN_WINDOW_DAYS = 30;
const DEFAULT_COUNTERFEIT_WINDOW_DAYS = 60;
const DEFAULT_SELLER_RESPONSE_DAYS = 3;

/** Standard return window (days from delivery). Reads from platform_settings. */
export async function getReturnWindowDays(): Promise<number> {
  return getPlatformSetting<number>('commerce.protection.standardClaimWindowDays', DEFAULT_RETURN_WINDOW_DAYS);
}

/** Counterfeit claim window (days from delivery). Reads from platform_settings. */
export async function getCounterfeitWindowDays(): Promise<number> {
  return getPlatformSetting<number>('commerce.protection.counterfeitClaimWindowDays', DEFAULT_COUNTERFEIT_WINDOW_DAYS);
}

/** Business days seller has to respond to a return. Reads from platform_settings. */
export async function getSellerResponseDays(): Promise<number> {
  return getPlatformSetting<number>('commerce.returns.sellerResponseDeadlineDays', DEFAULT_SELLER_RESPONSE_DAYS);
}

// Return reason to fault mapping
export const REASON_FAULT_MAP: Record<ReturnReason, ReturnFault> = {
  INAD: 'SELLER',
  DAMAGED: 'CARRIER',
  INR: 'SELLER',
  COUNTERFEIT: 'SELLER',
  REMORSE: 'BUYER',
  WRONG_ITEM: 'SELLER',
};

// Return reason to bucket mapping
export const REASON_BUCKET_MAP: Record<ReturnReason, ReturnReasonBucket> = {
  INAD: 'SELLER_FAULT',
  DAMAGED: 'PLATFORM_CARRIER_FAULT',
  INR: 'SELLER_FAULT',
  COUNTERFEIT: 'SELLER_FAULT',
  REMORSE: 'BUYER_REMORSE',
  WRONG_ITEM: 'SELLER_FAULT',
};

// Who pays return shipping by reason
export const RETURN_SHIPPING_PAYER: Record<ReturnReason, 'SELLER' | 'BUYER' | 'PLATFORM' | 'N/A'> = {
  INAD: 'SELLER',
  DAMAGED: 'PLATFORM',
  INR: 'N/A', // No return needed
  COUNTERFEIT: 'SELLER',
  REMORSE: 'BUYER',
  WRONG_ITEM: 'SELLER',
};

export interface CreateReturnRequestInput {
  buyerId: string;
  orderId: string;
  reason: ReturnReason;
  description: string;
  evidencePhotos?: string[];
}

export interface CreateReturnRequestResult {
  success: boolean;
  returnRequestId?: string;
  error?: string;
}

export interface ApproveReturnResult {
  success: boolean;
  error?: string;
}

export interface RespondToReturnInput {
  sellerId: string;
  returnId: string;
  approved: boolean;
  response?: string;
}
