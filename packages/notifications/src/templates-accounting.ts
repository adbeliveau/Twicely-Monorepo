import type { TemplateDef } from './templates-types';

/**
 * Notification templates for Accounting Sync events (G10.3).
 */
export const ACCOUNTING_TEMPLATES: Record<string, TemplateDef> = {
  'accounting.sync.completed': {
    key: 'accounting.sync.completed',
    name: 'Accounting Sync Completed',
    category: 'accounting',
    priority: 'NORMAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: '{{provider}} sync completed — {{recordsSynced}} records',
    bodyTemplate:
      'Your {{provider}} accounting sync completed successfully. {{recordsSynced}} records were synced. Last sync: {{syncDate}}.',
  },
  'accounting.sync.failed': {
    key: 'accounting.sync.failed',
    name: 'Accounting Sync Failed',
    category: 'accounting',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: '{{provider}} sync failed — action required',
    bodyTemplate:
      'Your {{provider}} accounting sync failed. {{errorMessage}} Please check your integration settings at /my/selling/finances/integrations.',
  },
};
