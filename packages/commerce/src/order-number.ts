import { randomBytes } from 'crypto';

/**
 * Generate a unique order number in format: TWC-YYMMDD-XXXXX
 * - TWC: Platform prefix
 * - YYMMDD: 2-digit year, 2-digit month, 2-digit day
 * - XXXXX: 5 random uppercase alphanumeric characters (crypto-safe)
 *
 * Example: TWC-260218-A7K2B
 */
export function generateOrderNumber(): string {
  const now = new Date();

  // Get 2-digit year, month, day
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // SEC-043: Use crypto.randomBytes instead of Math.random
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(5);
  let random = '';
  for (let i = 0; i < 5; i++) {
    random += chars.charAt(bytes[i]! % chars.length);
  }

  return `TWC-${year}${month}${day}-${random}`;
}
