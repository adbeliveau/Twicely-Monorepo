/**
 * Admin Orders Enriched Queries Tests (I4)
 * Covers getEnrichedPaymentsList, getOrderItems, getOrderPayment, getOrderDisputes,
 * and enhanced getAdminOrderList with payment status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEnrichedPaymentsList,
  getOrderItems,
  getOrderPayment,
  getOrderDisputes,
  getAdminOrderList,
} from '../admin-orders';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
vi.mock('@twicely/db', () => ({
  db: { select: (...args: unknown[]) => mockDbSelect(...args) },
}));
vi.mock('@twicely/db/schema', () => ({
  order: { id: 'id', orderNumber: 'order_number', buyerId: 'buyer_id', sellerId: 'seller_id', status: 'status', totalCents: 'total_cents', createdAt: 'created_at', isLocalPickup: 'is_local_pickup', paymentIntentId: 'payment_intent_id' },
  user: { id: 'id', name: 'name', email: 'email' },
  ledgerEntry: { id: 'id', orderId: 'order_id', createdAt: 'created_at' },
  orderItem: { id: 'id', orderId: 'order_id', title: 'title', quantity: 'quantity', unitPriceCents: 'unit_price_cents', tfRateBps: 'tf_rate_bps', tfAmountCents: 'tf_amount_cents', feeBucket: 'fee_bucket', createdAt: 'created_at' },
  orderPayment: { id: 'id', orderId: 'order_id', stripePaymentIntentId: 'stripe_payment_intent_id', stripeChargeId: 'stripe_charge_id', status: 'status', amountCents: 'amount_cents', stripeFeesCents: 'stripe_fees_cents', tfAmountCents: 'tf_amount_cents', tfRateBps: 'tf_rate_bps', boostFeeAmountCents: 'boost_fee_amount_cents', netToSellerCents: 'net_to_seller_cents', capturedAt: 'captured_at', refundedAt: 'refunded_at', refundAmountCents: 'refund_amount_cents', createdAt: 'created_at' },
  dispute: { id: 'id', orderId: 'order_id', claimType: 'claim_type', status: 'status', resolutionAmountCents: 'resolution_amount_cents', createdAt: 'created_at' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  or: (...args: unknown[]) => ({ type: 'or', args }),
  eq: (_col: unknown, _val: unknown) => ({ type: 'eq' }),
  gte: (_col: unknown, _val: unknown) => ({ type: 'gte' }),
  lte: (_col: unknown, _val: unknown) => ({ type: 'lte' }),
  desc: (_col: unknown) => ({ type: 'desc' }),
  count: () => ({ type: 'count' }),
  inArray: (_col: unknown, _arr: unknown) => ({ type: 'inArray' }),
  ilike: (_col: unknown, _pat: unknown) => ({ type: 'ilike' }),
  isNotNull: (_col: unknown) => ({ type: 'isNotNull' }),
  sql: Object.assign(
    (_strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: 'sql' }),
    { append: vi.fn() }
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00Z');

function makeSelectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    then: (resolve: (val: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'innerJoin', 'leftJoin'].forEach((key) => {
    chain[key] = vi.fn().mockReturnValue(chain);
  });
  return chain;
}

function makeOrderRow() {
  return {
    id: 'order-1',
    orderNumber: 'TW-001',
    buyerId: 'user-b',
    sellerId: 'user-s',
    status: 'COMPLETED',
    totalCents: 5000,
    createdAt: NOW,
  };
}

// ─── getEnrichedPaymentsList ──────────────────────────────────────────────────

describe('getEnrichedPaymentsList', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns orderPayment data with order number', async () => {
    const paymentRow = {
      id: 'op-1',
      orderId: 'order-1',
      stripePaymentIntentId: 'pi_abc',
      status: 'captured',
      amountCents: 5000,
      stripeFeesCents: 175,
      tfAmountCents: 500,
      netToSellerCents: 4325,
      capturedAt: NOW,
      createdAt: NOW,
    };

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([paymentRow]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'order-1', orderNumber: 'TW-001' }]));

    const { payments } = await getEnrichedPaymentsList({ page: 1, pageSize: 50 });

    expect(payments).toHaveLength(1);
    expect(payments[0]?.orderNumber).toBe('TW-001');
    expect(payments[0]?.amountCents).toBe(5000);
  });

  it('filters by status', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { payments } = await getEnrichedPaymentsList({ page: 1, pageSize: 50, status: 'refunded' });

    expect(payments).toHaveLength(0);
  });

  it('paginates correctly', async () => {
    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 100 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { total } = await getEnrichedPaymentsList({ page: 2, pageSize: 10 });

    expect(total).toBe(100);
  });
});

// ─── getOrderItems ────────────────────────────────────────────────────────────

describe('getOrderItems', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns items with TF breakdown for an order', async () => {
    const item = {
      id: 'oi-1',
      orderId: 'order-1',
      title: 'Nike Air Jordan',
      quantity: 1,
      unitPriceCents: 5000,
      tfRateBps: 1000,
      tfAmountCents: 500,
      feeBucket: null,
      createdAt: NOW,
    };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([item]));

    const items = await getOrderItems('order-1');

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe('Nike Air Jordan');
    expect(items[0]?.tfAmountCents).toBe(500);
  });

  it('returns empty array when no items for order', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const items = await getOrderItems('no-items-order');

    expect(items).toHaveLength(0);
  });
});

// ─── getOrderPayment ──────────────────────────────────────────────────────────

describe('getOrderPayment', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns payment with all fee columns', async () => {
    const payment = {
      id: 'op-1',
      orderId: 'order-1',
      amountCents: 5000,
      stripeFeesCents: 175,
      tfAmountCents: 500,
      tfRateBps: 1000,
      boostFeeAmountCents: 0,
      netToSellerCents: 4325,
      status: 'captured',
    };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([payment]));

    const result = await getOrderPayment('order-1');

    expect(result).not.toBeNull();
    expect(result?.netToSellerCents).toBe(4325);
    expect(result?.stripeFeesCents).toBe(175);
  });

  it('returns null when no payment exists for order', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const result = await getOrderPayment('no-payment-order');

    expect(result).toBeNull();
  });
});

// ─── getOrderDisputes ─────────────────────────────────────────────────────────

describe('getOrderDisputes', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns disputes for an order', async () => {
    const disputeRow = {
      id: 'disp-1',
      orderId: 'order-1',
      claimType: 'INAD',
      status: 'OPEN',
      resolutionAmountCents: null,
      createdAt: NOW,
    };
    mockDbSelect.mockReturnValueOnce(makeSelectChain([disputeRow]));

    const disputes = await getOrderDisputes('order-1');

    expect(disputes).toHaveLength(1);
    expect(disputes[0]?.claimType).toBe('INAD');
  });

  it('returns empty array for order with no disputes', async () => {
    mockDbSelect.mockReturnValueOnce(makeSelectChain([]));

    const disputes = await getOrderDisputes('order-no-disputes');

    expect(disputes).toHaveLength(0);
  });
});

// ─── getAdminOrderList (enhanced) ────────────────────────────────────────────

describe('getAdminOrderList (enhanced with payment status)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns payment status via LEFT JOIN on orderPayment', async () => {
    const orderRow = makeOrderRow();

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([orderRow]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'user-b', name: 'Bob' }, { id: 'user-s', name: 'Sally' }]))
      .mockReturnValueOnce(makeSelectChain([{ orderId: 'order-1', status: 'captured' }]));

    const { orders } = await getAdminOrderList({ page: 1, pageSize: 50 });

    expect(orders[0]?.paymentStatus).toBe('captured');
  });

  it('sets paymentStatus to null when no payment exists for order', async () => {
    const orderRow = makeOrderRow();

    mockDbSelect
      .mockReturnValueOnce(makeSelectChain([{ count: 1 }]))
      .mockReturnValueOnce(makeSelectChain([orderRow]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'user-b', name: 'Bob' }, { id: 'user-s', name: 'Sally' }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const { orders } = await getAdminOrderList({ page: 1, pageSize: 50 });

    expect(orders[0]?.paymentStatus).toBeNull();
  });
});
