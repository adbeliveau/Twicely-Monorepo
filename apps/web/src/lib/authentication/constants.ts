// Authentication tiers
export const AUTHENTICATION_TIERS = {
  VERIFIED_SELLER: 'VERIFIED_SELLER', // Tier 1: Free, seller credentials
  AI: 'AI',                           // Tier 2: Deferred to G10.2
  EXPERT: 'EXPERT',                   // Tier 3: Expert human inspection
} as const;

export type AuthenticationTier = typeof AUTHENTICATION_TIERS[keyof typeof AUTHENTICATION_TIERS];

// Authentication initiators
export const AUTHENTICATION_INITIATORS = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
} as const;

export type AuthenticationInitiator = typeof AUTHENTICATION_INITIATORS[keyof typeof AUTHENTICATION_INITIATORS];

// Authentication status groups (for UI logic)
export const AUTH_STATUS_AUTHENTICATED = [
  'SELLER_VERIFIED',
  'AI_AUTHENTICATED',
  'EXPERT_AUTHENTICATED',
] as const;

export const AUTH_STATUS_PENDING = [
  'AI_PENDING',
  'EXPERT_PENDING',
] as const;

export const AUTH_STATUS_FAILED = [
  'AI_COUNTERFEIT',
  'EXPERT_COUNTERFEIT',
] as const;

export const AUTH_STATUS_INVALID = [
  'CERTIFICATE_EXPIRED',
  'CERTIFICATE_REVOKED',
] as const;

// Certificate number prefix
export const CERTIFICATE_PREFIX = 'TW-AUTH-';

// Spec-defined authenticator specialties (Feature Lock-in Addendum §48)
export const AUTHENTICATOR_SPECIALTIES = [
  'HANDBAGS',
  'WATCHES',
  'SNEAKERS',
  'TRADING_CARDS',
] as const;

export type AuthenticatorSpecialty = typeof AUTHENTICATOR_SPECIALTIES[number];

// Platform settings keys
export const AUTH_SETTINGS_KEYS = {
  OFFER_THRESHOLD_CENTS: 'trust.authentication.offerThresholdCents',
  BUYER_FEE_CENTS: 'trust.authentication.buyerFeeCents',
  SELLER_FEE_CENTS: 'trust.authentication.sellerFeeCents',
  EXPERT_FEE_CENTS: 'trust.authentication.expertFeeCents',
  EXPERT_HIGH_VALUE_FEE_CENTS: 'trust.authentication.expertHighValueFeeCents',
  MANDATORY_ABOVE_CENTS: 'trust.authentication.mandatoryAboveCents',
} as const;
