/**
 * Risk Signal Types & Base Scores (Canonical 26 §4)
 *
 * 20 signal types with configurable base scores.
 * Each signal's actual base score reads from platform_settings
 * with these values as fallback defaults.
 */

import type { RiskSignalType, RiskSeverity } from './types';

// ─── Signal type constants ──────────────────────────────────────────────────

export const RISK_SIGNAL_TYPES = {
  // Authentication & Account
  IP_VELOCITY: 'ip_velocity',
  DEVICE_CHANGE: 'device_change',
  LOGIN_FAILURES: 'login_failures',
  GEO_ANOMALY: 'geo_anomaly',
  CREDENTIAL_CHANGE: 'credential_change',

  // Commerce & Transactions
  PAYOUT_CHANGE: 'payout_change',
  UNUSUAL_VOLUME: 'unusual_volume',
  CARD_VELOCITY: 'card_velocity',
  REFUND_ABUSE: 'refund_abuse',
  ACCOUNT_AGE: 'account_age',
  SHILL_BIDDING: 'shill_bidding',
  LISTING_MANIPULATION: 'listing_manipulation',
  RETURN_FRAUD_RING: 'return_fraud_ring',
  PAYMENT_FAILURE_RATE: 'payment_failure_rate',

  // Cross-domain (fed by existing V3 subsystems)
  AFFILIATE_FRAUD: 'affiliate_fraud',
  LOCAL_FRAUD: 'local_fraud',
  CHARGEBACK_PATTERN: 'chargeback_pattern',
  ENFORCEMENT_ACTION: 'enforcement_action',
  IDENTITY_UNVERIFIED: 'identity_unverified',
  DISPUTE_RATE: 'dispute_rate',
} as const satisfies Record<string, RiskSignalType>;

// ─── Default base scores (C26 §4 table) ────────────────────────────────────

export const DEFAULT_SIGNAL_BASE_SCORES: Record<RiskSignalType, number> = {
  ip_velocity: 15,
  device_change: 20,
  login_failures: 25,
  geo_anomaly: 35,
  credential_change: 30,
  payout_change: 40,
  unusual_volume: 30,
  card_velocity: 45,
  refund_abuse: 50,
  account_age: 25,
  shill_bidding: 60,
  listing_manipulation: 35,
  return_fraud_ring: 55,
  payment_failure_rate: 30,
  affiliate_fraud: 40,
  local_fraud: 45,
  chargeback_pattern: 50,
  enforcement_action: 35,
  identity_unverified: 25,
  dispute_rate: 40,
};

// ─── Signal type → platform_settings key mapping ────────────────────────────

const SIGNAL_SETTING_KEYS: Record<RiskSignalType, string> = {
  ip_velocity: 'risk.signal.ipVelocity.baseScore',
  device_change: 'risk.signal.deviceChange.baseScore',
  login_failures: 'risk.signal.loginFailures.baseScore',
  geo_anomaly: 'risk.signal.geoAnomaly.baseScore',
  credential_change: 'risk.signal.credentialChange.baseScore',
  payout_change: 'risk.signal.payoutChange.baseScore',
  unusual_volume: 'risk.signal.unusualVolume.baseScore',
  card_velocity: 'risk.signal.cardVelocity.baseScore',
  refund_abuse: 'risk.signal.refundAbuse.baseScore',
  account_age: 'risk.signal.accountAge.baseScore',
  shill_bidding: 'risk.signal.shillBidding.baseScore',
  listing_manipulation: 'risk.signal.listingManipulation.baseScore',
  return_fraud_ring: 'risk.signal.returnFraudRing.baseScore',
  payment_failure_rate: 'risk.signal.paymentFailureRate.baseScore',
  affiliate_fraud: 'risk.signal.affiliateFraud.baseScore',
  local_fraud: 'risk.signal.localFraud.baseScore',
  chargeback_pattern: 'risk.signal.chargebackPattern.baseScore',
  enforcement_action: 'risk.signal.enforcementAction.baseScore',
  identity_unverified: 'risk.signal.identityUnverified.baseScore',
  dispute_rate: 'risk.signal.disputeRate.baseScore',
};

/**
 * Get the platform_settings key for a signal type's base score.
 */
export function getSignalSettingKey(signalType: RiskSignalType): string {
  return SIGNAL_SETTING_KEYS[signalType];
}

// ─── All valid signal type values (for validation) ──────────────────────────

const ALL_SIGNAL_TYPES = new Set<string>(Object.values(RISK_SIGNAL_TYPES));

/**
 * Check if a string is a valid RiskSignalType.
 */
export function isValidSignalType(type: string): type is RiskSignalType {
  return ALL_SIGNAL_TYPES.has(type);
}

// ─── Severity derivation (C26 §5) ──────────────────────────────────────────

/**
 * Derive severity from a composite score.
 *
 * | Band     | Score Range | Recommendation |
 * |----------|-------------|----------------|
 * | LOW      | 0-30        | allow          |
 * | MEDIUM   | 31-60       | warn           |
 * | HIGH     | 61-80       | step_up        |
 * | CRITICAL | 81-100      | block          |
 */
export function severityFromScore(score: number): RiskSeverity {
  if (score <= 30) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  if (score <= 80) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Fallback base score for unknown signal types.
 */
export const UNKNOWN_SIGNAL_FALLBACK_SCORE = 10;
