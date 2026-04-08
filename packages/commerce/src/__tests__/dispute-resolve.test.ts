/**
 * Tests for the RESOLVED_BUYER waterfall call-site bug (D1 — CRITICAL).
 *
 * Decision #92 (LOCKED) requires recoverFromSellerWaterfall() to be called for
 * ALL refund-bearing resolutions, including RESOLVED_BUYER (full buyer win).
 *
 * Before the fix, resolveDispute() set refundAmount = undefined for RESOLVED_BUYER
 * and guarded with `if (refundAmount && refundAmount > 0)`, skipping the waterfall
 * for the most common dispute outcome.
 *
 * These tests verify:
 *   1. RESOLVED_BUYER + returnRequest — waterfall called with returnRequest.refundAmountCents
 *   2. RESOLVED_BUYER + no returnRequest — waterfall called with order.totalCents
 *   3. RESOLVED_BUYER + seller has zero balance — waterfall still called (platform absorbs)
 *   4. RESOLVED_SELLER — waterfall NOT called (no refund)
 *   5. RESOLVED_PARTIAL — waterfall called with resolutionAmountCents (existing path unchanged)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRecoverFromSellerWaterfall = vi.fn();
const mockProcessReturnRefund = vi.fn().mockResolvedValue({ success: true });
const mockNotify = vi.fn().mockResolvedValue(undefined);

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  dispute: {
    id: 'id',
    status: 'status',
    orderId: 'order_id',
    buyerId: 'buyer_id',
    sellerId: 'seller_id',
    resolvedByStaffId: 'resolved_by_staff_id',
    returnRequestId: 'return_request_id',
    resolutionNote: 'resolution_note',
    resolutionAmountCents: 'resolution_amount_cents',
    resolvedAt: 'resolved_at',
    updatedAt: 'updated_at',
  },
  order: {
    id: 'id',
    orderNumber: 'order_number',
    totalCents: 'total_cents',
  },
  returnRequest: {
    id: 'id',
    refundAmountCents: 'refund_amount_cents',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => args),
  isNull: vi.fn((col) => ({ isNull: col })),
}));

vi.mock('@twicely/notifications/service', () => ({ notify: mockNotify }));
vi.mock('@twicely/stripe/refunds', () => ({ processReturnRefund: mockProcessReturnRefund }));
vi.mock('../return-fee-apply', () => ({ applyReturnFees: vi.fn() }));
vi.mock('../dispute-recovery', () => ({ recoverFromSellerWaterfall: mockRecoverFromSellerWaterfall }));
vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { db } from '@twicely/db';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Make a single chainable select stub that resolves with `rows`.
 */
