import type { TemplateDef } from './templates';

/**
 * Notification templates for crosslister events (F5).
 */
export const CROSSLISTER_TEMPLATES: Record<string, TemplateDef> = {
  'crosslister.sale_detected': {
    key: 'crosslister.sale_detected',
    name: 'Sale Detected',
    category: 'crosslister',
    priority: 'HIGH',
    defaultChannels: ['IN_APP'],
    subjectTemplate: '{{itemTitle}} sold on {{channel}}',
    bodyTemplate: 'Your listing {{itemTitle}} sold on {{channel}} for {{salePriceFormatted}}. We are delisting it from {{delistingPlatforms}}.',
  },
  'crosslister.delist_failed': {
    key: 'crosslister.delist_failed',
    name: 'Delist Failed',
    category: 'crosslister',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Action required: could not delist {{itemTitle}} from {{channel}}',
    bodyTemplate: 'We could not automatically delist {{itemTitle}} from {{channel}}. Please delist it manually to prevent a double sale.',
  },
  'crosslister.double_sell': {
    key: 'crosslister.double_sell',
    name: 'Potential Double Sale',
    category: 'crosslister',
    priority: 'CRITICAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Action required: {{itemTitle}} may have sold twice',
    bodyTemplate: '{{itemTitle}} may have sold on both {{channel1}} and {{channel2}}. Please cancel one sale immediately to avoid a dispute.',
  },
};
