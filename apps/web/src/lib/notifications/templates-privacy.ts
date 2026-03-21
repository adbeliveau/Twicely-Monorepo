import type { TemplateDef } from './templates';

/**
 * Notification templates for Privacy & Data events (G6).
 */
export const PRIVACY_TEMPLATES: Record<string, TemplateDef> = {
  'privacy.data_export_ready': {
    key: 'privacy.data_export_ready',
    name: 'Data Export Ready',
    category: 'privacy',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Your data export is ready to download',
    bodyTemplate:
      'Your data export is ready. Download it at /my/settings/privacy before the link expires on {{expiresAt}}.',
  },
  'privacy.deletion_started': {
    key: 'privacy.deletion_started',
    name: 'Account Deletion Started',
    category: 'privacy',
    priority: 'CRITICAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Account deletion cooling-off period started',
    bodyTemplate:
      'Your account deletion request has been received. Your account will be permanently deleted on {{deletionDate}} unless you cancel this request at /my/settings/privacy.',
  },
  'privacy.deletion_completed': {
    key: 'privacy.deletion_completed',
    name: 'Account Deletion Completed',
    category: 'privacy',
    priority: 'CRITICAL',
    defaultChannels: ['EMAIL'],
    subjectTemplate: 'Your Twicely account has been deleted',
    bodyTemplate:
      'Your Twicely account has been permanently deleted. If you believe this was in error, contact support@twicely.co.',
  },
  'privacy.consent_changed': {
    key: 'privacy.consent_changed',
    name: 'Cookie Consent Updated',
    category: 'privacy',
    priority: 'LOW',
    defaultChannels: ['IN_APP'],
    subjectTemplate: 'Your cookie preferences have been updated',
    bodyTemplate:
      'Your cookie consent preferences have been updated. You can change them at any time at /p/cookies.',
  },
};