function makeSelectStub(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function buildUpdateMock() {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

const BASE_DISPUTE = {
  id: 'dispute-1',
  status: 'UNDER_REVIEW',
  orderId: 'order-1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  resolvedByStaffId: 'admin-1',
  returnRequestId: 'rr-1',
};

const BASE_DISPUTE_NO_RETURN = {
  ...BASE_DISPUTE,
  returnRequestId: null,
};

describe('resolveDispute — Decision #92 waterfall call-site', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRecoverFromSellerWaterfall.mockResolvedValue({
      recoveredFromAvailableCents: 0,
      recoveredFromReservedCents: 0,
      platformAbsorbedCents: 5000,
      totalCents: 5000,
    });
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  it('RESOLVED_BUYER: calls waterfall with returnRequest.refundAmountCents when present', async () => {
    const selectFn = vi.mocked(db.select);
    selectFn
      .mockReturnValueOnce(makeSelectStub([BASE_DISPUTE]) as never)            // dispute
      .mockReturnValueOnce(makeSelectStub([{ orderNumber: 'ORD-001', totalCents: 9000 }]) as never)  // order
      .mockReturnValueOnce(makeSelectStub([{ refundAmountCents: 5000 }]) as never);  // returnRequest

    vi.mocked(db.update).mockImplementation(buildUpdateMock() as never);

    const { resolveDispute } = await import('../dispute-queries');
    const result = await resolveDispute({
      adminId: 'admin-1',
      disputeId: 'dispute-1',
      resolution: 'RESOLVED_BUYER',
      resolutionNote: 'Buyer wins',
    });

    expect(result.success).toBe(true);
    expect(mockRecoverFromSellerWaterfall).toHaveBeenCalledOnce();
    expect(mockRecoverFromSellerWaterfall).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: 'seller-1',
        amountCents: 5000,
        disputeId: 'dispute-1',
        orderId: 'order-1',
      })
    );
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  it('RESOLVED_BUYER: falls back to order.totalCents when no returnRequest exists', async () => {
    const selectFn = vi.mocked(db.select);
    selectFn
      .mockReturnValueOnce(makeSelectStub([BASE_DISPUTE_NO_RETURN]) as never)  // dispute
      .mockReturnValueOnce(makeSelectStub([{ orderNumber: 'ORD-002', totalCents: 7500 }]) as never);  // order (no RR query)

    vi.mocked(db.update).mockImplementation(buildUpdateMock() as never);

    const { resolveDispute } = await import('../dispute-queries');
    const result = await resolveDispute({
      adminId: 'admin-1',
      disputeId: 'dispute-1',
      resolution: 'RESOLVED_BUYER',
      resolutionNote: 'Buyer wins, no return request',
    });

    expect(result.success).toBe(true);
    expect(mockRecoverFromSellerWaterfall).toHaveBeenCalledOnce();
    expect(mockRecoverFromSellerWaterfall).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: 'seller-1',
        amountCents: 7500,
      })
    );
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  it('RESOLVED_BUYER: still calls waterfall when waterfall result is full platform absorption', async () => {
    // Waterfall returns full absorption — the call must still happen even though
    // the seller has nothing to recover from. This is the key regression test.
    mockRecoverFromSellerWaterfall.mockResolvedValueOnce({
      recoveredFromAvailableCents: 0,
      recoveredFromReservedCents: 0,
      platformAbsorbedCents: 5000,
      totalCents: 5000,
    });

    const selectFn = vi.mocked(db.select);
    selectFn
      .mockReturnValueOnce(makeSelectStub([BASE_DISPUTE]) as never)
      .mockReturnValueOnce(makeSelectStub([{ orderNumber: 'ORD-003', totalCents: 5000 }]) as never)
      .mockReturnValueOnce(makeSelectStub([{ refundAmountCents: 5000 }]) as never);

    vi.mocked(db.update).mockImplementation(buildUpdateMock() as never);

    const { resolveDispute } = await import('../dispute-queries');
    const result = await resolveDispute({
      adminId: 'admin-1',
      disputeId: 'dispute-1',
      resolution: 'RESOLVED_BUYER',
      resolutionNote: 'Buyer wins',
    });

    expect(result.success).toBe(true);
    expect(mockRecoverFromSellerWaterfall).toHaveBeenCalledOnce();
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  it('RESOLVED_SELLER: does NOT call waterfall (no refund)', async () => {
    const selectFn = vi.mocked(db.select);
    selectFn
      .mockReturnValueOnce(makeSelectStub([BASE_DISPUTE]) as never)
      .mockReturnValueOnce(makeSelectStub([{ orderNumber: 'ORD-004', totalCents: 5000 }]) as never);

    vi.mocked(db.update).mockImplementation(buildUpdateMock() as never);

    const { resolveDispute } = await import('../dispute-queries');
    const result = await resolveDispute({
      adminId: 'admin-1',
      disputeId: 'dispute-1',
      resolution: 'RESOLVED_SELLER',
      resolutionNote: 'Seller wins',
    });

    expect(result.success).toBe(true);
    expect(mockRecoverFromSellerWaterfall).not.toHaveBeenCalled();
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────
  it('RESOLVED_PARTIAL: calls waterfall with resolutionAmountCents (existing path unchanged)', async () => {
    const selectFn = vi.mocked(db.select);
    // RESOLVED_PARTIAL uses resolutionAmountCents directly — no returnRequest query
    selectFn
      .mockReturnValueOnce(makeSelectStub([BASE_DISPUTE]) as never)
      .mockReturnValueOnce(makeSelectStub([{ orderNumber: 'ORD-005', totalCents: 9000 }]) as never);

    vi.mocked(db.update).mockImplementation(buildUpdateMock() as never);

    const { resolveDispute } = await import('../dispute-queries');
    const result = await resolveDispute({
      adminId: 'admin-1',
      disputeId: 'dispute-1',
      resolution: 'RESOLVED_PARTIAL',
      resolutionNote: 'Partial resolution',
      resolutionAmountCents: 3000,
    });

    expect(result.success).toBe(true);
    expect(mockRecoverFromSellerWaterfall).toHaveBeenCalledOnce();
    expect(mockRecoverFromSellerWaterfall).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 3000,
      })
    );
  });
});
