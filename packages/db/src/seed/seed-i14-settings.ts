/**
 * I14 Platform Settings Seed
 * Localization & Compliance settings: i18n, policy versioning, currency, shipping threshold, tax rules.
 */

import type { PlatformSettingSeed } from './v32-platform-settings';

export const SEED_I14_SETTINGS: PlatformSettingSeed[] = [
  // ─── i18n ─────────────────────────────────────────────────────────────────
  {
    key: 'i18n.defaultLocale',
    value: 'en-US',
    type: 'string',
    category: 'i18n',
    description: 'Default locale for the platform',
  },
  {
    key: 'i18n.supportedLocales',
    value: 'en-US',
    type: 'string',
    category: 'i18n',
    description: 'Comma-separated list of supported locales',
  },
  {
    key: 'i18n.fallbackLocale',
    value: 'en-US',
    type: 'string',
    category: 'i18n',
    description: 'Fallback locale when translation is missing',
  },

  // ─── Policy Versioning ────────────────────────────────────────────────────
  {
    key: 'policy.terms.version',
    value: '1.0.0',
    type: 'string',
    category: 'policy',
    description: 'Current version of the Terms of Service',
  },
  {
    key: 'policy.terms.effectiveDate',
    value: '2024-01-01',
    type: 'string',
    category: 'policy',
    description: 'Effective date of the current Terms of Service version',
  },
  {
    key: 'policy.privacy.version',
    value: '1.0.0',
    type: 'string',
    category: 'policy',
    description: 'Current version of the Privacy Policy',
  },
  {
    key: 'policy.privacy.effectiveDate',
    value: '2024-01-01',
    type: 'string',
    category: 'policy',
    description: 'Effective date of the current Privacy Policy version',
  },
  {
    key: 'policy.seller-agreement.version',
    value: '1.0.0',
    type: 'string',
    category: 'policy',
    description: 'Current version of the Seller Agreement',
  },
  {
    key: 'policy.seller-agreement.effectiveDate',
    value: '2024-01-01',
    type: 'string',
    category: 'policy',
    description: 'Effective date of the current Seller Agreement version',
  },
  {
    key: 'policy.refund.version',
    value: '1.0.0',
    type: 'string',
    category: 'policy',
    description: 'Current version of the Refund Policy',
  },
  {
    key: 'policy.refund.effectiveDate',
    value: '2024-01-01',
    type: 'string',
    category: 'policy',
    description: 'Effective date of the current Refund Policy version',
  },

  // ─── Currency ─────────────────────────────────────────────────────────────
  {
    key: 'currency.default',
    value: 'USD',
    type: 'string',
    category: 'currency',
    description: 'Default currency code for the platform',
  },
  {
    key: 'currency.symbol',
    value: '$',
    type: 'string',
    category: 'currency',
    description: 'Currency symbol for the default currency',
  },
  {
    key: 'currency.precision',
    value: 2,
    type: 'number',
    category: 'currency',
    description: 'Decimal precision for currency display',
  },

  // ─── Shipping ─────────────────────────────────────────────────────────────
  {
    key: 'fulfillment.shipping.freeThresholdCents',
    value: 5000,
    type: 'cents',
    category: 'fulfillment',
    description: 'Order total threshold for free shipping eligibility ($50)',
  },

  // ─── Tax ──────────────────────────────────────────────────────────────────
  {
    key: 'tax.platformTaxEnabled',
    value: false,
    type: 'boolean',
    category: 'tax',
    description: 'Enable platform-level tax collection',
  },
  {
    key: 'tax.defaultTaxRate',
    value: 0,
    type: 'number',
    category: 'tax',
    description: 'Default tax rate in basis points (0 = no default)',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RISK ENGINE (Canonical 26 §15 / C26 §7)
  // ═══════════════════════════════════════════════════════════════════════════
  { key: 'risk.enabled', value: true, type: 'boolean', category: 'risk', description: 'Master toggle for risk scoring engine' },
  { key: 'risk.scoring.cacheMinutes', value: 1, type: 'number', category: 'risk', description: 'Risk score cache TTL (minutes)' },
  { key: 'risk.scoring.windowHours', value: 24, type: 'number', category: 'risk', description: 'Lookback window for risk signal aggregation (hours)' },
  { key: 'risk.scoring.maxScore', value: 100, type: 'number', category: 'risk', description: 'Maximum risk score cap' },
  { key: 'risk.security.loginFailureThreshold', value: 3, type: 'number', category: 'risk', description: 'Failed login count to trigger IP velocity signal' },
  { key: 'risk.security.loginFailureWindowMinutes', value: 15, type: 'number', category: 'risk', description: 'Window for counting failed logins (minutes)' },
  { key: 'risk.security.ipVelocityScanWindowMinutes', value: 15, type: 'number', category: 'risk', description: 'Pattern scanner IP velocity scan window (minutes)' },
  { key: 'risk.fraud.paymentFailureThreshold', value: 5, type: 'number', category: 'risk', description: 'Payment failures per user to trigger fraud signal' },
  { key: 'risk.fraud.paymentFailureWindowMinutes', value: 60, type: 'number', category: 'risk', description: 'Window for counting payment failures (minutes)' },
];
