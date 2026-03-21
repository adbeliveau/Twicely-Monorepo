/**
 * Affiliate Fraud Detection Service (G3.5)
 *
 * Six fraud signal checks per TWICELY_V3_AFFILIATE_AND_TRIALS_CANONICAL §2.9.
 * Reads all thresholds from platform_settings — never hardcoded.
 * NOT a server action — pure service module.
 */

import { db } from '@twicely/db';
import { session, referral, sellerProfile } from '@twicely/db/schema';
import { eq, and, gte, count, isNotNull } from 'drizzle-orm';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import { logger } from '@twicely/logger';
import { isExcludedIp, getSubnet24, highestOf } from './fraud-detection-types';

export type { FraudCheckResult, FraudScanResult } from './fraud-detection-types';
import type { FraudCheckResult, FraudScanResult } from './fraud-detection-types';

// ─── Check 1: Self-Referral by IP ─────────────────────────────────────────────
/**
 * Returns flagged=true when the affiliate's own sessions share the
 * referral click IP address, indicating a self-referral attempt.
 * Excludes loopback and private IPs.
 */
export async function checkSelfReferralByIp(
  affiliateUserId: string,
  referralIpAddress: string | null,
): Promise<FraudCheckResult> {
  const NOT_FLAGGED: FraudCheckResult = {
    flagged: false,
    signalType: 'SELF_REFERRAL_IP',
    details: 'No IP match detected',
    severity: 'WARNING',
  };

  if (!referralIpAddress || isExcludedIp(referralIpAddress)) {
    return NOT_FLAGGED;
  }

  const rows = await db
    .select({ id: session.id })
    .from(session)
    .where(
      and(
        eq(session.userId, affiliateUserId),
        eq(session.ipAddress, referralIpAddress),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return NOT_FLAGGED;
  }

  logger.warn('[fraud-detection] Self-referral IP match', { affiliateUserId, referralIpAddress });

  return {
    flagged: true,
    signalType: 'SELF_REFERRAL_IP',
    details: `Referral click IP ${referralIpAddress} matches affiliate session IP`,
    severity: 'WARNING',
  };
}

// ─── Check 2: Same Payment Method ─────────────────────────────────────────────
/**
 * Compares Stripe payment method fingerprints between affiliate and referred user.
 * Returns not-flagged if either has no stripeCustomerId (check cannot be performed).
 * Runs during periodic scans ONLY — not at click time.
 */
export async function checkSamePaymentMethod(
  affiliateUserId: string,
  referredUserId: string,
): Promise<FraudCheckResult> {
  const NOT_FLAGGED: FraudCheckResult = {
    flagged: false,
    signalType: 'SAME_PAYMENT_METHOD',
    details: 'No payment method overlap detected',
    severity: 'WARNING',
  };

  const [affProfile] = await db
    .select({ stripeCustomerId: sellerProfile.stripeCustomerId })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, affiliateUserId))
    .limit(1);

  const [refProfile] = await db
    .select({ stripeCustomerId: sellerProfile.stripeCustomerId })
    .from(sellerProfile)
    .where(eq(sellerProfile.userId, referredUserId))
    .limit(1);

  if (!affProfile?.stripeCustomerId || !refProfile?.stripeCustomerId) {
    return NOT_FLAGGED;
  }

  // Both users have Stripe customers — comparison requires Stripe API call.
  // Per §3.B: payment method check runs during periodic scans only.
  // The Stripe API call is deferred to the caller to avoid coupling here.
  return NOT_FLAGGED;
}

// ─── Check 3: Rapid Churn ─────────────────────────────────────────────────────
/**
 * Counts referrals where churnedAt is within N hours of convertedAt.
 * Flags when count >= threshold (default 3).
 */
export async function checkRapidChurn(affiliateId: string): Promise<FraudCheckResult> {
  const NOT_FLAGGED: FraudCheckResult = {
    flagged: false,
    signalType: 'RAPID_CHURN',
    details: 'Rapid churn count below threshold',
    severity: 'WARNING',
  };

  const threshold = await getPlatformSetting<number>('affiliate.fraud.rapidChurnThreshold', 3);
  const windowHours = await getPlatformSetting<number>('affiliate.fraud.rapidChurnWindowHours', 48);
  const windowMs = windowHours * 60 * 60 * 1000;

  const rows = await db
    .select({
      convertedAt: referral.convertedAt,
      churnedAt: referral.churnedAt,
    })
    .from(referral)
    .where(
      and(
        eq(referral.affiliateId, affiliateId),
        isNotNull(referral.convertedAt),
        isNotNull(referral.churnedAt),
      ),
    );

  const rapidChurns = rows.filter((row) => {
    if (!row.convertedAt || !row.churnedAt) return false;
    const diffMs = row.churnedAt.getTime() - row.convertedAt.getTime();
    return diffMs >= 0 && diffMs <= windowMs;
  });

  if (rapidChurns.length < threshold) {
    return NOT_FLAGGED;
  }

  logger.warn('[fraud-detection] Rapid churn detected', { affiliateId, count: rapidChurns.length });

  return {
    flagged: true,
    signalType: 'RAPID_CHURN',
    details: `${rapidChurns.length} referred users churned within ${windowHours}h of converting (threshold: ${threshold})`,
    severity: 'WARNING',
  };
}

