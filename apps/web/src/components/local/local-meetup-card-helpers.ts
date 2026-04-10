import type { LocalTransactionWithLocation } from '@/lib/queries/local-transaction';
import type { CounterpartyReliability } from './reliability-badge';

export interface LocalMeetupCardProps {
  transaction: LocalTransactionWithLocation;
  role: 'BUYER' | 'SELLER';
  currentUserId: string;
  otherPartyName: string;
  buyerLat?: number;
  buyerLng?: number;
  sellerLat?: number;
  sellerLng?: number;
  originalPriceCents?: number;
  maxDiscountPercent?: number;
  rescheduleMaxCount?: number;
  dayOfConfirmationWindowHours?: number;
  cancelLateHours: number;
  cancelSamedayHours: number;
  counterpartyReliability?: CounterpartyReliability | null;
}

const FMT_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export function formatScheduledAt(date: Date): string { return FMT_DATE.format(new Date(date)); }
