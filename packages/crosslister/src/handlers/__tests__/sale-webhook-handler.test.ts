/**
 * Unit tests for Whatnot sale webhook handler.
 * Source: H2.3 install prompt §5 (Unit Tests — Whatnot Sale Webhook Handler)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@twicely/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@twicely/db/schema', () => ({
  channelProjection: {
    id: 'id',
    listingId: 'listing_id',
    status: 'status',
    channel: 'channel',
    externalId: 'external_id',
  },
}));

vi.mock('@twicely/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_a: unknown, _b: unknown) => ({ type: 'eq', a: _a, b: _b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('../../services/sale-detection', () => ({
  handleDetectedSale: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/platform-fees', () => ({
  getPlatformFeeRate: vi.fn().mockResolvedValue(1000), // 10% = 1000 bps
  calculatePlatformFee: vi.fn().mockReturnValue(499),  // 4.99 for $49.99 sale
}));

import { db } from '@twicely/db';
import { handleDetectedSale } from '../../services/sale-detection';
import { getPlatformFeeRate, calculatePlatformFee } from '../../services/platform-fees';
import { handleWhatnotSaleWebhook } from '../sale-webhook-handler';
import type { WhatnotWebhookEnvelope } from '../../connectors/whatnot-types';

/** Build a valid order.completed envelope */
function makeEnvelope(overrides: Partial<Record<string, unknown>> = {}): WhatnotWebhookEnvelope {
  return {
    eventId: 'evt-whatnot-001',
    eventType: 'order.completed',
    createdAt: '2025-01-15T12:00:00Z',
    data: {
      orderId: 'wn-order-123',
      listingId: 'wn-listing-456',
      price: { amount: '49.99', currencyCode: 'USD' },
      buyer: { id: 'buyer-wn-789', username: 'collector_jane' },
      completedAt: '2025-01-15T11:55:00Z',
      ...overrides,
    },
  };
}

/** Set up DB mock to return a found projection */
function mockFoundProjection(proj = {
  id: 'proj-wn-001',
  listingId: 'listing-twicely-abc',
  status: 'ACTIVE',
}) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([proj]),
      }),
    }),
  } as never);
}

/** Set up DB mock to return no projection (not managed by Twicely) */
function mockNotFound() {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as never);
}

describe('handleWhatnotSaleWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handleDetectedSale with correct DetectedSale shape when projection found', async () => {
    mockFoundProjection();
    vi.mocked(getPlatformFeeRate).mockResolvedValue(1000);
    vi.mocked(calculatePlatformFee).mockReturnValue(499);

    await handleWhatnotSaleWebhook(makeEnvelope());

    expect(handleDetectedSale).toHaveBeenCalledOnce();
    expect(handleDetectedSale).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: 'listing-twicely-abc',
        projectionId: 'proj-wn-001',
        channel: 'WHATNOT',
        externalOrderId: 'wn-order-123',
        salePriceCents: 4999,
        platformFeeCents: 499,
        buyerUsername: 'collector_jane',
      }),
    );
  });

  it('passes soldAt as Date parsed from data.completedAt', async () => {
    mockFoundProjection();

    await handleWhatnotSaleWebhook(makeEnvelope());

    const call = vi.mocked(handleDetectedSale).mock.calls[0];
    const arg = call![0];
    expect(arg.soldAt).toBeInstanceOf(Date);
    expect(arg.soldAt.toISOString()).toBe('2025-01-15T11:55:00.000Z');
  });

  it('skips silently when projection not found in DB', async () => {
    mockNotFound();

    await handleWhatnotSaleWebhook(makeEnvelope());

    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('logs warning and returns without calling handleDetectedSale on invalid Zod data (missing orderId)', async () => {
    const envelope = makeEnvelope();
    // Remove orderId from data to fail Zod validation
    const badData = { ...envelope.data } as Record<string, unknown>;
    delete badData.orderId;
    const badEnvelope: WhatnotWebhookEnvelope = { ...envelope, data: badData };

    await handleWhatnotSaleWebhook(badEnvelope);

    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('logs warning and returns without calling handleDetectedSale when price is zero', async () => {
    const zeroEnvelope = makeEnvelope({ price: { amount: '0', currencyCode: 'USD' } });

    await handleWhatnotSaleWebhook(zeroEnvelope);

    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('logs warning and returns without calling handleDetectedSale when price is non-numeric', async () => {
    const badPriceEnvelope = makeEnvelope({ price: { amount: 'abc', currencyCode: 'USD' } });

    await handleWhatnotSaleWebhook(badPriceEnvelope);

    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('correctly converts Whatnot Money type "49.99" to 4999 cents', async () => {
    mockFoundProjection();

    await handleWhatnotSaleWebhook(makeEnvelope());

    const call = vi.mocked(handleDetectedSale).mock.calls[0];
    const arg = call![0];
    expect(arg.salePriceCents).toBe(4999);
  });

  it('uses getPlatformFeeRate("WHATNOT") for fee calculation — not hardcoded', async () => {
    mockFoundProjection();
    vi.mocked(getPlatformFeeRate).mockResolvedValue(1500);
    vi.mocked(calculatePlatformFee).mockReturnValue(750);

    await handleWhatnotSaleWebhook(makeEnvelope());

    expect(getPlatformFeeRate).toHaveBeenCalledWith('WHATNOT');
    expect(calculatePlatformFee).toHaveBeenCalledWith(4999, 1500);
  });

  it('passes buyerUsername from data.buyer.username', async () => {
    mockFoundProjection();

    await handleWhatnotSaleWebhook(makeEnvelope());

    const call = vi.mocked(handleDetectedSale).mock.calls[0];
    const arg = call![0];
    expect(arg.buyerUsername).toBe('collector_jane');
  });

  it('logs warning and skips when price is negative (e.g., "-5.00")', async () => {
    // parseMoneyToCents('-5.00') = -500, which satisfies salePriceCents <= 0
    const negativeEnvelope = makeEnvelope({ price: { amount: '-5.00', currencyCode: 'USD' } });

    await handleWhatnotSaleWebhook(negativeEnvelope);

    expect(handleDetectedSale).not.toHaveBeenCalled();
  });

  it('propagates thrown error from getPlatformFeeRate up to the caller', async () => {
    // The handler has no try/catch around getPlatformFeeRate — errors propagate.
    // The route wraps the handler call in try/catch to prevent retry storms.
    mockFoundProjection();
    vi.mocked(getPlatformFeeRate).mockRejectedValue(new Error('DB unavailable'));

    await expect(handleWhatnotSaleWebhook(makeEnvelope())).rejects.toThrow('DB unavailable');
    expect(handleDetectedSale).not.toHaveBeenCalled();
  });
});
