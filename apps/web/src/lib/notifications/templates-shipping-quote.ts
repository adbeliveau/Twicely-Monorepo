import type { TemplateDef } from './templates';

/**
 * Notification templates for combined shipping quote events (D2.2).
 */
export const SHIPPING_QUOTE_TEMPLATES: Record<string, TemplateDef> = {
  'shipping_quote.requested': {
    key: 'shipping_quote.requested',
    name: 'Combined Shipping Quote Requested',
    category: 'shipping',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate:
      'Action required: Provide a combined shipping quote for order {{orderNumber}}',
    bodyTemplate:
      'Order {{orderNumber}} contains {{itemCount}} items. Please provide a combined shipping quote within {{deadlineFormatted}}. Maximum shipping: {{maxShippingFormatted}}.',
  },
  'shipping_quote.received': {
    key: 'shipping_quote.received',
    name: 'Combined Shipping Quote Received',
    category: 'shipping',
    priority: 'NORMAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate:
      'The seller provided a combined shipping quote for order {{orderNumber}}',
    bodyTemplate:
      '{{sellerName}} quoted {{quotedAmountFormatted}} for combined shipping on order {{orderNumber}}. You save {{savingsFormatted}}. Review and accept or dispute the quote.',
  },
  'shipping_quote.accepted': {
    key: 'shipping_quote.accepted',
    name: 'Combined Shipping Quote Accepted',
    category: 'shipping',
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    subjectTemplate: 'Your shipping quote was accepted for order {{orderNumber}}',
    bodyTemplate:
      '{{buyerName}} accepted your combined shipping quote for order {{orderNumber}}.',
  },
  'shipping_quote.disputed': {
    key: 'shipping_quote.disputed',
    name: 'Combined Shipping Quote Disputed',
    category: 'shipping',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'Shipping quote disputed for order {{orderNumber}}',
    bodyTemplate:
      '{{buyerName}} disputed your combined shipping quote for order {{orderNumber}}. Please contact Twicely support for resolution.',
  },
  'shipping_quote.penalty_applied': {
    key: 'shipping_quote.penalty_applied',
    name: 'Combined Shipping Discount Applied',
    category: 'shipping',
    priority: 'NORMAL',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate: 'You received a shipping discount on order {{orderNumber}}',
    bodyTemplate:
      'The seller did not provide a combined shipping quote in time for order {{orderNumber}}. Your shipping was reduced from {{originalShippingFormatted}} to {{discountedShippingFormatted}}. You saved {{savingsFormatted}}.',
  },
  'shipping_quote.deadline_missed': {
    key: 'shipping_quote.deadline_missed',
    name: 'Combined Shipping Quote Deadline Missed',
    category: 'shipping',
    priority: 'HIGH',
    defaultChannels: ['EMAIL', 'IN_APP'],
    subjectTemplate:
      'You missed the shipping quote deadline for order {{orderNumber}}',
    bodyTemplate:
      'You did not provide a combined shipping quote for order {{orderNumber}} before the deadline. A {{penaltyPercent}}% discount was automatically applied. The buyer now pays {{discountedShippingFormatted}}. You can still submit a lower quote.',
  },
};
