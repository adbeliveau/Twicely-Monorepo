import { describe, it, expect } from 'vitest';
import {
  AUTHENTICATION_TIERS,
  AUTHENTICATION_INITIATORS,
  AUTH_STATUS_AUTHENTICATED,
  AUTH_STATUS_PENDING,
  AUTH_STATUS_FAILED,
  AUTH_STATUS_INVALID,
  CERTIFICATE_PREFIX,
  AUTHENTICATOR_SPECIALTIES,
  AUTH_SETTINGS_KEYS,
} from '../constants';

describe('authentication constants', () => {
  it('exports all authentication tier constants', () => {
    expect(AUTHENTICATION_TIERS.VERIFIED_SELLER).toBe('VERIFIED_SELLER');
    expect(AUTHENTICATION_TIERS.AI).toBe('AI');
    expect(AUTHENTICATION_TIERS.EXPERT).toBe('EXPERT');
  });

  it('exports all authentication initiator constants', () => {
    expect(AUTHENTICATION_INITIATORS.BUYER).toBe('BUYER');
    expect(AUTHENTICATION_INITIATORS.SELLER).toBe('SELLER');
  });

  it('exports all authentication status groups', () => {
    expect(AUTH_STATUS_AUTHENTICATED).toBeDefined();
    expect(AUTH_STATUS_PENDING).toBeDefined();
    expect(AUTH_STATUS_FAILED).toBeDefined();
    expect(AUTH_STATUS_INVALID).toBeDefined();
  });

  it('AUTH_STATUS_AUTHENTICATED includes correct statuses', () => {
    expect(AUTH_STATUS_AUTHENTICATED).toContain('SELLER_VERIFIED');
    expect(AUTH_STATUS_AUTHENTICATED).toContain('AI_AUTHENTICATED');
    expect(AUTH_STATUS_AUTHENTICATED).toContain('EXPERT_AUTHENTICATED');
  });

  it('AUTH_STATUS_PENDING includes correct statuses', () => {
    expect(AUTH_STATUS_PENDING).toContain('AI_PENDING');
    expect(AUTH_STATUS_PENDING).toContain('EXPERT_PENDING');
  });

  it('AUTH_STATUS_FAILED includes correct statuses', () => {
    expect(AUTH_STATUS_FAILED).toContain('AI_COUNTERFEIT');
    expect(AUTH_STATUS_FAILED).toContain('EXPERT_COUNTERFEIT');
  });

  it('AUTH_STATUS_INVALID includes correct statuses', () => {
    expect(AUTH_STATUS_INVALID).toContain('CERTIFICATE_EXPIRED');
    expect(AUTH_STATUS_INVALID).toContain('CERTIFICATE_REVOKED');
  });

  it('CERTIFICATE_PREFIX is TW-AUTH-', () => {
    expect(CERTIFICATE_PREFIX).toBe('TW-AUTH-');
  });

  it('exports authenticator specialties array', () => {
    expect(Array.isArray(AUTHENTICATOR_SPECIALTIES)).toBe(true);
    expect(AUTHENTICATOR_SPECIALTIES.length).toBeGreaterThan(0);
    expect(AUTHENTICATOR_SPECIALTIES).toContain('HANDBAGS');
    expect(AUTHENTICATOR_SPECIALTIES).toContain('WATCHES');
  });

  it('exports all platform settings keys', () => {
    expect(AUTH_SETTINGS_KEYS.OFFER_THRESHOLD_CENTS).toBe('trust.authentication.offerThresholdCents');
    expect(AUTH_SETTINGS_KEYS.BUYER_FEE_CENTS).toBe('trust.authentication.buyerFeeCents');
    expect(AUTH_SETTINGS_KEYS.SELLER_FEE_CENTS).toBe('trust.authentication.sellerFeeCents');
    expect(AUTH_SETTINGS_KEYS.EXPERT_FEE_CENTS).toBe('trust.authentication.expertFeeCents');
    expect(AUTH_SETTINGS_KEYS.EXPERT_HIGH_VALUE_FEE_CENTS).toBe('trust.authentication.expertHighValueFeeCents');
    expect(AUTH_SETTINGS_KEYS.MANDATORY_ABOVE_CENTS).toBe('trust.authentication.mandatoryAboveCents');
  });
});
