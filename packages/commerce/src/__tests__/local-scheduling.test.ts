import { describe, it, expect, vi } from 'vitest';
import {
  validateProposedTime,
  isSchedulingComplete,
  canProposeMeetupTime,
  canRequestReschedule,
} from '../local-scheduling';

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation((_key: string, defaultValue: number) => Promise.resolve(defaultValue)),
}));
import type { LocalTransactionRow } from '@/lib/queries/local-transaction';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<LocalTransactionRow> = {}): LocalTransactionRow {
  return {
    id: 'lt-test-001',
    orderId: 'ord-test-001',
    buyerId: 'buyer-001',
    sellerId: 'seller-001',
    meetupLocationId: null,
    status: 'SCHEDULED',
    scheduledAt: null,
    scheduledAtConfirmedAt: null,
    schedulingProposedBy: null,
    sellerConfirmationCode: 'token.seller.abc',
    sellerOfflineCode: '123456',
    buyerConfirmationCode: 'token.buyer.abc',
    buyerOfflineCode: '654321',
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
    ...overrides,
  };
}

// ─── validateProposedTime ────────────────────────────────────────────────────

describe('validateProposedTime', () => {
  it('returns valid for a time 2 hours from now', async () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const result = await validateProposedTime(future);
    expect(result.valid).toBe(true);
  });

  it('returns error for a time 30 minutes from now (under 1hr minimum)', async () => {
    const tooSoon = new Date(Date.now() + 30 * 60 * 1000);
    const result = await validateProposedTime(tooSoon);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for a time 31 days from now (over 30-day max)', async () => {
    const tooFar = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const result = await validateProposedTime(tooFar);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for a time in the past', async () => {
    const past = new Date(Date.now() - 1000);
    const result = await validateProposedTime(past);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns valid for a time exactly 1 hour from now', async () => {
    // Add 1 hour + 5 seconds to safely clear the >= boundary
    const boundary = new Date(Date.now() + 60 * 60 * 1000 + 5000);
    const result = await validateProposedTime(boundary);
    expect(result.valid).toBe(true);
  });

  it('returns valid for a time exactly 30 days from now', async () => {
    // Subtract 5 seconds to safely stay within the max boundary
    const boundary = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 - 5000);
    const result = await validateProposedTime(boundary);
    expect(result.valid).toBe(true);
  });
});

// ─── isSchedulingComplete ────────────────────────────────────────────────────

describe('isSchedulingComplete', () => {
  it('returns true when scheduledAtConfirmedAt is set', () => {
    const tx = makeTx({ scheduledAtConfirmedAt: new Date() });
    expect(isSchedulingComplete(tx)).toBe(true);
  });

  it('returns false when scheduledAtConfirmedAt is null', () => {
    const tx = makeTx({ scheduledAtConfirmedAt: null });
    expect(isSchedulingComplete(tx)).toBe(false);
  });
});

// ─── canProposeMeetupTime ─────────────────────────────────────────────────────

describe('canProposeMeetupTime', () => {
  it('returns true for active transaction without confirmed time', () => {
    const tx = makeTx({ status: 'SCHEDULED', scheduledAtConfirmedAt: null });
    expect(canProposeMeetupTime(tx)).toBe(true);
  });

  it('returns false for COMPLETED status (terminal)', () => {
    const tx = makeTx({ status: 'COMPLETED', scheduledAtConfirmedAt: null });
    expect(canProposeMeetupTime(tx)).toBe(false);
  });

  it('returns false for CANCELED status (terminal)', () => {
    const tx = makeTx({ status: 'CANCELED', scheduledAtConfirmedAt: null });
    expect(canProposeMeetupTime(tx)).toBe(false);
  });

  it('returns false for NO_SHOW status (terminal)', () => {
    const tx = makeTx({ status: 'NO_SHOW', scheduledAtConfirmedAt: null });
    expect(canProposeMeetupTime(tx)).toBe(false);
  });

  it('returns false when scheduledAtConfirmedAt is set (already confirmed)', () => {
    const tx = makeTx({ status: 'SCHEDULED', scheduledAtConfirmedAt: new Date() });
    expect(canProposeMeetupTime(tx)).toBe(false);
  });
});

// ─── canRequestReschedule ─────────────────────────────────────────────────────

describe('canRequestReschedule', () => {
  it('returns true when status is SCHEDULED and scheduling is confirmed', () => {
    const tx = makeTx({ status: 'SCHEDULED', scheduledAtConfirmedAt: new Date() });
    expect(canRequestReschedule(tx)).toBe(true);
  });

  it('returns true when status is SELLER_CHECKED_IN and scheduling is confirmed', () => {
    const tx = makeTx({ status: 'SELLER_CHECKED_IN', scheduledAtConfirmedAt: new Date() });
    expect(canRequestReschedule(tx)).toBe(true);
  });

  it('returns true when status is BUYER_CHECKED_IN and scheduling is confirmed', () => {
    const tx = makeTx({ status: 'BUYER_CHECKED_IN', scheduledAtConfirmedAt: new Date() });
    expect(canRequestReschedule(tx)).toBe(true);
  });

  it('returns false when status is BOTH_CHECKED_IN', () => {
    const tx = makeTx({ status: 'BOTH_CHECKED_IN', scheduledAtConfirmedAt: new Date() });
    expect(canRequestReschedule(tx)).toBe(false);
  });

  it('returns false when status is RESCHEDULE_PENDING', () => {
    const tx = makeTx({ status: 'RESCHEDULE_PENDING', scheduledAtConfirmedAt: new Date() });
    expect(canRequestReschedule(tx)).toBe(false);
  });

  it('returns false when status is COMPLETED (terminal)', () => {
    const tx = makeTx({ status: 'COMPLETED', scheduledAtConfirmedAt: new Date() });
    expect(canRequestReschedule(tx)).toBe(false);
  });

  it('returns false when scheduledAtConfirmedAt is null', () => {
    const tx = makeTx({ status: 'SCHEDULED', scheduledAtConfirmedAt: null });
    expect(canRequestReschedule(tx)).toBe(false);
  });
});
