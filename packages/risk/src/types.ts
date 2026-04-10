/**
 * Risk Engine Type Definitions (Canonical 26)
 *
 * Central type definitions for the risk scoring and fraud detection system.
 * All types are string unions or interfaces — no enums, no Drizzle dependencies.
 */

// ─── Signal Types (20 signal types per C26 §4) ──────────────────────────────

export type RiskSignalType =
  | 'ip_velocity'
  | 'device_change'
  | 'login_failures'
  | 'geo_anomaly'
  | 'credential_change'
  | 'payout_change'
  | 'unusual_volume'
  | 'card_velocity'
  | 'refund_abuse'
  | 'account_age'
  | 'shill_bidding'
  | 'listing_manipulation'
  | 'return_fraud_ring'
  | 'payment_failure_rate'
  | 'affiliate_fraud'
  | 'local_fraud'
  | 'chargeback_pattern'
  | 'enforcement_action'
  | 'identity_unverified'
  | 'dispute_rate';

// ─── Severity Bands (C26 §5) ────────────────────────────────────────────────

export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ─── Recommendation from risk gate ──────────────────────────────────────────

export type RiskRecommendation = 'allow' | 'warn' | 'step_up' | 'block';

// ─── Risk action outcomes (C26 §3.4) ────────────────────────────────────────

export type RiskActionOutcome =
  | 'allowed'
  | 'blocked'
  | 'step_up_passed'
  | 'step_up_failed'
  | 'overridden';

// ─── Computed risk score returned from computeRiskScore ─────────────────────

export interface RiskScoreResult {
  userId: string;
  compositeScore: number;
  buyerScore: number;
  sellerScore: number;
  severity: RiskSeverity;
  signalCount: number;
  recommendation: RiskRecommendation;
  signals: RiskSignalRow[];
}

export interface RiskSignalRow {
  id: string;
  userId: string | null;
  sellerId: string | null;
  signalType: string;
  score: number;
  severity: string;
  metaJson: unknown;
  source: string;
  resolved: boolean;
  occurredAt: Date;
}

// ─── Security event types ───────────────────────────────────────────────────

export type SecurityEventType =
  | 'login'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'email_change'
  | 'mfa_enable'
  | 'mfa_disable'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'payout_destination_change'
  | 'account_deletion_requested';

// ─── Gated action keys (C26 §11) ───────────────────────────────────────────

export type GatedAction =
  | 'payout_change'
  | 'large_payout'
  | 'credential_change'
  | 'store_upgrade'
  | 'high_value_listing'
  | 'bulk_listing'
  | 'order_placement'
  | 'listing_publish';

// ─── Threshold shape ────────────────────────────────────────────────────────

export interface RiskThresholdConfig {
  action: string;
  warnAt: number;
  stepUpAt: number;
  blockAt: number;
  isActive: boolean;
}

// ─── Default threshold constants (C26 §11 seed data) ────────────────────────

export const DEFAULT_THRESHOLDS: Record<GatedAction, { warnAt: number; stepUpAt: number; blockAt: number }> = {
  payout_change:      { warnAt: 31, stepUpAt: 61, blockAt: 81 },
  large_payout:       { warnAt: 31, stepUpAt: 51, blockAt: 71 },
  credential_change:  { warnAt: 31, stepUpAt: 61, blockAt: 81 },
  store_upgrade:      { warnAt: 41, stepUpAt: 71, blockAt: 91 },
  high_value_listing: { warnAt: 31, stepUpAt: 61, blockAt: 81 },
  bulk_listing:       { warnAt: 41, stepUpAt: 61, blockAt: 81 },
  order_placement:    { warnAt: 41, stepUpAt: 71, blockAt: 91 },
  listing_publish:    { warnAt: 41, stepUpAt: 71, blockAt: 91 },
};

// ─── Input args for core functions ──────────────────────────────────────────

export interface RecordSignalArgs {
  userId: string;
  sellerId?: string;
  signalType: RiskSignalType;
  scoreMultiplier?: number;
  source?: string;
  meta?: Record<string, unknown>;
}

export interface ComputeScoreArgs {
  userId: string;
  action: string;
}

export interface AssertRiskAllowedArgs {
  userId: string;
  action: string;
  bypassStepUp?: boolean;
  meta?: Record<string, unknown>;
}

export interface RecordSecurityEventArgs {
  userId: string;
  eventType: SecurityEventType;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  location?: string;
  success?: boolean;
  meta?: Record<string, unknown>;
}
