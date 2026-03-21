/**
 * C5 + C5.1 + C5.2 — Buyer Protection Framework
 *
 * Twicely's buyer protection guarantee. Backed by platform fund.
 *
 * Claim windows:
 * - Standard: 30 days from delivery (INAD, DAMAGED, WRONG_ITEM, INR)
 * - Counterfeit: 60 days from delivery (extended window)
 *
 * NOT eligible: CHANGED_MIND (that's a return, not protection)
 *
 * Claim states:
 * SUBMITTED → UNDER_REVIEW → APPROVED → REFUNDED
 * SUBMITTED → UNDER_REVIEW → DENIED
 */

import { db } from '@twicely/db';
import { dispute, order } from '@twicely/db/schema';
import { eq } from 'drizzle-orm';
import { notify } from '@twicely/notifications/service';
import { getPlatformSetting } from '@/lib/queries/platform-settings';

// Re-export claim processing functions (extracted to protection-processing.ts)
export {
  processProtectionClaim,
  getProtectionStatus,
  type ProcessClaimInput,
  type ProcessClaimResult,
  type ProtectionStatus,
} from './protection-processing';

// Default claim windows (fallback if platform_settings unavailable)
export const DEFAULT_STANDARD_CLAIM_WINDOW_DAYS = 30;
export const DEFAULT_COUNTERFEIT_CLAIM_WINDOW_DAYS = 60;

/** Load claim windows from platform_settings. */
export async function getClaimWindows(): Promise<{
  standardDays: number;
  counterfeitDays: number;
}> {
  const [std, ctft] = await Promise.all([
    getPlatformSetting<number>('commerce.protection.standardClaimWindowDays', DEFAULT_STANDARD_CLAIM_WINDOW_DAYS),
    getPlatformSetting<number>('commerce.protection.counterfeitClaimWindowDays', DEFAULT_COUNTERFEIT_CLAIM_WINDOW_DAYS),
  ]);
  return { standardDays: std, counterfeitDays: ctft };
}

// Eligible claim reasons
export const PROTECTION_ELIGIBLE_REASONS = ['INAD', 'DAMAGED', 'WRONG_ITEM', 'INR', 'COUNTERFEIT'] as const;
type ProtectionReason = typeof PROTECTION_ELIGIBLE_REASONS[number];

// Claim types matching the enum
type ClaimType = 'INR' | 'INAD' | 'DAMAGED' | 'COUNTERFEIT' | 'REMORSE';

export interface CreateProtectionClaimInput {
  buyerId: string;
  orderId: string;
  reason: ProtectionReason;
  description: string;
  photos?: string[];
}

export interface CreateClaimResult {
  success: boolean;
  claimId?: string;
  error?: string;
}

/**
 * Check if an order is eligible for buyer protection.
 * Orders paid through the platform are eligible.
 */
