import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@twicely/casl', () => ({
  authorize: vi.fn(),
  sub: vi.fn((_type: string, cond: Record<string, unknown>) => cond),
}));

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn(),
}));

vi.mock('@twicely/commerce/local-transaction', () => ({
  recordCheckIn: vi.fn(),
  validateSellerToken: vi.fn(),
  validateSellerOfflineCode: vi.fn(),
  validateBuyerToken: vi.fn(),
  validateBuyerOfflineCode: vi.fn(),
  confirmLocalTransaction: vi.fn(),
}));

vi.mock('@twicely/commerce/local-state-machine', () => ({
  canTransition: vi.fn().mockReturnValue(true),
}));

vi.mock('@twicely/commerce/local-ledger', () => ({
  postConfirmationEffects: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/commerce/local-reserve', () => ({
  reserveListingForLocalTransaction: vi.fn().mockResolvedValue({ success: true }),
  unreserveListingForLocalTransaction: vi.fn().mockResolvedValue(undefined),
  markListingSoldForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/jobs/local-noshow-check', () => ({
  enqueueNoShowCheck: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/jobs/local-safety-timer', () => ({
  enqueueSafetyNudge: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/messaging/local-auto-messages', () => ({
  sendLocalAutoMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../local-transaction-offline', () => ({
  confirmReceiptOfflineAction: vi.fn(),
  confirmReceiptOfflineDualCodeAction: vi.fn(),
}));

import {
  checkInToMeetupAction,
} from '../local-transaction';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import { getPlatformSetting } from '@/lib/queries/platform-settings';
import {
  recordCheckIn,
} from '@twicely/commerce/local-transaction';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockGetPlatformSetting = vi.mocked(getPlatformSetting);
const mockRecordCheckIn = vi.mocked(recordCheckIn);

const BUYER_ID = 'buyer-user-001';
const SELLER_ID = 'seller-user-001';
const TX_ID = 'tx-local-001';

function makeSession(userId: string, isSeller = false) {
  return {
    userId,
    isSeller,
    delegationId: null,
    onBehalfOfSellerId: null,
  };
}

function makeAbility(canUpdate = true) {
  return { can: vi.fn().mockReturnValue(canUpdate) };
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    orderId: 'order-001',
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    status: 'SCHEDULED',
    scheduledAt: new Date(Date.now() + 3600_000), // 1h from now
    // G2.9: scheduledAtConfirmedAt must be set for check-in to be allowed
    scheduledAtConfirmedAt: new Date(),
    schedulingProposedBy: SELLER_ID,
    sellerConfirmationCode: 'seller.token.abc',
    sellerOfflineCode: '123456',
    buyerConfirmationCode: 'buyer.token.abc',
    buyerOfflineCode: '654321',
    confirmationMode: null,
    sellerCheckedIn: false,
    sellerCheckedInAt: null,
    buyerCheckedIn: false,
    buyerCheckedInAt: null,
    confirmedAt: null,
    offlineConfirmedAt: null,
    syncedAt: null,
    meetupLocationId: null,
    safetyAlertSent: false,
    safetyAlertAt: null,
    noShowParty: null,
    noShowFeeCents: null,
    noShowFeeChargedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function selectChain(rows: unknown[]) {
  return mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never);
}

// ─── checkInToMeetupAction ─────────────────────────────────────────────────────

describe('checkInToMeetupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformSetting.mockResolvedValue(48);
    mockRecordCheckIn.mockResolvedValue({ success: true, bothCheckedIn: false });
  });

  it('records buyer check-in successfully', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    selectChain([makeTransaction()]);

    const result = await checkInToMeetupAction({ localTransactionId: TX_ID });

    expect(result.success).toBe(true);
    expect(mockRecordCheckIn).toHaveBeenCalledWith(TX_ID, 'BUYER');
  });

  it('records seller check-in successfully', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(SELLER_ID, true) as never,
      ability: makeAbility() as never,
    });
    selectChain([makeTransaction()]);

    const result = await checkInToMeetupAction({ localTransactionId: TX_ID });

    expect(result.success).toBe(true);
    expect(mockRecordCheckIn).toHaveBeenCalledWith(TX_ID, 'SELLER');
  });

  it('returns bothCheckedIn=true when second party checks in', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    selectChain([makeTransaction({ sellerCheckedIn: true })]);
    mockRecordCheckIn.mockResolvedValue({ success: true, bothCheckedIn: true });

    const result = await checkInToMeetupAction({ localTransactionId: TX_ID });

    expect(result.success).toBe(true);
    expect(result.bothCheckedIn).toBe(true);
  });

  it('rejects check-in for non-participant', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession('other-user-999') as never,
      ability: makeAbility() as never,
    });
    selectChain([makeTransaction()]);

    const result = await checkInToMeetupAction({ localTransactionId: TX_ID });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
    expect(mockRecordCheckIn).not.toHaveBeenCalled();
  });

  it('rejects check-in for already completed transaction', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    selectChain([makeTransaction({ status: 'COMPLETED' })]);

    const result = await checkInToMeetupAction({ localTransactionId: TX_ID });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not in valid state');
    expect(mockRecordCheckIn).not.toHaveBeenCalled();
  });

  it('rejects check-in for canceled transaction', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    selectChain([makeTransaction({ status: 'CANCELED' })]);

    const result = await checkInToMeetupAction({ localTransactionId: TX_ID });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not in valid state');
    expect(mockRecordCheckIn).not.toHaveBeenCalled();
  });

  it('rejects missing localTransactionId', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const result = await checkInToMeetupAction({ localTransactionId: '' });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('rejects extra fields via strict schema', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const badInput = { localTransactionId: TX_ID, extra: 'bad' };
    const result = await checkInToMeetupAction(badInput as Parameters<typeof checkInToMeetupAction>[0]);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
