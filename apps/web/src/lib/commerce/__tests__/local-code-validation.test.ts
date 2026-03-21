/**
 * Tests for dual-token validation (G2.7).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {
    sellerConfirmationCode: 'seller_confirmation_code',
    buyerConfirmationCode: 'buyer_confirmation_code',
    id: 'id',
  },
}));

vi.mock('@twicely/commerce/local-token', () => ({
  verifyTokenServer: vi.fn(),
}));

import { db } from '@twicely/db';
import { verifyTokenServer } from '@twicely/commerce/local-token';
import {
  validateSellerToken,
  validateBuyerToken,
  validateSellerOfflineCode,
  validateBuyerOfflineCode,
} from '../local-code-validation';

const mockSelect = vi.mocked(db.select);
const mockVerifyServer = vi.mocked(verifyTokenServer);

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-001',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    sellerConfirmationCode: 'seller.token.abc',
    sellerOfflineCode: '123456',
    buyerConfirmationCode: 'buyer.token.abc',
    buyerOfflineCode: '654321',
    confirmedAt: null,
    ...overrides,
  };
}

// ─── validateSellerToken ─────────────────────────────────────────────────────

describe('validateSellerToken', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns valid=true for a valid seller token', async () => {
    mockVerifyServer.mockReturnValue({
      valid: true,
      payload: { role: 'SELLER', transactionId: 'tx-001', amountCents: 5000, buyerId: 'b', sellerId: 's', expiresAt: '', nonce: 'n' },
    });
    mockSelect.mockReturnValue(makeSelectChain([makeTransaction()]) as never);

    const result = await validateSellerToken('seller.token.abc');
    expect(result.valid).toBe(true);
    expect(result.transaction?.id).toBe('tx-001');
  });

  it('returns valid=false when server verification fails', async () => {
    mockVerifyServer.mockReturnValue({ valid: false, error: 'Invalid signature' });

    const result = await validateSellerToken('bad.token');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid signature');
  });

  it('returns valid=false when role is not SELLER', async () => {
    mockVerifyServer.mockReturnValue({
      valid: true,
      payload: { role: 'BUYER', transactionId: 'tx-001', amountCents: 5000, buyerId: 'b', sellerId: 's', expiresAt: '', nonce: 'n' },
    });

    const result = await validateSellerToken('buyer.token.abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token role mismatch');
  });

  it('returns valid=false when token not found in DB', async () => {
    mockVerifyServer.mockReturnValue({
      valid: true,
      payload: { role: 'SELLER', transactionId: 'tx-001', amountCents: 5000, buyerId: 'b', sellerId: 's', expiresAt: '', nonce: 'n' },
    });
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await validateSellerToken('seller.token.notindb');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid seller token');
  });

  it('returns valid=false when token already used', async () => {
    mockVerifyServer.mockReturnValue({
      valid: true,
      payload: { role: 'SELLER', transactionId: 'tx-001', amountCents: 5000, buyerId: 'b', sellerId: 's', expiresAt: '', nonce: 'n' },
    });
    mockSelect.mockReturnValue(makeSelectChain([makeTransaction({ confirmedAt: new Date() })]) as never);

    const result = await validateSellerToken('seller.token.abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token already used');
  });
});

// ─── validateBuyerToken ──────────────────────────────────────────────────────

describe('validateBuyerToken', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns valid=true for a valid buyer token', async () => {
    mockVerifyServer.mockReturnValue({
      valid: true,
      payload: { role: 'BUYER', transactionId: 'tx-001', amountCents: 5000, buyerId: 'b', sellerId: 's', expiresAt: '', nonce: 'n' },
    });
    mockSelect.mockReturnValue(makeSelectChain([makeTransaction()]) as never);

    const result = await validateBuyerToken('buyer.token.abc');
    expect(result.valid).toBe(true);
  });

  it('returns valid=false when role is not BUYER', async () => {
    mockVerifyServer.mockReturnValue({
      valid: true,
      payload: { role: 'SELLER', transactionId: 'tx-001', amountCents: 5000, buyerId: 'b', sellerId: 's', expiresAt: '', nonce: 'n' },
    });

    const result = await validateBuyerToken('seller.token.abc');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token role mismatch');
  });
});

// ─── validateSellerOfflineCode ───────────────────────────────────────────────

describe('validateSellerOfflineCode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns valid=true for a matching 6-digit seller code', async () => {
    mockSelect.mockReturnValue(makeSelectChain([makeTransaction()]) as never);

    const result = await validateSellerOfflineCode('123456', 'tx-001');
    expect(result.valid).toBe(true);
    expect(result.transaction?.id).toBe('tx-001');
  });

  it('returns valid=false for non-6-digit code', async () => {
    const result = await validateSellerOfflineCode('12345', 'tx-001');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid code format');
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns valid=false when code does not match', async () => {
    mockSelect.mockReturnValue(makeSelectChain([makeTransaction()]) as never);

    const result = await validateSellerOfflineCode('999999', 'tx-001');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid seller code');
  });

  it('returns valid=false when transaction not found', async () => {
    mockSelect.mockReturnValue(makeSelectChain([]) as never);

    const result = await validateSellerOfflineCode('123456', 'tx-missing');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Transaction not found');
  });
});

// ─── validateBuyerOfflineCode ────────────────────────────────────────────────

describe('validateBuyerOfflineCode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns valid=true for a matching 6-digit buyer code', async () => {
    mockSelect.mockReturnValue(makeSelectChain([makeTransaction()]) as never);

    const result = await validateBuyerOfflineCode('654321', 'tx-001');
    expect(result.valid).toBe(true);
  });

  it('returns valid=false when code does not match', async () => {
    mockSelect.mockReturnValue(makeSelectChain([makeTransaction()]) as never);

    const result = await validateBuyerOfflineCode('111111', 'tx-001');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid buyer code');
  });
});
