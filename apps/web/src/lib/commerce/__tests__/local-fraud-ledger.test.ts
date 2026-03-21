import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@twicely/db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@twicely/db/schema', () => ({
  localFraudFlag: {
    id: 'id',
    sellerId: 'seller_id',
    localTransactionId: 'local_transaction_id',
    listingId: 'listing_id',
    refundIssuedAt: 'refund_issued_at',
    sellerBannedAt: 'seller_banned_at',
    status: 'status',
    updatedAt: 'updated_at',
    listingRemovedAt: 'listing_removed_at',
  },
  localTransaction: { id: 'id', orderId: 'order_id' },
  ledgerEntry: {},
  user: { id: 'id', updatedAt: 'updated_at', localFraudBannedAt: 'local_fraud_banned_at' },
  listing: { id: 'id', updatedAt: 'updated_at', enforcementState: 'enforcement_state' },
  sellerProfile: { userId: 'user_id', status: 'status', updatedAt: 'updated_at' },
  order: { id: 'id', itemSubtotalCents: 'item_subtotal_cents' },
  orderPayment: { orderId: 'order_id', stripePaymentIntentId: 'stripe_payment_intent_id' },
  auditEvent: {},
}));

vi.mock('@twicely/stripe/server', () => ({
  stripe: { refunds: { create: vi.fn() } },
}));

const mockNotify = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@twicely/notifications/service', () => ({
  notify: mockNotify,
}));

vi.mock('@/lib/queries/platform-settings', () => ({
  getPlatformSetting: vi.fn().mockResolvedValue(2),
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { db } from '@twicely/db';
import { createFraudReversalLedgerEntry } from '../local-fraud-consequences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FLAG_ID = 'flag-ledger-001';
const SELLER_ID = 'seller-ledger-001';
const ORDER_ID = 'ord-ledger-001';
const REFUND_ID = 'refund-ledger-001';

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

function makeInsertChain() {
  const chain = { values: vi.fn().mockResolvedValue(undefined) };
  chain.values.mockReturnValue(chain);
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createFraudReversalLedgerEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify.mockResolvedValue(undefined);
  });

  it('inserts LOCAL_FRAUD_REVERSAL entry with negated amountCents', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: 5000 }]) as never,
    );
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createFraudReversalLedgerEntry(ORDER_ID, SELLER_ID, REFUND_ID, FLAG_ID);

    const inserted = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted?.type).toBe('LOCAL_FRAUD_REVERSAL');
    expect(inserted?.amountCents).toBe(-5000);
    expect(inserted?.stripeRefundId).toBe(REFUND_ID);
    expect(inserted?.userId).toBe(SELLER_ID);
    expect(inserted?.status).toBe('POSTED');
  });

  it('uses 0 for amountCents when order not found (fallback = 0, -0 is acceptable)', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelectChain([]) as never);
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createFraudReversalLedgerEntry(ORDER_ID, SELLER_ID, REFUND_ID, FLAG_ID);

    const inserted = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Math.abs(Number(inserted?.amountCents))).toBe(0);
  });

  it('includes reasonCode referencing fraudFlagId', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: 0 }]) as never,
    );
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createFraudReversalLedgerEntry(ORDER_ID, SELLER_ID, REFUND_ID, FLAG_ID);

    const inserted = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(inserted?.reasonCode)).toContain(FLAG_ID);
  });

  it('uses amountCents = -1500 for a 1500 cent order', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: 1500 }]) as never,
    );
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createFraudReversalLedgerEntry(ORDER_ID, SELLER_ID, REFUND_ID, FLAG_ID);

    const inserted = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted?.amountCents).toBe(-1500);
  });

  it('sets orderId correctly on the ledger entry', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectChain([{ itemSubtotalCents: 2000 }]) as never,
    );
    const insertChain = makeInsertChain();
    vi.mocked(db.insert).mockReturnValue(insertChain as never);

    await createFraudReversalLedgerEntry(ORDER_ID, SELLER_ID, REFUND_ID, FLAG_ID);

    const inserted = vi.mocked(insertChain.values).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted?.orderId).toBe(ORDER_ID);
  });
});
