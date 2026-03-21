import type { TemplateDef } from './templates';

export const TAX_TEMPLATES: Record<string, TemplateDef> = {
  'tax.info_required': {
    key: 'tax.info_required',
    name: 'Tax Information Required',
    category: 'tax',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Action required: Provide your tax information',
    bodyTemplate: "You're approaching the IRS reporting threshold. Please provide your tax information at /my/selling/tax before your next payout.",
  },
  'tax.info_required_payout_blocked': {
    key: 'tax.info_required_payout_blocked',
    name: 'Payout On Hold — Tax Information Required',
    category: 'tax',
    priority: 'CRITICAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Your payout is on hold — tax information required',
    bodyTemplate: 'Your payout is on hold. Tax information is required for sellers earning $600+/year. Please complete your tax details at /my/selling/tax.',
  },
  'tax.form_1099k_ready': {
    key: 'tax.form_1099k_ready',
    name: '1099-K Summary Ready',
    category: 'tax',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Your 1099-K summary for {{year}} is available',
    bodyTemplate: 'Your 1099-K summary for {{year}} is available for download at /my/selling/tax.',
  },
  'tax.form_1099nec_ready': {
    key: 'tax.form_1099nec_ready',
    name: '1099-NEC Summary Ready',
    category: 'tax',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Your 1099-NEC summary for {{year}} is available',
    bodyTemplate: 'Your 1099-NEC summary for {{year}} is available for download at /my/selling/tax.',
  },
};