export async function isEligibleForProtection(orderId: string): Promise<boolean> {
  const [ord] = await db
    .select({
      status: order.status,
      paidAt: order.paidAt,
      paymentIntentId: order.paymentIntentId,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord) {
    return false;
  }

  // Must have been paid through platform (has paymentIntentId)
  if (!ord.paymentIntentId) {
    return false;
  }

  // Must be in eligible status
  const eligibleStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'];
  return eligibleStatuses.includes(ord.status);
}

/**
 * Check if claim is within the allowed window.
 * Reads claim window durations from platform_settings.
 */
export async function isWithinClaimWindow(
  deliveredAt: Date | null,
  reason: ProtectionReason
): Promise<{ withinWindow: boolean; daysRemaining: number }> {
  const { standardDays, counterfeitDays } = await getClaimWindows();

  // For INR, we don't need delivery date
  if (reason === 'INR') {
    return { withinWindow: true, daysRemaining: standardDays };
  }

  if (!deliveredAt) {
    return { withinWindow: false, daysRemaining: 0 };
  }

  const windowDays = reason === 'COUNTERFEIT' ? counterfeitDays : standardDays;
  const windowEnd = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now > windowEnd) {
    return { withinWindow: false, daysRemaining: 0 };
  }

  const daysRemaining = Math.ceil((windowEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return { withinWindow: true, daysRemaining };
}

/**
 * Create a buyer protection claim.
 */
export async function createProtectionClaim(
  input: CreateProtectionClaimInput
): Promise<CreateClaimResult> {
  const { buyerId, orderId, reason, description, photos = [] } = input;

  // Get order details
  const [ord] = await db
    .select({
      id: order.id,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      status: order.status,
      deliveredAt: order.deliveredAt,
      totalCents: order.totalCents,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  if (!ord) {
    return { success: false, error: 'Order not found' };
  }

  // Verify buyer owns the order
  if (ord.buyerId !== buyerId) {
    return { success: false, error: 'You do not own this order' };
  }

  // Check eligibility
  const eligible = await isEligibleForProtection(orderId);
  if (!eligible) {
    return { success: false, error: 'This order is not eligible for buyer protection' };
  }

  // Check if reason is eligible (no CHANGED_MIND)
  if (!PROTECTION_ELIGIBLE_REASONS.includes(reason)) {
    return { success: false, error: 'Changed mind is not covered by buyer protection. Please request a return instead.' };
  }

  // Check claim window
  const windowCheck = await isWithinClaimWindow(ord.deliveredAt, reason);
  if (!windowCheck.withinWindow) {
    const { standardDays, counterfeitDays } = await getClaimWindows();
    const windowDays = reason === 'COUNTERFEIT' ? counterfeitDays : standardDays;
    return { success: false, error: `The ${windowDays}-day claim window has expired` };
  }

  // Require photos for INAD, DAMAGED, COUNTERFEIT
  const photosRequired: ProtectionReason[] = ['INAD', 'DAMAGED', 'COUNTERFEIT'];
  if (photosRequired.includes(reason) && photos.length === 0) {
    return { success: false, error: 'Photo evidence is required for this claim type' };
  }

  // Check if claim already exists
  const [existing] = await db
    .select({ id: dispute.id })
    .from(dispute)
    .where(eq(dispute.orderId, orderId))
    .limit(1);

  if (existing) {
    return { success: false, error: 'A claim already exists for this order' };
  }

  // Map reason to claim type
  const claimType = mapReasonToClaimType(reason);
  const now = new Date();
  const reviewDeadlineHours = await getPlatformSetting<number>('commerce.dispute.reviewDeadlineHours', 48);

  // Create protection claim (stored as dispute with protection flag)
  const [created] = await db
    .insert(dispute)
    .values({
      orderId,
      buyerId,
      sellerId: ord.sellerId,
      claimType,
      status: 'OPEN', // SUBMITTED maps to OPEN
      description,
      evidencePhotos: photos,
      deadlineAt: new Date(now.getTime() + reviewDeadlineHours * 60 * 60 * 1000),
    })
    .returning({ id: dispute.id });

  // Get order number for notification
  const [orderInfo] = await db
    .select({ orderNumber: order.orderNumber })
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);

  // Notify buyer
  await notify(buyerId, 'protection.claim_submitted', {
    orderNumber: orderInfo?.orderNumber ?? '',
  });

  // Notify seller
  void notify(ord.sellerId, 'dispute.opened', {
    orderNumber: orderInfo?.orderNumber ?? '',
  }).catch(() => {});

  return { success: true, claimId: created?.id };
}

function mapReasonToClaimType(reason: ProtectionReason): ClaimType {
  switch (reason) {
    case 'INAD':
      return 'INAD';
    case 'DAMAGED':
      return 'DAMAGED';
    case 'INR':
      return 'INR';
    case 'COUNTERFEIT':
      return 'COUNTERFEIT';
    case 'WRONG_ITEM':
      return 'INAD'; // Map to INAD for claim type
    default:
      return 'INAD';
  }
}

/**
 * C5.2 — Create counterfeit claim with 60-day window.
 */
export async function createCounterfeitClaim(
  buyerId: string,
  orderId: string,
  description: string,
  photos: string[]
): Promise<CreateClaimResult> {
  // Photos are required for counterfeit claims
  if (photos.length === 0) {
    return { success: false, error: 'Photo evidence is required for counterfeit claims' };
  }

  return createProtectionClaim({
    buyerId,
    orderId,
    reason: 'COUNTERFEIT',
    description,
    photos,
  });
}
