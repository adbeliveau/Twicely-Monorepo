/**
 * Status display constants for LocalMeetupCard.
 * Extracted to keep local-meetup-card.tsx under the 300-line limit.
 */

export const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled', SELLER_CHECKED_IN: 'Seller Checked In',
  BUYER_CHECKED_IN: 'Buyer Checked In', BOTH_CHECKED_IN: 'Both Checked In',
  ADJUSTMENT_PENDING: 'Price Adjustment Pending', RESCHEDULE_PENDING: 'Reschedule Pending',
  RECEIPT_CONFIRMED: 'Receipt Confirmed', COMPLETED: 'Completed',
  CANCELED: 'Canceled', NO_SHOW: 'No Show', DISPUTED: 'Disputed',
};

export const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SCHEDULED: 'secondary', SELLER_CHECKED_IN: 'default', BUYER_CHECKED_IN: 'default',
  BOTH_CHECKED_IN: 'default', ADJUSTMENT_PENDING: 'secondary', RESCHEDULE_PENDING: 'secondary',
  RECEIPT_CONFIRMED: 'default', COMPLETED: 'default',
  CANCELED: 'destructive', NO_SHOW: 'destructive', DISPUTED: 'destructive',
};