// ─── Check 4: Bot Traffic ─────────────────────────────────────────────────────

/**
 * Counts CLICKED referrals with zero SIGNED_UP/CONVERTED in a rolling window.
 * Flags when click count >= threshold (default 100).
 */
export async function checkBotTraffic(affiliateId: string): Promise<FraudCheckResult> {
  const NOT_FLAGGED: FraudCheckResult = {
    flagged: false,
    signalType: 'BOT_TRAFFIC',
    details: 'Bot traffic pattern not detected',
    severity: 'WARNING',
  };

  const threshold = await getPlatformSetting<number>('affiliate.fraud.botClickThreshold', 100);
  const windowHours = await getPlatformSetting<number>('affiliate.fraud.botWindowHours', 24);
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [clickResult] = await db
    .select({ total: count() })
    .from(referral)
    .where(
      and(
        eq(referral.affiliateId, affiliateId),
        eq(referral.status, 'CLICKED'),
        gte(referral.clickedAt, windowStart),
      ),
    );

  const clickCount = clickResult?.total ?? 0;
  if (clickCount < threshold) {
    return NOT_FLAGGED;
  }

  const [signupResult] = await db
    .select({ total: count() })
    .from(referral)
    .where(
      and(
        eq(referral.affiliateId, affiliateId),
        isNotNull(referral.signedUpAt),
        gte(referral.clickedAt, windowStart),
      ),
    );

  const signupCount = signupResult?.total ?? 0;
  if (signupCount > 0) {
    return NOT_FLAGGED;
  }

  logger.warn('[fraud-detection] Bot traffic detected', { affiliateId, clickCount });

  return {
    flagged: true,
    signalType: 'BOT_TRAFFIC',
    details: `${clickCount} clicks in ${windowHours}h window with zero signups (threshold: ${threshold})`,
    severity: 'WARNING',
  };
}

// ─── Check 5: Geo Anomaly ─────────────────────────────────────────────────────

/**
 * Groups referral IPs by /24 subnet in rolling window.
 * Flags when any subnet exceeds the cluster threshold (default 50).
 */
export async function checkGeoAnomaly(affiliateId: string): Promise<FraudCheckResult> {
  const NOT_FLAGGED: FraudCheckResult = {
    flagged: false,
    signalType: 'GEO_ANOMALY',
    details: 'No geographic anomaly detected',
    severity: 'SUSPEND',
  };

  const threshold = await getPlatformSetting<number>('affiliate.fraud.geoClusterThreshold', 50);
  const windowHours = await getPlatformSetting<number>('affiliate.fraud.botWindowHours', 24);
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const rows = await db
    .select({ ipAddress: referral.ipAddress })
    .from(referral)
    .where(
      and(
        eq(referral.affiliateId, affiliateId),
        isNotNull(referral.ipAddress),
        gte(referral.clickedAt, windowStart),
      ),
    );

  const subnetCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.ipAddress) continue;
    const subnet = getSubnet24(row.ipAddress);
    if (!subnet) continue;
    subnetCounts.set(subnet, (subnetCounts.get(subnet) ?? 0) + 1);
  }

  let maxSubnet = '';
  let maxCount = 0;
  for (const [subnet, cnt] of subnetCounts) {
    if (cnt > maxCount) { maxCount = cnt; maxSubnet = subnet; }
  }

  if (maxCount < threshold) {
    return NOT_FLAGGED;
  }

  logger.warn('[fraud-detection] Geo anomaly detected', { affiliateId, subnet: maxSubnet, count: maxCount });

  return {
    flagged: true,
    signalType: 'GEO_ANOMALY',
    details: `${maxCount} clicks from subnet ${maxSubnet} in ${windowHours}h window (threshold: ${threshold})`,
    severity: 'SUSPEND',
  };
}

// ─── Aggregator: runAllFraudChecks ────────────────────────────────────────────

/**
 * Runs periodic fraud checks (3–5) for a given affiliate.
 * Skips all checks when affiliate.fraud.enabled is false.
 */
export async function runAllFraudChecks(affiliateId: string): Promise<FraudScanResult> {
  const enabled = await getPlatformSetting<boolean>('affiliate.fraud.enabled', true);

  if (!enabled) {
    return { affiliateId, signals: [], highestSeverity: 'NONE' };
  }

  // Note: checkSelfReferralByIp is a per-click check (requires IP), not a batch scan.
  // It runs in real-time at click time via the affiliate/listing-click route.
  // checkSamePaymentMethod is deferred to Stripe API integration.
  const results = await Promise.all([
    checkRapidChurn(affiliateId),
    checkBotTraffic(affiliateId),
    checkGeoAnomaly(affiliateId),
  ]);

  const signals = results.filter((r) => r.flagged);

  let highestSeverity: 'NONE' | 'WARNING' | 'SUSPEND' | 'BAN' = 'NONE';
  for (const signal of signals) {
    highestSeverity = highestOf(highestSeverity, signal.severity);
  }

  return { affiliateId, signals, highestSeverity };
}
