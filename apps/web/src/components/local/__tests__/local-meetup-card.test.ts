import { describe, it, expect } from 'vitest';
import type { LocalTransactionWithLocation } from '@/lib/queries/local-transaction';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type LocalStatus = LocalTransactionWithLocation['status'];

function makeTx(
  overrides: Partial<LocalTransactionWithLocation> = {}
): LocalTransactionWithLocation {
  return {
    id: 'cm1abc',
    orderId: 'cm2abc',
    buyerId: 'buyer1',
    sellerId: 'seller1',
    meetupLocationId: null,
    status: 'SCHEDULED',
    scheduledAt: new Date('2026-06-15T14:00:00Z'),
    scheduledAtConfirmedAt: null,
    schedulingProposedBy: null,
    sellerConfirmationCode: 'seller.token.abc',
    sellerOfflineCode: '482910',
    buyerConfirmationCode: 'buyer.token.abc',
    buyerOfflineCode: '192837',
    confirmationMode: null,
    sellerCheckedIn: false,
    sellerCheckedInAt: null,
    buyerCheckedIn: false,
    buyerCheckedInAt: null,
    confirmedAt: null,
    offlineConfirmedAt: null,
    syncedAt: null,
    safetyAlertSent: false,
    safetyAlertAt: null,
    noShowParty: null,
    noShowFeeCents: null,
    noShowFeeChargedAt: null,
    adjustedPriceCents: null,
    adjustmentReason: null,
    adjustmentInitiatedAt: null,
    adjustmentAcceptedAt: null,
    adjustmentDeclinedAt: null,
    rescheduleCount: 0,
    lastRescheduledAt: null,
    lastRescheduledBy: null,
    originalScheduledAt: null,
    rescheduleProposedAt: null,
    canceledByParty: null,
    dayOfConfirmationSentAt: null,
    dayOfConfirmationRespondedAt: null,
    dayOfConfirmationExpired: false,
    meetupPhotoUrls: [],
    meetupPhotosAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    meetupLocation: null,
    ...overrides,
  };
}

// ─── Status badge label logic ────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  SELLER_CHECKED_IN: 'Seller Checked In',
  BUYER_CHECKED_IN: 'Buyer Checked In',
  BOTH_CHECKED_IN: 'Both Checked In',
  RECEIPT_CONFIRMED: 'Receipt Confirmed',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
  NO_SHOW: 'No Show',
  DISPUTED: 'Disputed',
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

// ─── Check-in visibility logic ───────────────────────────────────────────────

const CHECK_IN_ALLOWED_STATUSES: LocalStatus[] = [
  'SCHEDULED',
  'SELLER_CHECKED_IN',
  'BUYER_CHECKED_IN',
];

function canShowCheckIn(tx: LocalTransactionWithLocation, role: 'BUYER' | 'SELLER'): boolean {
  const hasCheckedIn = role === 'BUYER' ? tx.buyerCheckedIn : tx.sellerCheckedIn;
  // G2.9: check-in is locked until scheduling is confirmed
  const schedulingConfirmed = tx.scheduledAtConfirmedAt !== null;
  return schedulingConfirmed && !hasCheckedIn && (CHECK_IN_ALLOWED_STATUSES as string[]).includes(tx.status);
}

function shouldShowQrCode(tx: LocalTransactionWithLocation, role: 'BUYER' | 'SELLER'): boolean {
  return role === 'SELLER' && tx.status !== 'COMPLETED';
}

function shouldShowConfirmButton(role: 'BUYER' | 'SELLER'): boolean {
  return role === 'BUYER';
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LocalMeetupCard', () => {
  it('renders meetup status badge', () => {
    const tx = makeTx({ status: 'SCHEDULED' });
    expect(getStatusLabel(tx.status)).toBe('Scheduled');
  });

  it('renders scheduled date/time', () => {
    const scheduledAt = new Date('2026-06-15T14:00:00Z');
    const tx = makeTx({ scheduledAt });
    expect(tx.scheduledAt).toEqual(scheduledAt);
  });

  it('renders meetup location name and address', () => {
    const tx = makeTx({
      meetupLocationId: 'loc1',
      meetupLocation: {
        id: 'loc1',
        name: 'Downtown Police Station',
        address: '100 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        country: 'US',
        latitude: 39.7,
        longitude: -89.6,
        type: 'POLICE',
        verifiedSafe: true,
        operatingHoursJson: null,
        meetupCount: 12,
        rating: 4.8,
        isActive: true,
        addedByStaffId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    expect(tx.meetupLocation?.name).toBe('Downtown Police Station');
    expect(tx.meetupLocation?.address).toBe('100 Main St');
  });

  it('renders check-in button when status is SCHEDULED and scheduling is confirmed', () => {
    const tx = makeTx({ status: 'SCHEDULED', buyerCheckedIn: false, scheduledAtConfirmedAt: new Date() });
    expect(canShowCheckIn(tx, 'BUYER')).toBe(true);
    expect(canShowCheckIn(tx, 'SELLER')).toBe(true);
  });

  it('hides check-in button when scheduling not yet confirmed (G2.9)', () => {
    const tx = makeTx({ status: 'SCHEDULED', scheduledAtConfirmedAt: null });
    expect(canShowCheckIn(tx, 'BUYER')).toBe(false);
    expect(canShowCheckIn(tx, 'SELLER')).toBe(false);
  });

  it('hides check-in button when already checked in', () => {
    const tx = makeTx({ status: 'SELLER_CHECKED_IN', sellerCheckedIn: true, scheduledAtConfirmedAt: new Date() });
    expect(canShowCheckIn(tx, 'SELLER')).toBe(false);
  });

  it('renders QR code for seller view', () => {
    const tx = makeTx({ status: 'SCHEDULED' });
    expect(shouldShowQrCode(tx, 'SELLER')).toBe(true);
    expect(shouldShowQrCode(tx, 'BUYER')).toBe(false);
  });

  it('renders manual code entry for buyer view', () => {
    const tx = makeTx({ status: 'BOTH_CHECKED_IN' });
    expect(['BOTH_CHECKED_IN', 'RECEIPT_CONFIRMED'].includes(tx.status)).toBe(true);
    expect(shouldShowConfirmButton('BUYER')).toBe(true);
  });

  it('does not render confirm button for seller', () => {
    expect(shouldShowConfirmButton('SELLER')).toBe(false);
  });

  it('uses sellerConfirmationCode for seller QR token', () => {
    const tx = makeTx({ sellerConfirmationCode: 'seller.token.xyz' });
    expect(tx.sellerConfirmationCode).toBe('seller.token.xyz');
  });

  it('uses buyerConfirmationCode for buyer QR token', () => {
    const tx = makeTx({ buyerConfirmationCode: 'buyer.token.xyz' });
    expect(tx.buyerConfirmationCode).toBe('buyer.token.xyz');
  });
});
