/**
 * Finance formatting utilities.
 * All money values are integer cents internally.
 * Conversion to dollars happens here, only for display.
 */

/**
 * Convert integer cents to a dollar string.
 * Uses integer arithmetic to avoid floating-point errors.
 */
export function formatCentsToDollars(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents) % 100;
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${dollars.toLocaleString()}.${remainder.toString().padStart(2, '0')}`;
}

/**
 * Calculate trend direction and percent change between two cent values.
 */
export function calculateTrend(
  currentCents: number,
  previousCents: number,
): { direction: 'up' | 'down' | 'flat'; percent: number } {
  if (previousCents === 0) {
    return { direction: currentCents > 0 ? 'up' : 'flat', percent: 0 };
  }
  const diff = currentCents - previousCents;
  const percent = Math.abs(Math.round((diff / previousCents) * 10000) / 100);
  if (diff > 0) return { direction: 'up', percent };
  if (diff < 0) return { direction: 'down', percent };
  return { direction: 'flat', percent: 0 };
}

const TYPE_LABELS: Record<string, string> = {
  ORDER_PAYMENT_CAPTURED: 'Sale',
  ORDER_TF_FEE: 'Transaction Fee',
  ORDER_STRIPE_PROCESSING_FEE: 'Payment processing fee',
  ORDER_BOOST_FEE: 'Boost fee',
  LOCAL_TRANSACTION_FEE: 'Local sale fee',
  AUTH_FEE_BUYER: 'Authentication fee (buyer)',
  AUTH_FEE_SELLER: 'Authentication fee (seller)',
  AUTH_FEE_REFUND: 'Authentication fee refund',
  REFUND_FULL: 'Full refund',
  REFUND_PARTIAL: 'Partial refund',
  REFUND_TF_REVERSAL: 'Transaction Fee reversal',
  REFUND_BOOST_REVERSAL: 'Boost fee reversal',
  REFUND_STRIPE_REVERSAL: 'Payment processing fee reversal',
  CHARGEBACK_DEBIT: 'Chargeback',
  CHARGEBACK_REVERSAL: 'Chargeback reversal',
  CHARGEBACK_FEE: 'Chargeback fee',
  SHIPPING_LABEL_PURCHASE: 'Shipping label',
  SHIPPING_LABEL_REFUND: 'Shipping label refund',
  INSERTION_FEE: 'Insertion fee',
  INSERTION_FEE_WAIVER: 'Insertion fee waiver',
  SUBSCRIPTION_CHARGE: 'Subscription charge',
  SUBSCRIPTION_CREDIT: 'Subscription credit',
  FINANCE_SUBSCRIPTION_CHARGE: 'Finance Pro charge',
  PAYOUT_SENT: 'Payout sent',
  PAYOUT_FAILED: 'Payout failed',
  PAYOUT_REVERSED: 'Payout reversed',
  RESERVE_HOLD: 'Reserve hold',
  RESERVE_RELEASE: 'Reserve release',
  MANUAL_CREDIT: 'Manual credit',
  MANUAL_DEBIT: 'Manual debit',
  OVERAGE_CHARGE: 'Overage charge',
  AFFILIATE_COMMISSION_PAYOUT: 'Affiliate commission',
  PLATFORM_ABSORBED_COST: 'Platform credit',
  BUYER_REFERRAL_CREDIT_ISSUED: 'Referral credit issued',
  BUYER_REFERRAL_CREDIT_REDEEMED: 'Referral credit redeemed',
  SELLER_ADJUSTMENT: 'Seller adjustment',
  CROSSLISTER_SALE_REVENUE: 'Off-platform sale',
  CROSSLISTER_PLATFORM_FEE: 'External platform fee',
  LOCAL_CASH_SALE_REVENUE: 'Cash local sale',
};

const FEE_TYPES = new Set([
  'ORDER_TF_FEE',
  'ORDER_BOOST_FEE',
  'ORDER_STRIPE_PROCESSING_FEE',
  'INSERTION_FEE',
  'SUBSCRIPTION_CHARGE',
  'FINANCE_SUBSCRIPTION_CHARGE',
  'LOCAL_TRANSACTION_FEE',
  'AUTH_FEE_BUYER',
  'AUTH_FEE_SELLER',
  'OVERAGE_CHARGE',
  'CHARGEBACK_FEE',
]);

const PAYOUT_TYPES = new Set(['PAYOUT_SENT', 'PAYOUT_FAILED', 'PAYOUT_REVERSED']);

const REFUND_TYPES = new Set([
  'REFUND_FULL',
  'REFUND_PARTIAL',
  'REFUND_TF_REVERSAL',
  'REFUND_BOOST_REVERSAL',
  'REFUND_STRIPE_REVERSAL',
  'AUTH_FEE_REFUND',
  'CHARGEBACK_REVERSAL',
]);

/**
 * Get a human-readable label for a ledger entry type.
 */
export function getLedgerTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * Map a ledger entry type to its display group.
 */
export function getLedgerTypeGroup(
  type: string,
): 'SALES' | 'FEES' | 'PAYOUTS' | 'REFUNDS' | 'OTHER' {
  if (
    type === 'ORDER_PAYMENT_CAPTURED' ||
    type === 'CROSSLISTER_SALE_REVENUE' ||
    type === 'LOCAL_CASH_SALE_REVENUE'
  ) return 'SALES';
  if (FEE_TYPES.has(type) || type === 'CROSSLISTER_PLATFORM_FEE') return 'FEES';
  if (PAYOUT_TYPES.has(type)) return 'PAYOUTS';
  if (REFUND_TYPES.has(type)) return 'REFUNDS';
  return 'OTHER';
}

/**
 * Map a report type code to its human-readable label.
 */
export function formatReportType(type: string): string {
  const labels: Record<string, string> = {
    PNL: 'P&L Statement',
    BALANCE_SHEET: 'Balance Sheet',
    CASH_FLOW: 'Cash Flow Statement',
    TAX_PREP: 'Tax Prep Package',
    INVENTORY_AGING: 'Inventory Aging Report',
  };
  return labels[type] ?? type;
}

/**
 * Format a date range as "Jan 1, 2026 - Jan 31, 2026".
 */
export function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`;
}

/**
 * Map a report format code to its human-readable label.
 */
export function formatReportFormat(format: string): string {
  const labels: Record<string, string> = {
    JSON: 'Online',
    CSV: 'CSV',
    PDF: 'Printable',
  };
  return labels[format] ?? format;
}
