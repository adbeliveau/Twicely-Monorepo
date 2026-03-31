/**
 * C1.3 — Buyer Trust Signals (Decision #142)
 *
 * Replaced GREEN/YELLOW/RED tier system with factual trust signals.
 * Sellers see actual data (purchase count, returns, disputes) — not abstract tiers.
 *
 * Platform handles risk invisibly: rate limits, payment holds, account restrictions.
 */

export interface BuyerTrustSignals {
  /** Total completed (delivered, non-returned) purchases */
  completedPurchases: number;
  /** Account creation date */
  memberSince: Date;
  /** Email + phone verified */
  verified: boolean;
  /** Has prior completed order with this specific seller */
  repeatBuyer: boolean;
  /** Return count in trailing 90 days (only shown to sellers if > 0) */
  returns90d: number;
  /** Dispute count in trailing 90 days (only shown to sellers if > 0) */
  disputes90d: number;
}

/**
 * Format trust signals into a compact display string for seller-facing UI.
 * Example: "47 purchases · Member since 2024 · Verified"
 * Example: "12 purchases · 3 returns · 1 dispute"
 */
export function formatTrustSignals(signals: BuyerTrustSignals): string {
  const parts: string[] = [];

  parts.push(`${signals.completedPurchases} purchase${signals.completedPurchases !== 1 ? 's' : ''}`);

  const year = signals.memberSince.getFullYear();
  parts.push(`Member since ${year}`);

  if (signals.verified) parts.push('Verified');
  if (signals.repeatBuyer) parts.push('Bought from you before');
  if (signals.returns90d > 0) parts.push(`${signals.returns90d} return${signals.returns90d !== 1 ? 's' : ''}`);
  if (signals.disputes90d > 0) parts.push(`${signals.disputes90d} dispute${signals.disputes90d !== 1 ? 's' : ''}`);

  return parts.join(' · ');
}
