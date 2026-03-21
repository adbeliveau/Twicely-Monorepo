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

import {
  confirmReceiptOfflineAction,
  confirmReceiptOfflineDualCodeAction,
} from '../local-transaction-offline';
import { authorize } from '@twicely/casl';
import { db } from '@twicely/db';
import {
  validateSellerToken,
  validateBuyerToken,
  validateSellerOfflineCode,
  validateBuyerOfflineCode,
} from '@twicely/commerce/local-transaction';

const mockAuthorize = vi.mocked(authorize);
const mockSelect = vi.mocked(db.select);
const mockUpdate = vi.mocked(db.update);
const mockValidateSellerToken = vi.mocked(validateSellerToken);
const mockValidateSellerOfflineCode = vi.mocked(validateSellerOfflineCode);
const mockValidateBuyerToken = vi.mocked(validateBuyerToken);
const mockValidateBuyerOfflineCode = vi.mocked(validateBuyerOfflineCode);

const BUYER_ID = 'buyer-user-001';
const SELLER_ID = 'seller-user-001';
const TX_ID = 'tx-local-001';
const VALID_TIMESTAMP = '2026-03-10T12:00:00.000Z';

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

// ─── confirmReceiptOfflineAction (QR_DUAL_OFFLINE) ───────────────────────────

describe('confirmReceiptOfflineAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('confirms receipt with valid seller and buyer tokens', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripeFeesCents: 175 }]) as never);
    mockValidateSellerToken.mockResolvedValue({ valid: true, transaction: tx as never });
    mockValidateBuyerToken.mockResolvedValue({ valid: true, transaction: tx as never });

    const result = await confirmReceiptOfflineAction({
      localTransactionId: TX_ID,
      sellerToken: 'seller.token.abc',
      buyerToken: 'buyer.token.abc',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    expect(result).toEqual({ success: true });
    expect(mockValidateSellerToken).toHaveBeenCalledWith('seller.token.abc');
    expect(mockValidateBuyerToken).toHaveBeenCalledWith('buyer.token.abc');
  });

  it('sets offlineConfirmedAt from client timestamp', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripeFeesCents: 175 }]) as never);
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: setMock } as never);
    mockValidateSellerToken.mockResolvedValue({ valid: true, transaction: tx as never });
    mockValidateBuyerToken.mockResolvedValue({ valid: true, transaction: tx as never });

    await confirmReceiptOfflineAction({
      localTransactionId: TX_ID,
      sellerToken: 'seller.token.abc',
      buyerToken: 'buyer.token.abc',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    const firstCall = setMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const setArg = firstCall![0] as Record<string, unknown>;
    expect(setArg.offlineConfirmedAt).toEqual(new Date(VALID_TIMESTAMP));
    expect(setArg.confirmationMode).toBe('QR_DUAL_OFFLINE');
  });

  it('rejects when seller token is invalid', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockValidateSellerToken.mockResolvedValue({ valid: false, error: 'Invalid seller token' });

    const result = await confirmReceiptOfflineAction({
      localTransactionId: TX_ID,
      sellerToken: 'bad.seller.token',
      buyerToken: 'buyer.token.abc',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid seller token');
    expect(mockValidateBuyerToken).not.toHaveBeenCalled();
  });

  it('rejects when buyer token is invalid', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockValidateSellerToken.mockResolvedValue({ valid: true, transaction: tx as never });
    mockValidateBuyerToken.mockResolvedValue({ valid: false, error: 'Invalid buyer token' });

    const result = await confirmReceiptOfflineAction({
      localTransactionId: TX_ID,
      sellerToken: 'seller.token.abc',
      buyerToken: 'bad.buyer.token',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid buyer token');
  });

  it('is idempotent — returns success if already confirmed', async () => {
    const tx = makeTransaction({ confirmedAt: new Date() });
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockValidateSellerToken.mockResolvedValue({ valid: true, transaction: tx as never });

    const result = await confirmReceiptOfflineAction({
      localTransactionId: TX_ID,
      sellerToken: 'seller.token.abc',
      buyerToken: 'buyer.token.abc',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects extra fields via strict schema', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const badInput = {
      localTransactionId: TX_ID,
      sellerToken: 'seller.token',
      buyerToken: 'buyer.token',
      offlineTimestamp: VALID_TIMESTAMP,
      extra: 'bad',
    };
    const result = await confirmReceiptOfflineAction(
      badInput as Parameters<typeof confirmReceiptOfflineAction>[0]
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── confirmReceiptOfflineDualCodeAction (CODE_DUAL_OFFLINE) ──────────────────

describe('confirmReceiptOfflineDualCodeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(makeUpdateChain() as never);
  });

  it('confirms receipt with valid seller and buyer offline codes', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripeFeesCents: 175 }]) as never);
    mockValidateSellerOfflineCode.mockResolvedValue({ valid: true, transaction: tx as never });
    mockValidateBuyerOfflineCode.mockResolvedValue({ valid: true, transaction: tx as never });

    const result = await confirmReceiptOfflineDualCodeAction({
      localTransactionId: TX_ID,
      sellerOfflineCode: '123456',
      buyerOfflineCode: '654321',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    expect(result).toEqual({ success: true });
    expect(mockValidateSellerOfflineCode).toHaveBeenCalledWith('123456', TX_ID);
    expect(mockValidateBuyerOfflineCode).toHaveBeenCalledWith('654321', TX_ID);
  });

  it('sets confirmationMode to CODE_DUAL_OFFLINE', async () => {
    const tx = makeTransaction();
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ itemSubtotalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeSelectChain([{ stripeFeesCents: 175 }]) as never);
    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: setMock } as never);
    mockValidateSellerOfflineCode.mockResolvedValue({ valid: true, transaction: tx as never });
    mockValidateBuyerOfflineCode.mockResolvedValue({ valid: true, transaction: tx as never });

    await confirmReceiptOfflineDualCodeAction({
      localTransactionId: TX_ID,
      sellerOfflineCode: '123456',
      buyerOfflineCode: '654321',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    const firstCall = setMock.mock.calls[0];
    const setArg = firstCall![0] as Record<string, unknown>;
    expect(setArg.confirmationMode).toBe('CODE_DUAL_OFFLINE');
  });

  it('rejects invalid seller offline code format via schema', async () => {
    mockAuthorize.mockResolvedValue({
      session: makeSession(BUYER_ID) as never,
      ability: makeAbility() as never,
    });

    const result = await confirmReceiptOfflineDualCodeAction({
      localTransactionId: TX_ID,
      sellerOfflineCode: '12345', // 5 digits
      buyerOfflineCode: '654321',
      offlineTimestamp: VALID_TIMESTAMP,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockValidateSellerOfflineCode).not.toHaveBeenCalled();
  });
});
