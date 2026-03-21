import type { TemplateDef } from './templates';

/**
 * Notification templates for KYC & Identity Verification events (G6).
 */
export const KYC_TEMPLATES: Record<string, TemplateDef> = {
  'kyc.verification_required': {
    key: 'kyc.verification_required',
    name: 'Identity Verification Required',
    category: 'kyc',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Action required: Verify your identity',
    bodyTemplate:
      'Identity verification is required for your account. Please complete verification at /my/selling/verification to continue selling.',
  },
  'kyc.verification_submitted': {
    key: 'kyc.verification_submitted',
    name: 'Identity Verification Submitted',
    category: 'kyc',
    priority: 'NORMAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Identity verification submitted',
    bodyTemplate:
      'Your identity verification has been submitted. We will notify you once the review is complete.',
  },
  'kyc.verification_approved': {
    key: 'kyc.verification_approved',
    name: 'Identity Verification Approved',
    category: 'kyc',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Identity verification approved',
    bodyTemplate:
      'Your identity has been verified. Your account now has {{level}} verification status.',
  },
  'kyc.verification_failed': {
    key: 'kyc.verification_failed',
    name: 'Identity Verification Failed',
    category: 'kyc',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Identity verification was not successful',
    bodyTemplate:
      'Your identity verification was not successful. Reason: {{failureReason}}. You may retry after {{retryAfterDate}}. Visit /my/selling/verification for details.',
  },
  'kyc.verification_expired': {
    key: 'kyc.verification_expired',
    name: 'Identity Verification Expired',
    category: 'kyc',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Your identity verification has expired',
    bodyTemplate:
      'Your enhanced identity verification expired on {{expiryDate}}. Please re-verify at /my/selling/verification to maintain your account status.',
  },
};
