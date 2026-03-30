/**
 * 16 preset expense categories from Financial Center Canonical section 3 /
 * Platform Settings section 9.
 *
 * Canonical source of truth — imported by both the finance package
 * (receipt-ocr) and the app-layer validation schemas.
 */
export const EXPENSE_CATEGORIES = [
  'Shipping Supplies',
  'Packaging',
  'Equipment',
  'Software/Subscriptions',
  'Mileage',
  'Storage/Rent',
  'Sourcing Trips',
  'Photography',
  'Authentication',
  'Platform Fees',
  'Postage',
  'Returns/Losses',
  'Marketing',
  'Office Supplies',
  'Professional Services',
  'Other',
] as const;
