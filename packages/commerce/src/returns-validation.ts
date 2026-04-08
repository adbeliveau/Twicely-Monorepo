/**
 * C4 + C4.1 — Returns & Disputes: Validation helpers
 */

import {
  getReturnWindowDays,
  getCounterfeitWindowDays,
  getSellerResponseDays,
  getSellerResponseDeadlineHour,
} from './returns-types';
import type { ReturnReason } from './returns-types';

/**
 * Check if an order is within the return window.
 */
export async function isWithinReturnWindow(
  deliveredAt: Date | null,
  reason: ReturnReason
): Promise<boolean> {
  if (!deliveredAt) {
    return false; // Can't return if not delivered (except INR)
  }

  const windowDays = reason === 'COUNTERFEIT'
    ? await getCounterfeitWindowDays()
    : await getReturnWindowDays();
  const windowEnd = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
  return new Date() <= windowEnd;
}

/**
 * Check if INR (Item Not Received) is valid.
 * INR is valid if order has not been delivered.
 */
export function isValidINRClaim(
  deliveredAt: Date | null,
  expectedDeliveryAt: Date | null
): boolean {
  if (deliveredAt) {
    return false; // Already delivered, can't claim INR
  }

  // Must be past expected delivery date
  if (expectedDeliveryAt && new Date() < expectedDeliveryAt) {
    return false; // Not yet past expected delivery
  }

  return true;
}

/**
 * Calculate seller response due date (business days from now, configurable).
 */
export async function calculateSellerResponseDue(): Promise<Date> {
  const responseDays = await getSellerResponseDays();
  const now = new Date();
  let businessDays = 0;
  const result = new Date(now);

  while (businessDays < responseDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }

  // Set to end of business day (configurable, default 5pm)
  const deadlineHour = await getSellerResponseDeadlineHour();
  result.setHours(deadlineHour, 0, 0, 0);
  return result;
}
