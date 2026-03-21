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
  getPlatformSetting: vi.fn().mockResolvedValue(500),
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
  createLocalTransactionLedgerEntries: vi.fn().mockResolvedValue(undefined),
  postConfirmationEffects: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@twicely/jobs/local-escrow-release', () => ({
  enqueueLocalEscrowRelease: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@twicely/commerce/local-reserve', () => ({
  reserveListingForLocalTransaction: vi.fn().mockResolvedValue({ success: true }),
  unreserveListingForLocalTransaction: vi.fn().mockResolvedValue(undefined),
  markListingSoldForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

// Stub the offline module to avoid circular issues
vi.mock('../local-transaction-offline', () => ({
  confirmReceiptOfflineAction: vi.fn(),
  confirmReceiptOfflineDualCodeAction: vi.fn(),
}));

import {
  confirmReceiptAction,
  confirmReceiptManualAction,
} from '../local-transaction';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import {
  validateSellerToken,
  validateSellerOfflineCode,
} from '@twicely/commerce/local-transaction';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockValidateSellerToken = vi.mocked(validateSellerToken);
const mockValidateSellerOfflineCode = vi.mocked(validateSellerOfflineCode);

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
    status: 'BOTH_CHECKED_IN',
    scheduledAt: new Date(Date.now() + 3600_000),
    sellerConfirmationCode: 'seller.token.abc',
    sellerOfflineCode: '123456',
    buyerConfirmationCode: 'buyer.token.abc',
    buyerOfflineCode: '654321',
    confirmationMode: null,
    sellerCheckedIn: true,
    sellerCheckedInAt: null,
    buyerCheckedIn: true,
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

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ─── confirmReceiptAction (QR online) ────────────────────────────────────────

describe('confirmReceiptAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms receipt via seller QR token (valid token)', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripeFeesCents: 175 }]) as never);
    mockUpdate.mockReturnValue(makeUpdateChain() as never);
    mockValidateSellerToken.mockResolvedValue({ valid: true, transaction: tx as never });

    const result = await confirmReceiptAction({
      localTransactionId: TX_ID,
      sellerToken: 'seller.token.abc',
    });

    expect(result).toEqual({ success: true });
    expect(mockValidateSellerToken).toHaveBeenCalledWith('seller.token.abc');
  });

  it('rejects invalid seller token', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockValidateSellerToken.mockResolvedValue({ valid: false, error: 'Invalid seller token' });

    const result = await confirmReceiptAction({
      localTransactionId: TX_ID,
      sellerToken: 'bad.token',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid seller token');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects expired seller token', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockValidateSellerToken.mockResolvedValue({ valid: false, error: 'Token expired' });

    const result = await confirmReceiptAction({
      localTransactionId: TX_ID,
      sellerToken: 'expired.token',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('rejects non-buyer (seller cannot confirm receipt via QR)', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(SELLER_ID, true) as never,
      ability: makeAbility() as never,
    });
    mockValidateSellerToken.mockResolvedValue({ valid: true, transaction: tx as never });

    const result = await confirmReceiptAction({
      localTransactionId: TX_ID,
      sellerToken: 'seller.token.abc',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects missing sellerToken field', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const incompleteInput = { localTransactionId: TX_ID };
    const result = await confirmReceiptAction(incompleteInput as Parameters<typeof confirmReceiptAction>[0]);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockValidateSellerToken).not.toHaveBeenCalled();
  });

  it('rejects extra fields via strict schema', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const badInput = { localTransactionId: TX_ID, sellerToken: 'token', extra: 'bad' };
    const result = await confirmReceiptAction(badInput as Parameters<typeof confirmReceiptAction>[0]);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── confirmReceiptManualAction (CODE_ONLINE) ─────────────────────────────────

describe('confirmReceiptManualAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms receipt with valid seller offline code', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripeFeesCents: 175 }]) as never);
    mockUpdate.mockReturnValue(makeUpdateChain() as never);
    mockValidateSellerOfflineCode.mockResolvedValue({ valid: true, transaction: tx as never });

    const result = await confirmReceiptManualAction({
      localTransactionId: TX_ID,
      sellerOfflineCode: '123456',
    });

    expect(result).toEqual({ success: true });
    expect(mockValidateSellerOfflineCode).toHaveBeenCalledWith('123456', TX_ID);
  });

  it('rejects invalid seller offline code', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockValidateSellerOfflineCode.mockResolvedValue({ valid: false, error: 'Invalid seller code' });

    const result = await confirmReceiptManualAction({
      localTransactionId: TX_ID,
      sellerOfflineCode: '999999',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid seller code');
  });

  it('rejects non-6-digit offline code via schema', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const result = await confirmReceiptManualAction({
      localTransactionId: TX_ID,
      sellerOfflineCode: '12345', // 5 digits
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockValidateSellerOfflineCode).not.toHaveBeenCalled();
  });
});
