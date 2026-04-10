import { describe, it, expect } from 'vitest';
import {
  RISK_SIGNAL_TYPES,
  DEFAULT_SIGNAL_BASE_SCORES,
  severityFromScore,
  isValidSignalType,
  getSignalSettingKey,
  UNKNOWN_SIGNAL_FALLBACK_SCORE,
} from '../signal-types';
import type { RiskSignalType } from '../types';

describe('signal-types', () => {
  describe('RISK_SIGNAL_TYPES', () => {
    it('contains exactly 20 signal types', () => {
      const values = Object.values(RISK_SIGNAL_TYPES);
      expect(values).toHaveLength(20);
    });

    it('all values are unique', () => {
      const values = Object.values(RISK_SIGNAL_TYPES);
      expect(new Set(values).size).toBe(20);
    });

    it('contains expected authentication signal types', () => {
      expect(RISK_SIGNAL_TYPES.IP_VELOCITY).toBe('ip_velocity');
      expect(RISK_SIGNAL_TYPES.DEVICE_CHANGE).toBe('device_change');
      expect(RISK_SIGNAL_TYPES.LOGIN_FAILURES).toBe('login_failures');
      expect(RISK_SIGNAL_TYPES.GEO_ANOMALY).toBe('geo_anomaly');
      expect(RISK_SIGNAL_TYPES.CREDENTIAL_CHANGE).toBe('credential_change');
    });

    it('contains expected cross-domain signal types', () => {
      expect(RISK_SIGNAL_TYPES.AFFILIATE_FRAUD).toBe('affiliate_fraud');
      expect(RISK_SIGNAL_TYPES.LOCAL_FRAUD).toBe('local_fraud');
      expect(RISK_SIGNAL_TYPES.CHARGEBACK_PATTERN).toBe('chargeback_pattern');
      expect(RISK_SIGNAL_TYPES.ENFORCEMENT_ACTION).toBe('enforcement_action');
      expect(RISK_SIGNAL_TYPES.DISPUTE_RATE).toBe('dispute_rate');
    });
  });

  describe('DEFAULT_SIGNAL_BASE_SCORES', () => {
    it('has a base score for every signal type', () => {
      const signalTypes = Object.values(RISK_SIGNAL_TYPES);
      for (const type of signalTypes) {
        expect(DEFAULT_SIGNAL_BASE_SCORES[type]).toBeDefined();
        expect(typeof DEFAULT_SIGNAL_BASE_SCORES[type]).toBe('number');
      }
    });

    it('all base scores are between 1 and 100', () => {
      for (const score of Object.values(DEFAULT_SIGNAL_BASE_SCORES)) {
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(100);
      }
    });

    it('shill_bidding has the highest default base score (60)', () => {
      expect(DEFAULT_SIGNAL_BASE_SCORES.shill_bidding).toBe(60);
    });

    it('ip_velocity has the lowest default base score (15)', () => {
      expect(DEFAULT_SIGNAL_BASE_SCORES.ip_velocity).toBe(15);
    });
  });

  describe('severityFromScore', () => {
    it('returns LOW for scores 0-30', () => {
      expect(severityFromScore(0)).toBe('LOW');
      expect(severityFromScore(15)).toBe('LOW');
      expect(severityFromScore(30)).toBe('LOW');
    });

    it('returns MEDIUM for scores 31-60', () => {
      expect(severityFromScore(31)).toBe('MEDIUM');
      expect(severityFromScore(45)).toBe('MEDIUM');
      expect(severityFromScore(60)).toBe('MEDIUM');
    });

    it('returns HIGH for scores 61-80', () => {
      expect(severityFromScore(61)).toBe('HIGH');
      expect(severityFromScore(70)).toBe('HIGH');
      expect(severityFromScore(80)).toBe('HIGH');
    });

    it('returns CRITICAL for scores 81-100', () => {
      expect(severityFromScore(81)).toBe('CRITICAL');
      expect(severityFromScore(90)).toBe('CRITICAL');
      expect(severityFromScore(100)).toBe('CRITICAL');
    });
  });

  describe('isValidSignalType', () => {
    it('returns true for valid signal types', () => {
      expect(isValidSignalType('ip_velocity')).toBe(true);
      expect(isValidSignalType('shill_bidding')).toBe(true);
      expect(isValidSignalType('dispute_rate')).toBe(true);
    });

    it('returns false for invalid signal types', () => {
      expect(isValidSignalType('nonexistent_type')).toBe(false);
      expect(isValidSignalType('')).toBe(false);
      expect(isValidSignalType('IP_VELOCITY')).toBe(false); // uppercase not valid
    });
  });

  describe('getSignalSettingKey', () => {
    it('returns correct platform setting key for each signal type', () => {
      expect(getSignalSettingKey('ip_velocity')).toBe('risk.signal.ipVelocity.baseScore');
      expect(getSignalSettingKey('login_failures')).toBe('risk.signal.loginFailures.baseScore');
      expect(getSignalSettingKey('chargeback_pattern')).toBe('risk.signal.chargebackPattern.baseScore');
    });
  });

  describe('UNKNOWN_SIGNAL_FALLBACK_SCORE', () => {
    it('is 10', () => {
      expect(UNKNOWN_SIGNAL_FALLBACK_SCORE).toBe(10);
    });
  });
});
