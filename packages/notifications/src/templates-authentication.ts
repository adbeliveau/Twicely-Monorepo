import type { TemplateDef } from './templates-types';

/**
 * Notification templates for AI Authentication events (G10.2).
 */
export const AUTHENTICATION_TEMPLATES: Record<string, TemplateDef> = {
  'auth.ai.authenticated': {
    key: 'auth.ai.authenticated',
    name: 'AI Authentication Passed',
    category: 'authentication',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: '{{itemTitle}} has been authenticated',
    bodyTemplate:
      'Great news! {{itemTitle}} passed AI authentication with {{confidencePercent}}% confidence. Your listing now displays a verified authentication badge.',
  },
  'auth.ai.counterfeit': {
    key: 'auth.ai.counterfeit',
    name: 'AI Authentication — Counterfeit Detected',
    category: 'authentication',
    priority: 'CRITICAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Authentication issue with {{itemTitle}}',
    bodyTemplate:
      'Our AI authentication system flagged {{itemTitle}} as potentially not authentic. The listing has been delisted. If you believe this is an error, you may request expert review.',
  },
  'auth.ai.inconclusive': {
    key: 'auth.ai.inconclusive',
    name: 'AI Authentication — Inconclusive',
    category: 'authentication',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Authentication inconclusive for {{itemTitle}}',
    bodyTemplate:
      'Our AI authentication could not determine the authenticity of {{itemTitle}}. You may request an expert review for a definitive result.',
  },
};
