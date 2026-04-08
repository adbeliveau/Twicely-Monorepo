/**
 * Tests for local-transaction.ts
 *
 * Covers confirmLocalTransaction and recordCheckIn state machine guards (R8).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localTransaction: {
    id: 'id',
    status: 'status',
    sellerCheckedIn: 'seller_checked_in',
    buyerCheckedIn: 'buyer_checked_in',
    confirmationMode: 'confirmation_mode',
    confirmedAt: 'confirmed_at',
    offlineConfirmedAt: 'offline_confirmed_at',
    updatedAt: 'updated_at',
  },
  order: { id: 'id', itemSubtotalCents: 'item_subtotal_cents' },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@twicely/db/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockImplementation(
    (_key: string, fallback: unknown) => Promise.resolve(fallback),
  ),
}));

vi.mock('../local-token', () => ({
  generateTokenPair: vi.fn().mockReturnValue({
    sellerToken: 'seller-token',
    buyerToken: 'buyer-token',
    sellerOfflineCode: '111111',
    buyerOfflineCode: '222222',
    sellerNonce: 'nonce-s',
    buyerNonce: 'nonce-b',
  }),
}));

vi.mock('../local-reserve', () => ({
  reserveListingForLocalTransaction: vi.fn().mockResolvedValue(undefined),
}));

// Use real local-state-machine (pure logic, no deps)
vi.unmock('../local-state-machine');

import { db } from '@twicely/db';
import { confirmLocalTransaction, recordCheckIn } from '../local-transaction';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeUpdateChain(returning: unknown[] = [{ id: 'tx-1' }]) {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(returning),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

const TX_ID = 'lt-test-001';

// ─── confirmLocalTransaction ──────────────────────────────────────────────────

describe('confirmLocalTransaction — state machine guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds when status is BOTH_CHECKED_IN (valid transition)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'BOTH_CHECKED_IN' }]) as never,
    );
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await confirmLocalTransaction(TX_ID, 'QR_ONLINE');
    expect(result.success).toBe(true);
  });

  it('sets status to RECEIPT_CONFIRMED (not COMPLETED)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'BOTH_CHECKED_IN' }]) as never,
    );
    const updateChain = makeUpdateChain();
    vi.mocked(db.update).mockReturnValue(updateChain as never);

    await confirmLocalTransaction(TX_ID, 'QR_ONLINE');

    const setArgs = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.status).toBe('RECEIPT_CONFIRMED');
  });

  it('rejects confirm-receipt when status is SCHEDULED (not BOTH_CHECKED_IN)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'SCHEDULED' }]) as never,
    );

    const result = await confirmLocalTransaction(TX_ID, 'QR_ONLINE');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from SCHEDULED/);
  });

  it('rejects confirm-receipt when status is RESCHEDULE_PENDING (cannot skip to receipt)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'RESCHEDULE_PENDING' }]) as never,
    );

    const result = await confirmLocalTransaction(TX_ID, 'CODE_ONLINE');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from RESCHEDULE_PENDING/);
  });

  it('rejects confirm-receipt when status is CANCELED (terminal state)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'CANCELED' }]) as never,
    );

    const result = await confirmLocalTransaction(TX_ID, 'QR_ONLINE');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from CANCELED/);
  });

  it('returns success (idempotent) when status is already RECEIPT_CONFIRMED', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'RECEIPT_CONFIRMED' }]) as never,
    );

    const result = await confirmLocalTransaction(TX_ID, 'QR_ONLINE');

    expect(result.success).toBe(true);
    // Must NOT have issued a DB update
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('returns error when transaction not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    const result = await confirmLocalTransaction(TX_ID, 'QR_ONLINE');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
  });
});

// ─── recordCheckIn ────────────────────────────────────────────────────────────

describe('recordCheckIn — state machine guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows SELLER check-in when status is SCHEDULED', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'SCHEDULED', sellerCheckedIn: false, buyerCheckedIn: false }]) as never,
    );
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await recordCheckIn(TX_ID, 'SELLER');

    expect(result.success).toBe(true);
    expect(result.bothCheckedIn).toBe(false);
  });

  it('allows BUYER check-in when status is SCHEDULED', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'SCHEDULED', sellerCheckedIn: false, buyerCheckedIn: false }]) as never,
    );
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await recordCheckIn(TX_ID, 'BUYER');

    expect(result.success).toBe(true);
    expect(result.bothCheckedIn).toBe(false);
  });

  it('allows second check-in when status is SELLER_CHECKED_IN and BUYER checks in', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'SELLER_CHECKED_IN', sellerCheckedIn: true, buyerCheckedIn: false }]) as never,
    );
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await recordCheckIn(TX_ID, 'BUYER');

    expect(result.success).toBe(true);
    expect(result.bothCheckedIn).toBe(true);
  });

  it('allows second check-in when status is BUYER_CHECKED_IN and SELLER checks in', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'BUYER_CHECKED_IN', sellerCheckedIn: false, buyerCheckedIn: true }]) as never,
    );
    vi.mocked(db.update).mockReturnValue(makeUpdateChain() as never);

    const result = await recordCheckIn(TX_ID, 'SELLER');

    expect(result.success).toBe(true);
    expect(result.bothCheckedIn).toBe(true);
  });

  it('rejects check-in when status is CANCELED (invalid transition)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'CANCELED', sellerCheckedIn: false, buyerCheckedIn: false }]) as never,
    );

    const result = await recordCheckIn(TX_ID, 'SELLER');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from CANCELED/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('rejects check-in when status is BOTH_CHECKED_IN (already done)', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectChain([{ id: TX_ID, status: 'BOTH_CHECKED_IN', sellerCheckedIn: true, buyerCheckedIn: true }]) as never,
    );

    const result = await recordCheckIn(TX_ID, 'SELLER');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot transition from BOTH_CHECKED_IN/);
    expect(vi.mocked(db.update)).not.toHaveBeenCalled();
  });

  it('returns error when transaction not found', async () => {
    vi.mocked(db.select).mockReturnValue(makeSelectChain([]) as never);

    const result = await recordCheckIn(TX_ID, 'BUYER');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
  });
});
